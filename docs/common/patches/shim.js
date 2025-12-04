(()=>{try{
  // neutraliseer stopPropagation/preventDefault voor click/pointer/touch
  const TYPES=new Set(['click','pointerdown','pointerup','mousedown','mouseup','touchstart','touchend']);
  try{
    const pd=Event.prototype.preventDefault;
    Event.prototype.preventDefault=function(){ try{ if(TYPES.has(this.type)) return; }catch(_){ } try{ return pd.apply(this,arguments);}catch(_){ } };
    Event.prototype.stopPropagation=function(){};
    Event.prototype.stopImmediatePropagation=function(){};
  }catch(_){}
  // host klikbaar houden
  try{ (document.getElementById('root')||document.getElementById('app')||document.querySelector('main')||document.body).style.pointerEvents='auto'; }catch(_){}
  console.log('common/patches/shim.js actief');
}catch(e){console.error(e)}})();
