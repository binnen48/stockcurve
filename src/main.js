const DATA_BASE = `${import.meta.env.BASE_URL}feed`;
const REFRESH_MS = 90_000;
const LIVE_POLL_MS = 18_000;
const MAX_LAUNCHES = 750;
const LIVE_FAIL_TOAST_AFTER = 3;
const LS_WATCH = 'stockcurve.watchlist';
const LS_VISIT = 'stockcurve.lastVisit';
const LS_LIVE = 'stockcurve.live';
const LS_NOTIFY = 'stockcurve.notifyStocks';

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const PONS_API_20 = 'https://www.ponsfamily.com/api/pons-launches?limit=20';
const FACTORY_V1 = '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB';
const FACTORY_V2 = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const FACTORY_RECENT = '0xF4fC0CD27fC8EcF17E55eE4c3f7201897dF3eb75';
const TOPIC_V2 = '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607';
const TOPIC_V1STYLE = '0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a';
const ZERO = '0x0000000000000000000000000000000000000000';
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';

const S = {
  tagline:
    'Radar for <strong style="color:var(--text)">Pons</strong> memecoin launches on Robinhood Chain — filter by quote asset: tokenized stocks (RWA), USDG, or ETH.',
  live: 'Live',
  updated: 'Updated',
  launches: 'Launches',
  stocks: 'Stocks',
  usdg: 'USDG',
  eth: 'ETH',
  btc: 'BTC',
  unknown: 'Unknown',
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
  whyBody2:
    'Public static JSON under <code>/feed/</code>. No login. No API keys. Browser auto-refresh every 90s; server feed refresh about every 15 minutes. Live mode polls Robinhood Chain RPC for TokenLaunched events.',
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
  liveBadge: 'LIVE',
  mcapLabel: 'Mcap',
  priceLabel: 'Price',
  launchedLabel: 'Launched',
  safeFallback: 'Only use official links. Lookalikes are phishing.',
  safeUnavailable: 'Safe links unavailable.',
  onCurve: 'On curve only',
  topDeployers: 'Top deployers',
  quoteMix: 'Quote mix',
  notifyBtn: 'Notify on stock launches',
  notifyOn: 'Stock alerts ON',
  notifyDenied: 'Notifications blocked',
  swarm: 'swarm',
  scanning: 'scanning',
  lastEvent: 'last event',
  liveOff: 'Feed only',
  liveRpcFail: 'Live RPC failing — retrying with backoff. Feed refresh still works.',
  toastDismiss: 'Dismiss',
};

const state = {
  launches: [],
  meta: null,
  safe: null,
  quotesRegistry: {},
  filter: 'all',
  q: '',
  quoteTicker: '',
  onCurveOnly: false,
  sort: 'newest',
  loading: true,
  refreshing: false,
  error: null,
  watchlist: loadWatchlist(),
  lastVisit: Number(localStorage.getItem(LS_VISIT) || 0) || 0,
  clientFetchedAt: null,
  pulse: false,
  live: localStorage.getItem(LS_LIVE) !== '0',
  liveStatus: { block: null, lastEventAt: null, lastError: null, scanning: false, failCount: 0 },
  notifyStocks: localStorage.getItem(LS_NOTIFY) === '1',
  hashHadFilter: false,
  defaultedStocks: false,
  liveFlash: new Set(),
  toast: null,
};

let refreshTimer = null;
let liveTimer = null;
let searchDebounce = null;
let searchFocusRestore = null;
let liveBackoffUntil = 0;
let liveFromBlock = null;
let knownTokensAtBoot = new Set();
let feedAbort = null;
let feedReqId = 0;
let livePollId = 0;
let toastTimer = null;
const liveFlashTimers = new Map();

const $ = (sel, el = document) => el.querySelector(sel);
const t = (key) => S[key] ?? key;

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
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function relative(iso) {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (!ts) return '—';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  let core;
  if (s < 60) core = `${Math.floor(s)}s`;
  else if (s < 3600) core = `${Math.floor(s / 60)}m`;
  else if (s < 86400) core = `${Math.floor(s / 3600)}h`;
  else core = `${Math.floor(s / 86400)}d`;
  return `${core} ago`;
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function capLaunches(list) {
  if (!Array.isArray(list) || list.length <= MAX_LAUNCHES) return list || [];
  return list
    .slice()
    .sort((a, b) => (Date.parse(b.launchedAt) || 0) - (Date.parse(a.launchedAt) || 0))
    .slice(0, MAX_LAUNCHES);
}

function showToast(message, { ms = 8000 } = {}) {
  state.toast = { message: String(message || ''), at: Date.now() };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = null;
    const el = document.getElementById('sc-toast');
    if (el) el.remove();
  }, ms);
  renderToast();
}

function dismissToast() {
  state.toast = null;
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  const el = document.getElementById('sc-toast');
  if (el) el.remove();
}

