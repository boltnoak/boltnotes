document.addEventListener('DOMContentLoaded', () => {
    const currentUrl = location.pathname.split('/').slice(-2).join('/') + location.search;
    sessionStorage.setItem('fortniteLastUrl', currentUrl);
});