#!/usr/bin/env node
/**
 * StockCurve data refresh — free public sources only (Pons Family API + static quote registry + optional RPC logs).
 * Writes public/feed/{launches,quotes,safe-links,meta}.json
 *
 * Factories (Robinhood Chain 4663):
 *   v1 (superseded): 0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB
 *   v2 launch:       0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e
 *   recent API / alt: 0xF4fC0CD27fC8EcF17E55eE4c3f7201897dF3eb75
 *
 * V2 TokenLaunched topic0 (keccak of signature):
 *   TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)
 *   = 0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'feed');
const LAUNCHES_LIMIT_100 = 'https://www.ponsfamily.com/api/pons-launches?limit=100';
const LAUNCHES_LIMIT_20 = 'https://www.ponsfamily.com/api/pons-launches?limit=20';
const HIST_URL = 'https://www.ponsfamily.com/api/pons-launches';
const BITQUERY_PONS_DOCS = 'https://docs.bitquery.io/docs/blockchain/robinhood/pons-api/';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';
const ZERO = '0x0000000000000000000000000000000000000000';

const FACTORY_V1 = '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB';
const FACTORY_V2 = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const FACTORY_RECENT = '0xF4fC0CD27fC8EcF17E55eE4c3f7201897dF3eb75';
const FACTORIES = [FACTORY_V1, FACTORY_V2, FACTORY_RECENT];

/** V2 TokenLaunched topic0 from Bitquery / verified ABI */
const TOPIC_TOKEN_LAUNCHED_V2 =
  '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607';
/** Recent/API factory uses V1-style TokenLaunched topic0 */
const TOPIC_TOKEN_LAUNCHED_V1STYLE =
  '0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a';

/** Quote registry: lowercase address -> { symbol, class, name, decimals } */
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

async function fetchJson(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'StockCurve/1.1 (+https://github.com/binnen48/stockcurve)',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'StockCurve/1.1 (+https://github.com/binnen48/stockcurve)',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
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
    explorerDeployerUrl: raw.deployer
      ? `https://robinhoodchain.blockscout.com/address/${raw.deployer}`
      : null,
    ponsUrl: raw.token
      ? `https://www.ponsfamily.com/launchpad?token=${raw.token}`
      : 'https://www.ponsfamily.com/',
  };
}

function mergeByToken(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const item of list) {
      if (item?.token) map.set(item.token.toLowerCase(), item);
    }
  }
  return [...map.values()].sort((a, b) => {
    const ta = a.launchedAt ? Date.parse(a.launchedAt) : 0;
    const tb = b.launchedAt ? Date.parse(b.launchedAt) : 0;
    return tb - ta;
  });
}

function wordAddress(word) {
  if (!word) return null;
  const hex = String(word).replace(/^0x/, '').padStart(64, '0');
  return `0x${hex.slice(24)}`.toLowerCase();
}

/**
 * Decode TokenLaunched logs for V2 and recent/V1-style factories.
 * V2: topics[1]=token, [2]=curve, [3]=deployer; data pairToken,launchConfigId,graduationThreshold
 * Recent/V1-style: topics[1]=token, [2]=deployer, [3]=?; data pairToken, pool, ...
 */
function decodeTokenLaunchedLog(log, style = 'v2') {
  const topics = log.topics || [];
  const data = (log.data || '0x').replace(/^0x/, '');
  const token = wordAddress(topics[1]);
  let curve = null;
  let deployer = null;
  let pairToken = wordAddress(data.slice(0, 64));
  let launchConfigId = null;
  let graduationThreshold = null;
  let factory = FACTORY_V2;
  if (style === 'v1style') {
    deployer = wordAddress(topics[2]);
    curve = wordAddress(data.slice(64, 128)); // pool often in word1
    factory = (log.address || FACTORY_RECENT);
    // Normalize native ETH sentinel to WETH for registry classify convenience? keep ZERO.
  } else {
    curve = wordAddress(topics[2]);
    deployer = wordAddress(topics[3]);
    launchConfigId = data.slice(64, 128) ? BigInt(`0x${data.slice(64, 128)}`).toString() : null;
    graduationThreshold = data.slice(128, 192) ? BigInt(`0x${data.slice(128, 192)}`).toString() : null;
    factory = (log.address || FACTORY_V2);
  }
  return {
    token,
    curve,
    deployer,
    pairToken,
    launchConfigId,
    graduationThreshold,
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber ? parseInt(log.blockNumber, 16) : null,
    factory,
    style,
  };
}

