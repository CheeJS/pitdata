
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Trophy, Calendar, Zap, Timer, ChevronRight, Activity, TrendingUp, AlertTriangle, Calculator, Map, Info, Dna, RefreshCw, Clock, Play, BarChart3, Brain } from 'lucide-react';
import { cn } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, ComposedChart, Area, BarChart, Bar, Cell } from 'recharts';

// ============================================================
// MAIN SIMULATIONS PAGE
// ============================================================

export default function Simulations() {
    const [activeTab, setActiveTab] = useState('simulator');
    const [races, setRaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const year = 2026; // Hardcoded to 2026 as requested

    useEffect(() => {
        const fetchData = async () => {
            try {
                const racesRes = await axios.get(`http://localhost:5000/api/races?year=${year}`);
                setRaces(racesRes.data);
            } catch (e) {
                console.error("Sim Error", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [year]);

    if (loading) return <div className="p-8 text-white animate-pulse">Loading...</div>;

    return (
        <div className="h-full flex flex-col overflow-hidden">

            {/* ===== MOBILE LAYOUT ===== */}
            <div className="md:hidden flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                {/* Header */}
                <div className="p-4 space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                        <h1 className="text-lg font-bold text-white">Simulations {year}</h1>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-[#111] p-1 rounded-lg border border-[#222]">
                        <button onClick={() => setActiveTab('simulator')}
                            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all",
                                activeTab === 'simulator' ? "bg-f1-red text-white" : "text-gray-500")}>
                            <BarChart3 size={14} /> Race Sim
                        </button>
                        <button onClick={() => setActiveTab('strategy')}
                            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all",
                                activeTab === 'strategy' ? "bg-f1-red text-white" : "text-gray-500")}>
                            <Activity size={14} /> Strategy
                        </button>
                        <button onClick={() => setActiveTab('ai')}
                            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all",
                                activeTab === 'ai' ? "bg-f1-red text-white" : "text-gray-500")}>
                            <Brain size={14} /> AI
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 pb-20">
                    {activeTab === 'simulator' && <RaceSimulator races={races} year={year} />}
                    {activeTab === 'strategy' && <StrategyView races={races} />}
                    {activeTab === 'ai' && <AIPredictions races={races} year={year} />}
                </div>
            </div>

            {/* ===== DESKTOP LAYOUT ===== */}
            <div className="hidden md:flex flex-col flex-1 p-6 space-y-6 overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-end border-b border-[#222] pb-6 shrink-0">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">Simulation Hub</h1>
                            <span className="bg-[#111] text-gray-400 border border-[#222] px-3 py-1 text-xs font-medium rounded-md">
                                {year} SEASON
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm mt-1">Race predictions, pit strategy analysis, and AI-powered forecasting</p>
                    </div>

                    <div className="flex bg-[#0B0B0F] p-1.5 rounded-xl border border-[#2A2A30]">
                        <button onClick={() => setActiveTab('simulator')}
                            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'simulator' ? "bg-[#15151E] text-white border border-[#2A2A30]" : "text-gray-500 hover:text-white")}>
                            <BarChart3 size={16} /> Monte Carlo
                        </button>
                        <button onClick={() => setActiveTab('strategy')}
                            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'strategy' ? "bg-[#15151E] text-white border border-[#2A2A30]" : "text-gray-500 hover:text-white")}>
                            <Activity size={16} /> Pit Strategy
                        </button>
                        <button onClick={() => setActiveTab('ai')}
                            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'ai' ? "bg-[#15151E] text-white border border-[#2A2A30]" : "text-gray-500 hover:text-white")}>
                            <Brain size={16} /> AI Predictions
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'simulator' && <RaceSimulator races={races} year={year} />}
                    {activeTab === 'strategy' && <StrategyView races={races} />}
                    {activeTab === 'ai' && <AIPredictions races={races} year={year} />}
                </div>
            </div>
        </div>
    );
}


