(function(){
  const APP = document.body.dataset.app || 'kgb';
  const YEAR_KEY = () => {
    const y = document.querySelector('[data-year]')?.value || new Date().getFullYear();
    return `${APP}-${y}`;
  };

  function save(data){
    try {
      localStorage.setItem(YEAR_KEY(), JSON.stringify(data));
      if ('indexedDB' in window) {
        const r = indexedDB.open('kgb-db',1);
        r.onupgradeneeded=e=>e.target.result.createObjectStore('data');
        r.onsuccess=e=>{
          const db=e.target.result;
          const tx=db.transaction('data','readwrite');
          tx.objectStore('data').put(data,YEAR_KEY());
        };
      }
    } catch(e){ console.warn('KGB save fail',e); }
  }

  function load(){
    try {
      const d = localStorage.getItem(YEAR_KEY());
      return d ? JSON.parse(d) : null;
    } catch(e){ return null; }
  }

  window.KGB_STORAGE = { save, load };
})();
