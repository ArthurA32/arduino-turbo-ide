"""
SuperDial Hub - BLE & Serial Dual-Connection Manager
Gerencia a conexão assíncrona Bluetooth Low Energy com o ESP32-C5 (SuperDial-Pro) via Bleak
e suporte a conexão direta USB Serial (Auto-Detect).
"""

import asyncio
import logging
import threading
import time
from typing import Callable, Optional, Tuple
from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice
import serial.tools.list_ports
import serial

logger = logging.getLogger("SuperDial.BLE")

# UUIDs Oficiais do SuperDial-Pro
SERVICE_UUID = "0000FDF0-0000-1000-8000-00805F9B34FB"
CHAR_VOLUME_SYNC = "0000FDF1-0000-1000-8000-00805F9B34FB"  # Read / Write / Notify
CHAR_ARGB_STUDIO = "0000FDF2-0000-1000-8000-00805F9B34FB"  # Write (3 bytes RGB)
CHAR_MODE_STATUS = "0000FDF3-0000-1000-8000-00805F9B34FB"  # Read / Write / Notify (1 a 7)
CHAR_ACTION_EVENT = "0000FDF4-0000-1000-8000-00805F9B34FB" # Read / Notify (3 bytes)

DEVICE_NAME = "SuperDial-Pro"
KNOWN_MAC_ADDRESS = "D0:CF:13:EB:61:0A"


