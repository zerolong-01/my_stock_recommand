from __future__ import annotations

from datetime import date
from statistics import mean
from typing import Generator, List, Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from backend.analysis import recommendation_engine
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


class TickerSummary(BaseModel):
    code: str
    name: str
    market: str
    sector: Optional[str] = None

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
    financial_snapshot: FinancialSnapshot


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


class StarterAllocation(BaseModel):
    ticker_code: str
    ticker_name: str
    sector: Optional[str] = None
    weight: float
    target_amount: int
    estimated_shares: int
    invested_amount: int
    current_price: float
    role: str
    note: str


class StarterPlan(BaseModel):
    monthly_budget: int
    estimated_investment: int
    cash_buffer: int
    profile_note: str
    allocations: List[StarterAllocation]
    tips: List[str]


class FinancialSnapshot(BaseModel):
    revenue: Optional[float] = None
    operating_income: Optional[float] = None
    net_income: Optional[float] = None
    year: Optional[int] = None
    quarter: Optional[int] = None
    source: Optional[str] = None
    is_demo: bool = False
    summary: str


class DataSourceSummary(BaseModel):
    name: str
    status: str
    description: str


class BriefingCard(BaseModel):
    title: str
    label: str
    ticker_code: str
    ticker_name: str
    detail: str


class DataHealthCard(BaseModel):
    label: str
    value: str
    tone: str
    detail: str


class CompareRow(BaseModel):
    ticker_code: str
    ticker_name: str
    sector: Optional[str] = None
    score: float
    risk_level: str
    price_change_20d: float
    volatility: float
    financial_label: str


class SectorExposureCard(BaseModel):
    sector: str
    shortlist_count: int
    starter_weight: float
    note: str


class RiskAlertCard(BaseModel):
    title: str
    severity: str
    detail: str
    ticker_code: Optional[str] = None
    ticker_name: Optional[str] = None


class DashboardResponse(BaseModel):
    as_of: date
    headline: str
    subheadline: str
    starter_steps: List[str]
    summary_cards: List[SummaryCard]
    active_profile: ActiveProfile
    starter_plan: StarterPlan
    data_sources: List[DataSourceSummary]
    data_health: List[DataHealthCard]
    market_briefing: List[BriefingCard]
    compare_rows: List[CompareRow]
    sector_exposure: List[SectorExposureCard]
    risk_alerts: List[RiskAlertCard]
    recommendations: List[RecommendationCard]


def get_db() -> Generator[Session, None, None]:
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


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


def _portfolio_profile_note(risk_profile: RiskProfile) -> str:
    notes = {
        "steady": "This basket leaves a bit more cash on the side so your first month feels less rushed.",
        "balanced": "This basket mixes one core name with two supporting ideas so you can compare styles.",
        "ambitious": "This basket leans a little harder into the top idea while still keeping sector spread.",
    }
    return notes[risk_profile]


def _has_financial_table() -> bool:
    inspector = inspect(database.engine)
    return "financial_statements" in inspector.get_table_names()


def _get_financial_snapshot(db: Session, ticker_code: str) -> FinancialSnapshot:
    if not _has_financial_table():
        return FinancialSnapshot(summary="Financial statement pipeline is ready, but no imported statements are available yet.")

    statement = (
        db.query(models.FinancialStatement)
        .filter(models.FinancialStatement.ticker_code == ticker_code)
        .order_by(models.FinancialStatement.year.desc(), models.FinancialStatement.quarter.desc())
        .first()
    )

    if not statement:
        return FinancialSnapshot(summary="No saved financial statement yet for this stock, so the recommendation leans on market data first.")

    summary_parts = []
    if statement.revenue and statement.revenue > 0:
        summary_parts.append("Revenue data available")
    if statement.operating_income and statement.operating_income > 0:
        summary_parts.append("Operating profit is positive")
    if statement.net_income and statement.net_income > 0:
        summary_parts.append("Net income is positive")
    if getattr(statement, "is_demo", False):
        summary_parts.append("Using demo financial seed data for product walkthroughs")

    return FinancialSnapshot(
        revenue=statement.revenue,
        operating_income=statement.operating_income,
        net_income=statement.net_income,
        year=statement.year,
        quarter=statement.quarter,
        source=getattr(statement, "source", None),
        is_demo=bool(getattr(statement, "is_demo", False)),
        summary=", ".join(summary_parts) if summary_parts else "Financial statement exists, but the latest snapshot needs a closer manual read.",
    )


