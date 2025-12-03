/* KGB Finance — Drive helper: auto-pull + copy link (UI-onafhankelijk, via DOM) */
(function () {
  const LS_AUTO = 'kgb_drive_auto_pull';
  const SEL_ENHANCED = 'data-kgb-enhanced';
  const byText = (root, tag, txt) =>
    Array.from(root.querySelectorAll(tag)).find(b => (b.textContent || '').trim().toLowerCase() === txt.toLowerCase());

  function datasetFromPanel(panel) {
    // Lees welke dataset actief is; fallback naar 'full'
    try {
      const header = panel.querySelector('h3,h4,h2')?.textContent || '';
      if (/budget/i.test(header)) return 'budget';
      if (/full/i.test(header)) return 'full';
      // Zoeken naar dataset knoppen
      const btnBudget = byText(panel, 'button', 'Budget');
      const btnFull   = byText(panel, 'button', 'Full');
      if (btnBudget?.classList.contains('active')) return 'budget';
      if (btnFull?.classList.contains('active')) return 'full';
    } catch(_){}
    return 'full';
  }

  function userFromPanel(panel) {
    // Titel heeft vorm: "Google Drive — Kurt (full)" → pak "Kurt"
    const t = panel.querySelector('h3,h4,h2')?.textContent || '';
    const m = t.match(/Google Drive\s*—\s*([^(]+)\(/i);
    return (m ? m[1] : 'Kurt').trim();
  }

  function filename(dataset, user) {
    return `KGB-${dataset}-${user}.json`;
  }

  function buildSearchURL(name) {
    // Drive zoek-link (werkt zonder popups)
    // Zoekt bestand in mapnaam "KGB Finance 2025" of overal indien map niet bestaat
    // Let op: puur search-URL, geen fileId nodig.
    const q = encodeURIComponent(name);
    return `https://drive.google.com/drive/u/0/search?q=${q}`;
  }

  function enhance(panel) {
    if (!panel || panel.getAttribute(SEL_ENHANCED) === '1') return;
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.flexWrap = 'wrap';
    row.style.margin = '8px 0';

    // Auto-pull toggle
    const wrap = document.createElement('label');
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '6px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = localStorage.getItem(LS_AUTO) === '1';
    cb.addEventListener('change', () => localStorage.setItem(LS_AUTO, cb.checked ? '1' : '0'));
    const span = document.createElement('span');
    span.textContent = 'Auto-pull na inloggen';
    wrap.append(cb, span);

    // Kopieer link knop
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Kopieer Drive-link';
    copyBtn.style.padding = '6px 10px';
    copyBtn.style.border = '1px solid #e5e7eb';
    copyBtn.style.borderRadius = '8px';
    copyBtn.style.background = '#fff';
    copyBtn.addEventListener('click', async () => {
      const ds = datasetFromPanel(panel);
      const usr = userFromPanel(panel);
      const url = buildSearchURL(filename(ds, usr));
      try {
        await navigator.clipboard.writeText(url);
        toast(panel, '🔗 Link gekopieerd naar klembord');
      } catch {
        prompt('Kopieer de Drive-link:', url);
      }
    });

    row.append(wrap, copyBtn);
    // plaats net boven de knoppenrij met Export/Import (of helemaal onderaan)
    const bar = panel.querySelector('.buttons, .kgb-drive-buttons') || panel.lastElementChild;
    panel.insertBefore(row, bar?.nextSibling || null);

    // Auto-pull bij status=ingelogd
    const pullBtn = byText(panel, 'button', 'Drive Pull');
    observeLogin(panel, () => {
      if (localStorage.getItem(LS_AUTO) === '1' && pullBtn) {
        // kleine delay zodat token klaar is
        setTimeout(() => pullBtn.click(), 200);
      }
    });

    panel.setAttribute(SEL_ENHANCED, '1');
  }

  function observeLogin(panel, onLogin) {
    // Kijk naar tekst "Status: ingelogd" in het paneel
    const statusNode = Array.from(panel.querySelectorAll('*')).find(n => /status:/i.test(n.textContent || '')) || panel;
    const obs = new MutationObserver(() => {
      const txt = panel.textContent || '';
      if (/status:\s*ingelogd/i.test(txt)) {
        onLogin();
      }
    });
    obs.observe(statusNode, { childList: true, subtree: true, characterData: true });
    // init check
    if (/status:\s*ingelogd/i.test(panel.textContent || '')) onLogin();
  }

  function toast(panel, msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#111827;color:#fff;padding:8px 12px;border-radius:10px;z-index:99999;opacity:.98';
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 2000);
  }

  // Observeer DOM en enhance zodra het Drive-paneel verschijnt (knop "Drive Pull" bestaat dan)
  const rootObs = new MutationObserver(() => {
    const body = document.body;
    const hasDrivePanel = Array.from(body.querySelectorAll('div,section,article')).find(el => byText(el, 'button', 'Drive Pull'));
    if (hasDrivePanel) enhance(hasDrivePanel);
  });
  rootObs.observe(document.documentElement || document.body, { childList: true, subtree: true });
})();
