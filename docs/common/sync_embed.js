(function(){
  const CUR_USER='kgb_auth_current_v1';
  const KEYS={budget:'kgb_finance_budget_only_v1', full:'kgb_finance_full_v1'};
  const TOK='kgb_sync_gist_token', GID='kgb_sync_gist_id'; // geavanceerd
  const $=s=>document.querySelector(s);

  function user(){ return (localStorage.getItem(CUR_USER)||'').trim() || 'Kurt'; }
  function appKind(){ return localStorage.getItem(KEYS.full)?'full':(localStorage.getItem(KEYS.budget)?'budget':'budget'); }
  function keyForKind(){ return appKind()==='full'?KEYS.full:KEYS.budget; }
  function stablePayload(){ try{ return JSON.stringify(JSON.parse(localStorage.getItem(keyForKind())||'{}')); }catch{ return '{}' } }
  async function sha256Hex(s){ const d=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function applyYear(y){ ['kgb_year','kgb_view_year','kgb_selected_year','kgb_active_year','kgb_finance_year','kgb_year_filter'].forEach(k=>localStorage.setItem(k,String(y))); }
  function autoYearFromCurrentData(){ // zet jaar naar laatste (>=2020)
    const raw=localStorage.getItem(keyForKind())||'';
    const yrs=Array.from(String(raw).matchAll(/\b(19|20)\d{2}\b/g)).map(m=>+m[0]).filter(y=>y>=2000&&y<=2100);
    if(!yrs.length) return; const now=(new Date()).getFullYear(); applyYear(Math.min(Math.max(...yrs),now));
  }
  function toast(msg){ let r=$('#kgb_reload_bar'); if(!r){ r=document.createElement('div'); r.id='kgb_reload_bar'; r.style.cssText='position:fixed;left:0;right:0;top:0;z-index:9995;padding:10px 14px;text-align:center;background:#e0f2fe;border-bottom:1px solid #38bdf8;color:#075985'; document.body.appendChild(r); } r.textContent=msg; r.style.display='block'; }

  // --- Export/Import (mobiel-proof) ---
  async function exportSmart(){
    const name=`${appKind()}-${user()}.json`, data=stablePayload(), blob=new Blob([data],{type:'application/json'});
    try{ const file=new File([blob],name,{type:'application/json'});
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:name}); toast('Gedeeld'); return; }
      if(navigator.share){ await navigator.share({title:name, text:data}); toast('Gedeeld als tekst'); return; }
    }catch(_){}
    try{ if(navigator.clipboard && isSecureContext){ await navigator.clipboard.writeText(data); toast('JSON naar klembord'); return; } }catch(_){}
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.target='_blank'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),3e4); toast('Bestand geopend/gedownload');
  }
  async function importFromClipboard(){
    if(!(navigator.clipboard && isSecureContext)) throw new Error('Klembord niet beschikbaar');
    const txt=await navigator.clipboard.readText(); JSON.parse(txt||'{}');
    localStorage.setItem(keyForKind(), txt);
    const hash=await sha256Hex(stablePayload()); localStorage.setItem(`kgb_sync_local_meta_${appKind()}`, JSON.stringify({hash,updated_at:new Date().toISOString(),by:'import-clipboard'}));
    autoYearFromCurrentData(); toast('Import (klembord) OK — herlaad indien nodig');
  }
  async function importFromFile(file){
    const txt=await file.text(); JSON.parse(txt||'{}');
    localStorage.setItem(keyForKind(), txt);
    const hash=await sha256Hex(stablePayload()); localStorage.setItem(`kgb_sync_local_meta_${appKind()}`, JSON.stringify({hash,updated_at:new Date().toISOString(),by:'import-file'}));
    autoYearFromCurrentData(); toast('Import (bestand) OK — herlaad indien nodig');
  }

  // --- (Geavanceerd) Gist Pull/Push – verborgen achter details ---
  async function api(method, body){
    const tok=localStorage.getItem(TOK), gid=localStorage.getItem(GID);
    if(!tok||!gid) throw new Error('Token/Gist ID ontbreekt');
    const r=await fetch(`https://api.github.com/gists/${gid}`,{method,headers:{Authorization:`Bearer ${tok}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    if(!r.ok) throw new Error(`GitHub API ${r.status}`); return await r.json();
  }
  async function pullGist(){
    const u=user(), k=appKind(), f={`${k}-${u}.json`}; const j=await api('GET'); const c=j.files?.[f]?.content||null; if(!c) throw new Error(`Geen ${f} in Gist`);
    localStorage.setItem(keyForKind(), c); const hash=await sha256Hex(stablePayload());
    localStorage.setItem(`kgb_sync_local_meta_${k}`, JSON.stringify({hash,updated_at:new Date().toISOString(),by:'pull'}));
    autoYearFromCurrentData(); toast('Pull OK — herlaad indien nodig');
  }
  async function pushGist(){
    const u=user(), k=appKind(), f={`${k}-${u}.json`}, m=`${k}-${u}.meta.json`; const data=stablePayload(); const hash=await sha256Hex(data);
    await api('PATCH',{files:{[f]:{content:data},[m]:{content:JSON.stringify({hash,updated_at:new Date().toISOString(),by:u})}}}); toast('Push OK');
  }

  // --- UI: grote Export/Import + geavanceerd-blok ---
  function ensureButtons(){
    if($('#kgb_export_btn')) return;
    const barStyle='position:fixed;top:10px;right:10px;z-index:9996';
    const mk=(id,txt,dx)=>{const b=document.createElement('button'); b.id=id;b.textContent=txt;b.style.cssText=`${barStyle};right:${dx}px;padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer`; document.body.appendChild(b); return b;};
    const exp=mk('kgb_export_btn','💾 Export',190), imp=mk('kgb_import_btn','📥 Import',100), sync=mk('kgb_sync_btn','⚙️ Meer',10);
    exp.onclick=()=>exportSmart();
    imp.onclick=()=>{ const f=document.createElement('input'); f.type='file'; f.accept='application/json,.json'; f.onchange=e=>{const file=e.target.files?.[0]; if(file) importFromFile(file).catch(err=>toast('Fout: '+err.message));}; f.click(); };
    sync.onclick=openPanel;
  }

  function openPanel(){
    const back=document.createElement('div'); back.style.cssText='position:fixed;inset:0;background:rgba(2,6,23,.35);backdrop-filter:blur(2px);z-index:9996';
    const box=document.createElement('div'); box.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9997';
    const card=document.createElement('div'); card.style.cssText='width:min(94vw,560px);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 12px 40px rgba(2,6,23,.18);padding:16px';
    card.innerHTML=`<h3 style="margin:0 0 8px">📦 Export / Import — <b>${user()}</b> (${appKind()})</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">
        <button id="ex_btn">💾 Export (Delen/Bestanden)</button>
        <button id="im_btn">📥 Import (bestand)</button>
        <button id="clip_btn">📋 Import (klembord)</button>
        <input id="im_file" type="file" accept="application/json,.json" style="display:none">
      </div>
      <details style="margin-top:6px"><summary>Geavanceerd: GitHub Gist (optioneel)</summary>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0">
          <label style="flex:1 1 220px;display:flex;flex-direction:column;gap:6px">Gist Token<input id="se_tok" type="password" value="${localStorage.getItem(TOK)||''}" placeholder="ghp_..."></label>
          <label style="flex:1 1 220px;display:flex;flex-direction:column;gap:6px">Gist ID<input id="se_gid" type="text" value="${localStorage.getItem(GID)||''}" placeholder="xxxxxxxxxxxxxxxx"></label>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0">
          <button id="save_gist">Opslaan</button>
          <button id="pull_gist">⬇️ Pull</button>
          <button id="push_gist">⬆️ Push</button>
        </div>
      </details>
      <div style="margin-top:8px;color:#334155">Tip: op gsm kies je bij Export **Bestanden** of **Drive**. Daarna op gsm: Import → kies dat bestand.</div>`;
    box.appendChild(card); document.body.append(back,box);
    back.onclick=()=>{box.remove();back.remove()};
    card.querySelector('#ex_btn').onclick=()=>exportSmart().catch(e=>toast('Fout: '+e.message));
    card.querySelector('#im_btn').onclick=()=>card.querySelector('#im_file').click();
    card.querySelector('#im_file').onchange=e=>{const f=e.target.files?.[0]; if(f) importFromFile(f).catch(err=>toast('Fout: '+err.message));};
    card.querySelector('#clip_btn').onclick=()=>importFromClipboard().catch(e=>toast('Fout: '+e.message));
    card.querySelector('#save_gist').onclick=()=>{localStorage.setItem(TOK,card.querySelector('#se_tok').value.trim()); localStorage.setItem(GID,card.querySelector('#se_gid').value.trim()); toast('Gist opgeslagen');};
    card.querySelector('#pull_gist').onclick=()=>pullGist().catch(e=>toast('Fout: '+e.message));
    card.querySelector('#push_gist').onclick=()=>pushGist().catch(e=>toast('Fout: '+e.message));
  }

  (window.KGB_READY?window.KGB_READY:Promise.resolve()).finally(()=>{ ensureButtons(); try{ autoYearFromCurrentData(); }catch{} });
})();
