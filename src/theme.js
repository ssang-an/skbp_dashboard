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
    if (icon) icon.textContent = nextTheme === 'dark' ? '☀' : '◐';
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
