/* KGB_COMPAT_ACTIVEYEAR */
(function () {
  // Sommige builds verwachten een globale activeYear
  if (typeof window.activeYear === "undefined" || window.activeYear === null) {
    window.activeYear = (new Date()).getFullYear();
  }
  // En soms bestaat yearOf ook niet (extra zekerheid)
  if (typeof window.yearOf !== "function") {
    window.yearOf = function (dateLike) {
      try {
        const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
        const y = d.getFullYear();
        return Number.isFinite(y) ? y : (new Date()).getFullYear();
      } catch (e) {
        return (new Date()).getFullYear();
      }
    };
  }
})();

/* KGB_COMPAT_YEAROF */
(function () {
  // Zorg dat Full niet crasht als yearOf ontbreekt
  if (typeof window.yearOf !== "function") {
    window.yearOf = function (dateLike) {
      try {
        const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
        const y = d.getFullYear();
        return Number.isFinite(y) ? y : (new Date()).getFullYear();
      } catch (e) {
        return (new Date()).getFullYear();
      }
    };
  }
})();

const KEY="kgb_finance_data_v1";
const THEME="kgb_finance_theme_v1";
const PREF="kgb_finance_pref_v1";

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));

const pastel=["#A0C4FF","#BDB2FF","#FFC6FF","#9BF6FF","#FDFFB6","#CAFFBF","#FFADAD","#FFD6A5","#E4C1F9","#CDEAC0","#B9FBC0","#FFD5C2","#F7DAD9","#E2ECE9","#E6CBA8","#E4C6A1","#E8AEB7","#A0CED9","#E8D7FF","#A3D5D3","#D9E8E3","#FFF3B0","#FFCFD2","#F1E3FF","#C8E7FF","#E3F8FF","#FFEEE8","#FFE3E3","#E5FFFB","#F6E6FF","#F9D8D6","#D7F9F1","#F8E8C6","#FBE7E1","#E0F7FA","#E8F5E9","#FFEBEE","#FFFDE7","#EDE7F6","#E3F2FD","#FCE4EC","#F3E5F5","#FFECB3","#D1C4E9","#BBDEFB","#C8E6C9","#F0F4C3","#DCEDC8"];

let state=load();
let chart, chartType=(JSON.parse(localStorage.getItem(PREF)||"{}").chartType)||"line";

function load(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(_){return {}}}
function ensure(){ state.budget??=[]; state.investments??=[]; state.crypto??=[]; state.agenda??=[] }
function save(){localStorage.setItem(KEY,JSON.stringify(state)); refresh()}
function fmt(n){return (n??0).toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2})}
function num(x){if(x===undefined||x===null||x==="")return 0; const s=(x+"").replace(",","."); const n=+s; return isNaN(n)?0:n}
function today(){return new Date().toISOString().slice(0,10)}
function setPref(obj){localStorage.setItem(PREF,JSON.stringify({...(JSON.parse(localStorage.getItem(PREF)||"{}")),...obj}))}

function totals(){
  ensure();
  let inc=0, exp=0, inv=0, cr=0;
  state.budget.forEach(r=>{inc+=num(r.income); exp+=num(r.expense)});
  state.investments.forEach(r=>{inv+=num(r.profit)-num(r.loss)});
  state.crypto.forEach(r=>{cr+=num(r.profit)-num(r.loss)});
  return {income:inc, expense:exp, invest:inv, crypto:cr, saldo:inc-exp}
}

function renderDashboard(){
  const {income, expense, invest, crypto, saldo}=totals();

  const elIncome=$("#totIncome"); if(elIncome) elIncome.textContent=fmt(income);
  const elExpense=$("#totExpense"); if(elExpense) elExpense.textContent=fmt(expense);
  const elInvest=$("#totInvest"); if(elInvest) elInvest.textContent=fmt(invest);
  const elCrypto=$("#totCrypto"); if(elCrypto) elCrypto.textContent=fmt(crypto);
  const elSaldo=$("#totSaldo"); if(elSaldo) elSaldo.textContent=fmt(saldo);

  const canvas=$("#saldoChart");
  if(!canvas || !window.Chart) return;

  const ctx=canvas.getContext("2d");
  if(chart) chart.destroy();

  if(chartType==="pie"){
    chart=new Chart(ctx,{
      type:"pie",
      data:{labels:["Inkomen","Uitgave"],datasets:[{data:[income,expense]}]},
      options:{plugins:{legend:{position:"bottom"}}}
    });
  }else{
    const labels=[], data=[]; let run=0;
    state.budget.slice().sort((a,b)=> (a.date||"") < (b.date||"") ? -1:1 )
      .forEach(r=>{
        run+=num(r.income)-num(r.expense);
        labels.push(r.date||"");
        data.push(+run.toFixed(2));
      });
    chart=new Chart(ctx,{
      type:(chartType==="bar"?"bar":"line"),
      data:{labels,datasets:[{label:"Saldo",data,tension:.25}]},
      options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
    });
  }
}

