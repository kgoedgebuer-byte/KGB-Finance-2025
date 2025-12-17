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
$("#addBudget").addEventListener("submit",e=>{
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
$("#tblBudget").addEventListener("input",genericEdit)

function genericAction(e){
  const b=e.target.closest("button"); if(!b) return;
  const i=+b.dataset.i, a=b.dataset.a;
  if(a==="del"){ state.budget.splice(i,1); save(); }
  if(a==="up" && i>0){ [state.budget[i-1],state.budget[i]]=[state.budget[i],state.budget[i-1]]; save(); }
  if(a==="down" && i<state.budget.length-1){ [state.budget[i+1],state.budget[i]]=[state.budget[i],state.budget[i+1]]; save(); }
}
$("#tblBudget").addEventListener("click",genericAction)

$$('input[name="ctype"]').forEach(r=>{
  if(r.value===chartType) r.checked=true
  r.addEventListener("change",()=>{ chartType=r.value; setPref({chartType}); renderDashboard() })
})

$("#btnExport").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'})
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='kgb_budget.json'; a.click(); URL.revokeObjectURL(a.href)
})
$("#fileImport").addEventListener("change",async (e)=>{
  const f=e.target.files[0]; if(!f) return;
  try{ const data=JSON.parse(await f.text()); if(data && typeof data==="object"){ state=data; save(); alert("Geïmporteerd."); } }
  catch{ alert("Ongeldig JSON."); }
  e.target.value="";
})
$("#btnReset").addEventListener("click",()=>{ if(confirm("Alles wissen?")){ state={budget:[]}; save(); }})

$("#btnClear").addEventListener("click",()=>{ renderDashboard() })
$("#btnDemo").addEventListener("click",()=>{
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
$("#intensity").addEventListener("input",e=>{ theme.intensity=+e.target.value; applyTheme(theme) })
$("#gridIntensity").addEventListener("input",e=>{ theme.gridIntensity=+e.target.value; applyTheme(theme) })
$("#themeReset").addEventListener("click",()=>{ theme={...defaultTheme}; applyTheme(theme); buildSwatches() })
$("#themeSave").addEventListener("click",()=>{ localStorage.setItem(THEME,JSON.stringify(theme)); alert("Thema opgeslagen.") })
buildSwatches()

/* Tabs */
$$(".tab").forEach(b=>b.addEventListener("click",()=>{
  $$(".tab").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  $$(".panel").forEach(p=>p.classList.remove("active")); $("#"+b.dataset.tab).classList.add("active");
}))

ensure(); refresh();
