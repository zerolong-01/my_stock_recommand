"""
Standalone market data collection for the Stock Starter app.

This script reuses the backend database/models so the local demo flow and the
API stay in sync. It fetches a small starter basket from KRX, calculates basic
RSI and MACD values, and upserts them into SQLite or the configured DB.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
import os
import sys

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", f"sqlite:///{(ROOT / 'backend' / 'stock_analysis.db').as_posix()}")
os.environ.setdefault("MPLCONFIGDIR", str(ROOT / ".tmp-matplotlib"))
Path(os.environ["MPLCONFIGDIR"]).mkdir(parents=True, exist_ok=True)

import pandas as pd
from pykrx import stock

from backend import database, models  # noqa: E402


@dataclass(frozen=True)
class SeedTicker:
    code: str
    name: str
    market: str
    sector: str


STARTER_TICKERS: list[SeedTicker] = [
    SeedTicker("005930", "Samsung Electronics", "KOSPI", "Semiconductor"),
    SeedTicker("000660", "SK hynix", "KOSPI", "Semiconductor"),
    SeedTicker("035420", "NAVER", "KOSPI", "Internet Platform"),
    SeedTicker("051910", "LG Chem", "KOSPI", "Chemicals"),
    SeedTicker("035720", "Kakao", "KOSPI", "Internet Platform"),
    SeedTicker("005380", "Hyundai Motor", "KOSPI", "Automotive"),
    SeedTicker("006400", "Samsung SDI", "KOSPI", "Battery"),
    SeedTicker("207940", "Samsung Biologics", "KOSPI", "Biotech"),
    SeedTicker("068270", "Celltrion", "KOSPI", "Biotech"),
    SeedTicker("028260", "Samsung C&T", "KOSPI", "Industrial"),
]


def calculate_rsi(close_series: pd.Series, window: int = 14) -> pd.Series:
    delta = close_series.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    avg_gain = gains.rolling(window=window, min_periods=window).mean()
    avg_loss = losses.rolling(window=window, min_periods=window).mean()
    rs = avg_gain / avg_loss.replace(0, pd.NA)
    rsi = 100 - (100 / (1 + rs))
    return rsi.astype(float)


def calculate_macd(close_series: pd.Series) -> pd.Series:
    ema_fast = close_series.ewm(span=12, adjust=False).mean()
    ema_slow = close_series.ewm(span=26, adjust=False).mean()
    return ema_fast - ema_slow


def fetch_price_frame(ticker_code: str, start_date: str, end_date: str) -> pd.DataFrame:
    frame = stock.get_market_ohlcv_by_date(start_date, end_date, ticker_code)
    if frame.empty:
        return frame

    renamed = frame.rename(
        columns={
            "시가": "Open",
            "고가": "High",
            "저가": "Low",
            "종가": "Close",
            "거래량": "Volume",
        }
    )
    renamed["RSI"] = calculate_rsi(renamed["Close"].astype(float))
    renamed["MACD"] = calculate_macd(renamed["Close"].astype(float))
    return renamed


def upsert_tickers(db) -> None:
    for starter in STARTER_TICKERS:
        existing = db.query(models.Ticker).filter(models.Ticker.code == starter.code).first()
        if existing:
            existing.name = starter.name
            existing.market = starter.market
            existing.sector = starter.sector
            continue

        db.add(
            models.Ticker(
                code=starter.code,
                name=starter.name,
                market=starter.market,
                sector=starter.sector,
            )
        )
    db.commit()


def upsert_prices(db, ticker: SeedTicker, frame: pd.DataFrame) -> tuple[int, int]:
    inserted = 0
    updated = 0

    for date_idx, row in frame.iterrows():
        record_date = date_idx.date()
        existing = (
            db.query(models.DailyPrice)
            .filter(
                models.DailyPrice.ticker_code == ticker.code,
                models.DailyPrice.date == record_date,
            )
            .first()
        )

        payload = {
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": float(row["Volume"]),
            "rsi": float(row["RSI"]) if pd.notna(row["RSI"]) else None,
            "macd": float(row["MACD"]) if pd.notna(row["MACD"]) else None,
        }

        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
            updated += 1
            continue

        db.add(
            models.DailyPrice(
                ticker_code=ticker.code,
                date=record_date,
                **payload,
            )
        )
        inserted += 1

    db.commit()
    return inserted, updated


def collect_data(days: int = 120) -> int:
    print("=" * 60)
    print("Stock Starter market data collection")
    print("=" * 60)

    end_date = datetime.now().strftime("%Y%m%d")
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
    db = database.SessionLocal()

    total_inserted = 0
    total_updated = 0
    success_count = 0

    try:
        upsert_tickers(db)
        print(f"Loaded {len(STARTER_TICKERS)} starter tickers.")
        print(f"Collecting OHLCV history from {start_date} to {end_date}.")

        for ticker in STARTER_TICKERS:
            try:
                print(f"- {ticker.name} ({ticker.code})")
                frame = fetch_price_frame(ticker.code, start_date, end_date)
                if frame.empty:
                    print("  No market data returned.")
                    continue

                inserted, updated = upsert_prices(db, ticker, frame)
                total_inserted += inserted
                total_updated += updated
                success_count += 1
                print(f"  Saved {len(frame)} rows ({inserted} inserted, {updated} updated).")
            except Exception as exc:
                db.rollback()
                print(f"  Failed: {exc}")

        print("\nCollection complete.")
        print(f"Tickers processed successfully: {success_count}/{len(STARTER_TICKERS)}")
        print(f"Price rows inserted: {total_inserted}")
        print(f"Price rows updated: {total_updated}")
        print(f"Database: {database.DATABASE_URL}")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"\nCollection failed: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(collect_data())
