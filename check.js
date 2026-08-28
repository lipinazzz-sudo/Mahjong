
    // TILE DEFINITIONS
    const TILE_TYPES = [];
    const helpers = ['1','2','3','4','5','6','7','8','9'];
    const charsMan = ['一萬','二萬','三萬','四萬','伍萬','六萬','七萬','八萬','九萬'];
    const unicodePin = ['🀙','🀚','🀛','🀜','🀝','🀞','🀟','🀠','🀡'];
    const unicodeSou = ['🀐','🀑','🀒','🀓','🀔','🀕','🀖','🀗','🀘'];

    let idCounter = 0;
    for (let i = 0; i < 9; i++) TILE_TYPES.push({ id: idCounter++, val: charsMan[i], helper: helpers[i], type: 'man', num: i+1 });
    for (let i = 0; i < 9; i++) TILE_TYPES.push({ id: idCounter++, val: unicodePin[i], helper: helpers[i], type: 'pin', num: i+1 });
    for (let i = 0; i < 9; i++) TILE_TYPES.push({ id: idCounter++, val: unicodeSou[i], helper: helpers[i], type: 'sou', num: i+1 });
    const honors = [ { val: '東', helper: 'E' }, { val: '南', helper: 'S' }, { val: '西', helper: 'W' }, { val: '北', helper: 'N' }, { val: '🀆', helper: 'Wh' }, { val: '發', helper: 'G' }, { val: '中', helper: 'R' } ];
    honors.forEach(h => TILE_TYPES.push({ id: idCounter++, val: h.val, helper: h.helper, type: 'honor', num: 0 }));

    // STATE VARIABLES
    let fullDeck = [], deadWall = [], playerHands = [[], [], [], []], playerRivers = [[], [], [], []];
    let playerMelds = [[], [], [], []]; 
    let playerScores = [25000, 25000, 25000, 25000];
    let roundStartScores = [25000, 25000, 25000, 25000];
    let aiRiichi = [false, false, false, false];
    
    let activeScreenId = 'screen-main';
    let previousScreenId = 'screen-main';

    let autoSortSetting = true;
    let isMultiplayerMode = false;

    let currentRoundIndex = 0; // 0=East 1, 1=East 2, 2=East 3, 3=East 4, 4=Extra East 5
    let currentDealerIdx = 1; // 1 = East Player at start

    let lastDiscardedTile = null; 
    let lastDiscarderIdx = -1;
    let isRiichi = false, pendingRiichi = false;
    let riichiSticks = 0;

    let currentTurn = 0, drawnTile = null, isDiscardable = false, aiDifficulty = 'Medium';
    let timerInterval = null, baseTime = 10, extraTimeBank = 20, isActionPhase = false;


    // Safe DOM helpers: UI failures must never stop the Mahjong engine.
    function byId(id) { return document.getElementById(id); }
    function setText(id, value) {
        const el = byId(id);
        if (el) el.textContent = value == null ? '' : String(value);
        return el;
    }
    function setDisplay(id, value) {
        const el = byId(id);
        if (el) el.style.display = value;
        return el;
    }

    // NAVIGATION SYSTEM
    function nav(id) {
        previousScreenId = activeScreenId;
        activeScreenId = id;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = byId(id);
        if (target) target.classList.add('active');
    }

    function openSettingsFromGame() {
        nav('screen-settings');
    }

    function exitSettings() {
        nav(previousScreenId === 'screen-settings' ? 'screen-main' : previousScreenId);
    }

    function toggleAutoSortSetting() {
        autoSortSetting = !autoSortSetting;
        setText('btn-toggle-autosort', autoSortSetting ? 'ON' : 'OFF');
        if (autoSortSetting && activeScreenId === 'screen-game') autoSortHand();
    }

    function forcePlayMusic() {
        const bgMusic = byId('bg-music');
        const slider = byId('vol-slider');
        if (!bgMusic) return;
        if (slider) bgMusic.volume = Number(slider.value);
        bgMusic.play().catch(e => console.log('Audio waiting for user click...'));
    }
    function toggleAudio() {
        const bgMusic = byId('bg-music');
        if (!bgMusic) return;
        if (bgMusic.paused) bgMusic.play().catch(()=>{}); else bgMusic.pause();
    }
    function updateVolume(val) { const audio = byId('bg-music'); if (audio) audio.volume = Number(val); }

    // MULTIPLAYER LOBBY SIMULATION
    let lobbyReadyTimer = null;
    function openPlayerLobby() {
        isMultiplayerMode = true;
        document.getElementById('modal-lobby').style.display = 'flex';
        document.getElementById('st-0').className = 'status-waiting';
        setText('st-0', 'WAITING');
        for(let i=1; i<=3; i++) {
            document.getElementById(`st-${i}`).className = 'status-waiting';
            setText(`st-${i}`, 'WAITING');
        }
    }

    function closeLobby() {
        clearInterval(lobbyReadyTimer);
        document.getElementById('modal-lobby').style.display = 'none';
    }

    function togglePlayerReady() {
        const st0 = document.getElementById('st-0');
        st0.className = 'status-ready';
        st0.textContent = 'READY';

        // Simulate other players getting ready
        let step = 1;
        lobbyReadyTimer = setInterval(() => {
            if (step <= 3) {
                let st = document.getElementById(`st-${step}`);
                st.className = 'status-ready';
                st.textContent = 'READY';
                step++;
            } else {
                clearInterval(lobbyReadyTimer);
                setTimeout(() => {
                    closeLobby();
                    start4PGame('Hard', true);
                }, 500);
            }
        }, 600);
    }

