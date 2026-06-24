from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend import database, main, models

router = APIRouter()


@router.get("/tickers", response_model=list[main.TickerSummary])
def read_tickers(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(database.get_db),
) -> list[models.Ticker]:
    return db.query(models.Ticker).order_by(models.Ticker.market, models.Ticker.code).offset(skip).limit(limit).all()
