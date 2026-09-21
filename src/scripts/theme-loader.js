async function getTheme(themeName) {
  const name = String(themeName ?? '').replace(/[\\/]/g, '').trim();
  if (!name) return null;

  try {
    const res = await fetch(`${THEMES_URL}/${encodeURIComponent(name)}.boltss`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
async function listThemes() {
  let files;
  try {
    const res = await fetch(`${THEMES_URL}/`);
    if (!res.ok) return [];
    files = await res.json();
  } catch {
    return [];
  }

  const themeFiles = files.filter((f) => f.endsWith('.boltss'));

  return Promise.all(
    themeFiles.map(async (file) => {
      const name = file.replace(/\.boltss$/, '');
      try {
        const res = await fetch(`${THEMES_URL}/${encodeURIComponent(file)}`);
        if (!res.ok) throw new Error();
        const content = await res.text();
        const bgMatch = content.match(/--bg\s*:\s*([^;}\n]+)/);
        return { name, bg: bgMatch ? bgMatch[1].trim() : '#050505' };
      } catch {
        return { name, bg: '#000000' };
      }
    })
  );
}

async function applyTheme() {
    let styleTag = document.getElementById('theme-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'theme-style';
        document.head.appendChild(styleTag);
    }

    const cachedCss = localStorage.getItem('cached-theme-css');
    if (cachedCss) {
        styleTag.textContent = cachedCss;
    }

    try {
        const config = await window.electronAPI.config.getConfig();
        const currentTheme = config.theme;
        const cachedThemeName = localStorage.getItem('cached-theme-name');

        if (currentTheme !== cachedThemeName || !cachedCss) {
            const css = await getTheme(currentTheme);
            if (css) {
                styleTag.textContent = css;
                localStorage.setItem('cached-theme-css', css);
                localStorage.setItem('cached-theme-name', currentTheme);
            }
        }
    } catch (error) {
        console.error("Erro ao carregar o tema:", error);
    }
}

applyTheme();