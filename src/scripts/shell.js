let cachedFortniteChapters = '';

window.setFortniteChapters = function(html) {
  cachedFortniteChapters = html;
  
  const container = document.querySelector('.sidebar-chapter-section');
  if (container) {
    container.innerHTML = html;
    bindSidebarEvents();
  }
};

function bindSidebarEvents() {
  document.querySelectorAll('.sidebar-btn[data-nav]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      navigateShell(btn.dataset.nav);
    };
  });
}

function getFortniteLastUrl() {
  return sessionStorage.getItem('fortniteLastUrl');
}

function setFortniteLastUrl(url) {
  sessionStorage.setItem('fortniteLastUrl', url);
}

// Auxiliar para pegar tradução síncrona se o dicionário já estiver carregado
function t(key, fallback) {
  return (window._t && window._t[key]) ? window._t[key] : fallback;
}

// 1. Renderiza a estrutura do Header APENAS UMA VEZ na inicialização
function initHeader() {
  const header = document.querySelector('header');
  if (!header) return;

  const savedFortniteUrl = getFortniteLastUrl() || 'pages/fortnite.html';

  header.innerHTML = `
    <!-- <div class="sidebar-header-logo">
        <img src="assets/boltnotes-icon.png">
        <span>BoltNotes</span>
    </div> -->
    <a class="sidebar-btn" data-page="games" data-nav="pages/games.html">
        <i class="fa-solid fa-gamepad"></i>
        <span data-i18n="games-backlog">${t('games-backlog', 'Voltar')}</span>
    </a>
    <a class="sidebar-btn" data-page="notes" data-nav="pages/notes.html">
        <i class="fa-solid fa-note-sticky"></i>
        <span data-i18n="notes">${t('notes', 'Notas')}</span>
    </a>
    <a id="nav-fortnite-main" class="sidebar-btn" data-page="fortnite" data-nav="${savedFortniteUrl}">
        <div class="sidebar-fortnite-icon"></div>
        <span data-i18n="fortnite">${t('fortnite', 'Fortnite')}</span>
    </a>

    <div class="sidebar-sep-bar fortnite-only" style="display: none;"></div>
    
    <div class="sidebar-chapter-section fortnite-only" style="display: none;">
        ${cachedFortniteChapters}
    </div>

    <a class="sidebar-btn fortnite-only" data-nav="pages/fortnite.html" style="display: none;">
        <i class="fa-solid fa-book"></i>
        <span data-i18n="fn-chapters">${t('fn-chapters', 'Voltar')}</span>
    </a>

    <div class="sidebar-bottom">
        <div class="header-sep-bar fortnite-only" style="display: none;"></div>
        <a id="update-btn" class="sidebar-btn">
            <i class="fa-solid fa-arrow-rotate-right"></i>
            <span data-i18n="update">${t('update', 'Atualizar')}</span>
        </a>
        <a class="sidebar-btn" data-page="index" data-nav="pages/index.html">
            <i class="fa-solid fa-house"></i>
            <span data-i18n="home">${t('home', 'Início')}</span>
        </a>
        <a class="config sidebar-btn" data-page="config" data-nav="pages/config.html">
            <i id="config" class="fa-solid fa-sliders"></i>
            <span data-i18n="settings">${t('settings', 'Configurações')}</span>
        </a>
    </div>
  `;

  // Traduz o DOM uma única vez
  if (typeof applyLocale === 'function') applyLocale();
  bindSidebarEvents();
}

// 2. Atualiza apenas o estado da interface nas navegações (Sem destruir o HTML)
function updateHeaderState(activePage) {
  const isFortnite = activePage.includes('fortnite');
  const savedFortniteUrl = getFortniteLastUrl() || 'pages/fortnite.html';

  // Atualiza a URL do botão do Fortnite
  const fnMainBtn = document.getElementById('nav-fortnite-main');
  if (fnMainBtn) fnMainBtn.dataset.nav = savedFortniteUrl;

  // Atualiza a classe 'active'
  document.querySelectorAll('header .sidebar-btn[data-page]').forEach(btn => {
    const pageKey = btn.dataset.page;
    if (pageKey === 'fortnite') {
      btn.classList.toggle('active', isFortnite);
    } else {
      btn.classList.toggle('active', pageKey === activePage);
    }
  });

  // Alterna a exibição dos elementos exclusivos do Fortnite
  document.querySelectorAll('.fortnite-only').forEach(el => {
    el.style.display = isFortnite ? 'flex' : 'none';
  });
}

function navigateShell(page) {
  const filename = page.split('/').pop().split('.')[0].split('?')[0];

  if (filename.includes('fortnite')) {
    setFortniteLastUrl(page);
  }

  document.getElementById('content').src = page;
  updateHeaderState(filename);
}

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  updateHeaderState('index');
});

window.electronAPI.onWindowStateChange((state) => {
  if (state === 'maximized') {
    document.documentElement.classList.add('window-maximized');
    document.documentElement.classList.remove('window-normal');
  } else {
    document.documentElement.classList.add('window-normal');
    document.documentElement.classList.remove('window-maximized');
  }
  sessionStorage.setItem('windowState', state);
});