async function fetchLogs(address, topic, from, latest) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt) await sleep(400 * attempt);
      return await rpc('eth_getLogs', [{
        address,
        fromBlock: `0x${from.toString(16)}`,
        toBlock: 'latest',
        topics: [topic],
      }]);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function tryExpandQuotesFromBitqueryDocs() {
  const added = [];
  try {
    const html = await fetchText(BITQUERY_PONS_DOCS, 30000);
    // Match table-ish rows: SYMBOL ... 0xaddr
    const re = /\b([A-Z]{2,6})\b[\s\S]{0,80}?(0x[a-fA-F0-9]{40})/g;
    let m;
    const knownAddrs = new Set(Object.keys(QUOTE_REGISTRY));
    const skip = new Set([
      FACTORY_V1.toLowerCase(),
      FACTORY_V2.toLowerCase(),
      FACTORY_RECENT.toLowerCase(),
      WETH,
      ZERO,
      '0xe5e702641ea86f4ae6cc3cdaed2b886f976be044',
      '0xe33e9e479df8802cb0866d5d05258bec4cf62948',
      '0x267444d099b10fb5ed7c3cc7b7c767adca574952',
      '0x8366a39cc670b4001a1121b8f6a443a643e40951',
      '0xd3afeb2a57f70ef218aa82451c51b2fb0416ac9e',
      '0x42df2a798f82289e177311362e8f5ccc45c1219c',
      '0xc7819b64a1daecd7ec19856d026cb14efbd89046',
      '0xf5695117b99b6f6401e67d4195bd653628176c6c',
      '0x3711cea4feade896c913c68f01eda97cb06d1a42',
      '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
      '0xcec185eb182c47d1ba1efc84e6959e18cd620be4',
    ]);
    // Prefer explicit stock tickers from docs table section near "AAPL" etc.
    const stockSyms = new Set([
      'AAPL','AMD','AMZN','BB','COIN','COST','CRCL','DELL','DJT','GLD','GME','GOOGL','HIMS',
      'LLY','META','MSFT','MSTR','MU','NVDA','PLTR','QQQ','RBLX','RDDT','SKHY','SNDK','SPCX',
      'SPY','TSLA','TSM','TTWO','USO','WYFI','NFLX','HOOD','INTC','BABA','DIS','UBER','SHOP',
      'ARM','AVGO','ORCL','CRM','NOW','SNOW','PANW','ABNB','SQ','PYPL','XOM','JPM','BAC','V',
    ]);
    while ((m = re.exec(html))) {
      const symbol = m[1];
      const address = m[2].toLowerCase();
      if (!stockSyms.has(symbol)) continue;
      if (skip.has(address) || knownAddrs.has(address)) continue;
      // Avoid mistaking random nearby contract for stock if symbol already mapped
      const alreadySym = Object.values(QUOTE_REGISTRY).some((x) => x.symbol === symbol && x.class === 'stocks');
      if (alreadySym) continue;
      QUOTE_REGISTRY[address] = { symbol, class: 'stocks', name: symbol, decimals: 18 };
      knownAddrs.add(address);
      added.push({ symbol, address });
    }
  } catch (e) {
    return { ok: false, error: String(e.message || e), added };
  }
  return { ok: true, added, source: BITQUERY_PONS_DOCS };
}

