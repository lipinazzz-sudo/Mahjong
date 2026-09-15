/**
 * AUDIO SETTINGS FIX
 * Fixes music and SFX volume controls not responding properly
 */

(function() {
  'use strict';

  // ============================================================
  // FIX: AUDIO VOLUME RANGE INPUT LISTENERS
  // ============================================================
  const _origInitAudioSettingsUI = window.initAudioSettingsUI;
  
  window.initAudioSettingsUI = function() {
    // Call original first
    if (_origInitAudioSettingsUI) {
      _origInitAudioSettingsUI.call(this);
    }

    // Now attach proper event listeners
    const musicVolumeInput = document.getElementById('music-volume');
    const sfxVolumeInput = document.getElementById('sfx-volume');

    if (musicVolumeInput) {
      musicVolumeInput.addEventListener('input', (e) => {
        const value = e.target.value;
        console.log('Music volume input changed to:', value);
        window.setMusicVolume?.(value);
      });

      musicVolumeInput.addEventListener('change', (e) => {
        const value = e.target.value;
        console.log('Music volume changed to:', value);
        window.setMusicVolume?.(value);
      });
    }

    if (sfxVolumeInput) {
      sfxVolumeInput.addEventListener('input', (e) => {
        const value = e.target.value;
        console.log('SFX volume input changed to:', value);
        window.setSfxVolume?.(value);
      });

      sfxVolumeInput.addEventListener('change', (e) => {
        const value = e.target.value;
        console.log('SFX volume changed to:', value);
        window.setSfxVolume?.(value);
      });
    }
  };

  // ============================================================
  // FIX: IMPROVE SETMUSICVOLUME & SETSFXVOLUME FUNCTIONS
  // ============================================================
  const _origSetMusicVolume = window.setMusicVolume;
  window.setMusicVolume = function(index) {
    const value = Number(index);
    console.log('setMusicVolume called with:', value);
    
    if (!Number.isFinite(value)) {
      console.warn('Invalid music volume index:', index);
      return;
    }

    window.musicVolume = window.audioLevel?.(value) ?? 0.30;
    console.log('Music volume set to:', window.musicVolume);
    
    try {
      localStorage.setItem('hk_music_volume', String(window.musicVolume));
    } catch (e) {
      console.warn('Failed to save music volume:', e);
    }

    const bgm = document.getElementById('bg-music');
    if (window.musicVolume === 0) {
      if (bgm) {
        bgm.volume = 0;
        bgm.pause();
        bgm.currentTime = 0;
      }
      console.log('Music muted (volume 0)');
    } else {
      console.log('Applying audio settings, music volume:', window.musicVolume);
      window.applyAudioSettings?.();
      if (window.roundActive && !window.audioMuted) {
        window.playGameMusic?.();
      }
    }

    window.applyAudioSettings?.();
  };

  const _origSetSfxVolume = window.setSfxVolume;
  window.setSfxVolume = function(index) {
    const value = Number(index);
    console.log('setSfxVolume called with:', value);
    
    if (!Number.isFinite(value)) {
      console.warn('Invalid SFX volume index:', index);
      return;
    }

    window.sfxVolume = window.audioLevel?.(value) ?? 0.30;
    console.log('SFX volume set to:', window.sfxVolume);
    
    try {
      localStorage.setItem('hk_sfx_volume', String(window.sfxVolume));
    } catch (e) {
      console.warn('Failed to save SFX volume:', e);
    }

    window.applyAudioSettings?.();
  };

  // ============================================================
  // FIX: IMPROVE APPLYAUDIOSETTINGS
  // ============================================================
  const _origApplyAudioSettings = window.applyAudioSettings;
  window.applyAudioSettings = function() {
    console.log('Applying audio settings:', {
      musicVolume: window.musicVolume,
      sfxVolume: window.sfxVolume,
      audioMuted: window.audioMuted
    });

    // Update BGM volume
    const bgm = document.getElementById('bg-music');
    if (bgm) {
      const targetVolume = window.audioMuted || window.musicVolume === 0 ? 0 : window.musicVolume;
      bgm.volume = targetVolume;
      console.log('BGM volume set to:', targetVolume);
      
      if (window.audioMuted || window.musicVolume === 0) {
        bgm.pause();
      }
    }

    // Update all active SFX
    if (window.activeSfx) {
      window.activeSfx.forEach(a => {
        a.volume = window.audioMuted ? 0 : window.sfxVolume;
      });
    }

    // Update UI elements
    const musicVolumeInput = document.getElementById('music-volume');
    const musicVolumeValue = document.getElementById('music-volume-value');
    if (musicVolumeInput) {
      const nearestIndex = window.nearestAudioLevel?.(window.musicVolume) ?? 2;
      musicVolumeInput.value = String(nearestIndex);
      console.log('Music input value set to:', nearestIndex);
    }
    if (musicVolumeValue) {
      musicVolumeValue.textContent = Math.round((window.musicVolume || 0) * 100) + '%';
    }

    const sfxVolumeInput = document.getElementById('sfx-volume');
    const sfxVolumeValue = document.getElementById('sfx-volume-value');
    if (sfxVolumeInput) {
      const nearestIndex = window.nearestAudioLevel?.(window.sfxVolume) ?? 2;
      sfxVolumeInput.value = String(nearestIndex);
      console.log('SFX input value set to:', nearestIndex);
    }
    if (sfxVolumeValue) {
      sfxVolumeValue.textContent = Math.round((window.sfxVolume || 0) * 100) + '%';
    }

    // Update mute button
    const muteBtn = document.getElementById('btn-toggle-audio');
    if (muteBtn) {
      muteBtn.textContent = window.audioMuted ? 'OFF' : 'ON';
      muteBtn.style.background = window.audioMuted ? 'rgba(217, 101, 90, 0.3)' : 'rgba(85, 199, 154, 0.3)';
    }

    console.log('Audio settings applied successfully');
  };

  // ============================================================
  // FIX: IMPROVE TOGGLEAUDIOMUTE
  // ============================================================
  const _origToggleAudioMute = window.toggleAudioMute;
  window.toggleAudioMute = function() {
    window.audioMuted = !window.audioMuted;
    console.log('Audio muted toggled to:', window.audioMuted);
    
    try {
      localStorage.setItem('hk_audio_muted', window.audioMuted ? '1' : '0');
    } catch (e) {
      console.warn('Failed to save audio mute state:', e);
    }

    const bgm = document.getElementById('bg-music');
    if (window.audioMuted) {
      if (bgm) {
        bgm.volume = 0;
        bgm.pause();
        console.log('Music paused due to mute');
      }
      window.stopAllSfx?.();
    } else {
      window.applyAudioSettings?.();
      if (window.roundActive) {
        window.playGameMusic?.();
      }
    }

    // Update UI
    window.applyAudioSettings?.();
  };

  // ============================================================
  // FIX: REINIT ON SETTINGS SCREEN OPEN
  // ============================================================
  const _origNav = window.nav;
  window.nav = function(screenId) {
    if (_origNav) {
      _origNav.call(this, screenId);
    }

    if (screenId === 'screen-settings') {
      console.log('Settings screen opened, reinitializing audio UI');
      setTimeout(() => {
        window.initAudioSettingsUI?.();
      }, 50);
    }
  };

  // ============================================================
  // FIX: ENSURE EVENT LISTENERS ON DOM READY
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM ready, initializing audio settings UI');
    window.initAudioSettingsUI?.();
  });

  // Also try on interactive
  document.addEventListener('readystatechange', () => {
    if (document.readyState === 'interactive') {
      console.log('Document interactive, ensuring audio listeners attached');
      setTimeout(() => {
        window.initAudioSettingsUI?.();
      }, 100);
    }
  });

  // ============================================================
  // FIX: ATTACH LISTENERS IMMEDIATELY ON PAGE LOAD
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.initAudioSettingsUI?.();
    });
  } else {
    setTimeout(() => {
      window.initAudioSettingsUI?.();
    }, 100);
  }

  console.log('✓ Audio volume controls fix loaded');
  console.log('✓ Music volume range slider fixed');
  console.log('✓ SFX volume range slider fixed');
  console.log('✓ Audio mute toggle improved');
  console.log('✓ Settings screen UI reinit on open');

})();
