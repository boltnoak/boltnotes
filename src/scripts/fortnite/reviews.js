let reviews = window.reviews || {};
window.reviews = reviews;

function openReview(code) {
    const popup = document.getElementById("review-popup");
    const content = document.getElementById("review");
    
    const data = reviews[code] || {};

    content.innerHTML = `
    <div class="review-content">
        <div class="reviews">
            <div class="review-section">
                    <p class="review-topic">LOOT POOL</p>
                    <p id="edit-loot" class="review-topictext" contenteditable="true" 
                       oninput="autoSave('${code}')">${data.loot || ""}</p>
                    <hr class="sep-bar-review">
                    
                    <p class="review-topic">MAPA</p>
                    <p id="edit-mapa" class="review-topictext" contenteditable="true" 
                       oninput="autoSave('${code}')">${data.mapa || ""}</p>
                    <hr class="sep-bar-review">
                    
                    <p class="review-topic">PASSE DE BATALHA</p>
                    <p id="edit-passe" class="review-topictext" contenteditable="true" 
                       oninput="autoSave('${code}')">${data.passe || ""}</p>
                    <hr class="sep-bar-review">
                    <p class="review-topic">HISTÓRIA</p>
                    <p id="edit-story" class="review-topictext" contenteditable="true" 
                    oninput="autoSave('${code}')">${data.story || ""}</p>
            </div>
            <div>
                <img id="map" src="assets/fortnite/maps/${code}.jpg">
            </div>
        </div>
    </div>`;
}

function closeReview() {
    document.getElementById("review-popup").style.display = "none";
    document.documentElement.style.overflow = "auto";
}

let saveTimeout = null;

function initReviews() {
    const seasons = document.querySelectorAll('.fn-season');

    seasons.forEach(season => {
        const code = season.getAttribute('data-code');
        const content = season.querySelector(".review-section");
        const data = reviews[code] || {};

        if (!content || content.innerHTML.trim() !== "") return;

        content.innerHTML = `
            <div class="reviews">
                <p class="review-topic">LOOT POOL</p>
                <p id="${code}-loot" class="review-topictext" contenteditable="true" oninput="debouncedSave('${code}')">${data.loot || ""}</p>
                
                <p class="review-topic">MAPA</p>
                <p id="${code}-mapa" class="review-topictext" contenteditable="true" oninput="debouncedSave('${code}')">${data.mapa || ""}</p>
                
                <p class="review-topic">PASSE DE BATALHA</p>
                <p id="${code}-passe" class="review-topictext" contenteditable="true" oninput="debouncedSave('${code}')">${data.passe || ""}</p>
                
                <p class="review-topic">HISTÓRIA</p>
                <p id="${code}-story" class="review-topictext" contenteditable="true" oninput="debouncedSave('${code}')">${data.story || ""}</p>
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
    }, 1000);
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