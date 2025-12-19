const KEY="kgb_finance_budget_only_v1";
const THEME="kgb_finance_theme_v1";
const PREF="kgb_finance_pref_v1";
const pastel=["#A0C4FF","#BDB2FF","#FFC6FF","#9BF6FF","#FDFFB6","#CAFFBF","#FFADAD","#FFD6A5","#E4C1F9","#CDEAC0","#B9FBC0","#FFD5C2","#F7DAD9","#E2ECE9","#E6CBA8","#E4C6A1","#E8AEB7","#A0CED9","#E8D7FF","#A3D5D3","#D9E8E3","#FFF3B0","#FFCFD2","#F1E3FF","#C8E7FF","#E3F8FF","#FFEEE8","#FFE3E3","#E5FFFB","#F6E6FF","#F9D8D6","#D7F9F1","#F8E8C6","#FBE7E1","#E0F7FA","#E8F5E9","#FFEBEE","#FFFDE7","#EDE7F6","#E3F2FD","#FCE4EC","#F3E5F5","#FFECB3","#D1C4E9","#BBDEFB","#C8E6C9","#F0F4C3","#DCEDC8"];
const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
let state=load(); let chart; let chartType=(JSON.parse(localStorage.getItem(PREF)||"{}").chartType)||"line";

function load(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(_){return {}}}
function save(){localStorage.setItem(KEY,JSON.stringify(state)); refresh()}
function ensure(){ state.budget??=[] }
function fmt(n){return (n??0).toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2})}
function num(x){if(x===undefined||x===null||x==="")return 0; const s=(x+"").replace(",","."); const n=+s; return isNaN(n)?0:n}
function today(){return new Date().toISOString().slice(0,10)}
function setPref(obj){localStorage.setItem(PREF,JSON.stringify({...(JSON.parse(localStorage.getItem(PREF)||"{}")),...obj}))}

function totals(){
  ensure(); let inc=0, exp=0;
  state.budget.forEach(r=>{inc+=num(r.income); exp+=num(r.expense)});
  return {income:inc, expense:exp, saldo:inc-exp}
}

