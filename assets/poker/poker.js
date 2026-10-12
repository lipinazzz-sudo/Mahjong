(()=>{"use strict";
const $=id=>document.getElementById(id),SUITS=["♠","♥","♦","♣"],RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"],START=200000,SB=2000,BB=4000;
let deck=[],players=[],board=[],pot=0,street="idle",actor=0,handNo=0,currentBet=0,raiseCount=0,dealerIndex=-1;
const money=n=>Math.max(0,Math.round(n)).toLocaleString("id-ID");
function makeCard(r,s){return {r,s,v:RANKS.indexOf(r)+2}}
function shuffle(){deck=[];SUITS.forEach(s=>RANKS.forEach(r=>deck.push(makeCard(r,s))));for(let i=deck.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}}
function draw(){return deck.pop()}
function screen(id){document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===id));$("actions").classList.remove("show")}
function nextWithChips(after){for(let n=1;n<=players.length;n++){const i=(after+n+players.length)%players.length;if(players[i]&&players[i].chips>0&&!players[i].folded)return i}return -1}
function makePlayers(){players=Array.from({length:9},(_,i)=>({name:i===0?"Anda":"Bot "+String.fromCharCode(65+i),chips:START,bet:0,totalBet:0,hand:[],human:i===0,folded:false,allin:false,acted:false}));}
function beginTurn(idx){if(players.filter(p=>!p.folded).length===1){awardByFold(players.find(p=>!p.folded));return}if(idx<0){nextStreet();return}actor=idx;render();if(players[actor].human)humanTurn(street.toUpperCase(),"Pilih aksi.");else botTurn(players[actor])}
function newMatch(){makePlayers();handNo=0;dealerIndex=-1;newHand(true)}
function newHand(first){
 if(!players.length)makePlayers();
 if(players[0].chips<=0){showMatchEnd(false);return}
 const live=players.map((p,i)=>({p,i})).filter(x=>x.p.chips>0).map(x=>x.i);
 if(live.length<2){showMatchEnd(live.length===1&&players[live[0]].human);return}
 handNo++;shuffle();board=[];pot=0;currentBet=0;raiseCount=0;street="preflop";
 players.forEach(p=>{p.bet=0;p.totalBet=0;p.hand=[];p.folded=p.chips<=0;p.allin=false;p.acted=false});
 live.forEach(i=>{players[i].hand=[draw(),draw()]});
 if(dealerIndex<0||first===true)dealerIndex=live[0];else{const next=nextWithChips(dealerIndex);if(next>=0)dealerIndex=next}
 let sbIndex,bbIndex,firstActor;
 if(live.length===2){sbIndex=dealerIndex;bbIndex=nextWithChips(sbIndex);firstActor=sbIndex}
 else{sbIndex=nextWithChips(dealerIndex);bbIndex=nextWithChips(sbIndex);firstActor=nextWithChips(bbIndex)}
 postBlind(players[sbIndex],SB);postBlind(players[bbIndex],BB);currentBet=Math.max(players[sbIndex].bet,players[bbIndex].bet);
 render();beginTurn(firstActor)
}
function postBlind(p,n){pay(p,n);p.acted=false}
function face(c,hidden=false){let d=document.createElement("div");d.className="playing-card"+(c&&(c.s==="♥"||c.s==="♦")?" red":"")+(hidden?" back":"");d.textContent=hidden?"✦":c.r+c.s;return d}
function render(){ $("pot").textContent=money(pot);$("stage").textContent=({preflop:"PRE-FLOP",flop:"FLOP",turn:"TURN",river:"RIVER",showdown:"SHOWDOWN",result:"HASIL RONDE"})[street]||street.toUpperCase();$("community").replaceChildren();board.forEach(c=>$("community").appendChild(face(c)));$("felt").querySelectorAll(".seat").forEach(n=>n.remove());players.forEach((p,i)=>{let s=document.createElement("div");s.className="seat seat-"+i;if(i===0){s.style.left="50%";s.style.bottom="12px";s.style.transform="translateX(-50%)"}let name=document.createElement("strong");name.textContent=p.name+(p.folded?" · FOLD":p.allin?" · ALL-IN":i===actor&&street!=="result"&&street!=="showdown"?" · GILIRAN":"");let stack=document.createElement("small");stack.className="stack";stack.textContent="Chip "+money(p.chips);let bet=document.createElement("small");bet.textContent=p.bet?"Taruhan "+money(p.bet):" ";s.append(name,stack,bet);let hole=document.createElement("div");hole.className="hole";p.hand.forEach(c=>hole.appendChild(face(c,!p.human&&street!=="showdown"&&street!=="result"&&!p.folded)));s.appendChild(hole);$("felt").appendChild(s)});$("hand").replaceChildren();players[0].hand.forEach(c=>$("hand").appendChild(face(c)));$("status").textContent="Ronde "+handNo+" · "+street+" · Chip Anda "+money(players[0].chips)}
function panel(title,msg,buttons){$("actionTitle").textContent=title;$("actionText").textContent=msg;let host=$("actionButtons");host.replaceChildren();buttons.forEach(b=>{let el=document.createElement("button");el.className="btn "+(b.kind||"");el.textContent=b.label;el.disabled=!!b.disabled;el.onclick=b.run;host.appendChild(el)});$("actions").classList.add("show")}
function humanTurn(title,msg){actor=0;let p=players[0],need=Math.max(0,currentBet-p.bet),buttons=[];if(p.folded||p.allin){advance();return}buttons.push({label:need?"Call "+money(Math.min(need,p.chips)):"Check",kind:"alt",run:()=>{pay(p,Math.min(need,p.chips));p.acted=true;advance()}});let raise=Math.min(p.chips,need+Math.max(BB,currentBet));buttons.push({label:"Raise "+money(raise),run:()=>{if(raise<=p.bet){advance();return}pay(p,raise);currentBet=p.bet;raiseCount++;players.forEach(x=>{x.acted=false});p.acted=true;advance()}});buttons.push({label:"Fold",kind:"danger",run:()=>{p.folded=true;p.acted=true;advance()}});panel(title,msg+" Pot "+money(pot)+".",buttons)}
function pay(p,n){n=Math.max(0,Math.min(n,p.chips));p.chips-=n;p.bet+=n;p.totalBet=(p.totalBet||0)+n;pot+=n;if(!p.chips)p.allin=true;return n}
function strength(h){let a=h[0].v,b=h[1].v;return (Math.max(a,b)+Math.min(a,b))/30+(a===b?.3:0)+(h[0].s===h[1].s?.06:0)+(Math.abs(a-b)===1?.04:0)}
function advance(){ $("actions").classList.remove("show");if(players.filter(p=>!p.folded).length===1){let w=players.find(p=>!p.folded);w.chips+=pot;street="result";render();$("stage").textContent="PEMENANG: "+w.name;panel("Semua lawan fold",w.name+" memenangkan "+money(pot)+" chip.",[{label:"Ronde berikutnya",run:newHand},{label:"Lobby",kind:"alt",run:()=>screen("home")}]);return}
 let next=-1;for(let n=1;n<=players.length;n++){let i=(actor+n)%players.length,p=players[i];if(!p.folded&&!p.allin&&!p.acted){next=i;break}}
 if(next<0){nextStreet();return}actor=next;render();if(actor===0){humanTurn(street.toUpperCase(),"Pilih aksi.");return}botTurn(players[actor])}