function tr(...cells){const tr=document.createElement("tr"); tr.innerHTML=cells.join(""); return tr}
function actionBtns(i){
  return `<td class="actions">
    <button data-a="up" data-i="${i}">⬆️</button>
    <button data-a="down" data-i="${i}">⬇️</button>
    <button data-a="del" data-i="${i}">🗑️</button>
  </td>`;
}

function renderBudget(){
  const tbl=$("#tblBudget"); if(!tbl) return;
  const tb=$("#tblBudget tbody"); if(!tb) return;
  tb.innerHTML="";
  let running=0;
  state.budget.forEach((r,i)=>{
    running+=num(r.income)-num(r.expense);
    tb.appendChild(tr(
      `<td><input type="date" value="${r.date||""}" data-k="date" data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.cat||""}"  data-k="cat"  data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.desc||""}" data-k="desc" data-i="${i}"></td>`,
      `<td><input type="number" step="0.01" value="${r.income??""}" data-k="income" data-i="${i}"></td>`,
      `<td><input type="number" step="0.01" value="${r.expense??""}" data-k="expense" data-i="${i}"></td>`,
      `<td>${fmt(running)}</td>`,
      actionBtns(i)
    ));
  });
}


function renderInvest(){
  const tb = document.querySelector('#tblInvest tbody');
  if(!tb) return;
  tb.innerHTML = '';
  state.investments
    .filter(r => yearOf(r.date) === activeYear)
    .forEach((r,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="date" value="${r.date||''}" data-k="date" data-i="${i}"></td>
        <td><input type="text" value="${r.name||''}" data-k="name" data-i="${i}"></td>
        <td><input type="number" step="0.0001" value="${r.qty||''}" data-k="qty" data-i="${i}"></td>
        <td><input type="number" step="0.01" value="${r.buy||''}" data-k="buy" data-i="${i}"></td>
        <td><input type="number" step="0.01" value="${r.sell||''}" data-k="sell" data-i="${i}"></td>
        <td><input type="number" step="0.01" value="${r.div||''}" data-k="div" data-i="${i}"></td>
        <td>${fmt(r.profit||0)}</td>
        <td>${fmt(r.loss||0)}</td>
        ${actionBtns(i)}
      `;
      tb.appendChild(tr);
    });
}



function renderCrypto(){
  const tb = document.querySelector('#tblCrypto tbody');
  if(!tb) return;
  tb.innerHTML = '';
  state.crypto
    .filter(r => yearOf(r.date) === activeYear)
    .forEach((r,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="date" value="${r.date||''}" data-k="date" data-i="${i}"></td>
        <td><input type="text" value="${r.token||''}" data-k="token" data-i="${i}"></td>
        <td><input type="number" step="0.0001" value="${r.qty||''}" data-k="qty" data-i="${i}"></td>
        <td><input type="number" step="0.01" value="${r.buy||''}" data-k="buy" data-i="${i}"></td>
        <td><input type="number" step="0.01" value="${r.sell||''}" data-k="sell" data-i="${i}"></td>
        <td>${fmt(r.profit||0)}</td>
        <td>${fmt(r.loss||0)}</td>
        ${actionBtns(i)}
      `;
      tb.appendChild(tr);
    });
}


function renderAgenda(){
  const tbl=$("#tblAgenda"); if(!tbl) return;
  const tb=$("#tblAgenda tbody"); if(!tb) return;
  tb.innerHTML="";
  state.agenda.forEach((r,i)=>{
    tb.appendChild(tr(
      `<td><input type="date" value="${r.date||""}" data-k="date" data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.task||""}" data-k="task" data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.status||""}" data-k="status" data-i="${i}"></td>`,
      `<td><input type="text"  value="${r.meet||""}" data-k="meet" data-i="${i}"></td>`,
      actionBtns(i)
    ));
  });
}

