(()=>{"use strict";
const $=id=>document.getElementById(id);
const SUITS=["♠","♥","♦","♣"],RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const MAX_PLAYERS=9,STARTING_CHIPS=200000,SMALL_BLIND=2000,BIG_BLIND=4000,ACTION_SECONDS=15,BOT_DELAY_MS=2000;
let deck=[],players=[],board=[],pot=0,street="idle",actor=-1,handNo=0,currentBet=0,minRaise=BIG_BLIND,dealerIndex=-1,matchStarted=false;
let clockInterval=null,clockTimeout=null,botTimeout=null,turnToken=0,turnDeadline=0;
const money=n=>Math.max(0,Math.round(n)).toLocaleString("id-ID");
const cardIsRed=c=>c.s==="♥"||c.s==="♦";
function makeCard(r,s){return {r,s,v:RANKS.indexOf(r)+2}}
function shuffle(){deck=[];SUITS.forEach(s=>RANKS.forEach(r=>deck.push(makeCard(r,s))));for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}}
function draw(){return deck.pop()}
function clearTurnClocks(){if(clockInterval!==null)clearInterval(clockInterval);if(clockTimeout!==null)clearTimeout(clockTimeout);if(botTimeout!==null)clearTimeout(botTimeout);clockInterval=null;clockTimeout=null;botTimeout=null;turnToken++}
function screen(id){document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===id));if(id!=="game")$("actions").classList.remove("show");if(id==="game"&&matchStarted){render();if(actor>=0&&players[actor]&&players[actor].human&&street!=="result"&&street!=="showdown")humanTurn(street.toUpperCase(),"Giliran Anda.");}}
function activeIndexes(){return players.map((p,i)=>p.chips>0?i:-1).filter(i=>i>=0)}
function livePlayers(){return players.filter(p=>!p.folded&&p.hand.length===2)}
function actionable(p){return p&&!p.folded&&!p.allin&&p.chips>0&&p.hand.length===2}
function nextWithChips(after){for(let n=1;n<=players.length;n++){const i=(after+n+players.length)%players.length;if(players[i]&&players[i].chips>0)return i}return -1}
function makePlayers(){players=Array.from({length:MAX_PLAYERS},(_,i)=>({name:i===0?"Anda":"Bot "+String.fromCharCode(65+i),chips:STARTING_CHIPS,bet:0,totalBet:0,hand:[],human:i===0,folded:false,allin:false,acted:false}));}
function newMatch(){clearTurnClocks();makePlayers();handNo=0;dealerIndex=-1;matchStarted=true;newHand(true)}
function newHand(first){
 clearTurnClocks();
 if(!players.length)makePlayers();
 if(players[0].chips<=0){showMatchEnd(false);return}
 players.forEach(p=>{p.bet=0;p.totalBet=0;p.hand=[];p.folded=p.chips<=0;p.allin=false;p.acted=false});
 const live=activeIndexes();if(live.length<2){showMatchEnd(live.length===1&&players[live[0]].human);return}
 handNo++;shuffle();board=[];pot=0;currentBet=0;minRaise=BIG_BLIND;street="preflop";actor=-1;
 live.forEach(i=>{players[i].hand=[draw(),draw()]});
 if(dealerIndex<0||first===true)dealerIndex=live[0];else{const next=nextWithChips(dealerIndex);if(next>=0)dealerIndex=next}
 let sbIndex,bbIndex,firstActor;
 if(live.length===2){sbIndex=dealerIndex;bbIndex=nextWithChips(sbIndex);firstActor=sbIndex}
 else{sbIndex=nextWithChips(dealerIndex);bbIndex=nextWithChips(sbIndex);firstActor=nextWithChips(bbIndex)}
 postBlind(players[sbIndex],SMALL_BLIND);postBlind(players[bbIndex],BIG_BLIND);
 currentBet=Math.max(players[sbIndex].bet,players[bbIndex].bet);
 render();beginTurn(firstActor)
}
function postBlind(p,n){pay(p,n);p.acted=false}
function face(c,hidden=false){const d=document.createElement("div");d.className="playing-card"+(c&&cardIsRed(c)?" red":"")+(hidden?" back":"");d.textContent=hidden?"✦":c.r+c.s;return d}
function seatTimer(i){const badge=document.createElement("span");badge.className="turn-clock";badge.id="turnClock-"+i;badge.textContent=i===actor&&street!=="result"&&street!=="showdown"?"15s":"";badge.setAttribute("aria-label","Waktu aksi");badge.style.setProperty("--time-ratio","1");if(i!==actor||street==="result"||street==="showdown")badge.classList.add("clock-idle");return badge}
function render(){
 if(!players.length)return;
 $("pot").textContent=money(pot);
 $("stage").textContent=({preflop:"PRE-FLOP",flop:"FLOP",turn:"TURN",river:"RIVER",showdown:"SHOWDOWN",result:"HASIL RONDE"})[street]||"DJ POKER";
 $("community").replaceChildren();board.forEach(c=>$("community").appendChild(face(c)));
 $("felt").querySelectorAll(".seat").forEach(n=>n.remove());
 players.forEach((p,i)=>{
  const seat=document.createElement("div");seat.className="seat seat-"+i;
  if(i===0){seat.style.left="50%";seat.style.bottom="8px";seat.style.transform="translateX(-50%)"}
  const name=document.createElement("strong");
  name.textContent=p.chips<=0?p.name+" · OUT":p.folded?p.name+" · FOLD":p.allin?p.name+" · ALL-IN":i===actor&&street!=="result"&&street!=="showdown"?p.name+" · GILIRAN":p.name;
  const stack=document.createElement("small");stack.className="stack";stack.textContent="Chip "+money(p.chips);
  const bet=document.createElement("small");bet.className="seat-bet";bet.textContent=p.bet?"Taruhan "+money(p.bet):(i===dealerIndex?"DEALER":" ");
  seat.append(name,stack,bet);
  if(p.hand.length===2){
   const row=document.createElement("div");row.className="hole-row";
   const hole=document.createElement("div");hole.className="hole";
   const hidden=p.folded||(!p.human&&street!=="showdown"&&street!=="result");
   p.hand.forEach(c=>hole.appendChild(face(c,hidden)));
   row.append(hole,seatTimer(i));seat.appendChild(row);
  }
  $("felt").appendChild(seat);
 });
 $("hand").replaceChildren();
 if(players[0]&&players[0].hand.length===2)players[0].hand.forEach(c=>$("hand").appendChild(face(c,players[0].folded)));
 $("status").textContent="Ronde "+handNo+" · "+street.toUpperCase()+" · Chip Anda "+money(players[0].chips)+" · "+livePlayers().length+" pemain aktif";
}
function pay(p,n){n=Math.max(0,Math.min(p.chips,n));p.chips-=n;p.bet+=n;p.totalBet+=n;pot+=n;if(p.chips===0)p.allin=true;return n}
function panel(title,msg,buttons){$("actionTitle").textContent=title;$("actionText").textContent=msg;const host=$("actionButtons");host.replaceChildren();buttons.forEach(b=>{const btn=document.createElement("button");btn.className="btn "+(b.kind||"");btn.textContent=b.label;btn.disabled=!!b.disabled;btn.addEventListener("click",b.run);host.appendChild(btn)});$("actions").classList.add("show")}
function updateTimer(){const remaining=Math.max(0,turnDeadline-Date.now());const seconds=Math.ceil(remaining/1000);const ratio=Math.max(0,Math.min(1,remaining/(ACTION_SECONDS*1000)));const badge=$("turnClock-"+actor);if(badge){badge.textContent=seconds+"s";badge.style.setProperty("--time-ratio",String(ratio));badge.classList.toggle("clock-low",seconds<=5);badge.classList.remove("clock-idle")}if(remaining<=0){const token=turnToken;onActionTimeout(token)}}
function startTurnClock(index){clearTurnClocks();actor=index;const token=turnToken;turnDeadline=Date.now()+ACTION_SECONDS*1000;updateTimer();clockInterval=setInterval(()=>{if(token!==turnToken)return;updateTimer()},200);clockTimeout=setTimeout(()=>onActionTimeout(token),ACTION_SECONDS*1000)}
function onActionTimeout(token){if(token!==turnToken||actor<0||!players[actor]||street==="result"||street==="showdown")return;const p=players[actor];clearTurnClocks();if(!actionable(p))return;if(p.human){if(currentBet<=p.bet){p.acted=true;advanceAfterAction(actor,"check")}else{p.folded=true;p.acted=true;advanceAfterAction(actor,"fold")}}else{botAction(p);advanceAfterAction(actor,"auto")}}
function beginTurn(index){
 if(livePlayers().length<=1){awardByFold(livePlayers()[0]);return}
 if(index<0){advanceStreet();return}
 if(!actionable(players[index])){beginTurn(findNextActionable(index));return}
 startTurnClock(index);render();
 if(players[index].human){humanTurn(street.toUpperCase(),"Pilih aksi. Waktu aksi 15 detik.");return}
 $("actions").classList.remove("show");$("status").textContent=players[index].name+" sedang berpikir…";
 const token=turnToken;botTimeout=setTimeout(()=>{if(token!==turnToken||actor!==index)return;botTimeout=null;if(!actionable(players[index]))return;botAction(players[index]);advanceAfterAction(index,"bot")},BOT_DELAY_MS)
}
function findNextActionable(after){for(let n=1;n<=players.length;n++){const i=(after+n+players.length)%players.length;if(actionable(players[i])&&(!players[i].acted||players[i].bet<currentBet))return i}return -1}
function humanTurn(title,msg){
 const p=players[actor];if(!p||!p.human||!actionable(p))return;
 const need=Math.max(0,currentBet-p.bet),callAmount=Math.min(need,p.chips),raiseTarget=Math.max(currentBet+minRaise,minRaise),raiseCost=raiseTarget-p.bet,buttons=[];
 buttons.push({label:need===0?"Check":"Call "+money(callAmount),kind:"alt",run:()=>takeAction(p,need===0?"check":"call")});
 if(raiseCost>0&&p.chips>=raiseCost)buttons.push({label:(currentBet===0?"Bet to ":"Raise to ")+money(raiseTarget),run:()=>takeAction(p,"raise",raiseTarget)});
 buttons.push({label:"Fold",kind:"danger",run:()=>takeAction(p,"fold")});
 panel(title,msg+(need>0?" Call diperlukan: "+money(need)+".":" Anda boleh check atau bet.")+" Pot "+money(pot)+".",buttons)
}
function takeAction(p,action,target){
 if(!p||players[actor]!==p||!actionable(p))return;
 clearTurnClocks();
 if(action==="fold"){p.folded=true;p.acted=true}
 else if(action==="check"||action==="call"){pay(p,Math.min(Math.max(0,currentBet-p.bet),p.chips));p.acted=true}
 else if(action==="raise"){
  const old=currentBet,cost=target-p.bet;
  if(cost<=0||cost>p.chips){beginTurn(actor);return}
  pay(p,cost);currentBet=p.bet;minRaise=Math.max(BIG_BLIND,currentBet-old);
  players.forEach(x=>{if(x!==p&&!x.folded&&!x.allin)x.acted=false});
  p.acted=true
 }
 advanceAfterAction(players.indexOf(p),action)
}
function preflopStrength(hand){const a=hand[0].v,b=hand[1].v,hi=Math.max(a,b),lo=Math.min(a,b);return (hi+lo)/30+(a===b?.3:0)+(hand[0].s===hand[1].s?.06:0)+(hi-lo===1?.04:0)}
function botAction(p){
 const need=Math.max(0,currentBet-p.bet),strength=preflopStrength(p.hand),roll=Math.random();
 if(need>0&&(need>p.chips||(roll>(strength>.72?.84:strength>.52?.68:.4)))){p.folded=true;p.acted=true;return}
 const target=Math.max(currentBet+minRaise,minRaise),cost=target-p.bet,canRaise=cost>0&&p.chips>=cost;
 if(canRaise&&strength>.68&&roll>.76){const old=currentBet;pay(p,cost);currentBet=p.bet;minRaise=Math.max(BIG_BLIND,currentBet-old);players.forEach(x=>{if(x!==p&&!x.folded&&!x.allin)x.acted=false});p.acted=true;return}
 pay(p,Math.min(need,p.chips));p.acted=true
}
function advanceAfterAction(lastIndex){
 if(livePlayers().length<=1){awardByFold(livePlayers()[0]);return}
 const next=findNextActionable(lastIndex);
 if(next<0){advanceStreet();return}
 beginTurn(next)
}
function advanceStreet(){
 clearTurnClocks();players.forEach(p=>{p.bet=0;p.acted=false});currentBet=0;minRaise=BIG_BLIND;
 if(street==="preflop"){board.push(draw(),draw(),draw());street="flop"}
 else if(street==="flop"){board.push(draw());street="turn"}
 else if(street==="turn"){board.push(draw());street="river"}
 else{showdown();return}
 render();
 const next=findNextActionable(dealerIndex);
 if(next<0){if(street==="river"){showdown();return}advanceStreet();return}
 beginTurn(next)
}
function straightHigh(values){const sorted=[...new Set(values)].sort((a,b)=>b-a);for(let i=0;i<=sorted.length-5;i++)if(sorted[i]-sorted[i+4]===4)return sorted[i];if([14,5,4,3,2].every(v=>sorted.includes(v)))return 5;return 0}
function rank5(cards){
 const vals=cards.map(c=>c.v).sort((a,b)=>b-a),counts={};vals.forEach(v=>counts[v]=(counts[v]||0)+1);
 const groups=Object.keys(counts).map(Number).sort((a,b)=>counts[b]-counts[a]||b-a),flush=cards.every(c=>c.s===cards[0].s),straight=straightHigh(vals),multiples=Object.values(counts).sort((a,b)=>b-a);
 if(flush&&straight)return[8,straight];
 if(multiples[0]===4){const four=groups.find(v=>counts[v]===4);return[7,four,...vals.filter(v=>v!==four)]}
 if(multiples[0]===3&&multiples[1]===2){const three=groups.find(v=>counts[v]===3),pair=groups.filter(v=>counts[v]>=2&&v!==three).sort((a,b)=>b-a)[0];return[6,three,pair]}
 if(flush)return[5,...vals];
 if(straight)return[4,straight];
 if(multiples[0]===3){const three=groups.find(v=>counts[v]===3);return[3,three,...vals.filter(v=>v!==three)]}
 if(multiples[0]===2&&multiples[1]===2){const pairs=groups.filter(v=>counts[v]===2).sort((a,b)=>b-a),kicker=vals.find(v=>counts[v]===1);return[2,...pairs,kicker]}
 if(multiples[0]===2){const pair=groups.find(v=>counts[v]===2);return[1,pair,...vals.filter(v=>v!==pair)]}
 return[0,...vals]
}
function bestHand(cards){let best=null;for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){const rank=rank5([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(!best||compare(rank,best)>0)best=rank}return best}
function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const av=a[i]||0,bv=b[i]||0;if(av!==bv)return av-bv}return 0}
function handName(n){return["High card","One pair","Two pair","Three of a kind","Straight","Flush","Full house","Four of a kind","Straight flush"][n]||"High card"}
function settleSidePots(){
 const levels=[...new Set(players.map(p=>p.totalBet||0).filter(n=>n>0))].sort((a,b)=>a-b);let previous=0;const results=[];
 levels.forEach(level=>{
  const contributors=players.filter(p=>(p.totalBet||0)>=level),amount=(level-previous)*contributors.length;previous=level;if(!amount)return;
  const eligible=contributors.filter(p=>!p.folded&&p.hand.length===2);
  if(!eligible.length){const refunds=contributors.filter(p=>(p.totalBet||0)===level);if(refunds.length){const share=Math.floor(amount/refunds.length),extra=amount-share*refunds.length;refunds.forEach((p,i)=>p.chips+=share+(i<extra?1:0))}return}
  const ranked=eligible.map(p=>({p,rank:bestHand(p.hand.concat(board))})).sort((a,b)=>compare(b.rank,a.rank)),top=ranked[0].rank,winners=ranked.filter(x=>compare(x.rank,top)===0).map(x=>x.p);
  const share=Math.floor(amount/winners.length),extra=amount-share*winners.length;winners.forEach((p,i)=>p.chips+=share+(i<extra?1:0));results.push({amount,winners,rank:top})
 });
 return results
}
function showdown(){
 clearTurnClocks();street="showdown";const layers=settleSidePots(),names=[...new Set(layers.flatMap(x=>x.winners.map(p=>p.name)))],label=names.length?names.join(", "):"Tidak ada pemenang";
 render();$("stage").textContent="SHOWDOWN";$("status").textContent=layers.map(x=>x.winners.map(p=>p.name).join(", ")+" · "+handName(x.rank[0])).join(" | ");
 street="result";render();const details=layers.map(x=>x.winners.map(p=>p.name).join(", ")+" ("+handName(x.rank[0])+") · "+money(x.amount)).join("; ");
 panel("Showdown selesai",label+" memenangkan pot. "+details,[{label:"Ronde berikutnya",run:()=>newHand(false)},{label:"Lobby",kind:"alt",run:()=>screen("home")}])
}
function awardByFold(winner){if(!winner)return;clearTurnClocks();winner.chips+=pot;street="result";render();$("stage").textContent="PEMENANG: "+winner.name;panel("Semua lawan Fold",winner.name+" memenangkan pot "+money(pot)+" chip.",[{label:"Ronde berikutnya",run:()=>newHand(false)},{label:"Lobby",kind:"alt",run:()=>screen("home")}])}
function showMatchEnd(won){clearTurnClocks();street="result";$("actions").classList.remove("show");panel(won?"Meja dimenangkan":"Chip habis",won?"Anda menjadi pemain terakhir dengan chip tersisa.":"Chip Anda habis. Mulai pertandingan baru untuk mencoba lagi.",[{label:"Pertandingan baru",run:()=>{screen("game");newMatch()}},{label:"Lobby",kind:"alt",run:()=>screen("home")}])}
$("start").onclick=()=>{screen("game");newMatch()};
$("back").onclick=()=>screen("home");
$("settings").onclick=()=>screen("settingsScreen");
$("settingsBack").onclick=()=>{screen("game")};
$("newGame").onclick=()=>{screen("game");newMatch()};
})();