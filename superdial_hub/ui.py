"""
SuperDial Hub - Interface Gráfica Moderna (Cyberpunk / Obsidian Dark)
Simulador de Anel de 8 LEDs WS2812B idêntico ao firmware, 7 Modos de Trabalho e System Tray.
"""

import os
import sys
import math
import threading
import time
from typing import Callable, Optional, Tuple
from PIL import Image, ImageDraw
import customtkinter as ctk
import pystray
from pystray import MenuItem as item

# Configuração de Aparência CustomTkinter
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

# Cores Gerais da UI
COLOR_BG = "#0B0F19"
COLOR_CARD = "#141C2E"
COLOR_CARD_BORDER = "#1E2A42"
COLOR_ACCENT = "#00D2FF"
COLOR_TEXT_WHITE = "#F8FAFC"
COLOR_TEXT_MUTED = "#94A3B8"
COLOR_SUCCESS = "#10B981"
COLOR_WARNING = "#F59E0B"
COLOR_DANGER = "#EF4444"

# Cores Oficiais Idênticas à Matriz CORES_MODOS do Firmware ESP32
MODES_CONFIG = {
    1: {
        "name": "Volume Master",
        "icon": "🔊",
        "color": "#008CFF",  # RGB(0, 140, 255) - Azul Neon
        "rgb": (0, 140, 255),
        "turn_cw": "Giro Horário (+): Sobe 2% na barra progressiva",
        "turn_ccw": "Giro Anti-Horário (-): Desce 2% na barra progressiva",
        "click": "Botão: Avança para o próximo modo diretamente",
    },
    2: {
        "name": "Alt+Tab Inteligente",
        "icon": "🗔",
        "color": "#A000DC",  # RGB(160, 0, 220) - Roxo
        "rgb": (160, 0, 220),
        "turn_cw": "Giro Horário (+): Próxima Janela (Alt + Tab)",
        "turn_ccw": "Giro Anti-Horário (-): Janela Anterior (Alt + Shift + Tab)",
        "click": "Botão: Avança para o próximo modo diretamente",
    },
    3: {
        "name": "Linha do Tempo / Vídeo",
        "icon": "🎬",
        "color": "#DC1414",  # RGB(220, 20, 20) - Vermelho
        "rgb": (220, 20, 20),
        "turn_cw": "Giro Horário (+): Avança 5s (Seta Direita)",
        "turn_ccw": "Giro Anti-Horário (-): Volta 5s (Seta Esquerda)",
        "click": "Botão: Avança para o próximo modo diretamente",
    },
    4: {
        "name": "Spotify & Músicas",
        "icon": "🎵",
        "color": "#00DC32",  # RGB(0, 220, 50) - Verde
        "rgb": (0, 220, 50),
        "turn_cw": "Giro Horário (+): Próxima Faixa (Next Track)",
        "turn_ccw": "Giro Anti-Horário (-): Faixa Anterior (Prev Track)",
        "click": "Botão: Avança para o próximo modo diretamente",
    },
    5: {
        "name": "Navegador de Abas",
        "icon": "📑",
        "color": "#E65000",  # RGB(230, 80, 0) - Laranja
        "rgb": (230, 80, 0),
        "turn_cw": "Giro Horário (+): Próxima Aba (Ctrl + Tab)",
        "turn_ccw": "Giro Anti-Horário (-): Aba Anterior (Ctrl + Shift + Tab)",
        "click": "Botão: Avança para o próximo modo diretamente",
    },
    6: {
        "name": "Scroll do Mouse",
        "icon": "🖱️",
        "color": "#DCB400",  # RGB(220, 180, 0) - Amarelo Ouro
        "rgb": (220, 180, 0),
        "turn_cw": "Giro Horário (+): Roda do Mouse Cima (+120)",
        "turn_ccw": "Giro Anti-Horário (-): Roda do Mouse Baixo (-120)",
        "click": "Botão: Avança para o próximo modo diretamente",
    },
    7: {
        "name": "Iluminação de Mesa",
        "icon": "💡",
        "color": "#B4DCFF",  # RGB(180, 220, 255) - Branco Suave / Ciano
        "rgb": (180, 220, 255),
        "turn_cw": "Giro Horário (+): Aumenta Brilho (+5%)",
        "turn_ccw": "Giro Anti-Horário (-): Diminui Brilho (-5%)",
        "click": "Botão: Avança para o próximo modo diretamente",
    },
}

