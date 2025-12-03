(function(){
  const CUR_USER='kgb_auth_current_v1';
  const KEYS={budget:'kgb_finance_budget_only_v1', full:'kgb_finance_full_v1'};
  const OVERRIDE='kgb_sync_app_override';
  const LS_GDRIVE_CID='kgb_gdrive_client_id';
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
  const DRIVE_FOLDER='KGB Finance 2025';
  const URLS={full:'/KGB-Finance-2025/full/', budget:'/KGB-Finance-2025/budget/'};
  const $=s=>document.querySelector(s);

  function user(){ return (localStorage.getItem(CUR_USER)||'').trim() || 'Kurt'; }
  function appKind(){
    const ov=(localStorage.getItem(OVERRIDE)||'').trim();
    if(ov==='full'||ov==='budget') return ov;
    const p=(location.pathname||'').toLowerCase();
    if(p.includes('/full/')) return 'full';
    if(p.includes('/budget/')) return 'budget';
    return localStorage.getItem(KEYS.full)?'full':'budget';
  }
  function setAppKind(k){ if(k==='full'||k==='budget'){ localStorage.setItem(OVERRIDE,k); toast('Dataset → '+k); } }
  function keyForKind(){ return appKind()==='full'?KEYS.full:KEYS.budget; }
  function stablePayload(){ try{ return JSON.stringify(JSON.parse(localStorage.getItem(keyForKind())||'{}')); }catch{ return '{}' } }
  function isValidJSON(t){ try{ JSON.parse(t); return true; }catch{ return false; } }
  async function sha256Hex(s){ const d=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function applyYear(y){ ['kgb_year','kgb_view_year','kgb_selected_year','kgb_active_year','kgb_finance_year','kgb_year_filter'].forEach(k=>localStorage.setItem(k,String(y))); }
  function autoYearFromCurrentData(){
    const raw=localStorage.getItem(keyForKind())||'';
    const yrs=Array.from(String(raw).matchAll(/\b(19|20)\d{2}\b/g)).map(m=>+m[0]).filter(y=>y>=2000&&y<=2100);
    if(!yrs.length) return; const now=(new Date()).getFullYear(); applyYear(Math.min(Math.max(...yrs),now));
  }
  function toast(msg){
    let r=$('#kgb_reload_bar');
    if(!r){ r=document.createElement('div'); r.id='kgb_reload_bar'; r.style.cssText='position:fixed;left:0;right:0;top:0;z-index:9995;padding:10px 14px;text-align:center;background:#e0f2fe;border-bottom:1px solid #38bdf8;color:#075985'; document.body.appendChild(r); }
    r.textContent=msg; r.style.display='block';
  }

  function normalizeJsonText(txt){
    let s=(typeof txt==='string'?txt:String(txt||'')); s=s.replace(/^\uFEFF/, '').trim();
    if(s.startsWith('"')&&s.endsWith('"')){ try{s=JSON.parse(s);}catch{} }
    if(!isValidJSON(s)){ const i=s.indexOf('{'), j=s.lastIndexOf('}'); if(i>=0&&j>i) s=s.slice(i,j+1); }
    return s;
  }
  async function importCore(txt, via){
    const norm=normalizeJsonText(txt);
    try{ JSON.parse(norm||'{}'); }catch{ alert('Ongeldig JSON. Kies KGB-full-… of KGB-budget-….json'); throw new Error('invalid-json'); }
    localStorage.setItem(keyForKind(), norm);
    const hash=await sha256Hex(stablePayload());
    localStorage.setItem(`kgb_sync_local_meta_${appKind()}`, JSON.stringify({hash,updated_at:new Date().toISOString(),by:`import-${via}`}));
    autoYearFromCurrentData(); toast('Import OK — herlaad indien nodig');
  }
  async function importFromFile(file){ const txt=await file.text(); await importCore(txt,'file'); }
  async function exportSmart(){
    const name=`KGB-${appKind()}-${user()}.json`, data=stablePayload(), blob=new Blob([data],{type:'application/json'});
    try{ const file=new File([blob],name,{type:'application/json'});
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:name}); toast('Gedeeld'); return; }
      if(navigator.share){ await navigator.share({title:name, text:data}); toast('Gedeeld als tekst'); return; }
    }catch(_){}
    try{ if(navigator.clipboard && isSecureContext){ await navigator.clipboard.writeText(data); toast('Naar klembord'); return; } }catch(_){}
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.target='_blank'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),3e4); toast('Bestand gedownload');
  }

  // ---- Google Drive auth ----
  let accessToken=null;
  function gClientId(){ return (localStorage.getItem(LS_GDRIVE_CID)||'').trim(); }
  function ensureGIS(){
    return new Promise((res,rej)=>{
      if(window.google && google.accounts && google.accounts.oauth2){ res(); return; }
      const s=document.createElement('script'); s.src='https://accounts.google.com/gsi/client'; s.async=true; s.defer=true;
      s.onload=()=>res(); s.onerror=()=>rej(new Error('Google Identity laden mislukt')); document.head.appendChild(s);
    });
  }
  async function requestToken(promptUser){
    await ensureGIS();
    const cid=gClientId(); if(!cid) throw new Error('Google Client ID ontbreekt');
    return new Promise((resolve,reject)=>{
      const tc=google.accounts.oauth2.initTokenClient({
        client_id: cid, scope: DRIVE_SCOPE, prompt: promptUser?'consent':'',
        callback: (resp)=>{ if(resp?.access_token){ accessToken=resp.access_token; resolve(accessToken); } else reject(new Error('Geen access token')); }
      });
      tc.requestAccessToken();
    });
  }
  async function ensureAuthed(){ if(accessToken) return accessToken; try{ return await requestToken(false);}catch{ return await requestToken(true);} }
  function clearAuth(){ try{ if(window.google?.accounts?.oauth2?.revoke && accessToken){ google.accounts.oauth2.revoke(accessToken, ()=>{}); } }catch(_){ } accessToken=null; }

  async function driveFetch(path,opt={}){
    await ensureAuthed();
    const r=await fetch('https://www.googleapis.com/drive/v3'+path,{...opt,headers:{...(opt.headers||{}),Authorization:'Bearer '+accessToken}});
    if(!r.ok){
      let det=''; try{ const ej=await r.json(); det=ej.error?.message||JSON.stringify(ej);}catch(_){ det=''; }
      throw new Error(`Drive ${r.status}${det?(' — '+det):''}`);
    }
    return await r.json();
  }
  async function driveFindFolderId(){ const q=encodeURIComponent(`name='${DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`); const j=await driveFetch('/files?q='+q+'&fields=files(id,name)'); return j.files?.[0]?.id||null; }
  async function driveEnsureFolder(){
    const id=await driveFindFolderId(); if(id) return id;
    const r=await fetch('https://www.googleapis.com/drive/v3/files',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({name:DRIVE_FOLDER,mimeType:'application/vnd.google-apps.folder'})});
    if(!r.ok){ let det=''; try{const ej=await r.json(); det=ej.error?.message||JSON.stringify(ej);}catch(_){ } throw new Error('Folder maken '+r.status+(det?(' — '+det):'')); }
    return (await r.json()).id;
  }
  async function driveFindFileId(name){ const q=encodeURIComponent(`name='${name}' and trashed=false`); const j=await driveFetch('/files?q='+q+'&fields=files(id,name,modifiedTime,size,parents)'); return j.files?.[0]?.id||null; }

  async function driveDownload(name){
    const id=await driveFindFileId(name); if(!id) return null;
    const r=await fetch('https://www.googleapis.com/drive/v3/files/'+id+'?alt=media',{headers:{Authorization:'Bearer '+accessToken}});
    if(!r.ok){ let det=''; try{const ej=await r.json(); det=ej.error?.message||JSON.stringify(ej);}catch(_){ } throw new Error('Download '+r.status+(det?(' — '+det):'')); }
    return await r.text();
  }

  // Robuuste upload: probeer update, zo niet -> create
  async function driveUpload(name, content){
    const boundary='-------314159265358979323846';
    const delim='\r\n--'+boundary+'\r\n', close='\r\n--'+boundary+'--';
    const folderId=await driveEnsureFolder();
    const existId=await driveFindFileId(name);

    const metaCreate=JSON.stringify({name, parents:[folderId]});
    const metaUpdate=JSON.stringify({name}); // geen parents bij PATCH

    const bodyCreate=delim+'Content-Type: application/json; charset=UTF-8\r\n\r\n'+metaCreate+delim+'Content-Type: application/json\r\n\r\n'+content+close;
    const bodyUpdate=delim+'Content-Type: application/json; charset=UTF-8\r\n\r\n'+metaUpdate+delim+'Content-Type: application/json\r\n\r\n'+content+close;

    async function doReq(method,url,body){
      const r=await fetch(url,{method,headers:{Authorization:'Bearer '+accessToken,'Content-Type':'multipart/related; boundary='+boundary},body});
      if(!r.ok){ let det=''; try{const ej=await r.json(); det=ej.error?.message||JSON.stringify(ej);}catch(_){ }
        const msg=`Upload ${r.status}${det?(' — '+det):''}`;
        // 401/403 -> reauth en nog eens
        if(r.status===401||r.status===403){ clearAuth(); await ensureAuthed(); throw new Error(msg); }
        throw new Error(msg);
      }
      return await r.json().catch(()=>({}));
    }

    if(existId){
      try{ await doReq('PATCH','https://www.googleapis.com/upload/drive/v3/files/'+existId+'?uploadType=multipart', bodyUpdate); return existId; }
      catch(e){ console.warn('PATCH mislukt, probeer create:', e.message); }
    }
    const j=await doReq('POST','https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', bodyCreate);
    return j.id||existId||null;
  }

  async function drivePull(){ const name=`KGB-${appKind()}-${user()}.json`; const txt=await driveDownload(name); if(!txt) throw new Error('Geen bestand op Drive: '+name+'\nEerst op Mac: Drive Push'); await importCore(txt,'drive-pull'); toast('Drive Pull OK'); }
  async function drivePush(){ const name=`KGB-${appKind()}-${user()}.json`, payload=stablePayload(); const id=await driveUpload(name, payload); if(!id) throw new Error('Upload mislukte'); const hash=await sha256Hex(payload); localStorage.setItem(`kgb_sync_local_meta_${appKind()}`, JSON.stringify({hash,updated_at:new Date().toISOString(),by:'drive-push'})); toast('Drive Push OK — '+name); }
  async function driveOpen(){
    try{ await ensureAuthed(); }catch(_){}
    let url='https://drive.google.com/drive/my-drive';
    try{ const fid=await driveFindFolderId(); if(fid) url='https://drive.google.com/drive/folders/'+fid; const id=await driveFindFileId(`KGB-${appKind()}-${user()}.json`); if(id) url='https://drive.google.com/file/d/'+id+'/view'; }catch(_){}
    window.open(url,'_blank');
  }

  function ensureButtons(){
    if($('#kgb_sync_btn')) return;
    const mk=(id,txt,right)=>{const b=document.createElement('button'); b.id=id;b.textContent=txt;b.style.cssText=`position:fixed;top:10px;right:${right}px;z-index:9996;padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer`; document.body.appendChild(b); return b;};
    mk('kgb_export_btn','💾 Export',330).onclick=()=>exportSmart().catch(e=>toast('Fout: '+e.message));
    mk('kgb_import_btn','📥 Import',240).onclick=()=>{ const f=document.createElement('input'); f.type='file'; f.accept='application/json,.json'; f.onchange=e=>{const file=e.target.files?.[0]; if(file) importFromFile(file).catch(err=>toast('Fout: '+err.message));}; f.click(); };
    mk('kgb_sync_btn','☁️ Drive',90).onclick=openPanel;
  }

  function openPanel(){
    const kind=appKind(), u=user();
    const back=document.createElement('div'); back.style.cssText='position:fixed;inset:0;background:rgba(2,6,23,.35);backdrop-filter:blur(2px);z-index:9996';
    const box=document.createElement('div'); box.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9997';
    const card=document.createElement('div'); card.style.cssText='width:min(94vw,680px);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 12px 40px rgba(2,6,23,.18);padding:16px;position:relative';
    const cid=localStorage.getItem(LS_GDRIVE_CID)||'';
    card.innerHTML=`<button id="kgb_close" title="Sluiten" style="position:absolute;right:10px;top:10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;padding:2px 8px;cursor:pointer">✕</button>
      <h3 style="margin:0 0 8px">☁️ Google Drive — <b>${u}</b> (<span id="kgb_kind">${kind}</span>) <span id="gd_status" style="float:right;color:#334155">Status: onbekend</span></h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0">
        <span>Dataset:</span>
        <button id="kgb_kind_budget">Budget</button>
        <button id="kgb_kind_full">Full</button>
        <a href="${URLS.full}" target="_blank" style="margin-left:12px">Open Full</a>
        <a href="${URLS.budget}" target="_blank">Open Budget</a>
      </div>
      <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0">
        <label style="flex:1 1 260px;display:flex;flex-direction:column;gap:6px">Google Client ID<input id="gd_cid" type="text" value="${cid}" placeholder="xxx.apps.googleusercontent.com"></label>
      </div>
      <div class="buttons" style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="gd_save">Opslaan ID</button>
        <button id="gd_login">Inloggen</button>
        <button id="gd_logout">Log uit</button>
        <button id="gd_push">⬆️ Drive Push</button>
        <button id="gd_pull">⬇️ Drive Pull</button>
        <button id="gd_open">Open in Drive</button>
        <button id="gd_diag">Diagnose</button>
      </div>
      <hr/>
      <div class="buttons" style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="ex_btn">💾 Export</button>
        <button id="im_btn">📥 Import (bestand)</button>
        <button id="clip_btn">📋 Import (klembord)</button>
        <input id="im_file" type="file" accept="application/json,.json" style="display:none">
      </div>
      <div id="gd_log" style="margin-top:8px;color:#334155;white-space:pre-wrap"></div>
      <div style="margin-top:8px;color:#334155">Bestand: <code>KGB-${kind}-${u}.json</code> in map <b>${DRIVE_FOLDER}</b></div>`;
    box.appendChild(card); document.body.append(back,box);

    const closeAll=()=>{ box.remove(); back.remove(); };
    back.onclick=closeAll;
    document.addEventListener('keydown', function onEsc(e){ if(e.key==='Escape'){ closeAll(); document.removeEventListener('keydown', onEsc); }});

    const q=s=>card.querySelector(s);
    const log=(m)=>{ q('#gd_log').textContent=String(m||''); };
    const updKind=()=>{ q('#kgb_kind').textContent=appKind(); };
    const setStatus=(t)=>{ q('#gd_status').textContent='Status: '+t; };

    q('#kgb_close').onclick=closeAll;
    q('#kgb_kind_budget').onclick=()=>{ setAppKind('budget'); updKind(); };
    q('#kgb_kind_full').onclick=()=>{ setAppKind('full'); updKind(); };
    q('#gd_save').onclick=()=>{ localStorage.setItem(LS_GDRIVE_CID, q('#gd_cid').value.trim()); toast('Client ID opgeslagen'); };

    q('#gd_login').onclick=async ()=>{ try{ toast('Inloggen…'); await requestToken(true); setStatus('ingelogd'); log('OK: token verkregen'); }catch(e){ setStatus('fout'); log(e.message); toast('Fout: '+e.message); } };
    q('#gd_logout').onclick=()=>{ clearAuth(); setStatus('uitgelogd'); log('Uitgelogd'); toast('Uitgelogd'); };

    q('#gd_push').onclick=async ()=>{ try{ setStatus('bezig'); log('Drive Push…'); await ensureAuthed(); await drivePush(); setStatus('ingelogd'); log('Push OK'); }catch(e){ setStatus('fout'); log('Push fout: '+e.message); toast('Fout: '+e.message); } };
    q('#gd_pull').onclick=async ()=>{ try{ setStatus('bezig'); log('Drive Pull…'); await ensureAuthed(); await drivePull(); setStatus('ingelogd'); log('Pull OK'); }catch(e){ setStatus('fout'); log('Pull fout: '+e.message); toast('Fout: '+e.message); } };
    q('#gd_open').onclick=async ()=>{ try{ await ensureAuthed(); await driveOpen(); setStatus('ingelogd'); }catch(e){ setStatus('fout'); log(e.message); toast('Fout: '+e.message); } };
    q('#gd_diag').onclick=async ()=>{ 
      try{
        await ensureAuthed();
        const who=await driveFetch('/about?fields=user'); 
        const fid=await driveFindFolderId(); 
        log('Diag:\n- user: '+JSON.stringify(who)+'\n- folderId: '+(fid||'n/a'));
        setStatus('ingelogd');
      }catch(e){ setStatus('fout'); log('Diag fout: '+e.message); toast('Fout: '+e.message); }
    };

    q('#ex_btn').onclick=()=>exportSmart().catch(e=>toast('Fout: '+e.message));
    q('#im_btn').onclick=()=>q('#im_file').click();
    q('#im_file').onchange=e=>{const f=e.target.files?.[0]; if(f) importFromFile(f).catch(err=>toast('Fout: '+err.message));};
    q('#clip_btn').onclick=()=>navigator.clipboard?.readText().then(t=>importCore(t,'clipboard')).catch(e=>toast('Fout: '+e.message));
  }

  (window.KGB_READY?window.KGB_READY:Promise.resolve()).finally(()=>{ 
    ensureButtons();
    try{ autoYearFromCurrentData(); }catch{}
  });
})();
