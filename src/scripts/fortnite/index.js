const chapters = document.querySelectorAll('#chapter');

async function renderizarCapitulos() {
    const fortniteData = await window.api.fortnite.getSeasons();

    if (!fortniteData) {
        console.error("Nenhum dado retornado.");
        return;
    }

    const listaCapitulos = [...new Set(
        Object.keys(fortniteData)
            .map(key => key.match(/^c\d+/i)?.[0].toLowerCase())
            .filter(Boolean)
    )];

    const section = document.querySelector('.chapter-section');
    if (!section) return;

    section.innerHTML = listaCapitulos.map((capitulo, index) => {
        const numero = capitulo.replace('c', '');
    
        const delay = index * 0.1;

        return `
            <a id="chapter" href="${pageBase}/pages/fortnite-chapter.html?num=${numero}">
                <div class="chapter-image-div">
                    <img class="chapter-image" src="assets://fn-chapter-covers/chapter${numero}-cover.jpg">
                </div>
                <p class="title"><span data-i18n="fn-chapter">Capítulo</span> ${numero}</p>
            </a>
        `;
    }).join('');

    applyLocale();
    adicionarEventosDeClique();
}
function adicionarEventosDeClique() {
    const botoes = document.querySelectorAll('.chapter-button');
    
    botoes.forEach(botao => {
        botao.addEventListener('click', (e) => {
            const capituloSelecionado = botao.dataset.capitulo;
            console.log(`Você clicou no capítulo: ${capituloSelecionado}`);
        });
    });
}
renderizarCapitulos();

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
            imagemCapitulo.src = `assets://fn-chapter-covers/${nomeArquivo}-cover.jpg`;
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

        const latestPath = `assets://fortnite-${latest.key}-assets/${latest.key}.jpg`;

        console.log(`Temporada mais recente do Fortnite: ${latest.key.toUpperCase().replace('S','T')} — ${latest.data.name}`);

        const banner = document.getElementById("latestSeasonBG");
        if (banner && latestPath) { banner.style.backgroundImage = `url('${latestPath}')`}

    } catch (err) {
        console.error("Erro ao inicializar:", err);
    }
}

loadLatestFN();