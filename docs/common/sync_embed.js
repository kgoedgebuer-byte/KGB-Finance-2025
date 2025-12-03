(function(){
  const TOK='kgb_sync_gist_token', GID='kgb_sync_gist_id';
  const KEYS={budget:'kgb_finance_budget_only_v1', full:'kgb_finance_full_v1'};
  const CUR_USER='kgb_auth_current_v1';
  const AUTO={enabled:'kgb_sync_auto_enabled',mode:'kgb_sync_auto_mode',time:'kgb_sync_auto_time',last:'kgb_sync_auto_last'};
  const AUTO_RELOAD='kgb_sync_auto_reload';
  const $=s=>document.querySelector(s);

  function user(){ return (localStorage.getItem(CUR_USER)||'').trim() || 'Kurt'; }
  function appKind(){ return localStorage.getItem(KEYS.full)?'full':(localStorage.getItem(KEYS.budget)?'budget':'budget'); }
  function files(kind){ const u=user(); return {data:`${kind}-${u}.json`, meta:`${kind}-${u}.meta.json`}; }
  function keyForKind(){ const kind=appKind(); return (kind==='full')?KEYS.full:KEYS.budget; }
  function stablePayload(key){ try{ return JSON.stringify(JSON.parse(localStorage.getItem(key)||'{}')); }catch{ return '{}' } }
  async function sha256Hex(s){ const d=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function safeParseTime(s){ const t=Date.parse(s||0), now=Date.now(); const MAX=3600000; return Number.isFinite(t)? (t>now+MAX?now:t):0; }

  function detectYearBounds(raw){
    if(!raw) return null;
    const yrs = Array.from(String(raw).matchAll(/\b(20\d{2}|19\d{2})\b/g))
      .map(m=>+m[1]).filter(y=>y>=2000 && y<=2100);
    if(!yrs.length) return null;
    const now=(new Date()).getFullYear();
    const min = Math.max(Math.min(...yrs), 2020);
    const max = Math.min(Math.max(...yrs), now);
    const uniq = [...new Set(yrs)].filter(y=>y>=min && y<=max).sort((a,b)=>a-b);
    return {years:uniq, min, max};
  }
  function applyYear(y){
    if(!y) return {ok:false,msg:'Geen jaar'};
    const keys=[
      'kgb_year','kgb_view_year','kgb_selected_year',
      'kgb_active_year','kgb_finance_year','kgb_year_filter'
    ];
    keys.forEach(k=>localStorage.setItem(k,String(y)));
    return {ok:true,msg:`Jaar ingesteld: ${y}`};
  }
  function applyYearRange(min,max){
    const keys=['kgb_year_start','kgb_year_end','kgb_view_year_start','kgb_view_year_end'];
    localStorage.setItem('kgb_years_available', JSON.stringify({min,max}));
    localStorage.setItem('kgb_years_list', JSON.stringify(Array.from({length:max-min+1},(_,i)=>min+i)));
    keys.forEach(k=>{
      if(k.endsWith('_start')) localStorage.setItem(k,String(min));
      if(k.endsWith('_end'))   localStorage.setItem(k,String(max));
    });
  }
  function autoYearFromCurrentData(){
    const raw = localStorage.getItem(keyForKind())||'';
    const b = detectYearBounds(raw);
    if(!b) return {ok:false,msg:'Geen jaartallen in data'};
    applyYearRange(b.min,b.max);
    return applyYear(b.max);
  }

  ensureUI();
  function ensureUI(){
    if($('#kgb_sync_btn')) return;
    const b=document.createElement('button'); b.id='kgb_sync_btn'; b.textContent='🔄 Sync'; document.body.appendChild(b); b.onclick=openSync;
    if(!$('#kgb_reload_bar')){
      const r=document.createElement('div'); r.id='kgb_reload_bar';
      r.style.cssText='position:fixed;left:0;right:0;top:0;display:none;z-index:9995;padding:10px 14px;text-align:center;background:#fde68a;border-bottom:1px solid #f59e0b;color:#713f12';
      r.innerHTML='Nieuwe data binnen. <button id="kgb_reload_now">Herlaad</button>'; document.body.appendChild(r);
      r.querySelector('#kgb_reload_now').onclick=()=>location.reload();
    }
    if(localStorage.getItem(AUTO_RELOAD)==null) localStorage.setItem(AUTO_RELOAD,'1');
  }
  function showReload(){ const e=$('#kgb_reload_bar'); if(e) e.style.display='block'; }
  function maybeAutoReload(){ if(localStorage.getItem(AUTO_RELOAD)==='1') setTimeout(()=>location.reload(), 600); else showReload(); }

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

  async function doPull(){
    const kind=appKind(), f=files(kind), j=await api('GET');
    const content = j.files?.[f.data]?.content || null;
    if(!content) return {ok:false,msg:`Geen ${f.data} in Gist`};
    const key=keyForKind();
    localStorage.setItem(key, content);
    const hash=await sha256Hex(stablePayload(key));
    const m={hash, updated_at:new Date().toISOString(), by:`pull-${user()}`};
    localStorage.setItem(`kgb_sync_local_meta_${kind}`, JSON.stringify(m));
    autoYearFromCurrentData();
    maybeAutoReload();
    return {ok:true,msg:`Pull OK (${f.data})`};
  }

  async function doPush(opts={force:false}){
    const kind=appKind(), f=files(kind), key=keyForKind();
    const data=stablePayload(key), hash=await sha256Hex(data), j=await api('GET');
    const rmRaw = j.files?.[f.meta]?.content || null;
    const lmRaw = localStorage.getItem(`kgb_sync_local_meta_${kind}`) || '{}';
    let conflict=false;
    if(rmRaw && !opts.force){
      try{
        const rm=JSON.parse(rmRaw), lm=JSON.parse(lmRaw);
        const rt=safeParseTime(rm.updated_at), lt=safeParseTime(lm.updated_at);
        const diverged = (lm.hash && lm.hash!==hash);
        if(rt>lt && diverged) conflict=true;
      }catch{}
    }
    if(conflict) return {ok:false,conflict:true,msg:'Conflict: cloud nieuwer + lokale wijziging. Pull of Forceer push.'};
    const metaNow={hash, updated_at:new Date().toISOString(), by:user()};
    await api('PATCH',{files:{[f.data]:{content:data}, [f.meta]:{content:JSON.stringify(metaNow,null,2)}}});
    localStorage.setItem(`kgb_sync_local_meta_${kind}`, JSON.stringify(metaNow));
    return {ok:true,msg:`Push OK (${f.data})`};
  }

  async function doExport(){
    const kind=appKind(), key=keyForKind();
    const blob=new Blob([stablePayload(key)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`${kind}-${user()}.json`; document.body.appendChild(a); a.click(); a.remove();
    return {ok:true,msg:`Export OK → ${a.download}`};
  }
  async function doImport(file){
    const kind=appKind(), key=keyForKind();
    const txt=await file.text(); JSON.parse(txt||'{}');
    localStorage.setItem(key, txt);
    const hash=await sha256Hex(stablePayload(key));
    const m={hash, updated_at:new Date().toISOString(), by:`import-file`};
    localStorage.setItem(`kgb_sync_local_meta_${kind}`, JSON.stringify(m));
    autoYearFromCurrentData();
    maybeAutoReload();
    return {ok:true,msg:`Import OK (${file.name})`};
  }
  async function checkCloud(){
    const kind=appKind(), f=files(kind), j=await api('GET');
    const df=j.files?.[f.data], mf=j.files?.[f.meta];
    const size=df?.size ?? 0, updated=(mf?.content? (JSON.parse(mf.content).updated_at||'n/a') : 'n/a');
    return {ok:true,msg:`Cloud: ${f.data} ${df?'✓':'—'} (size ${size}), meta.updated_at=${updated}`};
  }

  function setUser(u){ if(!u) return {ok:false,msg:'Geen naam'}; localStorage.setItem(CUR_USER, u.trim()); return {ok:true,msg:`Gebruiker → ${u}. Bestand: ${files(appKind()).data}`}; }

  function overlay(){
    const back=document.createElement('div'); back.className='kgb-sync-back';
    const root=document.createElement('div'); root.className='kgb-sync';
    const tok=localStorage.getItem(TOK)||"", gid=localStorage.getItem(GID)||"";
    const en=localStorage.getItem(AUTO.enabled)==='1', mode=localStorage.getItem(AUTO.mode)||'pull', time=localStorage.getItem(AUTO.time)||'03:00';
    const autoReload = localStorage.getItem(AUTO_RELOAD)==='1';
    const uNow=user(), kind=appKind();
    root.innerHTML=`<div class="card">
      <h3>🔄 Sync — <b id="u_now">${uNow}</b> (${kind})</h3>
      <div class="row"><label>Gist Token<input id="se_tok" type="password" value="${tok}" placeholder="ghp_..."></label>
        <label>Gist ID<input id="se_gid" type="text" value="${gid}" placeholder="xxxxxxxxxxxxxxxx"></label></div>
      <div class="row">
        <label><span>Auto-sync</span><select id="se_en"><option value="0"${en?'':' selected'}>Uit</option><option value="1"${en?' selected':''}>Aan (dagelijks)</option></select></label>
        <label><span>Modus</span><select id="se_mode"><option value="pull"${mode==='pull'?' selected':''}>Pull</option><option value="push"${mode==='push'?' selected':''}>Push</option><option value="both"${mode==='both'?' selected':''}>Beide</option></select></label>
        <label><span>Tijd</span><input id="se_time" type="time" value="${time}"></label>
        <label><span>Auto-herladen</span><select id="se_reload"><option value="1"${autoReload?' selected':''}>Aan</option><option value="0"${autoReload?'':' selected'}>Uit</option></select></label>
      </div>
      <div class="row"><div style="flex:1">
        <div style="margin-bottom:6px;color:#334155">Snel wisselen gebruiker</div>
        <div class="buttons">
          <button data-a="user" data-name="Kurt">Kurt</button>
          <button data-a="user" data-name="Tamara">Tamara</button>
          <input id="se_user" placeholder="Andere naam…" style="padding:8px;border:1px solid #e5e7eb;border-radius:10px;min-width:140px"/>
          <button data-a="user-apply">Zet</button>
        </div></div></div>
      <div class="buttons" style="margin-top:6px">
        <button data-a="save">Opslaan</button><button data-a="test">Test</button><span id="msg" style="margin-left:8px"></span>
      </div><hr/>
      <div class="buttons">
        <button data-a="pull">⬇️ Pull</button><button data-a="push">⬆️ Push</button><button data-a="force" style="display:none">‼️ Forceer push</button>
        <button data-a="check">🔍 Check cloud</button><button data-a="autoyear">📅 Auto-jaar</button>
      </div>
      <div class="buttons" style="margin-top:8px">
        <button data-a="export">💾 Export</button><button data-a="import">📥 Import (bestand)</button>
        <input id="se_file" type="file" accept="application/json,.json" style="display:none"/>
      </div>
      <small>Bestanden: <code id="f_data">${files(kind).data}</code> / <code id="f_meta">${files(kind).meta}</code></small>
    </div>`;
    document.body.append(back,root);
    const q=s=>root.querySelector(s);
    back.onclick=()=>{root.remove();back.remove()};
    root.addEventListener('click', async (e)=>{
      const a=e.target?.dataset?.a; if(!a) return;
      try{
        if(a==='save'){
          localStorage.setItem(TOK,q('#se_tok').value.trim());
          localStorage.setItem(GID,q('#se_gid').value.trim());
          localStorage.setItem(AUTO.enabled,q('#se_en').value);
          localStorage.setItem(AUTO.mode,q('#se_mode').value);
          localStorage.setItem(AUTO.time,q('#se_time').value||'03:00');
          localStorage.setItem(AUTO_RELOAD,q('#se_reload').value);
          q('#msg').textContent='✔️ Bewaard';
        }
        if(a==='test'){ await api('PATCH',{files:{'ping.txt':{content:'ok '+new Date().toISOString()}}}); q('#msg').textContent='✅ OK'; }
        if(a==='pull'){ const r=await doPull(); q('#msg').textContent=r.ok?'✅ '+r.msg:r.msg; }
        if(a==='push'){ const r=await doPush({force:false}); if(r.conflict){ q('#msg').textContent='⚠️ '+r.msg; q('[data-a="force"]').style.display='inline-block'; } else q('#msg').textContent='✅ '+r.msg; }
        if(a==='force'){ const r=await doPush({force:true}); q('#msg').textContent=r.ok?'✅ '+r.msg:r.msg; q('[data-a="force"]').style.display='none'; }
        if(a==='check'){ const r=await checkCloud(); q('#msg').textContent=r.msg; }
        if(a==='export'){ const r=await doExport(); q('#msg').textContent='✅ '+r.msg; }
        if(a==='import'){ q('#se_file').click(); }
        if(a==='autoyear'){ const res=autoYearFromCurrentData(); q('#msg').textContent=res.ok?'✅ '+res.msg:'ℹ️ '+res.msg; showReload(); }
        if(a==='user'){ const r=setUser(e.target.dataset.name); q('#u_now').textContent=e.target.dataset.name; q('#msg').textContent=r.msg; q('#f_data').textContent=files(appKind()).data; q('#f_meta').textContent=files(appKind()).meta; }
        if(a==='user-apply'){ const name=(q('#se_user').value||'').trim(); const r=setUser(name||''); q('#u_now').textContent=name||user(); q('#msg').textContent=r.msg; q('#f_data').textContent=files(appKind()).data; q('#f_meta').textContent=files(appKind()).meta; }
      }catch(err){ q('#msg').textContent='❌ '+(err?.message||err); }
    });
    q('#se_file').addEventListener('change', async (ev)=>{
      const f=ev.target.files?.[0]; if(!f) return;
      try{ const r=await doImport(f); root.querySelector('#msg').textContent='✅ '+r.msg; }catch(err){ root.querySelector('#msg').textContent='❌ '+(err?.message||err); }
    });
  }

  function parseTime(s){const m=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s||''); return {h:m?+m[1]:3, m:m?+m[2]:0};}
  function nextAt(hhmm){const t=new Date(), {h,m}=parseTime(hhmm); const n=new Date(); n.setHours(h,m,0,0); if(n<=t) n.setDate(n.getDate()+1); return n.getTime();}
  async function runAuto(){ const mode=localStorage.getItem(AUTO.mode)||'pull'; try{ if(mode==='pull') await doPull(); else if(mode==='push') await doPush(); else {await doPull(); await doPush();} localStorage.setItem(AUTO.last,String(Date.now())); }catch{} }
  async function due(){ if(localStorage.getItem(AUTO.enabled)!=='1') return; const last=+(localStorage.getItem(AUTO.last)||0); if(Date.now()-last>86400000) await runAuto(); }
  function schedule(){ setTimeout(async()=>{await runAuto(); schedule();}, Math.max(1000, nextAt(localStorage.getItem(AUTO.time)||'03:00')-Date.now())); setInterval(due, 15*60*1000); }

  (window.KGB_READY?window.KGB_READY:Promise.resolve()).finally(()=>{
    ensureUI(); try{ autoYearFromCurrentData(); }catch{}; schedule(); due();
  });
  function openSync(){ overlay(); }
})();
