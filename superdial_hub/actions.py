"""
SuperDial Hub - Windows Actions Executor
Execução nativa de atalhos, controle de volume, eventos de teclado e mouse para os 7 modos de trabalho.
Sincronizado com os valores absolutos do firmware (Volume e Brilho exatos).
"""

import time
import ctypes
import logging
from typing import Callable, Optional
from audio_listener import AudioListener

logger = logging.getLogger("SuperDial.Actions")

user32 = ctypes.windll.user32

KEYEVENTF_KEYDOWN = 0x0000
KEYEVENTF_KEYUP = 0x0002

VK_TAB = 0x09
VK_RETURN = 0x0D
VK_SHIFT = 0x10
VK_CONTROL = 0x11
VK_MENU = 0x12       # Alt
VK_SPACE = 0x20
VK_LEFT = 0x25
VK_UP = 0x26
VK_RIGHT = 0x27
VK_DOWN = 0x28
VK_D = 0x44
VK_W = 0x57
VK_LWIN = 0x5B

VK_MEDIA_NEXT_TRACK = 0xB0
VK_MEDIA_PREV_TRACK = 0xB1
VK_MEDIA_STOP = 0xB2
VK_MEDIA_PLAY_PAUSE = 0xB3

MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800


def press_key(vk_code: int):
    """Pressiona e solta uma tecla virtual."""
    user32.keybd_event(vk_code, 0, KEYEVENTF_KEYDOWN, 0)
    time.sleep(0.01)
    user32.keybd_event(vk_code, 0, KEYEVENTF_KEYUP, 0)


def press_hotkey(*vk_codes: int):
    """Pressiona uma combinação de teclas na ordem fornecida e as solta em ordem inversa."""
    for vk in vk_codes:
        user32.keybd_event(vk, 0, KEYEVENTF_KEYDOWN, 0)
        time.sleep(0.005)
    time.sleep(0.02)
    for vk in reversed(vk_codes):
        user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
        time.sleep(0.005)


def mouse_wheel(delta: int):
    """Gira a roda do mouse (delta positivo = cima, delta negativo = baixo)."""
    user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta, 0)


def mouse_middle_click():
    """Executa o clique do meio (botão da roda)."""
    user32.mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0)
    time.sleep(0.01)
    user32.mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0)