function renderToast() {
  let el = document.getElementById('sc-toast');
  if (!state.toast) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'sc-toast';
    el.className = 'sc-toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.innerHTML = `<span>${esc(state.toast.message)}</span><button type="button" class="sc-toast-x" aria-label="${esc(t('toastDismiss'))}">×</button>`;
  el.querySelector('.sc-toast-x')?.addEventListener('click', dismissToast);
}

function markLiveFlash(key) {
  if (!key) return;
  state.liveFlash.add(key);
  const prev = liveFlashTimers.get(key);
  if (prev) clearTimeout(prev);
  const tid = setTimeout(() => {
    state.liveFlash.delete(key);
    liveFlashTimers.delete(key);
  }, 12000);
  liveFlashTimers.set(key, tid);
}

function shortAddr(a) {
  if (!a) return '—';
  const s = String(a);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function ponsUrlFor(token) {
  if (!token) return 'https://www.ponsfamily.com/';
  return `https://www.ponsfamily.com/launchpad?token=${token}`;
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

function topDeployers(n = 5) {
  return [...deployerCounts().entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([addr, count]) => ({ addr, count }));
}

function quoteTickerCounts() {
  const m = new Map();
  for (const L of state.launches) {
    if (L.quoteClass !== 'stocks') continue;
    const sym = (L.quoteSymbol || '').toUpperCase();
    if (!sym || sym === 'UNK') continue;
    m.set(sym, (m.get(sym) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function parseHash() {
  const raw = (location.hash || '').replace(/^#/, '');
  if (!raw) return;
  const params = new URLSearchParams(raw.includes('=') ? raw : '');
  const filter = params.get('filter');
  const sort = params.get('sort');
  const q = params.get('q');
  const quote = params.get('quote');
  const curve = params.get('curve');
  if (filter) {
    state.hashHadFilter = true;
    if (['all', 'stocks', 'usdg', 'eth', 'btc', 'unknown', 'watch'].includes(filter)) {
      state.filter = filter;
    }
  }
  if (sort && ['newest', 'mcap', 'graduation'].includes(sort)) state.sort = sort;
  if (q != null) state.q = q;
  if (quote != null) state.quoteTicker = quote.toUpperCase();
  if (curve === '1') state.onCurveOnly = true;
  if (curve === '0') state.onCurveOnly = false;
}

function writeHash() {
  const params = new URLSearchParams();
  params.set('filter', state.filter);
  params.set('sort', state.sort);
  if (state.q) params.set('q', state.q);
  else params.set('q', '');
  if (state.quoteTicker) params.set('quote', state.quoteTicker);
  if (state.onCurveOnly) params.set('curve', '1');
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
  if (state.onCurveOnly) {
    rows = rows.filter((x) => !x.graduated);
  }
  if (state.quoteTicker) {
    const qt = state.quoteTicker.toUpperCase();
    rows = rows.filter((x) => (x.quoteSymbol || '').toUpperCase() === qt);
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
    rows.sort((a, b) => {
      const tb = Date.parse(b.launchedAt);
      const ta = Date.parse(a.launchedAt);
      const nb = Number.isFinite(tb) ? tb : 0;
      const na = Number.isFinite(ta) ? ta : 0;
      return nb - na;
    });
  }
  return rows;
}

function counts() {
  const c = { all: state.launches.length, stocks: 0, usdg: 0, eth: 0, btc: 0, unknown: 0, watch: 0 };
  for (const L of state.launches) {
    if (c[L.quoteClass] != null) c[L.quoteClass] += 1;
    else c.unknown += 1;
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
    const ts = Date.parse(L.launchedAt);
    if (!ts) continue;
    if (!newestIso || ts > Date.parse(newestIso)) newestIso = L.launchedAt;
  }
  if (newestIso) newestAge = relative(newestIso);
  return { ...c, graduated, newestAge, newestIso };
}

function quoteMix() {
  const c = counts();
  const total = Math.max(1, c.all);
  const parts = [
    { key: 'stocks', label: 'Stocks', n: c.stocks, color: 'var(--stocks)' },
    { key: 'usdg', label: 'USDG', n: c.usdg, color: 'var(--usdg)' },
    { key: 'eth', label: 'ETH', n: c.eth, color: 'var(--eth)' },
    { key: 'other', label: 'Other', n: c.btc + c.unknown, color: '#64748b' },
  ].filter((p) => p.n > 0);
  return parts.map((p) => ({ ...p, pct: (p.n / total) * 100 }));
}

function isNewSinceVisit(L) {
  if (!state.lastVisit || !L.launchedAt) return false;
  return Date.parse(L.launchedAt) > state.lastVisit;
}

function graduationVelocity(L) {
  if (L.graduated || L.graduationProgressPct == null || !L.launchedAt) return null;
  const pct = Number(L.graduationProgressPct);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const ageH = (Date.now() - Date.parse(L.launchedAt)) / 3600000;
  if (!(ageH > 0.05)) return null;
  const perHour = pct / ageH;
  if (!(perHour > 0)) return null;
  let hint = `${perHour.toFixed(1)}%/h`;
  if (pct < 100 && perHour > 0.05) {
    const etaH = (100 - pct) / perHour;
    if (etaH < 48) hint += ` · ~${etaH < 1 ? `${Math.round(etaH * 60)}m` : `${etaH.toFixed(1)}h`} ETA`;
  }
  return hint;
}

function progressBar(L) {
  if (L.graduated) {
    return `<div class="grad-bar done" title="100%"><div class="grad-fill" style="width:100%"></div><span>100%</span></div>`;
  }
  const pct = Math.max(0, Math.min(100, Number(L.graduationProgressPct) || 0));
  const vel = graduationVelocity(L);
  if (L.graduationProgressPct == null && !L.pairedPrincipalEth) {
    return `<div class="grad-bar unknown" title="—"><div class="grad-fill" style="width:0%"></div><span>— ${t('curve')}</span></div>`;
  }
  return `<div class="grad-bar" title="${pct.toFixed(1)}%${vel ? ` · ${vel}` : ''}"><div class="grad-fill" style="width:${pct}%"></div><span>${pct.toFixed(1)}%${vel ? ` · ${esc(vel)}` : ''}</span></div>`;
}

function renderCard(L, depCounts) {
  const badgeClass = ['stocks', 'usdg', 'eth', 'btc'].includes(L.quoteClass) ? L.quoteClass : 'unknown';
  const initials = esc((L.symbol || '?').slice(0, 2));
  const tok = (L.token || '').toLowerCase();
  const starred = state.watchlist.has(tok);
  const isNew = isNewSinceVisit(L);
  const isLiveFlash = state.liveFlash.has(tok);
  const dep = L.deployer || '';
  const depN = depCounts.get(dep.toLowerCase()) || 0;
  const swarm = depN >= 3;
  const avatar = L.logoUrl
    ? `<img class="avatar" src="${esc(L.logoUrl)}" alt="" loading="lazy" data-ph="${initials}" onerror="this.outerHTML='<div class=\\'avatar ph\\'>'+this.dataset.ph+'</div>'" />`
    : `<div class="avatar ph">${initials}</div>`;
  const gradBadge = L.graduated
    ? `<span class="badge grad">${esc(t('graduated'))}</span>`
    : '';
  const pons = L.ponsUrl || ponsUrlFor(L.token);
  const age = relative(L.launchedAt);

  return `
    <article class="card ${isNew ? 'is-new' : ''} ${isLiveFlash ? 'is-live-flash' : ''} ${badgeClass === 'stocks' ? 'is-stock' : ''}" data-token="${esc(L.token)}">
      ${avatar}
      <div class="card-body">
        <div class="card-top">
          <div class="card-id">
            <button type="button" class="star-btn ${starred ? 'on' : ''}" data-star="${esc(L.token)}" aria-label="Watchlist" title="Watchlist">★</button>
            <div>
              <div class="title-row">
                <span class="title">${esc(L.name)}</span>
                ${isLiveFlash ? `<span class="badge live">${esc(t('liveBadge'))}</span>` : ''}
                ${isNew && !isLiveFlash ? `<span class="badge new">${esc(t('newBadge'))}</span>` : ''}
                ${swarm ? `<span class="badge swarm" title="${depN} launches by this deployer">${esc(t('swarm'))} ×${depN}</span>` : ''}
              </div>
              <div class="sym">$${esc(L.symbol)} · ${esc(age)}</div>
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
          <a class="chip-link" href="${esc(pons)}" target="_blank" rel="noopener noreferrer">Pons</a>
          <button type="button" class="chip-link copy-btn" data-copy="${esc(L.token)}">${esc(t('copy'))} ${esc(shortAddr(L.token))}</button>
        </div>
      </div>
    </article>`;
}

function emptyMessage(c) {
  if (state.filter === 'stocks' && c.stocks === 0) return t('emptyStocks');
  if (state.filter === 'watch') return t('emptyWatch');
  if (state.q.trim() || state.quoteTicker) return t('emptySearch');
  return t('emptyAll');
}

function updatedClockLabel() {
  const iso = state.meta?.updatedAt || state.clientFetchedAt;
  if (!iso) return '—';
  return fmtTime(iso);
}

function liveStatusLabel() {
  if (!state.live) return t('liveOff');
  const b = state.liveStatus.block;
  const last = state.liveStatus.lastEventAt;
  const parts = [t('live')];
  if (document.hidden) parts.push('paused');
  else if (b != null) parts.push(`block #${b}`);
  else if (state.liveStatus.scanning) parts.push(t('scanning'));
  if (last) parts.push(`${t('lastEvent')} ${relative(last)}`);
  else if (state.liveStatus.lastError) {
    parts.push(state.liveStatus.failCount >= LIVE_FAIL_TOAST_AFTER ? 'RPC errors' : 'retrying');
  }
  return parts.join(' · ');
}

function renderQuoteMix() {
  const mix = quoteMix();
  if (!mix.length) return '';
  const segs = mix.map((p) =>
    `<div class="mix-seg" style="width:${p.pct.toFixed(2)}%;background:${p.color}" title="${esc(p.label)} ${p.n} (${p.pct.toFixed(1)}%)"></div>`
  ).join('');
  const legend = mix.map((p) =>
    `<span class="mix-leg"><i style="background:${p.color}"></i>${esc(p.label)} ${p.pct.toFixed(0)}%</span>`
  ).join('');
  return `
    <div class="quote-mix" aria-label="${esc(t('quoteMix'))}">
      <div class="mix-label">${esc(t('quoteMix'))}</div>
      <div class="mix-bar">${segs}</div>
      <div class="mix-legend">${legend}</div>
    </div>`;
}

function renderQuoteChips() {
  if (state.filter !== 'stocks' && state.filter !== 'all') return '';
  const ticks = quoteTickerCounts();
  if (!ticks.length) return '';
  return `
    <div class="quote-chips" role="group" aria-label="Quote tickers">
      <button type="button" class="qchip ${!state.quoteTicker ? 'active' : ''}" data-quote="">All quotes</button>
      ${ticks.map(([sym, n]) => `
        <button type="button" class="qchip ${state.quoteTicker === sym ? 'active' : ''}" data-quote="${esc(sym)}">${esc(sym)} <em>${n}</em></button>
      `).join('')}
    </div>`;
}

function renderTopDeployers() {
  const top = topDeployers(5);
  if (!top.length) return '';
  return `
    <div class="panel" style="margin-top:14px">
      <div class="panel-hd"><h2>${esc(t('topDeployers'))}</h2></div>
      <div class="panel-bd">
        <ol class="top-deps">
          ${top.map((d) => `
            <li>
              <a href="https://robinhoodchain.blockscout.com/address/${esc(d.addr)}" target="_blank" rel="noopener noreferrer">${esc(shortAddr(d.addr))}</a>
              <span class="dep-count">×${d.count}</span>
            </li>`).join('')}
        </ol>
      </div>
    </div>`;
}

function renderListArea(rows, c, depCounts) {
  if (state.loading) return `<div class="loading">${esc(t('loading'))}</div>`;
  if (state.error) return `<div class="error">${esc(state.error)}</div>`;
  // Don't show stocks empty wrongly when stock-quoted count > 0 but other filters hide rows
  if (rows.length === 0) {
    return `<div class="empty ${state.filter === 'stocks' && c.stocks === 0 ? 'empty-stocks' : ''}">${esc(emptyMessage(c))}</div>`;
  }
  return `<div class="list" id="launch-list">${rows.map((L) => renderCard(L, depCounts)).join('')}</div>`;
}

function render() {
  const app = $('#app');
  const c = counts();
  const stats = stripStats();
  const rows = filtered();
  const depCounts = deployerCounts();
  const by = state.meta?.counts?.byQuoteClass || {};
  document.documentElement.lang = 'en';

  const filterBtns = [
    ['all', `${t('all')} (${c.all})`],
    ['stocks', `${t('stocks')} (${c.stocks})`],
    ['usdg', `${t('usdg')} (${c.usdg})`],
    ['eth', `${t('eth')} (${c.eth})`],
  ];
  if (c.btc > 0) filterBtns.push(['btc', `${t('btc')} (${c.btc})`]);
  if (c.unknown > 0) filterBtns.push(['unknown', `${t('unknown')} (${c.unknown})`]);
  filterBtns.push(['watch', `★ ${t('watchlist')} (${c.watch})`]);

  const notifyLabel = state.notifyStocks
    ? (Notification?.permission === 'denied' ? t('notifyDenied') : t('notifyOn'))
    : t('notifyBtn');

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
            <button type="button" class="btn live-toggle ${state.live ? 'on' : ''}" id="live-btn" title="Toggle Live RPC polling">
              <span class="dot"></span> ${state.live ? 'Live ON' : 'Live OFF'}
            </button>
            <button type="button" class="btn ghost" id="notify-btn" title="Browser notifications for stock-quoted launches">${esc(notifyLabel)}</button>
            <button type="button" class="btn" id="refresh-btn" ${state.refreshing ? 'disabled' : ''}>
              ${state.refreshing ? esc(t('refreshing')) : esc(t('refresh'))}
            </button>
          </div>
        </div>
        <div class="meta-bar">
          <span class="pill live ${state.live ? 'on' : ''} ${state.pulse ? 'pulse' : ''}" id="live-status"><span class="dot"></span> ${esc(liveStatusLabel())}</span>
          <span class="pill">${esc(t('updated'))} <strong id="upd-clock">${esc(updatedClockLabel())}</strong></span>
          <span class="pill">${esc(t('launches'))} <strong>${c.all}</strong></span>
          <span class="pill stocks-pill">${esc(t('stocks'))} <strong>${by.stocks ?? c.stocks}</strong></span>
          <span class="pill">${esc(t('usdg'))} <strong>${by.usdg ?? c.usdg}</strong></span>
          <span class="pill">${esc(t('eth'))} <strong>${by.eth ?? c.eth}</strong></span>
        </div>
        ${renderQuoteMix()}
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
                ${filterBtns.map(([f, label]) => `
                  <button type="button" class="filter-btn ${state.filter === f ? 'active' : ''}" data-f="${f}">
                    ${esc(label)}
                  </button>`).join('')}
              </div>
              <div class="extra-filters">
                <label class="toggle-curve">
                  <input type="checkbox" id="curve-only" ${state.onCurveOnly ? 'checked' : ''} />
                  <span>${esc(t('onCurve'))}</span>
                </label>
              </div>
              ${renderQuoteChips()}
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

            <div id="results-root">${renderListArea(rows, c, depCounts)}</div>
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

          ${renderTopDeployers()}

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
          <a href="https://github.com/stockcurve/stockcurve.github.io" target="_blank" rel="noopener noreferrer">${esc(t('github'))}</a>
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

function updateResultsOnly() {
  const root = $('#results-root');
  const statsEl = document.querySelectorAll('.stats .stat .v');
  const c = counts();
  const stats = stripStats();
  const rows = filtered();
  const depCounts = deployerCounts();
  if (root) root.innerHTML = renderListArea(rows, c, depCounts);
  // light stats update
  if (statsEl.length >= 6) {
    statsEl[0].textContent = String(rows.length);
    statsEl[1].textContent = String(c.stocks);
    statsEl[2].textContent = String(c.usdg);
    statsEl[3].textContent = String(c.eth);
    statsEl[4].textContent = String(stats.graduated);
    statsEl[5].textContent = stats.newestAge;
  }
  const shown = document.querySelector('.panel-hd .pill');
  if (shown) shown.textContent = `${rows.length} ${t('shown')}`;
  bindListActions(document);
  writeHash();
}

function copyTextFallback(addr) {
  try {
    const ta = document.createElement('textarea');
    ta.value = addr;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return true;
  } catch { /* ignore */ }
  try {
    window.prompt('Copy contract address:', addr);
    return true;
  } catch {
    return false;
  }
}

async function copyCa(addr, btn) {
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(addr);
      ok = true;
    }
  } catch { /* fall through */ }
  if (!ok) ok = copyTextFallback(addr);
  if (!ok) return;
  const prev = btn.textContent;
  btn.textContent = t('copied');
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = prev;
    btn.classList.remove('copied');
  }, 1200);
}

function bindListActions(scope) {
  scope.querySelectorAll('.star-btn').forEach((btn) => {
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
  scope.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyCa(btn.dataset.copy || '', btn);
    });
  });
}

function bindUi(app) {
  app.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.f;
      if (state.filter !== 'stocks') state.quoteTicker = '';
      render();
    });
  });

  const curveEl = $('#curve-only');
  if (curveEl) {
    curveEl.addEventListener('change', (e) => {
      state.onCurveOnly = !!e.target.checked;
      render();
    });
  }

  app.querySelectorAll('.qchip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.quoteTicker = (btn.dataset.quote || '').toUpperCase();
      if (state.quoteTicker && state.filter !== 'stocks') state.filter = 'stocks';
      render();
    });
  });

  const qEl = $('#q');
  if (qEl) {
    qEl.addEventListener('input', (e) => {
      state.q = e.target.value;
      searchFocusRestore = e.target.selectionStart;
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        updateResultsOnly();
        // restore focus after partial update
        const nq = $('#q');
        if (nq && searchFocusRestore != null) {
          nq.focus();
          try { nq.setSelectionRange(searchFocusRestore, searchFocusRestore); } catch { /* ignore */ }
        }
      }, 150);
    });
  }

  const sortEl = $('#sort');
  if (sortEl) {
    sortEl.addEventListener('change', (e) => {
      state.sort = e.target.value;
      render();
    });
  }

  const liveBtn = $('#live-btn');
  if (liveBtn) {
    liveBtn.addEventListener('click', () => {
      state.live = !state.live;
      localStorage.setItem(LS_LIVE, state.live ? '1' : '0');
      if (state.live) startLive();
      else stopLive();
      render();
    });
  }

  const notifyBtn = $('#notify-btn');
  if (notifyBtn) {
    notifyBtn.addEventListener('click', async () => {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          state.notifyStocks = false;
          localStorage.setItem(LS_NOTIFY, '0');
          render();
          return;
        }
      }
      if (Notification.permission === 'denied') {
        state.notifyStocks = false;
        localStorage.setItem(LS_NOTIFY, '0');
        render();
        return;
      }
      state.notifyStocks = !state.notifyStocks;
      localStorage.setItem(LS_NOTIFY, state.notifyStocks ? '1' : '0');
      render();
    });
  }

  const refreshBtn = $('#refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => { refreshData(true); });
  }

  bindListActions(app);
}

