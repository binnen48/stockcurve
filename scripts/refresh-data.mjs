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
  // Expanded from o1 Robinhood stock catalog (2026-09)
  '0x521cf887e6531c6f667b5bc4d896e5d9bfe8eb2e': { symbol: 'AAOI', class: 'stocks', name: 'Applied Optoelectronics', decimals: 18 },
  '0x3139d77ace0cbaa5bdfd38bd1f1911a794af0b0e': { symbol: 'ABCL', class: 'stocks', name: 'Abcellera Biologics', decimals: 18 },
  '0x232b8ed6377be97813853b0ac104c4cda8378d1b': { symbol: 'ADBE', class: 'stocks', name: 'Adobe', decimals: 18 },
  '0x5f604fba1162193a4388a5dfa56f556f3e133cc2': { symbol: 'AEHR', class: 'stocks', name: 'Aehr', decimals: 18 },
  '0xfaf9cb261b5fcc1f404bb10cd39c5c6c1974e612': { symbol: 'AEIS', class: 'stocks', name: 'Advanced Energy', decimals: 18 },
  '0x748c32c3ca24edf31ea597db1f3d330a7a6da3dc': { symbol: 'ALAB', class: 'stocks', name: 'Astera Labs, Inc.', decimals: 18 },
  '0x36046893810a7e7fce501229d57dc3fc8c8716d0': { symbol: 'AMAT', class: 'stocks', name: 'Applied Materials', decimals: 18 },
  '0x99d9d8663545151603863c5acbd6fc3218899009': { symbol: 'AMBA', class: 'stocks', name: 'Ambarella', decimals: 18 },
  '0x05a3d1cd21d0c88145e82600e62e7e496e0f222b': { symbol: 'AMC', class: 'stocks', name: 'AMC Entertainment', decimals: 18 },
  '0xdd356aa38f40a7b7076755ac854b6fbb1f0d305b': { symbol: 'AMKR', class: 'stocks', name: 'Amkor Technology', decimals: 18 },
  '0x28babd556b60e53663b8615036479a29c2cdd1bf': { symbol: 'ANET', class: 'stocks', name: 'Arista', decimals: 18 },
  '0xb8dbf92f9741c9ac1c32115e78581f23509916fd': { symbol: 'APLD', class: 'stocks', name: 'Applied Digital', decimals: 18 },
  '0xa249baf1063af884807c1e1400aef7784836917e': { symbol: 'APP', class: 'stocks', name: 'AppLovin', decimals: 18 },
  '0x47f93d52cbec7c6d2cfc080e154002370a60daea': { symbol: 'ASML', class: 'stocks', name: 'ASML Holding NV', decimals: 18 },
  '0x1af6446f07eb1d97c546afc8c9544cbdf3ad5137': { symbol: 'ASTS', class: 'stocks', name: 'AST SpaceMobile', decimals: 18 },
  '0x373c06c4f7bde527d7dae4ba169e42b55e393ced': { symbol: 'AUR', class: 'stocks', name: 'Aurora Innovation', decimals: 18 },
  '0xf6290b5e7c26502e2da514c31509849718ea76a5': { symbol: 'AVAV', class: 'stocks', name: 'AeroVironment', decimals: 18 },
  '0x156e175dd063a8ce274c50654ef40e0032b3fbcf': { symbol: 'AVGO', class: 'stocks', name: 'Broadcom', decimals: 18 },
  '0xc27dbd474af5181c5a8777903690d8d262d12648': { symbol: 'AXON', class: 'stocks', name: 'Axon', decimals: 18 },
  '0x141eea040c2250eec0314e336975e81f85f6585e': { symbol: 'AXTI', class: 'stocks', name: 'AXT', decimals: 18 },
  '0x4d21483a44bf67a86b77e3da301411880797d452': { symbol: 'BA', class: 'stocks', name: 'Boeing', decimals: 18 },
  '0xad25ac6c84d497db898fa1e8387bf6af3532a1c4': { symbol: 'BABA', class: 'stocks', name: 'Alibaba', decimals: 18 },
  '0x822cc93ffd030293e9842c30bbd678f530701867': { symbol: 'BE', class: 'stocks', name: 'Bloom Energy', decimals: 18 },
  '0x2f62fc9fabb470c690f141c28340ed832bb27020': { symbol: 'BND', class: 'stocks', name: 'Vanguard Total Bond Market ETF', decimals: 18 },
  '0xcef9027c7d6985b85f0ba431125073529a947a68': { symbol: 'BULL', class: 'stocks', name: 'Webull', decimals: 18 },
  '0x5c90450bbb4273d7b2f17cf6917aeb237a569679': { symbol: 'CBRS', class: 'stocks', name: 'Cerebras Systems', decimals: 18 },
  '0x9651342cea770ae9a2969ba2a52611523146aef9': { symbol: 'CCL', class: 'stocks', name: 'Carnival Corporation', decimals: 18 },
  '0xae517a2903e68bd929dfd15be875f8369d53e94a': { symbol: 'CEG', class: 'stocks', name: 'Constellation Energy', decimals: 18 },
  '0x8cf07c5a878945185d327aaa6e33faa95f95e7bf': { symbol: 'CELH', class: 'stocks', name: 'Celsius', decimals: 18 },
  '0x44f6d488021f8233b9416294d1fe9b1fee28382d': { symbol: 'CIEN', class: 'stocks', name: 'Ciena', decimals: 18 },
  '0x62200915e7deab1ec7f79fb246dadbb80eacddd0': { symbol: 'CLOV', class: 'stocks', name: 'Clover Health Investments', decimals: 18 },
  '0xbf449977089c718c004a66c554b26b94ef3ad4de': { symbol: 'CLS', class: 'stocks', name: 'Celestica', decimals: 18 },
  '0xcbb95bbf36099d34da091dc6fa6f49efa257cee3': { symbol: 'CLSK', class: 'stocks', name: 'CleanSpark', decimals: 18 },
  '0x92f9f459f1a9a5ad266b182be7bffd1c6c666894': { symbol: 'COHR', class: 'stocks', name: 'Coherent', decimals: 18 },
  '0x4d67253bc223e6b0e104f1084c1fb2b669ddc41b': { symbol: 'CRDO', class: 'stocks', name: 'Credo Technology Group', decimals: 18 },
  '0xd95b44124e475743a7589e68f3d74008a5536d44': { symbol: 'CRM', class: 'stocks', name: 'Salesforce', decimals: 18 },
  '0xea72ecca2d0f6bfa1394dbbcff85b52cd4233931': { symbol: 'CRWD', class: 'stocks', name: 'CrowdStrike Holdings', decimals: 18 },
  '0x5f10a1c971b69e47e059e1dc91901b59b3fb49c3': { symbol: 'CRWV', class: 'stocks', name: 'CoreWeave', decimals: 18 },
  '0xf543967eebb6f1917992ef0e68de63ab07a5a0da': { symbol: 'CSCO', class: 'stocks', name: 'Cisco Systems', decimals: 18 },
  '0x63d5a3b6939a33f1e75d8bcd85759858239600db': { symbol: 'CTSH', class: 'stocks', name: 'Cognizant', decimals: 18 },
  '0xa4f319104089fe321dc8093c6e707d4fe190a988': { symbol: 'CVNA', class: 'stocks', name: 'Carvana', decimals: 18 },
  '0x27c99fbde9d0d2aa4f4bfb4943f237843ddf6958': { symbol: 'DDOG', class: 'stocks', name: 'Datadog', decimals: 18 },
  '0xc02f12b9fe9e707079ec0d546f3050d3f6c1f8bd': { symbol: 'DOCN', class: 'stocks', name: 'DigitalOcean', decimals: 18 },
  '0x39ec44bee4f6a116c6f9b8de566848a985c53c60': { symbol: 'ELF', class: 'stocks', name: 'e.l.f. Beauty', decimals: 18 },
  '0x1c690498150252222c275a5ced69d3a6b1f52d5e': { symbol: 'EWT', class: 'stocks', name: 'iShares MSCI Taiwan Capped ETF', decimals: 18 },
  '0x7f0abef0c07280f82c6a08ead09ded6bae2c13fc': { symbol: 'EWY', class: 'stocks', name: 'iShares MSCI South Korea fund', decimals: 18 },
  '0x25c288e6d899b9bc30160965ad9644c67e73be0c': { symbol: 'F', class: 'stocks', name: 'Ford Motor', decimals: 18 },
  '0xa48f22a46c0f1c46ca7d111cb6c137c271987180': { symbol: 'FICO', class: 'stocks', name: 'Fair Isaac', decimals: 18 },
  '0x41f4267525a8aff329540ef24fd83d9044758b33': { symbol: 'FIG', class: 'stocks', name: 'Figma', decimals: 18 },
  '0x9ece29a4a2397c0a35fb5fa8ee2b9509130a98cc': { symbol: 'FISV', class: 'stocks', name: 'Fiserv', decimals: 18 },
  '0x93dbb1d2dc5d63f4abacff30485273f538df68ac': { symbol: 'FIX', class: 'stocks', name: 'Comfort Systems', decimals: 18 },
  '0x282e87451e10fa6679bc7d76c69be44cd3fc777c': { symbol: 'FLNC', class: 'stocks', name: 'Fluence Energy', decimals: 18 },
  '0x03bc731ffb162cdd7b98d3c6542bfc291126075d': { symbol: 'FLY', class: 'stocks', name: 'Firefly Aerospace Inc.', decimals: 18 },
  '0x3fb8976980d486084b2eb4a404bd12e72823958f': { symbol: 'FTNT', class: 'stocks', name: 'Fortinet', decimals: 18 },
  '0xeb30663bdff0622ef4e4e5cbb4e975f19f33f51d': { symbol: 'FUTU', class: 'stocks', name: 'Futu Holdings', decimals: 18 },
  '0x63b814ddbd6bf339f25fed8c36158a008d5b373e': { symbol: 'GE', class: 'stocks', name: 'General Electric', decimals: 18 },
  '0x94b8aae43a1ccc08aa64b7d1f29b4d920af4a0c9': { symbol: 'GEV', class: 'stocks', name: 'GE Vernova', decimals: 18 },
  '0x7c04e6a3368f2a1de3874f0e80d2e0a1a9915da6': { symbol: 'GLW', class: 'stocks', name: 'Corning', decimals: 18 },
  '0x2d427692e928fa156ec22acfabafa0447c5805b7': { symbol: 'GLXY', class: 'stocks', name: 'Galaxy Digital Inc.', decimals: 18 },
  '0xeb61c0ed490a367d4e3631ccf8a74b3bfc7e775d': { symbol: 'HII', class: 'stocks', name: 'Huntington Ingalls', decimals: 18 },
  '0x59dd09d4900c2e4b5f75b7c0d4e6796fcc234cb1': { symbol: 'HPE', class: 'stocks', name: 'HP Enterprise', decimals: 18 },
  '0xaea445c5f3db1a462998ccc422a875a361ee5d99': { symbol: 'HWM', class: 'stocks', name: 'Howmet Aerospace', decimals: 18 },
  '0x980dcf6766fa79f5cf0c4aadb3ab477ff15a9619': { symbol: 'IBM', class: 'stocks', name: 'IBM', decimals: 18 },
  '0x7c148f74ac7445d1f28366b7fcdc6792a9fcd0cf': { symbol: 'IBRX', class: 'stocks', name: 'ImmunityBio', decimals: 18 },
  '0xacef2e09adb47ad6abebad9ff06689e60615c2b6': { symbol: 'INDA', class: 'stocks', name: 'iShares MSCI India ETF', decimals: 18 },
  '0xb853bc83a753342a4f8320ea680b4b1e84118d21': { symbol: 'INFQ', class: 'stocks', name: 'Infleqtion', decimals: 18 },
  '0xf1953dab6fad537488d5a022361ffaa8b4c95ec6': { symbol: 'INOD', class: 'stocks', name: 'Innodata', decimals: 18 },
  '0xc72b96e0e48ecd4dc75e1e45396e26300bc39681': { symbol: 'INTC', class: 'stocks', name: 'Intel', decimals: 18 },
  '0x56d23bee5f41a7120170b0c603dae30128e460e9': { symbol: 'INTU', class: 'stocks', name: 'Intuit', decimals: 18 },
  '0x558378e000d634a36593e338ebacdd6207640efe': { symbol: 'IONQ', class: 'stocks', name: 'IonQ', decimals: 18 },
  '0xf0ab0c93be6f41369d302e55db1a96b3c430212d': { symbol: 'IREN', class: 'stocks', name: 'IREN Limited', decimals: 18 },
  '0xeaf2512dfc1beac608f8794b3793cd4e02894aa6': { symbol: 'JBL', class: 'stocks', name: 'Jabil Inc.', decimals: 18 },
  '0x03dfbbe0ac4e7bcdafd08ed41a400326b77d8c80': { symbol: 'JNJ', class: 'stocks', name: 'Johnson & Johnson', decimals: 18 },
  '0xb334c5ce741b80b5b671f47f5c269cb193fe8e24': { symbol: 'JOBY', class: 'stocks', name: 'Joby Aviation', decimals: 18 },
  '0x96b933c74ecb4a0926b9210cef7b743ef46be2e9': { symbol: 'KLAC', class: 'stocks', name: 'KLA', decimals: 18 },
  '0x12e3c047bf9aecaf9ddc98c05c31bfd1dd043993': { symbol: 'KSS', class: 'stocks', name: 'Kohls Corporation', decimals: 18 },
  '0x7fd06a4d81ccfa3f351394e144d5191874c31313': { symbol: 'KTOS', class: 'stocks', name: 'Kratos Defense & Security Solutions', decimals: 18 },
  '0x48d60243c66437c6ac3c2495be94747aed5dfe25': { symbol: 'LHX', class: 'stocks', name: 'L3Harris', decimals: 18 },
  '0x8ef20885f94e3d9bc7eb3080279188bd5ed7c08c': { symbol: 'LITE', class: 'stocks', name: 'Lumentum', decimals: 18 },
  '0x329fcaceb9ad6f9580dd5f643fed0646900d043c': { symbol: 'LMT', class: 'stocks', name: 'Lockheed', decimals: 18 },
  '0x57b0030166db0c31690d1a5aa167e2e26e2c29a4': { symbol: 'LRCX', class: 'stocks', name: 'Lam Research Corp', decimals: 18 },
  '0x4e62068525ab11fe768e29dfd00ef909b9803016': { symbol: 'LULU', class: 'stocks', name: 'Lululemon', decimals: 18 },
  '0xa5d4968421ba94814be3b136b15cf422101ac1a3': { symbol: 'LUNR', class: 'stocks', name: 'Intuitive Machines', decimals: 18 },
  '0xddf2266b79abf0b48898959b0ed6e6adf512be74': { symbol: 'MDB', class: 'stocks', name: 'MongoDB', decimals: 18 },
  '0xc6cbad1016b38b797610c25e1dc7d95988b1f362': { symbol: 'MOD', class: 'stocks', name: 'Modine', decimals: 18 },
  '0x52d50d0280ad1054b43f052bd70a49a212a1b128': { symbol: 'MPWR', class: 'stocks', name: 'Monolithic Power Systems', decimals: 18 },
  '0x43b07d15ce533bec5476d70c22a78a1b2b662155': { symbol: 'MRNA', class: 'stocks', name: 'Moderna', decimals: 18 },
  '0x62fd0668e10d8b72339be2dcf7643001688ff13b': { symbol: 'MRVL', class: 'stocks', name: 'Marvell Technology', decimals: 18 },
  '0xc93f4d80e268ab922e871bd169156c3cc41894e6': { symbol: 'MTSI', class: 'stocks', name: 'MACOM', decimals: 18 },
  '0x48961813349333209994750ffa89b3c5c22ec969': { symbol: 'MXL', class: 'stocks', name: 'MaxLinear', decimals: 18 },
  '0xf7181b63fdb858558a74ba96bc42732684cd7965': { symbol: 'NAVN', class: 'stocks', name: 'Navan', decimals: 18 },
  '0x9d9c6684f596f66a64c030b93a886d51fd4d7931': { symbol: 'NBIS', class: 'stocks', name: 'Nebius Group', decimals: 18 },
  '0x116f00968269b7bfbad4109ce591d6e74c0601d4': { symbol: 'NET', class: 'stocks', name: 'Cloudflare', decimals: 18 },
  '0xe0444ef8bf4ed74f74fd73686e2ddf4c1c5591e8': { symbol: 'NFLX', class: 'stocks', name: 'Netflix', decimals: 18 },
  '0xbef75684c43c4ea7bd18dd532a2244674ee8b926': { symbol: 'NNE', class: 'stocks', name: 'Nano Nuclear Energy', decimals: 18 },
  '0x0c3260af4b8f13a69c4c2dfb84fd667890cdfa14': { symbol: 'NOW', class: 'stocks', name: 'ServiceNow', decimals: 18 },
  '0x408c14038a04f7bd235329e26d2bf569ee20e250': { symbol: 'NU', class: 'stocks', name: 'Nu', decimals: 18 },
  '0xbe6702d7b70315376dc48a3293f24f0982f86386': { symbol: 'NVTS', class: 'stocks', name: 'Navitas Semiconductor', decimals: 18 },
  '0x8b2f88497f15a18e9d4ffa1a8ffb8538399ae774': { symbol: 'OKLO', class: 'stocks', name: 'Oklo', decimals: 18 },
  '0xbbd09f72b025360fee5c928053dca6248d35be54': { symbol: 'ON', class: 'stocks', name: 'ON Semiconductor', decimals: 18 },
  '0x8ff63eaeee3fe54ba450c4f5538064ec5a893aef': { symbol: 'ONTO', class: 'stocks', name: 'Onto Innovation', decimals: 18 },
  '0xb0992820e760d836549ba69bc7598b4af75dee03': { symbol: 'ORCL', class: 'stocks', name: 'Oracle', decimals: 18 },
  '0x40e7a279850e443f582059ae5dc1c3b6563e6395': { symbol: 'OUST', class: 'stocks', name: 'Ouster', decimals: 18 },
  '0x1cdad396db64bda184d5182a97dd9b3c62100b7d': { symbol: 'P', class: 'stocks', name: 'Everpure', decimals: 18 },
  '0xb039597ed45cba7b6e2fb9e8be51802969cee5be': { symbol: 'PANW', class: 'stocks', name: 'Palo Alto Networks', decimals: 18 },
  '0xfb2664f07b6aadd29ea7a59d8859b1aeb8645cda': { symbol: 'PATH', class: 'stocks', name: 'UiPath', decimals: 18 },
  '0x9b23573b156b52565012f5ce02cdf60afbaa70be': { symbol: 'PENG', class: 'stocks', name: 'Penguin Solutions', decimals: 18 },
  '0x7066a64c24e4206cd62e83bf198c1e7eb361f51e': { symbol: 'PFE', class: 'stocks', name: 'Pfizer', decimals: 18 },
  '0xaa4d64474c172010ab57719cb9951e6142a100d3': { symbol: 'PL', class: 'stocks', name: 'Planet Labs', decimals: 18 },
  '0xcf6b2d875361be807eafa57458c80f28521f9333': { symbol: 'POET', class: 'stocks', name: 'POET Technologies', decimals: 18 },
  '0x237c16d66590f67b886d978acd362eaead8b18c7': { symbol: 'POWL', class: 'stocks', name: 'Powell Industries', decimals: 18 },
  '0x4189f0c66ebbb0bfef1c31f763131361ef32f77c': { symbol: 'PR', class: 'stocks', name: 'Permian Resources', decimals: 18 },
  '0x9ab02ead789b6903c3c44d0ed32f9c707cdf12fd': { symbol: 'PWR', class: 'stocks', name: 'Quanta', decimals: 18 },
  '0xc583c60aef9dc401da72cec1b404743a93cea1cc': { symbol: 'QBTS', class: 'stocks', name: 'D-Wave Quantum Inc. Common Stock', decimals: 18 },
  '0x0f17206447090e464c277571124dd2688e48aea9': { symbol: 'QCOM', class: 'stocks', name: 'Qualcomm', decimals: 18 },
  '0x59818904ab4ce163b3ce4ffb64f2d6ca02c434b4': { symbol: 'QUBT', class: 'stocks', name: 'Quantum Computing', decimals: 18 },
  '0xfde6b5d9bb419b10c23268c74e369abff39c0460': { symbol: 'RCAT', class: 'stocks', name: 'Red Cat', decimals: 18 },
  '0x92ef19e82bd8ff36661de838d5eae7e5cef0effe': { symbol: 'RDW', class: 'stocks', name: 'Redwire', decimals: 18 },
  '0x284358abc07f9359f19f4b5b4ac91901be2597ba': { symbol: 'RGTI', class: 'stocks', name: 'Rigetti Computing', decimals: 18 },
  '0xb1bf26c1d20ff267a4f93550d1e0d06ac40a114b': { symbol: 'RIVN', class: 'stocks', name: 'Rivian Automotive', decimals: 18 },
  '0x3b14c39e89d60d627b42a1a4ca45b5bb45fc12e2': { symbol: 'RKLB', class: 'stocks', name: 'Rocket Lab Corporation', decimals: 18 },
  '0x756bc80af765c82da966a788858d65adf14f3793': { symbol: 'RUN', class: 'stocks', name: 'Sunrun', decimals: 18 },
  '0x95052ddcd5dc25641657424a8cf04834997e1730': { symbol: 'SATS', class: 'stocks', name: 'EchoStar', decimals: 18 },
  '0xd63abb2c13d7a8421a8017a712802053568e3c1d': { symbol: 'SCHD', class: 'stocks', name: 'Schwab US Dividend Equity ETF', decimals: 18 },
  '0x92fd66527192e3e61d4ddd13322aa222de86f9b5': { symbol: 'SGOV', class: 'stocks', name: 'iShares 0-3 Month Treasury Bond', decimals: 18 },
  '0xf53f66751b1eff985311b693531e3290f600c410': { symbol: 'SHOP', class: 'stocks', name: 'Shopify', decimals: 18 },
  '0xbe274710bf3d9567e1b290ef6a5f9f90ca016fd8': { symbol: 'SHY', class: 'stocks', name: 'iShares 1-3 Year Treasury Bond ETF', decimals: 18 },
  '0x77e655e37f4d913fb9540e0d541d824171a60e81': { symbol: 'SIMO', class: 'stocks', name: 'Silicon Motion', decimals: 18 },
  '0x285b231728c7e4333799183df1094d775246a535': { symbol: 'SLS', class: 'stocks', name: 'SELLAS Life Sciences', decimals: 18 },
  '0x411efb0e7f985935daec3d4c3ebaea0d0ad7d89f': { symbol: 'SLV', class: 'stocks', name: 'iShares Silver Trust', decimals: 18 },
  '0xc01aa1fecec0605b13bc84874ff7256c0f5f562a': { symbol: 'SMCI', class: 'stocks', name: 'Super Micro Computer', decimals: 18 },
  '0x072f979c2cac8e1391b0162a87fee094bf8744a0': { symbol: 'SMH', class: 'stocks', name: 'VanEck Semiconductor ETF', decimals: 18 },
  '0x1eebee7f74517e0279dfb09d25b0407beec3fdd6': { symbol: 'SMR', class: 'stocks', name: 'NuScale Power', decimals: 18 },
  '0xf6589f11bc40b669e584073f428b05562f568733': { symbol: 'SNAP', class: 'stocks', name: 'Snap', decimals: 18 },
  '0xba0cab75495255d0cb58e22b648bfed4ecd1f47e': { symbol: 'SNOW', class: 'stocks', name: 'Snowflake', decimals: 18 },
  '0x98e75885157c80992a8d41b696d8c9c6fb30a926': { symbol: 'SOFI', class: 'stocks', name: 'SoFi Technologies', decimals: 18 },
  '0x6e3dfd9f7e1649baa14d25cac18c94d62db10a54': { symbol: 'SOUN', class: 'stocks', name: 'SoundHound AI', decimals: 18 },
  '0x75742c18bc1f1c5c5f448f4c9d9c6f66dafaaa38': { symbol: 'SOXX', class: 'stocks', name: 'iShares Semiconductor ETF', decimals: 18 },
  '0xad622320e520de39e72d41ef07438c3fd3354875': { symbol: 'SPMO', class: 'stocks', name: 'Invesco S\\&P 500 Momentum ETF', decimals: 18 },
  '0xb1969f6604ca1ae7a2cd3f1827876e914594ca2d': { symbol: 'TE', class: 'stocks', name: 'T1 Energy', decimals: 18 },
  '0x5b97476b922f3305131b8f0b9d333172e87f4aae': { symbol: 'TEAM', class: 'stocks', name: 'Atlassian Corporation', decimals: 18 },
  '0xb1cc0ec7db69cf43539119814df40071b9d61793': { symbol: 'TEM', class: 'stocks', name: 'Tempus AI', decimals: 18 },
  '0x2778c5024d5ca2cdb0f8ead671ffc69963adcd9c': { symbol: 'TER', class: 'stocks', name: 'Teradyne', decimals: 18 },
  '0x89776d4cd68193597a2fc132cfac1fde36ccea8a': { symbol: 'TSEM', class: 'stocks', name: 'Tower Semiconductor', decimals: 18 },
  '0x0b5fb4031cae9163db10b169ee72685f0edc8545': { symbol: 'TTD', class: 'stocks', name: 'Trade Desk', decimals: 18 },
  '0x0e6e67ba88e7b5d9b67636a215c76779b948de79': { symbol: 'UMC', class: 'stocks', name: 'United Microelectronics', decimals: 18 },
  '0xcf364ea52787e289de6f32077834056e3e70d6a8': { symbol: 'UNH', class: 'stocks', name: 'UnitedHealth', decimals: 18 },
  '0xf23250dac154d05bb671cb0d0ebef3c635c79ce2': { symbol: 'UPS', class: 'stocks', name: 'UPS', decimals: 18 },
  '0xd917b029c761d264c6a312bbbcda868658ef86a6': { symbol: 'USAR', class: 'stocks', name: 'USA Rare Earth', decimals: 18 },
  '0x6006ed4b2f94110851ff7509d97d034f0eed9226': { symbol: 'VICR', class: 'stocks', name: 'Vicor', decimals: 18 },
  '0xfa78c12e6488814a0262e4e802749a4a737d5fb7': { symbol: 'VRT', class: 'stocks', name: 'Vertiv', decimals: 18 },
  '0x26dcbfb34fc83cabd6990f449674efdc6097ff85': { symbol: 'VSAT', class: 'stocks', name: 'ViaSat', decimals: 18 },
  '0x561e2a49212b7ccf47f2744ccb83e200722fadbc': { symbol: 'VST', class: 'stocks', name: 'Vistra', decimals: 18 },
  '0x0594134df3f171a354d9c85ebd65b7a6148f6d09': { symbol: 'VTI', class: 'stocks', name: 'Vanguard Morningstar Total Stock Market ETF', decimals: 18 },
  '0x82da4646242e1d962e96e932269dc644c94a9caa': { symbol: 'WDAY', class: 'stocks', name: 'Workday', decimals: 18 },
  '0xf52597345a8edf418bc4071b4a35112472277d3e': { symbol: 'WDC', class: 'stocks', name: 'Western Digital', decimals: 18 },
  '0x348be1a8663f15edde5cdf8a96bb69078f7ab6fd': { symbol: 'WULF', class: 'stocks', name: 'TeraWulf', decimals: 18 },
  '0x15cd20759ce7f3285c29a319de2d1a2e098c6f43': { symbol: 'XLK', class: 'stocks', name: 'State Street Technology Select Sector SPDR ETF', decimals: 18 },
  '0xa8eb3bccbf2017ee7cbfb652eb51cf2e1b153289': { symbol: 'XNDU', class: 'stocks', name: 'Xanadu Quantum', decimals: 18 },
  '0xf9b46d3d1b22199d4d1025a9cedb540a33f1a2d5': { symbol: 'XOM', class: 'stocks', name: 'ExxonMobil Holdings Corporation', decimals: 18 },
  '0x44c4f142009036cf477ed2d09932051843137cf1': { symbol: 'ZM', class: 'stocks', name: 'Zoom', decimals: 18 },
  '0x7dc013eb55e436f30d7ed1afe4e36d6e45e3c3f7': { symbol: 'ZS', class: 'stocks', name: 'Zscaler', decimals: 18 },
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
        'User-Agent': 'StockCurve/1.1 (+https://github.com/stockcurve/stockcurve.github.io)',
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
        'User-Agent': 'StockCurve/1.1 (+https://github.com/stockcurve/stockcurve.github.io)',
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

