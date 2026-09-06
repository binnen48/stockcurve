const DATA_BASE = `${import.meta.env.BASE_URL}feed`;
const REFRESH_MS = 45_000;
const LIVE_POLL_MS = 18_000;
const MAX_LAUNCHES = 750;
const LIVE_FAIL_TOAST_AFTER = 3;
const LS_WATCH = 'stockcurve.watchlist';
const LS_VISIT = 'stockcurve.lastVisit';
const LS_LIVE = 'stockcurve.live';
const LS_NOTIFY = 'stockcurve.notifyStocks';

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const PONS_API_20 = 'https://www.ponsfamily.com/api/pons-launches?limit=20';
const PONS_API_100 = 'https://www.ponsfamily.com/api/pons-launches?limit=100';
const FACTORY_V2 = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const FACTORY_RECENT = '0xF4fC0CD27fC8EcF17E55eE4c3f7201897dF3eb75';
const TOPIC_V2 = '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607';
const TOPIC_V1STYLE = '0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a';
const ZERO = '0x0000000000000000000000000000000000000000';
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';

const S = {
  tagline:
    'Tracks new Pons memecoin launches on Robinhood Chain and shows what they are quoted against — tokenized stocks (NVDA, TSLA, …), USDG, or ETH.',
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
  searchPh: 'Search name, $SYMBOL, or address…  (/)',
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
  emptyAll: 'No launches match this filter yet. Try All or clear search.',
  emptyStocks:
    'No launches quoted against tokenized stocks yet. Switch to All, USDG, or ETH to browse other launches.',
  emptyWatch: 'No starred tokens yet. Tap ★ on a card to save it here.',
  emptySearch: 'Nothing matched that search. Try another name, ticker, or address.',
  safeLinks: 'Official links',
  whyTitle: 'Why StockCurve?',
  whyBody:
    'Most Pons tools track $PONS burns. StockCurve watches <strong style="color:var(--text)">which asset a launch is quoted against</strong> — NVDA/TSLA/… tokenized stocks, USDG, or ETH — so RWA-quote discovery is one filter away.',
  whyBody2:
    'Bootstraps once from public static JSON under <code>/feed/</code>. No login. No API keys. Live mode watches Robinhood Chain RPC for new TokenLaunched events; auto-refresh every ~45s pulls the Pons API (or a wider RPC log backfill if CORS blocks) so the list stays current in the browser.',
  disclaimer:
    '<strong>Disclaimer:</strong> Independent community tool — not affiliated with Robinhood or Pons. Not financial advice. DYOR.',
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
  safeFallback: 'Use only these official links — lookalikes are often phishing.',
  safeUnavailable: 'Safe links unavailable.',
  onCurve: 'On curve only',
  notifyBtn: 'Notify on stock launches',
  notifyOn: 'Stock alerts ON',
  notifyDenied: 'Notifications blocked',
  swarm: 'swarm',
  scanning: 'scanning',
  lastEvent: 'last event',
  liveOff: 'Feed only · Live off',
  liveRpcFail: 'Live RPC failing — retrying with backoff. Auto-refresh still tries Pons / RPC backfill.',
  toastDismiss: 'Dismiss',
  fomoTitle: 'New vs stocks',
  heatTitle: 'Hottest quote stocks',
  twinLead: 'Similar names vs different stocks',
  firstStockLead: 'First vs stocks today',
  deployerFlip: 'Deployer switched to stock quotes',
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
let liveBackoffMs = 0; // 18s → 36s → 60s cap on 429
let liveRateLimited = false;
let liveFromBlock = null;
const LIVE_LOOKBACK = 6;
const LIVE_MAX_SPAN = 12;
const LIVE_HYDRATE_LIMIT = 3;
const LIVE_BACKOFF_START = 18_000;
const LIVE_BACKOFF_CAP = 60_000;
const BACKFILL_BLOCKS = 3500;
const BACKFILL_CHUNK = 500;
const FOMO_WINDOW_MS = 2 * 60 * 60 * 1000;
const HEAT_WINDOW_MS = 24 * 60 * 60 * 1000;
const TWIN_WINDOW_MS = 6 * 60 * 60 * 1000;
const HEAT_TOP_N = 8;
let knownTokensAtBoot = new Set();
let feedAbort = null;
let feedReqId = 0;
let livePollId = 0;
let feedBootstrapped = false;
let clientRefreshId = 0;
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
    updateFomoStrip();
  }, 12000);
  liveFlashTimers.set(key, tid);
}

