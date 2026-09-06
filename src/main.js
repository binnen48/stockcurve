const DATA_BASE = `${import.meta.env.BASE_URL}data`;
const REFRESH_MS = 90_000;
const LS_LANG = 'stockcurve.lang';
const LS_WATCH = 'stockcurve.watchlist';
const LS_VISIT = 'stockcurve.lastVisit';

const I18N = {
  en: {
    tagline:
      'Radar for <strong style="color:var(--text)">Pons</strong> memecoin launches on Robinhood Chain — filter by quote asset: tokenized stocks (RWA), USDG, or ETH.',
    live: 'Live',
    updated: 'Updated',
    launches: 'Launches',
    stocks: 'Stocks',
    usdg: 'USDG',
    eth: 'ETH',
    all: 'All',
    watchlist: 'Watchlist',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    shown: 'shown',
    searchPh: 'Search name, ticker, address, quote…  (/)',
    newest: 'Newest',
    mcap: 'Market cap',
    graduation: 'Graduation',
    visible: 'Visible',
    stockQuoted: 'Stock-quoted',
    usdgQuoted: 'USDG-quoted',
    ethQuoted: 'ETH-quoted',
    graduated: 'Graduated',
    newestAge: 'Newest launch',
    loading: 'Loading launch radar…',
    emptyAll: 'No launches match this filter yet.',
    emptyStocks:
      'No stock-quoted launches in the current dataset yet. The RWA quote registry is ready — StockCurve is waiting for Pons launches quoted against tokenized stocks (NVDA, TSLA, SPY, …). Switch to All / USDG / ETH meanwhile.',
    emptyWatch: 'No starred tokens yet. Tap ★ on a card to build your watchlist.',
    emptySearch: 'No launches match your search.',
    safeLinks: 'Safe Links',
    whyTitle: 'Why StockCurve?',
    whyBody:
      'Most Pons tools track $PONS burns. StockCurve watches <strong style="color:var(--text)">which asset a launch is quoted against</strong> — NVDA/TSLA/… tokenized stocks, USDG, or ETH — so RWA-quote discovery is one filter away.',
    whyBody2: 'Public static JSON under <code>/data/</code>. No login. No API keys. Auto-refresh every 90s in the browser; server data refreshes via GitHub Actions.',
    disclaimer:
      '<strong>Disclaimer:</strong> StockCurve is an independent, free community tool. It is <em>not</em> affiliated with Robinhood, Pons Labs, FOMO, or any token issuer. Nothing here is financial, investment, or trading advice. Memecoins and tokenized assets are highly risky — do your own research and verify every URL.',
    footer: 'StockCurve · Robinhood Chain (4663)',
    github: 'GitHub',
    data: 'Data',
    explorer: 'Explorer',
    launchTx: 'Launch tx',
    copy: 'Copy CA',
    copied: 'Copied!',
    deployer: 'Deployer',
    curve: 'curve',
    newBadge: 'New',
    mcapLabel: 'Mcap',
    priceLabel: 'Price',
    launchedLabel: 'Launched',
    langToggle: 'NL',
    safeFallback: 'Only use official links. Lookalikes are phishing.',
    safeUnavailable: 'Safe links unavailable.',
  },
  nl: {
    tagline:
      'Radar voor <strong style="color:var(--text)">Pons</strong> memecoin-launches op Robinhood Chain — filter op quote-asset: getokeniseerde aandelen (RWA), USDG of ETH.',
    live: 'Live',
    updated: 'Bijgewerkt',
    launches: 'Launches',
    stocks: 'Aandelen',
    usdg: 'USDG',
    eth: 'ETH',
    all: 'Alles',
    watchlist: 'Watchlist',
    refresh: 'Vernieuwen',
    refreshing: 'Bezig…',
    shown: 'zichtbaar',
    searchPh: 'Zoek naam, ticker, adres, quote…  (/)',
    newest: 'Nieuwste',
    mcap: 'Marktkapitalisatie',
    graduation: 'Graduatie',
    visible: 'Zichtbaar',
    stockQuoted: 'Aandeel-quote',
    usdgQuoted: 'USDG-quote',
    ethQuoted: 'ETH-quote',
    graduated: 'Afgestudeerd',
    newestAge: 'Nieuwste launch',
    loading: 'Launch-radar laden…',
    emptyAll: 'Geen launches voor dit filter.',
    emptyStocks:
      'Nog geen launches met aandeel-quote in de huidige data. Het RWA-register staat klaar — StockCurve wacht op Pons-launches die tegen getokeniseerde aandelen (NVDA, TSLA, SPY, …) worden gequote. Wissel intussen naar Alles / USDG / ETH.',
    emptyWatch: 'Nog geen favorieten. Tik ★ op een kaart om je watchlist te vullen.',
    emptySearch: 'Geen launches voor deze zoekopdracht.',
    safeLinks: 'Veilige links',
    whyTitle: 'Waarom StockCurve?',
    whyBody:
      'De meeste Pons-tools volgen $PONS-burns. StockCurve kijkt naar <strong style="color:var(--text)">tegen welk asset een launch wordt gequote</strong> — NVDA/TSLA/… aandelen, USDG of ETH — zodat RWA-ontdekking één filter weg is.',
    whyBody2: 'Publieke JSON onder <code>/data/</code>. Geen login. Geen API-keys. Browser auto-refresh elke 90s; serverdata via GitHub Actions.',
    disclaimer:
      '<strong>Disclaimer:</strong> StockCurve is een onafhankelijke, gratis communitytool. Het is <em>niet</em> gelieerd aan Robinhood, Pons Labs, FOMO of enige tokenuitgever. Niets hier is financieel of beleggingsadvies. Memecoins en getokeniseerde assets zijn zeer risicovol — doe je eigen research en verifieer elke URL.',
    footer: 'StockCurve · Robinhood Chain (4663)',
    github: 'GitHub',
    data: 'Data',
    explorer: 'Explorer',
    launchTx: 'Launch-tx',
    copy: 'Kopieer CA',
    copied: 'Gekopieerd!',
    deployer: 'Deployer',
    curve: 'curve',
    newBadge: 'Nieuw',
    mcapLabel: 'Mcap',
    priceLabel: 'Prijs',
    launchedLabel: 'Gelanceerd',
    langToggle: 'EN',
    safeFallback: 'Gebruik alleen officiële links. Lookalikes zijn phishing.',
    safeUnavailable: 'Veilige links niet beschikbaar.',
  },
};

