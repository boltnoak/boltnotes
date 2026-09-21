const THEMES_URL = 'documents://Themes';

async function getTheme(themeName) {
  const name = String(themeName ?? '').replace(/[\\/]/g, '').trim();
  if (!name) return null;

  try {
    const res = await fetch(`${THEMES_URL}/${encodeURIComponent(name)}.boltss`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
async function listThemes() {
  let names;
  try {
    const res = await fetch(`${THEMES_URL}/.ThemeList`);
    if (!res.ok) return [];
    names = (await res.text()).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }

  return Promise.all(
    names.map(async (name) => {
      try {
        const res = await fetch(`${THEMES_URL}/${encodeURIComponent(name)}.boltss`);
        if (!res.ok) throw new Error();
        const css = await res.text();
        const bg = css.match(/--bg\s*:\s*([^;}\n]+)/)?.[1].trim() ?? '#050505';
        return { name, bg };
      } catch {
        return { name, bg: '#000000' };
      }
    })
  );
}

// Ferramentas de dev
window.addEventListener('keydown', (e) => {
  if (!window.electronAPI || !window.electronAPI.isDev) {
    if (e.code === "F5" || e.code === "F12") {
      e.preventDefault();
    }
    return;
  }

  if (e.code == "F5") {
    const bodyElement = document.querySelector('.pageBody');
    if (bodyElement) {
      sessionStorage.setItem('pageBodyScroll', bodyElement.scrollTop);
    }
    window.location.reload();
  };
  
  if (e.code == "F12") {
    window.electronAPI.devTools();
  };
});

function minimizeApp() {
  window.electronAPI.menu.minimizeApp();
}
function maximizeApp() {
  window.electronAPI.menu.maximizeApp();
}
function closeApp() {
  window.electronAPI.menu.closeApp();
}

window.electronAPI.onWindowStateChange((state) => {
    sessionStorage.setItem('windowState', state);
    applyWindowState(state);
});

function applyWindowState(state) {
  const menuMax = document.getElementById('menuMax');
  const isNormal = state === 'normal';

  document.documentElement.classList.toggle('window-normal', isNormal);
  document.documentElement.classList.toggle('window-maximized', !isNormal);
}

document.addEventListener('DOMContentLoaded', async () => {
  const versao = await window.api.getAppVersion();
  
  const elementoVersao = document.getElementById('app-version');
  if (elementoVersao) {
    elementoVersao.innerText = `v${versao}`;
  }
});

async function changeFeatured(selectEl) {
    const selectedFeatured = selectEl.value;

    window.electronAPI.config.updateConfig('featured', selectedFeatured);

    if (selectedFeatured == 'none') {
        document.querySelector('#featured-title').style.display = 'none';
        document.querySelector('.page-infos').style.display = 'none';
    }
    if (selectedFeatured == 'fn_fast_edit') {
        document.querySelector('.page-infos').style.display = 'flex';

        document.querySelector('#featured-title').innerHTML = `<i class="fa-solid fa-square-poll-horizontal"></i>Fortnite BR — ${window._t['fn-quick-edit']}`;
        document.querySelector('#featured-title').style.display = 'flex';
        document.querySelector('.recentSeason-panel').style.display = 'flex';
        
        document.querySelector('.featured-games').style.display = 'none';
    }
    if (selectedFeatured == 'playing_now') {
        document.querySelector('.page-infos').style.display = 'flex';

        document.querySelector('#featured-title').innerHTML = `<i class="fa-solid fa-gamepad"></i>${window._t['playing-now']}`;
        document.querySelector('#featured-title').style.display = 'flex';
        document.querySelector('.featured-games').style.display = 'flex';

        document.querySelector('.recentSeason-panel').style.display = 'none';
    }
}

function toggleConfig(el) {
    const option = el.dataset.code;

    el.classList.toggle('active');
    
    const isActive = el.classList.contains('active');

    window.electronAPI.config.updateConfig(option, isActive);

    if (option == 'notes_on_home' && !isActive) {
        document.getElementById('notes').style.display = 'none';
    }
    if (option == 'notes_on_home' && isActive) {
        document.getElementById('notes').style.display = 'flex';
    }
    if (option == 'backlog_on_home' && !isActive) {
        document.getElementById('games').style.display = 'none';
    }
    if (option == 'backlog_on_home' && isActive) {
        document.getElementById('games').style.display = 'flex';
    }
    if (option == 'fortnite_on_home' && !isActive) {
        document.getElementById('fortnite').style.display = 'none';
    }
    if (option == 'fortnite_on_home' && isActive) {
        document.getElementById('fortnite').style.display = 'flex';
    }
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
            
            await applyLocale(); 
            changeLangSelect.style.display = 'none';

            const featuredSelect = document.querySelector('.featured-selector-div select');
            if (featuredSelect) {
                changeFeatured(featuredSelect);

                const customSpan = document.querySelector('#featuredSelector-btn-name');
                const activeOption = Array.from(featuredSelect.options).find(opt => opt.value === featuredSelect.value);
                if (customSpan && activeOption) {
                    customSpan.textContent = activeOption.textContent;
                }

                const customUl = document.querySelector('.featuredSelector-select');
                if (customUl) {
                    Array.from(featuredSelect.options).forEach(option => {
                        const matchingSpan = customUl.querySelector(`li[data-value="${option.value}"] span`);
                        if (matchingSpan) {
                            matchingSpan.textContent = option.textContent; 
                        }
                    });
                }
            }

            updateNoteCount();
            loadFortniteStats();
        });
    });
    
    const themeContainers = document.querySelectorAll('.theme-selector-div');

    // if (themeContainers.length > 0) {
    //     const config = await window.electronAPI.config.getConfig();
    //     const themesList = await listThemes();
    //     const currentTheme = config.theme;

    //     themeContainers.forEach(container => {
    //         const themeSelector = container.querySelector('select');
    //         const customBtn = container.querySelector('.themeSelector-btn');
    //         const customSpan = customBtn ? customBtn.querySelector('span') : null;
    //         const customUl = container.querySelector('.themeSelector-select');

    //         if (themeSelector && customUl && customSpan) {
    //             themeSelector.innerHTML = '';
    //             customUl.innerHTML = '';

    //             const formattedCurrentName = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);
    //             customSpan.textContent = formattedCurrentName;

    //             themesList.forEach(themeObj => {
    //                 const themeName = themeObj.name;
    //                 const themeBg = themeObj.bg; 
    //                 const formattedName = themeName.charAt(0).toUpperCase() + themeName.slice(1);

    //                 const option = document.createElement('option');
    //                 option.value = themeName;
    //                 option.textContent = formattedName;
    //                 if (themeName === currentTheme) option.selected = true;
    //                 themeSelector.appendChild(option);

    //                 const li = document.createElement('li');
                    
    //                 const colorCircle = document.createElement('span');
    //                 colorCircle.className = 'theme-color-preview';
    //                 colorCircle.style.backgroundColor = themeBg;
                    
    //                 const textSpan = document.createElement('span');
    //                 textSpan.textContent = formattedName;

    //                 li.appendChild(colorCircle);
    //                 li.appendChild(textSpan);
    //                 li.dataset.value = themeName;
                    
    //                 if (themeName === currentTheme) {
    //                     li.classList.add('active-config');
    //                 }
                    
    //                 li.addEventListener('click', async () => {
    //                     document.querySelectorAll('.theme-selector-div').forEach(syncContainer => {
    //                         const syncSelect = syncContainer.querySelector('select');
    //                         const syncSpan = syncContainer.querySelector('.themeSelector-btn span');
    //                         const syncUl = syncContainer.querySelector('.themeSelector-select');

    //                         if (syncSelect) syncSelect.value = themeName;
    //                         if (syncSpan) syncSpan.textContent = formattedName;
                            
    //                         if (syncUl) {
    //                             syncUl.querySelectorAll('li').forEach(el => el.classList.remove('active-config'));
    //                             const matchingLi = Array.from(syncUl.querySelectorAll('li')).find(el => el.dataset.value === themeName);
    //                             if (matchingLi) matchingLi.classList.add('active-config');
    //                         }
    //                     });

    //                     customUl.classList.remove('active');
                        
    //                     await changeTheme(themeSelector); 
    //                 });

    //                 customUl.appendChild(li);
    //             });
    //         }
    //     });
    // }

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

