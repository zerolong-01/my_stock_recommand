import FinanceDataReader as fdr
import pandas as pd
from datetime import datetime
import time
import sys
import os

# Adjust path if we were to save to DB
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
# from backend import models, database

def fetch_realtime_price(ticker):
    """
    Fetches the latest price snapshot (near real-time).
    FinanceDataReader fetches from Naver Finance which is near real-time.
    """
    try:
        # Fetching data for today only
        now = datetime.now()
        start_date = now.strftime("%Y-%m-%d")
        
        df = fdr.DataReader(ticker, start_date)
        if df.empty:
            return None
        
        # Get the last row (latest data)
        latest = df.iloc[-1]
        return {
            "ticker": ticker,
            "price": float(latest['Close']),
            "volume": float(latest['Volume']),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        print(f"Error fetching real-time price for {ticker}: {e}")
        return None

def start_realtime_monitoring(tickers, interval=60):
    """
    Simulates a real-time monitoring loop.
    """
    print(f"Starting real-time monitoring for {tickers} every {interval} seconds...")
    try:
        while True:
            for ticker in tickers:
                data = fetch_realtime_price(ticker)
                if data:
                    print(f"[{data['timestamp']}] {data['ticker']}: {data['price']} KRW (Vol: {data['volume']})")
                    # Here you would typically publish to Redis or save to InfluxDB
                else:
                    print(f"Failed to fetch {ticker}")
            
            time.sleep(interval)
    except KeyboardInterrupt:
        print("Monitoring stopped.")

if __name__ == "__main__":
    # Example: Monitor Samsung Elec and SK Hynix
    target_tickers = ["005930", "000660"]
    start_realtime_monitoring(target_tickers, interval=5)
