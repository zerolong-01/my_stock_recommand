import OpenDartReader
import os
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
import sys

# Adjust path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from backend import models, database

# Load API KEY
load_dotenv()
DART_API_KEY = os.getenv("DART_API_KEY")

class DartCollector:
    def __init__(self):
        if not DART_API_KEY:
            raise ValueError("DART_API_KEY is missing in .env")
        self.dart = OpenDartReader(DART_API_KEY)
        self.db = database.SessionLocal()

    def get_corp_code(self, ticker):
        """
        Find DART corp_code by stock ticker.
        """
        try:
            # dart.find_corp_code returns None if not found, or the code string
            return self.dart.find_corp_code(ticker)
        except Exception as e:
            print(f"Error finding corp_code for {ticker}: {e}")
            return None

    def collect_financials(self, ticker, year, quarter=1):
        """
        Collects financial data and saves to DB. # 11013=1Q, 11012=Half, 11014=3Q, 11011=Year
        Using 11011 (Annual Business Report) for simplicity in this example or mapping quarters.
        """
        corp_code = self.get_corp_code(ticker)
        if not corp_code:
            print(f"Corp code not found for {ticker}")
            return

        # Map quarter to report code
        reprt_code = "11011" # Default Annual
        if quarter == 1: reprt_code = "11013"
        elif quarter == 2: reprt_code = "11012"
        elif quarter == 3: reprt_code = "11014"
        elif quarter == 4: reprt_code = "11011" # Often 4Q is derived from Annual - 3Q, just using Annual here

        try:
            print(f"Fetching {ticker} ({corp_code}) {year} Q{quarter}...")
            fs = self.dart.finstate(corp_code, year, reprt_code=reprt_code)
            if fs is None or fs.empty:
                print("No data returned.")
                return

            # fs columns: report_nm, rcept_no, fs_div, fs_nm, account_nm, thstrm_amount, ...
            # Filter for Consolidated Financial Statement (CFS) if available, else Separate
            # Usually 'CFS' is '연결재무제표', 'OFS' is '재무제표'
            
            # Simple extraction logic: Look for key accounts
            # 매출액, 영업이익, 당기순이익
            revenue = self._extract_amount(fs, "매출액")
            op_income = self._extract_amount(fs, "영업이익")
            net_income = self._extract_amount(fs, "당기순이익")

            # Save to DB
            stmt = models.FinancialStatement(
                ticker_code=ticker,
                year=year,
                quarter=quarter,
                revenue=revenue,
                operating_income=op_income,
                net_income=net_income
            )
            self.db.add(stmt)
            self.db.commit()
            print(f"Saved financials for {ticker} {year} Q{quarter}")

        except Exception as e:
            print(f"Error processing {ticker}: {e}")
            self.db.rollback()

    def _extract_amount(self, df, account_name):
        """
        Extracts amount for a given account name.
        """
        try:
            # Filter by account_nm containing the name
            row = df[df['account_nm'].str.contains(account_name, na=False)]
            if row.empty:
                return 0.0
            
            # Priority: Consolidated (CFS) > Separate (OFS)
            # This logic can be improved.
            # 'thstrm_amount' is 'This Term Amount'
            amount_str = row.iloc[0]['thstrm_amount']
            return float(amount_str.replace(',', '')) if amount_str else 0.0
        except Exception:
            return 0.0

    def close(self):
        self.db.close()

if __name__ == "__main__":
    collector = DartCollector()
    # Example: Samsung Electronics (005930) 2023 Annual
    collector.collect_financials("005930", 2023, 4)
    collector.close()
