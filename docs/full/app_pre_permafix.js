const KEY="kgb_finance_data_v1"; const THEME="kgb_finance_theme_v1"; const PREF="kgb_finance_pref_v1";
const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
const pastel=["#A0C4FF","#BDB2FF","#FFC6FF","#9BF6FF","#FDFFB6","#CAFFBF","#FFADAD","#FFD6A5","#E4C1F9","#CDEAC0","#B9FBC0","#FFD5C2","#F7DAD9","#E2ECE9","#E6CBA8","#E4C6A1","#E8AEB7","#A0CED9","#E8D7FF","#A3D5D3","#D9E8E3","#FFF3B0","#FFCFD2","#F1E3FF","#C8E7FF","#E3F8FF","#FFEEE8","#FFE3E3","#E5FFFB","#F6E6FF","#F9D8D6","#D7F9F1","#F8E8C6","#FBE7E1","#E0F7FA","#E8F5E9","#FFEBEE","#FFFDE7","#EDE7F6","#E3F2FD","#FCE4EC","#F3E5F5","#FFECB3","#D1C4E9","#BBDEFB","#C8E6C9","#F0F4C3","#DCEDC8"];
let state=load(); let chart, chartType=(JSON.parse(localStorage.getItem(PREF)||"{}").chartType)||"line";

function load(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(_){return {}}}
function save(){localStorage.setItem(KEY,JSON.stringify(state)); refresh()}
function ensure(){ state.budget??=[]; state.investments??=[]; state.crypto??=[]; state.agenda??=[] }
function fmt(n){return (n??0).toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2})}
function num(x){if(x===undefined||x===null||x==="")return 0; const s=(x+"").replace(",","."); const n=+s; return isNaN(n)?0:n}
function today(){return new Date().toISOString().slice(0,10)}
function setPref(obj){localStorage.setItem(PREF,JSON.stringify({...(JSON.parse(localStorage.getItem(PREF)||"{}")),...obj}))}

function totals(){
  ensure()
  let inc=0, exp=0, inv=0, cr=0;
  state.budget.forEach(r=>{inc+=num(r.income); exp+=num(r.expense)});
  state.investments.forEach(r=>{inv+=num(r.profit)-num(r.loss)});
  state.crypto.forEach(r=>{cr+=num(r.profit)-num(r.loss)});
  return {income:inc, expense:exp, invest:inv, crypto:cr, saldo:inc-exp}
}

