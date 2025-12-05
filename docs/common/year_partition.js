(function(){
  if (window.__KGB_YEAR_PARTITION__) return; window.__KGB_YEAR_PARTITION__=1;
  var Y_MIN=2020, Y_NOW=new Date().getFullYear(), LS=localStorage, YEAR_KEY='kgb_year_sel';
  var year=parseInt(LS.getItem(YEAR_KEY)||String(Y_NOW),10); if(!year||year<Y_MIN||year>Y_NOW) year=Y_NOW;
  function shouldPartition(k){ return /^kgb_|^budget_|^full_/i.test(k); }
  function keyWithYear(base,y){ return base.replace(/_y\d{4}$/,'')+'_y'+y; }
  function currentKey(base){ return keyWithYear(base,year); }

  (function migrateOnce(){
    try{
      var FLAG='__kgb_year_migrated__'; if(LS.getItem(FLAG)) return;
      var seen=new Set();
      for(var i=0;i<LS.length;i++){
        var k=LS.key(i); if(!k||!shouldPartition(k)||/_y\d{4}$/.test(k)||seen.has(k)) continue;
        seen.add(k); var target=currentKey(k); if(LS.getItem(target)==null) LS.setItem(target, LS.getItem(k));
      }
      LS.setItem(FLAG,'1');
    }catch(_){}
  })();

  (function wrapLS(){
    var g=LS.getItem.bind(LS), s=LS.setItem.bind(LS), r=LS.removeItem.bind(LS);
    LS.getItem=function(k){ try{ if(shouldPartition(k)){ var v=g(currentKey(k)); return v==null?g(k):v; } }catch(_){ } return g(k); };
    LS.setItem=function(k,v){ try{ if(shouldPartition(k)) return s(currentKey(k),v); }catch(_){ } return s(k,v); };
    LS.removeItem=function(k){ try{ if(shouldPartition(k)) return r(currentKey(k)); }catch(_){ } return r(k); };
    window.KGB_YEAR={ get:()=>year, set:(y)=>setYear(y), storageKey:(base,y)=>keyWithYear(base,y||year) };
  })();

  function dispatchYear(){ try{ document.dispatchEvent(new CustomEvent('kgb:year-change',{detail:{year}})); }catch(_){ } }
  function setYear(y){ year=y; try{ LS.setItem(YEAR_KEY,String(y)); }catch(_){} var sel=document.getElementById('kgb-year-select'); if(sel) sel.value=String(y); dispatchYear(); }
  function norm(s){ return String(s||'').toLowerCase().replace(/\s+/g,'').replace(/[·|/\\]/g,'/'); }

  function buildInline(){
    var box=document.createElement('span');
    box.id='kgb-year-inline';
    box.style.cssText='display:inline-flex;align-items:center;gap:6px;margin-left:8px;padding:6px 10px;border-radius:999px;border:1px solid #9bb8ff;background:#eef3ff;color:#173a8b;font:14px/1 -apple-system,Segoe UI,Arial;';
    box.innerHTML='<span>Jaar</span>';
    var sel=document.createElement('select'); sel.id='kgb-year-select'; sel.style.cssText='border:0;background:transparent;font:inherit;color:inherit;outline:none;cursor:pointer';
    for(var y=2020;y<=Y_NOW;y++){ var o=document.createElement('option'); o.value=String(y); o.textContent=String(y); sel.appendChild(o); }
    sel.value=String(year);
    sel.onchange=function(){ var y=parseInt(sel.value,10); if(y&&y>=2020&&y<=Y_NOW) setYear(y); };
    box.appendChild(sel);
    return box;
  }
  function placeNearExport(){
    var nodes=document.querySelectorAll('a,button,span,div');
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i]; if(!el.isConnected) continue;
      var t=norm(el.textContent);
      if(t.includes('export') && t.includes('import')){ el.insertAdjacentElement('afterend', buildInline()); return true; }
    }
    return false;
  }
  function buildFallback(){
    var css=document.createElement('style'); css.textContent=
      '#kgb-year-box{position:fixed;right:12px;top:12px;z-index:2147483647;background:#0b132b;color:#e6fff2;border:1px solid #1bd97b;border-radius:12px;padding:8px 10px;font:12px/1 -apple-system,Segoe UI,Arial}' +
      '#kgb-year-box select{margin-left:6px;padding:6px 8px;border-radius:8px;border:1px solid #1bd97b;background:#0f5132;color:#e6fff2}';
    document.head.appendChild(css);
    var box=document.createElement('div'); box.id='kgb-year-box';
    box.innerHTML='Jaar <select id="kgb-year-select"></select>'; document.documentElement.appendChild(box);
    var sel=box.querySelector('select'); for(var y=2020;y<=Y_NOW;y++){ var o=document.createElement('option'); o.value=String(y); o.textContent=String(y); sel.appendChild(o); }
    sel.value=String(year); sel.onchange=function(){ var y=parseInt(sel.value,10); if(y&&y>=2020&&y<=Y_NOW) setYear(y); };
  }
  function ensurePlaced(){
    if(!placeNearExport()) buildFallback();
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', ensurePlaced, {once:true}); } else { ensurePlaced(); }
  var tries=0, mo=new MutationObserver(function(){ if(document.getElementById('kgb-year-inline')) return; if(placeNearExport()){ mo.disconnect(); } else if(++tries>20){ mo.disconnect(); } });
  mo.observe(document.body,{childList:true,subtree:true});
  dispatchYear();
})();
