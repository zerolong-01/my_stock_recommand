"""
Quick database health check for the Stock Starter app.

This script reuses the backend DB configuration so the numbers match what the
API is reading. It prints table counts, recent market dates, and a couple of
sample recommendations-oriented records for fast sanity checks.
"""
from __future__ import annotations

from pathlib import Path
import os
import sys

from sqlalchemy import func


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", f"sqlite:///{(ROOT / 'backend' / 'stock_analysis.db').as_posix()}")

from backend import database, models  # noqa: E402


def check_db() -> int:
    db = database.SessionLocal()
    try:
        ticker_count = db.query(models.Ticker).count()
        price_count = db.query(models.DailyPrice).count()
        financial_count = db.query(models.FinancialStatement).count()
        latest_price_date = db.query(func.max(models.DailyPrice.date)).scalar()

        print("=" * 60)
        print("Stock Starter DB check")
        print("=" * 60)
        print(f"Database URL: {database.DATABASE_URL}")
        print(f"Tickers: {ticker_count}")
        print(f"Daily prices: {price_count}")
        print(f"Financial statements: {financial_count}")
        print(f"Latest price date: {latest_price_date}")

        sample_tickers = db.query(models.Ticker).order_by(models.Ticker.code).limit(5).all()
        if sample_tickers:
            print("\nSample tickers:")
            for ticker in sample_tickers:
                print(f"- {ticker.code} | {ticker.name} | {ticker.market} | {ticker.sector}")

        sample_prices = (
            db.query(models.DailyPrice)
            .order_by(models.DailyPrice.date.desc(), models.DailyPrice.ticker_code.asc())
            .limit(5)
            .all()
        )
        if sample_prices:
            print("\nLatest saved prices:")
            for price in sample_prices:
                print(
                    f"- {price.date} | {price.ticker_code} | close={price.close:.2f} "
                    f"| volume={price.volume:.0f} | rsi={price.rsi} | macd={price.macd}"
                )

        demo_financials = (
            db.query(models.FinancialStatement)
            .filter(models.FinancialStatement.is_demo == True)
            .count()
        )
        if financial_count:
            print(f"\nDemo financial rows: {demo_financials}")

        print("=" * 60)
        return 0
    except Exception as exc:
        print(f"Database check failed: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(check_db())