function classifyPair(pairToken) {
  const key = (pairToken || '').toLowerCase();
  const hit = state.quotesRegistry[key];
  if (hit) return { quoteSymbol: hit.symbol, quoteClass: hit.class, quoteName: hit.name, quoteDecimals: hit.decimals };
  // built-in fallbacks
  if (key === ZERO || key === WETH) return { quoteSymbol: key === ZERO ? 'ETH' : 'WETH', quoteClass: 'eth', quoteName: 'ETH', quoteDecimals: 18 };
  return { quoteSymbol: 'UNK', quoteClass: 'unknown', quoteName: 'Unknown quote', quoteDecimals: null };
}

function wordAddress(word) {
  if (!word) return null;
  const hex = String(word).replace(/^0x/, '').padStart(64, '0');
  return `0x${hex.slice(24)}`.toLowerCase();
}

function decodeTokenLaunchedLog(log, style = 'v2') {
  const topics = log.topics || [];
  const data = (log.data || '0x').replace(/^0x/, '');
  const token = wordAddress(topics[1]);
  let curve = null;
  let deployer = null;
  let pairToken = wordAddress(data.slice(0, 64));
  let factory = FACTORY_V2;
  if (style === 'v1style') {
    deployer = wordAddress(topics[2]);
    curve = wordAddress(data.slice(64, 128));
    factory = (log.address || FACTORY_RECENT);
  } else {
    curve = wordAddress(topics[2]);
    deployer = wordAddress(topics[3]);
    factory = (log.address || FACTORY_V2);
  }
  return {
    token,
    curve,
    deployer,
    pairToken,
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber ? parseInt(log.blockNumber, 16) : null,
    factory,
    style,
  };
}

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (res.status === 429) {
    const err = new Error('429');
    err.code = 429;
    throw err;
  }
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j.result;
}