const state = {
  launches: [],
  meta: null,
  safe: null,
  filter: 'all',
  q: '',
  sort: 'newest',
  loading: true,
  refreshing: false,
  error: null,
  lang: localStorage.getItem(LS_LANG) === 'nl' ? 'nl' : 'en',
  watchlist: loadWatchlist(),
  lastVisit: Number(localStorage.getItem(LS_VISIT) || 0) || 0,
  clientFetchedAt: null,
  pulse: false,
};

let refreshTimer = null;
let searchFocusRestore = null;

const $ = (sel, el = document) => el.querySelector(sel);
const t = (key) => I18N[state.lang][key] ?? I18N.en[key] ?? key;

function loadWatchlist() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_WATCH) || '[]');
    return new Set(Array.isArray(raw) ? raw.map((x) => String(x).toLowerCase()) : []);
  } catch {
    return new Set();
  }
}

function saveWatchlist() {
  localStorage.setItem(LS_WATCH, JSON.stringify([...state.watchlist]));
}

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
  const loc = state.lang === 'nl' ? 'nl-NL' : undefined;
  return d.toLocaleString(loc, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function relative(iso) {
  if (!iso) return '';
  const ts = Date.parse(iso);
  if (!ts) return '';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function shortAddr(a) {
  if (!a) return '—';
  const s = String(a);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function deployerCounts() {
  const m = new Map();
  for (const L of state.launches) {
    const d = (L.deployer || '').toLowerCase();
    if (!d) continue;
    m.set(d, (m.get(d) || 0) + 1);
  }
  return m;
}

function parseHash() {
  const raw = (location.hash || '').replace(/^#/, '');
  if (!raw) return;
  const params = new URLSearchParams(raw.includes('=') ? raw : '');
  // also support query-style without encoding issues
  const filter = params.get('filter');
  const sort = params.get('sort');
  const q = params.get('q');
  if (filter && ['all', 'stocks', 'usdg', 'eth', 'watch'].includes(filter)) state.filter = filter;
  if (sort && ['newest', 'mcap', 'graduation'].includes(sort)) state.sort = sort;
  if (q != null) state.q = q;
}

function writeHash() {
  const params = new URLSearchParams();
  params.set('filter', state.filter);
  params.set('sort', state.sort);
  params.set('q', state.q || '');
  const next = `#${params.toString()}`;
  if (location.hash !== next) {
    history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
  }
}

function filtered() {
  let rows = state.launches.slice();
  if (state.filter === 'watch') {
    rows = rows.filter((x) => state.watchlist.has((x.token || '').toLowerCase()));
  } else if (state.filter !== 'all') {
    rows = rows.filter((x) => x.quoteClass === state.filter);
  }
  const q = state.q.trim().toLowerCase();
  if (q) {
    rows = rows.filter((x) => {
      const hay = `${x.name} ${x.symbol} ${x.token} ${x.quoteSymbol} ${x.description} ${x.deployer}`.toLowerCase();
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
  const c = { all: state.launches.length, stocks: 0, usdg: 0, eth: 0, watch: 0 };
  for (const L of state.launches) {
    if (c[L.quoteClass] != null) c[L.quoteClass] += 1;
    if (state.watchlist.has((L.token || '').toLowerCase())) c.watch += 1;
  }
  return c;
}

function stripStats() {
  const c = counts();
  const graduated = state.launches.filter((x) => x.graduated).length;
  let newestIso = null;
  let newestAge = '—';
  for (const L of state.launches) {
    if (!L.launchedAt) continue;
    if (!newestIso || Date.parse(L.launchedAt) > Date.parse(newestIso)) newestIso = L.launchedAt;
  }
  if (newestIso) newestAge = relative(newestIso);
  return { ...c, graduated, newestAge, newestIso };
}

function isNewSinceVisit(L) {
  if (!state.lastVisit || !L.launchedAt) return false;
  return Date.parse(L.launchedAt) > state.lastVisit;
}

function progressBar(L) {
  if (L.graduated) {
    return `<div class="grad-bar done" title="100%"><div class="grad-fill" style="width:100%"></div><span>100%</span></div>`;
  }
  const pct = Math.max(0, Math.min(100, Number(L.graduationProgressPct) || 0));
  if (L.graduationProgressPct == null && !L.pairedPrincipalEth) {
    return `<div class="grad-bar unknown" title="—"><div class="grad-fill" style="width:0%"></div><span>— ${t('curve')}</span></div>`;
  }
  return `<div class="grad-bar" title="${pct.toFixed(1)}%"><div class="grad-fill" style="width:${pct}%"></div><span>${pct.toFixed(1)}%</span></div>`;
}

function renderCard(L, depCounts) {
  const badgeClass = ['stocks', 'usdg', 'eth', 'btc'].includes(L.quoteClass) ? L.quoteClass : 'unknown';
  const initials = esc((L.symbol || '?').slice(0, 2));
  const tok = (L.token || '').toLowerCase();
  const starred = state.watchlist.has(tok);
  const isNew = isNewSinceVisit(L);
  const dep = L.deployer || '';
  const depN = depCounts.get(dep.toLowerCase()) || 0;
  const avatar = L.logoUrl
    ? `<img class="avatar" src="${esc(L.logoUrl)}" alt="" loading="lazy" data-ph="${initials}" onerror="this.outerHTML='<div class=\\'avatar ph\\'>'+this.dataset.ph+'</div>'" />`
    : `<div class="avatar ph">${initials}</div>`;
  const gradBadge = L.graduated
    ? `<span class="badge grad">${esc(t('graduated'))}</span>`
    : '';

  return `
    <article class="card ${isNew ? 'is-new' : ''} ${badgeClass === 'stocks' ? 'is-stock' : ''}" data-token="${esc(L.token)}">
      ${avatar}
      <div class="card-body">
        <div class="card-top">
          <div class="card-id">
            <button type="button" class="star-btn ${starred ? 'on' : ''}" data-star="${esc(L.token)}" aria-label="Watchlist" title="Watchlist">★</button>
            <div>
              <div class="title-row">
                <span class="title">${esc(L.name)}</span>
                ${isNew ? `<span class="badge new">${esc(t('newBadge'))}</span>` : ''}
              </div>
              <div class="sym">$${esc(L.symbol)} · ${esc(relative(L.launchedAt))}</div>
            </div>
          </div>
          <div class="badges">
            <span class="badge ${badgeClass}">${esc(L.quoteSymbol)} · ${esc(L.quoteClass)}</span>
            ${gradBadge}
          </div>
        </div>
        ${progressBar(L)}
        <div class="metrics">
          <span>${esc(t('mcapLabel'))} <strong>${fmtUsd(L.marketCapUsd)}</strong></span>
          <span>${esc(t('priceLabel'))} <strong>${fmtUsd(L.priceUsd)}</strong></span>
          <span>${esc(t('launchedLabel'))} <strong>${esc(fmtTime(L.launchedAt))}</strong></span>
        </div>
        <div class="deployer-row">
          <span class="muted-label">${esc(t('deployer'))}</span>
          ${dep
            ? `<a class="chip-link deployer" href="https://robinhoodchain.blockscout.com/address/${esc(dep)}" target="_blank" rel="noopener noreferrer">${esc(shortAddr(dep))}</a>
               <span class="dep-count" title="Launches by this deployer in current dataset">×${depN}</span>`
            : '<span>—</span>'}
        </div>
        ${L.description ? `<div class="desc">${esc(L.description)}</div>` : ''}
        <div class="links">
          ${L.explorerTokenUrl ? `<a class="chip-link" href="${esc(L.explorerTokenUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('explorer'))}</a>` : ''}
          ${L.explorerTxUrl ? `<a class="chip-link" href="${esc(L.explorerTxUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('launchTx'))}</a>` : ''}
          <a class="chip-link" href="https://www.ponsfamily.com/" target="_blank" rel="noopener noreferrer">Pons</a>
          <button type="button" class="chip-link copy-btn" data-copy="${esc(L.token)}">${esc(t('copy'))} ${esc(shortAddr(L.token))}</button>
        </div>
      </div>
    </article>`;
}

function emptyMessage(rows, c) {
  if (state.filter === 'stocks' && c.stocks === 0) return t('emptyStocks');
  if (state.filter === 'watch') return t('emptyWatch');
  if (state.q.trim()) return t('emptySearch');
  return t('emptyAll');
}

function updatedClockLabel() {
  const iso = state.meta?.updatedAt || state.clientFetchedAt;
  if (!iso) return '—';
  return fmtTime(iso);
}

function render() {
  const app = $('#app');
  const c = counts();
  const stats = stripStats();
  const rows = filtered();
  const depCounts = deployerCounts();
  const by = state.meta?.counts?.byQuoteClass || {};
  document.documentElement.lang = state.lang;

  app.innerHTML = `
    <div class="app">
      <header class="hero">
        <div class="brand">
          <div class="logo-mark">SC</div>
          <div>
            <h1>StockCurve</h1>
            <p class="tagline">${t('tagline')}</p>
          </div>
          <div class="hero-actions">
            <button type="button" class="btn ghost" id="lang-btn" title="Language">${esc(t('langToggle'))}</button>
            <button type="button" class="btn" id="refresh-btn" ${state.refreshing ? 'disabled' : ''}>
              ${state.refreshing ? esc(t('refreshing')) : esc(t('refresh'))}
            </button>
          </div>
        </div>
        <div class="meta-bar">
          <span class="pill live ${state.pulse ? 'pulse' : ''}"><span class="dot"></span> ${esc(t('live'))}</span>
          <span class="pill">${esc(t('updated'))} <strong id="upd-clock">${esc(updatedClockLabel())}</strong></span>
          <span class="pill">${esc(t('launches'))} <strong>${c.all}</strong></span>
          <span class="pill stocks-pill">${esc(t('stocks'))} <strong>${by.stocks ?? c.stocks}</strong></span>
          <span class="pill">${esc(t('usdg'))} <strong>${by.usdg ?? c.usdg}</strong></span>
          <span class="pill">${esc(t('eth'))} <strong>${by.eth ?? c.eth}</strong></span>
        </div>
      </header>

      <div class="layout">
        <main class="panel">
          <div class="panel-hd">
            <h2>${esc(t('launches'))}</h2>
            <span class="pill">${rows.length} ${esc(t('shown'))}</span>
          </div>
          <div class="panel-bd">
            <div class="controls">
              <div class="filters" role="tablist" aria-label="Quote class filter">
                ${[
                  ['all', `${t('all')} (${c.all})`],
                  ['stocks', `${t('stocks')} (${c.stocks})`],
                  ['usdg', `${t('usdg')} (${c.usdg})`],
                  ['eth', `${t('eth')} (${c.eth})`],
                  ['watch', `★ ${t('watchlist')} (${c.watch})`],
                ].map(([f, label]) => `
                  <button type="button" class="filter-btn ${state.filter === f ? 'active' : ''}" data-f="${f}">
                    ${esc(label)}
                  </button>`).join('')}
              </div>
              <div class="row2">
                <input type="search" id="q" placeholder="${esc(t('searchPh'))}" value="${esc(state.q)}" autocomplete="off" />
                <select id="sort" aria-label="Sort">
                  <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>${esc(t('newest'))}</option>
                  <option value="mcap" ${state.sort === 'mcap' ? 'selected' : ''}>${esc(t('mcap'))}</option>
                  <option value="graduation" ${state.sort === 'graduation' ? 'selected' : ''}>${esc(t('graduation'))}</option>
                </select>
              </div>
            </div>

            <div class="stats">
              <div class="stat"><div class="k">${esc(t('visible'))}</div><div class="v">${rows.length}</div></div>
              <div class="stat stock-stat"><div class="k">${esc(t('stockQuoted'))}</div><div class="v">${c.stocks}</div></div>
              <div class="stat"><div class="k">${esc(t('usdgQuoted'))}</div><div class="v" style="color:var(--usdg)">${c.usdg}</div></div>
              <div class="stat"><div class="k">${esc(t('ethQuoted'))}</div><div class="v" style="color:var(--eth)">${c.eth}</div></div>
              <div class="stat"><div class="k">${esc(t('graduated'))}</div><div class="v" style="color:var(--ok)">${stats.graduated}</div></div>
              <div class="stat"><div class="k">${esc(t('newestAge'))}</div><div class="v age">${esc(stats.newestAge)}</div></div>
            </div>

            ${state.loading ? `<div class="loading">${esc(t('loading'))}</div>` : ''}
            ${state.error ? `<div class="error">${esc(state.error)}</div>` : ''}
            ${!state.loading && !state.error && rows.length === 0
              ? `<div class="empty ${state.filter === 'stocks' ? 'empty-stocks' : ''}">${esc(emptyMessage(rows, c)).replaceAll('\n', '<br/>')}</div>`
              : !state.loading
                ? `<div class="list">${rows.map((L) => renderCard(L, depCounts)).join('')}</div>`
                : ''}
          </div>
        </main>

        <aside class="side">
          <div class="panel">
            <div class="panel-hd"><h2>${esc(t('safeLinks'))}</h2></div>
            <div class="panel-bd">
              <div class="warn">${esc(state.safe?.warning || t('safeFallback'))}</div>
              ${(state.safe?.links || []).map((L) => `
                <div class="item">
                  <h3>${esc(L.name)}</h3>
                  <p>${esc(L.blurb)}</p>
                  <a href="${esc(L.url)}" target="_blank" rel="noopener noreferrer">${esc(L.url.replace(/^https?:\/\//, ''))}</a>
                </div>`).join('') || `<p class="empty">${esc(t('safeUnavailable'))}</p>`}
            </div>
          </div>

          <div class="panel" style="margin-top:14px">
            <div class="panel-hd"><h2>${esc(t('whyTitle'))}</h2></div>
            <div class="panel-bd why">
              <p style="margin-top:0">${t('whyBody')}</p>
              <p>${t('whyBody2')}</p>
            </div>
          </div>
        </aside>
      </div>

      <p class="disclaimer">${t('disclaimer')}</p>
      <footer class="footer">
        <span>${esc(t('footer'))}</span>
        <span>
          <a href="https://github.com/binnen48/stockcurve" target="_blank" rel="noopener noreferrer">${esc(t('github'))}</a>
          · ${esc(t('data'))}: <a href="${DATA_BASE}/launches.json">launches.json</a>
        </span>
      </footer>
    </div>
  `;

  bindUi(app);
  writeHash();

  if (searchFocusRestore != null) {
    const nq = $('#q');
    if (nq) {
      nq.focus();
      try { nq.setSelectionRange(searchFocusRestore, searchFocusRestore); } catch { /* ignore */ }
    }
    searchFocusRestore = null;
  }
}

function bindUi(app) {
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
      searchFocusRestore = e.target.selectionStart;
      render();
    });
  }

  const sortEl = $('#sort');
  if (sortEl) {
    sortEl.addEventListener('change', (e) => {
      state.sort = e.target.value;
      render();
    });
  }

  const langBtn = $('#lang-btn');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      state.lang = state.lang === 'en' ? 'nl' : 'en';
      localStorage.setItem(LS_LANG, state.lang);
      render();
    });
  }

  const refreshBtn = $('#refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => { refreshData(true); });
  }

  app.querySelectorAll('.star-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tok = (btn.dataset.star || '').toLowerCase();
      if (!tok) return;
      if (state.watchlist.has(tok)) state.watchlist.delete(tok);
      else state.watchlist.add(tok);
      saveWatchlist();
      render();
    });
  });

  app.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const addr = btn.dataset.copy || '';
      try {
        await navigator.clipboard.writeText(addr);
        const prev = btn.textContent;
        btn.textContent = t('copied');
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = prev;
          btn.classList.remove('copied');
        }, 1200);
      } catch {
        /* ignore */
      }
    });
  });
}

async function loadJson(name) {
  const res = await fetch(`${DATA_BASE}/${name}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${name} (${res.status})`);
  return res.json();
}

async function refreshData(manual = false) {
  if (state.refreshing) return;
  state.refreshing = true;
  if (manual) render();
  try {
    const [launchesDoc, meta, safe] = await Promise.all([
      loadJson('launches.json'),
      loadJson('meta.json').catch(() => null),
      loadJson('safe-links.json').catch(() => null),
    ]);
    state.launches = Array.isArray(launchesDoc?.launches)
      ? launchesDoc.launches
      : (Array.isArray(launchesDoc) ? launchesDoc : []);
    state.meta = meta || { updatedAt: launchesDoc?.updatedAt };
    state.safe = safe;
    state.loading = false;
    state.error = null;
    state.clientFetchedAt = new Date().toISOString();
    state.pulse = true;
    setTimeout(() => { state.pulse = false; const live = document.querySelector('.pill.live'); if (live) live.classList.remove('pulse'); }, 900);
  } catch (e) {
    state.loading = false;
    if (!state.launches.length) state.error = e.message || String(e);
  } finally {
    state.refreshing = false;
    render();
  }
}

function markVisit() {
  // Keep prior visit for "new" highlights until page unload / next session start
  const now = Date.now();
  window.addEventListener('pagehide', () => {
    localStorage.setItem(LS_VISIT, String(now));
  });
  // If first visit, seed so future sessions work; don't highlight everything as new
  if (!state.lastVisit) {
    state.lastVisit = now - 6 * 3600 * 1000; // soft window: last 6h as "new" for first-timers
    localStorage.setItem(LS_VISIT, String(now));
  }
}

function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable;
    if (e.key === '/' && !typing) {
      e.preventDefault();
      const q = $('#q');
      if (q) { q.focus(); q.select(); }
      return;
    }
    if (typing) return;
    const map = { '1': 'all', '2': 'stocks', '3': 'usdg', '4': 'eth' };
    if (map[e.key]) {
      state.filter = map[e.key];
      render();
    }
  });
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => refreshData(false), REFRESH_MS);
}

async function boot() {
  parseHash();
  markVisit();
  bindKeyboard();
  window.addEventListener('hashchange', () => {
    parseHash();
    render();
  });
  render();
  await refreshData(false);
  startAutoRefresh();
}

boot();