ARGB_PRESET_COLORS = [
    ("#008CFF", "Azul Neon", (0, 140, 255)),
    ("#A000DC", "Roxo Cyber", (160, 0, 220)),
    ("#DC1414", "Vermelho Ruby", (220, 20, 20)),
    ("#00DC32", "Verde Esmeralda", (0, 220, 50)),
    ("#E65000", "Laranja Âmbar", (230, 80, 0)),
    ("#DCB400", "Amarelo Ouro", (220, 180, 0)),
    ("#B4DCFF", "Branco Suave", (180, 220, 255)),
    ("#FFFFFF", "Branco Puro", (255, 255, 255)),
    ("#FF00AA", "Rosa Choque", (255, 0, 170)),
    ("#00D2FF", "Ciano Neon", (0, 210, 255)),
]


def create_dial_image(size: int = 64, connected: bool = False) -> Image.Image:
    """Gera o ícone dinâmico do dial para a bandeja do sistema."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    accent = "#00D2FF" if connected else "#64748B"
    dot = "#10B981" if connected else "#EF4444"

    draw.ellipse([2, 2, size - 3, size - 3], fill="#0B0F19", outline=accent, width=max(2, size // 16))
    inset = size // 4
    draw.ellipse([inset, inset, size - inset, size - inset], fill="#141C2E", outline=accent, width=max(1, size // 24))
    draw.line([(size // 2, 4), (size // 2, inset)], fill=accent, width=max(2, size // 12))
    d_size = max(3, size // 7)
    draw.ellipse([size - d_size - 2, 2, size - 2, d_size + 2], fill=dot)
    return img


class SuperDialUI(ctk.CTk):
    """Janela principal do SuperDial Hub com Anel Virtual de 8 LEDs e tema Cyberpunk Dark."""

    def __init__(self):
        super().__init__()

        self.title("SuperDial Hub - Pro Control")
        self.geometry("490x880")
        self.minsize(480, 780)
        self.configure(fg_color=COLOR_BG)

        # Estado da Aplicação
        self.active_mode = 1
        self.current_volume = 30
        self.is_muted = False
        self.is_connected = False
        self.status_text = "Buscando SuperDial-Pro..."

        # Estado do Anel de LEDs
        self.cursor_led = 0
        self.desk_brightness = 80
        self.desk_light_on = True
        self.current_rgb = (0, 140, 255)

        # Callbacks externos
        self.on_mode_selected: Optional[Callable[[int], None]] = None
        self.on_volume_slider_changed: Optional[Callable[[int], None]] = None
        self.on_mute_toggled: Optional[Callable[[], None]] = None
        self.on_rgb_selected: Optional[Callable[[int, int, int], None]] = None
        self.on_brightness_slider_changed: Optional[Callable[[int], None]] = None
        self.on_light_toggle_clicked: Optional[Callable[[], None]] = None
        self.on_reconnect_clicked: Optional[Callable[[], None]] = None
        self.on_app_exit: Optional[Callable[[], None]] = None

        self._setup_window_icon()
        self._build_ui()

        self.protocol("WM_DELETE_WINDOW", self.hide_to_tray)

        self._tray_icon: Optional[pystray.Icon] = None
        self._init_system_tray()

    def _setup_window_icon(self):
        ico_path = os.path.join(os.path.dirname(__file__), "assets", "icon.ico")
        if os.path.exists(ico_path):
            try:
                self.iconbitmap(ico_path)
            except Exception:
                pass

    def _build_ui(self):
        """Constrói os componentes gráficos da interface."""
        # 1. HEADER BAR
        header_frame = ctk.CTkFrame(self, fg_color=COLOR_CARD, corner_radius=12, border_width=1, border_color=COLOR_CARD_BORDER)
        header_frame.pack(fill="x", padx=14, pady=(12, 6))

        title_box = ctk.CTkFrame(header_frame, fg_color="transparent")
        title_box.pack(side="left", padx=12, pady=10)

        title_label = ctk.CTkLabel(
            title_box,
            text="⚡ SUPERDIAL HUB",
            font=ctk.CTkFont(family="Segoe UI", size=17, weight="bold"),
            text_color=COLOR_ACCENT
        )
        title_label.pack(side="left")

        pro_badge = ctk.CTkLabel(
            title_box,
            text="PRO",
            font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
            text_color="#000000",
            fg_color=COLOR_ACCENT,
            corner_radius=6,
            padx=6,
            pady=1
        )
        pro_badge.pack(side="left", padx=(6, 0))

        ctrl_box = ctk.CTkFrame(header_frame, fg_color="transparent")
        ctrl_box.pack(side="right", padx=10, pady=8)

        self.btn_reconnect = ctk.CTkButton(
            ctrl_box,
            text="🔄 Buscar",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#1E293B",
            hover_color="#334155",
            text_color=COLOR_ACCENT,
            width=68,
            height=28,
            corner_radius=6,
            command=self._on_reconnect_click
        )
        self.btn_reconnect.pack(side="left", padx=(0, 6))

        btn_tray = ctk.CTkButton(
            ctrl_box,
            text="🗕 Bandeja",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#1E293B",
            hover_color="#334155",
            text_color=COLOR_TEXT_WHITE,
            width=70,
            height=28,
            corner_radius=6,
            command=self.hide_to_tray
        )
        btn_tray.pack(side="right")

        # Status Bar
        status_box = ctk.CTkFrame(self, fg_color="#0F172A", corner_radius=8, border_width=1, border_color=COLOR_CARD_BORDER)
        status_box.pack(fill="x", padx=14, pady=(0, 8))

        self.lbl_status_dot = ctk.CTkLabel(
            status_box,
            text="●",
            font=ctk.CTkFont(size=14),
            text_color=COLOR_WARNING
        )
        self.lbl_status_dot.pack(side="left", padx=(10, 4), pady=4)

        self.lbl_status = ctk.CTkLabel(
            status_box,
            text=self.status_text,
            font=ctk.CTkFont(family="Segoe UI", size=12),
            text_color=COLOR_TEXT_MUTED
        )
        self.lbl_status.pack(side="left", pady=4)

        # CONTAINER PRINCIPAL ROLÁVEL
        self.scroll_container = ctk.CTkScrollableFrame(
            self,
            fg_color="transparent",
            scrollbar_button_color="#1E293B",
            scrollbar_button_hover_color=COLOR_ACCENT
        )
        self.scroll_container.pack(fill="both", expand=True, padx=10, pady=(0, 8))

        # =====================================================================
        # 2. SIMULADOR DO ANEL DE 8 LEDS WS2812B (HARDWARE REPLICA)
        # =====================================================================
        ring_card = ctk.CTkFrame(self.scroll_container, fg_color=COLOR_CARD, corner_radius=12, border_width=1, border_color=COLOR_CARD_BORDER)
        ring_card.pack(fill="x", pady=4)

        ring_header = ctk.CTkFrame(ring_card, fg_color="transparent")
        ring_header.pack(fill="x", padx=14, pady=(8, 2))

        lbl_ring_title = ctk.CTkLabel(
            ring_header,
            text="ANEL DE 8 LEDS WS2812B (REPLICA DO DIAL FÍSICO)",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=COLOR_TEXT_MUTED
        )
        lbl_ring_title.pack(side="left")

        # Canvas para desenhar o anel de 8 LEDs
        self.canvas_ring = ctk.CTkCanvas(ring_card, width=130, height=130, bg="#141C2E", highlightthickness=0)
        self.canvas_ring.pack(pady=(2, 6))

        # Desenha a base inicial dos 8 LEDs
        self.led_ids = []
        cx, cy, radius = 65, 65, 45
        for i in range(8):
            angle = math.radians(i * (360 / 8) - 90)
            x = cx + radius * math.cos(angle)
            y = cy + radius * math.sin(angle)
            led_id = self.canvas_ring.create_oval(x - 7, y - 7, x + 7, y + 7, fill="#1E2A42", outline="#0B0F19", width=2)
            self.led_ids.append(led_id)

        # Centro decorativo do dial
        self.canvas_ring.create_oval(cx - 24, cy - 24, cx + 24, cy + 24, fill="#0B0F19", outline="#1E2A42", width=2)
        self.ring_center_text = self.canvas_ring.create_text(cx, cy, text="30%", fill=COLOR_ACCENT, font=("Segoe UI", 9, "bold"))

        # =====================================================================
        # 3. CARD DOS 7 MODOS DE TRABALHO
        # =====================================================================
        modes_card = ctk.CTkFrame(self.scroll_container, fg_color=COLOR_CARD, corner_radius=12, border_width=1, border_color=COLOR_CARD_BORDER)
        modes_card.pack(fill="x", pady=5)

        lbl_modes_title = ctk.CTkLabel(
            modes_card,
            text="MODOS DE TRABALHO (SELEÇÃO RÁPIDA - 7 MODOS)",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=COLOR_TEXT_MUTED
        )
        lbl_modes_title.pack(anchor="w", padx=14, pady=(10, 6))

        modes_grid = ctk.CTkFrame(modes_card, fg_color="transparent")
        modes_grid.pack(fill="x", padx=10, pady=(0, 6))
        modes_grid.columnconfigure((0, 1), weight=1, uniform="modes")

        self.mode_buttons = {}
        for m_id, m_data in MODES_CONFIG.items():
            row = (m_id - 1) // 2
            col = (m_id - 1) % 2

            btn = ctk.CTkButton(
                modes_grid,
                text=f"{m_data['icon']}  {m_data['name']}",
                font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
                fg_color="#1E293B" if m_id != self.active_mode else m_data["color"],
                text_color=COLOR_TEXT_WHITE if m_id != self.active_mode else "#000000",
                hover_color=m_data["color"],
                height=36,
                corner_radius=8,
                border_width=1,
                border_color=m_data["color"],
                command=lambda mid=m_id: self._on_mode_click(mid)
            )
            if m_id == 7:
                btn.grid(row=row, column=0, columnspan=2, padx=4, pady=4, sticky="ew")
            else:
                btn.grid(row=row, column=col, padx=4, pady=4, sticky="ew")
            self.mode_buttons[m_id] = btn

        # Banner explicativo do modo ativo
        self.mode_info_box = ctk.CTkFrame(modes_card, fg_color="#0F172A", corner_radius=8, border_width=1, border_color="#1E293B")
        self.mode_info_box.pack(fill="x", padx=10, pady=(4, 8))

        self.lbl_mode_cw = ctk.CTkLabel(
            self.mode_info_box,
            text=MODES_CONFIG[1]["turn_cw"],
            font=ctk.CTkFont(size=11),
            text_color=MODES_CONFIG[1]["color"]
        )
        self.lbl_mode_cw.pack(anchor="w", padx=10, pady=(6, 2))

        self.lbl_mode_ccw = ctk.CTkLabel(
            self.mode_info_box,
            text=MODES_CONFIG[1]["turn_ccw"],
            font=ctk.CTkFont(size=11),
            text_color=COLOR_TEXT_MUTED
        )
        self.lbl_mode_ccw.pack(anchor="w", padx=10, pady=(0, 2))

        self.lbl_mode_click = ctk.CTkLabel(
            self.mode_info_box,
            text=MODES_CONFIG[1]["click"],
            font=ctk.CTkFont(size=11),
            text_color="#CBD5E1"
        )
        self.lbl_mode_click.pack(anchor="w", padx=10, pady=(0, 6))

        # Indicador de Última Ação do Dial Físico
        self.action_feedback_box = ctk.CTkFrame(modes_card, fg_color="#111B2E", corner_radius=6, border_width=1, border_color="#1E2A42")
        self.action_feedback_box.pack(fill="x", padx=10, pady=(0, 10))

        self.lbl_last_action = ctk.CTkLabel(
            self.action_feedback_box,
            text="⚡ SuperDial-Pro pronto. Gire o botão físico para controlar o Windows.",
            font=ctk.CTkFont(family="Consolas", size=11),
            text_color=COLOR_ACCENT
        )
        self.lbl_last_action.pack(padx=8, pady=4)

        # =====================================================================
        # 4. CARD DE VOLUME MASTER (CHAR 1 SYNC)
        # =====================================================================
        vol_card = ctk.CTkFrame(self.scroll_container, fg_color=COLOR_CARD, corner_radius=12, border_width=1, border_color=COLOR_CARD_BORDER)
        vol_card.pack(fill="x", pady=6)

        vol_header = ctk.CTkFrame(vol_card, fg_color="transparent")
        vol_header.pack(fill="x", padx=14, pady=(10, 4))

        lbl_vol_title = ctk.CTkLabel(
            vol_header,
            text="VOLUME MASTER DO WINDOWS (CHAR 1)",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=COLOR_TEXT_MUTED
        )
        lbl_vol_title.pack(side="left")

        self.lbl_vol_percent = ctk.CTkLabel(
            vol_header,
            text=f"{self.current_volume}%",
            font=ctk.CTkFont(family="Segoe UI", size=18, weight="bold"),
            text_color=MODES_CONFIG[1]["color"]
        )
        self.lbl_vol_percent.pack(side="right")

        vol_controls = ctk.CTkFrame(vol_card, fg_color="transparent")
        vol_controls.pack(fill="x", padx=14, pady=(0, 10))

        self.slider_volume = ctk.CTkSlider(
            vol_controls,
            from_=0,
            to=100,
            number_of_steps=100,
            progress_color=MODES_CONFIG[1]["color"],
            button_color=MODES_CONFIG[1]["color"],
            button_hover_color="#38BDF8",
            command=self._on_vol_slider_drag
        )
        self.slider_volume.set(self.current_volume)
        self.slider_volume.pack(fill="x", side="left", expand=True, padx=(0, 10))

        self.btn_mute = ctk.CTkButton(
            vol_controls,
            text="🔊 Normal",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#1E293B",
            hover_color="#334155",
            width=80,
            height=30,
            corner_radius=6,
            command=self._on_mute_click
        )
        self.btn_mute.pack(side="right")

        # =====================================================================
        # 5. CARD ILUMINAÇÃO DE MESA & ARGB STUDIO (CHAR 2)
        # =====================================================================
        argb_card = ctk.CTkFrame(self.scroll_container, fg_color=COLOR_CARD, corner_radius=12, border_width=1, border_color=COLOR_CARD_BORDER)
        argb_card.pack(fill="x", pady=6)

        lbl_argb_title = ctk.CTkLabel(
            argb_card,
            text="ILUMINAÇÃO DE MESA & ARGB STUDIO (CHAR 2)",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=COLOR_TEXT_MUTED
        )
        lbl_argb_title.pack(anchor="w", padx=14, pady=(10, 4))

        bright_box = ctk.CTkFrame(argb_card, fg_color="transparent")
        bright_box.pack(fill="x", padx=14, pady=(2, 6))

        self.lbl_desk_bright = ctk.CTkLabel(
            bright_box,
            text=f"Brilho da Mesa (Modo 7): {self.desk_brightness}%",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=COLOR_TEXT_WHITE
        )
        self.lbl_desk_bright.pack(side="left")

        self.btn_toggle_light = ctk.CTkButton(
            bright_box,
            text="💡 Ligada",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#B4DCFF",
            text_color="#000000",
            hover_color="#E0F2FE",
            width=75,
            height=26,
            corner_radius=6,
            command=self._on_light_toggle_click
        )
        self.btn_toggle_light.pack(side="right")

        self.slider_bright = ctk.CTkSlider(
            argb_card,
            from_=0,
            to=100,
            progress_color="#B4DCFF",
            button_color="#B4DCFF",
            command=self._on_bright_slider_drag
        )
        self.slider_bright.set(self.desk_brightness)
        self.slider_bright.pack(fill="x", padx=14, pady=(0, 8))

        lbl_palette = ctk.CTkLabel(
            argb_card,
            text="Paleta Rápida (Envia 3 Bytes RGB para o Dial):",
            font=ctk.CTkFont(size=11),
            text_color=COLOR_TEXT_MUTED
        )
        lbl_palette.pack(anchor="w", padx=14, pady=(2, 4))

        colors_frame = ctk.CTkFrame(argb_card, fg_color="transparent")
        colors_frame.pack(fill="x", padx=14, pady=(0, 12))

        for hex_c, name, rgb_val in ARGB_PRESET_COLORS:
            c_btn = ctk.CTkButton(
                colors_frame,
                text="",
                width=24,
                height=24,
                corner_radius=12,
                fg_color=hex_c,
                hover_color=hex_c,
                border_width=2,
                border_color="#FFFFFF" if rgb_val == self.current_rgb else "#334155",
                command=lambda r=rgb_val: self._on_color_click(r)
            )
            c_btn.pack(side="left", padx=3, expand=True)

        # Atualiza anel virtual pela primeira vez
        self.update_virtual_ring()

    # =========================================================================
    # RENDERIZAÇÃO DO ANEL VIRTUAL DE LEDS (IDÊNTICO AO ESP32)
    # =========================================================================

    def update_virtual_ring(self):
        """Renderiza os 8 LEDs virtuais com os mesmos algoritmos do firmware C++."""
        # 1. Modo 1: Barra de Volume Progressiva
        if self.active_mode == 1:
            vol = max(0, min(100, self.current_volume))
            self.canvas_ring.itemconfig(self.ring_center_text, text=f"{vol}%", fill=MODES_CONFIG[1]["color"])
            total_brilho = (vol * 8 * 255) // 100

            for i in range(8):
                brilho_led = total_brilho - (i * 255)
                brilho_led = max(0, min(255, brilho_led))
                if brilho_led == 0:
                    color = "#141F30"
                else:
                    g = (140 * brilho_led) // 255
                    b = (255 * brilho_led) // 255
                    color = f"#{0:02x}{g:02x}{b:02x}"
                self.canvas_ring.itemconfig(self.led_ids[i], fill=color)

        # 2. Modo 7: Luz de Mesa Dimmerizada
        elif self.active_mode == 7:
            brilho = self.desk_brightness if self.desk_light_on else 0
            self.canvas_ring.itemconfig(self.ring_center_text, text=f"{brilho}%", fill="#B4DCFF")
            val = (brilho * 255) // 100
            if val == 0:
                color = "#141F30"
            else:
                color = f"#{val:02x}{val:02x}{val:02x}"
            for i in range(8):
                self.canvas_ring.itemconfig(self.led_ids[i], fill=color)

        # 3. Modos 2 a 6: Apenas 1 LED aceso girando (fundo 100% apagado)
        else:
            m_color = MODES_CONFIG[self.active_mode]["color"]
            self.canvas_ring.itemconfig(self.ring_center_text, text=f"M{self.active_mode}", fill=m_color)
            for i in range(8):
                if i == (self.cursor_led % 8):
                    self.canvas_ring.itemconfig(self.led_ids[i], fill=m_color)
                else:
                    self.canvas_ring.itemconfig(self.led_ids[i], fill="#101827")

    def step_cursor_led(self, direction: int):
        """Avança ou retrocede o LED do cursor nos Modos 2-6."""
        if direction == 1:
            self.cursor_led = (self.cursor_led + 1) % 8
        elif direction == 2:
            self.cursor_led = (self.cursor_led - 1 + 8) % 8
        self.update_virtual_ring()

    # =========================================================================
    # EVENTOS DE INTERFACE
    # =========================================================================

    def _on_reconnect_click(self):
        if self.on_reconnect_clicked:
            self.on_reconnect_clicked()

    def _on_mode_click(self, mode_id: int):
        self.set_active_mode(mode_id)
        if self.on_mode_selected:
            self.on_mode_selected(mode_id)

    def set_active_mode(self, mode_id: int):
        if mode_id not in MODES_CONFIG:
            return
        self.active_mode = mode_id
        self.cursor_led = 0
        m_data = MODES_CONFIG[mode_id]

        for mid, btn in self.mode_buttons.items():
            if mid == mode_id:
                btn.configure(fg_color=m_data["color"], text_color="#000000")
            else:
                btn.configure(fg_color="#1E293B", text_color=COLOR_TEXT_WHITE)

        self.lbl_mode_cw.configure(text=m_data["turn_cw"], text_color=m_data["color"])
        self.lbl_mode_ccw.configure(text=m_data["turn_ccw"])
        self.lbl_mode_click.configure(text=m_data["click"])

        self.update_virtual_ring()

        if self._tray_icon:
            self._tray_icon.update_menu()

    def flash_action_feedback(self, action_type: int, mode: int, action_text: str):
        icon = "🔄" if action_type == 1 else ("🔁" if action_type == 2 else "🔘")
        msg = f"{icon} Modo {mode}: {action_text}"
        self.lbl_last_action.configure(text=msg, text_color="#38BDF8")
        self.after(1200, lambda: self.lbl_last_action.configure(text_color=COLOR_ACCENT))

    def _on_vol_slider_drag(self, val: float):
        v = int(round(val))
        self.current_volume = v
        self.lbl_vol_percent.configure(text=f"{v}%")
        self.update_virtual_ring()
        if self.on_volume_slider_changed:
            self.on_volume_slider_changed(v)

    def _on_mute_click(self):
        if self.on_mute_toggled:
            self.on_mute_toggled()

    def update_volume_display(self, volume: int, is_muted: bool):
        self.current_volume = volume
        self.is_muted = is_muted

        self.lbl_vol_percent.configure(
            text=f"{volume}%" if not is_muted else "MUDO",
            text_color=COLOR_DANGER if is_muted else MODES_CONFIG[1]["color"]
        )
        self.slider_volume.set(volume)

        if is_muted:
            self.btn_mute.configure(text="🔇 Mudo", fg_color=COLOR_DANGER, hover_color="#DC2626")
        else:
            self.btn_mute.configure(text="🔊 Normal", fg_color="#1E293B", hover_color="#334155")

        self.update_virtual_ring()

    def update_connection_status(self, connected: bool, message: str):
        self.is_connected = connected
        self.status_text = message

        dot_color = COLOR_SUCCESS if connected else COLOR_WARNING
        self.lbl_status_dot.configure(text_color=dot_color)
        self.lbl_status.configure(text=message)

        if self._tray_icon:
            self._tray_icon.icon = create_dial_image(64, connected=connected)
            self._tray_icon.title = f"SuperDial Hub - {'Conectado' if connected else 'Desconectado'}"
            self._tray_icon.update_menu()

    def _on_color_click(self, rgb_val: Tuple[int, int, int]):
        self.current_rgb = rgb_val
        if self.on_rgb_selected:
            self.on_rgb_selected(rgb_val[0], rgb_val[1], rgb_val[2])

    def _on_bright_slider_drag(self, val: float):
        b = int(round(val))
        self.set_desk_brightness(b, notify=True)

    def set_desk_brightness(self, level: int, notify: bool = False):
        level = max(0, min(100, level))
        self.desk_brightness = level
        self.lbl_desk_bright.configure(text=f"Brilho da Mesa (Modo 7): {level}%")
        self.slider_bright.set(level)

        if level > 0:
            self.desk_light_on = True
            self.btn_toggle_light.configure(text="💡 Ligada", fg_color="#B4DCFF", text_color="#000000")
        else:
            self.desk_light_on = False
            self.btn_toggle_light.configure(text="🌑 Desligada", fg_color="#1E293B", text_color=COLOR_TEXT_WHITE)

        self.update_virtual_ring()

        if notify and self.on_brightness_slider_changed:
            self.on_brightness_slider_changed(level)

    def _on_light_toggle_click(self):
        if self.on_light_toggle_clicked:
            self.on_light_toggle_clicked()

    def toggle_desk_light(self):
        if self.desk_light_on:
            self.set_desk_brightness(0, notify=True)
        else:
            self.set_desk_brightness(80, notify=True)

    # =========================================================================
    # SYSTEM TRAY
    # =========================================================================

    def _init_system_tray(self):
        menu = pystray.Menu(
            item("Abrir SuperDial Hub", self._tray_show_window, default=True),
            item(lambda text: f"Status: {'Conectado' if self.is_connected else 'Buscando...'}", lambda: None, enabled=False),
            item(lambda text: f"Modo: {MODES_CONFIG[self.active_mode]['name']}", lambda: None, enabled=False),
            pystray.Menu.SEPARATOR,
            item("Mudo (Alternar)", self._tray_toggle_mute),
            pystray.Menu.SEPARATOR,
            item("Sair do SuperDial Hub", self._tray_exit_app),
        )

        icon_img = create_dial_image(64, connected=False)
        self._tray_icon = pystray.Icon("SuperDialHub", icon_img, "SuperDial Hub", menu)
        threading.Thread(target=self._tray_icon.run, daemon=True).start()

    def hide_to_tray(self):
        self.withdraw()

    def show_from_tray(self):
        self.deiconify()
        self.lift()
        self.focus_force()

    def _tray_show_window(self, icon=None, item=None):
        self.after(0, self.show_from_tray)

    def _tray_toggle_mute(self, icon=None, item=None):
        if self.on_mute_toggled:
            self.after(0, self.on_mute_toggled)

    def _tray_exit_app(self, icon=None, item=None):
        if self._tray_icon:
            self._tray_icon.stop()
        if self.on_app_exit:
            self.on_app_exit()
        self.after(0, self.destroy)
