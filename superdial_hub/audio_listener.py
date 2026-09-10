"""
SuperDial Hub - Windows Core Audio Listener
Utiliza IAudioEndpointVolumeCallback (COM) para sincronização de hardware com 0.0% de CPU.
"""

import time
import logging
import threading
from typing import Callable, Optional
import comtypes
from comtypes import COMObject
from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume, IAudioEndpointVolumeCallback

logger = logging.getLogger("SuperDial.Audio")


class _VolumeCallbackHandler(COMObject):
    """Callback COM para receber notificações de hardware do Windows Core Audio."""
    _com_interfaces_ = [IAudioEndpointVolumeCallback]

    def __init__(self, owner: "AudioListener"):
        super().__init__()
        self.owner = owner

    def OnNotify(self, pNotify) -> int:
        try:
            data = pNotify.contents
            vol_float = data.fMasterVolume
            is_muted = bool(data.bMuted)
            vol_int = int(round(vol_float * 100.0))
            vol_int = max(0, min(100, vol_int))

            self.owner._handle_windows_notification(vol_int, is_muted)
        except Exception as e:
            logger.error(f"Erro no processamento de OnNotify: {e}")
        return 0


class AudioListener:
    """
    Gerenciador do Core Audio do Windows.
    Permite leitura, escrita e subscrição de eventos de volume e mudo.
    """

    def __init__(self):
        self._callbacks: list[Callable[[int, bool], None]] = []
        self._endpoint: Optional[IAudioEndpointVolume] = None
        self._callback_handler: Optional[_VolumeCallbackHandler] = None
        self._callback_ptr = None
        self._is_running = False
        self._lock = threading.Lock()

        # Flags para prevenir realimentação em loop (feedback loop)
        self._suppress_until = 0.0
        self._last_set_vol: Optional[int] = None
        self._last_set_mute: Optional[bool] = None

    def _init_com(self):
        """Garante a inicialização COM na thread atual."""
        try:
            comtypes.CoInitialize()
        except Exception:
            pass

    def _get_endpoint(self) -> IAudioEndpointVolume:
        """Obtém o endpoint do dispositivo de reprodução padrão."""
        self._init_com()
        device = AudioUtilities.GetSpeakers()
        if not device:
            raise RuntimeError("Nenhum dispositivo de áudio padrão encontrado.")
        return device.EndpointVolume

    def start(self):
        """Inicia o listener de eventos de hardware do Windows Core Audio."""
        with self._lock:
            if self._is_running:
                return

            try:
                self._init_com()
                self._endpoint = self._get_endpoint()
                self._callback_handler = _VolumeCallbackHandler(self)
                self._callback_ptr = self._callback_handler.QueryInterface(IAudioEndpointVolumeCallback)
                self._endpoint.RegisterControlChangeNotify(self._callback_ptr)
                self._is_running = True
                logger.info("AudioListener registrado com sucesso no Windows Core Audio.")
            except Exception as e:
                logger.error(f"Falha ao registrar AudioListener: {e}")
                raise

    def stop(self):
        """Cancela o registro do listener e libera os recursos COM."""
        with self._lock:
            if not self._is_running:
                return

            try:
                if self._endpoint and self._callback_ptr:
                    self._endpoint.UnregisterControlChangeNotify(self._callback_ptr)
                self._is_running = False
                self._callback_ptr = None
                self._callback_handler = None
                logger.info("AudioListener desregistrado com sucesso.")
            except Exception as e:
                logger.warning(f"Aviso ao desregistrar AudioListener: {e}")

    def add_callback(self, cb: Callable[[int, bool], None]):
        """Adiciona um callback para ser disparado quando o áudio do Windows mudar externamente."""
        if cb not in self._callbacks:
            self._callbacks.append(cb)

    def remove_callback(self, cb: Callable[[int, bool], None]):
        """Remove um callback registrado."""
        if cb in self._callbacks:
            self._callbacks.remove(cb)

    def _handle_windows_notification(self, volume: int, is_muted: bool):
        """Chamado pelo COM quando há notificação de hardware."""
        now = time.time()

        # Verifica se o evento foi gerado pelo próprio aplicativo recentemente
        if now < self._suppress_until:
            vol_match = (self._last_set_vol is None or abs(volume - self._last_set_vol) <= 1)
            mute_match = (self._last_set_mute is None or is_muted == self._last_set_mute)
            if vol_match and mute_match:
                # Mudança originada internamente, ignora propagação externa
                return

        for cb in list(self._callbacks):
            try:
                cb(volume, is_muted)
            except Exception as e:
                logger.error(f"Erro em callback de áudio: {e}")

    def get_volume(self) -> int:
        """Retorna o volume atual do Windows (0 a 100)."""
        try:
            self._init_com()
            ep = self._endpoint or self._get_endpoint()
            scalar = ep.GetMasterVolumeLevelScalar()
            return int(round(scalar * 100.0))
        except Exception as e:
            logger.error(f"Erro ao obter volume: {e}")
            return 50

    def set_volume(self, level: int):
        """Define o volume do Windows (0 a 100) suprimindo reflexão para o BLE."""
        level = max(0, min(100, int(level)))
        try:
            self._init_com()
            ep = self._endpoint or self._get_endpoint()

            self._suppress_until = time.time() + 0.4
            self._last_set_vol = level

            ep.SetMasterVolumeLevelScalar(level / 100.0, None)
        except Exception as e:
            logger.error(f"Erro ao ajustar volume para {level}: {e}")

    def get_mute(self) -> bool:
        """Retorna True se o áudio estiver no mudo."""
        try:
            self._init_com()
            ep = self._endpoint or self._get_endpoint()
            return bool(ep.GetMute())
        except Exception as e:
            logger.error(f"Erro ao obter estado de mudo: {e}")
            return False

    def set_mute(self, is_muted: bool):
        """Define o estado de mudo suprimindo reflexão."""
        try:
            self._init_com()
            ep = self._endpoint or self._get_endpoint()

            self._suppress_until = time.time() + 0.4
            self._last_set_mute = bool(is_muted)

            ep.SetMute(1 if is_muted else 0, None)
        except Exception as e:
            logger.error(f"Erro ao ajustar mudo: {e}")

    def toggle_mute(self) -> bool:
        """Alterna o mudo e retorna o novo estado."""
        curr = self.get_mute()
        new_state = not curr
        self.set_mute(new_state)
        return new_state
