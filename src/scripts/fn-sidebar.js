document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');

    function isMouseOverHeader(e) {
        const header = document.querySelector('header');
        if (!header) return false; // Se não houver header na página, ignora com segurança
        
        const rect = header.getBoundingClientRect();
        return (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        );
    }

    function syncInitialState(e) {
        const overHeader = isMouseOverHeader(e);
        document.documentElement?.classList.toggle('sidebar-expanded', overHeader);
        localStorage.setItem('sidebarExpanded', overHeader ? 'true' : 'false');
        document.removeEventListener('mousemove', syncInitialState);
    }
    document.addEventListener('mousemove', syncInitialState);

    header?.addEventListener('mouseenter', () => {
        document.documentElement?.classList.add('sidebar-expanded');
        localStorage.setItem('sidebarExpanded', 'true');
    });

    header?.addEventListener('mouseleave', () => {
        document.documentElement?.classList.remove('sidebar-expanded');
        localStorage.setItem('sidebarExpanded', 'false');
    });
});