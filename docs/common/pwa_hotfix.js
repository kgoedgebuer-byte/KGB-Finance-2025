(function(){
  function nukeStuckOverlays(){
    // verwijder mogelijke full-screen blockers uit oudere versies
    const sel = [
      '.kgb-sync-back','.kgb-sync',
      '.drive-backdrop','.drive-modal',
      '.modal-backdrop','.modal','[data-drive-modal]'
    ].join(',');
    document.querySelectorAll(sel).forEach(el=>{
      // laat reload-bar ongemoeid
      if (el.id === 'kgb_reload_bar') return;
      try{ el.remove(); }catch(_){}
    });
  }
  function closeOnBackdrop(){
    document.body.addEventListener('click', (e)=>{
      const t=e.target;
      if(!t) return;
      if(t.classList && (t.classList.contains('kgb-sync-back') || t.classList.contains('drive-backdrop'))){
        try{ t.remove(); }catch(_){}
      }
    });
    document.addEventListener('keydown', (e)=>{
      if(e.key==='Escape') nukeStuckOverlays();
    });
  }
  function hideInstallInPWA(){
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if(isPWA){
      document.querySelectorAll('#install_app_btn,.install-app,.pwa-install-hint').forEach(n=>{ try{ n.remove(); }catch(_){} });
    }
  }
  window.addEventListener('load', ()=>{
    setTimeout(nukeStuckOverlays, 250);
    closeOnBackdrop();
    hideInstallInPWA();
  });
})();
