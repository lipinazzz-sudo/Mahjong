
(function(){
"use strict";
var STARTING_CHIPS=400000,START_MIN=5000;
var players=[],deck=[],pot=0,round=1,minBet=START_MIN,maxBet=40000;
var phase="idle",currentBet=0,lastActorIndex=-1,actingIndex=-1;
var settingsReturnTo="screen-main",gameStarted=false,tournamentSessionId=String(Date.now());
var selectedIndexes=[],userChosenCombo=null,lastResult=null,handEnded=false,log=[];
var $=function(id){return document.getElementById(id);};
var fmt=function(n){return new Intl.NumberFormat("id-ID").format(Math.max(0,Math.floor(n)));};
var liveHandPlayers=function(){return players.filter(function(p){return p.inHand&&!p.folded&&p.chips>=0;});};
var liveTournamentPlayers=function(){return players.filter(function(p){return p.chips>0;});};
var userPlayer=function(){return players.find(function(p){return p.human;});};
var stageTitles={buy5:"Taruhan untuk membeli kartu ke-5",betShow:"Taruhan terakhir setelah Show"};
var stageHints={buy5:"Anda sudah menerima 4 kartu. Ikut atau naikkan taruhan untuk membeli kartu ke-5. Jika tidak ikut, Anda Fold.",betShow:"Tiga kartu pilihan sudah di-Show. Ini ronde taruhan terakhir sebelum nilai dua kartu sisanya dibandingkan."};

function createDeck(){
 var d=[];
 for(var a=0;a<=6;a++)for(var b=a;b<=6;b++)d.push({a:a,b:b,id:a+"-"+b});
 for(var i=d.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),tmp=d[i];d[i]=d[j];d[j]=tmp;}
 return d;
}
function scoreTile(t){return t.a===0&&t.b===0?10:t.a+t.b;}
function tileRaw(t){return t.a+t.b;}
function pipPositions(v){
 var map={0:[],1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,3,6,2,5,8]};
 return map[v]||[];
}
function buildHalf(v){
 var half=document.createElement("span");half.className="pip-half";half.setAttribute("aria-hidden","true");
 var positions=pipPositions(v);
 for(var i=0;i<9;i++){var dot=document.createElement("span");dot.className="pip"+(positions.indexOf(i)>=0?" on":"");half.appendChild(dot);}
 return half;
}
function buildMiniTile(tile){
 var mini=document.createElement("span");mini.className="opponent-reveal-card";mini.setAttribute("aria-label","Kartu domino "+tile.a+" dan "+tile.b);
 var face=document.createElement("span");face.className="domino-face";face.append(buildHalf(tile.a),buildHalf(tile.b));mini.appendChild(face);return mini;
}
function buildCardButton(tile,index,selected,clickable){
 var btn=document.createElement("button");btn.type="button";btn.className="domino-card"+(selected?" selected":"")+(clickable?" selectable":"")+(tile.a===tile.b?" special-tile":"");
 btn.setAttribute("aria-label","Kartu domino "+tile.a+" dan "+tile.b+(selected?", dipilih":""));
 btn.setAttribute("aria-pressed",selected?"true":"false");
 if(!clickable)btn.tabIndex=-1;
 var face=document.createElement("span");face.className="domino-face";face.append(buildHalf(tile.a),buildHalf(tile.b));btn.appendChild(face);
 // Pip faces carry the tile value; no redundant micro-label beneath each domino.
 if(clickable)btn.addEventListener("click",function(){toggleSelected(index);});
 else btn.disabled=true;
 return btn;
}
function hasValidTriple(hand){
 return validCombinations(hand).length>0;
}
function validCombinations(hand){
 var out=[];
 for(var i=0;i<hand.length;i++)for(var j=i+1;j<hand.length;j++)for(var k=j+1;k<hand.length;k++){
  var sum=scoreTile(hand[i])+scoreTile(hand[j])+scoreTile(hand[k]);
  if(sum===10||sum===20||sum===30)out.push({indexes:[i,j,k],sum:sum});
 }
 return out;
}
function pairScore(two){
 if(!two||two.length!==2)return {rank:-1,total:0,special:false,label:"Tidak valid"};
 var special=(two.some(function(t){return t.a===5&&t.b===5;})&&two.some(function(t){return t.a===0&&t.b===0;}));
 var total=scoreTile(two[0])+scoreTile(two[1]),digit=total%10,rank=digit===0?10:digit;
 if(special)return {rank:100,total:total,special:true,label:"KOMBINASI SPESIAL 5/5 + 0/0"};
 var names={10:"0",9:"9",8:"8",7:"7",6:"6",5:"5",4:"4",3:"3",2:"2",1:"1"};
 return {rank:rank,total:total,special:false,label:"Nilai "+names[rank]+" (total "+total+")"};
}
function compareScore(a,b){
 if(a.rank!==b.rank)return a.rank>b.rank?1:-1;
 if(a.total!==b.total)return a.total>b.total?1:-1;
 return 0;
}
function bestBotCombo(hand){
 var combos=validCombinations(hand),best=null;
 combos.forEach(function(c){
  var remain=hand.filter(function(t,index){return c.indexes.indexOf(index)<0;});
  var score=pairScore(remain);
  if(!best||compareScore(score,best.score)>0)best={indexes:c.indexes.slice(),sum:c.sum,pair:remain,score:score};
 });
 return best;
}
function sgStorageGet(key,fallback){try{var v=localStorage.getItem(key);return v===null?fallback:v;}catch(e){return fallback;}}
function sgStorageSet(key,value){try{localStorage.setItem(key,String(value));}catch(e){}}
function sgReadProfile(){return {name:(sgStorageGet("sg_profile_name","Player").trim()||"Player").slice(0,20),avatar:sgStorageGet("sg_profile_avatar","🐂")};}
function sgReadSettings(){return {music:Number(sgStorageGet("sg_music_volume","30")),sfx:Number(sgStorageGet("sg_sfx_volume","50")),muted:sgStorageGet("sg_audio_muted","0")==="1",confirm:sgStorageGet("sg_confirm_bets","1")!=="0"};}
function sgShowScreen(id){
 document.querySelectorAll(".page-screen").forEach(function(n){n.classList.remove("active");});
 var target=$(id);if(target)target.classList.add("active");
 var game=$("screen-game");if(game)game.classList.toggle("active",id==="screen-game");
 if(id!=="screen-game")hidePrompt();
 if(id==="screen-main")sgRenderHome();
 if(id==="screen-settings")sgRenderSettings();
 if(id==="screen-game"&&gameStarted)sgRestorePrompt();
}
function sgRestorePrompt(){
 var p=userPlayer();
 if(!p)return;
 if(["buy5","betShow"].indexOf(phase)>=0&&actingIndex>=0&&players[actingIndex]&&players[actingIndex].human){promptBetting(players[actingIndex]);return;}
 if(phase==="show"&&!p.folded){
  var count=validCombinations(p.hand).length;
  showPrompt("RONDE "+round+" · SHOWDOWN","Pilih 3 kartu untuk Show","Pilih sendiri tepat 3 dari 5 kartu. Total nilai ketiganya harus tepat 10, 20, atau 30.",[
   {label:"Show kartu terpilih",click:function(){showSelectedCards();},disabled:true},
   {label:"Fold",kind:"danger",click:function(){p.folded=true;pushLog("Anda · Fold saat Show");renderAll();hidePrompt();if(activeCount()<=1)awardLastPlayer();else beginBettingStage("betShow");}}
  ],"Kombinasi valid ditemukan",String(count));
  updateShowPrompt();return;
 }
 if(phase==="result"&&lastResult){showResultPrompt();return;}
 if(phase==="tournamentOver"){endTournament(liveTournamentPlayers()[0]||null);}
}
function sgOpenModal(id){
 var modal=$(id);if(modal){modal.classList.add("active");modal.dataset.open="1";}
 if(id==="sgHistoryModal")sgRenderHistory();
 if(id==="sgStatsModal")sgRenderStats();
 if(id==="sgProfileModal")sgRenderProfileForm();
}
function sgCloseModal(id){var m=$(id);if(m){m.classList.remove("active");delete m.dataset.open;}}
function sgOpenMessage(title,message){$("sgMessageTitle").textContent=title;$("sgMessageBody").textContent=message;sgOpenModal("sgMessageModal");}
function sgRenderHome(){
 var p=sgReadProfile();$("sgProfileName").textContent=p.name;$("sgProfileAvatar").textContent=p.avatar;
 var rounds=[];try{rounds=JSON.parse(sgStorageGet("sg_history","[]"));if(!Array.isArray(rounds))rounds=[];}catch(e){}
 $("sgStatRounds").textContent=rounds.length;
}
function sgRenderProfileForm(){
 var p=sgReadProfile();$("sgNameInput").value=p.name;$("sgAvatarCaption").textContent=p.avatar;
 document.querySelectorAll(".avatar-choice").forEach(function(b){b.classList.toggle("selected",b.dataset.avatar===p.avatar);});
}
function sgRenderSettings(){
 var s=sgReadSettings();$("sgMusicVolume").value=String(s.music);$("sgMusicValue").textContent=s.music+"%";$("sgSfxVolume").value=String(s.sfx);$("sgSfxValue").textContent=s.sfx+"%";
 $("sgAudioToggle").textContent=s.muted?"OFF":"ON";$("sgAudioCaption").textContent=s.muted?"Dimatikan":"Aktif";
 $("sgConfirmToggle").textContent=s.confirm?"ON":"OFF";$("sgConfirmCaption").textContent=s.confirm?"Aktif":"Nonaktif";
}
function sgRenderHistory(){
 var host=$("sgHistoryList");host.replaceChildren();var rows=[];
 try{rows=JSON.parse(sgStorageGet("sg_history","[]"));if(!Array.isArray(rows))rows=[];}catch(e){rows=[];}
 if(!rows.length){var empty=document.createElement("div");empty.className="empty-history";empty.textContent="Belum ada ronde yang selesai. Hasil berikutnya akan dicatat di sini.";host.appendChild(empty);return;}
 rows.slice(0,30).forEach(function(item){
  var row=document.createElement("div");row.className="history-entry";
  var left=document.createElement("div"),title=document.createElement("strong"),sub=document.createElement("span"),amount=document.createElement("em");
  title.textContent="Ronde "+item.round+" · "+item.result;sub.textContent=(item.date||"")+" · "+(item.winners||[]).join(", ")+" · Saldo: "+fmt(item.chips||0);amount.textContent=fmt(item.pot||0);
  left.append(title,sub);row.append(left,amount);host.appendChild(row);
 });
}
function sgRenderStats(){
 var stats={};try{stats=JSON.parse(sgStorageGet("sg_stats","{}"))||{};}catch(e){}
 $("sgStatRounds").textContent=fmt(stats.rounds||0);$("sgStatWins").textContent=fmt(stats.wins||0);$("sgStatChips").textContent=fmt(stats.chipsWon||0);$("sgStatTournaments").textContent=fmt(stats.tournaments||0);
}
function sgLogHistory(){
 if(!lastResult||lastResult.logged)return;
 var p=userPlayer(),userWon=lastResult.winners.indexOf(p?p.name:"")>=0,won= userWon ? lastResult.amount : 0;
 var rows=[];try{rows=JSON.parse(sgStorageGet("sg_history","[]"));if(!Array.isArray(rows))rows=[];}catch(e){rows=[];}
 rows.unshift({round:round,date:new Date().toLocaleString("id-ID"),winners:lastResult.winners.slice(),pot:lastResult.amount,result:userWon?"Menang":"Kalah",chips:p?p.chips:0});
 sgStorageSet("sg_history",JSON.stringify(rows.slice(0,100)));
 var stats={};try{stats=JSON.parse(sgStorageGet("sg_stats","{}"))||{};}catch(e){}
 stats.rounds=(stats.rounds||0)+1;stats.wins=(stats.wins||0)+(userWon?1:0);stats.chipsWon=(stats.chipsWon||0)+won;sgStorageSet("sg_stats",JSON.stringify(stats));
 lastResult.logged=true;
}
function sgSaveTournamentWin(champion){
 if(!champion||!champion.human||sgStorageGet("sg_tournament_saved_id","")===tournamentSessionId)return;
 var stats={};try{stats=JSON.parse(sgStorageGet("sg_stats","{}"))||{};}catch(e){}
 stats.tournaments=(stats.tournaments||0)+1;sgStorageSet("sg_stats",JSON.stringify(stats));sgStorageSet("sg_tournament_saved_id",tournamentSessionId);
}
function sgRenderPlayerIdentity(){
 var p=userPlayer();if(!p)return;
 var profile=sgReadProfile();p.name=profile.name;p.letter=profile.avatar;
 var seat=document.querySelector('.seat[data-player="A"]');if(seat){seat.querySelector(".avatar").textContent=profile.avatar;seat.querySelector(".seat-name").textContent=profile.name;}
 sgRenderHome();
}
function sgNewTournament(){
 tournamentSessionId=String(Date.now())+"-"+String(Math.random()).slice(2);
 gameStarted=false;round=1;makePlayers();phase="idle";selectedIndexes=[];log=[];sgShowScreen("screen-game");gameStarted=true;startHand(true);
}
function sgReturnToLobby(){
 if(phase!=="idle"&&phase!=="result"&&phase!=="tournamentOver"){
  sgOpenMessage("Keluar ke lobby?","Ronde yang sedang berjalan akan dihentikan. Chip turnamen saat ini tidak dilanjutkan jika Anda memulai permainan baru.");
 }
 sgShowScreen("screen-main");
}
function sgSaveCurrentProfile(){
 var name=$("sgNameInput").value.trim().slice(0,20)||"Player";var chosen=document.querySelector(".avatar-choice.selected");var avatar=chosen?chosen.dataset.avatar:"🐂";
 sgStorageSet("sg_profile_name",name);sgStorageSet("sg_profile_avatar",avatar);sgCloseModal("sgProfileModal");sgRenderPlayerIdentity();renderSeats();sgRenderHome();
}
function sgWireNavigation(){
 $("sgProfileOpen").addEventListener("click",function(){sgOpenModal("sgProfileModal");});
 $("sgHistoryOpen").addEventListener("click",function(){sgOpenModal("sgHistoryModal");});
 $("sgStatsOpen").addEventListener("click",function(){sgOpenModal("sgStatsModal");});
 $("sgInfoOpen").addEventListener("click",function(){sgOpenModal("sgInfoModal");});
 $("sgInfoOpenBottom").addEventListener("click",function(){sgOpenModal("sgInfoModal");});
 $("sgSettingsOpen").addEventListener("click",function(){settingsReturnTo="screen-main";sgShowScreen("screen-settings");});
 $("sgPlayOpen").addEventListener("click",function(){sgShowScreen("screen-play");});
 $("sgPlayBack").addEventListener("click",function(){sgShowScreen("screen-main");});
 $("sgSettingsBack").addEventListener("click",function(){sgShowScreen(settingsReturnTo||"screen-main");});
 $("sgSettingsInfo").addEventListener("click",function(){sgOpenModal("sgInfoModal");});
 $("sgVsBot").addEventListener("click",sgNewTournament);
 $("sgMultiplayer").addEventListener("click",function(){sgOpenMessage("Multiplayer belum tersedia","Prototype saat ini berisi permainan melawan empat bot. Mode multiplayer akan dikembangkan terpisah setelah alur kartu dan taruhan stabil.");});
 $("sgRefresh").addEventListener("click",function(){window.location.reload();});
 $("sgInGameSettings").addEventListener("click",function(){settingsReturnTo="screen-game";sgShowScreen("screen-settings");});
 $("sgLeaveGame").addEventListener("click",sgReturnToLobby);
 $("sgMusicVolume").addEventListener("input",function(){sgStorageSet("sg_music_volume",this.value);$("sgMusicValue").textContent=this.value+"%";});
 $("sgSfxVolume").addEventListener("input",function(){sgStorageSet("sg_sfx_volume",this.value);$("sgSfxValue").textContent=this.value+"%";});
 $("sgAudioToggle").addEventListener("click",function(){var s=sgReadSettings();sgStorageSet("sg_audio_muted",s.muted?"0":"1");sgRenderSettings();});
 $("sgConfirmToggle").addEventListener("click",function(){var s=sgReadSettings();sgStorageSet("sg_confirm_bets",s.confirm?"0":"1");sgRenderSettings();});
 $("sgSettingsSave").addEventListener("click",function(){sgStorageSet("sg_music_volume",$("sgMusicVolume").value);sgStorageSet("sg_sfx_volume",$("sgSfxVolume").value);sgCloseModal("sgMessageModal");sgOpenMessage("Pengaturan tersimpan","Preferensi Sapi/Gu telah disimpan di perangkat ini. Audio akan aktif setelah aset audio khusus ditambahkan.");});
 $("sgProfileForm").addEventListener("submit",function(e){e.preventDefault();sgSaveCurrentProfile();});
 $("sgAvatarChoices").addEventListener("click",function(e){var b=e.target.closest(".avatar-choice");if(!b)return;document.querySelectorAll(".avatar-choice").forEach(function(n){n.classList.toggle("selected",n===b);});$("sgAvatarCaption").textContent=b.dataset.avatar;});
 $("sgClearHistory").addEventListener("click",function(){sgStorageSet("sg_history","[]");sgRenderHistory();});
 document.querySelectorAll("[data-close-modal]").forEach(function(b){b.addEventListener("click",function(){sgCloseModal(b.dataset.closeModal);});});
 document.querySelectorAll(".sg-modal").forEach(function(m){m.addEventListener("click",function(e){if(e.target===m)sgCloseModal(m.id);});});
 document.addEventListener("keydown",function(e){if(e.key==="Escape")document.querySelectorAll(".sg-modal.active").forEach(function(m){sgCloseModal(m.id);});});
}
function makePlayers(){
 players=[
  {id:"A",name:sgReadProfile().name,letter:sgReadProfile().avatar,human:true,chips:STARTING_CHIPS,hand:[],inHand:true,folded:false,stageBet:0,actedAtBet:0,reveal:false,combo:null,invalidShow:false},
  {id:"B",name:"Pemain B",letter:"B",human:false,chips:STARTING_CHIPS,hand:[],inHand:true,folded:false,stageBet:0,actedAtBet:0,reveal:false,combo:null,invalidShow:false},
  {id:"C",name:"Pemain C",letter:"C",human:false,chips:STARTING_CHIPS,hand:[],inHand:true,folded:false,stageBet:0,actedAtBet:0,reveal:false,combo:null,invalidShow:false},
  {id:"D",name:"Pemain D",letter:"D",human:false,chips:STARTING_CHIPS,hand:[],inHand:true,folded:false,stageBet:0,actedAtBet:0,reveal:false,combo:null,invalidShow:false},
  {id:"E",name:"Pemain E",letter:"E",human:false,chips:STARTING_CHIPS,hand:[],inHand:true,folded:false,stageBet:0,actedAtBet:0,reveal:false,combo:null,invalidShow:false}
 ];
}
function pushLog(text,amount){
 log.unshift({text:text,amount:amount===undefined?null:amount});
 if(log.length>8)log.length=8;
}
function renderPot(){
 $("potValue").textContent=fmt(pot);
 $("potSub").textContent=pot===0?(phase==="result"?"Pot sudah dibagikan":"Belum ada taruhan"):("Chip virtual terkumpul");
 var host=$("potChips");host.replaceChildren();
 var count=Math.min(12,Math.ceil(pot/Math.max(minBet,1)));
 for(var i=0;i<count;i++){var c=document.createElement("span");c.className="chip";c.setAttribute("aria-hidden","true");host.appendChild(c);}
}
function renderSeats(){
 document.querySelectorAll(".seat[data-player]").forEach(function(node){
  var p=players.find(function(x){return x.id===node.dataset.player;});if(!p)return;
  node.classList.toggle("folded",p.folded);
  node.classList.toggle("eliminated",p.chips<=0);
  node.classList.toggle("current",actingIndex>=0&&players[actingIndex]&&players[actingIndex].id===p.id&&phase!=="result");
  var state=node.querySelector(".seat-state");
  if(p.chips<=0)state.textContent="Kehabisan chip";
  else if(p.folded)state.textContent="FOLD";
  else if(p.human)state.textContent=phase==="show"?"Pilih 3 kartu":"Anda";
  else if(p.inHand)state.textContent=phase==="show"&&p.combo?"Siap Show":"Bermain";
  else state.textContent="Menunggu";
  var stack=node.querySelector(".seat-stack");if(stack)stack.textContent=fmt(p.chips);
 });
 players.filter(function(p){return !p.human;}).forEach(function(p){
  var host=document.querySelector('[data-hand="'+p.id+'"]');if(!host)return;host.replaceChildren();
  if(p.chips<=0||(p.folded&&phase!=="result"&&!(phase==="betShow"&&p.combo&&p.combo.indexes)))return;
  var n=p.hand.length;
  if(p.reveal&&phase==="result"){
   p.hand.forEach(function(tile){host.appendChild(buildMiniTile(tile));});
  }else if((phase==="betShow"||phase==="result")&&p.combo&&p.combo.indexes){
   p.hand.forEach(function(tile,index){
    if(p.combo.indexes.indexOf(index)>=0)host.appendChild(buildMiniTile(tile));
    else{var back=document.createElement("span");back.className="card-back";back.setAttribute("aria-hidden","true");host.appendChild(back);}
   });
  }else{
   for(var i=0;i<n;i++){var back=document.createElement("span");back.className="card-back";back.setAttribute("aria-hidden","true");host.appendChild(back);}
  }
 });
}
function renderHand(){
 var host=$("playerHand");host.replaceChildren();
 var p=userPlayer();if(!p)return;
 var selectable=phase==="show"&&!p.folded&&p.hand.length===5;
 var visibleSelection=phase==="betShow"&&p.combo&&p.combo.indexes?p.combo.indexes:[];
 p.hand.forEach(function(tile,index){
  var selected=selectable?selectedIndexes.indexOf(index)>=0:visibleSelection.indexOf(index)>=0;
  var btn=buildCardButton(tile,index,selected,selectable);
  host.appendChild(btn);
 });
 if(selectable){
  var sum=selectedIndexes.reduce(function(s,index){return s+scoreTile(p.hand[index]);},0);
  $("handHelp").textContent=selectedIndexes.length===0?"Pilih 3 kartu yang jumlah nilainya 10, 20, atau 30":("Pilihan: "+selectedIndexes.length+"/3 kartu · Total "+sum);
 }else if(phase==="result"){
  $("handHelp").textContent="";
 }else{
  $("handHelp").textContent=p.hand.length?(p.hand.length+" kartu Anda"):"";
 }
}
function renderAll(){
 renderPot();renderSeats();renderHand();
 $("tablePhase").textContent=phaseLabel();
 $("tableCaption").textContent="Ronde "+round+" · Minimum "+fmt(minBet)+" / Maksimum "+fmt(maxBet);
 $("youStack").textContent=fmt(userPlayer()?userPlayer().chips:0);
}
function phaseLabel(){
 if(phase==="buy5")return "Taruhan · Beli Kartu ke-5";
 if(phase==="show")return "Showdown · Pilih 3 Kartu";
 if(phase==="betShow")return "Taruhan Terakhir · Setelah Show";
 if(phase==="result")return "Hasil Ronde";
 if(phase==="tournamentOver")return "Pemenang Turnamen";
 return "Meja Sapi / Gu";
}
function hidePrompt(){$("actionPrompt").classList.remove("visible");}
function showPrompt(kicker,title,message,buttons,footLeft,footRight){
 $("promptKicker").textContent=kicker||"Giliran Anda";
 $("promptTitle").textContent=title||"";
 $("promptMessage").textContent=message||"";
 var host=$("promptActions");host.replaceChildren();
 buttons.forEach(function(b){
  var btn=document.createElement("button");btn.type="button";btn.className="prompt-button"+(b.kind?" "+b.kind:"");btn.textContent=b.label;btn.disabled=!!b.disabled;
  btn.addEventListener("click",b.click);host.appendChild(btn);
 });
 $("promptFootLeft").textContent=footLeft||"Chip virtual";
 $("promptFootRight").textContent=footRight||"";
 $("actionPrompt").classList.add("visible");
}
function amountText(v){return fmt(v)+" chip";}
function promptBetting(p){
 var need=currentBet-p.stageBet;
 var canCall=p.chips>=need&&need>=0;
 var nextRaise=Math.min(currentBet*2,maxBet);
 var canRaise=nextRaise>currentBet&&(nextRaise-p.stageBet)<=p.chips;
 var title=stageTitles[phase]||"Taruhan";
 var message=(stageHints[phase]||"Ikut taruhan atau Fold.")+" Taruhan saat ini "+fmt(currentBet)+". Saldo Anda "+fmt(p.chips)+".";
 var callLabel=phase==="buy5"?"Beli kartu ke-5 · "+fmt(need):(phase==="betShow"?"Ikut taruhan terakhir · "+fmt(need):"Ikut taruhan · "+fmt(need));
 var buttons=[
  {label:(canCall?callLabel:"Chip tidak cukup"),disabled:!canCall,click:function(){humanAction("call");}},
 ];
 if(canRaise)buttons.push({label:"Raise ke "+fmt(nextRaise),click:function(){humanAction("raise");}});
 buttons.push({label:"Fold",kind:"danger",click:function(){humanAction("fold");}});
 showPrompt("RONDE "+round+" · GILIRAN ANDA",title,message,buttons,"Pot saat ini",fmt(pot));
}
function dealToActive(count){
 for(var c=0;c<count;c++){
  players.forEach(function(p){
   if(p.inHand&&!p.folded&&p.chips>0&&deck.length)p.hand.push(deck.pop());
  });
 }
}
function startHand(initial){
 var alive=liveTournamentPlayers();
 if(alive.length<=1){endTournament(alive[0]||null);return;}
 if(!initial)round++;
 minBet=START_MIN*Math.pow(2,Math.floor((round-1)/10));
 maxBet=minBet*8;
 deck=createDeck();pot=0;selectedIndexes=[];userChosenCombo=null;lastResult=null;handEnded=false;

 // Reset round state and collect the mandatory ante before cards are dealt.
 players.forEach(function(p){
  p.hand=[];p.folded=false;p.inHand=p.chips>0;p.stageBet=0;p.actedAtBet=0;p.reveal=false;p.combo=null;p.invalidShow=false;
 });
 players.forEach(function(p){
  if(!p.inHand||p.chips<=0)return;
  var ante=Math.min(minBet,p.chips);
  p.chips-=ante;pot+=ante;
  pushLog(p.name+" · ante",ante);
  if(p.chips===0){p.inHand=false;p.folded=true;}
 });

 // All active players get four cards before the first betting decision.
 dealToActive(4);
 phase="buy5";actingIndex=-1;lastActorIndex=-1;
 renderAll();
 if(liveHandPlayers().length<=1){awardLastPlayer();return;}
 beginBettingStage("buy5");
}
function beginBettingStage(key){
 phase=key;currentBet=minBet;lastActorIndex=-1;actingIndex=-1;selectedIndexes=[];
 players.forEach(function(p){p.stageBet=0;p.actedAtBet=0;});
 renderAll();driveBetting();
}
function needsAction(p){
 return p.inHand&&!p.folded&&p.chips>0&&(p.stageBet<currentBet||p.actedAtBet<currentBet);
}
function findNextActor(afterIndex){
 for(var step=1;step<=players.length;step++){
  var i=(afterIndex+step+players.length)%players.length;
  if(needsAction(players[i]))return i;
 }
 return -1;
}
function activeCount(){return liveHandPlayers().length;}
function driveBetting(){
 var guard=0;
 while(guard++<250){
  if(activeCount()<=1){actingIndex=-1;awardLastPlayer();return;}
  var next=findNextActor(lastActorIndex);
  if(next<0){actingIndex=-1;finishBettingStage();return;}
  actingIndex=next;var p=players[next];
  if(p.human){
   renderAll();promptBetting(p);return;
  }
  botAction(p);lastActorIndex=next;renderAll();
 }
 // Emergency guard: prevent a malformed or unexpected loop from locking the page.
 actingIndex=-1;
 showPrompt("SIMULASI","Putaran taruhan dihentikan","Sistem menghentikan perulangan untuk menjaga permainan tetap responsif.",[{label:"Lanjutkan",click:function(){hidePrompt();finishBettingStage();}}],"Pot",fmt(pot));
}
function payBet(p,target){
 var needed=target-p.stageBet;
 if(needed<0)needed=0;
 if(p.chips<needed)return false;
 p.chips-=needed;pot+=needed;p.stageBet=target;p.actedAtBet=currentBet;
 if(needed>0)pushLog(p.name+" · taruhan",needed);
 return true;
}
function botAction(p){
 var due=currentBet-p.stageBet;
 if(p.chips<due){p.folded=true;pushLog(p.name+" · Fold (chip tidak cukup)");return;}
 var raiseTo=Math.min(currentBet*2,maxBet);
 var canRaise=raiseTo>currentBet;
 var potPressure=currentBet/minBet;
 // Buying the fifth card happens while all active players still hold four cards.
 var valid=p.hand.length===5&&hasValidTriple(p.hand);
 var foldChance=0.12+(potPressure>=4?0.12:0)+(phase==="betShow"&&!valid?0.2:0);
 var raiseChance=canRaise?(0.27+(phase==="betShow"&&valid?0.08:0)-(potPressure>=4?0.12:0)):0;
 var r=Math.random();
 if(r<foldChance&&p.stageBet<currentBet){p.folded=true;pushLog(p.name+" · Fold");return;}
 if(canRaise&&r<foldChance+raiseChance&&p.chips>=raiseTo-p.stageBet){
  var amount=raiseTo-p.stageBet;
  p.chips-=amount;pot+=amount;p.stageBet=raiseTo;currentBet=raiseTo;p.actedAtBet=currentBet;
  pushLog(p.name+" · Raise ke "+fmt(raiseTo),amount);
  return;
 }
 if(!payBet(p,currentBet)){p.folded=true;pushLog(p.name+" · Fold (chip tidak cukup)");return;}
}
function humanAction(action,skipConfirmation){
 var p=userPlayer();if(!p||!needsAction(p)||actingIndex<0||players[actingIndex]!==p)return;
 if(!skipConfirmation&&(action==="call"||action==="raise")&&sgReadSettings().confirm){
  var target=action==="raise"?Math.min(currentBet*2,maxBet):currentBet;
  var amount=Math.max(0,target-p.stageBet);
  showPrompt("KONFIRMASI TARUHAN",action==="raise"?"Konfirmasi raise ke "+fmt(target):"Konfirmasi ikut taruhan","Anda akan menambahkan "+fmt(amount)+" chip ke pot. Saldo setelah aksi: "+fmt(p.chips-amount)+".",[
   {label:"Konfirmasi",click:function(){humanAction(action,true);}},
   {label:"Batal",kind:"secondary",click:function(){promptBetting(p);}}
  ],"Pot saat ini",fmt(pot));return;
 }
 hidePrompt();
 if(action==="fold"){
  p.folded=true;pushLog("Anda · Fold");p.actedAtBet=currentBet;
 }else if(action==="call"){
  if(!payBet(p,currentBet)){showPrompt("AKSI TIDAK TERSEDIA","Chip tidak cukup","Saldo Anda tidak mencukupi untuk menyamai taruhan ini.",[{label:"Fold",kind:"danger",click:function(){humanAction("fold");}}],"Saldo",fmt(p.chips));return;}
 }else if(action==="raise"){
  var target=Math.min(currentBet*2,maxBet),needed=target-p.stageBet;
  if(target<=currentBet||needed>p.chips){promptBetting(p);return;}
  p.chips-=needed;pot+=needed;p.stageBet=target;currentBet=target;p.actedAtBet=currentBet;
  pushLog("Anda · Raise ke "+fmt(target),needed);
 }
 lastActorIndex=players.indexOf(p);actingIndex=-1;renderAll();driveBetting();
}
function finishBettingStage(){
 if(activeCount()<=1){awardLastPlayer();return;}
 if(phase==="buy5"){
  dealToActive(1);
  pushLog("Kartu ke-5 dibagikan kepada pemain aktif");
  enterShowdown();
  return;
 }
 if(phase==="betShow"){resolveShowdown();return;}
}
function enterShowdown(){
 phase="show";actingIndex=-1;selectedIndexes=[];userChosenCombo=null;
 players.forEach(function(p){
  if(!p.inHand||p.folded)return;
  if(p.hand.length!==5){p.folded=true;return;}
  if(p.human){
   if(!hasValidTriple(p.hand)){p.folded=true;p.invalidShow=true;pushLog("Anda · Fold otomatis (tidak ada kombinasi 10/20/30)");}
  }else{
   p.combo=bestBotCombo(p.hand);
   if(!p.combo){p.folded=true;p.invalidShow=true;pushLog(p.name+" · Fold otomatis (kombinasi tidak valid)");}
  }
 });
 renderAll();
 if(activeCount()<=1){awardLastPlayer();return;}
 var user=userPlayer();
 if(!user||user.folded){beginBettingStage("betShow");return;}
 var possibilities=validCombinations(user.hand);
 showPrompt("RONDE "+round+" · SHOWDOWN","Pilih 3 kartu untuk Show","Pilih sendiri tepat 3 dari 5 kartu. Total nilai ketiganya harus tepat 10, 20, atau 30. Jika tidak ada kombinasi valid, sistem otomatis Fold.",[
  {label:"Show kartu terpilih",click:function(){showSelectedCards();},disabled:true},
  {label:"Fold",kind:"danger",click:function(){user.folded=true;pushLog("Anda · Fold saat Show");renderAll();hidePrompt();if(activeCount()<=1)awardLastPlayer();else beginBettingStage("betShow");}}
 ],"Kombinasi valid ditemukan",String(possibilities.length));
 updateShowPrompt();
}
function toggleSelected(index){
 var p=userPlayer();if(phase!=="show"||!p||p.folded)return;
 var found=selectedIndexes.indexOf(index);
 if(found>=0)selectedIndexes.splice(found,1);
 else if(selectedIndexes.length<3)selectedIndexes.push(index);
 renderHand();updateShowPrompt();
}
function updateShowPrompt(){
 var p=userPlayer();if(!p||p.folded||phase!=="show")return;
 var selected=selectedIndexes.slice().sort(function(a,b){return a-b;});
 var sum=selected.reduce(function(s,i){return s+scoreTile(p.hand[i]);},0);
 var valid=selected.length===3&&(sum===10||sum===20||sum===30);
 $("promptKicker").textContent="RONDE "+round+" · SHOWDOWN";
 $("promptTitle").textContent="Pilih 3 kartu untuk Show";
 $("promptMessage").textContent=selected.length<3?"Ketuk 3 kartu di tangan Anda. Hanya total 10, 20, atau 30 yang valid.":("Total pilihan: "+sum+". "+(valid?"Kombinasi valid; kartu lainnya menjadi penentu nilai akhir.":"Kombinasi belum valid. Pilih total 10, 20, atau 30."));
 $("promptFootLeft").textContent="Pilihan "+selected.length+"/3 kartu";
 $("promptFootRight").textContent="Total "+sum;
 var buttons=$("promptActions").querySelectorAll("button");
 buttons.forEach(function(btn){if(btn.textContent.indexOf("Show kartu terpilih")===0)btn.disabled=!valid;});
}
function showSelectedCards(){
 var p=userPlayer();if(!p||phase!=="show"||p.folded)return;
 if(selectedIndexes.length!==3)return;
 var sum=selectedIndexes.reduce(function(s,i){return s+scoreTile(p.hand[i]);},0);
 if(sum!==10&&sum!==20&&sum!==30){updateShowPrompt();return;}
 var remain=p.hand.filter(function(tile,index){return selectedIndexes.indexOf(index)<0;});
 p.combo={indexes:selectedIndexes.slice(),sum:sum,pair:remain,score:pairScore(remain)};
 userChosenCombo=p.combo;hidePrompt();pushLog("Anda · Show valid, total "+sum+" · kartu pilihan dibuka");beginBettingStage("betShow");
}
function resolveBotShowdown(){
 if(activeCount()<=1){awardLastPlayer();return;}
 players.forEach(function(p){if(p.inHand&&!p.folded&&!p.human){p.combo=bestBotCombo(p.hand);if(!p.combo){p.folded=true;p.invalidShow=true;}}});
 renderAll();
 if(activeCount()<=1){awardLastPlayer();return;}
 resolveShowdown();
}
function resolveShowdown(){
 var contenders=liveHandPlayers().filter(function(p){return p.combo&&p.combo.score;});
 if(!contenders.length){awardLastPlayer();return;}
 var best=contenders[0].combo.score,winners=[contenders[0]];
 for(var i=1;i<contenders.length;i++){
  var comparison=compareScore(contenders[i].combo.score,best);
  if(comparison>0){best=contenders[i].combo.score;winners=[contenders[i]];}
  else if(comparison===0)winners.push(contenders[i]);
 }
 players.forEach(function(p){if(p.inHand&&!p.folded)p.reveal=true;});
 var handPot=pot;
 var share=Math.floor(handPot/winners.length),remainder=handPot-share*winners.length;
 winners.forEach(function(p,i){p.chips+=share+(i<remainder?1:0);});
 lastResult={winners:winners.map(function(p){return p.name;}),amount:handPot,score:best,byShow:true};
 handEnded=true;phase="result";actingIndex=-1;pot=handPot;
 pushLog("Showdown selesai",handPot);
 renderAll();showResultPrompt();
}
function awardLastPlayer(){
 if(handEnded)return;
 var contenders=liveHandPlayers();
 if(contenders.length===0){
  var invalids=players.filter(function(p){return p.invalidShow&&p.hand.length===5;});
  if(invalids.length){
   var noValidPot=pot,each=Math.floor(noValidPot/invalids.length),extra=noValidPot-each*invalids.length;
   invalids.forEach(function(p,i){p.chips+=each+(i<extra?1:0);p.reveal=true;});
   lastResult={winners:invalids.map(function(p){return p.name;}),amount:noValidPot,score:null,byShow:false,noValid:true};
   handEnded=true;phase="result";actingIndex=-1;
   pushLog("Tidak ada kombinasi valid · pot dibagi",noValidPot);
   renderAll();showResultPrompt();return;
  }
  var alive=liveTournamentPlayers();
  if(alive.length===1){endTournament(alive[0]);return;}
  if(alive.length>1){
   var fallback=alive.slice().sort(function(a,b){return b.chips-a.chips;})[0];
   var fallbackPot=pot;fallback.chips+=fallbackPot;
   lastResult={winners:[fallback.name],amount:fallbackPot,score:null,byShow:false,noValid:true};
   handEnded=true;phase="result";actingIndex=-1;pushLog("Pot diberikan kepada pemain dengan chip tertinggi",fallbackPot);
   renderAll();showResultPrompt();return;
  }
  endTournament(null);return;
 }
 var winner=contenders[0],handPot=pot;
 winner.chips+=handPot;
 players.forEach(function(p){if(p.folded)p.reveal=false;});
 lastResult={winners:[winner.name],amount:handPot,score:null,byShow:false};
 handEnded=true;phase="result";actingIndex=-1;
 pushLog(winner.name+" menang tanpa Show",handPot);
 renderAll();showResultPrompt();
}
function showResultPrompt(){
 sgLogHistory();
 var alive=liveTournamentPlayers();
 var winText=lastResult.winners.join(" & ");
 var details=lastResult.byShow&&lastResult.score?lastResult.score.label:(lastResult.noValid?"Tidak ada kombinasi valid; pot dibagi sesuai hasil simulasi.":"Pemain lain Fold atau kombinasi tidak valid.");
 var resultMessage=lastResult.winners.length>1?(winText+" berbagi pot sebesar "+fmt(lastResult.amount)+". "+details):(winText+" menang dan menerima pot "+fmt(lastResult.amount)+". "+details);
 showPrompt("HASIL RONDE "+round,lastResult.byShow?"Showdown selesai":"Pot dimenangkan",resultMessage,[
  {label:alive.length<=1?"Lihat pemenang turnamen":"Ronde berikutnya",click:function(){hidePrompt();if(alive.length<=1)endTournament(alive[0]||null);else startHand(false);}},
  {label:"Ulangi turnamen",kind:"secondary",click:function(){hidePrompt();round=1;makePlayers();startHand(true);}}
 ],"Chip Anda",fmt(userPlayer()?userPlayer().chips:0));
}
function endTournament(champion){
 sgSaveTournamentWin(champion);
 phase="tournamentOver";actingIndex=-1;hidePrompt();
 if(champion)showPrompt("TURNAMEN SELESAI","Pemenang: "+champion.name,champion.name+" menjadi satu-satunya pemain yang masih memiliki chip. Saldo akhir: "+fmt(champion.chips)+".",[
  {label:"Kembali ke Lobby",click:function(){hidePrompt();sgShowScreen("screen-main");}},{label:"Main lagi",click:function(){sgNewTournament();}}
 ],"Total ronde",String(round));
 else showPrompt("TURNAMEN SELESAI","Permainan selesai","Tidak ada pemain yang tersisa. Mulai ulang untuk mencoba lagi.",[
  {label:"Main lagi",click:function(){round=1;makePlayers();startHand(true);}}
 ],"Total ronde",String(round));
 renderAll();
}
function renderInitial(){
 renderAll();
}
makePlayers();
phase="idle";
sgWireNavigation();
sgRenderPlayerIdentity();
renderAll();
sgRenderSettings();
sgRenderHome();
})();