// ============================================================
// CHAMPIONSHIP CALCULATOR
// ============================================================
function ChampionshipCalculator() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('http://localhost:5000/api/simulations/championship?year=2025')
            .then(res => setData(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin text-f1-red" size={32} /></div>;
    if (!data) return <div className="flex-1 flex items-center justify-center text-gray-500">Failed to load data</div>;

    const teamColors = { "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#E8002D", "McLaren": "#FF8000", "Aston Martin": "#229971", "Alpine": "#FF87BC", "Williams": "#64C4FF", "RB": "#6692FF", "Audi": "#808080", "Haas": "#B6BABD" };

    return (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
            {/* LEFT: NEXT RACE COUNTDOWN + SCENARIOS */}
            <div className="lg:w-1/3 flex flex-col gap-4 shrink-0">
                {/* NEXT RACE CARD */}
                {data.next_race && (
                    <div className="bg-gradient-to-br from-f1-red/20 to-[#15151E] border border-f1-red/30 rounded-2xl p-6">
                        <div className="text-xs font-bold uppercase text-f1-red mb-2 flex items-center gap-2">
                            <Clock size={14} /> Next Race
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">{data.next_race.name}</h2>
                        <p className="text-gray-400 text-sm">{data.next_race.laps} Laps</p>
                        <CountdownTimer targetDate={data.next_race.date} />
                    </div>
                )}

                {/* SCENARIOS TICKER */}
                <div className="bg-[#15151E] border border-[#2A2A30] rounded-2xl p-4 flex-1 overflow-y-auto custom-scrollbar">
                    <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 flex items-center gap-2">
                        <Zap size={12} /> Championship Scenarios
                    </h3>
                    <div className="space-y-3">
                        {data.scenarios.length > 0 ? data.scenarios.map((s, i) => (
                            <div key={i} className="bg-[#0B0B0F] p-3 rounded-lg border border-[#2A2A30] text-sm text-gray-300">
                                {s}
                            </div>
                        )) : (
                            <div className="text-gray-500 text-sm">No dramatic scenarios yet.</div>
                        )}
                        <div className="bg-[#0B0B0F] p-3 rounded-lg border border-[#2A2A30] text-sm">
                            <span className="text-gray-500">Races remaining: </span>
                            <span className="text-white font-bold">{data.remaining_races}</span>
                            <span className="text-gray-500 ml-2">({data.max_points_available} pts available)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT: STANDINGS TABLE */}
            <div className="flex-1 bg-[#15151E] rounded-2xl border border-[#2A2A30] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[#2A2A30] bg-black/20 flex justify-between items-center shrink-0">
                    <h3 className="text-sm font-bold uppercase text-gray-400 flex items-center gap-2">
                        <Calculator size={14} /> Who Can Still Win?
                    </h3>
                    <div className="text-xs text-f1-red font-bold">LIVE STANDINGS</div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                    {data.standings.map((d, i) => {
                        const color = teamColors[Object.keys(teamColors).find(k => d.team?.includes(k))] || "#888";
                        return (
                            <motion.div
                                key={d.code}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-[#0B0B0F] p-4 rounded-xl border border-[#2A2A30] flex items-center gap-4"
                            >
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: color + "30", color: color }}>
                                    {i + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white">{d.name}</span>
                                        <span className="text-xs text-gray-500">{d.code}</span>
                                    </div>
                                    <div className="text-xs text-gray-400">{d.points} pts</div>
                                </div>
                                <div className="text-right">
                                    {d.can_win ? (
                                        <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded text-xs font-bold uppercase flex items-center gap-1">
                                            <Trophy size={12} /> Can Win
                                        </div>
                                    ) : (
                                        <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded text-xs font-bold uppercase">
                                            Eliminated
                                        </div>
                                    )}
                                </div>
                                {d.gap > 0 && (
                                    <div className="text-xs text-gray-500 w-20 text-right">
                                        -{d.gap} pts
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Countdown Timer Component
function CountdownTimer({ targetDate }) {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const target = new Date(targetDate);
            const diff = target - now;

            if (diff <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                return;
            }

            setTimeLeft({
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((diff / (1000 * 60)) % 60),
                seconds: Math.floor((diff / 1000) % 60)
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    return (
        <div className="flex gap-3 mt-4">
            {[
                { value: timeLeft.days, label: 'Days' },
                { value: timeLeft.hours, label: 'Hrs' },
                { value: timeLeft.minutes, label: 'Min' },
                { value: timeLeft.seconds, label: 'Sec' }
            ].map((item) => (
                <div key={item.label} className="bg-black/40 px-3 py-2 rounded-lg text-center min-w-[50px]">
                    <div className="text-xl font-mono font-bold text-white">{String(item.value).padStart(2, '0')}</div>
                    <div className="text-[9px] uppercase text-gray-500 font-bold">{item.label}</div>
                </div>
            ))}
        </div>
    );
}


// ============================================================
// RACE SIMULATOR (Monte Carlo)
// ============================================================
function RaceSimulator({ races, year }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [chaos, setChaos] = useState(1.0);
    const [numSims, setNumSims] = useState(1000);
    const [selectedRace, setSelectedRace] = useState(races[0]?.code || 'AUS');
    const [lastRun, setLastRun] = useState(null);

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('f1_last_simulation');
        if (saved) {
            try {
                setLastRun(JSON.parse(saved));
            } catch (e) { }
        }
    }, []);

    const runSimulation = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/simulations/race-monte-carlo?race=${selectedRace}&sims=${numSims}&chaos=${chaos}&year=${year}`);
            setData(res.data);
            // Save to localStorage
            localStorage.setItem('f1_last_simulation', JSON.stringify({
                race: selectedRace,
                top3: res.data.results.slice(0, 3).map(r => `${r.code} ${r.win_probability}%`),
                timestamp: new Date().toISOString()
            }));
            setLastRun(null); // Clear "last run" banner after new run
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const teamColors = { "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#E8002D", "McLaren": "#FF8000", "Aston Martin": "#229971", "Alpine": "#FF87BC", "Williams": "#64C4FF", "RB": "#6692FF", "Sauber": "#52E252", "Haas": "#B6BABD" };

    return (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
            {/* LEFT: CONTROLS */}
            <div className="lg:w-1/3 flex flex-col gap-4 shrink-0">
                {/* LAST RUN BANNER */}
                {lastRun && !data && (
                    <div className="bg-[#15151E] border border-[#2A2A30] rounded-2xl p-4">
                        <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Your Last Simulation</h4>
                        <div className="text-sm text-gray-300">{lastRun.race}: {lastRun.top3.join(', ')}</div>
                        <div className="text-[10px] text-gray-500 mt-1">{new Date(lastRun.timestamp).toLocaleString()}</div>
                    </div>
                )}


                {/* METHODOLOGY INFO */}
                <div className="bg-[#15151E] border border-[#2A2A30] rounded-2xl p-5">
                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-3 flex items-center gap-2">
                        <BarChart3 size={12} /> Monte Carlo Simulation
                    </h4>
                    <div className="space-y-3 text-xs text-gray-400">
                        <p>
                            We run <span className="text-white font-semibold">{numSims.toLocaleString()} virtual races</span> with randomized variables to calculate win probability distributions.
                        </p>
                        <div className="bg-black/30 rounded-lg p-3 space-y-2">
                            <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">Data Sources</div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span>2020-2025 Race Results (120+ races)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                <span>2026 Driver Lineup (HAM/Ferrari, etc.)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Circuit-Specific Performance History</span>
                            </div>
                        </div>
                        <div className="bg-black/30 rounded-lg p-3">
                            <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">Factors Considered</div>
                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                                <span>Driver Strength</span>
                                <span>DNF Probability</span>
                                <span>Team Reliability</span>
                                <span>Chaos Factor</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CONFIG PANEL */}
                <div className="bg-[#15151E] border border-[#2A2A30] rounded-2xl p-6 space-y-6">
                    <div>
                        <label className="text-xs font-bold uppercase text-gray-500 block mb-2">Select Race</label>
                        <select
                            value={selectedRace}
                            onChange={(e) => setSelectedRace(e.target.value)}
                            className="w-full bg-[#0B0B0F] text-white text-sm font-bold border border-[#2A2A30] rounded-lg px-4 py-2 outline-none focus:border-f1-red"
                        >
                            {races.map(r => (
                                <option key={r.id} value={r.code}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs font-bold uppercase text-gray-500 mb-2">
                            <span>Chaos Factor</span>
                            <span className="text-f1-red">{chaos}x</span>
                        </div>
                        <input
                            type="range" min="0.5" max="3.0" step="0.1"
                            value={chaos} onChange={e => setChaos(parseFloat(e.target.value))}
                            className="w-full h-2 bg-[#2A2A30] rounded-full accent-f1-red appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                            <span>Predictable</span>
                            <span>Chaotic</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-gray-500 block mb-2">Simulations</label>
                        <div className="flex gap-2">
                            {[100, 500, 1000, 5000].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setNumSims(n)}
                                    className={cn("flex-1 py-2 rounded text-xs font-bold uppercase transition-all", numSims === n ? "bg-f1-red text-white" : "bg-[#0B0B0F] text-gray-500 border border-[#2A2A30] hover:text-white")}
                                >
                                    {n >= 1000 ? `${n / 1000}K` : n}
                                </button>
                            ))}
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={runSimulation}
                        disabled={loading}
                        className="w-full bg-f1-red text-white py-4 rounded-xl font-bold uppercase flex items-center justify-center gap-2 shadow-lg shadow-f1-red/20 disabled:opacity-50"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} />}
                        {loading ? "Simulating..." : "Run Simulation"}
                    </motion.button>
                </div>
            </div>

            {/* RIGHT: RESULTS */}
            <div className="flex-1 bg-[#15151E] rounded-2xl border border-[#2A2A30] flex flex-col overflow-hidden">
                {!data ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <BarChart3 size={64} className="opacity-20 mb-4" />
                        <div className="text-sm">Run a simulation to see results</div>
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b border-[#2A2A30] bg-black/20 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-sm font-bold uppercase text-gray-400">2026 Win Probability</h3>
                                <div className="text-[10px] text-gray-600">Based on 2023-2025 data (122 races)</div>
                            </div>
                            <div className="text-xs text-gray-500">{data.simulations.toLocaleString()} sims • {data.avg_dnf_rate || data.dnf_rate}% DNF</div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                            {data.results.map((d, i) => {
                                const color = teamColors[Object.keys(teamColors).find(k => d.team?.includes(k))] || "#888";
                                return (
                                    <motion.div
                                        key={d.code}
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: "100%" }}
                                        transition={{ delay: i * 0.05 }}
                                        className="bg-[#0B0B0F] p-4 rounded-xl border border-[#2A2A30] flex items-center gap-4 relative overflow-hidden"
                                    >
                                        {/* Background bar */}
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${d.win_probability}%` }}
                                            transition={{ delay: i * 0.05 + 0.2, duration: 0.5 }}
                                            className="absolute left-0 top-0 bottom-0 opacity-15"
                                            style={{ backgroundColor: color }}
                                        />
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10" style={{ backgroundColor: color + "30", color: color }}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 z-10">
                                            <div className="font-bold text-white flex items-center gap-2">
                                                {d.name}
                                                {d.wins_2025 > 0 && (
                                                    <span className="bg-yellow-500/20 text-yellow-500 text-[9px] px-1.5 py-0.5 rounded font-bold" title="2025 Season Wins">
                                                        {d.wins_2025}W '25
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-400 flex items-center gap-2">
                                                {d.team}
                                                <span className="text-[9px] text-gray-500">• {d.reliability}% reliable</span>
                                            </div>
                                        </div>
                                        <div className="text-right z-10">
                                            <div className="text-2xl font-mono font-bold text-white">{d.win_probability}%</div>
                                            <div className="text-[10px] text-gray-500">Podium: {d.podium_probability}%</div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}


// ============================================================
// STRATEGY VIEW (Cleaned - No Weather)
// ============================================================
function StrategyView({ races }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showScenario, setShowScenario] = useState(false); // mobile toggle

    // Context State
    const [selectedRace, setSelectedRace] = useState(races && races.length > 0 ? (races.find(r => r.code === 'ABU') || races[races.length - 1]) : null);
    const [gridPos, setGridPos] = useState(5);
    const [objective, setObjective] = useState('Minimise Time');

    // Scenarios
    const [traffic, setTraffic] = useState(false);
    const [degMult, setDegMult] = useState(1.0);
    const [scLaps, setScLaps] = useState([]);
    const [newScLap, setNewScLap] = useState("");

    // Load Data
    useEffect(() => {
        if (!selectedRace) return;
        setLoading(true);
        const params = new URLSearchParams();
        params.append('race_id', selectedRace.code);
        params.append('laps', selectedRace.laps);
        params.append('traffic', traffic);
        params.append('deg', degMult);
        params.append('sc_laps', scLaps.join(','));
        params.append('grid_pos', gridPos);
        params.append('objective', objective);

        axios.get(`http://localhost:5000/api/simulations/strategy?${params.toString()}`)
            .then(res => setData(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [selectedRace, traffic, degMult, scLaps, gridPos, objective]);

    const addSafetyCar = () => {
        const lap = parseInt(newScLap);
        if (lap > 0 && selectedRace && lap <= selectedRace.laps && !scLaps.includes(lap)) {
            setScLaps([...scLaps, lap].sort((a, b) => a - b));
            setNewScLap("");
        }
    };

    const removeSafetyCar = (lap) => {
        setScLaps(scLaps.filter(l => l !== lap));
    };

    if (loading) return (
        <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Activity className="animate-pulse text-f1-red" size={32} />
                <div className="text-xs font-bold uppercase tracking-widest text-f1-red">Calculating Strategy...</div>
            </div>
        </div>
    );

    if (!data) return <div className="p-8 text-center text-gray-500">Strategy Engine Offline</div>;

    // Transform Data
    const laps = data.strategies[0].lap_data.map(l => l.lap);
    const chartData = laps.map(lapNum => {
        const point = { name: lapNum };
        data.strategies.forEach(strat => {
            const lapInfo = strat.lap_data.find(l => l.lap === lapNum);
            if (lapInfo && lapInfo.pit_stop) point[strat.name] = null;
            else point[strat.name] = lapInfo ? lapInfo.time : null;
        });
        return point;
    });

    const verdict = data.verdict;

    return (
        <div className="flex-1 bg-[#111] md:bg-[#15151E] rounded-xl md:rounded-3xl border border-[#222] md:border-[#2A2A30] flex flex-col overflow-hidden relative">
            {/* RACE CONTEXT BAR */}
            <div className="bg-[#0B0B0F] border-b border-[#222] p-3 md:p-4 shrink-0">
                {/* Mobile: Stacked layout */}
                <div className="md:hidden space-y-3">
                    <div className="flex items-center justify-between">
                        <select
                            value={selectedRace?.id || ''}
                            onChange={(e) => setSelectedRace(races.find(r => r.id === parseInt(e.target.value)))}
                            className="bg-[#111] text-white text-sm font-medium border border-[#222] rounded-lg px-3 py-2 flex-1"
                        >
                            {races && races.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={gridPos}
                            onChange={(e) => setGridPos(parseInt(e.target.value))}
                            className="bg-[#111] text-white text-sm border border-[#222] rounded-lg px-3 py-2 flex-1"
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(p => (
                                <option key={p} value={p}>P{p}</option>
                            ))}
                        </select>
                        <select
                            value={objective}
                            onChange={(e) => setObjective(e.target.value)}
                            className="bg-[#111] text-white text-sm border border-[#222] rounded-lg px-3 py-2 flex-1"
                        >
                            <option>Minimise Time</option>
                            <option>Track Position</option>
                        </select>
                    </div>
                </div>

                {/* Desktop: Original layout */}
                <div className="hidden md:flex flex-row items-center justify-between gap-3 overflow-x-auto">
                    <div className="flex flex-wrap items-center gap-3 md:gap-6">
                        {/* Race Selector */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Race Event</label>
                            <select
                                value={selectedRace?.id || ''}
                                onChange={(e) => setSelectedRace(races.find(r => r.id === parseInt(e.target.value)))}
                                className="bg-[#15151E] text-white text-sm font-bold border border-[#2A2A30] rounded px-3 py-1 outline-none focus:border-f1-red"
                            >
                                {races && races.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.laps} Laps)</option>
                                ))}
                            </select>
                        </div>

                        {/* Grid Pos */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Start Pos</label>
                            <select
                                value={gridPos}
                                onChange={(e) => setGridPos(parseInt(e.target.value))}
                                className="bg-[#15151E] text-white text-sm font-bold border border-[#2A2A30] rounded px-3 py-1 outline-none"
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(p => (
                                    <option key={p} value={p}>P{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Objective */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Strategy Goal</label>
                        <select
                            value={objective}
                            onChange={(e) => setObjective(e.target.value)}
                            className="bg-[#15151E] text-white text-sm font-bold border border-[#2A2A30] rounded px-3 py-1 outline-none text-right"
                        >
                            <option>Minimise Time</option>
                            <option>Track Position</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="p-4 md:p-6 flex flex-col flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-20 md:pb-6">
                {/* ONE-LINE DEFINITION */}
                <div className="mb-4 flex items-baseline gap-2">
                    <span className="text-gray-400 text-sm">Simulating</span>
                    <strong className="text-white text-lg">{selectedRace?.name} ({selectedRace?.laps} laps)</strong>
                    <span className="text-gray-400 text-sm">starting</span>
                    <strong className="text-white text-lg">P{gridPos}</strong>
                </div>

                {/* METHODOLOGY PANEL */}
                <div className="bg-[#0B0B0F] border border-[#2A2A30] rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-1">
                            <h4 className="text-xs font-bold uppercase text-gray-400 mb-2 flex items-center gap-2">
                                <Activity size={12} /> How Strategy is Calculated
                            </h4>
                            <p className="text-xs text-gray-400 leading-relaxed mb-3">
                                We compare <span className="text-white">1-stop, 2-stop, and aggressive strategies</span> by modeling tire degradation curves and pit stop time losses for each compound.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                                <div className="bg-black/40 rounded p-2">
                                    <div className="text-gray-500 uppercase mb-0.5">Pit Loss</div>
                                    <div className="text-white font-bold">~22s</div>
                                </div>
                                <div className="bg-black/40 rounded p-2">
                                    <div className="text-gray-500 uppercase mb-0.5">Tire Compounds</div>
                                    <div className="flex gap-1">
                                        <span className="w-3 h-3 rounded-full bg-red-500" title="Soft" />
                                        <span className="w-3 h-3 rounded-full bg-yellow-500" title="Medium" />
                                        <span className="w-3 h-3 rounded-full bg-white" title="Hard" />
                                    </div>
                                </div>
                                <div className="bg-black/40 rounded p-2">
                                    <div className="text-gray-500 uppercase mb-0.5">Deg Rate</div>
                                    <div className="text-white font-bold">{degMult}x</div>
                                </div>
                                <div className="bg-black/40 rounded p-2">
                                    <div className="text-gray-500 uppercase mb-0.5">Safety Cars</div>
                                    <div className="text-amber-400 font-bold">{scLaps.length} scheduled</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* INSIGHT + SCENARIO */}
                <div className="flex flex-col xl:flex-row gap-6 mb-6 shrink-0">
                    {/* INSIGHT PANEL */}
                    <div className="flex-[2] bg-gradient-to-r from-emerald-900/20 to-[#15151E] border border-emerald-500/30 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-xs font-bold uppercase text-emerald-500 mb-1 flex items-center gap-2">
                                    <Trophy size={12} /> Optimal Strategy
                                </div>
                                <h2 className="text-2xl font-bold text-white">{verdict.recommended}</h2>
                                <div className="flex items-center gap-4 mt-2">
                                    <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded">
                                        <Activity size={10} className="text-emerald-500" />
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Gain:</span>
                                        <span className="text-xs font-bold text-emerald-400">+{verdict.delta}s</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded">
                                        <div className={cn("w-2 h-2 rounded-full", verdict.risk === 'High' ? "bg-f1-red animate-pulse" : "bg-emerald-500")} />
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Risk:</span>
                                        <span className={cn("text-xs font-bold", verdict.risk === 'High' ? "text-f1-red" : "text-emerald-500")}>{verdict.risk}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-300 italic">" {verdict.reason} "</p>
                    </div>

                    {/* SCENARIO DECK */}
                    <div className="flex-1 bg-[#0B0B0F] p-4 rounded-xl border border-[#2A2A30] space-y-4 min-w-[240px]">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold uppercase text-gray-400 flex items-center gap-2">
                                <Calculator size={12} /> Scenario Lab
                            </h4>
                            <button onClick={() => { setDegMult(1.0); setScLaps([]); setTraffic(false); }} className="text-[9px] text-f1-red uppercase font-bold hover:underline">Reset</button>
                        </div>

                        {/* Traffic Toggle */}
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase font-bold text-gray-500">Traffic</span>
                            <button onClick={() => setTraffic(!traffic)} className={cn("flex-1 h-6 rounded relative", traffic ? "bg-f1-red/20" : "bg-[#2A2A30]")}>
                                <div className={cn("absolute top-0.5 bottom-0.5 w-[48%] rounded shadow-sm transition-all", traffic ? "right-0.5 bg-f1-red" : "left-0.5 bg-gray-500")} />
                            </button>
                        </div>

                        {/* Degradation Slider */}
                        <div>
                            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
                                <span>Degradation</span>
                                <span className={cn("font-mono", degMult > 1 ? "text-f1-red" : "text-white")}>{degMult}x</span>
                            </div>
                            <input
                                type="range" min="0.8" max="1.5" step="0.1"
                                value={degMult} onChange={(e) => setDegMult(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-[#2A2A30] rounded-full accent-f1-red"
                            />
                        </div>

                        {/* Safety Car */}
                        <div>
                            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
                                <span>Safety Cars</span>
                                <span className="text-amber-500">{scLaps.length} Active</span>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Lap"
                                    value={newScLap}
                                    onChange={(e) => setNewScLap(e.target.value)}
                                    className="flex-1 bg-[#15151E] border border-[#2A2A30] rounded px-2 py-1 text-xs text-white outline-none"
                                />
                                <button onClick={addSafetyCar} className="bg-amber-500/20 text-amber-500 px-3 py-1 rounded text-xs font-bold">Add SC</button>
                            </div>
                            {scLaps.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                    {scLaps.map(lap => (
                                        <button key={lap} onClick={() => removeSafetyCar(lap)} className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-xs">
                                            L{lap} ×
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* STRATEGY CARDS */}
                <div className="flex gap-4 mb-6 overflow-x-auto pb-2 shrink-0">
                    {data.strategies.map((strat, i) => (
                        <div key={strat.name} className={cn("min-w-[200px] p-4 rounded-xl border flex-shrink-0", strat.is_best ? "bg-emerald-500/10 border-emerald-500/30" : "bg-[#0B0B0F] border-[#2A2A30]")}>
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-white text-sm">{strat.name}</h4>
                                {strat.is_best && <span className="bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded font-bold">BEST</span>}
                            </div>
                            <div className="text-xs text-gray-400 mb-2">{strat.pit_stops.length} stop{strat.pit_stops.length !== 1 ? 's' : ''}</div>
                            <div className="text-lg font-mono font-bold text-white">
                                {strat.delta_to_best > 0 ? `+${strat.delta_to_best}s` : 'Fastest'}
                            </div>
                        </div>
                    ))}
                </div>

                {/* CHART */}
                <div className="h-[400px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A30" vertical={false} />
                            <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} label={{ value: 'Lap', position: 'bottom', fill: '#6b7280', fontSize: 10 }} />
                            <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} width={50} domain={['dataMin - 2', 'dataMax + 2']} label={{ value: 'Lap Time (s)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#15151E', border: '1px solid #2A2A30', borderRadius: '8px' }}
                                formatter={(value, name) => [value ? `${value.toFixed(1)}s` : 'Pit', name]}
                                labelFormatter={(label) => `Lap ${label}`}
                            />
                            {data.strategies.map((strat, i) => {
                                const colors = ["#22c55e", "#FF8000", "#E8002D", "#3671C6"];
                                return <Line key={strat.name} type="monotone" dataKey={strat.name} stroke={colors[i % colors.length]} strokeWidth={strat.is_best ? 3 : 2} dot={false} connectNulls={false} />;
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}


// ============================================================
// AI PREDICTIONS COMPONENT
// ============================================================
function AIPredictions({ races, year }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedRace, setSelectedRace] = useState(races[0]?.code || 'AUS');

    const fetchPrediction = async () => {
        setLoading(true);
        const startTime = performance.now();

        try {
            // Load pre-computed predictions from S3
            const cdnUrl = `https://pitdata-prediction.s3.ap-southeast-2.amazonaws.com/${year}/${selectedRace.toUpperCase()}.json`;
            const response = await fetch(cdnUrl);

            if (response.ok) {
                const data = await response.json();
                const elapsed = Math.round(performance.now() - startTime);
                console.log(`✓ Prediction loaded in ${elapsed}ms from CDN`);
                setData(data);
            } else {
                throw new Error(`Failed to load prediction: ${response.status}`);
            }
        } catch (error) {
            console.error('CDN error, trying API fallback:', error.message);

            // Fallback to API if CDN fails
            try {
                const res = await axios.get(`http://localhost:5000/api/predictions/ai?race=${selectedRace}&year=${year}`);
                const elapsed = Math.round(performance.now() - startTime);
                console.log(`⚙️ Prediction loaded in ${elapsed}ms from API`);
                setData(res.data);
            } catch (apiError) {
                console.error('Both sources failed:', apiError);
                setData({
                    error: "Failed to load predictions. Please try again.",
                    results: []
                });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedRace) fetchPrediction();
    }, [selectedRace, year]);

    const teamColors = { "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#E8002D", "McLaren": "#FF8000", "Aston Martin": "#229971", "Alpine": "#FF87BC", "Williams": "#64C4FF", "RB": "#6692FF", "Sauber": "#52E252", "Haas": "#B6BABD" };

    return (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
            {/* LEFT: Config */}
            <div className="lg:w-1/3 flex flex-col gap-4 shrink-0">
                <div className="bg-gradient-to-br from-purple-900/30 to-[#15151E] border border-purple-500/30 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Brain size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">AI Model</h2>
                            <p className="text-xs text-gray-400">The model thinks...</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 block mb-2">Select Race</label>
                            <select
                                value={selectedRace}
                                onChange={(e) => setSelectedRace(e.target.value)}
                                className="w-full bg-[#0B0B0F] text-white text-sm font-bold border border-[#2A2A30] rounded-lg px-4 py-2 outline-none focus:border-purple-500"
                            >
                                {races.map(r => (
                                    <option key={r.id} value={r.code}>{r.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* PRE-SEASON PREDICTION BANNER */}
                        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                    <Info size={16} className="text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-bold text-white">Pre-Season Prediction</h4>
                                        <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">
                                            Estimated Quali
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Based on 2025 performance data and team strengths. <span className="text-blue-400 font-semibold">Predictions will be updated with actual qualifying times</span> after Saturday sessions.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {data && (
                            <div className="bg-black/30 rounded-xl p-4 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">Model Type</span>
                                    <span className="text-purple-400 font-mono">{data.model_type}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">Prediction Year</span>
                                    <span className="text-white font-bold">{data.prediction_year}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">Data Confidence</span>
                                    <span className={cn("font-bold", data.model_confidence >= 70 ? "text-emerald-400" : data.model_confidence >= 40 ? "text-amber-400" : "text-red-400")}>
                                        {data.model_confidence}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* METHODOLOGY PANEL */}
                <div className="bg-[#15151E] border border-[#2A2A30] rounded-2xl p-4">
                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-3 flex items-center gap-2">
                        <Brain size={12} /> AI Model Methodology
                    </h4>

                    {/* Feature Weights */}
                    <div className="space-y-2 mb-4">
                        <div className="text-[10px] font-bold uppercase text-gray-500">Feature Weights</div>
                        <div className="space-y-1.5">
                            {[
                                { name: 'Qualifying Position', weight: 30, color: 'bg-purple-500' },
                                { name: 'Circuit History', weight: 25, color: 'bg-blue-500' },
                                { name: 'Recent Form (Last 5)', weight: 20, color: 'bg-emerald-500' },
                                { name: 'Team Strength', weight: 15, color: 'bg-amber-500' },
                                { name: 'Championship Pos', weight: 10, color: 'bg-gray-500' },
                            ].map(f => (
                                <div key={f.name} className="flex items-center gap-2 text-[11px]">
                                    <div className="w-16 text-gray-500">{f.weight}%</div>
                                    <div className="flex-1 h-1.5 bg-[#2A2A30] rounded-full overflow-hidden">
                                        <div className={`h-full ${f.color}`} style={{ width: `${f.weight}%` }} />
                                    </div>
                                    <div className="w-28 text-gray-400 text-right">{f.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Prediction Modes */}
                    <div className="bg-black/30 rounded-lg p-3">
                        <div className="text-[10px] font-bold uppercase text-gray-500 mb-2">Prediction Modes</div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                                <div className="font-bold text-blue-400 mb-0.5">Pre-Season</div>
                                <div className="text-gray-500">Estimated qualifying from team strength. ~65% accuracy.</div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
                                <div className="font-bold text-emerald-400 mb-0.5">Post-Qualifying</div>
                                <div className="text-gray-500">Uses actual Q3 times. ~85% accuracy.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT: Results */}
            <div className="flex-1 bg-[#15151E] rounded-2xl border border-[#2A2A30] flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Brain className="animate-pulse text-purple-500" size={48} />
                    </div>
                ) : !data ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <Brain size={64} className="opacity-20 mb-4" />
                        <div className="text-sm">Select a race to see AI predictions</div>
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b border-[#2A2A30] bg-black/20 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-sm font-bold uppercase text-purple-400 flex items-center gap-2">
                                    <Brain size={14} /> AI Win Probabilities
                                </h3>
                                <div className="text-[10px] text-gray-600">Based on circuit-specific historical data</div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                            {data.results.map((d, i) => {
                                const color = teamColors[Object.keys(teamColors).find(k => d.team?.includes(k))] || "#888";
                                return (
                                    <motion.div
                                        key={d.code}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="bg-[#0B0B0F]/80 p-3 rounded-xl border border-[#2A2A30] flex items-center gap-4 relative overflow-hidden group hover:border-[#3A3A45] transition-colors"
                                    >
                                        {/* Background Probability Bar */}
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${d.win_probability}%` }}
                                            transition={{ delay: i * 0.05 + 0.2, duration: 0.5 }}
                                            className="absolute left-0 top-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity"
                                            style={{ backgroundColor: color }}
                                        />

                                        {/* Rank & Driver Info */}
                                        <div className="flex items-center gap-3 w-[220px] z-10 shrink-0">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono"
                                                style={{ backgroundColor: color + "20", color: color, border: `1px solid ${color}40` }}>
                                                {i + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white text-sm flex items-center gap-2">
                                                    {d.name}
                                                    {d.code === 'VER' && <Trophy size={10} className="text-yellow-500" />}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-medium">{d.team}</div>
                                            </div>
                                        </div>

                                        {/* Key Stats */}
                                        <div className="flex-1 flex items-center gap-8 z-10">
                                            {/* Win Probability */}
                                            <div className="flex flex-col w-24">
                                                <span className="text-[9px] uppercase font-bold text-gray-500 mb-0.5">Win Prob</span>
                                                <div className="flex items-end gap-1">
                                                    <span className="text-lg font-bold text-white leading-none">{d.win_probability}%</span>
                                                    <div className="h-1.5 flex-1 bg-[#2A2A30] rounded-full overflow-hidden mb-1">
                                                        <div className="h-full rounded-full" style={{ width: `${d.win_probability}%`, backgroundColor: color }} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Podium Probability */}
                                            <div className="flex flex-col w-24">
                                                <span className="text-[9px] uppercase font-bold text-gray-500 mb-0.5">Podium</span>
                                                <div className="flex items-end gap-1">
                                                    <span className="text-sm font-bold text-gray-300 leading-none">{d.podium_probability}%</span>
                                                    <div className="h-1.5 flex-1 bg-[#2A2A30] rounded-full overflow-hidden mb-0.5">
                                                        <div className="h-full rounded-full bg-gray-500" style={{ width: `${d.podium_probability}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Feature Insights */}
                                        <div className="w-[180px] flex gap-3 z-10 border-l border-[#2A2A30] pl-4">
                                            {d.features && (
                                                <>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between text-[9px] mb-1">
                                                            <span className="text-gray-500">Circuit Avg</span>
                                                            <span className="text-white font-mono">{d.features.circuit_avg?.toFixed(1) || '-'}</span>
                                                        </div>
                                                        <div className="h-1 bg-[#2A2A30] rounded-full overflow-hidden">
                                                            {/* Inverse bar: lower is better (max 20) */}
                                                            <div className="h-full bg-blue-500/60" style={{ width: `${Math.max(0, 100 - (d.features.circuit_avg * 5))}%` }} />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between text-[9px] mb-1">
                                                            <span className="text-gray-500">Recent Form</span>
                                                            <span className="text-white font-mono">{d.features.recent_form?.toFixed(1) || '-'}</span>
                                                        </div>
                                                        <div className="h-1 bg-[#2A2A30] rounded-full overflow-hidden">
                                                            {/* Inverse bar: lower is better */}
                                                            <div className="h-full bg-purple-500/60" style={{ width: `${Math.max(0, 100 - (d.features.recent_form * 5))}%` }} />
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
