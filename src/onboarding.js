const onboardingConfig = window.PRISM_ONBOARDING_CONFIG || {};
export const CURRENT_ONBOARDING_VERSION = String(onboardingConfig.version || '2');
export const ONBOARDING_VERSION_STORAGE_KEY = String(onboardingConfig.storageKey || 'prism_onboarding_version_seen');

export function hasSeenCurrentOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_VERSION_STORAGE_KEY) === CURRENT_ONBOARDING_VERSION;
  } catch (_) {
    return false;
  }
}

export function shouldAutoShowOnboarding() {
  return !hasSeenCurrentOnboarding();
}

export function markOnboardingCompleted() {
  try {
    localStorage.setItem(ONBOARDING_VERSION_STORAGE_KEY, CURRENT_ONBOARDING_VERSION);
  } catch (_) {
    // A blocked localStorage should never prevent access to the Dashboard.
  }
}

window.PRISMOnboarding = {
  CURRENT_ONBOARDING_VERSION,
  hasSeenCurrentOnboarding,
  shouldAutoShowOnboarding,
  markOnboardingCompleted,
};

function makeDots(container, count, className, spreadX, spreadY) {
  if (!container) return;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    const dot = document.createElement('i');
    dot.className = className;
    const ratio = index / Math.max(1, count - 1);
    const x = Math.min(100, Math.max(0, (ratio * spreadX) + (Math.sin(index * 2.1) * 13) + 8));
    const y = Math.min(100, Math.max(0, 50 + (Math.cos(index * 1.7) * spreadY * (0.35 + ((index % 5) / 10)))));
    dot.style.setProperty('--x', `${x}%`);
    dot.style.setProperty('--y', `${y}%`);
    dot.style.setProperty('--size', `${3 + (index % 4)}px`);
    dot.style.setProperty('--delay', `${(index % 12) * 55}ms`);
    fragment.append(dot);
  }
  container.append(fragment);
}

makeDots(document.querySelector('[data-noise-web]'), 58, 'noise-dot', 102, 80);
makeDots(document.querySelector('[data-pipeline-dots]'), 86, 'pipeline-dot', 100, 72);

const screens = [...document.querySelectorAll('[data-onboarding-screen]')];
const pageDots = [...document.querySelectorAll('.page-dots a')];
const setActivePage = (screenNumber) => {
  pageDots.forEach((dot, index) => dot.classList.toggle('is-active', index + 1 === Number(screenNumber)));
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) setActivePage(entry.target.dataset.onboardingScreen);
  });
}, { threshold: 0.58 });
screens.forEach((screen) => observer.observe(screen));
setActivePage(1);

function exitOnboarding() {
  markOnboardingCompleted();
  window.location.assign('/');
}

document.querySelectorAll('[data-onboarding-exit]').forEach((button) => button.addEventListener('click', exitOnboarding));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') exitOnboarding();
});
