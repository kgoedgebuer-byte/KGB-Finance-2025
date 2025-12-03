(function(){
  const TOK='kgb_sync_gist_token', GID='kgb_sync_gist_id';
  const KEYS={budget:'kgb_finance_budget_only_v1', full:'kgb_finance_full_v1'};
  const META_FILE={budget:'budget_web.meta.json', full:'full_web.meta.json'};
  const DATA_FILE={budget:'budget_web.json',      full:'full_web.json'};
  const AUTO={enabled:'kgb_sync_auto_enabled',mode:'kgb_sync_auto_mode',time:'kgb_sync_auto_time',last:'kgb_sync_auto_last'};
  const LOCAL_META={budget:'kgb_sync_local_meta_budget', full:'kgb_sync_local_meta_full'};
  const CUR_USER='kgb_auth_current_v1';
  const $=s=>document.querySelector(s);

  // ----- UI helpers -----
  ensureReloadBar();
  function ensureReloadBar(){
    if($('#kgb_reload_bar')) return;
    const b=document.createElement('div'); b.id='kgb_reload_bar';
    b.innerHTML='Nieuwe data binnen. Herlaad om te tonen.<button id="kgb_reload_now">Herlaad</button>';
    document.body.appendChild(b);
    b.querySelector('#kgb_reload_now').onclick=()=>location.reload();
  }
  function showReloadBar(){ $('#kgb_reload_bar').style.display='block' }

  function ensureBtn(){
    if(document.getElementById('kgb_sync_btn')) return;
    const b=document.createElement('button'); b.id='kgb_sync_btn'; b.textContent='🔄 Sync';
    document.body.appendChild(b); b.onclick=openSync;
  }

  function ui(){
    const back=document.createElement('div'); back.className='kgb-sync-back';
    const root=document.createElement('div'); root.className='kgb-sync';
    const tok=localStorage.getItem(TOK)||"", gid=localStorage.getItem(GID)||"";
    const en=localStorage.getItem(AUTO.enabled)==='1';
    const mode=localStorage.getItem(AUTO.mode)||'pull';
    const time=localStorage.getItem(AUTO.time)||'03:00';
    root.innerHTML=`<div class="card">
      <h3>🔄 Sync met GitHub Gist</h3>
      <div class="row">
        <label>Gist Token<input id="se_tok" type="password" value="${tok}" placeholder="ghp_..."></label>
        <label>Gist ID<input id="se_gid" type="text" value="${gid}" placeholder="xxxxxxxxxxxxxxxx"></label>
      </div>
      <div class="row">
        <label style="flex:1"><span>⏱️ Auto-sync dagelijks</span>
          <select id="se_enabled"><option value="0"${en?'':' selected'}>Uit</option><option value="1"${en?' selected':''}>Aan</option></select>
        </label>
        <label style="flex:1"><span>Modus</span>
          <select id="se_mode">
            <option value="pull"${mode==='pull'?' selected':''}>Pull (cloud → dit toestel)</option>
            <option value="push"${mode==='push'?' selected':''}>Push (dit toestel → cloud)</option>
            <option value="both"${mode==='both'?' selected':''}>Beide (pull dan push)</option>
          </select>
        </label>
        <label style="flex:1"><span>Tijd</span><input id="se_time" type="time" value="${time}"></label>
      </div>
      <div class="buttons">
        <button data-a="save">Opslaan</button>
        <button data-a="test">Test</button>
        <span id="se_msg" style="margin-left:6px;color:#334155"></span>
      </div>
      <hr/>
      <div class="buttons">
        <button data-a="pull">⬇️ Pull (cloud → deze app)</button>
        <button data-a="push">⬆️ Push (deze app → cloud)</button>
        <button data-a="force-push" style="display:none">‼️ Forceer push</button>
      </div>
      <small style="color:#64748b">Bestanden: ${DATA_FILE.budget} / ${DATA_FILE.full} · Meta: ${META_FILE.budget} / ${META_FILE.full}</small>
    </div>`;
    document.body.append(back,root);
    return {
      back,root,
      tok:root.querySelector('#se_tok'), gid:root.querySelector('#se_gid'),
      enSel:root.querySelector('#se_enabled'),
      modeSel:root.querySelector('#se_mode'),
      timeInp:root.querySelector('#se_time'),
      msg:root.querySelector('#se_msg'),
      forceBtn:root.querySelector('[data-a="force-push"]')
    };
  }

  // ----- GitHub API -----
  async function api(method, body){
    const tok=localStorage.getItem(TOK), gid=localStorage.getItem(GID);
    if(!tok||!gid) throw new Error("Token/Gist ID ontbreekt");
    const r=await fetch(`https://api.github.com/gists/${gid}`,{
      method, headers:{Authorization:`Bearer ${tok}`,'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined
    });
    if(!r.ok) throw new Error(`GitHub API fout (${r.status})`);
    return await r.json();
  }

  // ----- Helpers -----
  function appKind(){ // 'full' heeft voorrang indien aanwezig
    const hasFull=!!localStorage.getItem(KEYS.full);
    const hasBud =!!localStorage.getItem(KEYS.budget);
    return hasFull?'full':(hasBud?'budget':'budget');
  }
  function stablePayload(key){
    try{ return JSON.stringify(JSON.parse(localStorage.getItem(key)||'{}')); }
    catch{ return '{}' }
  }
  async function sha256Hex(s){
    const d=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function readLocalMeta(kind){
    try{ return JSON.parse(localStorage.getItem(LOCAL_META[kind])||'{}') }catch{ return {} }
  }
  function writeLocalMeta(kind,meta){
    localStorage.setItem(LOCAL_META[kind], JSON.stringify(meta));
  }

  // ----- Pull / Push met meta & conflicts -----
  async function doPull(){
    const kind=appKind(); const files=await api('GET');
    const dataFile=DATA_FILE[kind], metaFile=META_FILE[kind];
    const f=files.files?.[dataFile]; if(!f||!f.content) return {ok:false,msg:`Geen ${dataFile} in Gist`};
    localStorage.setItem(KEYS[kind], f.content);
    const hash=await sha256Hex(stablePayload(KEYS[kind]));
    const metaRemote=files.files?.[metaFile]?.content;
    const meta = metaRemote ? JSON.parse(metaRemote) : {};
    meta.hash=hash; meta.updated_at=new Date().toISOString(); meta.by="pull";
    writeLocalMeta(kind, meta);
    showReloadBar();
    return {ok:true,msg:'Pull OK — herlaad app'};
  }

  async function doPush(opts={force:false}){
    const kind=appKind(); const data=stablePayload(KEYS[kind]);
    const hash=await sha256Hex(data);
    const files=await api('GET');
    const metaFile=META_FILE[kind], dataFile=DATA_FILE[kind];
    const metaRemoteRaw=files.files?.[metaFile]?.content || null;
    const metaLocal=readLocalMeta(kind);
    // Conflict: cloud nieuwer en lokale hash != laatst gesyncte hash
    if(!opts.force && metaRemoteRaw){
      try{
        const mr=JSON.parse(metaRemoteRaw);
        const remoteTime = Date.parse(mr.updated_at||0);
        const localTime  = Date.parse(metaLocal.updated_at||0);
        const diverged = (metaLocal.hash && metaLocal.hash !== hash);
        if(remoteTime>localTime && diverged){
          return {ok:false,conflict:true,msg:'Conflict: cloud is nieuwer en lokale data gewijzigd. Kies "Pull" of "Forceer push".'};
        }
      }catch(_){}
    }
    const by = localStorage.getItem(CUR_USER) || 'onbekend';
    const metaNow={hash, updated_at:new Date().toISOString(), by};
    await api('PATCH',{files:{[dataFile]:{content:data}, [metaFile]:{content:JSON.stringify(metaNow,null,2)}}});
    writeLocalMeta(kind, metaNow);
    return {ok:true,msg:'Push OK'};
  }

  // ----- Auto-sync (dagelijks) -----
  function parseTimeHHMM(s){const m=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s||''); return {h: m?+m[1]:3, min: m?+m[2]:0};}
  function nextRunAt(hhmm){const {h,min}=parseTimeHHMM(hhmm||'03:00'); const now=new Date(), t=new Date(); t.setHours(h,min,0,0); if(t<=now) t.setDate(t.getDate()+1); return t.getTime();}
  async function runAuto(){
    const mode=localStorage.getItem(AUTO.mode)||'pull';
    try{
      if(mode==='pull'){ await doPull(); }
      else if(mode==='push'){ await doPush({force:false}); }
      else { await doPull(); await doPush({force:false}); }
      localStorage.setItem(AUTO.last, String(Date.now()));
    }catch(_){/* stil bij auto */}
  }
  async function autoIfDue(){
    if(localStorage.getItem(AUTO.enabled)!=='1') return;
    const last=+(localStorage.getItem(AUTO.last)||0); if(Date.now()-last>24*3600*1000) await runAuto();
  }
  function scheduler(){
    const tgt=nextRunAt(localStorage.getItem(AUTO.time)||'03:00');
    setTimeout(async ()=>{ await runAuto(); scheduler(); }, Math.max(1000, tgt-Date.now()));
    setInterval(autoIfDue, 15*60*1000);
  }

  // ----- Overlay events -----
  function openSync(){
    const u=ui();
    u.back.onclick=()=>{u.root.remove();u.back.remove()};
    u.root.addEventListener('click', async (e)=>{
      const a=e.target?.dataset?.a; if(!a) return;
      if(a==='save'){
        localStorage.setItem(TOK,u.tok.value.trim());
        localStorage.setItem(GID,u.gid.value.trim());
        localStorage.setItem(AUTO.enabled, u.enSel.value);
        localStorage.setItem(AUTO.mode, u.modeSel.value);
        localStorage.setItem(AUTO.time, u.timeInp.value || '03:00');
        u.msg.textContent='✔️ Instellingen opgeslagen';
      }
      if(a==='test'){
        try{ await api('PATCH',{files:{'ping.txt':{content:'ok '+new Date().toISOString()}}}); u.msg.textContent='✅ Verbinding OK'; }
        catch(err){u.msg.textContent='❌ '+err.message}
      }
      if(a==='pull'){
        try{ const r=await doPull(); u.msg.textContent=r.ok?'✅ '+r.msg:'ℹ️ '+r.msg; }catch(err){u.msg.textContent='❌ '+err.message}
      }
      if(a==='push'){
        try{
          const r=await doPush({force:false});
          if(r.conflict){ u.msg.textContent='⚠️ '+r.msg; u.forceBtn.style.display='inline-block'; }
          else u.msg.textContent=r.ok?'✅ '+r.msg:'ℹ️ '+(r.msg||'');
        }catch(err){u.msg.textContent='❌ '+err.message}
      }
      if(a==='force-push'){
        try{ const r=await doPush({force:true}); u.msg.textContent=r.ok?'✅ '+r.msg:'ℹ️ '+(r.msg||''); u.forceBtn.style.display='none'; }
        catch(err){u.msg.textContent='❌ '+err.message}
      }
    });
  }

  // start
  (window.KGB_READY?window.KGB_READY:Promise.resolve()).finally(()=>{
    ensureBtn(); scheduler(); autoIfDue();
  });
})();