function recalcInvest(){
  state.investments.forEach(r=>{
    const total=(num(r.sell)-num(r.buy))*num(r.qty)+num(r.div);
    if(total>=0){ r.profit=+total.toFixed(2); r.loss=0 }
    else{ r.profit=0; r.loss=+(-total).toFixed(2) }
  });
}
function recalcCrypto(){
  state.crypto.forEach(r=>{
    const total=(num(r.sell)-num(r.buy))*num(r.qty);
    if(total>=0){ r.profit=+total.toFixed(2); r.loss=0 }
    else{ r.profit=0; r.loss=+(-total).toFixed(2) }
  });
}

function refresh(){
  ensure();
  recalcInvest(); recalcCrypto();
  renderDashboard();
  renderBudget();
  renderInvest();
  renderCrypto();
  renderAgenda();
}

// --- init default dates (alleen als inputs bestaan) ---
const bd=$("#b_date"); if(bd) bd.value=today();
const id=$("#i_date"); if(id) id.value=today();
const cd=$("#c_date"); if(cd) cd.value=today();
const ad=$("#a_date"); if(ad) ad.value=today();

// --- forms (alleen als form bestaat) ---
const formBudget=$("#addBudget");
if(formBudget) formBudget.addEventListener("submit",e=>{
  e.preventDefault();
  state.budget.push({
    date:$("#b_date")?.value || today(),
    cat:($("#b_cat")?.value || "").trim(),
    desc:($("#b_desc")?.value || "").trim(),
    income:num($("#b_inc")?.value),
    expense:num($("#b_exp")?.value),
  });
  e.target.reset();
  if($("#b_date")) $("#b_date").value=today();
  save();
});

const formInvest=$("#addInvest");
if(formInvest) formInvest.addEventListener("submit",e=>{
  e.preventDefault();
  state.investments.push({
    date:$("#i_date")?.value || today(),
    name:($("#i_name")?.value || "").trim(),
    qty:num($("#i_qty")?.value),
    buy:num($("#i_buy")?.value),
    sell:num($("#i_sell")?.value),
    div:num($("#i_div")?.value),
  });
  e.target.reset();
  if($("#i_date")) $("#i_date").value=today();
  save();
});

const formCrypto=$("#addCrypto");
if(formCrypto) formCrypto.addEventListener("submit",e=>{
  e.preventDefault();
  state.crypto.push({
    date:$("#c_date")?.value || today(),
    token:($("#c_token")?.value || "").trim(),
    qty:num($("#c_qty")?.value),
    buy:num($("#c_buy")?.value),
    sell:num($("#c_sell")?.value),
  });
  e.target.reset();
  if($("#c_date")) $("#c_date").value=today();
  save();
});

const formAgenda=$("#addAgenda");
if(formAgenda) formAgenda.addEventListener("submit",e=>{
  e.preventDefault();
  state.agenda.push({
    date:$("#a_date")?.value || today(),
    task:($("#a_task")?.value || "").trim(),
    status:($("#a_status")?.value || "").trim(),
    meet:($("#a_meet")?.value || "").trim(),
  });
  e.target.reset();
  if($("#a_date")) $("#a_date").value=today();
  save();
});

// --- tables edit/action (alleen als table bestaat) ---
function genericEdit(e, list){
  const t=e.target; if(t.tagName!=="INPUT") return;
  const i=+t.dataset.i, k=t.dataset.k; if(!Number.isInteger(i)||!k) return;
  const isNum=["income","expense","qty","buy","sell","div"].includes(k);
  list[i][k]=isNum?num(t.value):t.value;
  save();
}
function genericAction(e,list){
  const b=e.target.closest("button"); if(!b) return;
  const i=+b.dataset.i, a=b.dataset.a;
  if(a==="del"){ list.splice(i,1); save(); }
  if(a==="up" && i>0){ [list[i-1],list[i]]=[list[i],list[i-1]]; save(); }
  if(a==="down" && i<list.length-1){ [list[i+1],list[i]]=[list[i],list[i+1]]; save(); }
}

