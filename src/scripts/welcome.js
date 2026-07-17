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

  if (menuMax) {
    menuMax.className = isNormal
      ? 'fa-regular fa-window-maximize'
      : 'fa-regular fa-window-restore';
  }
}

async function updateMaximizeIcon() {
    const menuMax = document.getElementById('menuMax');

    const isMaximized = await window.electronAPI.menu.isMaximized();

    menuMax.className = isMaximized
        ? 'fa-regular fa-window-restore'
        : 'fa-regular fa-window-maximize';
}

document.addEventListener('DOMContentLoaded', async () => {
  const versao = await window.api.getAppVersion();
  
  const elementoVersao = document.getElementById('app-version');
  if (elementoVersao) {
    elementoVersao.innerText = `v${versao}`;
  }
});

async function initMenu() {
    const res = await fetch('components/menu.bolt');
    const data = await res.text();

    const container = document.querySelector('.app-container');
    (container || document.body).insertAdjacentHTML('afterbegin', data);

    const menuMax = document.getElementById('menuMax');
    const savedState = sessionStorage.getItem('windowState') || 'normal';
    if (menuMax) {
        menuMax.className = savedState === 'maximized'
            ? 'fa-regular fa-window-restore'
            : 'fa-regular fa-window-maximize';
    }

    const menu = document.getElementById('menu');
    let dragging = false;
    let lastX, lastY;

    menu.addEventListener('mousedown', (e) => {
        if (e.target.closest('.menuButtons') || e.target.closest('#update-btn')) return;

        const isMaximized = sessionStorage.getItem('windowState') === 'maximized';
        if (isMaximized) return;
        
        dragging = true;
        lastX = e.screenX;
        lastY = e.screenY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.screenX - lastX;
        const dy = e.screenY - lastY;
        lastX = e.screenX;
        lastY = e.screenY;
        window.electronAPI.menu.dragWindow({ mouseX: dx, mouseY: dy });
    });

    document.addEventListener('mouseup', () => { dragging = false; });

    document.getElementById('menuTitle').textContent = document.title;

    await updateMaximizeIcon();
    applyWindowState(sessionStorage.getItem('windowState') || 'normal');
}

initMenu();

