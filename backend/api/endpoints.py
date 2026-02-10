from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import database, models, schemas

router = APIRouter()

@router.get("/tickers", response_model=List[schemas.Ticker])
def read_tickers(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    tickers = db.query(models.Ticker).offset(skip).limit(limit).all()
    return tickers

@router.get("/prices/{ticker_code}", response_model=List[schemas.DailyPrice])
def read_prices(ticker_code: str, limit: int = 100, db: Session = Depends(database.get_db)):
    prices = db.query(models.DailyPrice).filter(models.DailyPrice.ticker_code == ticker_code).order_by(models.DailyPrice.date.desc()).limit(limit).all()
    if not prices:
        raise HTTPException(status_code=404, detail="Prices not found")
    return prices
