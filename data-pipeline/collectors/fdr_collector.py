import FinanceDataReader as fdr
import pandas as pd
from datetime import datetime, timedelta

def fetch_fdr_data(symbol, start_date, end_date):
    """
    Fetches data using FinanceDataReader.
    Effective for Indices and Foreign Stocks.
    """
    try:
        df = fdr.DataReader(symbol, start_date, end_date)
        return df
    except Exception as e:
        print(f"Error fetching data for {symbol}: {e}")
        return pd.DataFrame()

if __name__ == "__main__":
    # Example: Fetch KOSPI Index
    print("Fetching KOSPI Index...")
    df_kospi = fetch_fdr_data("KS11", "2024-01-01", "2024-01-10")
    print(df_kospi.head())

    # Example: Fetch USD/KRW Exchange Rate
    print("Fetching USD/KRW...")
    df_usd = fetch_fdr_data("USD/KRW", "2024-01-01", "2024-01-10")
    print(df_usd.head())
