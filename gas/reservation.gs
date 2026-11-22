/**
 * リルレオクリニック 予約（応募）受付  Google Apps Script
 * ============================================================
 * このファイルの中身を、Googleスプレッドシートの
 *   拡張機能 → Apps Script
 * に貼り付けて使います。手順は SETUP_RESERVATION.md を参照してください。
 *
 * 役割
 *   1. サイトの予約フォームから送られた内容を受け取る
 *   2. スプレッドシートに1行追記する
 *   3. Discord に通知を送る（任意）
 *
 * 個人情報について
 *   ・応募内容は「あなたのスプレッドシート」にだけ保存されます
 *   ・Discord の Webhook URL はこのスクリプトのプロパティに保存し、
 *     サイト側のコードには一切書きません（外部に漏れません）
 *   ・このスクリプトは書き込み専用です。保存済みの応募内容を
 *     外部から読み出す口（doGet での一覧表示など）は用意していません
 */

/* ============================================================
   設定：スクリプトプロパティ（プロジェクトの設定 → スクリプト プロパティ）
   ------------------------------------------------------------
   DISCORD_WEBHOOK_URL : Discord の Webhook URL（任意・未設定なら通知しない）

   受付日時と保存先シートは、公開中の reservation-config.js から読みます。
   （OPEN_AT / CLOSE_AT / SHEET_NAME のプロパティは使いません）
   ============================================================ */

// デプロイされている版の確認用（ウェブアプリURLを開くと表示されます）
const VERSION = '2026-11-22';

// 受付日時・開催日時の読み取り元。送信者の申告は使わないので、
// 期間外の送信や、勝手な名前のシート作成はできません。
const SITE_CONFIG_URL = 'https://lilleo-clinic.com/reservation-config.js';
const CONFIG_CACHE_SECONDS = 60;

// 受け取る項目（この並び順のまま、A列＝日時 の右（B列〜）へ追記されます）
// label は「シートが空だったときに自動で作る見出し」に使う文字です。
// すでに見出し行があるシートでは、見出しは書き換えず、並び順どおりに値だけ追記します。
const FIELDS = [
    { key: 'name', label: 'お名前（VRC表示名）を教えてください', required: true, max: 60 },
    { key: 'style', label: '撫でる、撫でられるどちらをご希望ですか？', required: true, max: 40 },
    { key: 'dislike', label: '苦手はありますか？（ご希望に応じて配慮いたします）', required: false, max: 300 },
    { key: 'method', label: 'ご希望の主な診察方法があれば教えてください', required: false, max: 300 },
    { key: 'device', label: 'プレイ環境はどれですか?（ios、単機不可）', required: true, max: 40 },
    { key: 'x_url', label: 'ご当選の場合メッセージをお送りしますので、XのアカウントプロフィールURLを貼ってください。（鍵、捨て垢不可）', required: true, max: 200 },
    { key: 'vc', label: 'VCでの会話は可能ですか？', required: true, max: 10, choices: ['可能', '不可'] }
];

/**
 * サイトのフォームから POST されたときに実行される
 */
function doPost(e) {
    try {
        // ---- 受信データを読む ----
        let data = {};
        if (e && e.postData && e.postData.contents) {
            data = JSON.parse(e.postData.contents);
        }

        // ---- 受付期間のチェック（サーバー側でも必ず確認する）----
        const site = readSiteConfig_();
        const windowCheck = checkWindow_(site, new Date());
        if (!windowCheck.open) {
            return jsonOut_({ ok: false, error: windowCheck.reason });
        }

        // ---- 入力チェック ----
        const clean = {};
        for (const f of FIELDS) {
            let v = data[f.key];
            v = (v === undefined || v === null) ? '' : String(v).trim();
            if (v.length > f.max) v = v.slice(0, f.max);
            if (f.required && !v) {
                return jsonOut_({ ok: false, error: f.label + 'が未入力です。' });
            }
            if (f.choices && v && f.choices.indexOf(v) === -1) {
                return jsonOut_({ ok: false, error: f.label + 'の選択内容をご確認ください。' });
            }
            clean[f.key] = v;
        }

        // X のプロフィール URL の形をざっくり確認
        if (!/^https?:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}\/?$/.test(clean.x_url)) {
            return jsonOut_({ ok: false, error: 'XプロフィールURLの形式をご確認ください（例：https://x.com/あなたのID）' });
        }

        // ---- 開催日時ごとのシートに保存 ----
        const now = new Date();
        const target = sheetNames_(site);
        if (!saveApplication_(clean, now, target.name, target.provisional)) {
            return jsonOut_({ ok: false, error: 'すでに受付が完了しています。重複のご応募はご遠慮ください。' });
        }

        // ---- Discord へ通知（設定されているときだけ）----
        notifyDiscord_(clean, now);

        return jsonOut_({ ok: true, message: '受付が完了しました。' });

    } catch (err) {
        // 失敗の詳細は応募者には返さない（内部情報を出さないため）
        console.error(err);
        return jsonOut_({ ok: false, error: '送信に失敗しました。時間をおいてお試しください。' });
    }
}

/**
 * 受付状況の問い合わせ（サイトが「今は受付中か」を確認するために使う）
 * ※ 応募内容は一切返しません
 */
function doGet() {
    try {
        const site = readSiteConfig_();
        const w = checkWindow_(site, new Date());
        return jsonOut_({
            ok: true, version: VERSION, open: w.open, reason: w.reason || '',
            openAt: site.openAt, closeAt: site.closeAt, sheet: sheetNames_(site).name
        });
    } catch (err) {
        console.error(err);
        return jsonOut_({ ok: false, version: VERSION, error: '設定を読み込めませんでした。' });
    }
}

