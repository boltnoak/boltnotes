function toggleConfig(el) {
    const option = el.dataset.code;

    el.classList.toggle('active');
    
    const isActive = el.classList.contains('active');

    window.electronAPI.config.updateConfig(option, isActive);
}

function toggleAssetsConfig(el) {
    const mark = document.querySelector('.fortnite-mark');
    const option = mark.dataset.assetsCode;

    mark.classList.toggle('active');
    
    const isActive = mark.classList.contains('active');

    window.api.assetsConfig.update(option, isActive);
}

const changeLangBtn = document.querySelector('.change-lang-btn');
const changeLangSelect = document.querySelector('.change-lang-drop-select');
changeLangBtn.addEventListener('click', () => {
    if (changeLangSelect.style.display === 'none' || changeLangSelect.style.display === '') {
        changeLangSelect.style.display = 'flex';
    } else {
        changeLangSelect.style.display = 'none';
    }
})

document.addEventListener('DOMContentLoaded', async () => {
    const config = await window.electronAPI.config.getConfig();

    const langBtn = document.getElementById('lang-btn');
    const langSelect = document.getElementById('lang-select');
    const langSpan = langBtn.querySelector('span');

    const currentLang = config.language || 'pt-BR';
    const langNames = { 'pt-BR': 'Português Brasil', 'en': 'English' };
    langSpan.textContent = langNames[currentLang] || 'Português Brasil';

    langBtn.addEventListener('click', () => {
        langSelect.classList.toggle('active');
    });

    langSelect.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', async () => {
            const lang = li.dataset.value;
            langSpan.textContent = li.querySelector('span').textContent;
            langSelect.classList.remove('active');

            await window.electronAPI.config.updateConfig('language', lang);

            if (typeof applyLocale === 'function') applyLocale();

            if (window.parent && typeof window.parent.applyLocale === 'function') {
                if (typeof window.parent.loadLanguage === 'function') await window.parent.loadLanguage(lang);
                window.parent.applyLocale();
            }

            changeLangSelect.style.display = 'none';
        });
    });
    
    const themeContainers = document.querySelectorAll('.theme-selector-div');

    if (themeContainers.length > 0) {
        const config = await window.electronAPI.config.getConfig();
        const themesList = await listThemes();
        const currentTheme = config.theme;

        themeContainers.forEach(container => {
            const themeSelector = container.querySelector('select');
            const customBtn = container.querySelector('.themeSelector-btn');
            const customSpan = customBtn ? customBtn.querySelector('span') : null;
            const customUl = container.querySelector('.themeSelector-select');

            if (themeSelector && customUl && customSpan) {
                themeSelector.innerHTML = '';
                customUl.innerHTML = '';

                const formattedCurrentName = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);
                customSpan.textContent = formattedCurrentName;

                themesList.forEach(themeObj => {
                    const themeName = themeObj.name;
                    const themeBg = themeObj.bg; 
                    const formattedName = themeName.charAt(0).toUpperCase() + themeName.slice(1);

                    const option = document.createElement('option');
                    option.value = themeName;
                    option.textContent = formattedName;
                    if (themeName === currentTheme) option.selected = true;
                    themeSelector.appendChild(option);

                    const li = document.createElement('li');
                    
                    const colorCircle = document.createElement('span');
                    colorCircle.className = 'theme-color-preview';
                    colorCircle.style.backgroundColor = themeBg;

                    const textSpan = document.createElement('span');
                    textSpan.textContent = formattedName;
                    
                    if (themeName == 'dark') {
                        textSpan.setAttribute('data-i18n', 'theme-dark');
                        applyLocale();
                    }
                    if (themeName == 'light') {
                        textSpan.setAttribute('data-i18n', 'theme-light');
                        applyLocale();
                    }
                    if (themeName == 'example') {
                        textSpan.setAttribute('data-i18n', 'theme-example');
                        applyLocale();
                    }

                    li.appendChild(colorCircle);
                    li.appendChild(textSpan);
                    li.dataset.value = themeName;
                    
                    if (themeName === currentTheme) {
                        li.classList.add('active-config');
                    }
                    
                    li.addEventListener('click', async () => {
                        document.querySelectorAll('.theme-selector-div').forEach(syncContainer => {
                            const syncSelect = syncContainer.querySelector('select');
                            const syncSpan = syncContainer.querySelector('.themeSelector-btn span');
                            const syncUl = syncContainer.querySelector('.themeSelector-select');

                            if (syncSelect) syncSelect.value = themeName;
                            if (syncSpan) syncSpan.textContent = formattedName;
                            
                            if (syncUl) {
                                syncUl.querySelectorAll('li').forEach(el => el.classList.remove('active-config'));
                                const matchingLi = Array.from(syncUl.querySelectorAll('li')).find(el => el.dataset.value === themeName);
                                if (matchingLi) matchingLi.classList.add('active-config');
                            }
                        });

                        customUl.classList.remove('active');
                        
                        await changeTheme(themeSelector); 
                    });

                    customUl.appendChild(li);
                });
            }
        });
    }

    const buttonsConfig = document.querySelectorAll('a[data-code]');
    buttonsConfig.forEach(button => {
        const code = button.dataset.code;
        
        if (config[code] === true) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
});


