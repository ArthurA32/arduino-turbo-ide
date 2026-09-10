"""
SuperDial Hub - Interface Gráfica Moderna (Cyberpunk / Obsidian Dark)
Construída com CustomTkinter e integração nativa com System Tray (pystray + Pillow).
"""

import os
import sys
import threading
from typing import Callable, Optional, Tuple
from PIL import Image, ImageDraw
import customtkinter as ctk
import pystray
from pystray import MenuItem as item

# Configuração de Aparência CustomTkinter
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

# Paleta de Cores Cyberpunk Obsidian
COLOR_BG = "#0B0F19"
COLOR_CARD = "#141C2E"
COLOR_CARD_BORDER = "#1E2A42"
COLOR_ACCENT = "#00D2FF"      # Ciano Neon
COLOR_TEXT_WHITE = "#F8FAFC"
COLOR_TEXT_MUTED = "#94A3B8"
COLOR_SUCCESS = "#10B981"     # Verde Esmeralda
COLOR_WARNING = "#F59E0B"     # Âmbar
COLOR_DANGER = "#EF4444"      # Vermelho Alerta

# Modos de Trabalho
MODES_CONFIG = {
    1: {
        "name": "Volume Master",
        "icon": "🔊",
        "color": "#00D2FF",
        "turn": "Giro: Ajusta Volume Geral do Windows",
        "click": "Clique: Alterna Mudo (Mute/Unmute)",
    },
    2: {
        "name": "Alt+Tab Inteligente",
        "icon": "🗔",
        "color": "#A855F7",
        "turn": "Giro: Alterna entre Janelas Abertas",
        "click": "Clique: Minimiza Tudo / Mostra Área de Trabalho",
    },
    3: {
        "name": "Linha do Tempo / Vídeo",
        "icon": "🎬",
        "color": "#EF4444",
        "turn": "Giro: Avança / Retrocede 5s (YouTube e Editores)",
        "click": "Clique: Play / Pause de Mídia",
    },
    4: {
        "name": "Spotify & Streaming",
        "icon": "🎵",
        "color": "#22C55E",
        "turn": "Giro: Faixa Seguinte / Faixa Anterior",
        "click": "Clique: Play / Pause de Música",
    },
    5: {
        "name": "Navegador de Abas",
        "icon": "📑",
        "color": "#F97316",
        "turn": "Giro: Navega entre Abas (Ctrl+Tab)",
        "click": "Clique: Fecha Aba Atual (Ctrl+W)",
    },
    6: {
        "name": "Ilumina Mesa",
        "icon": "💡",
        "color": "#E2E8F0",
        "turn": "Giro: Dimmer Suave de Luz da Mesa",
        "click": "Clique: Liga / Desliga Iluminação",
    },
}

# 10 Cores da Paleta Rápida ARGB
ARGB_PRESET_COLORS = [
    ("#00D2FF", "Ciano Neon", (0, 210, 255)),
    ("#9D00FF", "Roxo Cyber", (157, 0, 255)),
    ("#FF0055", "Vermelho Ruby", (255, 0, 85)),
    ("#00FF88", "Verde Esmeralda", (0, 255, 136)),
    ("#FF8800", "Laranja Âmbar", (255, 136, 0)),
    ("#FFFFFF", "Branco Puro", (255, 255, 255)),
    ("#FFDD00", "Ouro", (255, 221, 0)),
    ("#FF00AA", "Rosa Choque", (255, 0, 170)),
    ("#0055FF", "Azul Profundo", (0, 85, 255)),
    ("#88FF00", "Verde Limão", (136, 255, 0)),
]

# 15 Efeitos ARGB
ARGB_EFFECTS = [
    "0: Estático (Static)",
    "1: Respiração (Breathing)",
    "2: Arco-Íris (Rainbow)",
    "3: Onda de Cores (Color Wave)",
    "4: Cometa (Comet)",
    "5: Pulso (Pulse)",
    "6: Gradiente Duplo (Blend)",
    "7: Estroboscópio (Strobe)",
    "8: Brilho Neon (Neon Glow)",
    "9: Reativo ao Áudio (Audio)",
    "10: Fogo (Fire)",
    "11: Matriz Cyber (Cyber)",
    "12: Centelha (Sparkle)",
    "13: Aurora Boreal (Aurora)",
    "14: Desligado (Off)",
]


