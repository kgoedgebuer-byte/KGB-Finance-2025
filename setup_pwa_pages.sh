#!/bin/bash
set -euo pipefail

REPO_DIR="$HOME/Desktop/KGB-Finance-2025"
DOCS_DIR="$REPO_DIR/docs"
mkdir -p "$DOCS_DIR/icons"

# index.html
cat > "$DOCS_DIR/index.html" <<'HTML'
<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>KGB Finance 2025 — Web</title>
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#2563eb">
  <link rel="icon" href="icons/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="styles.css" />
  <script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script defer src="app.js"></script>
</head>
<body>
<header>
  <h1>KGB Finance 2025 — Web</h1>
  <nav>
    <button data-tab="dashboard" class="tab active">Dashboard</button>
    <button data-tab="budget" class="tab">Budget</button>
    <button data-tab="io" class="tab">Export / Import</button>
  </nav>
</header>

<main>
  <section id="dashboard" class="panel active">
    <div class="cards">
      <div class="card"><div class="k">Inkomen</div><div class="v" id="totIncome">0.00</div></div>
      <div class="card"><div class="k">Uitgave</div><div class="v" id="totExpense">0.00</div></div>
      <div class="card saldo"><div class="k">Saldo</div><div class="v" id="totSaldo">0.00</div></div>
    </div>
    <canvas id="saldoChart" height="140"></canvas>
  </section>

  <section id="budget" class="panel">
    <form id="addForm">
      <input id="date" type="date" required />
      <input id="cat" type="text" placeholder="Categorie" required />
      <input id="desc" type="text" placeholder="Omschrijving" />
      <input id="inc" type="number" step="0.01" placeholder="Inkomen">
      <input id="exp" type="number" step="0.01" placeholder="Uitgave">
      <button type="submit">Toevoegen</button>
    </form>
    <div class="tableWrap">
      <table id="tbl">
        <thead>
          <tr><th>Datum</th><th>Categorie</th><th>Omschrijving</th><th>Inkomen</th><th>Uitgave</th><th>Saldo (loopt)</th><th>Acties</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section id="io" class="panel">
    <div class="io-actions">
      <button id="btnExport">Export JSON</button>
      <label class="fileLabel">Import JSON <input id="fileImport" type="file" accept="application/json"></label>
      <button id="btnReset" class="danger">Reset (alle data)</button>
    </div>
    <p class="muted">Data staat lokaal in je browser (localStorage). Delen? Export JSON.</p>
  </section>
</main>

<footer><small>PWA — werkt offline na 1x laden.</small></footer>

<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
</script>
</body>
</html>
HTML

