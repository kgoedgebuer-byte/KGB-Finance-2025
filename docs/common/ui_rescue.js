(function(){
  // ---------- helpers ----------
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  function once(id, fn){ if(document.getElementById(id)) return; fn(); }
  function chip(txt, id){
    const b=document.createElement('button');
    b.className='kgb-chip'; b.id=id; b.type='button'; b.textContent=txt;
    return b;
  }
  function injectCSS(){
    once('kgb-ui-rescue-css', ()=>{
      const s=document.createElement('style'); s.id='kgb-ui-rescue-css';
      s.textContent = `
        .kgb-chip{display:inline-flex;align-items:center;gap:.35rem;margin:.25rem .35rem .25rem 0;
          padding:.55rem 1rem;border:1px solid #cbd5e1;border-radius:999px;background:#fff;
          font-weight:600;box-shadow:0 2px 6px rgba(2,6,23,.06);cursor:pointer}
        .kgb-year-wrap{display:inline-flex;align-items:center;gap:.45rem;margin:.25rem .35rem .25rem 0;}
        .kgb-year-lbl{opacity:.8;font-weight:600}
        .kgb-year-select{-webkit-appearance:none;appearance:none;border:1px solid #cbd5e1;border-radius:999px;background:#fff;
          padding:.55rem 1rem;font-weight:600;box-shadow:0 2px 6px rgba(2,6,23,.06);cursor:pointer}
        /* zorg dat top/banners/headers geen clicks blokkeren */
        .kgb-no-block{pointer-events:none}
        .kgb-no-block *{pointer-events:auto}
      `;
      document.head.appendChild(s);
    });
  }

  // ---------- verplaats Jaar-select ----------
  function isYearSelect(sel){
    if(!sel || sel.tagName!=='SELECT') return false;
    const years = Array.from(sel.options).map(o=>o.textContent.trim()).filter(t=>/^\d{4}$/.test(t));
    return years.length >= 3;
  }
  function findYearSelect(){ return $$('select').find(isYearSelect) || null; }
  function findNavRow(){
    const labels=['Dashboard','Budget','Belegging','Crypto','Agenda','Familie','Thema','Export','Import','Drive'];
    const cands=[];
    $$('nav,.nav,.tabs,.toolbar,.buttons,.controls,.chips,header,.top,.header,.btns,.menu').forEach(el=>{
      const t=(el.textContent||'');
      const score = labels.reduce((a,w)=>a+(t.indexOf(w)>-1?1:0),0);
      if(score>=2) cands.push({el,score});
    });
    if(cands.length) return cands.sort((a,b)=>b.score-a.score)[0].el;
    const exp = $$('*').find(e=>(e.textContent||'').includes('Export'));
    return exp? (exp.parentElement||document.body) : document.body;
  }
  function moveYear(){
    const sel=findYearSelect(); if(!sel) return;
    if(sel.classList.contains('kgb-year-select')) return; // al verplaatst
    const nav=findNavRow();

    // chip-wikkel
    const wrap=document.createElement('span'); wrap.className='kgb-year-wrap';
    const lbl=document.createElement('span'); lbl.className='kgb-year-lbl'; lbl.textContent='Jaar:';
    sel.classList.add('kgb-year-select');

    wrap.append(lbl, sel);
    if(nav.firstChild) nav.insertBefore(wrap, nav.firstChild); else nav.appendChild(wrap);

    // eventuele vaste topbalk die kliks slorpt → klik niet blokkeren
    const topBars = $$('header,[class*="top"],[class*="header"],[class*="appbar"]');
    topBars.forEach(b=> b.classList.add('kgb-no-block'));
  }

  // ---------- kill overlays & unblock clicks ----------
  function killOverlays(){
    const sels = [
      '.kgb-sync-back','.kgb-sync','#kgb_reload_bar + .kgb-sync', // eigen
      '.drive-backdrop','.drive-modal','[data-drive-modal]',
      '.modal-backdrop','.modal[role="dialog"]','.backdrop','.overlay','.sheet'
    ].join(',');
    $$(sels).forEach(el=>{ try{ el.remove(); }catch(_){ } });
    // globale unblock
    document.body.style.pointerEvents='auto';
    $$('header,[class*="top"],[class*="header"],[class*="appbar"]').forEach(b=> b.classList.add('kgb-no-block'));
  }

  // ---------- Installeren (PWA) knop ----------
  function setupInstall(){
    let deferred=null;
    const nav=findNavRow();
    const btn = chip('Installeren', 'kgb-install-btn'); btn.style.display='none';
    nav.appendChild(btn);
    window.addEventListener('beforeinstallprompt', (e)=>{
      e.preventDefault(); deferred=e; btn.style.display='inline-flex';
    });
    btn.addEventListener('click', async ()=>{
      if(!deferred){
        // iOS Safari → instructie
        const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if(isIOS) alert('iOS: Tik op Deelknop ▸ Zet op beginscherm.');
        return;
      }
      deferred.prompt();
      await deferred.userChoice; deferred=null; btn.style.display='none';
    });
  }

  // ---------- Herstelknop ----------
  function setupRescueBtn(){
    const nav=findNavRow();
    const b=chip('🛠 Herstel', 'kgb-fix-btn');
    b.title='Herstel klikproblemen (overlays sluiten)';
    b.addEventListener('click', ()=>killOverlays());
    nav.appendChild(b);
  }

  // ---------- init ----------
  window.addEventListener('load', ()=>{
    injectCSS();
    setTimeout(moveYear, 150);
    setTimeout(killOverlays, 250);
    setupInstall();
    setupRescueBtn();
    // extra failsafe: probeer een paar keer
    let tries=0; const t=setInterval(()=>{ killOverlays(); if(++tries>5) clearInterval(t); }, 800);
  });
})();
