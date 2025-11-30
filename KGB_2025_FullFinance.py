#!/usr/bin/env python3
# file: ~/Desktop/KGB-Finance-2025/KGB_2025_FullFinance.py
# 💰 KGB Finance 2025 — login gebruikt jouw euro-foto’s; logo linksboven; achtergrond geshuffeld; geen bandje.

import sys, os, json, sqlite3, hashlib, csv, datetime, re, glob, random
from typing import Dict, List, Tuple, Optional

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QMessageBox, QTabWidget, QTableWidget, QTableWidgetItem, QColorDialog,
    QSlider, QHeaderView, QMenu, QFileDialog, QAbstractItemView, QComboBox
)
from PyQt5.QtGui import (
    QFont, QColor, QCursor, QPainter, QPen, QPixmap, QFontMetrics, QBrush, QImage
)
from PyQt5.QtCore import Qt, QRect, QPoint

from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure

# ---------------- Paths / DB ----------------
BASE = os.path.expanduser("~/Desktop/KGB-Finance-2025")
DATA_DIR = os.path.join(BASE, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "users.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, pin TEXT)""")
    conn.commit(); conn.close()

def user_dir(name: str) -> str:
    d = os.path.join(DATA_DIR, name); os.makedirs(d, exist_ok=True); return d
def json_path(name: str) -> str: return os.path.join(user_dir(name), "data.json")

def load_data(name: str) -> dict:
    p = json_path(name)
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f: return json.load(f)
    return {"budget": [], "investments": [], "crypto": [], "agenda": [], "_prefs": {}}

def save_data(name: str, data: dict) -> None:
    with open(json_path(name), "w", encoding="utf-8") as f: json.dump(data, f, indent=2, ensure_ascii=False)

