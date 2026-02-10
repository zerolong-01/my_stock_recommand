from pykrx import stock
import pandas as pd
from datetime import datetime, timedelta
import time

def fetch_daily_ohlcv(ticker, start_date, end_date):
    """
    Fetches daily OHLCV execution from Pykrx.
    """
    try:
        df = stock.get_market_ohlcv(start_date, end_date, ticker)
        return df
    except Exception as e:
        print(f"Error fetching data for {ticker}: {e}")
        return pd.DataFrame()

def get_all_tickers(market="KOSPI"):
    """
    Get all ticker codes for a specific market.
    """
    tickers = stock.get_market_ticker_list(market=market)
    return tickers

if __name__ == "__main__":
    # Example usage
    today = datetime.now().strftime("%Y%m%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y%m%d")
    
    # Fetch Samsung Electronics (005930)
    print("Fetching Samsung Electronics data...")
    df = fetch_daily_ohlcv("005930", yesterday, today)
    print(df.head())