def _data_sources_summary(has_financial_data: bool) -> List[DataSourceSummary]:
    sources = [
        DataSourceSummary(
            name="Price trend",
            status="active",
            description="Uses recent 20-day direction and multi-session price range to judge readable momentum.",
        ),
        DataSourceSummary(
            name="Technical indicators",
            status="active",
            description="Reads RSI and MACD so beginners can see when momentum is hot, calm, or mixed.",
        ),
        DataSourceSummary(
            name="Volume attention",
            status="active",
            description="Checks whether recent trading volume is above normal to spot rising market attention.",
        ),
        DataSourceSummary(
            name="Sector context",
            status="active",
            description="Keeps the starter basket from overloading one sector and helps explain comparison-based picks.",
        ),
        DataSourceSummary(
            name="Financial statements",
            status="active" if has_financial_data else "pending",
            description="Uses imported revenue and profit data when available, and can fall back to labeled demo seed data for product walkthroughs.",
        ),
    ]
    return sources


def _build_market_briefing(recommendations: List[RecommendationCard]) -> List[BriefingCard]:
    if not recommendations:
        return []

    calmest = min(recommendations, key=lambda item: item.volatility)
    strongest_trend = max(recommendations, key=lambda item: item.price_change_20d)
    best_financial = max(
        recommendations,
        key=lambda item: (
            1 if item.financial_snapshot.operating_income and item.financial_snapshot.operating_income > 0 else 0,
            1 if item.financial_snapshot.net_income and item.financial_snapshot.net_income > 0 else 0,
            item.score,
        ),
    )

    return [
        BriefingCard(
            title="Calmest setup",
            label="Lower swing candidate",
            ticker_code=calmest.ticker_code,
            ticker_name=calmest.ticker_name,
            detail=f"Recent volatility is {calmest.volatility:.1f}%, which is the most beginner-friendly range in the shortlist.",
        ),
        BriefingCard(
            title="Strongest momentum",
            label="Trend leader",
            ticker_code=strongest_trend.ticker_code,
            ticker_name=strongest_trend.ticker_name,
            detail=f"The 20-day move is {strongest_trend.price_change_20d:.1f}%, so the recent direction is easiest to recognize here.",
        ),
        BriefingCard(
            title="Best fundamental support",
            label="Financial check",
            ticker_code=best_financial.ticker_code,
            ticker_name=best_financial.ticker_name,
            detail=best_financial.financial_snapshot.summary,
        ),
    ]


def _build_data_health(db: Session, as_of: date) -> List[DataHealthCard]:
    ticker_count = db.query(models.Ticker).count()
    price_rows = db.query(models.DailyPrice).count()

    financial_rows = 0
    demo_financial_rows = 0
    if _has_financial_table():
        financial_rows = db.query(models.FinancialStatement).count()
        demo_financial_rows = (
            db.query(models.FinancialStatement)
            .filter(getattr(models.FinancialStatement, "is_demo") == True)
            .count()
        )

    real_financial_rows = max(financial_rows - demo_financial_rows, 0)
    financial_tone = "warm" if real_financial_rows > 0 else "caution"

    return [
        DataHealthCard(
            label="Latest price date",
            value=str(as_of),
            tone="good",
            detail="The recommendation engine is currently reading price history through this saved market date.",
        ),
        DataHealthCard(
            label="Tracked stocks",
            value=str(ticker_count),
            tone="good",
            detail=f"The current shortlist is built from {ticker_count} tracked Korean stocks with saved daily price history.",
        ),
        DataHealthCard(
            label="Price observations",
            value=str(price_rows),
            tone="good",
            detail="More saved price rows generally means the technical indicators are less fragile.",
        ),
        DataHealthCard(
            label="Financial coverage",
            value=f"{financial_rows} rows",
            tone=financial_tone,
            detail=(
                f"{real_financial_rows} live-style rows and {demo_financial_rows} demo rows are currently available."
                if financial_rows
                else "No financial statement rows are currently saved."
            ),
        ),
    ]


