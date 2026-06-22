window.reviews = window.reviews || {};
window.stats = window.stats || {};

let saveTimeout = null;
let reviewsTemplateText = null;

async function getReviewsTemplate() {
    if (!reviewsTemplateText) {
        const res = await fetch('components/fortnite/reviews.bolt');
        reviewsTemplateText = await res.text();
    }
    return reviewsTemplateText;
}

function renderReviewsTemplate(templateText, vars) {
    const fn = new Function(...Object.keys(vars), `return \`${templateText}\`;`);
    return fn(...Object.values(vars));
}

async function initReviews() {
    const seasons = document.querySelectorAll('.fn-season');
    const reviewsHTML = await getReviewsTemplate();

    seasons.forEach(season => {
        const code = season.getAttribute('data-code');
        const content = season.querySelector(".review-section");
        const data = window.reviews[code] || {};

        if (!content || content.innerHTML.trim() !== "") return;

        const isSeasonLocked = data.locked ?? (season.querySelector('.season')?.dataset.locked === "true");
        const editableAttr = isSeasonLocked ? 'contenteditable="false"' : 'contenteditable="true"';

        content.innerHTML = renderReviewsTemplate(reviewsHTML, { code, data, editableAttr });
    });
}

function debouncedSave(code) {
    clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
        const rating = document.getElementById(`${code}-rating`)?.textContent || "0";
        const levels = document.getElementById(`${code}-levels`)?.textContent || "0";
        const wins = document.getElementById(`${code}-wins`)?.textContent || "0";

        const gameplay = document.getElementById(`${code}-gameplay`)?.innerText || "";
        const loot = document.getElementById(`${code}-loot`)?.innerText || "";
        const mapa = document.getElementById(`${code}-mapa`)?.innerText || "";
        const passe = document.getElementById(`${code}-passe`)?.innerText || "";
        const story = document.getElementById(`${code}-story`)?.innerText || "";

        window.reviews[code] = { 
            ...window.reviews[code], 
            gameplay,
            loot,
            mapa,
            passe,
            story
        };

        window.stats[code] = {
            ...window.stats[code],
            rating, 
            levels, 
            wins
        };

        try {
            await window.electronAPI.json.save(FILE, window.reviews);
            await window.electronAPI.json.save(FILE_STATS, window.stats);
            
            console.log(`Fortnite - Dados da temporada ${code.toUpperCase().replace('S', 'T')} salvos com sucesso!`);
        } catch (err) {
            console.error(`[BoltNotes] Erro ao salvar dados da temporada ${code}:`, err);
        }
    }, 200);
}

async function autoSave(code) {
    const existing = reviews[code] || {};

    const levelsEl = document.getElementById(`${code}-levels`);
    const winsEl = document.getElementById(`${code}-wins`);
    const ratingEl = document.getElementById(`${code}-rating`);

    const gameplayEl = document.getElementById(`${code}-gameplay`);
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