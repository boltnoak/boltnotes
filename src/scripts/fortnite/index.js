async function getLatestSeason() {
    const seasons = await window.api.fortnite.getSeasons();
    const [key, value] = Object.entries(seasons)[0] || [];

    return key ? {key, data: value} : null;
}

async function loadBanner() {
        const latest = await getLatestSeason();
        if (!latest) return;

        console.log(`Temporada mais recente: ${latest.key.toUpperCase().replace('S','T')} — ${latest.data.name}`);
        document.getElementById("latestSeasonBG").style.backgroundImage = `url('assets://fortnite-${latest.key}-assets/${latest.key}.jpg')`;
}

async function loadChapters() {
    const data = await window.api.fortnite.getSeasons();
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