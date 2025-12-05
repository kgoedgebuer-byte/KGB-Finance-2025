/* Web-build: Drive uitgeschakeld (geen Google OAuth/picker op GH Pages) */
(function(){
  if (window.__KGB_DRIVE_OFF__) return; window.__KGB_DRIVE_OFF__ = true;

  // Zachte stubs zodat app.js geen errors gooit
  const noop = ()=>{};
  window.kgbDriveAvailable = false;
  window.gapi   = window.gapi   || { load: noop, auth2: { init: ()=>Promise.reject(new Error('drive_disabled')) } };
  window.google = window.google || { picker: { PickerBuilder: function(){ return {
      setOAuthToken: noop, setDeveloperKey: noop, setAppId: noop, setCallback: noop, addView: noop,
      build: function(){ return { setVisible: noop }; }
  };}}};

  // Eventueel door de app verwachte helpers neutraliseren
  ['driveInit','driveOpen','driveSave','driveSync','initDrive','openDrive'].forEach(fn=>{
    if (!window[fn]) window[fn] = ()=>{ throw new Error('Drive is uitgeschakeld in web-build'); };
  });

  function disableDriveButtons(root){
    try{
      const candidates = Array.from(root.querySelectorAll('a,button,li,nav *')).filter(el=>{
        const t = (el.textContent||'').trim().toLowerCase();
        return /drive/.test(t);
      });
      candidates.forEach(el=>{
        el.setAttribute('aria-disabled','true');
        el.style.pointerEvents='none';
        el.style.opacity='0.5';
        if (!/drive\s*\(uit\)/i.test(el.textContent||'')) {
          el.textContent = (el.textContent||'').replace(/drive/i,'Drive (uit)');
        }
        el.title = 'Drive is uitgeschakeld in de webversie';
      });
    }catch(_){}
  }

  function toast(msg){
    try{
      const n = document.createElement('div');
      n.style.cssText='position:fixed;right:12px;bottom:12px;z-index:2147483647;background:#0b132b;color:#e6fff2;border:1px solid #1bd97b;padding:8px 10px;border-radius:10px;font:12px -apple-system,Segoe UI,Arial';
      n.textContent = msg;
      document.body.appendChild(n);
      setTimeout(()=>{ try{ n.remove(); }catch(_){}} , 3000);
    }catch(_){}
  }

  function run(){
    disableDriveButtons(document);
    // Shadow roots
    try{ document.querySelectorAll('*').forEach(el=>{ if (el.shadowRoot) disableDriveButtons(el.shadowRoot); }); }catch(_){}
    toast('Drive is uitgeschakeld (web-build)');
  }

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', run, {once:true});
  } else { run(); }
})();