class BleManager:
    """
    Gerenciador de Conexão Híbrido:
    - Escaneamento Ativo BLE (Bleak active scanning)
    - Conexão direta por endereço MAC / UUID
    - Reconexão silenciosa contínua
    - Escuta paralela de portas USB Serial (COM) caso a placa esteja no cabo
    """

    def __init__(self):
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._ble_thread: Optional[threading.Thread] = None
        self._serial_thread: Optional[threading.Thread] = None
        self._client: Optional[BleakClient] = None
        self._serial_conn: Optional[serial.Serial] = None

        self._is_running = False
        self._is_connected_ble = False
        self._is_connected_serial = False
        self._connection_type = "none"  # "ble", "serial", "none"
        self._last_device_address: str = KNOWN_MAC_ADDRESS

        # Callbacks para a UI e Actions
        self.on_connection_change: Optional[Callable[[bool, str], None]] = None
        self.on_mode_change: Optional[Callable[[int], None]] = None
        self.on_action_event: Optional[Callable[[int, int, int], None]] = None
        self.on_volume_sync: Optional[Callable[[int, bool], None]] = None

    @property
    def is_connected(self) -> bool:
        return self._is_connected_ble or self._is_connected_serial

    def start(self):
        """Inicia os loops de supervisão BLE e USB Serial."""
        if self._is_running:
            return
        self._is_running = True

        # Inicia thread BLE
        self._ble_thread = threading.Thread(target=self._ble_worker, name="SuperDial-BLE-Worker", daemon=True)
        self._ble_thread.start()

        # Inicia thread USB Serial (Dual-Channel)
        self._serial_thread = threading.Thread(target=self._serial_worker, name="SuperDial-Serial-Worker", daemon=True)
        self._serial_thread.start()

        logger.info("BLE & Serial Manager iniciado.")

    def stop(self):
        """Para todos os serviços e desconecta de forma segura."""
        self._is_running = False

        # Desconecta BLE
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self._async_disconnect_ble(), self._loop)
            self._loop.call_soon_threadsafe(self._loop.stop)

        # Fecha Serial
        if self._serial_conn:
            try:
                self._serial_conn.close()
            except Exception:
                pass
            self._serial_conn = None

        self._is_connected_ble = False
        self._is_connected_serial = False
        logger.info("Manager finalizado.")

    # =========================================================================
    # 1. GERENCIAMENTO BLUETOOTH BLE (ATIVO + MULTIVETORIAL)
    # =========================================================================

    def _ble_worker(self):
        """Worker do loop asyncio para BLE."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._ble_supervisor())
        except Exception as e:
            logger.error(f"Erro no supervisor BLE: {e}")
        finally:
            self._loop.close()

    async def _ble_supervisor(self):
        """Supervisão BLE com busca ativa e reconexão silenciosa contínua."""
        while self._is_running:
            if not self.is_connected:
                self._update_status(False, "Buscando SuperDial-Pro (BLE / USB)...")
                device = await self._find_target_device()

                if device and self._is_running:
                    self._update_status(False, f"Conectando a {device.name or DEVICE_NAME}...")
                    connected = await self._connect_ble(device)
                    if connected:
                        self._last_device_address = device.address
                        while self._is_running and self._is_connected_ble:
                            await asyncio.sleep(0.5)

            if self._is_running:
                await asyncio.sleep(2.0)

    async def _find_target_device(self) -> Optional[BLEDevice]:
        """
        Varredura ativa multivetor:
        1. Varredura com modo 'active' para capturar Scan Response
        2. Correspondência por Nome, UUID de Serviço ou Endereço MAC conhecido
        3. Tentativa direta pelo MAC address conhecido
        """
        found_device: Optional[BLEDevice] = None

        def detection_callback(device: BLEDevice, adv_data):
            nonlocal found_device
            if found_device is not None:
                return

            name = (device.name or adv_data.local_name or "").strip()
            mac = (device.address or "").upper()
            uuids = [str(u).upper() for u in (adv_data.service_uuids or [])]

            # Critérios de correspondência
            name_match = (DEVICE_NAME.lower() in name.lower() or "superdial" in name.lower())
            mac_match = (mac == KNOWN_MAC_ADDRESS.upper())
            uuid_match = (SERVICE_UUID.upper() in uuids)

            if name_match or mac_match or uuid_match:
                logger.info(f"SuperDial-Pro encontrado via BLE! Nome: '{name}' | MAC: {mac}")
                found_device = device

        try:
            scanner = BleakScanner(detection_callback=detection_callback, scanning_mode="active")
            await scanner.start()
            for _ in range(30):  # até 3 segundos de escuta ativa
                if found_device is not None or not self._is_running:
                    break
                await asyncio.sleep(0.1)
            await scanner.stop()

            if found_device:
                return found_device

        except Exception as e:
            logger.debug(f"Aviso no scan BLE: {e}")

        # Vetor 2: Tentativa direta pelo MAC address
        if self._last_device_address:
            try:
                dev = await BleakScanner.find_device_by_address(self._last_device_address, timeout=1.5)
                if dev:
                    logger.info(f"SuperDial-Pro localizado diretamente por MAC: {dev.address}")
                    return dev
            except Exception:
                pass

        return None

    async def _connect_ble(self, device: BLEDevice) -> bool:
        """Conecta via GATT ao SuperDial-Pro e subscreve nas 3 características."""
        try:
            self._client = BleakClient(device, disconnected_callback=self._on_ble_disconnected)
            await self._client.connect(timeout=8.0)

            if not self._client.is_connected:
                return False

            self._is_connected_ble = True
            self._connection_type = "ble"
            logger.info(f"Conectado via BLE ao {DEVICE_NAME} ({device.address})!")

            # 1. Inscrição na CHAR 4 (Action Event de 3 bytes: tipo, modo, valor)
            try:
                await self._client.start_notify(CHAR_ACTION_EVENT, self._handle_action_notification)
                logger.info("Subscrição CHAR 4 (Action Event) ativa.")
            except Exception as e:
                logger.warning(f"Aviso CHAR 4: {e}")

            # 2. Inscrição na CHAR 3 (Mode Status - bidirecional)
            try:
                await self._client.start_notify(CHAR_MODE_STATUS, self._handle_mode_notification)
                logger.info("Subscrição CHAR 3 (Mode Status) ativa.")
            except Exception as e:
                logger.warning(f"Aviso CHAR 3: {e}")

            # 3. Inscrição na CHAR 1 (Volume Sync)
            try:
                await self._client.start_notify(CHAR_VOLUME_SYNC, self._handle_volume_notification)
                logger.info("Subscrição CHAR 1 (Volume Sync) ativa.")
            except Exception as e:
                logger.warning(f"Aviso CHAR 1: {e}")

            # Lê modo atual
            try:
                m_data = await self._client.read_gatt_char(CHAR_MODE_STATUS)
                if m_data and len(m_data) >= 1:
                    if self.on_mode_change:
                        self.on_mode_change(int(m_data[0]))
            except Exception:
                pass

            self._update_status(True, f"Conectado via Bluetooth BLE ({device.address})")
            return True

        except Exception as e:
            logger.warning(f"Falha ao conectar BLE: {e}")
            self._is_connected_ble = False
            return False

    def _on_ble_disconnected(self, client: BleakClient):
        logger.warning("Conexão BLE perdida.")
        self._is_connected_ble = False
        if not self._is_connected_serial:
            self._connection_type = "none"
            self._update_status(False, "Desconectado. Aguardando reconexão...")

    async def _async_disconnect_ble(self):
        if self._client and self._client.is_connected:
            try:
                await self._client.disconnect()
            except Exception:
                pass
        self._client = None
        self._is_connected_ble = False

    def _handle_action_notification(self, sender, data: bytearray):
        """Recebe notificação da CHAR 4 (tipo, modo, valor)."""
        try:
            if len(data) >= 3:
                action_type = int(data[0])
                mode = int(data[1])
                val = int(data[2])
                if self.on_action_event:
                    self.on_action_event(action_type, mode, val)
        except Exception as e:
            logger.error(f"Erro em CHAR 4: {e}")

    def _handle_mode_notification(self, sender, data: bytearray):
        """Recebe troca de modo da CHAR 3."""
        try:
            if len(data) >= 1:
                mode = int(data[0])
                if self.on_mode_change:
                    self.on_mode_change(mode)
        except Exception as e:
            logger.error(f"Erro em CHAR 3: {e}")

    def _handle_volume_notification(self, sender, data: bytearray):
        """Recebe notificação de volume da CHAR 1."""
        try:
            if len(data) >= 1:
                vol = int(data[0])
                mute = bool(data[1] == 1) if len(data) >= 2 else False
                if self.on_volume_sync:
                    self.on_volume_sync(vol, mute)
        except Exception as e:
            logger.error(f"Erro em CHAR 1: {e}")

    # =========================================================================
    # 2. SUPORTE A USB SERIAL DUAL-CHANNEL (Auto-Detect de Portas COM)
    # =========================================================================

    def _serial_worker(self):
        """Monitora portas COM a 115200 baud em busca de pacotes [DIAL]."""
        while self._is_running:
            if not self._is_connected_serial:
                ports = serial.tools.list_ports.comports()
                for p in ports:
                    # Ignora portas bluetooth virtuais seriais genéricas que travam
                    if "bluetooth" in p.description.lower() or "bth" in p.hwid.lower():
                        continue
                    if p.device == "COM1":
                        continue

                    try:
                        ser = serial.Serial(p.device, 115200, timeout=0.2)
                        time.sleep(0.1)
                        # Lê linha para testar
                        line = ser.readline().decode("utf-8", errors="ignore").strip()
                        if "[DIAL]" in line or "SUPERDIAL" in line or "SuperDial" in line:
                            logger.info(f"SuperDial-Pro detectado via USB Serial na porta {p.device}!")
                            self._serial_conn = ser
                            self._is_connected_serial = True
                            self._connection_type = "serial"
                            self._update_status(True, f"Conectado via USB ({p.device})")
                            self._read_serial_loop()
                            break
                        else:
                            ser.close()
                    except Exception:
                        pass

            time.sleep(3.0)

    def _read_serial_loop(self):
        """Lê eventos vindos da Serial USB."""
        while self._is_running and self._is_connected_serial and self._serial_conn:
            try:
                line = self._serial_conn.readline().decode("utf-8", errors="ignore").strip()
                if not line:
                    continue

                # Exemplo: [DIAL] EVENT:1,MODE:1,VAL:32
                if "[DIAL] EVENT:" in line:
                    parts = line.split("[DIAL] EVENT:")[1].split(",")
                    tipo = int(parts[0])
                    modo = int(parts[1].split(":")[1])
                    val = int(parts[2].split(":")[1])
                    if self.on_action_event:
                        self.on_action_event(tipo, modo, val)

                # Exemplo: [DIAL] MODE_CHANGED:2,Alt+Tab
                elif "[DIAL] MODE_CHANGED:" in line:
                    mode_str = line.split("[DIAL] MODE_CHANGED:")[1].split(",")[0]
                    mode = int(mode_str)
                    if self.on_mode_change:
                        self.on_mode_change(mode)

            except Exception as e:
                logger.debug(f"Desconexão serial: {e}")
                break

        if self._serial_conn:
            try:
                self._serial_conn.close()
            except Exception:
                pass
            self._serial_conn = None
        self._is_connected_serial = False
        if not self._is_connected_ble:
            self._connection_type = "none"
            self._update_status(False, "Desconectado. Aguardando reconexão...")

    # =========================================================================
    # 3. MÉTODOS DE ENVIO (Thread-Safe)
    # =========================================================================

    def send_volume(self, volume: int, is_muted: bool = False):
        """Envia volume para a placa (CHAR 1 via BLE ou Serial USB)."""
        vol = max(0, min(100, int(volume)))

        # Envia via BLE
        if self._is_connected_ble and self._loop:
            payload = bytes([vol, 1 if is_muted else 0])
            asyncio.run_coroutine_threadsafe(self._write_char(CHAR_VOLUME_SYNC, payload), self._loop)

        # Envia via Serial
        if self._is_connected_serial and self._serial_conn:
            try:
                self._serial_conn.write(f"VOL:{vol}\n".encode())
            except Exception:
                pass

    def send_rgb(self, r: int, g: int, b: int):
        """Envia 3 bytes RGB para a CHAR 2 (ARGB Studio)."""
        if self._is_connected_ble and self._loop:
            payload = bytes([max(0, min(255, int(c))) for c in (r, g, b)])
            asyncio.run_coroutine_threadsafe(self._write_char(CHAR_ARGB_STUDIO, payload), self._loop)

    def send_mode(self, mode: int):
        """Envia 1 byte (1 a 7) para a CHAR 3 (Mode Status)."""
        mode = max(1, min(7, int(mode)))

        if self._is_connected_ble and self._loop:
            payload = bytes([mode])
            asyncio.run_coroutine_threadsafe(self._write_char(CHAR_MODE_STATUS, payload), self._loop)

        if self._is_connected_serial and self._serial_conn:
            try:
                self._serial_conn.write(f"MODE:{mode}\n".encode())
            except Exception:
                pass

    async def _write_char(self, char_uuid: str, payload: bytes):
        try:
            if self._client and self._client.is_connected:
                await self._client.write_gatt_char(char_uuid, payload, response=False)
        except Exception as e:
            logger.debug(f"Falha ao escrever em {char_uuid}: {e}")

    def _update_status(self, connected: bool, message: str):
        if self.on_connection_change:
            try:
                self.on_connection_change(connected, message)
            except Exception as e:
                logger.error(f"Erro em status callback: {e}")
