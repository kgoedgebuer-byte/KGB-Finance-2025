(() => {
  const YEARS_FROM = 2020;
  const YEARS_TO   = 2050;

  function pickSelect(){
    return document.querySelector('#yearSelect, #year, select[name="year"], select[data-year]')
        || document.querySelector('select'); // fallback (laatste redmiddel)
  }

  function getStored(){
    const keys = ['kgb_year','activeYear','kgb_finance_year'];
    for(const k of keys){
      const v = localStorage.getItem(k);
      if(v && /^\d{4}$/.test(v)) return +v;
    }
    return null;
  }

  function storeYear(y){
    localStorage.setItem('kgb_year', String(y));
    localStorage.setItem('activeYear', String(y));
    localStorage.setItem('kgb_finance_year', String(y));
  }

  function applyYear(y){
    window.activeYear = y;
    if(typeof window.refresh === 'function') window.refresh();
    window.dispatchEvent(new CustomEvent('kgb:year', { detail: { year: y }}));
  }

  function build(){
    const sel = pickSelect();
    if(!sel) return;

    const current = getStored() || (new Date()).getFullYear();
    sel.innerHTML = '';
    for(let y = YEARS_FROM; y <= YEARS_TO; y++){
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      if(y === current) opt.selected = true;
      sel.appendChild(opt);
    }

    storeYear(+sel.value);
    applyYear(+sel.value);

    sel.addEventListener('change', () => {
      const y = +sel.value;
      storeYear(y);
      applyYear(y);
    });
  }

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
