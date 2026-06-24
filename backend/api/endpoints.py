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
    db: Session = Depends(database.get_db),
) -> list[models.Ticker]:
    return db.query(models.Ticker).order_by(models.Ticker.market, models.Ticker.code).offset(skip).limit(limit).all()


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
