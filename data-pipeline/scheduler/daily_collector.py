"""
Daily scheduler for the Stock Starter market data refresh.

This reuses the standalone `collect_stock_data.py` entrypoint so the one-off
manual refresh flow and the scheduled flow stay identical.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import os
import sys

from apscheduler.schedulers.blocking import BlockingScheduler


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import collect_stock_data  # noqa: E402


DEFAULT_HOUR = int(os.getenv("STOCK_STARTER_SCHEDULE_HOUR", "16"))
DEFAULT_MINUTE = int(os.getenv("STOCK_STARTER_SCHEDULE_MINUTE", "0"))
DEFAULT_DAYS = int(os.getenv("STOCK_STARTER_COLLECT_DAYS", "120"))
RUN_MODE = os.getenv("STOCK_STARTER_SCHEDULER_MODE", "once").lower()


def collect_and_process_data(days: int = DEFAULT_DAYS) -> int:
    started_at = datetime.now()
    print(f"[{started_at:%Y-%m-%d %H:%M:%S}] Starting Stock Starter scheduled refresh.")
    exit_code = collect_stock_data.collect_data(days=days)
    finished_at = datetime.now()
    status = "succeeded" if exit_code == 0 else "failed"
    print(f"[{finished_at:%Y-%m-%d %H:%M:%S}] Scheduled refresh {status}.")
    return exit_code


def run_scheduler() -> None:
    scheduler = BlockingScheduler(timezone="Asia/Seoul")
    scheduler.add_job(
        collect_and_process_data,
        "cron",
        hour=DEFAULT_HOUR,
        minute=DEFAULT_MINUTE,
        kwargs={"days": DEFAULT_DAYS},
        id="stock_starter_daily_refresh",
        replace_existing=True,
    )

    print(
        "Scheduler started. "
        f"Daily refresh will run at {DEFAULT_HOUR:02d}:{DEFAULT_MINUTE:02d} Asia/Seoul "
        f"with a {DEFAULT_DAYS}-day lookback."
    )
    scheduler.start()


def main() -> int:
    if RUN_MODE == "scheduler":
        run_scheduler()
        return 0

    return collect_and_process_data(days=DEFAULT_DAYS)


if __name__ == "__main__":
    raise SystemExit(main())
