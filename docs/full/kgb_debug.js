(function(){
  if (window.__KGB_DEBUG_JS__) return; window.__KGB_DEBUG_JS__ = true;

  function ensureBox(){
    var box = document.getElementById('kgb-debug-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'kgb-debug-box';
      box.style.cssText = 'position:fixed;top:10px;left:10px;z-index:2147483647;max-width:85vw;max-height:50vh;overflow:auto;padding:10px 12px;border-radius:10px;border:2px solid #900;background:#ffeaea;color:#300;font:14px/1.35 -apple-system,Segoe UI,Arial,sans-serif;white-space:pre-wrap;box-shadow:0 8px 30px rgba(0,0,0,.35)';
      document.addEventListener('DOMContentLoaded', function(){ if(!document.body.contains(box)) document.body.appendChild(box); });
      (document.body ? document.body : document.documentElement).appendChild(box);
    }
    return box;
  }

  function show(msg){
    try{
      var box = ensureBox();
      var t = '[' + new Date().toLocaleTimeString() + '] ' + String(msg);
      box.textContent = t + '\n' + (box.textContent || '');
    }catch(e){}
  }

  window.addEventListener('error', function(e){
    var where = (e.filename||'') + (e.lineno?(':'+e.lineno):'');
    show('ERROR: ' + (e.message||'') + (where?(' @ '+where):''));
  });

  window.addEventListener('unhandledrejection', function(e){
    var r = e.reason;
    var msg = r && (r.stack || r.message) ? (r.stack || r.message) : String(r);
    show('PROMISE: ' + msg);
  });

  // Log dat de debug-loader werkt
  show('KGB Debug actief — script geladen.');
})();
