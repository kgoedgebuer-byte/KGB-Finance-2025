/* KGB Finance — Investments hard-fix (single source of truth)
   Rules:
   netto = (verkoop - aankoop) * aantal + dividend
   winst = max(netto, 0)
   verlies = max(-netto, 0)
*/
(function(){
  function toNum(v){
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const s = String(v).trim()
      .replace(/\s/g,"")
      .replace(/\./g,"")
      .replace(",",".");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function euro(n){
    const x = isFinite(n) ? n : 0;
    return x.toLocaleString("nl-BE",{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function getYear(){
    const m = (location.pathname||"").match(/(20\d{2})/);
    return m ? m[1] : "2025";
  }
  function storageKey(){
    return `kgb_finance_${getYear()}_beleggingen_fix`;
  }

  function findInvestmentsTable(){
    const tables = Array.from(document.querySelectorAll("table"));
    for (const t of tables){
      const ths = Array.from(t.querySelectorAll("thead th")).map(x => (x.textContent||"").trim().toLowerCase());
      const need = ["aandeel","aantal","aankoop","verkoop","dividend","winst","verlies"];
      const ok = need.every(k => ths.some(h => h.includes(k)));
      if (ok) return t;
    }
    return null;
  }

  function mapHeaderIdx(table){
    const ths = Array.from(table.querySelectorAll("thead th")).map(x => (x.textContent||"").trim().toLowerCase());
    const idx = {};
    function pick(key){
      const i = ths.findIndex(h => h.includes(key));
      return i >= 0 ? i : null;
    }
    idx.datum   = pick("datum");
    idx.aandeel = pick("aandeel");
    idx.aantal  = pick("aantal");
    idx.aankoop = pick("aankoop");
    idx.verkoop = pick("verkoop");
    idx.dividend= pick("dividend");
    idx.winst   = pick("winst");
    idx.verlies = pick("verlies");
    return idx;
  }

  function getCellInput(cell){
    if (!cell) return null;
    return cell.querySelector("input, select, textarea");
  }
  function readCellValue(cell){
    const inp = getCellInput(cell);
    if (inp) return inp.value;
    return (cell.textContent||"").trim();
  }
  function writeCellValue(cell, value){
    if (!cell) return;
    const inp = getCellInput(cell);
    if (inp){
      // als het een input is, schrijf erin
      inp.value = value;
    } else {
      cell.textContent = value;
    }
  }

  function calcRow(qty,buy,sell,div){
    const net = (sell - buy) * qty + div;
    return {
      net,
      winst: net >= 0 ? net : 0,
      verlies: net < 0 ? -net : 0
    };
  }

  function extractRows(table, idx){
    const body = table.querySelector("tbody") || table;
    const trs = Array.from(body.querySelectorAll("tr"));
    return trs.map(tr => {
      const tds = Array.from(tr.children);
      const row = {
        datum: idx.datum!=null ? readCellValue(tds[idx.datum]) : "",
        aandeel: idx.aandeel!=null ? readCellValue(tds[idx.aandeel]) : "",
        aantal: idx.aantal!=null ? readCellValue(tds[idx.aantal]) : "",
        aankoop: idx.aankoop!=null ? readCellValue(tds[idx.aankoop]) : "",
        verkoop: idx.verkoop!=null ? readCellValue(tds[idx.verkoop]) : "",
        dividend: idx.dividend!=null ? readCellValue(tds[idx.dividend]) : ""
      };
      return row;
    });
  }

  function restoreRows(table, idx){
    const raw = localStorage.getItem(storageKey());
    if (!raw) return;
    let saved;
    try { saved = JSON.parse(raw); } catch(e){ return; }
    if (!Array.isArray(saved)) return;

    const body = table.querySelector("tbody") || table;
    const trs = Array.from(body.querySelectorAll("tr"));
    for (let i=0;i<Math.min(trs.length, saved.length);i++){
      const tr = trs[i];
      const tds = Array.from(tr.children);
      const s = saved[i] || {};
      if (idx.datum!=null)   writeCellValue(tds[idx.datum], s.datum ?? "");
      if (idx.aandeel!=null) writeCellValue(tds[idx.aandeel], s.aandeel ?? "");
      if (idx.aantal!=null)  writeCellValue(tds[idx.aantal], s.aantal ?? "");
      if (idx.aankoop!=null) writeCellValue(tds[idx.aankoop], s.aankoop ?? "");
      if (idx.verkoop!=null) writeCellValue(tds[idx.verkoop], s.verkoop ?? "");
      if (idx.dividend!=null)writeCellValue(tds[idx.dividend], s.dividend ?? "");
    }
  }

  function updateDashboardInvestNet(totalNet){
    // probeer het kaartje te vinden met label "Beleggingen (netto)"
    const all = Array.from(document.querySelectorAll("*"));
    const labelEl = all.find(el => (el.textContent||"").trim().includes("Beleggingen (netto)"));
    if (!labelEl) return;

    // Zoek in dezelfde "card" naar een grote waarde
    const card = labelEl.closest("div") || labelEl.parentElement;
    if (!card) return;

    // 1) eerst: element met cijfer-achtige text (niet de label zelf)
    const candidates = Array.from(card.querySelectorAll("*"))
      .filter(el => el !== labelEl)
      .filter(el => (el.textContent||"").match(/-?\d[\d\.\,\s]*\d/));

    // kies de eerste die er uitziet als "waarde"
    const valueEl = candidates[0] || null;
    if (valueEl) valueEl.textContent = euro(totalNet);
  }

  function recalcAll(){
    const table = findInvestmentsTable();
    if (!table) return;
    const idx = mapHeaderIdx(table);

    const body = table.querySelector("tbody") || table;
    const trs = Array.from(body.querySelectorAll("tr"));
    let totalNet = 0;

    trs.forEach(tr => {
      const tds = Array.from(tr.children);
      const qty = idx.aantal!=null ? toNum(readCellValue(tds[idx.aantal])) : 0;
      const buy = idx.aankoop!=null ? toNum(readCellValue(tds[idx.aankoop])) : 0;
      const sell= idx.verkoop!=null ? toNum(readCellValue(tds[idx.verkoop])) : 0;
      const div = idx.dividend!=null? toNum(readCellValue(tds[idx.dividend])): 0;

      const r = calcRow(qty,buy,sell,div);
      totalNet += r.net;

      if (idx.winst!=null)   writeCellValue(tds[idx.winst], euro(r.winst));
      if (idx.verlies!=null) writeCellValue(tds[idx.verlies], euro(r.verlies));
    });

    // save rows
    const rows = extractRows(table, idx);
    localStorage.setItem(storageKey(), JSON.stringify(rows));

    // update dashboard
    updateDashboardInvestNet(totalNet);
  }

  function hook(){
    const table = findInvestmentsTable();
    if (!table) return;

    const idx = mapHeaderIdx(table);
    restoreRows(table, idx);

    // luister naar ALLE input changes binnen die tabel
    table.addEventListener("input", (e) => {
      const el = e.target;
      if (!el) return;
      // alleen reageren op de relevante velden
      recalcAll();
    }, {passive:true});

    // ook bij klik op “Toevoegen” of delete knoppen: herberekenen na microtask
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!t) return;
      const txt = (t.textContent||"").toLowerCase();
      if (txt.includes("toevoegen") || t.closest("button")){
        setTimeout(recalcAll, 0);
      }
    }, true);

    // init
    recalcAll();
    // na 1s nog eens (voor als app later render’d)
    setTimeout(recalcAll, 1000);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", hook);
  } else {
    hook();
  }
})();