function shortAddr(a) {
  if (!a) return '—';
  const s = String(a);
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function displayName(L) {
  const n = L?.name;
  if (n && n !== 'Unknown' && String(n).trim()) return n;
  const tok = L?.token;
  return tok ? `Token ${shortAddr(tok)}` : 'Token';
}

function displaySymbol(L) {
  const s = L?.symbol;
  if (s && s !== '???' && s !== 'UNK' && String(s).trim()) return s;
  const tok = L?.token;
  return tok ? shortAddr(tok) : '—';
}

function quoteBadgeLabel(L) {
  const cls = L?.quoteClass;
  const sym = L?.quoteSymbol;
  const known = ['stocks', 'usdg', 'eth', 'btc'].includes(cls);
  if (known && sym && sym !== 'UNK') {
    if (cls === 'usdg') return 'vs USDG';
    return `vs ${sym}`;
  }
  const pair = L?.pairToken;
  if (pair) return `vs ${shortAddr(pair)}`;
  if (sym && sym !== 'UNK') return `vs ${sym}`;
  return 'vs quote';
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

function normalizeStem(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\$\s]+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function launchStems(L) {
  const out = [];
  const sym = normalizeStem(L?.symbol);
  const name = normalizeStem(L?.name);
  if (sym && sym.length >= 2) out.push(sym);
  if (name && name.length >= 2 && name !== sym) out.push(name);
  return out;
}

function stemsSimilar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const minLen = 5;
  if (a.length >= minLen && b.length >= minLen && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

/** Hottest tokenized stocks used as quote assets — prefer last 24h, else full dataset. */
function quoteHeatCounts() {
  const cutoff = Date.now() - HEAT_WINDOW_MS;
  const recent = [];
  const all = [];
  for (const L of state.launches) {
    if (L.quoteClass !== 'stocks') continue;
    const sym = (L.quoteSymbol || '').toUpperCase();
    if (!sym || sym === 'UNK') continue;
    all.push(sym);
    const ts = Date.parse(L.launchedAt);
    if (Number.isFinite(ts) && ts >= cutoff) recent.push(sym);
  }
  const pool = recent.length ? recent : all;
  const m = new Map();
  for (const sym of pool) m.set(sym, (m.get(sym) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * Twin radar: 2+ stock-quoted launches in last 6h with similar name/symbol stem
 * but different quote stocks. Returns one compact cluster or null.
 */
function findTwinCluster() {
  const cutoff = Date.now() - TWIN_WINDOW_MS;
  const rows = state.launches
    .filter((L) => {
      if (L.quoteClass !== 'stocks') return false;
      const q = (L.quoteSymbol || '').toUpperCase();
      if (!q || q === 'UNK') return false;
      const ts = Date.parse(L.launchedAt);
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .sort((a, b) => (Date.parse(b.launchedAt) || 0) - (Date.parse(a.launchedAt) || 0));

  for (let i = 0; i < rows.length; i++) {
    const A = rows[i];
    const stemsA = launchStems(A);
    if (!stemsA.length) continue;
    const qa = (A.quoteSymbol || '').toUpperCase();
    for (let j = i + 1; j < rows.length; j++) {
      const B = rows[j];
      const qb = (B.quoteSymbol || '').toUpperCase();
      if (!qb || qb === qa) continue;
      const stemsB = launchStems(B);
      let hit = false;
      for (const sa of stemsA) {
        for (const sb of stemsB) {
          if (stemsSimilar(sa, sb)) { hit = true; break; }
        }
        if (hit) break;
      }
      if (!hit) continue;
      return [A, B];
    }
  }
  return null;
}


/** Local calendar-day start (browser timezone). */
function localDayStartMs(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Earliest stock-quoted launch since local midnight, or null. */
function firstStockToday() {
  const start = localDayStartMs();
  let best = null;
  let bestTs = Infinity;
  for (const L of state.launches) {
    if (L.quoteClass !== 'stocks') continue;
    const ts = Date.parse(L.launchedAt);
    if (!Number.isFinite(ts) || ts < start) continue;
    if (ts < bestTs) {
      bestTs = ts;
      best = L;
    }
  }
  return best;
}

/**
 * Deployers whose newest launch is stock-quoted and who also have an older eth-quoted launch.
 * Returns Map<deployerLower, newestStockTokenLower>.
 */
function deployerStockFlips() {
  const byDep = new Map();
  for (const L of state.launches) {
    const d = (L.deployer || '').toLowerCase();
    if (!d) continue;
    if (!byDep.has(d)) byDep.set(d, []);
    byDep.get(d).push(L);
  }
  const flips = new Map();
  for (const [d, rows] of byDep) {
    if (rows.length < 2) continue;
    const sorted = rows
      .slice()
      .sort((a, b) => (Date.parse(b.launchedAt) || 0) - (Date.parse(a.launchedAt) || 0));
    const newest = sorted[0];
    if (!newest || newest.quoteClass !== 'stocks') continue;
    const hasOlderEth = sorted.slice(1).some((x) => x.quoteClass === 'eth');
    if (!hasOlderEth) continue;
    const tok = (newest.token || '').toLowerCase();
    if (!tok) continue;
    flips.set(d, tok);
  }
  return flips;
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
  if (L.graduationProgressPct == null && !L.pairedPrincipalEth) return '';
  const pct = Math.max(0, Math.min(100, Number(L.graduationProgressPct) || 0));
  return `<div class="grad-bar" title="${pct.toFixed(1)}%"><div class="grad-fill" style="width:${pct}%"></div><span>${pct.toFixed(0)}%</span></div>`;
}

function renderCard(L, depCounts, flipMap = null) {
  const badgeClass = ['stocks', 'usdg', 'eth', 'btc'].includes(L.quoteClass) ? L.quoteClass : 'unknown';
  const initials = esc((displaySymbol(L) || '?').slice(0, 2).replace('…', '?'));
  const tok = (L.token || '').toLowerCase();
  const starred = state.watchlist.has(tok);
  const isNew = isNewSinceVisit(L);
  const isLiveFlash = state.liveFlash.has(tok);
  const dep = L.deployer || '';
  const depKey = dep.toLowerCase();
  const depN = depCounts.get(depKey) || 0;
  const swarm = depN >= 3;
  const flipped = flipMap && depKey && flipMap.get(depKey) === tok;
  const avatar = L.logoUrl
    ? `<img class="avatar" src="${esc(L.logoUrl)}" alt="" loading="lazy" data-ph="${initials}" onerror="this.outerHTML='<div class=\'avatar ph\'>'+this.dataset.ph+'</div>'" />`
    : `<div class="avatar ph">${initials}</div>`;
  const pons = L.ponsUrl || ponsUrlFor(L.token);
  const age = relative(L.launchedAt);
  const desc = (L.description || '').trim();
  const descHtml = desc
    ? `<details class="desc-fold"><summary>About</summary><div class="desc">${esc(desc)}</div></details>`
    : '';

  return `
    <article class="card ${isNew ? 'is-new' : ''} ${isLiveFlash ? 'is-live-flash' : ''} ${badgeClass === 'stocks' ? 'is-stock' : ''}" data-token="${esc(L.token)}">
      ${avatar}
      <div class="card-body">
        <div class="card-top">
          <div class="card-id">
            <button type="button" class="star-btn ${starred ? 'on' : ''}" data-star="${esc(L.token)}" aria-label="Watchlist" title="Watchlist">★</button>
            <div>
              <div class="title-row">
                <span class="title">${esc(displayName(L))}</span>
                ${isLiveFlash ? `<span class="badge live">${esc(t('liveBadge'))}</span>` : ''}
                ${isNew && !isLiveFlash ? `<span class="badge new">${esc(t('newBadge'))}</span>` : ''}
                ${swarm ? `<span class="badge swarm" title="${depN} launches by this deployer">${esc(t('swarm'))} ×${depN}</span>` : ''}
                ${flipped ? `<span class="badge flip" title="${esc(t('deployerFlip'))}">${esc(t('deployerFlip'))}</span>` : ''}
                ${L.graduated ? `<span class="badge grad">${esc(t('graduated'))}</span>` : ''}
              </div>
              <div class="sym">$${esc(displaySymbol(L))} · ${esc(age)}</div>
            </div>
          </div>
          <div class="badges">
            <span class="badge ${badgeClass}">${esc(quoteBadgeLabel(L))}</span>
          </div>
        </div>
        ${progressBar(L)}
        <div class="metrics">
          <span>${esc(t('mcapLabel'))} <strong>${fmtUsd(L.marketCapUsd)}</strong></span>
        </div>
        ${descHtml}
        <div class="links">
          ${L.explorerTokenUrl ? `<a class="chip-link" href="${esc(L.explorerTokenUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('explorer'))}</a>` : ''}
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
  if (document.hidden) return 'Live · paused';
  const coolMs = liveBackoffUntil - Date.now();
  if (coolMs > 0) {
    const secs = Math.max(1, Math.ceil(coolMs / 1000));
    return liveRateLimited
      ? `Live · cooling down · ${secs}s`
      : `Live · retry in ${secs}s`;
  }
  if (state.liveStatus.scanning) return b != null ? `Live · scanning · block ${b}` : 'Live · scanning';
  if (state.liveStatus.failCount >= 3) return 'Live · RPC issues';
  const parts = ['Live'];
  if (b != null) parts.push(`block ${b}`);
  if (last) parts.push(`event ${relative(last)}`);
  else parts.push('watching');
  return parts.join(' · ');
}

function recentStockQuoted(limit = 3) {
  const cutoff = Date.now() - FOMO_WINDOW_MS;
  return state.launches
    .filter((L) => {
      if (L.quoteClass !== 'stocks') return false;
      const ts = Date.parse(L.launchedAt);
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .sort((a, b) => (Date.parse(b.launchedAt) || 0) - (Date.parse(a.launchedAt) || 0))
    .slice(0, limit);
}

function shouldShowFomoStrip() {
  // Show when Live is on or recent stock-quoted launches exist; hide if none.
  const items = recentStockQuoted(3);
  if (!items.length) return false;
  return state.live || items.length > 0;
}

function renderFomoStrip() {
  if (!shouldShowFomoStrip()) return '';
  const items = recentStockQuoted(3);
  if (!items.length) return '';
  return `
    <div class="fomo-strip" id="fomo-strip" aria-label="${esc(t('fomoTitle'))}">
      <div class="fomo-strip-title">${esc(t('fomoTitle'))}</div>
      <div class="fomo-strip-items">
        ${items.map((L) => {
          const tok = (L.token || '').toLowerCase();
          const flash = state.liveFlash.has(tok) ? 'is-flash' : '';
          const sym = displaySymbol(L);
          const vs = (L.quoteSymbol && L.quoteSymbol !== 'UNK') ? L.quoteSymbol : '?';
          return `<button type="button" class="fomo-item ${flash}" data-fomo-token="${esc(L.token)}" data-fomo-symbol="${esc(sym)}" title="Jump to $${esc(sym)}">$${esc(sym)} · vs ${esc(vs)} · ${esc(relative(L.launchedAt))}</button>`;
        }).join('')}
      </div>
    </div>`;
}

function renderFirstStockLine() {
  const L = firstStockToday();
  if (!L) return '';
  const sym = displaySymbol(L);
  const vs = (L.quoteSymbol && L.quoteSymbol !== 'UNK') ? L.quoteSymbol : '?';
  const label = `${t('firstStockLead')}: $${sym} · vs ${vs} · ${relative(L.launchedAt)}`;
  return `
    <div class="first-stock" id="first-stock" role="note">
      <button type="button" class="first-stock-btn" data-first-token="${esc(L.token)}" data-first-symbol="${esc(sym)}" title="Jump to $${esc(sym)}">${esc(label)}</button>
    </div>`;
}

function updateFirstStockLine() {
  const host = document.getElementById('first-stock-host');
  if (!host) return;
  host.innerHTML = renderFirstStockLine();
  bindFirstStockLine(host);
}

function bindFirstStockLine(scope = document) {
  scope.querySelectorAll('.first-stock-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      focusFomoLaunch(btn.dataset.firstToken || '', btn.dataset.firstSymbol || '');
    });
  });
}

function updateFomoStrip() {
  const host = document.getElementById('fomo-strip-host');
  if (!host) return;
  const was = document.activeElement;
  const focusTok = was?.dataset?.fomoToken || null;
  host.innerHTML = renderFomoStrip();
  bindFomoStrip(host);
  if (focusTok) {
    const btn = host.querySelector(`[data-fomo-token="${CSS.escape(focusTok)}"]`);
    btn?.focus();
  }
  updateFirstStockLine();
  updateTwinAlert();
  updateQuoteHeat();
}

function focusFomoLaunch(token, symbol) {
  const tok = (token || '').toLowerCase();
  const findCard = () => [...document.querySelectorAll('.card[data-token]')].find(
    (el) => (el.dataset.token || '').toLowerCase() === tok,
  );
  const highlight = (card) => {
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('is-fomo-focus');
    setTimeout(() => card.classList.remove('is-fomo-focus'), 1600);
  };
  let card = findCard();
  if (card) {
    highlight(card);
    return;
  }
  // Not in current view — set search to symbol so the card appears
  state.q = symbol || state.q;
  if (state.filter !== 'stocks' && state.filter !== 'all') state.filter = 'stocks';
  state.quoteTicker = '';
  render();
  requestAnimationFrame(() => {
    highlight(findCard());
  });
}

function bindFomoStrip(scope = document) {
  scope.querySelectorAll('.fomo-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      focusFomoLaunch(btn.dataset.fomoToken || '', btn.dataset.fomoSymbol || '');
    });
  });
}

function renderQuoteHeat() {
  if (state.filter !== 'stocks') return '';
  const ticks = quoteHeatCounts().slice(0, HEAT_TOP_N);
  if (!ticks.length) return '';
  return `
    <div class="quote-heat" id="quote-heat" aria-label="${esc(t('heatTitle'))}">
      <span class="quote-heat-label">${esc(t('heatTitle'))}</span>
      <span class="quote-heat-items">
        ${ticks.map(([sym, n], i) => `
          <button type="button" class="heat-tick ${state.quoteTicker === sym ? 'active' : ''}" data-quote="${esc(sym)}" title="Filter vs ${esc(sym)}">${esc(sym)} ${n}</button>${i < ticks.length - 1 ? '<span class="heat-sep" aria-hidden="true">·</span>' : ''}
        `).join('')}
      </span>
    </div>`;
}

function renderTwinAlert() {
  const pair = findTwinCluster();
  if (!pair) return '';
  const bits = pair.map((L) => {
    const sym = displaySymbol(L);
    const vs = (L.quoteSymbol && L.quoteSymbol !== 'UNK') ? L.quoteSymbol : '?';
    return `<button type="button" class="twin-item" data-twin-token="${esc(L.token)}" data-twin-symbol="${esc(sym)}" title="Jump to $${esc(sym)}">$${esc(sym)} vs ${esc(vs)}</button>`;
  });
  return `
    <div class="twin-alert" id="twin-alert" role="note">
      <span class="twin-lead">${esc(t('twinLead'))}:</span>
      ${bits.join('<span class="twin-sep">,</span>')}
    </div>`;
}

function updateTwinAlert() {
  const host = document.getElementById('twin-alert-host');
  if (!host) return;
  host.innerHTML = renderTwinAlert();
  bindTwinAlert(host);
}

function updateQuoteHeat() {
  const host = document.getElementById('quote-heat-host');
  if (!host) return;
  host.innerHTML = renderQuoteHeat();
  bindQuoteHeat(host);
}

function bindTwinAlert(scope = document) {
  scope.querySelectorAll('.twin-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      focusFomoLaunch(btn.dataset.twinToken || '', btn.dataset.twinSymbol || '');
    });
  });
}

function bindQuoteHeat(scope = document) {
  scope.querySelectorAll('.heat-tick').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.quoteTicker = (btn.dataset.quote || '').toUpperCase();
      if (state.quoteTicker) state.filter = 'stocks';
      render();
    });
  });
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