function renderDashboard(){
  const {income, expense, saldo}=totals()
  $("#totIncome").textContent=fmt(income)
  $("#totExpense").textContent=fmt(expense)
  $("#totSaldo").textContent=fmt(saldo)

  const ctx=$("#saldoChart").getContext("2d"); if(chart) chart.destroy()
  if(chartType==="pie"){
    chart=new Chart(ctx,{type:"pie",data:{labels:["Inkomen","Uitgave"],datasets:[{data:[income,expense]}]},options:{plugins:{legend:{position:"bottom"}}}})
  }else{
    const labels=[], data=[]; let run=0;
    state.budget.slice().sort((a,b)=> (a.date||"") < (b.date||"") ? -1:1 ).forEach(r=>{ run+=num(r.income)-num(r.expense); labels.push(r.date||""); data.push(+run.toFixed(2)); })
    chart=new Chart(ctx,{type:(chartType==="bar"?"bar":"line"),data:{labels,datasets:[{label:"Saldo",data,tension:.25}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}})
  }
}

function tr(...cells){const tr=document.createElement("tr"); tr.innerHTML=cells.join(""); return tr}
function actionBtns(i){return `<td class="actions"><button data-a="up" data-i="${i}">⬆️</button><button data-a="down" data-i="${i}">⬇️</button><button data-a="del" data-i="${i}">🗑️</button></td>`}

function renderBudget(){
  const tb=$("#tblBudget tbody"); tb.innerHTML="";
  let running=0;
  state.budget.forEach((r,i)=>{ running+=num(r.income)-num(r.expense);
    tb.appendChild(tr(
      `<td><input type="date" value="${r.date||""}" data-k="date" data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.cat||""}"  data-k="cat"  data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.desc||""}" data-k="desc" data-i="${i}"></td>`,
      `<td><input type="number" step="0.01" value="${r.income??""}" data-k="income" data-i="${i}"></td>`,
      `<td><input type="number" step="0.01" value="${r.expense??""}" data-k="expense" data-i="${i}"></td>`,
      `<td>${fmt(running)}</td>`,
      actionBtns(i)
    ))
  })
}

function refresh(){ renderDashboard(); renderBudget(); }

$("#b_date").value=today();
$("#addBudget")?.addEventListener("submit",e=>{
  e.preventDefault();
  state.budget.push({date:$("#b_date").value,cat:$("#b_cat").value.trim(),desc:$("#b_desc").value.trim(),income:num($("#b_inc").value),expense:num($("#b_exp").value)});
  e.target.reset(); $("#b_date").value=today(); save();
})

function genericEdit(e){
  const t=e.target; if(t.tagName!=="INPUT") return;
  const i=+t.dataset.i, k=t.dataset.k; if(!Number.isInteger(i)||!k) return;
  const isNum=["income","expense"].includes(k);
  state.budget[i][k]=isNum?num(t.value):t.value; save();
}
$("#tblBudget")?.addEventListener("input",genericEdit)

function genericAction(e){
  const b=e.target.closest("button"); if(!b) return;
  const i=+b.dataset.i, a=b.dataset.a;
  if(a==="del"){ state.budget.splice(i,1); save(); }
  if(a==="up" && i>0){ [state.budget[i-1],state.budget[i]]=[state.budget[i],state.budget[i-1]]; save(); }
  if(a==="down" && i<state.budget.length-1){ [state.budget[i+1],state.budget[i]]=[state.budget[i],state.budget[i+1]]; save(); }
}
$("#tblBudget")?.addEventListener("click",genericAction)

$$('input[name="ctype"]').forEach(r=>{
  if(r.value===chartType) r.checked=true
  r.addEventListener("change",()=>{ chartType=r.value; setPref({chartType}); renderDashboard() })
})

$("#btnExport")?.addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'})
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='kgb_budget.json'; a.click(); URL.revokeObjectURL(a.href)
})
$("#fileImport")?.addEventListener("change",async (e)=>{
  const f=e.target.files[0]; if(!f) return;
  try{ const data=JSON.parse(await f.text()); if(data && typeof data==="object"){ state=data; save(); alert("Geïmporteerd."); } }
  catch{ alert("Ongeldig JSON."); }
  e.target.value="";
})
$("#btnReset")?.addEventListener("click",()=>{ if(confirm("Alles wissen?")){ state={budget:[]}; save(); }})

$("#btnClear")?.addEventListener("click",()=>{ renderDashboard() })
$("#btnDemo")?.addEventListener("click",()=>{
  if(!confirm("Demo-data toevoegen?")) return;
  state.budget=[
    {date:today(),cat:"Loon",desc:"",income:1000,expense:0},
    {date:today(),cat:"Huur",desc:"",income:0,expense:250},
    {date:today(),cat:"Boodschappen",desc:"",income:0,expense:120}
  ];
  save();
})