function enrichLaunchRow(raw) {
  const q = classifyPair(raw.pairToken);
  const logo = raw.logo || null;
  let logoUrl = raw.logoUrl || null;
  if (!logoUrl && logo && typeof logo === 'string') {
    if (logo.startsWith('ipfs://')) logoUrl = `https://ipfs.io/ipfs/${logo.slice(7)}`;
    else if (logo.startsWith('http')) logoUrl = logo;
  }
  return {
    token: raw.token,
    name: raw.name || 'Unknown',
    symbol: raw.symbol || '???',
    description: raw.description || '',
    logo,
    logoUrl,
    factory: raw.factory,
    deployer: raw.deployer,
    pool: raw.pool || raw.curve || null,
    pairToken: raw.pairToken,
    transactionHash: raw.transactionHash,
    blockNumber: raw.blockNumber,
    launchedAt: raw.launchedAt || null,
    priceUsd: raw.priceUsd ?? null,
    marketCapUsd: raw.marketCapUsd ?? null,
    liquidityUsd: raw.liquidityUsd ?? null,
    graduated: Boolean(raw.graduated),
    graduationProgressPct: raw.graduationProgressPct ?? null,
    pairedPrincipalEth: raw.pairedPrincipalEth ?? null,
    graduationThresholdEth: raw.graduationThresholdEth ?? null,
    latestBuyAt: raw.latestBuyAt ?? null,
    ...q,
    explorerTokenUrl: `https://robinhoodchain.blockscout.com/token/${raw.token}`,
    explorerTxUrl: raw.transactionHash
      ? `https://robinhoodchain.blockscout.com/tx/${raw.transactionHash}`
      : null,
    explorerDeployerUrl: raw.deployer
      ? `https://robinhoodchain.blockscout.com/address/${raw.deployer}`
      : null,
    ponsUrl: ponsUrlFor(raw.token),
    _live: !!raw._live,
  };
}

