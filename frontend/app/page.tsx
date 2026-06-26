'use client';

import { useEffect, useMemo, useState } from 'react';

import { StockChart } from '../components/StockChart';

interface Recommendation {
    ticker_code: string;
    ticker_name: string;
    market: string;
    sector: string | null;
    score: number;
    badge: string;
    fit_for: string;
    risk_level: string;
    current_price: number;
    price_change_20d: number;
    volatility: number;
    reasons: string[];
    beginner_note: string;
    action_guide: string;
    profile_match: string;
    financial_snapshot: FinancialSnapshot;
}

interface SummaryCard {
    label: string;
    value: string;
    tone: string;
    description: string;
}

interface ActiveProfile {
    label: string;
    description: string;
}

interface StarterAllocation {
    ticker_code: string;
    ticker_name: string;
    weight: number;
    target_amount: number;
    note: string;
}

interface StarterPlan {
    monthly_budget: number;
    estimated_investment: number;
    cash_buffer: number;
    profile_note: string;
    allocations: StarterAllocation[];
    tips: string[];
}

interface FinancialSnapshot {
    revenue: number | null;
    operating_income: number | null;
    net_income: number | null;
    year: number | null;
    quarter: number | null;
    source: string | null;
    is_demo: boolean;
    summary: string;
}

interface DashboardResponse {
    as_of: string;
    headline: string;
    subheadline: string;
    starter_steps: string[];
    summary_cards: SummaryCard[];
    active_profile: ActiveProfile;
    starter_plan: StarterPlan;
    recommendations: Recommendation[];
}

interface ChartData {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
}

type RiskProfile = 'steady' | 'balanced' | 'ambitious';
type LearningFocus = 'dividend' | 'trend' | 'value';

const API_BASE = 'http://localhost:8000';
const WATCHLIST_KEY = 'stock-starter-watchlist';

const riskOptions: Array<{ value: RiskProfile; label: string; description: string }> = [
    { value: 'steady', label: '안정형', description: '변동성이 낮은 후보를 우선으로 봅니다.' },
    { value: 'balanced', label: '균형형', description: '안정감과 성장성을 함께 고려합니다.' },
    { value: 'ambitious', label: '도전형', description: '움직임이 큰 종목도 학습 대상으로 봅니다.' },
];

const focusOptions: Array<{ value: LearningFocus; label: string; description: string }> = [
    { value: 'dividend', label: '안정성', description: '처음 투자할 때 부담이 적은 흐름을 봅니다.' },
    { value: 'trend', label: '추세', description: '최근 방향성과 강도를 중심으로 봅니다.' },
    { value: 'value', label: '기업비교', description: '사업과 재무를 비교하기 쉬운 종목을 봅니다.' },
];

function formatPrice(value: number) {
    return `₩${new Intl.NumberFormat('ko-KR').format(Math.round(value))}`;
}

function formatBudgetLabel(value: number) {
    return `월 ${new Intl.NumberFormat('ko-KR').format(value)}원`;
}

function formatPercent(value: number) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

