from sqlalchemy import Boolean, Column, Integer, String, Float, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

if __package__ == "backend":
    from backend import database
else:
    import database


class Ticker(database.Base):
    __tablename__ = "tickers"

    code = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    market = Column(String) # KOSPI, KOSDAQ
    sector = Column(String)

    prices = relationship("DailyPrice", back_populates="ticker")
    financials = relationship("FinancialStatement", back_populates="ticker")


class DailyPrice(database.Base):
    __tablename__ = "daily_prices"

    id = Column(Integer, primary_key=True, index=True)
    ticker_code = Column(String, ForeignKey("tickers.code"), index=True)
    date = Column(Date, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    
    # Technical Indicators (Calculated)
    rsi = Column(Float, nullable=True)
    macd = Column(Float, nullable=True)
    
    ticker = relationship("Ticker", back_populates="prices")

    __table_args__ = (
        UniqueConstraint('ticker_code', 'date', name='uix_ticker_date'),
    )


class FinancialStatement(database.Base):
    __tablename__ = "financial_statements"

    id = Column(Integer, primary_key=True, index=True)
    ticker_code = Column(String, ForeignKey("tickers.code"))
    year = Column(Integer)
    quarter = Column(Integer) # 1, 2, 3, 4
    revenue = Column(Float)
    operating_income = Column(Float)
    net_income = Column(Float)
    source = Column(String, nullable=True)
    is_demo = Column(Boolean, default=False)

    ticker = relationship("Ticker", back_populates="financials")