def create_dial_image(size: int = 64, connected: bool = False) -> Image.Image:
    """Gera o ícone dinâmico do dial para a bandeja do sistema."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    accent = "#00D2FF" if connected else "#64748B"
    dot = "#10B981" if connected else "#EF4444"

    # Dial exterior
    draw.ellipse([2, 2, size - 3, size - 3], fill="#0B0F19", outline=accent, width=max(2, size // 16))
    # Dial interno
    inset = size // 4
    draw.ellipse([inset, inset, size - inset, size - inset], fill="#141C2E", outline=accent, width=max(1, size // 24))
    # Indicador de topo
    draw.line([(size // 2, 4), (size // 2, inset)], fill=accent, width=max(2, size // 12))
    # Ponto de status
    d_size = max(3, size // 7)
    draw.ellipse([size - d_size - 2, 2, size - 2, d_size + 2], fill=dot)
    return img


class SuperDialUI(ctk.CTk):
    """Janela principal do SuperDial Hub com tema Dark Cyberpunk."""

    def __init__(self):
        super().__init__()

        self.title("SuperDial Hub - Pro Control")
        self.geometry("470x760")
        self.minsize(470, 720)
        self.configure(fg_color=COLOR_BG)

        # Estado da Aplicação
        self.active_mode = 1
        self.current_volume = 50
        self.is_muted = False
        self.is_connected = False
        self.status_text = "Buscando SuperDial-Pro..."

        # Estado do ARGB
        self.argb_effect = 2  # Rainbow padrão
        self.argb_color1 = (0, 210, 255)
        self.argb_color2 = (157, 0, 255)
        self.argb_brightness = 80
        self.argb_speed = 50

        # Callbacks registrados externamente
        self.on_mode_selected: Optional[Callable[[int], None]] = None
        self.on_volume_changed: Optional[Callable[[int], None]] = None
        self.on_mute_toggled: Optional[Callable[[], None]] = None
        self.on_argb_changed: Optional[Callable[[int, Tuple[int, int, int], Tuple[int, int, int], int, int], None]] = None
        self.on_app_exit: Optional[Callable[[], None]] = None

        # Configura ícone da janela
        self._setup_window_icon()

        # Construção da Interface Gráfica
        self._build_ui()

        # Protocolo de Fechamento da Janela (Esconder na bandeja)
        self.protocol("WM_DELETE_WINDOW", self.hide_to_tray)

        # Inicia System Tray em thread separada
        self._tray_icon: Optional[pystray.Icon] = None
        self._init_system_tray()

    def _setup_window_icon(self):
        """Define o ícone da barra de tarefas se disponível."""
        ico_path = os.path.join(os.path.dirname(__file__), "assets", "icon.ico")
        if os.path.exists(ico_path):
            try:
                self.iconbitmap(ico_path)
            except Exception:
                pass

    def _build_ui(self):
        """Constrói os componentes gráficos da interface."""
        # =====================================================================
        # 1. HEADER BAR
        # =====================================================================
        header_frame = ctk.CTkFrame(self, fg_color=COLOR_CARD, corner_radius=12, border_width=1, border_color=COLOR_CARD_BORDER)
        header_frame.pack(fill="x", padx=14, pady=(12, 6))

        # Título e Badge
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

        # Controles do Header (Minimizar para a Bandeja)
        ctrl_box = ctk.CTkFrame(header_frame, fg_color="transparent")
        ctrl_box.pack(side="right", padx=10, pady=8)

        btn_tray = ctk.CTkButton(
            ctrl_box,
            text="🗕 Bandeja",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#1E293B",
            hover_color="#334155",
            text_color=COLOR_TEXT_WHITE,
            width=75,
            height=28,
            corner_radius=6,
            command=self.hide_to_tray
        )
        btn_tray.pack(side="right", padx=2)

        # Status BLE no Header
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

        # =====================================================================
        # CONTAINER PRINCIPAL ROLÁVEL (Para garantir ajuste em qualquer monitor)
        # =====================================================================
        self.scroll_container = ctk.CTkScrollableFrame(
            self,
            fg_color="transparent",
            scrollbar_button_color="#1E293B",
            scrollbar_button_hover_color=COLOR_ACCENT
        )
        self.scroll_container.pack(fill="both", expand=True, padx=10, pady=(0, 8))

        # =====================================================================
        # 2. CARD CENTRAL: OS 6 MODOS DE TRABALHO
        # =====================================================================
        modes_card = ctk.CTkFrame(self.scroll_container, fg_color=COLOR_CARD, corner_radius=12, border_width=1, border_color=COLOR_CARD_BORDER)
        modes_card.pack(fill="x", pady=5)

        lbl_modes_title = ctk.CTkLabel(
            modes_card,
            text="MODOS DE TRABALHO (SELEÇÃO RÁPIDA)",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=COLOR_TEXT_MUTED
        )
        lbl_modes_title.pack(anchor="w", padx=14, pady=(10, 6))

        # Grid dos 6 Modos
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
                height=38,
                corner_radius=8,
                border_width=1,
                border_color=m_data["color"],
                command=lambda mid=m_id: self._on_mode_click(mid)
            )
            btn.grid(row=row, column=col, padx=4, pady=4, sticky="ew")
            self.mode_buttons[m_id] = btn

        # Banner explicativo do modo ativo
        self.mode_info_box = ctk.CTkFrame(modes_card, fg_color="#0F172A", corner_radius=8, border_width=1, border_color="#1E293B")
        self.mode_info_box.pack(fill="x", padx=10, pady=(4, 10))

        self.lbl_mode_turn = ctk.CTkLabel(
            self.mode_info_box,
            text=MODES_CONFIG[1]["turn"],
            font=ctk.CTkFont(size=11),
            text_color=COLOR_ACCENT
        )
        self.lbl_mode_turn.pack(anchor="w", padx=10, pady=(6, 2))

        self.lbl_mode_click = ctk.CTkLabel(
            self.mode_info_box,
            text=MODES_CONFIG[1]["click"],
            font=ctk.CTkFont(size=11),
            text_color=COLOR_TEXT_MUTED
        )
        self.lbl_mode_click.pack(anchor="w", padx=10, pady=(0, 6))

        # =====================================================================
        # 3. CARD DE VOLUME (SINCRONIZAÇÃO EM TEMPO REAL)
        # =====================================================================
        vol_card = ctk.CTkFrame(self.scroll_container, fg_color=COLOR_CARD, corner_radius=12, border_width=1, border_color=COLOR_CARD_BORDER)
        vol_card.pack(fill="x", pady=6)

        vol_header = ctk.CTkFrame(vol_card, fg_color="transparent")
        vol_header.pack(fill="x", padx=14, pady=(10, 4))

        lbl_vol_title = ctk.CTkLabel(
            vol_header,
            text="VOLUME MASTER DO WINDOWS",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=COLOR_TEXT_MUTED
        )
        lbl_vol_title.pack(side="left")

        self.lbl_vol_percent = ctk.CTkLabel(
            vol_header,
            text=f"{self.current_volume}%",
            font=ctk.CTkFont(family="Segoe UI", size=18, weight="bold"),
            text_color=COLOR_ACCENT
        )
        self.lbl_vol_percent.pack(side="right")

        # Barra de Progresso e Slider
        vol_controls = ctk.CTkFrame(vol_card, fg_color="transparent")
        vol_controls.pack(fill="x", padx=14, pady=(0, 8))

        self.slider_volume = ctk.CTkSlider(
            vol_controls,
            from_=0,
            to=100,
            number_of_steps=100,
            progress_color=COLOR_ACCENT,
            button_color=COLOR_ACCENT,
            button_hover_color="#38BDF8",
            command=self._on_slider_change
        )
        self.slider_volume.set(self.current_volume)
        self.slider_volume.pack(fill="x", side="left", expand=True, padx=(0, 10))

        # Botão Mute
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
        # 4. CARD ARGB LIGHTING STUDIO (8 LEDs)
        # =====================================================================
        argb_card = ctk.CTkFrame(self.scroll_container, fg_color=COLOR_CARD, corner_radius=12, border_width=1, border_color=COLOR_CARD_BORDER)
        argb_card.pack(fill="x", pady=6)

        lbl_argb_title = ctk.CTkLabel(
            argb_card,
            text="ARGB LIGHTING STUDIO (8 LEDs)",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=COLOR_TEXT_MUTED
        )
        lbl_argb_title.pack(anchor="w", padx=14, pady=(10, 4))

        # Dropdown de Efeitos
        fx_frame = ctk.CTkFrame(argb_card, fg_color="transparent")
        fx_frame.pack(fill="x", padx=14, pady=(0, 8))

        lbl_fx = ctk.CTkLabel(fx_frame, text="Efeito:", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_WHITE)
        lbl_fx.pack(side="left", padx=(0, 8))

        self.cmb_effects = ctk.CTkComboBox(
            fx_frame,
            values=ARGB_EFFECTS,
            font=ctk.CTkFont(size=11),
            dropdown_font=ctk.CTkFont(size=11),
            fg_color="#0F172A",
            border_color=COLOR_CARD_BORDER,
            button_color="#1E293B",
            button_hover_color=COLOR_ACCENT,
            command=self._on_effect_selected
        )
        self.cmb_effects.set(ARGB_EFFECTS[self.argb_effect])
        self.cmb_effects.pack(side="left", fill="x", expand=True)

        # Paleta Rápida de 10 Cores
        lbl_palette = ctk.CTkLabel(argb_card, text="Paleta Rápida (Cor Primária / Secundária):", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_WHITE)
        lbl_palette.pack(anchor="w", padx=14, pady=(2, 4))

        colors_frame = ctk.CTkFrame(argb_card, fg_color="transparent")
        colors_frame.pack(fill="x", padx=14, pady=(0, 8))

        for idx, (hex_c, name, rgb_val) in enumerate(ARGB_PRESET_COLORS):
            c_btn = ctk.CTkButton(
                colors_frame,
                text="",
                width=24,
                height=24,
                corner_radius=12,
                fg_color=hex_c,
                hover_color=hex_c,
                border_width=2,
                border_color="#FFFFFF" if rgb_val == self.argb_color1 else "#334155",
                command=lambda r=rgb_val: self._on_color_swatch_click(r)
            )
            c_btn.pack(side="left", padx=3, expand=True)

        # Sliders de Brilho e Velocidade
        sliders_frame = ctk.CTkFrame(argb_card, fg_color="transparent")
        sliders_frame.pack(fill="x", padx=14, pady=(0, 10))
        sliders_frame.columnconfigure((0, 1), weight=1)

        # Brilho
        b_box = ctk.CTkFrame(sliders_frame, fg_color="transparent")
        b_box.grid(row=0, column=0, padx=4, sticky="ew")

        self.lbl_bright = ctk.CTkLabel(b_box, text=f"Brilho: {self.argb_brightness}%", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_MUTED)
        self.lbl_bright.pack(anchor="w")

        self.slider_bright = ctk.CTkSlider(
            b_box,
            from_=0,
            to=100,
            progress_color=COLOR_ACCENT,
            button_color=COLOR_ACCENT,
            command=self._on_bright_change
        )
        self.slider_bright.set(self.argb_brightness)
        self.slider_bright.pack(fill="x", pady=2)

        # Velocidade
        s_box = ctk.CTkFrame(sliders_frame, fg_color="transparent")
        s_box.grid(row=0, column=1, padx=4, sticky="ew")

        self.lbl_speed = ctk.CTkLabel(s_box, text=f"Velocidade: {self.argb_speed}%", font=ctk.CTkFont(size=11), text_color=COLOR_TEXT_MUTED)
        self.lbl_speed.pack(anchor="w")

        self.slider_speed = ctk.CTkSlider(
            s_box,
            from_=1,
            to=100,
            progress_color="#9D00FF",
            button_color="#9D00FF",
            command=self._on_speed_change
        )
        self.slider_speed.set(self.argb_speed)
        self.slider_speed.pack(fill="x", pady=2)

        # Botão Aplicar no Dial
        self.btn_apply_argb = ctk.CTkButton(
            argb_card,
            text="✨ Aplicar Iluminação no SuperDial-Pro",
            font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"),
            fg_color=COLOR_ACCENT,
            text_color="#000000",
            hover_color="#38BDF8",
            height=34,
            corner_radius=8,
            command=self._trigger_argb_sync
        )
        self.btn_apply_argb.pack(fill="x", padx=14, pady=(2, 12))

    # =========================================================================
    # EVENTOS DE INTERFACE & TRATAMENTO
    # =========================================================================

    def _on_mode_click(self, mode_id: int):
        """Disparado ao clicar em um dos 6 modos."""
        self.set_active_mode(mode_id)
        if self.on_mode_selected:
            self.on_mode_selected(mode_id)

    def set_active_mode(self, mode_id: int):
        """Atualiza visualmente o modo ativo na UI."""
        if mode_id not in MODES_CONFIG:
            return
        self.active_mode = mode_id
        m_data = MODES_CONFIG[mode_id]

        for mid, btn in self.mode_buttons.items():
            if mid == mode_id:
                btn.configure(fg_color=m_data["color"], text_color="#000000")
            else:
                btn.configure(fg_color="#1E293B", text_color=COLOR_TEXT_WHITE)

        self.lbl_mode_turn.configure(text=m_data["turn"], text_color=m_data["color"])
        self.lbl_mode_click.configure(text=m_data["click"])

        # Atualiza menu de bandeja se ativo
        if self._tray_icon:
            self._tray_icon.update_menu()

    def _on_slider_change(self, val: float):
        """Ajuste de volume manual via slider."""
        v = int(round(val))
        self.lbl_vol_percent.configure(text=f"{v}%")
        if self.on_volume_changed:
            self.on_volume_changed(v)

    def _on_mute_click(self):
        """Clique no botão de mudo da UI."""
        if self.on_mute_toggled:
            self.on_mute_toggled()

    def update_volume_display(self, volume: int, is_muted: bool):
        """Atualiza a exibição de volume (chamado pela thread de áudio ou BLE)."""
        self.current_volume = volume
        self.is_muted = is_muted

        self.lbl_vol_percent.configure(
            text=f"{volume}%" if not is_muted else "MUDO",
            text_color=COLOR_DANGER if is_muted else COLOR_ACCENT
        )
        self.slider_volume.set(volume)

        if is_muted:
            self.btn_mute.configure(text="🔇 Mudo", fg_color=COLOR_DANGER, hover_color="#DC2626")
        else:
            self.btn_mute.configure(text="🔊 Normal", fg_color="#1E293B", hover_color="#334155")

    def update_connection_status(self, connected: bool, message: str):
        """Atualiza a indicação visual de status BLE."""
        self.is_connected = connected
        self.status_text = message

        dot_color = COLOR_SUCCESS if connected else COLOR_WARNING
        self.lbl_status_dot.configure(text_color=dot_color)
        self.lbl_status.configure(text=message)

        if self._tray_icon:
            self._tray_icon.icon = create_dial_image(64, connected=connected)
            self._tray_icon.title = f"SuperDial Hub - {'Conectado' if connected else 'Desconectado'}"
            self._tray_icon.update_menu()

    def _on_effect_selected(self, choice: str):
        """Efeito ARGB selecionado no dropdown."""
        try:
            self.argb_effect = int(choice.split(":")[0].strip())
            self._trigger_argb_sync()
        except Exception:
            pass

    def _on_color_swatch_click(self, rgb_val: Tuple[int, int, int]):
        """Clique em uma das cores rápidas."""
        # Se Cor 1 já é essa cor, define Cor 2 para gradiente; caso contrário, define Cor 1
        if self.argb_color1 == rgb_val:
            self.argb_color2 = rgb_val
        else:
            self.argb_color1 = rgb_val
        self._trigger_argb_sync()

    def _on_bright_change(self, val: float):
        b = int(round(val))
        self.argb_brightness = b
        self.lbl_bright.configure(text=f"Brilho: {b}%")

    def _on_speed_change(self, val: float):
        s = int(round(val))
        self.argb_speed = s
        self.lbl_speed.configure(text=f"Velocidade: {s}%")

    def _trigger_argb_sync(self):
        """Envia os dados de iluminação se callback registrado."""
        if self.on_argb_changed:
            self.on_argb_changed(
                self.argb_effect,
                self.argb_color1,
                self.argb_color2,
                self.argb_brightness,
                self.argb_speed,
            )

    # =========================================================================
    # SYSTEM TRAY (BANDEJA DO SISTEMA)
    # =========================================================================

    def _init_system_tray(self):
        """Inicializa o ícone da bandeja com pystray."""
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

        # Inicia o tray em thread secundária
        threading.Thread(target=self._tray_icon.run, daemon=True).start()

    def hide_to_tray(self):
        """Esconde a janela gráfica na bandeja do sistema."""
        self.withdraw()

    def show_from_tray(self):
        """Restaura a janela gráfica da bandeja."""
        self.deiconify()
        self.lift()
        self.focus_force()

    def _tray_show_window(self, icon=None, item=None):
        self.after(0, self.show_from_tray)

    def _tray_toggle_mute(self, icon=None, item=None):
        if self.on_mute_toggled:
            self.after(0, self.on_mute_toggled)

    def _tray_exit_app(self, icon=None, item=None):
        """Fecha a aplicação por completo."""
        if self._tray_icon:
            self._tray_icon.stop()
        if self.on_app_exit:
            self.on_app_exit()
        self.after(0, self.destroy)