function formatCompactNumber(value: number | null) {
    if (value === null) {
        return '-';
    }

    return new Intl.NumberFormat('ko-KR', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

function getRiskLabel(riskLevel: string) {
    if (riskLevel.includes('Low')) {
        return '낮음';
    }
    if (riskLevel.includes('High')) {
        return '높음';
    }
    return '보통';
}

function getToneClasses(tone: string) {
    if (tone.toLowerCase().includes('good') || tone.toLowerCase().includes('strong')) {
        return 'bg-emerald-100 text-emerald-700';
    }
    if (tone.toLowerCase().includes('warn')) {
        return 'bg-amber-100 text-amber-700';
    }
    return 'bg-slate-200 text-slate-700';
}

export default function Home() {
    const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [riskProfile, setRiskProfile] = useState<RiskProfile>('balanced');
    const [learningFocus, setLearningFocus] = useState<LearningFocus>('trend');
    const [monthlyBudget, setMonthlyBudget] = useState(300000);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const saved = window.localStorage.getItem(WATCHLIST_KEY);
        if (!saved) {
            return;
        }

        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                setWatchlist(parsed);
            }
        } catch (error) {
            console.error('관심 종목을 불러오지 못했습니다.', error);
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    }, [watchlist]);

    useEffect(() => {
        setDashboardLoading(true);
        setErrorMessage(null);

        fetch(`${API_BASE}/dashboard?risk_profile=${riskProfile}&learning_focus=${learningFocus}&monthly_budget=${monthlyBudget}`)
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Dashboard request failed with status ${res.status}`);
                }
                return res.json();
            })
            .then((data: DashboardResponse) => {
                setDashboard(data);
                setDashboardLoading(false);
            })
            .catch((error) => {
                console.error('대시보드를 불러오지 못했습니다.', error);
                setDashboard(null);
                setDashboardLoading(false);
                setErrorMessage('추천 데이터를 불러오지 못했습니다. 백엔드가 실행 중인지 확인해 주세요.');
            });
    }, [riskProfile, learningFocus, monthlyBudget]);

    useEffect(() => {
        if (!dashboard?.recommendations.length) {
            setSelectedTicker(null);
            setSelectedRecommendation(null);
            setChartData([]);
            return;
        }

        const nextTicker =
            dashboard.recommendations.find((item) => item.ticker_code === selectedTicker)?.ticker_code ??
            dashboard.recommendations[0].ticker_code;

        setSelectedTicker(nextTicker);
    }, [dashboard, selectedTicker]);

    useEffect(() => {
        if (!selectedTicker) {
            return;
        }

        const params = new URLSearchParams({
            risk_profile: riskProfile,
            learning_focus: learningFocus,
        });

        setDetailLoading(true);

        Promise.all([
            fetch(`${API_BASE}/prices/${selectedTicker}`).then((res) => {
                if (!res.ok) {
                    throw new Error(`Price request failed with status ${res.status}`);
                }
                return res.json();
            }),
            fetch(`${API_BASE}/recommendations/${selectedTicker}?${params.toString()}`).then((res) => {
                if (!res.ok) {
                    throw new Error(`Recommendation request failed with status ${res.status}`);
                }
                return res.json();
            }),
        ])
            .then(([priceRows, recommendation]: [Array<{ date: string; open: number; high: number; low: number; close: number }>, Recommendation]) => {
                const formatted = priceRows
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((item) => ({
                        time: item.date,
                        open: item.open,
                        high: item.high,
                        low: item.low,
                        close: item.close,
                    }));

                setChartData(formatted);
                setSelectedRecommendation(recommendation);
                setDetailLoading(false);
            })
            .catch((error) => {
                console.error('상세 정보를 불러오지 못했습니다.', error);
                setChartData([]);
                setSelectedRecommendation(null);
                setDetailLoading(false);
            });
    }, [selectedTicker, riskProfile, learningFocus]);

    const watchlistItems = useMemo(() => {
        if (!dashboard) {
            return [];
        }

        return dashboard.recommendations.filter((item) => watchlist.includes(item.ticker_code));
    }, [dashboard, watchlist]);

    const toggleWatchlist = (tickerCode: string) => {
        setWatchlist((current) =>
            current.includes(tickerCode) ? current.filter((item) => item !== tickerCode) : [...current, tickerCode]
        );
    };

    const budgetPresets = [100000, 300000, 500000, 1000000];

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f8f3e8_0%,#f6f7fb_45%,#edf2f7_100%)] text-slate-900">
            <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <p className="text-sm font-medium tracking-[0.2em] text-emerald-700">STOCK STARTER</p>
                            <h1 className="mt-3 font-display text-4xl leading-tight text-slate-950 md:text-5xl">
                                복잡한 정보 대신
                                <br />
                                지금 보기 쉬운 추천만 보여드립니다
                            </h1>
                            <p className="mt-4 text-base leading-7 text-slate-600">
                                {dashboard?.headline ?? '투자 성향과 예산에 맞춰 핵심 추천 종목을 간단하게 정리했습니다.'}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                {dashboard?.subheadline ?? '추천 이유, 주가 흐름, 예산 배분만 빠르게 확인할 수 있습니다.'}
                            </p>
                        </div>
                        <div className="grid gap-3 rounded-[28px] bg-slate-950 p-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)] sm:grid-cols-3">
                            <div>
                                <p className="text-xs text-white/60">기준 시점</p>
                                <p className="mt-2 text-lg font-semibold">{dashboard?.as_of ?? '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-white/60">선택 예산</p>
                                <p className="mt-2 text-lg font-semibold">{formatBudgetLabel(monthlyBudget)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-white/60">관심 종목</p>
                                <p className="mt-2 text-lg font-semibold">{watchlist.length}개</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                    <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                        <p className="text-sm font-semibold text-slate-500">투자 성향</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {riskOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setRiskProfile(option.value)}
                                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                                        riskProfile === option.value
                                            ? 'border-emerald-700 bg-emerald-50'
                                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                    }`}
                                >
                                    <p className="font-semibold text-slate-900">{option.label}</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                        <p className="text-sm font-semibold text-slate-500">학습 포인트</p>
                        <div className="mt-4 grid gap-3">
                            {focusOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setLearningFocus(option.value)}
                                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                                        learningFocus === option.value
                                            ? 'border-sky-700 bg-sky-50'
                                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                    }`}
                                >
                                    <p className="font-semibold text-slate-900">{option.label}</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-500">월 투자 예산</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">{formatBudgetLabel(monthlyBudget)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {budgetPresets.map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() => setMonthlyBudget(amount)}
                                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                        monthlyBudget === amount
                                            ? 'bg-slate-950 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {new Intl.NumberFormat('ko-KR').format(amount)}원
                                </button>
                            ))}
                        </div>
                    </div>
                    <input
                        className="mt-5 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-700"
                        type="range"
                        min={100000}
                        max={1000000}
                        step={50000}
                        value={monthlyBudget}
                        onChange={(event) => setMonthlyBudget(Number(event.target.value))}
                    />
                </section>

                {dashboard?.summary_cards?.length ? (
                    <section className="grid gap-4 md:grid-cols-3">
                        {dashboard.summary_cards.slice(0, 3).map((card) => (
                            <article
                                key={card.label}
                                className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]"
                            >
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getToneClasses(card.tone)}`}>
                                    {card.label}
                                </span>
                                <p className="mt-4 text-3xl font-semibold text-slate-950">{card.value}</p>
                                <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
                            </article>
                        ))}
                    </section>
                ) : null}

                {errorMessage ? (
                    <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                        {errorMessage}
                    </section>
                ) : null}

                <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <section className="rounded-[32px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07)]">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-slate-500">추천 종목</p>
                                <h2 className="mt-2 font-display text-3xl text-slate-950">한눈에 보는 후보</h2>
                            </div>
                            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                                {dashboard?.active_profile?.label ?? '추천 프로필'}
                            </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                            {dashboard?.active_profile?.description ?? '현재 조건에 맞는 추천 종목을 점수순으로 보여줍니다.'}
                        </p>

                        {dashboardLoading ? (
                            <div className="mt-6 rounded-[24px] bg-slate-50 px-5 py-8 text-sm text-slate-500">
                                추천 목록을 불러오는 중입니다.
                            </div>
                        ) : (
                            <div className="mt-6 space-y-4">
                                {dashboard?.recommendations.map((item) => {
                                    const isSelected = selectedTicker === item.ticker_code;
                                    const isSaved = watchlist.includes(item.ticker_code);

                                    return (
                                        <article
                                            key={item.ticker_code}
                                            className={`rounded-[28px] border p-5 transition ${
                                                isSelected
                                                    ? 'border-emerald-300 bg-emerald-50/70 shadow-[0_14px_30px_rgba(5,150,105,0.10)]'
                                                    : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-xl font-semibold text-slate-950">{item.ticker_name}</h3>
                                                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                                                            {item.ticker_code}
                                                        </span>
                                                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                                                            {item.badge}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 text-sm text-slate-500">
                                                        {item.market}
                                                        {item.sector ? ` · ${item.sector}` : ''}
                                                    </p>
                                                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.fit_for}</p>
                                                </div>
                                                <div className="grid min-w-[180px] grid-cols-2 gap-3">
                                                    <div className="rounded-2xl bg-white px-4 py-3">
                                                        <p className="text-xs text-slate-400">현재가</p>
                                                        <p className="mt-1 font-semibold text-slate-950">{formatPrice(item.current_price)}</p>
                                                    </div>
                                                    <div className="rounded-2xl bg-white px-4 py-3">
                                                        <p className="text-xs text-slate-400">20일 변화</p>
                                                        <p
                                                            className={`mt-1 font-semibold ${
                                                                item.price_change_20d >= 0 ? 'text-rose-600' : 'text-sky-700'
                                                            }`}
                                                        >
                                                            {formatPercent(item.price_change_20d)}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-2xl bg-white px-4 py-3">
                                                        <p className="text-xs text-slate-400">추천 점수</p>
                                                        <p className="mt-1 font-semibold text-slate-950">{item.score.toFixed(1)}</p>
                                                    </div>
                                                    <div className="rounded-2xl bg-white px-4 py-3">
                                                        <p className="text-xs text-slate-400">리스크</p>
                                                        <p className="mt-1 font-semibold text-slate-950">{getRiskLabel(item.risk_level)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedTicker(item.ticker_code)}
                                                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                                                >
                                                    자세히 보기
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleWatchlist(item.ticker_code)}
                                                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                                                >
                                                    {isSaved ? '관심 종목 해제' : '관심 종목 저장'}
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="space-y-6">
                        <section className="rounded-[32px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07)]">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-500">선택 종목 상세</p>
                                    <h2 className="mt-2 font-display text-3xl text-slate-950">
                                        {selectedRecommendation?.ticker_name ?? '종목을 선택해 주세요'}
                                    </h2>
                                    <p className="mt-2 text-sm text-slate-500">
                                        {selectedRecommendation
                                            ? `${selectedRecommendation.ticker_code} · ${selectedRecommendation.market}`
                                            : '왼쪽 목록에서 종목을 선택하면 상세 정보가 열립니다.'}
                                    </p>
                                </div>
                                {selectedRecommendation ? (
                                    <div className="rounded-[24px] bg-slate-950 px-4 py-3 text-white">
                                        <p className="text-xs text-white/60">추천 점수</p>
                                        <p className="mt-1 text-2xl font-semibold">{selectedRecommendation.score.toFixed(1)}</p>
                                    </div>
                                ) : null}
                            </div>

                            {detailLoading ? (
                                <div className="mt-6 rounded-[24px] bg-slate-50 px-5 py-8 text-sm text-slate-500">
                                    상세 정보를 불러오는 중입니다.
                                </div>
                            ) : selectedRecommendation ? (
                                <>
                                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                                        <div className="rounded-[24px] bg-slate-50 p-4">
                                            <p className="text-xs text-slate-400">현재가</p>
                                            <p className="mt-2 text-2xl font-semibold text-slate-950">
                                                {formatPrice(selectedRecommendation.current_price)}
                                            </p>
                                        </div>
                                        <div className="rounded-[24px] bg-slate-50 p-4">
                                            <p className="text-xs text-slate-400">변동성</p>
                                            <p className="mt-2 text-2xl font-semibold text-slate-950">
                                                {selectedRecommendation.volatility.toFixed(1)}%
                                            </p>
                                        </div>
                                        <div className="rounded-[24px] bg-slate-50 p-4">
                                            <p className="text-xs text-slate-400">성향 적합도</p>
                                            <p className="mt-2 text-lg font-semibold text-slate-950">{selectedRecommendation.badge}</p>
                                        </div>
                                    </div>

                                    <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white">
                                        {chartData.length > 0 ? (
                                            <StockChart
                                                data={chartData}
                                                colors={{
                                                    backgroundColor: '#ffffff',
                                                    textColor: '#475569',
                                                }}
                                            />
                                        ) : (
                                            <div className="px-5 py-10 text-center text-sm text-slate-500">
                                                차트 데이터가 아직 충분하지 않습니다.
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 grid gap-4">
                                        <article className="rounded-[24px] bg-emerald-50 p-5">
                                            <p className="text-sm font-semibold text-emerald-800">추천 이유</p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {selectedRecommendation.reasons.map((reason) => (
                                                    <span key={reason} className="rounded-full bg-white px-3 py-2 text-sm text-slate-700">
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>
                                        </article>
                                        <article className="rounded-[24px] bg-slate-50 p-5">
                                            <p className="text-sm font-semibold text-slate-700">초보자 메모</p>
                                            <p className="mt-3 text-sm leading-7 text-slate-600">{selectedRecommendation.beginner_note}</p>
                                        </article>
                                        <article className="rounded-[24px] bg-sky-50 p-5">
                                            <p className="text-sm font-semibold text-sky-800">다음 행동 제안</p>
                                            <p className="mt-3 text-sm leading-7 text-slate-700">{selectedRecommendation.action_guide}</p>
                                        </article>
                                        <article className="rounded-[24px] bg-amber-50 p-5">
                                            <p className="text-sm font-semibold text-amber-800">현재 성향과의 궁합</p>
                                            <p className="mt-3 text-sm leading-7 text-slate-700">{selectedRecommendation.profile_match}</p>
                                        </article>
                                    </div>
                                </>
                            ) : (
                                <div className="mt-6 rounded-[24px] bg-slate-50 px-5 py-8 text-sm text-slate-500">
                                    표시할 종목 상세 정보가 없습니다.
                                </div>
                            )}
                        </section>

                        <section className="rounded-[32px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07)]">
                            <p className="text-sm font-semibold text-slate-500">예산 배분 가이드</p>
                            <h2 className="mt-2 font-display text-3xl text-slate-950">처음 시작할 때의 기준</h2>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {dashboard?.starter_plan.profile_note ?? '월 예산을 무리 없이 나눠보는 기준입니다.'}
                            </p>
                            <div className="mt-5 grid gap-4 md:grid-cols-3">
                                <div className="rounded-[24px] bg-slate-50 p-4">
                                    <p className="text-xs text-slate-400">월 예산</p>
                                    <p className="mt-2 text-xl font-semibold text-slate-950">
                                        {formatPrice(dashboard?.starter_plan.monthly_budget ?? monthlyBudget)}
                                    </p>
                                </div>
                                <div className="rounded-[24px] bg-slate-50 p-4">
                                    <p className="text-xs text-slate-400">권장 투자금</p>
                                    <p className="mt-2 text-xl font-semibold text-slate-950">
                                        {formatPrice(dashboard?.starter_plan.estimated_investment ?? 0)}
                                    </p>
                                </div>
                                <div className="rounded-[24px] bg-slate-50 p-4">
                                    <p className="text-xs text-slate-400">현금 여유분</p>
                                    <p className="mt-2 text-xl font-semibold text-slate-950">
                                        {formatPrice(dashboard?.starter_plan.cash_buffer ?? 0)}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 space-y-3">
                                {dashboard?.starter_plan.allocations.slice(0, 3).map((allocation) => (
                                    <article key={allocation.ticker_code} className="rounded-[24px] bg-slate-50 px-5 py-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-slate-900">{allocation.ticker_name}</p>
                                                <p className="mt-1 text-sm text-slate-500">{allocation.weight}% 비중</p>
                                            </div>
                                            <p className="text-lg font-semibold text-slate-950">
                                                {formatPrice(allocation.target_amount)}
                                            </p>
                                        </div>
                                        <p className="mt-3 text-sm leading-6 text-slate-600">{allocation.note}</p>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <section className="grid gap-6 lg:grid-cols-2">
                            <article className="rounded-[32px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07)]">
                                <p className="text-sm font-semibold text-slate-500">관심 종목</p>
                                <h2 className="mt-2 font-display text-2xl text-slate-950">저장한 후보</h2>
                                <div className="mt-4 space-y-3">
                                    {watchlistItems.length > 0 ? (
                                        watchlistItems.map((item) => (
                                            <button
                                                key={item.ticker_code}
                                                type="button"
                                                onClick={() => setSelectedTicker(item.ticker_code)}
                                                className="flex w-full items-center justify-between rounded-[22px] bg-slate-50 px-4 py-4 text-left"
                                            >
                                                <div>
                                                    <p className="font-semibold text-slate-900">{item.ticker_name}</p>
                                                    <p className="mt-1 text-sm text-slate-500">{item.ticker_code}</p>
                                                </div>
                                                <p className="text-sm font-medium text-slate-700">{formatPrice(item.current_price)}</p>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="rounded-[22px] bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                            아직 저장한 관심 종목이 없습니다.
                                        </div>
                                    )}
                                </div>
                            </article>

                            <article className="rounded-[32px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.07)]">
                                <p className="text-sm font-semibold text-slate-500">빠른 체크</p>
                                <h2 className="mt-2 font-display text-2xl text-slate-950">매수 전 확인할 것</h2>
                                <div className="mt-4 space-y-3">
                                    {(dashboard?.starter_steps ?? []).map((step) => (
                                        <div key={step} className="rounded-[22px] bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                                            {step}
                                        </div>
                                    ))}
                                </div>
                            </article>
                        </section>

                        <section className="rounded-[32px] border border-white/80 bg-slate-950 p-6 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
                            <p className="text-sm font-semibold text-white/65">재무 요약</p>
                            <h2 className="mt-2 font-display text-3xl text-white">기업 숫자를 간단히 보기</h2>
                            <p className="mt-3 text-sm leading-6 text-white/72">
                                {selectedRecommendation?.financial_snapshot.summary ?? '종목을 선택하면 재무 요약을 확인할 수 있습니다.'}
                            </p>
                            <div className="mt-5 grid gap-4 md:grid-cols-3">
                                <div className="rounded-[24px] bg-white/10 p-4">
                                    <p className="text-xs text-white/55">매출</p>
                                    <p className="mt-2 text-xl font-semibold">
                                        {formatCompactNumber(selectedRecommendation?.financial_snapshot.revenue ?? null)}
                                    </p>
                                </div>
                                <div className="rounded-[24px] bg-white/10 p-4">
                                    <p className="text-xs text-white/55">영업이익</p>
                                    <p className="mt-2 text-xl font-semibold">
                                        {formatCompactNumber(selectedRecommendation?.financial_snapshot.operating_income ?? null)}
                                    </p>
                                </div>
                                <div className="rounded-[24px] bg-white/10 p-4">
                                    <p className="text-xs text-white/55">순이익</p>
                                    <p className="mt-2 text-xl font-semibold">
                                        {formatCompactNumber(selectedRecommendation?.financial_snapshot.net_income ?? null)}
                                    </p>
                                </div>
                            </div>
                            {selectedRecommendation?.financial_snapshot.source ? (
                                <p className="mt-4 text-xs text-white/55">
                                    출처: {selectedRecommendation.financial_snapshot.source}
                                    {selectedRecommendation.financial_snapshot.is_demo ? ' · 데모 데이터 포함' : ''}
                                </p>
                            ) : null}
                        </section>
                    </section>
                </section>
            </section>
        </main>
    );
}
