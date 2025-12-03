/* KGB kill-SW: verwijder alle caches en schrijf jezelf uit */
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil((async()=>{
  try{ const names=await caches.keys(); await Promise.all(names.map(n=>caches.delete(n))); }catch(e){}
  try{ await self.registration.unregister(); }catch(e){}
  try{ const cs=await self.clients.matchAll({type:"window"}); cs.forEach(c=>c.navigate(c.url)); }catch(e){}
})()));
