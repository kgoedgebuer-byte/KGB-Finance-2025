(function(){
  const TOK='kgb_sync_gist_token', GID='kgb_sync_gist_id';
  const CUR_USER='kgb_auth_current_v1';
  const KEYS={budget:'kgb_finance_budget_only_v1', full:'kgb_finance_full_v1'};
  const AUTO_RELOAD='kgb_sync_auto_reload';

  const $=s=>document.querySelector(s);
  function user(){ return (localStorage.getItem(CUR_USER)||'').trim() || 'Kurt'; }
  function appKind(){ return localStorage.getItem(KEYS.full)?'full':(localStorage.getItem(KEYS.budget)?'budget':'budget'); }
  function keyForKind(){ return appKind()==='full'?KEYS.full:KEYS.budget; }
  function files(){ const u=user(), k=appKind(); return {data:`${k}-${u}.json`, meta:`${k}-${u}.meta.json`}; }
  function stablePayload(){ try{ return JSON.stringify(JSON.parse(localStorage.getItem(keyForKind())||'{}')); }catch{ return '{}' } }
  async function sha256Hex(s){ const d=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function clampTime(s){ const t=Date.parse(s||0), now=Date.now(); return Number.isFinite(t)? Math.min(t, now+3600000):0; }

  // ---- Jaar-detectie en zetten (2020 → huidig) ----
  function detectYearBounds(raw){
    const yrs=Array.from(String(raw||'').matchAll(/\b(19|20)\d{2}\b/g)).map(m=>+m[0]).filter(y=>y>=2000&&y<=2100);
    if(!yrs.length) return null;
    const now=(new Date()).getFullYear();
    const min=Math.max(Math.min(...yrs),2020), max=Math.min(Math.max(...yrs),now);
    return {min,max};
  }
  function applyYear(y){
    ['kgb_year','kgb_view_year','kgb_selected_year','kgb_active_year','kgb_finance_year','kgb_year_filter']
      .forEach(k=>localStorage.setItem(k,String(y)));
  }
  function autoYearFromCurrentData(){
    const raw = localStorage.getItem(keyForKind())||'';
    const b=detectYearBounds(raw); if(!b) return {ok:false,msg:'Geen jaartallen'};
    applyYear(b.max); return {ok:true,msg:`Jaar → ${b.max}`};
  }

  // ---- UI helpers ----
  function ensureUI(){
    if($('#kgb_sync_btn')) return;
    const b=document.createElement('button');
    b.id='kgb_sync_btn';
    b.textContent='🔄 Sync';
    b.style.cssText='position:fixed;top:10px;right:120px;z-index:9996;padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer';
    b.onclick=openSync;
    document.body.appendChild(b);
    if(!$('#kgb_reload_bar')){
      const r=document.createElement('div'); r.id='kgb_reload_bar';
      r.style.cssText='position:fixed;left:0;right:0;top:0;display:none;z-index:9995;padding:10px 14px;text-align:center;background:#fde68a;border-bottom:1px solid #f59e0b;color:#713f12';
      r.innerHTML='Nieuwe data binnen. <button id="kgb_reload_now">Herlaad</button>'; document.body.appendChild(r);
      r.querySelector('#kgb_reload_now').onclick=()=>location.reload();
    }
    if(localStorage.getItem(AUTO_RELOAD)==null) localStorage.setItem(AUTO_RELOAD,'1');
  }
  function showReload(){ const e=$('#kgb_reload_bar'); if(e) e.style.display='block'; }
  function maybeAutoReload(){ localStorage.getItem(AUTO_RELOAD)==='1' ? setTimeout(()=>location.reload(),600) : showReload(); }

  // ---- Gist API ----
  async function api(method, body){
    const tok=localStorage.getItem(TOK), gid=localStorage.getItem(GID);
    if(!tok||!gid) throw new Error('Token/Gist ID ontbreekt');
    const r=await fetch(`https://api.github.com/gists/${gid}`,{
      method, headers:{Authorization:`Bearer ${tok}`,'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined
    });
    if(!r.ok) throw new Error(`GitHub API ${r.status}`);
    return await r.json();
  }

  // ---- Pull/Push ----
  async function doPull(){
    const f=files(), j=await api('GET');
    const content=j.files?.[f.data]?.content || null;
    if(!content) return {ok:false,msg:`Geen ${f.data} in Gist`};
    localStorage.setItem(keyForKind(), content);
    const hash=await sha256Hex(stablePayload());
    localStorage.setItem(`kgb_sync_local_meta_${appKind()}`, JSON.stringify({hash,updated_at:new Date().toISOString(),by:'pull'}));
    autoYearFromCurrentData(); maybeAutoReload();
    return {ok:true,msg:`Pull OK (${f.data})`};
  }
  async function doPush(opts={force:false}){
    const f=files(), data=stablePayload(), hash=await sha256Hex(data), j=await api('GET');
    const rmRaw=j.files?.[f.meta]?.content || null;
    const lmRaw=localStorage.getItem(`kgb_sync_local_meta_${appKind()}`) || '{}';
    let conflict=false;
    if(rmRaw && !opts.force){
      try{ const rm=JSON.parse(rmRaw), lm=JSON.parse(lmRaw);
        if(clampTime(rm.updated_at)>clampTime(lm.updated_at) && lm.hash && lm.hash!==hash) conflict=true;
      }catch{}
    }
    if(conflict) return {ok:false,conflict:true,msg:'Conflict: cloud nieuwer + lokaal gewijzigd. Pull of Forceer push.'};
    const metaNow={hash,updated_at:new Date().toISOString(),by:user()};
    await api('PATCH',{files:{[f.data]:{content:data},[f.meta]:{content:JSON.stringify(metaNow,null,2)}}});
    localStorage.setItem(`kgb_sync_local_meta_${appKind()}`, JSON.stringify(metaNow));
    return {ok:true,msg:`Push OK (${f.data})`};
  }

  // ---- Export/Import (werkt op gsm) ----
  async function exportSmart(){
    const fname=`${appKind()}-${user()}.json`, data=stablePayload(), blob=new Blob([data],{type:'application/json'});
    try{
      const file=new File([blob],fname,{type:'application/json'});
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title: fname}); return {ok:true,msg:'Gedeeld (Bestanden/Drive)'}; }
      if(navigator.share){ await navigator.share({title: fname, text: data}); return {ok:true,msg:'Gedeeld als tekst'}; }
    }catch(_){}
    try{ if(navigator.clipboard && isSecureContext){ await navigator.clipboard.writeText(data); return {ok:true,msg:'Gekopieerd naar klembord'}; } }catch(_){}
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=fname; a.target='_blank'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),3e4);
    return {ok:true,msg:'Bestand geopend/gedownload'};
  }
  async function importFromClipboard(){
    if(!(navigator.clipboard && isSecureContext)) throw new Error('Klembord niet beschikbaar');
    const txt=await navigator.clipboard.readText(); if(!txt) throw new Error('Klembord leeg');
    try{ JSON.parse(txt); }catch{ throw new Error('Geen geldige JSON op klembord'); }
    localStorage.setItem(keyForKind(), txt);
    const hash=await sha256Hex(stablePayload());
    localStorage.setItem(`kgb_sync_local_meta_${appKind()}`, JSON.stringify({hash,updated_at:new Date().toISOString(),by:'import-clipboard'}));
    autoYearFromCurrentData(); maybeAutoReload();
    return {ok:true,msg:'Import uit klembord OK'};
  }
  async function importFromFile(file){
    const txt=await file.text(); JSON.parse(txt||'{}');
    localStorage.setItem(keyForKind(), txt);
    const hash=await sha256Hex(stablePayload());
    localStorage.setItem(`kgb_sync_local_meta_${appKind()}`, JSON.stringify({hash,updated_at:new Date().toISOString(),by:'import-file'}));
    autoYearFromCurrentData(); maybeAutoReload();
    return {ok:true,msg:`Import OK (${file.name})`};
  }

  // ---- Overlay UI ----
  function openSync(){
    const back=document.createElement('div'); back.className='kgb-sync-back';
    const root=document.createElement('div'); root.className='kgb-sync';
    const tok=localStorage.getItem(TOK)||'', gid=localStorage.getItem(GID)||'';
    root.innerHTML=`<div class="card">
      <h3 style="margin:0 0 8px">🔄 Sync — <b>${user()}</b> (${appKind()})</h3>
      <div class="row">
        <label><span>Gist Token</span><input id="se_tok" type="password" value="${tok}" placeholder="ghp_..."></label>
        <label><span>Gist ID</span><input id="se_gid" type="text" value="${gid}" placeholder="xxxxxxxxxxxxxxxx"></label>
      </div>
      <div class="row">
        <div style="flex:1">
          <div style="margin-bottom:6px;color:#334155">Snel wisselen</div>
          <div class="buttons"><button data-a="user" data-name="Kurt">Kurt</button><button data-a="user" data-name="Tamara">Tamara</button>
          <input id="se_user" placeholder="Andere naam…" style="padding:8px;border:1px solid #e5e7eb;border-radius:10px;min-width:140px">
          <button data-a="user-apply">Zet</button></div>
        </div>
      </div>
      <div class="buttons" style="margin-top:6px">
        <button data-a="save">Opslaan</button><button data-a="test">Test</button><span id="msg" style="margin-left:8px"></span>
      </div>
      <hr/>
      <div class="buttons">
        <button data-a="pull">⬇️ Pull</button><button data-a="push">⬆️ Push</button><button data-a="force" style="display:none">‼️ Forceer push</button>
        <button data-a="export">💾 Export (Delen)</button><button data-a="import">📥 Import (bestand)</button><button data-a="import-clip">📋 Import (klembord)</button>
      </div>
      <small>Bestanden: <code id="f_data">${files().data}</code> / <code id="f_meta">${files().meta}</code></small>
    </div>`;
    document.body.append(back,root);
    const q=s=>root.querySelector(s);
    back.onclick=()=>{root.remove();back.remove()};
    root.addEventListener('click', async (e)=>{
      const a=e.target?.dataset?.a; if(!a) return;
      const msg=s=>q('#msg').textContent=s;
      try{
        if(a==='save'){ localStorage.setItem(TOK,q('#se_tok').value.trim()); localStorage.setItem(GID,q('#se_gid').value.trim()); msg('✔️ Bewaard'); }
        if(a==='test'){ await api('PATCH',{files:{'ping.txt':{content:'ok '+new Date().toISOString()}}}); msg('✅ Gist OK'); }
        if(a==='pull'){ const r=await doPull(); msg(r.ok?'✅ '+r.msg:r.msg); }
        if(a==='push'){ const r=await doPush({force:false}); if(r.conflict){ msg('⚠️ '+r.msg); q('[data-a="force"]').style.display='inline-block'; } else msg('✅ '+r.msg); }
        if(a==='force'){ const r=await doPush({force:true}); msg(r.ok?'✅ '+r.msg:r.msg); q('[data-a="force"]').style.display='none'; }
        if(a==='export'){ const r=await exportSmart(); msg(r.msg); }
        if(a==='import'){ const f=document.createElement('input'); f.type='file'; f.accept='application/json,.json'; f.onchange=async ev=>{ const file=ev.target.files?.[0]; if(!file) return; const r=await importFromFile(file); msg(r.msg); }; f.click(); }
        if(a==='import-clip'){ const r=await importFromClipboard(); msg(r.msg); }
        if(a==='user'){ localStorage.setItem(CUR_USER, e.target.dataset.name); q('#f_data').textContent=files().data; q('#f_meta').textContent=files().meta; msg('Gebruiker → '+e.target.dataset.name); }
        if(a==='user-apply'){ const name=(q('#se_user').value||'').trim(); if(name){ localStorage.setItem(CUR_USER,name); q('#f_data').textContent=files().data; q('#f_meta').textContent=files().meta; msg('Gebruiker → '+name); } }
      }catch(err){ msg('❌ '+(err?.message||String(err))); }
    });
  }

  // ---- Start + stijl ----
  (window.KGB_READY?window.KGB_READY:Promise.resolve()).finally(()=>{
    ensureUI(); try{ autoYearFromCurrentData(); }catch{}
  });
  if(!document.getElementById('kgb-sync-style')){
    const st=document.createElement('style'); st.id='kgb-sync-style';
    st.textContent='.kgb-sync-back{position:fixed;inset:0;background:rgba(2,6,23,.35);backdrop-filter:blur(2px);z-index:9996}.kgb-sync{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9997}.kgb-sync .card{width:min(94vw,560px);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 12px 40px rgba(2,6,23,.18);padding:16px}.kgb-sync .row{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.kgb-sync label{display:flex;flex-direction:column;gap:6px;flex:1 1 220px}.kgb-sync input,.kgb-sync select{padding:10px;border:1px solid #e5e7eb;border-radius:10px}.kgb-sync .buttons{display:flex;gap:8px;flex-wrap:wrap}#kgb_sync_btn{position:fixed;top:10px;right:120px;padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;z-index:9996}';
    document.head.appendChild(st);
  }

  function ensureUI(){ if($('#kgb_sync_btn')) return; const b=document.createElement('button'); b.id='kgb_sync_btn'; b.textContent='🔄 Sync'; b.style.cssText='position:fixed;top:10px;right:120px;z-index:9996;padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer'; b.onclick=openSync; document.body.appendChild(b); if(localStorage.getItem(AUTO_RELOAD)==null) localStorage.setItem(AUTO_RELOAD,'1'); }
})();
