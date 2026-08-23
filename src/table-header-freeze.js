/*
 * Viewport-level table headers for the dashboard's horizontally scrollable
 * Pipeline Tables. Native `position: sticky` cannot escape `.table-wrap`
 * because that wrapper owns horizontal scrolling, so this mirrors only the
 * header while the original header is above the sticky site navigation.
 */
function dashboardStickyTop() {
  const header = document.querySelector('.app-shell > .topbar');
  return Math.max(0, Math.round(header?.getBoundingClientRect().bottom || 0));
}

function copyTableHeader(table) {
  const clone = table.cloneNode(false);
  clone.classList.add('pipeline-frozen-header-table');
  clone.removeAttribute('id');
  const colgroup = table.querySelector(':scope > colgroup');
  if (colgroup) clone.append(colgroup.cloneNode(true));
  if (table.tHead) clone.append(table.tHead.cloneNode(true));
  clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  clone.querySelectorAll('input, select, textarea').forEach((node) => {
    node.disabled = true;
    node.setAttribute('tabindex', '-1');
  });
  return clone;
}

function activeBodyRows(table) {
  return [...table.tBodies].flatMap((body) => [...body.rows])
    .filter((row) => !row.querySelector('.step0-empty-state, .empty-state'));
}

function createFrozenHeader(table) {
  const wrap = table.closest('.table-wrap');
  if (!wrap || !table.tHead) return null;
  const layer = document.createElement('div');
  layer.className = 'pipeline-frozen-header';
  layer.hidden = true;
  document.body.append(layer);

  let scheduled = false;
  const refreshHeader = () => {
    layer.replaceChildren(copyTableHeader(table));
    scheduleSync();
  };
  const sync = () => {
    scheduled = false;
    const top = dashboardStickyTop();
    const tableRect = table.getBoundingClientRect();
    const headRect = table.tHead.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const rows = activeBodyRows(table);
    const visibleRows = rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > top + 4;
    });
    // The final lone row is easier to read without a large duplicated header;
    // the original header remains immediately above it if the user needs it.
    const shouldShow = headRect.bottom <= top && tableRect.bottom > top + 34 && visibleRows.length >= 2 && wrapRect.right > 0 && wrapRect.left < window.innerWidth;
    if (!shouldShow) {
      layer.hidden = true;
      return;
    }
    const clone = layer.firstElementChild;
    if (!clone) return;
    layer.hidden = false;
    layer.style.top = `${top}px`;
    layer.style.left = `${Math.round(wrapRect.left)}px`;
    layer.style.width = `${Math.round(wrap.clientWidth)}px`;
    clone.style.width = `${Math.round(table.getBoundingClientRect().width)}px`;
    clone.style.transform = `translateX(${-wrap.scrollLeft}px)`;
  };
  const scheduleSync = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  };
  const mutationObserver = new MutationObserver(refreshHeader);
  mutationObserver.observe(table.tHead, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  const bodyObserver = new MutationObserver(scheduleSync);
  [...table.tBodies].forEach((body) => bodyObserver.observe(body, { childList: true, subtree: true }));
  const resizeObserver = new ResizeObserver(scheduleSync);
  resizeObserver.observe(table);
  resizeObserver.observe(wrap);
  wrap.addEventListener('scroll', scheduleSync, { passive: true });
  window.addEventListener('scroll', scheduleSync, { passive: true });
  window.addEventListener('resize', scheduleSync, { passive: true });
  refreshHeader();
  return { refreshHeader, scheduleSync, destroy: () => { mutationObserver.disconnect(); bodyObserver.disconnect(); resizeObserver.disconnect(); layer.remove(); } };
}

export function initPipelineHeaderFreeze() {
  const controllers = [...document.querySelectorAll('.pipeline-table')]
    .map(createFrozenHeader)
    .filter(Boolean);
  return {
    refresh: () => controllers.forEach((controller) => controller.refreshHeader()),
    sync: () => controllers.forEach((controller) => controller.scheduleSync()),
  };
}
