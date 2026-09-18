"""
SuperDial Hub - Dashboard Action Monitor
Monitora os eventos de giro e clique do SuperDial-Pro para exibição em tempo real no Dashboard.
Como o ESP32 agora utiliza BLE HID Nativo (envia teclas, volume e mouse diretamente ao Windows),
este módulo NÃO injeta teclas ou mouse para evitar duplicação de comandos.
"""

import logging
from typing import Callable, Optional
from audio_listener import AudioListener

logger = logging.getLogger("SuperDial.Actions")


class ActionsExecutor:
    """
    Processador de eventos para o Dashboard do SuperDial Hub (Estilo Logitech G Hub).
    Responsável apenas por:
    1. Notificar a UI com o feedback visual da ação executada pelo hardware (sem duplicar teclas/volume no SO).
    2. Gerenciar o ajuste de iluminação da mesa (Modo 7).
    """

    def __init__(self, audio_listener: Optional[AudioListener] = None):
        self.audio = audio_listener or AudioListener()
        self.on_brightness_change: Optional[Callable[[int], None]] = None
        self.on_light_toggle: Optional[Callable[[], None]] = None
        self.on_action_dispatched: Optional[Callable[[int, int, str], None]] = None

    def execute_action(self, action_type: int, mode: int, val: int = 1):
        """
        Processa evento do dial para telemetria e feedback visual no Dashboard.
        :param action_type: 1 = Giro Horário (+), 2 = Giro Anti-Horário (-), 3 = Clique
        :param mode: Modo Ativo (1 a 7)
        :param val: Valor associado vindo do hardware
        """
        action_name = ""
        dir_symbol = "(+)" if action_type == 1 else ("(-)" if action_type == 2 else "(Clique)")

        try:
            # =================================================================
            # MODO 1: VOLUME MASTER (HID NATIVO NO HARDWARE)
            # =================================================================
            if mode == 1:
                if action_type in (1, 2):
                    action_name = f"Volume {dir_symbol} [HID Nativo]"
                elif action_type == 3:
                    action_name = "Mudo Toggle [HID Nativo]"

            # =================================================================
            # MODO 2: ALT+TAB INTELIGENTE (HID NATIVO)
            # =================================================================
            elif mode == 2:
                if action_type == 1:
                    action_name = "Próxima Janela (Alt+Tab) [HID Nativo]"
                elif action_type == 2:
                    action_name = "Janela Anterior (Alt+Shift+Tab) [HID Nativo]"
                elif action_type == 3:
                    action_name = "Área de Trabalho (Win+D) [HID Nativo]"

            # =================================================================
            # MODO 3: LINHA DO TEMPO / VÍDEO (HID NATIVO)
            # =================================================================
            elif mode == 3:
                if action_type == 1:
                    action_name = "Avançar +5s (Seta Direita) [HID Nativo]"
                elif action_type == 2:
                    action_name = "Voltar -5s (Seta Esquerda) [HID Nativo]"
                elif action_type == 3:
                    action_name = "Play / Pause (Espaço) [HID Nativo]"

            # =================================================================
            # MODO 4: SPOTIFY & MÚSICAS (HID NATIVO)
            # =================================================================
            elif mode == 4:
                if action_type == 1:
                    action_name = "Próxima Faixa (Media Next) [HID Nativo]"
                elif action_type == 2:
                    action_name = "Faixa Anterior (Media Prev) [HID Nativo]"
                elif action_type == 3:
                    action_name = "Play / Pause (Media Play/Pause) [HID Nativo]"

            # =================================================================
            # MODO 5: NAVEGADOR DE ABAS (HID NATIVO)
            # =================================================================
            elif mode == 5:
                if action_type == 1:
                    action_name = "Próxima Aba (Ctrl+Tab) [HID Nativo]"
                elif action_type == 2:
                    action_name = "Aba Anterior (Ctrl+Shift+Tab) [HID Nativo]"
                elif action_type == 3:
                    action_name = "Fechar Aba (Ctrl+W) [HID Nativo]"

            # =================================================================
            # MODO 6: SCROLL DO MOUSE (HID NATIVO)
            # =================================================================
            elif mode == 6:
                if action_type == 1:
                    action_name = "Scroll Cima (Wheel Up) [HID Nativo]"
                elif action_type == 2:
                    action_name = "Scroll Baixo (Wheel Down) [HID Nativo]"
                elif action_type == 3:
                    action_name = "Clique do Meio (Middle Click) [HID Nativo]"

            # =================================================================
            # MODO 7: ILUMINAÇÃO DE MESA (CONTROLE VIA APP / ARGB)
            # =================================================================
            elif mode == 7:
                if action_type in (1, 2):
                    target_bright = max(0, min(100, val))
                    if self.on_brightness_change:
                        self.on_brightness_change(target_bright)
                    action_name = f"Brilho da Mesa {dir_symbol}: {target_bright}%"
                elif action_type == 3:
                    if self.on_light_toggle:
                        self.on_light_toggle()
                    action_name = "Toggle Iluminação Mesa"

            logger.info(f"[Modo {mode}] Ação {action_type}: {action_name}")

            # Notifica a UI para atualizar o indicador visual em tempo real
            if self.on_action_dispatched and action_name:
                self.on_action_dispatched(action_type, mode, action_name)

        except Exception as e:
            logger.error(f"Erro ao processar ação (Modo {mode}, Tipo {action_type}): {e}")
