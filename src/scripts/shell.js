let cachedFortniteChapters = '';

window.setFortniteChapters = function(html) {
  cachedFortniteChapters = html;
  
  const container = document.querySelector('.chapter-list');
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

function t(key, fallback) {
    return (window._t && window._t[key]) ? window._t[key] : fallback;
}

function updateHeaderState(activePage) {
    const savedFortniteUrl = getFortniteLastUrl() || 'pages/fortnite.html';
    const fnMainBtn = document.getElementById('nav-fortnite-main');
    fnMainBtn.dataset.nav = savedFortniteUrl;

    document.querySelectorAll('header .sidebar-btn[data-page]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === activePage);
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
    bindSidebarEvents();
    updateHeaderState('index');
});

window.electronAPI.onWindowStateChange((state) => {
    document.documentElement.classList.toggle('window-maximized', state === 'maximized');
});