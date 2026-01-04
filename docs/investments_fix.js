/* KGB Finance — Investments + Chart FIX v2
   - Supports split tables:
     T1: Datum/Aandeel/Aantal/Aankoop
     T2: Aankoop/Verkoop/Dividend/Winst/Verlies/Acties
   - Calculation (per row):
     net = (verkoop - aankoop) * aantal + dividend
     winst = max(net,0), verlies = max(-net,0)
   - Dashboard “Beleggingen (netto)” updated
   - Graph (Lijn/Balk/Cirkel) rebuilt using Chart.js and card values
*/
(function () {
  const SAFE = (fn) => { try { return fn(); } catch(e){ /* console.warn(e); */ } };

  function toNum(v){
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const s = String(v).trim().replace(/\s/g,"").replace(/\./g,"").replace(",",".");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function euro(n){
    const x = isFinite(n) ? n : 0;
    return x.toLocaleString("nl-BE",{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  function findTableByHeaders(need){
    const tables = Array.from(document.querySelectorAll("table"));
    for (const t of tables){
      const ths = Array.from(t.querySelectorAll("thead th")).map(x => (x.textContent||"").trim().toLowerCase());
      const ok = need.every(k => ths.some(h => h.includes(k)));
      if (ok) return t;
    }
    return null;
  }
  function headerIdx(table){
    const ths = Array.from(table.querySelectorAll("thead th")).map(x => (x.textContent||"").trim().toLowerCase());
    const pick = (k) => {
      const i = ths.findIndex(h => h.includes(k));
      return i >= 0 ? i : null;
    };
    return {
      datum: pick("datum"),
      aandeel: pick("aandeel"),
      aantal: pick("aantal"),
      aankoop: pick("aankoop"),
      verkoop: pick("verkoop"),
      dividend: pick("dividend"),
      winst: pick("winst"),
      verlies: pick("verlies"),
    };
  }
  function bodyRows(table){
    const body = table.querySelector("tbody") || table;
    return Array.from(body.querySelectorAll("tr"));
  }
  function cell(tr, idx){
    if (idx === null || idx === undefined) return null;
    const tds = Array.from(tr.children);
    return tds[idx] || null;
  }
  function inputOf(cell){
    return cell ? cell.querySelector("input, select, textarea") : null;
  }
  function readCell(cell){
    const inp = inputOf(cell);
    return inp ? inp.value : (cell ? (cell.textContent||"").trim() : "");
  }
  function writeCell(cell, value){
    const inp = inputOf(cell);
    if (inp) inp.value = value;
    else if (cell) cell.textContent = value;
  }

  function getYear(){
    const m = (location.pathname||"").match(/(20\d{2})/);
    return m ? m[1] : "2025";
  }
  function storageKey(){
    return `kgb_finance_${getYear()}_beleggingen_v2`;
  }

  // --- DASHBOARD helpers ---
  function setCardValue(labelContains, val){
    const all = Array.from(document.querySelectorAll("*"));
    const label = all.find(el => (el.textContent||"").trim().includes(labelContains));
    if (!label) return;
    const card = label.closest("div") || label.parentElement;
    if (!card) return;
    // pick first numeric-looking element different than label
    const candidates = Array.from(card.querySelectorAll("*"))
      .filter(el => el !== label)
      .filter(el => (el.textContent||"").match(/-?\d[\d\.\,\s]*\d/));
    const valueEl = candidates[0];
    if (valueEl) valueEl.textContent = euro(val);
  }

  function readCardValue(labelContains){
    const all = Array.from(document.querySelectorAll("*"));
    const label = all.find(el => (el.textContent||"").trim().includes(labelContains));
    if (!label) return 0;
    const card = label.closest("div") || label.parentElement;
    if (!card) return 0;
    const candidates = Array.from(card.querySelectorAll("*"))
      .filter(el => el !== label)
      .map(el => (el.textContent||"").trim())
      .filter(t => t.match(/-?\d/));
    return candidates.length ? toNum(candidates[0]) : 0;
  }

  // --- CALC ---
  function calc(netQty, buy, sell, div){
    const net = (sell - buy) * netQty + div;
    return { net, winst: net >= 0 ? net : 0, verlies: net < 0 ? -net : 0 };
  }

  // Find your two tables
  function getTables(){
    const tMain = findTableByHeaders(["datum","aandeel","aantal","aankoop"]);
    const tCalc = findTableByHeaders(["verkoop","dividend","winst","verlies"]);
    return { tMain, tCalc };
  }

  function loadSaved(tMain, tCalc){
    const raw = localStorage.getItem(storageKey());
    if (!raw) return;
    let saved; try { saved = JSON.parse(raw); } catch(e){ return; }
    if (!Array.isArray(saved)) return;

    const iMain = tMain ? headerIdx(tMain) : null;
    const iCalc = tCalc ? headerIdx(tCalc) : null;
    const rMain = tMain ? bodyRows(tMain) : [];
    const rCalc = tCalc ? bodyRows(tCalc) : [];

    for (let i=0;i<saved.length;i++){
      const s = saved[i] || {};
      if (rMain[i] && iMain){
        if (iMain.datum!=null)   writeCell(cell(rMain[i], iMain.datum), s.datum ?? "");
        if (iMain.aandeel!=null) writeCell(cell(rMain[i], iMain.aandeel), s.aandeel ?? "");
        if (iMain.aantal!=null)  writeCell(cell(rMain[i], iMain.aantal), s.aantal ?? "");
        if (iMain.aankoop!=null) writeCell(cell(rMain[i], iMain.aankoop), s.aankoop ?? "");
      }
      if (rCalc[i] && iCalc){
        if (iCalc.aankoop!=null) writeCell(cell(rCalc[i], iCalc.aankoop), s.aankoop ?? "");
        if (iCalc.verkoop!=null) writeCell(cell(rCalc[i], iCalc.verkoop), s.verkoop ?? "");
        if (iCalc.dividend!=null)writeCell(cell(rCalc[i], iCalc.dividend), s.dividend ?? "");
      }
    }
  }

  function saveState(tMain, tCalc){
    const iMain = tMain ? headerIdx(tMain) : null;
    const iCalc = tCalc ? headerIdx(tCalc) : null;
    const rMain = tMain ? bodyRows(tMain) : [];
    const rCalc = tCalc ? bodyRows(tCalc) : [];
    const n = Math.max(rMain.length, rCalc.length);
    const out = [];

    for (let i=0;i<n;i++){
      const o = {};
      if (rMain[i] && iMain){
        o.datum   = iMain.datum!=null ? readCell(cell(rMain[i], iMain.datum)) : "";
        o.aandeel = iMain.aandeel!=null ? readCell(cell(rMain[i], iMain.aandeel)) : "";
        o.aantal  = iMain.aantal!=null ? readCell(cell(rMain[i], iMain.aantal)) : "";
        o.aankoop = iMain.aankoop!=null ? readCell(cell(rMain[i], iMain.aankoop)) : "";
      }
      if (rCalc[i] && iCalc){
        // prefer aankoop from calc table if present
        const buy2 = iCalc.aankoop!=null ? readCell(cell(rCalc[i], iCalc.aankoop)) : "";
        if (buy2 !== "") o.aankoop = buy2;
        o.verkoop  = iCalc.verkoop!=null ? readCell(cell(rCalc[i], iCalc.verkoop)) : "";
        o.dividend = iCalc.dividend!=null ? readCell(cell(rCalc[i], iCalc.dividend)) : "";
      }
      out.push(o);
    }
    localStorage.setItem(storageKey(), JSON.stringify(out));
  }

  function recalcAll(){
    const { tMain, tCalc } = getTables();
    if (!tMain && !tCalc) return;

    const iMain = tMain ? headerIdx(tMain) : null;
    const iCalc = tCalc ? headerIdx(tCalc) : null;
    const rMain = tMain ? bodyRows(tMain) : [];
    const rCalc = tCalc ? bodyRows(tCalc) : [];
    const n = Math.max(rMain.length, rCalc.length);

    let totalNet = 0;

    for (let i=0;i<n;i++){
      const qty = (rMain[i] && iMain && iMain.aantal!=null) ? toNum(readCell(cell(rMain[i], iMain.aantal))) : 0;

      let buy = 0;
      if (rCalc[i] && iCalc && iCalc.aankoop!=null) buy = toNum(readCell(cell(rCalc[i], iCalc.aankoop)));
      if (!buy && rMain[i] && iMain && iMain.aankoop!=null) buy = toNum(readCell(cell(rMain[i], iMain.aankoop)));

      const sell = (rCalc[i] && iCalc && iCalc.verkoop!=null) ? toNum(readCell(cell(rCalc[i], iCalc.verkoop))) : 0;
      const div  = (rCalc[i] && iCalc && iCalc.dividend!=null)? toNum(readCell(cell(rCalc[i], iCalc.dividend))) : 0;

      const r = calc(qty, buy, sell, div);
      totalNet += r.net;

      // write winst/verlies in calc table (that’s what user sees)
      if (rCalc[i] && iCalc){
        if (iCalc.winst!=null)   writeCell(cell(rCalc[i], iCalc.winst), euro(r.winst));
        if (iCalc.verlies!=null) writeCell(cell(rCalc[i], iCalc.verlies), euro(r.verlies));
      }
    }

    setCardValue("Beleggingen (netto)", totalNet);
    saveState(tMain, tCalc);

    // update graph
    SAFE(() => renderGraph());
  }

  // --- GRAPH FIX (Chart.js) ---
  let chart = null;

  function findGraphCanvas(){
    // pick first canvas on dashboard area
    const canvases = Array.from(document.querySelectorAll("canvas"));
    return canvases[0] || null;
  }

  function getSelectedGraphType(){
    // UI has: Grafiek: Lijn / Balk / Cirkel (radio’s or clickable labels)
    // We'll read checked radio if present, else fallback to "lijn"
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const hit = radios.find(r => r.checked && (r.value || r.id));
    const v = hit ? String(hit.value || hit.id).toLowerCase() : "";
    if (v.includes("balk") || v.includes("bar")) return "bar";
    if (v.includes("cirkel") || v.includes("pie")) return "pie";
    return "line";
  }

  function renderGraph(){
    if (!window.Chart) return; // Chart.js not loaded
    const canvas = findGraphCanvas();
    if (!canvas) return;

    const inkomen = readCardValue("Inkomen");
    const uitgave = readCardValue("Uitgave");
    const crypto  = readCardValue("Crypto (netto)");
    const beleg   = readCardValue("Beleggingen (netto)");

    const type = getSelectedGraphType();

    const data = {
      labels: ["Inkomen","Uitgave","Crypto","Beleggingen"],
      datasets: [{
        label: "Netto",
        data: [inkomen, uitgave, crypto, beleg]
      }]
    };

    if (chart) { chart.destroy(); chart = null; }

    chart = new window.Chart(canvas.getContext("2d"), {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: (type === "pie") ? {} : {
          y: { beginAtZero: true }
        }
      }
    });
  }

  function hookGraphControls(){
    // Re-render graph when user clicks labels or radios
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!t) return;
      const txt = (t.textContent||"").toLowerCase();
      if (txt.includes("lijn") || txt.includes("balk") || txt.includes("cirkel")){
        setTimeout(() => SAFE(() => renderGraph()), 0);
      }
    }, true);

    document.addEventListener("change", (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('input[type="radio"]')){
        setTimeout(() => SAFE(() => renderGraph()), 0);
      }
    }, true);
  }

  function hook(){
    const { tMain, tCalc } = getTables();
    if (tMain || tCalc) loadSaved(tMain, tCalc);

    // recalc on any input across page (safe + simple)
    document.addEventListener("input", () => SAFE(recalcAll), { passive:true });
    document.addEventListener("change", () => SAFE(recalcAll), { passive:true });

    // clicks like “Toevoegen”, delete, etc.
    document.addEventListener("click", () => setTimeout(() => SAFE(recalcAll), 0), true);

    hookGraphControls();

    SAFE(recalcAll);
    setTimeout(() => SAFE(recalcAll), 500);
    setTimeout(() => SAFE(recalcAll), 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hook);
  } else {
    hook();
  }
})();
