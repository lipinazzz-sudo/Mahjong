
/* Stable game viewport:
   Keyboard iOS/Android boleh mengecilkan visualViewport, tetapi meja Mahjong
   tetap memakai tinggi viewport yang dikunci saat layar game aktif. */
(function(){
  const root=document.documentElement;
  const gameScreen=()=>document.getElementById('screen-game');
  let lockedHeight=0;

  function keyboardOpen(){
    const input=document.activeElement;
    return !!(input&&input.id==='game-chat-input');
  }

  function lockGameHeight(force=false){
    const game=gameScreen();
    if(!game)return;
    if(!force&&keyboardOpen())return;

    const h=Math.max(1,Math.round(window.innerHeight||window.visualViewport?.height||0));
    if(h<=0)return;

    lockedHeight=h;
    root.style.setProperty('--mahjong-game-height',`${h}px`);
  }

  function refresh(){
    const game=gameScreen();
    if(!game)return;
    if(game.classList.contains('active')||getComputedStyle(game).display!=='none'){
      lockGameHeight(false);
    }
  }

  function scrollTop(){
    try{window.scrollTo(0,0)}catch(e){}
    try{document.documentElement.scrollTop=0;document.body.scrollTop=0}catch(e){}
  }

  document.addEventListener('focusin',e=>{
    if(e.target?.id!=='game-chat-input')return;
    if(!lockedHeight)lockGameHeight(true);
    scrollTop();
    requestAnimationFrame(scrollTop);
    setTimeout(scrollTop,80);
  },{passive:true});

  document.addEventListener('focusout',e=>{
    if(e.target?.id!=='game-chat-input')return;
    setTimeout(()=>{
      lockGameHeight(true);
      scrollTop();
    },120);
  },{passive:true});

  window.addEventListener('orientationchange',()=>{
    setTimeout(()=>lockGameHeight(true),180);
  },{passive:true});

  window.addEventListener('resize',()=>{
    if(!keyboardOpen())lockGameHeight(true);
  },{passive:true});

  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',()=>{
      if(!keyboardOpen()&&!lockedHeight)lockGameHeight(true);
      if(keyboardOpen())scrollTop();
    },{passive:true});
  }

  const observer=new MutationObserver(()=>{
    const game=gameScreen();
    if(game?.classList.contains('active')&&!keyboardOpen()){
      if(!lockedHeight)lockGameHeight(true);
    }
  });
  observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});

  window.addEventListener('pageshow',()=>lockGameHeight(true),{passive:true});
  document.addEventListener('DOMContentLoaded',()=>lockGameHeight(true),{once:true});
  setTimeout(()=>lockGameHeight(true),0);
})();
