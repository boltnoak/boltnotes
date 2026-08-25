
document.addEventListener('DOMContentLoaded', () => {
    // Salva a URL atual (path + query, ex: pages/fortnite-chapter.html?num=7)
    const currentUrl = location.pathname.split('/').slice(-2).join('/') + location.search;
    localStorage.setItem('fortniteLastUrl', currentUrl);
});