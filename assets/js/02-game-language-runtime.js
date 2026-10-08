
(function(){
  const LANG_KEY='hk_language';
  const TEXT={
    'main.play':{en:'Play Game',id:'Main'},
    'main.history':{en:'History',id:'Riwayat'},
    'main.settings':{en:'Settings',id:'Pengaturan'},
    'profile.customize':{en:'Customize Profile',id:'Sesuaikan Profil'},
    'settings.kicker':{en:'Set up game and audio.',id:'Atur permainan dan audio.'},
    'settings.music':{en:'Music Volume',id:'Volume Musik'},
    'settings.musicHelp':{en:'Game music volume.',id:'Volume musik permainan.'},
    'settings.sfx':{en:'SFX Volume',id:'Volume Efek Suara'},
    'settings.sfxHelp':{en:'Game sound effects.',id:'Efek suara permainan.'},
    'settings.audio':{en:'Audio',id:'Audio'},
    'settings.audioHelp':{en:'Mute all sounds.',id:'Matikan semua suara.'},
    'settings.autosort':{en:'Auto-Sort Hand',id:'Urutkan Tangan Otomatis'},
    'settings.autosortHelp':{en:'Automatically sort player tiles.',id:'Urutkan tile pemain secara otomatis.'},
    'settings.backGame':{en:'Back to Game',id:'Kembali ke Permainan'},
    'settings.backMenu':{en:'Back to Main Menu',id:'Kembali ke Menu Utama'},
    'settings.language':{en:'Language',id:'Bahasa'},
    'play.kicker':{en:'Game Modes',id:'Mode Permainan'},
    'play.title':{en:'Select Mode',id:'Pilih Mode'},
    'play.subtitle':{en:'Profile and style are saved. Choose a mode to play.',id:'Profil dan style sudah tersimpan. Pilih mode untuk langsung bermain.'},
    'play.single':{en:'Singleplayer',id:'Pemain Tunggal'},
    'play.multi':{en:'Multiplayer Lobby',id:'Lobby Multiplayer'},
    'play.vsPlayer':{en:'VS PLAYER',id:'VS PLAYER'},
    'play.back':{en:'Back',id:'Kembali'},
    'profile.kicker':{en:'PLAYER PROFILE',id:'PROFIL PEMAIN'},
    'profile.title':{en:'Customize Your Style',id:'Sesuaikan Gaya'},
    'profile.copy':{en:'Name, avatar, table color, center board background, and frame are saved on this device.',id:'Nama, avatar, warna meja, background center board, dan frame tersimpan di perangkat ini.'},
    'profile.profile':{en:'PROFILE',id:'PROFIL'},
    'profile.avatar':{en:'AVATAR',id:'AVATAR'},
    'profile.table':{en:'TABLE FELT',id:'WARNA MEJA'},
    'profile.center':{en:'CENTER BOARD BACKGROUND',id:'LATAR CENTER BOARD'},
    'profile.frame':{en:'CENTER FRAME',id:'FRAME CENTER BOARD'},
    'profile.preview':{en:'LIVE PREVIEW',id:'PRATINJAU LANGSUNG'},
    'profile.reset':{en:'Reset Style',id:'Atur Ulang Gaya'},
    'profile.save':{en:'Save & Close',id:'Simpan & Tutup'},
    'profile.namePlaceholder':{en:'Player name',id:'Nama pemain'},
    'lobby.kicker':{en:'ONLINE FRIEND ROOM',id:'ROOM TEMAN ONLINE'},
    'lobby.title':{en:'Multiplayer',id:'Multiplayer'},
    'lobby.create':{en:'Create Room',id:'Buat Room'},
    'lobby.share':{en:'Share Room',id:'Bagikan Room'},
    'lobby.shareLink':{en:'Share Link',id:'Bagikan Link'},
    'lobby.join':{en:'Join Room',id:'Gabung Room'},
    'lobby.roomCode':{en:'Room Code',id:'Kode Room'},
    'lobby.joinNow':{en:'Join Now',id:'Gabung Sekarang'},
    'lobby.reconnect':{en:'Reconnect',id:'Sambungkan Kembali'},
    'lobby.copy':{en:'Copy',id:'Salin'},
    'lobby.ready':{en:'READY',id:'SIAP'},
    'lobby.cancelReady':{en:'CANCEL READY',id:'BATAL SIAP'},
    'lobby.start':{en:'START GAME',id:'MULAI GAME'},
    'lobby.leave':{en:'Leave',id:'Keluar'},
    'history.multi':{en:'MULTIPLAYER',id:'MULTIPLAYER'},
    'history.title':{en:'Game History',id:'Riwayat Pertandingan'},
    'history.sub':{en:'Saved multiplayer matches on this device.',id:'Riwayat pertandingan multiplayer yang tersimpan di perangkat ini.'},
    'history.detail':{en:'Match Details',id:'Detail Pertandingan'},
    'history.roundDetail':{en:'Round Details',id:'Detail Per Ronde'},
    'history.closeDetail':{en:'Back to Match Details',id:'Kembali ke Detail Pertandingan'},
    'history.empty':{en:'No saved multiplayer matches on this device.',id:'Belum ada pertandingan multiplayer yang tersimpan di perangkat ini.'},
    'result.round':{en:'ROUND RESULT',id:'HASIL RONDE'},
    'result.hand':{en:'Winning Hand',id:'Tangan Kemenangan'},
    'result.score':{en:'Scoreboard',id:'Papan Skor'},
    'result.next':{en:'Next Round',id:'Lanjut ke Ronde Berikutnya'},
    'result.matchOver':{en:'MATCH COMPLETE',id:'PERTANDINGAN SELESAI'},
    'result.final':{en:'Final Standings',id:'Peringkat Akhir'},
    'result.playAgain':{en:'Play Again',id:'Main Lagi'},
    'result.mainMenu':{en:'Main Menu',id:'Menu Utama'},
    'scoreGuide.launch':{en:'Score Guide',id:'Panduan Skor'},
    'scoreGuide.kicker':{en:'MAHJONG-DJ',id:'MAHJONG-DJ'},
    'scoreGuide.title':{en:'SCORE GUIDE',id:'PANDUAN SKOR'},
    'lobby.leave':{en:'Leave',id:'Keluar'},
    'lobby.shareHelp':{en:'Share this link with other players. Empty seats will be played by AI.',id:'Bagikan link ini ke pemain lain. Kursi kosong akan tetap dimainkan AI.'},
    'lobby.transport':{en:'Transport uses Cloudflare.',id:'Transport memakai Cloudflare.'},
    'lobby.joinHelp':{en:'Enter the room code to join automatically.',id:'Masukan Kode Room akan Masuk otomatis.'},
    'lobby.modeHelp':{en:'Multiplayer uses a shared link; all players can use the same link.',id:'Mode multiplayer Memakai Link, semua pemain cukup menggunakan link yang sama.'},
    'result.roundTitle':{en:'Round Complete',id:'Ronde Selesai'},
    'result.waiting':{en:'Waiting for the host to reopen the room to play again…',id:'Menunggu host membuka room untuk main lagi…'},
    'common.close':{en:'Close',id:'Tutup'},
    'common.room':{en:'Room',id:'Room'},
    'common.duration':{en:'Duration',id:'Durasi'},
    'common.round':{en:'Round',id:'Ronde'},
    'common.player':{en:'Player',id:'Pemain'},
    'common.players':{en:'Players',id:'Pemain'},
    'common.match':{en:'Match',id:'Pertandingan'},
    'common.finalResult':{en:'Final Result',id:'Hasil Akhir'},
    'common.chooseRound':{en:'Choose Round',id:'Pilih Ronde'},
    'common.meld':{en:'MELD',id:'MELD'},
    'common.scoreAfterRound':{en:'Score After Round',id:'Skor Setelah Ronde'},
    'common.handUnavailable':{en:'Winning hand details are unavailable.',id:'Detail tangan kemenangan tidak tersedia.'},
    'common.noWinner':{en:'No winner',id:'Tidak ada pemenang'},
    'common.noRoundDetail':{en:'Round details are unavailable.',id:'Detail ronde tidak tersedia.'}
  };

  const STATIC=[
    ['#screen-settings .section-kicker','settings.kicker'],
    ['#screen-settings .settings-row:nth-of-type(2) .settings-label strong','settings.music'],
    ['#screen-settings .settings-row:nth-of-type(2) .settings-label span','settings.musicHelp'],
    ['#screen-settings .settings-row:nth-of-type(3) .settings-label strong','settings.sfx'],
    ['#screen-settings .settings-row:nth-of-type(3) .settings-label span','settings.sfxHelp'],
    ['#screen-settings .settings-pair .settings-row:nth-child(1) .settings-label strong','settings.audio'],
    ['#screen-settings .settings-pair .settings-row:nth-child(1) .settings-label span','settings.audioHelp'],
    ['#screen-settings .settings-pair .settings-row:nth-child(2) .settings-label strong','settings.autosort'],
    ['#screen-settings .settings-pair .settings-row:nth-child(2) .settings-label span','settings.autosortHelp'],
    ['#screen-settings .settings-actions .btn-primary','settings.backGame'],
    ['#screen-settings .settings-actions .btn-danger','settings.backMenu'],
    ['#screen-main .main-play-btn','main.play'],
    ['#screen-main .main-history-btn','main.history'],
    ['#screen-main .main-settings-btn > span:last-child','main.settings'],
    ['#modal-lobby .setup-actions .btn-primary','lobby.ready'],
    ['#mp-setup .mp-p2p-choice .btn-primary','lobby.create'],
    ['#mp-setup .btn-danger','lobby.leave'],
    ['#mp-host-invite .p2p-mini:nth-of-type(1)','lobby.shareHelp'],
    ['#mp-host-invite .p2p-mini:nth-of-type(2)','lobby.transport'],
    ['#mp-guest-invite .mp-hint','lobby.joinHelp'],
    ['#mp-setup > .mp-hint','lobby.modeHelp'],
    ['#res-title','result.roundTitle'],
    ['#modal-result .result-section-title:nth-of-type(1)','result.hand'],
    ['#modal-result .result-section-title:nth-of-type(2)','result.score'],
    ['#matchover-waiting-hint','result.waiting'],
    ['#score-guide-drawer .score-guide-launcher','scoreGuide.launch'],
    ['#language-label','settings.language'],
    ['#screen-play .brand-kicker','play.kicker'],
    ['#play-title','play.title'],
    ['#screen-play .brand-subtitle','play.subtitle'],
    ['#screen-play .mode-card:nth-child(1) span','play.single'],
    ['#screen-play .mode-card:nth-child(2) span','play.multi'],
    ['#screen-play .mode-card:nth-child(2) strong','play.vsPlayer'],
    ['#screen-play .mode-back','play.back'],
    ['#modal-avatar-picker .modal-kicker','profile.kicker'],
    ['#avatar-picker-title','profile.title'],
    ['#modal-avatar-picker .modal-copy','profile.copy'],
    ['#modal-avatar-picker .style-section-title:nth-child(1)','profile.profile'],
    ['#modal-avatar-picker .profile-style-column:first-child .style-section:nth-child(2) .style-section-title','profile.avatar'],
    ['#modal-avatar-picker .style-choice-pair .style-section:nth-child(1) .style-section-title','profile.table'],
    ['#modal-avatar-picker .style-choice-pair .style-section:nth-child(2) .style-section-title','profile.center'],
    ['#modal-avatar-picker .style-choice-pair .style-section:nth-child(3) .style-section-title','profile.frame'],
    ['#modal-avatar-picker .style-live-preview .style-section-title','profile.preview'],
    ['#modal-avatar-picker .profile-style-actions .btn-secondary','profile.reset'],
    ['#modal-avatar-picker .profile-style-actions .btn-primary','profile.save'],
    ['#custom-player-name','profile.namePlaceholder'],
    ['#modal-lobby .modal-kicker','lobby.kicker'],
    ['#lobby-title','lobby.title'],
    ['#mp-host-invite .p2p-card-title','lobby.share'],
    ['#btn-share-room-link','lobby.shareLink'],
    ['#mp-guest-invite .p2p-card-title','lobby.join'],
    ['label[for="mp-room-code"]','lobby.roomCode'],
    ['#mp-guest-invite .p2p-card:first-child .btn-wide','lobby.joinNow'],
    ['#mp-reconnect-card .btn','lobby.reconnect'],
    ['#mp-room-panel .room-share-card .btn','lobby.copy'],
    ['#btn-lobby-start','lobby.start'],
    ['#history-title','history.title'],
    ['#modal-history .history-subtitle','history.sub'],
    ['#history-detail-title','history.detail'],
    ['#history-round-title','history.roundDetail'],
    ['#modal-history-round .history-close-row .btn','history.closeDetail'],
    ['#modal-result #res-round-label','result.round'],
    ['#modal-result .result-section-title:nth-of-type(1)','result.hand'],
    ['#modal-result .result-section-title:nth-of-type(2)','result.score'],
    ['#modal-match-over #matchover-title','result.matchOver'],
    ['#modal-match-over .result-section-title','result.final'],
    ['#btn-matchover-rematch','result.playAgain'],
    ['#modal-match-over .btn-secondary','result.mainMenu'],
    ['#screen-game .score-guide-launcher span:last-child','scoreGuide.launch'],
    ['#score-guide-drawer .score-guide-drawer-kicker','scoreGuide.kicker'],
    ['#score-guide-drawer .score-guide-drawer-title','scoreGuide.title'],
    ['#modal-history .history-kicker','history.multi'],
    ['#modal-history-detail .history-kicker','history.multi'],
    ['#modal-history-round .history-kicker','history.roundDetail']
  ];

  const DYNAMIC={
    'Atur permainan dan audio.':'Set up game and audio.',
    'Volume musik permainan.':'Game music volume.',
    'Efek suara permainan.':'Game sound effects.',
    'Mute semua suara.':'Mute all sounds.',
    'Urutkan tile pemain secara otomatis.':'Automatically sort player tiles.',
    'Kembali ke Permainan':'Back to Game',
    'Buat Room':'Create Room',
    'Kembali ke Menu Utama':'Back to Main Menu',
    'Main':'Play',
    'Riwayat':'History',
    'Pengaturan':'Settings',
    'Sesuaikan Profil':'Customize Profile',
    'Mode Permainan':'Game Modes',
    'Pilih Mode':'Select Mode',
    'Pemain Tunggal':'Singleplayer',
    'Lobby Multiplayer':'Multiplayer Lobby',
    'Kembali':'Back',
    'Nama pemain':'Player name',
    'Atur Ulang Gaya':'Reset Style',
    'Simpan & Tutup':'Save & Close',
    'Tutup':'Close',
    'Bagikan Room':'Share Room',
    'Bagikan Link':'Share Link',
    'Gabung Room':'Join Room',
    'Kode Room':'Room Code',
    'Gabung Sekarang':'Join Now',
    'Menyambungkan kembali':'Reconnecting',
    'Sesi room tersimpan.':'Saved room session.',
    'Sambungkan Kembali':'Reconnect',
    'Masukan Kode Room akan Masuk otomatis.':'Enter the room code to join automatically.',
    'Salin':'Copy',
    'BATAL SIAP':'CANCEL READY',
    'MULAI GAME':'START GAME',
    'Keluar':'Leave',
    'SIAP':'READY',
    'Belum ada pertandingan multiplayer yang tersimpan di perangkat ini.':'No saved multiplayer matches on this device.',
    'Detail Pertandingan':'Match Details',
    'Detail Per Round':'Round Details',
    'Lihat History Per Round ›':'View Round History ›',
    'Kembali ke Detail Pertandingan':'Back to Match Details',
    'Pertandingan':'Match',
    'Hasil Akhir':'Final Result',
    'Peringkat Akhir':'Final Standings',
    'Tangan Kemenangan':'Winning Hand',
    'Papan Skor':'Scoreboard',
    'Skor Setelah Ronde':'Score After Round',
    'Detail tangan tidak tersedia.':'Winning hand details are unavailable.',
    'Detail ronde tidak tersedia.':'Round details are unavailable.',
    'Pilih Round':'Choose Round',
    'Ronde':'Round',
    'Menit':'minutes',
    'Pemain':'Player',
    'Durasi':'Duration',
    'SISA':'LEFT',
    'HASIL RONDE':'ROUND RESULT',
    'PERTANDINGAN SELESAI':'MATCH COMPLETE',
    'FINAL':'FINAL',
    'Main Lagi':'Play Again',
    'Menu Utama':'Main Menu',
    'Panduan Skor':'Score Guide',
    'ONLINE':'ONLINE',
    'OFFLINE':'OFFLINE',
    'TERPUTUS':'DISCONNECTED',
    'Berbagi link berhasil disalin.':'Room link copied.',
    'Link room berhasil disalin.':'Room link copied.',
    'Link room siap disalin.':'Room link ready to copy.',
    'Room error':'Room error',
    'Room dibuat. Bagikan link/QR kepada pemain lain.':'Room created. Share the link/QR with other players.',
    'Berhasil masuk room. Kamu otomatis READY.':'Joined the room. You are automatically READY.',
    'Menyambungkan kembali…':'Reconnecting…',
    'Memulihkan keadaan meja terakhir.':'Restoring the latest table state.',
    'Menunggu state permainan dari room.':'Waiting for the room game state.',
    'Sesi permainan belum dapat dipulihkan':'The game session could not be restored',
    'Room tidak mengirim state permainan. Silakan kembali ke menu utama atau coba lagi.':'The room did not provide game state. Return to the main menu or try again.',
    'Menunggu state permainan terbaru.':'Waiting for the latest game state.',
    'Menunggu state permainan':'Waiting for game state',
    'Belum menerima state terbaru dari room. Koneksi akan mencoba kembali.':'The latest room state has not arrived. The connection will retry.',
    'Permainan dilanjutkan':'Game resumed',
    'State room tidak tersedia; memakai snapshot host terakhir.':'Room state unavailable; using the latest host snapshot.',
    'Sinkron dengan room.':'Synced with room.',
    'State permainan tidak dapat dipulihkan':'Game state could not be restored',
    'Room mengirim state yang tidak dapat dipakai untuk melanjutkan sesi.':'The room sent an unusable state for resuming the session.',
    'Aksi tersedia':'Actions available',
    'Pilih aksi sebelum waktu habis.':'Choose an action before time runs out.',
    'Giliran Anda':'Your turn',
    'Pilih aksi atau tile untuk dibuang.':'Choose an action or a tile to discard.',
    'Pilih tile untuk membuang.':'Choose a tile to discard.',
    'Menunggu giliran pemain.':'Waiting for the player\'s turn.',
    'RON TERSEDIA':'RON AVAILABLE',
    'Kartu buangan terakhir membuat Anda bisa menang.':'The last discard allows you to win.',
    'Lewati':'Skip',
    'Tunggu host membuka room untuk main lagi.':'Waiting for the host to reopen the room.',
    'Tekan SIAP lalu MULAI GAME untuk bermain lagi.':'Press READY, then START GAME to play again.',
    'Host membuka room untuk main lagi. Tekan SIAP.':'The host reopened the room. Press READY.',
    'Semua kursi terisi.':'All seats are filled.',
    'Room siap.':'Room ready.',
    'Kursi kosong':'Empty seat',
    'Tidak ada detail kemenangan.':'No winning details.',
    'Tidak ada pemenang':'No winner',
    'Draw':'Draw',
    'Menang':'Win',
    'Room':'Room',
    'Multiplayer':'Multiplayer',
    'Multiplayer Lobby':'Multiplayer Lobby',
    'Solo • AI':'Solo • AI',
    'GAME OPTIONS':'GAME OPTIONS',
    'GAMEPLAY':'GAMEPLAY'
  };

  function loadLang(){
    try{
      const v=localStorage.getItem(LANG_KEY);
      return v==='id'?'id':'en';
    }catch(e){return 'en'}
  }
  window.hkLanguage=loadLang();

  function dictTranslate(s){
    const raw=String(s??'');
    if(raw in DYNAMIC)return window.hkLanguage==='id'?raw:DYNAMIC[raw];
    if(window.hkLanguage==='id')return raw;
    return DYNAMIC[raw]||raw;
  }

  window.hkTranslateText=function(v){
    if(v==null)return '';
    let s=String(v);
    if(!s)return '';

    if(s.startsWith('SISA '))return window.hkLanguage==='id'?s:s.replace(/^SISA /,'LEFT ');
    if(s.startsWith('LEFT '))return window.hkLanguage==='id'?s.replace(/^LEFT /,'SISA '):s;

    // Common dynamic status lines.
    let m=s.match(/^Giliran (.+)$/);
    if(m)return window.hkLanguage==='id'?s:`Turn: ${m[1]}`;
    m=s.match(/^Turn: (.+)$/);
    if(m)return window.hkLanguage==='id'?`Giliran ${m[1]}`:s;
    m=s.match(/^Pilih aksi: (.+) atau pilih tile\.$/);
    if(m)return window.hkLanguage==='id'?s:`Choose an action: ${m[1]} or choose a tile.`;
    m=s.match(/^Choose an action: (.+) or choose a tile\.$/);
    if(m)return window.hkLanguage==='id'?`Pilih aksi: ${m[1]} atau pilih tile.`:s;
    m=s.match(/^Pilih aksi sebelum waktu habis\.$/);
    if(m)return window.hkLanguage==='id'?s:'Choose an action before time runs out.';
    m=s.match(/^Menunggu call prioritas lebih tinggi\.\.\. (\d+)s$/);
    if(m)return window.hkLanguage==='id'?s:`Waiting for a higher-priority call… ${m[1]}s`;
    m=s.match(/^Waiting for a higher-priority call… (\d+)s$/);
    if(m)return window.hkLanguage==='id'?`Menunggu call prioritas lebih tinggi... ${m[1]}s`:s;
    m=s.match(/^Room siap\. (\d+)\/4 pemain; kursi kosong dapat diisi AI saat game dimulai\.$/);
    if(m)return window.hkLanguage==='id'?s:`Room ready. ${m[1]}/4 players; empty seats will be filled by AI when the game starts.`;
    m=s.match(/^Room ready\. (\d+)\/4 players; empty seats will be filled by AI when the game starts\.$/);
    if(m)return window.hkLanguage==='id'?`Room siap. ${m[1]}/4 pemain; kursi kosong dapat diisi AI saat game dimulai.`:s;
    m=s.match(/^([^•]+) menang dengan (.+) poin$/);
    if(m)return window.hkLanguage==='id'?s:`${m[1]} won with ${m[2]} points`;
    m=s.match(/^([^•]+) won with (.+) points$/);
    if(m)return window.hkLanguage==='id'?`${m[1]} menang dengan ${m[2]} poin`:s;
    m=s.match(/(\d+) poin/g);
    if(m&&window.hkLanguage==='en')s=s.replace(/(\d+) poin/g,'$1 points');
    if(window.hkLanguage==='id')s=s.replace(/(\d+) points/g,'$1 poin');

    return dictTranslate(s);
  };

  window.hkTranslateRemaining=function(n){return `${window.hkLanguage==='id'?'SISA':'LEFT'} ${Math.max(0,Number(n)||0)}`};
  window.hkActionLabel=function(type){
    const t=String(type||'');
    if(t==='Skip')return window.hkLanguage==='id'?'Lewati':'Skip';
    if(t==='Pong'||t==='Pung')return window.hkLanguage==='id'?'Pung':'Pung';
    if(t==='Chi')return 'Chi';
    if(t==='Kan')return 'Kan';
    if(t==='Ron')return 'Ron';
    if(t==='Tsumo')return 'Tsumo';
    return t;
  };

  function setElementText(el,text){
    if(!el)return;
    el.textContent=TEXT[text]?.[window.hkLanguage]||dictTranslate(text);
  }

  function applyStatic(){
    STATIC.forEach(([selector,key])=>{
      const el=document.querySelector(selector);
      if(!el)return;
      const val=TEXT[key]?.[window.hkLanguage];
      if(val==null)return;
      if(el.tagName==='INPUT')el.placeholder=val;
      else if(el.tagName==='SELECT'){
        // Section heading selectors on <select> are not expected; options are handled below.
      }else setElementText(el,key);
    });

    // Main menu buttons contain icons/arrow spans; replace only their text nodes.
    const hist=document.querySelector('#screen-main .main-history-btn');
    if(hist){for(const n of hist.childNodes){if(n.nodeType===3){n.textContent=`${TEXT['main.history'][window.hkLanguage]}`;break}}}
    const settings=document.querySelector('#screen-main .main-settings-btn');
    if(settings){const spans=settings.querySelectorAll('span');if(spans[1])spans[1].textContent=TEXT['main.settings'][window.hkLanguage];}
    const profileSmall=document.querySelector('#screen-main .profile-card-copy small');
    if(profileSmall){for(const n of profileSmall.childNodes){if(n.nodeType===3){n.textContent=TEXT['profile.customize'][window.hkLanguage]+' ';break}}}

    // Preserve the profile arrow and avatar/user data.
    const options={
      board:[['emerald','Emerald Forest'],['jade','Deep Jade'],['teal','Deep Teal'],['petrol','Petrol Blue'],['navy','Royal Navy'],['indigo','Indigo Night'],['olive','Dark Olive'],['obsidian','Obsidian']],
      center:[['emerald','Emerald Silk'],['jade','Jade Ink'],['teal','Ocean Teal'],['sapphire','Sapphire Ink'],['indigo','Midnight Indigo'],['aubergine','Royal Aubergine'],['copper','Copper Silk'],['obsidian','Black Ink']]
    };
    options.board.forEach(([v,label])=>{const opt=document.querySelector(`#custom-board-select option[value="${v}"]`);if(opt)opt.textContent=label});
    options.center.forEach(([v,label])=>{const opt=document.querySelector(`#custom-center-select option[value="${v}"]`);if(opt)opt.textContent=label});
    const frameOptions=[['classic-gold','Classic Gold'],['jade-dragon','Jade Dragon'],['red-lacquer','Red Lacquer'],['black-obsidian','Black Obsidian'],['sapphire-luxe','Sapphire Luxe'],['lotus','Lotus'],['bamboo','Bamboo'],['oriental-cloud','Oriental Cloud'],['modern-minimal','Modern Minimal'],['arcadia','Arcadia']];
    frameOptions.forEach(([v,label])=>{const opt=document.querySelector(`#custom-frame-select option[value="${v}"]`);if(opt)opt.textContent=label});

    const remain=document.querySelector('.style-preview-remain');
    if(remain)remain.textContent=hkTranslateRemaining(81);

    const langBtn=document.getElementById('btn-language-toggle');
    if(langBtn){langBtn.textContent=window.hkLanguage.toUpperCase();langBtn.setAttribute('aria-label',window.hkLanguage==='id'?'Ganti ke bahasa Inggris':'Switch to Indonesian');}
    document.documentElement.dataset.hkLang=window.hkLanguage;

    // Native labels/ARIA used by important controls.
    document.querySelectorAll('[aria-label="Tutup"]').forEach(el=>el.setAttribute('aria-label',TEXT['common.close'][window.hkLanguage]));
    const nameInput=document.getElementById('custom-player-name');
    if(nameInput)nameInput.placeholder=TEXT['profile.namePlaceholder'][window.hkLanguage];

    // Keep main menu profile copy aligned with the selected language.
    const mainProfile=document.getElementById('main-profile-card');
    if(mainProfile)mainProfile.setAttribute('aria-label',TEXT['profile.title'][window.hkLanguage]);

    // Re-render affected game labels when the language changes.
    try{if(typeof renderNames==='function' && (typeof roundActive!=='undefined'))renderNames();}catch(e){}
    try{if(typeof renderPlayerConnectionStatus==='function' && (typeof mp!=='undefined'))renderPlayerConnectionStatus(mp.room);}catch(e){}
    try{if(typeof gameChatRefreshVisibility==='function')gameChatRefreshVisibility();}catch(e){}
    try{
      const actionTitle=document.querySelector('#action-overlay .action-overlay-title');
      if(actionTitle)actionTitle.textContent=window.hkLanguage==='id'?'TINDAKAN':'ACTION';
      const actionPhase=document.querySelector('#action-overlay .action-overlay-phase');
      if(actionPhase&&document.getElementById('action-overlay')?.classList.contains('action-time-bank'))actionPhase.textContent='TIME BANK';
      else if(actionPhase)actionPhase.textContent='PILIH';
    }catch(e){}
    try{
      const tiles=document.getElementById('tiles-remaining');
      if(tiles){const m=String(tiles.textContent||'').match(/(?:SISA|LEFT)\s+(\d+)/);if(m)tiles.textContent=hkTranslateRemaining(m[1]);}
    }catch(e){}
  }

  window.applyGameLanguage=applyStatic;
  window.toggleGameLanguage=function(){
    window.hkLanguage=window.hkLanguage==='id'?'en':'id';
    try{localStorage.setItem(LANG_KEY,window.hkLanguage)}catch(e){}
    applyStatic();
  };

  // Initial pass after the DOM is available.
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyStatic,{once:true});
  else applyStatic();
})();
