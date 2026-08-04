const MOBILE_QUERY = '(max-width: 720px)';

function readGeometry(storageKey) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!value || typeof value !== 'object') return null;
    const fields = ['x', 'y', 'width', 'height'];
    return fields.every((field) => Number.isFinite(Number(value[field]))) ? value : null;
  } catch {
    return null;
  }
}

function readLauncherPosition(storageKey) {
  try {
    const value = JSON.parse(localStorage.getItem(`${storageKey}.launcher`) || 'null');
    return value && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))
      ? { x: Number(value.x), y: Number(value.y) }
      : null;
  } catch {
    return null;
  }
}

function isEditableTarget(target) {
  return Boolean(target?.closest?.('button, a, input, textarea, select, [contenteditable="true"], [data-floating-agent-no-drag]'));
}

/**
 * Turns an existing chat surface into a non-modal, movable floating window.
 * Chat rendering and transport remain owned by each page module.
 */
export function initFloatingAgent({
  launcher,
  panel,
  closeButton,
  minimizeButton,
  maximizeButton,
  dragHandle,
  resizeHandle,
  storageKey,
  initialWidth = 560,
  initialHeight = 680,
  focusTarget
}) {
  if (!launcher || !panel) return null;

  const mobileMedia = window.matchMedia(MOBILE_QUERY);
  const margin = 16;
  const minimumWidth = 360;
  const minimumHeight = 480;
  let closeTimer = 0;
  let lastFocused = null;
  let geometry = readGeometry(storageKey);
  let launcherPosition = readLauncherPosition(storageKey);
  let restoreGeometry = null;
  let maximized = Boolean(geometry?.maximized);
  let suppressLauncherClick = false;

  launcher.setAttribute('aria-controls', panel.id);
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-haspopup', 'dialog');
  panel.setAttribute('aria-hidden', 'true');

  function clampLauncherPosition(position) {
    const rect = launcher.getBoundingClientRect();
    const width = rect.width || 58;
    const height = rect.height || 58;
    const edge = 12;
    return {
      x: Math.max(edge, Math.min(Number(position.x) || edge, window.innerWidth - width - edge)),
      y: Math.max(edge, Math.min(Number(position.y) || edge, window.innerHeight - height - edge))
    };
  }

  function renderLauncherPosition() {
    if (!launcherPosition) return;
    launcherPosition = clampLauncherPosition(launcherPosition);
    launcher.style.left = `${launcherPosition.x}px`;
    launcher.style.top = `${launcherPosition.y}px`;
    launcher.style.right = 'auto';
    launcher.style.bottom = 'auto';
  }

  function saveLauncherPosition() {
    if (!launcherPosition) return;
    try {
      localStorage.setItem(`${storageKey}.launcher`, JSON.stringify(launcherPosition));
    } catch {
      // The launcher remains movable when browser storage is unavailable.
    }
  }

  function startLauncherDrag(event) {
    if (event.button !== 0 || launcher.getAttribute('aria-expanded') === 'true') return;
    const rect = launcher.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { x: rect.left, y: rect.top };
    let moved = false;

    launcher.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      moved = true;
      event.preventDefault();
      launcher.classList.add('is-dragging');
      launcherPosition = clampLauncherPosition({ x: origin.x + dx, y: origin.y + dy });
      renderLauncherPosition();
    };
    const end = () => {
      launcher.classList.remove('is-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (moved) {
        suppressLauncherClick = true;
        saveLauncherPosition();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', end, { once: true });
  }

  function keyboardMoveLauncher(event) {
    if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const rect = launcher.getBoundingClientRect();
    const step = event.shiftKey ? 40 : 12;
    const delta = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step]
    }[event.key];
    launcherPosition = clampLauncherPosition({ x: rect.left + delta[0], y: rect.top + delta[1] });
    renderLauncherPosition();
    saveLauncherPosition();
  }

  function bounds() {
    const maxWidth = Math.max(280, window.innerWidth - margin * 2);
    const maxHeight = Math.max(360, window.innerHeight - margin * 2);
    return {
      minWidth: Math.min(minimumWidth, maxWidth),
      minHeight: Math.min(minimumHeight, maxHeight),
      maxWidth,
      maxHeight
    };
  }

  function defaultGeometry() {
    const limits = bounds();
    const width = Math.min(initialWidth, limits.maxWidth);
    const height = Math.min(initialHeight, limits.maxHeight);
    return {
      width,
      height,
      x: Math.max(margin, window.innerWidth - width - 24),
      y: Math.max(margin, window.innerHeight - height - 24)
    };
  }

  function clampGeometry(next) {
    const limits = bounds();
    const width = Math.max(limits.minWidth, Math.min(Number(next.width) || initialWidth, limits.maxWidth));
    const height = Math.max(limits.minHeight, Math.min(Number(next.height) || initialHeight, limits.maxHeight));
    return {
      width,
      height,
      x: Math.max(margin, Math.min(Number(next.x) || margin, window.innerWidth - width - margin)),
      y: Math.max(margin, Math.min(Number(next.y) || margin, window.innerHeight - height - margin))
    };
  }

  function saveGeometry() {
    if (mobileMedia.matches || !geometry) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...geometry, maximized }));
    } catch {
      // Storage can be unavailable in privacy modes; the window remains usable.
    }
  }

  function renderGeometry() {
    if (mobileMedia.matches) {
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.style.removeProperty('width');
      panel.style.removeProperty('height');
      return;
    }

    if (maximized) {
      geometry = {
        x: margin,
        y: margin,
        width: window.innerWidth - margin * 2,
        height: window.innerHeight - margin * 2
      };
    } else {
      geometry = clampGeometry(geometry || defaultGeometry());
    }
    panel.style.left = `${geometry.x}px`;
    panel.style.top = `${geometry.y}px`;
    panel.style.width = `${geometry.width}px`;
    panel.style.height = `${geometry.height}px`;
    panel.classList.toggle('is-maximized', maximized);
    maximizeButton?.setAttribute('aria-label', maximized ? '에이전트 창 이전 크기로 복원' : '에이전트 창 최대화');
    maximizeButton?.setAttribute('title', maximized ? '이전 크기로 복원' : '최대화');
  }

  function setMinimized(value) {
    if (mobileMedia.matches && value) {
      close();
      return;
    }
    panel.classList.toggle('is-minimized', value);
    minimizeButton?.setAttribute('aria-label', value ? '에이전트 창 펼치기' : '에이전트 창 최소화');
    minimizeButton?.setAttribute('title', value ? '펼치기' : '최소화');
    minimizeButton?.setAttribute('aria-pressed', String(value));
    if (value) minimizeButton?.focus();
  }

  function open() {
    window.clearTimeout(closeTimer);
    lastFocused = document.activeElement;
    panel.hidden = false;
    setMinimized(false);
    renderGeometry();
    requestAnimationFrame(() => {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      launcher.setAttribute('aria-expanded', 'true');
      window.setTimeout(() => focusTarget?.focus?.(), 40);
    });
  }

  function close() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    launcher.setAttribute('aria-expanded', 'false');
    closeTimer = window.setTimeout(() => {
      panel.hidden = true;
    }, 180);
    const returnTarget = lastFocused?.isConnected ? lastFocused : launcher;
    window.setTimeout(() => returnTarget?.focus?.(), 0);
  }

  function toggle() {
    if (panel.hidden || !panel.classList.contains('open')) open();
    else if (panel.classList.contains('is-minimized')) setMinimized(false);
    else close();
  }

  function toggleMaximized() {
    if (mobileMedia.matches) return;
    if (!maximized) {
      restoreGeometry = { ...(geometry || defaultGeometry()) };
      maximized = true;
    } else {
      maximized = false;
      geometry = restoreGeometry || defaultGeometry();
      restoreGeometry = null;
    }
    renderGeometry();
    saveGeometry();
  }

  function startPointerGesture(event, mode) {
    if (mobileMedia.matches || event.button !== 0 || maximized) return;
    if (mode === 'drag' && isEditableTarget(event.target)) return;
    event.preventDefault();
    const start = clampGeometry(geometry || defaultGeometry());
    const startX = event.clientX;
    const startY = event.clientY;
    panel.classList.add(mode === 'drag' ? 'is-dragging' : 'is-resizing');
    event.currentTarget?.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      geometry = mode === 'drag'
        ? clampGeometry({ ...start, x: start.x + dx, y: start.y + dy })
        : clampGeometry({ ...start, width: start.width + dx, height: start.height + dy });
      renderGeometry();
    };
    const end = () => {
      panel.classList.remove('is-dragging', 'is-resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      saveGeometry();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', end, { once: true });
  }

  function keyboardMove(event) {
    if (mobileMedia.matches || maximized || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    if (!event.altKey) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 12;
    const current = geometry || defaultGeometry();
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    }[event.key];
    geometry = clampGeometry({ ...current, x: current.x + delta[0], y: current.y + delta[1] });
    renderGeometry();
    saveGeometry();
  }

  function keyboardResize(event) {
    if (mobileMedia.matches || maximized || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 12;
    const current = geometry || defaultGeometry();
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    }[event.key];
    geometry = clampGeometry({ ...current, width: current.width + delta[0], height: current.height + delta[1] });
    renderGeometry();
    saveGeometry();
  }

  launcher.addEventListener('pointerdown', startLauncherDrag);
  launcher.addEventListener('keydown', keyboardMoveLauncher);
  launcher.addEventListener('click', (event) => {
    if (suppressLauncherClick) {
      suppressLauncherClick = false;
      event.preventDefault();
      return;
    }
    toggle();
  });
  closeButton?.addEventListener('click', close);
  minimizeButton?.addEventListener('click', () => setMinimized(!panel.classList.contains('is-minimized')));
  maximizeButton?.addEventListener('click', toggleMaximized);
  dragHandle?.addEventListener('pointerdown', (event) => startPointerGesture(event, 'drag'));
  dragHandle?.addEventListener('keydown', keyboardMove);
  dragHandle?.addEventListener('dblclick', (event) => {
    if (!isEditableTarget(event.target)) toggleMaximized();
  });
  resizeHandle?.addEventListener('pointerdown', (event) => startPointerGesture(event, 'resize'));
  resizeHandle?.addEventListener('keydown', keyboardResize);

  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && panel.classList.contains('open')) close();
  });
  window.addEventListener('resize', () => {
    renderLauncherPosition();
    saveLauncherPosition();
    renderGeometry();
    if (!mobileMedia.matches) saveGeometry();
  });
  mobileMedia.addEventListener?.('change', () => {
    setMinimized(false);
    renderGeometry();
  });

  geometry = maximized ? defaultGeometry() : clampGeometry(geometry || defaultGeometry());
  renderLauncherPosition();
  renderGeometry();
  panel.hidden = true;

  return { open, close, toggle, toggleMaximized };
}
