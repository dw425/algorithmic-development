"""Phase 5 — data loader: Yahoo tickers OR generic CSV; any interval (1d/1wk/1mo); any years.
Disk-cached. Built fresh + gated by tests/test_foundation.py."""
import csv as _csv
import json
import os
import ssl
import urllib.request
import datetime

try:
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:  # noqa
    _SSL = ssl._create_unverified_context()

CACHE = os.path.join(os.path.dirname(__file__), "cache")
os.makedirs(CACHE, exist_ok=True)
TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "JNJ"]


def _epoch(y, m, d):
    return int(datetime.datetime(y, m, d, tzinfo=datetime.timezone.utc).timestamp())


def fetch(ticker, force=False, interval="1d", y0=2024, y1=2025):
    """Return {'ticker','rows':[{date,close}]}; cached. Granularity via interval; years via y0..y1."""
    suffix = "" if (interval == "1d" and (y0, y1) == (2024, 2025)) else f"_{interval}_{y0}_{y1}"
    path = os.path.join(CACHE, f"{ticker}{suffix}.json")
    if os.path.exists(path) and not force:
        with open(path) as f:
            return json.load(f)
    p1, p2 = _epoch(y0 - 1, 12, 1), _epoch(y1 + 1, 1, 15)
    years = set(range(y0, y1 + 1))
    last_err = None
    for host in ("query1", "query2"):
        url = (f"https://{host}.finance.yahoo.com/v8/finance/chart/{ticker}"
               f"?period1={p1}&period2={p2}&interval={interval}")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            try:
                resp = urllib.request.urlopen(req, timeout=25, context=_SSL)
            except ssl.SSLError:
                resp = urllib.request.urlopen(req, timeout=25, context=ssl._create_unverified_context())
            with resp:
                payload = json.load(resp)
            res = payload["chart"]["result"][0]
            ts, closes = res["timestamp"], res["indicators"]["quote"][0]["close"]
            rows = []
            for t, c in zip(ts, closes):
                if c is None:
                    continue
                d = datetime.datetime.fromtimestamp(t, datetime.timezone.utc).date()
                if d.year in years:
                    rows.append({"date": d.isoformat(), "close": float(c)})
            rows.sort(key=lambda x: x["date"])
            out = {"ticker": ticker, "rows": rows}
            with open(path, "w") as f:
                json.dump(out, f)
            return out
        except Exception as e:  # noqa
            last_err = e
    raise RuntimeError(f"fetch failed for {ticker}: {last_err}")


def load_csv_series(path):
    """Generic CSV loader: a date column + a value column → [{date, close}]."""
    with open(path) as f:
        reader = _csv.reader(f)
        header = next(reader)
        cols = [h.strip().lower() for h in header]
        di = next((i for i, c in enumerate(cols) if "date" in c or "time" in c), 0)
        vi = next((i for i, c in enumerate(cols)
                   if c in ("close", "value", "price", "y", "adj close", "adj_close")), 1)
        rows = []
        for r in reader:
            if len(r) <= max(di, vi):
                continue
            try:
                rows.append({"date": str(r[di]).strip(), "close": float(r[vi])})
            except ValueError:
                continue
    rows.sort(key=lambda x: x["date"])
    return rows


def universe():
    """All tickers with cached raw data (Phase 6)."""
    return sorted(f[:-5] for f in os.listdir(CACHE)
                  if f.endswith(".json") and "_" not in f and f[:-5].isalpha())