function mergeLaunches(incoming, { flash = false, notify = false } = {}) {
  if (!incoming?.length) return 0;
  const map = new Map(state.launches.map((x) => [(x.token || '').toLowerCase(), x]));
  let added = 0;
  const stockNews = [];
  for (const raw of incoming) {
    const row = enrichLaunchRow(raw);
    const key = (row.token || '').toLowerCase();
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      added += 1;
      if (flash) markLiveFlash(key);
      if (notify && row.quoteClass === 'stocks') stockNews.push(row);
    } else {
      map.set(key, {
        ...prev,
        ...Object.fromEntries(Object.entries(row).filter(([, v]) => v != null && v !== '')),
        name: row.name !== 'Unknown' ? row.name : prev.name,
        symbol: row.symbol !== '???' ? row.symbol : prev.symbol,
        launchedAt: row.launchedAt || prev.launchedAt,
        quoteClass: row.quoteClass !== 'unknown' ? row.quoteClass : prev.quoteClass,
        quoteSymbol: row.quoteSymbol !== 'UNK' ? row.quoteSymbol : prev.quoteSymbol,
        _live: prev._live || row._live,
      });
    }
  }
  state.launches = capLaunches([...map.values()]);
  if (stockNews.length && state.notifyStocks && Notification?.permission === 'granted') {
    for (const L of stockNews.slice(0, 3)) {
      try {
        new Notification(`StockCurve · $${L.symbol}`, {
          body: `${L.name} quoted vs ${L.quoteSymbol}`,
          tag: `sc-${(L.token || '').toLowerCase()}`,
        });
      } catch { /* ignore */ }
    }
  }
  return added;
}

