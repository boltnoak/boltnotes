let cachedSeasons = null;

async function loadCloudSeasonInfo() {
    if (cachedSeasons) return cachedSeasons;

    const config = await window.electronAPI.config.getConfig();
    const language = config.language || "pt-BR";

    const url = `https://gist.githubusercontent.com/boltnoak/a836e64254fca6d8263c6d66347e021d/raw/fn-seasons-${language}.json`;

    const content = await fetchWithCache(url, `fn-seasons-${language}`);
    cachedSeasons = content || {};
    return cachedSeasons;
}

async function getLatestSeason() {
    const seasons = await loadCloudSeasonInfo();
    const [key, value] = Object.entries(seasons)[0] || [];

    return key ? {key, data: value} : null;
}

async function loadBanner() {
        const latest = await getLatestSeason();
        if (!latest) return;

        console.log(`Temporada mais recente: ${latest.key.toUpperCase().replace('S','T')} — ${latest.data.name}`);
        document.getElementById("latestSeasonBG").style.backgroundImage = `url('assets://fortnite-${latest.key}-assets/${latest.key}.jpg')`;
}
async function loadSidebarChapters() {
    const data = await loadCloudSeasonInfo();
    if (!data) return;

    const chapters = [...new Set(
        Object.keys(data)
            .map(key => key.match(/^c\d+/i)?.[0])
            .filter(Boolean)
    )].sort((a, b) => {
        const numA = parseInt(a.replace('c', ''), 10);
        const numB = parseInt(b.replace('c', ''), 10);
        return numB - numA;
    });
    const chaptersHtml = chapters.map((e) => {
        const number = e.replace('c', '');
        return `<a class="sidebar-btn sidebar-btn-chapter" data-chapter="${number}" data-nav="pages/fortnite-chapter.html?num=${number}">
                    <p class="sidebar-btn-number">${number}</p>
                    <span><span data-i18n="fn-chapter">Capítulo</span> ${number}</span>
                </a>`;
    }).join('');
    if (window.parent && typeof window.parent.setFortniteChapters === 'function') {
        window.parent.setFortniteChapters(chaptersHtml);
        const urlParams = new URLSearchParams(window.location.search);
        const currentNum = urlParams.get('num');
        if (currentNum) {
            window.parent.document.querySelectorAll('.sidebar-btn-chapter').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.chapter === currentNum);
            });
        }
    }
}
async function loadChapters() {
    const data = await loadCloudSeasonInfo();
    if (!data) return;

    const chapters = [...new Set(
        Object.keys(data)
            .map(key => key.match(/^c\d+/i)?.[0])
    )];

    document.querySelector('.chapter-section').innerHTML = chapters.map((e) => {
        const number = e.replace('c', '');
        return `<a id="chapter" data-chapter="${number}" href="pages/fortnite-chapter.html?num=${number}">
                    <div class="chapter-image-div">
                        <img class="chapter-image" src="assets://fn-chapter-covers/chapter${number}-cover.jpg">
                    </div>
                    <p class="title"><span data-i18n="fn-chapter">Capítulo</span> ${number}</p>
                </a>`;
    }).join('');
    applyLocale();
}

loadBanner();
loadChapters();
loadSidebarChapters();