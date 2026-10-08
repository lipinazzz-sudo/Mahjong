
// ============================================================
// HONG KONG MAHJONG — CLEAN GAME ENGINE
// Multiplayer transport is kept compatible with the old worker.
// The old Riichi patch stack is intentionally removed.
// ============================================================
const TILE_TYPES=[];
const MAN=['一','二','三','四','五','六','七','八','九'];
const PIN=['●','②','③','④','⑤','⑥','⑦','⑧','⑨'];
const SOU=['🀐','🀑','🀒','🀓','🀔','🀕','🀖','🀗','🀘'];
let idCounter=0;
for(let i=0;i<9;i++)TILE_TYPES.push({id:idCounter++,type:'man',num:i+1,val:MAN[i]+'萬',helper:String(i+1)});
for(let i=0;i<9;i++)TILE_TYPES.push({id:idCounter++,type:'pin',num:i+1,val:PIN[i],helper:String(i+1)});
for(let i=0;i<9;i++)TILE_TYPES.push({id:idCounter++,type:'sou',num:i+1,val:SOU[i],helper:String(i+1)});
[['東','E'],['南','S'],['西','W'],['北','N'],['白','Wh'],['發','G'],['中','R']].forEach(([val,helper])=>TILE_TYPES.push({id:idCounter++,type:'honor',num:0,val,helper}));
const PIP_POS={1:[[2,2]],2:[[1,1],[3,3]],3:[[1,1],[2,2],[3,3]],4:[[1,1],[1,3],[3,1],[3,3]],5:[[1,1],[1,3],[2,2],[3,1],[3,3]],6:[[1,1],[1,3],[2,1],[2,3],[3,1],[3,3]],7:[[1,1],[1,3],[2,1],[2,3],[3,1],[3,3],[2,2]],8:[[1,1],[1,2],[1,3],[3,1],[3,2],[3,3],[2,1],[2,3]],9:[[1,1],[1,2],[1,3],[2,1],[2,2],[2,3],[3,1],[3,2],[3,3]]};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function byId(id){return document.getElementById(id)}

/* ============================================================
   AUDIO MANAGER
   Local GitHub audio: ./audio/*.mp3
   Playlist: bgm1-game.mp3 ... bgm5-game.mp3
   Random track; the same track cannot repeat within the
   previous 2 tracks, so it may return again after 3 tracks.
   ============================================================ */
const GAME_BGM_TRACKS=[1,2,3,4,5].map(n=>`audio/bgm${n}-game.mp3`);
let musicTrackIndex=-1;
let musicRecentTracks=[];
let musicPlaylistBound=false;
let musicSessionActive=false;
let musicTrackPrepared=false;
const SFX_SOURCES={
  draw:'audio/sfx-draw.mp3',
  discard:'audio/sfx-discard.mp3',
  chi:'audio/sfx-chi.mp3',
  pon:'audio/sfx-pon.mp3',
  kan:'audio/sfx-kan.mp3',
  ron:'audio/sfx-ron.mp3',
  tsumo:'audio/sfx-tsumo.mp3',
  button:'audio/sfx-button.mp3'
};
const AUDIO_LEVELS=[0,0.10,0.30,0.50,0.80,1.00];
let audioMuted=false;
let musicVolume=0.30;
let sfxVolume=0.30;
let audioUnlocked=false;
const activeSfx=new Set();

function nearestAudioLevel(v){
  let best=0,d=Infinity;
  const n=Number(v);
  AUDIO_LEVELS.forEach((x,i)=>{const nd=Math.abs(x-n);if(nd<d){d=nd;best=i;}});
  return best;
}
function audioLevel(index){
  const raw=Number(index);
  const i=Number.isFinite(raw)?Math.min(AUDIO_LEVELS.length-1,Math.max(0,Math.round(raw))):0;
  return AUDIO_LEVELS[i];
}
try{
  musicVolume=audioLevel(nearestAudioLevel(Number(localStorage.getItem('hk_music_volume')??0.30)));
  sfxVolume=audioLevel(nearestAudioLevel(Number(localStorage.getItem('hk_sfx_volume')??0.30)));
  audioMuted=localStorage.getItem('hk_audio_muted')==='1';
}catch{}

function applyAudioSettings(){
  const bgm=byId('bg-music');
  if(bgm){
    bgm.volume=audioMuted||musicVolume===0?0:musicVolume;
    if(audioMuted||musicVolume===0)bgm.pause();
  }
  activeSfx.forEach(a=>a.volume=audioMuted?0:sfxVolume);

  const mv=byId('music-volume'),mvv=byId('music-volume-value');
  const sv=byId('sfx-volume'),svv=byId('sfx-volume-value');
  if(mv)mv.value=String(nearestAudioLevel(musicVolume));
  if(mvv)mvv.textContent=Math.round(musicVolume*100)+'%';
  if(sv)sv.value=String(nearestAudioLevel(sfxVolume));
  if(svv)svv.textContent=Math.round(sfxVolume*100)+'%';

  const ab=byId('btn-toggle-audio');
  if(ab)ab.textContent=audioMuted?'OFF':'ON';
}
function setMusicVolume(index){
  musicVolume=audioLevel(index);
  try{localStorage.setItem('hk_music_volume',String(musicVolume))}catch{}
  const bgm=byId('bg-music');
  if(musicVolume===0){
    if(bgm){
      bgm.volume=0;
      bgm.pause();
      bgm.currentTime=0;
    }
  }else{
    applyAudioSettings();
    if(roundActive&&!audioMuted)playGameMusic();
  }
  applyAudioSettings();
}
function setSfxVolume(index){
  sfxVolume=audioLevel(index);
  try{localStorage.setItem('hk_sfx_volume',String(sfxVolume))}catch{}
  applyAudioSettings();
}
function stopAllSfx(){
  activeSfx.forEach(a=>{try{a.pause();a.currentTime=0}catch{}});
  activeSfx.clear();
}
function toggleAudioMute(){
  audioMuted=!audioMuted;
  try{localStorage.setItem('hk_audio_muted',audioMuted?'1':'0')}catch{}
  const bgm=byId('bg-music');
  if(audioMuted){
    if(bgm){
      bgm.volume=0;
      bgm.pause();
    }
    stopAllSfx();
  }else{
    applyAudioSettings();
    if(roundActive)playGameMusic();
  }
}
function playSfx(type){
  if(audioMuted||sfxVolume<=0)return;
  const src=SFX_SOURCES[type];
  if(!src)return;
  const a=new Audio(src);
  a.preload='auto';
  a.volume=sfxVolume;
  if(type==='draw'||type==='discard')a.volume=sfxVolume*0.60;
  activeSfx.add(a);
  a.addEventListener('ended',()=>activeSfx.delete(a),{once:true});
  const p=a.play();
  if(p&&typeof p.catch==='function')p.catch(()=>activeSfx.delete(a));
}
function pickNextMusicTrack(){
  if(!GAME_BGM_TRACKS.length)return null;
  const blocked=new Set(musicRecentTracks.slice(-2));
  let candidates=GAME_BGM_TRACKS.map((src,i)=>({src,index:i})).filter(x=>!blocked.has(x.index));
  if(!candidates.length)candidates=GAME_BGM_TRACKS.map((src,i)=>({src,index:i}));
  const pick=candidates[Math.floor(Math.random()*candidates.length)];
  musicTrackIndex=pick.index;
  musicRecentTracks.push(pick.index);
  if(musicRecentTracks.length>2)musicRecentTracks=musicRecentTracks.slice(-2);
  musicTrackPrepared=false;
  return pick.src;
}
function loadNextMusicTrack(autoplay=true){
  const audio=byId('bg-music');
  if(!audio)return false;
  const src=pickNextMusicTrack();
  if(!src)return false;
  audio.loop=false;
  audio.src=src;
  audio.currentTime=0;
  musicTrackPrepared=false;
  updateMusicIntensity();
  applyAudioSettings();
  if(audioMuted||musicVolume===0||!autoplay)return true;
  const p=audio.play();
  if(p&&typeof p.catch==='function')p.catch(()=>{});
  return true;
}
function bindMusicPlaylist(){
  const audio=byId('bg-music');
  if(!audio||musicPlaylistBound)return;
  musicPlaylistBound=true;
  audio.addEventListener('ended',()=>{
    // Musik mengikuti sesi game/match, bukan hanya satu ronde.
    // Jadi pergantian lagu tetap berjalan saat layar hasil ronde tampil.
    if(!musicSessionActive||audioMuted||musicVolume===0)return;
    loadNextMusicTrack(true);
  });
  audio.addEventListener('pause',()=>{
    if(!musicSessionActive||!roundActive||audioMuted||musicVolume===0||audio.ended)return;
    const resume=()=>{
      if(!musicSessionActive||!roundActive||audioMuted||musicVolume===0||!audio.paused)return;
      const p=audio.play();
      if(p&&typeof p.catch==='function')p.catch(()=>{});
    };
    setTimeout(resume,120);
  });
}
function unlockGameAudio(){
  const audio=byId('bg-music');
  if(!audio||audioUnlocked)return;
  bindMusicPlaylist();
  if(musicTrackIndex<0)pickNextMusicTrack();
  const src=GAME_BGM_TRACKS[musicTrackIndex];
  if(!src)return;
  audio.src=src;
  audio.loop=false;
  audio.currentTime=0;
  audio.volume=0;
  const p=audio.play();
  if(p&&typeof p.then==='function'){
    p.then(()=>{
      audio.pause();
      audio.currentTime=0;
      audioUnlocked=true;
      musicTrackPrepared=true;
      applyAudioSettings();
    }).catch(()=>applyAudioSettings());
  }
}
function playGameMusic(){
  const audio=byId('bg-music');
  if(!audio||audioMuted||musicVolume===0)return;
  bindMusicPlaylist();
  if(!musicSessionActive){
    if(!musicTrackPrepared||musicTrackIndex<0)loadNextMusicTrack(false);
    musicSessionActive=true;
    musicTrackPrepared=false;
  }else if(!audio.src||audio.ended){
    loadNextMusicTrack(false);
  }
  audio.loop=false;
  updateMusicIntensity();
  applyAudioSettings();
  if(audio.volume===0)audio.volume=musicVolume;
  // A mobile browser can pause media during a long-lived SPA transition.
  // Resume the current track when the game session is still active; do not
  // interfere with mute/volume-zero or an intentionally stopped session.
  const p=audio.play();
  if(p&&typeof p.catch==='function')p.catch(()=>{});
}
function updateMusicIntensity(){
  const audio=byId('bg-music');
  if(!audio)return;
  const urgent=(fullDeck.length>0&&fullDeck.length<=20);
  audio.playbackRate=urgent?2.0:1.0;
}
function stopGameMusic(){
  const audio=byId('bg-music');
  if(audio){audio.pause();audio.currentTime=0;}
  musicSessionActive=false;
  musicTrackPrepared=false;
  stopAllSfx();
}
function initAudioSettingsUI(){
  const mv=byId('music-volume'),sv=byId('sfx-volume');
  if(mv)mv.addEventListener('input',e=>setMusicVolume(e.target.value));
  if(sv)sv.addEventListener('input',e=>setSfxVolume(e.target.value));
  applyAudioSettings();
}
window.addEventListener('error',e=>{
  lastRuntimeError=e?.error?.message||e?.message||'Unknown runtime error';
  console.error('[Mahjong DJ] runtime error',e?.error||e);
  scheduleGameRecovery('window-error');
});
window.addEventListener('unhandledrejection',e=>{
  lastRuntimeError=e?.reason?.message||String(e?.reason||'Unhandled promise rejection');
  console.error('[Mahjong DJ] unhandled rejection',e?.reason||e);
  scheduleGameRecovery('promise-rejection');
});
document.addEventListener('pointerdown',()=>{bindMusicPlaylist();unlockGameAudio()},{once:true,passive:true});
document.addEventListener('DOMContentLoaded',()=>{bindMusicPlaylist();initAudioSettingsUI();gameChatInit();});
window.addEventListener('pageshow',e=>{if(e.persisted&&isMultiplayerMode)setTimeout(mpEnsureReconnectOnResume,0)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&isMultiplayerMode)setTimeout(mpEnsureReconnectOnResume,0)},{passive:true});
window.addEventListener('pagehide',()=>{if(isMultiplayerMode&&mp.room?.code)mpTouchSession(true)},{capture:true});

setTimeout(preloadTileAssets,0);
function setText(id,v){const e=byId(id);if(e)e.textContent=hkTranslateText(v);return e}
function setDisplay(id,v){const e=byId(id);if(e){e.hidden=v==='none';e.style.display=v}return e}
function toggleScoreGuide(force){
  const drawer=byId('score-guide-drawer');
  const btn=byId('btn-score-guide');
  if(!drawer||!btn)return;
  const open=typeof force==='boolean'?force:!drawer.classList.contains('open');
  drawer.classList.toggle('open',open);
  drawer.setAttribute('aria-hidden',String(!open));
  btn.setAttribute('aria-expanded',String(open));
  btn.setAttribute('aria-label',open?'Tutup Score Guide':'Buka Score Guide');
}

function nav(id){
  const from=activeScreenId||'screen-main';
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  byId(id)?.classList.add('active');
  activeScreenId=id;
  if(id==='screen-settings'){
    previousScreenId=from;
    applyAudioSettings();
  }
  if(typeof gameChatRefreshVisibility==='function'){
    requestAnimationFrame(gameChatRefreshVisibility);
  }
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleScoreGuide(false)},{passive:true});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b)return;
  if(b.id==='btn-toggle-audio'||b.id==='btn-toggle-autosort')return;
  playSfx('button');
},{passive:true});
const TILE_ASSET_ROOT=new URL('icons/tiles/', document.baseURI).href;
function tileAssetName(t){
  if(!t)return '';
  if(t.type==='man')return `man_${t.num}.png`;
  if(t.type==='pin')return `pin_${t.num}.png`;
  if(t.type==='sou')return `sou_${t.num}.png`;
  const honors={27:'east.png',28:'south.png',29:'west.png',30:'north.png',31:'white.png',32:'green.png',33:'red.png'};
  return honors[t.id]||'';
}
function tileSVG(t){
  const file=tileAssetName(t);
  if(!file)return '';
  const src=TILE_ASSET_ROOT+file;
  return `<img class="tile-svg-img tile-asset" src="${src}" alt="" draggable="false" loading="eager" decoding="async" onerror="this.classList.add('tile-asset-error')">`;
}
function tileMarkup(t){return tileSVG(t)}
function preloadTileAssets(){
  const urls=[];
  for(let i=1;i<=9;i++){urls.push(`${TILE_ASSET_ROOT}man_${i}.png`,`${TILE_ASSET_ROOT}pin_${i}.png`,`${TILE_ASSET_ROOT}sou_${i}.png`)}
  ['east','south','west','north','white','green','red'].forEach(x=>urls.push(`${TILE_ASSET_ROOT}${x}.png`));
  urls.forEach(src=>{const im=new Image();im.decoding='async';im.src=src;});
}
function cloneTile(t){return {...t}}
function makeDeck(){const d=[];let uid=0;for(const type of TILE_TYPES)for(let i=0;i<4;i++)d.push({...type,uniqueId:`t${++uid}`});return d.sort(()=>Math.random()-.5)}
function tileCounts(tiles){const c=Array(34).fill(0);for(const t of tiles||[])if(t)c[t.id]++;return c}
function isTerminalOrHonor(t){return t.type==='honor'||t.num===1||t.num===9}
function isSimple(t){return t.type!=='honor'&&t.num>=2&&t.num<=8}
function getChiCombinations(hand,tile){if(!tile||tile.type==='honor')return[];const nums=(hand||[]).filter(x=>x.type===tile.type).map(x=>x.num);const out=[];for(const a of [tile.num-2,tile.num-1,tile.num]){const seq=[a,a+1,a+2];if(a>=1&&a<=7&&seq.includes(tile.num)&&seq.filter(n=>n!==tile.num).every(n=>nums.includes(n)))out.push(seq)}return out}
function canFormMelds(c){for(let i=0;i<34;i++){if(c[i]>=3){c[i]-=3;if(canFormMelds(c))return true;c[i]+=3}if(i<27&&i%9<=6&&c[i]&&c[i+1]&&c[i+2]){c[i]--;c[i+1]--;c[i+2]--;if(canFormMelds(c))return true;c[i]++;c[i+1]++;c[i+2]++}if(c[i])return false}return true}
function isSevenPairs(c){let pairs=0;for(const n of c){if(n===2)pairs++;else if(n===4)pairs+=2;else if(n!==0)return false}return pairs===7}
function isStandardWin(tiles,meldCount=0){const needed=14-meldCount*3;if((tiles?.length||0)!==needed)return false;const c=tileCounts(tiles);if(isSevenPairs(c)&&meldCount===0)return true;for(let i=0;i<34;i++)if(c[i]>=2){c[i]-=2;if(canFormMelds(c))return true;c[i]+=2}return false}
function checkWinningHand(tiles,meldCount=0){return isWinningShape(tiles,meldCount)}
const waitCache=new Map();
function checkWinningHandCounts(counts,meldCount=0){
  if(isSevenPairs(counts)&&meldCount===0)return true;
  const needed=14-meldCount*3;
  let total=0;
  for(const n of counts)total+=n;
  if(total!==needed)return false;
  for(let i=0;i<34;i++){
    if(counts[i]<2)continue;
    counts[i]-=2;
    if(canFormMelds(counts)){counts[i]+=2;return true;}
    counts[i]+=2;
  }
  return false;
}
function getWaitIds(hand13,meldCount=0){
  if(!hand13||hand13.length%3!==1)return[];
  const key=`${meldCount}|${tileCounts(hand13).join(',')}`;
  const cached=waitCache.get(key);
  if(cached)return cached.slice();

  const out=[];
  const baseCounts=tileCounts(hand13);
  for(const t of TILE_TYPES){
    if(baseCounts[t.id]>=4)continue;
    const candidate=baseCounts.slice();
    candidate[t.id]++;
    if(checkWinningHandCounts(candidate,meldCount))out.push(t.id);
  }

  waitCache.set(key,out.slice());
  if(waitCache.size>96)waitCache.delete(waitCache.keys().next().value);
  return out;
}
function isTenpai(hand,meldCount=0){return getWaitIds(hand,meldCount).length>0}

let fullDeck=[],playerHands=[[],[],[],[]],playerRivers=[[],[],[],[]],playerMelds=[[],[],[],[]];
let playerScores=[15000,15000,15000,15000],roundStartScores=[15000,15000,15000,15000];
let currentRoundIndex=0,currentDealerIdx=1,currentTurn=0,lastDiscardedTile=null,lastDiscarderIdx=-1,drawnTile=null;
const TURN_BASE_SECONDS=10,TIME_BANK_MAX=20,ACTION_WINDOW_SECONDS=5;
let roundActive=false,roundEnding=false,isDiscardable=false,isActionPhase=false,selectedTileIndex=-1,aiMoveTimer=null,turnTimer=null,actionTimer=null,secondsLeft=10,timeBank=[20,20,20,20],actionSecondsLeft=0,pendingCallChoice=null,actionTimeoutHandler=null,actionSeat=-1,actionMode='';
let gameTurnEpoch=0;
let stateHasRemoteCallForLocalGuest=false;