function botTurn(p){let need=Math.max(0,currentBet-p.bet),roll=Math.random(),s=strength(p.hand);if(need>p.chips||(need>0&&roll>(s>.65?.78:.42))){p.folded=true;p.acted=true;advance();return}if(s>.75&&roll>.68&&raiseCount<2&&p.chips>BB){pay(p,Math.min(p.chips,need+Math.max(BB,currentBet)));currentBet=p.bet;raiseCount++;players.forEach(x=>{x.acted=false});p.acted=true}else{pay(p,need);p.acted=true}advance()}
function nextStreet(){
 players.forEach(p=>{p.bet=0;p.acted=false});currentBet=0;raiseCount=0;
 if(street==="preflop"){board.push(draw(),draw(),draw());street="flop"}
 else if(street==="flop"){board.push(draw());street="turn"}
 else if(street==="turn"){board.push(draw());street="river"}
 else{showdown();return}
 render();const first=nextWithChips(dealerIndex);
 if(first<0){if(street==="river"){showdown();return}nextStreet();return}
 beginTurn(first)
}
function settleSidePots(){
 const levels=[...new Set(players.map(p=>p.totalBet||0).filter(n=>n>0))].sort((a,b)=>a-b);
 let previous=0;const results=[];
 levels.forEach(level=>{
  const contributors=players.filter(p=>(p.totalBet||0)>=level);
  const amount=(level-previous)*contributors.length;previous=level;if(!amount)return;
  const eligible=contributors.filter(p=>!p.folded&&p.hand.length===2);
  if(!eligible.length){const refund=contributors.filter(p=>(p.totalBet||0)===level);if(refund.length){const share=Math.floor(amount/refund.length),extra=amount-share*refund.length;refund.forEach((p,i)=>p.chips+=share+(i<extra?1:0));}return}
  const ranked=eligible.map(p=>({p,rank:best(p.hand.concat(board))})).sort((a,b)=>cmp(b.rank,a.rank));
  const top=ranked[0].rank,winners=ranked.filter(x=>cmp(x.rank,top)===0).map(x=>x.p);
  const share=Math.floor(amount/winners.length),extra=amount-share*winners.length;
  winners.forEach((p,i)=>p.chips+=share+(i<extra?1:0));
  results.push({amount,winners,rank:top});
 });
 return results
}
function showdown(){
 street="showdown";
 const layers=settleSidePots();
 const winnerNames=[...new Set(layers.flatMap(x=>x.winners.map(p=>p.name)))];
 const label=winnerNames.length?winnerNames.join(", "):"Tidak ada pemenang";
 render();$("stage").textContent="SHOWDOWN";$("status").textContent=layers.map(x=>x.winners.map(p=>p.name).join(", ")+" · "+handName(x.rank[0])).join(" | ");
 street="result";render();
 const details=layers.map(x=>x.winners.map(p=>p.name).join(", ")+" ("+handName(x.rank[0])+") · "+money(x.amount)).join("; ");
 panel("Showdown selesai",label+" memenangkan pot. "+details,[{label:"Ronde berikutnya",run:()=>newHand(false)},{label:"Lobby",kind:"alt",run:()=>screen("home")}])
}
function rank5(cs){let vals=cs.map(c=>c.v).sort((a,b)=>b-a),counts={};vals.forEach(v=>counts[v]=(counts[v]||0)+1);let groups=Object.keys(counts).map(Number).sort((a,b)=>counts[b]-counts[a]||b-a),flush=cs.every(c=>c.s===cs[0].s),uniq=[...new Set(vals)],straight=0;for(let i=0;i<=uniq.length-5;i++)if(uniq[i]-uniq[i+4]===4)straight=uniq[i];if([14,5,4,3,2].every(v=>uniq.includes(v)))straight=5;let c=Object.values(counts).sort((a,b)=>b-a);if(flush&&straight)return[8,straight];if(c[0]===4)return[7,groups[0],groups[1]];if(c[0]===3&&c[1]===2)return[6,groups[0],groups[1]];if(flush)return[5,...vals];if(straight)return[4,straight];if(c[0]===3)return[3,...groups];if(c[0]===2&&c[1]===2)return[2,...groups];if(c[0]===2)return[1,...groups];return[0,...vals]}
function best(cs){let out=null;for(let a=0;a<cs.length-4;a++)for(let b=a+1;b<cs.length-3;b++)for(let c=b+1;c<cs.length-2;c++)for(let d=c+1;d<cs.length-1;d++)for(let e=d+1;e<cs.length;e++){let r=rank5([cs[a],cs[b],cs[c],cs[d],cs[e]]);if(!out||cmp(r,out)>0)out=r}return out}
function cmp(a,b){for(let i=0;i<Math.max(a.length,b.length);i++)if((a[i]||0)!==(b[i]||0))return(a[i]||0)-(b[i]||0);return 0}
function nameRank(n){return["High card","One pair","Two pair","Three of a kind","Straight","Flush","Full house","Four of a kind","Straight flush"][n]||"High card"}
function showdown(){street="showdown";let ranked=players.filter(p=>!p.folded).map(p=>({p,r:best(p.hand.concat(board))})).sort((a,b)=>cmp(b.r,a.r)),winners=ranked.filter(x=>cmp(x.r,ranked[0].r)===0).map(x=>x.p),share=Math.floor(pot/winners.length);winners.forEach(p=>p.chips+=share);let label=winners.map(p=>p.name).join(", ");render();$("stage").textContent="PEMENANG: "+label;$("status").textContent=label+" · "+nameRank(ranked[0].r[0]);panel("Showdown selesai",label+" menang dengan "+nameRank(ranked[0].r[0])+". Pot "+money(pot)+".",[{label:"Ronde berikutnya",run:newHand},{label:"Lobby",kind:"alt",run:()=>screen("home")}])}
$("start").onclick=()=>{screen("game");newMatch()};$("back").onclick=()=>screen("home");$("settings").onclick=()=>screen("settingsScreen");$("settingsBack").onclick=()=>{screen("game");resumeHumanTurn()};$("newGame").onclick=()=>{screen("game");newMatch()};
function resumeHumanTurn(){if(street!=="result"&&street!=="showdown"&&players[actor]&&players[actor].human)humanTurn(street.toUpperCase(),"Pilih aksi.")}
})();