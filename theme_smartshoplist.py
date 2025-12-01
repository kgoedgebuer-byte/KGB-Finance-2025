# path: theme_smartshoplist.py
from __future__ import annotations
import json, tkinter as tk
from tkinter import ttk, colorchooser, messagebox
from pathlib import Path
from typing import Dict, Optional

SETTINGS_PATH = Path("settings.json")

PALETTES: Dict[str, Dict[str, str]] = {
    "Mint":    {"bg": "#E8FFF1", "fg": "#0A4D2A", "accent": "#3DDC97"},
    "Blauw":   {"bg": "#EAF4FF", "fg": "#0B3A6A", "accent": "#5AA9E6"},
    "Roze":    {"bg": "#FFF0F3", "fg": "#6A103A", "accent": "#FF89A3"},
    "Zand":    {"bg": "#FFF7E6", "fg": "#6A4B0B", "accent": "#E6C27A"},
    "Grijs":   {"bg": "#F2F4F7", "fg": "#222222", "accent": "#A0AEC0"},
    "Lila":    {"bg": "#F5E9FF", "fg": "#44285E", "accent": "#B084F5"},
    "Lavendel":{"bg": "#F0F2FF", "fg": "#1F2A60", "accent": "#8EA2F7"},
    "Koraal":  {"bg": "#FFF1EE", "fg": "#6A1B19", "accent": "#FF6F61"},
    "Oceaan":  {"bg": "#EAF8FB", "fg": "#0B3D46", "accent": "#21B6D7"},
    "Bos":     {"bg": "#EDF7EE", "fg": "#133A1A", "accent": "#58C472"},
    "Aarde":   {"bg": "#F7F2EA", "fg": "#4A3A2A", "accent": "#C49A6C"},
    "Steen":   {"bg": "#F4F5F7", "fg": "#1F2937", "accent": "#9CA3AF"},
    "Koper":   {"bg": "#FFF4EC", "fg": "#4F2C1D", "accent": "#CE7B48"},
    "Goud":    {"bg": "#FFF9E6", "fg": "#6B5200", "accent": "#F2C94C"},
    "Nacht":   {"bg": "#111827", "fg": "#E5E7EB", "accent": "#60A5FA"},
}

def _load() -> dict:
    try: return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except Exception: return {}
def _save(s: dict) -> None:
    SETTINGS_PATH.write_text(json.dumps(s, indent=2), encoding="utf-8")

class SmartShopListTheme:
    def __init__(self, root: tk.Tk, default: str = "Mint") -> None:
        self.root = root; self.style = ttk.Style(root)
        s=_load(); self.name=s.get("theme_name", default); 
self.custom=s.get("theme_accent")
        self.apply(self.name, self.custom)

    def apply(self, name: Optional[str]=None, accent: 
Optional[str]=None)->None:
        if name: self.name=name
        pal = PALETTES.get(self.name, PALETTES["Mint"]).copy()
        if accent: self.custom=accent
        if self.custom: pal["accent"]=self.custom
        bg, fg, acc = pal["bg"], pal["fg"], pal["accent"]
        self.root.configure(bg=bg)
        for sty in ("TFrame","TLabelframe","TLabel","TLabelframe.Label"):
            self.style.configure(sty, background=bg, foreground=fg)
        self.style.configure("Treeview", background="white", 
fieldbackground="white", foreground=fg)
        self.style.configure("Accent.TLabel", background=bg, 
foreground=acc)
        self.style.configure("TNotebook", background=bg)
        self.style.configure("TNotebook.Tab", background=bg, 
foreground=fg)

    def mount_toolbar(self, parent: tk.Misc)->ttk.Frame:
        bar=ttk.Frame(parent)
        
ttk.Label(bar,text="Thema",style="Accent.TLabel").pack(side="left",padx=(0,8))
        self.var=tk.StringVar(value=self.name)
        
cb=ttk.Combobox(bar,textvariable=self.var,values=list(PALETTES.keys()),state="readonly",width=14)
        cb.pack(side="left"); cb.bind("<<ComboboxSelected>>", lambda 
e:self.apply(self.var.get(), self.custom))
        
ttk.Button(bar,text="Kleurkiezer",command=self._pick).pack(side="left",padx=6)
        ttk.Button(bar,text="Opslaan",command=self.save).pack(side="left")
        
ttk.Button(bar,text="Reset",command=self.reset).pack(side="left",padx=(6,0))
        return bar

    def _pick(self)->None:
        c=colorchooser.askcolor(title="Accentkleur")[1]
        if c: self.apply(self.name, c)

    def reset(self)->None:
        self.custom=None; self.apply(self.name, None)

    def save(self)->None:
        s=_load(); s["theme_name"]=self.name; 
s["theme_accent"]=self.custom; _save(s)
        messagebox.showinfo("Thema","Opgeslagen.")

