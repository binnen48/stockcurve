#!/usr/bin/env node
/**
 * StockCurve data refresh — free public sources only (Pons Family API + static quote registry).
 * Writes public/data/{launches,quotes,safe-links,meta}.json
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data');
const LAUNCHES_URL = 'https://www.ponsfamily.com/api/pons-launches?limit=100';
const HIST_URL = 'https://www.ponsfamily.com/api/pons-launches';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';
const ZERO = '0x0000000000000000000000000000000000000000';

/** Quote registry: lowercase address -> { symbol, class: 'eth'|'usdg'|'stocks'|'btc', name } */
const QUOTE_REGISTRY = {
  [ZERO]: { symbol: 'ETH', class: 'eth', name: 'Native ETH', decimals: 18 },
  [WETH]: { symbol: 'WETH', class: 'eth', name: 'Wrapped ETH', decimals: 18 },
  '0x5fc5360d0400a0fd4f2af552add042d716f1d168': { symbol: 'USDG', class: 'usdg', name: 'USDG Stablecoin', decimals: 6 },
  '0xcec185eb182c47d1ba1efc84e6959e18cd620be4': { symbol: 'cbBTC', class: 'btc', name: 'Coinbase Wrapped BTC', decimals: 8 },
  // Tokenized stocks / ETFs (Bitquery Pons docs snapshot)
  '0xaf3d76f1834a1d425780943c99ea8a608f8a93f9': { symbol: 'AAPL', class: 'stocks', name: 'Apple', decimals: 18 },
  '0x86923f96303d656e4aa86d9d42d1e57ad2023fdc': { symbol: 'AMD', class: 'stocks', name: 'AMD', decimals: 18 },
  '0x12f190a9f9d7d37a250758b26824b97ce941bf54': { symbol: 'AMZN', class: 'stocks', name: 'Amazon', decimals: 18 },
  '0x48e39e56acdba37b09020c0b734a613c9a2f100a': { symbol: 'BB', class: 'stocks', name: 'BlackBerry', decimals: 18 },
  '0x6330d8c3178a418788df01a47479c0ce7ccf450b': { symbol: 'COIN', class: 'stocks', name: 'Coinbase', decimals: 18 },
  '0x4ea005168d7f09a7a0ba9d1def21a479950e44c2': { symbol: 'COST', class: 'stocks', name: 'Costco', decimals: 18 },
  '0xdf0992e440dd0be65bd8439b609d6d4366bf1cb5': { symbol: 'CRCL', class: 'stocks', name: 'Circle', decimals: 18 },
  '0x941ae714ec6d8130c7b75d67160ca08f1e7d11dd': { symbol: 'DELL', class: 'stocks', name: 'Dell', decimals: 18 },
  '0x1d11f0496982706c5e14a514d4e79f2e6bde4516': { symbol: 'DJT', class: 'stocks', name: 'Trump Media', decimals: 18 },
  '0xc9a981fee1f9dec688bb123ccdecc63d0debfc4e': { symbol: 'GLD', class: 'stocks', name: 'SPDR Gold', decimals: 18 },
  '0x1b0e319c6a659f002271b69db8a7df2f911c153e': { symbol: 'GME', class: 'stocks', name: 'GameStop', decimals: 18 },
  '0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3': { symbol: 'GOOGL', class: 'stocks', name: 'Alphabet', decimals: 18 },
  '0xccee82fe024c36fa15e1005ede3e9e4787e23d09': { symbol: 'HIMS', class: 'stocks', name: 'Hims & Hers', decimals: 18 },
  '0x8005d266423c7ea827372c9c864491e5786600ea': { symbol: 'LLY', class: 'stocks', name: 'Eli Lilly', decimals: 18 },
  '0xc0d6457c16cc70d6790dd43521c899c87ce02f35': { symbol: 'META', class: 'stocks', name: 'Meta', decimals: 18 },
  '0xe93237c50d904957cf27e7b1133b510c669c2e74': { symbol: 'MSFT', class: 'stocks', name: 'Microsoft', decimals: 18 },
  '0xec262a75e413fafd0df80480274532c79d42da09': { symbol: 'MSTR', class: 'stocks', name: 'MicroStrategy', decimals: 18 },
  '0xff080c8ce2e5feadaca0da81314ae59d232d4afd': { symbol: 'MU', class: 'stocks', name: 'Micron', decimals: 18 },
  '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec': { symbol: 'NVDA', class: 'stocks', name: 'NVIDIA', decimals: 18 },
  '0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a': { symbol: 'PLTR', class: 'stocks', name: 'Palantir', decimals: 18 },
  '0xd5f3879160bc7c32ebb4dc785f8a4f505888de68': { symbol: 'QQQ', class: 'stocks', name: 'Invesco QQQ', decimals: 18 },
  '0xf0c4bf4c582cb3836e98394b1d4e7b7281101be8': { symbol: 'RBLX', class: 'stocks', name: 'Roblox', decimals: 18 },
  '0x05b37fb53a299a1b874a619e1c4c404d52c36f4c': { symbol: 'RDDT', class: 'stocks', name: 'Reddit', decimals: 18 },
  '0x84cab63bc87912e71ad199ff14a0ba45de68fef8': { symbol: 'SKHY', class: 'stocks', name: 'SK Hynix', decimals: 18 },
  '0xb90a19ff0af67f7779aff50a882a9cff42446400': { symbol: 'SNDK', class: 'stocks', name: 'Sandisk', decimals: 18 },
  '0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea': { symbol: 'SPCX', class: 'stocks', name: 'SPCX', decimals: 18 },
  '0x117cc2133c37b721f49de2a7a74833232b3b4c0c': { symbol: 'SPY', class: 'stocks', name: 'SPDR S&P 500', decimals: 18 },
  '0x322f0929c4625ed5bad873c95208d54e1c003b2d': { symbol: 'TSLA', class: 'stocks', name: 'Tesla', decimals: 18 },
  '0x58ffe4a942d3885baa22d7520691f611ef09e7aa': { symbol: 'TSM', class: 'stocks', name: 'TSMC', decimals: 18 },
  '0x5e81213613b6b86eab4c6c50d718d34359459786': { symbol: 'TTWO', class: 'stocks', name: 'Take-Two', decimals: 18 },
  '0xa30fa36db767ad9ed3f7a60fc79526fb4d56d344': { symbol: 'USO', class: 'stocks', name: 'US Oil Fund', decimals: 18 },
  '0x9e7abd3c9139d14e4c86dce0e455aab7a0c2fb3e': { symbol: 'WYFI', class: 'stocks', name: 'WYFI', decimals: 18 },
};

