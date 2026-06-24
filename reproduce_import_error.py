from __future__ import annotations

import os
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parent
DATABASE_PATH = ROOT / "backend" / "stock_analysis.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{DATABASE_PATH.as_posix()}")

from backend.main import app  # noqa: E402


def main() -> None:
    client = TestClient(app)

    endpoints = [
        ("/health", {}, 200),
        ("/tickers", {"limit": 3}, 200),
        ("/recommendations", {"limit": 3}, 200),
        (
            "/compare",
            [("ticker_codes", "005930"), ("ticker_codes", "000660")],
            200,
        ),
        (
            "/dashboard",
            {"risk_profile": "balanced", "learning_focus": "trend", "monthly_budget": 300000},
            200,
        ),
    ]

    print("Running backend smoke checks against", DATABASE_PATH)
    for path, params, expected_status in endpoints:
        response = client.get(path, params=params)
        if response.status_code != expected_status:
            raise AssertionError(f"{path} returned {response.status_code}, expected {expected_status}")
        print(f"ok {path} -> {response.status_code}")

    ticker_search = client.get("/tickers", params={"query": "005930", "limit": 5})
    ticker_search.raise_for_status()
    codes = [item["code"] for item in ticker_search.json()]
    if "005930" not in codes:
        raise AssertionError("Ticker search did not return the expected code 005930")
    print("ok /tickers query search ->", ", ".join(codes))


if __name__ == "__main__":
    main()