async function changeFeatured(selectEl) {
    const selectedFeatured = selectEl.value;

    window.electronAPI.config.updateConfig('featured', selectedFeatured);

    if (selectedFeatured == 'none') {
        document.querySelector('#featured-title').style.display = 'none';
        document.querySelector('.page-infos').style.display = 'none';
    }
    if (selectedFeatured == 'fn_fast_edit') {
        document.querySelector('.page-infos').style.display = 'flex';

        document.querySelector('#featured-title').innerHTML = `Fortnite BR — ${window._t['fn-quick-edit']}<i class="fa-solid fa-square-poll-horizontal"></i>`;
        document.querySelector('#featured-title').style.display = 'flex';
        document.querySelector('.recentSeason-panel').style.display = 'flex';
        
        document.querySelector('.playingNow-panel').style.display = 'none';
    }
    if (selectedFeatured == 'playing_now') {
        document.querySelector('.page-infos').style.display = 'flex';

        document.querySelector('#featured-title').innerHTML = `${window._t['playing-now']}<i class="fa-solid fa-gamepad"></i>`;
        document.querySelector('#featured-title').style.display = 'flex';
        document.querySelector('.playingNow-panel').style.display = 'flex';

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
            window.electronAPI.notifyLanguageChanged();
            applyLocale();
            changeLangSelect.style.display = 'none';
        });
    });

    const assetsConf = await window.api.assetsConfig.get();

    document.querySelectorAll('a[data-assets-code]').forEach(button => {
        const code = button.dataset.code;
        if (assetsConf[code] !== false) {
            button.classList.add('active');
        }
    });
    
    const themeContainers = document.querySelectorAll('.theme-selector-div');

    if (themeContainers.length > 0) {
        const themesList = await window.electronAPI.themes.list();
        const currentTheme = await window.electronAPI.themes.getCurrent();

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

async function updateNoteCount() {
  const count = await window.api.notes.count();
  const el = document.getElementById("note-count");

  if (el) {
    el.textContent = `${count} Notas`;
  }
}

let cachedSeasonInfo = null;

async function loadFortniteStats() {
  try {
    const data = await loadCloudSeasonInfo();

    if (!data || Object.keys(data).length === 0) {
      console.log("Nenhum dado de Fortnite encontrado ainda.");
      return; 
    }

    const keys = Object.keys(data);
    const chapters = new Set();
    
    keys.forEach(key => {
      const match = key.match(/^c(\d+)s(\d+)$/i);
      if (match) {
        const chapter = match[1];
        chapters.add(chapter);
      }
    });

    const totalSeasons = keys.length;
    const totalChapters = chapters.size;

    document.getElementById("season-count").textContent = `${totalSeasons + 20} ${window._t['fn-seasons']}`;
    document.getElementById("chapter-count").textContent = `${totalChapters + 2} ${window._t['fn-chapters']}`;

  } catch (error) {
    console.error("Erro ao calcular o progresso do Fortnite:", error);
  }
}

updateNoteCount();
loadFortniteStats();

function parseBRDate(dateStr) {
  if (!dateStr || !dateStr.includes("/")) return 0;

  const [d, m, y] = dateStr.split("/").map(Number);
  return new Date(y, m - 1, d).getTime();
}

const playingNowTitle = document.getElementById('featured-title');

let steps = 0;
let canClick = false;

function finish() {
  window.electronAPI.welcomeDone();
  window.location = 'pages/index.html'
}

function toggleAssetsConfig(el) {
    const mark = document.querySelector('.fortnite-mark');
    const option = mark.dataset.code;

    mark.classList.toggle('active');
    
    const isActive = mark.classList.contains('active');

    window.api.assetsConfig.update(option, isActive);
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

    const assetsConf = await window.api.assetsConfig.get();

    document.querySelectorAll('a[data-assets-code]').forEach(button => {
        const code = button.dataset.code;
        if (assetsConf[code] !== false) {
            button.classList.add('active');
        }
    });

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
        'playing_now': document.querySelector('.playingNow-panel'),
        'fn_fast_edit': document.querySelector('.recentSeason-panel')
    };

    const currentFeatured = config.featured;

    if (currentFeatured === 'none') {
        document.querySelector('.recentSeason-panel').style.display = 'none';
        document.querySelector('.playingNow-panel').style.display = 'none';
        document.querySelector('#featured-title').style.display = 'none';
        document.querySelector('.page-infos').style.display = 'none';
    } if (currentFeatured === 'fn_fast_edit') {
        document.querySelector('#featured-title').innerHTML = `Fortnite BR — ${window._t['fn-quick-edit']}<i class="fa-solid fa-square-poll-horizontal"></i>`;
        document.querySelector('.playingNow-panel').style.display = 'none';
        document.querySelector('.recentSeason-panel').style.display = 'flex';
    } if (currentFeatured === 'playing_now') {
        document.querySelector('#featured-title').innerHTML = `${window._t['playing-now']}<i class="fa-solid fa-gamepad"></i>`;
        document.querySelector('.recentSeason-panel').style.display = 'none';
        document.querySelector('.playingNow-panel').style.display = 'flex';
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

const FILE_STATS = "Fortnite/stats.json";

async function loadCloudSeasonInfo() {
    if (cachedSeasonInfo) return cachedSeasonInfo;
    try {
        const content = await window.api.fortnite.getSeasons(); 
        cachedSeasonInfo = content || {};
        return cachedSeasonInfo;
    } catch (e) {
        console.error("Erro ao buscar dados da internet:", e);
        return {};
    }
}