/**
 * 動作確認：Apps Script の画面で testWrite を選んで「実行」すると、
 * 受付期間に関係なくシート「動作テスト」に1行書き込みます。（確認後はシートごと削除してOK）
 */
function testWrite() {
    console.log(JSON.stringify(readSiteConfig_()));
    const sample = {
        name: '動作テスト', style: '撫でる', dislike: '特になし', method: '先生にお任せ',
        device: 'PCVR', x_url: 'https://x.com/test_' + (Date.now() % 100000), vc: '可能'
    };
    saveApplication_(sample, new Date(), '動作テスト', '動作テスト');
    console.log('シート「動作テスト」に書き込みました');
}

/* ---------------- 内部で使う関数 ---------------- */

// 公開中のサイト設定を読む。読めないときは受け付けずにエラーにする。
function readSiteConfig_() {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('site');
    if (cached) return JSON.parse(cached);

    const text = UrlFetchApp.fetch(SITE_CONFIG_URL + '?t=' + Date.now()).getContentText('UTF-8');
    const pick = key => {
        const m = text.match(new RegExp('^[ \\t]*' + key + ":\\s*'([^']*)'", 'm'));
        return m ? m[1] : null;
    };
    const site = {
        closed: /^[ \t]*closed:\s*true\b/m.test(text),
        openAt: pick('openAt'),
        closeAt: pick('closeAt'),
        eventAt: pick('eventAt') || ''
    };
    if (site.openAt === null || site.closeAt === null) throw new Error('受付日時を読み取れません');

    cache.put('site', JSON.stringify(site), CONFIG_CACHE_SECONDS);
    return site;
}

function checkWindow_(site, now) {
    const openAt = parseDate_(site.openAt);
    const closeAt = parseDate_(site.closeAt);

    if (site.closed || (openAt && now < openAt)) {
        return { open: false, reason: 'ただいま受付時間外です。受付開始までお待ちください。' };
    }
    if (closeAt && now > closeAt) {
        return { open: false, reason: '今回の受付は終了しました。次回の開催をお待ちください。' };
    }
    return { open: true };
}

// '2026-08-05 21:00' のような文字列を日本時間として日付に変換（空なら null＝制限なし）
// プロジェクトのタイムゾーン設定に左右されないよう +09:00 を明示する
function parseDate_(s) {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
    if (!m) return null;
    const p = v => ('0' + (v || 0)).slice(-2);
    return new Date(m[1] + '-' + p(m[2]) + '-' + p(m[3]) + 'T' + p(m[4]) + ':' + p(m[5]) + ':00+09:00');
}

// 保存先：開催日時が決まっていれば「2026-12-05_2130」、未定なら「受付_2026-11-23_1700」
function sheetNames_(site) {
    const stamp = s => {
        const d = parseDate_(s);
        return d ? Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd_HHmm') : '';
    };
    const provisional = '受付_' + (stamp(site.openAt) || '日程未定');
    return { name: stamp(site.eventAt) || provisional, provisional: provisional };
}

// 1件保存する。重複なら false。
// 受付開始直後に同時に届いても、シートの二重作成や行のずれが起きないよう順番に処理する。
function saveApplication_(clean, now, name, provisional) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        const sheet = getSheet_(name, provisional);

        // ---- 簡易的な連投防止（同じ内容が直前に入っていたら弾く）----
        const last = sheet.getLastRow();
        if (last >= 2) {
            const prev = sheet.getRange(last, 1, 1, FIELDS.length + 1).getValues()[0];
            const col = key => FIELDS.findIndex(f => f.key === key) + 1;
            const prevKey = String(prev[col('name')]) + '|' + String(prev[col('x_url')]);
            if (prevKey === clean.name + '|' + clean.x_url) return false;
        }

        sheet.appendRow([now].concat(FIELDS.map(f => asText_(clean[f.key]))));
        // 日時の表示を、既存の回答と同じ「2026/07/10 18:06:00」の形にそろえる
        sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('yyyy/MM/dd HH:mm:ss');
        SpreadsheetApp.flush();
        return true;
    } finally {
        lock.releaseLock();
    }
}

// = などで始まる入力が数式として動くと、シート内の個人情報を外部へ送られ得るため文字として保存する
function asText_(v) {
    return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function getSheet_(name, provisional) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
        // 開催日時が後から決まったら、仮名のシートをそのまま改名して引き継ぐ
        sheet = ss.getSheetByName(provisional);
        if (sheet) sheet.setName(name);
        else sheet = ss.insertSheet(name);
    }
    // 見出し行が無いときだけ、自動で作る。
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(['タイムスタンプ'].concat(FIELDS.map(f => f.label)));
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, FIELDS.length + 1).setFontWeight('bold');
    }
    return sheet;
}

function notifyDiscord_(clean, when) {
    const url = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK_URL');
    if (!url) return;   // 未設定なら何もしない

    const fields = FIELDS
        .filter(f => clean[f.key])
        .map(f => ({ name: f.label, value: String(clean[f.key]).slice(0, 1000), inline: false }));

    const payload = {
        username: 'リルレオクリニック 受付',
        embeds: [{
            title: '🐾 新しいご予約が届きました',
            color: 0xf2a0ae,
            fields: fields,
            footer: { text: Utilities.formatDate(when, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm') + ' 受付' }
        }]
    };

    try {
        UrlFetchApp.fetch(url, {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
    } catch (err) {
        // 通知に失敗しても、応募自体は成立させる（シートには保存済み）
        console.error('Discord通知に失敗: ' + err);
    }
}

function jsonOut_(obj) {
    return ContentService
        .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}
