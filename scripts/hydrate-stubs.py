#!/usr/bin/env python3
import json, subprocess, time, re
from pathlib import Path
from collections import Counter

FEED = Path("/workspace/stockcurve/public/feed")
launches_doc = json.loads((FEED / "launches.json").read_text())
quotes_doc = json.loads((FEED / "quotes.json").read_text())
launches = launches_doc["launches"]

reg_map = {}
for row in quotes_doc.get("registry") or []:
    if row.get("address"):
        reg_map[row["address"].lower()] = {
            "symbol": row.get("symbol"),
            "class": row.get("class"),
            "name": row.get("name"),
            "decimals": row.get("decimals"),
        }

mp_path = Path("/tmp/new_quotes_map.json")
if mp_path.exists():
    for a, meta in json.loads(mp_path.read_text()).items():
        reg_map[a.lower()] = meta

src = Path("/workspace/stockcurve/scripts/refresh-data.mjs").read_text()
pat = re.compile(
    r"'((?:0x)[a-fA-F0-9]{40})'\s*:\s*\{\s*symbol:\s*'([^']+)'\s*,\s*class:\s*'([^']+)'\s*,\s*name:\s*'([^']*)'\s*,\s*decimals:\s*(\d+)"
)
for line in src.splitlines():
    am = pat.search(line)
    if not am:
        continue
    addr, sym, cls, name, dec = am.groups()
    reg_map[addr.lower()] = {
        "symbol": sym,
        "class": cls,
        "name": name,
        "decimals": int(dec),
    }

reg_map["0x0000000000000000000000000000000000000000"] = {
    "symbol": "ETH",
    "class": "eth",
    "name": "Native ETH",
    "decimals": 18,
}
reg_map["0x0bd7d308f8e1639fab988df18a8011f41eacad73"] = {
    "symbol": "WETH",
    "class": "eth",
    "name": "Wrapped ETH",
    "decimals": 18,
}
print("registry size", len(reg_map), flush=True)


def short(a):
    s = str(a or "")
    return f"{s[:6]}…{s[-4:]}" if len(s) >= 12 else (s or "—")


def classify(pair):
    hit = reg_map.get((pair or "").lower())
    if hit:
        return hit["symbol"], hit["class"], hit["name"], hit.get("decimals")
    return "UNK", "unknown", "Unknown quote", None


unk_before = sum(
    1 for x in launches if x.get("quoteClass") == "unknown" or x.get("quoteSymbol") == "UNK"
)
for x in launches:
    sym, cls, name, dec = classify(x.get("pairToken"))
    x["quoteSymbol"] = sym
    x["quoteClass"] = cls
    x["quoteName"] = name
    x["quoteDecimals"] = dec
unk_after = sum(
    1 for x in launches if x.get("quoteClass") == "unknown" or x.get("quoteSymbol") == "UNK"
)
print("unknown quotes", unk_before, "->", unk_after, flush=True)


def is_stub(x):
    n, s = x.get("name"), x.get("symbol")
    return (not n) or n == "Unknown" or (not s) or s in ("???", "UNK")


stubs = [x for x in launches if is_stub(x)]
stubs.sort(
    key=lambda x: 0
    if x.get("quoteClass") == "stocks"
    else 1
    if x.get("quoteClass") == "unknown"
    else 2
)
print(
    "stubs",
    len(stubs),
    "stock",
    sum(1 for x in stubs if x.get("quoteClass") == "stocks"),
    flush=True,
)


def rpc(method, params, retries=8):
    for i in range(retries):
        payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
        out = subprocess.check_output(
            [
                "curl",
                "-sS",
                "--max-time",
                "25",
                "-X",
                "POST",
                "https://rpc.mainnet.chain.robinhood.com",
                "-H",
                "content-type: application/json",
                "-H",
                "User-Agent: StockCurve/1.1 (+hydrate)",
                "-d",
                payload,
            ],
            text=True,
        )
        j = json.loads(out)
        if j.get("error"):
            msg = str(j["error"])
            if "429" in msg or "Too Many" in msg:
                time.sleep(1.2 * (i + 1))
                continue
            raise RuntimeError(j["error"])
        return j.get("result")
    raise RuntimeError("rate limited")


