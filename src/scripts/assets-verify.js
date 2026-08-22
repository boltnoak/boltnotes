window.addEventListener('load', async () => {
    const loadingDetails = document.getElementById('loading-details');
    const loadingProgress = document.getElementById('loading-progress');
    const progressBarFill = document.getElementById('progress-bar-fill');

    window.electronAPI.onAssetsProgress((() => {
        let lastUpdate = 0;
        return (data) => {
            if (!loadingDetails || !progressBarFill) return;

            const now = Date.now();
            if (data.percent !== 100 && (now - lastUpdate < 200)) return;
            lastUpdate = now;

            const mb = (data.downloaded / 1024 / 1024).toFixed(1);
            const totalMb = data.total ? (data.total / 1024 / 1024).toFixed(1) : '?';

            loadingDetails.textContent = `${window._t['downloading']} ${data.package} (${data.percent ?? '...'}%)`;
            loadingProgress.textContent = `${mb} MB / ${totalMb} MB`;

            if (data.percent !== null) {
                progressBarFill.style.width = `${data.percent}%`;
            }
        };
    })());

    window.electronAPI.onAssetsReady(() => {
        const loadingTitle = document.getElementById('loading-title');
        const shineEffect = document.querySelector('.shine-effect');
        if (loadingTitle) {
            loadingTitle.setAttribute('data-i18n', 'sync-assets-finished');
            loadingDetails.style.display = 'none';
            applyLocale();
        }
        if (loadingDetails) loadingDetails.textContent = "";
        if (loadingProgress) loadingProgress.textContent = "";
        if (progressBarFill) progressBarFill.style.width = "100%";
        if (shineEffect) shineEffect.style.display = 'none';
    });

    window.electronAPI.onAssetsError((errorMsg) => {
        if (loadingDetails) {
            loadingDetails.textContent = `${errorMsg}`;
            loadingDetails.style.color = "var(--red)";
        }

        const shineEffect = document.querySelector('.shine-effect');
        if (shineEffect) shineEffect.style.display = 'none';

        if (progressBarFill) {
            progressBarFill.style.width = '100%';
            progressBarFill.style.backgroundColor = "var(--red)";
        }
    });
});