/* RIICHI ENGINE REPLACEMENT */
    // =========================
    // RIICHI MAHJONG RULE ENGINE
    // =========================
    const WIND_ORDER = ['E', 'S', 'W', 'N'];
    const PLAYER_SEAT_WINDS = ['S', 'E', 'N', 'W']; // You, P1, P2, P3
    let temporaryFuriten = [false, false, false, false];
    let riichiFuriten = [false, false, false, false];
    let pendingPlayerActions = [];
    let riichiDiscardIndices = [];
    let rinshanTiles = [], rinshanDrawIndex = 0;
    let doraIndicators = [], uraDoraIndicators = [];
    let kanCount = 0, canRevealUraDora = false, lastDrawWasRinshan = false;
    let aiMoveTimer = null, autoDiscardTimer = null, roundToken = 0;
    let roundActive = false;
    let roundEnding = false;

    function ceil100(v) { return Math.ceil(v / 100) * 100; }

    function getDoraNext(tile) {
        if (!tile) return null;
        if (tile.type !== 'honor') {
            const base = tile.type === 'man' ? 0 : tile.type === 'pin' ? 9 : 18;
            return TILE_TYPES[base + (tile.num === 9 ? 0 : tile.num)];
        }
        const winds = [27,28,29,30], dragons = [31,32,33];
        if (winds.includes(tile.id)) return TILE_TYPES[winds[(winds.indexOf(tile.id)+1)%4]];
        if (dragons.includes(tile.id)) return TILE_TYPES[dragons[(dragons.indexOf(tile.id)+1)%3]];
        return null;
    }
    function getDoraTiles(){ return doraIndicators.map(getDoraNext).filter(Boolean); }
    function getUraDoraTiles(){ return uraDoraIndicators.map(getDoraNext).filter(Boolean); }
    function countDora(tiles, includeUra=false){
        let total=0;
        for(const d of getDoraTiles()) total += (tiles||[]).filter(t=>t.id===d.id).length;
        if(includeUra) for(const d of getUraDoraTiles()) total += (tiles||[]).filter(t=>t.id===d.id).length;
        return total;
    }
    function renderDoraIndicators(){
        const row=document.getElementById('dora-indicators-row'); if(!row) return;
        row.innerHTML='';
        for(let i=0;i<5;i++){ const el=document.createElement('div'); el.className='dora-tile-box'+(i===0?' dora-open':''); el.textContent=doraIndicators[i]?.val||''; if(i>0&&doraIndicators[i]) el.classList.add('revealed-kan'); row.appendChild(el); }
        const info=document.getElementById('kan-info'); if(info) info.textContent=`Rinshan ${Math.max(0,rinshanTiles.length-rinshanDrawIndex)} • Kandora ${doraIndicators.length}`;
        const kc=document.getElementById('kan-counter'); if(kc) kc.textContent=`KAN × ${kanCount}`;
    }
    function revealNextKandora(){
        if(doraIndicators.length>=5) return false;
        const idx=4+doraIndicators.length*2, next=deadWall[idx], ura=deadWall[idx+1];
        if(!next) return false; doraIndicators.push(next); if(ura) uraDoraIndicators.push(ura); renderDoraIndicators(); return true;
    }
    function drawRinshanTile(){ if(rinshanDrawIndex>=rinshanTiles.length) return null; const t=rinshanTiles[rinshanDrawIndex++]; renderDoraIndicators(); return t; }

    function tileCounts(tiles) {
        const counts = new Array(34).fill(0);
        (tiles || []).forEach(t => { if (t && Number.isInteger(t.id)) counts[t.id]++; });
        return counts;
    }

    function isSuitId(id) { return id >= 0 && id < 27; }
    function suitOfId(id) { return id < 9 ? 'man' : id < 18 ? 'pin' : id < 27 ? 'sou' : 'honor'; }
    function isTerminalOrHonor(t) { return t.type === 'honor' || t.num === 1 || t.num === 9; }
    function isSimple(t) { return t.type !== 'honor' && t.num >= 2 && t.num <= 8; }

    // Return all legal Chi patterns using the discarded tile.
    // Each result contains the two tiles that must be taken from the player's hand.
    function getChiCombinations(hand, tile) {
        if (!Array.isArray(hand) || !tile || tile.type === 'honor') return [];
        const nums = new Set(
            hand
                .filter(t => t && t.type === tile.type)
                .map(t => t.num)
        );
        const n = tile.num;
        const combinations = [];
        if (nums.has(n - 2) && nums.has(n - 1)) combinations.push([n - 2, n - 1]);
        if (nums.has(n - 1) && nums.has(n + 1)) combinations.push([n - 1, n + 1]);
        if (nums.has(n + 1) && nums.has(n + 2)) combinations.push([n + 1, n + 2]);
        return combinations;
    }

    function cloneCounts(counts) { return counts.slice(); }

    function canFormMelds(counts) {
        const first = counts.findIndex(c => c > 0);
        if (first === -1) return true;

        if (counts[first] >= 3) {
            counts[first] -= 3;
            if (canFormMelds(counts)) { counts[first] += 3; return true; }
            counts[first] += 3;
        }

        if (first < 27 && first % 9 <= 6 && counts[first + 1] > 0 && counts[first + 2] > 0) {
            counts[first]--; counts[first + 1]--; counts[first + 2]--;
            if (canFormMelds(counts)) {
                counts[first]++; counts[first + 1]++; counts[first + 2]++;
                return true;
            }
            counts[first]++; counts[first + 1]++; counts[first + 2]++;
        }
        return false;
    }

    function decomposeStandardCounts(counts) {
        const results = [];
        const seen = new Set();

        function recurse(c, pairId, groups) {
            const key = `${pairId}|${c.join(',')}`;
            if (seen.has(key)) return;
            seen.add(key);

            const first = c.findIndex(v => v > 0);
            if (first === -1) {
                results.push({ pairId, groups: groups.map(g => ({ ...g })) });
                return;
            }

            if (pairId === -1 && c[first] >= 2) {
                c[first] -= 2;
                recurse(c, first, groups);
                c[first] += 2;
            }

            if (c[first] >= 3) {
                c[first] -= 3;
                groups.push({ type: 'triplet', ids: [first, first, first] });
                recurse(c, pairId, groups);
                groups.pop();
                c[first] += 3;
            }

            if (first < 27 && first % 9 <= 6 && c[first + 1] > 0 && c[first + 2] > 0) {
                c[first]--; c[first + 1]--; c[first + 2]--;
                groups.push({ type: 'sequence', ids: [first, first + 1, first + 2] });
                recurse(c, pairId, groups);
                groups.pop();
                c[first]++; c[first + 1]++; c[first + 2]++;
            }
        }

        recurse(cloneCounts(counts), -1, []);
        return results;
    }

    function isChiitoitsuCounts(counts) {
        return counts.filter(c => c === 2).length === 7 && counts.every(c => c === 0 || c === 2);
    }

    function isKokushiCounts(counts) {
        const terminals = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
        let pair = false;
        for (const id of terminals) {
            if (counts[id] === 0) return false;
            if (counts[id] >= 2) pair = true;
        }
        return pair;
    }

    function checkWinningHand(tiles, meldCount = 0) {
        const expectedConcealedTotal = 14 - (meldCount * 3);
        if (!tiles || tiles.length !== expectedConcealedTotal) return false;
        const counts = tileCounts(tiles);
        if (isChiitoitsuCounts(counts) || isKokushiCounts(counts)) return true;
        return decomposeStandardCounts(counts).length > 0;
    }

    function getWaitIds(hand13, meldCount = 0) {
        if (!hand13 || hand13.length % 3 !== 1) return [];
        const waits = [];
        for (const tile of TILE_TYPES) {
            if (tileCounts([...hand13, tile]).some(c => c > 4)) continue;
            if (checkWinningHand([...hand13, tile], meldCount)) waits.push(tile.id);
        }
        return waits;
    }

    function isTenpai(hand, meldCount = 0) { return getWaitIds(hand, meldCount).length > 0; }

    function getRiichiDiscardIndices() {
        if (playerMelds[0].length !== 0 || playerHands[0].length !== 14) return [];
        const legal = [];
        for (let i = 0; i < playerHands[0].length; i++) {
            const testHand = playerHands[0].filter((_, idx) => idx !== i);
            if (isTenpai(testHand, 0)) legal.push(i);
        }
        return legal;
    }

    function hasAnyYaku(yaku) { return yaku.length > 0; }

    function getAllTilesForHand(hand, melds) {
        return [...hand, ...(melds || []).flat()];
    }


    function countOpenMeldTriplets(melds) {
        return (melds || []).filter(g => g.length >= 3 && g.every(t => t.id === g[0].id)).length;
    }

    function countClosedTriplets(groups, winId, isTsumo) {
        let n = 0;
        for (const g of groups) {
            if (g.type !== 'triplet') continue;
            if (!isTsumo && g.ids.includes(winId)) continue;
            n++;
        }
        return n;
    }

    function isValuePair(pairId, seatWind, roundWind) {
        return pairId >= 31 || pairId === 27 + WIND_ORDER.indexOf(seatWind) || pairId === 27 + WIND_ORDER.indexOf(roundWind);
    }

    function sequenceIsEdgeWait(seqIds, winId) {
        if (!seqIds.includes(winId)) return false;
        const idx = seqIds.indexOf(winId);
        const nums = seqIds.map(id => (id % 9) + 1);
        if (idx === 1) return false; // kanchan
        if (nums.includes(1) && winId === seqIds[0]) return false; // 123 on 1
        if (nums.includes(9) && winId === seqIds[2]) return false; // 789 on 9
        return true;
    }

    function evaluateStandardYaku(hand, melds, decomposition, winTile, isTsumo, pIdx) {
        const yaku = [];
        const closed = (melds || []).length === 0;
        const allTiles = getAllTilesForHand(hand, melds);
        const groups = decomposition.groups;
        const pairId = decomposition.pairId;
        const roundWind = 'E';
        const seatWind = PLAYER_SEAT_WINDS[pIdx] || 'S';

        if (pIdx === 0 ? isRiichi : aiRiichi[pIdx]) yaku.push({ name: 'Riichi', han: 1 });
        if (isTsumo && closed) yaku.push({ name: 'Menzen Tsumo', han: 1 });
        if (isTsumo && lastDrawWasRinshan) yaku.push({ name: 'Rinshan Kaihou', han: 1 });

        if (allTiles.every(isSimple)) yaku.push({ name: 'Tanyao', han: 1 });

        if (closed && groups.every(g => g.type === 'sequence') && !isValuePair(pairId, seatWind, roundWind) &&
            sequenceIsEdgeWait(groups.find(g => g.ids.includes(winTile.id))?.ids || [], winTile.id)) {
            yaku.push({ name: 'Pinfu', han: 1, pinfu: true });
        }

        const triplets = groups.filter(g => g.type === 'triplet');
        const allGroups = [...groups, ...((melds || []).map(g => ({
            type: g.every(t => t.id === g[0].id) ? 'triplet' : 'sequence',
            ids: g.map(t => t.id)
        })) )];
        const allTriplets = allGroups.filter(g => g.type === 'triplet');

        let yakuhai = 0;
        for (const g of allTriplets) {
            const id = g.ids[0];
            if (id >= 31) yakuhai++;
            if (id === 27 + WIND_ORDER.indexOf(roundWind)) yakuhai++;
            if (id === 27 + WIND_ORDER.indexOf(seatWind)) yakuhai++;
        }
        if (yakuhai) yaku.push({ name: `Yakuhai x${yakuhai}`, han: yakuhai });

        if (allTriplets.length === 4) yaku.push({ name: 'Toitoi', han: 2 });

        if (closed) {
            const seqKeys = groups.filter(g => g.type === 'sequence').map(g => g.ids.join('-'));
            const counts = {};
            seqKeys.forEach(k => counts[k] = (counts[k] || 0) + 1);
            const pairsOfSeq = Object.values(counts).filter(v => v >= 2).reduce((s,v) => s + Math.floor(v / 2), 0);
            if (pairsOfSeq > 0) yaku.push({ name: `Iipeiko x${pairsOfSeq}`, han: pairsOfSeq });
        }

        const seqSets = new Set(groups.filter(g => g.type === 'sequence').map(g => g.ids[0]));
        const hasSanshoku = [...seqSets].some(start => [start, start + 9, start + 18].every(x => seqSets.has(x)));
        if (hasSanshoku) yaku.push({ name: 'Sanshoku Doujun', han: closed ? 2 : 1 });

        const hasItsu = [0, 9, 18].some(base => [base, base + 3, base + 6].every(start => groups.some(g => g.type === 'sequence' && g.ids[0] === start)));
        if (hasItsu) yaku.push({ name: 'Ittsu', han: closed ? 2 : 1 });

        const allTermHonor = allTiles.every(isTerminalOrHonor);
        const allHonor = allTiles.every(t => t.type === 'honor');
        const allTerminal = allTiles.every(t => t.type !== 'honor' && (t.num === 1 || t.num === 9));
        if (allHonor) yaku.push({ name: 'Tsuuiisou', han: 13, yakuman: true });
        else if (allTerminal) yaku.push({ name: 'Chinroutou', han: 13, yakuman: true });
        else if (allTermHonor) yaku.push({ name: 'Honroutou', han: 2 });

        const suits = new Set(allTiles.filter(t => t.type !== 'honor').map(t => t.type));
        const hasHonors = allTiles.some(t => t.type === 'honor');
        if (suits.size === 1 && hasHonors) yaku.push({ name: 'Honitsu', han: closed ? 3 : 2 });
        if (suits.size === 1 && !hasHonors) yaku.push({ name: 'Chinitsu', han: closed ? 6 : 5 });

        const junchan = allGroups.every(g => {
            const ts = g.ids.map(id => TILE_TYPES[id]);
            return ts.some(t => t.type === 'honor' || t.num === 1 || t.num === 9);
        }) && allGroups.every(g => {
            if (g.type === 'triplet') return true;
            return g.ids.some(id => id % 9 === 0 || id % 9 === 8);
        }) && !hasHonors && groups.some(g => g.type === 'sequence');
        if (junchan) yaku.push({ name: 'Junchan', han: closed ? 3 : 2 });

        const chanta = allGroups.every(g => {
            const ts = g.ids.map(id => TILE_TYPES[id]);
            return ts.some(t => t.type === 'honor' || t.num === 1 || t.num === 9);
        }) && groups.some(g => g.type === 'sequence');
        if (chanta && !junchan) yaku.push({ name: 'Chanta', han: closed ? 2 : 1 });

        const concealedTriplets = countClosedTriplets(groups, winTile.id, isTsumo);
        if (concealedTriplets === 4) yaku.push({ name: 'Suuankou', han: 13, yakuman: true });
        else if (concealedTriplets >= 3) yaku.push({ name: 'Sanankou', han: 2 });

        return yaku;
    }

    function evaluateChiitoitsu(hand, melds, isTsumo, pIdx) {
        if ((melds || []).length) return [];
        const counts = tileCounts(hand);
        if (!isChiitoitsuCounts(counts)) return [];
        const allTiles = hand;
        const yaku = [{ name: 'Chiitoitsu', han: 2 }];
        if (allTiles.every(isSimple)) yaku.push({ name: 'Tanyao', han: 1 });
        const suits = new Set(allTiles.filter(t => t.type !== 'honor').map(t => t.type));
        const hasHonors = allTiles.some(t => t.type === 'honor');
        const allTH = allTiles.every(isTerminalOrHonor);
        if (allTH) yaku.push({ name: 'Honroutou', han: 2 });
        if (suits.size === 1 && hasHonors) yaku.push({ name: 'Honitsu', han: 3 });
        if (suits.size === 1 && !hasHonors) yaku.push({ name: 'Chinitsu', han: 6 });
        return yaku;
    }

    function evaluateYakumanSpecial(hand, melds) {
        if ((melds || []).length) return [];
        const counts = tileCounts(hand);
        if (isKokushiCounts(counts)) return [{ name: 'Kokushi Musou', han: 13, yakuman: true }];
        return [];
    }

    function calculateFu(decomp, hand, melds, winTile, isTsumo, pIdx, yaku) {
        if (yaku.some(y => y.name === 'Chiitoitsu')) return 25;
        if (yaku.some(y => y.name === 'Pinfu')) return isTsumo ? 20 : 30;

        const closed = (melds || []).length === 0;
        let fu = 20;
        if (isTsumo) fu += 2;
        else if (closed) fu += 10;

        if (isValuePair(decomp.pairId, PLAYER_SEAT_WINDS[pIdx] || 'S', 'E')) fu += 2;

        const allGroups = [
            ...decomp.groups.map(g => ({ ...g, open: false })),
            ...((melds || []).map(g => ({ type: g.every(t => t.id === g[0].id) ? 'triplet' : 'sequence', ids: g.map(t => t.id), open: true })))
        ];
        for (const g of allGroups) {
            if (g.type !== 'triplet') continue;
            const t = TILE_TYPES[g.ids[0]];
            const terminalHonor = isTerminalOrHonor(t);
            const open = g.open;
            const isKan = g.ids.length === 4;
            if (isKan) fu += terminalHonor ? (open ? 16 : 32) : (open ? 8 : 16);
            else fu += terminalHonor ? (open ? 4 : 8) : (open ? 2 : 4);
        }

        if (decomp.groups.every(g => g.type === 'sequence') &&
            sequenceIsEdgeWait(decomp.groups.find(g => g.ids.includes(winTile.id))?.ids || [], winTile.id)) {
            fu += 0; // ryanmen has no extra fu
        } else {
            fu += 2; // tanki / kanchan / penchan
        }

        return Math.max(20, Math.ceil(fu / 10) * 10);
    }

    function calculateRiichiPoints(han, fu, isDealer, isTsumo) {
        if (han >= 13) return isTsumo
            ? (isDealer ? { total: 24000, detail: 'Semua lawan bayar 8000' } : { total: 16000, detail: 'Oya bayar 8000, Ko masing-masing 4000' })
            : { total: isDealer ? 48000 : 32000, detail: 'Bayaran Yakuman dari lawan' };

        let basePoint;
        if (han >= 11) basePoint = 6000;
        else if (han >= 8) basePoint = 4000;
        else if (han >= 6) basePoint = 3000;
        else if (han >= 5 || (han === 4 && fu >= 40) || (han === 3 && fu >= 70)) basePoint = 2000;
        else basePoint = Math.min(fu * Math.pow(2, han + 2), 2000);

        if (isTsumo) {
            if (isDealer) {
                const pay = ceil100(basePoint * 2);
                return { total: pay * 3, detail: `Setiap Ko bayar ${pay}` };
            }
            const payDealer = ceil100(basePoint * 2);
            const payOther = ceil100(basePoint);
            return { total: payDealer + payOther * 2, detail: `Oya: ${payDealer}, Ko: ${payOther}` };
        }

        const pay = ceil100(basePoint * (isDealer ? 6 : 4));
        return { total: pay, detail: `Lawan bayar ${pay}` };
    }

    function evaluateRiichiHand(pIdx, winningTile, isTsumo) {
        const hand = [...playerHands[pIdx]];
        const melds = playerMelds[pIdx] || [];
        if (!isTsumo && winningTile) hand.push(winningTile);
        if (hand.length + melds.length * 3 !== 14) return null;

        const isDealer = pIdx === currentDealerIdx;
        const actualWinTile = winningTile || (pIdx === currentTurn ? drawnTile : null) || hand[hand.length - 1];
        const candidates = [];
        const special = evaluateYakumanSpecial(hand, melds);
        if (special.length) candidates.push({ yaku: special, fu: 0, decomp: null });

        const chiitoi = evaluateChiitoitsu(hand, melds, isTsumo, pIdx);
        if (chiitoi.length) candidates.push({ yaku: chiitoi, fu: 25, decomp: null });

        const decomps = decomposeStandardCounts(tileCounts(hand));
        for (const dec of decomps) {
            const yaku = evaluateStandardYaku(hand, melds, dec, actualWinTile, isTsumo, pIdx);
            if (!hasAnyYaku(yaku)) continue;
            const hasYakuman = yaku.some(y => y.yakuman);
            const includeUra = (pIdx === 0 ? isRiichi : aiRiichi[pIdx]) && canRevealUraDora;
            const dora = hasYakuman ? 0 : countDora(getAllTilesForHand(hand, melds), includeUra);
            if (dora > 0) yaku.push({ name: `${includeUra ? 'Dora + Ura Dora' : 'Dora'} x${dora}`, han: dora, dora: true });
            const han = yaku.reduce((sum, y) => sum + y.han, 0);
            candidates.push({ yaku, fu: calculateFu(dec, hand, melds, actualWinTile, isTsumo, pIdx, yaku), decomp: dec, han });
        }

        if (!candidates.length) return null;
        for (const c of candidates) c.han = c.han ?? c.yaku.reduce((s, y) => s + y.han, 0);
        candidates.sort((a, b) => (b.han * 100 + b.fu) - (a.han * 100 + a.fu));
        const best = candidates[0];
        const points = calculateRiichiPoints(best.han, best.fu, isDealer, isTsumo);
        return {
            valid: true,
            han: best.han,
            fu: best.fu,
            yaku: best.yaku,
            yakuStr: best.yaku.map(y => `${y.name} (${y.han} Han)`).join(', '),
            points: points.total,
            detail: points.detail
        };
    }

    // Compatibility wrapper used by the rest of the game.
    function evaluateYakuAndScore(pIdx, winningTile, isTsumo) {
        return evaluateRiichiHand(pIdx, winningTile, isTsumo) || {
            valid: false, han: 0, fu: 0, yaku: [], yakuStr: 'Tidak ada yaku', points: 0, detail: 'Tangan tidak legal untuk menang.'
        };
    }

    function getPermanentFuritenForPlayer0() {
        const waits = getCurrentWaitIdsForPlayer0();
        return waits.length > 0 && waits.some(id => playerRivers[0].some(t => t.id === id));
    }

    function checkFuriten(winningTileId){
        const ownDiscards=playerRivers[0].some(t=>t.id===winningTileId);
        return ownDiscards || temporaryFuriten[0] || riichiFuriten[0];
    }
    function getCurrentWaitIdsForPlayer0(){
        const h=playerHands[0]||[];
        if(h.length===13) return getWaitIds(h,playerMelds[0].length);
        if(h.length===14){ const out=new Set(); h.forEach((_,i)=>getWaitIds(h.filter((__,j)=>j!==i),playerMelds[0].length).forEach(id=>out.add(id))); return [...out]; }
        return [];
    }
    function updateFuritenStatusUI(){
        const panel=document.getElementById('furiten-panel');
        const el=document.getElementById('furiten-status');
        if(!panel||!el) return;
        const activePermanent=!!riichiFuriten[0] || getPermanentFuritenForPlayer0();
        const activeTemporary=!!temporaryFuriten[0] && !activePermanent;
        if(!activePermanent && !activeTemporary){
            panel.classList.remove('is-active'); panel.style.display='none';
            el.className='furiten-status';
            el.textContent='';
            return;
        }
        panel.style.display='block';
        el.className='furiten-status '+(activePermanent?'perma':'temp');
        el.textContent=activePermanent ? 'Permanent Furiten — Ron dilarang' : 'Temporary Furiten — tunggu discard berikutnya';
    }
    function checkFuritenStatusUI(){
        updateFuritenStatusUI();
        const el=document.getElementById('furiten-status'); if(!el) return;
        if(!riichiFuriten[0] && !temporaryFuriten[0]) return;
        const waits=getCurrentWaitIdsForPlayer0().map(id=>TILE_TYPES[id]?.val).filter(Boolean);
        el.textContent += waits.length ? ` • Machi: ${waits.join(' ')}` : '';
    }
    function skipWinningTileDemo(){
        let tile=lastDiscardedTile; const waits=getCurrentWaitIdsForPlayer0();
        if((!tile||!waits.includes(tile.id))&&waits.length) tile=TILE_TYPES[waits[0]];
        if(!tile) return;
        temporaryFuriten[0]=true;
        if(isRiichi) riichiFuriten[0]=true;
        pendingPlayerActions=pendingPlayerActions.filter(a=>a!=='Ron');
        updateFuritenStatusUI();
    }
    function clearTemporaryFuritenAfterDiscard(){
        if(!isRiichi && temporaryFuriten[0]){
            temporaryFuriten[0]=false;
            updateFuritenStatusUI();
        }
    }

    function formatYakuNames(result) {
        if (!result || !result.yaku || !result.yaku.length) return 'Tidak ada yaku';
        const names = result.yaku.filter(y => !y.dora).map(y => y.name);
        return names.length ? names.join(' • ') : 'Tidak ada yaku';
    }

    function evaluateWaitOutcome(waitIds) {
        let best = null;
        for (const id of waitIds || []) {
            const tile = TILE_TYPES[id];
            if (!tile) continue;
            const results = [
                evaluateYakuAndScore(0, tile, false),
                evaluateYakuAndScore(0, tile, true)
            ];
            for (const r of results) {
                if (r && r.valid && (!best || r.han > best.han || (r.han === best.han && r.fu > best.fu))) best = r;
            }
        }
        return best;
    }

    function updateHandStatus() {
        const box = document.getElementById('hand-status');
        const main = document.getElementById('hand-status-main');
        const sub = document.getElementById('hand-status-sub');
        if (!box || !main || !sub || !playerHands[0]) return;

        const actionOpen = box.classList.contains('action-open');
        box.classList.remove('ready','tenpai','warning','blocked');
        if (actionOpen) box.classList.add('action-open');
        const hand = playerHands[0];
        const meldCount = (playerMelds[0] || []).length;
        const total = hand.length + meldCount * 3;

        if (total === 14) {
            const win = evaluateYakuAndScore(0, null, true);
            const structural = checkWinningHand(hand, meldCount);
            if (win.valid) {
                box.classList.add('ready');
                main.textContent = `BISA MENANG • ${win.han} Han • ${win.fu} Fu`;
                sub.textContent = `Yaku: ${formatYakuNames(win)}`;
                return;
            }
            if (structural) {
                box.classList.add('blocked');
                main.textContent = 'BENTUK LENGKAP • NO YAKU';
                sub.textContent = 'Belum dapat menang. Pastikan ada minimal 1 yaku.';
                return;
            }
        }

        const expected13 = 13 - meldCount * 3;
        if (hand.length === expected13) {
            const waits = getWaitIds(hand, meldCount);
            if (waits.length) {
                const outcome = evaluateWaitOutcome(waits);
                box.classList.add('tenpai');
                main.textContent = `TENPAI • ${waits.length} WAIT`;
                sub.textContent = outcome && outcome.valid
                    ? `Menang pada: ${waits.map(id => TILE_TYPES[id]?.val).filter(Boolean).join(' ')} • Yaku: ${formatYakuNames(outcome)} • ${outcome.han} Han`
                    : 'Belum bisa menang: wait yang tersedia belum menghasilkan yaku.';
            } else {
                box.classList.add('warning');
                main.textContent = 'BELUM TENPAI';
                sub.textContent = 'Prioritaskan membentuk 4 set + 1 pasangan.';
            }
            return;
        }

        box.classList.add('warning');
        main.textContent = 'STATUS TANGAN';
        sub.textContent = '4 set + 1 pasangan + minimal 1 yaku untuk menang.';
    }

    function updateScoresUI() {
        for (let i = 0; i < 4; i++) setText(`score-${i}`, playerScores[i]);
        setText('riichi-stick-counter', `1000 × ${riichiSticks}`);
    }

    // GAME INITIALIZATION
    function start4PGame(diff, isMultiplayer) {
        roundActive = false;
        roundEnding = false;
        forcePlayMusic();
        aiDifficulty = diff;
        isMultiplayerMode = isMultiplayer;
        currentRoundIndex = 0;
        playerScores = [25000, 25000, 25000, 25000];
        
        nav('screen-game');
        setupRound();
    }

    function setupRound() {
        clearInterval(timerInterval);
        roundActive = false;
        roundEnding = false;
        if (aiMoveTimer) { clearTimeout(aiMoveTimer); aiMoveTimer = null; }
        if (autoDiscardTimer) { clearTimeout(autoDiscardTimer); autoDiscardTimer = null; }
        roundToken++;
        roundStartScores = [...playerScores];
        setDisplay('modal-result', 'none');
        setDisplay('action-overlay', 'none');
        extraTimeBank = 20;
        setText('player-time-bank', `+${extraTimeBank}s`);

        let roundNames = ['East 1', 'East 2', 'East 3', 'East 4', 'East 5 (Extra)'];
        setText('round-title-display', roundNames[currentRoundIndex] || 'East 1');

        fullDeck = [];
        TILE_TYPES.forEach(t => { for (let i = 0; i < 4; i++) fullDeck.push({ ...t, uniqueId: Math.random() }); });
        fullDeck.sort(() => Math.random() - 0.5);

        deadWall = fullDeck.splice(0, 14);
        rinshanTiles = deadWall.slice(0,4); rinshanDrawIndex = 0;
        doraIndicators = deadWall[4] ? [deadWall[4]] : [];
        uraDoraIndicators = deadWall[5] ? [deadWall[5]] : [];
        kanCount = 0; canRevealUraDora = false; lastDrawWasRinshan = false;

        playerHands = [[], [], [], []];
        playerRivers = [[], [], [], []];
        playerMelds = [[], [], [], []]; 
        aiRiichi = [false, false, false, false];
        temporaryFuriten = [false, false, false, false];
        riichiFuriten = [false, false, false, false];
        pendingPlayerActions = [];
        riichiDiscardIndices = [];
        isRiichi = false; pendingRiichi = false; riichiSticks = 0;
        lastDiscardedTile = null; lastDiscarderIdx = -1;
        drawnTile = null; isDiscardable = false; isActionPhase = false;
        setDisplay('riichi-effect', 'none');
        
        document.querySelectorAll('.river-container').forEach(r => r.innerHTML = '');
        document.getElementById('player-melds-container').innerHTML = '';
        for(let i=1; i<=3; i++) {
            let enemyMeldEl = document.getElementById(`enemy-melds-${i}`);
            if (enemyMeldEl) enemyMeldEl.innerHTML = '';
        }

        updateScoresUI();

        for (let i = 0; i < 13; i++) {
            for (let p = 0; p < 4; p++) playerHands[p].push(fullDeck.pop());
        }

        setText('dora-indicator-tile', deadWall[4]?.val || '—');
        renderDoraIndicators();
        updateFuritenStatusUI();

        if (autoSortSetting) autoSortHand();
        else renderPlayerHand();

        renderEnemyHands();
        updateHandStatus();
        currentTurn = 0;
        roundActive = true;
        roundEnding = false;
        processTurn();
    }

    function startTimer(forAction = false) {
        clearInterval(timerInterval);
        isActionPhase = forAction;
        
        if (currentTurn !== 0 && !forAction) {
            const timerEl = byId('turn-timer-display');
            if (timerEl) timerEl.style.color = '#7f8c8d';
            return;
        }

        baseTime = 10;
        updateTimerUI();

        timerInterval = setInterval(() => {
            if (baseTime > 0) {
                baseTime--;
            } else if (extraTimeBank > 0) {
                extraTimeBank--;
            } else {
                clearInterval(timerInterval);
                if (isActionPhase) triggerAction('Skip');
                else autoDiscard();
            }
            updateTimerUI();
        }, 1000);
    }

    function updateTimerUI() {
        const timerEl = byId('turn-timer-display');
        const bankEl = byId('player-time-bank');
        if (timerEl) {
            if (baseTime > 0) { timerEl.textContent = baseTime; timerEl.style.color = '#fff'; }
            else { timerEl.textContent = extraTimeBank; timerEl.style.color = '#e74c3c'; }
        }
        if (bankEl) bankEl.textContent = `+${extraTimeBank}s`;
    }

    function autoDiscard() {
        if (!isDiscardable || playerHands[0].length === 0) return;
        let idx = playerHands[0].length - 1;
        if (pendingRiichi && riichiDiscardIndices.length) idx = riichiDiscardIndices[0];
        discardTile(idx);
    }

    function autoSortHand() {
        playerHands[0].sort((a, b) => a.id - b.id);
        renderPlayerHand();
    }

    let selectedTileIndex = -1;
    let selectedTileId = null;
    let tapState = { index:-1, time:0 };

    function clearSelectedTile(){
        selectedTileIndex = -1;
        selectedTileId = null;
        tapState = { index:-1, time:0 };
        document.querySelectorAll('#player-hand-tiles .tile.selected-tile').forEach(el=>el.classList.remove('selected-tile'));
        clearDiscardHighlights();
    }

    function selectHandTile(index, el){
        const tile = playerHands[0]?.[index];
        if(!tile) return;
        document.querySelectorAll('#player-hand-tiles .tile.selected-tile').forEach(node=>node.classList.remove('selected-tile'));
        selectedTileIndex = index;
        selectedTileId = tile.id;
        el.classList.add('selected-tile');
        highlightMatchingDiscards(tile.id);
    }

    function discardSelectedTile(index){
        if(!isDiscardable) return false;
        if(pendingRiichi && !riichiDiscardIndices.includes(index)) return false;
        clearSelectedTile();
        discardTile(index);
        return true;
    }

    function handleTileTap(index, el){
        if(!isDiscardable) { selectHandTile(index, el); return; }
        const now=performance.now();
        if(selectedTileIndex===index && now-tapState.time <= 480){
            discardSelectedTile(index);
            return;
        }
        if(selectedTileIndex!==index) selectHandTile(index, el);
        else selectHandTile(index, el);
        tapState={index,time:now};
    }

    function handleTilePointerDown(ev, index, el){
        if(ev.pointerType==='mouse' && ev.button!==0) return;
        el._pointerStartX=ev.clientX;
        el._pointerStartY=ev.clientY;
        el._pointerStartTime=performance.now();
        if(el.setPointerCapture) { try{el.setPointerCapture(ev.pointerId)}catch(e){} }
    }

    function handleTilePointerUp(ev, index, el){
        if(ev.pointerType==='mouse' && ev.button!==0) return;
        const dx=ev.clientX-(el._pointerStartX||ev.clientX);
        const dy=ev.clientY-(el._pointerStartY||ev.clientY);
        const dt=performance.now()-(el._pointerStartTime||performance.now());
        const swipeUp = dy < -55 && Math.abs(dy) > Math.abs(dx)*1.15 && dt < 700;
        if(swipeUp){
            if(selectedTileIndex!==index) selectHandTile(index, el);
            discardSelectedTile(index);
            return;
        }
        if(Math.abs(dx)>12 || Math.abs(dy)>12) return;
        handleTileTap(index, el);
    }

    function renderPlayerHand(){
        const c=byId('player-hand-tiles'); if(!c) return; c.innerHTML=''; const waitsByDiscard={};
        if(playerHands[0].length===14&&!isRiichi) playerHands[0].forEach((_,i)=>waitsByDiscard[i]=getWaitIds(playerHands[0].filter((__,j)=>j!==i),playerMelds[0].length));
        if(selectedTileIndex>=playerHands[0].length) clearSelectedTile();
        playerHands[0].forEach((t,i)=>{
            const el=document.createElement('div');
            el.className='tile'+(t===drawnTile?' drawn-tile-gap':'')+(riichiDiscardIndices.includes(i)?' riichi-legal-discard':'')+(i===selectedTileIndex?' selected-tile':'');
            el.tabIndex=0;
            const waits=waitsByDiscard[i]||[]; const waitText=waits.length?waits.map(id=>TILE_TYPES[id]?.val).filter(Boolean).join(' '):'—'; const yakuText=t.id===2?'No Yaku (simulasi 3-man)':'Terdeteksi';
            el.innerHTML=`<span class="tile-char">${t.val}</span><span class="tile-helper">${t.helper}</span><span class="machi-bubble ${t.id===2?'no-yaku':''}"><strong>Machi: ${waitText}</strong><span>Yaku: ${yakuText}</span></span>`;
            el.addEventListener('pointerdown',ev=>handleTilePointerDown(ev,i,el));
            el.addEventListener('pointerup',ev=>handleTilePointerUp(ev,i,el));
            el.addEventListener('focus',()=>{ selectHandTile(i,el); });
            el.addEventListener('blur',()=>{ if(selectedTileIndex===i) clearSelectedTile(); });
            el.addEventListener('contextmenu',ev=>ev.preventDefault());
            c.appendChild(el);
        });
        setText('wall-count', `x ${fullDeck.length}`); updateFuritenStatusUI(); updateHandStatus();
    }
    function highlightMatchingDiscards(id){document.querySelectorAll('.discard-tile').forEach(el=>{if(Number(el.dataset.tileId)===id)el.classList.add('discard-highlight')})}
    function clearDiscardHighlights(){document.querySelectorAll('.discard-tile.discard-highlight').forEach(el=>el.classList.remove('discard-highlight'))}

    function renderPlayerMelds() {
        const container = document.getElementById('player-melds-container');
        container.innerHTML = '';
        playerMelds[0].forEach(group => {
            let groupEl = document.createElement('div');
            groupEl.className = 'meld-group';
            group.forEach(t => {
                let tileEl = document.createElement('div');
                tileEl.className = 'tile';
                tileEl.innerHTML = `<span class="tile-char">${t.val}</span><span class="tile-helper">${t.helper}</span>`;
                groupEl.appendChild(tileEl);
            });
            container.appendChild(groupEl);
        });
    }

    function renderEnemyMelds(pIdx) {
        const container = document.getElementById(`enemy-melds-${pIdx}`);
        if (!container) return;
        container.innerHTML = '';
        playerMelds[pIdx].forEach(group => {
            let groupEl = document.createElement('div');
            groupEl.className = 'meld-group';
            group.forEach(t => {
                let tileEl = document.createElement('div');
                tileEl.className = 'tile';
                tileEl.innerHTML = `<span class="tile-char">${t.val}</span>`;
                groupEl.appendChild(tileEl);
            });
            container.appendChild(groupEl);
        });
    }

    function renderEnemyHands() {
        ['enemy-hand-top', 'enemy-hand-left', 'enemy-hand-right'].forEach((id, idx) => {
            const el = byId(id);
            if (!el) return;
            el.innerHTML = '';
            for (let i = 0; i < playerHands[idx+1].length; i++) {
                let b = document.createElement('div');
                b.className = 'tile-back';
                el.appendChild(b);
            }
        });
    }

    function updateTurnHighlight() {
        const centerBox = byId('center-board-box');
        const colors = ['#2ecc71', '#f39c12', '#e74c3c', '#9b59b6'];
        if (centerBox) centerBox.style.borderColor = colors[currentTurn] || colors[0];
    }

    function processTurn(options = {}) {
        if (!roundActive || roundEnding) return;
        const drawTile = options.drawTile !== false;
        updateTurnHighlight();
        if (!playerHands[currentTurn]) return;

        if (drawTile) {
            if (fullDeck.length === 0) {
                endRound("Draw (Ryuukyoku)", "Dinding kartu telah habis!");
                return;
            }
            drawnTile = fullDeck.pop();
            lastDrawWasRinshan = false;
            playerHands[currentTurn].push(drawnTile);
        }

        if (currentTurn === 0) {
            if (autoSortSetting) autoSortHand();
            isDiscardable = true;
            renderPlayerHand();
            updateHandStatus();
            
            let actions = [];
            let currentTotalTiles = playerHands[0].length + (playerMelds[0].length * 3);
            
            if (currentTotalTiles === 14) {
                const tsumoEval = evaluateYakuAndScore(0, null, true);
                if (tsumoEval.valid && tsumoEval.points > 0) actions.push('Tsumo');
            }
            
            if (!isRiichi && playerScores[0] >= 1000 && playerMelds[0].length === 0 && getRiichiDiscardIndices().length > 0) {
                actions.push('Riichi');
            }
            if (!isRiichi && (getClosedKanOptions(0).length > 0 || getShouminkanOptions(0).length > 0)) {
                actions.push('Kan');
            }
            
            if (actions.length > 0) {
                showAvailableActions(actions);
            } else {
                if (isRiichi) {
                    if (autoDiscardTimer) clearTimeout(autoDiscardTimer);
                    const token = roundToken;
                    autoDiscardTimer = setTimeout(() => { if (token === roundToken) autoDiscard(); }, 800); 
                } else {
                    startTimer(false);
                }
            }
        } else {
            // AI TURN BOT LOGIC
            isDiscardable = false;
            renderEnemyHands();
            startTimer(false);

            // AI Kan: closed kan / added kan before discard
            if (!aiRiichi[currentTurn]) {
                const aiUpgrade = getShouminkanOptions(currentTurn);
                if (aiUpgrade.length) { executeShouminkan(currentTurn, aiUpgrade[0]); return; }
                const aiClosedKan = getClosedKanOptions(currentTurn);
                if (aiClosedKan.length) { executeAnkan(currentTurn, aiClosedKan[0]); return; }
            }

            // Check AI TSUMO Win
            if (checkWinningHand(playerHands[currentTurn], playerMelds[currentTurn].length)) {
                canRevealUraDora = aiRiichi[currentTurn];
                let evalScore = evaluateYakuAndScore(currentTurn, null, true);
                if (!evalScore.valid) { /* structural agari without yaku: continue play */ } else {
                playerScores[currentTurn] += evalScore.points;
                let pNames = ["You", "P1 (East)", "P2 (North)", "P3 (West)"];
                endRound(`TSUMO by ${pNames[currentTurn]}!`, `${evalScore.yakuStr} - ${evalScore.points} Pts`);
                return;
                }
            }

            // Check AI Riichi Declaration
            if (!aiRiichi[currentTurn] && playerMelds[currentTurn].length === 0 && isTenpai(playerHands[currentTurn].slice(0, -1))) {
                aiRiichi[currentTurn] = true;
                playerScores[currentTurn] -= 1000;
                riichiSticks++;
                updateScoresUI();
            }
            
            let delay = aiDifficulty === 'Easy' ? 1000 : 500;
            const token = roundToken;
            if (aiMoveTimer) clearTimeout(aiMoveTimer);
            aiMoveTimer = setTimeout(() => {
                aiMoveTimer = null;
                if (!roundActive || roundEnding || token !== roundToken || !playerHands[currentTurn]) return;
                let hand = playerHands[currentTurn];
                let discardIdx = 0;

                if (aiRiichi[currentTurn]) {
                    // Discard drawn tile if in Riichi
                    discardIdx = hand.indexOf(drawnTile);
                    if (discardIdx === -1) discardIdx = hand.length - 1;
                } else {
                    // Smart Discard: Prioritize isolated Honor tiles -> Terminals (1/9)
                    let honorIdx = hand.findIndex(t => t.type === 'honor');
                    let terminalIdx = hand.findIndex(t => t.num === 1 || t.num === 9);
                    
                    if (honorIdx !== -1) discardIdx = honorIdx;
                    else if (terminalIdx !== -1) discardIdx = terminalIdx;
                    else discardIdx = Math.floor(Math.random() * hand.length);
                }

                let discarded = hand.splice(discardIdx, 1)[0];
                drawnTile = null;
                commitDiscard(currentTurn, discarded);
            }, delay);
        }
    }

    function discardTile(index) {
        if (!isDiscardable) return;
        if (pendingRiichi && !riichiDiscardIndices.includes(index)) return;
        isDiscardable = false;
        clearInterval(timerInterval);
        
        let discarded = playerHands[0].splice(index, 1)[0];
        drawnTile = null;
        selectedTileIndex = -1;
        selectedTileId = null;
        tapState = { index:-1, time:0 };
        renderPlayerHand();
        commitDiscard(0, discarded);
    }

    function commitDiscard(pIdx, tile) {
        if (!roundActive || roundEnding || !tile) return;
        playerRivers[pIdx].push(tile);
        lastDiscardedTile = tile; 
        lastDiscarderIdx = pIdx;  
        
        const riverIds = ['river-bottom', 'river-right', 'river-top', 'river-left'];
        const riverEl = byId(riverIds[pIdx]);
        let dEl = document.createElement('div');
        dEl.className = 'discard-tile';
        
        if (pIdx === 0 && pendingRiichi) {
            isRiichi = true;
            pendingRiichi = false;
            riichiDiscardIndices = [];
            playerScores[0] -= 1000;
            riichiSticks++;
            updateScoresUI();
            dEl.classList.add('riichi-tile'); 
            setDisplay('riichi-effect', 'block'); 
        } else if (pIdx !== 0 && aiRiichi[pIdx] && playerRivers[pIdx].length === 1) {
            dEl.classList.add('riichi-tile');
        }

        dEl.dataset.tileId = String(tile.id);
        dEl.innerHTML = `<span class="tile-char">${tile.val}</span><span class="tile-helper">${tile.helper}</span>`;
        if (riverEl) riverEl.appendChild(dEl);
        clearTemporaryFuritenAfterDiscard();

        // Check if ANY AI Bot calls RON from discarded tile
        for (let p = 1; p < 4; p++) {
            if (p !== pIdx) {
                let isWin = checkWinningHand([...playerHands[p], tile], playerMelds[p].length);
                if (isWin) {
                    let evalScore = evaluateYakuAndScore(p, tile, false);
                    if (!evalScore.valid) continue;
                    playerScores[p] += evalScore.points;
                    playerScores[pIdx] -= evalScore.points;
                    let pNames = ["You", "Player 1 (East)", "Player 2 (North)", "Player 3 (West)"];
                    endRound(`RON by ${pNames[p]}!`, `${evalScore.yakuStr} (+${evalScore.points} Pts paid by ${pNames[pIdx]})`);
                    return;
                }
            }
        }

        // AI open Kan response to a player's discard.
        for (let p = 1; p < 4; p++) {
            if (p !== pIdx && !aiRiichi[p]) {
                const same = playerHands[p].filter(t => t.id === tile.id).length;
                if (same >= 3 && kanCount < 4) {
                    lastDiscardedTile = tile;
                    lastDiscarderIdx = pIdx;
                    executeKan(p);
                    return;
                }
            }
        }

        // Check Player actions on AI Discard
        if (pIdx !== 0 && !isRiichi) {
            let actions = [];
            let isWinning = checkWinningHand([...playerHands[0], tile], playerMelds[0].length);
            let ronEval = isWinning ? evaluateYakuAndScore(0, tile, false) : null;
            let isInFuriten = checkFuriten(tile.id);

            if (isWinning && ronEval && ronEval.valid && !isInFuriten) actions.push('Ron');

            let matchCount = playerHands[0].filter(t => t.id === tile.id).length;
            if (matchCount >= 2) actions.push('Pon');
            if (matchCount >= 3) actions.push('Kan');

            if (pIdx === 3 && getChiCombinations(playerHands[0], tile).length > 0) actions.push('Chi');

            if (actions.length > 0) {
                actions.push('Skip');
                showAvailableActions(actions);
            } else {
                nextTurn();
            }
        } 
        else if (pIdx !== 0 && isRiichi) {
            let isWinning = checkWinningHand([...playerHands[0], tile], playerMelds[0].length);
            let ronEval = isWinning ? evaluateYakuAndScore(0, tile, false) : null;
            let isInFuriten = checkFuriten(tile.id);
            if (isWinning && ronEval && ronEval.valid && !isInFuriten) showAvailableActions(['Ron', 'Skip']);
            else nextTurn();
        } else {
            nextTurn();
        }
    }

    function showAvailableActions(actionsList) {
        const overlay = byId('action-overlay');
        if (!overlay) { pendingPlayerActions = actionsList ? [...actionsList] : []; return; }
        overlay.innerHTML = '';
        pendingPlayerActions = actionsList ? [...actionsList] : [];
        if (!actionsList || actionsList.length === 0) {
            overlay.style.display = 'none';
            document.getElementById('hand-status')?.classList.remove('action-open');
            return;
        }

        actionsList.forEach(act => {
            let btn = document.createElement('button');
            btn.className = `act-btn btn-${act.toLowerCase()}`;
            btn.textContent = act === 'Skip' && actionsList.includes('Ron') ? 'Lewatkan Kartu Menang' : act;
            btn.onclick = () => triggerAction(act);
            overlay.appendChild(btn);
        });
        
        overlay.style.display = 'flex';
        document.getElementById('hand-status')?.classList.add('action-open');
        startTimer(true);
    }

    function triggerAction(act) {
        clearInterval(timerInterval);
        setDisplay('action-overlay', 'none');
        document.getElementById('hand-status')?.classList.remove('action-open');
        
        if (act === 'Ron' || act === 'Tsumo') {
            pendingPlayerActions = [];
            riichiDiscardIndices = [];
            canRevealUraDora = isRiichi;
            let evalScore = evaluateYakuAndScore(0, act === 'Ron' ? lastDiscardedTile : null, act === 'Tsumo');
            if (!evalScore.valid || evalScore.points <= 0) return;
            playerScores[0] += evalScore.points;
            if (act === 'Ron' && lastDiscarderIdx !== -1) {
                playerScores[lastDiscarderIdx] -= evalScore.points;
            }
            endRound(`${act.toUpperCase()} WIN!`, `${evalScore.yakuStr} (+${evalScore.points} Poin)\n${evalScore.detail}`);
            return;
        }
        
        if (act === 'Riichi') {
            if (playerScores[0] < 1000 || isRiichi) return;
            riichiDiscardIndices = getRiichiDiscardIndices();
            if (!riichiDiscardIndices.length) return;
            pendingRiichi = true;
            renderPlayerHand();
            startTimer(false); 
            return;
        }

        if (act === 'Pon') return executePon(0);
        if (act === 'Kan') { const up=getShouminkanOptions(0); if(up.length) return executeShouminkan(0,up[0]); const opts=getClosedKanOptions(0); return opts.length ? executeAnkan(0,opts[0]) : executeKan(0); }
        if (act === 'Chi') return executeChi(0);

        if (act === 'Skip') {
            if (pendingPlayerActions.includes('Ron') && currentTurn !== 0) {
                temporaryFuriten[0] = true;
                if (isRiichi) riichiFuriten[0] = true;
                updateFuritenStatusUI();
            }
            pendingPlayerActions = [];
            if (currentTurn === 0 && drawnTile !== null) {
                if (isRiichi) autoDiscard();
                else startTimer(false);
            } else {
                nextTurn();
            }
        }
    }

    function removeLastDiscard() {
        playerRivers[lastDiscarderIdx].pop(); 
        let riverEl = byId(['river-bottom', 'river-right', 'river-top', 'river-left'][lastDiscarderIdx]);
        if (riverEl && riverEl.lastChild) riverEl.removeChild(riverEl.lastChild);
    }

    function executePon(playerIdx) {
        let count = 0, indicesToRemove = [];
        for (let i = playerHands[playerIdx].length - 1; i >= 0; i--) {
            if (playerHands[playerIdx][i].id === lastDiscardedTile.id && count < 2) {
                indicesToRemove.push(i); count++;
            }
        }
        let ponTiles = [];
        indicesToRemove.forEach(idx => ponTiles.push(playerHands[playerIdx].splice(idx, 1)[0]));
        ponTiles.push(lastDiscardedTile);
        playerMelds[playerIdx].push(ponTiles);

        removeLastDiscard();
        if (playerIdx === 0) {
            if (autoSortSetting) autoSortHand();
            renderPlayerMelds();
        } else {
            renderEnemyMelds(playerIdx);
        }

        currentTurn = playerIdx; isDiscardable = (playerIdx === 0); drawnTile = null; 
        if (playerIdx === 0) startTimer(false); else processTurn();
    }

    function takeTilesById(hand,tileId,count){const out=[];for(let i=hand.length-1;i>=0&&out.length<count;i--)if(hand[i].id===tileId)out.push(hand.splice(i,1)[0]);return out;}
    function continueAfterKanDraw(playerIdx) {
        if (!roundActive || roundEnding) return false;
        currentTurn = playerIdx;
        isDiscardable = playerIdx === 0;
        if (playerIdx === 0) {
            if (autoSortSetting) autoSortHand();
            renderPlayerMelds();
            renderPlayerHand();
            updateHandStatus();
            startTimer(false);
        } else {
            renderEnemyMelds(playerIdx);
            processTurn({ drawTile: false });
        }
        return true;
    }

    function finishKan(playerIdx, kanTiles, sourceDiscard = true) {
        if (!roundActive || roundEnding || kanCount >= 4 || kanTiles.length !== 4) return false;
        playerMelds[playerIdx].push(kanTiles);
        kanCount++;
        revealNextKandora();
        const r = drawRinshanTile();
        lastDrawWasRinshan = true;
        if (!r) {
            endRound('KAN ABORT', 'Tidak ada tile Rinshan tersisa.');
            return false;
        }
        if (sourceDiscard) removeLastDiscard();
        playerHands[playerIdx].push(r);
        drawnTile = r;
        return continueAfterKanDraw(playerIdx);
    }

    function executeKan(playerIdx) {
        if (!lastDiscardedTile || kanCount >= 4) return false;
        const a = takeTilesById(playerHands[playerIdx], lastDiscardedTile.id, 3);
        if (a.length !== 3) return false;
        a.push(lastDiscardedTile);
        return finishKan(playerIdx, a, true);
    }

    function executeAnkan(playerIdx, tileId) {
        if (!roundActive || roundEnding || kanCount >= 4) return false;
        const a = takeTilesById(playerHands[playerIdx], tileId, 4);
        if (a.length !== 4) {
            playerHands[playerIdx].push(...a);
            return false;
        }
        playerMelds[playerIdx].push(a);
        kanCount++;
        revealNextKandora();
        const r = drawRinshanTile();
        if (!r) {
            endRound('KAN ABORT', 'Tidak ada tile Rinshan tersisa.');
            return false;
        }
        lastDrawWasRinshan = true;
        drawnTile = r;
        playerHands[playerIdx].push(r);
        return continueAfterKanDraw(playerIdx);
    }

    function executeShouminkan(playerIdx, meldIndex) {
        if (!roundActive || roundEnding || kanCount >= 4) return false;
        const g = playerMelds[playerIdx][meldIndex];
        if (!g || g.length !== 3 || !g.every(t => t.id === g[0].id)) return false;
        const i = playerHands[playerIdx].findIndex(t => t.id === g[0].id);
        if (i < 0) return false;
        g.push(playerHands[playerIdx].splice(i, 1)[0]);
        kanCount++;
        revealNextKandora();
        const r = drawRinshanTile();
        if (!r) {
            endRound('KAN ABORT', 'Tidak ada tile Rinshan tersisa.');
            return false;
        }
        lastDrawWasRinshan = true;
        drawnTile = r;
        playerHands[playerIdx].push(r);
        return continueAfterKanDraw(playerIdx);
    }

    function getClosedKanOptions(playerIdx){return tileCounts(playerHands[playerIdx]).map((c,id)=>c===4?id:-1).filter(id=>id>=0)}
    function getShouminkanOptions(playerIdx){
        const out=[];
        (playerMelds[playerIdx]||[]).forEach((g,i)=>{ if(g.length===3&&g.every(t=>t.id===g[0].id)&&playerHands[playerIdx].some(t=>t.id===g[0].id)) out.push(i); });
        return out;
    }

    function executeChi(playerIdx) {
        const combos = getChiCombinations(playerHands[playerIdx], lastDiscardedTile);
        const chosenCombo = combos[0];
        if (!chosenCombo || !lastDiscardedTile) return;

        let chiTiles = [];
        for (let num of chosenCombo) {
            let idx = playerHands[playerIdx].findIndex(t => t.type === lastDiscardedTile.type && t.num === num);
            chiTiles.push(playerHands[playerIdx].splice(idx, 1)[0]);
        }
        chiTiles.push(lastDiscardedTile);
        chiTiles.sort((a,b) => a.num - b.num);
        playerMelds[playerIdx].push(chiTiles);

        removeLastDiscard();
        if (playerIdx === 0) {
            if (autoSortSetting) autoSortHand();
            renderPlayerMelds();
        } else {
            renderEnemyMelds(playerIdx);
        }

        currentTurn = playerIdx; isDiscardable = (playerIdx === 0); drawnTile = null; 
        if (playerIdx === 0) startTimer(false); else processTurn();
    }

    function nextTurn() {
        if (!roundActive || roundEnding) return;
        currentTurn = (currentTurn + 1) % 4;
        processTurn();
    }

    // EXHAUSTIVE DRAW (RYUUKYOKU) / TENPAI-NOTEN SETTLEMENT
    // Standard riichi rule: 3000 points are transferred between Noten and Tenpai players.
    // Tenpai players split the 3000-point pool; Noten players split the 3000-point payment.
    function getPlayerTenpaiStatus(pIdx) {
        const hand = playerHands[pIdx] || [];
        const meldCount = (playerMelds[pIdx] || []).length;
        // At exhaustive draw, players should have 13 concealed tiles (or equivalent after melds).
        return isTenpai(hand, meldCount);
    }

    function settleExhaustiveDraw() {
        if (!roundActive || roundEnding) return;

        const tenpai = [0, 1, 2, 3].map(getPlayerTenpaiStatus);
        const readyPlayers = tenpai.map((v, i) => v ? i : -1).filter(i => i !== -1);
        const notenPlayers = tenpai.map((v, i) => !v ? i : -1).filter(i => i !== -1);

        let description = '';

        if (readyPlayers.length > 0 && readyPlayers.length < 4) {
            const gain = 3000 / readyPlayers.length;
            const loss = 3000 / notenPlayers.length;
            readyPlayers.forEach(p => { playerScores[p] += gain; });
            notenPlayers.forEach(p => { playerScores[p] -= loss; });

            updateScoresUI();

            const names = ['You (South)', 'Player 1 (East)', 'Player 2 (North)', 'Player 3 (West)'];
            const readyNames = readyPlayers.map(p => names[p]).join(', ');
            description = `Tenpai: ${readyNames}. Masing-masing +${gain.toLocaleString('id-ID')} poin; Noten membayar total 3000 poin.`;
        } else if (readyPlayers.length === 4) {
            description = 'Semua pemain Tenpai. Tidak ada pembayaran Tenpai/Noten.';
        } else {
            description = 'Tidak ada pemain Tenpai. Tidak ada pembayaran Tenpai/Noten.';
        }

        const readyCount = readyPlayers.length;
        const title = readyCount > 0 ? `RYUUKYOKU • ${readyCount} TENPAI` : 'RYUUKYOKU • SEMUA NOTEN';
        endRound(title, description);
    }

    // ROUND END & EXTENSION MECHANICS
    function getRoundName() {
        const roundNames = ['East 1', 'East 2', 'East 3', 'East 4', 'East 5 (Extra)'];
        return roundNames[currentRoundIndex] || `East ${currentRoundIndex + 1}`;
    }

    function endRound(title, desc) {
        if (roundEnding) return;
        roundEnding = true;
        roundActive = false;
        clearInterval(timerInterval);
        if (aiMoveTimer) { clearTimeout(aiMoveTimer); aiMoveTimer = null; }
        if (autoDiscardTimer) { clearTimeout(autoDiscardTimer); autoDiscardTimer = null; }
        roundToken++;
        isDiscardable = false; pendingPlayerActions = [];
        setDisplay('action-overlay', 'none');
        canRevealUraDora = title.includes('WIN') && (isRiichi || aiRiichi.some(Boolean));
        setText('res-title', title);
        setText('res-desc', desc);
        setText('res-round-label', `HASIL • ${getRoundName()}`);

        const isDraw = title.toUpperCase().includes('RYUUKOKU') || title.toUpperCase().includes('DRAW');
        const winnerMatch = title.match(/(?:TSUMO by|RON by)\s+(.+?)(?:!|$)/i);
        const winnerName = winnerMatch ? winnerMatch[1] : (isDraw ? 'Tidak ada pemenang' : 'Ronde selesai');
        const deltas = playerScores.map((score, i) => score - (roundStartScores[i] ?? score));
        const sorted = [...playerScores].map((score, i) => ({ score, i })).sort((a,b) => b.score - a.score);
        const places = Array(4);
        sorted.forEach((entry, idx) => { places[entry.i] = idx + 1; });

        const badge = byId('res-badge');
        if (badge) {
            badge.textContent = isDraw ? 'DRAW' : 'WIN';
            badge.className = `result-badge ${isDraw ? 'draw' : 'win'}`;
        }

        const summary = byId('res-summary');
        if (summary) {
            const leader = sorted[0];
            const myDelta = deltas[0];
            const deltaText = `${myDelta > 0 ? '+' : ''}${myDelta.toLocaleString('id-ID')}`;
            const deltaClass = myDelta > 0 ? 'delta-up' : myDelta < 0 ? 'delta-down' : 'delta-flat';
            summary.innerHTML = `
                <div class="result-summary-card">
                    <div class="result-summary-label">Hasil</div>
                    <div class="result-summary-value">${winnerName}</div>
                    <div class="result-summary-sub">${isDraw ? 'Pembagian Tenpai / Noten diterapkan bila berlaku.' : desc}</div>
                </div>
                <div class="result-summary-card">
                    <div class="result-summary-label">Perubahan Anda</div>
                    <div class="result-summary-value ${deltaClass}">${deltaText}</div>
                    <div class="result-summary-sub">Skor akhir: ${playerScores[0].toLocaleString('id-ID')}</div>
                </div>
                <div class="result-summary-card">
                    <div class="result-summary-label">Pimpinan</div>
                    <div class="result-summary-value">${['You','P1','P2','P3'][leader.i]} • ${leader.score.toLocaleString('id-ID')}</div>
                    <div class="result-summary-sub">Peringkat Anda: #${places[0]}</div>
                </div>`;
        }

        const names = [
            { name:'You', seat:'South' },
            { name:'Player 1', seat:'East' },
            { name:'Player 2', seat:'North' },
            { name:'Player 3', seat:'West' }
        ];
        let scoreHtml = `
            <div class="score-row score-head">
                <div>Pemain</div><div>Perubahan</div><div>Total</div><div>Peringkat</div>
            </div>`;
        for (let i = 0; i < 4; i++) {
            const delta = deltas[i];
            const deltaClass = delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat';
            const deltaText = delta > 0 ? `+${delta.toLocaleString('id-ID')}` : delta.toLocaleString('id-ID');
            const ready = getPlayerTenpaiStatus(i);
            const status = isDraw ? ` <span class="round-ready-tag ${ready ? 'ready' : 'noten'}">${ready ? 'TENPAI' : 'NOTEN'}</span>` : '';
            scoreHtml += `<div class="score-row">
                <div class="score-name"><strong>${names[i].name}${i === 0 ? ' (Anda)' : ''}${status}</strong><div class="score-seat">${names[i].seat}${i === currentDealerIdx ? ' • Oya' : ''}</div></div>
                <div class="score-delta ${deltaClass}">${deltaText}</div>
                <div class="score-total">${playerScores[i].toLocaleString('id-ID')}</div>
                <div class="score-place">#${places[i]}</div>
            </div>`;
        }
        const scoreBox = byId('res-scores');
        if (scoreBox) scoreBox.innerHTML = scoreHtml;
        setDisplay('modal-result', 'flex');
    }

    function nextRoundOrFinish() {
        if (!roundEnding) return;
        setDisplay('modal-result', 'none');
        document.getElementById('hand-status')?.classList.remove('action-open');
        pendingPlayerActions = [];
        currentRoundIndex++;
        
        // Standard match flow: East 1-4, with East 5 extra only when the configured extension condition is met.
        let maxScore = Math.max(...playerScores);
        if (currentRoundIndex < 4 || (currentRoundIndex === 4 && maxScore < 30000)) {
            nav('screen-game');
            nav('screen-game');
            setupRound();
        } else {
            alert("Permainan Selesai!\nSkor Akhir Anda: " + playerScores[0]);
            nav('screen-main');
        }
    }

    function quitGame() { 
        clearInterval(timerInterval);
        if (aiMoveTimer) { clearTimeout(aiMoveTimer); aiMoveTimer = null; }
        if (autoDiscardTimer) { clearTimeout(autoDiscardTimer); autoDiscardTimer = null; }
        roundToken++;
        roundActive = false;
        roundEnding = false;
        pendingPlayerActions = [];
        setDisplay('action-overlay', 'none');
        document.getElementById('hand-status')?.classList.remove('action-open');
        nav('screen-main'); 
    }


(function(){
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function(){ navigator.serviceWorker.register('./sw.js').catch(function(err){ console.warn('SW registration failed:', err); }); });
  }
})();