def _build_compare_rows(recommendations: List[RecommendationCard], limit: int = 3) -> List[CompareRow]:
    rows: List[CompareRow] = []
    for item in recommendations[:limit]:
        if item.financial_snapshot.year and item.financial_snapshot.operating_income and item.financial_snapshot.operating_income > 0:
            financial_label = "Profit data ready"
        elif item.financial_snapshot.year:
            financial_label = "Statement saved"
        else:
            financial_label = "No statement yet"

        rows.append(
            CompareRow(
                ticker_code=item.ticker_code,
                ticker_name=item.ticker_name,
                sector=item.sector,
                score=item.score,
                risk_level=item.risk_level,
                price_change_20d=item.price_change_20d,
                volatility=item.volatility,
                financial_label=financial_label,
            )
        )
    return rows


def _build_sector_exposure(
    recommendations: List[RecommendationCard],
    starter_plan: StarterPlan,
    limit: int = 4,
) -> List[SectorExposureCard]:
    shortlist_counts: dict[str, int] = {}
    starter_weights: dict[str, float] = {}

    for item in recommendations:
        sector = item.sector or "Unknown"
        shortlist_counts[sector] = shortlist_counts.get(sector, 0) + 1

    for allocation in starter_plan.allocations:
        sector = allocation.sector or "Unknown"
        starter_weights[sector] = starter_weights.get(sector, 0.0) + allocation.weight

    ordered_sectors = sorted(
        shortlist_counts.keys(),
        key=lambda sector: (starter_weights.get(sector, 0.0), shortlist_counts.get(sector, 0)),
        reverse=True,
    )

    cards: List[SectorExposureCard] = []
    for sector in ordered_sectors[:limit]:
        shortlist_count = shortlist_counts.get(sector, 0)
        starter_weight = round(starter_weights.get(sector, 0.0), 1)
        if starter_weight >= 45:
            note = "Starter basket weight is concentrated here, so keep an eye on sector-specific news."
        elif shortlist_count >= 3:
            note = "This sector appears often in the shortlist, so compare names carefully instead of buying all of them."
        elif starter_weight == 0:
            note = "This sector appears in the shortlist but is not heavily used in the starter basket."
        else:
            note = "Exposure looks balanced enough for a beginner to study without overloading one theme."

        cards.append(
            SectorExposureCard(
                sector=sector,
                shortlist_count=shortlist_count,
                starter_weight=starter_weight,
                note=note,
            )
        )

    return cards