/** Apply static feed without wiping newer Live-only discoveries. */
function applyFeedLaunches(list) {
  const feedRows = (list || []).map((x) => enrichLaunchRow(x));
  const feedKeys = new Set(feedRows.map((x) => (x.token || '').toLowerCase()).filter(Boolean));
  const liveOnly = state.launches.filter((x) => {
    const k = (x.token || '').toLowerCase();
    return k && x._live && !feedKeys.has(k);
  });
  const map = new Map(feedRows.map((x) => [(x.token || '').toLowerCase(), x]));
  for (const L of liveOnly) {
    const k = (L.token || '').toLowerCase();
    if (!map.has(k)) map.set(k, L);
  }
  state.launches = capLaunches([...map.values()]);
  knownTokensAtBoot = new Set(
    [...feedKeys, ...liveOnly.map((x) => (x.token || '').toLowerCase())].filter(Boolean),
  );
}

async function hydrateBlockTimestamp(blockNumber) {
  if (blockNumber == null) return null;
  try {
    const block = await rpc('eth_getBlockByNumber', [`0x${Number(blockNumber).toString(16)}`, false]);
    if (block?.timestamp) return new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
  } catch { /* ignore */ }
  return null;
}

async function pollLiveOnce() {
  if (!state.live || document.hidden) return;
  if (Date.now() < liveBackoffUntil) return;
  const myId = ++livePollId;
  state.liveStatus.scanning = true;
  updateLivePill();
  try {
    const blockHex = await rpc('eth_blockNumber');
    if (myId !== livePollId || !state.live) return;
    const latest = parseInt(blockHex, 16);
    state.liveStatus.block = latest;
    if (liveFromBlock == null) liveFromBlock = Math.max(0, latest - 8);
    const from = liveFromBlock;
    const fromHex = `0x${from.toString(16)}`;

    const jobs = [
      { address: FACTORY_V2, topic: TOPIC_V2, style: 'v2' },
      { address: FACTORY_V1, topic: TOPIC_V1STYLE, style: 'v1style' },
      { address: FACTORY_RECENT, topic: TOPIC_V1STYLE, style: 'v1style' },
    ];

    const decoded = [];
    for (const job of jobs) {
      if (myId !== livePollId || !state.live) return;
      try {
        const logs = await rpc('eth_getLogs', [{
          address: job.address,
          fromBlock: fromHex,
          toBlock: 'latest',
          topics: [job.topic],
        }]);
        for (const log of logs || []) {
          const ev = decodeTokenLaunchedLog(log, job.style);
          if (!ev.token) continue;
          decoded.push(ev);
        }
      } catch (e) {
        if (e.code === 429 || /429/.test(String(e.message))) throw e;
        // soft-fail per factory
      }
    }

    if (myId !== livePollId || !state.live) return;

    const fresh = [];
    for (const ev of decoded) {
      const key = ev.token.toLowerCase();
      const exists = state.launches.some((x) => (x.token || '').toLowerCase() === key);
      if (exists && knownTokensAtBoot.has(key)) continue;
      let launchedAt = null;
      if (!exists) launchedAt = await hydrateBlockTimestamp(ev.blockNumber);
      if (myId !== livePollId || !state.live) return;
      fresh.push({
        token: ev.token,
        name: 'Unknown',
        symbol: '???',
        factory: ev.factory,
        deployer: ev.deployer,
        pool: ev.curve,
        pairToken: ev.pairToken,
        transactionHash: ev.transactionHash,
        blockNumber: ev.blockNumber,
        launchedAt,
        graduated: false,
        _live: true,
      });
      if (!exists) state.liveStatus.lastEventAt = launchedAt || new Date().toISOString();
    }

    const added = mergeLaunches(fresh, { flash: true, notify: true });
    if (myId !== livePollId || !state.live) return;
    liveFromBlock = latest;
    state.liveStatus.lastError = null;
    state.liveStatus.failCount = 0;

    // Optional Pons HTTP (CORS may block)
    try {
      const res = await fetch(PONS_API_20, { cache: 'no-store' });
      if (myId !== livePollId || !state.live) return;
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const before = state.launches.length;
          mergeLaunches(data.map((x) => ({ ...x, _live: true })), { flash: true, notify: true });
          if (state.launches.length > before) {
            state.liveStatus.lastEventAt = new Date().toISOString();
          }
        }
      }
    } catch {
      /* CORS or network — silent */
    }

    if (myId !== livePollId || !state.live) return;
    if (added > 0) {
      state.pulse = true;
      setTimeout(() => { state.pulse = false; updateLivePill(); }, 900);
      render();
    } else {
      updateLivePill();
    }
  } catch (e) {
    if (myId !== livePollId) return;
    state.liveStatus.lastError = e.message || String(e);
    state.liveStatus.failCount = (state.liveStatus.failCount || 0) + 1;
    if (e.code === 429 || /429/.test(String(e.message))) {
      liveBackoffUntil = Date.now() + 60_000;
    } else {
      liveBackoffUntil = Date.now() + 20_000;
    }
    if (state.liveStatus.failCount >= LIVE_FAIL_TOAST_AFTER) {
      showToast(t('liveRpcFail'));
    }
    updateLivePill();
  } finally {
    if (myId === livePollId) state.liveStatus.scanning = false;
  }
}

