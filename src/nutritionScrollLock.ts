let locks = 0;
let restore: (()=>void) | undefined;

export function lockNutritionScroll(): ()=>void {
  if (locks++ === 0) {
    const x = window.scrollX, y = window.scrollY;
    const body = document.body, root = document.documentElement;
    const properties = ['position','top','left','right','width','overflow','padding-right'];
    const saved = properties.map(key=>[key,body.style.getPropertyValue(key),body.style.getPropertyPriority(key)]);
    const rootSaved = ['overflow','overscroll-behavior'].map(key=>[key,root.style.getPropertyValue(key),root.style.getPropertyPriority(key)]);
    const gutter = Math.max(0,window.innerWidth-root.clientWidth);
    const padding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.setProperty('position','fixed');
    body.style.setProperty('top',`${-y}px`);
    body.style.setProperty('left',`${-x}px`);
    body.style.setProperty('right','0');
    body.style.setProperty('width','100%');
    body.style.setProperty('overflow','hidden');
    if(gutter)body.style.setProperty('padding-right',`${padding+gutter}px`);
    root.style.setProperty('overflow','hidden');
    root.style.setProperty('overscroll-behavior','none');
    restore = ()=>{
      for (const [key,value,priority] of saved) value ? body.style.setProperty(key,value,priority) : body.style.removeProperty(key);
      for (const [key,value,priority] of rootSaved) value ? root.style.setProperty(key,value,priority) : root.style.removeProperty(key);
      window.scrollTo({left:x,top:y,behavior:'instant'});
    };
  }
  let released=false;
  return ()=>{if(released)return;released=true;if(--locks===0){restore?.();restore=undefined;}};
}
