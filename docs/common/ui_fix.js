(function(){
  const $all=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const toast=(m)=>{const t=document.createElement('div');t.className='kgb-toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2200);};

  function findButtonRow(){
    // Zoek container met de hoofdknoppen
    const cands=$all('nav,.nav,.tabs,.pill-row,.buttons,.btn-row,.chip-row,header,main section,main .row');
    for(const el of cands){
      const txt=(el.textContent||'').toLowerCase();
      if(/dashboard|budget|belegging|crypto|agenda|familie|thema|export|import/.test(txt)) return el;
    }
    return null;
  }

  function findYearBlock(){
    // 1) Select met jaartallen
    for(const sel of $all('select')){
      const vals=[...sel.options].slice(0,10).map(o=>o.text.trim());
      if(vals.filter(v=>/^\d{4}$/.test(v)).length>=3){
        // neem wrapper als die een label 'Jaar' bevat, anders de select zelf
        let wrap=sel.closest('div');
        const label=wrap?.querySelector('label,span,strong,b');
        if(!(label&&/^\s*jaar[:\s]?$/i.test((label.textContent||'').trim()))){
          // bouw chip wrapper
          const chip=document.createElement('div'); chip.className='kgb-year-chip';
          const lab=document.createElement('label'); lab.textContent='Jaar:';
          chip.append(lab, sel);
          return chip;
        }else{
          // gebruik bestaande wrapper maar maak hem 'chip'
          wrap.classList.add('kgb-year-chip');
          return wrap;
        }
      }
    }
    // 2) fallback: element dat 'Jaar' toont met select in buurt
    const lab=$all('label,span,strong,b').find(n=>/^\s*jaar/i.test(n.textContent||''));
    if(lab){
      const sel=lab.parentElement?.querySelector('select')||lab.closest('div')?.querySelector('select');
      if(sel){
        const chip=document.createElement('div'); chip.className='kgb-year-chip';
        const lab2=document.createElement('label'); lab2.textContent='Jaar:';
        chip.append(lab2, sel);
        return chip;
      }
    }
    return null;
  }

  function stripFixedStyles(el){
    const s=el.style; ['position','top','left','right','bottom','zIndex','boxShadow','background'].forEach(k=>s[k]='');
  }

  function placeYear(){
    const row=findButtonRow();
    const block=findYearBlock();
    if(!row||!block) return false;

    // Als block net gemaakt is (nog niet in DOM), prima. Als het al in DOM zit: eerst styles neutraliseren en losmaken.
    stripFixedStyles(block);
    try{ block.parentElement && block.parentElement.removeChild(block); }catch(_){}
    row.insertBefore(block, row.firstChild);
    return true;
  }

  // PWA install knop
  function setupInstall(){
    let deferred;
    const addBtn=()=>{
      if(document.querySelector('.kgb-install-btn')) return;
      const row=findButtonRow(); if(!row) return;
      const btn=document.createElement('button'); btn.className='kgb-install-btn'; btn.textContent='Installeer app';
      btn.onclick=async()=>{
        if(deferred){ deferred.prompt(); try{ await deferred.userChoice; }catch(_){ } }
        else if(/iphone|ipad|ipod/i.test(navigator.userAgent)){ toast('iOS: Deelknop ▶︎ “Zet op beginscherm”'); }
        else{ toast('Browsermenu ▶︎ “Install app / Add to Home screen”'); }
      };
      row.appendChild(btn);
    };
    window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferred=e; addBtn(); });
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)){ setTimeout(addBtn, 800); }
  }

  function init(){
    // probeer meteen
    placeYear();
    setupInstall();
    // probeer nog een paar keer na initialisatie (SPA)
    let tries=0; const iv=setInterval(()=>{ if(placeYear()||++tries>20) clearInterval(iv); }, 250);
    // observeer mutaties (route/DOM updates)
    const mo=new MutationObserver(()=>placeYear());
    mo.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
