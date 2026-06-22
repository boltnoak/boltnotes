window.electronAPI.themes.list();

async function applyTheme() {
    let styleTag = document.getElementById('theme-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'theme-style';
        document.head.appendChild(styleTag);
    }

    const cachedCss = localStorage.getItem('cached-theme-css');
    if (cachedCss) {
        styleTag.textContent = cachedCss;
    }

    try {
        const currentTheme = await window.electronAPI.themes.getCurrent();
        const cachedThemeName = localStorage.getItem('cached-theme-name');

        if (currentTheme !== cachedThemeName || !cachedCss) {
            const css = await window.electronAPI.themes.get(currentTheme);
            if (css) {
                styleTag.textContent = css;
                localStorage.setItem('cached-theme-css', css);
                localStorage.setItem('cached-theme-name', currentTheme);
            }
        }
    } catch (error) {
        console.error("Erro ao carregar o tema:", error);
    }
}

applyTheme();