class ActionsExecutor:
    """Centraliza e executa as ações do Windows disparadas pelo SuperDial-Pro."""

    def __init__(self, audio_listener: Optional[AudioListener] = None):
        self.audio = audio_listener or AudioListener()
        self.on_brightness_change: Optional[Callable[[int], None]] = None
        self.on_light_toggle: Optional[Callable[[], None]] = None
        self.on_action_dispatched: Optional[Callable[[int, int, str], None]] = None

    def execute_action(self, action_type: int, mode: int, val: int = 1):
        """
        Executa a ação correspondente no Windows.
        :param action_type: 1 = Giro Horário (+), 2 = Giro Anti-Horário (-), 3 = Clique
        :param mode: Modo Ativo (1 a 7)
        :param val: Valor enviado pela placa (Modo 1 = volume exato, Modo 7 = brilho exato, Modos 2-6 = passos)
        """
        action_name = ""
        try:
            # =================================================================
            # MODO 1: VOLUME MASTER (AZUL NEON)
            # =================================================================
            if mode == 1:
                if action_type in (1, 2):
                    # Sincronização Absoluta com o volume calculado na placa
                    target_vol = max(0, min(100, val))
                    self.audio.set_volume(target_vol)
                    dir_symbol = "+" if action_type == 1 else "-"
                    action_name = f"Volume {dir_symbol} ({target_vol}%)"
                elif action_type == 3:
                    muted = self.audio.toggle_mute()
                    action_name = f"Mudo: {'Ativado' if muted else 'Desativado'}"

            # =================================================================
            # MODO 2: ALT+TAB INTELIGENTE (ROXO)
            # =================================================================
            elif mode == 2:
                if action_type == 1:
                    press_hotkey(VK_MENU, VK_TAB)
                    action_name = "Alt + Tab (Próxima Janela)"
                elif action_type == 2:
                    press_hotkey(VK_MENU, VK_SHIFT, VK_TAB)
                    action_name = "Alt + Shift + Tab (Janela Anterior)"
                elif action_type == 3:
                    press_hotkey(VK_LWIN, VK_D)
                    action_name = "Win + D (Área de Trabalho)"

            # =================================================================
            # MODO 3: LINHA DO TEMPO / VÍDEO (VERMELHO)
            # =================================================================
            elif mode == 3:
                steps = max(1, val)
                if action_type == 1:
                    for _ in range(steps):
                        press_key(VK_RIGHT)
                    action_name = "Avançar (+5s / Frame)"
                elif action_type == 2:
                    for _ in range(steps):
                        press_key(VK_LEFT)
                    action_name = "Voltar (-5s / Frame)"
                elif action_type == 3:
                    press_key(VK_SPACE)
                    action_name = "Play / Pause (Espaço)"

            # =================================================================
            # MODO 4: SPOTIFY & STREAMING (VERDE)
            # =================================================================
            elif mode == 4:
                if action_type == 1:
                    press_key(VK_MEDIA_NEXT_TRACK)
                    action_name = "Próxima Faixa (Next Track)"
                elif action_type == 2:
                    press_key(VK_MEDIA_PREV_TRACK)
                    action_name = "Faixa Anterior (Prev Track)"
                elif action_type == 3:
                    press_key(VK_MEDIA_PLAY_PAUSE)
                    action_name = "Play / Pause Mídia"

            # =================================================================
            # MODO 5: NAVEGADOR DE ABAS (LARANJA)
            # =================================================================
            elif mode == 5:
                if action_type == 1:
                    press_hotkey(VK_CONTROL, VK_TAB)
                    action_name = "Ctrl + Tab (Próxima Aba)"
                elif action_type == 2:
                    press_hotkey(VK_CONTROL, VK_SHIFT, VK_TAB)
                    action_name = "Ctrl + Shift + Tab (Aba Anterior)"
                elif action_type == 3:
                    press_hotkey(VK_CONTROL, VK_W)
                    action_name = "Ctrl + W (Fechar Aba)"

            # =================================================================
            # MODO 6: SCROLL DO MOUSE (AMARELO OURO)
            # =================================================================
            elif mode == 6:
                steps = max(1, val)
                if action_type == 1:
                    mouse_wheel(120 * steps)
                    action_name = f"Scroll Cima (+{120 * steps})"
                elif action_type == 2:
                    mouse_wheel(-120 * steps)
                    action_name = f"Scroll Baixo (-{120 * steps})"
                elif action_type == 3:
                    mouse_middle_click()
                    action_name = "Clique do Meio (Wheel Click)"

            # =================================================================
            # MODO 7: ILUMINAÇÃO DE MESA (BRANCO SUAVE / CIANO)
            # =================================================================
            elif mode == 7:
                if action_type in (1, 2):
                    target_bright = max(0, min(100, val))
                    if self.on_brightness_change:
                        self.on_brightness_change(target_bright)
                    dir_symbol = "+" if action_type == 1 else "-"
                    action_name = f"Brilho Mesa {dir_symbol} ({target_bright}%)"
                elif action_type == 3:
                    if self.on_light_toggle:
                        self.on_light_toggle()
                    action_name = "Toggle Iluminação Mesa"

            logger.info(f"[Modo {mode}] Ação {action_type}: {action_name}")

            if self.on_action_dispatched and action_name:
                self.on_action_dispatched(action_type, mode, action_name)

        except Exception as e:
            logger.error(f"Erro ao executar ação (Modo {mode}, Tipo {action_type}): {e}")
