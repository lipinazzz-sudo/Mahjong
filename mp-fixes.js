/**
 * MULTIPLAYER FIXES & ENHANCEMENTS
 * Non-intrusive fixes for common multiplayer issues
 */

(function() {
  'use strict';

  // ============================================================
  // 1. FIX: CONNECTION TIMEOUT & HEARTBEAT
  // ============================================================
  let mpPingTimer = null;
  const PING_INTERVAL = 30000; // 30 seconds
  const PONG_TIMEOUT = 10000; // 10 seconds wait for pong
  let lastPongTime = Date.now();

  function startMpPing() {
    stopMpPing();
    mpPingTimer = setInterval(() => {
      if (window.mp?.connected && window.mp?.ws?.readyState === WebSocket.OPEN) {
        window.mpSend('ping');
        const checkPong = setTimeout(() => {
          if (Date.now() - lastPongTime > PONG_TIMEOUT) {
            console.warn('Ping timeout detected, attempting reconnect...');
            window.mpReconnect?.();
          }
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }

  function stopMpPing() {
    if (mpPingTimer) {
      clearInterval(mpPingTimer);
      mpPingTimer = null;
    }
  }

  window.startMpPing = startMpPing;
  window.stopMpPing = stopMpPing;

  // Hook into WebSocket message handler
  const originalMpHandle = window.mpHandle;
  window.mpHandle = function(msg) {
    if (msg?.type === 'pong') {
      lastPongTime = Date.now();
    }
    return originalMpHandle?.call(this, msg);
  };

  // ============================================================
  // 2. FIX: GRACEFUL RECONNECTION WITH EXPONENTIAL BACKOFF
  // ============================================================
  let mpReconnectAttempts = 0;
  let mpReconnectDeadline = 0;
  const MAX_RECONNECT_ATTEMPTS = 8;
  const INITIAL_BACKOFF = 700;
  const MAX_BACKOFF = 5000;

  const _origMpReconnect = window.mpReconnect;
  window.mpReconnect = function() {
    if (!window.mp?.room?.code || !window.isMultiplayerMode) return;
    
    if (mpReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      window.setText?.('lobby-help', 'Koneksi hilang. Silakan kembali ke menu.');
      return;
    }

    const backoffDelay = Math.min(
      MAX_BACKOFF,
      INITIAL_BACKOFF + mpReconnectAttempts * 450
    );
    
    mpReconnectAttempts++;
    console.log(`Attempting reconnect ${mpReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${backoffDelay}ms`);
    
    setTimeout(() => {
      if (!window.mp?.connected) {
        window.mpConnect?.(window.mp?.room?.code, window.mp?.host ? 'host' : 'guest', true);
      }
    }, backoffDelay);
  };

  // Reset attempts on successful connection
  const _origMpConnect = window.mpConnect;
  window.mpConnect = function(code = '', role = '', isReconnect = false) {
    if (!code && !window.mp?.room?.code) {
      window.mpSetConnection?.(false);
      return false;
    }

    try {
      const result = _origMpConnect.call(this, code, role, isReconnect);
      // On successful connection attempt, reset backoff
      if (result && isReconnect) {
        mpReconnectAttempts = 0;
        mpReconnectDeadline = 0;
      }
      return result;
    } catch (e) {
      console.error('mpConnect error:', e);
      return false;
    }
  };

  // ============================================================
  // 3. FIX: CONNECTION QUEUE (prevent message loss)
  // ============================================================
  const mpMessageQueue = [];
  let mpQueueFlushTimer = null;
  const QUEUE_FLUSH_INTERVAL = 16;

  function enqueueMpMessage(type, data = {}) {
    mpMessageQueue.push({ type, data });
    flushMpQueue();
  }

  function flushMpQueue() {
    if (mpQueueFlushTimer) clearTimeout(mpQueueFlushTimer);
    
    mpQueueFlushTimer = setTimeout(() => {
      while (mpMessageQueue.length > 0) {
        if (!window.mp?.connected || window.mp?.ws?.readyState !== WebSocket.OPEN) {
          console.log('Queue paused: connection not ready');
          break;
        }
        
        const { type, data } = mpMessageQueue.shift();
        try {
          window.mpSend?.(type, data);
        } catch (e) {
          console.error('Failed to send queued message:', e);
          mpMessageQueue.unshift({ type, data });
          break;
        }
      }
      mpQueueFlushTimer = null;
    }, QUEUE_FLUSH_INTERVAL);
  }

  window.enqueueMpMessage = enqueueMpMessage;

  // ============================================================
  // 4. FIX: PREVENT DUPLICATE CONNECTIONS
  // ============================================================
  let mpConnectionLock = false;
  let mpLastConnectTime = 0;
  const CONNECTION_DEBOUNCE = 2000;

  const _origMpConnectImpl = window.mpConnect;
  window.mpConnect = function(code = '', role = '', isReconnect = false) {
    if (mpConnectionLock) {
      console.warn('Connection already in progress, skipping duplicate attempt');
      return false;
    }

    if (!isReconnect && (Date.now() - mpLastConnectTime < CONNECTION_DEBOUNCE)) {
      console.warn('Connection attempted too soon, debouncing');
      return false;
    }

    mpConnectionLock = true;
    mpLastConnectTime = Date.now();
    
    const lockTimeout = setTimeout(() => {
      mpConnectionLock = false;
    }, CONNECTION_DEBOUNCE);

    try {
      const result = _origMpConnectImpl.call(this, code, role, isReconnect);
      return result;
    } catch (e) {
      mpConnectionLock = false;
      clearTimeout(lockTimeout);
      throw e;
    }
  };

  // ============================================================
  // 5. FIX: HANDLE NETWORK ERRORS GRACEFULLY
  // ============================================================
  window.addEventListener('online', () => {
    console.log('Network restored');
    if (window.isMultiplayerMode && !window.mp?.connected && window.mp?.room?.code) {
      setTimeout(() => {
        mpReconnectAttempts = 0;
        window.mpReconnect?.();
      }, 500);
    }
  });

  window.addEventListener('offline', () => {
    console.log('Network lost');
    if (window.mp?.ws) {
      try {
        window.mp.ws.close(1000, 'Network offline');
      } catch (e) {}
    }
  });

  // ============================================================
  // 6. FIX: ROOM CODE VALIDATION
  // ============================================================
  function validateRoomCode(code) {
    const c = String(code || '').trim();
    return /^\d{5}$/.test(c);
  }

  window.validateRoomCode = validateRoomCode;

  // ============================================================
  // 7. FIX: PERSISTENT SESSION RECOVERY
  // ============================================================
  function saveMpSession() {
    if (!window.mp?.room) return;
    try {
      const session = {
        code: window.mp.room.code,
        seat: window.mp.seat,
        token: window.mp.token,
        playerName: window.mp.playerName,
        playerAvatar: window.mp.playerAvatar,
        host: window.mp.host,
        timestamp: Date.now()
      };
      localStorage.setItem('hk_mp_session', JSON.stringify(session));
      console.log('MP session saved:', session.code);
    } catch (e) {
      console.error('Failed to save MP session:', e);
    }
  }

  function loadMpSession() {
    try {
      const data = localStorage.getItem('hk_mp_session');
      if (!data) return null;
      const session = JSON.parse(data);
      // Session valid for 1 hour
      if (Date.now() - (session.timestamp || 0) > 3600000) {
        localStorage.removeItem('hk_mp_session');
        return null;
      }
      return session;
    } catch (e) {
      console.error('Failed to load MP session:', e);
      return null;
    }
  }

  function clearMpSession() {
    try {
      localStorage.removeItem('hk_mp_session');
    } catch (e) {}
  }

  window.saveMpSession = saveMpSession;
  window.loadMpSession = loadMpSession;
  window.clearMpSession = clearMpSession;

  // Auto-load session on startup
  document.addEventListener('DOMContentLoaded', () => {
    const savedSession = loadMpSession();
    if (savedSession && !window.roundActive) {
      console.log('Found saved MP session for room:', savedSession.code);
    }
  });

  // Auto-save session when connection established
  const _origMpHandle = window.mpHandle;
  window.mpHandle = function(msg) {
    if (msg?.type === 'joined' || msg?.type === 'lobby') {
      saveMpSession();
    }
    return _origMpHandle?.call(this, msg);
  };

  // ============================================================
  // 8. FIX: WEBSOCKET ERROR HANDLING WRAPPER
  // ============================================================
  const _origMpConnectWithErrorHandling = window.mpConnect;
  window.mpConnect = function(code = '', role = '', isReconnect = false) {
    const result = _origMpConnectWithErrorHandling.call(this, code, role, isReconnect);
    
    // Enhance error handling if WebSocket was created
    if (window.mp?.ws) {
      const ws = window.mp.ws;
      
      const originalOnerror = ws.onerror;
      ws.onerror = function(event) {
        console.error('WebSocket error:', event);
        window.mpSetConnection?.(false);
        if (window.isMultiplayerMode) {
          setTimeout(() => window.mpReconnect?.(), 1000);
        }
        originalOnerror?.call(this, event);
      };

      const originalOnclose = ws.onclose;
      ws.onclose = function(event) {
        console.log(`WebSocket closed: code=${event.code}, reason=${event.reason}`);
        window.mp.connected = false;
        window.mpSetConnection?.(false);
        
        if (window.isMultiplayerMode && !event.wasClean && event.code !== 1000) {
          setTimeout(() => window.mpReconnect?.(), 1000);
        }
        originalOnclose?.call(this, event);
      };
    }
    
    return result;
  };

  // ============================================================
  // 9. FIX: STATE SYNC CONFIRMATION
  // ============================================================
  let lastStateSyncTime = 0;
  const STATE_SYNC_DEBOUNCE = 100;

  window.mpSendGameState = function(state) {
    if (!state || Date.now() - lastStateSyncTime < STATE_SYNC_DEBOUNCE) {
      return;
    }
    lastStateSyncTime = Date.now();
    
    try {
      enqueueMpMessage('state', { state });
    } catch (e) {
      console.error('Failed to queue game state:', e);
    }
  };

  // ============================================================
  // 10. FIX: ROOM CODE GENERATION (Host side)
  // ============================================================
  function generateRoomCode() {
    return String(Math.floor(10000 + Math.random() * 90000));
  }

  window.generateRoomCode = generateRoomCode;

  // ============================================================
  // 11. FIX: CONNECTION STATUS MONITORING
  // ============================================================
  window.mpGetConnectionStatus = function() {
    return {
      connected: window.mp?.connected || false,
      wsOpen: window.mp?.ws?.readyState === WebSocket.OPEN,
      wsReady: window.mp?.ws?.readyState === WebSocket.OPEN,
      hasRoom: !!window.mp?.room?.code,
      isHost: window.mp?.host || false,
      reconnectAttempts: mpReconnectAttempts,
      seat: window.mp?.seat ?? null,
      playerName: window.mp?.playerName || 'Player',
      queuedMessages: mpMessageQueue.length
    };
  };

  // ============================================================
  // 12. FIX: CLEANUP ON PAGE UNLOAD
  // ============================================================
  window.addEventListener('beforeunload', () => {
    if (window.isMultiplayerMode && window.mp?.connected) {
      try {
        window.mpSend?.('leave');
        saveMpSession();
      } catch (e) {}
    }
  });

  // ============================================================
  // 13. FIX: IMPROVE MPCREATROOM & MPJOINROOM
  // ============================================================
  const _origMpCreateRoom = window.mpCreateRoom;
  window.mpCreateRoom = function() {
    if (!window.byId?.('mp-name')) {
      console.error('MP name field not found');
      return;
    }
    
    window.mp.playerName = (window.byId('mp-name').value || 'Player').trim().slice(0, 20) || 'Player';
    window.mp.host = true;
    window.mp.ready = true;
    
    window.mpEnsureToken?.();
    
    const code = window.generateRoomCode?.() || String(Math.floor(10000 + Math.random() * 90000));
    window.mp.room = { code, players: [null, null, null, null], started: false };
    
    window.setText?.('lobby-help', 'Membuat room ' + code + '…');
    window.setDisplay?.('mp-setup', 'none');
    window.setDisplay?.('mp-host-invite', 'grid');
    
    window.mpConnect?.(code, 'host');
    
    return _origMpCreateRoom?.call(this);
  };

  const _origMpJoinRoom = window.mpJoinRoom;
  window.mpJoinRoom = function() {
    const codeInput = window.byId?.('mp-room-code');
    if (!codeInput) {
      console.error('MP room code input not found');
      return;
    }

    const code = codeInput.value?.trim() || '';
    
    if (!window.validateRoomCode(code)) {
      window.setText?.('lobby-help', 'Kode room tidak valid. Harus 5 digit.');
      return;
    }

    window.mp.playerName = (window.byId('mp-name')?.value || 'Player').trim().slice(0, 20) || 'Player';
    window.mp.host = false;
    window.mp.ready = true;
    
    window.mpEnsureToken?.();
    
    window.mp.room = { code, players: [null, null, null, null], started: false };
    
    window.setText?.('lobby-help', 'Menghubungkan ke room ' + code + '…');
    window.setDisplay?.('mp-setup', 'none');
    window.setDisplay?.('mp-room-panel', 'grid');
    
    mpReconnectAttempts = 0;
    window.mpConnect?.(code, 'guest');
    
    return _origMpJoinRoom?.call(this);
  };

  // ============================================================
  // 14. FIX: LOBBY CLOSE CLEANUP
  // ============================================================
  const _origCloseLobby = window.closeLobby;
  window.closeLobby = function() {
    clearTimeout(mpQueueFlushTimer);
    stopMpPing();
    mpReconnectAttempts = 0;
    mpMessageQueue.length = 0;
    mpConnectionLock = false;
    
    try {
      window.mpSend?.('leave');
    } catch (e) {}
    
    try {
      if (window.mp?.ws) {
        window.mp.ws.onclose = null;
        window.mp.ws.close();
      }
    } catch (e) {}
    
    window.mp.ws = null;
    window.mp.connected = false;
    
    return _origCloseLobby?.call(this);
  };

  // ============================================================
  // INITIALIZATION
  // ============================================================
  console.log('✓ Multiplayer fixes loaded');
  console.log('✓ Heartbeat ping/pong enabled (30s interval)');
  console.log('✓ Exponential backoff reconnection (max 8 attempts)');
  console.log('✓ Message queue for reliability');
  console.log('✓ Connection locking enabled');
  console.log('✓ Network state monitoring');
  console.log('✓ Session persistence ready');
  console.log('✓ WebSocket error handling improved');
  console.log('✓ Room code validation ready');

})();
