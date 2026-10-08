/* Mahjong DJ v26 feature layer
 * Scope: AI difficulty, main-menu info, local statistics, lightweight achievements.
 * Does not replace the existing game core; it integrates through small wrappers.
 */
(function(){
  'use strict';

  const NS = window.MahjongV26 = window.MahjongV26 || {};
  const AI_KEY = 'mahjongDJAiLevelV1';
  const STATS_KEY = 'mahjongDJStatsV1';
  const VALID_LEVELS = ['easy','normal','hard','expert'];

  const AI_LEVELS = {
    easy:   {label:'Easy',   thinkMs:1500, waitWeight:0,  safetyWeight:0, callThreshold:999, noise:2.2},
    normal: {label:'Normal', thinkMs:1900, waitWeight:7, safetyWeight:0, callThreshold:2.0, noise:0.65},
    hard:   {label:'Hard',   thinkMs:2400, waitWeight:14, safetyWeight:1.2, callThreshold:0.8, noise:0.25},
    expert: {label:'Expert', thinkMs:2900, waitWeight:22, safetyWeight:3.2, callThreshold:0.2, noise:0.08}
  };

  const DEFAULT_STATS = {
    gamesPlayed:0, wins:0, losses:0, draws:0,
    tsumoWins:0, ronWins:0,
    highestFan:0, highestScore:15000,
    totalFinalScore:0, finalScoreSamples:0,
    currentWinStreak:0, bestWinStreak:0,
    unlocked:[]
  };

  function safeRead(key, fallback){
    try{
      const raw=localStorage.getItem(key);
      if(!raw)return fallback;
      const parsed=JSON.parse(raw);
      return parsed && typeof parsed==='object' ? parsed : fallback;
    }catch{return fallback}
  }

  function safeWrite(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));}catch{}
  }

  function normalizeStats(raw){
    const s={...DEFAULT_STATS,...(raw&&typeof raw==='object'?raw:{})};
    s.unlocked=Array.isArray(s.unlocked)?[...new Set(s.unlocked.map(String))]:[];
    for(const k of ['gamesPlayed','wins','losses','draws','tsumoWins','ronWins','highestFan','highestScore','totalFinalScore','finalScoreSamples','currentWinStreak','bestWinStreak']){
      s[k]=Number.isFinite(Number(s[k]))?Number(s[k]):DEFAULT_STATS[k];
    }
    return s;
  }

  let stats=normalizeStats(safeRead(STATS_KEY,{}));
  let activeMatchId=null;
  let matchStartedAt=0;
  let matchRecorded=false;
  let sessionTsumoWins=0;
  let sessionRonWins=0;
  let sessionHighestFan=0;

  function localSeat(){
    const n=Number(window.mp?.seat);
    return Number.isInteger(n)&&n>=0&&n<4?n:0;
  }

  function beginMatchSession(){
    activeMatchId='v26-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
    matchStartedAt=Date.now();
    matchRecorded=false;
    sessionTsumoWins=0;
    sessionRonWins=0;
    sessionHighestFan=0;
  }

  function currentAiLevel(){
    try{
      const stored=String(localStorage.getItem(AI_KEY)||'').toLowerCase();
      return VALID_LEVELS.includes(stored)?stored:'normal';
    }catch{return'normal'}
  }

  let aiLevel=currentAiLevel();
  NS.aiLevel=aiLevel;
  NS.aiLevels=AI_LEVELS;

  function setAiLevel(level){
    level=String(level||'').toLowerCase();
    if(!VALID_LEVELS.includes(level))return;
    aiLevel=level;
    NS.aiLevel=level;
    try{localStorage.setItem(AI_KEY,level)}catch{}
    v26RenderAiLevel();
  }

  function v26Lang(){
    return String(window.hkLanguage||'id').toLowerCase()==='en'?'en':'id';
  }

  function tr(id){
    const en={
      infoTitle:'Info & How to Play',
      infoIntro:'A compact guide for Hong Kong Mahjong.',
      infoBasic:'How to Play',
      infoBasicText:'Draw a tile, choose a tile to discard, then continue clockwise.',
      infoActions:'Actions',
      infoActionsText:'Chi follows the previous player, Pon uses a matching pair, Kan uses four matching tiles, Ron wins from a discard, and Tsumo wins from your draw.',
      infoScore:'Score & Fan',
      infoScoreText:'A winning hand receives Fan based on the combinations detected by the game. Score is shown after the hand.',
      infoMatch:'Match',
      infoMatchText:'A standard match runs through four rounds. Final standings are shown at the end.',
      infoMulti:'Multiplayer',
      infoMultiText:'Host controls the authoritative game state. Reconnect can restore a reserved seat.',
      close:'Close',
      back:'Back',
      backProfile:'Back to Profile',
      tutorial:'Interactive Tutorial',
      tutorialStep:'Step',
      prev:'Back',
      next:'Next',
      tutorial1Title:'Build a Winning Hand',
      tutorial1Text:'A basic winning hand is 4 melds plus 1 pair. Melds can be sequences or triplets; the exact scoring depends on the hand.',
      tutorial2Title:'Draw Then Discard',
      tutorial2Text:'On your turn, draw one tile, check what improves the hand, then discard one tile. The tile you discard may also give another player a Ron or call.',
      tutorial3Title:'Chi, Pon, Kan',
      tutorial3Text:'Chi uses a sequence with the previous player\'s discard. Pon uses three matching tiles. Kan uses four matching tiles.',
      tutorial4Title:'Ron or Tsumo',
      tutorial4Text:'Ron wins from another player\'s discard. Tsumo wins when your own draw completes the hand.',
      tutorial5Title:'Fan & Score',
      tutorial5Text:'After a win, the game evaluates the hand and displays its Fan and score. Stronger combinations can produce higher Fan.',
      tutorial6Title:'Multiplayer Table',
      tutorial6Text:'In multiplayer, each player has a seat around the same table. The host keeps the authoritative game state while players reconnect through their reserved seat.',
      stats:'Statistics',
      games:'Games',
      wins:'Wins',
      losses:'Losses',
      draws:'Draws',
      winRate:'Win Rate',
      tsumo:'Tsumo',
      ron:'Ron',
      highestFan:'Highest Fan',
      highestScore:'Highest Score',
      avgScore:'Average Final Score',
      achievements:'Achievements',
      locked:'Locked',
      aiTitle:'AI Level',
      aiSub:'Choose the challenge level. AI behaviour changes automatically.',
      easy:'Easy',
      normal:'Normal',
      hard:'Hard',
      expert:'Expert',
      easyDesc:'Simple decisions. Best for learning.',
      normalDesc:'Balanced hand efficiency.',
      hardDesc:'Stronger efficiency, waits and calls.',
      expertDesc:'Most calculated decisions and conservative discards.',
      selected:'Selected',
      viewStats:'View Statistics',
      info:'Info',
      howToPlay:'Cara Bermain'
    };
    const idText={
      infoTitle:'Info & Cara Bermain',
      infoIntro:'Panduan ringkas Hong Kong Mahjong.',
      infoBasic:'Cara Bermain',
      infoBasicText:'Ambil tile, pilih tile untuk dibuang, lalu permainan berlanjut searah jarum jam.',
      infoActions:'Tindakan',
      infoActionsText:'Chi mengikuti pemain sebelumnya, Pon memakai sepasang tile yang sama, Kan memakai empat tile yang sama, Ron menang dari tile buangan, dan Tsumo menang dari tile yang Anda ambil.',
      infoScore:'Score & Fan',
      infoScoreText:'Hand kemenangan mendapat Fan berdasarkan kombinasi yang terdeteksi game. Score ditampilkan setelah ronde selesai.',
      infoMatch:'Pertandingan',
      infoMatchText:'Pertandingan standar berjalan selama empat ronde. Peringkat akhir ditampilkan setelah selesai.',
      infoMulti:'Multiplayer',
      infoMultiText:'Host memegang state game authoritative. Reconnect dapat memulihkan kursi yang masih dicadangkan.',
      close:'Tutup',
      back:'Kembali',
      backProfile:'Kembali ke Profile',
      tutorial:'Tutorial Interaktif',
      tutorialStep:'Langkah',
      prev:'Kembali',
      next:'Lanjut',
      tutorial1Title:'Membentuk Hand Menang',
      tutorial1Text:'Hand menang dasar terdiri dari 4 meld dan 1 pair. Meld bisa berupa sequence atau triplet; nilai akhirnya tetap mengikuti kombinasi hand yang terdeteksi game.',
      tutorial2Title:'Ambil Lalu Buang',
      tutorial2Text:'Saat giliran Anda, ambil satu tile, lihat tile mana yang paling membantu hand, lalu buang satu tile. Buangan Anda juga bisa memberi pemain lain kesempatan Ron atau call.',
      tutorial3Title:'Chi, Pon, Kan',
      tutorial3Text:'Chi memakai sequence dari buangan pemain sebelumnya. Pon memakai tiga tile yang sama. Kan memakai empat tile yang sama.',
      tutorial4Title:'Ron atau Tsumo',
      tutorial4Text:'Ron menang dari tile buangan pemain lain. Tsumo menang ketika tile yang Anda ambil sendiri melengkapi hand.',
      tutorial5Title:'Fan & Score',
      tutorial5Text:'Setelah menang, game menghitung kombinasi hand lalu menampilkan Fan dan score. Kombinasi yang lebih kuat dapat menghasilkan Fan lebih tinggi.',
      tutorial6Title:'Meja Multiplayer',
      tutorial6Text:'Dalam multiplayer, setiap pemain menempati kursi di meja yang sama. Host menjaga state game authoritative dan pemain dapat reconnect ke kursi yang masih dicadangkan.',
      stats:'Statistik',
      games:'Game',
      wins:'Menang',
      losses:'Kalah',
      draws:'Draw',
      winRate:'Win Rate',
      tsumo:'Tsumo',
      ron:'Ron',
      highestFan:'Fan Tertinggi',
      highestScore:'Score Tertinggi',
      avgScore:'Rata-rata Score Akhir',
      achievements:'Achievement',
      locked:'Terkunci',
      aiTitle:'Level AI',
      aiSub:'Pilih tingkat tantangan. Perilaku AI akan berubah otomatis.',
      easy:'Easy',
      normal:'Normal',
      hard:'Hard',
      expert:'Expert',
      easyDesc:'Keputusan sederhana. Cocok untuk belajar.',
      normalDesc:'Efisiensi hand yang seimbang.',
      hardDesc:'Efisiensi, wait, dan call lebih kuat.',
      expertDesc:'Keputusan paling terukur dan buangan konservatif.',
      selected:'Dipilih',
      viewStats:'Lihat Statistik',
      info:'Info',
      howToPlay:'Cara Bermain'
    };
    return (v26Lang()==='en'?en:idText)[id]||id;
  }

  function openModal(id){const e=document.getElementById(id);if(e){e.hidden=false;e.style.display='flex';}}
  function closeModal(id){const e=document.getElementById(id);if(e){e.hidden=true;e.style.display='none';}}

  const TUTORIAL_SLIDES=[
    {
      title:'tutorial1Title',text:'tutorial1Text',
      groups:[
        {label:{id:'Sequence',en:'Sequence'},tiles:['man_1.png','man_2.png','man_3.png']},
        {label:{id:'Sequence',en:'Sequence'},tiles:['man_4.png','man_5.png','man_6.png']},
        {label:{id:'Sequence',en:'Sequence'},tiles:['pin_7.png','pin_8.png','pin_9.png']},
        {label:{id:'Triplet',en:'Triplet'},tiles:['pin_5.png','pin_5.png','pin_5.png']},
        {label:{id:'Pair',en:'Pair'},tiles:['sou_3.png','sou_3.png']}
      ]
    },
    {
      title:'tutorial2Title',text:'tutorial2Text',
      groups:[
        {label:{id:'Hand before draw',en:'Hand before draw'},tiles:['man_2.png','man_3.png','man_4.png','man_5.png','pin_5.png','pin_6.png']},
        {label:{id:'DRAW',en:'DRAW'},tiles:['man_6.png'],mark:'draw'},
        {label:{id:'DISCARD',en:'DISCARD'},tiles:['man_1.png'],mark:'discard'}
      ]
    },
    {
      title:'tutorial3Title',text:'tutorial3Text',
      groups:[
        {label:{id:'CHI',en:'CHI'},tiles:['man_2.png','man_3.png','man_4.png'],mark:'action'},
        {label:{id:'PON',en:'PON'},tiles:['pin_5.png','pin_5.png','pin_5.png'],mark:'action'},
        {label:{id:'KAN',en:'KAN'},tiles:['sou_7.png','sou_7.png','sou_7.png','sou_7.png'],mark:'action'}
      ]
    },
    {
      title:'tutorial4Title',text:'tutorial4Text',
      groups:[
        {label:{id:'RON',en:'RON'},tiles:['man_1.png','man_2.png','man_3.png','man_4.png','man_5.png','man_6.png','pin_7.png','pin_8.png','pin_9.png','pin_5.png','pin_5.png','pin_5.png','sou_3.png','sou_3.png'],mark:'win'},
        {label:{id:'TSUMO',en:'TSUMO'},tiles:['man_1.png','man_2.png','man_3.png','man_4.png','man_5.png','man_6.png','pin_7.png','pin_8.png','pin_9.png','pin_5.png','pin_5.png','pin_5.png','sou_3.png','sou_3.png'],mark:'win'}
      ]
    },
    {
      title:'tutorial5Title',text:'tutorial5Text',
      groups:[
        {label:{id:'Winning hand',en:'Winning hand'},tiles:['man_1.png','man_2.png','man_3.png','man_4.png','man_5.png','man_6.png','pin_7.png','pin_8.png','pin_9.png','pin_5.png','pin_5.png','pin_5.png','sou_3.png','sou_3.png'],mark:'win'},
        {label:{id:'FAN',en:'FAN'},tiles:[],badge:'+'}
      ]
    },
    {
      title:'tutorial6Title',text:'tutorial6Text',
      groups:[
        {label:{id:'YOU',en:'YOU'},tiles:['man_2.png','man_3.png']},
        {label:{id:'LEFT',en:'LEFT'},tiles:['pin_2.png','pin_3.png']},
        {label:{id:'TOP',en:'TOP'},tiles:['sou_3.png','sou_3.png']},
        {label:{id:'RIGHT',en:'RIGHT'},tiles:['man_7.png','man_8.png']}
      ]
    }
  ];

  let tutorialIndex=0;

  function tutorialText(id){
    return tr(id);
  }

  function v26TutorialTileMarkup(file,mark){
    const markClass=mark?' is-'+mark:'';
    return '<span class="v26-tile-wrap'+markClass+'"><img src="icons/tiles/'+file+'" alt="" draggable="false" loading="eager"><span class="v26-tile-mark">'+(mark==='draw'?'DRAW':mark==='discard'?'DISCARD':'')+'</span></span>';
  }

  function v26RenderTutorial(){
    const slide=TUTORIAL_SLIDES[tutorialIndex]||TUTORIAL_SLIDES[0];
    const lang=v26Lang();
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('tutorial-step',tr('tutorialStep')+' '+(tutorialIndex+1)+' / '+TUTORIAL_SLIDES.length);
    set('tutorial-title',tr(slide.title));
    set('tutorial-text',tr(slide.text));
    const visual=document.getElementById('tutorial-visual');
    if(visual){
      visual.innerHTML=slide.groups.map(g=>{
        const label=(g.label?.[lang]||g.label?.id||'');
        const tiles=(g.tiles||[]).map(f=>v26TutorialTileMarkup(f,g.mark)).join('');
        const badge=g.badge?'<span class="v26-tutorial-badge">'+g.badge+'</span>':'';
        return '<div class="v26-tutorial-group"><span class="v26-tutorial-group-label">'+label+'</span><div class="v26-tutorial-tile-row">'+tiles+badge+'</div></div>';
      }).join('');
    }
    const dots=document.getElementById('tutorial-dots');
    if(dots){
      dots.innerHTML=TUTORIAL_SLIDES.map((x,i)=>'<button type="button" class="v26-tutorial-dot '+(i===tutorialIndex?'is-active':'')+'" aria-label="'+tr('tutorialStep')+' '+(i+1)+'" onclick="openGameTutorial('+i+')"></button>').join('');
    }
    const prev=document.getElementById('tutorial-prev');
    const next=document.getElementById('tutorial-next');
    if(prev){prev.textContent='‹ '+tr('prev');prev.disabled=tutorialIndex===0;}
    if(next){next.textContent=tutorialIndex===TUTORIAL_SLIDES.length-1?tr('back')+' ✓':tr('next')+' ›';}
  }

  window.openGameTutorial=function(index=0){
    tutorialIndex=Math.max(0,Math.min(TUTORIAL_SLIDES.length-1,Number(index)||0));
    const overview=document.getElementById('game-info-overview');
    const tutorial=document.getElementById('game-info-tutorial');
    if(overview)overview.hidden=true;
    if(tutorial){tutorial.hidden=false;}
    v26RenderTutorial();
  };
  window.closeGameTutorial=function(){
    const overview=document.getElementById('game-info-overview');
    const tutorial=document.getElementById('game-info-tutorial');
    if(tutorial)tutorial.hidden=true;
    if(overview)overview.hidden=false;
    v26RenderInfo();
  };
  window.prevGameTutorial=function(){
    if(tutorialIndex<=0)return;
    tutorialIndex--;
    v26RenderTutorial();
  };
  window.nextGameTutorial=function(){
    if(tutorialIndex<TUTORIAL_SLIDES.length-1){
      tutorialIndex++;
      v26RenderTutorial();
    }else{
      window.closeGameTutorial();
    }
  };

  window.openGameInfo=function(){
    window.closeGameTutorial();
    v26RenderInfo();
    openModal('modal-game-info');
  };
  window.closeGameInfo=function(){
    window.closeGameTutorial();
    closeModal('modal-game-info');
  };

  function v26RenderInfo(){
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('game-info-title',tr('infoTitle'));
    set('game-info-intro',tr('infoIntro'));
    set('game-info-basic-title',tr('infoBasic'));
    set('game-info-basic-text',tr('infoBasicText'));
    set('game-info-actions-title',tr('infoActions'));
    set('game-info-actions-text',tr('infoActionsText'));
    set('game-info-score-title',tr('infoScore'));
    set('game-info-score-text',tr('infoScoreText'));
    set('game-info-match-title',tr('infoMatch'));
    set('game-info-match-text',tr('infoMatchText'));
    set('game-info-multi-title',tr('infoMulti'));
    set('game-info-multi-text',tr('infoMultiText'));
    set('game-info-close',tr('close'));
    const tutBtn=document.getElementById('game-info-tutorial-btn');if(tutBtn)tutBtn.textContent='▶ '+tr('tutorial');
    const mainInfo=document.getElementById('main-info-label'); if(mainInfo)mainInfo.textContent=tr('info');
  }

  const ACHIEVEMENTS=[
    {id:'first-win',icon:'🏆',name:{id:'First Win',en:'First Win'},desc:{id:'Menangkan 1 pertandingan',en:'Win your first match'},ok:s=>s.wins>=1},
    {id:'streak-3',icon:'🔥',name:{id:'Winning Streak',en:'Winning Streak'},desc:{id:'Menang 3 pertandingan beruntun',en:'Win 3 matches in a row'},ok:s=>s.bestWinStreak>=3},
    {id:'ron',icon:'🎯',name:{id:'Ron!',en:'Ron!'},desc:{id:'Menang dengan Ron',en:'Win with Ron'},ok:s=>s.ronWins>=1},
    {id:'tsumo',icon:'🌊',name:{id:'Tsumo!',en:'Tsumo!'},desc:{id:'Menang dengan Tsumo',en:'Win with Tsumo'},ok:s=>s.tsumoWins>=1},
    {id:'big-hand',icon:'💰',name:{id:'Big Hand',en:'Big Hand'},desc:{id:'Mencapai 5+ Fan',en:'Reach 5+ Fan'},ok:s=>s.highestFan>=5},
    {id:'maximum-hand',icon:'👑',name:{id:'Maximum',en:'Maximum'},desc:{id:'Mencapai 13 Fan',en:'Reach 13 Fan'},ok:s=>s.highestFan>=13},
    {id:'champion',icon:'🥇',name:{id:'Champion',en:'Champion'},desc:{id:'Menang 10 pertandingan',en:'Win 10 matches'},ok:s=>s.wins>=10},
    {id:'veteran',icon:'🀄',name:{id:'Veteran',en:'Veteran'},desc:{id:'Main 25 pertandingan',en:'Play 25 matches'},ok:s=>s.gamesPlayed>=25}
  ];

  function checkAchievements(){
    let changed=false;
    for(const a of ACHIEVEMENTS){
      if(!stats.unlocked.includes(a.id)&&a.ok(stats)){
        stats.unlocked.push(a.id);
        changed=true;
        showAchievementToast(a);
      }
    }
    if(changed)safeWrite(STATS_KEY,stats);
  }

  function showAchievementToast(a){
    let toast=document.getElementById('v26-achievement-toast');
    if(!toast){
      toast=document.createElement('div');
      toast.id='v26-achievement-toast';
      toast.className='v26-achievement-toast';
      toast.innerHTML='<span class="v26-achievement-icon"></span><span><strong class="v26-achievement-kicker"></strong><b class="v26-achievement-name"></b><small class="v26-achievement-desc"></small></span>';
      document.body.appendChild(toast);
    }
    toast.querySelector('.v26-achievement-icon').textContent=a.icon;
    toast.querySelector('.v26-achievement-kicker').textContent=v26Lang()==='en'?'Achievement Unlocked':'Achievement Terbuka';
    toast.querySelector('.v26-achievement-name').textContent=a.name[v26Lang()];
    toast.querySelector('.v26-achievement-desc').textContent=a.desc[v26Lang()];
    toast.classList.remove('is-visible'); void toast.offsetWidth; toast.classList.add('is-visible');
    clearTimeout(toast._timer); toast._timer=setTimeout(()=>toast.classList.remove('is-visible'),2600);
  }

  let statsOpenedFromProfile=false;

  window.openPlayerStatistics=function(){
    const profile=document.getElementById('modal-avatar-picker');
    statsOpenedFromProfile=!!profile && !profile.hidden && profile.style.display!=='none';
    if(statsOpenedFromProfile && typeof window.closeCustomizeProfile==='function'){
      window.closeCustomizeProfile();
    }
    v26RenderStats();
    openModal('modal-player-stats');
  };
  window.closePlayerStatistics=function(){
    closeModal('modal-player-stats');
    if(statsOpenedFromProfile){
      statsOpenedFromProfile=false;
      requestAnimationFrame(()=>{if(typeof window.openCustomizeProfile==='function')window.openCustomizeProfile();});
    }
  };

  function v26RenderStats(){
    const s=stats, games=s.gamesPlayed;
    const winRate=games?((s.wins/games)*100):0;
    const avg=s.finalScoreSamples?(s.totalFinalScore/s.finalScoreSamples):15000;
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('stats-title',tr('stats'));
    const statsIntro=document.getElementById('stats-intro'); if(statsIntro)statsIntro.textContent=v26Lang()==='en'?'Statistics are stored on this device.':'Statistik pertandingan disimpan di perangkat ini.';
    const statsButton=document.querySelector('.v26-stats-btn'); if(statsButton)statsButton.textContent=tr('stats');
    set('stats-games',s.gamesPlayed.toLocaleString('id-ID'));
    set('stats-wins',s.wins.toLocaleString('id-ID'));
    set('stats-losses',s.losses.toLocaleString('id-ID'));
    set('stats-draws',s.draws.toLocaleString('id-ID'));
    set('stats-winrate',winRate.toFixed(1)+'%');
    set('stats-tsumo',s.tsumoWins.toLocaleString('id-ID'));
    set('stats-ron',s.ronWins.toLocaleString('id-ID'));
    set('stats-highest-fan',s.highestFan.toLocaleString('id-ID'));
    set('stats-highest-score',Math.round(s.highestScore).toLocaleString('id-ID'));
    set('stats-average-score',Math.round(avg).toLocaleString('id-ID'));
    set('stats-achievements-title',tr('achievements'));
    set('stats-unlocked-count',s.unlocked.length.toLocaleString('id-ID'));
    set('stats-close',tr('backProfile'));
    set('stats-games-label',tr('games')); set('stats-wins-label',tr('wins')); set('stats-losses-label',tr('losses')); set('stats-draws-label',tr('draws')); set('stats-winrate-label',tr('winRate'));
    set('stats-tsumo-label',tr('tsumo')); set('stats-ron-label',tr('ron')); set('stats-highest-fan-label',tr('highestFan')); set('stats-highest-score-label',tr('highestScore')); set('stats-average-score-label',tr('avgScore')); set('stats-unlocked-count-label',tr('achievements'));
    const box=document.getElementById('stats-achievement-grid');
    if(box){
      box.innerHTML=ACHIEVEMENTS.map(a=>{
        const unlocked=s.unlocked.includes(a.id);
        return '<div class="v26-achievement-card '+(unlocked?'is-unlocked':'is-locked')+'">'+
          '<span class="v26-achievement-card-icon">'+(unlocked?a.icon:'🔒')+'</span>'+
          '<strong>'+a.name[v26Lang()]+'</strong>'+
          '<small>'+a.desc[v26Lang()]+'</small>'+
          '</div>';
      }).join('');
    }
  }

  function recordRoundResult(resultMeta){
    const winner=resultMeta?.winner;
    if(!winner)return;
    const seat=Number(winner.winnerSeat);
    if(seat!==localSeat())return;
    const winType=String(winner.winType||'').toLowerCase();
    if(winType==='tsumo')sessionTsumoWins++;
    if(winType==='ron')sessionRonWins++;
    const fan=Array.isArray(winner.yaku)?winner.yaku.reduce((n,x)=>n+(Number(x?.[1])||0),0):0;
    sessionHighestFan=Math.max(sessionHighestFan,fan);
    if(fan>stats.highestFan)stats.highestFan=fan;
    safeWrite(STATS_KEY,stats);
  }

  function recordCompletedMatch(){
    if(matchRecorded)return;
    if(!activeMatchId)activeMatchId='v26-recovered-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
    if(typeof computeStandings!=='function'||!Array.isArray(window.playerScores) && typeof playerScores==='undefined')return;
    const scores=Array.isArray(window.playerScores)?window.playerScores:playerScores;
    if(!Array.isArray(scores)||scores.length<4)return;
    const standings=computeStandings();
    if(!Array.isArray(standings)||!standings.length)return;
    const top=Number(standings[0]?.score||0);
    const winners=standings.filter(s=>Number(s.score)===top);
    const seat=localSeat();
    const local=scores[seat]??0;
    const localWins=winners.some(s=>Number(s.seat)===seat);
    const isDraw=winners.length!==1;
    stats.gamesPlayed++;
    stats.finalScoreSamples++;
    stats.totalFinalScore+=Number(local)||0;
    stats.highestScore=Math.max(stats.highestScore,Number(local)||0);
    if(isDraw){
      stats.draws++;
      stats.currentWinStreak=0;
    }else if(localWins){
      stats.wins++;
      stats.currentWinStreak++;
      stats.bestWinStreak=Math.max(stats.bestWinStreak,stats.currentWinStreak);
    }else{
      stats.losses++;
      stats.currentWinStreak=0;
    }
    stats.tsumoWins+=sessionTsumoWins;
    stats.ronWins+=sessionRonWins;
    safeWrite(STATS_KEY,stats);
    matchRecorded=true;
    checkAchievements();
  }

  NS.getStats=()=>({...stats,unlocked:[...stats.unlocked]});
  NS.recordMatch=recordCompletedMatch;
  NS.recordRound=recordRoundResult;

  /* -------------------- AI decision layer -------------------- */

  function tileKey(t){return t?String(t.type)+':'+String(t.num||t.id):'';}

  function countForHand(hand){
    const c=Array(34).fill(0);
    for(const t of hand||[])if(t&&Number.isInteger(t.id))c[t.id]++;
    return c;
  }

  function sequencePotential(c){
    let score=0;
    for(let start=0;start<27;start++){
      if(start%9>6)continue;
      const a=c[start],b=c[start+1],d=c[start+2];
      if(a&&b&&d)score+=5;
      else if((a&&b)||(b&&d)||(a&&d))score+=1.7;
    }
    return score;
  }

  function handValue(hand,melds){
    const c=countForHand(hand);
    let score=0;
    for(let id=0;id<34;id++){
      const n=c[id];
      if(n>=2)score+=3;
      if(n>=3)score+=5;
      if(n===4)score+=1.5;
      if(n===1){
        const t=TILE_TYPES?.[id];
        if(t?.type==='honor')score-=1.4;
        else if(t?.num===1||t?.num===9)score-=0.55;
        else score+=0.45;
      }
    }
    score+=sequencePotential(c);
    for(const g of melds||[])score+=Array.isArray(g)&&g.length>=3?5:2;
    return score;
  }

  function remainingCopies(id){
    try{return Math.max(0,4-(Number(countKnownTile(id))||0));}catch{return 0;}
  }

  function discardScore(hand,melds,index,level){
    const t=hand[index];
    const kept=hand.slice();
    kept.splice(index,1);
    let score=handValue(kept,melds);
    const counts=countForHand(hand);
    const id=Number(t?.id);
    const n=Number(counts[id]||0);
    if(n>=2)score-=level==='easy'?2.5:5.5;
    if(t?.type==='honor'&&n===1)score+=2.2;
    if(t?.type!=='honor'&&n===1&&t.num>=2&&t.num<=8)score-=0.4;
    if(t?.type!=='honor'){
      const left=counts[id-1]||0, right=counts[id+1]||0;
      if(t.num>1&&t.num<9)score-=(left+right)*1.2;
      if(t.num>2&&t.num<8)score-=(counts[id-2]||0)*0.55-(counts[id+2]||0)*-0.55;
    }
    if(level==='hard'||level==='expert'){
      try{
        const waits=getWaitIds(kept,(playerMelds[index]||[]).length);
        if(waits.length)score+=AI_LEVELS[level].waitWeight*waits.length;
        let live=0;
        for(const id2 of waits)live+=remainingCopies(id2);
        score+=live*0.32;
      }catch{}
    }
    if(level==='expert'){
      try{
        const seen=Math.max(0,Number(countDiscardedTile(id))||0);
        score+=seen*AI_LEVELS.expert.safetyWeight;
      }catch{}
    }
    return score + (Math.random()-0.5)*AI_LEVELS[level].noise;
  }

  function chooseBestDiscard(hand,melds,level){
    if(!hand?.length)return 0;
    if(level==='easy'){
      let best=0,bestScore=-Infinity;
      for(let i=0;i<hand.length;i++){
        const t=hand[i],c=countForHand(hand),n=c[t.id]||0;
        let s=0;
        if(n===1)s+=2;
        if(t.type==='honor')s+=1.4;
        if(t.type!=='honor'&&(t.num===1||t.num===9))s+=0.7;
        s+=Math.random()*AI_LEVELS.easy.noise;
        if(s>bestScore){bestScore=s;best=i;}
      }
      return best;
    }
    let best=0,bestScore=-Infinity;
    for(let i=0;i<hand.length;i++){
      const s=discardScore(hand,melds,i,level);
      if(s>bestScore){bestScore=s;best=i;}
    }
    return best;
  }

  function simulateCall(hand,melds,action){
    const next=(hand||[]).slice();
    const nextMelds=(melds||[]).slice();
    const discard=window.lastDiscardedTile||lastDiscardedTile;
    if(!action||!discard)return {hand:next,melds:nextMelds};
    if(action.type==='Pon'){
      let removed=0;
      for(let i=next.length-1;i>=0&&removed<2;i--)if(next[i]?.id===discard.id){next.splice(i,1);removed++;}
      if(removed===2)nextMelds.push([discard.clone?discard.clone():{...discard},...Array(2).fill(null).map(()=>({...discard}))]);
    }else if(action.type==='Kan'){
      let removed=0,group=[{...discard}];
      for(let i=next.length-1;i>=0&&removed<3;i--)if(next[i]?.id===discard.id){group.push(next[i]);next.splice(i,1);removed++;}
      if(removed===3)nextMelds.push(group);
    }else if(action.type==='Chi'&&Array.isArray(action.combo)){
      const values=action.combo.slice();
      const sameType=next.filter(x=>x?.type===discard.type);
      for(const n of values){
        if(n===discard.num)continue;
        const idx=next.findIndex(x=>x?.type===discard.type&&x?.num===n);
        if(idx>=0)next.splice(idx,1);
      }
      nextMelds.push(values.map(n=>({...discard,num:n,id:TILE_TYPES.find(x=>x.type===discard.type&&x.num===n)?.id})));
    }
    return {hand:next,melds:nextMelds};
  }

  function chooseBetterCall(actions,seatOverride=null){
    if(!Array.isArray(actions)||!actions.length)return null;
    const ron=actions.find(a=>a?.type==='Ron');
    if(ron)return ron;
    const level=aiLevel;
    if(level==='easy'){
      const kan=actions.find(a=>a?.type==='Kan');
      if(kan)return kan;
      const pon=actions.find(a=>a?.type==='Pon');
      if(pon)return pon;
      const chi=actions.find(a=>a?.type==='Chi'&&Array.isArray(a.combos)&&a.combos.length);
      return chi?{type:'Chi',combo:chi.combos[0].slice()}:null;
    }
    const p=Number.isInteger(Number(seatOverride))?Number(seatOverride):(currentTurn===undefined?0:currentTurn);
    const hand=playerHands[p]||[];
    const melds=playerMelds[p]||[];
    const base=handValue(hand,melds);
    let best=null,bestDelta=-Infinity;
    for(const action of actions){
      if(action?.type==='Ron')continue;
      if(action?.type==='Chi'&&!action.combos?.length)continue;
      const sim=simulateCall(hand,melds,action);
      const val=handValue(sim.hand,sim.melds);
      const delta=val-base;
      if(delta>bestDelta){bestDelta=delta;best=action;}
    }
    if(best&&bestDelta>=AI_LEVELS[level].callThreshold)return best;
    return null;
  }

  function installAiHooks(){
    if(typeof window.aiDiscard==='function'){
      const originalAiDiscard=window.aiDiscard;
      window.aiDiscard=function(p){
        if(!roundActive||roundEnding)return originalAiDiscard(p);
        const level=aiLevel;
        const hand=playerHands[p];
        if(!Array.isArray(hand)||!hand.length)return;
        if(level==='easy')return originalAiDiscard(p);
        const idx=chooseBestDiscard(hand,playerMelds[p]||[],level);
        const tile=hand.splice(idx,1)[0];
        drawnTile=null;
        commitDiscard(p,tile);
      };
    }

    if(typeof window.chooseAiCall==='function'){
      window.chooseAiCall=chooseBetterCall;
    }

    if(typeof window.scheduleAiTurn==='function'){
      const originalSchedule=window.scheduleAiTurn;
      window.scheduleAiTurn=function(seat,mode='discard'){
        if(!roundActive||roundEnding||!aiSeats.has(seat))return;
        const level=aiLevel, cfg=AI_LEVELS[level];
        cancelAiTurn();
        if(mode==='discard'&&currentTurn!==seat)return;
        const token=aiDecisionToken;
        setText('hand-status-main',`${playerName(seat)} berpikir...`);
        setText('hand-status-sub',mode==='call'?(v26Lang()==='en'?'AI evaluating call...':'AI mengevaluasi call...'):(v26Lang()==='en'?'AI choosing discard...':'AI memilih buangan...'));
        const run=()=>{
          if(token===aiDecisionToken)aiMoveTimer=null;
          if(token!==aiDecisionToken||!roundActive||roundEnding||!aiSeats.has(seat))return;
          if(mode==='call'){
            const live=mpPendingCalls.find(x=>x.seat===seat);
            if(!live){promptNextCall();return;}
            const pick=chooseBetterCall(live.actions,seat);
            if(pick){resolveCallChoice(seat,pick);return;}
            mpPendingCalls=mpPendingCalls.filter(x=>x!==live);
            mpBroadcastState({remoteActions:[]});
            promptNextCall();
            return;
          }
          window.aiDiscard(seat);
        };
        aiMoveTimer=setTimeout(run,cfg.thinkMs);
        setTimeout(()=>{
          if(token===aiDecisionToken&&aiMoveTimer&&roundActive&&!roundEnding&&aiSeats.has(seat)){
            if(mode==='discard'&&currentTurn!==seat)return;
            clearTimeout(aiMoveTimer);aiMoveTimer=null;run();
          }
        },cfg.thinkMs+900);
      };
    }
  }

  window.openAiLevelPicker=function(){
    v26RenderAiLevel();
    openModal('modal-ai-level');
  };
  window.closeAiLevelPicker=function(){closeModal('modal-ai-level');};
  window.selectAiLevel=function(level){
    setAiLevel(level);
    closeAiLevelPicker();
    try{window.start4PGame(level,false)}catch(e){console.error(e);}
  };

  function v26RenderAiLevel(){
    const title=document.getElementById('ai-level-title'),sub=document.getElementById('ai-level-sub');
    if(title)title.textContent=tr('aiTitle');
    if(sub)sub.textContent=tr('aiSub');
    const close=document.getElementById('ai-level-close');if(close)close.textContent=tr('close');
    const descriptions={easy:tr('easyDesc'),normal:tr('normalDesc'),hard:tr('hardDesc'),expert:tr('expertDesc')};
    document.querySelectorAll('.v26-ai-level-btn').forEach(btn=>{
      const desc=btn.querySelector('small'); if(desc)desc.textContent=descriptions[btn.dataset.level]||'';
      const level=btn.dataset.level;
      const current=level===aiLevel;
      btn.classList.toggle('is-selected',current);
      const badge=btn.querySelector('.v26-ai-level-selected');
      if(badge)badge.textContent=current?tr('selected'):'';
    });
  }

  /* Main-menu/profile integration */
  const originalSingle=window.startSinglePlayerFromMenu;
  window.startSinglePlayerFromMenu=function(){
    window.openAiLevelPicker();
  };

  const originalStart4=window.start4PGame;
  window.start4PGame=function(diff='Medium',multi=false){
    if(!activeMatchId)beginMatchSession();
    const nextDiff=multi?diff:aiLevel;
    return originalStart4(nextDiff,multi);
  };

  const originalEndRound=window.endRound;
  window.endRound=function(title,desc,resultMeta){
    recordRoundResult(resultMeta);
    return originalEndRound(title,desc,resultMeta);
  };

  const originalFinish=window.finishMatchToMenu;
  window.finishMatchToMenu=function(){
    recordCompletedMatch();
    return originalFinish();
  };

  const originalShowMatchOver=window.showMatchOverScreen;
  window.showMatchOverScreen=function(){
    recordCompletedMatch();
    return originalShowMatchOver();
  };

  window.v26StatsRefresh=function(){stats=normalizeStats(safeRead(STATS_KEY,stats));v26RenderStats();};

  const originalApplyLang=window.applyGameLanguage;
  window.applyGameLanguage=function(){
    const out=originalApplyLang?.();
    v26RenderInfo();v26RenderTutorial();v26RenderStats();v26RenderAiLevel();
    return out;
  };
  const originalToggleLang=window.toggleGameLanguage;
  window.toggleGameLanguage=function(){
    const out=originalToggleLang?.();
    v26RenderInfo();v26RenderTutorial();v26RenderStats();v26RenderAiLevel();
    return out;
  };

  window.addEventListener('load',()=>{
    v26RenderInfo();v26RenderStats();v26RenderAiLevel();
    if(!activeMatchId&&!window.roundActive)beginMatchSession();
  },{once:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{
    installAiHooks();
    v26RenderInfo();v26RenderStats();v26RenderAiLevel();
  },{once:true}); else {installAiHooks();v26RenderInfo();v26RenderStats();v26RenderAiLevel();}
})();
