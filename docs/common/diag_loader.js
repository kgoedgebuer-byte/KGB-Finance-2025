(()=>{try{
  if (window.__KGB_DIAG_LOADER__) return; window.__KGB_DIAG_LOADER__=1;

  const ASSETS = [
    // CSS eerst (meest verdacht vaak ui_fix.css)
    {type:'css', path:'../common/sync_embed.css'},
    {type:'css', path:'../common/ui_fix.css'},
    // JS daarna
    {type:'js',  path:'../common/sync_embed.js'},
    {type:'js',  path:'../common/kgb_year_dropdown.js'},
    {type:'js',  path:'../common/drive_autopull.js'},
    {type:'js',  path:'../common/ui_fix.js'},
    {type:'js',  path:'../common/pwa_hotfix.js'},
    {type:'js',  path:'../common/layout_fix.js'},
    {type:'js',  path:'../common/ui_rescue.js'}
  ];

  const box = document.createElement('div');
  box.id = 'kgb-diag-loader';
  Object.assign(box.style, {
    position:'fixed', right:'10px', bottom:'10px', zIndex:'2147483647',
    background:'#111', color:'#0f0', border:'1px solid #0f0',
    borderRadius:'12px', padding:'10px', font:'12px/1.35 -apple-system,Segoe UI,Arial,sans-serif',
    maxWidth:'320px', maxHeight:'50vh', overflow:'auto', boxShadow:'0 8px 26px rgba(0,0,0,.35)'
  });
  box.innerHTML = `<b>Extra’s testen</b>
    <div style="margin:6px 0 8px;color:#9f9">Vink aan en klik “Laad geselecteerde”. Refresh = herstel.</div>
    <div id="kgb-list"></div>
    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
      <button id="kgb-load" style="padding:6px 8px;border-radius:8px;border:1px solid #0f0;background:#000;color:#0f0;cursor:pointer">Laad geselecteerde</button>
      <button id="kgb-hide" style="padding:6px 8px;border-radius:8px;border:1px solid #0f0;background:#000;color:#0f0;cursor:pointer">Paneel verbergen</button>
    </div>
    <div id="kgb-log" style="margin-top:8px;white-space:pre-wrap"></div>`;
  document.body.appendChild(box);

  const L = (m)=>{ const log = document.getElementById('kgb-log'); log.textContent = m+'\n'+log.textContent; };
  const list = document.getElementById('kgb-list');

  // lijst met checkboxen
  ASSETS.forEach((a,i)=>{
    const row = document.createElement('label');
    row.style.display='flex'; row.style.gap='6px'; row.style.alignItems='center'; row.style.margin='4px 0';
    row.innerHTML = `<input type="checkbox" data-idx="${i}" />
      <span style="background:#0f0;color:#111;padding:2px 6px;border-radius:6px;font-weight:600">${a.type.toUpperCase()}</span>
      <span style="color:#cff">${a.path}</span>
      <span id="kgb-st-${i}" style="margin-left:auto;color:#aaa"></span>`;
    list.appendChild(row);
  });

  // helper: loader
  function loadOne(a, i){
    return new Promise((resolve)=>{
      const st = document.getElementById('kgb-st-'+i);
      const url = new URL(a.path, location.href).toString();
      if (a.type==='css'){
        const el = document.createElement('link');
        el.rel='stylesheet'; el.href=url;
        el.onload=()=>{ st.textContent='✅'; resolve(true); };
        el.onerror=()=>{ st.textContent='❌'; L('CSS fout: '+url); resolve(false); };
        document.head.appendChild(el);
      } else {
        const el = document.createElement('script');
        el.src=url; el.defer=false; el.async=false;
        el.onload=()=>{ st.textContent='✅'; resolve(true); };
        el.onerror=()=>{ st.textContent='❌'; L('JS fout: '+url); resolve(false); };
        document.head.appendChild(el);
      }
      st.textContent='…';
    });
  }

  async function runSelected(){
    const sel = [...box.querySelectorAll('input[type="checkbox"]:checked')].map(x=>+x.dataset.idx);
    if (!sel.length){ L('Niets geselecteerd.'); return; }
    L('Start laden… (refresh = herstel)');
    // laad sequentieel (zodat oorzaak duidelijk is)
    for (const idx of sel){
      const a = ASSETS[idx];
      const ok = await loadOne(a, idx);
      if (!ok){ L('Gestopt door fout.'); break; }
      // waarschuwing: sommige assets kunnen UI “bevriezen” — daarom kort wachten en loggen
      await new Promise(r=>setTimeout(r, 150));
    }
    L('Klaar. Als klikken nu stuk is, refresh en vink tot de laatst geladen asset.');
  }

  document.getElementById('kgb-load').onclick = runSelected;
  document.getElementById('kgb-hide').onclick = ()=>{ box.remove(); };

  // zorg dat echte UI klikbaar blijft
  try{ (document.getElementById('app')||document.getElementById('root')||document.body).style.pointerEvents='auto'; }catch(_){}
}catch(e){console.error(e)}})();
