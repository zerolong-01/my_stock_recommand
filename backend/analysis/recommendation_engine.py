"""
Recommendation helpers shared by the Stock Starter backend.

This module keeps the ranking logic separate from the FastAPI route layer so it
can be reused from API handlers and future batch jobs.
"""
from __future__ import annotations

from statistics import mean
from typing import Iterable, Optional

from backend import models


def pct_change(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0
    return round(((current - previous) / previous) * 100, 1)


def calculate_volatility(closes: Iterable[float], latest_close: float) -> float:
    close_values = list(closes)
    if not close_values or latest_close == 0:
        return 0.0
    return round(((max(close_values) - min(close_values)) / latest_close) * 100, 1)


def risk_level(volatility: float, rsi: Optional[float]) -> str:
    if volatility >= 4.5 or (rsi is not None and rsi >= 70):
        return "High"
    if volatility >= 2.5 or (rsi is not None and rsi <= 35):
        return "Medium"
    return "Low"


def fit_for(score: float, volatility: float) -> str:
    if score >= 78 and volatility < 3:
        return "Best for a beginner who wants a calm first stock."
    if score >= 68:
        return "Best for a beginner comparing a few candidates side by side."
    return "Best as a watchlist idea while you learn how signals move."


def badge(score: float) -> str:
    if score >= 80:
        return "Strong starter pick"
    if score >= 70:
        return "Worth a closer look"
    return "Watchlist candidate"


def action_guide(score: float, volatility: float) -> str:
    if score >= 80 and volatility < 3.5:
        return "Consider splitting your first buy into two or three smaller entries."
    if volatility >= 4:
        return "This one moves quickly, so it is safer to study it with a small amount first."
    return "Check earnings dates and recent news before making any first-buy decision."


def beginner_note(rsi: Optional[float], macd: Optional[float]) -> str:
    if rsi is not None and rsi < 35:
        return "The stock recently cooled down, which can feel less intimidating for a first-time investor."
    if macd is not None and macd > 0:
        return "The short-term trend is still intact, so it is useful for learning how momentum behaves."
    return "Treat this as a learning candidate first and a buy decision second."


def history_is_usable(prices: list[models.DailyPrice], minimum_points: int = 10) -> bool:
    return len(prices) >= minimum_points and all(price.close is not None for price in prices[:minimum_points])


def average_recent_volume(prices: list[models.DailyPrice], sessions: int = 10) -> float:
    recent_volumes = [price.volume for price in prices[:sessions] if price.volume is not None]
    if not recent_volumes:
        return 0.0
    return mean(recent_volumes)