function renderListArea(rows, c, depCounts, flipMap = null) {
  if (state.loading) return `<div class="loading">${esc(t('loading'))}</div>`;
  if (state.error) return `<div class="error">${esc(state.error)}</div>`;
  // Don't show stocks empty wrongly when stock-quoted count > 0 but other filters hide rows
  if (rows.length === 0) {
    return `<div class="empty ${state.filter === 'stocks' && c.stocks === 0 ? 'empty-stocks' : ''}">${esc(emptyMessage(c))}</div>`;
  }
  const flips = flipMap || deployerStockFlips();
  return `<div class="list" id="launch-list">${rows.map((L) => renderCard(L, depCounts, flips)).join('')}</div>`;
}

function render() {
  const app = $('#app');
  const c = counts();
  const rows = filtered();
  const depCounts = deployerCounts();
  document.documentElement.lang = 'en';

  const filterBtns = [
    ['all', `${t('all')} (${c.all})`, 'Show every launch'],
    ['stocks', `${t('stocks')} (${c.stocks})`, 'Quoted against tokenized stocks (NVDA, TSLA, …)'],
    ['usdg', `${t('usdg')} (${c.usdg})`, 'Quoted against USDG stablecoin'],
    ['eth', `${t('eth')} (${c.eth})`, 'Quoted against ETH / WETH'],
    ['watch', `★ ${t('watchlist')} (${c.watch})`, 'Your starred tokens'],
  ];
  // Hide Unknown / BTC filter tabs — still classify internally.
  if (state.filter === 'unknown' || state.filter === 'btc') state.filter = 'all';

  const notifyLabel = state.notifyStocks
    ? (Notification?.permission === 'denied' ? t('notifyDenied') : t('notifyOn'))
    : t('notifyBtn');

  const statusPill = state.live
    ? `<span class="pill live on ${state.pulse ? 'pulse' : ''}" id="live-status"><span class="dot"></span> ${esc(liveStatusLabel())}</span>`
    : `<span class="pill" id="live-status">${esc(t('updated'))} <strong id="upd-clock">${esc(updatedClockLabel())}</strong></span>`;

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
          ${statusPill}
          <span class="pill">${rows.length} ${esc(t('shown'))}</span>
        </div>
      </header>

      <div class="layout layout-minimal">
        <main class="panel">
          <div class="panel-bd">
            <div id="fomo-strip-host">${renderFomoStrip()}</div>
            <div id="first-stock-host">${renderFirstStockLine()}</div>
            <div id="twin-alert-host">${renderTwinAlert()}</div>
            <div class="controls">
              <div class="filters" role="tablist" aria-label="Quote class filter">
                ${filterBtns.map(([f, label, tip]) => `
                  <button type="button" class="filter-btn ${state.filter === f ? 'active' : ''}" data-f="${f}" title="${esc(tip || '')}">
                    ${esc(label)}
                  </button>`).join('')}
              </div>
              <div id="quote-heat-host">${renderQuoteHeat()}</div>
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

            <div id="results-root">${renderListArea(rows, c, depCounts)}</div>
          </div>
        </main>

        <aside class="side side-minimal">
          <div class="panel">
            <div class="panel-hd"><h2>${esc(t('safeLinks'))}</h2></div>
            <div class="panel-bd">
              <div class="warn">${esc(state.safe?.warning || t('safeFallback'))}</div>
              <ul class="safe-list">
              ${(state.safe?.links || []).map((L) => `
                <li><a href="${esc(L.url)}" target="_blank" rel="noopener noreferrer">${esc(L.name)}</a></li>`).join('') || `<li class="empty">${esc(t('safeUnavailable'))}</li>`}
              </ul>
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
  // Toast lives on document.body only — never inside #app flow
  renderToast();

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
  const c = counts();
  const rows = filtered();
  const depCounts = deployerCounts();
  const flips = deployerStockFlips();
  if (root) root.innerHTML = renderListArea(rows, c, depCounts, flips);
  const shown = document.querySelector('.meta-bar .pill:last-child');
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
  bindFomoStrip(app);
  bindFirstStockLine(app);
  bindTwinAlert(app);
  bindQuoteHeat(app);
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
  // Always reclassify from live registry (overwrite baked UNK/unknown when registry has a hit).
  const q = classifyPair(raw.pairToken);
  const logo = raw.logo || null;
  let logoUrl = raw.logoUrl || null;
  if (!logoUrl && logo && typeof logo === 'string') {
    if (logo.startsWith('ipfs://')) logoUrl = `https://ipfs.io/ipfs/${logo.slice(7)}`;
    else if (logo.startsWith('http')) logoUrl = logo;
  }
  let name = raw.name || '';
  let symbol = raw.symbol || '';
  if (!name || name === 'Unknown') name = raw.token ? `Token ${shortAddr(raw.token)}` : 'Token';
  if (!symbol || symbol === '???' || symbol === 'UNK') symbol = raw.token ? shortAddr(raw.token) : '—';
  return {
    token: raw.token,
    name,
    symbol,
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
        name: (!row.name || row.name === 'Unknown' || String(row.name).startsWith('Token '))
          ? ((prev.name && prev.name !== 'Unknown') ? prev.name : row.name)
          : row.name,
        symbol: (!row.symbol || row.symbol === '???' || row.symbol === 'UNK')
          ? ((prev.symbol && prev.symbol !== '???') ? prev.symbol : row.symbol)
          : row.symbol,
        launchedAt: row.launchedAt || prev.launchedAt,
        // Prefer freshly classified quote when registry has a hit
        quoteClass: row.quoteClass !== 'unknown' ? row.quoteClass : (prev.quoteClass || row.quoteClass),
        quoteSymbol: row.quoteSymbol !== 'UNK' ? row.quoteSymbol : (prev.quoteSymbol || row.quoteSymbol),
        quoteName: row.quoteClass !== 'unknown' ? row.quoteName : (prev.quoteName || row.quoteName),
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
    if (!map.has(k)) {
      // Reclassify live-only rows against current registry
      const q = classifyPair(L.pairToken);
      map.set(k, { ...L, ...q });
    }
  }
  state.launches = capLaunches([...map.values()].map((row) => {
    const q = classifyPair(row.pairToken);
    if (q.quoteClass === 'unknown' && q.quoteSymbol === 'UNK') return row;
    return { ...row, ...q };
  }));
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
  if (Date.now() < liveBackoffUntil) {
    updateLivePill();
    return;
  }
  const myId = ++livePollId;
  state.liveStatus.scanning = true;
  updateLivePill();
  try {
    const blockHex = await rpc('eth_blockNumber');
    if (myId !== livePollId || !state.live) return;
    const latest = parseInt(blockHex, 16);
    state.liveStatus.block = latest;
    if (liveFromBlock == null) liveFromBlock = Math.max(0, latest - LIVE_LOOKBACK);
    // Cap window so we never scan huge ranges after a long pause
    const from = Math.max(liveFromBlock, Math.max(0, latest - LIVE_MAX_SPAN));
    const fromHex = `0x${from.toString(16)}`;
    const toHex = `0x${latest.toString(16)}`;

    // Prefer active factories only — drop noisy FACTORY_V1 to cut rate-limit pressure
    const jobs = [
      { address: FACTORY_V2, topic: TOPIC_V2, style: 'v2' },
      { address: FACTORY_RECENT, topic: TOPIC_V1STYLE, style: 'v1style' },
    ];

    const decoded = [];
    for (const job of jobs) {
      if (myId !== livePollId || !state.live) return;
      try {
        const logs = await rpc('eth_getLogs', [{
          address: job.address,
          fromBlock: fromHex,
          toBlock: toHex,
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

    // Batch/limit block timestamp hydrates (avoid eth_getBlockByNumber hammering)
    const blockTsCache = new Map();
    let hydrateLeft = LIVE_HYDRATE_LIMIT;
    async function hydrateCached(bn) {
      if (bn == null) return null;
      if (blockTsCache.has(bn)) return blockTsCache.get(bn);
      if (hydrateLeft <= 0) return null;
      hydrateLeft -= 1;
      const iso = await hydrateBlockTimestamp(bn);
      blockTsCache.set(bn, iso);
      return iso;
    }

    const fresh = [];
    for (const ev of decoded) {
      const key = ev.token.toLowerCase();
      const exists = state.launches.some((x) => (x.token || '').toLowerCase() === key);
      if (exists && knownTokensAtBoot.has(key)) continue;
      let launchedAt = null;
      if (!exists) {
        launchedAt = await hydrateCached(ev.blockNumber);
        if (!launchedAt) launchedAt = new Date().toISOString();
      }
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
    liveFromBlock = latest + 1;
    state.liveStatus.lastError = null;
    state.liveStatus.failCount = 0;
    liveBackoffMs = 0;
    liveRateLimited = false;

    if (myId !== livePollId || !state.live) return;
    touchFreshness();
    if (added > 0) {
      state.pulse = true;
      setTimeout(() => { state.pulse = false; updateLivePill(); }, 900);
      render();
    } else {
      updateLivePill();
      updateFomoStrip();
    }
  } catch (e) {
    if (myId !== livePollId) return;
    state.liveStatus.lastError = e.message || String(e);
    state.liveStatus.failCount = (state.liveStatus.failCount || 0) + 1;
    const is429 = e.code === 429 || /429/.test(String(e.message));
    if (is429) {
      liveRateLimited = true;
      liveBackoffMs = liveBackoffMs > 0
        ? Math.min(LIVE_BACKOFF_CAP, liveBackoffMs * 2)
        : LIVE_BACKOFF_START;
      liveBackoffUntil = Date.now() + liveBackoffMs;
      // Calm status pill only — no spammy toasts on rate limits
    } else {
      liveBackoffUntil = Date.now() + 20_000;
      if (state.liveStatus.failCount >= LIVE_FAIL_TOAST_AFTER) {
        showToast(t('liveRpcFail'));
      }
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
  // Reclassify every launch once quotes.json is loaded (overwrite baked UNK/unknown).
  if (state.launches?.length) {
    state.launches = state.launches.map((row) => {
      const q = classifyPair(row.pairToken);
      if (q.quoteSymbol === 'UNK' && q.quoteClass === 'unknown') return row;
      return {
        ...row,
        quoteSymbol: q.quoteSymbol,
        quoteClass: q.quoteClass,
        quoteName: q.quoteName,
        quoteDecimals: q.quoteDecimals,
      };
    });
  }
}

function maybeDefaultStocks() {
  if (state.defaultedStocks || state.hashHadFilter) return;
  const c = counts();
  if (c.stocks <= 0) {
    state.defaultedStocks = true;
    return;
  }
  const stockRows = state.launches.filter((x) => x.quoteClass === 'stocks');
  const realNamed = stockRows.filter((x) => {
    const n = x.name || '';
    const s = x.symbol || '';
    return n && n !== 'Unknown' && !String(n).startsWith('Token ') && s && s !== '???' && s !== 'UNK';
  }).length;
  const majorityReal = stockRows.length > 0 && realNamed / stockRows.length >= 0.5;
  if (majorityReal) state.filter = 'stocks';
  // else keep All — avoid landing on a filter that looks broken/empty
  state.defaultedStocks = true;
}

function touchFreshness(iso = null) {
  const now = iso || new Date().toISOString();
  state.clientFetchedAt = now;
  state.meta = { ...(state.meta || {}), updatedAt: now };
  const clock = $('#upd-clock');
  if (clock) clock.textContent = updatedClockLabel();
}

function parsePonsPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.launches)) return data.launches;
  if (Array.isArray(data?.data)) return data.data;
  return null;
}

async function fetchPonsList(url, signal) {
  const res = await fetch(url, { cache: 'no-store', signal, mode: 'cors' });
  if (!res.ok) throw new Error(`Pons HTTP ${res.status}`);
  const data = await res.json();
  const list = parsePonsPayload(data);
  if (!list) throw new Error('Pons payload shape unexpected');
  return list;
}

/** Try Pons API; prefer limit=100 when CORS allows. Returns null on CORS/network fail. */
async function tryFetchPons(signal) {
  let list20 = null;
  try {
    list20 = await fetchPonsList(PONS_API_20, signal);
  } catch {
    return null;
  }
  try {
    const list100 = await fetchPonsList(PONS_API_100, signal);
    if (list100?.length) return list100;
  } catch {
    /* limit=100 blocked or failed — keep 20 */
  }
  return list20;
}

async function rpcBackfillLogs(signal) {
  const blockHex = await rpc('eth_blockNumber');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const latest = parseInt(blockHex, 16);
  state.liveStatus.block = latest;
  const fromAll = Math.max(0, latest - BACKFILL_BLOCKS);
  const jobs = [
    { address: FACTORY_V2, topic: TOPIC_V2, style: 'v2' },
    { address: FACTORY_RECENT, topic: TOPIC_V1STYLE, style: 'v1style' },
  ];
  const decoded = [];
  for (const job of jobs) {
    for (let start = fromAll; start <= latest; start += BACKFILL_CHUNK) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const end = Math.min(latest, start + BACKFILL_CHUNK - 1);
      try {
        const logs = await rpc('eth_getLogs', [{
          address: job.address,
          fromBlock: `0x${start.toString(16)}`,
          toBlock: `0x${end.toString(16)}`,
          topics: [job.topic],
        }]);
        for (const log of logs || []) {
          const ev = decodeTokenLaunchedLog(log, job.style);
          if (!ev.token) continue;
          decoded.push(ev);
        }
      } catch (e) {
        if (e.code === 429 || /429/.test(String(e.message))) break;
        /* soft-fail per chunk */
      }
    }
  }
  if (!decoded.length) return 0;
  const fresh = decoded.map((ev) => ({
    token: ev.token,
    name: 'Unknown',
    symbol: '???',
    factory: ev.factory,
    deployer: ev.deployer,
    pool: ev.curve,
    pairToken: ev.pairToken,
    transactionHash: ev.transactionHash,
    blockNumber: ev.blockNumber,
    launchedAt: null,
    graduated: false,
    _live: true,
  }));
  return mergeLaunches(fresh, { flash: true, notify: true });
}

/** One-time bootstrap from static /feed/*.json cache. Never wipes Live rows. */
async function bootstrapFeed() {
  const reqId = ++feedReqId;
  if (feedAbort) {
    try { feedAbort.abort(); } catch { /* ignore */ }
  }
  feedAbort = new AbortController();
  const { signal } = feedAbort;
  state.refreshing = true;
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
    applyFeedLaunches(list);
    state.meta = meta || { updatedAt: launchesDoc?.updatedAt };
    state.safe = safe;
    state.loading = false;
    state.error = null;
    state.clientFetchedAt = new Date().toISOString();
    feedBootstrapped = true;
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

/**
 * Self-sufficient client refresh (browser-only):
 * 1) Try Pons API limit=20 (and limit=100 if CORS allows)
 * 2) If CORS/network blocks → wider RPC eth_getLogs backfill on factories
 * Soft-fail; never wipe Live rows.
 */
async function refreshLiveData(manual = false) {
  const reqId = ++clientRefreshId;
  if (feedAbort) {
    try { feedAbort.abort(); } catch { /* ignore */ }
  }
  feedAbort = new AbortController();
  const { signal } = feedAbort;
  state.refreshing = true;
  if (manual) render();
  try {
    const pons = await tryFetchPons(signal);
    if (reqId !== clientRefreshId) return;
    if (pons) {
      const before = state.launches.length;
      const added = mergeLaunches(
        pons.map((x) => ({ ...x, _live: true })),
        { flash: true, notify: true },
      );
      if (added > 0 || state.launches.length !== before) {
        state.liveStatus.lastEventAt = new Date().toISOString();
      }
      touchFreshness();
      state.pulse = true;
      setTimeout(() => { state.pulse = false; updateLivePill(); }, 900);
      state.error = null;
      return;
    }
    // CORS / network blocked Pons — wider RPC log backfill
    const added = await rpcBackfillLogs(signal);
    if (reqId !== clientRefreshId) return;
    touchFreshness();
    if (added > 0) {
      state.liveStatus.lastEventAt = new Date().toISOString();
      state.pulse = true;
      setTimeout(() => { state.pulse = false; updateLivePill(); }, 900);
    }
    state.error = null;
  } catch (e) {
    if (e.name === 'AbortError' || reqId !== clientRefreshId) return;
    // Soft-fail: keep existing Live / bootstrapped rows
  } finally {
    if (reqId === clientRefreshId) {
      state.refreshing = false;
      render();
    }
  }
}

/** Manual refresh: self-sufficient path; re-bootstrap static only if never loaded. */
async function refreshData(manual = false) {
  if (!feedBootstrapped && !state.launches.length) {
    await bootstrapFeed();
    if (!feedBootstrapped && !state.launches.length) return;
  }
  await refreshLiveData(manual);
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
    if (!document.hidden) refreshLiveData(false);
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
  await bootstrapFeed();
  startAutoRefresh();
  if (state.live) startLive();
  // Kick one self-sufficient refresh after bootstrap (Pons or RPC backfill)
  refreshLiveData(false);
}

boot();
