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
