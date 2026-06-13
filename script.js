/* ==========================================================
   リルレオクリニック 公式サイト  script.js
   ギミック一式：問診票／肉球エフェクト／なでなで／BGM
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------
       0. ふわふわ背景の肉球を生成
    ------------------------------------------ */
    if (!reducedMotion) {
        const bg = document.createElement('div');
        bg.className = 'bg-paws';
        bg.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 10; i++) {
            const s = document.createElement('span');
            s.textContent = '🐾';
            s.style.left = Math.random() * 100 + '%';
            s.style.fontSize = (22 + Math.random() * 26) + 'px';
            s.style.animationDuration = (16 + Math.random() * 18) + 's';
            s.style.animationDelay = (Math.random() * 18) + 's';
            bg.appendChild(s);
        }
        document.body.appendChild(bg);
    }

    /* ------------------------------------------
       1. ポスター拡大表示（モーダル）
    ------------------------------------------ */
    const overlay = document.getElementById('image-overlay');
    const expandedImg = document.getElementById('expanded-image');
    const zoomableImages = document.querySelectorAll('.zoomable-img');

    if (overlay && expandedImg && zoomableImages.length > 0) {
        zoomableImages.forEach(img => {
            img.addEventListener('click', () => {
                overlay.style.display = 'flex';
                expandedImg.src = img.src;
                expandedImg.alt = img.alt;
            });
        });
        overlay.addEventListener('click', () => { overlay.style.display = 'none'; });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') overlay.style.display = 'none';
        });
    }

    /* ------------------------------------------
       2. スクロール連動：ぽよんと出現
    ------------------------------------------ */
    const fadeElements = document.querySelectorAll('.fade-in-up');
    if (fadeElements.length > 0) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });
        fadeElements.forEach(el => observer.observe(el));
    }

    /* ------------------------------------------
       3. 肉球クリックエフェクト（ページ全体）
          ※ エフェクトは overflow:hidden のレイヤー内に
            出すので、スクロールバーがちらつかない
    ------------------------------------------ */
    const fxLayer = document.createElement('div');
    fxLayer.className = 'fx-layer';
    fxLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fxLayer);

    function spawnPaw(x, y) {
        if (reducedMotion) return;
        const p = document.createElement('span');
        p.className = 'paw-pop';
        p.textContent = '🐾';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        fxLayer.appendChild(p);
        setTimeout(() => p.remove(), 850);
    }

    document.addEventListener('click', (e) => {
        // ラベルクリック時にブラウザが内部のradio/checkboxへ複製発火する
        // クリックは無視（肉球が2連発するのを防ぐ）
        if (e.target.matches('input[type="radio"], input[type="checkbox"]')) return;
        spawnPaw(e.clientX, e.clientY);
        playSfx('puni');
    });

    /* ------------------------------------------
       4. なでなでホバー：ハート・音符が飛び出す
          （.photo-frame / .cast-photo ※キャスト写真のみ）
    ------------------------------------------ */
    const PARTICLES = ['💗', '🎵', '✨', '💕', '♪'];
    function spawnParticle(x, y) {
        if (reducedMotion) return;
        const p = document.createElement('span');
        p.className = 'float-particle';
        p.textContent = PARTICLES[Math.floor(Math.random() * PARTICLES.length)];
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
        p.style.setProperty('--rot', (Math.random() * 40 - 20) + 'deg');
        fxLayer.appendChild(p);
        setTimeout(() => p.remove(), 1450);
    }

    document.querySelectorAll('.photo-frame, .cast-photo').forEach(el => {
        let last = 0;
        el.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - last > 180) {           // 出しすぎ防止
                spawnParticle(e.clientX, e.clientY);
                last = now;
            }
        });
        el.addEventListener('mouseenter', () => playSfx('kyu'));
        // タッチ端末でもなでなでできるように
        el.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            const now = Date.now();
            if (t && now - last > 200) {
                spawnParticle(t.clientX, t.clientY);
                last = now;
            }
        }, { passive: true });
    });

    /* ------------------------------------------
       5. 問診票 → 処方箋ギミック（index.html）
    ------------------------------------------ */
    const monshinOverlay = document.getElementById('monshin-overlay');

    if (monshinOverlay) {
        const card = monshinOverlay.querySelector('.monshin-card');
        const openBtns = document.querySelectorAll('.js-open-monshin');
        const closeBtn = monshinOverlay.querySelector('.monshin-close');
        const skipBtn = monshinOverlay.querySelector('.monshin-skip');
        const form = document.getElementById('monshin-form');
        const karteCloseBtn = monshinOverlay.querySelector('.shohousen-close-btn');

        // 一度閉じたら（受診・見学・✕いずれでも）次回からは自動表示しない
        function markMonshinDone() {
            try { localStorage.setItem('lilleo-monshin', 'done'); } catch (_) { }
            try { sessionStorage.setItem('lilleo-monshin', 'done'); } catch (_) { }
        }
        function isMonshinDone() {
            try { if (localStorage.getItem('lilleo-monshin') === 'done') return true; } catch (_) { }
            try { if (sessionStorage.getItem('lilleo-monshin') === 'done') return true; } catch (_) { }
            return false;
        }

        // 疲れ度（肉球レーティング）
        let tiredLevel = 3;
        const pawBtns = monshinOverlay.querySelectorAll('.paw-rating button');
        const pawLabel = monshinOverlay.querySelector('.paw-rating-label');
        const TIRED_TEXT = ['', 'げんき！', 'ちょっとだけ おつかれ', 'まあまあ おつかれ', 'かなり おつかれ…', 'もう げんかい …🫠'];

        function renderPaws() {
            pawBtns.forEach((b, i) => b.classList.toggle('on', i < tiredLevel));
            if (pawLabel) pawLabel.textContent = '疲れ度 ' + tiredLevel + '：' + TIRED_TEXT[tiredLevel];
        }
        pawBtns.forEach((b, i) => {
            b.addEventListener('click', (e) => {
                e.preventDefault();
                tiredLevel = i + 1;
                renderPaws();
                playSfx('pico');
            });
        });
        renderPaws();

        function openMonshin() {
            card.classList.remove('done');
            monshinOverlay.classList.add('open');
            const nameInput = document.getElementById('monshin-name');
            if (nameInput) setTimeout(() => nameInput.focus(), 450);
        }
        function closeMonshin() {
            if (!monshinOverlay.classList.contains('open')) return;
            monshinOverlay.classList.remove('open');
            markMonshinDone();
        }

        openBtns.forEach(b => b.addEventListener('click', openMonshin));
        if (closeBtn) closeBtn.addEventListener('click', closeMonshin);
        if (skipBtn) skipBtn.addEventListener('click', closeMonshin);
        if (karteCloseBtn) karteCloseBtn.addEventListener('click', closeMonshin);
        monshinOverlay.addEventListener('click', (e) => {
            if (e.target === monshinOverlay) closeMonshin();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMonshin();
        });

        // 自動表示は「サイトに初めて入った一度きり」。
        // 受診・見学・✕のどれかで閉じた時点で記憶され、それ以降は自動では出ない
        // （「Web問診を受けてみる」ボタンからはいつでも開けます）
        if (!isMonshinDone()) {
            setTimeout(openMonshin, 900);
        }

        // 診断ロジック
        const DIAGNOSIS = [
            '',
            '元気いっぱい症候群（とても良いことです）',
            'ちょっぴりおつかれ気味',
            'なでなで不足症（軽度）',
            'なでなで不足症（中等度）',
            '重度のなでなで欠乏症【要・肉球セラピー】'
        ];
        const RX_BY_LEVEL = [
            '',
            '肉球タッチ …… 1日1回（予防のため）',
            '肉球もみもみ …… 1日2回（朝・夜）',
            '肉球を多めに処方 …… 1日3回（毎食後）',
            '肉球を特盛りで処方 …… 気がすむまで',
            '肉球セラピー集中コース …… ようすを見ながら たっぷりと'
        ];
        const RX_BY_PLACE = {
            'あたま': 'なでなで（あたま用）…… やさしく ゆっくり',
            'おてて': 'おてて にぎにぎ …… ぷにぷに感を確かめながら',
            'おまかせ': '先生のおまかせなでなで …… 当日のお楽しみ'
        };
        const OKUSURI = ['チュール（気持ちが落ち着くやつ）', 'カリカリ（よく効くやつ）', '猫用おやつ（とくべつなやつ）', 'またたびシロップ（ほんのちょっぴり）'];

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();

                const nameRaw = (document.getElementById('monshin-name').value || '').trim();
                const name = nameRaw === '' ? '患者' : nameRaw;
                const placeInput = form.querySelector('input[name="place"]:checked');
                const place = placeInput ? placeInput.value : 'おまかせ';

                // カルテに反映（textContentなので入力値も安全）
                document.getElementById('rx-name').textContent = name + ' さん';
                document.getElementById('rx-diag').textContent = DIAGNOSIS[tiredLevel];
                document.getElementById('rx-line1').textContent = RX_BY_LEVEL[tiredLevel];
                document.getElementById('rx-line2').textContent = RX_BY_PLACE[place] || RX_BY_PLACE['おまかせ'];
                document.getElementById('rx-line3').textContent = 'おくすり：' + OKUSURI[Math.floor(Math.random() * OKUSURI.length)];

                card.classList.add('done');
                playSfx('fanfare');
                burstConfetti();
                markMonshinDone();
            });
        }
    }

    // 肉球の紙吹雪（カルテ発行時）
    function burstConfetti() {
        if (reducedMotion) return;
        const EMOJI = ['🐾', '💗', '🩹', '✨', '🐟'];
        for (let i = 0; i < 26; i++) {
            const c = document.createElement('span');
            c.className = 'confetti-paw';
            c.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
            c.style.left = Math.random() * 100 + '%';
            c.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
            c.style.animationDelay = (Math.random() * .5) + 's';
            c.style.fontSize = (16 + Math.random() * 18) + 'px';
            fxLayer.appendChild(c);
            setTimeout(() => c.remove(), 4200);
        }
    }

    /* ------------------------------------------
       6. BGM・効果音（Web Audio APIで生成）
          外部音源不要：おもちゃの病院風オルゴール
    ------------------------------------------ */
    let audioCtx = null;
    let bgmOn = false;
    let bgmTimer = null;
    let masterGain = null;

    function ensureCtx() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            audioCtx = new AC();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.16;
            masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => { });
        return audioCtx;
    }

    // 単音（オルゴール風）
    function note(freq, time, dur, vol, type) {
        const ctx = ensureCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type || 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(vol, time + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(g).connect(masterGain);
        osc.start(time);
        osc.stop(time + dur + 0.05);
    }

    // 効果音
    function playSfx(kind) {
        if (!bgmOn) return;                  // サウンドONのときだけ鳴らす
        const ctx = ensureCtx();
        if (!ctx) return;
        const t = ctx.currentTime;
        if (kind === 'puni') {               // ぷにっ
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(520, t);
            o.frequency.exponentialRampToValueAtTime(260, t + 0.12);
            g.gain.setValueAtTime(0.25, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
            o.connect(g).connect(masterGain);
            o.start(t); o.stop(t + 0.16);
        } else if (kind === 'kyu') {         // きゅぅ
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(740, t);
            o.frequency.linearRampToValueAtTime(980, t + 0.16);
            g.gain.setValueAtTime(0.12, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            o.connect(g).connect(masterGain);
            o.start(t); o.stop(t + 0.22);
        } else if (kind === 'pico') {        // ピコッ
            note(1046, t, 0.1, 0.2, 'square');
        } else if (kind === 'fanfare') {     // 処方箋ファンファーレ
            const seq = [523, 659, 784, 1046];
            seq.forEach((f, i) => note(f, t + i * 0.12, 0.3, 0.22, 'triangle'));
            note(1318, t + 0.5, 0.6, 0.2, 'triangle');
        }
    }

    // BGMループ（やさしいオルゴールのワルツ）
    const MELODY = [
        523, 0, 659, 0, 784, 0, 659, 0,
        587, 0, 698, 0, 880, 0, 698, 0,
        523, 0, 659, 0, 784, 0, 1046, 0,
        880, 0, 784, 0, 659, 0, 587, 0
    ];
    const BASS = [262, 330, 392, 330, 294, 349, 440, 349];
    let step = 0;

    function bgmTick() {
        // 自動再生制限などで停止中は予約しない（復帰時に溜まった音が一斉に鳴るのを防ぐ）
        if (!audioCtx || audioCtx.state !== 'running') return;
        const t = audioCtx.currentTime;
        const m = MELODY[step % MELODY.length];
        if (m) note(m, t, 0.45, 0.12, 'triangle');
        if (step % 4 === 0) {
            note(BASS[(step / 4) % BASS.length], t, 0.8, 0.07, 'sine');
        }
        // ときどきキラッと装飾音
        if (step % 16 === 14) note(1568, t, 0.25, 0.06, 'sine');
        step++;
    }

    function startBgm() {
        if (!ensureCtx()) return;
        stopBgmTimer();
        step = 0;
        bgmTimer = setInterval(bgmTick, 230);
    }
    function stopBgmTimer() {
        if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    }

    // トグルボタンを全ページに設置（テキスト付きでわかりやすく）
    const soundBtn = document.createElement('button');
    soundBtn.className = 'sound-toggle';
    soundBtn.setAttribute('aria-label', 'BGMと効果音のオン・オフ');
    document.body.appendChild(soundBtn);

    function renderSoundBtn() {
        if (bgmOn) {
            soundBtn.classList.add('playing');
            soundBtn.innerHTML = '🎵 <span class="st-full">BGM・効果音 </span>ON';
        } else {
            soundBtn.classList.remove('playing');
            soundBtn.innerHTML = '🔇 <span class="st-full">BGM・効果音 </span>OFF';
        }
    }

    function saveSound() {
        try { localStorage.setItem('lilleo-sound', bgmOn ? 'on' : 'off'); } catch (_) { }
    }

    soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        bgmOn = !bgmOn;
        if (bgmOn) {
            startBgm();
            playSfx('pico');
        } else {
            stopBgmTimer();
        }
        renderSoundBtn();
        saveSound();
    });

    // 前回ONだった場合は遷移後すぐ復帰を試みる。
    // ブラウザの自動再生制限で即時に鳴らせない場合でも、
    // タップ・クリック・キー操作・スクロール等の最初の操作で自動的に鳴り出す
    let savedSound = 'off';
    try { savedSound = localStorage.getItem('lilleo-sound') || 'off'; } catch (_) { }
    if (savedSound === 'on') {
        bgmOn = true;
        startBgm();   // 許可されている環境ならこの時点で再生開始

        const RESUME_EVENTS = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'wheel', 'scroll'];
        const tryResume = () => {
            if (!bgmOn) { cleanup(); return; }
            if (!audioCtx) startBgm();
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => { });
            }
            if (audioCtx && audioCtx.state === 'running') cleanup();
        };
        const cleanup = () => RESUME_EVENTS.forEach(ev => document.removeEventListener(ev, tryResume));
        RESUME_EVENTS.forEach(ev => document.addEventListener(ev, tryResume, { passive: true }));

        // ページがbfcache（戻る/進む）から復元された際にもBGM再開を試みる
        window.addEventListener('pageshow', tryResume);
    }
    renderSoundBtn();

    /* ------------------------------------------
       7. ボタンクリック時のログ（既存機能を維持）
    ------------------------------------------ */
    document.querySelectorAll('.buttons .btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const buttonText = event.currentTarget.textContent.trim();
            console.log(`ボタンがクリックされました: ${buttonText}`);
        });
    });

});
