(() => {
  const deck = document.querySelector('#deck');
  const sections = [...deck.querySelectorAll(':scope > section')];
  const total = sections.length;
  const pageNumberEl = document.querySelector('#page-number');
  const progressFillEl = document.querySelector('#progress-fill');

  if (!total) return;

  const pad = (n) => String(n).padStart(2, '0');

  sections.forEach((s, idx) => {
    const firstHeading = s.querySelector('h1, h2, h3, h4, h5');
    if (firstHeading && firstHeading.tagName === 'H1') {
      s.classList.add('divider');
    }
    if (firstHeading) {
      const next = firstHeading.nextElementSibling;
      if (!next || next.tagName !== 'H6') {
        firstHeading.insertAdjacentElement('afterend', document.createElement('h6'));
      }
    }
    s.dataset.num = pad(idx + 1);
    s.dataset.total = pad(total);
  });

  const readHash = () => {
    const m = location.hash.match(/^#\/(\d+)$/);
    if (!m) return null;
    const n = parseInt(m[1], 10) - 1;
    return n >= 0 && n < total ? n : null;
  };

  let i = readHash() ?? 0;
  let suppressHashSync = false;

  const render = () => {
    sections.forEach((s, idx) => s.classList.toggle('active', idx === i));
    pageNumberEl.textContent = `${pad(i + 1)} / ${pad(total)}`;
    progressFillEl.style.width = ((i + 1) / total) * 100 + '%';
    const target = `#/${i + 1}`;
    if (location.hash !== target) {
      suppressHashSync = true;
      location.hash = target;
    }
  };

  const jump = (n) => {
    const next = Math.max(0, Math.min(total - 1, n));
    if (next === i) return;
    i = next;
    render();
  };

  const go = (delta) => jump(i + delta);

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, [contenteditable]')) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
        e.preventDefault(); go(+1); break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault(); go(-1); break;
      case ' ':
        e.preventDefault(); go(e.shiftKey ? -1 : +1); break;
      case 'Home':
        e.preventDefault(); jump(0); break;
      case 'End':
        e.preventDefault(); jump(total - 1); break;
      case 'o':
      case 'O':
        document.body.classList.toggle('overview'); break;
      case 'Escape':
        document.body.classList.remove('overview'); break;
    }
  });

  let startX = 0, startY = 0, tracking = false;
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    startX = e.clientX; startY = e.clientY; tracking = true;
  });
  window.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) < 50) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    go(dx < 0 ? +1 : -1);
  });

  window.addEventListener('hashchange', () => {
    if (suppressHashSync) { suppressHashSync = false; return; }
    const n = readHash();
    if (n !== null && n !== i) { i = n; render(); }
  });

  deck.addEventListener('click', (e) => {
    if (!document.body.classList.contains('overview')) return;
    const s = e.target.closest('section');
    if (!s) return;
    const idx = sections.indexOf(s);
    if (idx < 0) return;
    document.body.classList.remove('overview');
    jump(idx);
  });

  render();
})();