function renderDashboard(){
  const {income, expense, invest, crypto, saldo}=totals()
  $("#totIncome").textContent=fmt(income)
  $("#totExpense").textContent=fmt(expense)
  $("#totInvest").textContent=fmt(invest)
  $("#totCrypto").textContent=fmt(crypto)
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

function renderInvest(){
  const tb=$("#tblInvest tbody"); tb.innerHTML="";
  state.investments.forEach((r,i)=>{
    tb.appendChild(tr(
      `<td><input type="date" value="${r.date||""}" data-k="date" data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.name||""}" data-k="name" data-i="${i}"></td>`,
      `<td><input type="number" step="0.0001" value="${r.qty??""}" data-k="qty" data-i="${i}"></td>`,
      `<td><input type="number" step="0.01" value="${r.buy??""}" data-k="buy" data-i="${i}"></td>`,
      `<td><input type="number" step="0.01" value="${r.sell??""}" data-k="sell" data-i="${i}"></td>`,
      `<td><input type="number" step="0.01" value="${r.div??""}" data-k="div" data-i="${i}"></td>`,
      `<td>${fmt(r.profit||0)}</td>`,
      `<td>${fmt(r.loss||0)}</td>`,
      actionBtns(i)
    ))
  })
}

function renderCrypto(){
  const tb=$("#tblCrypto tbody"); tb.innerHTML="";
  state.crypto.forEach((r,i)=>{
    tb.appendChild(tr(
      `<td><input type="date" value="${r.date||""}" data-k="date" data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.token||""}" data-k="token" data-i="${i}"></td>`,
      `<td><input type="number" step="0.0001" value="${r.qty??""}" data-k="qty" data-i="${i}"></td>`,
      `<td><input type="number" step="0.01" value="${r.buy??""}" data-k="buy" data-i="${i}"></td>`,
      `<td><input type="number" step="0.01" value="${r.sell??""}" data-k="sell" data-i="${i}"></td>`,
      `<td>${fmt(r.profit||0)}</td>`,
      `<td>${fmt(r.loss||0)}</td>`,
      actionBtns(i)
    ))
  })
}

function renderAgenda(){
  const tb=$("#tblAgenda tbody"); tb.innerHTML="";
  state.agenda.forEach((r,i)=>{
    tb.appendChild(tr(
      `<td><input type="date" value="${r.date||""}" data-k="date" data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.task||""}" data-k="task" data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.status||""}" data-k="status" data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.meet||""}" data-k="meet" data-i="${i}"></td>`,
      actionBtns(i)
    ))
  })
}

function recalcInvest(){
  state.investments.forEach(r=>{
    const total=(num(r.sell)-num(r.buy))*num(r.qty)+num(r.div)
    if(total>=0){ r.profit=+total.toFixed(2); r.loss=0 }
    else{ r.profit=0; r.loss=+(-total).toFixed(2) }
  })
}
function recalcCrypto(){
  state.crypto.forEach(r=>{
    const total=(num(r.sell)-num(r.buy))*num(r.qty)
    if(total>=0){ r.profit=+total.toFixed(2); r.loss=0 }
    else{ r.profit=0; r.loss=+(-total).toFixed(2) }
  })
}

function refresh(){
  recalcInvest(); recalcCrypto();
  renderDashboard(); renderBudget(); renderInvest(); renderCrypto(); renderAgenda();
}

$("#b_date").value=today(); $("#i_date").value=today(); $("#c_date").value=today(); $("#a_date").value=today();

$("#addBudget").addEventListener("submit",e=>{
  e.preventDefault();
  state.budget.push({date:$("#b_date").value,cat:$("#b_cat").value.trim(),desc:$("#b_desc").value.trim(),income:num($("#b_inc").value),expense:num($("#b_exp").value)});
  e.target.reset(); $("#b_date").value=today(); save();
})
$("#addInvest").addEventListener("submit",e=>{
  e.preventDefault();
  state.investments.push({date:$("#i_date").value,name:$("#i_name").value.trim(),qty:num($("#i_qty").value),buy:num($("#i_buy").value),sell:num($("#i_sell").value),div:num($("#i_div").value)});
  e.target.reset(); $("#i_date").value=today(); save();
})
$("#addCrypto").addEventListener("submit",e=>{
  e.preventDefault();
  state.crypto.push({date:$("#c_date").value,token:$("#c_token").value.trim(),qty:num($("#c_qty").value),buy:num($("#c_buy").value),sell:num($("#c_sell").value)});
  e.target.reset(); $("#c_date").value=today(); save();
})
$("#addAgenda").addEventListener("submit",e=>{
  e.preventDefault();
  state.agenda.push({date:$("#a_date").value,task:$("#a_task").value.trim(),status:$("#a_status").value.trim(),meet:$("#a_meet").value.trim()});
  e.target.reset(); $("#a_date").value=today(); save();
})

function genericEdit(e, list){
  const t=e.target; if(t.tagName!=="INPUT") return;
  const i=+t.dataset.i, k=t.dataset.k; if(!Number.isInteger(i)||!k) return;
  const isNum=["income","expense","qty","buy","sell","div"].includes(k);
  list[i][k]=isNum?num(t.value):t.value; save();
}
$("#tblBudget").addEventListener("input",(e)=>genericEdit(e,state.budget))
$("#tblInvest").addEventListener("input",(e)=>genericEdit(e,state.investments))
$("#tblCrypto").addEventListener("input",(e)=>genericEdit(e,state.crypto))
$("#tblAgenda").addEventListener("input",(e)=>genericEdit(e,state.agenda))

function genericAction(e,list){
  const b=e.target.closest("button"); if(!b) return;
  const i=+b.dataset.i, a=b.dataset.a;
  if(a==="del"){ list.splice(i,1); save(); }
  if(a==="up" && i>0){ [list[i-1],list[i]]=[list[i],list[i-1]]; save(); }
  if(a==="down" && i<list.length-1){ [list[i+1],list[i]]=[list[i],list[i+1]]; save(); }
}
$("#tblBudget").addEventListener("click",(e)=>genericAction(e,state.budget))
$("#tblInvest").addEventListener("click",(e)=>genericAction(e,state.investments))
$("#tblCrypto").addEventListener("click",(e)=>genericAction(e,state.crypto))
$("#tblAgenda").addEventListener("click",(e)=>genericAction(e,state.agenda))

$$('input[name="ctype"]').forEach(r=>{
  if(r.value===chartType) r.checked=true
  r.addEventListener("change",()=>{ chartType=r.value; setPref({chartType}); renderDashboard() })
})

$("#btnExport").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'})
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='kgb_finance.json'; a.click(); URL.revokeObjectURL(a.href)
})
$("#fileImport").addEventListener("change",async (e)=>{
  const f=e.target.files[0]; if(!f) return;
  try{ const data=JSON.parse(await f.text()); if(data && typeof data==="object"){ state=data; save(); alert("Geïmporteerd."); } }
  catch{ alert("Ongeldig JSON."); }
  e.target.value="";
})
$("#btnReset").addEventListener("click",()=>{ if(confirm("Alles wissen?")){ state={budget:[],investments:[],crypto:[],agenda:[]}; save(); }})
$("#btnClear").addEventListener("click",()=>{ renderDashboard() })
$("#btnDemo").addEventListener("click",()=>{
  if(!confirm("Demo-data toevoegen?")) return;
  state.budget=[{date:today(),cat:"Loon",desc:"",income:1000,expense:0},{date:today(),cat:"Huur",desc:"",income:0,expense:250},{date:today(),cat:"Boodschappen",desc:"",income:0,expense:120}];
  state.investments=[{date:today(),name:"ABC",qty:10,buy:10,sell:12,div:5},{date:today(),name:"XYZ",qty:5,buy:20,sell:18,div:0}];
  state.crypto=[{date:today(),token:"BTC",qty:0.01,buy:30000,sell:35000},{date:today(),token:"ETH",qty:0.2,buy:2000,sell:1800}];
  state.agenda=[{date:today(),task:"Belasting",status:"open",meet:"Afspraak 15:00"}];
  save();
})

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

$$(".tab").forEach(b=>b.addEventListener("click",()=>{
  $$(".tab").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  $$(".panel").forEach(p=>p.classList.remove("active")); $("#"+b.dataset.tab).classList.add("active");
}))

ensure(); refresh();
