document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. ポスター拡大表示（モーダル）機能
    // ==========================================
    const overlay = document.getElementById('image-overlay');
    const expandedImg = document.getElementById('expanded-image');
    const zoomableImages = document.querySelectorAll('.zoomable-img');

    // 画像が存在する場合のみ、クリックイベントを設定
    if (overlay && expandedImg && zoomableImages.length > 0) {
        zoomableImages.forEach(img => {
            img.addEventListener('click', () => {
                overlay.style.display = 'flex';
                expandedImg.src = img.src;
                expandedImg.alt = img.alt;
            });
        });

        // 拡大画面の背景をクリックしたら閉じる
        overlay.addEventListener('click', () => {
            overlay.style.display = 'none';
        });
    }

    // ==========================================
    // 2. スクロール連動ふわっと浮き出る機能
    // ==========================================
    const fadeElements = document.querySelectorAll('.fade-in-up');

    // 画面のどこまで来たら表示させるかの設定（画面下部から10%の位置に入ったら起動）
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -10% 0px',
        threshold: 0
    };

    if (fadeElements.length > 0) {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                // 要素が画面内に入ったら
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target); // 一度表示されたら負荷軽減のため監視を終了
                }
            });
        }, observerOptions);

        // すべての対象要素を監視開始
        fadeElements.forEach(el => observer.observe(el));
    }
});
