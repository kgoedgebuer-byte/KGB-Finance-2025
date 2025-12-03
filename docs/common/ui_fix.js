(function(){
  // --- helpers ---
  const $all = (sel,root=document) => Array.from(root.querySelectorAll(sel));
  const toast = (msg)=>{const t=document.createElement('div');t.className='kgb-toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2000);};

  // Vind container met de grote knoppen (Dashboard/Budget/…)
  function findButtonRow(){
    const candidates = $all('nav,.nav,.tabs,.pill-row,.buttons,.btn-row,header,main .row,section');
    for(const el of candidates){
      const txt=(el.textContent||'').toLowerCase();
      if(/dashboard|budget|belegging|crypto|agenda|familie|thema|export|import/.test(txt)) return el;
    }
    return null;
  }

  // Vind de jaar-select (heuristiek op opties die op jaar lijken)
  function findYearSelect(){
    const sels=$all('select');
    for(const s of sels){
      const vals=[...s.options].slice(0,6).map(o=>o.text.trim());
      if(vals.some(v=>/^\d{4}$/.test(v))) return s;
    }
    // fallback: element met tekst 'Jaar'
    const label=$all('label,span,strong,b').find(n=>/^\s*jaar/i.test(n.textContent||''));
    if(label){
      const near = label.closest('div')?.querySelector('select') || label.parentElement?.querySelector('select');
      if(near) return near;
    }
    return null;
  }

  function moveYearIntoButtons(){
    const sel = findYearSelect();
    const row = findButtonRow();
    if(!sel || !row) return false;

    // verwijder eventuele absolute/fixed styles
    sel.style.position='static'; sel.style.top=''; sel.style.left=''; sel.style.right=''; sel.style.bottom='';
    sel.style.zIndex=''; sel.style.boxShadow=''; sel.style.background='';

    // bouw chip
    const wrap=document.createElement('div'); wrap.className='kgb-year-wrap';
    const chip=document.createElement('div'); chip.className='kgb-year-chip';
    const lab=document.createElement('label'); lab.textContent='Jaar:';
    chip.append(lab, sel);
    wrap.append(chip);

    // plaats helemaal links in de rij
    row.insertBefore(wrap, row.firstChild);
    return true;
  }

  // --- PWA install ---
  function setupInstallButton(){
    let deferred;
    window.addEventListener('beforeinstallprompt', (e)=>{
      e.preventDefault(); deferred=e; addInstallButton();
    });

    function addInstallButton(){
      if(document.querySelector('.kgb-install-btn')) return;
      const row = findButtonRow(); if(!row) return;
      const btn=document.createElement('button');
      btn.className='kgb-install-btn'; btn.textContent='Installeer app';
      btn.onclick=async()=>{
        if(deferred){ deferred.prompt(); const _=await deferred.userChoice; }
        else if(/iphone|ipad|ipod/i.test(navigator.userAgent)){
          toast('iOS: Deelknop ▶︎ “Zet op beginscherm”');
        }else{
          toast('Gebruik browsermenu ▶︎ “Install app / Add to Home screen”');
        }
      };
      // plaats rechts in de rij
      row.appendChild(btn);
    }

    // iOS hint (geen event)
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)){
      setTimeout(()=>{ if(!document.querySelector('.kgb-install-btn')) addInstallButton(); }, 800);
    }
  }

  // run
  const init=()=>{ moveYearIntoButtons(); setupInstallButton(); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