function shortAddrLocal(a) {
  const s = String(a || '');
  if (s.length < 12) return s || '—';
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function decodeAbiString(hex) {
  const h = String(hex || '').replace(/^0x/, '');
  if (!h || h === '0') return null;
  // dynamic string
  if (h.length >= 128) {
    try {
      const len = parseInt(h.slice(64, 128), 16);
      if (Number.isFinite(len) && len > 0 && len <= 256) {
        const data = h.slice(128, 128 + len * 2);
        const s = Buffer.from(data, 'hex').toString('utf8').replace(/\0/g, '').trim();
        if (s) return s;
      }
    } catch { /* fall through */ }
  }
  // bytes32 fallback
  try {
    const raw = Buffer.from(h.slice(0, 64).padEnd(64, '0'), 'hex').toString('utf8').replace(/\0/g, '').trim();
    return raw || null;
  } catch {
    return null;
  }
}

async function rpcCallWithRetry(method, params, { retries = 6 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await rpc(method, params);
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (msg.includes('429') || /too many requests/i.test(msg) || /rate/i.test(msg)) {
        await sleep(800 * (i + 1) + Math.floor(Math.random() * 200));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function fetchTokenMetaBlockscout(addr) {
  const url = `https://robinhoodchain.blockscout.com/api/v2/tokens/${addr}`;
  try {
    const j = await fetchJson(url, 20000);
    const name = (j?.name || '').trim() || null;
    const symbol = (j?.symbol || '').trim() || null;
    if (name || symbol) return { name, symbol, source: 'blockscout' };
  } catch { /* CF / 403 */ }
  return null;
}

async function fetchTokenMetaRpc(addr) {
  const [nameHex, symHex] = await Promise.all([
    rpcCallWithRetry('eth_call', [{ to: addr, data: '0x06fdde03' }, 'latest']),
    rpcCallWithRetry('eth_call', [{ to: addr, data: '0x95d89b41' }, 'latest']),
  ]);
  return {
    name: decodeAbiString(nameHex),
    symbol: decodeAbiString(symHex),
    source: 'rpc',
  };
}

function isStubMeta(x) {
  if (!x) return false;
  const name = x.name;
  const symbol = x.symbol;
  return (
    x._stub
    || !name
    || name === 'Unknown'
    || /^0x[a-fA-F0-9]{6}…/.test(String(name))
    || !symbol
    || symbol === '???'
    || symbol === 'UNK'
  );
}

function classifyQuoteClassGuess(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (!s) return 'other';
  if (s === 'USDG' || s === 'USDC' || s === 'USDT' || s === 'DAI') return 'usdg';
  if (s === 'ETH' || s === 'WETH') return 'eth';
  if (s === 'BTC' || s === 'CBBTC' || s === 'WBTC') return 'btc';
  // ticker-like equity / ETF
  if (/^[A-Z]{1,5}$/.test(s) || /^[A-Z]{2,5}\.[A-Z]$/.test(s)) return 'stocks';
  return 'other';
}

/** Hydrate Unknown/??? launch token metadata via RPC (+ Blockscout fallback). */
async function hydrateStubMetadata(launches, limit = 500) {
  const stubs = (launches || []).filter((x) => isStubMeta(x) && x.token);
  // Prioritize stock-quoted stubs, then unknown quote class, then the rest
  stubs.sort((a, b) => {
    const rank = (x) => {
      const c = x.quoteClass || classifyPair(x.pairToken).quoteClass;
      if (c === 'stocks') return 0;
      if (c === 'unknown') return 1;
      if (c === 'usdg') return 2;
      return 3;
    };
    return rank(a) - rank(b);
  });
  const targets = stubs.slice(0, Math.max(limit, stubs.length));
  let ok = 0;
  let fail = 0;
  for (const item of targets) {
    const addr = item.token;
    let meta = null;
    try {
      meta = await fetchTokenMetaRpc(addr);
    } catch {
      meta = null;
    }
    if ((!meta?.name && !meta?.symbol)) {
      await sleep(120);
      meta = await fetchTokenMetaBlockscout(addr);
    }
    if (meta?.name && (item.name === 'Unknown' || !item.name || item._stub)) item.name = meta.name;
    if (meta?.symbol && (item.symbol === '???' || !item.symbol || item._stub || item.symbol === 'UNK')) {
      item.symbol = meta.symbol;
    }
    if (meta?.name || meta?.symbol) {
      ok += 1;
      delete item._stub;
    } else {
      fail += 1;
      // Prefer shortened token address over the word "Unknown"
      if (!item.name || item.name === 'Unknown') item.name = `Token ${shortAddrLocal(addr)}`;
      if (!item.symbol || item.symbol === '???') item.symbol = shortAddrLocal(addr);
      delete item._stub;
    }
    await sleep(350);
  }
  return { ok, fail, attempted: targets.length };
}

/** Resolve unknown pairToken quotes into QUOTE_REGISTRY via RPC/Blockscout. */
async function hydrateUnknownQuotePairs(launches, limit = 40) {
  const pairs = [];
  const seen = new Set();
  for (const x of launches || []) {
    const p = (x?.pairToken || '').toLowerCase();
    if (!p || seen.has(p)) continue;
    const q = classifyPair(p);
    if (q.quoteClass !== 'unknown' && q.quoteSymbol !== 'UNK') continue;
    seen.add(p);
    pairs.push(p);
  }
  const targets = pairs.slice(0, limit);
  let ok = 0;
  for (const addr of targets) {
    let meta = null;
    try {
      meta = await fetchTokenMetaRpc(addr);
    } catch {
      meta = null;
    }
    if (!meta?.symbol && !meta?.name) {
      await sleep(120);
      meta = await fetchTokenMetaBlockscout(addr);
    }
    if (!meta?.symbol && !meta?.name) {
      await sleep(200);
      continue;
    }
    const symbol = (meta.symbol || shortAddrLocal(addr)).slice(0, 12);
    const name = meta.name || symbol;
    const cls = classifyQuoteClassGuess(symbol);
    QUOTE_REGISTRY[addr] = {
      symbol,
      class: cls === 'other' ? 'other' : cls,
      name,
      decimals: 18,
    };
    // normalize class: keep unknown only if truly empty — prefer other over unknown
    if (QUOTE_REGISTRY[addr].class === 'other') {
      // UI treats non stocks/usdg/eth/btc as unknown-ish; map ticker-like already handled
      QUOTE_REGISTRY[addr].class = /^[A-Z0-9.]{1,8}$/.test(symbol) ? 'stocks' : 'other';
    }
    ok += 1;
    await sleep(350);
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

  // Prefer previously known names/symbols for stubs that failed hydrate last run
  try {
    const prevNamed = await loadPreviousLaunches();
    const prevMap = new Map(
      prevNamed
        .filter((x) => x?.token && x.name && x.name !== 'Unknown')
        .map((x) => [String(x.token).toLowerCase(), x]),
    );
    let restoredMeta = 0;
    for (const item of merged) {
      const key = String(item?.token || '').toLowerCase();
      if (!key) continue;
      const prev = prevMap.get(key);
      if (!prev) continue;
      if ((!item.name || item.name === 'Unknown') && prev.name && prev.name !== 'Unknown') {
        item.name = prev.name;
        restoredMeta += 1;
      }
      if ((!item.symbol || item.symbol === '???') && prev.symbol && prev.symbol !== '???') {
        item.symbol = prev.symbol;
      }
      if (!item.launchedAt && prev.launchedAt) item.launchedAt = prev.launchedAt;
      if ((!item.pairToken || item.pairToken === ZERO) && prev.pairToken) item.pairToken = prev.pairToken;
    }
    if (restoredMeta) console.log(`Restored stub metadata from disk: ${restoredMeta}`);
  } catch (e) {
    errors.push(`prev-meta: ${e.message || e}`);
  }

  try {
    // Aggressive: hydrate ALL stubs (esp. stock-quoted), not a small sample.
    hydrateInfo = await hydrateStubMetadata(merged, 500);
    console.log(`Stub metadata hydrate: ok=${hydrateInfo.ok} fail=${hydrateInfo.fail || 0} attempted=${hydrateInfo.attempted}`);
  } catch (e) {
    errors.push(`hydrate: ${e.message || e}`);
  }

  try {
    const qh = await hydrateUnknownQuotePairs(merged, 60);
    console.log(`Unknown quote pair hydrate: ok=${qh.ok} attempted=${qh.attempted}`);
  } catch (e) {
    errors.push(`quote-hydrate: ${e.message || e}`);
  }

  // Re-apply classifyPair after registry growth / quote hydrate
  for (const item of merged) {
    if (!item?.pairToken) continue;
    const q = classifyPair(item.pairToken);
    item.quoteSymbol = q.quoteSymbol;
    item.quoteClass = q.quoteClass;
    item.quoteName = q.quoteName;
    item.quoteDecimals = q.quoteDecimals;
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
