import talib
import pandas as pd
import numpy as np

def calculate_indicators(df):
    """
    Expects a DataFrame with columns: ['Open', 'High', 'Low', 'Close', 'Volume']
    Returns DataFrame with added technical indicators.
    """
    if df.empty:
        return df
    
    # Ensure columns are float
    close = df['Close'].astype(float).values
    high = df['High'].astype(float).values
    low = df['Low'].astype(float).values
    
    # RSI (14)
    df['RSI'] = talib.RSI(close, timeperiod=14)
    
    # MACD (12, 26, 9)
    macd, macdsignal, macdhist = talib.MACD(close, fastperiod=12, slowperiod=26, signalperiod=9)
    df['MACD'] = macd
    df['MACD_Signal'] = macdsignal
    df['MACD_Hist'] = macdhist
    
    # Bollinger Bands (20, 2)
    upper, middle, lower = talib.BBANDS(close, timeperiod=20, nbdevup=2, nbdevdn=2, matype=0)
    df['BB_Upper'] = upper
    df['BB_Middle'] = middle
    df['BB_Lower'] = lower
    
    # Moving Averages
    df['SMA_20'] = talib.SMA(close, timeperiod=20)
    df['SMA_60'] = talib.SMA(close, timeperiod=60)
    
    return df

if __name__ == "__main__":
    # Dummy data test
    data = {
        'Close': np.random.normal(100, 10, 100),
        'High': np.random.normal(105, 10, 100),
        'Low': np.random.normal(95, 10, 100),
        'Open': np.random.normal(100, 10, 100),
        'Volume': np.random.randint(1000, 10000, 100)
    }
    df = pd.DataFrame(data)
    print("Calculating indicators for dummy data...")
    df_processed = calculate_indicators(df)
    print(df_processed[['Close', 'RSI', 'MACD', 'BB_Upper']].tail())
