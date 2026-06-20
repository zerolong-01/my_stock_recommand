'use client';

import { useEffect, useState } from 'react';

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
    risk_profile: RiskProfile;
    learning_focus: LearningFocus;
    label: string;
    description: string;
}

interface StarterAllocation {
    ticker_code: string;
    ticker_name: string;
    sector: string | null;
    weight: number;
    target_amount: number;
    estimated_shares: number;
    invested_amount: number;
    current_price: number;
    role: string;
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

interface DataSourceSummary {
    name: string;
    status: string;
    description: string;
}

interface BriefingCard {
    title: string;
    label: string;
    ticker_code: string;
    ticker_name: string;
    detail: string;
}

interface DataHealthCard {
    label: string;
    value: string;
    tone: string;
    detail: string;
}

interface CompareRow {
    ticker_code: string;
    ticker_name: string;
    sector: string | null;
    score: number;
    risk_level: string;
    price_change_20d: number;
    volatility: number;
    financial_label: string;
}

interface SectorExposureCard {
    sector: string;
    shortlist_count: number;
    starter_weight: number;
    note: string;
}

interface RiskAlertCard {
    title: string;
    severity: string;
    detail: string;
    ticker_code: string | null;
    ticker_name: string | null;
}

interface DashboardResponse {
    as_of: string;
    headline: string;
    subheadline: string;
    starter_steps: string[];
    summary_cards: SummaryCard[];
    active_profile: ActiveProfile;
    starter_plan: StarterPlan;
    data_sources: DataSourceSummary[];
    data_health: DataHealthCard[];
    market_briefing: BriefingCard[];
    compare_rows: CompareRow[];
    sector_exposure: SectorExposureCard[];
    risk_alerts: RiskAlertCard[];
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

const riskOptions: Array<{
    value: RiskProfile;
    title: string;
    description: string;
}> = [
    {
        value: 'steady',
        title: 'Steady',
        description: 'Prefer calmer names and a less stressful first investing experience.',
    },
    {
        value: 'balanced',
        title: 'Balanced',
        description: 'Want a mix of stability and learning opportunities.',
    },
    {
        value: 'ambitious',
        title: 'Ambitious',
        description: 'Okay with bigger movement if the learning upside feels worth it.',
    },
];

const focusOptions: Array<{
    value: LearningFocus;
    title: string;
    description: string;
}> = [
    {
        value: 'dividend',
        title: 'Stability',
        description: 'I want calmer charts and easier first-stock confidence.',
    },
    {
        value: 'trend',
        title: 'Momentum',
        description: 'Show me stocks with clearer recent direction and signal strength.',
    },
    {
        value: 'value',
        title: 'Comparison',
        description: 'I want names that are easier to compare and study as businesses.',
    },
];

function formatPrice(value: number) {
    return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}

function formatBudgetLabel(value: number) {
    return `${new Intl.NumberFormat('ko-KR').format(value)} KRW`;
}

function formatPercent(value: number) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

export default function Home() {
    const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [chartLoading, setChartLoading] = useState(false);
    const [riskProfile, setRiskProfile] = useState<RiskProfile>('balanced');
    const [learningFocus, setLearningFocus] = useState<LearningFocus>('trend');
    const [monthlyBudget, setMonthlyBudget] = useState(300000);
    const [watchlist, setWatchlist] = useState<string[]>([]);

    useEffect(() => {
        const saved = window.localStorage.getItem('stock-starter-watchlist');
        if (!saved) {
            return;
        }

        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                setWatchlist(parsed);
            }
        } catch (error) {
            console.error('Failed to parse watchlist:', error);
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem('stock-starter-watchlist', JSON.stringify(watchlist));
    }, [watchlist]);

    useEffect(() => {
        fetchDashboard(riskProfile, learningFocus, monthlyBudget);
    }, [riskProfile, learningFocus, monthlyBudget]);

    const fetchDashboard = (risk: RiskProfile, focus: LearningFocus, budget: number) => {
        setLoading(true);

        fetch(`${API_BASE}/dashboard?risk_profile=${risk}&learning_focus=${focus}&monthly_budget=${budget}`)
            .then((res) => res.json())
            .then((data: DashboardResponse) => {
                setDashboard(data);
                setLoading(false);

                const nextTicker =
                    data.recommendations.find((item) => item.ticker_code === selectedTicker)?.ticker_code ??
                    data.recommendations[0]?.ticker_code ??
                    null;

                if (nextTicker) {
                    handleTickerClick(nextTicker);
                } else {
                    setSelectedTicker(null);
                    setChartData([]);
                }
            })
            .catch((error) => {
                console.error('Failed to fetch dashboard:', error);
                setLoading(false);
            });
    };

