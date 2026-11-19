async function applyLocale() {
    const t = await window.electronAPI.get_i18n();
    window._t = t;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key]) el.textContent = t[key];
    })
    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        const key = el.dataset.i18nTooltip;
        if (t[key]) el.dataset.tooltip = t[key];
    })
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (t[key]) el.setAttribute('placeholder', t[key]);
    })
}
applyLocale();