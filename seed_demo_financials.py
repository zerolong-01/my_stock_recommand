import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "backend" / "stock_analysis.db"
SEED_PATH = ROOT / "database" / "sample_financial_statements.json"


def main() -> None:
    records = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS financial_statements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker_code TEXT NOT NULL,
            year INTEGER NOT NULL,
            quarter INTEGER NOT NULL,
            revenue REAL,
            operating_income REAL,
            net_income REAL,
            source TEXT,
            is_demo INTEGER DEFAULT 0
        )
        """
    )

    cur.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_financials_unique
        ON financial_statements (ticker_code, year, quarter)
        """
    )

    for record in records:
        cur.execute(
            """
            INSERT INTO financial_statements (
                ticker_code, year, quarter, revenue, operating_income, net_income, source, is_demo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(ticker_code, year, quarter) DO UPDATE SET
                revenue=excluded.revenue,
                operating_income=excluded.operating_income,
                net_income=excluded.net_income,
                source=excluded.source,
                is_demo=excluded.is_demo
            """,
            (
                record["ticker_code"],
                record["year"],
                record["quarter"],
                record["revenue"],
                record["operating_income"],
                record["net_income"],
                record["source"],
                1 if record["is_demo"] else 0,
            ),
        )

    conn.commit()
    cur.execute("select count(*) from financial_statements")
    total = cur.fetchone()[0]
    conn.close()
    print(f"Seeded demo financial statements. total_rows={total}")


if __name__ == "__main__":
    main()