def decode(hexdata):
    h = (hexdata or "").replace("0x", "")
    if not h:
        return None
    if len(h) >= 128:
        try:
            length = int(h[64:128], 16)
            if 0 < length <= 256:
                data = h[128 : 128 + length * 2]
                s = bytes.fromhex(data).decode("utf-8", "ignore").replace("\0", "").strip()
                if s:
                    return s
        except Exception:
            pass
    try:
        raw = bytes.fromhex(h[:64].ljust(64, "0")).rstrip(b"\0")
        return raw.decode("utf-8", "ignore").strip() or None
    except Exception:
        return None


ok = fail = 0
for i, item in enumerate(stubs):
    tok = item["token"]
    try:
        name = decode(rpc("eth_call", [{"to": tok, "data": "0x06fdde03"}, "latest"]))
        time.sleep(0.4)
        sym = decode(rpc("eth_call", [{"to": tok, "data": "0x95d89b41"}, "latest"]))
        if name:
            item["name"] = name
        if sym:
            item["symbol"] = sym
        if name or sym:
            ok += 1
            print(
                f"[{i+1}/{len(stubs)}] OK {short(tok)} -> {item.get('name')!r} / {item.get('symbol')!r}",
                flush=True,
            )
        else:
            fail += 1
            if not item.get("name") or item["name"] == "Unknown":
                item["name"] = f"Token {short(tok)}"
            if not item.get("symbol") or item["symbol"] in ("???", "UNK"):
                item["symbol"] = short(tok)
            print(f"[{i+1}/{len(stubs)}] EMPTY {short(tok)}", flush=True)
    except Exception as e:
        fail += 1
        if not item.get("name") or item["name"] == "Unknown":
            item["name"] = f"Token {short(tok)}"
        if not item.get("symbol") or item["symbol"] in ("???", "UNK"):
            item["symbol"] = short(tok)
        print(f"[{i+1}/{len(stubs)}] FAIL {short(tok)} {e}", flush=True)
    time.sleep(0.5)

for x in launches:
    if not x.get("name") or x["name"] == "Unknown":
        x["name"] = f"Token {short(x.get('token'))}"
    if not x.get("symbol") or x["symbol"] in ("???", "UNK"):
        x["symbol"] = short(x.get("token"))

stocks = [x for x in launches if x.get("quoteClass") == "stocks"]
still = [
    x
    for x in stocks
    if str(x.get("name", "")).startswith("Token ") or x.get("name") == "Unknown"
]
print("hydrate ok", ok, "fail", fail, flush=True)
print(
    "stocks",
    len(stocks),
    "still-placeholder",
    len(still),
    f"real%={100 * (len(stocks) - len(still)) / max(1, len(stocks)):.0f}",
    flush=True,
)

quotes_doc["registry"] = [
    {
        "address": a,
        "symbol": m["symbol"],
        "class": m["class"],
        "name": m["name"],
        "decimals": m.get("decimals"),
    }
    for a, m in sorted(reg_map.items())
]
quotes_doc["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
quotes_doc["source"] = "registry+o1-catalog"
launches_doc["launches"] = launches
launches_doc["updatedAt"] = quotes_doc["updatedAt"]
(FEED / "launches.json").write_text(json.dumps(launches_doc, indent=2) + "\n")
(FEED / "quotes.json").write_text(json.dumps(quotes_doc, indent=2) + "\n")

meta_path = FEED / "meta.json"
if meta_path.exists():
    meta = json.loads(meta_path.read_text())
    c = Counter(x.get("quoteClass") or "unknown" for x in launches)
    meta.setdefault("counts", {})["byQuoteClass"] = dict(c)
    meta["counts"]["launches"] = len(launches)
    meta["updatedAt"] = launches_doc["updatedAt"]
    meta_path.write_text(json.dumps(meta, indent=2) + "\n")
print("wrote feed files", flush=True)