async function enrichPairTokenFromReceipts(launches, limit = 120) {
  const out = launches.slice();
  const targets = out
    .filter((x) => x?.transactionHash && x?.token)
    .slice(0, limit);
  let ok = 0;
  let fail = 0;
  const TOPIC = TOPIC_TOKEN_LAUNCHED_V1STYLE.toLowerCase();
  const TOPIC_V2 = TOPIC_TOKEN_LAUNCHED_V2.toLowerCase();
  // modest concurrency
  const queue = targets.slice();
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      try {
        const receipt = await rpc('eth_getTransactionReceipt', [item.transactionHash]);
        const logs = receipt?.logs || [];
        const hit = logs.find((l) => {
          const t0 = (l.topics?.[0] || '').toLowerCase();
          return t0 === TOPIC || t0 === TOPIC_V2;
        });
        if (!hit) continue;
        const data = (hit.data || '0x').replace(/^0x/, '');
        const pair = wordAddress(data.slice(0, 64));
        if (pair) {
          item.pairToken = pair;
          ok += 1;
        }
      } catch {
        fail += 1;
      }
      await sleep(60);
    }
  }
  await Promise.all([worker(), worker()]);
  return { launches: out, ok, fail, attempted: targets.length };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function hydrateStubMetadata(launches, limit = 60) {
  const stubs = launches.filter((x) => x && (x._stub || x.name === 'Unknown' || x.symbol === '???') && x.token);
  const targets = stubs.slice(0, limit);
  let ok = 0;
  function decodeString(hex) {
    const h = String(hex || '').replace(/^0x/, '');
    if (h.length < 128) return null;
    const len = parseInt(h.slice(64, 128), 16);
    if (!Number.isFinite(len) || len <= 0 || len > 128) return null;
    const data = h.slice(128, 128 + len * 2);
    return Buffer.from(data, 'hex').toString('utf8').replace(/\0/g, '').trim();
  }
  for (const item of targets) {
    try {
      const [nameHex, symHex] = await Promise.all([
        rpc('eth_call', [{ to: item.token, data: '0x06fdde03' }, 'latest']),
        rpc('eth_call', [{ to: item.token, data: '0x95d89b41' }, 'latest']),
      ]);
      const name = decodeString(nameHex);
      const symbol = decodeString(symHex);
      if (name) item.name = name;
      if (symbol) item.symbol = symbol;
      if (name || symbol) ok += 1;
      delete item._stub;
    } catch {
      /* rate limit / revert */
    }
    await sleep(40);
  }
  return { ok, attempted: targets.length };
}

