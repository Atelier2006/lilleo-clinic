/* ==========================================================
   リルレオクリニック  予約フォームの設定
   ==========================================================

   ★ 受付の開始・終了は、ここの openAt / closeAt を書き換えるだけです。

   ・openAt  … 受付開始日時。この時刻になるまでフォームは開きません
   ・closeAt … 受付終了日時。この時刻を過ぎるとフォームは閉じます
   ・どちらも '' （空）にすると、その制限なし
       例）openAt: '', closeAt: ''            → いつでも受付
       例）openAt: '2026-08-05 21:00'         → 8/5 21:00 から受付開始
       形式は 'YYYY-MM-DD HH:MM'（時刻は省略可）

   ※ 実際に受け付けるかどうかの最終判断は Google 側（GAS）でも行います。
     GAS の OPEN_AT / CLOSE_AT も合わせて設定しておくと確実です。
     （設定方法は gas/SETUP_RESERVATION.md）
   ========================================================== */

const LILLEO_RESERVATION = {

    // Google Apps Script のウェブアプリURL（gas/SETUP_RESERVATION.md の手順5で取得）
    endpoint: 'https://script.google.com/macros/s/AKfycbzBaETU7TNNjU1kV_otR9ZxSdhAdoqDEv_tKoW0eMBmKpbmbFTY4EkZjTSezslSY1EV/exec',

    // 受付を止めたいときは true にする（開始日が未定のときもこれ）
    //   true  … フォームを出さず、下の beforeMessage を表示
    //   false … openAt / closeAt の日時にしたがって受付
    closed: false,

    // 今回の開催名（フォームの見出しに出ます。空でもOK）
    eventName: '',

    // 受付開始日時（空なら制限なし）
    openAt: '2026-08-14 21:55',

    // 受付終了日時（空なら制限なし）
    closeAt: '2026-08-21 23:59',

    // 受付前・受付停止中に表示する案内文
    beforeMessage: 'ご予約の受付開始まで、今しばらくお待ちください。受付開始と同時に、こちらのページからお申し込みいただけます。',

    // 受付終了後に表示する案内文
    afterMessage: '今回の受付は終了しました。たくさんのご応募をありがとうございました。次回の開催をお楽しみに。ご当選された方には、Xアカウントへご連絡いたします。'

};
