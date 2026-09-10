"""
SuperDial Hub - Orquestrador Principal
Ponto de entrada oficial da aplicação desktop para Windows.
"""

import os
import sys
import ctypes
import logging
import threading

# Adiciona o diretório local ao sys.path para garantir importações relativas e em bundle PyInstaller
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from audio_listener import AudioListener
from ble_service import BleService
from ui_main import SuperDialUI

# Configuração de Logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("SuperDial.Main")


def set_app_user_model_id():
    """Garante que a barra de tarefas do Windows trate o SuperDial Hub como uma aplicação independente."""
    try:
        app_id = "SuperDial.Hub.Desktop.1.0"
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(app_id)
    except Exception as e:
        logger.debug(f"Não foi possível definir AppUserModelID: {e}")


class SuperDialApp:
    """Orquestrador central conectando Audio Listener, BLE Service e UI."""

    def __init__(self):
        set_app_user_model_id()

        # Instanciação dos Módulos
        self.ui = SuperDialUI()
        self.audio = AudioListener()
        self.ble = BleService()

        # Conexão de Eventos
        self._wire_events()

    def _wire_events(self):
        """Conecta os callbacks entre UI, BLE e AudioListener com thread-safety."""

        # ---------------------------------------------------------------------
        # 1. Eventos do Windows Core Audio -> UI & BLE
        # ---------------------------------------------------------------------
        def on_windows_audio_change(volume: int, is_muted: bool):
            # Atualiza UI na thread principal do Tk
            self.ui.after(0, lambda: self.ui.update_volume_display(volume, is_muted))
            # Envia para o ESP32 via BLE
            self.ble.send_volume(volume, is_muted)

        self.audio.add_callback(on_windows_audio_change)

        # ---------------------------------------------------------------------
        # 2. Eventos do BLE (SuperDial-Pro) -> Áudio & UI
        # ---------------------------------------------------------------------
        def on_ble_volume_received(volume: int, is_muted: bool):
            logger.info(f"Recebido do SuperDial-Pro: Vol={volume}%, Mute={is_muted}")
            # Aplica no Windows Core Audio
            self.audio.set_volume(volume)
            self.audio.set_mute(is_muted)
            # Atualiza UI
            self.ui.after(0, lambda: self.ui.update_volume_display(volume, is_muted))

        self.ble.on_volume_received = on_ble_volume_received

        def on_ble_mode_received(mode: int):
            logger.info(f"Modo recebido do dial: {mode}")
            self.ui.after(0, lambda: self.ui.set_active_mode(mode))

        self.ble.on_mode_received = on_ble_mode_received

        def on_ble_connection_change(connected: bool, message: str):
            logger.info(f"Status BLE: {message}")
            self.ui.after(0, lambda: self.ui.update_connection_status(connected, message))

            # Se conectou, sincroniza imediatamente o volume atual do Windows com o Dial
            if connected:
                try:
                    curr_vol = self.audio.get_volume()
                    curr_mute = self.audio.get_mute()
                    self.ble.send_volume(curr_vol, curr_mute)
                    # Envia o modo ativo
                    self.ble.send_mode(self.ui.active_mode)
                    # Envia a configuração atual de iluminação
                    self.ble.send_argb_config(
                        self.ui.argb_effect,
                        self.ui.argb_color1,
                        self.ui.argb_color2,
                        self.ui.argb_brightness,
                        self.ui.argb_speed,
                    )
                except Exception as e:
                    logger.warning(f"Erro ao sincronizar estado inicial com o dial: {e}")

        self.ble.on_connection_change = on_ble_connection_change

        # ---------------------------------------------------------------------
        # 3. Ações da UI -> Windows & BLE
        # ---------------------------------------------------------------------
        def on_ui_mode_selected(mode: int):
            logger.info(f"UI selecionou modo: {mode}")
            self.ble.send_mode(mode)

        self.ui.on_mode_selected = on_ui_mode_selected

        def on_ui_volume_changed(volume: int):
            self.audio.set_volume(volume)
            self.ble.send_volume(volume, self.audio.get_mute())

        self.ui.on_volume_changed = on_ui_volume_changed

        def on_ui_mute_toggled():
            new_mute = self.audio.toggle_mute()
            vol = self.audio.get_volume()
            self.ui.update_volume_display(vol, new_mute)
            self.ble.send_volume(vol, new_mute)

        self.ui.on_mute_toggled = on_ui_mute_toggled

        def on_ui_argb_changed(effect, c1, c2, brightness, speed):
            self.ble.send_argb_config(effect, c1, c2, brightness, speed)

        self.ui.on_argb_changed = on_ui_argb_changed

        def on_ui_exit():
            self.shutdown()

        self.ui.on_app_exit = on_ui_exit

    def run(self):
        """Inicia os serviços e executa o loop principal da interface."""
        logger.info("Iniciando SuperDial Hub...")

        # Inicia Audio Listener
        try:
            self.audio.start()
            # Lê volume inicial
            init_vol = self.audio.get_volume()
            init_mute = self.audio.get_mute()
            self.ui.update_volume_display(init_vol, init_mute)
        except Exception as e:
            logger.error(f"Erro ao iniciar AudioListener: {e}")

        # Inicia Serviço BLE em background
        try:
            self.ble.start()
        except Exception as e:
            logger.error(f"Erro ao iniciar BleService: {e}")

        # Centraliza e foca a janela
        self.ui.update_idletasks()
        w = self.ui.winfo_width()
        h = self.ui.winfo_height()
        sw = self.ui.winfo_screenwidth()
        sh = self.ui.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.ui.geometry(f"{w}x{h}+{x}+{y}")

        # Executa o loop principal do Tkinter
        try:
            self.ui.mainloop()
        except KeyboardInterrupt:
            self.shutdown()

    def shutdown(self):
        """Finalização limpa e liberação de recursos."""
        logger.info("Encerrando SuperDial Hub...")
        try:
            self.audio.stop()
        except Exception:
            pass

        try:
            self.ble.stop()
        except Exception:
            pass


def main():
    app = SuperDialApp()
    app.run()


if __name__ == "__main__":
    main()