# styles.css
cat > "$DOCS_DIR/styles.css" <<'CSS'
:root{
  --bg:#f6faff; --card:#ffffff; --txt:#0f172a; --muted:#64748b;
  --acc:#2563eb; --ok:#16a34a; --grid:#e2e8f0; --shadow:0 6px 20px rgba(2,6,23,.08);
}
*{box-sizing:border-box} html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial}
header{padding:16px 20px}
h1{margin:0 0 10px;font-size:22px}
nav{display:flex;gap:8px;flex-wrap:wrap}
.tab{border:1px solid var(--acc);background:#eff6ff;color:#0b3aa3;border-radius:999px;padding:8px 14px;cursor:pointer}
.tab.active{background:var(--acc);color:#fff}
main{padding:6px 20px 20px}.panel{display:none}.panel.active{display:block}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:16px}
.card{background:var(--card);border:1px solid var(--grid);border-radius:16px;padding:14px;box-shadow:var(--shadow)}
.card .k{font-size:13px;color:var(--muted)} .card .v{margin-top:6px;font-size:24px;font-weight:700}
.card.saldo .v{color:var(--ok)}
.tableWrap{overflow:auto;border:1px solid var(--grid);border-radius:14px;background:var(--card);box-shadow:var(--shadow)}
table{width:100%;border-collapse:collapse;font-size:14px} th,td{padding:10px 8px;border-bottom:1px solid var(--grid);text-align:left;white-space:nowrap}
thead th{position:sticky;top:0;background:#eef2ff;border-bottom:1px solid #c7d2fe}
form#addForm{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:8px;margin:10px 0}
input,button{padding:10px 12px;border:1px solid var(--grid);border-radius:12px;background:#fff} button{cursor:pointer}
button.danger{border-color:#fecaca;background:#fee2e2;color:#b91c1c}
.fileLabel{display:inline-flex;align-items:center;gap:6px;padding:10px 12px;border:1px dashed var(--grid);border-radius:12px;background:#fff;cursor:pointer}
.fileLabel input{display:none}
footer{padding:16px 20px;color:var(--muted)} .muted{color:var(--muted)}
.actions{display:flex;gap:6px} .actions button{padding:6px 10px}
@media (max-width:900px){ form#addForm{grid-template-columns:1fr 1fr} }
CSS

# app.js
cat > "$DOCS_DIR/app.js" <<'JS'
const KEY = "kgb_finance_budget_v1";
const $ = (s, c=document)=>c.querySelector(s);
const $$ = (s, c=document)=>Array.from(c.querySelectorAll(s));
let rows = load();

function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||"[]"); }catch(_){ return []; } }
function save(){ localStorage.setItem(KEY, JSON.stringify(rows)); recalc(); }
function fmt(n){ return (n??0).toFixed(2); }
function parse(n){ return isNaN(+n) ? 0 : +n; }

function recalc(){
  let income=0, expense=0, running=0;
  rows.forEach(r=>{ income+=parse(r.income); expense+=parse(r.expense); });
  $("#totIncome").textContent=fmt(income);
  $("#totExpense").textContent=fmt(expense);
  $("#totSaldo").textContent=fmt(income-expense);

  const tbody=$("#tbl tbody"); tbody.innerHTML="";
  running=0;
  rows.forEach((r,i)=>{
    running+=parse(r.income)-parse(r.expense);
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td><input type="date" value="${r.date||""}" data-i="${i}" data-k="date"></td>
      <td><input type="text"  value="${r.cat||""}"  data-i="${i}" data-k="cat"></td>
      <td><input type="text"  value="${r.desc||""}" data-i="${i}" data-k="desc"></td>
      <td><input type="number" step="0.01" value="${r.income||""}" data-i="${i}" data-k="income"></td>
      <td><input type="number" step="0.01" value="${r.expense||""}" data-i="${i}" data-k="expense"></td>
      <td>${fmt(running)}</td>
      <td class="actions">
        <button data-act="up" data-i="${i}">Up</button>
        <button data-act="down" data-i="${i}">Down</button>
        <button data-act="del" data-i="${i}">Del</button>
      </td>`;
    tbody.appendChild(tr);
  });

  const labels=[], data=[]; running=0;
  rows.forEach(r=>{ running+=parse(r.income)-parse(r.expense); labels.push(r.date||""); data.push(running); });
  drawChart(labels,data);
}

let chart;
function drawChart(labels,data){
  const ctx=$("#saldoChart").getContext("2d");
  if(chart) chart.destroy();
  chart=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Saldo',data,tension:.25}]} ,options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
}

$("#addForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  rows.push({
    date: $("#date").value,
    cat:  $("#cat").value.trim(),
    desc: $("#desc").value.trim(),
    income: parse($("#inc").value),
    expense: parse($("#exp").value),
  });
  $("#addForm").reset(); save();
});

$("#tbl").addEventListener("input",(e)=>{
  const i=+e.target.dataset.i, k=e.target.dataset.k;
  if(Number.isInteger(i)&&k){
    rows[i][k]=(k==='income'||k==='expense')?parse(e.target.value):e.target.value;
    save();
  }
});
$("#tbl").addEventListener("click",(e)=>{
  const b=e.target.closest("button"); if(!b) return;
  const i=+b.dataset.i, a=b.dataset.act;
  if(a==="del"){ rows.splice(i,1); save(); }
  if(a==="up" && i>0){ [rows[i-1],rows[i]]=[rows[i],rows[i-1]]; save(); }
  if(a==="down" && i<rows.length-1){ [rows[i+1],rows[i]]=[rows[i],rows[i+1]]; save(); }
});

$$(".tab").forEach(b=>b.addEventListener("click",()=>{
  $$(".tab").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  $$(".panel").forEach(p=>p.classList.remove("active")); $("#"+b.dataset.tab).classList.add("active");
}));

recalc();
JS

# manifest
cat > "$DOCS_DIR/manifest.webmanifest" <<'JSON'
{
  "name": "KGB Finance 2025 — Web",
  "short_name": "KGB Finance",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#f6faff",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
JSON

# service-worker (fix: gebruik CACHE, geen typfout)
cat > "$DOCS_DIR/service-worker.js" <<'JS'
"use strict";
const CACHE = "kgb-finance-pwa-v1";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icons/icon.svg"];
self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
});
self.addEventListener("fetch", e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
JS

# simpel SVG icoon
cat > "$DOCS_DIR/icons/icon.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
    <stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#22c55e"/>
  </linearGradient></defs>
  <rect width="256" height="256" rx="48" fill="url(#g)"/>
  <g fill="#fff" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">
    <text x="128" y="116" font-size="84" font-weight="700">€</text>
    <text x="128" y="188" font-size="44" font-weight="700">KGB</text>
  </g>
</svg>
SVG

# git push
cd "$REPO_DIR"
git add docs
git commit -m "Add PWA web (docs) for GitHub Pages" >/dev/null 2>&1 || true
git push -u origin main
echo "OK: PWA toegevoegd en gepusht."
echo "Stap: GitHub -> Settings -> Pages -> Deploy from branch: main /docs"
