(async () => {
    let windowState = sessionStorage.getItem('windowState');

    if (!windowState) {
        const verificarAPI = () => {
            return new Promise((resolve) => {
                if (window.electronAPI && window.electronAPI.config) {
                    resolve(window.electronAPI);
                } else {
                    const interval = setInterval(() => {
                        if (window.electronAPI && window.electronAPI.config) {
                            clearInterval(interval);
                            resolve(window.electronAPI);
                        }
                    }, .5);
                }
            });
        };

        try {
            const api = await verificarAPI();
            const config = await api.config.getConfig();
            windowState = (config && config.maximize_on_start) ? 'maximized' : 'normal';
            sessionStorage.setItem('windowState', windowState);
        } catch (err) {
            windowState = 'normal';
        }
    }

    if (windowState === 'normal') {
        document.documentElement.classList.add('window-normal');
    }
})();