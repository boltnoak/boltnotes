async function applyTheme() {
    let styleTag = document.getElementById('theme-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'theme-style';
        document.head.appendChild(styleTag);
    }

    try {
        const config = await getConfig();
        const currentTheme = config.theme;
        const frame = document.querySelector('#content html head');

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = `themes/${currentTheme}.css`;
        document.head.appendChild(link);
        if (frame) frame.appendChild(link);
    } catch (error) {
        console.error("Failed to load theme: ", error);
    }
}
applyTheme();