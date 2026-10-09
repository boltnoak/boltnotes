const btn = document.getElementById('linux-btn');
const options = document.getElementById('linux-options');
const arrow = document.getElementById('linux-btn-arrow');

btn.addEventListener('click', () => {
    const isHidden = getComputedStyle(options).display === 'none';
    options.style.display = isHidden ? 'flex' : 'none';
    arrow.classList.toggle('fa-angle-down', !isHidden);
    arrow.classList.toggle('fa-angle-up', isHidden);
});