"""
SuperDial Hub - BLE Manager
Gerencia a comunicação assíncrona Bluetooth Low Energy com o ESP32-C5 (SuperDial-Pro) via Bleak.
"""

import asyncio
import logging
import threading
from typing import Callable, Optional, Tuple
from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice

logger = logging.getLogger("SuperDial.BLE")

# UUIDs Oficiais do SuperDial-Pro
SERVICE_UUID = "0000FDF0-0000-1000-8000-00805F9B34FB"
CHAR_VOLUME_SYNC = "0000FDF1-0000-1000-8000-00805F9B34FB"  # Read / Write / Notify
CHAR_ARGB_STUDIO = "0000FDF2-0000-1000-8000-00805F9B34FB"  # Write (3 bytes RGB)
CHAR_MODE_STATUS = "0000FDF3-0000-1000-8000-00805F9B34FB"  # Read / Write / Notify (1 a 7)
CHAR_ACTION_EVENT = "0000FDF4-0000-1000-8000-00805F9B34FB" # Read / Notify (3 bytes)

DEVICE_NAME = "SuperDial-Pro"


class BleManager:
    """
    Gerenciador BLE com reconexão silenciosa contínua e processamento de eventos.
    Executado em thread secundária com event loop asyncio dedicado.
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
        self.on_mode_change: Optional[Callable[[int], None]] = None
        self.on_action_event: Optional[Callable[[int, int, int], None]] = None
        self.on_volume_sync: Optional[Callable[[int, bool], None]] = None

    @property
    def is_connected(self) -> bool:
        return self._is_connected and self._client is not None and self._client.is_connected

    def start(self):
        """Inicia a thread de background e o loop de eventos asyncio."""
        if self._is_running:
            return
        self._is_running = True
        self._thread = threading.Thread(target=self._thread_worker, name="SuperDial-BLE-Thread", daemon=True)
        self._thread.start()
        logger.info("BLE Manager iniciado em thread de background.")

    def stop(self):
        """Para o serviço BLE e desconecta de forma segura."""
        self._is_running = False
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self._async_disconnect(), self._loop)
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        self._is_connected = False
        logger.info("BLE Manager finalizado.")

    def _thread_worker(self):
        """Worker do loop asyncio."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._supervisor_loop())
        except Exception as e:
            logger.error(f"Exceção no supervisor BLE: {e}")
        finally:
            self._loop.close()

    async def _supervisor_loop(self):
        """Loop de supervisão: busca, conecta e reconecta silenciosamente."""
        while self._is_running:
            if not self.is_connected:
                self._update_status(False, "Buscando SuperDial-Pro...")
                device = await self._scan_device()

                if device and self._is_running:
                    self._update_status(False, f"Conectando a {device.name or DEVICE_NAME}...")
                    connected = await self._connect_device(device)
                    if connected:
                        self._last_device_address = device.address
                        while self._is_running and self.is_connected:
                            await asyncio.sleep(0.5)

            if self._is_running:
                await asyncio.sleep(self._reconnect_delay)

    async def _scan_device(self) -> Optional[BLEDevice]:
        """Procura o SuperDial-Pro por nome ou UUID de serviço."""
        try:
            devices = await BleakScanner.discover(timeout=2.5)
            for d in devices:
                name = d.name or ""
                if DEVICE_NAME.lower() in name.lower() or "superdial" in name.lower():
                    logger.info(f"Dispositivo detectado: {name} [{d.address}]")
                    return d

            if self._last_device_address:
                try:
                    dev = await BleakScanner.find_device_by_address(self._last_device_address, timeout=1.5)
                    if dev:
                        return dev
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"Scan BLE notice: {e}")

        return None

    def _on_disconnected_callback(self, client: BleakClient):
        """Callback acionado pelo Bleak na desconexão."""
        logger.warning("SuperDial-Pro desconectado.")
        self._is_connected = False
        self._update_status(False, "Desconectado. Aguardando reconexão...")

    async def _connect_device(self, device: BLEDevice) -> bool:
        """Estabelece a conexão e subscreve nas características oficiais."""
        try:
            self._client = BleakClient(device, disconnected_callback=self._on_disconnected_callback)
            await self._client.connect(timeout=8.0)

            if not self._client.is_connected:
                return False

            self._is_connected = True
            logger.info(f"Conexão estabelecida com {DEVICE_NAME}!")

            # 1. Inscrição na CHAR 4 (Action Event: 3 bytes)
            try:
                await self._client.start_notify(CHAR_ACTION_EVENT, self._handle_action_notification)
                logger.info("Inscrito em CHAR 4 (Action Event).")
            except Exception as e:
                logger.warning(f"Falha ao subscrever CHAR_ACTION_EVENT: {e}")

            # 2. Inscrição na CHAR 3 (Mode Status: 1 byte, 1 a 7)
            try:
                await self._client.start_notify(CHAR_MODE_STATUS, self._handle_mode_notification)
                logger.info("Inscrito em CHAR 3 (Mode Status).")
            except Exception as e:
                logger.warning(f"Falha ao subscrever CHAR_MODE_STATUS: {e}")

            # 3. Inscrição na CHAR 1 (Volume Sync)
            try:
                await self._client.start_notify(CHAR_VOLUME_SYNC, self._handle_volume_notification)
                logger.info("Inscrito em CHAR 1 (Volume Sync).")
            except Exception as e:
                logger.warning(f"Falha ao subscrever CHAR_VOLUME_SYNC: {e}")

            # Lê o modo atual da placa na inicialização
            try:
                mode_data = await self._client.read_gatt_char(CHAR_MODE_STATUS)
                if mode_data and len(mode_data) >= 1:
                    initial_mode = int(mode_data[0])
                    if self.on_mode_change:
                        self.on_mode_change(initial_mode)
            except Exception as e:
                logger.debug(f"Leitura inicial do modo: {e}")

            self._update_status(True, "Conectado ao SuperDial-Pro")
            return True

        except Exception as e:
            logger.warning(f"Falha na conexão com {DEVICE_NAME}: {e}")
            self._is_connected = False
            return False

    async def _async_disconnect(self):
        """Desconecta o cliente BLE."""
        if self._client and self._client.is_connected:
            try:
                await self._client.disconnect()
            except Exception:
                pass
        self._client = None
        self._is_connected = False

    # =========================================================================
    # HANDLERS DE NOTIFICAÇÕES RECEBIDAS
    # =========================================================================

    def _handle_action_notification(self, sender, data: bytearray):
        """
        Processa notificação de ação recebida da CHAR 4 (3 bytes):
        - Byte 0: Tipo de Ação (1 = Horário / +, 2 = Anti-Horário / -, 3 = Clique)
        - Byte 1: Modo Ativo (1 a 7)
        - Byte 2: Passos (1)
        """
        try:
            if len(data) >= 3:
                action_type = int(data[0])
                mode = int(data[1])
                steps = int(data[2])
                logger.debug(f"BLE Action Event: Tipo={action_type}, Modo={mode}, Passos={steps}")
                if self.on_action_event:
                    self.on_action_event(action_type, mode, steps)
        except Exception as e:
            logger.error(f"Erro ao processar CHAR 4 (Action Event): {e}")

    def _handle_mode_notification(self, sender, data: bytearray):
        """
        Processa notificação de mudança de modo vinda da placa (CHAR 3):
        Disparado quando o usuário segura o botão físico na placa.
        """
        try:
            if len(data) >= 1:
                mode = int(data[0])
                logger.info(f"BLE Mode Status Notif: Modo={mode}")
                if self.on_mode_change:
                    self.on_mode_change(mode)
        except Exception as e:
            logger.error(f"Erro ao processar CHAR 3 (Mode Status): {e}")

    def _handle_volume_notification(self, sender, data: bytearray):
        """Processa notificação de volume (CHAR 1)."""
        try:
            if len(data) >= 1:
                vol = int(data[0])
                mute = bool(data[1] == 1) if len(data) >= 2 else False
                if self.on_volume_sync:
                    self.on_volume_sync(vol, mute)
        except Exception as e:
            logger.error(f"Erro ao processar CHAR 1 (Volume Sync): {e}")

    def _update_status(self, connected: bool, message: str):
        self._is_connected = connected
        if self.on_connection_change:
            try:
                self.on_connection_change(connected, message)
            except Exception as e:
                logger.error(f"Erro no status callback: {e}")

    # =========================================================================
    # MÉTODOS PÚBLICOS THREAD-SAFE (Envio para a placa)
    # =========================================================================

    def send_volume(self, volume: int, is_muted: bool = False):
        """
        Envia o volume do Windows (0 a 100) para a CHAR 1 (Volume Sync)
        para atualizar os LEDs da placa.
        """
        if not self.is_connected or not self._loop:
            return
        vol = max(0, min(100, int(volume)))
        payload = bytes([vol, 1 if is_muted else 0])
        asyncio.run_coroutine_threadsafe(self._write_char(CHAR_VOLUME_SYNC, payload), self._loop)

    def send_rgb(self, r: int, g: int, b: int):
        """
        Envia comandos de cores RGB (3 bytes) para CHAR 2 (ARGB Studio).
        """
        if not self.is_connected or not self._loop:
            return
        r = max(0, min(255, int(r)))
        g = max(0, min(255, int(g)))
        b = max(0, min(255, int(b)))
        payload = bytes([r, g, b])
        asyncio.run_coroutine_threadsafe(self._write_char(CHAR_ARGB_STUDIO, payload), self._loop)

    def send_mode(self, mode: int):
        """
        Envia seleção de modo ativo (1 byte, 1 a 7) para a CHAR 3 (Mode Status).
        A placa atualiza os LEDs e modo instantaneamente.
        """
        if not self.is_connected or not self._loop:
            return
        mode = max(1, min(7, int(mode)))
        payload = bytes([mode])
        asyncio.run_coroutine_threadsafe(self._write_char(CHAR_MODE_STATUS, payload), self._loop)

    async def _write_char(self, char_uuid: str, payload: bytes):
        """Escrita assíncrona protegida."""
        try:
            if self._client and self._client.is_connected:
                await self._client.write_gatt_char(char_uuid, payload, response=False)
        except Exception as e:
            logger.debug(f"Falha ao escrever na característica {char_uuid}: {e}")