    const handleTickerClick = (tickerCode: string) => {
        setSelectedTicker(tickerCode);
        setChartLoading(true);

        fetch(`${API_BASE}/prices/${tickerCode}`)
            .then((res) => res.json())
            .then((data) => {
                const formatted = data
                    .sort((a: { date: string }, b: { date: string }) => {
                        return new Date(a.date).getTime() - new Date(b.date).getTime();
                    })
                    .map((item: { date: string; open: number; high: number; low: number; close: number }) => ({
                        time: item.date,
                        open: item.open,
                        high: item.high,
                        low: item.low,
                        close: item.close,
                    }));

                setChartData(formatted);
                setChartLoading(false);
            })
            .catch((error) => {
                console.error(`Failed to fetch prices for ${tickerCode}:`, error);
                setChartData([]);
                setChartLoading(false);
            });
    };

    const selectedRecommendation =
        dashboard?.recommendations.find((item) => item.ticker_code === selectedTicker) ?? null;
    const usesDemoFinancials =
        dashboard?.recommendations.some((item) => item.financial_snapshot.is_demo) ?? false;
    const watchlistItems =
        dashboard?.recommendations.filter((item) => watchlist.includes(item.ticker_code)) ?? [];
    const selectedRiskOption = riskOptions.find((option) => option.value === riskProfile) ?? riskOptions[1];
    const selectedFocusOption = focusOptions.find((option) => option.value === learningFocus) ?? focusOptions[1];
    const planProgress = [
        { label: 'Comfort picked', done: true },
        { label: 'Learning goal picked', done: true },
        { label: 'Budget ready', done: monthlyBudget >= 100000 },
        { label: 'Stock reviewed', done: Boolean(selectedRecommendation) },
        { label: 'Watchlist saved', done: watchlistItems.length > 0 },
    ];
    const completedPlanSteps = planProgress.filter((step) => step.done).length;
    const progressPercent = Math.round((completedPlanSteps / planProgress.length) * 100);
    const roadmapHighlight =
        watchlistItems[0] ?? selectedRecommendation ?? dashboard?.recommendations[0] ?? null;
    const nextActions = [
        watchlistItems.length === 0
            ? 'Save one or two names to your watchlist so you can compare them later without starting over.'
            : `You already saved ${watchlistItems.length} stock${watchlistItems.length > 1 ? 's' : ''}. Compare their risk and sector before buying anything.`,
        selectedRecommendation
            ? `Review ${selectedRecommendation.ticker_name}'s beginner note and action guide before making a first small order.`
            : 'Open one recommendation to see the chart, beginner note, and action guide in detail.',
        monthlyBudget >= 500000
            ? 'Because your starter budget is higher, keep part of it as cash buffer and avoid putting it all into one theme.'
            : 'With a smaller starter budget, focus on learning consistency first instead of chasing too many stocks at once.',
    ];

