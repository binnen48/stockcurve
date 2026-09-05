const DATA_BASE = `${import.meta.env.BASE_URL}data`;

const state = {
  launches: [],
  meta: null,
  safe: null,
  filter: 'all',
  q: '',
  sort: 'newest',
  loading: true,
  error: null,
};

const $ = (sel, el = document) => el.querySelector(sel);

function fmtUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.0001) return `$${v.toFixed(6)}`;
  return `$${v.toExponential(2)}`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function relative(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function filtered() {
  let rows = state.launches.slice();
  if (state.filter !== 'all') {
    rows = rows.filter((x) => x.quoteClass === state.filter);
  }
  const q = state.q.trim().toLowerCase();
  if (q) {
    rows = rows.filter((x) => {
      const hay = `${x.name} ${x.symbol} ${x.token} ${x.quoteSymbol} ${x.description}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (state.sort === 'mcap') {
    rows.sort((a, b) => (Number(b.marketCapUsd) || -1) - (Number(a.marketCapUsd) || -1));
  } else if (state.sort === 'graduation') {
    rows.sort((a, b) => {
      const ga = a.graduated ? 1e9 : (Number(a.graduationProgressPct) || 0);
      const gb = b.graduated ? 1e9 : (Number(b.graduationProgressPct) || 0);
      return gb - ga;
    });
  } else {
    rows.sort((a, b) => (Date.parse(b.launchedAt) || 0) - (Date.parse(a.launchedAt) || 0));
  }
  return rows;
}

function counts() {
  const c = { all: state.launches.length, stocks: 0, usdg: 0, eth: 0 };
  for (const L of state.launches) {
    if (c[L.quoteClass] != null) c[L.quoteClass] += 1;
  }
  return c;
}

function renderCard(L) {
  const badgeClass = ['stocks', 'usdg', 'eth', 'btc'].includes(L.quoteClass) ? L.quoteClass : 'unknown';
  const initials = esc((L.symbol || '?').slice(0, 2));
  const avatar = L.logoUrl
    ? `<img class="avatar" src="${esc(L.logoUrl)}" alt="" loading="lazy" data-ph="${initials}" onerror="this.outerHTML='<div class=\'avatar ph\'>'+this.dataset.ph+'</div>'" />`
    : `<div class="avatar ph">${initials}</div>`;
  const grad = L.graduated
    ? `<span class="badge grad">Graduated</span>`
    : (L.graduationProgressPct != null
      ? `<span class="badge unknown">${esc(Number(L.graduationProgressPct).toFixed(1))}% curve</span>`
      : '');
  return `
    <article class="card">
      ${avatar}
      <div>
        <div class="card-top">
          <div>
            <div class="title">${esc(L.name)}</div>
            <div class="sym">$${esc(L.symbol)} · ${esc(relative(L.launchedAt))}</div>
          </div>
          <div class="badges">
            <span class="badge ${badgeClass}">${esc(L.quoteSymbol)} · ${esc(L.quoteClass)}</span>
            ${grad}
          </div>
        </div>
        <div class="metrics">
          <span>Mcap <strong>${fmtUsd(L.marketCapUsd)}</strong></span>
          <span>Price <strong>${fmtUsd(L.priceUsd)}</strong></span>
          <span>Launched <strong>${esc(fmtTime(L.launchedAt))}</strong></span>
        </div>
        ${L.description ? `<div class="desc">${esc(L.description)}</div>` : ''}
        <div class="links">
          ${L.explorerTokenUrl ? `<a class="chip-link" href="${esc(L.explorerTokenUrl)}" target="_blank" rel="noopener noreferrer">Explorer</a>` : ''}
          ${L.explorerTxUrl ? `<a class="chip-link" href="${esc(L.explorerTxUrl)}" target="_blank" rel="noopener noreferrer">Launch tx</a>` : ''}
          <a class="chip-link" href="https://www.ponsfamily.com/" target="_blank" rel="noopener noreferrer">Pons</a>
          <span class="chip-link" title="Token address" style="color:var(--muted);cursor:default">${esc((L.token || '').slice(0, 6))}…${esc((L.token || '').slice(-4))}</span>
        </div>
      </div>
    </article>`;
}

function render() {
  const app = $('#app');
  const c = counts();
  const rows = filtered();
  const updated = state.meta?.updatedAt || state.launches[0] && null;
  const updatedLabel = state.meta?.updatedAt ? fmtTime(state.meta.updatedAt) : '—';
  const by = state.meta?.counts?.byQuoteClass || {};

  app.innerHTML = `
    <div class="app">
      <header class="hero">
        <div class="brand">
          <div class="logo-mark">SC</div>
          <div>
            <h1>StockCurve</h1>
            <p class="tagline">Radar for <strong style="color:var(--text)">Pons</strong> memecoin launches on Robinhood Chain — filter by quote asset class: tokenized stocks (RWA), USDG, or ETH. Built for FOMO / Pons traders who care which curve a launch is quoted in.</p>
          </div>
        </div>
        <div class="meta-bar">
          <span class="pill live">● Live JSON · no API keys</span>
          <span class="pill">Updated <strong>${esc(updatedLabel)}</strong></span>
          <span class="pill">Launches <strong>${c.all}</strong></span>
          <span class="pill">Stocks <strong>${by.stocks ?? c.stocks}</strong></span>
          <span class="pill">USDG <strong>${by.usdg ?? c.usdg}</strong></span>
          <span class="pill">ETH <strong>${by.eth ?? c.eth}</strong></span>
        </div>
      </header>

      <div class="layout">
        <main class="panel">
          <div class="panel-hd">
            <h2>Launches</h2>
            <span class="pill">${rows.length} shown</span>
          </div>
          <div class="panel-bd">
            <div class="controls">
              <div class="filters" role="tablist" aria-label="Quote class filter">
                ${['all', 'stocks', 'usdg', 'eth'].map((f) => `
                  <button type="button" class="filter-btn ${state.filter === f ? 'active' : ''}" data-f="${f}">
                    ${f === 'all' ? `All (${c.all})` : f === 'stocks' ? `Stocks (${c.stocks})` : f === 'usdg' ? `USDG (${c.usdg})` : `ETH (${c.eth})`}
                  </button>`).join('')}
              </div>
              <div class="row2">
                <input type="search" id="q" placeholder="Search name, ticker, address, quote…" value="${esc(state.q)}" />
                <select id="sort" aria-label="Sort">
                  <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Newest</option>
                  <option value="mcap" ${state.sort === 'mcap' ? 'selected' : ''}>Market cap</option>
                  <option value="graduation" ${state.sort === 'graduation' ? 'selected' : ''}>Graduation</option>
                </select>
              </div>
            </div>

            <div class="stats">
              <div class="stat"><div class="k">Visible</div><div class="v">${rows.length}</div></div>
              <div class="stat"><div class="k">Stock-quoted</div><div class="v" style="color:var(--stocks)">${c.stocks}</div></div>
              <div class="stat"><div class="k">USDG-quoted</div><div class="v" style="color:var(--usdg)">${c.usdg}</div></div>
              <div class="stat"><div class="k">ETH-quoted</div><div class="v" style="color:var(--eth)">${c.eth}</div></div>
            </div>

            ${state.loading ? `<div class="loading">Loading launch radar…</div>` : ''}
            ${state.error ? `<div class="error">${esc(state.error)}</div>` : ''}
            ${!state.loading && !state.error && rows.length === 0
              ? `<div class="empty">No launches match this filter yet. Stock / USDG-quoted launches appear here when pairToken ≠ WETH — the registry is ready.</div>`
              : `<div class="list">${rows.map(renderCard).join('')}</div>`}
          </div>
        </main>

        <aside class="side">
          <div class="panel">
            <div class="panel-hd"><h2>Safe Links</h2></div>
            <div class="panel-bd">
              <div class="warn">${esc(state.safe?.warning || 'Only use official links. Lookalikes are phishing.')}</div>
              ${(state.safe?.links || []).map((L) => `
                <div class="item">
                  <h3>${esc(L.name)}</h3>
                  <p>${esc(L.blurb)}</p>
                  <a href="${esc(L.url)}" target="_blank" rel="noopener noreferrer">${esc(L.url.replace(/^https?:\/\//, ''))}</a>
                </div>`).join('') || '<p class="empty">Safe links unavailable.</p>'}
            </div>
          </div>

          <div class="panel" style="margin-top:18px">
            <div class="panel-hd"><h2>Why StockCurve?</h2></div>
            <div class="panel-bd" style="color:var(--muted);font-size:.78rem;line-height:1.55">
              <p style="margin-top:0">Most Pons tools track $PONS burns. StockCurve watches <strong style="color:var(--text)">which asset a launch is quoted against</strong> — NVDA/TSLA/… tokenized stocks, USDG, or ETH — so RWA-quote discovery is one filter away.</p>
              <p>Public static JSON under <code>/data/</code>. No login. No API keys. Refresh ~every 15 minutes via GitHub Actions.</p>
            </div>
          </div>
        </aside>
      </div>

      <p class="disclaimer">
        <strong>Disclaimer:</strong> StockCurve is an independent, free community tool. It is <em>not</em> affiliated with Robinhood, Pons Labs, FOMO, or any token issuer.
        Nothing here is financial, investment, or trading advice. Memecoins and tokenized assets are highly risky — do your own research and verify every URL.
      </p>
      <footer class="footer">
        <span>StockCurve · Robinhood Chain (4663)</span>
        <span><a href="https://github.com/binnen48/stockcurve" target="_blank" rel="noopener noreferrer">GitHub</a> · Data: <a href="${DATA_BASE}/launches.json">launches.json</a></span>
      </footer>
    </div>
  `;

  app.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.f;
      render();
    });
  });
  const qEl = $('#q');
  if (qEl) {
    qEl.addEventListener('input', (e) => {
      state.q = e.target.value;
      // re-render would steal focus — update list only
      state.q = e.target.value;
      const list = app.querySelector('.list') || app.querySelector('.empty');
      const rows2 = filtered();
      const host = app.querySelector('.panel-bd');
      // simpler: soft re-render keeping focus
      const pos = qEl.selectionStart;
      render();
      const nq = $('#q');
      if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); }
    });
  }
  const sortEl = $('#sort');
  if (sortEl) {
    sortEl.addEventListener('change', (e) => {
      state.sort = e.target.value;
      render();
    });
  }
}

async function loadJson(name) {
  const res = await fetch(`${DATA_BASE}/${name}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${name} (${res.status})`);
  return res.json();
}

async function boot() {
  render();
  try {
    const [launchesDoc, meta, safe] = await Promise.all([
      loadJson('launches.json'),
      loadJson('meta.json').catch(() => null),
      loadJson('safe-links.json').catch(() => null),
    ]);
    state.launches = Array.isArray(launchesDoc?.launches) ? launchesDoc.launches : (Array.isArray(launchesDoc) ? launchesDoc : []);
    state.meta = meta || { updatedAt: launchesDoc?.updatedAt };
    state.safe = safe;
    state.loading = false;
    state.error = null;
    if (state.launches.length === 0) {
      state.error = null; // empty is ok — UI shows empty state
    }
  } catch (e) {
    state.loading = false;
    state.error = e.message || String(e);
  }
  render();
}

boot();
