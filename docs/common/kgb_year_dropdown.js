(function(){
  function yearsList(){
    try{
      const j = JSON.parse(localStorage.getItem('kgb_years_list')||'[]');
      if(Array.isArray(j) && j.length) return j;
    }catch{}
    const now=(new Date()).getFullYear();
    const years=[]; for(let y=2020;y<=now;y++) years.push(y);
    return years;
  }
  function getActiveYear(){
    const keys=['kgb_year','kgb_view_year','kgb_selected_year','kgb_active_year','kgb_finance_year','kgb_year_filter'];
    for(const k of keys){ const v=localStorage.getItem(k); if(v&&/^\d{4}$/.test(v)) return +v; }
    return (new Date()).getFullYear();
  }
  function setYear(y){
    const keys=['kgb_year','kgb_view_year','kgb_selected_year','kgb_active_year','kgb_finance_year','kgb_year_filter'];
    keys.forEach(k=>localStorage.setItem(k,String(y)));
    location.reload();
  }
  function mount(){
    if(document.getElementById('kgb-year-ctl')) return;
    const wrap=document.createElement('div');
    wrap.id='kgb-year-ctl';
    wrap.style.cssText='position:fixed;top:10px;left:10px;z-index:9996;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:6px 8px;box-shadow:0 6px 18px rgba(2,6,23,.12);display:flex;gap:6px;align-items:center';
    const lab=document.createElement('span'); lab.textContent='Jaar:'; lab.style.color='#334155'; lab.style.fontSize='12px';
    const sel=document.createElement('select'); sel.style.cssText='padding:6px;border:1px solid #e5e7eb;border-radius:8px';
    const yrs=yearsList(); const act=getActiveYear();
    yrs.forEach(y=>{ const o=document.createElement('option'); o.value=String(y); o.textContent=String(y); if(y===act) o.selected=true; sel.appendChild(o); });
    sel.onchange=()=>setYear(+sel.value);
    wrap.append(lab,sel); document.body.appendChild(wrap);
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', mount); } else { mount(); }
})();
