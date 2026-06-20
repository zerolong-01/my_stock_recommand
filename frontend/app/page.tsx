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

interface DashboardResponse {
    as_of: string;
    headline: string;
    subheadline: string;
    starter_steps: string[];
    summary_cards: SummaryCard[];
    active_profile: ActiveProfile;
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

    useEffect(() => {
        fetchDashboard(riskProfile, learningFocus);
    }, [riskProfile, learningFocus]);

    const fetchDashboard = (risk: RiskProfile, focus: LearningFocus) => {
        setLoading(true);

        fetch(`${API_BASE}/dashboard?risk_profile=${risk}&learning_focus=${focus}`)
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

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.28),_transparent_32%),linear-gradient(135deg,_#f6efe4_0%,_#e7f0ec_55%,_#d7e7f5_100%)] text-slate-900">
            <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
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
                    <div className="grid gap-6 lg:grid-cols-2">
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
                                                            {item.ticker_code} · {item.market}
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
                                        {selectedRecommendation?.sector ?? 'No sector data'} · {selectedRecommendation?.ticker_code ?? '-'}
                                    </p>
                                </div>
                                {selectedRecommendation && (
                                    <div className="rounded-3xl bg-[#f5f0e4] px-4 py-3 text-right">
                                        <p className="text-xs text-slate-500">Current price</p>
                                        <p className="font-display text-3xl">{formatPrice(selectedRecommendation.current_price)} KRW</p>
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
