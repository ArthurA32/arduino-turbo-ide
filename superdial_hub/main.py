"""
SuperDial Hub - Orquestrador Principal
Ponto de entrada oficial da aplicação desktop para Windows.
Unifica BLE Manager, Windows Actions Executor e CustomTkinter UI.
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
        app_id = "SuperDial.Hub.Desktop.2.0"
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(app_id)
    except Exception as e:
        logger.debug(f"Não foi possível definir AppUserModelID: {e}")


class SuperDialApp:
    """Orquestrador central do SuperDial Hub."""

    def __init__(self):
        set_app_user_model_id()

        # Instanciação dos Módulos
        self.audio = AudioListener()
        self.actions = ActionsExecutor(audio_listener=self.audio)
        self.ble = BleManager()
        self.ui = SuperDialUI()

        # Conexão de Eventos
        self._wire_events()

    def _wire_events(self):
        """Conecta os callbacks entre UI, BLE e Actions com total thread-safety."""

        # ---------------------------------------------------------------------
        # 1. Eventos do Windows Core Audio (Hardware COM) -> UI & BLE (CHAR 1)
        # ---------------------------------------------------------------------
        def on_windows_audio_changed(volume: int, is_muted: bool):
            # Atualiza UI na thread do Tkinter
            self.ui.after(0, lambda: self.ui.update_volume_display(volume, is_muted))
            # Envia volume para a placa (CHAR 1) para atualizar os LEDs
            self.ble.send_volume(volume, is_muted)

        self.audio.add_callback(on_windows_audio_changed)

        # ---------------------------------------------------------------------
        # 2. Eventos BLE recebidos da placa (CHAR 1, 3 e 4)
        # ---------------------------------------------------------------------
        # CHAR 4 - Action Event (Giro ou Clique do Dial)
        def on_ble_action_event(action_type: int, mode: int, steps: int):
            # Executa a ação no Windows
            self.actions.execute_action(action_type, mode, steps)

        self.ble.on_action_event = on_ble_action_event

        # Feedback da ação executada para a UI
        def on_action_dispatched(action_type: int, mode: int, action_text: str):
            self.ui.after(0, lambda: self.ui.flash_action_feedback(action_type, mode, action_text))
            # Se a ação foi de volume (Modo 1), sincroniza a UI e envia CHAR 1
            if mode == 1:
                curr_vol = self.audio.get_volume()
                curr_mute = self.audio.get_mute()
                self.ui.after(0, lambda: self.ui.update_volume_display(curr_vol, curr_mute))
                self.ble.send_volume(curr_vol, curr_mute)

        self.actions.on_action_dispatched = on_action_dispatched

        # CHAR 3 - Mudança de modo vinda da placa (botão físico segurado)
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

        # Status de Conexão BLE
        def on_ble_connection_change(connected: bool, message: str):
            logger.info(f"Status BLE: {message}")
            self.ui.after(0, lambda: self.ui.update_connection_status(connected, message))

            if connected:
                # Sincroniza estado inicial com a placa
                try:
                    curr_vol = self.audio.get_volume()
                    curr_mute = self.audio.get_mute()
                    self.ble.send_volume(curr_vol, curr_mute)
                    self.ble.send_mode(self.ui.active_mode)
                    # Envia cor RGB atual escalada pelo brilho
                    r, g, b = self._calc_scaled_rgb()
                    self.ble.send_rgb(r, g, b)
                except Exception as e:
                    logger.warning(f"Erro ao sincronizar estado inicial: {e}")

        self.ble.on_connection_change = on_ble_connection_change

        # ---------------------------------------------------------------------
        # 3. Ações do Modo 7 (Iluminação de Mesa) disparadas pelo Dial
        # ---------------------------------------------------------------------
        def on_brightness_delta(delta: int):
            new_val = max(0, min(100, self.ui.desk_brightness + delta))
            self.ui.after(0, lambda: self.ui.set_desk_brightness(new_val, notify=True))

        self.actions.on_brightness_change = on_brightness_delta

        def on_light_toggle():
            self.ui.after(0, self.ui.toggle_desk_light)

        self.actions.on_light_toggle = on_light_toggle

        # ---------------------------------------------------------------------
        # 4. Ações disparadas pela UI -> Windows & BLE
        # ---------------------------------------------------------------------
        # Clique em um dos 7 botões de modos na UI -> escreve 1 byte na CHAR 3
        def on_ui_mode_selected(mode: int):
            logger.info(f"UI selecionou modo: {mode}")
            self.ble.send_mode(mode)

        self.ui.on_mode_selected = on_ui_mode_selected

        # Slider de Volume na UI
        def on_ui_volume_slider(volume: int):
            self.audio.set_volume(volume)
            self.ble.send_volume(volume, self.audio.get_mute())

        self.ui.on_volume_slider_changed = on_ui_volume_slider

        # Botão Mute na UI
        def on_ui_mute_toggled():
            new_mute = self.audio.toggle_mute()
            vol = self.audio.get_volume()
            self.ui.update_volume_display(vol, new_mute)
            self.ble.send_volume(vol, new_mute)

        self.ui.on_mute_toggled = on_ui_mute_toggled

        # Seleção de Cor RGB na UI (CHAR 2)
        def on_ui_rgb_selected(r: int, g: int, b: int):
            self.ui.current_rgb = (r, g, b)
            scaled_r, scaled_g, scaled_b = self._calc_scaled_rgb()
            self.ble.send_rgb(scaled_r, scaled_g, scaled_b)

        self.ui.on_rgb_selected = on_ui_rgb_selected

        # Slider de Brilho da Mesa na UI (Modo 7)
        def on_ui_brightness_changed(level: int):
            scaled_r, scaled_g, scaled_b = self._calc_scaled_rgb()
            self.ble.send_rgb(scaled_r, scaled_g, scaled_b)

        self.ui.on_brightness_slider_changed = on_ui_brightness_changed

        def on_ui_light_toggle():
            self.ui.toggle_desk_light()

        self.ui.on_light_toggle_clicked = on_ui_light_toggle

        def on_ui_exit():
            self.shutdown()

        self.ui.on_app_exit = on_ui_exit

    def _calc_scaled_rgb(self):
        """Calcula a cor RGB atual escalada pelo brilho da mesa (Modo 7)."""
        r, g, b = self.ui.current_rgb
        bright = self.ui.desk_brightness / 100.0 if self.ui.desk_light_on else 0.0
        return int(r * bright), int(g * bright), int(b * bright)

    def run(self):
        """Inicializa os serviços e executa o loop da UI."""
        logger.info("Iniciando SuperDial Hub (7 Modos)...")

        # Inicia Audio Listener COM
        try:
            self.audio.start()
            init_vol = self.audio.get_volume()
            init_mute = self.audio.get_mute()
            self.ui.update_volume_display(init_vol, init_mute)
        except Exception as e:
            logger.error(f"Erro ao iniciar AudioListener: {e}")

        # Inicia BLE Manager
        try:
            self.ble.start()
        except Exception as e:
            logger.error(f"Erro ao iniciar BleManager: {e}")

        # Centraliza a janela na tela
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
        """Liberação limpa de todos os recursos ao fechar a aplicação."""
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
