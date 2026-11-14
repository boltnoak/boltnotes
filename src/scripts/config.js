function toggleConfig(el) {
    const option = el.dataset.code;

    el.classList.toggle('active');
    
    const isActive = el.classList.contains('active');

    updateConfig(option, isActive);
}

document.addEventListener('DOMContentLoaded', async () => {
    const config = await getConfig();
    const currentFeatured = config.featured;
    const currentLang = config.language || 'en';

    const langOptions = document.querySelectorAll('.lang-option');
    langOptions.forEach(e => {
        const value = e.dataset.value;
        const isActive = value === currentLang;

        e.classList.toggle('active', isActive);
        e.addEventListener('click', async () => {
            langOptions.forEach(e => e.classList.remove('active'));
            document.querySelector(`.lang-option[data-value="${value}"]`).classList.add('active')
            await updateConfig('language', value);

            if (typeof applyLocale === 'function') applyLocale();
            if (window.parent && typeof window.parent.applyLocale === 'function') {
                if (typeof window.parent.loadLanguage === 'function') await window.parent.loadLanguage(lang);
                window.parent.applyLocale();
            }
        });
    });
    
    const themeContainers = document.querySelectorAll('.theme-selector-div');
    if (themeContainers.length > 0) {
        const config = await getConfig();
        const themesList = await listThemes();
        const currentTheme = config.theme;

        themeContainers.forEach(container => {
            const formattedCurrentName = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);

            themesList.forEach(themeObj => {
                const themeName = themeObj.name;
                const themeBg = themeObj.bg; 
                const formattedName = themeName.charAt(0).toUpperCase() + themeName.slice(1);

                const option = document.createElement('a');
                option.dataset.value = themeName;
                option.classList.toggle('active', themeName === currentTheme);
                    
                const colorCircle = document.createElement('span');
                colorCircle.className = 'theme-color-preview';
                colorCircle.style.backgroundColor = themeBg;

                const textSpan = document.createElement('span');
                textSpan.textContent = formattedName;
                    
                if (themeName == 'dark') textSpan.setAttribute('data-i18n', 'theme-dark');
                if (themeName == 'light') textSpan.setAttribute('data-i18n', 'theme-light');
                if (themeName == 'example') textSpan.setAttribute('data-i18n', 'theme-example');
                applyLocale();

                option.appendChild(colorCircle);
                option.appendChild(textSpan);
                option.classList.add('button');
                textSpan.classList.add('theme-name');
                option.classList.add('theme-option');
                container.appendChild(option);
                    
                option.addEventListener('click', async () => {
                    const options = document.querySelectorAll('.theme-option');
                    const optionActive = document.querySelector(`.theme-option[data-value="${themeName}"]`);

                    options.forEach(el => el.classList.toggle('active', el.dataset.value === optionActive.dataset.value));
                    await changeTheme(optionActive); 
                });
            });
        });
    }

    const selectorsContainers = document.querySelectorAll('.featured-selector-div a');
    const buttonsConfig = document.querySelectorAll('a[data-code]');
    selectorsContainers.forEach(async (e) => {
        const isActive = currentFeatured === e.dataset.value;

        e.classList.toggle('button-color', isActive);

        e.addEventListener('click', async () => {
            await changeFeatured(e.dataset.value);
        })
    });
    buttonsConfig.forEach(button => {
        const code = button.dataset.code;
        const isActive = config[code] === true;

        button.classList.toggle('active', isActive);
    });
});

function tabSwitch(el) {
    const code = el.dataset.code;
    const mainTitle = document.querySelector('.tab-configs-title');
    mainTitle.setAttribute('data-i18n', code);
    applyLocale();

    const tabs = document.querySelectorAll('.tab');
    const configs = document.querySelectorAll('.tab-configs');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    el.classList.add('active');

    configs.forEach(config => config.classList.remove('active'));

    const targetConfig = document.getElementById(code);
    if (targetConfig) {
        targetConfig.classList.add('active');
    }
}

async function applySelectedTheme() {
    localStorage.removeItem('cached-theme-css');
    localStorage.removeItem('cached-theme-name');
    await applyTheme();

    if (window.parent && typeof window.parent.applyTheme === 'function') {
        window.parent.localStorage.removeItem('cached-theme-css');
        window.parent.localStorage.removeItem('cached-theme-name');
        await window.parent.applyTheme();
    }
}

async function changeTheme(selectEl) {
    const selectedTheme = selectEl.dataset.value;

    updateConfig('theme', selectedTheme);

    await applySelectedTheme();
}
async function changeFeatured(el) {
    const selectedFeatured = el;
    updateConfig('featured', selectedFeatured);

    const selectorsContainers = document.querySelectorAll('.featured-selector-div a');
    selectorsContainers.forEach(e => {
        const isActive = el === e.dataset.value;
        e.classList.toggle('button-color', isActive);
    });
}

async function checkUpdates() {
    const text = document.querySelectorAll('#checkUpdates-text');
    const btn = window.parent ? window.parent.document.getElementById('update-btn') : null;
    if (!text || text.length === 0) return;

    let downloadIniciado = false;

    showMessage(text, `${window._t['check-updates-verify']}`, 'var(--text-light-gray)');

    window.electronAPI.updates.onUpdateProgress((percent) => {
        downloadIniciado = true;
        showMessage(text, `${window._t['downloading']}... ${Math.round(percent)}%`, 'var(--text)');
    });

    window.electronAPI.updates.onUpdateReady(() => {
        showMessage(text, `${window._t['check-updates-done']}`, 'var(--blue)');
        if (btn) btn.style.display = 'flex';
    });

    try {
        const result = await window.electronAPI.updates.checkUpdates();

        if (result.status === 'available') {
            if (!downloadIniciado) {
                showMessage(text, `${window._t['new-version']} v${result.version}! ${window._t['downloading']}...`, 'var(--text)');
            }
        } else {
            showMessage(text, `${window._t['check-updates-finished']}`, 'var(--blue)');
        }
    } catch (err) {
        console.error('Erro ao buscar atualizações:', err);
        showMessage(text, 'Erro ao buscar atualizações.', 'var(--red)');
    }
}
let listenersRegistrados = false;

function showMessage(element, msg, color) {
    const elementList = element instanceof NodeList || Array.isArray(element) 
        ? element 
        : [element];

    elementList.forEach(element => {
        if (!element) return;

        element.textContent = `${msg}`;
        applyLocale();
        element.style.color = color;
        element.style.opacity = 1;
        
        if (element.timeoutId) clearTimeout(element.timeoutId);
        
        element.timeoutId = setTimeout(() => {
            element.style.opacity = 0;
        }, 3500);
    });
}

async function createBackup() {
    const buttons = document.querySelectorAll('.backup-btn');
    buttons.forEach(b => b.disabled = true);

    try {
        const res = await window.electronAPI.backup.create();

        if (res.status === 'ok') {
            showToast(`Backup saved ${res.path}`);
        } else if (res.status === 'error') {
            console.error(res.message);
            showToast(`Failed to create backup: ${res.message}`);
        }
    } finally {
        buttons.forEach(b => b.disabled = false);
    }
}

async function restoreBackup() {
    const buttons = document.querySelectorAll('.backup-btn');
    buttons.forEach(b => b.disabled = true);

    try {
        const res = await window.electronAPI.backup.restore();

        if (res.status === 'invalid') {
            showToast('Invalid file.');
        } else if (res.status === 'error') {
            console.error(res.message);
            showToast(`Failed to restore backup: ${res.message}`);
        }
    } finally {
        buttons.forEach(b => b.disabled = false);
    }
}