"""
SuperDial Hub - BLE Service
Gerencia a comunicação assíncrona com o ESP32-C5 (SuperDial-Pro) via bleak (WinRT nativo).
"""

import asyncio
import logging
import struct
import threading
from typing import Callable, Optional, Tuple
from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice

logger = logging.getLogger("SuperDial.BLE")

# UUIDs Oficiais do SuperDial-Pro
SERVICE_UUID = "0000FDF0-0000-1000-8000-00805F9B34FB"
CHAR_VOLUME_SYNC = "0000FDF1-0000-1000-8000-00805F9B34FB"  # Read / Write / Notify
CHAR_ARGB_STUDIO = "0000FDF2-0000-1000-8000-00805F9B34FB"  # Write
CHAR_MODE_STATUS = "0000FDF3-0000-1000-8000-00805F9B34FB"  # Read / Write / Notify

DEVICE_NAME = "SuperDial-Pro"


class BleService:
    """
    Serviço BLE assíncrono executado em thread dedicada.
    Oferece reconexão automática contínua e métodos thread-safe para envio de comandos.
    """

    def __init__(self):
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._client: Optional[BleakClient] = None
        self._is_running = False
        self._is_connected = False
        self._reconnect_delay = 2.0
        self._last_device_address: Optional[str] = None

        # Callbacks para o orquestrador
        self.on_connection_change: Optional[Callable[[bool, str], None]] = None
        self.on_volume_received: Optional[Callable[[int, bool], None]] = None
        self.on_mode_received: Optional[Callable[[int], None]] = None

    @property
    def is_connected(self) -> bool:
        return self._is_connected and self._client is not None and self._client.is_connected

    def start(self):
        """Inicia a thread de background e o loop de eventos asyncio."""
        if self._is_running:
            return
        self._is_running = True
        self._thread = threading.Thread(target=self._thread_worker, name="SuperDial-BLE-Worker", daemon=True)
        self._thread.start()
        logger.info("Thread de serviço BLE iniciada.")

    def stop(self):
        """Para o serviço BLE e desconecta de forma segura."""
        self._is_running = False
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self._async_disconnect(), self._loop)
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        self._is_connected = False
        logger.info("Serviço BLE finalizado.")

    def _thread_worker(self):
        """Worker que roda o loop asyncio."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._connection_supervisor())
        except Exception as e:
            logger.error(f"Erro no supervisor BLE: {e}")
        finally:
            self._loop.close()

    async def _connection_supervisor(self):
        """Loop de supervisão: busca, conecta e reconecta silenciosamente."""
        while self._is_running:
            if not self.is_connected:
                self._update_status(False, "Buscando SuperDial-Pro...")
                device = await self._scan_for_device()

                if device and self._is_running:
                    self._update_status(False, f"Conectando a {device.name or 'SuperDial-Pro'}...")
                    connected = await self._connect_device(device)
                    if connected:
                        self._last_device_address = device.address
                        # Aguarda enquanto estiver conectado
                        while self._is_running and self.is_connected:
                            await asyncio.sleep(0.5)

            if self._is_running:
                await asyncio.sleep(self._reconnect_delay)

    async def _scan_for_device(self) -> Optional[BLEDevice]:
        """Procura pelo dispositivo SuperDial-Pro por nome ou UUID de serviço."""
        try:
            # Varredura rápida de 2.5s
            devices = await BleakScanner.discover(timeout=2.5)
            for d in devices:
                name = d.name or ""
                if DEVICE_NAME.lower() in name.lower() or "superdial" in name.lower():
                    logger.info(f"Dispositivo encontrado: {name} [{d.address}]")
                    return d

            # Se tínhamos o endereço salvo, tenta conectar diretamente
            if self._last_device_address:
                try:
                    dev = await BleakScanner.find_device_by_address(self._last_device_address, timeout=1.5)
                    if dev:
                        return dev
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"Aviso durante scan BLE: {e}")

        return None

    def _on_device_disconnected(self, client: BleakClient):
        """Callback acionado pelo bleak em caso de queda de conexão."""
        logger.warning("SuperDial-Pro desconectado.")
        self._is_connected = False
        self._update_status(False, "Desconectado. Aguardando reconexão...")

    async def _connect_device(self, device: BLEDevice) -> bool:
        """Conecta ao dispositivo e ativa subscrições."""
        try:
            self._client = BleakClient(device, disconnected_callback=self._on_device_disconnected)
            await self._client.connect(timeout=8.0)

            if not self._client.is_connected:
                return False

            self._is_connected = True
            logger.info(f"Conectado com sucesso ao {DEVICE_NAME}!")

            # Inscreve nas notificações de volume
            try:
                await self._client.start_notify(CHAR_VOLUME_SYNC, self._handle_volume_notification)
            except Exception as e:
                logger.warning(f"Não foi possível assinar CHAR_VOLUME_SYNC: {e}")

            # Inscreve nas notificações de modo
            try:
                await self._client.start_notify(CHAR_MODE_STATUS, self._handle_mode_notification)
            except Exception as e:
                logger.warning(f"Não foi possível assinar CHAR_MODE_STATUS: {e}")

            # Lê o modo atual do dial
            try:
                mode_bytes = await self._client.read_gatt_char(CHAR_MODE_STATUS)
                if mode_bytes and len(mode_bytes) > 0:
                    current_mode = int(mode_bytes[0])
                    if self.on_mode_received:
                        self.on_mode_received(current_mode)
            except Exception as e:
                logger.debug(f"Leitura inicial do modo: {e}")

            self._update_status(True, "Conectado ao SuperDial-Pro")
            return True

        except Exception as e:
            logger.warning(f"Falha ao conectar com o SuperDial-Pro: {e}")
            self._is_connected = False
            return False

    async def _async_disconnect(self):
        """Desconecta o cliente BLE de forma segura."""
        if self._client and self._client.is_connected:
            try:
                await self._client.disconnect()
            except Exception:
                pass
        self._client = None
        self._is_connected = False

    def _handle_volume_notification(self, sender, data: bytearray):
        """Processa notificação de giro/mute recebida do SuperDial-Pro."""
        try:
            if len(data) >= 2:
                volume = int(data[0])
                is_muted = bool(data[1] == 1)
                logger.debug(f"BLE Notif Volume: {volume}%, Mute={is_muted}")
                if self.on_volume_received:
                    self.on_volume_received(volume, is_muted)
        except Exception as e:
            logger.error(f"Erro ao processar notificação de volume BLE: {e}")

    def _handle_mode_notification(self, sender, data: bytearray):
        """Processa notificação de mudança de modo vinda do SuperDial-Pro."""
        try:
            if len(data) >= 1:
                mode = int(data[0])
                logger.info(f"BLE Notif Modo: {mode}")
                if self.on_mode_received:
                    self.on_mode_received(mode)
        except Exception as e:
            logger.error(f"Erro ao processar notificação de modo BLE: {e}")

    def _update_status(self, connected: bool, message: str):
        """Dispara callback de status para a UI."""
        self._is_connected = connected
        if self.on_connection_change:
            try:
                self.on_connection_change(connected, message)
            except Exception as e:
                logger.error(f"Erro em on_connection_change: {e}")

    # =========================================================================
    # MÉTODOS PÚBLICOS THREAD-SAFE (Chamados pela UI ou Áudio)
    # =========================================================================

    def send_volume(self, volume: int, is_muted: bool):
        """
        Envia o estado de volume do Windows para o ESP32 (2 bytes):
        Byte 0: Volume (0 a 100)
        Byte 1: Mudo (0 = normal, 1 = mudo)
        """
        if not self.is_connected or not self._loop:
            return

        payload = bytes([max(0, min(100, volume)), 1 if is_muted else 0])
        asyncio.run_coroutine_threadsafe(self._write_char(CHAR_VOLUME_SYNC, payload), self._loop)

    def send_argb_config(
        self,
        effect: int,
        color1: Tuple[int, int, int],
        color2: Tuple[int, int, int],
        brightness: int,
        speed: int,
    ):
        """
        Envia pacote de configuração para os 8 LEDs ARGB (9 bytes):
        Byte 0: Efeito (0 a 14)
        Byte 1..3: Cor 1 RGB (3 bytes)
        Byte 4..6: Cor 2 RGB (3 bytes)
        Byte 7: Brilho (0 a 100)
        Byte 8: Velocidade (1 a 100)
        """
        if not self.is_connected or not self._loop:
            return

        effect = max(0, min(14, int(effect)))
        r1, g1, b1 = [max(0, min(255, c)) for c in color1]
        r2, g2, b2 = [max(0, min(255, c)) for c in color2]
        brightness = max(0, min(100, int(brightness)))
        speed = max(1, min(100, int(speed)))

        payload = struct.pack("BBBBBBBBB", effect, r1, g1, b1, r2, g2, b2, brightness, speed)
        asyncio.run_coroutine_threadsafe(self._write_char(CHAR_ARGB_STUDIO, payload), self._loop)

    def send_mode(self, mode: int):
        """
        Envia seleção de modo de trabalho ativo (1 a 6).
        Byte 0: Modo (1 a 6)
        """
        if not self.is_connected or not self._loop:
            return

        mode = max(1, min(6, int(mode)))
        payload = bytes([mode])
        asyncio.run_coroutine_threadsafe(self._write_char(CHAR_MODE_STATUS, payload), self._loop)

    async def _write_char(self, char_uuid: str, payload: bytes):
        """Escreve dados de forma assíncrona em uma característica BLE."""
        try:
            if self._client and self._client.is_connected:
                await self._client.write_gatt_char(char_uuid, payload, response=False)
        except Exception as e:
            logger.debug(f"Falha ao escrever na característica {char_uuid}: {e}")