// v8 presentation-only animation trackers. These never alter game state;
// they only prevent a visual animation from replaying on every renderTable().
let lastDrawnTileHighlightId=null;
let lastDiscardAnimationId=null;
let seenMeldAnimationKeys=new Set();
let meldAnimationInitialized=false;
let activeRemoteActions=null;
// Every multiplayer game interaction gets a context ID. For normal turns the
// value is TURN-N; for discard-call windows it is CALL-N. All network actions
// carry this ID as `callId`, so stale clicks from an older window are rejected.
let activeCallId=null;
let mpCallSeq=0;
let mpActionSeq=0;
let mpProcessedActionIds=new Set();
let activeActionFeedback=null;
let lastActionFeedbackId='';
let actionFeedbackTimer=null;
let actionFeedbackToken=0;
let aiDecisionToken=0;
let autoSortSetting=true,activeScreenId='screen-main',previousScreenId='screen-main',isMultiplayerMode=false;
let mpHistoryMatchStartedAt=null;
let mpHistoryMatchId=null;
let mpHistoryRounds=[];
let mpHistorySavedKeys=new Set();
let mpHistoryCompletedMatch=null;
let historyDetailMatch=null;
let historyDetailRoundIndex=0;
const HISTORY_DB_NAME='mahjong_dj_history_v1';
const HISTORY_STORE='matches';
function historyDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(HISTORY_DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(HISTORY_STORE)){const st=r.result.createObjectStore(HISTORY_STORE,{keyPath:'id'});st.createIndex('playedAt','playedAt')}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function historyGetAll(){try{const db=await historyDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(HISTORY_STORE,'readonly'),st=tx.objectStore(HISTORY_STORE),r=st.getAll();r.onsuccess=()=>resolve((r.result||[]).sort((a,b)=>Number(b.playedAt)-Number(a.playedAt)));r.onerror=()=>reject(r.error)})}catch{return []}}
async function historyPut(match){try{const db=await historyDb();await new Promise((resolve,reject)=>{const tx=db.transaction(HISTORY_STORE,'readwrite');tx.objectStore(HISTORY_STORE).put(match);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(e){console.warn('History save failed',e)}}
function historyDate(ts){try{return new Date(ts).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return '-'}}
function historyRoomCode(){return String(mp.room?.code||'Multiplayer')}
function historyPlayersSnapshot(){return [0,1,2,3].map(i=>{const roomAvatar=mp.room?.players?.[i]?.avatar;const avatar=AVATAR_IDS.includes(roomAvatar)?roomAvatar:(playerAvatars[i]||'panda');return {seat:i,name:playerName(i),avatar,wind:['South','East','North','West'][i]}})}
function historyRoundRecord(title,desc,resultMeta){return {round:currentRoundIndex,name:getRoundName(),title:String(title||'Ronde Selesai'),desc:String(desc||''),scores:playerScores.map(x=>Math.round(Number(x)||0)),winner:resultMeta?.winner?JSON.parse(JSON.stringify(resultMeta.winner)):null,playedAt:Date.now()}}
function historyBuildMatch(rounds=mpHistoryRounds,finalScores=playerScores,winner=null){
  const list=(Array.isArray(rounds)?rounds:[]).filter(Boolean).slice(0,4);
  if(list.length<4)return null;
  const startedAt=mpHistoryMatchStartedAt||Number(list[0]?.playedAt)||Date.now();
  const id=String(mpHistoryMatchId||`${historyRoomCode()}-${startedAt}`);
  const scores=(Array.isArray(finalScores)?finalScores:playerScores).map(x=>Math.round(Number(x)||0));
  return {id,playedAt:Number(list[3]?.playedAt)||Date.now(),startedAt,room:historyRoomCode(),players:historyPlayersSnapshot(),rounds:list,finalScores:scores,winner:winner?JSON.parse(JSON.stringify(winner)):computeStandings().map(x=>({...x}))[0]||null,durationMs:Math.max(0,Date.now()-startedAt)};
}
async function historyRecordRound(title,desc,resultMeta){
  if(!isMultiplayerMode)return;
  const key=`${historyRoomCode()}:${currentRoundIndex}`;
  if(mpHistorySavedKeys.has(key))return;
  mpHistorySavedKeys.add(key);
  const rec=historyRoundRecord(title,desc,resultMeta);
  mpHistoryRounds=mpHistoryRounds.filter(r=>r.round!==rec.round);mpHistoryRounds.push(rec);mpHistoryRounds.sort((a,b)=>a.round-b.round);
  if(mpHistoryRounds.length>=4){
    const match=historyBuildMatch(mpHistoryRounds,rec.scores,computeStandings().map(x=>({...x}))[0]||null);
    if(!match)return;
    mpHistoryCompletedMatch=match;
    await historyPut(match);
  }
}
async function historyPersistRemoteState(state){
  if(!state||!isMultiplayerMode)return false;
  if(state.historyMatchId)mpHistoryMatchId=String(state.historyMatchId);
  if(Array.isArray(state.historyRounds))mpHistoryRounds=state.historyRounds.slice(0,4);
  if(state.historyMatch){
    mpHistoryCompletedMatch=state.historyMatch;
    mpHistoryRounds=Array.isArray(state.historyMatch.rounds)?state.historyMatch.rounds.slice():mpHistoryRounds;
    await historyPut(state.historyMatch);
    return true;
  }
  if(state.phase==='matchFinished'&&mpHistoryRounds.length>=4){
    const match=historyBuildMatch(mpHistoryRounds,state.playerScores,state.result?.winner||null);
    if(match){mpHistoryCompletedMatch=match;await historyPut(match);return true;}
  }
  if(state.phase==='result'&&state.result){
    await historyRecordRound(state.result.title,state.result.desc,state.result);
    return !!mpHistoryCompletedMatch;
  }
  return false;
}
function avatarUrl(id){const def=getAvatarDef(id||'panda');return def?.file||''}
function historyTileHtml(tile){if(!tile)return '';const wrap=document.createElement('div');wrap.className='history-tile';wrap.innerHTML=tileMarkup(tile);const img=wrap.querySelector('img');if(img)img.removeAttribute('onerror');return wrap.outerHTML}
async function openHistory(){setDisplay('modal-history-detail','none');setDisplay('modal-history-round','none');setDisplay('modal-history','flex');await renderHistoryList()}
function closeHistory(){setDisplay('modal-history','none')}
function closeHistoryDetail(){setDisplay('modal-history-detail','none')}
function closeHistoryRoundDetail(){setDisplay('modal-history-round','none');setDisplay('modal-history-detail','flex')}
async function renderHistoryList(){const box=byId('history-list');if(!box)return;const list=await historyGetAll();if(!list.length){box.innerHTML='<div class="history-empty">Belum ada pertandingan multiplayer yang tersimpan di perangkat ini.</div>';return}box.innerHTML=list.map((m,i)=>{const winner=m.winner?.name||'Draw';const top=Number(m.winner?.score||0);return `<button class="history-row" type="button" onclick="openHistoryMatch(${i})" data-history-index="${i}"><span class="history-main"><strong>${esc(winner)}${winner!=='Draw'?' Menang':' • Draw'}</strong><span>${esc(historyDate(m.playedAt))} • Room ${esc(m.room)}</span></span><span class="history-meta">Multiplayer</span><span class="history-result">${(m.rounds||[]).length} Ronde</span><span class="history-score">${top.toLocaleString('id-ID')}</span><span class="history-arrow">›</span></button>`}).join('');window.__mahjongHistoryList=list}
async function openHistoryMatch(index){const list=window.__mahjongHistoryList||await historyGetAll();const m=list[index];if(!m)return;historyDetailMatch=m;historyDetailRoundIndex=0;setDisplay('modal-history','none');setDisplay('modal-history-round','none');setDisplay('modal-history-detail','flex');renderHistoryDetail()}
function renderHistoryDetail(){const m=historyDetailMatch;if(!m)return;setText('history-detail-title','Detail Pertandingan');setText('history-detail-subtitle',`Room ${m.room} • ${historyDate(m.playedAt)} • ${m.rounds.length} ronde`);const body=byId('history-detail-body');if(!body)return;const players=(m.players||[]);const standings=(m.finalScores||[]).map((score,seat)=>({seat,name:players[seat]?.name||`Player ${seat+1}`,score})).sort((a,b)=>b.score-a.score);const phtml=players.map(p=>`<div class="history-player-row"><div class="history-avatar" style="background-image:url('${avatarUrl(p.avatar)}')"></div><span>${esc(p.name)}<small>${esc(p.wind)}</small></span><strong>${(m.finalScores?.[p.seat]||0).toLocaleString('id-ID')}</strong></div>`).join('');body.innerHTML=`<div class="history-detail-grid"><div class="history-card"><div class="history-card-title">Pertandingan</div><div class="history-info-list"><div class="history-info-row"><span>Room</span><strong>${esc(m.room)}</strong></div><div class="history-info-row"><span>Durasi</span><strong>${Math.round((m.durationMs||0)/60000)} menit</strong></div><div class="history-info-row"><span>Ronde</span><strong>${m.rounds.length}</strong></div></div><div class="history-card-title" style="margin-top:10px">Pemain</div><div class="history-players-grid">${phtml}</div></div><div class="history-card"><div class="history-card-title">Hasil Akhir</div><div class="history-score-table">${standings.map((x,i)=>`<div class="history-score-line"><span>${i===0?'🏆 ':`#${i+1} `}${esc(x.name)}</span><strong>${x.score.toLocaleString('id-ID')}</strong></div>`).join('')}</div></div></div><div class="history-summary-action"><button class="history-round-open-btn" type="button" onclick="openHistoryRoundDetail()">Lihat History Per Round ›</button></div>`}
function openHistoryRoundDetail(){if(!historyDetailMatch)return;setDisplay('modal-history-detail','none');setDisplay('modal-history-round','flex');renderHistoryRoundDetail()}
function renderHistoryRoundDetail(){const m=historyDetailMatch;if(!m)return;setText('history-round-title','Detail Per Round');setText('history-round-subtitle',`Room ${m.room} • ${historyDate(m.playedAt)} • ${m.rounds.length} ronde`);const body=byId('history-round-body');if(!body)return;const players=(m.players||[]);const rounds=(m.rounds||[]).map((r,i)=>`<button class="history-round-tab${i===historyDetailRoundIndex?' active':''}" onclick="selectHistoryRound(${i})">${esc(r.name||`Round ${i+1}`)}</button>`).join('');const r=m.rounds?.[historyDetailRoundIndex]||null;let winner=r?.winner;const winnerName=winner?.winnerName||(winner?.winnerSeat!==undefined?players[winner.winnerSeat]?.name:'Draw');const winTitle=r?.title||'DRAW';const points=String(r?.desc||'').split(' • ').slice(1).join(' • ');const tiles=winner?[...(winner.hand||[])]:[];if(winner?.winningTile&&!tiles.some(t=>t?.uniqueId===winner.winningTile.uniqueId))tiles.push(winner.winningTile);const tileHtml=tiles.map(historyTileHtml).join('');const meldHtml=(winner?.melds||[]).map((group,i)=>Array.isArray(group)&&group.length?`<div class="history-meld-mini" title="Meld ${i+1}">${group.map(historyTileHtml).join('')}</div>`:'').join('');const yaku=winner?.yakuStr||r?.desc||'Tidak ada detail kemenangan.';body.innerHTML=`${r?`<div class="history-round-overview"><div class="history-round-selector"><div class="history-card-title">Pilih Round</div><div class="history-round-tabs">${rounds}</div></div><div class="history-round-result"><div class="history-trophy">${winTitle.startsWith('DRAW')?'🀄':'🏆'}</div><div><strong>${esc(winTitle)}</strong><span>${esc(winnerName||'Tidak ada pemenang')} • ${esc(r.desc||'')}</span></div><div class="history-points">${esc(points)}</div></div></div><div class="history-round-data-grid">${tileHtml||meldHtml?`<div class="history-card history-round-hand-card"><div class="history-card-title">Tangan Kemenangan</div><div class="history-winning-pack">${tileHtml?`<div class="history-tiles history-winning-hand">${tileHtml}</div>`:''}${meldHtml?`<div class="history-meld-inline"><span class="history-meld-inline-label">MELD</span>${meldHtml}</div>`:''}</div><div class="history-yaku">${esc(yaku)}</div></div>`:`<div class="history-card history-round-hand-card"><div class="history-card-title">Tangan Kemenangan</div><div class="history-empty">Detail tangan tidak tersedia.</div><div class="history-yaku">${esc(yaku)}</div></div>`}<div class="history-card history-round-score-card"><div class="history-card-title">Skor Setelah Ronde</div><div class="history-score-table">${(r.scores||[]).map((score,seat)=>`<div class="history-score-line"><span>${esc(players[seat]?.name||playerName(seat))}</span><strong>${Number(score).toLocaleString('id-ID')}</strong></div>`).join('')}</div></div></div>`:'<div class="history-empty">Detail ronde tidak tersedia.</div>'}<div class="history-close-row"><button class="btn btn-secondary" type="button" onclick="closeHistoryRoundDetail()">Kembali ke Detail Pertandingan</button></div>`}
function selectHistoryRound(i){historyDetailRoundIndex=Math.max(0,Math.min(i,(historyDetailMatch?.rounds?.length||1)-1));renderHistoryRoundDetail()}
try{autoSortSetting=localStorage.getItem('hk_auto_sort')!=='0'}catch{}
function nextMpCallId(prefix='TURN'){
  mpCallSeq++;
  return `${prefix}-${mpCallSeq}`;
}
function nextMpActionId(prefix='ACT'){
  mpActionSeq++;
  const client=mpClientId||'local';
  return `${prefix}-${client}-${mpActionSeq}`;
}
function rememberMpAction(seat,actionId){
  const id=String(actionId||'').trim();
  if(!id)return false;
  const key=`${seat}:${id}`;
  if(mpProcessedActionIds.has(key))return false;
  mpProcessedActionIds.add(key);
  if(mpProcessedActionIds.size>512){
    const first=mpProcessedActionIds.values().next().value;
    if(first)mpProcessedActionIds.delete(first);
  }
  return true;
}
function actionAnnounceCode(type){
  const key=String(type||'').trim().toLowerCase();
  return ({chi:'吃',pon:'碰',kan:'槓',ron:'和',tsumo:'自摸'})[key]||'';
}
function actionAnnounceTitle(type){
  const key=String(type||'').trim().toLowerCase();
  return ({chi:'CHI',pon:'PON',kan:'KAN',ron:'RON',tsumo:'TSUMO'})[key]||String(type||'').toUpperCase();
}
function clearActionAnnouncement(){
  const el=byId('action-announce');
  if(!el)return;
  el.classList.remove('is-visible');
  el.setAttribute('aria-hidden','true');
  el.removeAttribute('data-action');
  el.style.removeProperty('--announce-duration');
  const tiles=byId('action-announce-tiles');
  if(tiles)tiles.innerHTML='';
}
function showActionAnnouncement(seat,type,tiles=[],duration=3000){
  const el=byId('action-announce');
  const wrap=byId('action-announce-tiles');
  const title=byId('action-announce-title');
  const zh=byId('action-announce-zh');
  if(!el||!wrap||!title||!zh)return;

  clearActionAnnouncement();
  const safeTiles=Array.isArray(tiles)?tiles.filter(Boolean).slice(0,4):[];
  const actorName=String(typeof playerName==='function'?playerName(seat):'').trim()||`Player ${Number(seat)+1}`;
  title.textContent=`${actorName} - ${actionAnnounceTitle(type)}`;
  zh.textContent=actionAnnounceCode(type);
  el.dataset.action=String(type||'');
  el.style.setProperty('--announce-duration',`${Math.max(1,Number(duration)||3000)}ms`);
  safeTiles.forEach((tile,index)=>{
    const item=document.createElement('div');
    item.className='action-announce-tile';
    item.style.setProperty('--tile-delay',`${index*70}ms`);
    item.innerHTML=tileMarkup(tile);
    wrap.appendChild(item);
  });
  void el.offsetWidth;
  el.classList.add('is-visible');
  el.setAttribute('aria-hidden','false');
}
function actionFeedbackDuration(type){
  const key=String(type||'').trim().toLowerCase();
  if(key==='chi')return 2000;
  if(key==='pon')return 2500;
  if(key==='kan')return 3000;
  if(key==='ron'||key==='tsumo')return 4000;
  return 2000;
}
function beginActionFeedback(seat,type,duration=3000,resume,tiles=[]){
  clearTimeout(actionFeedbackTimer);
  clearActionAnnouncement();
  actionFeedbackToken++;
  const safeTiles=Array.isArray(tiles)?tiles.filter(Boolean).slice(0,4).map(cloneTile):[];
  const feedbackId=nextMpActionId('FEEDBACK');
  activeActionFeedback={id:feedbackId,seat,type,duration,startedAt:Date.now(),tiles:safeTiles};
  lastActionFeedbackId=feedbackId;
  isDiscardable=false;
  showActionAnnouncement(seat,type,safeTiles,duration);
  if(isMultiplayerMode&&mp.host)mpBroadcastState({actionFeedback:activeActionFeedback});

  const token=actionFeedbackToken;
  actionFeedbackTimer=setTimeout(()=>{
    if(token!==actionFeedbackToken)return;
    actionFeedbackTimer=null;
    activeActionFeedback=null;
    
    clearActionAnnouncement();
    resume?.();
  },Math.max(0,Number(duration)||0));
}
function resumeAfterAction(seat,type,resume,tiles=[]){
  beginActionFeedback(seat,type,actionFeedbackDuration(type),resume,tiles);
}
function restoreRemoteActionFeedback(feedback){
  if(!feedback?.id||feedback.id===lastActionFeedbackId)return;
  const duration=Math.max(0,Number(feedback.duration)||0);
  const started=Number(feedback.startedAt)||Date.now();
  const remaining=Math.max(0,duration-(Date.now()-started));
  lastActionFeedbackId=feedback.id;
  if(remaining<=0){clearActionAnnouncement();return;}
  clearTimeout(actionFeedbackTimer);
  clearActionAnnouncement();
  actionFeedbackToken++;
  showActionAnnouncement(feedback.seat,feedback.type,Array.isArray(feedback.tiles)?feedback.tiles:[],duration);
  const token=actionFeedbackToken;
  actionFeedbackTimer=setTimeout(()=>{
    if(token!==actionFeedbackToken)return;
    
    clearActionAnnouncement();
    actionFeedbackTimer=null;
  },remaining);
}
const AVATAR_OPTIONS=[
  {id:'panda',name:'Panda',file:'avatars/avatar-panda.jpg'},
  {id:'shiba',name:'Shiba',file:'avatars/avatar-shiba.jpg'},
  {id:'turtle',name:'Kura-kura',file:'avatars/avatar-turtle.jpg'},
  {id:'penguin',name:'Penguin',file:'avatars/avatar-penguin.jpg'},
  {id:'rubah',name:'Rubah',file:'avatars/avatar-rubah.jpg'},
  {id:'rabbit',name:'Kelinci',file:'avatars/avatar-rabbit.jpg'},
  {id:'dragon',name:'Naga',file:'avatars/avatar-dragon.jpg'},
  {id:'tiger',name:'Macan',file:'avatars/avatar-tiger.jpg'},
  {id:'owl',name:'Owl',file:'avatars/avatar-owl.jpg'},
  {id:'squirrel',name:'Tupai',file:'avatars/avatar-squirrel.jpg'}
];
const AVATAR_IDS=AVATAR_OPTIONS.map(a=>a.id);
let selectedAvatar='panda';
try{selectedAvatar=AVATAR_IDS.includes(localStorage.getItem('hk_avatar'))?localStorage.getItem('hk_avatar'):'panda'}catch{}
let avatarPickerMode='';
let playerAvatars=['panda','shiba','turtle','penguin'];

let mp={ws:null,connected:false,room:null,seat:null,host:false,ready:false,started:false,state:null,playerName:'Player',token:null,playerAvatar:selectedAvatar};
mp.playerName=getStoredPlayerName();
let mpClientId=null,mpReconnectTimer=null,mpAutoStartTimer=null,mpPendingCalls=[];let mpServerStarted=false;let mpReconnectAttempts=0,mpReconnectDeadline=0,mpLastRoomView=null;let mpGameWatchdogTimer=null;let lastHostServerSeq=0;let mpRejoinMode=false,mpRejoinStateApplied=false,mpRejoinJoined=false,mpRejoinFallbackState=null,mpRejoinFallbackTimer=null,mpRejoinModeTimer=null,mpRejoinHandshakeTimer=null,mpSessionTouchAt=0;const MP_RECONNECT_WINDOW_MS=15*60*1000;const MP_SESSION_TOUCH_MS=5000;const MP_WORKER_URL='https://mahjong-room.mahjongjong.workers.dev',MP_ROOM_PARAM='room',MP_SESSION_KEY='mahjongHKRoomV1',MP_GAME_STATE_KEY='mahjongHKActiveGameV1';
let aiSeats=new Set();
const HUMAN_NAMES=['Player','Player 2','Player 3','Player 4'];

function getAvatarDef(id){return AVATAR_OPTIONS.find(a=>a.id===id)||AVATAR_OPTIONS[0]}
function avatarAsset(id){return getAvatarDef(id).file}
function shuffleArray(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
function randomAvatarIds(count,exclude=[]){
  const blocked=new Set(exclude.filter(id=>AVATAR_IDS.includes(id)));
  const pool=shuffleArray(AVATAR_IDS.filter(id=>!blocked.has(id)));
  const out=[];
  while(out.length<count){
    if(pool.length)out.push(pool.shift());
    else out.push(AVATAR_IDS[Math.floor(Math.random()*AVATAR_IDS.length)]);
  }
  return out;
}
const PLAYER_PROFILE_NAME_KEY='mahjongHKPlayerNameV1';
const PLAYER_TABLE_STYLE_KEY='mahjongHKTableStyleV1';
const PLAYER_CENTER_STYLE_KEY='mahjongHKCenterStyleV1';
const PLAYER_CENTER_FRAME_KEY='mahjongHKCenterFrameV1';

const TABLE_STYLE_OPTIONS={
  emerald:{name:'Emerald Forest',a:'#123d32',b:'#06150f',c:'#0d2b20'},
  jade:{name:'Deep Jade',a:'#155044',b:'#061b14',c:'#0c382b'},
  teal:{name:'Deep Teal',a:'#123f46',b:'#06161a',c:'#0d3035'},
  petrol:{name:'Petrol Blue',a:'#173e52',b:'#07151f',c:'#102d40'},
  navy:{name:'Royal Navy',a:'#172e4a',b:'#070f1c',c:'#10223a'},
  indigo:{name:'Indigo Night',a:'#28284a',b:'#0c0d1b',c:'#1c1d35'},
  olive:{name:'Dark Olive',a:'#3e4029',b:'#14170d',c:'#2d301b'},
  obsidian:{name:'Obsidian',a:'#181a1d',b:'#060708',c:'#111419'}
};
const CENTER_STYLE_OPTIONS={
  emerald:{name:'Emerald Silk',top:'#19483f',bottom:'#071613'},
  jade:{name:'Jade Ink',top:'#0f3932',bottom:'#05110e'},
  teal:{name:'Ocean Teal',top:'#164a55',bottom:'#06171d'},
  sapphire:{name:'Sapphire Ink',top:'#183455',bottom:'#070f1b'},
  indigo:{name:'Midnight Indigo',top:'#252a4a',bottom:'#0b0d19'},
  aubergine:{name:'Royal Aubergine',top:'#402b49',bottom:'#100b17'},
  copper:{name:'Copper Silk',top:'#553329',bottom:'#170b08'},
  obsidian:{name:'Black Ink',top:'#191c20',bottom:'#070809'}
};
const CENTER_FRAME_OPTIONS={
  'classic-gold':{name:'Classic Gold',file:'classic-gold.png'},
  'jade-dragon':{name:'Jade Dragon',file:'jade-dragon.png'},
  'red-lacquer':{name:'Red Lacquer',file:'red-lacquer.png'},
  'black-obsidian':{name:'Black Obsidian',file:'black-obsidian.png'},
  'sapphire-luxe':{name:'Sapphire Luxe',file:'sapphire-luxe.png'},
  lotus:{name:'Lotus',file:'lotus.png'},
  bamboo:{name:'Bamboo',file:'bamboo.png'},
  'oriental-cloud':{name:'Oriental Cloud',file:'oriental-cloud.png'},
  'modern-minimal':{name:'Modern Minimal',file:'modern-minimal.png'},
  arcadia:{name:'Arcadia',file:'arcadia.png'}
};

let selectedTableStyle='emerald';
let selectedCenterStyle='emerald';
let selectedCenterFrame='classic-gold';
try{selectedTableStyle=Object.prototype.hasOwnProperty.call(TABLE_STYLE_OPTIONS,localStorage.getItem(PLAYER_TABLE_STYLE_KEY)||'')?localStorage.getItem(PLAYER_TABLE_STYLE_KEY):'emerald'}catch{}
try{selectedCenterStyle=Object.prototype.hasOwnProperty.call(CENTER_STYLE_OPTIONS,localStorage.getItem(PLAYER_CENTER_STYLE_KEY)||'')?localStorage.getItem(PLAYER_CENTER_STYLE_KEY):'emerald'}catch{}
try{selectedCenterFrame=Object.prototype.hasOwnProperty.call(CENTER_FRAME_OPTIONS,localStorage.getItem(PLAYER_CENTER_FRAME_KEY)||'')?localStorage.getItem(PLAYER_CENTER_FRAME_KEY):'classic-gold'}catch{}

function getStoredPlayerName(){
  try{
    const n=(localStorage.getItem(PLAYER_PROFILE_NAME_KEY)||'Player').trim();
    return (n||'Player').slice(0,20);
  }catch{return'Player'}
}
function syncProfileNameToInputs(){
  const name=getStoredPlayerName();
  const a=byId('mp-name');if(a)a.value=name;
  setText('main-profile-name',name);
  setText('style-profile-name',name);
}
function applyCustomizeStyle(){
  const table=TABLE_STYLE_OPTIONS[selectedTableStyle]||TABLE_STYLE_OPTIONS.emerald;
  const center=CENTER_STYLE_OPTIONS[selectedCenterStyle]||CENTER_STYLE_OPTIONS.emerald;
  const frame=CENTER_FRAME_OPTIONS[selectedCenterFrame]||CENTER_FRAME_OPTIONS['classic-gold'];
  document.documentElement.style.setProperty('--user-table-a',table.a);
  document.documentElement.style.setProperty('--user-table-b',table.b);
  document.documentElement.style.setProperty('--user-table-c',table.c);
  document.documentElement.style.setProperty('--user-center-top',center.top);
  document.documentElement.style.setProperty('--user-center-bottom',center.bottom);
  try{
    localStorage.setItem(PLAYER_TABLE_STYLE_KEY,selectedTableStyle);
    localStorage.setItem(PLAYER_CENTER_STYLE_KEY,selectedCenterStyle);
    localStorage.setItem(PLAYER_CENTER_FRAME_KEY,selectedCenterFrame);
  }catch{}
  applyCenterFrameSelection();
  renderStylePreview();
}
function applyCenterFrameSelection(){
  const frame=CENTER_FRAME_OPTIONS[selectedCenterFrame]||CENTER_FRAME_OPTIONS['classic-gold'];
  const src=`assets/centerboard/frames-png-clean/${frame.file}`;
  document.querySelectorAll('.centerboard-frame,.style-preview-frame').forEach(img=>{
    if(img&&img.getAttribute('src')!==src)img.setAttribute('src',src);
  });
}
function setSelectedAvatar(id){
  if(!AVATAR_IDS.includes(id))return;
  const input=byId('custom-player-name');
  const draftName=input?input.value:getStoredPlayerName();
  selectedAvatar=id;
  mp.playerAvatar=id;
  try{localStorage.setItem('hk_avatar',id)}catch{}
  renderCustomizeProfile();
  const restored=byId('custom-player-name');
  if(restored)restored.value=draftName;
}
function renderAvatarPicker(){
  const grid=byId('avatar-picker-grid');
  if(!grid)return;
  grid.innerHTML=AVATAR_OPTIONS.map(a=>`<button class="avatar-option-picker${a.id===selectedAvatar?' selected':''}" type="button" onclick="setSelectedAvatar('${a.id}')"><img src="${a.file}" alt="${esc(a.name)}"><span class="avatar-option-name">${esc(a.name)}</span></button>`).join('');
}
function renderCustomizeProfile(){
  renderAvatarPicker();
  const def=getAvatarDef(selectedAvatar);
  const name=getStoredPlayerName();
  const mainAvatar=byId('main-profile-avatar');if(mainAvatar)mainAvatar.src=def.file;
  const styleAvatar=byId('style-profile-avatar');if(styleAvatar)styleAvatar.src=def.file;
  setText('main-profile-name',name);setText('main-profile-avatar-name',def.name);
  setText('style-profile-name',name);setText('style-profile-avatar-name',def.name);
  const input=byId('custom-player-name');if(input&&document.activeElement!==input)input.value=name;
  renderStyleChoices();renderStylePreview();
}
function renderStyleChoices(){
  const board=byId('custom-board-select');
  if(board){board.value=selectedTableStyle;board.onchange=()=>setTableStyle(board.value)}
  const center=byId('custom-center-select');
  if(center){center.value=selectedCenterStyle;center.onchange=()=>setCenterStyle(center.value)}
  const frame=byId('custom-frame-select');
  if(frame){frame.value=selectedCenterFrame;frame.onchange=()=>setCenterFrame(frame.value)}
  applyCenterFrameSelection();
}
function setTableStyle(id){if(!TABLE_STYLE_OPTIONS[id])return;selectedTableStyle=id;applyCustomizeStyle();renderStyleChoices()}
function setCenterStyle(id){if(!CENTER_STYLE_OPTIONS[id])return;selectedCenterStyle=id;applyCustomizeStyle();renderStyleChoices()}
function setCenterFrame(id){if(!CENTER_FRAME_OPTIONS[id])return;selectedCenterFrame=id;applyCustomizeStyle();renderStyleChoices()}
function renderStylePreview(){
  const stage=byId('style-preview-stage');
  const board=byId('style-preview-board');
  if(!board)return;
  const table=TABLE_STYLE_OPTIONS[selectedTableStyle]||TABLE_STYLE_OPTIONS.emerald;
  const center=CENTER_STYLE_OPTIONS[selectedCenterStyle]||CENTER_STYLE_OPTIONS.emerald;
  board.style.background=`radial-gradient(circle at 50% 28%,rgba(230,186,92,.12),transparent 42%),linear-gradient(180deg,${center.top},${center.bottom})`;
  if(stage)stage.style.background=`linear-gradient(145deg,${table.a},${table.b} 56%,${table.c})`;
  applyCenterFrameSelection();
}
function startSinglePlayerFromMenu(){
  isMultiplayerMode=false;
  mp.playerName=getStoredPlayerName();
  mp.playerAvatar=selectedAvatar;
  start4PGame('Medium',false);
}
function openCustomizeProfile(){
  avatarPickerMode='profile';
  syncProfileNameToInputs();
  renderCustomizeProfile();
  setDisplay('modal-avatar-picker','flex');
}
function closeCustomizeProfile(){avatarPickerMode='';setDisplay('modal-avatar-picker','none')}
function saveCustomizeProfile(){
  const name=((byId('custom-player-name')?.value||'Player').trim().slice(0,20)||'Player');
  try{localStorage.setItem(PLAYER_PROFILE_NAME_KEY,name)}catch{}
  mp.playerName=name;mp.playerAvatar=selectedAvatar;
  syncProfileNameToInputs();
  applyCustomizeStyle();
  closeCustomizeProfile();
}
function resetCustomizeStyle(){
  selectedAvatar='panda';
  selectedTableStyle='emerald';
  selectedCenterStyle='emerald';
  selectedCenterFrame='classic-gold';
  try{localStorage.removeItem('hk_avatar');localStorage.removeItem(PLAYER_PROFILE_NAME_KEY);localStorage.removeItem(PLAYER_TABLE_STYLE_KEY);localStorage.removeItem(PLAYER_CENTER_STYLE_KEY)}catch{}
  mp.playerName='Player';mp.playerAvatar='panda';
  applyCustomizeStyle();syncProfileNameToInputs();renderCustomizeProfile();
}
function openAvatarPicker(){openCustomizeProfile()}
function confirmAvatarSelection(){saveCustomizeProfile()}

function syncHumanAvatars(room){
  if(!room?.players)return;
  for(let i=0;i<4;i++){
    const p=room.players[i];
    if(p?.avatar&&AVATAR_IDS.includes(p.avatar))playerAvatars[i]=p.avatar;
  }
}
function randomizeAiAvatars(){
  const humanIds=[];
  for(let i=0;i<4;i++)if(!aiSeats.has(i)&&AVATAR_IDS.includes(playerAvatars[i]))humanIds.push(playerAvatars[i]);
  const ai=shuffleArray(AVATAR_IDS.filter(id=>!humanIds.includes(id)));
  for(const seat of [...aiSeats]){
    playerAvatars[seat]=ai.length?ai.shift():AVATAR_IDS[Math.floor(Math.random()*AVATAR_IDS.length)];
  }
}
function renderAvatars(){
  const s=mp.seat??0,m=mappedSeats(s);
  const displaySeats=[
    ['.pos-bottom .avatar-img',m[0]],
    ['.pos-left .avatar-img',m[3]],
    ['.pos-top .avatar-img',m[2]],
    ['.pos-right .avatar-img',m[1]]
  ];
  displaySeats.forEach(([sel,p])=>{
    const el=document.querySelector(sel);if(!el)return;
    const id=playerAvatars[p]||'panda';
    const def=getAvatarDef(id);
    el.style.backgroundImage=`url("${def.file}")`;
    el.style.backgroundSize='cover';
    el.style.backgroundPosition='center';
    el.setAttribute('aria-label',`${def.name} avatar`);
  });
}
function showScoreChange(el,delta){
  if(!el||!delta)return;
  el.classList.remove('score-change-up','score-change-down');
  void el.offsetWidth;
  el.classList.add(delta>0?'score-change-up':'score-change-down');
  if(el._scoreChangeTimer)clearTimeout(el._scoreChangeTimer);
  el._scoreChangeTimer=setTimeout(()=>el.classList.remove('score-change-up','score-change-down'),520);
  if(!el.classList.contains('score-south')&&!el.classList.contains('score-north'))return;
  const old=el.querySelector('.score-change-float');
  old?.remove();
  const badge=document.createElement('span');
  badge.className=`score-change-float ${delta>0?'up':'down'}`;
  badge.textContent=(delta>0?'+':'')+Math.round(delta).toLocaleString('id-ID');
  el.appendChild(badge);
  setTimeout(()=>badge.remove(),760);
}
function animateScoreValue(el,target,duration=520){
  if(!el)return;
  const next=Math.round(Number(target)||0);
  const raw=el.dataset.scoreValue;
  const hadValue=raw!==undefined;
  const current=hadValue?Number(raw):Number(String(el.textContent||'').replace(/\D/g,''))||0;
  if(current===next){el.textContent=next.toLocaleString('id-ID');el.dataset.scoreValue=String(next);return;}
  if(hadValue)showScoreChange(el,next-current);
  const start=current,t0=performance.now(),ease=t=>1-Math.pow(1-t,3);
  const frame=now=>{const p=Math.min(1,(now-t0)/duration);const value=Math.round(start+(next-start)*ease(p));el.textContent=value.toLocaleString('id-ID');el.dataset.scoreValue=String(value);if(p<1)requestAnimationFrame(frame)};
  requestAnimationFrame(frame);
}
function updateScoresUI(){
  const localSeat=mp.seat??0;
  const m=mappedSeats(localSeat);
  document.querySelectorAll('.score-tag').forEach(el=>el.classList.remove('score-turn-active'));
  m.forEach((canon,display)=>{animateScoreValue(byId(`score-${display}`),playerScores[canon],520);if(canon===currentTurn)byId(`score-${display}`)?.classList.add('score-turn-active');});
}
function updateTurnHighlight(){
  const localSeat=mp.seat??0,m=mappedSeats(localSeat);
  const displaySeats=[
    ['.pos-bottom',m[0]],
    ['.pos-left',m[3]],
    ['.pos-top',m[2]],
    ['.pos-right',m[1]]
  ];
  displaySeats.forEach(([sel,canon])=>{
    const el=document.querySelector(sel);
    if(el)el.classList.toggle('turn-active',canon===currentTurn);
  });
}
function getRoundName(){return ['East 1','East 2','East 3','East 4','East 5','East 6'][currentRoundIndex]||`East ${currentRoundIndex+1}`}
function getLocalizedRoundName(){
  const base=getRoundName();
  return hkLanguage==='id'?base.replace(/^East/i,'Timur').toUpperCase():base.toUpperCase();
}
let roundTransitionTimer=null;
function hideRoundTransition(){
  const el=byId('round-transition');
  if(!el)return;
  clearTimeout(roundTransitionTimer);
  roundTransitionTimer=null;
  el.classList.remove('is-visible');
  el.hidden=true;
  el.setAttribute('aria-hidden','true');
}
function showRoundTransition(){
  const el=byId('round-transition');
  if(!el)return;
  clearTimeout(roundTransitionTimer);
  setText('round-transition-kicker',hkLanguage==='id'?'RONDE BERIKUTNYA':'NEXT ROUND');
  setText('round-transition-title',getLocalizedRoundName());
  setText('round-transition-sub',hkLanguage==='id'?'Bersiap untuk ronde berikutnya':'Prepare for the next hand');
  el.hidden=false;
  el.setAttribute('aria-hidden','false');
  el.classList.remove('is-visible');
  void el.offsetWidth;
  el.classList.add('is-visible');
  roundTransitionTimer=setTimeout(hideRoundTransition,1100);
}
function playerName(i){
  const localSeat=mp.seat??0;
  if(aiSeats.has(i))return `AI ${['Red','Jade','Bamboo','Pearl'][i]||'Bot'}`;
  if(!isMultiplayerMode&&i===localSeat)return getStoredPlayerName();
  if(mp.room?.players?.[i]?.name)return mp.room.players[i].name;
  if(i===localSeat)return String(mp.playerName||getStoredPlayerName()||'Player').trim().slice(0,20)||'Player';
  return HUMAN_NAMES[i];
}
function mappedSeats(seat){const s=seat??0;return[s,(s+1)%4,(s+2)%4,(s+3)%4]}
function sortHand(p){if(!autoSortSetting||!playerHands[p])return;const h=playerHands[p];h.sort((a,b)=>a.id-b.id);if(drawnTile&&p===currentTurn){const i=h.findIndex(t=>t.uniqueId===drawnTile.uniqueId);if(i>=0&&i!==h.length-1)h.push(h.splice(i,1)[0])}}
function renderNames(){
  const s=mp.seat??0,m=mappedSeats(s);
  const winds=['South','East','North','West'];
  const windNames=hkLanguage==='id'?['Selatan','Timur','Utara','Barat']:winds;
  setText('name-bottom',`${playerName(m[0])} • ${windNames[m[0]]}`);
  setText('name-left',`${playerName(m[3])} • ${windNames[m[3]]}`);
  setText('name-top',`${playerName(m[2])} • ${windNames[m[2]]}`);
  setText('name-right',`${playerName(m[1])} • ${windNames[m[1]]}`);
  setText('round-title-display',getRoundName());
}
// -------- Hand advisor: known remaining tiles + one-away waits --------
let advisorKnownCacheKey='';
let advisorKnownCache=null;
function advisorKnownCounts(excludeSeatHand=false){
  const seat=mp.seat??0;
  const hand=playerHands[seat]||[];
  const key=[
    seat,
    excludeSeatHand?'1':'0',
    hand.map(t=>t?.uniqueId||'').join(','),
    (playerRivers||[]).map(r=>(r||[]).map(t=>t?.uniqueId||'').join(',')).join('|'),
    (playerMelds||[]).map(gs=>(gs||[]).map(g=>(g||[]).map(t=>t?.uniqueId||'').join(',')).join('/')).join('|')
  ].join('||');

  if(advisorKnownCache && advisorKnownCacheKey===key)return advisorKnownCache.slice();

  const known=Array(34).fill(0);
  if(!excludeSeatHand)for(const t of hand)if(t)known[t.id]++;
  for(const river of playerRivers||[])for(const t of (river||[]))if(t)known[t.id]++;
  for(const groups of playerMelds||[])for(const g of (groups||[]))for(const t of (g||[]))if(t)known[t.id]++;

  advisorKnownCacheKey=key;
  advisorKnownCache=known;
  return known.slice();
}
function tileLabelById(id){const t=TILE_TYPES[id];return t?t.val:'?'}
function tileFriendlyLabelById(id){const t=TILE_TYPES[id];if(!t)return'?';if(t.type==='sou')return `${t.num} Bambu`;if(t.type==='pin')return `${t.num} Lingkaran`;if(t.type==='man')return `${t.num} Karakter`;const honor={27:'Timur',28:'Selatan',29:'Barat',30:'Utara',31:'Naga Putih',32:'Naga Hijau',33:'Naga Merah'};return honor[id]||t.val}
function formatWaitList(waitIds,known){
  return waitIds.map(id=>{
    const left=Math.max(0,4-(known[id]||0));
    return `${tileLabelById(id)} (${left})`;
  }).join(' · ');
}
function getAdvisorForDiscard(p,index){
  const hand=playerHands[p]||[]; if(index<0||index>=hand.length)return null;
  const kept=hand.slice(); kept.splice(index,1);
  // After discarding, a normal hand should be 13 tiles (plus meld-equivalent hand size).
  const meldCount=(playerMelds[p]||[]).length;
  const waits=getWaitIds(kept,meldCount);
  const known=advisorKnownCounts();
  const left=waits.map(id=>({id,left:Math.max(0,4-(known[id]||0))}));
  const live=left.filter(x=>x.left>0);
  const dead=left.filter(x=>x.left===0);
  return {discard:hand[index],waits,left,live,dead,known};
}
function showTileAdvisor(index){
  const p=mp.seat??0;
  const a=getAdvisorForDiscard(p,index);
  if(!a){setText('hand-status-main','Giliran Anda');setText('hand-status-sub','Pilih tile untuk membuang.');return;}
  const name=a.discard?.val||'tile';
  if(a.waits.length){
    const live=a.live.map(x=>`${tileLabelById(x.id)} ×${x.left}`).join(' · ');
    const dead=a.dead.map(x=>tileLabelById(x.id)).join(' · ');
    const visible=a.waits.map(id=>`${tileLabelById(id)} ${Math.max(0,4-(a.known[id]||0))}`).join(' · ');
    setText('hand-status-main',`Buang ${name} → ${a.live.length?`TENPAI · ${a.live.length} wait`:'SEMUA WAIT HABIS'}`);
    let sub=a.live.length?`Tsumo/Ron: ${live}`:'Tidak ada sisa tile yang diketahui untuk wait ini.';
    if(dead)sub+=` | Habis: ${dead}`;
    if(visible)sub+=` | Sisa: ${visible}`;
    setText('hand-status-sub',sub);
    return;
  }
  setText('hand-status-main',`Buang ${name} → belum Tenpai`);
  setText('hand-status-sub','Belum ada 1 kartu langsung menuju Mahjong dari buangan ini.');
}
let smartAssistantState={title:'',detail:'',tone:'',visible:false};
function smartAssistantShow(title,detail,tone='gold'){
  const box=byId('smart-assistant');
  if(!box)return;
  if(smartAssistantState.visible&&smartAssistantState.title===title&&smartAssistantState.detail===detail&&smartAssistantState.tone===tone)return;
  smartAssistantState={title,detail,tone,visible:true};
  box.hidden=false;
  box.classList.remove('is-green','is-red');
  if(tone==='green')box.classList.add('is-green');
  if(tone==='red')box.classList.add('is-red');
  setText('smart-assistant-title',title);
  setText('smart-assistant-detail',detail);
}
function smartAssistantHide(){
  const box=byId('smart-assistant');
  if(!box)return;
  if(!smartAssistantState.visible)return;
  smartAssistantState={title:'',detail:'',tone:'',visible:false};
  box.hidden=true;
  box.classList.remove('is-green','is-red');
  setText('smart-assistant-title','');
  setText('smart-assistant-detail','');
}
function updateCriticalAssistant(){if(!roundActive||currentTurn!==(mp.seat??0))return false;if(Number(secondsLeft)<5){smartAssistantShow(`${secondsLeft} DETIK`,'Pilih tile sekarang.','red');return true}return false}
let assistantDecisionKey='';
function showCurrentWaitAdvisor(){
  const p=mp.seat??0;
  const hand=playerHands[p]||[];
  const meldCount=(playerMelds[p]||[]).length;
  const expectedDrawn=14-(meldCount*3);
  const expectedReady=13-(meldCount*3);
  const handKey=hand.map(t=>t?.uniqueId||'').join(',');
  const known=advisorKnownCounts();
  const key=`${p}|${currentTurn}|${handKey}|${meldCount}|${known.join(',')}`;

  if(key===assistantDecisionKey)return;
  assistantDecisionKey=key;

  if(hand.length===expectedDrawn){
    const win=checkCurrentWin(p,null,true);
    if(win?.valid){
      smartAssistantShow('TSUMO TERSEDIA',`${win.fan} FAN • ${win.points.toLocaleString('id-ID')} poin`,'green');
      return;
    }
  }

  if(hand.length===expectedReady){
    const waits=getWaitIds(hand,meldCount);
    if(waits.length){
      const live=waits
        .map(id=>({id,left:Math.max(0,4-(known[id]||0))}))
        .filter(x=>x.left>0)
        .map(x=>`${tileFriendlyLabelById(x.id)} ×${x.left}`)
        .join(' • ');
      if(live)smartAssistantShow('TENPAI READY',`Menunggu: ${live}`,'gold');
      else smartAssistantShow('TENPAI • WAIT HABIS','Semua tile tunggu yang diketahui sudah habis.','red');
      return;
    }
  }

  smartAssistantHide();
}

function countDiscardedTile(id){let n=0;for(const river of playerRivers||[])for(const t of (river||[]))if(t&&t.id===id)n++;return n}
function countKnownTile(id){const known=advisorKnownCounts();return known[id]||0}
function highlightMatchingTiles(tileId){document.querySelectorAll('#player-hand-tiles .tile').forEach(x=>x.classList.toggle('same-tile-highlight',Number(x.dataset.tileId)===tileId));document.querySelectorAll('.discard-tile').forEach(x=>x.classList.toggle('same-tile-highlight',Number(x.dataset.tileId)===tileId));}
function renderHand(){const wrap=byId('player-hand-tiles');if(!wrap)return;const p=mp.seat??0;sortHand(p);wrap.innerHTML='';const h=playerHands[p]||[];const canInteract=p===currentTurn&&p===(mp.seat??0)&&isDiscardable;const newDrawnId=drawnTile?.uniqueId??null;const shouldAnimateDrawn=!!newDrawnId&&newDrawnId!==lastDrawnTileHighlightId;h.forEach((t,i)=>{const e=document.createElement('div');e.className='tile';if(canInteract)e.classList.add('is-interactive');if(drawnTile&&t.uniqueId===drawnTile.uniqueId){e.classList.add('drawn-tile-gap');if(shouldAnimateDrawn)e.classList.add('drawn-tile-emphasis');}if(i===selectedTileIndex)e.classList.add('selected-tile');if(selectedTileIndex>=0&&h[selectedTileIndex]&&h[selectedTileIndex].id===t.id)e.classList.add('same-tile-highlight');e.dataset.index=i;e.dataset.tileId=t.id;e.innerHTML=tileMarkup(t);e.onclick=()=>handleTileTap(i,e);wrap.appendChild(e)});if(newDrawnId)lastDrawnTileHighlightId=newDrawnId;}
function renderEnemyHands(){const s=mp.seat??0,m=mappedSeats(s);[[`enemy-hand-top`,m[2]],[`enemy-hand-right`,m[1]],[`enemy-hand-left`,m[3]]].forEach(([id,p])=>{const e=byId(id);if(!e)return;e.innerHTML='';const count=Math.max(0,playerHands[p]?.length||0);for(let i=0;i<count;i++){const b=document.createElement('span');b.className='mini-back';e.appendChild(b)}const label=document.createElement('span');label.className='hand-count-label';label.textContent=`×${count}`;e.appendChild(label);})}
function renderRivers(){const s=mp.seat??0,m=mappedSeats(s);const selectedId=(selectedTileIndex>=0&&playerHands[s]?.[selectedTileIndex])?playerHands[s][selectedTileIndex].id:null;const newDiscardId=lastDiscardedTile?.uniqueId??null;const shouldAnimateDiscard=!!newDiscardId&&newDiscardId!==lastDiscardAnimationId;[['river-bottom',m[0]],['river-right',m[1]],['river-top',m[2]],['river-left',m[3]]].forEach(([id,p])=>{const e=byId(id);if(!e)return;e.innerHTML='';const tiles=(playerRivers[p]||[]).slice(0,id==='river-top'||id==='river-bottom'?32:30);tiles.forEach((t,index)=>{const d=document.createElement('div');d.className='discard-tile';if(selectedId!==null&&t.id===selectedId)d.classList.add('same-tile-highlight');if(p===lastDiscarderIdx&&index===tiles.length-1&&lastDiscardedTile?.uniqueId===t.uniqueId){d.classList.add('last-discard-highlight');if(shouldAnimateDiscard)d.classList.add('discard-enter');}d.dataset.tileId=t.id;d.innerHTML=tileMarkup(t);e.appendChild(d)})});if(newDiscardId)lastDiscardAnimationId=newDiscardId;}
function renderMelds(){const s=mp.seat??0,m=mappedSeats(s);const buildMeldKey=(seat,index,g)=>`${seat}:${index}:${(g||[]).map(t=>t?.uniqueId??`${t?.id??''}-${t?.num??''}`).join(',')}`;const own=byId('player-melds-container');if(own){own.innerHTML='';(playerMelds[m[0]]||[]).forEach((g,gi)=>{const box=document.createElement('div');box.className='meld-group';const key=buildMeldKey(m[0],gi,g);const reveal=meldAnimationInitialized&&!seenMeldAnimationKeys.has(key);if(reveal)box.classList.add('meld-reveal');seenMeldAnimationKeys.add(key);g.forEach(t=>{const x=document.createElement('div');x.className='tile';x.innerHTML=tileMarkup(t);box.appendChild(x)});own.appendChild(box)})}const enemyMap=[['enemy-meld-top-label','enemy-meld-top-tiles',m[2]],['enemy-meld-right-label','enemy-meld-right-tiles',m[1]],['enemy-meld-left-label','enemy-meld-left-tiles',m[3]]];enemyMap.forEach(([labelId,tilesId,p])=>{const label=byId(labelId),wrap=byId(tilesId);const groups=playerMelds[p]||[];const labels=groups.map(g=>g.length===4?'Kan':(g.length===3&&g.every(t=>t.id===g[0].id)?'Pon':'Chow'));if(label)setText(labelId,labels.length?labels.join(' • '):'');if(!wrap)return;wrap.innerHTML='';groups.forEach((g,gi)=>{const box=document.createElement('div');box.className='enemy-meld-group';const key=buildMeldKey(p,gi,g);const reveal=meldAnimationInitialized&&!seenMeldAnimationKeys.has(key);if(reveal)box.classList.add('meld-reveal');seenMeldAnimationKeys.add(key);g.forEach(t=>{const x=document.createElement('div');x.className='tile';x.innerHTML=tileMarkup(t);box.appendChild(x)});wrap.appendChild(box)})});meldAnimationInitialized=true;}
function renderTable(){advisorKnownCacheKey='';advisorKnownCache=null;renderNames();renderAvatars();updateTurnHighlight();renderPlayerConnectionStatus(mp.room);renderHand();renderEnemyHands();renderRivers();renderMelds();updateScoresUI();updateTimeBankUI(mp.seat??0);if(!isMultiplayerMode){renderLocalTurnTimer(isActionPhase?actionSecondsLeft:secondsLeft,isActionPhase?actionSeat:currentTurn);}else if(isActionPhase){renderLocalTurnTimer(actionSecondsLeft,actionSeat);}else{renderLocalTurnTimer(secondsLeft,currentTurn);}const tilesLeftEl=byId('tiles-remaining');const tilesRemaining=Math.max(0,Number(fullDeck.length)||0);if(tilesLeftEl){tilesLeftEl.classList.toggle('low',tilesRemaining<30);tilesLeftEl.textContent=hkTranslateRemaining(tilesRemaining);}updateMusicIntensity();showCurrentWaitAdvisor();if(currentTurn===(mp.seat??0)){setText('hand-status-main','Giliran Anda');setText('hand-status-sub','Pilih tile untuk membuang.');}else{setText('hand-status-main',`Giliran ${playerName(currentTurn)}`);setText('hand-status-sub','Menunggu giliran pemain.');}}

function isSequenceGroup(group){
  if(!Array.isArray(group)||group.length!==3)return false;
  const [a,b,c]=group;
  if(!a||!b||!c||a.type==='honor'||b.type!==a.type||c.type!==a.type)return false;
  return b.num===a.num+1&&c.num===a.num+2;
}
function canFormOnlySequences(counts){
  for(let id=0;id<34;id++){
    if(counts[id]===0)continue;
    if(id>=27||id%9>6)return false;
    if(counts[id]>0&&counts[id+1]>0&&counts[id+2]>0){
      counts[id]--;counts[id+1]--;counts[id+2]--;
      if(canFormOnlySequences(counts))return true;
      counts[id]++;counts[id+1]++;counts[id+2]++;
    }
    return false;
  }
  return true;
}
function canFormOnlyTriplets(counts){
  for(let id=0;id<34;id++){
    if(counts[id]===0)continue;
    if(counts[id]>=3){
      counts[id]-=3;
      if(canFormOnlyTriplets(counts))return true;
      counts[id]+=3;
    }
    return false;
  }
  return true;
}
function isAllPungsHand(hand,melds){
  const groups=melds||[];
  if(groups.some(g=>!Array.isArray(g)||!g.length||!g.every(t=>t&&t.id===g[0]?.id)))return false;
  const c=tileCounts(hand);
  for(let id=0;id<34;id++){
    if(c[id]<2)continue;
    c[id]-=2;
    if(canFormOnlyTriplets(c)){c[id]+=2;return true}
    c[id]+=2;
  }
  return false;
}
function isAllChiHand(hand,melds){
  const groups=melds||[];
  if(groups.some(g=>!isSequenceGroup(g)))return false;
  const c=tileCounts(hand);
  for(let id=0;id<34;id++){
    if(c[id]<2)continue;
    c[id]-=2;
    if(canFormOnlySequences(c)){c[id]+=2;return true}
    c[id]+=2;
  }
  return false;
}
function isFullHouseHand(all){
  const suits=new Set((all||[]).filter(t=>t&&t.type!=='honor').map(t=>t.type));
  const hasHonor=(all||[]).some(t=>t&&t.type==='honor');
  return suits.size===1&&!hasHonor;
}
function isMixedOneSuitHand(all){
  const tiles=(all||[]).filter(Boolean);
  for(const suit of ['man','pin','sou']){
    const main=tiles.filter(t=>t.type===suit);
    const outside=tiles.filter(t=>t.type!==suit);
    if(main.length!==11&&main.length!==12)continue;
    if(outside.length!==2&&outside.length!==3)continue;
    if(outside.every(t=>t.id===outside[0].id))return true;
  }
  return false;
}
function isAllHonorsHand(all){
  const tiles=(all||[]).filter(Boolean);
  return tiles.length>0&&tiles.every(t=>t.type==='honor');
}
function isMixedTerminalsHonorsHand(all){
  const tiles=(all||[]).filter(Boolean);
  return tiles.length>0&&tiles.every(isTerminalOrHonor);
}
function isAllTerminalsHand(all){
  const tiles=(all||[]).filter(Boolean);
  return tiles.length>0&&tiles.every(t=>t.type!=='honor'&&(t.num===1||t.num===9));
}
function isThirteenOrphans(c,melds){
  if((melds||[]).length)return false;
  const required=[0,8,9,17,18,26,27,28,29,30,31,32,33];
  if(!required.every(id=>c[id]>=1))return false;
  let extra=0;
  for(let id=0;id<34;id++){
    if(!required.includes(id)){if(c[id]!==0)return false;continue}
    if(c[id]===2)extra++;
    else if(c[id]!==1)return false;
  }
  return extra===1;
}
function isNineGates(c,melds){
  if((melds||[]).length)return false;
  let suit=-1,total=0;
  for(const s of ['man','pin','sou']){
    const base=s==='man'?0:s==='pin'?9:18;
    const counts=c.slice(base,base+9);
    const sum=counts.reduce((a,b)=>a+b,0);
    if(!sum)continue;
    if(suit!==-1)return false;
    suit=base;total=sum;
  }
  if(suit<0||total!==14)return false;
  for(let i=0;i<34;i++)if(i<27&&i>=suit&&i<suit+9){}else if(c[i])return false;
  const x=c.slice(suit,suit+9);
  if(x[0]<3||x[8]<3)return false;
  for(let i=1;i<=7;i++)if(x[i]<1)return false;
  const excess=x[0]-3+x[8]-3+x.slice(1,8).reduce((a,n)=>a+(n-1),0);
  return excess===1;
}
function dragonIds(){return [31,32,33]}
function windIds(){return [27,28,29,30]}
function countTripletIds(c,ids){return ids.filter(id=>c[id]>=3).length}
function countPairIds(c,ids){return ids.filter(id=>c[id]===2).length}
function isLittleThreeDragons(c){
  const d=dragonIds();
  return countTripletIds(c,d)===2&&countPairIds(c,d)===1;
}
function isBigThreeDragons(c){
  return countTripletIds(c,dragonIds())===3;
}
function isLittleFourWinds(c){
  const w=windIds();
  return countTripletIds(c,w)===3&&countPairIds(c,w)===1;
}
function isBigFourWinds(c){
  return countTripletIds(c,windIds())===4;
}
function isFourConcealedPungs(c,melds){
  if((melds||[]).length)return false;
  const ids=[];
  for(let id=0;id<34;id++)if(c[id]>=3)ids.push(id);
  if(ids.length!==4)return false;
  let pair=0;
  for(let id=0;id<34;id++){
    if(ids.includes(id)){if(c[id]!==3)return false}
    else if(c[id]===2)pair++;else if(c[id]!==0)return false;
  }
  return pair===1;
}
function isFourKongs(melds){
  const groups=melds||[];
  return groups.length===4&&groups.every(g=>Array.isArray(g)&&g.length===4&&g.every(t=>t&&t.id===g[0]?.id));
}
function evaluateHK(pIdx,winningTile,isTsumo=false){
  // On Ron the winning tile is still in the river, so include it in the
  // winning-hand calculation exactly once. On Tsumo it is already in hand.
  const hand=[...(playerHands[pIdx]||[]),...(winningTile?[winningTile]:[])];
  const melds=playerMelds[pIdx]||[];
  const all=[...hand,...melds.flat()];
  const c=tileCounts(all);
  const y=[];

  // Main winning-hand patterns.
  if(isAllChiHand(hand,melds))y.push(['All Chi',1]);
  if(isAllPungsHand(hand,melds))y.push(['All Pungs',3]);
  if(isMixedOneSuitHand(all))y.push(['Mixed One Suit',3]);
  if(isFullHouseHand(all))y.push(['Full House',7]);
  if(isAllHonorsHand(all))y.push(['All Honors',10]);
  if(isMixedTerminalsHonorsHand(all))y.push(['Mixed Terminals & Honors',5]);
  if(isAllTerminalsHand(all))y.push(['All Terminals',10]);

  // Special winning hands.
  if(isSevenPairs(c)&&melds.length===0)y.push(['Seven Pairs',4]);
  if(isThirteenOrphans(c,melds))y.push(['Thirteen Orphans',13]);
  if(isNineGates(c,melds))y.push(['Nine Gates',13]);
  if(isLittleThreeDragons(c))y.push(['Little Three Dragons',5]);
  if(isBigThreeDragons(c))y.push(['Big Three Dragons',13]);
  if(isLittleFourWinds(c))y.push(['Little Four Winds',10]);
  if(isBigFourWinds(c))y.push(['Big Four Winds',13]);
  if(isFourConcealedPungs(c,melds))y.push(['Four Concealed Pungs',13]);
  if(isFourKongs(melds))y.push(['Four Kongs',13]);

  // Bonus fan rules.
  for(let id of dragonIds())if(c[id]>=3)y.push(['Dragon Pung/Kong',1]);
  for(let id of windIds())if(c[id]>=3)y.push(['Wind Pung/Kong',1]);
  const kanCount=melds.filter(g=>Array.isArray(g)&&g.length===4).length;
  for(let i=0;i<kanCount;i++)y.push(['Kan',1]);
  if(melds.length===0)y.push(['Concealed Hand',1]);
  if(isTsumo)y.push(['Self Draw',1]);

  const fan=y.reduce((a,b)=>a+b[1],0);
  const basePerFan=500;
  const payment=fan*basePerFan;

  return {
    valid:true,
    fan,
    yaku:y,
    payment,
    points:payment*3,
    yakuStr:y.map(x=>`${x[0]} +${x[1]}F`).join(', ')||'0 Fan • Tidak ada kombinasi Fan',
    detail:`${fan} Fan • ${isTsumo?'Self Draw':'Discard Win'}`
  };
}
function drawTile(){if(!fullDeck.length)return null;return fullDeck.pop()}
function setupRound(){cancelAiTurn();assistantDecisionKey='';advisorKnownCacheKey='';advisorKnownCache=null;
  actionFeedbackToken++;clearTimeout(actionFeedbackTimer);actionFeedbackTimer=null;activeActionFeedback=null;lastActionFeedbackId='';
  activeCallId=nextMpCallId('TURN');
  mpPendingCalls=[];
  activeRemoteActions=null;
  fullDeck=makeDeck();playerHands=[[],[],[],[]];playerRivers=[[],[],[],[]];playerMelds=[[],[],[],[]];lastDiscardedTile=null;lastDiscarderIdx=-1;lastDrawnTileHighlightId=null;lastDiscardAnimationId=null;seenMeldAnimationKeys=new Set();meldAnimationInitialized=false;selectedTileIndex=-1;roundEnding=false;roundActive=true;secondsLeft=TURN_BASE_SECONDS;timeBank=[TIME_BANK_MAX,TIME_BANK_MAX,TIME_BANK_MAX,TIME_BANK_MAX];actionSecondsLeft=0;pendingCallChoice=null;clearInterval(turnTimer);clearInterval(actionTimer);
  for(let n=0;n<13;n++)for(let p=0;p<4;p++)playerHands[p].push(fullDeck.pop());
  for(let p=0;p<4;p++)sortHand(p);
  currentTurn=currentDealerIdx;drawnTile=null;renderTable();processTurn();
  if(typeof gameChatRefreshVisibility==='function')gameChatRefreshVisibility();
}
function start4PGame(diff='Medium',multi=false){hideRoundTransition();mpHistoryRounds=[];mpHistorySavedKeys=new Set();mpHistoryCompletedMatch=null;mpHistoryMatchStartedAt=Date.now();mpHistoryMatchId=multi&&mp.host?`${mp.room?.code||'Multiplayer'}-${mpHistoryMatchStartedAt}`:null;activeRemoteActions=null;mpPendingCalls=[];activeActionFeedback=null;actionFeedbackToken++;clearTimeout(actionFeedbackTimer);actionFeedbackTimer=null;lastActionFeedbackId='';activeCallId=null;mpCallSeq=0;mpActionSeq=0;mpProcessedActionIds=new Set();cancelAiTurn();clearGameTimers();gameTurnEpoch++;if(!multi){stopMpGameWatchdog();lastHostServerSeq=0;}
  aiMoveTimer&&clearTimeout(aiMoveTimer);clearInterval(turnTimer);isMultiplayerMode=!!multi;roundActive=false;roundEnding=false;currentRoundIndex=0;currentDealerIdx=1;currentTurn=currentDealerIdx;
  if(!multi){
    mp.seat=0;mp.room=null;mp.host=true;mp.connected=false;mp.playerAvatar=selectedAvatar;
    aiSeats=new Set([1,2,3]);playerAvatars[0]=selectedAvatar;playerAvatars[1]='shiba';playerAvatars[2]='turtle';playerAvatars[3]='penguin';randomizeAiAvatars();
    playerScores=[15000,15000,15000,15000];nav('screen-game');playGameMusic();setTimeout(()=>{startMpGameWatchdog();setupRound();gameChatRefreshVisibility()},20);return
  }
  if(mp.host){
    fillAiSeats();playerScores=[15000,15000,15000,15000];nav('screen-game');playGameMusic();setTimeout(()=>{startMpGameWatchdog();setupRound();gameChatRefreshVisibility()},20);mpSaveSession({started:true});mpBroadcastState()
  }
}
function fillAiSeats(){
  const human=new Set((mp.room?.players||[]).map((p,i)=>p?i:-1).filter(i=>i>=0));
  aiSeats=new Set();for(let i=0;i<4;i++)if(!human.has(i))aiSeats.add(i);
  syncHumanAvatars(mp.room);
  if(mp.seat!==null&&mp.seat!==undefined)playerAvatars[mp.seat]=mp.playerAvatar||playerAvatars[mp.seat]||'panda';
  randomizeAiAvatars();
}
function checkCurrentWin(p,t,isTsumo){
  const base=Array.isArray(playerHands[p])?playerHands[p]:[];
  const melds=Array.isArray(playerMelds[p])?playerMelds[p]:[];
  const hand=t?[...base,t]:[...base];
  const meldCount=melds.length;
  // Hong Kong hand structure: each exposed meld removes 3 concealed tiles
  // from the normal 14-tile winning shape, including a 4-tile Kan.
  const expected=14-(meldCount*3);
  if(hand.length!==expected)return null;
  if(!isWinningShape(hand,meldCount))return null;
  return evaluateHK(p,t,isTsumo);
}
function isWinningShape(tiles,meldCount=0){
  const needed=14-(meldCount*3);
  if(!Array.isArray(tiles)||tiles.length!==needed)return false;
  const c=tileCounts(tiles);
  if(meldCount===0&&isSevenPairs(c))return true;
  // Try every possible pair, then solve the remaining tiles as sequences/triplets.
  for(let id=0;id<34;id++){
    if(c[id]<2)continue;
    c[id]-=2;
    if(canFormMelds(c))return true;
    c[id]+=2;
  }
  return false;
}
function shouldShowLocalTurnTimer(seat){
  if(!isMultiplayerMode)return true;
  return Number(seat)===(mp.seat??0);
}
function renderLocalTurnTimer(value,seat=currentTurn){
  const el=byId('turn-timer-display');
  if(!el)return;
  const numeric=Math.max(0,Number(value)||0);
  const visible=shouldShowLocalTurnTimer(seat);
  el.textContent=visible?String(numeric):'--';
  el.classList.toggle('timer-danger',visible&&numeric<5);
}
function updateTurnTimerVisual(value=secondsLeft,seat=currentTurn){
  const el=byId('turn-timer-display');
  if(!el)return;
  const numeric=Math.max(0,Number(value)||0);
  const visible=shouldShowLocalTurnTimer(seat);
  el.classList.toggle('timer-danger',visible&&numeric<5);
}
function updateTimeBankUI(p=currentTurn){
  const el=byId('player-time-bank');
  if(el)el.textContent=`+${Math.max(0,timeBank[p]??0)}s`;
}
function broadcastTimerState(extra={}){
  if(isMultiplayerMode&&mp.host&&mp.connected)mpBroadcastState({remoteTimer:{seat:currentTurn,baseTime:secondsLeft,timeBank:timeBank[currentTurn]??0,actionSeconds:actionSecondsLeft,isActionPhase,...extra}});
}
function clearGameTimers(){
  clearInterval(turnTimer);
  clearInterval(actionTimer);
  turnTimer=null;
  actionTimer=null;
}
function startTurnTimer(resume=false){
  clearGameTimers();
  isActionPhase=false; actionSecondsLeft=0; pendingCallChoice=null;
  actionTimeoutHandler=null; actionSeat=-1; actionMode='';
  const p=currentTurn, epoch=gameTurnEpoch;
  if(!resume)secondsLeft=TURN_BASE_SECONDS;
  renderLocalTurnTimer(secondsLeft,p);
  updateCriticalAssistant(); updateTimeBankUI(p); broadcastTimerState();
  turnTimer=setInterval(()=>{
    if(!roundActive||roundEnding||epoch!==gameTurnEpoch||p!==currentTurn){
      clearInterval(turnTimer); turnTimer=null; return;
    }
    try{
      if(secondsLeft>0){
        secondsLeft--;
        renderLocalTurnTimer(secondsLeft,p);
        updateCriticalAssistant();
      }else if((timeBank[p]||0)>0){
        timeBank[p]--;
        renderLocalTurnTimer(timeBank[p],p);
        updateCriticalAssistant(); updateTimeBankUI(p);
        if(timeBank[p]<=0){
          clearInterval(turnTimer); turnTimer=null;
          broadcastTimerState(); autoDiscardCurrent(); return;
        }
      }else{
        clearInterval(turnTimer); turnTimer=null; autoDiscardCurrent(); return;
      }
      broadcastTimerState();
    }catch(err){
      console.error('Turn timer recovery:',err);
      clearInterval(turnTimer); turnTimer=null; autoDiscardCurrent();
    }
  },1000);
}
function startActionWindow(timeoutHandler,seat=currentTurn,mode='call',resume=false){
  clearGameTimers();
  isActionPhase=true; if(!resume)actionSecondsLeft=ACTION_WINDOW_SECONDS;
  actionTimeoutHandler=timeoutHandler; actionSeat=seat; actionMode=mode;
  const o=byId('action-overlay');
  if(o&&!o.hidden){
    if(!Number(o.dataset.actionTotal))o.dataset.actionTotal=String(ACTION_WINDOW_SECONDS+(timeBank[seat]||0));
    updateActionOverlayTimer(actionSecondsLeft+(timeBank[seat]||0),seat,'action');
  }
  const epoch=gameTurnEpoch;
  renderLocalTurnTimer(actionSecondsLeft,seat);
  updateTimeBankUI(seat); broadcastTimerState({actionMode:mode,seat});
  actionTimer=setInterval(()=>{
    if(!roundActive||roundEnding||epoch!==gameTurnEpoch){
      clearInterval(actionTimer); actionTimer=null; return;
    }
    try{
      if(actionSecondsLeft>0){
        actionSecondsLeft--;
        renderLocalTurnTimer(Math.max(0,actionSecondsLeft),seat);
        updateActionOverlayTimer(actionSecondsLeft+(timeBank[seat]||0),seat,'action');
        broadcastTimerState({actionMode:mode,seat}); return;
      }
      if((timeBank[seat]||0)>0){
        timeBank[seat]--;
        renderLocalTurnTimer(timeBank[seat],seat); updateTimeBankUI(seat);
        updateActionOverlayTimer(actionSecondsLeft+(timeBank[seat]||0),seat,'bank');
        broadcastTimerState({actionMode:mode,seat});
        if(timeBank[seat]<=0){
          clearInterval(actionTimer); actionTimer=null; isActionPhase=false;
          updateActionOverlayTimer(0,seat,'bank');
          const cb=actionTimeoutHandler; actionTimeoutHandler=null;
          actionSeat=-1; actionMode=''; cb?.();
        }
        return;
      }
      clearInterval(actionTimer); actionTimer=null; isActionPhase=false;
      updateActionOverlayTimer(0,seat,'action');
      const cb=actionTimeoutHandler; actionTimeoutHandler=null;
      actionSeat=-1; actionMode=''; cb?.();
    }catch(err){
      console.error('Action timer recovery:',err);
      clearInterval(actionTimer); actionTimer=null; isActionPhase=false;
      const cb=actionTimeoutHandler; actionTimeoutHandler=null;
      actionSeat=-1; actionMode=''; cb?.();
    }
  },1000);
}
function startBankTimerOnly(p=currentTurn){
  clearGameTimers(); secondsLeft=0;
  const epoch=gameTurnEpoch;
  renderLocalTurnTimer(timeBank[p]||0,p); updateTimeBankUI(p);
  broadcastTimerState({phase:'bank-only',seat:p});
  turnTimer=setInterval(()=>{
    if(!roundActive||roundEnding||epoch!==gameTurnEpoch||p!==currentTurn){
      clearInterval(turnTimer); turnTimer=null; return;
    }
    try{
      if((timeBank[p]||0)>0){
        timeBank[p]--;
        renderLocalTurnTimer(timeBank[p],p);
        updateCriticalAssistant(); updateTimeBankUI(p);
        broadcastTimerState({phase:'bank-only',seat:p});
        if(timeBank[p]<=0){clearInterval(turnTimer);turnTimer=null;autoDiscardCurrent();}
      }else{clearInterval(turnTimer);turnTimer=null;autoDiscardCurrent();}
    }catch(err){
      console.error('Bank timer recovery:',err);
      clearInterval(turnTimer); turnTimer=null; autoDiscardCurrent();
    }
  },1000);
}
function cancelAiTurn(){
  aiDecisionToken++;
  if(aiMoveTimer){clearTimeout(aiMoveTimer);aiMoveTimer=null;}
}
function scheduleAiTurn(seat,mode='discard'){
  cancelAiTurn();
  if(!roundActive||roundEnding||!aiSeats.has(seat))return;

  // During a call window, currentTurn still belongs to the discarder.
  // Therefore only normal discard decisions require currentTurn===seat.
  if(mode==='discard'&&currentTurn!==seat)return;

  const token=aiDecisionToken;
  setText('hand-status-main',`${playerName(seat)} berpikir...`);
  setText('hand-status-sub',mode==='call'?'AI mengevaluasi call...':'AI memilih buangan...');

  const run=()=>{
    // Only the timer belonging to this exact AI decision may clear the handle.
    // This prevents an obsolete callback from leaving aiMoveTimer truthy and
    // blocking the multiplayer watchdog from recovering the AI.
    if(token===aiDecisionToken)aiMoveTimer=null;

    if(token!==aiDecisionToken||!roundActive||roundEnding||!aiSeats.has(seat))return;
    if(mode==='discard'&&currentTurn!==seat)return;

    if(mode==='call'){
      const live=mpPendingCalls.find(x=>x.seat===seat);
      if(!live){promptNextCall();return}
      const pick=chooseAiCall(live.actions);
      if(pick){resolveCallChoice(seat,pick);return}
      mpPendingCalls=mpPendingCalls.filter(x=>x!==live);
      mpBroadcastState({remoteActions:[]});
      promptNextCall();
      return;
    }

    aiDiscard(seat);
  };

  // Requested AI thinking time: ~2 seconds.
  aiMoveTimer=setTimeout(run,2000);

  // Recovery guard so a stalled callback cannot leave the table frozen.
  setTimeout(()=>{
    if(token===aiDecisionToken&&aiMoveTimer&&roundActive&&!roundEnding&&aiSeats.has(seat)){
      if(mode==='discard'&&currentTurn!==seat)return;
      clearTimeout(aiMoveTimer);
      aiMoveTimer=null;
      run();
    }
  },2800);
}

function autoDiscardCurrent(){
  if(!roundActive||roundEnding)return;
  const p=currentTurn;
  if(aiSeats.has(p)){aiDiscard(p);return;}
  const idx=selectedTileIndex>=0?selectedTileIndex:playerHands[p]?.length-1;
  const tile=playerHands[p]?.[idx];
  if(!tile)return;
  if(isMultiplayerMode&&!mp.host&&p===(mp.seat??0)){
    queueGuestAction({
      type:'discard',
      uniqueId:tile.uniqueId,
      callId:activeCallId,
      actionId:nextMpActionId('DISCARD')
    });
    return;
  }
  playerHands[p].splice(idx,1);
  selectedTileIndex=-1;
  drawnTile=null;
  commitDiscard(p,tile);
}
function processTurn(){
  if(!roundActive||roundEnding)return;
  if(!activeCallId)activeCallId=nextMpCallId('TURN');
  clearGameTimers(); selectedTileIndex=-1;
  if(fullDeck.length===0){const r=settleExhaustiveDraw();renderTable();endRound(r.changed?'DRAW • TENPAI BONUS':'DRAW',r.desc);return}
  const t=drawTile();if(!t){const r=settleExhaustiveDraw();renderTable();endRound(r.changed?'DRAW • TENPAI BONUS':'DRAW',r.desc);return}playerHands[currentTurn].push(t);drawnTile=t;playSfx('draw');sortHand(currentTurn);renderTable();
  const turnActions=[];const win=checkCurrentWin(currentTurn,null,true);if(win?.valid)turnActions.push('Tsumo');
  const selfKans=getSelfKanOptions(currentTurn);if(selfKans.length)turnActions.push('Kan');
  if(aiSeats.has(currentTurn)){
    const localHand=playerHands[mp.seat??0]||[];
    const localTenpai=localHand.length===13&&getWaitIds(localHand,(playerMelds[mp.seat??0]||[]).length).length>0;
    if(!localTenpai)smartAssistantHide();
    scheduleAiTurn(currentTurn,'discard');
  }else{
    isDiscardable=true;
    if(currentTurn===(mp.seat??0)){
      setText('hand-status-main','Giliran Anda');
      setText('hand-status-sub',turnActions.length?`Pilih aksi: ${turnActions.join(' / ')} atau pilih tile.`:'Pilih tile untuk membuang.');
      if(turnActions.length){showAvailableActions(turnActions);startActionWindow(()=>{hideAvailableActions();mpBroadcastState({remoteActions:[]});if((timeBank[currentTurn]||0)>0){secondsLeft=0;startBankTimerOnly(currentTurn)}else autoDiscardCurrent();},currentTurn,'turn-action');}
      else startTurnTimer();
    }else if(isMultiplayerMode&&mp.host){
      // Host remains authoritative for a guest turn. If that guest has optional
      // self-actions (Tsumo/Kan), expose them for 5 seconds first, then consume
      // that player's round time bank. A normal discard may still arrive at any time.
      if(turnActions.length){
        startActionWindow(()=>{mpBroadcastState({remoteActions:[]});if((timeBank[currentTurn]||0)>0){secondsLeft=0;startBankTimerOnly(currentTurn)}else autoDiscardCurrent();},currentTurn,'turn-action');
      }else{
        startTurnTimer();
      }
    }else{
      startTurnTimer();
    }
  }
  mpBroadcastState({remoteActions:(!aiSeats.has(currentTurn)&&currentTurn!==(mp.seat??0))?{seat:currentTurn,actions:turnActions,actionWindow:turnActions.length?ACTION_WINDOW_SECONDS:0}:[],handStatus:{seat:currentTurn,main:'GILIRAN',sub:currentTurn===(mp.seat??0)?'Pilih tile untuk dibuang.':(turnActions.length?`Aksi tersedia: ${turnActions.join(' / ')}`:'Menunggu.')}})
}
function aiDiscard(p){if(!roundActive||roundEnding)return;const h=playerHands[p];if(!h.length)return;let best=0;for(let i=0;i<h.length;i++){const t=h[i];if(isSimple(t))best=i; if(t.type==='honor')best=i}const tile=h.splice(best,1)[0];drawnTile=null;commitDiscard(p,tile)}
function handleTileTap(i,el){if(currentTurn!==(mp.seat??0)||!isDiscardable)return;const h=playerHands[mp.seat??0]||[],picked=h[i];if(!picked)return;document.querySelectorAll('#player-hand-tiles .tile, .discard-tile').forEach(x=>{x.classList.remove('selected-tile');x.classList.toggle('same-tile-highlight',Number(x.dataset.tileId)===picked.id)});el.classList.add('selected-tile');if(selectedTileIndex===i){discardTile(i);return}selectedTileIndex=i}
function discardTile(i){if(currentTurn!==(mp.seat??0)||!isDiscardable)return;clearInterval(turnTimer);const tile=playerHands[currentTurn]?.[i];if(!tile)return;if(isMultiplayerMode&&!mp.host){
    queueGuestAction({type:'discard',uniqueId:tile.uniqueId,callId:activeCallId,actionId:nextMpActionId('DISCARD')});
    return;
  }
  selectedTileIndex=-1;isDiscardable=false;drawnTile=null;playerHands[currentTurn].splice(i,1);sortHand(currentTurn);renderTable();commitDiscard(currentTurn,tile)}
function getDiscardCallOptions(p,tile){
  if(!tile||p===lastDiscarderIdx)return [];

  const hand=playerHands[p]||[];
  const actions=[];
  const same=hand.filter(t=>t.id===tile.id).length;
  const isNext=((lastDiscarderIdx+1)%4)===p;
  const chi=getChiCombinations(hand,tile);

  // Ron
  const ronHand=[...hand,tile];
  const ronShape=isWinningShape(
    ronHand,
    playerMelds[p]?.length||0
  );

  if(ronShape){
    const ron=evaluateHK(p,tile,false);
    if(ron){
      actions.push({type:'Ron',score:ron});
    }
  }

  // Kan
  if(same>=3){
    actions.push({type:'Kan'});
  }

  // Pon
  if(same>=2){
    actions.push({type:'Pon'});
  }

  // Chi — keep every valid combination.
  if(isNext&&chi.length){
    actions.push({
      type:'Chi',
      combos:chi
    });
  }

  return actions;
}
function getSelfKanOptions(p){
  const hand=playerHands[p]||[];const out=[];
  const counts=tileCounts(hand);
  for(let id=0;id<34;id++)if(counts[id]===4)out.push({type:'closed',id});
  for(let gi=0;gi<(playerMelds[p]||[]).length;gi++){const g=playerMelds[p][gi];if(g.length===3&&g.every(t=>t.id===g[0].id)){const extra=hand.find(t=>t.id===g[0].id);if(extra)out.push({type:'added',id:g[0].id,groupIndex:gi,tile:extra})}}
  return out;
}
function removeLastDiscard(){const p=lastDiscarderIdx;if(p<0)return;playerRivers[p].pop();lastDiscardedTile=null;lastDiscarderIdx=-1;renderTable()}
function takeTilesById(hand,id,n){const out=[];for(let i=hand.length-1;i>=0&&out.length<n;i--)if(hand[i].id===id)out.push(hand.splice(i,1)[0]);return out}
function executePon(p){
  cancelAiTurn();
  playSfx('pon');
  stopCallWindow();
  clearInterval(turnTimer);

  const tile=lastDiscardedTile;
  if(!tile)return;

  const a=takeTilesById(playerHands[p],tile.id,2);
  if(a.length<2)return;

  a.push(tile);
  playerMelds[p].push(a);
  removeLastDiscard();
  currentTurn=p;
  activeCallId=nextMpCallId('TURN');
  drawnTile=null;
  selectedTileIndex=-1;
  renderTable();

  mpPendingCalls=[];
  const resume=()=>{
    if(aiSeats.has(p)){
      aiDiscard(p);
    }else if(!isMultiplayerMode||p===(mp.seat??0)||mp.host){
      isDiscardable=p===(mp.seat??0)||!isMultiplayerMode;
      startTurnTimer();
    }else{
      isDiscardable=false;
    }
    mpBroadcastState();
  };
  resumeAfterAction(p,'Pon',resume,a);
}
function executeChi(p,combo){
  cancelAiTurn();
  playSfx('chi');
  stopCallWindow();
  clearInterval(turnTimer);

  const tile=lastDiscardedTile;
  if(!tile||!Array.isArray(combo)||combo.length!==3)return;

  const a=[];
  for(const n of combo){
    if(n===tile.num)continue;
    const idx=playerHands[p].findIndex(
      t=>t.type===tile.type&&t.num===n
    );
    if(idx<0)return;
    a.push(playerHands[p].splice(idx,1)[0]);
  }

  a.push(tile);
  a.sort((x,y)=>x.num-y.num);
  playerMelds[p].push(a);
  removeLastDiscard();
  currentTurn=p;
  activeCallId=nextMpCallId('TURN');
  drawnTile=null;
  selectedTileIndex=-1;
  renderTable();

  mpPendingCalls=[];
  const resume=()=>{
    if(aiSeats.has(p)){
      aiDiscard(p);
    }else if(!isMultiplayerMode||p===(mp.seat??0)||mp.host){
      isDiscardable=p===(mp.seat??0)||!isMultiplayerMode;
      startTurnTimer();
    }else{
      isDiscardable=false;
    }
    mpBroadcastState();
  };
  resumeAfterAction(p,'Chi',resume,a);
}
function executeKan(p){
  cancelAiTurn();
  playSfx('kan');
  stopCallWindow();
  clearInterval(turnTimer);

  const tile=lastDiscardedTile;
  if(!tile)return;

  const a=takeTilesById(playerHands[p],tile.id,3);
  if(a.length<3)return;

  a.push(tile);
  playerMelds[p].push(a);
  removeLastDiscard();

  const t=drawTile();
  if(!t){
    endRound('DRAW','Tidak ada tile.');
    return;
  }

  playerHands[p].push(t);
  drawnTile=t;
  currentTurn=p;
  activeCallId=nextMpCallId('TURN');
  selectedTileIndex=-1;
  renderTable();

  mpPendingCalls=[];
  const resume=()=>{
    if(aiSeats.has(p)){
      aiDiscard(p);
    }else if(!isMultiplayerMode||p===(mp.seat??0)||mp.host){
      isDiscardable=p===(mp.seat??0)||!isMultiplayerMode;
      startTurnTimer();
    }else{
      isDiscardable=false;
    }
    mpBroadcastState();
  };
  resumeAfterAction(p,'Kan',resume,a);
}
function executeSelfKan(p,opt){
  cancelAiTurn();
  playSfx('kan');
  if(!opt)return false;

  if(opt.type==='closed'){
    const a=takeTilesById(playerHands[p],opt.id,4);
    if(a.length!==4)return false;
    playerMelds[p].push(a);
  }else if(opt.type==='added'){
    const g=playerMelds[p]?.[opt.groupIndex];
    if(!g||g.length!==3)return false;
    const idx=playerHands[p].findIndex(t=>t.id===opt.id);
    if(idx<0)return false;
    g.push(playerHands[p].splice(idx,1)[0]);
  }else return false;

  const t=drawTile();
  if(!t){
    endRound('DRAW','Tidak ada tile.');
    return true;
  }

  playerHands[p].push(t);
  drawnTile=t;
  activeCallId=nextMpCallId('TURN');
  sortHand(p);
  selectedTileIndex=-1;
  const actionTiles=opt.type==='closed' ? (playerMelds[p][playerMelds[p].length-1]||[]) : (playerMelds[p][opt.groupIndex]||[]);

  renderTable();

  const resume=()=>{
    if(aiSeats.has(p)){
      aiDiscard(p);
    }else if(!isMultiplayerMode||p===(mp.seat??0)||mp.host){
      isDiscardable=p===(mp.seat??0)||!isMultiplayerMode;
      startTurnTimer();
    }else{
      isDiscardable=false;
    }
    mpBroadcastState();
  };
  resumeAfterAction(p,'Kan',resume,actionTiles);
  return true;
}
function chooseAiCall(actions){
  if(!Array.isArray(actions)||!actions.length)return null;
  const ron=actions.find(a=>a?.type==='Ron');
  if(ron)return ron;
  const kan=actions.find(a=>a?.type==='Kan');
  if(kan)return kan;
  const pon=actions.find(a=>a?.type==='Pon');
  if(pon)return pon;
  const chi=actions.find(a=>a?.type==='Chi'&&Array.isArray(a.combos)&&a.combos.length);
  if(chi)return {type:'Chi',combo:[...chi.combos[0]]};
  return null;
}
const CALL_PRIORITY={Ron:4,Kan:3,Pon:2,Chi:1};
function callPriority(action){return CALL_PRIORITY[action?.type]||0}
function highestPendingCall(){
  let best=null;
  for(const q of mpPendingCalls||[]){
    for(const a of q.actions||[]){
      if(!best||callPriority(a)>callPriority(best.action))best={seat:q.seat,action:a,callId:q.callId||null};
    }
  }
  return best;
}
function stopCallWindow(){
  clearInterval(actionTimer);actionTimer=null;isActionPhase=false;actionSecondsLeft=0;actionTimeoutHandler=null;actionSeat=-1;actionMode='';
  // Invalidate the previous decision context immediately. A new turn/call
  // creates a new ID before another player can act.
  activeCallId=null;
  if(mp.host)activeRemoteActions=null;
}
function resolveCallChoice(seat,action){
  const q=mpPendingCalls.find(x=>x.seat===seat);
  if(!q||!action)return;
  const expectedCallId=q.callId||activeCallId;
  const suppliedCallId=action.callId||expectedCallId;
  if(expectedCallId&&suppliedCallId!==expectedCallId)return;
  if(!action.callId)action={...action,callId:expectedCallId};
  stopCallWindow();pendingCallChoice=null;
  if(action.type==='Ron'){resolveWin(seat,action.score,false);return}
  if(action.type==='Kan'){executeKan(seat);return}
  if(action.type==='Pon'){executePon(seat);return}
  if(action.type==='Chi'){executeChi(seat,action.combo);return}
  mpPendingCalls=mpPendingCalls.filter(x=>x!==q);promptNextCall();
}
function finishCallWindow(){
  const best=highestPendingCall();
  const chosen=pendingCallChoice;
  pendingCallChoice=null;
  if(chosen){
    const bp=best?callPriority(best.action):0;
    if(callPriority(chosen.action)>=bp){resolveCallChoice(chosen.seat,chosen.action);return}
  }
  if(best){
    const q=mpPendingCalls.find(x=>x.seat===best.seat);
    if(!q)return promptNextCall();
    // Timeout consumes only this player's action opportunity. The shared
    // round bank has already been reduced by startActionWindow as needed.
    mpPendingCalls=mpPendingCalls.filter(x=>x!==q);
  }
  promptNextCall();
}
function commitDiscard(p,tile){
  if(!roundActive||roundEnding||!tile)return;
  clearInterval(turnTimer);stopCallWindow();isDiscardable=false;
  playerRivers[p].push(tile);lastDiscardedTile=tile;lastDiscarderIdx=p;playSfx('discard');renderTable();
  const claims=[];
  const callId=nextMpCallId('CALL');
  activeCallId=callId;
  for(const q of [0,1,2,3]){
    if(q===p)continue;
    const actions=getDiscardCallOptions(q,tile);
    if(actions.length)claims.push({seat:q,actions,callId});
  }
  mpPendingCalls=claims;pendingCallChoice=null;
  if(mpPendingCalls.length){promptNextCall();return}
  mpBroadcastState();nextTurn();
}
function promptNextCall(resumeRuntime=false){
  if(!mpPendingCalls.length){
    stopCallWindow();
    mpBroadcastState({remoteActions:[]});
    nextTurn();
    return;
  }

  // Every player claim created by one discard belongs to the same callId.
  // Normalize older/restored snapshots that may not have one yet.
  let callId=mpPendingCalls.find(x=>x.callId)?.callId||activeCallId;
  if(!callId||!String(callId).startsWith('CALL-'))callId=nextMpCallId('CALL');
  if(mpPendingCalls.some(x=>x.callId!==callId)){
    mpPendingCalls=mpPendingCalls.map(x=>({...x,callId}));
  }
  activeCallId=callId;

  const best=highestPendingCall();
  if(!best){
    mpPendingCalls=[];
    stopCallWindow();
    mpBroadcastState({remoteActions:[]});
    nextTurn();
    return;
  }
  const q=mpPendingCalls.find(x=>x.seat===best.seat);
  if(!q){mpPendingCalls.shift();promptNextCall();return}

  const actions=q.actions.map(x=>x.type);

  if(!aiSeats.has(best.seat)){
    if(pendingCallChoice&&pendingCallChoice.seat===best.seat){
      const chosen=pendingCallChoice.action;
      pendingCallChoice=null;
      if(callPriority(chosen)>=callPriority(best.action)){
        resolveCallChoice(best.seat,chosen);
        return;
      }
    }

    if(best.seat===(mp.seat??0)){
      showAvailableActions([...q.actions,{type:'Skip'}]);
    }

    // The HOST is authoritative for every remote player's action timer.
    // Without a host-side timer, a disconnected/stalled guest could leave
    // mpPendingCalls waiting forever and freeze the entire room.
    if(mp.host){
      startActionWindow(finishCallWindow,best.seat,'discard-call',resumeRuntime);
    }

    // The remote guest needs the COMPLETE Chi action object so that
    // multiple Chi combinations remain selectable on the guest client.
    if(mp.host){
      const remoteActions=q.actions.map(x=>{
        if(x.type==='Chi')return {
          type:'Chi',
          combos:Array.isArray(x.combos)?x.combos.map(c=>[...c]):[]
        };
        return x.type;
      });
      remoteActions.push('Skip');
      mpBroadcastState({
        remoteActions:{
          seat:best.seat,
          callId:q.callId,
          actions:remoteActions,
          actionWindow:ACTION_WINDOW_SECONDS
        }
      });
    }
    return;
  }

  if(aiSeats.has(best.seat)){
    // AI calls are automatic: no 5-second human action window and no time-bank use.
    stopCallWindow();
    const pick=chooseAiCall(q.actions);
    if(pick){
      resolveCallChoice(best.seat,pick);
      return;
    }
    // Never leave the room waiting on a stale/invalid AI call.
    mpPendingCalls=mpPendingCalls.filter(x=>x!==q);
    mpBroadcastState({remoteActions:[]});
    promptNextCall();
    return;
  }

  mpPendingCalls=mpPendingCalls.filter(x=>x!==q);
  promptNextCall();
}
function settleExhaustiveDraw(){
  const tenpai=[];const noten=[];
  for(let p=0;p<4;p++){const waits=getWaitIds(playerHands[p]||[],(playerMelds[p]||[]).length);if(waits.length)tenpai.push(p);else noten.push(p)}
  if(!tenpai.length||!noten.length)return {tenpai,noten,changed:false,desc:tenpai.length===4?'Semua pemain Tenpai. Tidak ada pembayaran.':'Semua pemain Noten. Tidak ada pembayaran.'};
  const poolPerNoten=1000;const totalPool=poolPerNoten*noten.length;const gain=totalPool/tenpai.length;
  noten.forEach(p=>{playerScores[p]-=poolPerNoten});
  tenpai.forEach(p=>{playerScores[p]+=gain});
  const tn=tenpai.map(playerName).join(', ');const nn=noten.map(playerName).join(', ');
  return {tenpai,noten,changed:true,desc:`Tenpai: ${tn}. Noten: ${nn}. Pool ${Math.round(totalPool).toLocaleString('id-ID')} poin dibagi rata; masing-masing Noten -${poolPerNoten.toLocaleString('id-ID')}, masing-masing Tenpai +${Math.round(gain).toLocaleString('id-ID')}.`};
}
function snapshotWinningHand(seat,result,isTsumo){
  const hand=(playerHands[seat]||[]).map(cloneTile);
  const melds=(playerMelds[seat]||[]).map(g=>(g||[]).map(cloneTile));
  const winningTile=isTsumo
    ?(drawnTile?cloneTile(drawnTile):null)
    :(lastDiscardedTile?cloneTile(lastDiscardedTile):null);
  return {
    winnerSeat:seat,
    winnerName:playerName(seat),
    winType:isTsumo?'Tsumo':'Ron',
    winningTile,
    hand,
    melds,
    yaku:Array.isArray(result?.yaku)?result.yaku.map(x=>Array.isArray(x)?[x[0],x[1]]:x):[],
    yakuStr:String(result?.yakuStr||'')
  };
}
function resolveWin(seat,result,isTsumo){playSfx(isTsumo?'tsumo':'ron');roundEnding=true;clearInterval(turnTimer);clearInterval(actionTimer);const payer=isTsumo?null:lastDiscarderIdx;let amount=Number.isFinite(Number(result?.points))?Number(result.points):0;if(isTsumo){for(let p=0;p<4;p++)if(p!==seat)playerScores[p]-=amount/3;playerScores[seat]+=amount}else{playerScores[seat]+=amount; if(payer>=0)playerScores[payer]-=amount}renderTable();flashBoard('win');const title=`${isTsumo?'TSUMO':'RON'} • ${playerName(seat)}`;const desc=`${result.yakuStr} • ${result.points} poin`;const winner=snapshotWinningHand(seat,result,isTsumo);beginActionFeedback(seat,isTsumo?'Tsumo':'Ron',4500,()=>endRound(title,desc,{winner}),winner.winningTile?[winner.winningTile]:[])}
function updateActionOverlayTimer(remaining=null,seat=actionSeat,phase=isActionPhase?'action':'bank'){
  const o=byId('action-overlay');
  if(!o)return;
  const numeric=Math.max(0,Number(remaining==null?(actionSecondsLeft+(timeBank[seat]||0)):remaining)||0);
  const total=Math.max(1,Number(o.dataset.actionTotal)||Number(ACTION_WINDOW_SECONDS+(timeBank[seat]||0))||1);
  const pct=Math.max(0,Math.min(100,(numeric/total)*100));
  o.style.setProperty('--action-progress',pct+'%');
  o.classList.toggle('action-time-danger',numeric<=3);
  o.classList.toggle('action-time-bank',phase==='bank');
  const phaseEl=o.querySelector('.action-overlay-phase');
  if(phaseEl)phaseEl.textContent=phase==='bank'?'TIME BANK':'PILIH';
}
function hideAvailableActions(){
  const o=byId('action-overlay');
  if(o){o.innerHTML='';o.style.display='none';o.hidden=true;o.removeAttribute('data-action-total');o.style.removeProperty('--action-progress');['--action-glow-1','--action-glow-2','--action-glow-3','--action-glow-4'].forEach(key=>o.style.removeProperty(key));o.classList.remove('action-time-danger','action-time-bank');}
  isActionPhase=false;
  showCurrentWaitAdvisor();
}
function showAvailableActions(actions,contextId=activeCallId){
  if((actions||[]).some(a=>(typeof a==='string'?a:a?.type)==='Ron')){
    smartAssistantShow(
      'RON TERSEDIA',
      'Kartu buangan terakhir membuat Anda bisa menang.',
      'green'
    );
  }

  const o=byId('action-overlay');
  hideAvailableActions();

  if(!o||!Array.isArray(actions)||!actions.length)return;

  isActionPhase=true;
  o.hidden=false;
  o.style.display='flex';
  o.dataset.actionTotal=String(ACTION_WINDOW_SECONDS+(timeBank[actionSeat>=0?actionSeat:currentTurn]||0));
  const actionGlowMap={
    Ron:'rgba(217,93,84,.36)',
    Hu:'rgba(217,93,84,.36)',
    Pong:'rgba(144,103,177,.34)',
    Pung:'rgba(144,103,177,.34)',
    Chi:'rgba(67,176,116,.34)',
    Kan:'rgba(58,173,168,.34)',
    Tsumo:'rgba(224,171,72,.36)'
  };
  const glowTypes=[...new Set((actions||[]).map(a=>String(typeof a==='string'?a:a?.type||'')).filter(t=>actionGlowMap[t]))];
  ['--action-glow-1','--action-glow-2','--action-glow-3','--action-glow-4'].forEach((key,i)=>{
    o.style.setProperty(key,glowTypes[i]?actionGlowMap[glowTypes[i]]:'rgba(227,183,92,0)');
  });
  const actionTitle=(window.hkLanguage==='id'?'TINDAKAN':'ACTION');
  o.innerHTML=`
    <div class="action-overlay-head">
      <strong class="action-overlay-title">${actionTitle}</strong>
      <span class="action-overlay-phase">PILIH</span>
    </div>
    <div class="action-overlay-track"><span class="action-overlay-progress"></span></div>
    <div class="action-overlay-buttons"></div>
  `;
  const wrap=o.querySelector('.action-overlay-buttons');

  actions.forEach(a=>{
    const type=typeof a==='string'?a:a?.type;
    const callId=(typeof a==='object'&&a?.callId)||contextId||null;

    if(type==='Chi'&&a?.combos?.length){
      if(a.combos.length===1){
        const b=document.createElement('button');
        b.type='button';
        b.className='act-btn btn-chi';
        b.textContent=hkActionLabel('Chi');
        b.onclick=()=>triggerAction({
          type:'Chi',
          combo:[...a.combos[0]],
          callId
        });
        wrap?.appendChild(b);
        return;
      }

      a.combos.forEach(combo=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='act-btn btn-chi';
        b.textContent=`${hkActionLabel('Chi')} ${combo.join('-')}`;
        b.onclick=()=>triggerAction({
          type:'Chi',
          combo:[...combo],
          callId
        });
        wrap?.appendChild(b);
      });
      return;
    }

    const b=document.createElement('button');
    b.type='button';
    b.className=`act-btn btn-${String(type).toLowerCase()}`;
    b.textContent=hkActionLabel(type);
    b.onclick=()=>triggerAction({type,callId});
    wrap?.appendChild(b);
  });
  updateActionOverlayTimer(actionSecondsLeft+(timeBank[actionSeat>=0?actionSeat:currentTurn]||0),actionSeat>=0?actionSeat:currentTurn,'action');
}
function triggerAction(a){
  const guestAction=isMultiplayerMode&&!mp.host;
  const type=typeof a==='string'?a:a?.type;
  const callId=(typeof a==='object'&&a?.callId)||activeCallId||null;

  if(!guestAction)hideAvailableActions();

  // Chi with an explicitly selected combination.
  if(a&&typeof a==='object'&&a.type==='Chi'){
    const combo=Array.isArray(a.combo)?a.combo:null;
    if(!combo||combo.length!==3||!callId)return;

    if(isMultiplayerMode&&!mp.host){
      queueGuestAction({
        type:'call',
        action:'Chi',
        combo:[...combo],
        callId,
        actionId:nextMpActionId('CALL')
      });
      return;
    }

    const q=mpPendingCalls.find(
      x=>x.seat===(mp.seat??0)&&x.callId===callId
    );
    if(!q)return;

    const act=q.actions.find(x=>x.type==='Chi');
    if(!act||!Array.isArray(act.combos))return;

    const validCombo=act.combos.some(
      c=>Array.isArray(c)&&
         c.length===combo.length&&
         c.every((n,i)=>n===combo[i])
    );
    if(!validCombo)return;

    const chosen={type:'Chi',combo:[...combo],callId};
    pendingCallChoice={
      seat:mp.seat??0,
      action:chosen
    };

    const best=highestPendingCall();
    if(!best||callPriority(chosen)>=callPriority(best.action)){
      resolveCallChoice(mp.seat??0,chosen);
    }else{
      showAvailableActions(['Skip'],callId);
      setText(
        'hand-status-sub',
        `Menunggu call prioritas lebih tinggi... ${actionSecondsLeft}s`
      );
    }
    return;
  }

  // Guest always sends game actions to the authoritative host with both the
  // context ID and a unique action ID.
  if(isMultiplayerMode&&!mp.host){
    queueGuestAction({
      type:'call',
      action:type,
      callId,
      actionId:nextMpActionId('CALL')
    });
    return;
  }

  if(type==='Skip'){
    const q=mpPendingCalls.find(
      x=>x.seat===(mp.seat??0)&&x.callId===callId
    );
    if(q)mpPendingCalls=mpPendingCalls.filter(x=>x!==q);
    pendingCallChoice=null;
    stopCallWindow();
    promptNextCall();
    return;
  }

  if(type==='Tsumo'){
    if(callId!==activeCallId)return;
    stopCallWindow();
    const e=checkCurrentWin(mp.seat,null,true);
    if(e)resolveWin(mp.seat,e,true);
    else startTurnTimer();
    return;
  }

  const q=mpPendingCalls.find(
    x=>x.seat===(mp.seat??0)&&x.callId===callId
  );

  if(q){
    const act=q.actions.find(x=>x.type===type);
    if(!act){
      hideAvailableActions();
      return;
    }

    if(type==='Kan'){
      // Discard-call Kan. Self-Kan is handled below.
      const chosen={...act,callId};
      pendingCallChoice={seat:mp.seat??0,action:chosen};
      const best=highestPendingCall();
      if(!best||callPriority(chosen)>=callPriority(best.action))resolveCallChoice(mp.seat??0,chosen);
      return;
    }

    pendingCallChoice={
      seat:mp.seat??0,
      action:{...act,callId}
    };

    const best=highestPendingCall();
    const chosen=pendingCallChoice.action;
    if(!best||callPriority(chosen)>=callPriority(best.action)){
      resolveCallChoice(mp.seat??0,chosen);
    }else{
      showAvailableActions(['Skip'],callId);
    }
    return;
  }

  // Self-Kan during the player's own draw turn.
  if(type==='Kan'){
    if(callId!==activeCallId)return;
    const opt=getSelfKanOptions(mp.seat??0)[0];
    if(opt){
      stopCallWindow();
      executeSelfKan(mp.seat??0,opt);
    }
  }
}

function nextTurn(){
  if(!roundActive||roundEnding)return;
  activeRemoteActions=null;
  clearGameTimers(); cancelAiTurn(); pendingCallChoice=null; mpPendingCalls=[];
  selectedTileIndex=-1;
  currentTurn=(currentTurn+1)%4;
  activeCallId=nextMpCallId('TURN');
  gameTurnEpoch++;
  setTimeout(()=>{if(roundActive&&!roundEnding)processTurn()},0);
}
function renderWinningHand(snapshot){
  const section=byId('res-winning-hand-section');
  const wrap=byId('res-winning-hand');
  if(!section||!wrap)return;
  wrap.innerHTML='';
  if(!snapshot||snapshot.winnerSeat===undefined||snapshot.winnerSeat===null){section.hidden=true;return;}

  section.hidden=false;

  const head=document.createElement('div');
  head.className='result-winning-player';
  head.textContent=`${snapshot.winnerName||playerName(snapshot.winnerSeat)} • ${snapshot.winType||''}`.trim();
  wrap.appendChild(head);

  if(snapshot.yakuStr){
    const sub=document.createElement('div');
    sub.className='result-winning-sub';
    sub.textContent=snapshot.yakuStr;
    wrap.appendChild(sub);
  }

  const concealed=Array.isArray(snapshot.hand)?snapshot.hand.map(cloneTile):[];
  const melds=Array.isArray(snapshot.melds)?snapshot.melds.map(g=>(g||[]).map(cloneTile)):[];
  const winningTile=snapshot.winningTile?cloneTile(snapshot.winningTile):null;

  const concealedGroup=document.createElement('div');
  concealedGroup.className='result-winning-group is-concealed';
  const addTile=(tile,isWinning=false)=>{
    if(!tile)return;
    const el=document.createElement('div');
    el.className=`result-winning-tile${isWinning?' is-winning':''}`;
    el.innerHTML=tileMarkup(tile);
    const img=el.querySelector('img');
    if(img)img.removeAttribute('onerror');
    if(isWinning)el.setAttribute('aria-label','Tile kemenangan');
    concealedGroup.appendChild(el);
  };

  concealed.forEach(tile=>{
    const isWinning=!!(winningTile&&tile.uniqueId&&winningTile.uniqueId===tile.uniqueId);
    addTile(tile,isWinning);
  });

  // Ron keeps the winning tile in the discard river, so append it to the
  // concealed hand snapshot. For Tsumo the winning tile is already in hand.
  if(winningTile && !concealed.some(t=>t?.uniqueId&&t.uniqueId===winningTile.uniqueId))addTile(winningTile,true);
  if(concealedGroup.children.length){wrap.appendChild(concealedGroup);}

  melds.forEach(group=>{
    if(!Array.isArray(group)||!group.length)return;
    const divider=document.createElement('div');
    divider.className='result-winning-divider';
    wrap.appendChild(divider);
    const box=document.createElement('div');
    box.className='result-winning-group is-meld';
    group.forEach(tile=>addResultGroupTile(box,tile));
    wrap.appendChild(box);
  });

  const legend=document.createElement('div');
  legend.className='result-winning-legend';
  legend.textContent=winningTile?'Tile yang diberi garis emas adalah tile kemenangan.':'Tiles tangan kemenangan dan meld pemain.';
  wrap.appendChild(legend);
}
function addResultGroupTile(box,tile){
  if(!box||!tile)return;
  const el=document.createElement('div');
  el.className='result-winning-tile';
  el.innerHTML=tileMarkup(tile);
  const img=el.querySelector('img');
  if(img)img.removeAttribute('onerror');
  box.appendChild(el);
}
function leaveFinishedRoom(){
  clearGuestActionRetry();
  clearTimeout(mpRejoinHandshakeTimer);
  mpRejoinHandshakeTimer=null;
  mpRejoinMode=false;
  mpRejoinStateApplied=false;
  mpRejoinJoined=false;
  mpRejoinFallbackState=null;
  stopMpGameWatchdog();
  stopMpPing();
  clearTimeout(mpReconnectTimer);
  mpReconnectAttempts=0;
  mpReconnectDeadline=0;
  try{mpSend('leave')}catch(e){}
  try{if(mp.ws){mp.ws.onclose=null;mp.ws.close()}}catch(e){}
  mp.ws=null;
  mp.connected=false;
  mpClearSession();
  mpClearActiveGameState();
  mp={ws:null,connected:false,room:null,seat:null,host:false,ready:false,started:false,state:null,token:null,playerName:mp.playerName||'Player',playerAvatar:selectedAvatar};
  isMultiplayerMode=false;
}
function finishMatchToMenu(){
  hideRoundTransition();
  setDisplay('modal-result','none');
  setDisplay('modal-match-over','none');
  roundActive=false;
  roundEnding=false;
  stopGameMusic();
  leaveFinishedRoom();
  nav('screen-main');
}

function renderResultModal(title,desc,resultMeta=null){
  const finalResult=currentRoundIndex>=3;
  setText('res-title',finalResult?'🏆 Pertandingan Selesai':title);
  setText('res-desc','');
  setText('res-round-label',finalResult?'HASIL AKHIR':getRoundName());
  const summary=byId('res-summary');
  if(summary){
    const parts=String(desc||'').split(' • ');
    const detail=parts[0]||'Ronde selesai';
    const points=parts.slice(1).join(' • ');
    summary.innerHTML=`<strong>${esc(detail)}</strong>${points?`<span class="result-win-points">${esc(points)}</span>`:''}<span class="result-win-detail">🏆 Hasil ronde</span>`;
  }
  renderWinningHand(resultMeta?.winner||null);
  const box=byId('res-scores');
  if(box){box.innerHTML=playerScores.map((s,i)=>`<div class="ready-item result-score-row"><span>${esc(playerName(i))}</span><strong data-target-score="${Math.round(s)}">0</strong></div>`).join('');}
  const nextBtn=document.querySelector('#modal-result .btn-primary');
  if(nextBtn){
    if(currentRoundIndex>=3){nextBtn.textContent='Kembali ke Menu Utama';nextBtn.classList.remove('btn-primary');nextBtn.classList.add('btn-secondary');nextBtn.onclick=finishMatchToMenu;}
    else{nextBtn.textContent='Lanjut ke Ronde Berikutnya';nextBtn.classList.remove('btn-secondary');nextBtn.classList.add('btn-primary');nextBtn.onclick=nextRoundOrFinish;}
  }
  setDisplay('modal-result','flex');
  const modal=byId('modal-result');if(modal){modal.classList.remove('result-reveal');void modal.offsetWidth;modal.classList.add('result-reveal');}
  requestAnimationFrame(()=>{if(box)box.querySelectorAll('[data-target-score]').forEach((el,i)=>animateScoreValue(el,Number(el.dataset.targetScore),700+i*80));});
}
function endRound(title,desc,resultMeta={}){smartAssistantHide();
  const finalRound=currentRoundIndex>=3;
  if(!finalRound)historyRecordRound(title,desc,resultMeta);
  actionFeedbackToken++;clearTimeout(actionFeedbackTimer);actionFeedbackTimer=null;activeActionFeedback=null;lastActionFeedbackId='';
  activeCallId=null;
  mpPendingCalls=[];
  activeRemoteActions=null;
  roundEnding=true;roundActive=false;clearGameTimers();clearTimeout(aiMoveTimer);
  renderResultModal(title,desc,resultMeta);
  if(isMultiplayerMode&&mp.host&&finalRound){
    historyRecordRound(title,desc,resultMeta).finally(()=>{
      mpBroadcastState({phase:'matchFinished',matchFinished:true,result:{title,desc,...resultMeta},playerScores});
      mpClearActiveGameState();
      setTimeout(()=>leaveFinishedRoom(),500);
    });
  }else{
    mpBroadcastState({phase:'result',result:{title,desc,...resultMeta},playerScores});
    mpClearActiveGameState();
  }
}
function computeStandings(){
  return [0,1,2,3].map(seat=>({seat,name:playerName(seat),score:Math.round(playerScores[seat]||0)})).sort((a,b)=>b.score-a.score);
}
function showMatchOverScreen(){
  actionFeedbackToken++;clearTimeout(actionFeedbackTimer);actionFeedbackTimer=null;activeActionFeedback=null;lastActionFeedbackId='';
  roundActive=false;roundEnding=false;
  clearInterval(turnTimer);clearInterval(actionTimer);clearTimeout(aiMoveTimer);
  stopGameMusic();
  setDisplay('modal-result','none');
  const standings=computeStandings();
  const topScore=standings[0].score;
  const winners=standings.filter(s=>s.score===topScore).map(s=>s.name);
  setText('matchover-winner-line',`${winners.map(esc).join(' & ')} menang dengan ${topScore.toLocaleString('id-ID')} poin`);
  const box=byId('matchover-standings');
  if(box){
    box.innerHTML=standings.map((s,i)=>`<div class="ready-item result-score-row${s.score===topScore?' result-winner-row':''}"><span>${i===0?'🏆':`#${i+1}`} ${esc(s.name)}</span><strong>${s.score.toLocaleString('id-ID')}</strong></div>`).join('');
  }
  const rematchBtn=byId('btn-matchover-rematch');
  const waitingHint=byId('matchover-waiting-hint');
  const isWaitingGuest=isMultiplayerMode&&!mp.host;
  if(rematchBtn)rematchBtn.hidden=isWaitingGuest;
  if(waitingHint)waitingHint.hidden=!isWaitingGuest;
  setDisplay('modal-match-over','flex');
  const modal=byId('modal-match-over');if(modal){modal.classList.remove('result-reveal');void modal.offsetWidth;modal.classList.add('result-reveal');}
  if(isMultiplayerMode)mpClearActiveGameState();
}
function handleRematchClick(){
  setDisplay('modal-match-over','none');
  if(!isMultiplayerMode){
    start4PGame('Medium',false);
    return;
  }
  if(mp.host){
    mp.started=false;mp.ready=false;
    mpRejoinMode=false;
    mpRejoinStateApplied=false;
    mpRejoinFallbackState=null;
    clearTimeout(mpRejoinFallbackTimer);
    clearTimeout(mpRejoinModeTimer);
    if(mp.room)mp.room.started=false;
    mpSend('rematch');
  }
  setDisplay('modal-lobby','flex');
  setDisplay('mp-setup','none');
  setDisplay('mp-room-panel','grid');
  setDisplay('mp-host-invite','none');
  setDisplay('mp-guest-invite','none');
  setText('lobby-help',mp.host?'Tekan SIAP, lalu MULAI GAME saat semua sudah siap.':'Menunggu host membuka room untuk main lagi.');
  if(mp.room)mpRenderLobby(mp.room);
}
function matchOverToMenu(){
  setDisplay('modal-match-over','none');
  roundActive=false;roundEnding=false;
  stopGameMusic();
  if(isMultiplayerMode){
    try{mpSend('leave')}catch(e){}
    try{if(mp.ws){mp.ws.onclose=null;mp.ws.close()}}catch(e){}
    mpClearSession();mpClearActiveGameState();
    mp={ws:null,connected:false,room:null,seat:null,host:false,ready:false,started:false,state:null,token:null,playerName:mp.playerName||'Player',playerAvatar:selectedAvatar};
    isMultiplayerMode=false;
  }
  nav('screen-main');
}
function nextRoundOrFinish(){
  setDisplay('modal-result','none');
  if(isMultiplayerMode&&!mp.host){
    // Guests don't drive the shared game clock or round counter. The host
    // remains authoritative and will broadcast the next round state.
    setText('hand-status-main','Menunggu ronde berikutnya…');
    return;
  }
  currentRoundIndex++;
  if(currentRoundIndex>=4){
    hideRoundTransition();
    finishMatchToMenu();
    return;
  }
  currentDealerIdx=(currentDealerIdx+1)%4;
  showRoundTransition();
  setupRound();
  // Keep the same BGM session alive across round transitions. If the previous
  // track ended while the result screen was open, playGameMusic() will select
  // the next track and resume playback without resetting the playlist history.
  playGameMusic();
  mpBroadcastState();
}
function flashBoard(kind){const e=byId('center-board-box');if(!e)return;e.classList.remove('win-flash','draw-flash');void e.offsetWidth;e.classList.add(kind==='draw'?'draw-flash':'win-flash')}
function quitGame(){hideRoundTransition();cancelAiTurn();clearInterval(turnTimer);clearInterval(actionTimer);clearTimeout(aiMoveTimer);actionFeedbackToken++;clearTimeout(actionFeedbackTimer);actionFeedbackTimer=null;activeActionFeedback=null;lastActionFeedbackId='';roundActive=false;mpClearActiveGameState();stopGameMusic();nav('screen-main');if(mp.connected)mpSend('leave')}
function openSettingsFromGame(){previousScreenId=activeScreenId==='screen-game'?'screen-game':(previousScreenId||'screen-main');nav('screen-settings');applyAudioSettings()}
function returnToGameFromSettings(){nav(previousScreenId||'screen-main')}
function exitGameFromSettings(){hideRoundTransition();cancelAiTurn();clearInterval(turnTimer);clearInterval(actionTimer);clearTimeout(aiMoveTimer);roundActive=false;mpClearActiveGameState();stopGameMusic();previousScreenId='screen-main';nav('screen-main')}
function exitSettings(){returnToGameFromSettings()}
function toggleAutoSortSetting(){autoSortSetting=!autoSortSetting;try{localStorage.setItem('hk_auto_sort',autoSortSetting?'1':'0')}catch{};setText('btn-toggle-autosort',autoSortSetting?'ON':'OFF');if(roundActive)renderTable()}

// --------------------- Multiplayer Chat -------------------------
const MP_CHAT_POSITION_KEY='mahjongHKChatPositionV2';
const MP_CHAT_MAX_MESSAGES=100;

let gameChatMessages=[];
let gameChatUnread=0;
let gameChatOpen=false;
let gameChatDragging=false;
let gameChatDragMoved=false;
let gameChatPointerId=null;
let gameChatStartX=0;
let gameChatStartY=0;
let gameChatStartLeft=0;
let gameChatStartTop=0;
let gameChatSuppressToggle=false;
let gameChatAiReplyTimers=[];
const gameChatBubbleTimers=new Map();
const gameChatSeenIds=new Set();
// ============================================================
// CHAT AI REPLIES — UBAH BALASAN AI DI SINI
// Cari kata: CHAT AI REPLIES
// Kamu cukup mengubah / menambah kalimat di dalam array berikut.
// Setiap AI akan memilih 1 template secara RANDOM.
// ============================================================
const GAME_CHAT_AI_TEMPLATES=[
  'Selamat Bermain Mahjong ! Semoga Beruntung.',
  'Bagaimana Perasaan Kamu Saat Bermain Bersama Saya ?',
  'Apakah Saya Hebat ?',
  'Cuman Segini Kemampuan Kamu?',
  'Saya Rasa Kamu Bukan Tandingan Kami !!'
];

function gameChatRoot(){return byId('game-chat')}
function gameChatToggle(){return byId('game-chat-toggle')}
function gameChatPanel(){return byId('game-chat-panel')}
function gameChatInput(){return byId('game-chat-input')}

function gameChatIsAvailable(){
  if(activeScreenId!=='screen-game')return false;

  if(!isMultiplayerMode){
    return !!roundActive;
  }

  // CHAT MULTIPLAYER TETAP AKTIF MESKI HANYA 1 PEMAIN MANUSIA DI ROOM.
  // Jangan bergantung pada jumlah pemain, mpServerStarted, atau room.code.
  // Setelah layar game terbuka dan WebSocket tersambung, chat sudah boleh dipakai.
  return !!(
    mp.seat!=null &&
    mp.connected &&
    mp.ws?.readyState===WebSocket.OPEN
  );
}

function gameChatLoadPosition(){
  const root=gameChatRoot();
  const board=byId('game-board');
  if(!root||!board)return;

  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(MP_CHAT_POSITION_KEY)||'null')}catch(e){}

  if(saved&&Number.isFinite(Number(saved.left))&&Number.isFinite(Number(saved.top))){
    root.style.left=`${Number(saved.left)}px`;
    root.style.top=`${Number(saved.top)}px`;
  }else{
    const rect=board.getBoundingClientRect();
    root.style.left=`${Math.max(6,rect.width-38)}px`;
    root.style.top=`${Math.max(6,rect.height-115)}px`;
  }

  gameChatClampPosition();
}

function gameChatClampPosition(){
  const root=gameChatRoot();
  const board=byId('game-board');
  if(!root||!board)return;

  const rect=board.getBoundingClientRect();
  const w=root.offsetWidth||23;
  const h=root.offsetHeight||23;
  const left=Number.parseFloat(root.style.left);
  const top=Number.parseFloat(root.style.top);

  if(!Number.isFinite(left)||!Number.isFinite(top))return;

  root.style.left=`${Math.max(4,Math.min(left,Math.max(4,rect.width-w-4)))}px`;
  root.style.top=`${Math.max(4,Math.min(top,Math.max(4,rect.height-h-4)))}px`;
}

function gameChatSavePosition(){
  const root=gameChatRoot();
  if(!root)return;

  const left=Number.parseFloat(root.style.left);
  const top=Number.parseFloat(root.style.top);
  if(!Number.isFinite(left)||!Number.isFinite(top))return;

  try{
    localStorage.setItem(MP_CHAT_POSITION_KEY,JSON.stringify({left,top}));
  }catch(e){}
}

function gameChatUpdatePanelPlacement(){
  const root=gameChatRoot();
  const panel=gameChatPanel();
  const board=byId('game-board');

  if(!root||!panel||!board||!gameChatOpen)return;

  root.classList.remove('panel-right','panel-below');
  panel.style.left='';
  panel.style.top='';
  panel.style.right='auto';
  panel.style.bottom='auto';

  const boardRect=board.getBoundingClientRect();
  const rootRect=root.getBoundingClientRect();
  const panelW=panel.offsetWidth||220;
  const panelH=panel.offsetHeight||248;
  const gap=8;
  const margin=6;

  // Keep the whole chat panel inside the actual visible viewport.
  // The old class-only placement could still let the panel run off-screen.
  const viewportW=window.visualViewport?.width||window.innerWidth;
  const viewportH=window.visualViewport?.height||window.innerHeight;
  const viewportLeft=window.visualViewport?.offsetLeft||0;
  const viewportTop=window.visualViewport?.offsetTop||0;

  const minX=Math.max(viewportLeft+margin,boardRect.left+margin);
  const maxX=Math.min(viewportLeft+viewportW-margin,boardRect.right-margin);
  const minY=Math.max(viewportTop+margin,boardRect.top+margin);
  const maxY=Math.min(viewportTop+viewportH-margin,boardRect.bottom-margin);

  let targetX=rootRect.left;
  let targetY=rootRect.top-panelH-gap;

  // Prefer opening above the button.
  if(targetY<minY){
    targetY=rootRect.bottom+gap;
    root.classList.add('panel-below');
  }

  // If there is not enough room below either, clamp vertically to the viewport.
  if(targetY+panelH>maxY){
    targetY=Math.max(minY,maxY-panelH);
  }

  // Keep the full panel horizontally visible.
  if(targetX+panelW>maxX){
    targetX=maxX-panelW;
    root.classList.add('panel-right');
  }
  if(targetX<minX){
    targetX=minX;
    root.classList.remove('panel-right');
  }

  // When the screen is narrower than the panel, let CSS max-width handle it.
  // Re-read the size once after clamping so the calculation remains accurate.
  const finalW=panel.offsetWidth||panelW;
  const finalH=panel.offsetHeight||panelH;
  targetX=Math.max(minX,Math.min(targetX,maxX-finalW));
  targetY=Math.max(minY,Math.min(targetY,maxY-finalH));

  panel.style.left=`${targetX-rootRect.left}px`;
  panel.style.top=`${targetY-rootRect.top}px`;
  panel.style.right='auto';
  panel.style.bottom='auto';
}

function gameChatUnreadRender(){
  const badge=byId('game-chat-unread');
  if(!badge)return;

  if(gameChatOpen)gameChatUnread=0;
  badge.hidden=gameChatUnread<=0;
  if(gameChatUnread>0){
    badge.textContent=gameChatUnread>99?'99+':String(gameChatUnread);
  }
}

function gameChatRender(){
  const box=byId('game-chat-messages');
  if(!box)return;

  if(!gameChatMessages.length){
    box.innerHTML='<div class="game-chat-empty">Belum ada pesan.<br>Mulai ngobrol dengan pemain lain.</div>';
    return;
  }

  box.innerHTML=gameChatMessages.map(msg=>{
    const own=Number(msg.from)===Number(mp.seat);
    let time='';

    try{
      time=new Date(Number(msg.ts)||Date.now()).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    }catch(e){}

    const senderSeat=Number.isFinite(Number(msg.from))?Number(msg.from):-1;
    const senderAvatar=String(msg.avatar||playerAvatars?.[senderSeat]||'panda').toLowerCase();
    const avatarClass=['panda','shiba','turtle','penguin','rubah','rabbit','dragon','tiger','owl','squirrel'].includes(senderAvatar)?` avatar-${senderAvatar}`:' avatar-panda';

    return `<div class="game-chat-msg${own?' own':''}${avatarClass}">`+
      `<span class="game-chat-name${avatarClass}">${esc(msg.name||'Player')}${own?' • Kamu':''}</span>`+
      `<span class="game-chat-text">${esc(msg.text||'')}</span>`+
      `<span class="game-chat-time">${esc(time)}</span>`+
      `</div>`;
  }).join('');

  box.scrollTop=box.scrollHeight;
}

function gameChatReset(){
  gameChatClearBubbles();
  gameChatAiReplyTimers.forEach(clearTimeout);
  gameChatAiReplyTimers=[];
  gameChatMessages=[];
  gameChatUnread=0;
  gameChatSeenIds.clear();
  gameChatRender();
  gameChatUnreadRender();
}

function gameChatClose(){
  const root=gameChatRoot();
  const toggle=gameChatToggle();
  if(!root)return;

  gameChatOpen=false;
  root.classList.remove('open','panel-right','panel-below');

  if(toggle){
    toggle.setAttribute('aria-expanded','false');
  }
}

function gameChatOpenPanel(){
  const root=gameChatRoot();
  const toggle=gameChatToggle();

  if(!root||!gameChatIsAvailable())return;

  gameChatOpen=true;
  gameChatUnread=0;
  root.classList.add('open');

  if(toggle){
    toggle.setAttribute('aria-expanded','true');
  }

  gameChatUnreadRender();

  requestAnimationFrame(()=>{
    gameChatClampPosition();
    gameChatUpdatePanelPlacement();
    gameChatRender();
    gameChatInput()?.focus();
  });
}

function gameChatTogglePanel(){
  if(!gameChatIsAvailable())return;
  if(gameChatOpen)gameChatClose();
  else gameChatOpenPanel();
}

function gameChatRefreshVisibility(){
  const root=gameChatRoot();
  if(!root)return;

  const visible=gameChatIsAvailable();
  root.hidden=!visible;

  const status=byId('game-chat-status');
  if(status){
    status.textContent=isMultiplayerMode?(hkLanguage==='id'?'Multiplayer':'Multiplayer'):(hkLanguage==='id'?'Solo • AI':'Solo • AI');
  }

  if(!visible){
    gameChatClose();
    return;
  }

  gameChatLoadPosition();
  gameChatUnreadRender();
}

function gameChatPush(msg){
  if(!msg||typeof msg!=='object')return;

  const id=String(msg.id||'').trim();
  if(id&&gameChatSeenIds.has(id))return;
  if(id)gameChatSeenIds.add(id);

  const text=String(msg.text||'').replace(/\s+/g,' ').trim().slice(0,240);
  if(!text)return;

  gameChatMessages.push({
    id:id||`chat-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    from:Number.isFinite(Number(msg.from))?Number(msg.from):-1,
    name:String(msg.name||'Player').trim().slice(0,20)||'Player',
    avatar:String(msg.avatar||playerAvatars?.[Number(msg.from)]||'panda').toLowerCase(),
    text,
    ts:Number(msg.ts)||Date.now()
  });

  gameChatShowBubble(msg);

  while(gameChatMessages.length>MP_CHAT_MAX_MESSAGES){
    const removed=gameChatMessages.shift();
    if(removed?.id)gameChatSeenIds.delete(removed.id);
  }

  const chatRoot=gameChatRoot();
  const chatIsVisible=gameChatOpen||!!chatRoot?.classList.contains('open');
  if(!chatIsVisible&&Number(msg.from)!==Number(mp.seat)){
    gameChatUnread++;
  }else if(chatIsVisible){
    gameChatUnread=0;
  }

  gameChatRender();
  gameChatUnreadRender();
}

function gameChatSeatElement(seat){
  const s=mp.seat??0,m=mappedSeats(s);
  if(Number(seat)===m[0])return document.querySelector('.player-seat.pos-bottom');
  if(Number(seat)===m[1])return document.querySelector('.player-seat.pos-right');
  if(Number(seat)===m[2])return document.querySelector('.player-seat.pos-top');
  if(Number(seat)===m[3])return document.querySelector('.player-seat.pos-left');
  return null;
}
function gameChatShowBubble(msg){
  if(!msg||msg.from===undefined||msg.from===null)return;
  const seat=Number(msg.from);
  if(!Number.isInteger(seat)||seat<0||seat>3)return;
  const seatEl=gameChatSeatElement(seat);
  if(!seatEl)return;
  const old=seatEl.querySelector('.game-chat-bubble');
  old?.remove();
  const timer=gameChatBubbleTimers.get(seat);
  if(timer)clearTimeout(timer);
  const avatar=String(msg.avatar||playerAvatars?.[seat]||'panda').toLowerCase();
  const avatarClass=['panda','shiba','turtle','penguin','rubah','rabbit','dragon','tiger','owl','squirrel'].includes(avatar)?` avatar-${avatar}`:' avatar-panda';
  const bubble=document.createElement('div');
  bubble.className=`game-chat-bubble${avatarClass}`;
  const name=document.createElement('span');
  name.className='game-chat-bubble-name';
  name.textContent=String(msg.name||playerName(seat)||'Player').trim().slice(0,20)||'Player';
  const text=document.createElement('span');
  text.className='game-chat-bubble-text';
  text.textContent=String(msg.text||'').replace(/\s+/g,' ').trim().slice(0,180);
  bubble.append(name,text);
  seatEl.appendChild(bubble);
  gameChatBubbleTimers.set(seat,setTimeout(()=>{bubble.remove();gameChatBubbleTimers.delete(seat)},2500));
}
function gameChatClearBubbles(){
  gameChatBubbleTimers.forEach(clearTimeout);
  gameChatBubbleTimers.clear();
  document.querySelectorAll('.game-chat-bubble').forEach(el=>el.remove());
}
function gameChatRandomAiReply(){
  const templates=GAME_CHAT_AI_TEMPLATES.filter(v=>String(v||'').trim());
  if(!templates.length)return '';
  return String(templates[Math.floor(Math.random()*templates.length)]).trim().slice(0,240);
}

function gameChatScheduleAiReplies(){
  const seats=[...aiSeats].filter(seat=>Number.isInteger(Number(seat))&&Number(seat)>=0&&Number(seat)<4);
  if(!seats.length)return;

  // Multiplayer: HANYA HOST yang mengirim balasan AI ke Worker supaya
  // setiap pemain menerima balasan yang sama dan tidak terjadi duplikasi.
  if(isMultiplayerMode&&!mp.host)return;
  if(isMultiplayerMode&&(!mp.connected||mp.ws?.readyState!==WebSocket.OPEN))return;

  seats.forEach((aiSeat,index)=>{
    const delay=700+(index*950)+Math.floor(Math.random()*350);
    const timer=setTimeout(()=>{
      gameChatAiReplyTimers=gameChatAiReplyTimers.filter(t=>t!==timer);
      if(!gameChatIsAvailable())return;

      const reply=gameChatRandomAiReply();
      if(!reply)return;

      if(isMultiplayerMode){
        // Worker akan broadcast pesan AI ini ke host + seluruh guest.
        mpSend('chat',{
          text:reply,
          ai:true,
          aiSeat:Number(aiSeat),
          name:playerName(aiSeat),
          avatar:playerAvatars[aiSeat]||'panda'
        });
        return;
      }

      // Solo: tidak ada WebSocket, jadi tampilkan AI langsung di browser.
      gameChatPush({
        id:`solo-ai-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        from:Number(aiSeat),
        name:playerName(aiSeat),
        avatar:playerAvatars[aiSeat]||'panda',
        text:reply,
        ts:Date.now(),
        ai:true
      });
    },delay);

    gameChatAiReplyTimers.push(timer);
  });
}

