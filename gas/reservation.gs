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
   OPEN_AT             : 受付開始日時（任意・例 2026-08-05 21:00）
   CLOSE_AT            : 受付終了日時（任意・例 2026-08-10 23:59）
   ALLOW_ORIGIN        : 許可するサイト（任意・既定 https://lilleo-clinic.com）
   ============================================================ */

// 書き込み先のシート（タブ）名。
// 開催回ごとにシートを分けます。どの回に書くかはサイトから送られてくる名前で決まり、
// 設定は reservation-config.js の sheetName です（例：第2回）。
// 名前が送られてこない／形式が違うときは、スクリプトプロパティ SHEET_NAME、
// それも無ければ下の既定シートに書き込みます。
const DEFAULT_SHEET_NAME = 'Form_Responses';

// サイトから受け取るシート名は「第◯回」の形だけを許可します。
// これで、外部から勝手な名前のシートを作られるのを防ぎます。
const SHEET_NAME_PATTERN = /^第[0-9]{1,3}回$/;

// 受け取る項目（この並び順のまま、A列＝日時 の右（B列〜）へ追記されます）
// label は「シートが空だったときに自動で作る見出し」に使う文字です。
// すでに見出し行があるシートでは、見出しは書き換えず、並び順どおりに値だけ追記します。
const FIELDS = [
    { key: 'name', label: 'お名前（VRC表示名）を教えてください', required: true, max: 60 },
    { key: 'style', label: '撫でる、撫でられるどちらをご希望ですか？', required: true, max: 40 },
    { key: 'dislike', label: '苦手はありますか？（ご希望に応じて配慮いたします）', required: false, max: 300 },
    { key: 'method', label: 'ご希望の主な診察方法があれば教えてください', required: false, max: 300 },
    { key: 'device', label: 'プレイ環境はどれですか?（ios、単機不可）', required: true, max: 40 },
    { key: 'x_url', label: 'ご当選の場合メッセージをお送りしますので、XのアカウントプロフィールURLを貼ってください。（鍵、捨て垢不可）', required: true, max: 200 }
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
        const windowCheck = checkWindow_();
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
            clean[f.key] = v;
        }

        // X のプロフィール URL の形をざっくり確認
        if (!/^https?:\/\/(x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}\/?$/.test(clean.x_url)) {
            return jsonOut_({ ok: false, error: 'XプロフィールURLの形式をご確認ください（例：https://x.com/あなたのID）' });
        }

        // ---- どのシート（開催回）に書くかを決める ----
        let sheetName = String(data.sheet || '').trim();
        if (!SHEET_NAME_PATTERN.test(sheetName)) {
            sheetName = PropertiesService.getScriptProperties().getProperty('SHEET_NAME') || DEFAULT_SHEET_NAME;
        }

        // ---- 簡易的な連投防止（同じ内容が直前に入っていたら弾く）----
        const sheet = getSheet_(sheetName);
        const last = sheet.getLastRow();
        if (last >= 2) {
            const prev = sheet.getRange(last, 1, 1, FIELDS.length + 1).getValues()[0];
            const prevKey = String(prev[1]) + '|' + String(prev[FIELDS.length]);
            if (prevKey === clean.name + '|' + clean.x_url) {
                return jsonOut_({ ok: false, error: 'すでに受付が完了しています。重複のご応募はご遠慮ください。' });
            }
        }

        // ---- スプレッドシートに追記 ----
        // 既存のフォーム回答と同じ並び（A列=日時／B列〜=各項目）で1行足します
        const now = new Date();
        const row = [now].concat(FIELDS.map(f => clean[f.key]));
        sheet.appendRow(row);
        // 日時の表示を、既存の回答と同じ「2026/07/10 18:06:00」の形にそろえる
        sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('yyyy/MM/dd HH:mm:ss');

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
    const w = checkWindow_();
    return jsonOut_({ ok: true, open: w.open, reason: w.reason || '' });
}

/* ---------------- 内部で使う関数 ---------------- */

function checkWindow_() {
    const props = PropertiesService.getScriptProperties();
    const now = new Date();
    const openAt = parseDate_(props.getProperty('OPEN_AT'));
    const closeAt = parseDate_(props.getProperty('CLOSE_AT'));

    if (openAt && now < openAt) {
        return { open: false, reason: 'ただいま受付時間外です。受付開始までお待ちください。' };
    }
    if (closeAt && now > closeAt) {
        return { open: false, reason: '今回の受付は終了しました。次回の開催をお待ちください。' };
    }
    return { open: true };
}

// '2026-08-05 21:00' のような文字列を日付に変換（空なら null＝制限なし）
function parseDate_(s) {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, 0);
}

function getSheet_(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = name || DEFAULT_SHEET_NAME;
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);   // その回のシートが無ければ新しく作る
    }
    // 見出し行が無いときだけ、自動で作る。
    // すでに見出しがあるシート（フォームの回答シートなど）は書き換えません。
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
