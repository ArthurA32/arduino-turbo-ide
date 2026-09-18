"""
SuperDial Hub - Orquestrador Principal
Ponto de entrada oficial da aplicação desktop para Windows.
Unifica BLE/Serial Manager, Windows Actions Executor e CustomTkinter UI com Anel Virtual.
"""

import os
import sys
import ctypes
import logging

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from audio_listener import AudioListener
from actions import ActionsExecutor
from ble_manager import BleManager
from ui import SuperDialUI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("SuperDial.Main")


def set_app_user_model_id():
    try:
        app_id = "SuperDial.Hub.Desktop.2.1"
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(app_id)
    except Exception as e:
        logger.debug(f"Não foi possível definir AppUserModelID: {e}")


class SuperDialApp:
    """Orquestrador central do SuperDial Hub."""

    def __init__(self):
        set_app_user_model_id()

        self.audio = AudioListener()
        self.actions = ActionsExecutor(audio_listener=self.audio)
        self.ble = BleManager()
        self.ui = SuperDialUI()

        self._wire_events()

    def _wire_events(self):
        # 1. Eventos do Windows Core Audio -> UI & Placa (CHAR 1)
        def on_windows_audio_changed(volume: int, is_muted: bool):
            self.ui.after(0, lambda: self.ui.update_volume_display(volume, is_muted))
            self.ble.send_volume(volume, is_muted)

        self.audio.add_callback(on_windows_audio_changed)

        # 2. Eventos da Placa (CHAR 4 - Ações de Giro/Clique)
        def on_ble_action_event(action_type: int, mode: int, val: int):
            # Executa no Windows
            self.actions.execute_action(action_type, mode, val)

            # Se estiver nos Modos 2 a 6, rotaciona o anel de LEDs virtual
            if mode not in (1, 7):
                self.ui.after(0, lambda: self.ui.step_cursor_led(action_type))

        self.ble.on_action_event = on_ble_action_event

        # Feedback da Ação Disparada
        def on_action_dispatched(action_type: int, mode: int, action_text: str):
            self.ui.after(0, lambda: self.ui.flash_action_feedback(action_type, mode, action_text))
            # Se for volume (Modo 1), sincroniza a UI
            if mode == 1:
                curr_vol = self.audio.get_volume()
                curr_mute = self.audio.get_mute()
                self.ui.after(0, lambda: self.ui.update_volume_display(curr_vol, curr_mute))
                self.ble.send_volume(curr_vol, curr_mute)

        self.actions.on_action_dispatched = on_action_dispatched

        # CHAR 3 - Mudança de modo vinda do botão da placa
        def on_ble_mode_received(mode: int):
            logger.info(f"Modo recebido da placa (CHAR 3): {mode}")
            self.ui.after(0, lambda: self.ui.set_active_mode(mode))

        self.ble.on_mode_change = on_ble_mode_received

        # CHAR 1 - Volume recebido da placa
        def on_ble_volume_sync(vol: int, is_muted: bool):
            self.audio.set_volume(vol)
            self.audio.set_mute(is_muted)
            self.ui.after(0, lambda: self.ui.update_volume_display(vol, is_muted))

        self.ble.on_volume_sync = on_ble_volume_sync

        # Status de Conexão (BLE ou Serial USB)
        def on_connection_change(connected: bool, message: str):
            logger.info(f"Status Conexão: {message}")
            self.ui.after(0, lambda: self.ui.update_connection_status(connected, message))

            if connected:
                try:
                    curr_vol = self.audio.get_volume()
                    curr_mute = self.audio.get_mute()
                    self.ble.send_volume(curr_vol, curr_mute)
                    self.ble.send_mode(self.ui.active_mode)
                    r, g, b = self.ui.current_rgb
                    self.ble.send_rgb(r, g, b)
                except Exception as e:
                    logger.warning(f"Erro ao sincronizar estado inicial: {e}")

        self.ble.on_connection_change = on_connection_change

        # 3. Ações de Iluminação do Modo 7 vindas do Dial
        def on_brightness_target(target_val: int):
            self.ui.after(0, lambda: self.ui.set_desk_brightness(target_val, notify=True))

        self.actions.on_brightness_change = on_brightness_target

        def on_light_toggle():
            self.ui.after(0, self.ui.toggle_desk_light)

        self.actions.on_light_toggle = on_light_toggle

        # 4. Ações da UI -> Placa
        def on_ui_mode_selected(mode: int):
            logger.info(f"UI selecionou modo: {mode}")
            self.ble.send_mode(mode)

        self.ui.on_mode_selected = on_ui_mode_selected

        def on_ui_volume_slider(volume: int):
            self.audio.set_volume(volume)
            self.ble.send_volume(volume, self.audio.get_mute())

        self.ui.on_volume_slider_changed = on_ui_volume_slider

        def on_ui_mute_toggled():
            new_mute = self.audio.toggle_mute()
            vol = self.audio.get_volume()
            self.ui.update_volume_display(vol, new_mute)
            self.ble.send_volume(vol, new_mute)

        self.ui.on_mute_toggled = on_ui_mute_toggled

        def on_ui_rgb_selected(r: int, g: int, b: int):
            self.ui.current_rgb = (r, g, b)
            self.ble.send_rgb(r, g, b)

        self.ui.on_rgb_selected = on_ui_rgb_selected

        def on_ui_brightness_changed(level: int):
            r, g, b = self.ui.current_rgb
            scale = level / 100.0 if self.ui.desk_light_on else 0.0
            self.ble.send_rgb(int(r * scale), int(g * scale), int(b * scale))

        self.ui.on_brightness_slider_changed = on_ui_brightness_changed

        def on_ui_light_toggle():
            self.ui.toggle_desk_light()

        self.ui.on_light_toggle_clicked = on_ui_light_toggle

        def on_reconnect_req():
            logger.info("Reconexão solicitada pelo usuário.")
            self.ui.update_connection_status(False, "Buscando SuperDial-Pro (Ativo)...")

        self.ui.on_reconnect_clicked = on_reconnect_req

        def on_ui_exit():
            self.shutdown()

        self.ui.on_app_exit = on_ui_exit

    def run(self):
        logger.info("Iniciando SuperDial Hub...")

        try:
            self.audio.start()
            init_vol = self.audio.get_volume()
            init_mute = self.audio.get_mute()
            self.ui.update_volume_display(init_vol, init_mute)
        except Exception as e:
            logger.error(f"Erro ao iniciar AudioListener: {e}")

        try:
            self.ble.start()
        except Exception as e:
            logger.error(f"Erro ao iniciar BleManager: {e}")

        self.ui.update_idletasks()
        w = self.ui.winfo_width()
        h = self.ui.winfo_height()
        sw = self.ui.winfo_screenwidth()
        sh = self.ui.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.ui.geometry(f"{w}x{h}+{x}+{y}")

        try:
            self.ui.mainloop()
        except KeyboardInterrupt:
            self.shutdown()

    def shutdown(self):
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