const SAFE_LINKS = [
  {
    name: 'Pons Family',
    url: 'https://www.ponsfamily.com/',
    blurb: 'Official Pons launchpad on Robinhood Chain.',
  },
  {
    name: 'Robinhood Chain',
    url: 'https://robinhood.com/us/en/chain/',
    blurb: 'Official Robinhood Chain hub.',
  },
  {
    name: 'Robinhood Chain Explorer',
    url: 'https://robinhoodchain.blockscout.com/',
    blurb: 'Official Blockscout explorer for chain ID 4663.',
  },
  {
    name: 'FOMO (App Store)',
    url: 'https://apps.apple.com/us/app/fomo-never-miss-out/id6741115427',
    blurb: 'Official FOMO iOS app — Never Miss Out.',
  },
];

const FACTORIES = [
  '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB', // v1
  '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e', // v2
  '0xF4fC0CD27fC8EcF17E55eE4c3f7201897dF3eb75', // recent API
];

async function fetchJson(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'StockCurve/1.0 (+https://github.com/binnen48/stockcurve)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j.result;
}

function classifyPair(pairToken) {
  const key = (pairToken || '').toLowerCase();
  const hit = QUOTE_REGISTRY[key];
  if (hit) return { quoteSymbol: hit.symbol, quoteClass: hit.class, quoteName: hit.name, quoteDecimals: hit.decimals };
  return { quoteSymbol: 'UNK', quoteClass: 'unknown', quoteName: 'Unknown quote', quoteDecimals: null };
}

function normalizeLaunch(raw) {
  const pair = (raw.pairToken || '').toLowerCase();
  const q = classifyPair(pair);
  const logo = raw.logo || null;
  let logoUrl = null;
  if (logo && typeof logo === 'string') {
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
    pool: raw.pool,
    pairToken: raw.pairToken,
    transactionHash: raw.transactionHash,
    blockNumber: raw.blockNumber,
    launchedAt: raw.launchedAt,
    initialBuyWei: raw.initialBuyWei,
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
    ponsUrl: `https://www.ponsfamily.com/`,
  };
}

