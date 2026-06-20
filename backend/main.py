from __future__ import annotations

from datetime import date
from statistics import mean
from typing import Generator, List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend import database, models


app = FastAPI(
    title="Stock Starter API",
    description="초보 투자자를 위한 한국 주식 추천 API",
    version="1.0.0",
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


class SummaryCard(BaseModel):
    label: str
    value: str
    tone: str
    description: str


class DashboardResponse(BaseModel):
    as_of: date
    headline: str
    subheadline: str
    starter_steps: List[str]
    summary_cards: List[SummaryCard]
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
        return "높음"
    if volatility >= 2.5 or (rsi is not None and rsi <= 35):
        return "보통"
    return "낮음"


def _fit_for(score: float, volatility: float) -> str:
    if score >= 78 and volatility < 3:
        return "천천히 배우며 시작하는 초보자"
    if score >= 68:
        return "분산 투자에 익숙해지는 입문자"
    return "관심 종목으로 관찰해볼 초보자"


def _badge(score: float) -> str:
    if score >= 80:
        return "지금 보기 좋은 후보"
    if score >= 70:
        return "차분히 살펴볼 후보"
    return "관찰 리스트 추천"


def _action_guide(score: float, volatility: float) -> str:
    if score >= 80 and volatility < 3.5:
        return "한 번에 많이 사기보다 2~3번으로 나눠 진입해 보세요."
    if volatility >= 4:
        return "변동이 큰 편이라 소액으로 먼저 지켜보는 편이 안전합니다."
    return "바로 매수 판단보다 실적 일정과 최근 뉴스 확인을 먼저 권장합니다."


def _beginner_note(rsi: Optional[float], macd: Optional[float]) -> str:
    if rsi is not None and rsi < 35:
        return "최근 눌림이 있었던 종목이라 초보자도 가격 부담을 덜 느낄 수 있습니다."
    if macd is not None and macd > 0:
        return "추세가 완전히 꺾이지 않은 편이라 초보자가 흐름 공부용으로 보기 좋습니다."
    return "지금 당장 매수 신호라기보다, 왜 점수가 나왔는지 익히기 좋은 예시입니다."


def build_recommendation(ticker: models.Ticker, prices: List[models.DailyPrice]) -> RecommendationCard:
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
            reasons.append("RSI가 낮아 최근 과열보다 눌림 구간에 가깝습니다.")
        elif latest.rsi <= 60:
            score += 10
            reasons.append("RSI가 과열 구간이 아니어서 추격 매수 부담이 덜합니다.")
        else:
            score += 4
            reasons.append("상승 흐름은 있지만 단기 과열 여부를 함께 봐야 합니다.")

    if latest.macd is not None:
        if latest.macd > 0:
            score += 12
            reasons.append("MACD가 플러스라 단기 추세가 완전히 꺾이지 않았습니다.")
        else:
            reasons.append("MACD는 아직 약해 추가 확인이 필요합니다.")

    if latest.volume > avg_volume * 1.2:
        score += 10
        reasons.append("최근 거래량이 평균보다 늘어 관심이 붙고 있습니다.")

    if change_20d > 8:
        score += 10
        reasons.append("최근 한 달 흐름이 우상향이라 초보자도 방향을 읽기 쉽습니다.")
    elif change_20d > 0:
        score += 6
        reasons.append("최근 흐름이 크게 무너지지 않았습니다.")
    else:
        score += 2
        reasons.append("가격은 쉬어가는 구간이라 분할 접근 관점이 필요합니다.")

    if volatility < 3:
        score += 10
        reasons.append("변동성이 과하지 않아 초보자에게 상대적으로 편안합니다.")
    elif volatility < 6:
        score += 5
    else:
        reasons.append("가격 움직임이 큰 편이라 비중 조절이 중요합니다.")

    score = round(min(score, 95.0), 1)
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
    )


def get_ranked_recommendations(db: Session, limit: int = 10) -> List[RecommendationCard]:
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
        recommendations.append(build_recommendation(ticker, prices))

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
def read_recommendations(limit: int = 10, db: Session = Depends(get_db)) -> List[RecommendationCard]:
    return get_ranked_recommendations(db, limit=limit)


@app.get("/dashboard", response_model=DashboardResponse)
def read_dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    recommendations = get_ranked_recommendations(db, limit=10)
    if not recommendations:
        raise HTTPException(status_code=404, detail="No recommendation data available")

    latest_date = (
        db.query(models.DailyPrice.date)
        .order_by(models.DailyPrice.date.desc())
        .first()
    )
    as_of = latest_date[0] if latest_date else date.today()
    average_score = round(mean(item.score for item in recommendations), 1)
    low_risk_count = len([item for item in recommendations if item.risk_level == "낮음"])
    positive_trend_count = len([item for item in recommendations if item.price_change_20d > 0])

    return DashboardResponse(
        as_of=as_of,
        headline="처음 투자하는 사람도 이해할 수 있게, 이유까지 설명하는 주식 추천",
        subheadline="점수만 보여주지 않고 변동성, 최근 흐름, 초보자 메모까지 함께 제공해 첫 종목 탐색 부담을 줄였습니다.",
        starter_steps=[
            "먼저 추천 점수보다 리스크 레벨과 초보자 메모를 읽어보세요.",
            "한 종목에 몰지 말고 2~3개 관심 종목을 비교하며 보는 습관을 만드세요.",
            "매수 전에는 최근 실적 발표일과 뉴스 이벤트를 꼭 한 번 더 확인하세요.",
        ],
        summary_cards=[
            SummaryCard(
                label="분석 종목",
                value=f"{len(recommendations)}개",
                tone="neutral",
                description="최근 가격 데이터가 충분한 종목만 추려 추천에 사용했습니다.",
            ),
            SummaryCard(
                label="평균 추천 점수",
                value=f"{average_score}점",
                tone="positive",
                description="기술적 흐름과 변동성을 함께 반영한 입문자 관점 점수입니다.",
            ),
            SummaryCard(
                label="저변동 후보",
                value=f"{low_risk_count}개",
                tone="calm",
                description="가격 출렁임이 상대적으로 적어 초보자에게 덜 부담스러운 종목입니다.",
            ),
            SummaryCard(
                label="상승 흐름 유지",
                value=f"{positive_trend_count}개",
                tone="warm",
                description="최근 20거래일 기준 흐름이 플러스인 종목 수입니다.",
            ),
        ],
        recommendations=recommendations,
    )
