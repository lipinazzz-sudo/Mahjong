/**
 * PERFORMANCE OPTIMIZATION LAYER
 * Non-intrusive performance enhancements for Mahjong game
 * Wraps existing functions without modifying original code
 */

(function() {
  'use strict';

  // ============================================================
  // 1. MEMOIZATION SYSTEM FOR RECURSIVE TILE VALIDATION
  // ============================================================
  const memoCache = new WeakMap();
  const _origCanFormMelds = window.canFormMelds;
  
  window.canFormMelds = function(c) {
    // Use object identity for memoization
    if (!memoCache.has(c)) {
      memoCache.set(c, new Map());
    }
    const cache = memoCache.get(c);
    const key = c.join(',');
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = _origCanFormMelds.call(this, c);
    cache.set(key, result);
    return result;
  };

  // ============================================================
  // 2. OPTIMIZED CACHE KEY GENERATION (Numeric Hashing)
  // ============================================================
  function hashTileCountArray(arr) {
    let hash = 0;
    for (let i = 0; i < arr.length; i++) {
      hash = ((hash << 5) - hash) + arr[i];
      hash |= 0; // Convert to 32-bit integer
    }
    return hash;
  }

  const _origGetWaitIds = window.getWaitIds;
  const numericWaitCache = new Map();
  
  window.getWaitIds = function(hand13, meldCount = 0) {
    if (!hand13 || hand13.length % 3 !== 1) return [];
    
    const counts = window.tileCounts(hand13);
    const numericKey = `${meldCount}:${hashTileCountArray(counts)}`;
    
    if (numericWaitCache.has(numericKey)) {
      return numericWaitCache.get(numericKey).slice();
    }
    
    const result = _origGetWaitIds.call(this, hand13, meldCount);
    
    numericWaitCache.set(numericKey, result.slice());
    if (numericWaitCache.size > 256) {
      const firstKey = numericWaitCache.keys().next().value;
      numericWaitCache.delete(firstKey);
    }
    
    return result;
  };

  // ============================================================
  // 3. BATCH DOM UPDATES WITH RAF
  // ============================================================
  const pendingUpdates = [];
  let rafScheduled = false;

  function scheduleUpdate(fn) {
    pendingUpdates.push(fn);
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(() => {
        pendingUpdates.forEach(f => f());
        pendingUpdates.length = 0;
        rafScheduled = false;
      });
    }
  }

  window.scheduleUpdate = scheduleUpdate;

  // ============================================================
  // 4. OPTIMIZED SCORE ANIMATION (Pre-calculate formatting)
  // ============================================================
  const numberFormatCache = new Map();
  
  function formatNumberID(num) {
    if (numberFormatCache.has(num)) {
      return numberFormatCache.get(num);
    }
    const formatted = num.toLocaleString('id-ID');
    numberFormatCache.set(num, formatted);
    if (numberFormatCache.size > 1000) {
      const firstKey = numberFormatCache.keys().next().value;
      numberFormatCache.delete(firstKey);
    }
    return formatted;
  }

  const _origAnimateScoreValue = window.animateScoreValue;
  
  window.animateScoreValue = function(el, target, duration = 520) {
    if (!el) return;
    const next = Math.round(Number(target) || 0);
    const raw = el.dataset.scoreValue;
    const current = raw !== undefined ? Number(raw) : Number(String(el.textContent || '').replace(/\D/g, '')) || 0;
    
    if (current === next) {
      el.textContent = formatNumberID(next);
      el.dataset.scoreValue = String(next);
      return;
    }
    
    const start = current, t0 = performance.now(), ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
      const p = Math.min(1, (now - t0) / duration);
      const value = Math.round(start + (next - start) * ease(p));
      el.textContent = formatNumberID(value);
      el.dataset.scoreValue = String(value);
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  // ============================================================
  // 5. LAZY LOAD TILE ASSETS WITH INTERSECTION OBSERVER
  // ============================================================
  const loadedAssets = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        if (src && !loadedAssets.has(src)) {
          img.src = src;
          loadedAssets.add(src);
          observer.unobserve(img);
        }
      }
    });
  }, { rootMargin: '50px' });

  window.observeAssetLoading = function(el) {
    if (el.dataset.src) observer.observe(el);
  };

  // ============================================================
  // 6. DEBOUNCED ADVISOR CALCULATION
  // ============================================================
  let advisorDebounceTimer = null;
  const _origShowTileAdvisor = window.showTileAdvisor;

  window.showTileAdvisor = function(index) {
    clearTimeout(advisorDebounceTimer);
    advisorDebounceTimer = setTimeout(() => {
      _origShowTileAdvisor.call(this, index);
    }, 16);
  };

  // ============================================================
  // 7. EFFICIENT RENDER BATCHING
  // ============================================================
  let renderPending = false;
  const _origRenderTable = window.renderTable;

  window.renderTable = function() {
    if (renderPending) return;
    renderPending = true;
    scheduleUpdate(() => {
      _origRenderTable.call(this);
      renderPending = false;
    });
  };

  // ============================================================
  // 8. EVENT DELEGATION FOR BUTTONS (Replace inline onclick)
  // ============================================================
  const actionHandlers = {
    'nav': (arg) => window.nav(arg),
    'toggleAudioMute': () => window.toggleAudioMute(),
    'toggleAutoSortSetting': () => window.toggleAutoSortSetting(),
    'openSingleAvatarPicker': () => window.openSingleAvatarPicker(),
    'openMultiAvatarPicker': () => window.openMultiAvatarPicker(),
    'closeAvatarPicker': () => window.closeAvatarPicker(),
    'confirmAvatarSelection': () => window.confirmAvatarSelection(),
    'setSelectedAvatar': (id) => window.setSelectedAvatar(id),
    'returnToGameFromSettings': () => window.returnToGameFromSettings(),
    'exitGameFromSettings': () => window.exitGameFromSettings(),
    'openSettingsFromGame': () => window.openSettingsFromGame(),
    'mpCreateRoom': () => window.mpCreateRoom(),
    'mpShowJoinForm': () => window.mpShowJoinForm(),
    'mpJoinRoom': () => window.mpJoinRoom(),
    'mpReconnect': () => window.mpReconnect(),
    'mpCopyRoomInfo': () => window.mpCopyRoomInfo(),
    'togglePlayerReady': () => window.togglePlayerReady(),
    'mpStartGame': () => window.mpStartGame(),
    'closeLobby': () => window.closeLobby(),
    'nextRoundOrFinish': () => window.nextRoundOrFinish(),
    'handleRematchClick': () => window.handleRematchClick(),
    'matchOverToMenu': () => window.matchOverToMenu(),
  };

  document.addEventListener('click', function(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const arg = btn.dataset.arg;
    
    if (actionHandlers[action]) {
      e.preventDefault();
      if (arg) {
        actionHandlers[action](arg);
      } else {
        actionHandlers[action]();
      }
    }
  }, true);

  // ============================================================
  // 9. PARALLELIZE ASSET PRELOADING
  // ============================================================
  const _origPreloadTileAssets = window.preloadTileAssets;
  
  window.preloadTileAssets = function() {
    const urls = [];
    for (let i = 1; i <= 9; i++) {
      urls.push(`icons/tiles/man_${i}.png`, `icons/tiles/pin_${i}.png`, `icons/tiles/sou_${i}.png`);
    }
    ['east', 'south', 'west', 'north', 'white', 'green', 'red'].forEach(x => urls.push(`icons/tiles/${x}.png`));
    
    // Use Promise.all for concurrent loading
    const baseURL = new URL('icons/tiles/', document.baseURI).href;
    const promises = urls.map(url => 
      new Promise(resolve => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = resolve;
        img.onerror = resolve;
        img.src = baseURL + url;
      })
    );
    
    Promise.all(promises).then(() => {
      console.log('All tile assets preloaded');
    });
  };

  // ============================================================
  // 10. ADVISOR KNOWN COUNTS - INCREMENTAL UPDATES
  // ============================================================
  let lastAdvisorState = {
    hand: null,
    rivers: null,
    melds: null
  };

  const _origAdvisorKnownCounts = window.advisorKnownCounts;
  let cachedAdvisorResult = null;
  let advisorCacheValid = false;

  window.advisorKnownCounts = function(excludeSeatHand = false) {
    const seat = window.mp?.seat ?? 0;
    const hand = window.playerHands?.[seat] || [];
    const hasHandChanged = hand !== lastAdvisorState.hand;
    const hasRiversChanged = window.playerRivers !== lastAdvisorState.rivers;
    const hasMeldsChanged = window.playerMelds !== lastAdvisorState.melds;

    if (!hasHandChanged && !hasRiversChanged && !hasMeldsChanged && advisorCacheValid) {
      return cachedAdvisorResult.slice();
    }

    cachedAdvisorResult = _origAdvisorKnownCounts.call(this, excludeSeatHand);
    lastAdvisorState = { hand, rivers: window.playerRivers, melds: window.playerMelds };
    advisorCacheValid = true;
    
    return cachedAdvisorResult.slice();
  };

  // ============================================================
  // 11. INTERSECTION OBSERVER FOR DOM VISIBILITY
  // ============================================================
  window.createVisibilityObserver = function(callback, options = {}) {
    return new IntersectionObserver(callback, {
      threshold: 0.1,
      rootMargin: '100px',
      ...options
    });
  };

  // ============================================================
  // 12. PERFORMANCE MONITORING
  // ============================================================
  window.perfMetrics = {
    renders: 0,
    updates: 0,
    startTime: performance.now(),
    
    recordRender() {
      this.renders++;
    },
    
    recordUpdate() {
      this.updates++;
    },
    
    report() {
      const elapsed = performance.now() - this.startTime;
      console.log(`Performance Report:
        Renders: ${this.renders}
        Updates: ${this.updates}
        Time: ${elapsed.toFixed(2)}ms
        Avg per update: ${(elapsed / this.updates).toFixed(2)}ms`);
    }
  };

  // ============================================================
  // 13. CLEAR MEMOIZATION ON STATE CHANGES
  // ============================================================
  window.clearMemoCache = function() {
    numberFormatCache.clear();
    numericWaitCache.clear();
    memoCache.clear();
  };

  // Schedule cleanup periodically
  setInterval(() => {
    if (numberFormatCache.size > 500) {
      numberFormatCache.clear();
    }
  }, 5000);

  // ============================================================
  // 14. INIT OPTIMIZATION SYSTEM
  // ============================================================
  console.log('✓ Performance optimization layer loaded');
  console.log('✓ Memoization enabled for canFormMelds');
  console.log('✓ Numeric hash caching for wait IDs');
  console.log('✓ Batch DOM updates with RAF');
  console.log('✓ Optimized score animations');
  console.log('✓ Lazy asset loading ready');
  console.log('✓ Debounced advisor calculations');

})();
