function scrollPageTo(position) {
  window.scrollTo({ top: position, behavior: 'smooth' });
}

export function initPageJumpControls() {
  if (document.querySelector('.page-jump-controls')) return;

  const controls = document.createElement('nav');
  controls.className = 'page-jump-controls';
  controls.setAttribute('aria-label', '페이지 빠른 이동');
  controls.innerHTML = `
    <div class="page-jump-orb" aria-label="페이지 빠른 이동">
      <button type="button" class="page-jump-button page-jump-top" aria-label="페이지 맨 위로 이동" title="맨 위로 이동" data-tooltip="맨 위로 이동">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 14 6-6 6 6" /></svg>
      </button>
      <button type="button" class="page-jump-button page-jump-bottom" aria-label="페이지 맨 아래로 이동" title="맨 아래로 이동" data-tooltip="맨 아래로 이동">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 10 6 6 6-6" /></svg>
      </button>
    </div>
  `;
  document.body.append(controls);

  // The AI agent launcher isn't removed from the DOM when a tab hides it
  // (e.g. Tab 1 Fast Triage on the main dashboard) — it just toggles
  // `hidden`. Watch that instead of checking presence once at load, so the
  // orb drops into the launcher's own spot on any tab/page that currently
  // has no visible bot, and rises back above it as soon as one reappears.
  const syncSoloPosition = () => {
    const launcher = document.querySelector('.floating-agent-launcher');
    const botVisible = Boolean(launcher) && !launcher.hidden && getComputedStyle(launcher).display !== 'none';
    controls.classList.toggle('page-jump-controls-solo', !botVisible);
  };
  syncSoloPosition();
  const launcher = document.querySelector('.floating-agent-launcher');
  if (launcher) {
    new MutationObserver(syncSoloPosition).observe(launcher, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
  }

  const topButton = controls.querySelector('.page-jump-top');
  const bottomButton = controls.querySelector('.page-jump-bottom');
  const updateVisibility = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const threshold = Math.min(240, Math.max(80, maxScroll * 0.08));
    controls.hidden = maxScroll < 180;
    topButton.classList.toggle('is-unavailable', scrollTop <= threshold);
    bottomButton.classList.toggle('is-unavailable', maxScroll - scrollTop <= threshold);
  };

  topButton.addEventListener('click', () => scrollPageTo(0));
  bottomButton.addEventListener('click', () => scrollPageTo(document.documentElement.scrollHeight));
  window.addEventListener('scroll', updateVisibility, { passive: true });
  window.addEventListener('resize', updateVisibility, { passive: true });
  window.requestAnimationFrame(updateVisibility);
}
