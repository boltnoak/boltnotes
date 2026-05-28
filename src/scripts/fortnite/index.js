const track = document.querySelector('.chapter-section');
let offset = 0;

if (track) {
    const items = Array.from(track.children);
    
    track.innerHTML = '';
    items.forEach(item => track.appendChild(item));

    if (track.children.length < 10) {
        const currentItems = Array.from(track.children);
        currentItems.forEach(item => track.appendChild(item.cloneNode(true)));
    }
}

function getStepWidth() {
    const firstItem = track.firstElementChild;
    const gap = parseInt(getComputedStyle(track).gap) + 275 || 0;
    return firstItem.offsetWidth + gap;
}

if (track) {
    const initialStep = getStepWidth();
    offset = initialStep;
    track.style.transform = `translateX(${-offset}px)`;
}

track.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const step = getStepWidth();
    offset += e.deltaY;

    if (offset >= step) {
        track.appendChild(track.firstElementChild);
        offset -= step;
    } else if (offset <= -step) {
        track.prepend(track.lastElementChild);
        offset += step;
    }

    track.style.transform = `translateX(${-offset}px)`;
}, { passive: false });


const chapters = document.querySelectorAll('#chapter');

chapters.forEach((capituloAtual) => {
    const titleElement = capituloAtual.querySelector('.title');

    if (titleElement) {
        const nomeCapitulo = titleElement.textContent.trim();
        const numeroOuNome = nomeCapitulo.toLowerCase().replace(/[^a-z0-9]/g, ''); 
        const nomeArquivo = numeroOuNome.replace('captulo', 'chapter');
        const linkDestino = `${pageBase}/pages/fortnite/${nomeArquivo}.html`;
        
        const imagemCapitulo = capituloAtual.querySelector('.chapter-image');
        if (imagemCapitulo) {
            imagemCapitulo.src = `assets://fortnite/chapters/${nomeArquivo}.jpg`;
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