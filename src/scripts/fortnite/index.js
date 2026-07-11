const chapters = document.querySelectorAll('#chapter');

chapters.forEach((capituloAtual) => {
    const titleElement = capituloAtual.querySelector('.title');

    if (titleElement) {
        const nomeCapitulo = titleElement.textContent.trim();
        const numeroOuNome = nomeCapitulo.toLowerCase().replace(/[^a-z0-9]/g, ''); 
        const nomeArquivo = numeroOuNome.replace('captulo', 'chapter');
        const nome = numeroOuNome.replace('captulo', '');
        const linkDestino = `${pageBase}/pages/fortnite-chapter.html?num=${nome}`;
        
        const imagemCapitulo = capituloAtual.querySelector('.chapter-image');
        if (imagemCapitulo) {
            imagemCapitulo.src = `assets://${nomeArquivo}-cover.jpg`;
        }

        capituloAtual.addEventListener('click', () => {
            window.location.href = linkDestino;
        });
        
        const linkDestinoLog = linkDestino
            .replace(/.*(BoltNotes=?)\//,'')
            .replace(/\//g, ' > ');

        console.log(`Fortnite - Link do ${nomeCapitulo}: ${linkDestinoLog}`);
    }
});

function getLatestSeason(data) {
    const parsed = Object.entries(data)
        .map(([key, value]) => {

            const match = key.match(
                /^c(\d+)(ms|s|og|remix)?(\d+)?$/i
            );

            if (!match) return null;

            return {
                key,
                data: value,
                chapter: Number(match[1]),
                type: match[2] || '',
                season: Number(match[3] || 0)
            };
        })
        .filter(Boolean);

    parsed.sort((a, b) => {

        if (a.chapter !== b.chapter) {
            return b.chapter - a.chapter;
        }

        return b.season - a.season;
    });

    return parsed[0] || null;
}

async function loadLatestFN() {
    try {
        const assetDir = await window.api.load('assets://');
        const seasons = await window.api.fortnite.getSeasons();

        const latest = getLatestSeason(seasons);

        if (!latest) return;

        const latestPathLobby = `assets://${latest.key}-lobby.jpg`;
        const latestPath = `assets://${latest.key}.jpg`;

        console.log(`Temporada mais recente do Fortnite: ${latest.key.toUpperCase().replace('S','T')} — ${latest.data.name}`);

        const banner = document.getElementById("latestSeasonBG");
        if (banner && latestPath) { banner.style.backgroundImage = `url('${latestPath}')`}

    } catch (err) {
        console.error("Erro ao inicializar:", err);
    }
}

loadLatestFN();