function gameChatSend(){
  const input=gameChatInput();
  if(!input||!gameChatIsAvailable())return false;

  const text=String(input.value||'').replace(/\s+/g,' ').trim().slice(0,240);
  if(!text)return false;

  if(!isMultiplayerMode){
    gameChatPush({
      id:`solo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      from:0,
      name:playerName(0)||'Player',
      avatar:playerAvatars[0]||selectedAvatar||'panda',
      text,
      ts:Date.now()
    });

    input.value='';
    input.focus();
    gameChatScheduleAiReplies();
    return true;
  }

  if(!mp.connected||mp.ws?.readyState!==WebSocket.OPEN)return false;

  const sent=mpSend('chat',{text});
  if(sent){
    input.value='';
    input.focus();
    gameChatScheduleAiReplies();
  }

  return sent;
}

function gameChatDragStart(e){
  const root=gameChatRoot();
  const toggle=gameChatToggle();

  if(!root||!toggle||!gameChatIsAvailable())return;
  if(e.pointerType==='mouse'&&e.button!==0)return;

  gameChatDragging=true;
  gameChatDragMoved=false;
  gameChatSuppressToggle=false;
  gameChatPointerId=e.pointerId;
  gameChatStartX=e.clientX;
  gameChatStartY=e.clientY;
  gameChatStartLeft=Number.parseFloat(root.style.left)||0;
  gameChatStartTop=Number.parseFloat(root.style.top)||0;

  try{toggle.setPointerCapture(e.pointerId)}catch(err){}
  e.preventDefault();
}

function gameChatDragMove(e){
  if(!gameChatDragging||e.pointerId!==gameChatPointerId)return;

  const root=gameChatRoot();
  const board=byId('game-board');
  if(!root||!board)return;

  const dx=e.clientX-gameChatStartX;
  const dy=e.clientY-gameChatStartY;

  if(Math.hypot(dx,dy)>4)gameChatDragMoved=true;
  if(!gameChatDragMoved)return;

  const rect=board.getBoundingClientRect();
  const w=root.offsetWidth||23;
  const h=root.offsetHeight||23;

  const left=Math.max(4,Math.min(gameChatStartLeft+dx,Math.max(4,rect.width-w-4)));
  const top=Math.max(4,Math.min(gameChatStartTop+dy,Math.max(4,rect.height-h-4)));

  root.style.left=`${left}px`;
  root.style.top=`${top}px`;
  gameChatSuppressToggle=true;

  if(gameChatOpen)gameChatUpdatePanelPlacement();
  e.preventDefault();
}

function gameChatDragEnd(e){
  if(!gameChatDragging||e.pointerId!==gameChatPointerId)return;

  const toggle=gameChatToggle();
  try{toggle?.releasePointerCapture(e.pointerId)}catch(err){}

  const moved=gameChatDragMoved;
  gameChatDragging=false;
  gameChatPointerId=null;

  if(moved){
    gameChatSavePosition();
  }else if(!gameChatSuppressToggle){
    gameChatTogglePanel();
  }

  gameChatSuppressToggle=false;
  e.preventDefault();
}

function gameChatInit(){
  const root=gameChatRoot();
  const toggle=gameChatToggle();
  const form=byId('game-chat-form');
  const input=gameChatInput();

  if(!root||!toggle||!form||!input)return;
  if(root.dataset.ready==='1')return;

  root.dataset.ready='1';
  gameChatLoadPosition();
  gameChatRender();
  gameChatUnreadRender();
  gameChatRefreshVisibility();

  toggle.addEventListener('pointerdown',gameChatDragStart,{passive:false});
  toggle.addEventListener('pointermove',gameChatDragMove,{passive:false});
  toggle.addEventListener('pointerup',gameChatDragEnd,{passive:false});
  toggle.addEventListener('pointercancel',gameChatDragEnd,{passive:false});

  form.addEventListener('submit',e=>{
    e.preventDefault();
    gameChatSend();
  });

  const refreshChatViewport=()=>{
    const inputFocused=document.activeElement?.id==='game-chat-input';
    if(inputFocused)return;
    gameChatClampPosition();
    if(gameChatOpen)gameChatUpdatePanelPlacement();
  };
  window.addEventListener('resize',refreshChatViewport,{passive:true});
  window.visualViewport?.addEventListener('resize',refreshChatViewport,{passive:true});
  window.visualViewport?.addEventListener('scroll',refreshChatViewport,{passive:true});

  input.addEventListener('focus',()=>{
    window.scrollTo(0,0);
    requestAnimationFrame(()=>window.scrollTo(0,0));
    setTimeout(()=>window.scrollTo(0,0),80);
  });

  input.addEventListener('blur',()=>{
    window.scrollTo(0,0);
    setTimeout(()=>window.scrollTo(0,0),80);
  });

  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      gameChatSend();
    }
  });

  document.addEventListener('pointerdown',e=>{
    if(!gameChatOpen)return;
    if(root.contains(e.target))return;
    gameChatClose();
  },{passive:true});

  window.addEventListener('resize',()=>{
    if(!gameChatIsAvailable())return;
    gameChatClampPosition();
    if(gameChatOpen)gameChatUpdatePanelPlacement();
  },{passive:true});
}

// --------------------- Multiplayer -------------------------
function escapeHtml(v){return esc(v)}
function mpSetConnection(online){setText('mp-connection-badge',online?'ONLINE':'OFFLINE');const b=byId('mp-connection-badge');if(b)b.className=`connection-badge ${online?'online':'offline'}`;renderPlayerConnectionStatus(mp.room)}
function renderPlayerConnectionStatus(room=mp.room){const indicators=[['.pos-bottom .player-connection-indicator',0],['.pos-left .player-connection-indicator',3],['.pos-top .player-connection-indicator',2],['.pos-right .player-connection-indicator',1]];if(!isMultiplayerMode){indicators.forEach(([sel])=>{const el=document.querySelector(sel);if(el)el.className='player-connection-indicator hidden'});return}const localSeat=mp.seat??0;const mapped=mappedSeats(localSeat);indicators.forEach(([sel,displayIndex])=>{const el=document.querySelector(sel);if(!el)return;const seat=mapped[displayIndex];el.className='player-connection-indicator';const p=room?.players?.[seat];if(aiSeats.has(seat)){el.classList.add('ai');el.querySelector('.player-connection-text').textContent='AI';el.title='AI';return}let online=false;let disconnected=false;if(seat===localSeat){online=!!mp.connected;disconnected=!online}else if(p){online=p.connected!==false;disconnected=p.connected===false}else{disconnected=true}const stateClass=online?'online':'disconnected';el.classList.add(stateClass);el.querySelector('.player-connection-text').textContent=online?'ONLINE':(hkLanguage==='id'?'TERPUTUS':'DISCONNECTED');el.title=online?'Player online':'Player terputus';});}

function mpServerUrl(code=''){const base=String(MP_WORKER_URL||'').replace(/\/$/,'');if(!base)return null;const wsBase=base.replace(/^https:/,'wss:').replace(/^http:/,'ws:');return `${wsBase}/ws?room=${encodeURIComponent(code)}`}
function mpSaveSession(extra={}){try{const room=mp.room||null;localStorage.setItem(MP_SESSION_KEY,JSON.stringify({room:room?.code||'',seat:mp.seat??null,name:mp.playerName||'Player',avatar:mp.playerAvatar||selectedAvatar,host:!!mp.host,ready:!!mp.ready,started:!!mp.started,players:room?.players||null,roomStarted:!!room?.started,token:mp.token||null,updatedAt:Date.now(),...extra}))}catch(e){}}
function mpTouchSession(force=false){const now=Date.now();if(!force&&now-mpSessionTouchAt<MP_SESSION_TOUCH_MS)return;mpSessionTouchAt=now;mpSaveSession({started:!!mp.started,roomStarted:!!mp.room?.started})}
function mpLoadSession(){try{return JSON.parse(localStorage.getItem(MP_SESSION_KEY)||'null')}catch(e){return null}}
function mpClearSession(){try{localStorage.removeItem(MP_SESSION_KEY)}catch(e){}}
function mpSaveActiveGameState(state){
  if(!mp.host||!mp.room?.code||!state?.roundActive)return;
  try{localStorage.setItem(MP_GAME_STATE_KEY,JSON.stringify({room:mp.room.code,savedAt:Date.now(),state}))}catch(e){}
}
function mpLoadActiveGameState(code){
  try{
    const saved=JSON.parse(localStorage.getItem(MP_GAME_STATE_KEY)||'null');
    if(!saved?.state||saved.room!==code||Date.now()-Number(saved.savedAt||0)>4*60*60*1000)return null;
    return saved;
  }catch(e){return null}
}
function mpClearActiveGameState(){try{localStorage.removeItem(MP_GAME_STATE_KEY)}catch(e){}}
function mpRestoreHostGameState(state,startRuntime=true){
  if(!state?.roundActive)return false;
  cancelAiTurn();
  clearGameTimers();
  fullDeck=state.fullDeck||[];
  playerHands=state.playerHands||[[],[],[],[]];
  playerRivers=state.playerRivers||[[],[],[],[]];
  playerMelds=state.playerMelds||[[],[],[],[]];
  playerScores=state.playerScores||[15000,15000,15000,15000];
  currentRoundIndex=state.currentRoundIndex??0;
  currentDealerIdx=state.currentDealerIdx??1;
  currentTurn=state.currentTurn??currentDealerIdx;
  lastDiscardedTile=state.lastDiscardedTile||null;
  lastDiscarderIdx=state.lastDiscarderIdx??-1;
  drawnTile=state.drawnTile||null;
  secondsLeft=state.secondsLeft??TURN_BASE_SECONDS;
  timeBank=Array.isArray(state.timeBank)?state.timeBank:[TIME_BANK_MAX,TIME_BANK_MAX,TIME_BANK_MAX,TIME_BANK_MAX];
  actionSecondsLeft=state.actionSecondsLeft??0;
  activeCallId=state.actionContextId||null;
  aiSeats=new Set(state.aiSeats||[]);
  if(Array.isArray(state.playerAvatars)&&state.playerAvatars.length===4)playerAvatars=state.playerAvatars.slice();
  mpPendingCalls=Array.isArray(state.pendingCalls)?state.pendingCalls:[];
  pendingCallChoice=null;
  roundEnding=false;
  roundActive=true;
  nav('screen-game');
  renderTable();
  gameTurnEpoch++;
  if(!startRuntime)return true;
  if(mpPendingCalls.length)promptNextCall(true);
  else if(aiSeats.has(currentTurn))scheduleAiTurn(currentTurn,'discard');
  else {
    isDiscardable=currentTurn===(mp.seat??0);
    startTurnTimer(true);
  }
  return true;
}
function mpRoomUrl(code){const u=new URL(location.href);u.searchParams.set(MP_ROOM_PARAM,code);u.searchParams.delete('offer');u.searchParams.delete('answer');return u.href}
async function mpCopyRoomLink(){const link=byId('mp-room-link')?.value||mpRoomUrl(mp.room?.code||'');if(!link)return;try{if(navigator.share){await navigator.share({title:'Mahjong DJ',text:'Gabung ke room Mahjong DJ',url:link});setText('mp-invite-help','Link room berhasil dibagikan.');return;}}catch(e){if(e?.name==='AbortError')return}try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(link);setText('mp-invite-help','Link room berhasil disalin.');return}}catch(e){}const input=byId('mp-room-link');if(input){input.removeAttribute('readonly');input.focus();input.select();try{document.execCommand('copy')}catch(e){}input.setAttribute('readonly','readonly');setText('mp-invite-help','Link room siap disalin.')}}
function mpRenderRoomQr(code){setText('mp-host-room-code',code||'-----');const input=byId('mp-room-link');if(input)input.value=mpRoomUrl(code);const canvas=byId('mp-offer-qr');if(!canvas)return;canvas.classList.remove('visible');const draw=()=>{try{if(window.QRCode?.toCanvas){QRCode.toCanvas(canvas,mpRoomUrl(code),{width:180,margin:1},()=>canvas.classList.add('visible'));return true}}catch(e){}return false};if(!draw()){let tries=0;const t=setInterval(()=>{if(draw()||++tries>40)clearInterval(t)},150)}}
function mpEnsureToken(){if(!mp.token){try{mp.token=(crypto.randomUUID?crypto.randomUUID():('tok-'+Math.random().toString(36).slice(2)+Date.now().toString(36)))}catch(e){mp.token='tok-'+Math.random().toString(36).slice(2)+Date.now().toString(36)}}return mp.token}
function mpConnect(code='',role='',isReconnect=false){const c=String(code||mp.room?.code||'').trim();mpServerStarted=false;if(!/^\d{5}$/.test(c)){mpSetConnection(false);return false}const workerUrl=mpServerUrl(c);if(!workerUrl){mpSetConnection(false);setText('lobby-help','URL Cloudflare Worker belum dikonfigurasi.');return false}if(mp.ws&&(mp.ws.readyState===WebSocket.OPEN||mp.ws.readyState===WebSocket.CONNECTING))return true;if(isReconnect&&isMultiplayerMode&&mp.started){
  // Every reconnect attempt, including a transient Wi-Fi/WebSocket drop while
  // the page is still open, must consume the same authoritative rejoin path.
  // Without this, a reconnected host could ignore the server's restored state.
  mpRejoinMode=true;
  mpRejoinStateApplied=false;
  mpRejoinJoined=false;
  clearTimeout(mpRejoinFallbackTimer);
  clearTimeout(mpRejoinModeTimer);
}try{const desiredRole=role||(mp.host?'host':'guest');const ws=new WebSocket(`${workerUrl}&name=${encodeURIComponent(mp.playerName||'Player')}&role=${desiredRole}${mp.seat!=null?`&seat=${mp.seat}`:''}`);mp.ws=ws;ws.onopen=()=>{setTimeout(retryPendingGuestAction,0);mp.connected=true;mpReconnectAttempts=0;mpReconnectDeadline=0;mpSetConnection(true);startMpPing();lastHostServerSeq=0;clearTimeout(mpRejoinHandshakeTimer);ws.send(JSON.stringify({type:isReconnect?'rejoin':(desiredRole==='host'?'createRoom':'joinRoom'),code:c,name:mp.playerName||'Player',seat:mp.seat,token:mp.token,avatar:mp.playerAvatar||selectedAvatar}));if(isReconnect){mpRejoinHandshakeTimer=setTimeout(()=>{if(mpRejoinMode&&!mpRejoinStateApplied&&mp.ws===ws){try{ws.close()}catch(e){}}},7000)}};ws.onmessage=e=>{try{mpHandle(JSON.parse(e.data))}catch(err){console.error('MP message error',err)}};ws.onerror=()=>{mp.connected=false;mpSetConnection(false)};ws.onclose=()=>{mp.connected=false;stopMpPing();clearTimeout(mpRejoinHandshakeTimer);mpRejoinHandshakeTimer=null;if(isReconnect)mpRejoinJoined=false;mpSetConnection(false);mp.ws=null;
    // Reconnect during a game too. The host keeps a local snapshot and sends
    // it again after the Worker accepts the restored room connection.
    if(mp.room?.code && isMultiplayerMode){
      if(!mpReconnectDeadline)mpReconnectDeadline=Date.now()+MP_RECONNECT_WINDOW_MS;
      if(Date.now()<mpReconnectDeadline){const delay=Math.min(2500,700+mpReconnectAttempts*450);mpReconnectAttempts++;clearTimeout(mpReconnectTimer);mpReconnectTimer=setTimeout(()=>{if(!mp.connected)mpConnect(mp.room.code,mp.host?'host':'guest',true)},delay)}
    }
  };return true}catch(e){mp.connected=false;mpSetConnection(false);console.error(e);return false}}
function mpSend(type,data={}){
  if(mp.ws?.readyState!==WebSocket.OPEN)return false;
  try{
    mp.ws.send(JSON.stringify({type,...data}));
    return true;
  }catch(err){
    console.warn('MP send failed:',err);
    return false;
  }
}
function clearGuestActionRetry(){
  mpPendingGuestAction=null;
  clearTimeout(mpGuestActionRetryTimer);
  mpGuestActionRetryTimer=null;
}
function retryPendingGuestAction(){
  clearTimeout(mpGuestActionRetryTimer);
  mpGuestActionRetryTimer=null;

  const pending=mpPendingGuestAction;
  if(!pending||!isMultiplayerMode||mp.host)return;

  if(mp.ws?.readyState===WebSocket.OPEN){
    if(mpSend('action',{action:pending})){
      hideAvailableActions();
      clearGuestActionRetry();
      return;
    }
  }

  mpGuestActionRetryTimer=setTimeout(retryPendingGuestAction,350);
}
function queueGuestAction(action){
  if(!action||typeof action!=='object')return false;

  // Never queue a second action while the first one is still waiting for transport.
  if(mpPendingGuestAction)return false;

  mpPendingGuestAction={...action};
  retryPendingGuestAction();
  return true;
}
let mpPingTimer=null;
let mpPendingGuestAction=null;
let mpGuestActionRetryTimer=null;
function startMpPing(){clearInterval(mpPingTimer);if(!mp.connected)return;mpPingTimer=setInterval(()=>{if(mp.ws?.readyState===WebSocket.OPEN)mpSend('ping',{clientTime:Date.now()});},8000)}
function stopMpPing(){clearInterval(mpPingTimer);mpPingTimer=null}
function mpRestoreSavedSession(saved){
  if(!saved?.room||!/^\d{5}$/.test(String(saved.room))||!saved.token)return false;
  isMultiplayerMode=true;
  mp.playerName=saved.name||'Player';
  mp.playerAvatar=saved.avatar||selectedAvatar;
  selectedAvatar=mp.playerAvatar;
  mp.host=!!saved.host;
  mp.seat=saved.seat;
  mp.token=saved.token;
  mp.ready=!!saved.ready;
  mp.started=!!saved.started;
  mp.room={code:String(saved.room),players:saved.players||[null,null,null,null],started:!!saved.roomStarted||!!saved.started};
  return true;
}
function mpBeginReconnect(saved){
  if(!mpRestoreSavedSession(saved))return false;
  clearTimeout(mpReconnectTimer);
  clearTimeout(mpRejoinFallbackTimer);
  clearTimeout(mpRejoinModeTimer);
  mpReconnectAttempts=0;
  mpReconnectDeadline=Date.now()+MP_RECONNECT_WINDOW_MS;
  mpRejoinMode=true;
  mpRejoinStateApplied=false;
  mpRejoinJoined=false;
  mpRejoinFallbackState=null;
  clearTimeout(mpRejoinHandshakeTimer);
  mpRejoinHandshakeTimer=null;
  setDisplay('modal-lobby','none');
  setDisplay('mp-reconnect-card','none');

  if(mp.host){
    const savedGame=mpLoadActiveGameState(saved.room);
    if(savedGame?.state){
      mpRejoinFallbackState=savedGame.state;
      mpRestoreHostGameState(savedGame.state,false);
      setText('hand-status-main','Menyambungkan kembali…');
      setText('hand-status-sub','Memulihkan keadaan meja terakhir.');
      // Render the saved host snapshot immediately, but do not start its timers yet.
      // The Worker sends the authoritative state right after the rejoin handshake.
      // If the Worker has no game state, the fallback is activated only from
      // its startGame confirmation below, preventing a stale local snapshot
      // from overwriting a newer server state.
    }else{
      nav('screen-game');
      setText('hand-status-main','Menyambungkan kembali…');
      setText('hand-status-sub','Menunggu state permainan dari room.');
      clearTimeout(mpRejoinFallbackTimer);
      mpRejoinFallbackTimer=setTimeout(()=>{
        if(mpRejoinMode&&!mpRejoinStateApplied){
          mpRejoinMode=false;
          setText('hand-status-main','Sesi permainan belum dapat dipulihkan');
          setText('hand-status-sub','Room tidak mengirim state permainan. Silakan kembali ke menu utama atau coba lagi.');
        }
      },7000);
    }
  }else if(saved.started){
    nav('screen-game');
    setText('hand-status-main','Menyambungkan kembali…');
    setText('hand-status-sub','Menunggu state permainan terbaru.');
    clearTimeout(mpRejoinFallbackTimer);
    mpRejoinFallbackTimer=setTimeout(()=>{
      if(mpRejoinMode&&!mpRejoinStateApplied){
        mpRejoinMode=false;
        setText('hand-status-main','Menunggu state permainan');
        setText('hand-status-sub','Belum menerima state terbaru dari room. Koneksi akan mencoba kembali.');
      }
    },7000);
  }

  mpConnect(saved.room,mp.host?'host':'guest',true);
  return true;
}
function mpAutoRecoverSavedSession(){
  // Saved multiplayer sessions are never revived on a fresh page load.
  // Reconnect is allowed only after the player intentionally enters Multiplayer.
  return false;
}
function mpEnsureReconnectOnResume(){
  if(!isMultiplayerMode)return;

  if(
    mp.room?.code&&
    !mp.connected&&
    (!mp.ws||mp.ws.readyState===WebSocket.CLOSED)
  ){
    mpReconnectDeadline=Date.now()+MP_RECONNECT_WINDOW_MS;
    mpConnect(
      mp.room.code,
      mp.host?'host':'guest',
      true
    );
  }
}
function openPlayerLobby(){isMultiplayerMode=true;mp.playerAvatar=selectedAvatar;clearTimeout(mpReconnectTimer);mpReconnectAttempts=0;mpReconnectDeadline=0;setDisplay('modal-lobby','flex');setDisplay('mp-setup','grid');setDisplay('mp-room-panel','none');setDisplay('mp-host-invite','none');setDisplay('mp-guest-invite','grid');setDisplay('mp-reconnect-card','grid');mpSetConnection(false);const code=new URL(location.href).searchParams.get(MP_ROOM_PARAM);const saved=mpLoadSession();if(code&&saved?.room===code&&saved?.token&&saved?.started){setDisplay('mp-setup','none');setDisplay('mp-room-panel','grid');setText('lobby-help','Menyambungkan kembali ke Room '+code+'…');mpBeginReconnect(saved);return}if(code){setDisplay('mp-setup','none');setDisplay('mp-room-panel','grid');mp.playerName=getStoredPlayerName();mp.host=false;mp.ready=true;mpEnsureToken();mp.room={code,players:[null,null,null,null],started:false};setText('lobby-help','Menghubungkan ke Room '+code+'…');mpConnect(code,'guest')}}
function closeLobby(){gameChatClose();mpServerStarted=false;clearGuestActionRetry();clearTimeout(mpReconnectTimer);clearTimeout(mpRejoinFallbackTimer);clearTimeout(mpRejoinModeTimer);clearTimeout(mpRejoinHandshakeTimer);mpRejoinHandshakeTimer=null;mpRejoinMode=false;mpRejoinStateApplied=false;mpRejoinFallbackState=null;stopMpGameWatchdog();stopMpPing();try{mpSend('leave')}catch(e){}try{if(mp.ws){mp.ws.onclose=null;mp.ws.close()}}catch(e){}mp.ws=null;mp.connected=false;mpClearSession();mpClearActiveGameState();mp={ws:null,connected:false,room:null,seat:null,host:false,ready:false,started:false,state:null,token:null,playerName:mp.playerName||'Player',playerAvatar:selectedAvatar};isMultiplayerMode=false;setDisplay('modal-lobby','none');mpSetConnection(false)}
function closeLobbyToMenu(){closeLobby();nav('screen-play')}
function mpCreateRoom(){mpServerStarted=false;mpRejoinMode=false;mpRejoinStateApplied=false;mpRejoinJoined=false;mpRejoinFallbackState=null;clearTimeout(mpRejoinFallbackTimer);clearTimeout(mpRejoinModeTimer);mp.playerName=getStoredPlayerName();mp.playerAvatar=selectedAvatar;const code=String(Math.floor(10000+Math.random()*90000));mp.host=true;mp.seat=0;mp.ready=true;mp.started=false;mp.playerAvatar=selectedAvatar;mpEnsureToken();isMultiplayerMode=true;mp.room={code,players:[null,null,null,null],started:false};setDisplay('mp-setup','none');setDisplay('mp-room-panel','grid');setDisplay('mp-host-invite','grid');setDisplay('mp-guest-invite','none');setText('mp-room-code-display',code);setText('mp-host-room-code',code);setText('lobby-help','Membuat room di Cloudflare…');mpRenderRoomQr(code);mpSaveSession();mpConnect(code,'host')}
function mpJoinRoom(){mpServerStarted=false;mpRejoinMode=false;mpRejoinStateApplied=false;mpRejoinJoined=false;mpRejoinFallbackState=null;clearTimeout(mpRejoinFallbackTimer);clearTimeout(mpRejoinModeTimer);mp.playerName=getStoredPlayerName();const code=(byId('mp-room-code')?.value||'').trim();if(!/^\d{5}$/.test(code)){alert('Masukkan kode room 5 digit.');return}mp.host=false;mp.seat=null;mp.ready=true;mp.started=false;mp.playerAvatar=selectedAvatar;mpEnsureToken();mp.room={code,players:[null,null,null,null],started:false};isMultiplayerMode=true;setDisplay('mp-setup','none');setDisplay('mp-room-panel','grid');setDisplay('mp-host-invite','none');setDisplay('mp-guest-invite','none');setText('lobby-help','Menghubungkan ke Room '+code+'…');mpSaveSession();mpConnect(code,'guest')}
function togglePlayerReady(){if(!mp.room)return;mp.ready=!mp.ready;mpSend('ready',{ready:mp.ready});mpSaveSession();if(mp.host&&mp.room.players?.[0])mp.room.players[0].ready=mp.ready;mpRenderLobby(mp.room)}
function mpStartGame(){
  if(!mp.host)return;
  const humans=(mp.room?.players||[]).filter(Boolean).length;
  if(humans<1)return;
  mpRejoinMode=false;
  mpRejoinStateApplied=false;
  mpRejoinFallbackState=null;
  clearTimeout(mpRejoinFallbackTimer);
  clearTimeout(mpRejoinModeTimer);
  // The host is the authoritative game engine. For solo-host testing,
  // start locally so the existing AI seats can fill the empty chairs.
  if(!mp.started){
    mp.started=true;
    if(mp.room)mp.room.started=true;
    gameChatRefreshVisibility();
    setDisplay('modal-lobby','none');
    start4PGame('Medium',true);
    startMpGameWatchdog();
    mpSaveSession({started:true});
    if(humans>1)mpSend('start');
  }
}
function mpHandle(msg){
  if(msg.type==='hello'){mpClientId=msg.clientId;return}
  if(msg.type==='error'){
    setText('lobby-help',msg.message||'Room error');
    mpSetConnection(false);
    if(msg.code==='REJOIN_SESSION_NOT_FOUND'||msg.code==='REJOIN_EXPIRED'){
      clearTimeout(mpRejoinFallbackTimer);
      clearTimeout(mpRejoinModeTimer);
      clearTimeout(mpRejoinHandshakeTimer);
      mpRejoinHandshakeTimer=null;
      mpRejoinMode=false;
      mpRejoinStateApplied=false;
      mpRejoinFallbackState=null;
      try{if(mp.ws){mp.ws.onclose=null;mp.ws.close()}}catch(e){}
      mp.ws=null;
      setDisplay('modal-lobby','flex');
      setDisplay('mp-setup','none');
      setDisplay('mp-room-panel','grid');
      setText('lobby-help',msg.message||'Sesi lama sudah tidak tersedia.');
    }
    return
  }
  if(msg.type==='joined'){
    const wasRejoining=mpRejoinMode;
    if(wasRejoining)mpRejoinJoined=true;

    clearTimeout(mpRejoinHandshakeTimer);
    mpRejoinHandshakeTimer=null;

    mp.room=msg.room||mp.room;
    mpLastRoomView=mp.room;
    mp.seat=msg.seat;
    mp.host=!!msg.host;
    mp.started=!!msg.room?.started;
    mpServerStarted=!!msg.room?.started;
    mp.ready=!!(msg.room?.players?.[msg.seat]?.ready);

    mp.playerAvatar=
      msg.room?.players?.[msg.seat]?.avatar||
      mp.playerAvatar||
      selectedAvatar;

    selectedAvatar=mp.playerAvatar;
    syncHumanAvatars(msg.room);

    if(msg.seat!=null){
      playerAvatars[msg.seat]=mp.playerAvatar;
    }

    mpReconnectAttempts=0;
    mpReconnectDeadline=0;

    if(msg.token)mp.token=msg.token;

    setDisplay('mp-setup','none');
    setDisplay('mp-room-panel','grid');
    setText('mp-room-code-display',msg.room.code);

    if(mp.host){
      setDisplay('mp-host-invite','grid');
      setDisplay('mp-guest-invite','none');
      setText('lobby-help','Room dibuat. Bagikan link/QR kepada pemain lain.');
      mpRenderRoomQr(msg.room.code);
    }else{
      setDisplay('mp-host-invite','none');
      setDisplay('mp-guest-invite','none');
      setText('lobby-help','Berhasil masuk room. Kamu otomatis READY.');
    }

    mpRenderLobby(msg.room);
    renderPlayerConnectionStatus(msg.room);
    mpTouchSession(true);
    gameChatRefreshVisibility();

    if(mp.host&&roundActive&&!mpRejoinMode&&!mpRejoinStateApplied){
      mpBroadcastState();
    }

    return
  }
  if(msg.type==='lobby'){
    const wasStarted=mp.started;

    mp.room=msg.room||mp.room;
    mpLastRoomView=mp.room;
    mp.started=!!(msg.room?.started);
    mpServerStarted=!!(msg.room?.started);

    mpRenderLobby(mp.room);
    renderPlayerConnectionStatus(msg.room);
    mpTouchSession(true);
    gameChatRefreshVisibility();

    if(mp.host&&roundActive&&!mpRejoinMode&&!mpRejoinStateApplied){
      mpBroadcastState();
    }

    if(mpRejoinMode&&!mp.started){
      clearTimeout(mpRejoinFallbackTimer);
      clearTimeout(mpRejoinModeTimer);
      mpRejoinMode=false;
      mpRejoinStateApplied=false;
      mpRejoinFallbackState=null;
    }

    if(wasStarted&&!mp.started){
      mpServerStarted=false;
      mpRejoinMode=false;
      mpRejoinStateApplied=false;
      mpRejoinJoined=false;
      mpRejoinFallbackState=null;
      clearTimeout(mpRejoinFallbackTimer);
      clearTimeout(mpRejoinModeTimer);
      mp.ready=false;
      setDisplay('modal-match-over','none');
      setDisplay('modal-lobby','flex');
      setDisplay('mp-setup','none');
      setDisplay('mp-room-panel','grid');
      setDisplay('mp-host-invite','none');
      setDisplay('mp-guest-invite','none');
      setText('lobby-help',mp.host?'Tekan SIAP lalu MULAI GAME untuk bermain lagi.':'Host membuka room untuk main lagi. Tekan SIAP.');
    }

    return
  }
  if(msg.type==='startGame'){
    mpHistoryRounds=[];mpHistorySavedKeys=new Set();mpHistoryMatchStartedAt=Date.now();
    mp.started=true;mpServerStarted=true;if(mp.room)mp.room.started=true;mpTouchSession(true);setDisplay('modal-lobby','none');setDisplay('modal-match-over','none');setDisplay('modal-result','none');nav('screen-game');playGameMusic();
    if(mpRejoinMode||mpRejoinStateApplied){
      if(mp.host&&mpRejoinMode&&!mpRejoinStateApplied&&mpRejoinJoined&&mpRejoinFallbackState){
        clearTimeout(mpRejoinFallbackTimer);
        mpRejoinFallbackTimer=null;
        clearTimeout(mpRejoinModeTimer);
        mpRejoinModeTimer=null;
        mpRestoreHostGameState(mpRejoinFallbackState,true);
        mpRejoinStateApplied=true;
        mpRejoinJoined=false;
        mpRejoinMode=false;
        mpRejoinFallbackState=null;
        setText('hand-status-main','Permainan dilanjutkan');
        setText('hand-status-sub','State room tidak tersedia; memakai snapshot host terakhir.');
      }
      if(mp.host)startMpGameWatchdog();
      return;
    }
    if(mp.host&&!roundActive)start4PGame('Medium',true);if(mp.host)startMpGameWatchdog();return
  }
  if(msg.type==='state'&&msg.state){
    if(mp.host&&mpRejoinMode){
      clearTimeout(mpRejoinFallbackTimer);
      clearTimeout(mpRejoinModeTimer);
      let restored=false;
      if(msg.state.roundActive){
        restored=mpRestoreHostGameState(msg.state,true);
      }else if(msg.state.phase==='result'&&msg.state.result){
        playerScores=Array.isArray(msg.state.playerScores)?msg.state.playerScores.slice():playerScores;
        currentRoundIndex=msg.state.currentRoundIndex??currentRoundIndex;
        currentDealerIdx=msg.state.currentDealerIdx??currentDealerIdx;
        currentTurn=msg.state.currentTurn??currentTurn;
        mp.started=true;
        if(mp.room)mp.room.started=true;
        roundActive=false;
        roundEnding=false;
        setDisplay('modal-lobby','none');
        setDisplay('modal-match-over','none');
        nav('screen-game');
        renderResultModal(msg.state.result.title,msg.state.result.desc,msg.state.result);
        historyPersistRemoteState(msg.state).catch(()=>{});
        restored=true;
      }
      mpRejoinStateApplied=!!restored;
      mpRejoinJoined=false;
      mpRejoinFallbackState=null;
      mpRejoinMode=false;
      clearTimeout(mpRejoinHandshakeTimer);
      mpRejoinHandshakeTimer=null;
      if(restored){
        setText('hand-status-main','Permainan dilanjutkan');
        setText('hand-status-sub','Sinkron dengan room.');
      }else{
        setText('hand-status-main','State permainan tidak dapat dipulihkan');
        setText('hand-status-sub','Room mengirim state yang tidak dapat dipakai untuk melanjutkan sesi.');
      }
      return;
    }
    mpApplyRemoteState(msg.state);
    return;
  }
  if(msg.type==='chat'){gameChatPush(msg);return}
  if(msg.type==='playerAction'&&mp.host){mpHandlePlayerAction(msg.seat,msg.action||{});return}
}
function mpRenderLobby(room){
  const list=byId('mp-player-list');if(!list||!room)return;syncHumanAvatars(room);
  const winds=['South','East','North','West'];list.innerHTML='';
  winds.forEach((w,i)=>{const p=room.players?.[i];const row=document.createElement('div');row.className='ready-item';const isHost=i===0&&p;const name=p?escapeHtml(p.name):'Kursi kosong';const disconnected=p&&p.connected===false;const state=p?(disconnected?'TERPUTUS':(p.ready?'READY':'WAITING')):'OPEN';const cls=p&&p.ready&&!disconnected?'status-ready':'status-waiting';row.innerHTML=`<span>${name} <small>• ${w}${isHost?' • HOST':''}</small></span><span class="${cls}">${state}</span>`;list.appendChild(row)});
  setText('btn-lobby-ready',mp.ready?'BATAL SIAP':'SIAP');
  const joined=(room.players||[]).filter(Boolean).length;const humans=(room.players||[]).filter(Boolean);const startBtn=byId('btn-lobby-start');
  const lobbyActions=byId('modal-lobby')?.querySelector('.lobby-actions');
  if(lobbyActions)lobbyActions.classList.toggle('guest-actions',!mp.host);
  if(startBtn){startBtn.hidden=!mp.host||room.started;startBtn.disabled=!(joined>=1&&humans.every(p=>p.ready));}
  if(mp.host&&joined>=1&&!room.started) setText('lobby-help',joined<4?`Room siap. ${joined}/4 pemain; kursi kosong dapat diisi AI saat game dimulai.`:'Semua kursi terisi.');
}
function startMpGameWatchdog(){
  clearInterval(mpGameWatchdogTimer);
  mpGameWatchdogTimer=setInterval(()=>{
    if(!isMultiplayerMode||!roundActive||roundEnding)return;
    if(activeActionFeedback)return;

    if(mp.host){
      if(mpPendingCalls.length&&!actionTimer&&!aiMoveTimer){
        promptNextCall();
        return;
      }
      if(!mpPendingCalls.length&&aiSeats.has(currentTurn)&&!turnTimer&&!actionTimer&&!aiMoveTimer){
        scheduleAiTurn(currentTurn,'discard');
        return;
      }
      if(!mpPendingCalls.length&&!aiSeats.has(currentTurn)&&!turnTimer&&!actionTimer){
        startTurnTimer();
      }
      return;
    }

    // Guest never creates or owns an authoritative game timer.
    // It only restores local input permission from the latest host state.
    if(currentTurn===(mp.seat??0)&&roundActive&&!roundEnding&&!stateHasRemoteCallForLocalGuest){
      isDiscardable=true;
    }
  },1000);
}
function stopMpGameWatchdog(){
  clearInterval(mpGameWatchdogTimer);
  mpGameWatchdogTimer=null;
}
function mpStateSnapshot(extra={}){const hasRemote=Object.prototype.hasOwnProperty.call(extra,'remoteActions');if(hasRemote)activeRemoteActions=extra.remoteActions;const hasFeedback=Object.prototype.hasOwnProperty.call(extra,'actionFeedback');if(hasFeedback)activeActionFeedback=extra.actionFeedback||null;return{currentRoundIndex,currentDealerIdx,currentTurn,fullDeck,playerHands,playerRivers,playerMelds,playerScores,lastDiscardedTile,lastDiscarderIdx,drawnTile,secondsLeft,timeBank,actionSecondsLeft,isActionPhase,isDiscardable,pendingCalls:mpPendingCalls,roundActive,roundEnding,roomPlayers:mp.room?.players||[],aiSeats:[...aiSeats],playerAvatars:[...playerAvatars],actionContextId:activeCallId,remoteActions:activeRemoteActions,actionFeedback:activeActionFeedback,historyRounds:mpHistoryRounds.slice(0,4),historyMatchId:mpHistoryMatchId,historyMatch:mpHistoryCompletedMatch,...extra}}
function mpBroadcastState(extra={}){const state=mpStateSnapshot(extra);if(isMultiplayerMode&&mp.host){mpSaveActiveGameState(state);mpTouchSession()}if(isMultiplayerMode&&mp.host&&mp.connected)mpSend('state',{state})}
function mpApplyRemoteState(state){
  if(mp.host)return;
  if(!state||typeof state!=='object')return;
  const incomingSeq=Number(state._serverSeq)||0;
  if(incomingSeq&&incomingSeq<lastHostServerSeq)return;
  if(incomingSeq)lastHostServerSeq=incomingSeq;

  // A reconnected guest must remain in multiplayer mode.
  isMultiplayerMode=true;
  if(state.roundActive||state.roundEnding){
    mp.started=true;
    if(mp.room)mp.room.started=true;
  }
  if(mpRejoinMode){
    mpRejoinStateApplied=true;
    mpRejoinJoined=false;
    clearTimeout(mpRejoinHandshakeTimer);
    mpRejoinHandshakeTimer=null;
    clearTimeout(mpRejoinFallbackTimer);
    clearTimeout(mpRejoinModeTimer);
    mpRejoinMode=false;
    mpRejoinFallbackState=null;
  }
  const previousRemoteRoundIndex=currentRoundIndex;
  const incomingRemoteRoundIndex=Number(state.currentRoundIndex??0);

  mp.state=state;
  mp.seat=mp.seat??0;

  playerScores=state.playerScores||playerScores;
  fullDeck=state.fullDeck||[];
  playerHands=state.playerHands||playerHands;
  playerRivers=state.playerRivers||playerRivers;
  playerMelds=state.playerMelds||playerMelds;
  currentRoundIndex=incomingRemoteRoundIndex;
  if(state.roundActive&&incomingRemoteRoundIndex>previousRemoteRoundIndex){
    showRoundTransition();
  }
  currentDealerIdx=state.currentDealerIdx??currentDealerIdx;
  currentTurn=state.currentTurn??0;
  lastDiscardedTile=state.lastDiscardedTile||null;
  lastDiscarderIdx=state.lastDiscarderIdx??-1;
  drawnTile=state.drawnTile||null;
  secondsLeft=state.secondsLeft??secondsLeft;
  if(Array.isArray(state.timeBank))timeBank=state.timeBank;
  actionSecondsLeft=state.actionSecondsLeft??actionSecondsLeft;
  roundActive=!!state.roundActive;
  roundEnding=!!state.roundEnding;
  activeCallId=state.actionContextId||state.remoteActions?.callId||null;

  const remoteTimer=state.remoteTimer||null;

  aiSeats=new Set(state.aiSeats||[]);
  if(Array.isArray(state.playerAvatars)&&state.playerAvatars.length===4){
    playerAvatars=state.playerAvatars.slice();
  }
  if(state.roomPlayers){
    mp.room={...(mp.room||{}),players:state.roomPlayers};
    syncHumanAvatars(mp.room);
    renderPlayerConnectionStatus(mp.room);
  }

  nav('screen-game');
  gameChatRefreshVisibility();
  if(state.roundActive||state.roundEnding)setDisplay('modal-lobby','none');
  if(state.roundActive){setDisplay('modal-result','none');setDisplay('modal-match-over','none');}

  // Rebuild the guest's local control state from the synchronized table.
  const remoteCallId=state.remoteActions?.callId||null;
  stateHasRemoteCallForLocalGuest=!!(
    remoteCallId&&
    state.remoteActions?.seat===(mp.seat??0)&&
    Array.isArray(state.remoteActions.actions)&&
    state.remoteActions.actions.length&&
    (!state.actionContextId||state.actionContextId===remoteCallId)
  );
  isDiscardable=
    roundActive&&
    !roundEnding&&
    currentTurn===(mp.seat??0)&&
    !stateHasRemoteCallForLocalGuest;

  renderTable();
  if(remoteTimer){
    const timerValue=remoteTimer.isActionPhase
      ?Math.max(0,remoteTimer.actionSeconds??0)
      :Math.max(0,(remoteTimer.baseTime??0)>0?remoteTimer.baseTime:(remoteTimer.timeBank??0));
    renderLocalTurnTimer(timerValue,remoteTimer.seat);
  }else{
    renderLocalTurnTimer(secondsLeft,currentTurn);
  }
  mpTouchSession();

  const feedbackActive=!!(state.actionFeedback?.id&&Math.max(0,(Number(state.actionFeedback.duration)||0)-((Date.now()-(Number(state.actionFeedback.startedAt)||Date.now()))))>0);
  if(feedbackActive){
    isDiscardable=false;
    isActionPhase=false;
    hideAvailableActions();
    restoreRemoteActionFeedback(state.actionFeedback);
  }else if(!state.actionFeedback&&lastActionFeedbackId){
    lastActionFeedbackId='';
    clearTimeout(actionFeedbackTimer);actionFeedbackTimer=null;
    
    clearActionAnnouncement();
  }

  if(mpPendingGuestAction){
    const localActionStillOpen=
      state.remoteActions?.callId===activeCallId&&
      state.remoteActions?.seat===(mp.seat??0)&&
      Array.isArray(state.remoteActions.actions)&&
      state.remoteActions.actions.length;
    const localTurnStillActive=
      currentTurn===(mp.seat??0)&&
      roundActive&&
      !roundEnding;
    if(!localActionStillOpen&&!localTurnStillActive)clearGuestActionRetry();
  }

  if(!feedbackActive&&
    state.remoteActions?.callId===activeCallId&&
    state.remoteActions?.seat===(mp.seat??0)&&
    Array.isArray(state.remoteActions.actions)&&
    state.remoteActions.actions.length
  ){
    isDiscardable=false;
    showAvailableActions(state.remoteActions.actions,state.remoteActions.callId);
    setText('hand-status-main','Aksi tersedia');
    setText('hand-status-sub','Pilih aksi sebelum waktu habis.');
  }else if(!feedbackActive&&currentTurn===(mp.seat??0)&&roundActive){
    // Reconnect can happen during a normal turn without a fresh startGame
    // message. Recreate the same Tsumo/Kan controls the player would have had.
    const turnActions=[];
    const win=checkCurrentWin(mp.seat,null,true);
    if(win?.valid)turnActions.push('Tsumo');
    if(getSelfKanOptions(mp.seat).length)turnActions.push('Kan');

    hideAvailableActions();

    if(turnActions.length){
      showAvailableActions(turnActions,activeCallId);
      setText('hand-status-main','Giliran Anda');
      setText('hand-status-sub','Pilih aksi atau tile untuk dibuang.');
    }else{
      isDiscardable=true;
      setText('hand-status-main','Giliran Anda');
      setText('hand-status-sub','Pilih tile untuk membuang.');
    }
  }else{
    hideAvailableActions();
  }

  if(state.roundActive&&state.currentRoundIndex===0&&!mpHistoryMatchStartedAt)mpHistoryMatchStartedAt=Date.now();
  if(state.phase==='matchFinished'&&state.result){
    const finish=()=>{renderResultModal(state.result.title,state.result.desc,state.result);setTimeout(()=>leaveFinishedRoom(),500)};
    historyPersistRemoteState(state).finally(finish);
  }else{
    historyPersistRemoteState(state).catch(()=>{});
    if(state.phase==='result'&&state.result){
      renderResultModal(state.result.title,state.result.desc,state.result);
    }
  }
}
function roomCanAct(seat){return !!(mp.room?.players?.[seat] || seat===mp.seat || (mp.host&&seat===0))}
function mpHandlePlayerAction(seat,action){
  if(!mp.host||!roundActive||!roomCanAct(seat))return;
  if(!action||typeof action!=='object')return;

  const incomingCallId=String(action.callId||'').trim();
  const actionId=String(action.actionId||'').trim();

  if(action.type==='discard'){
    // A discard must belong to this player's current turn context.
    if(!incomingCallId||incomingCallId!==activeCallId||!String(activeCallId).startsWith('TURN-'))return;
    if(actionId&&!rememberMpAction(seat,actionId))return;

    const i=playerHands[seat].findIndex(
      t=>t.uniqueId===action.uniqueId
    );

    if(i>=0&&currentTurn===seat&&roundActive){
      const t=playerHands[seat].splice(i,1)[0];
      isDiscardable=false;
      commitDiscard(seat,t);
    }
    return;
  }

  if(action.type!=='call')return;

  if(!incomingCallId||incomingCallId!==activeCallId)return;
  if(actionId&&!rememberMpAction(seat,actionId))return;

  const a=action.action;

  // Tsumo is a normal turn action.
  if(a==='Tsumo'&&seat===currentTurn){
    const e=checkCurrentWin(seat,null,true);
    if(e?.valid){
      stopCallWindow();
      resolveWin(seat,e,true);
    }
    return;
  }

  // Self-Kan is also a normal turn action and does not belong to
  // mpPendingCalls (which is reserved for discard calls).
  if(a==='Kan'&&seat===currentTurn&&String(activeCallId).startsWith('TURN-')){
    const options=getSelfKanOptions(seat);
    const opt=options[0];
    if(opt){
      stopCallWindow();
      executeSelfKan(seat,opt);
    }
    return;
  }

  const q=mpPendingCalls.find(x=>x.seat===seat&&x.callId===incomingCallId);
  if(!q)return;

  if(a==='Skip'){
    mpPendingCalls=mpPendingCalls.filter(x=>x!==q);
    if(mpPendingCalls.length)promptNextCall();
    else finishCallWindow();
    return;
  }

  const act=q.actions.find(x=>x.type===a);
  if(!act)return;

  // Chi must use the exact combination selected by the guest.
  if(a==='Chi'){
    const combo=Array.isArray(action.combo)?action.combo:null;
    if(!combo||combo.length!==3)return;
    if(!Array.isArray(act.combos))return;

    const validCombo=act.combos.some(
      c=>Array.isArray(c)&&
         c.length===combo.length&&
         c.every((n,i)=>n===combo[i])
    );

    if(!validCombo)return;

    pendingCallChoice={
      seat,
      action:{type:'Chi',combo:[...combo],callId:incomingCallId}
    };
  }else{
    pendingCallChoice={seat,action:{...act,callId:incomingCallId}};
  }

  const best=highestPendingCall();
  const chosen=pendingCallChoice.action;

  if(!best||callPriority(chosen)>=callPriority(best.action)){
    resolveCallChoice(seat,chosen);
  }
}
function mpTapRemoteDiscard(t){
  if(!t)return;
  queueGuestAction({type:'discard',uniqueId:t.uniqueId,callId:activeCallId,actionId:nextMpActionId('DISCARD')});
}
function mpCopyRoomInfo(){mpCopyRoomLink()}
function mpReconnect(){
  const saved=mpLoadSession();
  if(!saved?.room){
    setText('mp-reconnect-text','Tidak ada sesi room tersimpan.');
    return false;
  }
  return mpBeginReconnect(saved);
}
window.mpConnect=mpConnect;window.mpSend=mpSend;window.openPlayerLobby=openPlayerLobby;window.mpCreateRoom=mpCreateRoom;window.mpJoinRoom=mpJoinRoom;window.togglePlayerReady=togglePlayerReady;window.mpStartGame=mpStartGame;window.closeLobby=closeLobby;window.mpCopyRoomLink=mpCopyRoomLink;window.mpCopyRoomInfo=mpCopyRoomInfo;

function forceFreshReload(){
  const btn=document.getElementById('btn-cache-refresh');
  if(btn){btn.disabled=true;btn.textContent='↻';btn.style.opacity='.55'}
  // Hanya bersihkan Cache Storage milik browser/service worker.
  // localStorage dan IndexedDB TIDAK disentuh agar settings, session, dan History tetap aman.
  const clearCaches=(async()=>{
    try{
      if(window.caches){
        const keys=await caches.keys();
        await Promise.all(keys.map(k=>caches.delete(k)));
      }
    }catch(e){}
  })();
  const sep=location.pathname.includes('?')?'&':'?';
  const freshUrl=location.pathname+sep+'v='+Date.now()+location.hash;
  clearCaches.finally(()=>{ location.replace(freshUrl); });
}

document.addEventListener('DOMContentLoaded',()=>{syncProfileNameToInputs();applyCustomizeStyle();applyCenterFrameSelection();renderCustomizeProfile()},{once:true});
