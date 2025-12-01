#!/usr/bin/env python3
# file: ~/Desktop/KGB-Finance-2025/KGB_2025_FullFinance.py
# 💰 KGB Finance 2025 — Full Edition (PyQt5)
# - Budget saldo-fix
# - Beleggingen/Crypto winst-verlies
# - Dashboard grafiek: Lijn/Balk/Cirkel (matplotlib)
# - 50 pastelkleuren + sliders (intensiteit/raster) + opslag in settings.json
# - Agenda met "Afspraak"
# - Familie-tab + Export/backup
# - Loginachtergrond met euro-foto's uit ~/Desktop/euro's of ~/Desktop/euros

import sys, os, json, sqlite3, hashlib, csv, datetime, glob, random
from typing import Dict, List, Tuple

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QLineEdit, QPushButton, QMessageBox, QTabWidget, QTableWidget,
    QTableWidgetItem, QColorDialog, QSlider, QHeaderView, QMenu, QFileDialog,
    QAbstractItemView, QRadioButton, QButtonGroup
)
from PyQt5.QtGui import QFont, QColor, QCursor, QPainter, QPixmap
from PyQt5.QtCore import Qt, QRect

# matplotlib embed
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg
from matplotlib.figure import Figure


# -------------------- Paden / DB --------------------
BASE = os.path.expanduser("~/Desktop/KGB-Finance-2025")
DATA_DIR = os.path.join(BASE, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "users.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            name TEXT PRIMARY KEY,
            pin  TEXT
        )
    """)
    conn.commit()
    conn.close()


def user_dir(name: str) -> str:
    d = os.path.join(DATA_DIR, name)
    os.makedirs(d, exist_ok=True)
    return d


def json_path(name: str) -> str:
    return os.path.join(user_dir(name), "data.json")


def settings_path(name: str) -> str:
    return os.path.join(user_dir(name), "settings.json")


def load_data(name: str) -> dict:
    p = json_path(name)
    if os.path.exists(p):
        with open(p, "r") as f:
            return json.load(f)
    return {"budget": [], "investments": [], "crypto": [], "agenda": []}


def save_data(name: str, data: dict) -> None:
    with open(json_path(name), "w") as f:
        json.dump(data, f, indent=2)


def export_to_csv(name: str, data: dict, folder: str) -> None:
    os.makedirs(folder, exist_ok=True)
    for key, value in data.items():
        if isinstance(value, list):
            path = os.path.join(folder, f"{key}.csv")
            with open(path, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerows(value)


def load_settings(name: str) -> dict:
    p = settings_path(name)
    if os.path.exists(p):
        with open(p, "r") as f:
            try:
                s = json.load(f)
                return s
            except Exception:
                pass
    return {}


def save_settings(name: str, settings: dict) -> None:
    with open(settings_path(name), "w") as f:
        json.dump(settings, f, indent=2)


# -------------------- Thema --------------------
PASTEL_COLORS = [
    "#A0C4FF","#BDB2FF","#FFC6FF","#9BF6FF","#FDFFB6","#CAFFBF","#FFADAD",
    "#FFD6A5","#E4C1F9","#CDEAC0","#B9FBC0","#FFD5C2","#F7DAD9","#E2ECE9",
    "#E6CBA8","#E4C6A1","#E8AEB7","#A0CED9","#E8D7FF","#A3D5D3","#D9E8E3",
    "#FFF3B0","#FFCFD2","#F1E3FF","#C8E7FF","#E3F8FF","#FFEEE8","#FFE3E3",
    "#E5FFFB","#F6E6FF","#F9D8D6","#D7F9F1","#F8E8C6","#FBE7E1","#E0F7FA",
    "#E8F5E9","#FFEBEE","#FFFDE7","#EDE7F6","#E3F2FD","#FCE4EC","#F3E5F5",
    "#FFECB3","#D1C4E9","#BBDEFB","#C8E6C9","#F0F4C3","#DCEDC8",
]

DEFAULT_THEME = {
    "bg": "#EAF4FF",
    "sheet": "#FFFFFF",
    "border": "#0078D4",
    "button": "#FFE0B2",
    "text": "#000000",
    "grid": "#B0C4DE",
    "intensity": 100,
    "grid_intensity": 100,
}


# -------------------- Helpers --------------------
def to_float(s: str) -> float:
    try:
        s = (s or "").strip().replace(",", ".")
        return float(s) if s else 0.0
    except Exception:
        return 0.0


# -------------------- Tabelcomponent --------------------
class EditableTable(QTableWidget):
    def __init__(self, user: str, key: str, headers: List[str], calc_func=None):
        super().__init__(30, len(headers))
        self.user = user
        self.key = key
        self.headers = headers
        self.calc_func = calc_func

        self.setHorizontalHeaderLabels(headers)
        self.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.verticalHeader().setVisible(False)
        self.setEditTriggers(QAbstractItemView.AllEditTriggers)
        self.setContextMenuPolicy(Qt.CustomContextMenu)
        self.customContextMenuRequested.connect(self.show_context_menu)

        self.itemChanged.connect(self.auto_save)
        self.load_data()

    def show_context_menu(self, pos):
        menu = QMenu(self)
        delete_action = menu.addAction("🗑️ Verwijder rij")
        chosen = menu.exec_(self.mapToGlobal(pos))
        if chosen == delete_action:
            row = self.currentRow()
            if row >= 0:
                self.removeRow(row)
                self.insertRow(self.rowCount())
                self.auto_save()

    def load_data(self):
        stored = load_data(self.user).get(self.key, [])
        for r, row in enumerate(stored):
            for c, value in enumerate(row):
                if r < self.rowCount() and c < self.columnCount():
                    self.setItem(r, c, QTableWidgetItem(str(value)))

    def collect_rows(self) -> List[List[str]]:
        rows = []
        for r in range(self.rowCount()):
            row = []
            for c in range(self.columnCount()):
                it = self.item(r, c)
                row.append(it.text() if it else "")
            if any(cell.strip() for cell in row):
                rows.append(row)
        return rows

    def auto_save(self):
        rows = self.collect_rows()
        if self.calc_func:
            try:
                rows = self.calc_func(rows)
            except Exception:
                pass

        self.blockSignals(True)
        for r, row in enumerate(rows):
            for c, val in enumerate(row):
                if r < self.rowCount() and c < self.columnCount():
                    it = self.item(r, c)
                    if it is None:
                        it = QTableWidgetItem()
                        self.setItem(r, c, it)
                    it.setText(str(val))
        self.blockSignals(False)

        data = load_data(self.user)
        data[self.key] = rows
        save_data(self.user, data)


# -------------------- Budget --------------------
class BudgetView(QWidget):
    def __init__(self, user: str):
        super().__init__()
        self.user = user
        layout = QVBoxLayout(self)
        title = QLabel("📋 Budget")
        title.setFont(QFont("Arial", 12, QFont.Bold))
        layout.addWidget(title)

        headers = ["Datum","Categorie","Omschrijving","Inkomen","Uitgave","Saldo"]
        self.table = EditableTable(user, "budget", headers, self.calc_budget)
        layout.addWidget(self.table)

    def calc_budget(self, rows: List[List[str]]) -> List[List[str]]:
        out = []
        for row in rows:
            while len(row) < 6:
                row.append("")
            income = to_float(row[3])
            expense = to_float(row[4])
            row[5] = f"{income - expense:.2f}"
            out.append(row)
        return out


# -------------------- Beleggingen --------------------
class InvestmentsView(QWidget):
    def __init__(self, user: str):
        super().__init__()
        self.user = user
        layout = QVBoxLayout(self)
        title = QLabel("💼 Beleggingen")
        title.setFont(QFont("Arial", 12, QFont.Bold))
        layout.addWidget(title)

        headers = ["Datum","Aandeel","Aantal","Aankoop","Verkoop","Dividend","Winst","Verlies"]
        self.table = EditableTable(user, "investments", headers, self.calc_invest)
        layout.addWidget(self.table)

    def calc_invest(self, rows):
        out = []
        for row in rows:
            while len(row) < 8:
                row.append("")
            qty = to_float(row[2])
            buy = to_float(row[3])
            sell = to_float(row[4])
            divi = to_float(row[5])
            total = (sell - buy) * qty + divi
            if total >= 0:
                row[6] = f"{total:.2f}"
                row[7] = ""
            else:
                row[6] = ""
                row[7] = f"{abs(total):.2f}"
            out.append(row)
        return out


# -------------------- Crypto --------------------
class CryptoView(QWidget):
    def __init__(self, user: str):
        super().__init__()
        self.user = user
        layout = QVBoxLayout(self)
        title = QLabel("🪙 Crypto")
        title.setFont(QFont("Arial", 12, QFont.Bold))
        layout.addWidget(title)

        headers = ["Datum","Token","Aantal","Aankoop","Verkoop","Winst","Verlies"]
        self.table = EditableTable(user, "crypto", headers, self.calc_crypto)
        layout.addWidget(self.table)

    def calc_crypto(self, rows):
        out = []
        for row in rows:
            while len(row) < 7:
                row.append("")
            qty = to_float(row[2])
            buy = to_float(row[3])
            sell = to_float(row[4])
            total = (sell - buy) * qty
            if total >= 0:
                row[5] = f"{total:.2f}"
                row[6] = ""
            else:
                row[5] = ""
                row[6] = f"{abs(total):.2f}"
            out.append(row)
        return out


# -------------------- Agenda --------------------
class AgendaView(QWidget):
    def __init__(self, user: str):
        super().__init__()
        self.user = user
        layout = QVBoxLayout(self)
        title = QLabel("🗓️ Agenda")
        title.setFont(QFont("Arial", 12, QFont.Bold))
        layout.addWidget(title)

        headers = ["Datum","Taak","Status","Afspraak"]
        self.table = EditableTable(user, "agenda", headers, None)
        layout.addWidget(self.table)


# -------------------- Dashboard (matplotlib) --------------------
class MplCanvas(FigureCanvasQTAgg):
    def __init__(self):
        self.fig = Figure(figsize=(5, 3), dpi=100)
        super().__init__(self.fig)
        self.ax = self.fig.add_subplot(111)


class DashboardView(QWidget):
    def __init__(self, user: str):
        super().__init__()
        self.user = user

        v = QVBoxLayout(self)

        title = QLabel("📊 Overzicht")
        title.setFont(QFont("Arial", 14, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        v.addWidget(title)

        # totals
        self.label = QLabel("")
        self.label.setAlignment(Qt.AlignCenter)
        self.label.setFont(QFont("Arial", 12))
        v.addWidget(self.label)

        # chart type
        row = QHBoxLayout()
        row.addWidget(QLabel("Grafiek:"))
        self.rb_line = QRadioButton("Lijn"); self.rb_line.setChecked(True)
        self.rb_bar  = QRadioButton("Balk")
        self.rb_pie  = QRadioButton("Cirkel")
        self.group = QButtonGroup(self)
        for i, rb in enumerate([self.rb_line, self.rb_bar, self.rb_pie]):
            self.group.addButton(rb, i)
            row.addWidget(rb)
        row.addStretch()
        v.addLayout(row)

        self.canvas = MplCanvas()
        v.addWidget(self.canvas)

        self.group.buttonClicked.connect(self.refresh)
        self.refresh()

    def _budget_sorted(self, rows: List[List[str]]) -> List[List[str]]:
        def parse_date(s):
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
                try:
                    return datetime.datetime.strptime(s, fmt)
                except Exception:
                    pass
            return None
        with_dates = []
        for r in rows:
            d = parse_date((r[0] if r and r[0] else ""))
            with_dates.append((d or datetime.datetime.min, r))
        with_dates.sort(key=lambda x: x[0])
        return [r for _, r in with_dates]

    def refresh(self):
        data = load_data(self.user)

        # totals
        income = sum(to_float(r[3]) for r in data.get("budget", []))
        expense = sum(to_float(r[4]) for r in data.get("budget", []))

        inv = 0.0
        for r in data.get("investments", []):
            inv += to_float(r[6]) - to_float(r[7])

        crypto = 0.0
        for r in data.get("crypto", []):
            crypto += to_float(r[5]) - to_float(r[6])

        saldo = income - expense
        self.label.setText(
            f"Inkomen: {income:.2f}   |   Uitgave: {expense:.2f}   |   "
            f"Saldo: {saldo:.2f}   |   Winst beleggingen: {inv:.2f}   |   "
            f"Crypto: {crypto:.2f}"
        )

        # chart
        self.canvas.fig.clear()
        ax = self.canvas.fig.add_subplot(111)

        if self.rb_line.isChecked():
            running = 0.0
            xs, ys = [], []
            for r in self._budget_sorted(data.get("budget", [])):
                running += to_float(r[3]) - to_float(r[4])
                xs.append(r[0] or "")
                ys.append(running)
            ax.plot(xs, ys)
            ax.set_title("Lopend saldo")
            ax.set_ylabel("Saldo")
            ax.set_xlabel("Datum")

        elif self.rb_bar.isChecked():
            ax.bar(["Inkomen", "Uitgave"], [income, expense])
            ax.set_title("Inkomen vs Uitgave")

        else:  # pie
            vals = [max(income, 0.0), max(expense, 0.0)]
            labels = ["Inkomen", "Uitgave"]
            ax.pie(vals, labels=labels, autopct="%1.1f%%")
            ax.set_title("Verdeling")

        self.canvas.fig.tight_layout()
        self.canvas.draw_idle()


# -------------------- Instellingen --------------------
class SettingsView(QWidget):
    def __init__(self, main):
        super().__init__()
        self.main = main

        v = QVBoxLayout(self)
        title = QLabel("⚙️ Instellingen & Thema")
        title.setFont(QFont("Arial", 14, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        v.addWidget(title)

        # directe knoppen
        for label, key in [
            ("Achtergrondkleur", "bg"),
            ("Tabelkleur", "sheet"),
            ("Randkleur / raster", "border"),
            ("Knopkleur", "button"),
            ("Tekstkleur", "text"),
        ]:
            b = QPushButton(label)
            b.clicked.connect(lambda _, k=key: self.pick_color(k))
            v.addWidget(b)

        v.addWidget(QLabel("Pastelkleuren (klik voor menu):"))
        row = QHBoxLayout()
        for col in PASTEL_COLORS:
            b = QPushButton()
            b.setFixedSize(22, 22)
            b.setStyleSheet(f"background:{col}; border:1px solid #555;")
            b.clicked.connect(lambda _, c=col: self.pastel_menu(c))
            row.addWidget(b)
        v.addLayout(row)

        v.addWidget(QLabel("Intensiteit (lichter/donkerder):"))
        self.intensity = QSlider(Qt.Horizontal)
        self.intensity.setRange(50, 150)
        self.intensity.setValue(self.main.intensity_factor)
        self.intensity.valueChanged.connect(self.change_intensity)
        v.addWidget(self.intensity)

        v.addWidget(QLabel("Raster-donkerte:"))
        self.grid = QSlider(Qt.Horizontal)
        self.grid.setRange(50, 150)
        self.grid.setValue(self.main.grid_factor)
        self.grid.valueChanged.connect(self.change_grid)
        v.addWidget(self.grid)

        btn_export = QPushButton("💾 Export / Backup naar map (Drive/USB)")
        btn_export.clicked.connect(self.export_data)
        v.addWidget(btn_export)

        btn_reset = QPushButton("Reset standaard thema")
        btn_reset.clicked.connect(self.reset_theme)
        v.addWidget(btn_reset)

        v.addStretch()

    def pastel_menu(self, color_hex: str):
        menu = QMenu(self)
        act_bg = menu.addAction("Achtergrond")
        act_sheet = menu.addAction("Tabel (sheet)")
        act_border = menu.addAction("Rand / tabs / header")
        act_button = menu.addAction("Knoppen")
        act_grid = menu.addAction("Rasterlijnen")
        act_text = menu.addAction("Tekst")
        menu.addSeparator()
        act_all = menu.addAction("Alles tegelijk (snelle stijl)")
        chosen = menu.exec_(QCursor.pos())
        if not chosen:
            return

        t = self.main.base_theme
        if chosen == act_bg: t["bg"] = color_hex
        elif chosen == act_sheet: t["sheet"] = color_hex
        elif chosen == act_border: t["border"] = color_hex
        elif chosen == act_button: t["button"] = color_hex
        elif chosen == act_grid: t["grid"] = color_hex
        elif chosen == act_text: t["text"] = color_hex
        elif chosen == act_all:
            t["bg"] = color_hex; t["sheet"] = "#FFFFFF"; t["border"] = color_hex
            t["button"] = color_hex; t["grid"] = color_hex

        self.main.apply_theme(save=True)

    def pick_color(self, key: str):
        col = QColorDialog.getColor()
        if col.isValid():
            self.main.base_theme[key] = col.name()
            self.main.apply_theme(save=True)

    def change_intensity(self, value: int):
        self.main.intensity_factor = value
        self.main.apply_theme(save=True)

    def change_grid(self, value: int):
        self.main.grid_factor = value
        self.main.apply_theme(save=True)

    def reset_theme(self):
        self.main.base_theme = dict(DEFAULT_THEME)
        self.main.intensity_factor = DEFAULT_THEME["intensity"]
        self.main.grid_factor = DEFAULT_THEME["grid_intensity"]
        self.intensity.setValue(self.main.intensity_factor)
        self.grid.setValue(self.main.grid_factor)
        self.main.apply_theme(save=True)

    def export_data(self):
        folder = QFileDialog.getExistingDirectory(self, "Kies map voor backup")
        if folder:
            data = load_data(self.main.user)
            export_to_csv(self.main.user, data, folder)
            QMessageBox.information(self, "Export", "Data geëxporteerd.")


# -------------------- Familie --------------------
class FamilyView(QWidget):
    def __init__(self, user: str):
        super().__init__()
        v = QVBoxLayout(self)
        title = QLabel("👨‍👩‍👧 Familieweergave (basis)")
        title.setFont(QFont("Arial", 12, QFont.Bold))
        v.addWidget(title)
        info = QLabel("Gebruik export naar gedeelde map (bijv. Drive) om data te delen.")
        info.setAlignment(Qt.AlignCenter)
        v.addWidget(info)
        v.addStretch()


# -------------------- Main (tabs + thema) --------------------
class MainView(QWidget):
    def __init__(self, user: str):
        super().__init__()
        self.user = user

        # thema laden (persist)
        saved = load_settings(user)
        base = dict(DEFAULT_THEME)
        base.update({k: v for k, v in saved.get("theme", {}).items() if k in DEFAULT_THEME})
        self.base_theme = base
        self.intensity_factor = int(saved.get("intensity", base.get("intensity", 100)))
        self.grid_factor = int(saved.get("grid_intensity", base.get("grid_intensity", 100)))
        self.theme = dict(DEFAULT_THEME)

        v = QVBoxLayout(self)
        title = QLabel(f"Welkom {user} — KGB Finance 2025")
        title.setFont(QFont("Arial", 16, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        v.addWidget(title)

        self.tabs = QTabWidget()
        self.dashboard = DashboardView(user)
        self.tabs.addTab(self.dashboard, "📊 Overzicht")
        self.tabs.addTab(BudgetView(user), "📋 Budget")
        self.tabs.addTab(InvestmentsView(user), "💼 Beleggingen")
        self.tabs.addTab(CryptoView(user), "🪙 Crypto")
        self.tabs.addTab(AgendaView(user), "🗓️ Agenda")
        self.tabs.addTab(FamilyView(user), "👨‍👩‍👧 Familie")
        self.tabs.addTab(SettingsView(self), "⚙️ Instellingen")
        v.addWidget(self.tabs)

        self.apply_theme(save=False)

    def _apply_intensity(self, color_hex: str, factor: int) -> str:
        c = QColor(color_hex)
        if factor > 100: c = c.darker(factor)
        elif factor < 100: c = c.lighter(200 - factor)
        return c.name()

    def apply_theme(self, save: bool = False):
        bg = self._apply_intensity(self.base_theme["bg"], self.intensity_factor)
        sheet = self._apply_intensity(self.base_theme["sheet"], self.intensity_factor)
        border = self._apply_intensity(self.base_theme["border"], self.intensity_factor)
        button = self._apply_intensity(self.base_theme["button"], self.intensity_factor)
        text = self.base_theme["text"]
        grid = self._apply_intensity(self.base_theme["grid"], self.grid_factor)

        self.theme.update({"bg": bg,"sheet": sheet,"border": border,"button": button,"text": text,"grid": grid})

        style = f"""
        QWidget {{ background-color: {bg}; color: {text}; font-family: Arial; font-size: 12px; }}
        QTableWidget {{ background-color: {sheet}; gridline-color: {grid}; }}
        QHeaderView::section {{ background-color: {border}; padding: 3px; }}
        QPushButton {{ background-color: {button}; border: 1px solid {border}; border-radius: 6px; padding: 4px 8px; }}
        QPushButton:hover {{ background-color: {border}; color: #fff; }}
        """
        self.setStyleSheet(style)

        if save:
            settings = {
                "theme": {k: self.base_theme[k] for k in DEFAULT_THEME.keys()},
                "intensity": self.intensity_factor,
                "grid_intensity": self.grid_factor,
            }
            save_settings(self.user, settings)


# -------------------- Login (met euro-achtergrond) --------------------
def load_euro_pixmaps() -> List[QPixmap]:
    pixmaps = []
    for folder in [os.path.expanduser("~/Desktop/euro's"), os.path.expanduser("~/Desktop/euros")]:
        if os.path.isdir(folder):
            for ext in ("*.jpg","*.jpeg","*.png","*.bmp","*.gif"):
                for p in glob.glob(os.path.join(folder, ext)):
                    pm = QPixmap(p)
                    if not pm.isNull():
                        pixmaps.append(pm)
    # shuffle voor verdeling; voorkom gigantische aantallen
    random.shuffle(pixmaps)
    return pixmaps[:60]  # cap

class LoginView(QWidget):
    def __init__(self, parent):
        super().__init__()
        self.parent = parent
        self.bg = "#EAF4FF"
        self.pixmaps = load_euro_pixmaps()

        v = QVBoxLayout(self)
        v.setContentsMargins(24, 24, 24, 24)

        title = QLabel("Financiële Tracker KGB 2025")
        title.setFont(QFont("Arial", 20, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        v.addWidget(title)

        self.name_edit = QLineEdit(); self.name_edit.setPlaceholderText("Naam")
        v.addWidget(self.name_edit)

        self.pin_edit = QLineEdit(); self.pin_edit.setPlaceholderText("Pincode")
        self.pin_edit.setEchoMode(QLineEdit.Password)
        v.addWidget(self.pin_edit)

        btn_login = QPushButton("Inloggen")
        btn_login.clicked.connect(self.do_login)
        v.addWidget(btn_login)

        btn_color = QPushButton("🎨 Login achtergrondkleur")
        btn_color.clicked.connect(self.change_bg)
        v.addWidget(btn_color)

        tip = QLabel("Achtergrond: foto's uit map 'euro's' of 'euros' op Bureaublad. Nieuwe gebruiker? Pincode wordt aangemaakt.")
        tip.setAlignment(Qt.AlignCenter); tip.setFont(QFont("Arial", 10))
        v.addWidget(tip)

        v.addStretch()
        self.setLayout(v)

    def paintEvent(self, e):
        # teken zachte tegelachtergrond van euro-foto's
        painter = QPainter(self)
        painter.fillRect(self.rect(), QColor(self.bg))
        if not self.pixmaps:
            return
        w = self.width(); h = self.height()
        cellw, cellh = 180, 100  # tegelmaat
        alpha = 64               # zichtbaarheid
        i = 0
        for y in range(20, h, cellh + 20):
            for x in range(20, w, cellw + 20):
                pm = self.pixmaps[i % len(self.pixmaps)]
                scaled = pm.scaled(cellw, cellh, Qt.KeepAspectRatio, Qt.SmoothTransformation)
                painter.setOpacity(0.28)
                painter.drawPixmap(QRect(x, y, scaled.width(), scaled.height()), scaled)
                i += 1
        painter.setOpacity(1.0)

    def change_bg(self):
        c = QColorDialog.getColor()
        if c.isValid():
            self.bg = c.name()
            self.update()

    def do_login(self):
        name = self.name_edit.text().strip()
        pin = self.pin_edit.text().strip()
        if not name or not pin:
            QMessageBox.warning(self, "Fout", "Naam en pincode zijn verplicht.")
            return

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        h = hashlib.sha256(pin.encode()).hexdigest()
        row = c.execute("SELECT pin FROM users WHERE name=?", (name,)).fetchone()
        if row:
            if row[0] != h:
                QMessageBox.warning(self, "Fout", "Verkeerde pincode.")
                conn.close()
                return
        else:
            c.execute("INSERT INTO users (name, pin) VALUES (?, ?)", (name, h))
        conn.commit(); conn.close()
        self.parent.open_main(name)


# -------------------- MainWindow --------------------
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        init_db()
        self.setWindowTitle("💰 KGB Finance 2025 — Login")
        self.resize(1200, 760)
        self.login_view = LoginView(self)
        self.setCentralWidget(self.login_view)

    def open_main(self, user: str):
        self.main_view = MainView(user)
        self.setCentralWidget(self.main_view)
        self.setWindowTitle(f"💰 KGB Finance 2025 — {user}")


# -------------------- Entry --------------------
def main():
    app = QApplication(sys.argv)
    w = MainWindow(); w.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