function updateLivePill() {
  const el = $('#live-status');
  if (el) {
    el.classList.toggle('on', state.live);
    el.classList.toggle('pulse', state.pulse);
    el.innerHTML = `<span class="dot"></span> ${esc(liveStatusLabel())}`;
  }
}

function startLive() {
  stopLive();
  if (!state.live || document.hidden) return;
  pollLiveOnce();
  liveTimer = setInterval(pollLiveOnce, LIVE_POLL_MS);
}

function stopLive() {
  livePollId += 1; // invalidate in-flight polls
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
  state.liveStatus.scanning = false;
}

async function loadJson(name, signal) {
  const res = await fetch(`${DATA_BASE}/${name}?t=${Date.now()}`, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`Failed to load ${name} (${res.status})`);
  return res.json();
}

function ingestQuotes(doc) {
  const reg = {};
  const list = doc?.registry || [];
  for (const row of list) {
    if (!row?.address) continue;
    reg[String(row.address).toLowerCase()] = {
      symbol: row.symbol,
      class: row.class,
      name: row.name,
      decimals: row.decimals,
    };
  }
  // always ensure eth
  reg[ZERO] = reg[ZERO] || { symbol: 'ETH', class: 'eth', name: 'Native ETH', decimals: 18 };
  reg[WETH] = reg[WETH] || { symbol: 'WETH', class: 'eth', name: 'Wrapped ETH', decimals: 18 };
  state.quotesRegistry = reg;
}

