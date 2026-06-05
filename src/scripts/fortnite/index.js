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