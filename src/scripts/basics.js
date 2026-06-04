let BasePath;

let notes;
let games;
let fortnite;

const basePagePathLog = document.querySelector('base').href
    .replace(/.*(?=BoltNotes\/)/, 'Documentos/')
    .replace(/\/$/, '')
    .replace('file://', '');

console.log(`Base da página: ${basePagePathLog}`);

const appStorage = {
    load: async (filePath) => {
        try {
            const fileHandle = await getFileHandle(filePath, { create: false });
            const file = await fileHandle.getFile();
            const content = await file.text();
            return JSON.parse(content);
        } catch (error) {
            return {};
        }
    },
    
    save: async ({ filePath, data }) => {
        try {
            const fileHandle = await getFileHandle(filePath, { create: true });
            const writable = await fileHandle.createWritable();
            
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
            return true;
        } catch (error) {
            console.error("Erro ao salvar o arquivo:", error);
            return false;
        }
    }
};

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

        const latest =
            getLatestSeason(seasons);

        if (!latest) return;

        const latestPath = `assets://${latest.key}.jpg`;

        console.log(latest.key);
        console.log(latest.data.name);

        const img = document.getElementById("latest-season");
        const banner = document.getElementById("latestSeasonBG");
        if (img && latestPath) {
            img.src = latestPath;
        } else if (banner && latestPath) { banner.style.backgroundImage = `url('${latestPath}')`}

    } catch (err) {
        console.error("Erro ao inicializar:", err);
    }
}

loadLatestFN();