function mergeByToken(recent, historical) {
  const map = new Map();
  for (const item of historical) {
    if (item?.token) map.set(item.token.toLowerCase(), item);
  }
  // Prefer recent (fresher market data)
  for (const item of recent) {
    if (item?.token) map.set(item.token.toLowerCase(), item);
  }
  return [...map.values()].sort((a, b) => {
    const ta = a.launchedAt ? Date.parse(a.launchedAt) : 0;
    const tb = b.launchedAt ? Date.parse(b.launchedAt) : 0;
    return tb - ta;
  });
}

async function tryRpcProbe() {
  try {
    const [chainId, block] = await Promise.all([
      rpc('eth_chainId'),
      rpc('eth_blockNumber'),
    ]);
    return {
      ok: true,
      chainId: parseInt(chainId, 16),
      blockNumber: parseInt(block, 16),
      factories: FACTORIES,
      note: 'RPC reachable. Quote class comes from pairToken registry; eth_getLogs enrichment optional.',
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const errors = [];
  let recent = [];
  let historical = [];

  try {
    const data = await fetchJson(LAUNCHES_URL);
    recent = Array.isArray(data) ? data : [];
    console.log(`Recent launches: ${recent.length}`);
  } catch (e) {
    errors.push(`recent: ${e.message || e}`);
    console.error('Recent fetch failed:', e.message || e);
  }

  try {
    const data = await fetchJson(HIST_URL, 45000);
    historical = Array.isArray(data) ? data : [];
    console.log(`Historical launches: ${historical.length}`);
  } catch (e) {
    errors.push(`historical: ${e.message || e}`);
    console.error('Historical fetch failed:', e.message || e);
  }

  const merged = mergeByToken(recent, historical);
  // Cap payload for Pages: keep newest 400 + any non-ETH quotes always
  const nonEth = merged.filter((x) => classifyPair(x.pairToken).quoteClass !== 'eth');
  const ethOnly = merged.filter((x) => classifyPair(x.pairToken).quoteClass === 'eth');
  const capped = [...nonEth, ...ethOnly].filter((x, i, arr) => {
    const k = x.token.toLowerCase();
    return arr.findIndex((y) => y.token.toLowerCase() === k) === i;
  });
  const launchesRaw = capped.slice(0, 500);
  const launches = launchesRaw.map(normalizeLaunch);

  const byClass = { eth: 0, usdg: 0, stocks: 0, btc: 0, unknown: 0 };
  for (const L of launches) byClass[L.quoteClass] = (byClass[L.quoteClass] || 0) + 1;

  const rpcInfo = await tryRpcProbe();

  const quotes = {
    updatedAt: new Date().toISOString(),
    registry: Object.entries(QUOTE_REGISTRY).map(([address, meta]) => ({
      address,
      ...meta,
    })),
  };

  const safeLinks = {
    updatedAt: new Date().toISOString(),
    warning:
      'Only use the official links below. Lookalike domains, fake apps, and “support” DMs are common phishing vectors for Pons / Robinhood Chain / FOMO traders.',
    links: SAFE_LINKS,
  };

  const meta = {
    updatedAt: new Date().toISOString(),
    source: {
      recent: LAUNCHES_URL,
      historical: HIST_URL,
      rpc: RPC,
    },
    counts: {
      launches: launches.length,
      recentFetched: recent.length,
      historicalFetched: historical.length,
      byQuoteClass: byClass,
      stockQuoted: byClass.stocks,
      usdgQuoted: byClass.usdg,
    },
    rpc: rpcInfo,
    errors,
    disclaimer:
      'StockCurve is an independent community tool. Not affiliated with Robinhood, Pons Labs, or FOMO. Not financial advice.',
  };

  await writeFile(join(OUT, 'launches.json'), JSON.stringify({ updatedAt: meta.updatedAt, launches }, null, 2));
  await writeFile(join(OUT, 'quotes.json'), JSON.stringify(quotes, null, 2));
  await writeFile(join(OUT, 'safe-links.json'), JSON.stringify(safeLinks, null, 2));
  await writeFile(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(JSON.stringify(meta.counts, null, 2));
  if (errors.length) {
    console.warn('Completed with soft errors:', errors);
    // Soft failure: still exit 0 so Pages can deploy last-good + empty-friendly UI if needed
    // Hard fail only if we have zero launches
    if (launches.length === 0) process.exit(1);
  }
  console.log('Wrote public/data/*.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