def export_to_csv(name: str, data: dict, folder: str) -> None:
    os.makedirs(folder, exist_ok=True)
    headers = {
        "budget": ["Datum","Categorie","Omschrijving","Inkomen","Uitgave","Saldo"],
        "investments": ["Datum","Aandeel","Aantal","Aankoop","Verkoop","Dividend","Winst","Verlies"],
        "crypto": ["Datum","Token","Aantal","Aankoop","Verkoop","Winst","Verlies"],
        "agenda": ["Datum","Taak","Status","Afspraak"],
    }
    for key, value in data.items():
        if isinstance(value, list):
            with open(os.path.join(folder, f"{key}.csv"), "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f); w.writerow(headers.get(key, [])); w.writerows(value)

# ---------------- Amount/date helpers ----------------
def parse_amount(s) -> float:
    if s is None: return 0.0
    s = str(s).strip()
    if not s: return 0.0
    s = re.sub(r"[^\d,.\-]", "", s)
    if "," in s and "." in s: s = s.replace(".", "").replace(",", ".")
    elif "," in s: s = s.replace(",", ".")
    try: return float(s)
    except: return 0.0

def parse_date(s: str) -> Optional[datetime.date]:
    if not s: return None
    for fmt in ("%d-%m-%Y","%Y-%m-%d","%d/%m/%Y","%d-%m-%y"):
        try: return datetime.datetime.strptime(s.strip(), fmt).date()
        except: pass
    return None

# ---------------- Theme ----------------
PASTEL_COLORS = [
    "#A0C4FF","#BDB2FF","#FFC6FF","#9BF6FF","#FDFFB6","#CAFFBF","#FFADAD","#FFD6A5","#E4C1F9","#CDEAC0",
    "#B9FBC0","#FFD5C2","#F7DAD9","#E2ECE9","#E6CBA8","#E4C6A1","#E8AEB7","#A0CED9","#E8D7FF","#A3D5D3",
    "#D9E8E3","#FFF3B0","#FFCFD2","#F1E3FF","#C8E7FF","#E3F8FF","#FFEEE8","#FFE3E3","#E5FFFB","#F6E6FF",
    "#F9D8D6","#D7F9F1","#F8E8C6","#FBE7E1","#E0F7FA","#E8F5E9","#FFEBEE","#FFFDE7","#EDE7F6","#E3F2FD",
    "#FCE4EC","#F3E5F5","#FFECB3","#D1C4E9","#BBDEFB","#C8E6C9","#F0F4C3","#DCEDC8","#D0E8FF","#FFE8F0",
]
DEFAULT_THEME = {"bg":"#EAF4FF","sheet":"#FFFFFF","border":"#0078D4","button":"#FFE0B2","text":"#000000","grid":"#B0C4DE"}

def load_theme_prefs(user: str) -> dict:
    d = load_data(user); prefs = d.get("_prefs") or {}
    base = dict(DEFAULT_THEME); base.update(prefs.get("theme") or {})
    return {"base": base, "intensity": int(prefs.get("intensity", 100)), "grid": int(prefs.get("grid", 100))}

def save_theme_prefs(user: str, base_theme: Dict[str,str], intensity: int, grid: int) -> None:
    d = load_data(user); d["_prefs"] = {"theme": base_theme, "intensity": int(intensity), "grid": int(grid)}; save_data(user, d)

def _hex_to_rgb(h: str): h=h.lstrip("#"); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def _rgb_to_hex(rgb) -> str: return "#{:02X}{:02X}{:02X}".format(*[max(0,min(255,int(x))) for x in rgb])
def adjust_intensity(hex_color: str, factor: int) -> str:
    r,g,b=_hex_to_rgb(hex_color)
    if factor==100: return hex_color
    if factor<100:
        t=(100-factor)/100.0; r+=(255-r)*t; g+=(255-g)*t; b+=(255-b)*t
    else:
        t=(factor-100)/100.0; r*= (1-t); g*= (1-t); b*= (1-t)
    return _rgb_to_hex((r,g,b))
def adjust_to_black_white(hex_color: str, factor: int) -> str:
    r,g,b=_hex_to_rgb(hex_color)
    if factor==100: return hex_color
    if factor<100:
        t=(100-factor)/100.0; r+=(255-r)*t; g+=(255-g)*t; b+=(255-b)*t
    else:
        t=(factor-100)/100.0; r*= (1-t); g*= (1-t); b*= (1-t)
    return _rgb_to_hex((r,g,b))

# ---------------- Table component ----------------
class EditableTable(QTableWidget):
    def __init__(self, user: str, key: str, headers, calc_func=None):
        super().__init__(30, len(headers))
        self.user, self.key, self.headers, self.calc_func = user, key, headers, calc_func
        self.setHorizontalHeaderLabels(headers)
        self.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.verticalHeader().setVisible(False)
        self.setEditTriggers(QAbstractItemView.AllEditTriggers)
        self.setContextMenuPolicy(Qt.CustomContextMenu)
        self.customContextMenuRequested.connect(self.show_context_menu)
        self.setAlternatingRowColors(True)
        self.itemChanged.connect(self.auto_save)
        self.load_data()

    def show_context_menu(self, pos):
        menu = QMenu(self)
        da = menu.addAction("🗑️ Verwijder rij")
        ia = menu.addAction("➕ Voeg lege rij onderaan toe")
        ch = menu.exec_(self.mapToGlobal(pos))
        if ch==da:
            r=self.currentRow()
            if r>=0: self.removeRow(r); self.insertRow(self.rowCount()); self.auto_save()
        elif ch==ia:
            self.insertRow(self.rowCount()); self.auto_save()

    def load_data(self):
        stored = load_data(self.user).get(self.key, [])
        for r,row in enumerate(stored):
            if r>=self.rowCount(): self.insertRow(self.rowCount())
            for c,val in enumerate(row):
                if c<self.columnCount(): self.setItem(r,c,QTableWidgetItem(str(val)))

    def auto_save(self):
        rows=[]
        for r in range(self.rowCount()):
            row=[(self.item(r,c).text() if self.item(r,c) else "") for c in range(self.columnCount())]
            if any(cell.strip() for cell in row): rows.append(row)
        if self.calc_func is not None: rows = self.calc_func(rows)
        self.blockSignals(True)
        for r,row in enumerate(rows):
            if r>=self.rowCount(): self.insertRow(self.rowCount())
            for c,val in enumerate(row):
                if c<self.columnCount():
                    it=self.item(r,c) or QTableWidgetItem(); it.setText(str(val)); self.setItem(r,c,it)
        self.blockSignals(False)
        d=load_data(self.user); d[self.key]=rows; save_data(self.user,d)

# ---------------- Budget ----------------
class BudgetView(QWidget):
    def __init__(self, user: str):
        super().__init__(); self.user=user
        lay=QVBoxLayout(self)
        t=QLabel("📋 Budget"); t.setFont(QFont("Arial",12,QFont.Bold)); lay.addWidget(t)
        headers=["Datum","Categorie","Omschrijving","Inkomen","Uitgave","Saldo"]
        self.table=EditableTable(user,"budget",headers,self.calc_budget); lay.addWidget(self.table)

    def calc_budget(self, rows):
        res=[]; running=0.0
        for row in rows:
            while len(row)<6: row.append("")
            income=parse_amount(row[3]); expense=parse_amount(row[4])
            if any(str(c).strip() for c in row[:5]): running+=income-expense; row[5]=f"{running:.2f}"
            else: row[5]=""
            res.append(row)
        return res

# ---------------- Investments ----------------
class InvestmentsView(QWidget):
    def __init__(self, user: str):
        super().__init__(); self.user=user
        lay=QVBoxLayout(self)
        t=QLabel("💼 Beleggingen"); t.setFont(QFont("Arial",12,QFont.Bold)); lay.addWidget(t)
        headers=["Datum","Aandeel","Aantal","Aankoop","Verkoop","Dividend","Winst","Verlies"]
        self.table=EditableTable(user,"investments",headers,self.calc_invest); lay.addWidget(self.table)

    def calc_invest(self, rows):
        res=[]
        for row in rows:
            while len(row)<8: row.append("")
            try:
                qty=parse_amount(row[2]); buy=parse_amount(row[3]); sell=parse_amount(row[4]); div=parse_amount(row[5])
                tot=(sell-buy)*qty+div
                if tot>=0: row[6]=f"{tot:.2f}"; row[7]=""
                else: row[6]=""; row[7]=f"{abs(tot):.2f}"
            except: pass
            res.append(row)
        return res

# ---------------- Crypto ----------------
class CryptoView(QWidget):
    def __init__(self, user: str):
        super().__init__(); self.user=user
        lay=QVBoxLayout(self)
        t=QLabel("🪙 Crypto"); t.setFont(QFont("Arial",12,QFont.Bold)); lay.addWidget(t)
        headers=["Datum","Token","Aantal","Aankoop","Verkoop","Winst","Verlies"]
        self.table=EditableTable(user,"crypto",headers,self.calc_crypto); lay.addWidget(self.table)

    def calc_crypto(self, rows):
        res=[]
        for row in rows:
            while len(row)<7: row.append("")
            try:
                qty=parse_amount(row[2]); buy=parse_amount(row[3]); sell=parse_amount(row[4])
                tot=(sell-buy)*qty
                if tot>=0: row[5]=f"{tot:.2f}"; row[6]=""
                else: row[5]=""; row[6]=f"{abs(tot):.2f}"
            except: pass
            res.append(row)
        return res

# ---------------- Agenda ----------------
class AgendaView(QWidget):
    def __init__(self, user: str):
        super().__init__(); self.user=user
        lay=QVBoxLayout(self)
        t=QLabel("🗓️ Agenda"); t.setFont(QFont("Arial",12,QFont.Bold)); lay.addWidget(t)
        headers=["Datum","Taak","Status","Afspraak"]
        self.table=EditableTable(user,"agenda",headers,None); lay.addWidget(self.table)

# ---------------- Charts ----------------
class ChartCanvas(FigureCanvas):
    def __init__(self):
        self.fig=Figure(figsize=(5,3), tight_layout=True); super().__init__(self.fig)
        self.ax=self.fig.add_subplot(111)
    def apply_theme(self, theme: Dict[str,str]):
        self.fig.set_facecolor(theme["bg"]); self.ax.set_facecolor(theme["sheet"])
        for s in self.ax.spines.values(): s.set_color(theme["border"])
        self.ax.grid(True, color=theme["grid"], linestyle="-", alpha=0.6)
        self.ax.tick_params(colors=theme["text"]); self.ax.yaxis.label.set_color(theme["text"])
        self.ax.xaxis.label.set_color(theme["text"]); self.ax.title.set_color(theme["text"])
    def clear_axes(self): self.fig.clf(); self.ax=self.fig.add_subplot(111)

class DashboardView(QWidget):
    def __init__(self, user: str):
        super().__init__(); self.user=user; self.theme=dict(DEFAULT_THEME)
        lay=QVBoxLayout(self)
        row=QHBoxLayout(); title=QLabel("📊 Overzicht"); title.setFont(QFont("Arial",14,QFont.Bold))
        row.addWidget(title); self.chart_select=QComboBox()
        self.chart_select.addItems(["Balk (totaal)","Cirkel (uitgaven per categorie)","Lijn (saldo over tijd)"])
        self.chart_select.currentIndexChanged.connect(self.refresh); row.addStretch()
        row.addWidget(QLabel("Grafiek:")); row.addWidget(self.chart_select); lay.addLayout(row)
        self.label=QLabel(""); self.label.setAlignment(Qt.AlignCenter); self.label.setFont(QFont("Arial",12)); lay.addWidget(self.label)
        self.canvas=ChartCanvas(); lay.addWidget(self.canvas); lay.addStretch(); self.setLayout(lay); self.refresh()

    def _totals(self)->Tuple[float,float,float,float]:
        d=load_data(self.user); inc=exp=inv=cr=0.0
        for r in d.get("budget",[]): inc+=parse_amount(r[3] if len(r)>3 else ""); exp+=parse_amount(r[4] if len(r)>4 else "")
        for r in d.get("investments",[]):
            if len(r)>6 and r[6]: inv+=parse_amount(r[6])
            if len(r)>7 and r[7]: inv-=parse_amount(r[7])
        for r in d.get("crypto",[]):
            if len(r)>5 and r[5]: cr+=parse_amount(r[5])
            if len(r)>6 and r[6]: cr-=parse_amount(r[6])
        return inc,exp,inv,cr

    def _expenses_by_category(self)->Dict[str,float]:
        d=load_data(self.user); out={}
        for r in d.get("budget",[]):
            if len(r)<5: continue
            cat=(r[1] or "Onbekend").strip() or "Onbekend"; val=max(0.0, parse_amount(r[4]))
            if val>0: out[cat]=out.get(cat,0.0)+val
        return out

    def _saldo_over_time(self)->Tuple[List[str],List[float]]:
        d=load_data(self.user)
        rows=[r for r in d.get("budget",[]) if any((r+["","",""])[:5])]
        rows.sort(key=lambda r: parse_date(r[0] if len(r)>0 else "") or datetime.date.min)
        labels=[]; values=[]; run=0.0
        for r in rows:
            inc=parse_amount(r[3] if len(r)>3 else ""); ex=parse_amount(r[4] if len(r)>4 else "")
            run+=inc-ex; dt=parse_date(r[0] if len(r)>0 else "")
            labels.append(dt.strftime("%d-%m") if dt else str(len(labels)+1)); values.append(run)
        return labels, values

    def update_theme(self, theme: Dict[str,str]): self.theme=theme; self.refresh()

    def refresh(self):
        inc,exp,inv,cr=self._totals(); saldo=inc-exp
        self.label.setText(f"Inkomen: {inc:.2f} | Uitgave: {exp:.2f} | Saldo: {saldo:.2f} | Winst beleggingen: {inv:.2f} | Crypto: {cr:.2f}")
        self.canvas.clear_axes(); self.canvas.apply_theme(self.theme); ax=self.canvas.ax
        idx=self.chart_select.currentIndex()
        if idx==0:
            ax.bar(["Inkomen","Uitgave","Saldo"], [inc,exp,saldo], edgecolor=self.theme["border"]); ax.set_title("Totaaloverzicht"); ax.set_ylabel("Bedrag")
        elif idx==1:
            by=self._expenses_by_category()
            if by: ax.pie(list(by.values()), labels=list(by.keys()), autopct="%1.0f%%", pctdistance=0.8); ax.set_title("Uitgaven per categorie")
            else: ax.text(0.5,0.5,"Geen uitgaven-data", ha="center", va="center", color=self.theme["text"])
        else:
            x,y=self._saldo_over_time(); ax.plot(x,y,marker="o"); ax.set_title("Saldo over tijd"); ax.set_ylabel("Saldo"); ax.set_xlabel("Datum/volgorde"); ax.tick_params(axis="x", rotation=45)
        self.canvas.draw_idle()

# ---------------- Settings ----------------
class SettingsView(QWidget):
    def __init__(self, main):
        super().__init__(); self.main=main
        lay=QVBoxLayout(self)
        title=QLabel("⚙️ Instellingen & Thema"); title.setFont(QFont("Arial",14,QFont.Bold)); title.setAlignment(Qt.AlignCenter); lay.addWidget(title)
        for label,key in [("Achtergrondkleur","bg"),("Tabelkleur","sheet"),("Randkleur / raster","border"),("Knopkleur","button"),("Tekstkleur","text")]:
            b=QPushButton(label); b.clicked.connect(lambda _,k=key: self.pick_color(k)); lay.addWidget(b)

        lay.addWidget(QLabel("Pastelkleuren (klik = kies onderdeel):"))
        row=QHBoxLayout()
        for col in PASTEL_COLORS:
            b=QPushButton(); b.setFixedSize(22,22); b.setStyleSheet(f"background:{col}; border:1px solid #555;")
            b.clicked.connect(lambda _, c=col: self.pastel_menu(c)); row.addWidget(b)
        lay.addLayout(row)

        lay.addWidget(QLabel("Intensiteit (lichter/donkerder):")); self.intensity=QSlider(Qt.Horizontal)
        self.intensity.setRange(50,150); self.intensity.setValue(self.main.intensity_factor)
        self.intensity.valueChanged.connect(self.change_intensity); lay.addWidget(self.intensity)

        lay.addWidget(QLabel("Raster-donkerte:")); self.grid=QSlider(Qt.Horizontal)
        self.grid.setRange(50,150); self.grid.setValue(self.main.grid_factor)
        self.grid.valueChanged.connect(self.change_grid); lay.addWidget(self.grid)

        btn_save = QPushButton("💾 Thema opslaan"); btn_save.clicked.connect(self.main.save_theme_prefs); lay.addWidget(btn_save)
        btn_restore = QPushButton("↩️ Thema herstellen"); btn_restore.clicked.connect(self.restore_theme); lay.addWidget(btn_restore)

        btn_export=QPushButton("📤 Export / Backup naar map"); btn_export.clicked.connect(self.export_data); lay.addWidget(btn_export)
        btn_reset=QPushButton("Reset standaard thema"); btn_reset.clicked.connect(self.reset_theme); lay.addWidget(btn_reset)

        lay.addStretch(); self.setLayout(lay)

    def pastel_menu(self, color_hex: str):
        m=QMenu(self)
        acts=[("Achtergrond","bg"),("Tabel (sheet)","sheet"),("Rand / tabs / header","border"),("Knoppen","button"),("Rasterlijnen","grid"),("Tekst","text")]
        actions={m.addAction(a):k for a,k in acts}; m.addSeparator(); all_act=m.addAction("Alles tegelijk (snelle stijl)")
        ch=m.exec_(QCursor.pos()); 
        if not ch: return
        if ch==all_act:
            self.main.base_theme.update({"bg":color_hex,"sheet":"#FFFFFF","border":color_hex,"button":color_hex,"grid":color_hex,"text":"#000000"})
        else:
            self.main.base_theme[actions[ch]]=color_hex
        self.main.apply_theme(); self.main.save_theme_prefs()

    def pick_color(self, key: str):
        col=QColorDialog.getColor()
        if col.isValid(): self.main.base_theme[key]=col.name(); self.main.apply_theme(); self.main.save_theme_prefs()

    def change_intensity(self, v:int): self.main.intensity_factor=v; self.main.apply_theme(); self.main.save_theme_prefs()
    def change_grid(self, v:int): self.main.grid_factor=v; self.main.apply_theme(); self.main.save_theme_prefs()
    def reset_theme(self): self.main.base_theme=dict(DEFAULT_THEME); self.main.intensity_factor=100; self.main.grid_factor=100; self.main.apply_theme(); self.main.save_theme_prefs()
    def restore_theme(self):
        prefs=load_theme_prefs(self.main.user)
        self.main.base_theme=prefs["base"]; self.main.intensity_factor=prefs["intensity"]; self.main.grid_factor=prefs["grid"]
        self.intensity.setValue(self.main.intensity_factor); self.grid.setValue(self.main.grid_factor); self.main.apply_theme()

    def export_data(self):
        folder=QFileDialog.getExistingDirectory(self,"Kies map voor backup")
        if folder:
            d=load_data(self.main.user); export_to_csv(self.main.user,d,folder); QMessageBox.information(self,"Export","Data geëxporteerd.")

# ---------------- Euro-photo helpers ----------------
def _euro_folders() -> List[str]:
    return [
        os.path.expanduser("~/Desktop/euro's"),
        os.path.expanduser("~/Desktop/euros"),
        os.path.join(BASE, "euros"),
        os.path.join(BASE, "euro's"),
    ]

def _collect_euro_images() -> List[str]:
    folder = next((p for p in _euro_folders() if os.path.isdir(p)), "")
    if not folder: return []
    files=[]
    for ext in ("*.png","*.jpg","*.jpeg"):
        files += glob.glob(os.path.join(folder, ext))
    # sorteer op waarde (5..500) zodat elk type aanwezig is
    def coup(f):
        m=re.search(r"(\d+)", os.path.basename(f))
        return int(m.group(1)) if m else 9999
    return sorted(files, key=coup)

def _scale_only(pm: QPixmap, target_h: int) -> QPixmap:
    return pm.scaledToHeight(target_h, Qt.SmoothTransformation)

# ---------------- Login (logo linksboven, geshuffelde tegels, geen bandje) ----------------
class LoginView(QWidget):
    def __init__(self, parent):
        super().__init__(); self.parent=parent; self.bg="#EAF4FF"
        self.logo_pt = 80
        self._files = _collect_euro_images()
        self._pixmaps: List[QPixmap] = []

        lay=QVBoxLayout(self); lay.setContentsMargins(30,30,30,30); lay.setSpacing(10)

        # Topbar met logo linksboven (bewaren om overlap te vermijden)
        top = QHBoxLayout()
        self.logo_lbl = QLabel(); self.logo_lbl.setAlignment(Qt.AlignLeft|Qt.AlignTop)
        target_h = self._target_px()
        logo_file = next((f for f in self._files if re.search(r"\b100\b", os.path.basename(f))), (self._files[0] if self._files else ""))
        if logo_file:
            logo_pm = _scale_only(QPixmap(logo_file), target_h)
            self.logo_lbl.setPixmap(logo_pm)
        else:
            self.logo_lbl.setText("💶"); self.logo_lbl.setFont(QFont("Arial", self.logo_pt, QFont.Bold))
        top.addWidget(self.logo_lbl); top.addStretch(); lay.addLayout(top)

        title=QLabel("Financiële Tracker KGB 2025"); title.setFont(QFont("Arial",20,QFont.Bold)); title.setAlignment(Qt.AlignCenter); lay.addWidget(title)
        self.name_edit=QLineEdit(); self.name_edit.setPlaceholderText("Naam"); lay.addWidget(self.name_edit)
        self.pin_edit=QLineEdit(); self.pin_edit.setPlaceholderText("Pincode"); self.pin_edit.setEchoMode(QLineEdit.Password); lay.addWidget(self.pin_edit)
        btn_login=QPushButton("Inloggen"); btn_login.clicked.connect(self.do_login); lay.addWidget(btn_login)
        btn_color=QPushButton("🎨 Login achtergrondkleur"); btn_color.clicked.connect(self.change_bg); lay.addWidget(btn_color)
        tip=QLabel("Achtergrond: jouw euro-foto’s (5–500), geshuffeld, volledig zichtbaar"); tip.setAlignment(Qt.AlignCenter); tip.setFont(QFont("Arial",10)); lay.addWidget(tip)
        lay.addStretch(); self.setLayout(lay)

    def _target_px(self)->int:
        fm = QFontMetrics(QFont("Arial", self.logo_pt, QFont.Bold))
        return max(56, fm.height())

    def _ensure_pixmaps(self, target_h: int):
        if self._pixmaps: return
        for f in self._files:
            pm = QPixmap(f)
            if not pm.isNull(): self._pixmaps.append(_scale_only(pm, target_h))

    def paintEvent(self, _):
        p=QPainter(self)
        p.fillRect(self.rect(), QColor(self.bg))
        p.setRenderHint(QPainter.Antialiasing)

        target = self._target_px()
        self._ensure_pixmaps(target)
        pix = self._pixmaps
        if not pix: p.end(); return

        # rastermaat gebaseerd op grootste breedte (voorkomt overlap)
        max_w = max(pm.width() for pm in pix)
        h = pix[0].height()
        step_x = int(max_w * 1.25)
        step_y = int(h * 1.25)

        cols = (self.width() + step_x - 1) // step_x + 1
        rows = (self.height() + step_y - 1) // step_y + 1
        total = cols * rows

        # maak sequence waar elke waarde zeker in zit, dan shuffle
        seq = []
        while len(seq) < total: seq += list(range(len(pix)))
        seq = seq[:total]
        random.shuffle(seq)

        # uitsparing onder logo
        logo_top_left = self.logo_lbl.mapTo(self, QPoint(0,0))
        logo_rect = QRect(logo_top_left, self.logo_lbl.size())

        idx = 0
        p.setOpacity(1.0)
        for ry in range(rows):
            for cx in range(cols):
                x = cx * step_x
                y = ry * step_y
                tile_rect = QRect(x, y, max_w, h)
                if tile_rect.intersects(logo_rect):
                    idx += 1
                    continue
                pm = pix[ seq[idx % len(seq)] ]
                p.drawPixmap(x, y, pm)
                idx += 1
        p.end()

    def change_bg(self):
        col=QColorDialog.getColor()
        if col.isValid(): self.bg=col.name(); self.update()

    def do_login(self):
        name=self.name_edit.text().strip(); pin=self.pin_edit.text().strip()
        if not name or not pin:
            QMessageBox.warning(self,"Fout","Naam en pincode zijn verplicht."); return
        conn=sqlite3.connect(DB_PATH); c=conn.cursor()
        h=hashlib.sha256(pin.encode()).hexdigest(); row=c.execute("SELECT pin FROM users WHERE name=?", (name,)).fetchone()
        if row:
            if row[0]!=h: QMessageBox.warning(self,"Fout","Verkeerde pincode."); conn.close(); return
        else:
            c.execute("INSERT INTO users (name, pin) VALUES (?, ?)", (name, h))
        conn.commit(); conn.close(); self.parent.open_main(name)

# ---------------- Family ----------------
class FamilyView(QWidget):
    def __init__(self, user: str):
        super().__init__(); lay=QVBoxLayout(self)
        t=QLabel("👨‍👩‍👧 Familie (basis)"); t.setFont(QFont("Arial",12,QFont.Bold)); lay.addWidget(t)
        info=QLabel("Tip: Exporteer naar gedeelde map om data te delen."); info.setAlignment(Qt.AlignCenter); lay.addWidget(info)
        lay.addStretch(); self.setLayout(lay)

# ---------------- Main view ----------------
class MainView(QWidget):
    def __init__(self, user: str):
        super().__init__(); self.user=user
        prefs=load_theme_prefs(user); self.base_theme=prefs["base"]; self.theme=dict(self.base_theme)
        self.intensity_factor=prefs["intensity"]; self.grid_factor=prefs["grid"]

        lay=QVBoxLayout(self)
        title=QLabel(f"Welkom {user} — KGB Finance 2025"); title.setFont(QFont("Arial",16,QFont.Bold)); title.setAlignment(Qt.AlignCenter); lay.addWidget(title)

        self.tabs=QTabWidget()
        self.dashboard=DashboardView(user); self.budget=BudgetView(user); self.investments=InvestmentsView(user)
        self.crypto=CryptoView(user); self.agenda=AgendaView(user); self.family=FamilyView(user); self.settings=SettingsView(self)
        self.tabs.addTab(self.dashboard,"📊 Overzicht"); self.tabs.addTab(self.budget,"📋 Budget")
        self.tabs.addTab(self.investments,"💼 Beleggingen"); self.tabs.addTab(self.crypto,"🪙 Crypto")
        self.tabs.addTab(self.agenda,"🗓️ Agenda"); self.tabs.addTab(self.family,"👨‍👩‍👧 Familie"); self.tabs.addTab(self.settings,"⚙️ Instellingen")
        lay.addWidget(self.tabs); self.setLayout(lay)

        self.budget.table.itemChanged.connect(lambda _: self.dashboard.refresh())
        self.investments.table.itemChanged.connect(lambda _: self.dashboard.refresh())
        self.crypto.table.itemChanged.connect(lambda _: self.dashboard.refresh())

        self.apply_theme()

    def computed_theme(self)->Dict[str,str]:
        t={}
        for k,v in self.base_theme.items():
            t[k]=adjust_to_black_white(v,self.grid_factor) if k=="grid" else adjust_intensity(v,self.intensity_factor)
        return t

    def apply_theme(self)->None:
        self.theme=self.computed_theme()
        bg=self.theme["bg"]; sheet=self.theme["sheet"]; border=self.theme["border"]; button=self.theme["button"]; text=self.theme["text"]; grid=self.theme["grid"]
        button_hover=adjust_intensity(button,90); header_bg=adjust_intensity(border,80); sel_bg=adjust_intensity(border,80); alt_bg=adjust_intensity(sheet,95); lineedit_bg=sheet
        qss=f"""
        QWidget {{ background-color:{bg}; color:{text}; font-size:13px; }}
        QTabWidget::pane {{ border:1px solid {border}; border-radius:12px; background:{bg}; }}
        QTabBar::tab {{ background:{sheet}; border:1px solid {border}; padding:6px 10px; border-top-left-radius:10px; border-top-right-radius:10px; margin-right:2px; }}
        QTabBar::tab:selected {{ background:{bg}; }}
        QPushButton {{ background-color:{button}; border:1px solid {border}; padding:8px 12px; border-radius:12px; }}
        QPushButton:hover {{ background-color:{button_hover}; }}
        QTableWidget {{ background:{sheet}; alternate-background-color:{alt_bg}; gridline-color:{grid}; selection-background-color:{sel_bg}; selection-color:{text}; border:1px solid {border}; border-radius:10px; }}
        QHeaderView::section {{ background-color:{header_bg}; color:{text}; border:1px solid {border}; padding:4px 6px; }}
        QLineEdit, QTextEdit, QComboBox {{ background-color:{lineedit_bg}; border:1px solid {border}; border-radius:8px; padding:4px 6px; selection-background-color:{sel_bg}; selection-color:{text}; }}
        QMenu {{ background-color:{sheet}; border:1px solid {border}; }}
        QMenu::item:selected {{ background:{sel_bg}; }}
        QSlider::groove:horizontal {{ background:{sheet}; height:6px; border:1px solid {border}; border-radius:3px; }}
        QSlider::handle:horizontal {{ background:{button}; width:16px; margin:-6px 0; border:1px solid {border}; border-radius:8px; }}
        """
        QApplication.instance().setStyleSheet(qss)
        self.dashboard.update_theme(self.theme)

    def save_theme_prefs(self)->None:
        save_theme_prefs(self.user, self.base_theme, self.intensity_factor, self.grid_factor)

# ---------------- MainWindow ----------------
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__(); init_db()
        self.setWindowTitle("💰 KGB Finance 2025 — Login"); self.resize(1200,780)
        self.login_view=LoginView(self); self.setCentralWidget(self.login_view)
    def open_main(self, user: str):
        self.main_view=MainView(user); self.setCentralWidget(self.main_view)
        self.setWindowTitle(f"💰 KGB Finance 2025 — {user}")

# ---------------- Entry ----------------
def main():
    app=QApplication(sys.argv); w=MainWindow(); w.show(); sys.exit(app.exec_())
if __name__=="__main__": main()