document.addEventListener('DOMContentLoaded', async () => {
    const config = await window.electronAPI.config.getConfig();
    const currentFeatured = config.featured;

    const selectorsContainers = document.querySelectorAll('.featured-selector-div');

    selectorsContainers.forEach(container => {
        const featuredSelector = container.querySelector('select'); 
        const customBtn = container.querySelector('.featuredSelector-btn');
        const customSpan = container.querySelector('#featuredSelector-btn-name');
        const customUl = container.querySelector('.featuredSelector-select');

        if (featuredSelector && customUl && customSpan) {
            customUl.innerHTML = '';
            
            featuredSelector.value = currentFeatured;
            
            const activeOption = Array.from(featuredSelector.options).find(opt => opt.value === currentFeatured);
            if (activeOption) {
                customSpan.textContent = activeOption.textContent;
            } else {
                customSpan.textContent = currentFeatured.charAt(0).toUpperCase() + currentFeatured.slice(1);
            }

            Array.from(featuredSelector.options).forEach(option => {
                const featuredName = option.value;
                const formattedName = option.textContent;

                const li = document.createElement('li');
                const textSpan = document.createElement('span');
                textSpan.textContent = formattedName;

                li.appendChild(textSpan);
                li.dataset.value = featuredName;

                if (featuredName == 'none') {
                    textSpan.setAttribute('data-i18n', 'featured-none');
                    applyLocale();
                }
                if (featuredName == 'playing_now') {
                    textSpan.setAttribute('data-i18n', 'playing-now');
                    applyLocale();
                }
                if (featuredName == 'fn_fast_edit') {
                    textSpan.textContent = `Fortnite BR: ${window._t['fn-quick-edit']}`;
                    applyLocale();
                }
                
                if (featuredName === currentFeatured) {
                    li.classList.add('active-config');
                }
                li.addEventListener('click', async () => {
                    document.querySelectorAll('.featured-selector-div').forEach(syncContainer => {
                        const syncSelect = syncContainer.querySelector('select');
                        const syncSpan = syncContainer.querySelector('#featuredSelector-btn-name');
                        const syncUl = syncContainer.querySelector('.featuredSelector-select');

                        if (syncSelect) syncSelect.value = featuredName;
                        if (syncSpan) syncSpan.textContent = formattedName;
                        
                        if (syncUl) {
                            syncUl.querySelectorAll('li').forEach(el => el.classList.remove('active-config'));
                            const matchingLi = Array.from(syncUl.querySelectorAll('li')).find(el => el.dataset.value === featuredName);
                            if (matchingLi) matchingLi.classList.add('active-config');
                        }
                    });
                    customUl.classList.remove('active-config');
                    
                    await changeFeatured(featuredSelector); 
                });

                customUl.appendChild(li);
            });
        }
    });

    const buttonsConfig = document.querySelectorAll('a[data-code]');
    buttonsConfig.forEach(button => {
        const code = button.dataset.code;
        
        if (config[code] === true) {
            button.classList.add('active-config');
        } else {
            button.classList.remove('active-config');
        }
    });
});


function tabSwitch(el) {
    const code = el.dataset.code;
    const title = el.querySelector('span').textContent;
    const mainTitle = document.querySelector('.tab-configs-title');
    mainTitle.textContent = title

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

async function selectNewTheme(themeName) {
    localStorage.removeItem('cached-theme-css');
    localStorage.removeItem('cached-theme-name');

    if (typeof applyTheme === 'function') {
        await applyTheme();
    }

    if (window.parent && typeof window.parent.applyTheme === 'function') {
        window.parent.localStorage.removeItem('cached-theme-css');
        window.parent.localStorage.removeItem('cached-theme-name');
        await window.parent.applyTheme();
    }
}

async function changeTheme(selectEl) {
    const selectedTheme = selectEl.value;

    window.electronAPI.config.updateConfig('theme', selectedTheme);

    await selectNewTheme(selectedTheme);
}
async function changeFeatured(selectEl) {
    const selectedFeatured = selectEl.value;

    window.electronAPI.config.updateConfig('featured', selectedFeatured);
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