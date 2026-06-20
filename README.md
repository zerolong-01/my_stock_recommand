# Stock Starter

초보 투자자를 위해 여러 데이터 축을 함께 보여주는 주식 추천 웹서비스입니다.

현재 앱은 아래 데이터를 조합합니다.

- 최근 주가 흐름과 20일 추세
- RSI, MACD 같은 기술 지표
- 최근 거래량 변화
- 섹터 분산과 초보자용 포트폴리오 구성
- 재무 데이터
  지금 저장소에는 데모 실행용 시드 데이터가 포함되어 있습니다.

## What It Does

- 투자 성향별 추천
  `steady`, `balanced`, `ambitious`
- 학습 목적별 추천
  `dividend`, `trend`, `value`
- 월 예산 기반 스타터 포트폴리오 제안
- 추천 근거 설명
- 데이터 소스 투명성 표시
- 초보자용 마켓 브리핑 카드

## Project Structure

- `backend/`
  FastAPI API, 추천 로직, SQLite DB
- `frontend/`
  Next.js 대시보드
- `data-pipeline/`
  가격/공시 수집 파이프라인 초안
- `database/sample_financial_statements.json`
  데모 재무 데이터 시드
- `seed_demo_financials.py`
  로컬 SQLite에 데모 재무 데이터 적재

## Local Run

### 1. Backend dependencies

백엔드 패키지를 먼저 설치합니다.

```powershell
cd backend
py -m pip install -r requirements.txt
```

### 2. Frontend dependencies

```powershell
cd frontend
npm install
```

### 3. Seed demo financial data

재무 추천 근거를 바로 확인하려면 데모 재무 데이터를 넣습니다.

```powershell
cd ..
py seed_demo_financials.py
```

실행 후 `financial_statements` 테이블에 10개 종목의 데모 데이터가 들어갑니다.

### 4. Start backend

```powershell
cd backend
py -m uvicorn main:app --reload --port 8000
```

### 5. Start frontend

새 터미널에서:

```powershell
cd frontend
npm run dev
```

열기:

- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`

## One-Click Scripts

- `run_system.bat`
  전체 실행 시도
- `collect_data.bat`
  가격 데이터 수집
- `update_data.bat`
  루트 수집 스크립트 실행

주의:

- `run_system.bat`는 Docker와 로컬 환경 상태에 따라 일부 단계가 실패할 수 있습니다.
- 현재 가장 안정적인 실행 방식은 위의 수동 실행 순서입니다.

## Demo Data Notes

- 재무 데이터가 `demo_seed`로 표시되면 실공시 수집값이 아니라 데모용 시드입니다.
- UI에서 `demo financial seed` 배지가 보이면 데모 재무값을 사용하는 상태입니다.
- 실데이터 연결 전에도 추천 흐름과 설명 UX를 확인할 수 있도록 넣어둔 값입니다.

## Useful Commands

백엔드 문법 확인:

```powershell
@'
import py_compile
for path in [r'backend/database.py', r'backend/main.py', r'backend/models.py', r'seed_demo_financials.py']:
    py_compile.compile(path, doraise=True)
    print('ok', path)
'@ | python -
```

프런트 빌드:

```powershell
cd frontend
npm.cmd run build
```

프런트 타입 체크:

```powershell
cd frontend
npx.cmd tsc --noEmit
```

## Current Limitations

- 외부 GitHub 원격으로의 자동 `push`는 현재 실행 정책상 차단됩니다.
- DART 실공시 수집은 파이프라인 코드가 있지만 로컬 API 키/네트워크/정제 로직 보강이 더 필요합니다.
- 뉴스 이벤트 데이터는 아직 본 서비스 추천 로직에 연결되지 않았습니다.

## Next Good Steps

- DART 실공시 적재 자동화
- 뉴스/공시 이벤트 카드 추가
- 배포 환경 구성
- 추천 결과 저장과 히스토리 비교 기능 추가
