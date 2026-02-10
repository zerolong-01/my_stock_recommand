from pydantic import BaseModel
from typing import Optional, List
from datetime import date

class DailyPriceBase(BaseModel):
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float
    rsi: Optional[float] = None
    macd: Optional[float] = None

class DailyPrice(DailyPriceBase):
    id: int
    ticker_code: str

    class Config:
        orm_mode = True

class TickerBase(BaseModel):
    code: str
    name: str
    market: str
    sector: Optional[str] = None

class Ticker(TickerBase):
    prices: List[DailyPrice] = []

    class Config:
        orm_mode = True