async function tryEthGetLogsTokenLaunched() {
  try {
    const blockHex = await rpc('eth_blockNumber');
    const latest = parseInt(blockHex, 16);
    // Keep ranges modest for public RPC (~half day)
    const fromV2 = Math.max(0, latest - 15_000);
    const fromRecent = Math.max(0, latest - 20_000);
    const errors = [];
    let logsV2 = [];
    let logsRecent = [];
    try {
      logsV2 = await fetchLogs(FACTORY_V2, TOPIC_TOKEN_LAUNCHED_V2, fromV2, latest);
    } catch (e) {
      errors.push(`v2: ${e.message || e}`);
    }
    await sleep(300);
    try {
      logsRecent = await fetchLogs(FACTORY_RECENT, TOPIC_TOKEN_LAUNCHED_V1STYLE, fromRecent, latest);
    } catch (e) {
      errors.push(`recent: ${e.message || e}`);
    }
    const decoded = [
      ...(Array.isArray(logsV2) ? logsV2 : []).map((l) => decodeTokenLaunchedLog(l, 'v2')),
      ...(Array.isArray(logsRecent) ? logsRecent : []).map((l) => decodeTokenLaunchedLog(l, 'v1style')),
    ].filter((x) => x.token);
    return {
      ok: true,
      count: decoded.length,
      fromBlock: Math.min(fromV2, fromRecent),
      toBlock: latest,
      topicV2: TOPIC_TOKEN_LAUNCHED_V2,
      topicRecent: TOPIC_TOKEN_LAUNCHED_V1STYLE,
      factories: { v2: FACTORY_V2, recent: FACTORY_RECENT },
      counts: { v2: Array.isArray(logsV2) ? logsV2.length : 0, recent: Array.isArray(logsRecent) ? logsRecent.length : 0 },
      softErrors: errors,
      samples: decoded.slice(0, 5).map((x) => ({
        token: x.token,
        pairToken: x.pairToken,
        deployer: x.deployer,
        tx: x.transactionHash,
        style: x.style,
      })),
      decoded,
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e.message || e),
      topicV2: TOPIC_TOKEN_LAUNCHED_V2,
      topicRecent: TOPIC_TOKEN_LAUNCHED_V1STYLE,
      factories: { v2: FACTORY_V2, recent: FACTORY_RECENT },
      note: 'eth_getLogs optional enrichment; API launches remain primary.',
    };
  }
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
      factories: {
        v1: FACTORY_V1,
        v2: FACTORY_V2,
        recentApi: FACTORY_RECENT,
        all: FACTORIES,
      },
      tokenLaunchedTopicV2: TOPIC_TOKEN_LAUNCHED_V2,
      note: 'RPC reachable. Quote class from pairToken registry; eth_getLogs TokenLaunched enrichment attempted when available.',
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e), factories: FACTORIES };
  }
}

async function loadPreviousLaunches() {
  try {
    const raw = await readFile(join(OUT, 'launches.json'), 'utf8');
    const doc = JSON.parse(raw);
    return Array.isArray(doc?.launches) ? doc.launches : [];
  } catch {
    return [];
  }
}