def _build_risk_alerts(recommendations: List[RecommendationCard]) -> List[RiskAlertCard]:
    alerts: List[RiskAlertCard] = []

    hottest = max(recommendations, key=lambda item: item.price_change_20d, default=None)
    if hottest and hottest.price_change_20d >= 12:
        alerts.append(
            RiskAlertCard(
                title="Momentum is strong, but chasing can hurt",
                severity="medium",
                ticker_code=hottest.ticker_code,
                ticker_name=hottest.ticker_name,
                detail=f"{hottest.ticker_name} has the sharpest recent move at {hottest.price_change_20d:.1f}% over 20 sessions. Beginners may want staggered entries instead of rushing in.",
            )
        )

    highest_vol = max(recommendations, key=lambda item: item.volatility, default=None)
    if highest_vol and highest_vol.volatility >= 6:
        alerts.append(
            RiskAlertCard(
                title="One candidate is moving much faster than the rest",
                severity="high",
                ticker_code=highest_vol.ticker_code,
                ticker_name=highest_vol.ticker_name,
                detail=f"{highest_vol.ticker_name} is showing {highest_vol.volatility:.1f}% recent volatility. Keep position sizes smaller if you use it for learning.",
            )
        )

    weak_financial = [item for item in recommendations[:3] if item.financial_snapshot.is_demo]
    if weak_financial:
        alerts.append(
            RiskAlertCard(
                title="Financial support is still partly demo-based",
                severity="medium",
                detail="Some top candidates still rely on labeled demo financial data. Treat the profitability section as a product walkthrough until live statement ingestion is connected.",
            )
        )

    cooling = [item for item in recommendations if item.risk_level == "High"]
    if cooling:
        alerts.append(
            RiskAlertCard(
                title="At least one shortlist name is already in a higher-risk zone",
                severity="medium",
                ticker_code=cooling[0].ticker_code,
                ticker_name=cooling[0].ticker_name,
                detail=f"{cooling[0].ticker_name} is tagged as {cooling[0].risk_level} risk in the current shortlist. Compare it against calmer names before choosing a first buy.",
            )
        )

    return alerts[:4]


def _financial_bonus(financial_snapshot: FinancialSnapshot) -> tuple[float, List[str]]:
    bonus = 0.0
    reasons: List[str] = []

    if financial_snapshot.operating_income and financial_snapshot.operating_income > 0:
        bonus += 5.0
        reasons.append("Operating profit is positive, which helps beginners avoid purely speculative names.")
    if financial_snapshot.net_income and financial_snapshot.net_income > 0:
        bonus += 4.0
        reasons.append("Net income is positive, adding a basic profitability check to the idea.")
    if financial_snapshot.revenue and financial_snapshot.revenue > 0:
        bonus += 3.0
        reasons.append("Revenue data is available, so this pick is not relying on price action alone.")

    return bonus, reasons


def _allocation_weights(risk_profile: RiskProfile) -> List[float]:
    weights = {
        "steady": [0.38, 0.34, 0.18],
        "balanced": [0.42, 0.30, 0.20],
        "ambitious": [0.50, 0.27, 0.15],
    }
    return weights[risk_profile]


def _starter_role(index: int, risk_profile: RiskProfile) -> str:
    if index == 0:
        return "Core anchor"
    if index == 1:
        return "Second learning slot"
    if risk_profile == "steady":
        return "Small observation slot"
    return "Higher-variance learning slot"


