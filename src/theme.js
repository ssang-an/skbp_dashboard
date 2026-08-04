const THEME_STORAGE_KEY = 'skbp.ui.theme';

function preferredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    const label = button.querySelector('[data-theme-label]');
    const icon = button.querySelector('[data-theme-icon]');
    button.setAttribute('aria-pressed', String(nextTheme === 'dark'));
    button.setAttribute('aria-label', nextTheme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
    if (label) label.textContent = nextTheme === 'dark' ? 'Light' : 'Dark';
    if (icon) {
      icon.innerHTML = nextTheme === 'dark'
        ? '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"></path></svg>'
        : '<svg viewBox="0 0 24 24" focusable="false"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"></path></svg>';
    }
  });
}

export function setupThemeToggle() {
  applyTheme(document.documentElement.dataset.theme || preferredTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  });
}
