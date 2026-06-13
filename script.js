/* ==========================================================
   リルレオクリニック 公式サイト  script.js
   ギミック一式：問診票／肉球エフェクト／なでなで／BGM
   ＋ 擬似SPA遷移（ページをリロードせず中身だけ差し替え）
     → AudioContextが破棄されないので、最初に一度鳴らせば
       以降は画面遷移してもBGMが鳴り続ける（スマホでもPCのように）
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 遷移しても消さない「常設ノード」（背景・エフェクト層・サウンドボタン）
    const persistent = [];

    /* ------------------------------------------
       0. ふわふわ背景の肉球を生成（常設）
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
        persistent.push(bg);
    }

    /* ------------------------------------------
       肉球エフェクト用レイヤー（常設）
       ※ overflow:hidden のレイヤー内に出すのでスクロールバーがちらつかない
    ------------------------------------------ */
    const fxLayer = document.createElement('div');
    fxLayer.className = 'fx-layer';
    fxLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fxLayer);
    persistent.push(fxLayer);

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
       肉球クリックエフェクト（ページ全体・常設）
    ------------------------------------------ */
    document.addEventListener('click', (e) => {
        // ラベルクリック時にブラウザが内部のradio/checkboxへ複製発火する
        // クリックは無視（肉球が2連発するのを防ぐ）
        if (e.target.matches('input[type="radio"], input[type="checkbox"]')) return;
        spawnPaw(e.clientX, e.clientY);
        // 通常遷移で別ページへ飛ぶリンクのクリックでは効果音を鳴らさない
        // （SPA遷移はページ破棄が無いので問題ないが、フォールバック時の雑音防止）。
        const link = e.target.closest ? e.target.closest('a[href]') : null;
        if (link) {
            const href = link.getAttribute('href') || '';
            const sameTab = !link.target || link.target === '_self';
            const leavesPage = sameTab && href && !href.startsWith('#') && !href.toLowerCase().startsWith('javascript:');
            if (leavesPage) return;
        }
        playSfx('puni');
    });

    /* ==========================================================
       BGM・効果音（Web Audio APIで生成・常設）
       外部音源不要：おもちゃの病院風オルゴール
       ========================================================== */
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

    // トグルボタンを全ページに設置（常設・テキスト付きでわかりやすく）
    const soundBtn = document.createElement('button');
    soundBtn.className = 'sound-toggle';
    soundBtn.setAttribute('aria-label', 'BGMと効果音のオン・オフ');
    document.body.appendChild(soundBtn);
    persistent.push(soundBtn);

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
        try { sessionStorage.setItem('lilleo-sound', bgmOn ? 'on' : 'off'); } catch (_) { }
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

    // サウンドのON/OFFは「同じ訪問（セッション）」の間だけ記憶する。
    //  → 初めてサイトに入ったとき（新規セッション）は必ずOFF。
    //  → 同じ訪問の間はON/OFFが引き継がれる。
    // ※ただし擬似SPA遷移ではページがリロードされないため、ここを通るのは
    //   「初回読み込み」と「フォールバックの通常遷移」のときだけ。
    let savedSound = 'off';
    try { savedSound = sessionStorage.getItem('lilleo-sound') || 'off'; } catch (_) { }
    if (savedSound === 'on') {
        bgmOn = true;

        // タッチ端末（特にiOS Safari）かどうかを判定。
        //  ・タッチ端末：AudioContextは「ユーザー操作の中」で生成しないと
        //    その後いくら resume() しても音が出ない（死んだ状態になる）。
        //    → 生成を最初のタップ等（activationとして有効な操作）まで遅らせる。
        //  ・PC：読み込み時に生成しておき、最初の操作で再開する従来方式が確実。
        const needsGesture = (() => {
            const ua = navigator.userAgent || '';
            const iOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
            const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
            return iOS || coarse;
        })();

        if (!needsGesture) startBgm();

        const ACTIVATION = ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown'];
        const RESUME_EVENTS = needsGesture ? ACTIVATION : ACTIVATION.concat(['mousedown', 'wheel', 'scroll', 'mousemove']);

        const tryResume = (e) => {
            if (!bgmOn) { cleanup(); return; }
            if (!audioCtx && (!needsGesture || ACTIVATION.indexOf(e.type) !== -1)) startBgm();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => { });
            if (audioCtx && audioCtx.state === 'running') cleanup();
        };
        const cleanup = () => RESUME_EVENTS.forEach(ev => document.removeEventListener(ev, tryResume));
        RESUME_EVENTS.forEach(ev => document.addEventListener(ev, tryResume, { passive: true }));

        // 再表示・bfcache（戻る/進む）復帰でも再開を試みる（新規生成はしない）
        const resumeIfExists = () => {
            if (bgmOn && audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => { });
        };
        window.addEventListener('pageshow', resumeIfExists);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') resumeIfExists();
        });
    }
    renderSoundBtn();

    /* ------------------------------------------
       共通：Escapeで開いているオーバーレイを閉じる（常設）
    ------------------------------------------ */
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const ov = document.getElementById('image-overlay');
        if (ov && ov.style.display === 'flex') ov.style.display = 'none';
        const ms = document.getElementById('monshin-overlay');
        if (ms && ms.classList.contains('open')) {
            ms.classList.remove('open');
            try { localStorage.setItem('lilleo-monshin', 'done'); } catch (_) { }
            try { sessionStorage.setItem('lilleo-monshin', 'done'); } catch (_) { }
        }
    });

    /* ==========================================================
       ここから下は「ページ毎の初期化」。
       擬似SPA遷移のたびに initPage() で呼び直す。
       （新しい要素にだけ束ねるので、リスナーは重複しない）
       ========================================================== */

    /* --- キャストプロフィール（profile.html?id=…） --- */
    function renderProfile() {
        const container = document.querySelector('.profile-container');
        if (!container) return;

        // 役職順：院長 ➔ 副院長 ➔ 医者
        const castData = {
            ageru: {
                role: "🏥 院長", name: "モルフォ", image: "images/cast_ageru.jpg",
                comment: "「みんなのしあわせのおてつだいができたらいいなあ」",
                description: "おままごと好きが高じて、みんなを癒すお医者さんごっこができるクリニックを開院した院長先生。<br>いつもねむたげ（でも、特にねむいわけではない）で、ふわふわした雰囲気と間延びした口調が特徴。<br>丁寧なヒアリングと温かく優しい治療で、院内をいつでも穏やかな空気で包み込んでくれます。"
            },
            uron: {
                role: "📋 副院長・受付", name: "テル", image: "images/cast_uron.jpg",
                comment: "「疲れてはいませんか？いつでも待ってますよ」",
                description: "モルフォ院長の幼馴染で、クリニックの受付と運営を支える冷静な副院長。<br>お医者さんごっこに付き合っていたらいつの間にかこのポジションに収まっており、メンバーの中で一番年上のため、個性豊かな先生たちをまとめる苦労人。<br>少し気怠げな雰囲気もありますが、患者様へのご案内や備品整理などの仕事は完璧。心に寄り添う一言で、訪れる人々を静かに温かく迎えてくれます。"
            },
            asuyui: {
                role: "🩺 医者", name: "アル", image: "images/cast_asuyui.jpg",
                comment: "「僕がしっかりしないと…！」",
                description: "お友達のモルフォ院長とおむれちゅ！先生に突然連れてこられちゃった、ちょっぴり不憫なお医者さん。<br>優しく落ち着いた「基本に忠実……？」な診察を心がけており、「周りの先生が自由すぎるから、僕がちゃんと診察しなきゃ！」と意気込んでいます。<br>……が、実はそもそも医者の基本を知らないため、なんとなくそれっぽく診察しているだけなのは患者様と院長だけの秘密です。<br>診察の仕方がわからなくても、あなたを元気にしたい気持ちは本物！パタパタと健気に世話を焼いてくれるしっかり者（？）な姿に、癒やされる患者様も多いみたいです🐾"
            },
            omuraichu: {
                role: "🩺 医者", name: "おむれちゅ！", image: "images/cast_omuraichu.jpg",
                comment: "「一緒に沢山笑顔になっちゃおー！！！あなたの為に！！！おむ先生たぁああくさん頑張るよー！！！🔥🔥」",
                description: "モルフォ院長にお医者さんごっこに誘われ、超絶ノリノリで参戦した活発なお医者さん！<br>動きが止まることがほぼないほどの超絶元気なムードメーカーで、楽しく笑顔で元気いっぱいの診察をお届けします。<br>普段はとても賑やかですが、患者様の体調や心に寄り添う気持ちは人一倍熱く、本当に元気がない時には優しく本気で寄り添ってくれる温かい心の持ち主です。そのギャップに救われる患者様が後を絶ちません。<br>（※許してくれそうな患者様にはたまにちょっかいをかけに行くお茶目な一面も。もしも一人で暴れてしまっている時は、優しく見守るか檻に入れてあげてください👮🏻🚓💨）"
            },
            nakaron: {
                role: "🩺 医者", name: "ましゅ", image: "images/cast_nakaron.jpg",
                comment: "「僕の肉球でストレスや疲れを忘れちゃうくらいゆ〜ったりリラックスしてね？」",
                description: "口元にくわえた双葉（🌱）がトレードマークの、おっとりした僕っ子お医者さん。<br>「モルフォ院長のお手伝いができれば」とクリニックにやってきた。<br>患者様に寄り添い、ゆったりリラックスしてもらうことをモットーにしており、自慢の肉球でもちもちふわふわに癒されていく人を見るのが何よりも大好き。<br>日々のストレスや疲れを優しく解きほぐす、極上の癒やしタイムを届けてくれます。"
            },
            akino: {
                role: "🩺 医者", name: "アキ", image: "images/cast_akino.jpg",
                comment: "「肩の力をぬいてね　ジブンと一緒に深呼吸しましょ」",
                description: "クリニックが開院すると聞いてやってきた、気さくで誠実なお医者さん。<br>親しみやすさと話しやすい雰囲気で患者様を優しく受け止め、みんなが毎日元気に過ごせるように、心と体の健康を願いながら日々診察を行っています。<br>とても真面目で面倒見が良いが、実は少し抜けた一面も。このクリニックが「ごっこ遊び」だということに、本人はまだ気づいていない……かもしれません。"
            },
            remix: {
                role: "🩺 医者", name: "リミ", image: "images/cast_remix.jpg",
                comment: "「触れるのはまだ慣れないけど、患者の背中を押すのは結構好きなんだ〜」",
                description: "クリニックが開院すると聞いて、リルレオにひょっこり取り憑いちゃったポジティブで直感的な幽霊のお医者さん。👻<br>ここでの毎日が楽しすぎて、ただいま絶賛成仏を延期中！<br>幽霊だった頃は誰かに触れることも触れられることもできなかったため、実は「撫でるのも撫でられるのも」まだまだ一生懸命練習中。少しぎこちない手つきになってしまうこともありますが、その分ひとつひとつの触れ合いを誰よりも大切にしています。<br>フレンドリーに寄り添いながら、あなたの心が前を向けるように優しく背中を押してくれる先生です。"
            }
        };

        const id = new URLSearchParams(location.search).get('id');
        if (id && castData[id]) {
            const d = castData[id];
            const set = (elId, prop, val) => { const el = document.getElementById(elId); if (el) el[prop] = val; };
            set('js-role', 'textContent', d.role);
            set('js-name', 'textContent', d.name);
            const photo = document.getElementById('js-photo');
            if (photo) { photo.src = d.image; photo.alt = d.name + '先生の写真'; }
            set('js-comment', 'textContent', d.comment);
            set('js-description', 'innerHTML', d.description);
            document.title = `${d.name} | キャスト紹介 | リルレオクリニック`;
        } else {
            container.innerHTML = `
                <div style="text-align:center; width:100%; padding:100px 0;">
                    <p style="margin-bottom:20px;">🐾 キャスト情報が見つかりませんでした。</p>
                    <a href="cast.html" class="btn-back">キャスト一覧に戻る</a>
                </div>`;
        }
    }

    /* --- ポスター拡大表示（notice.html） --- */
    function initZoomable() {
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
        }
    }

    /* --- スクロール連動：ぽよんと出現 --- */
    let fadeObserver = null;
    function initFade() {
        if (fadeObserver) { fadeObserver.disconnect(); fadeObserver = null; }
        const fadeElements = document.querySelectorAll('.fade-in-up');
        if (!fadeElements.length) return;
        fadeObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });
        fadeElements.forEach(el => fadeObserver.observe(el));
    }

    /* --- なでなでホバー：ハート・音符が飛び出す（キャスト写真） --- */
    function initCastHover() {
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
    }

    /* --- 問診票 → 処方箋ギミック（index.html） --- */
    function initMonshin() {
        const monshinOverlay = document.getElementById('monshin-overlay');
        if (!monshinOverlay) return;

        const card = monshinOverlay.querySelector('.monshin-card');
        const openBtns = document.querySelectorAll('.js-open-monshin');
        const closeBtn = monshinOverlay.querySelector('.monshin-close');
        const skipBtn = monshinOverlay.querySelector('.monshin-skip');
        const form = document.getElementById('monshin-form');
        const karteCloseBtn = monshinOverlay.querySelector('.shohousen-close-btn');

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

        // 自動表示は「サイトに初めて入った一度きり」。
        // 受診・見学・✕のどれかで閉じた時点で記憶され、それ以降は自動では出ない。
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

    /* --- ボタンクリック時のログ（既存機能を維持） --- */
    function initButtonLog() {
        document.querySelectorAll('.buttons .btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const buttonText = event.currentTarget.textContent.trim();
                console.log(`ボタンがクリックされました: ${buttonText}`);
            });
        });
    }

    // ページ毎の初期化をまとめて実行
    function initPage() {
        renderProfile();
        initZoomable();
        initFade();
        initCastHover();
        initMonshin();
        initButtonLog();
    }

    /* ==========================================================
       擬似SPA遷移：内部リンクをリロードせず中身だけ差し替える。
       これによりAudioContextが破棄されず、BGMが鳴り続ける。
       fetch不可な環境（file://等）では通常遷移にフォールバック。
       ========================================================== */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    // 常設ノードは残し、それ以外（=各ページの中身）を入れ替える
    function swapBody(doc) {
        Array.from(document.body.children).forEach(ch => {
            if (persistent.indexOf(ch) === -1) ch.remove();
        });
        const frag = document.createDocumentFragment();
        Array.from(doc.body.children).forEach(ch => {
            if (ch.tagName === 'SCRIPT') return;   // スクリプトは取り込まない（script.jsは継続中）
            frag.appendChild(document.importNode(ch, true));
        });
        document.body.insertBefore(frag, document.body.firstChild);
    }

    let spaBusy = false;
    async function spaNavigate(href, push) {
        if (spaBusy) return;
        spaBusy = true;
        let html;
        try {
            const res = await fetch(href, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            html = await res.text();
        } catch (err) {
            location.href = href;   // フォールバック：通常遷移
            return;
        }
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            swapBody(doc);
            document.title = doc.title || document.title;
            if (push) history.pushState({ spa: true }, '', href);
            window.scrollTo(0, 0);
            initPage();
        } finally {
            spaBusy = false;
        }
    }

    // 内部の .html リンクのクリックを横取り
    document.addEventListener('click', (e) => {
        if (e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 別タブ等は通常動作
        const a = e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
        if (a.target && a.target !== '_self') return;            // _blank等は通常動作
        const raw = a.getAttribute('href') || '';
        if (!raw || raw.startsWith('#') || raw.toLowerCase().startsWith('javascript:')) return;
        let url;
        try { url = new URL(raw, location.href); } catch (_) { return; }
        if (url.origin !== location.origin) return;             // 外部リンクは通常動作
        if (!/\.html$/i.test(url.pathname)) return;             // サイト内HTMLのみ対象
        if (url.href === location.href) { e.preventDefault(); window.scrollTo(0, 0); return; }
        e.preventDefault();
        spaNavigate(url.href, true);
    });

    window.addEventListener('popstate', () => spaNavigate(location.href, false));

    // 初回ページの初期化
    initPage();

});