/* Thema */
function colToRgb(hex){hex=hex.replace('#',''); if(hex.length===3) hex=hex.split('').map(x=>x+x).join(''); const n=parseInt(hex,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
function adjust(hex,f){const {r,g,b}=colToRgb(hex); const adj=(v)=>Math.max(0,Math.min(255, Math.round(v*(f/100)))); const rr=adj(r),gg=adj(g),bb=adj(b); return `rgb(${rr}, ${gg}, ${bb})`}
function applyTheme(t){ document.documentElement.style.setProperty('--bg',adjust(t.bg,t.intensity)); document.documentElement.style.setProperty('--card',adjust(t.card,t.intensity)); document.documentElement.style.setProperty('--acc',adjust(t.acc,t.intensity)); document.documentElement.style.setProperty('--txt',t.txt); document.documentElement.style.setProperty('--grid',adjust(t.grid,t.gridIntensity)); }
const defaultTheme={bg:"#f5f7ff",card:"#ffffff",acc:"#7c9cf5",txt:"#0f172a",grid:"#e2e8f0",intensity:100,gridIntensity:100}
let theme=JSON.parse(localStorage.getItem(THEME)||"null")||defaultTheme; applyTheme(theme)
function buildSwatches(){ const box=$("#swatches"); box.innerHTML=""; pastel.forEach(c=>{ const b=document.createElement("button"); b.style.background=c; b.title=c; b.addEventListener("click",()=>{ const t=$("#themeTarget").value; theme[t==="bg"?"bg":t==="card"?"card":t==="acc"?"acc":t==="grid"?"grid":"txt"]=c; applyTheme(theme)}); box.appendChild(b); }); $("#intensity").value=theme.intensity; $("#gridIntensity").value=theme.gridIntensity}
$("#intensity")?.addEventListener("input",e=>{ theme.intensity=+e.target.value; applyTheme(theme) })
$("#gridIntensity")?.addEventListener("input",e=>{ theme.gridIntensity=+e.target.value; applyTheme(theme) })
$("#themeReset")?.addEventListener("click",()=>{ theme={...defaultTheme}; applyTheme(theme); buildSwatches() })
$("#themeSave")?.addEventListener("click",()=>{ localStorage.setItem(THEME,JSON.stringify(theme)); alert("Thema opgeslagen.") })
buildSwatches()

/* Tabs */
$$(".tab").forEach(b=>b.addEventListener("click",()=>{
  $$(".tab").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  $$(".panel").forEach(p=>p.classList.remove("active")); $("#"+b.dataset.tab).classList.add("active");
}))

ensure(); refresh();

try{buildSwatches();}catch(_){ }


/* KGB_THEME_ENGINE v1 */
(() => {
  const THEME_KEY = "kgb_finance_theme_v1";
  const pastel = ["#A0C4FF","#BDB2FF","#FFC6FF","#9BF6FF","#FDFFB6","#CAFFBF","#FFADAD","#FFD6A5","#E4C1F9","#CDEAC0","#B9FBC0","#FFD5C2","#F7DAD9","#E2ECE9","#E6CBA8","#E4C6A1","#E8AEB7","#A0CED9","#E8D7FF","#A3D5D3","#D9E8E3","#FFF3B0","#FFCFD2","#F1E3FF","#C8E7FF","#E3F8FF","#FFEEE8","#FFE3E3","#E5FFFB","#F6E6FF","#F9D8D6","#D7F9F1","#F8E8C6","#FBE7E1","#E0F7FA","#E8F5E9","#FFEBEE","#FFFDE7","#EDE7F6","#E3F2FD","#FCE4EC","#F3E5F5","#FFECB3","#D1C4E9","#BBDEFB","#C8E6C9","#F0F4C3","#DCEDC8"];
  const def = {bg:"#f5f7ff",card:"#ffffff",acc:"#7c9cf5",txt:"#0f172a",grid:"#e2e8f0",intensity:100,gridIntensity:100};
  const $ = (s, c=document) => c.querySelector(s);

  function colToRgb(hex){
    hex=(hex||"").replace('#','');
    if(hex.length===3) hex=hex.split('').map(x=>x+x).join('');
    const n=parseInt(hex,16);
    return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
  }
  function adjust(hex,f){
    const {r,g,b}=colToRgb(hex);
    const adj=(v)=>Math.max(0,Math.min(255, Math.round(v*(f/100))));
    return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
  }

  function load(){
    try { return JSON.parse(localStorage.getItem(THEME_KEY)||"null") || {...def}; }
    catch { return {...def}; }
  }
  function save(t){ localStorage.setItem(THEME_KEY, JSON.stringify(t)); }

  function apply(t){
    const root = document.documentElement;
    root.style.setProperty('--bg',   adjust(t.bg,   t.intensity||100));
    root.style.setProperty('--card', adjust(t.card, t.intensity||100));
    root.style.setProperty('--acc',  adjust(t.acc,  t.intensity||100));
    root.style.setProperty('--grid', adjust(t.grid, t.gridIntensity||100));
    root.style.setProperty('--txt',  t.txt || "#0f172a");
  }

  function ensureSwatchesUI(){
    // probeer de bestaande theme UI te gebruiken
    const themeTitle = Array.from(document.querySelectorAll("h1,h2,h3")).find(x => (x.textContent||"").trim().toLowerCase()==="thema");
    const themeArea = themeTitle ? (themeTitle.closest("section,.card,.panel,main") || themeTitle.parentElement) : document.body;

    let box = $("#swatches");
    if (!box){
      box = document.createElement("div");
      box.id = "swatches";
      box.className = "swatches";
      themeArea.appendChild(box);
    }

    // target select: bestaande #themeTarget of de 2e "Onderdeel" dropdown (onder thema)
    let target = $("#themeTarget");
    if (!target){
      const sels = Array.from(themeArea.querySelectorAll("select"));
      target = sels.find(s => (s.previousElementSibling?.textContent||"").toLowerCase().includes("onderdeel")) || sels[0];
      if (target) target.id = "themeTarget";
    }

    // sliders: neem 2 range inputs uit thema area
    const ranges = Array.from(themeArea.querySelectorAll('input[type="range"]'));
    if (ranges[0] && !$("#intensity")) ranges[0].id = "intensity";
    if (ranges[1] && !$("#gridIntensity")) ranges[1].id = "gridIntensity";

    // knoppen reset/opslaan (boven thema)
    const btns = Array.from(themeArea.querySelectorAll("button"));
    const resetBtn = btns.find(b => (b.textContent||"").trim().toLowerCase()==="reset");
    const saveBtn  = btns.find(b => (b.textContent||"").trim().toLowerCase()==="opslaan");
    if (resetBtn && !$("#themeReset")) resetBtn.id = "themeReset";
    if (saveBtn  && !$("#themeSave"))  saveBtn.id  = "themeSave";

    return {box, target};
  }

  function initTheme(){
    const t = load();
    apply(t);

    const {box, target} = ensureSwatchesUI();
    if (!box || !target) return;

    // build swatches (eenmalig)
    if (box.children.length === 0){
      pastel.forEach(c => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "swatch";
        b.style.background = c;
        b.title = c;
        b.addEventListener("click", () => {
          const part = (target.value || "bg");
          if (part === "bg") t.bg = c;
          else if (part === "card") t.card = c;
          else if (part === "acc") t.acc = c;
          else if (part === "grid") t.grid = c;
          else t.txt = c;
          apply(t);
        });
        box.appendChild(b);
      });
    }

    const intensity = $("#intensity");
    const gridIntensity = $("#gridIntensity");
    const btnReset = $("#themeReset");
    const btnSave = $("#themeSave");

    if (intensity){
      intensity.value = t.intensity ?? 100;
      const onI = (e)=>{ t.intensity = +e.target.value; apply(t); };
      intensity.addEventListener("input", onI);
      intensity.addEventListener("change", onI);
    }
    if (gridIntensity){
      gridIntensity.value = t.gridIntensity ?? 100;
      const onG = (e)=>{ t.gridIntensity = +e.target.value; apply(t); };
      gridIntensity.addEventListener("input", onG);
      gridIntensity.addEventListener("change", onG);
    }
    if (btnReset){
      btnReset.addEventListener("click", () => { Object.assign(t, def); apply(t); });
    }
    if (btnSave){
      btnSave.addEventListener("click", () => { save(t); alert("Thema opgeslagen."); });
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    initTheme();
    // safety: 2e run na render
    setTimeout(initTheme, 250);
  });
})();



/* KGB_THEME_ENGINE_SAFE v1 */
(() => {
  try {
    const THEME_KEY = "kgb_finance_theme_v1";
    const pastel = ["#A0C4FF","#BDB2FF","#FFC6FF","#9BF6FF","#FDFFB6","#CAFFBF","#FFADAD","#FFD6A5","#E4C1F9","#CDEAC0","#B9FBC0","#FFD5C2","#F7DAD9","#E2ECE9","#E6CBA8","#E4C6A1","#E8AEB7","#A0CED9","#E8D7FF","#A3D5D3","#D9E8E3","#FFF3B0","#FFCFD2","#F1E3FF","#C8E7FF","#E3F8FF","#FFEEE8","#FFE3E3","#E5FFFB","#F6E6FF","#F9D8D6","#D7F9F1","#F8E8C6","#FBE7E1","#E0F7FA","#E8F5E9","#FFEBEE","#FFFDE7","#EDE7F6","#E3F2FD","#FCE4EC","#F3E5F5","#FFECB3","#D1C4E9","#BBDEFB","#C8E6C9","#F0F4C3","#DCEDC8"];
    const def = {bg:"#f5f7ff",card:"#ffffff",acc:"#7c9cf5",txt:"#0f172a",grid:"#e2e8f0",intensity:100,gridIntensity:100};
    const $ = (s, c=document) => c.querySelector(s);

    function colToRgb(hex){
      hex=(hex||"").replace('#','');
      if(hex.length===3) hex=hex.split('').map(x=>x+x).join('');
      const n=parseInt(hex,16);
      return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
    }
    function adjust(hex,f){
      const {r,g,b}=colToRgb(hex);
      const adj=(v)=>Math.max(0,Math.min(255, Math.round(v*(f/100))));
      return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
    }
    function load(){
      try { return JSON.parse(localStorage.getItem(THEME_KEY)||"null") || {...def}; }
      catch { return {...def}; }
    }
    function save(t){ localStorage.setItem(THEME_KEY, JSON.stringify(t)); }

    function apply(t){
      const root = document.documentElement;
      root.style.setProperty('--bg',   adjust(t.bg,   t.intensity||100));
      root.style.setProperty('--card', adjust(t.card, t.intensity||100));
      root.style.setProperty('--acc',  adjust(t.acc,  t.intensity||100));
      root.style.setProperty('--grid', adjust(t.grid, t.gridIntensity||100));
      root.style.setProperty('--txt',  t.txt || "#0f172a");
    }

    function badge(msg){
      let b = $("#kgbThemeBadge");
      if (!b){
        b = document.createElement("div");
        b.id = "kgbThemeBadge";
        b.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:99999;padding:6px 10px;border-radius:12px;background:rgba(0,0,0,.7);color:#fff;font:12px system-ui;";
        document.body.appendChild(b);
      }
      b.textContent = msg;
    }

    function init(){
      const t = load();
      apply(t);

      let box = $("#swatches");
      if (!box){
        box = document.createElement("div");
        box.id = "swatches";
        box.className = "swatches";
        document.body.appendChild(box);
      }

      // swatches bouwen (eenmalig)
      if (!box.dataset.built){
        box.dataset.built = "1";
        box.innerHTML = "";
        pastel.forEach(c => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "swatch";
          btn.style.background = c;
          btn.title = c;
          btn.addEventListener("click", () => {
            // default: accent aanpassen als er geen target dropdown bestaat
            const target = $("#themeTarget");
            const part = target ? target.value : "acc";
            if (part === "bg") t.bg = c;
            else if (part === "card") t.card = c;
            else if (part === "acc") t.acc = c;
            else if (part === "grid") t.grid = c;
            else t.txt = c;
            apply(t);
          });
          box.appendChild(btn);
        });
      }

      // sliders live (pak gewoon de 2 ranges op de pagina)
      const ranges = Array.from(document.querySelectorAll('input[type="range"]'));
      if (ranges[0]){
        ranges[0].addEventListener("input", e => { t.intensity = +e.target.value || 100; apply(t); });
        ranges[0].addEventListener("change", e => { t.intensity = +e.target.value || 100; apply(t); });
      }
      if (ranges[1]){
        ranges[1].addEventListener("input", e => { t.gridIntensity = +e.target.value || 100; apply(t); });
        ranges[1].addEventListener("change", e => { t.gridIntensity = +e.target.value || 100; apply(t); });
      }

      // knoppen opslaan/reset (eerste match op tekst)
      const btns = Array.from(document.querySelectorAll("button"));
      const resetBtn = btns.find(b => (b.textContent||"").trim().toLowerCase()==="reset");
      const saveBtn  = btns.find(b => (b.textContent||"").trim().toLowerCase()==="opslaan");
      if (resetBtn) resetBtn.addEventListener("click", () => { Object.assign(t, def); apply(t); });
      if (saveBtn)  saveBtn.addEventListener("click", () => { save(t); alert("Thema opgeslagen."); });

      badge("THEME OK ✅  swatches=" + (box.children?.length || 0));
    }

    window.addEventListener("DOMContentLoaded", () => {
      init();
      setTimeout(init, 300);
    });
  } catch (e) {
    try {
      const b = document.createElement("div");
      b.style.cssText = "position:fixed;left:10px;bottom:10px;z-index:99999;padding:8px 10px;border-radius:12px;background:#b00020;color:#fff;font:12px system-ui;";
      b.textContent = "THEME ERROR: " + (e && e.message ? e.message : e);
      document.body.appendChild(b);
    } catch {}
  }
})();
