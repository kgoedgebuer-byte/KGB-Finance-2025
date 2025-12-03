(function(){
  // --- helpers ---
  function isYearSelect(sel){
    if(!sel || sel.tagName!=='SELECT') return false;
    const years = Array.from(sel.options).map(o=>o.textContent.trim()).filter(t=>/^\d{4}$/.test(t));
    return years.length >= 3;
  }
  function findYearSelect(){
    const sels = Array.from(document.querySelectorAll('select'));
    for(const s of sels){ if(isYearSelect(s)) return s; }
    return null;
  }
  function findNavRow(){
    const words=['Dashboard','Budget','Belegging','Crypto','Agenda','Familie','Thema','Export','Import','Drive'];
    const cands=[];
    document.querySelectorAll('nav,.nav,.tabs,.toolbar,.buttons,.controls,.menu,.chips,header,.top,.header')
      .forEach(el=>{
        const t=(el.textContent||'');
        let score=0; words.forEach(w=>{ if(t.indexOf(w)>-1) score++; });
        if(score>=2) cands.push({el,score});
      });
    if(cands.length) return cands.sort((a,b)=>b.score-a.score)[0].el;
    const exp = Array.from(document.querySelectorAll('*')).find(e=>(e.textContent||'').includes('Export'));
    return exp ? (exp.parentElement||document.body) : document.body;
  }
  function injectCSS(){
    if(document.getElementById('kgb-layout-css')) return;
    const s=document.createElement('style'); s.id='kgb-layout-css'; s.textContent=`
      .kgb-year-wrap{display:inline-flex;align-items:center;gap:.45rem;margin:.25rem .35rem .25rem 0;}
      .kgb-year-lbl{opacity:.8;font-weight:600}
      .kgb-year-select{
        -webkit-appearance:none;appearance:none;
        border:1px solid #cbd5e1;border-radius:999px;background:#fff;
        padding:.55rem 1.0rem;font-weight:600;box-shadow:0 2px 6px rgba(2,6,23,.06);cursor:pointer;
      }
      /* laat chips mooi doorlopen op mobiel */
      .kgb-year-wrap,.kgb-year-select{font-size:1rem;line-height:1;}
      @media (max-width:720px){ .kgb-year-wrap{margin-top:.35rem} }
    `;
    document.head.appendChild(s);
  }
  function moveYearIntoNav(){
    const sel=findYearSelect(); if(!sel) return;
    // stop dubbele uitvoering
    if(sel.classList.contains('kgb-year-select')) return;

    const nav=findNavRow();
    // bouw chip
    const wrap=document.createElement('span');
    wrap.className='kgb-year-wrap';
    const lbl=document.createElement('span');
    lbl.className='kgb-year-lbl';
    lbl.textContent='Jaar:';
    sel.classList.add('kgb-year-select');

    // verplaats echte select (betrouwbaar voor mobiel & desktop)
    // bewaar oude container om te verbergen als die leeg wordt
    const oldBox=sel.closest('div,section,fieldset,form')||sel.parentElement;
    wrap.appendChild(lbl);
    wrap.appendChild(sel);
    // Plaats helemaal vooraan in nav
    if(nav.firstChild) nav.insertBefore(wrap, nav.firstChild); else nav.appendChild(wrap);
    // verberg oude box als leeg
    if(oldBox && oldBox !== wrap && oldBox !== nav){
      setTimeout(()=>{ if(!oldBox.querySelector('select')) oldBox.style.display='none'; }, 0);
    }
  }
  function nukeStuckOverlays(){
    const sel=['.kgb-sync-back','.kgb-sync','.drive-backdrop','.drive-modal','.modal-backdrop','.modal','[data-drive-modal]'].join(',');
    document.querySelectorAll(sel).forEach(el=>{ if(el.id!=='kgb_reload_bar'){ try{el.remove();}catch(_){}} });
  }

  window.addEventListener('load', function(){
    injectCSS();
    setTimeout(moveYearIntoNav, 150);
    setTimeout(nukeStuckOverlays, 250);
  });
})();
