from __future__ import annotations

from datetime import date
from statistics import mean
from typing import Generator, List, Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend import database, models


RiskProfile = Literal["steady", "balanced", "ambitious"]
LearningFocus = Literal["dividend", "trend", "value"]


app = FastAPI(
    title="Stock Starter API",
    description="Beginner-first Korean stock recommendation API",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

database.Base.metadata.create_all(bind=database.engine)


class PricePoint(BaseModel):
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float
    rsi: Optional[float] = None
    macd: Optional[float] = None

    class Config:
        from_attributes = True


class RecommendationCard(BaseModel):
    ticker_code: str
    ticker_name: str
    market: str
    sector: Optional[str] = None
    score: float
    badge: str
    fit_for: str
    risk_level: str
    current_price: float
    price_change_20d: float
    volatility: float
    reasons: List[str]
    beginner_note: str
    action_guide: str
    profile_match: str


class SummaryCard(BaseModel):
    label: str
    value: str
    tone: str
    description: str


class ActiveProfile(BaseModel):
    risk_profile: RiskProfile
    learning_focus: LearningFocus
    label: str
    description: str


class DashboardResponse(BaseModel):
    as_of: date
    headline: str
    subheadline: str
    starter_steps: List[str]
    summary_cards: List[SummaryCard]
    active_profile: ActiveProfile
    recommendations: List[RecommendationCard]


def get_db() -> Generator[Session, None, None]:
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _pct_change(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0
    return round(((current - previous) / previous) * 100, 1)


def _risk_level(volatility: float, rsi: Optional[float]) -> str:
    if volatility >= 4.5 or (rsi is not None and rsi >= 70):
        return "High"
    if volatility >= 2.5 or (rsi is not None and rsi <= 35):
        return "Medium"
    return "Low"


def _fit_for(score: float, volatility: float) -> str:
    if score >= 78 and volatility < 3:
        return "Best for a beginner who wants a calm first stock."
    if score >= 68:
        return "Best for a beginner comparing a few candidates side by side."
    return "Best as a watchlist idea while you learn how signals move."


def _badge(score: float) -> str:
    if score >= 80:
        return "Strong starter pick"
    if score >= 70:
        return "Worth a closer look"
    return "Watchlist candidate"


def _action_guide(score: float, volatility: float) -> str:
    if score >= 80 and volatility < 3.5:
        return "Consider splitting your first buy into two or three smaller entries."
    if volatility >= 4:
        return "This one moves quickly, so it is safer to study it with a small amount first."
    return "Check earnings dates and recent news before making any first-buy decision."


def _beginner_note(rsi: Optional[float], macd: Optional[float]) -> str:
    if rsi is not None and rsi < 35:
        return "The stock recently cooled down, which can feel less intimidating for a first-time investor."
    if macd is not None and macd > 0:
        return "The short-term trend is still intact, so it is useful for learning how momentum behaves."
    return "Treat this as a learning candidate first and a buy decision second."


def _focus_bonus(
    ticker: models.Ticker,
    latest: models.DailyPrice,
    change_20d: float,
    volatility: float,
    learning_focus: LearningFocus,
) -> tuple[float, str]:
    sector = (ticker.sector or "").lower()

    if learning_focus == "dividend":
        if volatility <= 3.0:
            return 8.0, "Matched for steady learners who prefer calmer price swings."
        return 3.0, "Less calm than a typical steady-income learner may want."

    if learning_focus == "trend":
        if latest.macd is not None and latest.macd > 0 and change_20d > 0:
            return 10.0, "Matched for trend learners because momentum is still positive."
        return 2.0, "Trend signals are mixed, so this is more observational than aggressive."

    if any(keyword in sector for keyword in ["service", "chemical", "bio", "electric", "tech"]):
        return 8.0, "Matched for value learners because the sector can be compared across peers."
    return 4.0, "Useful for value learners, but you may want extra business-context reading."


def _risk_bonus(volatility: float, risk_profile: RiskProfile) -> tuple[float, str]:
    if risk_profile == "steady":
        if volatility < 3.0:
            return 12.0, "Fits a steady profile thanks to lower recent volatility."
        if volatility < 5.0:
            return 5.0, "Acceptable for a steady profile, but not the calmest option."
        return -5.0, "Too jumpy for a steady first-time investing profile."

    if risk_profile == "ambitious":
        if volatility >= 4.0:
            return 8.0, "Fits an ambitious profile that can tolerate faster price moves."
        return 3.0, "Solid candidate, though not especially high-energy."

    if volatility < 5.0:
        return 8.0, "Fits a balanced profile with manageable short-term movement."
    return 2.0, "Balanced investors can still watch it, but position sizing matters."


def _profile_copy(risk_profile: RiskProfile, learning_focus: LearningFocus) -> ActiveProfile:
    labels = {
        ("steady", "dividend"): (
            "Slow and steady starter",
            "Lower-volatility names rise to the top, with beginner notes tuned for patient learning.",
        ),
        ("steady", "trend"): (
            "Careful trend learner",
            "Momentum still matters, but unstable charts are pushed down for a safer first experience.",
        ),
        ("steady", "value"): (
            "Patient comparison learner",
            "The service favors names that are easier to compare calmly rather than chase quickly.",
        ),
        ("balanced", "dividend"): (
            "Balanced income explorer",
            "You get a mix of stability and learning value, with calmer names still rewarded.",
        ),
        ("balanced", "trend"): (
            "Balanced momentum learner",
            "You see names with positive signals, but extreme volatility stays penalized.",
        ),
        ("balanced", "value"): (
            "Balanced stock explorer",
            "The ranking stays broad so a beginner can compare sectors without overcommitting.",
        ),
        ("ambitious", "dividend"): (
            "Active but income-aware",
            "The service still respects stability, but it allows faster-moving names into the shortlist.",
        ),
        ("ambitious", "trend"): (
            "Fast-learning momentum explorer",
            "Recent strength matters more, and higher-volatility charts can rank better.",
        ),
        ("ambitious", "value"): (
            "Bold comparison learner",
            "You still compare business stories, but the service allows more movement in the shortlist.",
        ),
    }
    label, description = labels[(risk_profile, learning_focus)]
    return ActiveProfile(
        risk_profile=risk_profile,
        learning_focus=learning_focus,
        label=label,
        description=description,
    )


def build_recommendation(
    ticker: models.Ticker,
    prices: List[models.DailyPrice],
    risk_profile: RiskProfile,
    learning_focus: LearningFocus,
) -> RecommendationCard:
    latest = prices[0]
    oldest = prices[-1]
    closes = [price.close for price in prices]
    volumes = [price.volume for price in prices[:10]]
    avg_volume = mean(volumes)
    volatility = round(((max(closes) - min(closes)) / latest.close) * 100, 1)
    change_20d = _pct_change(latest.close, oldest.close)

    score = 50.0
    reasons: List[str] = []

    if latest.rsi is not None:
        if latest.rsi < 35:
            score += 14
            reasons.append("RSI is in a cooler zone, so the stock is not being chased as aggressively.")
        elif latest.rsi <= 60:
            score += 10
            reasons.append("RSI is still in a manageable range for a beginner studying entries.")
        else:
            score += 4
            reasons.append("The stock has strength, but short-term heat should be watched closely.")

    if latest.macd is not None:
        if latest.macd > 0:
            score += 12
            reasons.append("MACD remains positive, so near-term momentum has not broken down yet.")
        else:
            reasons.append("MACD is weaker here, so this name needs more confirmation than the top picks.")

    if latest.volume > avg_volume * 1.2:
        score += 10
        reasons.append("Recent trading volume is above average, which suggests rising attention.")

    if change_20d > 8:
        score += 10
        reasons.append("The last 20 sessions were clearly positive, making the direction easier to read.")
    elif change_20d > 0:
        score += 6
        reasons.append("The short-term path stayed constructive instead of breaking down.")
    else:
        score += 2
        reasons.append("The stock is in a pause phase, so a beginner should think in partial entries.")

    if volatility < 3:
        score += 10
        reasons.append("Volatility stayed relatively calm, which can feel friendlier for a first buy.")
    elif volatility < 6:
        score += 5
    else:
        reasons.append("Price swings were large, so sizing discipline matters more than usual.")

    risk_delta, risk_match = _risk_bonus(volatility, risk_profile)
    focus_delta, focus_match = _focus_bonus(ticker, latest, change_20d, volatility, learning_focus)
    score += risk_delta + focus_delta

    score = round(min(max(score, 0.0), 99.0), 1)
    risk_level = _risk_level(volatility, latest.rsi)

    return RecommendationCard(
        ticker_code=ticker.code,
        ticker_name=ticker.name,
        market=ticker.market,
        sector=ticker.sector,
        score=score,
        badge=_badge(score),
        fit_for=_fit_for(score, volatility),
        risk_level=risk_level,
        current_price=latest.close,
        price_change_20d=change_20d,
        volatility=volatility,
        reasons=reasons[:4],
        beginner_note=_beginner_note(latest.rsi, latest.macd),
        action_guide=_action_guide(score, volatility),
        profile_match=f"{risk_match} {focus_match}",
    )


def get_ranked_recommendations(
    db: Session,
    limit: int = 10,
    risk_profile: RiskProfile = "balanced",
    learning_focus: LearningFocus = "trend",
) -> List[RecommendationCard]:
    tickers = db.query(models.Ticker).order_by(models.Ticker.market, models.Ticker.code).all()
    recommendations: List[RecommendationCard] = []

    for ticker in tickers:
        prices = (
            db.query(models.DailyPrice)
            .filter(models.DailyPrice.ticker_code == ticker.code)
            .order_by(models.DailyPrice.date.desc())
            .limit(20)
            .all()
        )
        if len(prices) < 10:
            continue
        recommendations.append(
            build_recommendation(
                ticker=ticker,
                prices=prices,
                risk_profile=risk_profile,
                learning_focus=learning_focus,
            )
        )

    recommendations.sort(key=lambda item: item.score, reverse=True)
    return recommendations[:limit]


@app.get("/")
def read_root() -> dict:
    return {"message": "Stock Starter API"}


@app.get("/health")
def health_check() -> dict:
    return {"status": "healthy"}


@app.get("/prices/{ticker_code}", response_model=List[PricePoint])
def read_prices(ticker_code: str, limit: int = 90, db: Session = Depends(get_db)) -> List[models.DailyPrice]:
    prices = (
        db.query(models.DailyPrice)
        .filter(models.DailyPrice.ticker_code == ticker_code)
        .order_by(models.DailyPrice.date.desc())
        .limit(limit)
        .all()
    )
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    return prices


@app.get("/recommendations", response_model=List[RecommendationCard])
def read_recommendations(
    limit: int = 10,
    risk_profile: RiskProfile = Query(default="balanced"),
    learning_focus: LearningFocus = Query(default="trend"),
    db: Session = Depends(get_db),
) -> List[RecommendationCard]:
    return get_ranked_recommendations(
        db,
        limit=limit,
        risk_profile=risk_profile,
        learning_focus=learning_focus,
    )


@app.get("/dashboard", response_model=DashboardResponse)
def read_dashboard(
    risk_profile: RiskProfile = Query(default="balanced"),
    learning_focus: LearningFocus = Query(default="trend"),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    recommendations = get_ranked_recommendations(
        db,
        limit=10,
        risk_profile=risk_profile,
        learning_focus=learning_focus,
    )
    if not recommendations:
        raise HTTPException(status_code=404, detail="No recommendation data available")

    latest_date = db.query(models.DailyPrice.date).order_by(models.DailyPrice.date.desc()).first()
    as_of = latest_date[0] if latest_date else date.today()
    average_score = round(mean(item.score for item in recommendations), 1)
    low_risk_count = len([item for item in recommendations if item.risk_level == "Low"])
    positive_trend_count = len([item for item in recommendations if item.price_change_20d > 0])

    return DashboardResponse(
        as_of=as_of,
        headline="Stock picks that explain the why, not just the score",
        subheadline="Built for beginners who want guidance similar to investment starter apps: clear reasons, simple risk language, and a profile-aware shortlist.",
        starter_steps=[
            "Pick a profile first so the list matches how cautious or curious you want your first investing step to be.",
            "Read the risk line and beginner note before you read the score.",
            "Use the chart and recent trend together, then check earnings dates and news before buying anything.",
        ],
        summary_cards=[
            SummaryCard(
                label="Stocks ranked",
                value=f"{len(recommendations)}",
                tone="neutral",
                description="Only names with enough recent price data are included in the shortlist.",
            ),
            SummaryCard(
                label="Average score",
                value=f"{average_score}",
                tone="positive",
                description="This blends technical signals with beginner-friendly volatility and profile fit.",
            ),
            SummaryCard(
                label="Low-risk names",
                value=f"{low_risk_count}",
                tone="calm",
                description="These names showed calmer recent movement than the rest of the shortlist.",
            ),
            SummaryCard(
                label="Positive 20-day trend",
                value=f"{positive_trend_count}",
                tone="warm",
                description="Names still holding a positive recent direction over the last 20 sessions.",
            ),
        ],
        active_profile=_profile_copy(risk_profile, learning_focus),
        recommendations=recommendations,
    )