def build_starter_plan(
    recommendations: List[RecommendationCard],
    monthly_budget: int,
    risk_profile: RiskProfile,
) -> StarterPlan:
    unique_sector_picks: List[RecommendationCard] = []
    seen_sectors: set[str] = set()

    for recommendation in recommendations:
        sector_key = recommendation.sector or recommendation.ticker_code
        if sector_key in seen_sectors:
            continue
        seen_sectors.add(sector_key)
        unique_sector_picks.append(recommendation)
        if len(unique_sector_picks) == 3:
            break

    if len(unique_sector_picks) < 3:
        for recommendation in recommendations:
            if recommendation.ticker_code in [pick.ticker_code for pick in unique_sector_picks]:
                continue
            unique_sector_picks.append(recommendation)
            if len(unique_sector_picks) == 3:
                break

    weights = _allocation_weights(risk_profile)[: len(unique_sector_picks)]
    weight_total = sum(weights) or 1.0
    normalized_weights = [weight / weight_total for weight in weights]

    allocations: List[StarterAllocation] = []
    invested_total = 0

    for index, (recommendation, weight) in enumerate(zip(unique_sector_picks, normalized_weights)):
        target_amount = int(monthly_budget * weight)
        estimated_shares = max(int(target_amount // recommendation.current_price), 0)
        invested_amount = int(estimated_shares * recommendation.current_price)
        invested_total += invested_amount

        allocations.append(
            StarterAllocation(
                ticker_code=recommendation.ticker_code,
                ticker_name=recommendation.ticker_name,
                sector=recommendation.sector,
                weight=round(weight * 100, 1),
                target_amount=target_amount,
                estimated_shares=estimated_shares,
                invested_amount=invested_amount,
                current_price=recommendation.current_price,
                role=_starter_role(index, risk_profile),
                note=recommendation.profile_match,
            )
        )

    cash_buffer = max(monthly_budget - invested_total, 0)
    tips = [
        "A small cash buffer is healthy for beginners because it lowers the pressure to go all-in at once.",
        "If one stock feels hard to understand, start by buying only the core anchor and keep the rest as cash.",
        "Try reviewing this basket once a week instead of reacting to every daily move.",
    ]

    return StarterPlan(
        monthly_budget=monthly_budget,
        estimated_investment=invested_total,
        cash_buffer=cash_buffer,
        profile_note=_portfolio_profile_note(risk_profile),
        allocations=allocations,
        tips=tips,
    )


def build_recommendation(
    ticker: models.Ticker,
    prices: List[models.DailyPrice],
    risk_profile: RiskProfile,
    learning_focus: LearningFocus,
    financial_snapshot: FinancialSnapshot,
) -> RecommendationCard:
    latest = prices[0]
    oldest = prices[-1]
    closes = [price.close for price in prices]
    avg_volume = recommendation_engine.average_recent_volume(prices)
    volatility = recommendation_engine.calculate_volatility(closes, latest.close)
    change_20d = recommendation_engine.pct_change(latest.close, oldest.close)

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
    financial_delta, financial_reasons = _financial_bonus(financial_snapshot)
    score += risk_delta + focus_delta + financial_delta
    reasons.extend(financial_reasons)

    score = round(min(max(score, 0.0), 99.0), 1)
    risk_level = recommendation_engine.risk_level(volatility, latest.rsi)

    return RecommendationCard(
        ticker_code=ticker.code,
        ticker_name=ticker.name,
        market=ticker.market,
        sector=ticker.sector,
        score=score,
        badge=recommendation_engine.badge(score),
        fit_for=recommendation_engine.fit_for(score, volatility),
        risk_level=risk_level,
        current_price=latest.close,
        price_change_20d=change_20d,
        volatility=volatility,
        reasons=reasons[:4],
        beginner_note=recommendation_engine.beginner_note(latest.rsi, latest.macd),
        action_guide=recommendation_engine.action_guide(score, volatility),
        profile_match=f"{risk_match} {focus_match}",
        financial_snapshot=financial_snapshot,
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
        if not recommendation_engine.history_is_usable(prices):
            continue
        financial_snapshot = _get_financial_snapshot(db, ticker.code)
        recommendations.append(
            build_recommendation(
                ticker=ticker,
                prices=prices,
                risk_profile=risk_profile,
                learning_focus=learning_focus,
                financial_snapshot=financial_snapshot,
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


@app.get("/tickers", response_model=List[TickerSummary])
def read_tickers(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> List[models.Ticker]:
    return db.query(models.Ticker).order_by(models.Ticker.market, models.Ticker.code).offset(skip).limit(limit).all()


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
    monthly_budget: int = Query(default=300000, ge=100000, le=5000000),
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
    starter_plan = build_starter_plan(
        recommendations=recommendations,
        monthly_budget=monthly_budget,
        risk_profile=risk_profile,
    )
    has_financial_data = any(
        item.financial_snapshot.revenue is not None
        or item.financial_snapshot.operating_income is not None
        or item.financial_snapshot.net_income is not None
        for item in recommendations
    )

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
        starter_plan=starter_plan,
        data_sources=_data_sources_summary(has_financial_data),
        data_health=_build_data_health(db, as_of),
        market_briefing=_build_market_briefing(recommendations),
        compare_rows=_build_compare_rows(recommendations),
        sector_exposure=_build_sector_exposure(recommendations, starter_plan),
        risk_alerts=_build_risk_alerts(recommendations),
        recommendations=recommendations,
    )
