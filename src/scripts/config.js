function toggleConfig(el) {
    const option = el.dataset.code;

    el.classList.toggle('active');
    
    const isActive = el.classList.contains('active');

    window.electronAPI.config.updateConfig(option, isActive);
}

document.addEventListener('DOMContentLoaded', async () => {
    const config = await window.electronAPI.config.getConfig();
    
    const themeSelector = document.getElementById('theme-selector');
    const customBtn = document.querySelector('.themeSelector-btn');
    const customSpan = customBtn.querySelector('span');
    const customUl = document.querySelector('.themeSelector-select');

    if (themeSelector && customUl) {
        // 1. Agora themesList traz [{name, bg}, {name, bg}]
        const themesList = await window.electronAPI.themes.list();
        const currentTheme = await window.electronAPI.themes.getCurrent();

        themeSelector.innerHTML = '';
        customUl.innerHTML = '';

        themesList.forEach(themeObj => {
            const themeName = themeObj.name;
            const themeBg = themeObj.bg; // <--- Aqui está a cor capturada do arquivo!
            const formattedName = themeName.charAt(0).toUpperCase() + themeName.slice(1);

            // Preenche o select nativo (apenas o nome string)
            const option = document.createElement('option');
            option.value = themeName;
            option.textContent = formattedName;
            if (themeName === currentTheme) option.selected = true;
            themeSelector.appendChild(option);

            // Preenche a lista customizada (UL > LI)
            const li = document.createElement('li');
            
            // Cria a bolinha de cor dinâmica usando o background do arquivo .boltss
            const colorCircle = document.createElement('span');
            colorCircle.className = 'theme-color-preview';
            colorCircle.style.backgroundColor = themeBg; // Aplica a cor extraída
            
            // Cria o texto do nome do tema
            const textSpan = document.createElement('span');
            textSpan.textContent = formattedName;

            // Coloca a bolinha e o texto dentro do <li>
            li.appendChild(colorCircle);
            li.appendChild(textSpan);
            li.dataset.value = themeName;
            
            li.addEventListener('click', async () => {
                themeSelector.value = themeName;
                customSpan.textContent = formattedName;
                customUl.classList.remove('active');
                
                await changeTheme(themeSelector); 
            });

            customUl.appendChild(li);
        });

        customSpan.textContent = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);
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

loadInfo();