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

    if (typeof applyLocale === 'function') {
        applyLocale();
    }
}
initReviews();

document.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('review-topictext')) {
        e.target.closest('.reviewTopic-big, .reviewTopic-smaller, .reviewTopic-small, .reviewTopic-mapa')
            ?.classList.add('focused');
    }
});
document.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('review-topictext')) {
        e.target.closest('.reviewTopic-big, .reviewTopic-smaller, .reviewTopic-small, .reviewTopic-mapa')
            ?.classList.remove('focused');
    }
});