function toggleConfig(el) {
    const option = el.dataset.code;

    el.classList.toggle('active');
    
    const isActive = el.classList.contains('active');

    window.electronAPI.config.updateConfig(option, isActive);
}

document.addEventListener('DOMContentLoaded', async () => {
    const config = await window.electronAPI.config.getConfig();
    
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


function tabSwitch(el) {
    const code = el.dataset.code;

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

async function loadInfo() {
  const userData = await window.info.getUserData();
  const documents = await window.info.getDocuments();

  document.getElementById('user-config').textContent = userData + '/config.json';
  document.getElementById('documents').textContent = documents;
//   document.getElementById('assets-folder').textContent = userData + '/assets';
  document.getElementById('themes-folder').textContent = documents + '/Themes';
}

async function selectNewTheme(themeName) {
    localStorage.removeItem('cached-theme-css');
    localStorage.removeItem('cached-theme-name');
    
    await applyTheme(); 
}

async function changeTheme(selectEl) {
    const selectedTheme = selectEl.value;

    window.electronAPI.config.updateConfig('theme', selectedTheme);

    await selectNewTheme(selectedTheme);
}
async function changeFeatured(selectEl) {
    const selectedFeatured = selectEl.value;

    window.electronAPI.config.updateConfig('featured', selectedFeatured);

    await selectNewTheme(selectedFeatured);
}

loadInfo();

async function checkUpdates() {
    const text = document.getElementById('checkUpdates-text');
    if (!text) return;

    text.textContent = 'Verificando atualizações...';
    text.style.color = 'var(--text)';
    text.style.opacity = 1;

    try {
        const result = await window.electronAPI.updates.checkUpdates();

        if (result && result.status === 'available') {
            text.textContent = `Nova versão disponível!`;
            text.style.color = 'var(--blue)';
        } else {
            text.textContent = 'BoltNotes já atualizado!';
            text.style.color = 'var(--blue)';
            
            setTimeout(() => {
                text.style.opacity = 0;
            }, 3500);
        }
    } catch (err) {
        text.textContent = 'Erro ao buscar atualizações.';
        text.style.color = 'var(--red)';
    }
}

async function syncAssets() {
    const text = document.getElementById('syncAssets-text');
    if (!text) return;

    let respondeuPeloAwait = false;

    window.electronAPI.onAssetsProgress((data) => {
        if (respondeuPeloAwait) return;

        const progresso = (data && typeof data === 'object') ? (data.percent || data.progress) : data;
        
        const mb = (data.downloaded / 1024 / 1024).toFixed(1);
        const totalMb = data.total ? (data.total / 1024 / 1024).toFixed(1) : '?';

        text.textContent = `Baixando ${data.package} (${data.percent ?? '...'}%) ${mb} MB / ${totalMb} MB`;
        text.style.color = 'var(--text)';
        text.style.opacity = 1;
    });

    text.textContent = 'Iniciando...';
    text.style.color = 'var(--text--light-gray)';
    text.style.opacity = 1;

    try {
        const result = await window.electronAPI.syncAssets();

        respondeuPeloAwait = true;

        if (result && result.success) {
            exibirMensagemFeedback(text, 'Assets sincronizados!', 'var(--blue)');
        } else {
            const erroMsg = result && result.error ? result.error : 'Erro ao sincronizar.';
            exibirMensagemFeedback(text, erroMsg, 'var(--red)');
        }
    } catch (err) {
        respondeuPeloAwait = true;
        exibirMensagemFeedback(text, 'Erro de comunicação com o sistema.', 'var(--red)');
    }
}

function exibirMensagemFeedback(elemento, mensagem, cor) {
    elemento.textContent = mensagem;
    elemento.style.color = cor;
    elemento.style.opacity = 1;
    
    if (elemento.timeoutId) clearTimeout(elemento.timeoutId);
    
    elemento.timeoutId = setTimeout(() => {
        elemento.style.opacity = 0;
    }, 3500);
}