let cachedSeasons = null;

function parseBRDate(dateStr) {
  if (!dateStr || !dateStr.includes("/")) return 0;

  const [d, m, y] = dateStr.split("/").map(Number);
  return new Date(y, m - 1, d).getTime();
}

const playingNowTitle = document.getElementById('featured-title');

let steps = 0;
let canClick = false;

async function finish() {
    await window.electronAPI.config.updateConfig("welcomed", true);
    window.location.href = 'pages/shell.html';
}


document.addEventListener('DOMContentLoaded', async () => {
  const nextButtons = document.querySelectorAll('.next-btn');
  const start = document.getElementById('start');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');

  start.classList.add('fadeIn');

  nextButtons.forEach(nextBtn => {
    nextBtn.addEventListener('click', () => {
      if (nextBtn.classList.contains('locked') || nextBtn.disabled) return;

      if (steps === 0) {
        nextBtn.classList.add('locked');
        nextBtn.disabled = true;

        start.classList.remove('fadeIn');
        start.classList.add('fadeOut');

        start.addEventListener('animationend', function aoSumir() {
          start.removeEventListener('animationend', aoSumir);
          
          start.style.display = 'none';
          step1.style.display = 'flex';

          step1.classList.add('fadeIn');

          step1.addEventListener('animationend', function aoSurgir() {
            step1.removeEventListener('animationend', aoSurgir);
            
            steps = 1;
            nextBtn.classList.remove('locked');
            nextBtn.disabled = false;
          });
        });
      }
      else if (steps === 1) {
        nextBtn.classList.add('locked');
        nextBtn.disabled = true;

        step1.classList.remove('fadeIn');
        step1.classList.add('fadeOut');

        step1.addEventListener('animationend', function aoSumir() {
          step1.removeEventListener('animationend', aoSumir);
          
          step1.style.display = 'none';
          step2.style.display = 'flex';

          step2.classList.add('fadeIn');

          step2.addEventListener('animationend', function aoSurgir() {
            step2.removeEventListener('animationend', aoSurgir);
            
            steps = 2;
            nextBtn.classList.remove('locked');
            nextBtn.disabled = false;
          });
        });
      }
    });
  })

    const config = await window.electronAPI.config.getConfig();

    const toggles = {
        'notes_on_home': document.getElementById('notes'),
        'backlog_on_home': document.getElementById('games'),
        'fortnite_on_home': document.getElementById('fortnite'),
        'show_version': document.querySelector('.app-version')
    };

    const featuredPanels = {
        'none': [
            document.querySelector('.page-infos')
        ],
        'playing_now': document.querySelector('.featured-games'),
        'fn_fast_edit': document.querySelector('.recentSeason-panel')
    };

    const currentFeatured = config.featured;

    if (currentFeatured === 'none') {
        document.querySelector('.recentSeason-panel').style.display = 'none';
        document.querySelector('.featured-games').style.display = 'none';
        document.querySelector('#featured-title').style.display = 'none';
        document.querySelector('.page-infos').style.display = 'none';
    } if (currentFeatured === 'fn_fast_edit') {
        document.querySelector('#featured-title').innerHTML = `<i class="fa-solid fa-square-poll-horizontal"></i>Fortnite BR — ${window._t['fn-quick-edit']}`;
        document.querySelector('.featured-games').style.display = 'none';
        document.querySelector('.recentSeason-panel').style.display = 'flex';
    } if (currentFeatured === 'playing_now') {
        document.querySelector('#featured-title').innerHTML = `<i class="fa-solid fa-gamepad"></i>${window._t['playing-now']}`;
        document.querySelector('.recentSeason-panel').style.display = 'none';
        document.querySelector('.featured-games').style.display = 'flex';
    } else {
        for (const [key, value] of Object.entries(featuredPanels)) {
            if (key === 'none') continue;
            const elements = Array.isArray(value) ? value : [value];

            elements.forEach(el => {
                if (el) {
                    el.style.display = key === currentFeatured ? '' : 'none';
                }
            });
        }
    }


    for (const [key, value] of Object.entries(toggles)) {
        if (!value) continue;

        const elements = Array.isArray(value) ? value : [value];

        elements.forEach(el => {
            if (el) {
                el.style.display = config[key] === false ? 'none' : '';
            }
        });
    }
});