async function fillLaunchedAtFromBlocks(launches, concurrency = 3) {
  const need = launches.filter((x) => !x.launchedAt && x.blockNumber != null);
  if (!need.length) return { filled: 0, attempted: 0 };
  const cache = new Map();
  let filled = 0;
  let i = 0;
  async function fetchBlockIso(bn) {
    if (cache.has(bn)) return cache.get(bn);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        if (attempt) await sleep(600 * attempt);
        const block = await rpc('eth_getBlockByNumber', [`0x${bn.toString(16)}`, false]);
        if (block?.timestamp) {
          const iso = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
          cache.set(bn, iso);
          return iso;
        }
        return null;
      } catch {
        /* retry */
      }
    }
    return null;
  }
  async function worker() {
    while (i < need.length) {
      const idx = i++;
      const item = need[idx];
      const bn = Number(item.blockNumber);
      if (!Number.isFinite(bn)) continue;
      const iso = await fetchBlockIso(bn);
      if (iso) {
        item.launchedAt = iso;
        filled += 1;
      }
      await sleep(80);
    }
  }
  const n = Math.min(concurrency, need.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return { filled, attempted: need.length };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const errors = [];
  let recent100 = [];
  let recent20 = [];
  let historical = [];

  const quoteExpand = await tryExpandQuotesFromBitqueryDocs();
  if (!quoteExpand.ok) errors.push(`quotes-expand: ${quoteExpand.error}`);
  else if (quoteExpand.added?.length) {
    console.log(`Expanded quotes registry +${quoteExpand.added.length}:`, quoteExpand.added);
  } else {
    console.log('Quotes registry: no new stock addresses found in Bitquery docs (snapshot already complete).');
  }

  try {
    const data = await fetchJson(LAUNCHES_LIMIT_100);
    recent100 = Array.isArray(data) ? data : [];
    console.log(`Recent launches limit=100: ${recent100.length}`);
  } catch (e) {
    errors.push(`recent100: ${e.message || e}`);
    console.error('Recent limit=100 fetch failed:', e.message || e);
  }

  try {
    const data = await fetchJson(LAUNCHES_LIMIT_20);
    recent20 = Array.isArray(data) ? data : [];
    console.log(`Recent launches limit=20: ${recent20.length}`);
  } catch (e) {
    errors.push(`recent20: ${e.message || e}`);
    console.error('Recent limit=20 fetch failed:', e.message || e);
  }

  try {
    const data = await fetchJson(HIST_URL, 45000);
    historical = Array.isArray(data) ? data : [];
    console.log(`Historical launches: ${historical.length}`);
  } catch (e) {
    errors.push(`historical: ${e.message || e}`);
    console.error('Historical fetch failed:', e.message || e);
  }
  if (historical.length === 0) {
    const prev = await loadPreviousLaunches();
    if (prev.length) {
      historical = prev.map((x) => ({
        token: x.token,
        name: x.name,
        symbol: x.symbol,
        description: x.description,
        logo: x.logo,
        factory: x.factory,
        deployer: x.deployer,
        pool: x.pool,
        pairToken: x.pairToken,
        transactionHash: x.transactionHash,
        blockNumber: x.blockNumber,
        launchedAt: x.launchedAt,
        initialBuyWei: x.initialBuyWei,
        priceUsd: x.priceUsd,
        marketCapUsd: x.marketCapUsd,
        liquidityUsd: x.liquidityUsd,
        graduated: x.graduated,
        graduationProgressPct: x.graduationProgressPct,
        pairedPrincipalEth: x.pairedPrincipalEth,
        graduationThresholdEth: x.graduationThresholdEth,
        latestBuyAt: x.latestBuyAt,
      }));
      console.warn(`Seeded historical from previous launches.json (${historical.length})`);
      errors.push('historical-fallback: previous launches.json');
    }
  }

  // Prefer freshest market data: limit=20 overlays limit=100 overlays historical
  const merged = mergeByToken(historical, recent100, recent20);

  let receiptInfo = { ok: 0, fail: 0, attempted: 0 };
  let hydrateInfo = { ok: 0, attempted: 0 };


  await sleep(500);
  const logsInfo = await tryEthGetLogsTokenLaunched();
  if (!logsInfo.ok) {
    errors.push(`eth_getLogs: ${logsInfo.error}`);
    console.warn('eth_getLogs TokenLaunched soft-fail:', logsInfo.error);
  } else {
    console.log(`eth_getLogs TokenLaunched: ${logsInfo.count} (blocks ${logsInfo.fromBlock}→${logsInfo.toBlock})`);
    // Enrich pairToken/deployer/factory when API row missing fields
    const byTok = new Map(merged.map((x) => [x.token.toLowerCase(), x]));
    let enriched = 0;
    let stubs = 0;
    for (const ev of logsInfo.decoded || []) {
      const key = ev.token.toLowerCase();
      const existing = byTok.get(key);
      if (existing) {
        // Pons HTTP API currently reports WETH for every launch — trust on-chain pairToken.
        if (ev.pairToken) {
          existing.pairToken = ev.pairToken;
          enriched += 1;
        }
        if (ev.deployer) existing.deployer = existing.deployer || ev.deployer;
        if (ev.factory) existing.factory = existing.factory || ev.factory;
        if (ev.transactionHash) existing.transactionHash = existing.transactionHash || ev.transactionHash;
        if (ev.blockNumber) existing.blockNumber = existing.blockNumber || ev.blockNumber;
        if (ev.curve) existing.pool = existing.pool || ev.curve;
      } else {
        // Keep stub count low; only keep non-ETH discoveries (API already covers ETH).
        if (stubs >= 80) continue;
        const cls = classifyPair(ev.pairToken).quoteClass;
        if (cls === 'eth') continue;
        const stub = {
          token: ev.token,
          name: 'Unknown',
          symbol: '???',
          description: '',
          logo: null,
          factory: ev.factory,
          deployer: ev.deployer,
          pool: ev.curve,
          pairToken: ev.pairToken,
          transactionHash: ev.transactionHash,
          blockNumber: ev.blockNumber,
          launchedAt: null,
          priceUsd: null,
          marketCapUsd: null,
          graduated: false,
          graduationProgressPct: null,
          _stub: true,
        };
        merged.push(stub);
        byTok.set(key, stub);
        stubs += 1;
      }
    }
    console.log(`eth_getLogs overlay: enriched=${enriched} stubs=${stubs}`);
  }

  // If logs failed/empty, keep prior non-ETH discoveries from disk so Stocks filter stays useful.
  if (!logsInfo.ok || !(logsInfo.count > 0)) {
    const prev = await loadPreviousLaunches();
    const byTok = new Map(merged.map((x) => [String(x.token || '').toLowerCase(), x]));
    let kept = 0;
    for (const x of prev) {
      const cls = x.quoteClass || classifyPair(x.pairToken).quoteClass;
      if (cls === 'eth' || cls === 'unknown') continue;
      const key = String(x.token || '').toLowerCase();
      if (!key || byTok.has(key)) continue;
      merged.push({
        token: x.token,
        name: x.name,
        symbol: x.symbol,
        description: x.description,
        logo: x.logo,
        factory: x.factory,
        deployer: x.deployer,
        pool: x.pool,
        pairToken: x.pairToken,
        transactionHash: x.transactionHash,
        blockNumber: x.blockNumber,
        launchedAt: x.launchedAt,
        priceUsd: x.priceUsd,
        marketCapUsd: x.marketCapUsd,
        graduated: x.graduated,
        graduationProgressPct: x.graduationProgressPct,
      });
      byTok.set(key, x);
      kept += 1;
      if (kept >= 100) break;
    }
    if (kept) console.warn(`Restored ${kept} prior non-ETH launches from disk`);
  }

  if ((logsInfo.count || 0) < 10) {
    try {
      await sleep(250);
      const enrichedRcpt = await enrichPairTokenFromReceipts(merged, 40);
      receiptInfo = { ok: enrichedRcpt.ok, fail: enrichedRcpt.fail, attempted: enrichedRcpt.attempted };
      console.log(`Receipt pairToken enrich: ok=${receiptInfo.ok} fail=${receiptInfo.fail} attempted=${receiptInfo.attempted}`);
    } catch (e) {
      errors.push(`receipts: ${e.message || e}`);
      console.warn('Receipt enrich soft-fail:', e.message || e);
    }
  } else {
    console.log('Skipping receipt enrich (eth_getLogs already populated pairTokens)');
  }

  try {
    hydrateInfo = await hydrateStubMetadata(merged, 50);
    console.log(`Stub metadata hydrate: ok=${hydrateInfo.ok} attempted=${hydrateInfo.attempted}`);
  } catch (e) {
    errors.push(`hydrate: ${e.message || e}`);
  }

  // Cap payload: prefer named API rows; keep all non-ETH quotes; fill with ETH.
  const dedupe = (list) => {
    const seen = new Set();
    const out = [];
    for (const x of list) {
      const k = (x.token || '').toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(x);
    }
    return out;
  };
  const named = merged.filter((x) => x && x.name && x.name !== 'Unknown' && x.symbol && x.symbol !== '???');
  const stubsOnly = merged.filter((x) => x && (x._stub || x.name === 'Unknown' || x.symbol === '???'));
  const namedNonEth = named.filter((x) => classifyPair(x.pairToken).quoteClass !== 'eth');
  const namedEth = named.filter((x) => classifyPair(x.pairToken).quoteClass === 'eth');
  const stubNonEth = stubsOnly.filter((x) => classifyPair(x.pairToken).quoteClass !== 'eth');
  // Order: named non-ETH, stub non-ETH (discovery), named ETH fill
  const capped = dedupe([...namedNonEth, ...stubNonEth, ...namedEth]);
  let launchesRaw = capped.slice(0, 500);

  // Soft fallback: if API totally failed, keep previous on-disk launches
  if (launchesRaw.length === 0) {
    const prev = await loadPreviousLaunches();
    if (prev.length) {
      console.warn(`Using previous on-disk launches (${prev.length}) after empty fetch`);
      launchesRaw = prev.map((x) => ({
        token: x.token,
        name: x.name,
        symbol: x.symbol,
        description: x.description,
        logo: x.logo,
        factory: x.factory,
        deployer: x.deployer,
        pool: x.pool,
        pairToken: x.pairToken,
        transactionHash: x.transactionHash,
        blockNumber: x.blockNumber,
        launchedAt: x.launchedAt,
        initialBuyWei: x.initialBuyWei,
        priceUsd: x.priceUsd,
        marketCapUsd: x.marketCapUsd,
        liquidityUsd: x.liquidityUsd,
        graduated: x.graduated,
        graduationProgressPct: x.graduationProgressPct,
        pairedPrincipalEth: x.pairedPrincipalEth,
        graduationThresholdEth: x.graduationThresholdEth,
        latestBuyAt: x.latestBuyAt,
      }));
      errors.push('fallback: previous launches.json');
    }
  }


  try {
    const launchedFill = await fillLaunchedAtFromBlocks(launchesRaw, 8);
    console.log(`launchedAt from blocks: filled=${launchedFill.filled} attempted=${launchedFill.attempted}`);
  } catch (e) {
    errors.push(`launchedAt-blocks: ${e.message || e}`);
    console.warn('launchedAt block fill soft-fail:', e.message || e);
  }

  const launches = launchesRaw.map(normalizeLaunch);

  const byClass = { eth: 0, usdg: 0, stocks: 0, btc: 0, unknown: 0 };
  for (const L of launches) byClass[L.quoteClass] = (byClass[L.quoteClass] || 0) + 1;

  const rpcInfo = await tryRpcProbe();

  const quotes = {
    updatedAt: new Date().toISOString(),
    source: BITQUERY_PONS_DOCS,
    expand: quoteExpand,
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
      recent100: LAUNCHES_LIMIT_100,
      recent20: LAUNCHES_LIMIT_20,
      historical: HIST_URL,
      rpc: RPC,
      bitqueryDocs: BITQUERY_PONS_DOCS,
    },
    factories: {
      v1: FACTORY_V1,
      v2: FACTORY_V2,
      recentApi: FACTORY_RECENT,
      tokenLaunchedTopicV2: TOPIC_TOKEN_LAUNCHED_V2,
      tokenLaunchedTopicRecent: TOPIC_TOKEN_LAUNCHED_V1STYLE,
      tokenLaunchedSigV2:
        'TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)',
    },
    counts: {
      launches: launches.length,
      recent100Fetched: recent100.length,
      recent20Fetched: recent20.length,
      historicalFetched: historical.length,
      ethGetLogsTokenLaunched: logsInfo.ok ? logsInfo.count : 0,
      receiptPairTokenEnrich: receiptInfo,
      stubMetadataHydrate: hydrateInfo,
      byQuoteClass: byClass,
      stockQuoted: byClass.stocks,
      usdgQuoted: byClass.usdg,
      graduated: launches.filter((x) => x.graduated).length,
    },
    rpc: rpcInfo,
    ethGetLogs: {
      ok: logsInfo.ok,
      count: logsInfo.count ?? 0,
      fromBlock: logsInfo.fromBlock,
      toBlock: logsInfo.toBlock,
      topicV2: logsInfo.topicV2,
      topicRecent: logsInfo.topicRecent,
      factories: logsInfo.factories,
      counts: logsInfo.counts,
      softErrors: logsInfo.softErrors || [],
      samples: logsInfo.samples || [],
      error: logsInfo.error,
      note: logsInfo.note,
    },
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
    if (launches.length === 0) process.exit(1);
  }
  console.log('Wrote public/feed/*.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
