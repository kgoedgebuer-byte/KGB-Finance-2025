/* KGB Finance — Investments + Chart FIX v3 (hard-fix)
   Doel:
   - Winst/Verlies per rij altijd invullen
   - Dashboard "Beleggingen (netto)" altijd updaten (geen oude waarde laten staan)
   - Grafiek Lijn/Balk/Cirkel werkt op klik (radio OF knoppen/labels)
   - Werkt met split tables (boven: datum/aandeel/aantal/aankoop | onder: aankoop/verkoop/dividend/winst/verlies)
*/
(function () {
  const SAFE = (fn) => { try { return fn(); } catch(e){ console.warn("[investments_fix]", e); } };

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
    return `kgb_finance_${getYear()}_beleggingen_v3`;
  }

  // -------- DASHBOARD: hard update (force replace of value element) --------
  function findCardByLabel(labelText){
    const nodes = Array.from(document.querySelectorAll("body *"))
      .filter(el => el.children.length === 0); // leafs
    const label = nodes.find(el => (el.textContent||"").trim() === labelText);
    if (!label) return null;

    // card is usually a container around label + big number
    let card = label.closest("section, article, div");
    // climb until we find a box containing a number
    while (card && card !== document.body) {
      const txt = card.innerText || "";
      if (txt.match(/-?\d[\d\.\,\s]*\d/)) return { card, label };
      card = card.parentElement;
    }
    return null;
  }

  function forceSetCard(labelText, value){
    const hit = findCardByLabel(labelText);
    if (!hit) return false;
    const { card, label } = hit;

    // pick the "main number" element inside card: biggest numeric-like leaf
    const leaves = Array.from(card.querySelectorAll("*"))
      .filter(el => el.children.length === 0)
      .filter(el => el !== label)
      .map(el => ({ el, t: (el.textContent||"").trim() }))
      .filter(x => x.t.match(/-?\d/));

    if (!leaves.length) return false;

    // choose leaf with longest numeric string
    leaves.sort((a,b) => (b.t.length - a.t.length));
    leaves[0].el.textContent = euro(value);
    return true;
  }

  // -------- INVESTMENTS: calculation --------
  function calc(qty, buy, sell, div){
    // buy/sell are per-aandeel (zoals jij invult 53 / 62)
    const net = (sell - buy) * qty + div;
    return { net, winst: net >= 0 ? net : 0, verlies: net < 0 ? -net : 0 };
  }

  function getTables(){
    const tMain = findTableByHeaders(["datum","aandeel","aantal","aankoop"]);
    const tCalc = findTableByHeaders(["verkoop","dividend","winst","verlies"]);
    return { tMain, tCalc };
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
        const buy2 = iCalc.aankoop!=null ? readCell(cell(rCalc[i], iCalc.aankoop)) : "";
        if (buy2 !== "") o.aankoop = buy2;
        o.verkoop  = iCalc.verkoop!=null ? readCell(cell(rCalc[i], iCalc.verkoop)) : "";
        o.dividend = iCalc.dividend!=null ? readCell(cell(rCalc[i], iCalc.dividend)) : "";
      }
      out.push(o);
    }
    localStorage.setItem(storageKey(), JSON.stringify(out));
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

  function recalcAll(){
    const { tMain, tCalc } = getTables();
    if (!tMain || !tCalc) return;

    const iMain = headerIdx(tMain);
    const iCalc = headerIdx(tCalc);
    const rMain = bodyRows(tMain);
    const rCalc = bodyRows(tCalc);
    const n = Math.max(rMain.length, rCalc.length);

    let totalNet = 0;

    for (let i=0;i<n;i++){
      const qty = (rMain[i] && iMain.aantal!=null) ? toNum(readCell(cell(rMain[i], iMain.aantal))) : 0;

      // aankoop: eerst uit calc-table, anders main-table
      let buy = 0;
      if (rCalc[i] && iCalc.aankoop!=null) buy = toNum(readCell(cell(rCalc[i], iCalc.aankoop)));
      if (!buy && rMain[i] && iMain.aankoop!=null) buy = toNum(readCell(cell(rMain[i], iMain.aankoop)));

      const sell = (rCalc[i] && iCalc.verkoop!=null) ? toNum(readCell(cell(rCalc[i], iCalc.verkoop))) : 0;
      const div  = (rCalc[i] && iCalc.dividend!=null)? toNum(readCell(cell(rCalc[i], iCalc.dividend))) : 0;

      const r = calc(qty, buy, sell, div);
      totalNet += r.net;

      // ALWAYS fill winst/verlies columns (as numbers, not blank)
      if (rCalc[i]) {
        if (iCalc.winst!=null)   writeCell(cell(rCalc[i], iCalc.winst), euro(r.winst));
        if (iCalc.verlies!=null) writeCell(cell(rCalc[i], iCalc.verlies), euro(r.verlies));
      }
    }

    // HARD set dashboard value
    forceSetCard("Beleggingen (netto)", totalNet);

    saveState(tMain, tCalc);

    SAFE(renderGraph);
  }

  // -------- GRAPH: robust canvas + control detection --------
  let chart = null;

  function findGraphCanvas(){
    // find "Grafiek:" label and take nearest canvas after it
    const label = Array.from(document.querySelectorAll("body *"))
      .find(el => (el.textContent||"").trim().toLowerCase().startsWith("grafiek"));
    if (label) {
      const container = label.closest("div, section, article") || document.body;
      const c = container.querySelector("canvas");
      if (c) return c;
    }
    // fallback: first canvas
    return document.querySelector("canvas");
  }

  function getGraphType(){
    // 1) checked radio
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const checked = radios.find(r => r.checked);
    if (checked){
      const v = String(checked.value || checked.id || "").toLowerCase();
      if (v.includes("balk") || v.includes("bar")) return "bar";
      if (v.includes("cirkel") || v.includes("pie")) return "pie";
      return "line";
    }

    // 2) active button/label
    const candidates = Array.from(document.querySelectorAll("button, label, a, span, div"))
      .filter(el => {
        const t = (el.textContent||"").trim().toLowerCase();
        return t === "lijn" || t === "balk" || t === "cirkel";
      });

    const active = candidates.find(el =>
      el.classList.contains("active") ||
      el.getAttribute("aria-pressed") === "true" ||
      el.getAttribute("data-active") === "true"
    );

    const t = ((active || candidates[0])?.textContent || "lijn").trim().toLowerCase();
    if (t === "balk") return "bar";
    if (t === "cirkel") return "pie";
    return "line";
  }

  function readCard(labelText){
    // find exact label leaf, then find numeric leaf in same card
    const hit = findCardByLabel(labelText);
    if (!hit) return 0;
    const { card, label } = hit;

    const leaves = Array.from(card.querySelectorAll("*"))
      .filter(el => el.children.length === 0)
      .filter(el => el !== label)
      .map(el => (el.textContent||"").trim())
      .filter(t => t.match(/-?\d/));
    return leaves.length ? toNum(leaves[0]) : 0;
  }

  function renderGraph(){
    if (!window.Chart) return;
    const canvas = findGraphCanvas();
    if (!canvas) return;

    // ensure visible height (Chart.js needs size)
    canvas.style.height = "260px";
    const parent = canvas.parentElement;
    if (parent) parent.style.minHeight = "260px";

    const inkomen = readCard("Inkomen");
    const uitgave = readCard("Uitgave");
    const crypto  = readCard("Crypto (netto)");
    const beleg   = readCard("Beleggingen (netto)");

    const type = getGraphType();

    if (chart) { chart.destroy(); chart = null; }

    chart = new window.Chart(canvas.getContext("2d"), {
      type,
      data: {
        labels: ["Inkomen","Uitgave","Crypto","Beleggingen"],
        datasets: [{
          label: "Netto",
          data: [inkomen, uitgave, crypto, beleg]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: (type === "pie") ? {} : { y: { beginAtZero: true } }
      }
    });
  }

  function hookGraphControls(){
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!t) return;
      const txt = (t.textContent||"").trim().toLowerCase();
      if (txt === "lijn" || txt === "balk" || txt === "cirkel") {
        // if no radios, mark clicked as active so getGraphType works
        try {
          const sibs = Array.from(t.parentElement?.querySelectorAll("button,label,a,span,div") || []);
          sibs.forEach(x => x.classList.remove("active"));
          t.classList.add("active");
        } catch {}
        setTimeout(() => SAFE(renderGraph), 0);
      }
    }, true);

    document.addEventListener("change", (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('input[type="radio"]')) {
        setTimeout(() => SAFE(renderGraph), 0);
      }
    }, true);
  }

  function hook(){
    const { tMain, tCalc } = getTables();
    if (tMain && tCalc) loadSaved(tMain, tCalc);

    // recalc on ANY edit
    document.addEventListener("input", () => SAFE(recalcAll), { passive:true });
    document.addEventListener("change", () => SAFE(recalcAll), { passive:true });
    document.addEventListener("click", () => setTimeout(() => SAFE(recalcAll), 0), true);

    hookGraphControls();

    SAFE(recalcAll);
    setTimeout(() => SAFE(recalcAll), 400);
    setTimeout(() => SAFE(recalcAll), 1200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook);
  else hook();
})();
