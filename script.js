document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. ポスター拡大表示（モーダル）機能
    // ==========================================
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

        overlay.addEventListener('click', () => {
            overlay.style.display = 'none';
        });
    }

    // ==========================================
    // 2. スクロール連動じわっとふわっと浮き出る機能
    // ==========================================
    const fadeElements = document.querySelectorAll('.fade-in-up');

    const observerOptions = {
        root: null,
        /* rootMarginのマイナスを「0px」にすることで、
           セクションが画面の下端を1ピクセルでもまたいだ瞬間に、即座にアニメーションを開始させます */
        rootMargin: '0px 0px 0px 0px',
        threshold: 0
    };

    if (fadeElements.length > 0) {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // 画面に入った瞬間にクラスを付与し、CSS側の1.2秒かけた「ふわっと動く演出」をスタートさせます
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        fadeElements.forEach(el => observer.observe(el));
    }
});