    const toggleWatchlist = (tickerCode: string) => {
        setWatchlist((current) =>
            current.includes(tickerCode)
                ? current.filter((code) => code !== tickerCode)
                : [...current, tickerCode]
        );
    };

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.28),_transparent_32%),linear-gradient(135deg,_#f6efe4_0%,_#e7f0ec_55%,_#d7e7f5_100%)] text-slate-900">
            <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
                {usesDemoFinancials && (
                    <div className="mb-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-[0_8px_24px_rgba(120,86,18,0.08)]">
                        Financial guidance currently includes labeled demo seed data so you can review the full beginner flow before live statement ingestion is connected.
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[32px] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(39,61,51,0.12)] backdrop-blur">
                        <div className="mb-5 inline-flex items-center gap-3 rounded-full bg-[#173f35] px-4 py-2 text-sm font-medium text-white">
                            <span className="h-2 w-2 rounded-full bg-[#f4b942]" />
                            Beginner-first Stock Picks
                        </div>
                        <h1 className="max-w-3xl font-display text-4xl leading-tight md:text-6xl">
                            {dashboard?.headline ?? 'Finding your first stock should feel less overwhelming.'}
                        </h1>
                        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                            {dashboard?.subheadline ??
                                'We are preparing a clearer recommendation flow for new investors.'}
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-700">
                            <div className="rounded-full bg-[#f4b942]/20 px-4 py-2">Simple reasons instead of finance-heavy language</div>
                            <div className="rounded-full bg-[#1d6b57]/15 px-4 py-2">Risk translated into beginner-friendly terms</div>
                            <div className="rounded-full bg-[#3c6ca8]/15 px-4 py-2">Profile-aware ranking like starter investing apps</div>
                        </div>
                    </div>

                    <div className="rounded-[32px] bg-[#173f35] p-7 text-white shadow-[0_24px_80px_rgba(16,45,38,0.24)]">
                        <p className="text-sm uppercase tracking-[0.24em] text-white/65">Quick setup</p>
                        <div className="mt-5 rounded-[28px] border border-white/10 bg-white/5 p-5">
                            <p className="text-xs text-[#f4b942]">PROFILE</p>
                            <h2 className="mt-2 font-display text-2xl">
                                {dashboard?.active_profile.label ?? 'Choose your beginner style'}
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-white/80">
                                {dashboard?.active_profile.description ??
                                    'Pick a comfort level and learning goal. The ranking will update right away.'}
                            </p>
                        </div>
                        <div className="mt-5 space-y-4">
                            {(dashboard?.starter_steps ?? []).map((step, index) => (
                                <div key={step} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-xs text-[#f4b942]">STEP {index + 1}</p>
                                    <p className="mt-2 text-sm leading-6 text-white/85">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <section className="mt-8 rounded-[32px] border border-white/70 bg-white/78 p-6 shadow-[0_20px_70px_rgba(39,61,51,0.1)] backdrop-blur">
                    <div className="grid gap-6 xl:grid-cols-[1fr_1fr_0.92fr]">
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">1. Risk comfort</p>
                            <div className="mt-4 grid gap-3">
                                {riskOptions.map((option) => {
                                    const active = riskProfile === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setRiskProfile(option.value)}
                                            className={`rounded-[24px] border px-5 py-4 text-left transition ${
                                                active
                                                    ? 'border-[#173f35] bg-[#173f35] text-white'
                                                    : 'border-slate-200 bg-[#faf7f1] text-slate-900 hover:bg-white'
                                            }`}
                                        >
                                            <p className="font-semibold">{option.title}</p>
                                            <p className={`mt-2 text-sm leading-6 ${active ? 'text-white/78' : 'text-slate-600'}`}>
                                                {option.description}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">2. What you want to learn first</p>
                            <div className="mt-4 grid gap-3">
                                {focusOptions.map((option) => {
                                    const active = learningFocus === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setLearningFocus(option.value)}
                                            className={`rounded-[24px] border px-5 py-4 text-left transition ${
                                                active
                                                    ? 'border-[#1c4b73] bg-[#1c4b73] text-white'
                                                    : 'border-slate-200 bg-[#f4f8fb] text-slate-900 hover:bg-white'
                                            }`}
                                        >
                                            <p className="font-semibold">{option.title}</p>
                                            <p className={`mt-2 text-sm leading-6 ${active ? 'text-white/80' : 'text-slate-600'}`}>
                                                {option.description}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">3. Monthly starter budget</p>
                            <div className="mt-4 rounded-[24px] border border-slate-200 bg-[#fcfaf5] p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm text-slate-500">Budget</p>
                                        <p className="mt-2 font-display text-3xl">{formatBudgetLabel(monthlyBudget)}</p>
                                    </div>
                                    <div className="rounded-full bg-[#173f35] px-4 py-2 text-sm text-white">
                                        Starter basket ready
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min={100000}
                                    max={1000000}
                                    step={50000}
                                    value={monthlyBudget}
                                    onChange={(event) => setMonthlyBudget(Number(event.target.value))}
                                    className="mt-5 w-full accent-[#173f35]"
                                />
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {[200000, 300000, 500000, 1000000].map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setMonthlyBudget(preset)}
                                            className={`rounded-full px-4 py-2 text-sm transition ${
                                                monthlyBudget === preset
                                                    ? 'bg-[#173f35] text-white'
                                                    : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {formatBudgetLabel(preset)}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-4 text-sm leading-6 text-slate-600">
                                    Use this to preview how a first-month basket could look before committing real money.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-8 rounded-[32px] border border-[#d7e5de] bg-[linear-gradient(135deg,_rgba(23,63,53,0.98),_rgba(29,75,115,0.95))] p-6 text-white shadow-[0_24px_80px_rgba(23,63,53,0.2)]">
                    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.24em] text-white/60">Starter roadmap</p>
                                    <h2 className="mt-2 font-display text-3xl">Your beginner investing setup at a glance</h2>
                                </div>
                                <div className="rounded-[24px] bg-white/10 px-4 py-3 text-right">
                                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">Progress</p>
                                    <p className="mt-2 font-display text-3xl">{progressPercent}%</p>
                                </div>
                            </div>
                            <div className="mt-6 grid gap-4 md:grid-cols-3">
                                <article className="rounded-[24px] bg-white/10 p-5 backdrop-blur">
                                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">Risk comfort</p>
                                    <p className="mt-3 text-2xl font-semibold">{selectedRiskOption.title}</p>
                                    <p className="mt-3 text-sm leading-6 text-white/75">{selectedRiskOption.description}</p>
                                </article>
                                <article className="rounded-[24px] bg-white/10 p-5 backdrop-blur">
                                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">Learning focus</p>
                                    <p className="mt-3 text-2xl font-semibold">{selectedFocusOption.title}</p>
                                    <p className="mt-3 text-sm leading-6 text-white/75">{selectedFocusOption.description}</p>
                                </article>
                                <article className="rounded-[24px] bg-white/10 p-5 backdrop-blur">
                                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">Starter budget</p>
                                    <p className="mt-3 text-2xl font-semibold">{formatBudgetLabel(monthlyBudget)}</p>
                                    <p className="mt-3 text-sm leading-6 text-white/75">
                                        {watchlistItems.length > 0
                                            ? `Watchlist ready with ${watchlistItems.length} saved idea${watchlistItems.length > 1 ? 's' : ''}.`
                                            : 'No saved picks yet, so the next good step is to bookmark one candidate.'}
                                    </p>
                                </article>
                            </div>
                            <div className="mt-6 grid gap-3 md:grid-cols-5">
                                {planProgress.map((step) => (
                                    <div
                                        key={step.label}
                                        className={`rounded-[20px] px-4 py-4 text-sm ${
                                            step.done ? 'bg-white text-slate-900' : 'bg-white/8 text-white/70'
                                        }`}
                                    >
                                        <p className="font-medium">{step.label}</p>
                                        <p className={`mt-2 text-xs uppercase tracking-[0.14em] ${step.done ? 'text-emerald-600' : 'text-white/45'}`}>
                                            {step.done ? 'Done' : 'Next'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <article className="rounded-[28px] bg-white/10 p-6 backdrop-blur">
                                <p className="text-xs uppercase tracking-[0.18em] text-white/55">Primary idea</p>
                                <h3 className="mt-3 font-display text-3xl">
                                    {roadmapHighlight?.ticker_name ?? 'Pick a recommendation to begin'}
                                </h3>
                                <p className="mt-2 text-sm text-white/70">
                                    {roadmapHighlight
                                        ? `${roadmapHighlight.ticker_code} | ${roadmapHighlight.sector ?? 'No sector'}`
                                        : 'Once you open a recommendation, this area will summarize your most relevant starting point.'}
                                </p>
                                <p className="mt-4 text-sm leading-6 text-white/80">
                                    {roadmapHighlight?.fit_for ??
                                        'The app will use your selected comfort level, learning focus, and budget to surface a clearer first pick.'}
                                </p>
                                {roadmapHighlight && (
                                    <div className="mt-5 flex flex-wrap gap-2 text-xs">
                                        <span className="rounded-full bg-[#f4b942] px-3 py-1 font-medium text-slate-900">
                                            Score {roadmapHighlight.score}
                                        </span>
                                        <span className="rounded-full bg-white/10 px-3 py-1 text-white/78">
                                            Risk {roadmapHighlight.risk_level}
                                        </span>
                                        <span className="rounded-full bg-white/10 px-3 py-1 text-white/78">
                                            20-day {formatPercent(roadmapHighlight.price_change_20d)}
                                        </span>
                                    </div>
                                )}
                                {roadmapHighlight && (
                                    <div className="mt-5 flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleTickerClick(roadmapHighlight.ticker_code)}
                                            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#173f35]"
                                        >
                                            Open this pick
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleWatchlist(roadmapHighlight.ticker_code)}
                                            className="rounded-full border border-white/16 px-4 py-2 text-sm font-medium text-white/85"
                                        >
                                            {watchlist.includes(roadmapHighlight.ticker_code) ? 'Remove from watchlist' : 'Save for later'}
                                        </button>
                                    </div>
                                )}
                            </article>

                            <article className="rounded-[28px] bg-[#f8f3e4] p-6 text-slate-900 shadow-[0_10px_30px_rgba(31,43,38,0.08)]">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">What to do next</p>
                                <div className="mt-4 space-y-3">
                                    {nextActions.map((action, index) => (
                                        <div key={action} className="rounded-[22px] bg-white px-4 py-4">
                                            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Step {index + 1}</p>
                                            <p className="mt-2 text-sm leading-6 text-slate-700">{action}</p>
                                        </div>
                                    ))}
                                </div>
                            </article>
                        </div>
                    </div>
                </section>

                <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {(dashboard?.summary_cards ?? []).map((card) => (
                        <article
                            key={card.label}
                            className="rounded-[28px] border border-white/70 bg-white/75 p-6 shadow-[0_14px_40px_rgba(49,67,59,0.08)] backdrop-blur"
                        >
                            <p className="text-sm text-slate-500">{card.label}</p>
                            <p className="mt-3 font-display text-3xl">{card.value}</p>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
                        </article>
                    ))}
                </section>

                <section className="mt-8 rounded-[32px] border border-white/70 bg-white/76 p-6 shadow-[0_20px_70px_rgba(39,61,51,0.08)] backdrop-blur">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Beginner briefing</p>
                            <h2 className="mt-2 font-display text-3xl">How to read today&apos;s shortlist</h2>
                        </div>
                        <p className="max-w-xl text-sm leading-6 text-slate-600">
                            Instead of opening ten charts at once, start with these three quick signals to understand what stands out in the list.
                        </p>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        {(dashboard?.market_briefing ?? []).map((card) => (
                            <article key={`${card.title}-${card.ticker_code}`} className="rounded-[26px] bg-[#f8f6ef] p-5 shadow-[0_10px_30px_rgba(40,52,47,0.06)]">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{card.title}</p>
                                <div className="mt-3 flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-2xl font-semibold text-slate-900">{card.ticker_name}</h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {card.ticker_code} | {card.label}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleTickerClick(card.ticker_code)}
                                        className="rounded-full bg-[#173f35] px-3 py-2 text-xs font-medium text-white"
                                    >
                                        View
                                    </button>
                                </div>
                                <p className="mt-4 text-sm leading-6 text-slate-600">{card.detail}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-8 rounded-[32px] border border-white/70 bg-[#173f35] p-6 text-white shadow-[0_22px_80px_rgba(23,63,53,0.22)]">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-white/60">Watchlist</p>
                            <h2 className="mt-2 font-display text-3xl">Save a few names before you decide</h2>
                        </div>
                        <p className="max-w-xl text-sm leading-6 text-white/75">
                            Keep two or three stocks here while you learn the patterns. It helps beginners compare ideas without feeling rushed.
                        </p>
                    </div>
                    {watchlistItems.length > 0 ? (
                        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {watchlistItems.map((item) => (
                                <article key={item.ticker_code} className="rounded-[26px] bg-white/10 p-5 backdrop-blur">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.18em] text-white/55">Saved pick</p>
                                            <h3 className="mt-2 text-2xl font-semibold">{item.ticker_name}</h3>
                                            <p className="mt-1 text-sm text-white/65">
                                                {item.ticker_code} | {item.sector ?? 'No sector'}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-[#f4b942] px-3 py-1 text-xs font-medium text-slate-900">
                                            Score {item.score}
                                        </span>
                                    </div>
                                    <p className="mt-4 text-sm leading-6 text-white/78">{item.fit_for}</p>
                                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/70">
                                        <span className="rounded-full bg-white/10 px-3 py-1">Risk {item.risk_level}</span>
                                        <span className="rounded-full bg-white/10 px-3 py-1">
                                            20-day {formatPercent(item.price_change_20d)}
                                        </span>
                                    </div>
                                    <div className="mt-5 flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleTickerClick(item.ticker_code)}
                                            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#173f35]"
                                        >
                                            Open detail
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleWatchlist(item.ticker_code)}
                                            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/85"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-6 rounded-[26px] border border-dashed border-white/20 bg-white/6 p-6 text-sm leading-6 text-white/70">
                            Your watchlist is empty. Tap the save button on a recommendation to keep a few beginner-friendly ideas in one place.
                        </div>
                    )}
                </section>

                <section className="mt-8 rounded-[32px] border border-white/70 bg-white/78 p-6 shadow-[0_20px_70px_rgba(39,61,51,0.08)] backdrop-blur">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Quick compare</p>
                            <h2 className="mt-2 font-display text-3xl">Top candidates side by side</h2>
                        </div>
                        <p className="max-w-xl text-sm leading-6 text-slate-600">
                            This is the fastest way for a beginner to compare the shortlist without jumping in and out of multiple charts.
                        </p>
                    </div>
                    <div className="mt-6 overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-3">
                            <thead>
                                <tr className="text-left text-sm text-slate-500">
                                    <th className="px-4 py-2">Stock</th>
                                    <th className="px-4 py-2">Score</th>
                                    <th className="px-4 py-2">Risk</th>
                                    <th className="px-4 py-2">20-day move</th>
                                    <th className="px-4 py-2">Volatility</th>
                                    <th className="px-4 py-2">Financials</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(dashboard?.compare_rows ?? []).map((row) => (
                                    <tr key={row.ticker_code} className="rounded-[20px] bg-white shadow-[0_8px_24px_rgba(45,61,54,0.06)]">
                                        <td className="rounded-l-[20px] px-4 py-4">
                                            <button
                                                type="button"
                                                onClick={() => handleTickerClick(row.ticker_code)}
                                                className="text-left"
                                            >
                                                <p className="text-lg font-semibold text-slate-900">{row.ticker_name}</p>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    {row.ticker_code} | {row.sector ?? 'No sector'}
                                                </p>
                                            </button>
                                        </td>
                                        <td className="px-4 py-4 font-display text-2xl text-slate-900">{row.score}</td>
                                        <td className="px-4 py-4">
                                            <span className="rounded-full bg-[#f4b942]/20 px-3 py-2 text-sm text-[#7b5410]">
                                                {row.risk_level}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-4 text-sm font-medium ${row.price_change_20d >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {formatPercent(row.price_change_20d)}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-slate-700">{row.volatility.toFixed(1)}%</td>
                                        <td className="rounded-r-[20px] px-4 py-4 text-sm text-slate-700">{row.financial_label}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="mt-8 rounded-[32px] border border-[#f3d9a7] bg-[#fff8ea] p-6 shadow-[0_20px_70px_rgba(145,104,27,0.08)]">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-amber-700">Watch-outs</p>
                            <h2 className="mt-2 font-display text-3xl text-slate-900">What beginners should slow down for</h2>
                        </div>
                        <p className="max-w-xl text-sm leading-6 text-slate-600">
                            A good stock list is more useful when it also tells you where caution matters. These alerts highlight the easiest mistakes to avoid.
                        </p>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {(dashboard?.risk_alerts ?? []).map((alert) => (
                            <article key={`${alert.title}-${alert.ticker_code ?? 'general'}`} className="rounded-[24px] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(94,74,33,0.06)]">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-slate-900">{alert.title}</p>
                                        {alert.ticker_name && (
                                            <p className="mt-1 text-sm text-slate-500">
                                                {alert.ticker_name} | {alert.ticker_code}
                                            </p>
                                        )}
                                    </div>
                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                                            alert.severity === 'high'
                                                ? 'bg-rose-100 text-rose-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}
                                    >
                                        {alert.severity}
                                    </span>
                                </div>
                                <p className="mt-4 text-sm leading-6 text-slate-600">{alert.detail}</p>
                                {alert.ticker_code && (
                                    <button
                                        type="button"
                                        onClick={() => handleTickerClick(alert.ticker_code as string)}
                                        className="mt-4 rounded-full bg-[#173f35] px-4 py-2 text-sm text-white"
                                    >
                                        Review this stock
                                    </button>
                                )}
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-8 rounded-[32px] border border-white/70 bg-white/76 p-6 shadow-[0_20px_70px_rgba(39,61,51,0.08)] backdrop-blur">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Sector balance</p>
                            <h2 className="mt-2 font-display text-3xl">Where your shortlist is concentrated</h2>
                        </div>
                        <p className="max-w-xl text-sm leading-6 text-slate-600">
                            Even strong-looking picks can become risky when they all lean on the same sector story. This helps beginners spot concentration early.
                        </p>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {(dashboard?.sector_exposure ?? []).map((sector) => (
                            <article key={sector.sector} className="rounded-[24px] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(45,61,54,0.06)]">
                                <p className="text-sm text-slate-500">{sector.sector}</p>
                                <div className="mt-4 flex items-end justify-between gap-3">
                                    <div>
                                        <p className="text-xs text-slate-400">Shortlist count</p>
                                        <p className="mt-1 font-display text-3xl text-slate-900">{sector.shortlist_count}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400">Starter weight</p>
                                        <p className="mt-1 text-lg font-semibold text-slate-900">{sector.starter_weight}%</p>
                                    </div>
                                </div>
                                <p className="mt-4 text-sm leading-6 text-slate-600">{sector.note}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-8 rounded-[32px] border border-white/70 bg-white/76 p-6 shadow-[0_20px_70px_rgba(39,61,51,0.08)] backdrop-blur">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Data health</p>
                            <h2 className="mt-2 font-display text-3xl">How fresh and complete the saved data is</h2>
                        </div>
                        <p className="max-w-xl text-sm leading-6 text-slate-600">
                            This helps beginners understand whether the current screen is powered by fresh market history, demo financials, or a fuller live dataset.
                        </p>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {(dashboard?.data_health ?? []).map((card) => (
                            <article key={card.label} className="rounded-[24px] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(45,61,54,0.06)]">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-slate-500">{card.label}</p>
                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                                            card.tone === 'caution'
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-emerald-100 text-emerald-700'
                                        }`}
                                    >
                                        {card.tone}
                                    </span>
                                </div>
                                <p className="mt-3 font-display text-3xl text-slate-900">{card.value}</p>
                                <p className="mt-3 text-sm leading-6 text-slate-600">{card.detail}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-8 rounded-[32px] border border-white/70 bg-white/76 p-6 shadow-[0_20px_70px_rgba(39,61,51,0.08)] backdrop-blur">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Data mix</p>
                            <h2 className="mt-2 font-display text-3xl">What powers these recommendations</h2>
                        </div>
                        <p className="max-w-xl text-sm leading-6 text-slate-600">
                            Beginner apps feel more trustworthy when they explain the inputs. This panel shows which data streams are already active and which are still being prepared.
                        </p>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        {(dashboard?.data_sources ?? []).map((source) => (
                            <article key={source.name} className="rounded-[24px] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(45,61,54,0.06)]">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-semibold text-slate-900">{source.name}</p>
                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                                            source.status === 'active'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}
                                    >
                                        {source.status}
                                    </span>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-600">{source.description}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-8 rounded-[32px] bg-[#173f35] p-6 text-white shadow-[0_24px_80px_rgba(16,45,38,0.2)]">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-white/60">Starter basket</p>
                            <h2 className="mt-2 font-display text-3xl">Your first-month sample plan</h2>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
                                {dashboard?.starter_plan.profile_note ??
                                    'Pick a profile and budget to generate a sample starter plan.'}
                            </p>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/8 px-5 py-4 text-right">
                            <p className="text-xs text-white/60">Estimated investment</p>
                            <p className="mt-2 font-display text-3xl">
                                {formatBudgetLabel(dashboard?.starter_plan.estimated_investment ?? 0)}
                            </p>
                            <p className="mt-2 text-sm text-white/70">
                                Cash buffer {formatBudgetLabel(dashboard?.starter_plan.cash_buffer ?? 0)}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="grid gap-4 md:grid-cols-3">
                            {(dashboard?.starter_plan.allocations ?? []).map((allocation) => (
                                <article key={allocation.ticker_code} className="rounded-[28px] bg-white/8 p-5">
                                    <p className="text-xs uppercase tracking-[0.18em] text-[#f4b942]">{allocation.role}</p>
                                    <h3 className="mt-3 text-2xl font-semibold">{allocation.ticker_name}</h3>
                                    <p className="mt-1 text-sm text-white/65">
                                        {allocation.ticker_code} | {allocation.sector ?? 'No sector'}
                                    </p>
                                    <div className="mt-5 grid gap-3">
                                        <div>
                                            <p className="text-xs text-white/55">Weight</p>
                                            <p className="mt-1 text-lg font-semibold">{allocation.weight}%</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-white/55">Target amount</p>
                                            <p className="mt-1 text-lg font-semibold">{formatBudgetLabel(allocation.target_amount)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-white/55">Estimated shares</p>
                                            <p className="mt-1 text-lg font-semibold">{allocation.estimated_shares}</p>
                                        </div>
                                    </div>
                                    <p className="mt-4 text-sm leading-6 text-white/82">{allocation.note}</p>
                                </article>
                            ))}
                        </div>

                        <div className="space-y-4 rounded-[28px] bg-white/8 p-5">
                            <div>
                                <p className="text-sm text-white/60">Why this basket helps beginners</p>
                                <p className="mt-3 text-sm leading-7 text-white/85">
                                    It spreads your first month across a few roles so you are not forced to learn everything from one stock.
                                </p>
                            </div>
                            <div className="space-y-3">
                                {(dashboard?.starter_plan.tips ?? []).map((tip) => (
                                    <div key={tip} className="rounded-2xl bg-white/6 px-4 py-3 text-sm leading-6 text-white/84">
                                        {tip}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-10 grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
                    <div className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(39,61,51,0.12)] backdrop-blur">
                        <div className="mb-6 flex items-end justify-between gap-4">
                            <div>
                                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Top picks</p>
                                <h2 className="mt-2 font-display text-3xl">Personalized shortlist</h2>
                            </div>
                            <p className="text-sm text-slate-500">As of {dashboard?.as_of ?? '-'}</p>
                        </div>

                        <div className="space-y-4">
                            {loading && (
                                <div className="rounded-3xl bg-slate-100 px-5 py-8 text-center text-slate-500">
                                    Updating the beginner shortlist for your profile.
                                </div>
                            )}

                            {(dashboard?.recommendations ?? []).map((item, index) => {
                                const active = selectedTicker === item.ticker_code;
                                return (
                                    <button
                                        key={item.ticker_code}
                                        type="button"
                                        onClick={() => handleTickerClick(item.ticker_code)}
                                        className={`w-full rounded-[28px] border p-5 text-left transition ${
                                            active
                                                ? 'border-[#173f35] bg-[#173f35] text-white shadow-[0_20px_60px_rgba(23,63,53,0.28)]'
                                                : 'border-slate-200 bg-[#f9f6ef] text-slate-900 hover:border-[#cfd8d2] hover:bg-white'
                                        }`}
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                                                            active ? 'bg-white/15 text-white' : 'bg-[#173f35] text-white'
                                                        }`}
                                                    >
                                                        {index + 1}
                                                    </span>
                                                    <div>
                                                        <p className="text-xl font-semibold">{item.ticker_name}</p>
                                                        <p className={`text-sm ${active ? 'text-white/70' : 'text-slate-500'}`}>
                                                            {item.ticker_code} | {item.market}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                                                    <span className={`rounded-full px-3 py-1 ${active ? 'bg-white/12 text-white' : 'bg-white text-slate-700'}`}>
                                                        {item.badge}
                                                    </span>
                                                    <span className={`rounded-full px-3 py-1 ${active ? 'bg-[#f4b942] text-slate-900' : 'bg-[#f4b942]/20 text-[#7b5410]'}`}>
                                                        Risk {item.risk_level}
                                                    </span>
                                                    {watchlist.includes(item.ticker_code) && (
                                                        <span className={`rounded-full px-3 py-1 ${active ? 'bg-white/18 text-white' : 'bg-[#173f35]/12 text-[#173f35]'}`}>
                                                            Saved
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <p className={`text-sm ${active ? 'text-white/70' : 'text-slate-500'}`}>Score</p>
                                                <p className="font-display text-4xl">{item.score}</p>
                                                <p className={`mt-2 text-sm ${item.price_change_20d >= 0 ? 'text-emerald-300' : active ? 'text-rose-200' : 'text-rose-500'}`}>
                                                    20-day move {formatPercent(item.price_change_20d)}
                                                </p>
                                            </div>
                                        </div>

                                        <p className={`mt-4 text-sm leading-6 ${active ? 'text-white/82' : 'text-slate-600'}`}>
                                            {item.fit_for}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-8">
                        <section className="rounded-[32px] border border-white/70 bg-white/82 p-6 shadow-[0_24px_80px_rgba(39,61,51,0.12)] backdrop-blur">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Detail board</p>
                                    <h2 className="mt-2 font-display text-3xl">
                                        {selectedRecommendation?.ticker_name ?? 'Select a stock'}
                                    </h2>
                                    <p className="mt-2 text-sm text-slate-500">
                                        {selectedRecommendation?.sector ?? 'No sector data'} | {selectedRecommendation?.ticker_code ?? '-'}
                                    </p>
                                </div>
                                {selectedRecommendation && (
                                    <div className="flex flex-wrap items-center justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleWatchlist(selectedRecommendation.ticker_code)}
                                            className={`rounded-full px-4 py-3 text-sm font-medium transition ${
                                                watchlist.includes(selectedRecommendation.ticker_code)
                                                    ? 'bg-[#173f35] text-white'
                                                    : 'border border-slate-200 bg-white text-slate-700'
                                            }`}
                                        >
                                            {watchlist.includes(selectedRecommendation.ticker_code) ? 'Saved to watchlist' : 'Save to watchlist'}
                                        </button>
                                        <div className="rounded-3xl bg-[#f5f0e4] px-4 py-3 text-right">
                                            <p className="text-xs text-slate-500">Current price</p>
                                            <p className="font-display text-3xl">{formatPrice(selectedRecommendation.current_price)} KRW</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 grid gap-4 md:grid-cols-3">
                                <div className="rounded-3xl bg-[#f7f9f5] p-4">
                                    <p className="text-sm text-slate-500">Who it fits</p>
                                    <p className="mt-2 text-lg font-semibold">{selectedRecommendation?.fit_for ?? '-'}</p>
                                </div>
                                <div className="rounded-3xl bg-[#f7f9f5] p-4">
                                    <p className="text-sm text-slate-500">Volatility</p>
                                    <p className="mt-2 text-lg font-semibold">
                                        {selectedRecommendation ? `${selectedRecommendation.volatility.toFixed(1)}%` : '-'}
                                    </p>
                                </div>
                                <div className="rounded-3xl bg-[#f7f9f5] p-4">
                                    <p className="text-sm text-slate-500">20-day move</p>
                                    <p className="mt-2 text-lg font-semibold">
                                        {selectedRecommendation ? formatPercent(selectedRecommendation.price_change_20d) : '-'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 rounded-[28px] bg-white p-4 shadow-inner">
                                {chartLoading ? (
                                    <div className="flex h-[420px] items-center justify-center text-slate-500">
                                        Loading chart data.
                                    </div>
                                ) : chartData.length > 0 ? (
                                    <StockChart
                                        data={chartData}
                                        colors={{
                                            backgroundColor: '#ffffff',
                                            textColor: '#425466',
                                        }}
                                    />
                                ) : (
                                    <div className="flex h-[420px] items-center justify-center text-slate-500">
                                        No chart data available for this stock.
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="rounded-[32px] bg-[#1c4b73] p-6 text-white shadow-[0_24px_80px_rgba(28,75,115,0.24)]">
                            <p className="text-sm uppercase tracking-[0.24em] text-white/65">Why this stock</p>
                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <div className="rounded-3xl bg-white/8 p-5">
                                    <p className="text-sm text-white/65">Profile match</p>
                                    <p className="mt-3 text-sm leading-7 text-white/88">
                                        {selectedRecommendation?.profile_match ?? 'Choose a stock to see why it fits your profile.'}
                                    </p>
                                </div>
                                <div className="rounded-3xl bg-white/8 p-5">
                                    <p className="text-sm text-white/65">Beginner note</p>
                                    <p className="mt-3 text-sm leading-7 text-white/88">
                                        {selectedRecommendation?.beginner_note ?? 'Choose a stock to read the beginner note.'}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 rounded-3xl bg-white/8 p-5">
                                <p className="text-sm text-white/65">Action guide</p>
                                <p className="mt-3 text-sm leading-7 text-white/88">
                                    {selectedRecommendation?.action_guide ?? 'Choose a stock to see a simple next-step suggestion.'}
                                </p>
                            </div>
                            <div className="mt-4 rounded-3xl bg-white/8 p-5">
                                <p className="text-sm text-white/65">Financial snapshot</p>
                                <p className="mt-3 text-sm leading-7 text-white/88">
                                    {selectedRecommendation?.financial_snapshot.summary ??
                                        'Choose a stock to see how financial statement coverage looks.'}
                                </p>
                                {selectedRecommendation?.financial_snapshot.source && (
                                    <div className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-2 text-xs text-white/78">
                                        {selectedRecommendation.financial_snapshot.is_demo ? 'demo financial seed' : selectedRecommendation.financial_snapshot.source}
                                    </div>
                                )}
                                {selectedRecommendation?.financial_snapshot.year && (
                                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                                        <div className="rounded-2xl bg-white/6 px-4 py-3">
                                            <p className="text-xs text-white/55">Revenue</p>
                                            <p className="mt-1 text-sm font-semibold">
                                                {formatPrice(selectedRecommendation.financial_snapshot.revenue ?? 0)}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-white/6 px-4 py-3">
                                            <p className="text-xs text-white/55">Operating income</p>
                                            <p className="mt-1 text-sm font-semibold">
                                                {formatPrice(selectedRecommendation.financial_snapshot.operating_income ?? 0)}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-white/6 px-4 py-3">
                                            <p className="text-xs text-white/55">Net income</p>
                                            <p className="mt-1 text-sm font-semibold">
                                                {formatPrice(selectedRecommendation.financial_snapshot.net_income ?? 0)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="mt-5 rounded-3xl bg-white/8 p-5">
                                <p className="text-sm text-white/65">Recommendation reasons</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(selectedRecommendation?.reasons ?? []).map((reason) => (
                                        <span key={reason} className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/92">
                                            {reason}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                </section>
            </section>
        </main>
    );
}
