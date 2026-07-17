async function applyLocale() {
    const t = await window.electronAPI.i18n.get();
    window._t = t;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key]) el.textContent = t[key];
    });
    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        const key = el.dataset.i18nTooltip;
        if (t[key]) el.dataset.tooltip = t[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (t[key]) el.placeholder = t[key];
    });
    const titleKey = document.documentElement.dataset.i18nTitle;
    const menuTitle = document.getElementById('menuTitle');
    if (titleKey && t[titleKey]) document.title = t[titleKey];
    if (titleKey && t[titleKey]) menuTitle.textContent = t[titleKey];
    const gamePopupReleaseDate = document.querySelector('.game-releaseDate-title');
    if (gamePopupReleaseDate) {
        gamePopupReleaseDate.textContent.replace(/:$/, '');
    }
}

applyLocale();