const tBudget=$("#tblBudget");
if(tBudget){
  tBudget.addEventListener("input",(e)=>genericEdit(e,state.budget));
  tBudget.addEventListener("click",(e)=>genericAction(e,state.budget));
}
const tInvest=$("#tblInvest");
if(tInvest){
  tInvest.addEventListener("input",(e)=>genericEdit(e,state.investments));
  tInvest.addEventListener("click",(e)=>genericAction(e,state.investments));
}
const tCrypto=$("#tblCrypto");
if(tCrypto){
  tCrypto.addEventListener("input",(e)=>genericEdit(e,state.crypto));
  tCrypto.addEventListener("click",(e)=>genericAction(e,state.crypto));
}
const tAgenda=$("#tblAgenda");
if(tAgenda){
  tAgenda.addEventListener("input",(e)=>genericEdit(e,state.agenda));
  tAgenda.addEventListener("click",(e)=>genericAction(e,state.agenda));
}

// --- chart type radios (als ze bestaan) ---
$$('input[name="ctype"]').forEach(r=>{
  if(r.value===chartType) r.checked=true;
  r.addEventListener("change",()=>{
    chartType=r.value;
    setPref({chartType});
    renderDashboard();
  });
});

// --- GEEN demo/refresh/export/import/reset binding (knoppen zijn weg in budget-v2) ---
// (dus ook geen crash)

// --- THEMA (alleen als thema UI bestaat) ---
function colToRgb(hex){
  hex=(hex||"").replace('#','');
  if(hex.length===3) hex=hex.split('').map(x=>x+x).join('');
  const n=parseInt(hex||"000000",16);
  return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}
}
function adjust(hex,f){
  const {r,g,b}=colToRgb(hex);
  const adj=(v)=>Math.max(0,Math.min(255, Math.round(v*(f/100))));
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}
function applyTheme(t){
  document.documentElement.style.setProperty('--bg',adjust(t.bg,t.intensity));
  document.documentElement.style.setProperty('--card',adjust(t.card,t.intensity));
  document.documentElement.style.setProperty('--acc',adjust(t.acc,t.intensity));
  document.documentElement.style.setProperty('--txt',t.txt);
  document.documentElement.style.setProperty('--grid',adjust(t.grid,t.gridIntensity));
}
const defaultTheme={bg:"#f5f7ff",card:"#ffffff",acc:"#7c9cf5",txt:"#0f172a",grid:"#e2e8f0",intensity:100,gridIntensity:100};
let theme=JSON.parse(localStorage.getItem(THEME)||"null")||defaultTheme;
applyTheme(theme);

function buildSwatches(){
  const box=$("#swatches"); if(!box) return;
  box.innerHTML="";
  pastel.forEach(c=>{
    const b=document.createElement("button");
    b.style.background=c;
    b.title=c;
    b.addEventListener("click",()=>{
      const tgt=$("#themeTarget"); if(!tgt) return;
      const t=tgt.value;
      theme[t==="bg"?"bg":t==="card"?"card":t==="acc"?"acc":t==="grid"?"grid":"txt"]=c;
      applyTheme(theme);
    });
    box.appendChild(b);
  });
  const intens=$("#intensity"); if(intens) intens.value=theme.intensity;
  const gridI=$("#gridIntensity"); if(gridI) gridI.value=theme.gridIntensity;
}

const intensity=$("#intensity");
if(intensity) intensity.addEventListener("input",e=>{ theme.intensity=+e.target.value; applyTheme(theme); });

const gridIntensity=$("#gridIntensity");
if(gridIntensity) gridIntensity.addEventListener("input",e=>{ theme.gridIntensity=+e.target.value; applyTheme(theme); });

const themeReset=$("#themeReset");
if(themeReset) themeReset.addEventListener("click",()=>{ theme={...defaultTheme}; applyTheme(theme); buildSwatches(); });

const themeSave=$("#themeSave");
if(themeSave) themeSave.addEventListener("click",()=>{ localStorage.setItem(THEME,JSON.stringify(theme)); alert("Thema opgeslagen."); });

buildSwatches();

// --- tabs (dit is wat je nodig hebt) ---
$$(".tab").forEach(b=>b.addEventListener("click",()=>{
  $$(".tab").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");

  $$(".panel").forEach(p=>p.classList.remove("active"));
  const panel=$("#"+b.dataset.tab);
  if(panel) panel.classList.add("active");
}));

ensure();
refresh();
