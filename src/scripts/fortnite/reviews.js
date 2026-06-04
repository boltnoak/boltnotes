let reviews = window.reviews || {};
window.reviews = reviews;

let saveTimeout = null;

function initReviews() {
    const seasons = document.querySelectorAll('.fn-season');

    seasons.forEach(season => {
        const code = season.getAttribute('data-code');
        const content = season.querySelector(".review-section");
        const data = reviews[code] || {};

        if (!content || content.innerHTML.trim() !== "") return;

        const isSeasonLocked = data.locked ?? (season.querySelector('.season')?.dataset.locked === "true");

        const editableAttr = isSeasonLocked ? 'contenteditable="false"' : 'contenteditable="true"';

        content.innerHTML = `
            <div class="reviews">
                <p class="review-topic">LOOT POOL</p>
                <p id="${code}-loot" placeholder="Vazio" class="review-topictext" ${editableAttr} oninput="debouncedSave('${code}')">${data.loot || ""}</p>
                <!--<p class="sep-bar-season"></p>-->
                <p class="review-topic">MAPA</p>
                <p id="${code}-mapa" placeholder="Vazio" class="review-topictext" ${editableAttr} oninput="debouncedSave('${code}')">${data.mapa || ""}</p>
                <!--<p class="sep-bar-season"></p>-->
                <p class="review-topic">PASSE DE BATALHA</p>
                <p id="${code}-passe" placeholder="Vazio" class="review-topictext" ${editableAttr} oninput="debouncedSave('${code}')">${data.passe || ""}</p>
                <!--<p class="sep-bar-season"></p>-->
                <p class="review-topic">HISTÓRIA</p>
                <p id="${code}-story" placeholder="Vazio" class="review-topictext" ${editableAttr} oninput="debouncedSave('${code}')">${data.story || ""}</p>
            </div>`;
    });
}

function debouncedSave(code) {
    clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(() => {
        const rating = document.getElementById(`${code}-rating`)?.textContent || "0";
        const levels = document.getElementById(`${code}-levels`)?.textContent || "0";
        const wins = document.getElementById(`${code}-wins`)?.textContent || "0";

        const loot = document.getElementById(`${code}-loot`)?.innerText || "";
        const mapa = document.getElementById(`${code}-mapa`)?.innerText || "";
        const passe = document.getElementById(`${code}-passe`)?.innerText || "";
        const story = document.getElementById(`${code}-story`)?.innerText || "";

        reviews[code] = { 
            ...reviews[code], 
            rating, 
            levels, 
            wins,
            loot,
            mapa,
            passe,
            story
        };

        window.electronAPI.json.save(FILE, reviews);
        console.log(`Dados da temporada ${code} salvos com sucesso!`);
    }, 100);
}

async function autoSave(code) {
    const existing = reviews[code] || {};

    const levelsEl = document.getElementById(`${code}-levels`);
    const winsEl = document.getElementById(`${code}-wins`);
    const ratingEl = document.getElementById(`${code}-rating`);

    const lootEl = document.getElementById(`${code}-loot`);
    const mapaEl = document.getElementById(`${code}-mapa`);
    const passeEl = document.getElementById(`${code}-passe`);
    const storyEl = document.getElementById(`${code}-story`);

    reviews[code] = {
        ...existing,levels: levelsEl ? levelsEl.textContent.trim() : existing.levels,
        wins: winsEl ? winsEl.textContent.trim() : existing.wins,
        rating: ratingEl ? ratingEl.textContent.trim() : existing.rating,
       
        loot: lootEl ? lootEl.textContent.trim() : existing.loot,
        mapa: mapaEl ? mapaEl.textContent.trim() : existing.mapa,
        passe: passeEl ? passeEl.textContent.trim() : existing.passe,
        story: storyEl ? storyEl.textContent.trim() : existing.story
    };

    clearTimeout(saveTimeout);

    saveTimeout = setTimeout(async () => {
        try {
            await window.electronAPI.json.save(FILE, reviews);
        } catch (err) {
            console.error("Erro ao salvar:", err);
        }
    }, 500);
}

window.autoSave = autoSave;
initReviews();