function maybeDefaultStocks() {
  if (state.defaultedStocks || state.hashHadFilter) return;
  const c = counts();
  if (c.stocks > 0) {
    state.filter = 'stocks';
    state.defaultedStocks = true;
  }
}

async function refreshData(manual = false) {
  const reqId = ++feedReqId;
  if (feedAbort) {
    try { feedAbort.abort(); } catch { /* ignore */ }
  }
  feedAbort = new AbortController();
  const { signal } = feedAbort;
  state.refreshing = true;
  if (manual) render();
  try {
    const [launchesDoc, meta, safe, quotes] = await Promise.all([
      loadJson('launches.json', signal),
      loadJson('meta.json', signal).catch((e) => { if (e.name === 'AbortError') throw e; return null; }),
      loadJson('safe-links.json', signal).catch((e) => { if (e.name === 'AbortError') throw e; return null; }),
      loadJson('quotes.json', signal).catch((e) => { if (e.name === 'AbortError') throw e; return null; }),
    ]);
    if (reqId !== feedReqId) return;
    if (quotes) ingestQuotes(quotes);
    const list = Array.isArray(launchesDoc?.launches)
      ? launchesDoc.launches
      : (Array.isArray(launchesDoc) ? launchesDoc : []);
    // Merge feed into state so Live-only rows are not wiped
    applyFeedLaunches(list);
    state.meta = meta || { updatedAt: launchesDoc?.updatedAt };
    state.safe = safe;
    state.loading = false;
    state.error = null;
    state.clientFetchedAt = new Date().toISOString();
    state.pulse = true;
    setTimeout(() => { state.pulse = false; updateLivePill(); }, 900);
    maybeDefaultStocks();
  } catch (e) {
    if (e.name === 'AbortError' || reqId !== feedReqId) return;
    state.loading = false;
    if (!state.launches.length) state.error = e.message || String(e);
  } finally {
    if (reqId === feedReqId) {
      state.refreshing = false;
      render();
    }
  }
}

function markVisit() {
  const now = Date.now();
  window.addEventListener('pagehide', () => {
    localStorage.setItem(LS_VISIT, String(now));
  });
  if (!state.lastVisit) {
    state.lastVisit = now - 6 * 3600 * 1000;
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
    const map = { '1': 'all', '2': 'stocks', '3': 'usdg', '4': 'eth', '5': 'watch' };
    if (map[e.key]) {
      state.filter = map[e.key];
      render();
    }
  });
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  if (document.hidden) return;
  refreshTimer = setInterval(() => {
    if (!document.hidden) refreshData(false);
  }, REFRESH_MS);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function onVisibilityChange() {
  if (document.hidden) {
    stopLive();
    stopAutoRefresh();
    updateLivePill();
    return;
  }
  startAutoRefresh();
  if (state.live) startLive();
  else updateLivePill();
}

async function boot() {
  parseHash();
  markVisit();
  bindKeyboard();
  window.addEventListener('hashchange', () => {
    parseHash();
    render();
  });
  document.addEventListener('visibilitychange', onVisibilityChange);
  render();
  await refreshData(false);
  startAutoRefresh();
  if (state.live) startLive();
}

boot();
