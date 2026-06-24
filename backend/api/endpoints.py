from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

if __package__ == "backend.api":
    from backend import database, main, models
else:
    import database
    import main
    import models

router = APIRouter()


@router.get("/tickers", response_model=list[main.TickerSummary])
def read_tickers(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    query: str | None = Query(default=None, min_length=1, max_length=50),
    db: Session = Depends(database.get_db),
) -> list[models.Ticker]:
    return main.read_tickers(skip=skip, limit=limit, query=query, db=db)


@router.get("/prices/{ticker_code}", response_model=list[main.PricePoint])
def read_prices(
    ticker_code: str,
    limit: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(database.get_db),
) -> list[models.DailyPrice]:
    return main.read_prices(ticker_code=ticker_code, limit=limit, db=db)


@router.get("/recommendations", response_model=list[main.RecommendationCard])
def read_recommendations(
    limit: int = Query(default=10, ge=1, le=50),
    risk_profile: main.RiskProfile = Query(default="balanced"),
    learning_focus: main.LearningFocus = Query(default="trend"),
    db: Session = Depends(database.get_db),
) -> list[main.RecommendationCard]:
    return main.get_ranked_recommendations(
        db=db,
        limit=limit,
        risk_profile=risk_profile,
        learning_focus=learning_focus,
    )


@router.get("/recommendations/{ticker_code}", response_model=main.RecommendationCard)
def read_recommendation(
    ticker_code: str,
    risk_profile: main.RiskProfile = Query(default="balanced"),
    learning_focus: main.LearningFocus = Query(default="trend"),
    db: Session = Depends(database.get_db),
) -> main.RecommendationCard:
    return main.read_recommendation(
        ticker_code=ticker_code,
        risk_profile=risk_profile,
        learning_focus=learning_focus,
        db=db,
    )


@router.get("/compare", response_model=main.CompareResponse)
def read_compare(
    ticker_codes: list[str] = Query(...),
    risk_profile: main.RiskProfile = Query(default="balanced"),
    learning_focus: main.LearningFocus = Query(default="trend"),
    db: Session = Depends(database.get_db),
) -> main.CompareResponse:
    return main.read_compare(
        ticker_codes=ticker_codes,
        risk_profile=risk_profile,
        learning_focus=learning_focus,
        db=db,
    )


@router.get("/alternatives/{ticker_code}", response_model=main.AlternativeResponse)
def read_alternatives(
    ticker_code: str,
    limit: int = Query(default=3, ge=1, le=6),
    risk_profile: main.RiskProfile = Query(default="balanced"),
    learning_focus: main.LearningFocus = Query(default="trend"),
    db: Session = Depends(database.get_db),
) -> main.AlternativeResponse:
    return main.read_alternatives(
        ticker_code=ticker_code,
        limit=limit,
        risk_profile=risk_profile,
        learning_focus=learning_focus,
        db=db,
    )
