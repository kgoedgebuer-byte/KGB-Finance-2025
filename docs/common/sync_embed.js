(function(){
  const TOK='kgb_sync_gist_token', GID='kgb_sync_gist_id';
  const KEYS={budget:'kgb_finance_budget_only_v1', full:'kgb_finance_full_v1'};
  const CUR_USER='kgb_auth_current_v1'; // gezet door login
  const AUTO={enabled:'kgb_sync_auto_enabled',mode:'kgb_sync_auto_mode',time:'kgb_sync_auto_time',last:'kgb_sync_auto_last'};
  const $=s=>document.querySelector(s);

  function user(){ return (localStorage.getItem(CUR_USER)||'').trim() || 'Kurt'; }
  function files(kind){
    const u=user();
    return {
      data:`${kind}-${u}.json`,
      meta:`${kind}-${u}.meta.json`,
      // legacy namen (alleen lezen → migreren)
      legacyData: kind==='budget' ? 'budget_web.json' : 'full_web.json',
      legacyMeta: kind==='budget' ? 'budget_web.meta.json' : 'full_web.meta.json'
    };
  }
  function appKind(){ return localStorage.getItem(KEYS.full)?'full':(localStorage.getItem(KEYS.budget)?'budget':'budget'); }
  function stablePayload(key){ try{ return JSON.stringify(JSON.parse(localStorage.getItem(key)||'{}')); }catch{ return '{}' } }
  async function sha256Hex(s){ const d=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join(''); }

  function ensureUI(){
    if($('#kgb_sync_btn')) return;
    const b=document.createElement('button'); b.id='kgb_sync_btn'; b.textContent='🔄 Sync'; document.body.appendChild(b);
    b.onclick=openSync;
    if(!$('#kgb_reload_bar')){ const r=document.createElement('div'); r.id='kgb_reload_bar'; r.innerHTML='Nieuwe data binnen. <button id="kgb_reload_now">Herlaad</button>'; document.body.appendChild(r); r.querySelector('#kgb_reload_now').onclick=()=>location.reload(); }
  }
  function showReload(){ $('#kgb_reload_bar').style.display='block'; }

  async function api(method, body){
    const tok=localStorage.getItem(TOK), gid=localStorage.getItem(GID);
    if(!tok||!gid) throw new Error("Token/Gist ID ontbreekt");
    const r=await fetch(`https://api.github.com/gists/${gid}`,{
      method, headers:{Authorization:`Bearer ${tok}`,'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined
    });
    if(!r.ok) throw new Error(`GitHub API ${r.status}`);
    return await r.json();
  }

  // ---- PULL (met legacy migratie) ----
  async function doPull(){
    const kind=appKind(); const f=files(kind); const j=await api('GET');
    const readFile = name => j.files?.[name]?.content || null;
    let content = readFile(f.data), meta = readFile(f.meta);
    if(!content){ // probeer legacy → migratie
      const legacy = readFile(f.legacyData);
      if(legacy){ content=legacy; meta = readFile(f.legacyMeta); }
    }
    if(!content) return {ok:false,msg:`Geen ${f.data} (of legacy) in Gist`};
    const key = (kind==='full')?KEYS.full:KEYS.budget;
    localStorage.setItem(key, content);
    // schrijf lokale meta (hash/timestamp)
    const hash=await sha256Hex(stablePayload(key));
    const m = meta ? JSON.parse(meta) : {};
    m.hash=hash; m.updated_at=new Date().toISOString(); m.by=`pull-${user()}`;
    localStorage.setItem(`kgb_sync_local_meta_${kind}`, JSON.stringify(m));
    showReload();
    return {ok:true,msg:`Pull OK (${f.data}) — herlaad`};
  }

  // ---- PUSH (conflictcheck) ----
  async function doPush(opts={force:false}){
    const kind=appKind(); const f=files(kind); const key=(kind==='full')?KEYS.full:KEYS.budget;
    const data=stablePayload(key), hash=await sha256Hex(data);
    const j=await api('GET'); const remoteMetaRaw = j.files?.[f.meta]?.content || null;
    const localMetaRaw = localStorage.getItem(`kgb_sync_local_meta_${kind}`) || '{}';
    let conflict=false;
    if(remoteMetaRaw && !opts.force){
      try{
        const rm=JSON.parse(remoteMetaRaw), lm=JSON.parse(localMetaRaw);
        const rt=Date.parse(rm.updated_at||0), lt=Date.parse(lm.updated_at||0);
        const diverged = (lm.hash && lm.hash!==hash);
        if(rt>lt && diverged) conflict=true;
      }catch{}
    }
    if(conflict && !opts.force) return {ok:false,conflict:true,msg:'Conflict: cloud nieuwer + lokale wijziging. Pull of Forceer push.'};
    const metaNow={hash, updated_at:new Date().toISOString(), by:user()};
    await api('PATCH',{files:{[f.data]:{content:data}, [f.meta]:{content:JSON.stringify(metaNow,null,2)}}});
    localStorage.setItem(`kgb_sync_local_meta_${kind}`, JSON.stringify(metaNow));
    return {ok:true,msg:`Push OK (${f.data})`};
  }

  // ---- Auto (dagelijks) ----
  function parseTime(s){const m=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s||''); return {h:m?+m[1]:3, m:m?+m[2]:0};}
  function nextAt(hhmm){const t=new Date(), {h,m}=parseTime(hhmm); const n=new Date(); n.setHours(h,m,0,0); if(n<=t) n.setDate(n.getDate()+1); return n.getTime();}
  async function runAuto(){ const mode=localStorage.getItem(AUTO.mode)||'pull'; try{ if(mode==='pull') await doPull(); else if(mode==='push') await doPush(); else {await doPull(); await doPush();} localStorage.setItem(AUTO.last,String(Date.now())); }catch{} }
  async function due(){ if(localStorage.getItem(AUTO.enabled)!=='1') return; const last=+(localStorage.getItem(AUTO.last)||0); if(Date.now()-last>86400000) await runAuto(); }
  function schedule(){ setTimeout(async()=>{await runAuto(); schedule();}, Math.max(1000, nextAt(localStorage.getItem(AUTO.time)||'03:00')-Date.now())); setInterval(due, 15*60*1000); }

  // ---- Overlay ----
  function overlay(){
    const back=document.createElement('div'); back.className='kgb-sync-back';
    const root=document.createElement('div'); root.className='kgb-sync';
    const tok=localStorage.getItem(TOK)||"", gid=localStorage.getItem(GID)||"";
    const en=localStorage.getItem(AUTO.enabled)==='1', mode=localStorage.getItem(AUTO.mode)||'pull', time=localStorage.getItem(AUTO.time)||'03:00';
    root.innerHTML=`<div class="card">
      <h3>🔄 Sync voor <b>${user()}</b></h3>
      <div class="row">
        <label>Gist Token<input id="se_tok" type="password" value="${tok}" placeholder="ghp_..."></label>
        <label>Gist ID<input id="se_gid" type="text" value="${gid}" placeholder="xxxxxxxxxxxxxxxx"></label>
      </div>
      <div class="row">
        <label><span>Auto-sync</span><select id="se_en"><option value="0"${en?'':' selected'}>Uit</option><option value="1"${en?' selected':''}>Aan (dagelijks)</option></select></label>
        <label><span>Modus</span><select id="se_mode"><option value="pull"${mode==='pull'?' selected':''}>Pull</option><option value="push"${mode==='push'?' selected':''}>Push</option><option value="both"${mode==='both'?' selected':''}>Beide</option></select></label>
        <label><span>Tijd</span><input id="se_time" type="time" value="${time}"></label>
      </div>
      <div class="buttons">
        <button data-a="save">Opslaan</button><button data-a="test">Test</button><span id="msg" style="margin-left:8px"></span>
      </div><hr/>
      <div class="buttons">
        <button data-a="pull">⬇️ Pull</button><button data-a="push">⬆️ Push</button><button data-a="force" style="display:none">‼️ Forceer push</button>
      </div>
      <small>Bestanden per gebruiker: budget-<i>Naam</i>.json / full-<i>Naam</i>.json (legacy wordt automatisch gemigreerd)</small>
    </div>`;
    document.body.append(back,root);
    const $=s=>root.querySelector(s);
    back.onclick=()=>{root.remove();back.remove()};
    root.addEventListener('click', async (e)=>{
      const a=e.target?.dataset?.a; if(!a) return;
      if(a==='save'){ localStorage.setItem(TOK,$('#se_tok').value.trim()); localStorage.setItem(GID,$('#se_gid').value.trim()); localStorage.setItem(AUTO.enabled,$('#se_en').value); localStorage.setItem(AUTO.mode,$('#se_mode').value); localStorage.setItem(AUTO.time,$('#se_time').value); $('#msg').textContent='✔️ Bewaard'; }
      if(a==='test'){ try{ await api('PATCH',{files:{'ping.txt':{content:'ok '+new Date().toISOString()}}}); $('#msg').textContent='✅ OK'; }catch(err){ $('#msg').textContent='❌ '+err.message; } }
      if(a==='pull'){ try{ const r=await doPull(); $('#msg').textContent=r.ok?'✅ '+r.msg:r.msg; }catch(err){ $('#msg').textContent='❌ '+err.message; } }
      if(a==='push'){ try{ const r=await doPush({force:false}); if(r.conflict){ $('#msg').textContent='⚠️ '+r.msg; $('[data-a="force"]').style.display='inline-block'; } else { $('#msg').textContent='✅ '+r.msg; } }catch(err){ $('#msg').textContent='❌ '+err.message; } }
      if(a==='force'){ try{ const r=await doPush({force:true}); $('#msg').textContent=r.ok?'✅ '+r.msg:r.msg; e.target.style.display='none'; }catch(err){ $('#msg').textContent='❌ '+err.message; } }
    });
  }

  // start
  (window.KGB_READY?window.KGB_READY:Promise.resolve()).finally(()=>{ ensureUI(); schedule(); due(); });
  function openSync(){ overlay(); }
})();
