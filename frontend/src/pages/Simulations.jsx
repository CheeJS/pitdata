
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Trophy, Calendar, Zap, Timer, ChevronRight, Activity, TrendingUp, AlertTriangle, Calculator, Map, Info, Dna, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, ComposedChart, Area } from 'recharts';

// Dynamic Data used instead of REMAINING_RACES

const POINTS_SYSTEM = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1, 'FL': 1, 'DNF': 0
};

export default function Simulations() {
    const [activeTab, setActiveTab] = useState('predictor');
    const [standings, setStandings] = useState(null);
    const [races, setRaces] = useState([]); // Dynamic Race List
    const [predictions, setPredictions] = useState({}); // { raceId: { driverCode: pos } }
    const [loading, setLoading] = useState(true);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [standingsRes, racesRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/standings?year=2025'),
                    axios.get('http://localhost:5000/api/races?year=2025')
                ]);

                setStandings(standingsRes.data);

                // Filter Future Races (Simplification: Just use all for now, or filter by date?)
                // User said "Simulations should be recent year". Logic:
                // Use the API list. If Standings "completed_rounds" tells usage, we can filter "Remaining".
                // But Simulations might want to simulate past races too?
                // Let's just store all races.
                setRaces(racesRes.data);
            } catch (e) {
                console.error("Sim Error", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Helper: Update Prediction
    const handlePredictionChange = (raceId, driverCode, value) => {
        setPredictions(prev => ({
            ...prev,
            [raceId]: {
                ...prev[raceId],
                [driverCode]: value
            }
        }));
    };

    // Calculation Engine
    const projectedData = useMemo(() => {
        if (!standings || races.length === 0) return null;

        // Base Setup: Top 5 Drivers
        const drivers = standings.drivers.slice(0, 5);
        const completedCount = standings.completed_rounds;

        // 1. Reconstruct Season So Far (Chart)
        // standings.races contains names of ALL races.
        // d.history contains cumulative points for ALL races.
        // We only want the "Actual" part for the chart up to completed.
        // Actually, d.history is full length. Let's map it all, then override future portion.

        let chartData = [];
        let currentPoints = {};
        drivers.forEach(d => currentPoints[d.code] = d.points); // Current total (including completed)

        // Wait, d.points IS the total current points.
        // But d.history tracks progression.

        // Let's iterate the RACES list (from API) which has proper objects
        // We assume races and standings.races are aligned in order (Date sorted).

        races.forEach((race, i) => {
            const isFuture = i >= completedCount;
            const pointSnapshot = {};

            if (!isFuture) {
                // Past/History
                drivers.forEach(d => {
                    pointSnapshot[d.code] = d.history[i] || 0;
                });
                chartData.push({
                    name: race.code,
                    ...pointSnapshot,
                    fullRace: race.name,
                    type: 'actual'
                });
            } else {
                // Future/Projected
                // Start from the last known points (from previous iteration or current total)
                // Actually easier: Calculate cumulative manually from "current total" base?
                // No, "Current Total" is at 'completedCount'.

                // We need to carry forward points.
                // Let's restart calculation:
                // For future races, we add prediction points to the PREVIOUS snapshot.
            }
        });

        // Simpler Logic:
        // 1. Slice History
        chartData = standings.races.slice(0, completedCount).map((rName, i) => {
            const snap = {};
            drivers.forEach(d => snap[d.code] = d.history[i]);
            // Find code from races list if possible, or substr
            const raceObj = races[i];
            return { name: raceObj ? raceObj.code : rName.substring(0, 3).toUpperCase(), ...snap, fullRace: rName, type: 'actual' };
        });

        // 2. Append Future
        // Initial points for projection = points at end of history
        let projectedPoints = {};
        drivers.forEach(d => projectedPoints[d.code] = d.history[completedCount - 1] || 0);

        const futureRaces = races.slice(completedCount);

        futureRaces.forEach(race => {
            const snap = {};
            drivers.forEach(d => {
                const predPos = predictions[race.id]?.[d.code];
                let pts = 0;
                if (predPos) pts = POINTS_SYSTEM[predPos] || 0;

                projectedPoints[d.code] += pts;
                snap[d.code] = projectedPoints[d.code];
            });

            chartData.push({
                name: race.code,
                ...snap,
                fullRace: race.name,
                type: 'projected'
            });
        });

        return { chartData, drivers, finalPoints: projectedPoints };
    }, [standings, predictions, races]);

    if (loading) return <div className="p-8 text-white animate-pulse">Loading Simulation Engine...</div>;

    return (
        <div className="p-6 space-y-6 h-screen flex flex-col overflow-hidden animate-in fade-in duration-500">
            {/* HEADER */}
            <div className="flex justify-between items-end border-b border-[#2A2A30] pb-6 shrink-0">
                <div>
                    <h1 className="text-3xl font-heading font-bold italic uppercase text-white tracking-tighter">Race Engineer AI</h1>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                        Advanced Simulation Hub <ChevronRight size={12} /> {activeTab}
                    </p>
                </div>

                {/* TABS */}
                <div className="flex bg-[#15151E] p-1 rounded-xl border border-[#2A2A30]">
                    <button onClick={() => setActiveTab('predictor')} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'predictor' ? "bg-f1-red text-white shadow-lg" : "text-gray-500 hover:text-white")}>
                        <Calculator size={16} /> Predictor
                    </button>
                    <button onClick={() => setActiveTab('monte-carlo')} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'monte-carlo' ? "bg-f1-red text-white shadow-lg" : "text-gray-500 hover:text-white")}>
                        <Dna size={16} /> Oracle
                    </button>
                    <button onClick={() => setActiveTab('strategy')} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'strategy' ? "bg-f1-red text-white shadow-lg" : "text-gray-500 hover:text-white")}>
                        <Activity size={16} /> Strategy
                    </button>
                    <button onClick={() => setActiveTab('crowd')} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'crowd' ? "bg-f1-red text-white shadow-lg" : "text-gray-500 hover:text-white")}>
                        <Zap size={16} /> Crowd
                    </button>
                </div>
            </div>

            {/* PREDICTOR VIEW */}
            {activeTab === 'predictor' && projectedData && (
                <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
                    {/* LEFT: INPUTS */}
                    <div className="flex-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-[#2A2A30] bg-black/20 flex justify-between items-center">
                            <h3 className="text-sm font-bold uppercase text-gray-400 flex items-center gap-2">
                                <Calculator size={14} /> Race Outcomes
                            </h3>
                            <button onClick={() => setPredictions({})} className="text-[10px] text-f1-red underline font-bold uppercase hover:text-white">Reset All</button>
                        </div>
                        <div className="overflow-auto custom-scrollbar flex-1 p-4">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-2 text-xs text-gray-500 font-bold sticky left-0 bg-[#15151E] z-10">Driver</th>
                                        {races.slice(standings.completed_rounds).map(r => (
                                            <th key={r.id} className="p-2 text-[10px] text-gray-400 font-bold text-center min-w-[70px] uppercase">{r.code}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectedData.drivers.map(d => {
                                        const teamColors = { "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#E8002D", "McLaren": "#FF8000", "Aston Martin": "#229971" };
                                        const color = teamColors[Object.keys(teamColors).find(k => d.team.includes(k))] || "#FFF";

                                        return (
                                            <tr key={d.code} className="border-b border-[#2A2A30]/50 hover:bg-white/5">
                                                <td className="p-3 sticky left-0 bg-[#15151E] z-10 border-r border-[#2A2A30]">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: color }} />
                                                        <span className="font-bold text-white text-sm">{d.code}</span>
                                                    </div>
                                                </td>
                                                {races.slice(standings.completed_rounds).map(r => (
                                                    <td key={r.id} className="p-1">
                                                        <select
                                                            className="w-full bg-[#0B0B0F] border border-[#2A2A30] text-white text-xs rounded p-1.5 focus:border-f1-red outline-none text-center font-bold"
                                                            value={predictions[r.id]?.[d.code] || ""}
                                                            onChange={(e) => handlePredictionChange(r.id, d.code, e.target.value)}
                                                        >
                                                            <option value="">-</option>
                                                            <option value="1">P1</option>
                                                            <option value="2">P2</option>
                                                            <option value="3">P3</option>
                                                            <option value="4">P4</option>
                                                            <option value="5">P5</option>
                                                            <option value="DNF">DNF</option>
                                                        </select>
                                                    </td>
                                                ))}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* RIGHT: CHART */}
                    <div className="flex-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] p-4 flex flex-col overflow-hidden h-full">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h3 className="text-sm font-bold uppercase text-gray-400 flex items-center gap-2"><TrendingUp size={14} /> Projected Battle</h3>
                            <div className="bg-f1-red/10 px-3 py-1 rounded text-f1-red text-xs font-bold uppercase border border-f1-red/20 animate-pulse">Live Projection</div>
                        </div>
                        <div className="h-[300px] w-full relative">
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={projectedData.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A30" vertical={false} />
                                        <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} width={30} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#15151E', border: '1px solid #2A2A30', borderRadius: '8px' }}
                                            labelStyle={{ color: '#9ca3af', fontSize: '10px' }}
                                            formatter={(v, name) => [v, name]}
                                        />
                                        {projectedData.drivers.map((d, i) => {
                                            const teamColors = { "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#E8002D", "McLaren": "#FF8000", "Aston Martin": "#229971" };
                                            const color = teamColors[Object.keys(teamColors).find(k => d.team.includes(k))] || `hsl(${i * 60}, 70 %, 50 %)`;

                                            return (
                                                <Line
                                                    key={d.code} type="monotone" dataKey={d.code} stroke={color} strokeWidth={3} dot={false}
                                                    activeDot={{ r: 4 }}
                                                    strokeDasharray={(rec) => rec.payload.type === 'projected' ? "4 4" : ""}
                                                    isAnimationActive={false}
                                                />
                                            )
                                        })}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* PLACEHOLDERS for other tabs */}
            {/* MONTE CARLO TAB */}
            {activeTab === 'monte-carlo' && (
                <MonteCarloView />
            )}

            {activeTab === 'strategy' && (
                <StrategyView races={races} />
            )}
        </div>
    );
}





function TrajectoryChart({ data }) {
    // Transform Data: { VER: [ {race, p10...} ] } -> [ {name: 'BHR', VER_p10: 10, VER_p50: 15...} ]
    const chartData = useMemo(() => {
        if (!data) return [];
        const drivers = Object.keys(data);
        if (drivers.length === 0) return [];

        const races = data[drivers[0]].map(r => r.race); // ['Curr', 'BHR', 'SAU'...]

        return races.map((rName, i) => {
            const point = { name: rName };
            drivers.forEach(d => {
                const dData = data[d][i];
                point[`${d}_p10`] = dData.p10;
                point[`${d}_p50`] = dData.p50;
                point[`${d}_p90`] = dData.p90;
                // Area range: [min, max]
                point[`${d}_range`] = [dData.p10, dData.p90];
            });
            return point;
        });
    }, [data]);

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A30" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#15151E', border: '1px solid #2A2A30' }}
                    labelStyle={{ color: '#9ca3af' }}
                />
                {Object.keys(data).map((d, i) => {
                    const color = d === 'VER' ? "#3671C6" : d === 'NOR' ? "#FF8000" : d === 'LEC' ? "#E8002D" : `hsl(${i * 60}, 70%, 50%)`;
                    return (
                        <React.Fragment key={d}>
                            {/* Uncertainty Area */}
                            <Area
                                type="monotone"
                                dataKey={`${d}_range`}
                                stroke="none"
                                fill={color}
                                fillOpacity={0.1}
                            />
                            {/* Median Line */}
                            <Line
                                type="monotone"
                                dataKey={`${d}_p50`}
                                stroke={color}
                                strokeWidth={2}
                                dot={false}
                                name={d}
                            />
                        </React.Fragment>
                    )
                })}
            </ComposedChart>
        </ResponsiveContainer>
    );
}

function MonteCarloView() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [chaos, setChaos] = useState(1.0);
    const [reliability, setReliability] = useState(0.95);
    const [mods, setMods] = useState({}); // { VER: 1.5 }

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('chaos', chaos);
        params.append('reliability', reliability);
        params.append('mods', JSON.stringify(mods));

        axios.get(`http://localhost:5000/api/simulations/monte-carlo?${params.toString()}`)
            .then(res => setData(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [chaos, mods, reliability]); // Trigger on config change

    const toggleBoost = (code) => {
        setMods(prev => {
            const newMods = { ...prev };
            if (newMods[code]) delete newMods[code]; // Toggle off
            else newMods[code] = 1.5; // Simple "Good Upgrade" boost
            return newMods;
        });
    };

    return (
        <div className="flex-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] p-6 overflow-hidden flex flex-col">
            {/* CONFIG PANEL */}
            <div className="bg-[#0B0B0F] p-4 rounded-xl border border-[#2A2A30] mb-6 flex flex-wrap gap-8 items-center shrink-0">

                {/* CHAOS SLIDER */}
                <div className="flex flex-col gap-2 min-w-[200px]">
                    <div className="flex justify-between items-center text-xs font-bold uppercase text-gray-500">
                        <span>Chaos Factor</span>
                        <span className="text-f1-red">{chaos}x</span>
                    </div>
                    <input
                        type="range" min="0.5" max="3.0" step="0.1"
                        value={chaos} onChange={e => setChaos(e.target.value)}
                        className="w-full accent-f1-red h-1.5 bg-[#2A2A30] rounded-full appearance-none cursor-pointer"
                    />
                </div>

                {/* MODS */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase text-gray-500 mr-2">Driver Form:</span>
                    {['VER', 'NOR', 'LEC', 'HAM', 'RUS'].map(d => (
                        <button
                            key={d}
                            onClick={() => toggleBoost(d)}
                            className={cn(
                                "px-3 py-1 rounded text-xs font-bold uppercase border transition-all",
                                mods[d]
                                    ? "bg-f1-red text-white border-f1-red shadow-[0_0_10px_rgba(255,24,1,0.5)]"
                                    : "bg-[#15151E] text-gray-500 border-[#2A2A30] hover:text-white"
                            )}
                        >
                            {d} {mods[d] ? "🔥" : ""}
                        </button>
                    ))}
                </div>
            </div>

            {/* RESULTS */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <RefreshCw className="animate-spin text-f1-red opacity-50" size={48} />
                </div>
            ) : !data ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">Simulation Error</div>
            ) : (
                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-6 p-2">
                    {/* LEFT: PROBABILITIES */}
                    <div className="overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        <div className="flex justify-between items-end mb-4 px-2">
                            <h2 className="text-xl font-bold text-white">Win Probability</h2>
                            <div className="text-[10px] text-gray-500 text-right uppercase">
                                {data.simulations.toLocaleString()} Runs <br />
                                Gen 8 Engine
                            </div>
                        </div>

                        {data.results.slice(0, 10).map((d, i) => {
                            const color = d.code === 'VER' ? "#3671C6" : d.code === 'NOR' ? "#FF8000" : d.code === 'LEC' ? "#E8002D" : "#888";
                            return (
                                <div key={d.code} className="bg-[#0B0B0F] p-3 rounded-lg border border-[#2A2A30] flex items-center gap-4 relative overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${d.probability}%` }}
                                        className="absolute left-0 top-0 bottom-0 opacity-10"
                                        style={{ backgroundColor: color }}
                                    />
                                    <div className="text-lg font-bold text-gray-600 w-6">#{i + 1}</div>
                                    <div className="flex-1 relative z-10 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: color }} />
                                            <span className="font-bold text-white">{d.name}</span>
                                            {mods[d.code] && <span className="text-[10px] bg-f1-red/20 text-f1-red px-1 rounded">BOOST ACTIVE</span>}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-mono font-bold text-white">{d.probability}%</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* RIGHT: TRAJECTORY CHART */}
                    <div className="bg-[#0B0B0F] rounded-xl border border-[#2A2A30] p-4 flex flex-col min-h-0">
                        <div className="mb-4">
                            <h3 className="text-sm font-bold uppercase text-gray-400 flex items-center gap-2">
                                <TrendingUp size={14} /> Season Trajectory (P10 - P90)
                            </h3>
                            <p className="text-[10px] text-gray-600">Shaded area represents uncertainty range.</p>
                        </div>
                        <div className="flex-1 min-h-[300px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                {/* We need to compose data for Recharts, but data.trajectories structure is {VER: [...], NOR: [...]} 
                                   Recharts wants [{name: Race1, VER_p10: 100, VER_p50: 120...}, {name: Race2...}]
                                   So we need transform logic here or inside Memo.
                               */}
                                <TrajectoryChart data={data.trajectories} />
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StrategyView({ races }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Context State
    const [selectedRace, setSelectedRace] = useState(races && races.length > 0 ? (races.find(r => r.code === 'ABU') || races[races.length - 1]) : null);
    const [gridPos, setGridPos] = useState(5);
    const [weather, setWeather] = useState('Dry');
    const [objective, setObjective] = useState('Minimise Time');

    // Scenarios
    const [traffic, setTraffic] = useState(false);
    const [degMult, setDegMult] = useState(1.0);
    const [scLaps, setScLaps] = useState([]); // Array of lap numbers
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
        // Context
        params.append('grid_pos', gridPos);
        params.append('weather', weather);
        params.append('objective', objective);

        axios.get(`http://localhost:5000/api/simulations/strategy?${params.toString()}`)
            .then(res => setData(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [selectedRace, traffic, degMult, scLaps, gridPos, weather, objective]);

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

    // Modal State
    const [showInfo, setShowInfo] = useState(false);

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
        <div className="flex-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] flex flex-col overflow-hidden relative">

            {/* STRATEGY GUIDE MODAL */}
            {showInfo && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
                    <div className="bg-[#15151E] border border-[#2A2A30] rounded-2xl w-full max-w-2xl max-h-full overflow-y-auto custom-scrollbar shadow-2xl p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">How It Works 🧠</h2>
                                <p className="text-gray-400 text-sm">Inside the "Generation 7" Strategy Engine</p>
                            </div>
                            <button onClick={() => setShowInfo(false)} className="text-gray-500 hover:text-white">
                                <span className="text-2xl">×</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#0B0B0F] p-4 rounded-xl border border-[#2A2A30]">
                                <h3 className="text-emerald-500 font-bold uppercase text-xs mb-2 flex items-center gap-2">
                                    <Map size={14} /> 1. Circuit DNA
                                </h3>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    Every track is unique. <strong>Monaco</strong> has a 28s pit loss (making stops expensive), while <strong>Montreal</strong> has a cheap 18s loss. The engine loads this physics data automatically.
                                </p>
                            </div>

                            <div className="bg-[#0B0B0F] p-4 rounded-xl border border-[#2A2A30]">
                                <h3 className="text-amber-500 font-bold uppercase text-xs mb-2 flex items-center gap-2">
                                    <Activity size={14} /> 2. Tyre Physics
                                </h3>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    Tyres don't just get slow linearly. We model a <strong>"Cliff"</strong> (Age⁴). Push a Soft tyre too far, and it will die suddenly, ruining your race pace.
                                </p>
                            </div>

                            <div className="bg-[#0B0B0F] p-4 rounded-xl border border-[#2A2A30]">
                                <h3 className="text-f1-red font-bold uppercase text-xs mb-2 flex items-center gap-2">
                                    <Zap size={14} /> 3. The Generator
                                </h3>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    We don't hardcode strategies. The engine <strong>simulates thousands</strong> of permutations (S-M, M-H, S-M-S) to find the mathematical optimum for the conditions.
                                </p>
                            </div>

                            <div className="bg-[#0B0B0F] p-4 rounded-xl border border-[#2A2A30]">
                                <h3 className="text-blue-500 font-bold uppercase text-xs mb-2 flex items-center gap-2">
                                    <Trophy size={14} /> 4. Verdict Logic
                                </h3>
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    The "Winner" isn't just the fastest raw time. We analyze <strong>Risk</strong> (Traffic, Pit Errors) and <strong>Context</strong> (Track Position) to give you a realistic recommendation.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-[#2A2A30] flex justify-end">
                            <button
                                onClick={() => setShowInfo(false)}
                                className="bg-white text-black font-bold uppercase text-xs px-6 py-2 rounded hover:bg-gray-200"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. RACE CONTEXT BAR */}
            <div className="bg-[#0B0B0F] border-b border-[#2A2A30] p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                    {/* Race Selector */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Race Event</label>
                            <button onClick={() => setShowInfo(true)} className="text-gray-500 hover:text-white transition-colors">
                                <Info size={12} />
                            </button>
                        </div>
                        <select
                            value={selectedRace.id}
                            onChange={(e) => setSelectedRace(races.find(r => r.id === e.target.value))}
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

                    {/* Weather */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Weather</label>
                        <div className="bg-[#15151E] px-3 py-1 rounded border border-[#2A2A30] text-sm font-bold text-f1-red flex items-center gap-2">
                            Selected: {weather}
                        </div>
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

            {/* MAIN CONTENT PADDING */}
            <div className="p-6 flex flex-col flex-1 min-h-0 overflow-y-auto custom-scrollbar">

                {/* ONE-LINE DEFINITION */}
                <div className="mb-6 flex items-baseline gap-2">
                    <span className="text-gray-400 text-sm">Simulating</span>
                    <strong className="text-white text-lg">{selectedRace.name} GP ({selectedRace.laps} laps)</strong>
                    <span className="text-gray-400 text-sm">starting</span>
                    <strong className="text-white text-lg">P{gridPos}</strong>
                    <span className="text-gray-400 text-sm">in</span>
                    <strong className="text-white text-lg">{traffic ? "Traffic" : "Clean Air"}</strong>
                    {gridPos > 10 && !traffic && <span className="text-xs text-f1-red ml-2 animate-pulse">⚠ Traffic Mode Recommended</span>}
                </div>

                {/* ANALYTICAL INSIGHT PANEL & SCENARIOS */}
                <div className="flex flex-col xl:flex-row gap-6 mb-6 shrink-0">

                    {/* A. INSIGHT PANEL ("THE WHY") */}
                    <div className="flex-[2] bg-gradient-to-r from-emerald-900/20 to-[#15151E] border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
                        <div className="relative z-10 flex justify-between items-start mb-4">
                            <div>
                                <div className="text-xs font-bold uppercase text-emerald-500 mb-1 flex items-center gap-2">
                                    <Trophy size={12} /> Optimal Strategy
                                </div>
                                <h2 className="text-2xl font-bold text-white leading-none mb-1">{verdict.recommended}</h2>
                                <div className="flex items-center gap-4 mt-2">
                                    <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                                        <Activity size={10} className="text-emerald-500" />
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Time Gain:</span>
                                        <span className="text-xs font-bold text-emerald-400">+{verdict.delta}s</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                                        <div className={cn("w-2 h-2 rounded-full", verdict.risk === 'High' ? "bg-f1-red animate-pulse" : verdict.risk === 'Medium' ? "bg-orange-500" : "bg-emerald-500")} />
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Risk Level:</span>
                                        <span className={cn("text-xs font-bold", verdict.risk === 'High' ? "text-f1-red" : verdict.risk === 'Medium' ? "text-orange-500" : "text-emerald-500")}>{verdict.risk}</span>
                                    </div>
                                </div>
                            </div>

                            {/* BREAKDOWN BOX */}
                            <div className="bg-black/50 p-3 rounded-lg border border-white/10 min-w-[180px]">
                                <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-2 border-b border-white/10 pb-1">Gain Breakdown</h4>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Pit Stops</span>
                                        <span className={cn("font-mono font-bold", verdict.breakdown?.pit_gain > 0 ? "text-emerald-500" : "text-f1-red")}>
                                            {verdict.breakdown?.pit_gain > 0 ? "+" : ""}{verdict.breakdown?.pit_gain}s
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Pace Loss</span>
                                        <span className={cn("font-mono font-bold", -verdict.breakdown?.pace_loss > 0 ? "text-emerald-500" : "text-f1-red")}>
                                            {-verdict.breakdown?.pace_loss}s
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="relative z-10 text-xs text-gray-300 italic">" {verdict.reason} "</p>
                    </div>

                    {/* B. SCENARIO CONTROL DECK */}
                    <div className="flex-1 bg-[#0B0B0F] p-4 rounded-xl border border-[#2A2A30] flex flex-col justify-center gap-3 min-w-[240px]">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold uppercase text-gray-400 flex items-center gap-2">
                                <Calculator size={12} /> Scenario Lab
                            </h4>
                            <button
                                onClick={() => { setDegMult(1.0); setScLaps([]); setTraffic(false); }}
                                className="text-[9px] text-f1-red uppercase font-bold hover:underline"
                            >Reset</button>
                        </div>

                        {/* 1. Traffic */}
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase font-bold text-gray-500 w-16">Traffic</span>
                            <button
                                onClick={() => setTraffic(!traffic)}
                                className={cn("flex-1 h-6 rounded relative transition-colors", traffic ? "bg-f1-red/20" : "bg-[#2A2A30]")}
                            >
                                <div className={cn("absolute top-0.5 bottom-0.5 w-[48%] rounded bg-white transition-all shadow-sm", traffic ? "right-0.5 bg-f1-red" : "left-0.5 bg-gray-500")} />
                            </button>
                        </div>

                        {/* 2. Deg Multiplier */}
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500">
                                <span>Degradation</span>
                                <span className={cn("font-mono", degMult > 1 ? "text-f1-red" : "text-white")}>{degMult}x</span>
                            </div>
                            <input
                                type="range" min="0.8" max="1.5" step="0.1"
                                value={degMult} onChange={(e) => setDegMult(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-[#2A2A30] rounded-full accent-f1-red appearance-none cursor-pointer"
                            />
                        </div>

                        {/* 3. Safety Car Manager */}
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500">
                                <span>Safety Cars</span>
                                <span className="text-amber-500">{scLaps.length} Active</span>
                            </div>

                            {/* Input Row */}
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max={selectedRace.laps}
                                    placeholder={`1-${selectedRace.laps}...`}
                                    value={newScLap}
                                    onChange={(e) => setNewScLap(e.target.value)}
                                    className={cn(
                                        "w-full bg-[#15151E] border rounded px-2 text-xs text-white font-bold outline-none",
                                        (newScLap && (newScLap < 1 || newScLap > selectedRace.laps))
                                            ? "border-f1-red text-f1-red focus:border-f1-red"
                                            : "border-[#2A2A30] focus:border-amber-500"
                                    )}
                                />
                                <button
                                    onClick={addSafetyCar}
                                    disabled={!newScLap || newScLap < 1 || newScLap > selectedRace.laps}
                                    className="bg-amber-500 text-black text-[10px] font-bold px-3 rounded hover:bg-amber-400 disabled:opacity-50 disabled:bg-[#2A2A30] disabled:text-gray-500"
                                >
                                    ADD
                                </button>
                            </div>

                            {/* Chips */}
                            <div className="flex flex-wrap gap-1.5">
                                {scLaps.map(lap => (
                                    <div key={lap} className="flex items-center gap-1 bg-amber-500/20 text-amber-500 border border-amber-500/50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        <span>Lap {lap}</span>
                                        <button onClick={() => removeSafetyCar(lap)} className="hover:text-white">×</button>
                                    </div>
                                ))}
                                {scLaps.length === 0 && <span className="text-[9px] text-gray-600 italic">No Safety Cars added.</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* CHART */}
                <div className="h-[350px] bg-[#0B0B0F] rounded-xl border border-[#2A2A30] p-4 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A30" vertical={false} />
                            <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} dy={10} label={{ value: 'Lap', position: 'insideBottomRight', fill: '#666', fontSize: 10 }} />

                            {/* INVERTED Y-AXIS: Lower is Faster */}
                            <YAxis reversed={true} domain={['dataMin - 1', 'dataMax + 1']} stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} width={30} />

                            <Tooltip
                                contentStyle={{ backgroundColor: '#15151E', border: '1px solid #2A2A30', borderRadius: '8px' }}
                                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                labelStyle={{ color: '#9ca3af', fontSize: '10px' }}
                                formatter={(value) => value ? [value + "s", "Lap Time"] : ["PIT", ""]}
                            />

                            {/* PIT STOP LINES */}
                            {data.strategies.map(strat => (
                                strat.pit_stops.map(lap => (
                                    <ReferenceLine key={`${strat.name}-${lap}`} x={lap} stroke={strat.color} strokeDasharray="3 3" strokeOpacity={0.5}>
                                        <Label value="PIT" position="insideTop" fill={strat.color} fontSize={10} fontWeight="bold" />
                                    </ReferenceLine>
                                ))
                            ))}

                            {/* SAFETY CAR LINES */}
                            {scLaps.map(lap => (
                                <ReferenceLine key={`sc-${lap}`} x={lap} stroke="#F59E0B" strokeDasharray="5 5" strokeWidth={2}>
                                    <Label value="SC DEPLOYED" position="insideTopRight" fill="#F59E0B" fontSize={10} fontWeight="bold" />
                                </ReferenceLine>
                            ))}

                            {data.strategies.map(strat => (
                                <Line
                                    key={strat.name}
                                    type="monotone"
                                    connectNulls={false} // Leave gap for pits
                                    dataKey={strat.name}
                                    stroke={strat.color}
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>

                    {/* PIT BREAKDOWN OVERLAY */}
                    <div className="absolute top-4 right-4 bg-black/80 px-3 py-2 rounded border border-white/10 text-[10px] backdrop-blur-sm">
                        <div className="text-gray-400 font-bold uppercase mb-1 border-b border-white/10 pb-1">Pit Time Loss</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-500">
                            <span>Entry:</span> <span className="text-white text-right">{data.pit_breakdown.entry}s</span>
                            <span>Stationary:</span> <span className="text-white text-right">{data.pit_breakdown.stationary}s</span>
                            <span>Exit:</span> <span className="text-white text-right">{data.pit_breakdown.exit}s</span>
                        </div>
                        {scLaps.length > 0 && (
                            <div className="mt-2 text-amber-500 font-bold border-t border-white/10 pt-1">
                                SC DISCOUNT ACTIVE: -10s
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4 shrink-0">
                    {data.strategies.map(strat => (
                        <div key={strat.name} className={cn("px-4 py-2 rounded border flex items-center justify-between", strat.is_best ? "bg-emerald-900/10 border-emerald-500/50" : "bg-[#0B0B0F] border-[#2A2A30]")}>
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: strat.color }} />
                                <div>
                                    <div className="text-xs font-bold text-white flex items-center gap-2">
                                        {strat.name}
                                        {strat.is_best && <span className="bg-emerald-500 text-black text-[9px] px-1 rounded uppercase">Best</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-400">Total: {(strat.total_time / 60).toFixed(2)} min</div>
                                </div>
                            </div>
                            <div className="text-right">
                                {strat.is_best ? (
                                    <span className="text-emerald-500 font-mono font-bold text-sm">WINNER</span>
                                ) : (
                                    <span className="text-f1-red font-mono font-bold text-sm">+{strat.delta_to_best}s</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
