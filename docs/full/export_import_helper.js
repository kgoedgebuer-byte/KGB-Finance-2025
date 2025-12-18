(function(){
  if(window.KGBExport) return;
  window.KGBExport = {
    exportAll: function(data){
      const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
      const a = document.createElement('a');
      a.click();
      URL.revokeObjectURL(a.href);
    },
    importAll: async function(file){
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if(!data) throw new Error('leeg bestand');
        document.dispatchEvent(new CustomEvent('kgb:imported', {detail:{data}}));
        alert('✅ Import geslaagd');
      }catch(e){ alert('❌ Ongeldig JSON-bestand'); console.error(e); }
    }
  };
})();
