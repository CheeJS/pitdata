
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Activity, Zap, AlertTriangle, MapPin, Calendar, CheckCircle2, ChevronRight, BarChart3, Brain, Lock, Info, Timer } from 'lucide-react';
import { cn } from '../lib/utils';

// --- DATA CONSTANTS ---
const DRIVER_DATA = {
    // Contenders
    "VER": { team: "Red Bull Racing", color: "#3671C6", probability: 42 },
    "NOR": { team: "McLaren", color: "#F58020", probability: 28 },
    "LEC": { team: "Ferrari", color: "#F91536", probability: 12 },
    "HAM": { team: "Ferrari", color: "#F91536", probability: 8 },
    "PIA": { team: "McLaren", color: "#F58020", probability: 5 },
    "RUS": { team: "Mercedes", color: "#6CD3BF", probability: 4 },
    // The Field
    "SAI": { team: "Williams", color: "#37BEDD", probability: 0.8 },
    "ALO": { team: "Aston Martin", color: "#358C75", probability: 0.2 },
    "STR": { team: "Aston Martin", color: "#358C75", probability: 0 },
    "TSU": { team: "RB", color: "#6692FF", probability: 0 },
    "GAS": { team: "Alpine", color: "#2293D1", probability: 0 },
    "ALB": { team: "Williams", color: "#37BEDD", probability: 0 },
    "OCO": { team: "Haas F1 Team", color: "#B6BABD", probability: 0 },
    "HUL": { team: "Sauber", color: "#52E252", probability: 0 },
    "LAW": { team: "Red Bull Racing", color: "#3671C6", probability: 0 },
    "BEA": { team: "Haas F1 Team", color: "#B6BABD", probability: 0 },
    "ANT": { team: "Mercedes", color: "#6CD3BF", probability: 0 },
    "DOO": { team: "Alpine", color: "#2293D1", probability: 0 },
    "BOR": { team: "Sauber", color: "#52E252", probability: 0 },
    "HAD": { team: "RB", color: "#6692FF", probability: 0 },
};

const CONTENDERS = ['VER', 'NOR', 'LEC', 'HAM', 'PIA', 'RUS'];

// --- SUB-COMPONENT: DRIVER CARD ---
const DriverCard = ({ code, meta, isSelected, isLocked, onSelect, type = 'contender' }) => {
    const isContender = type === 'contender';

    return (
        <motion.button
            onClick={onSelect}
            disabled={isLocked}
            whileHover={!isLocked ? { scale: 1.02, borderColor: meta.color } : {}}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "relative text-left transition-all overflow-hidden bg-[#0B0B0F] border",
                isSelected ? "border-current bg-[#1A1A24]" : "border-[#2A2A30] hover:border-gray-600",
                isContender ? "p-4 rounded-xl border-2" : "p-3 rounded-lg opacity-80 hover:opacity-100"
            )}
            style={{ borderColor: isSelected ? meta.color : undefined }}
        >
            <div className="relative z-10 flex justify-between items-start">
                <div className="flex flex-col">
                    <span className={cn("font-bold text-white block", isContender ? "text-2xl" : "text-lg")}>{code}</span>
                    <span className={cn("text-gray-500 font-bold uppercase", isContender ? "text-xs tracking-wider" : "text-[10px]")}>
                        {meta.team.replace(" F1 Team", "").split(' ')[0]}
                    </span>
                </div>
                {isSelected && isLocked && <CheckCircle2 className="text-white" size={isContender ? 24 : 16} />}

                {/* Implicit Probability on Hover (Smart UX) */}
                <div className="opacity-0 hover:opacity-100 absolute top-0 right-0 h-full w-1/2 flex items-center justify-end pr-2 transition-opacity bg-gradient-to-l from-[#0B0B0F] via-[#0B0B0F]/80 to-transparent pointer-events-none">
                    <span className="text-xs font-mono text-gray-400">{meta.probability > 0 ? `${meta.probability}%` : "<1%"}</span>
                </div>
            </div>
            {/* Team Stripe */}
            <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: meta.color }} />
        </motion.button>
    );
};


export default function Predictions() {
    const [races, setRaces] = useState([]);
    const [clientId, setClientId] = useState(localStorage.getItem('f1_client_id'));
    const [selectedRace, setSelectedRace] = useState(null);
    const [stats, setStats] = useState(null);
    const [userVote, setUserVote] = useState(null);
    const [loading, setLoading] = useState(false);

    // UI State
    const [confidence, setConfidence] = useState(75);
    const [scProbability, setScProbability] = useState(50);
    const [activeWinner, setActiveWinner] = useState(null);
    const [activeMargin, setActiveMargin] = useState(null);
    const [showAllDrivers, setShowAllDrivers] = useState(false);

    // 1. Initialize Identity
    useEffect(() => {
        if (!clientId) {
            const newId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('f1_client_id', newId);
            setClientId(newId);
        }
    }, [clientId]);

    // 2. Fetch Races
    useEffect(() => {
        axios.get('http://localhost:5000/api/races?year=2025')
            .then(res => {
                setRaces(res.data);
                if (res.data.length > 0) setSelectedRace(res.data[0]);
            })
            .catch(err => console.error("Error fetching races", err));
    }, []);

    // 3. Fetch Stats
    useEffect(() => {
        if (!selectedRace) return;
        setLoading(true);
        // Reset local state
        setUserVote(null);
        setActiveWinner(null);
        setActiveMargin(null);
        setShowAllDrivers(false); // Reset expand on race change

        axios.get(`http://localhost:5000/api/predictions/stats?race_id=${selectedRace.id}`)
            .then(res => setStats(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [selectedRace]);

    // Submit Handlers
    const confirmVote = async () => {
        if (!activeWinner || !activeMargin) return;

        const votePayload = { winner: { code: activeWinner, confidence }, margin: activeMargin, safetyCar: scProbability };
        setUserVote(votePayload);

        try {
            await axios.post('http://localhost:5000/api/predictions/vote', { race_id: selectedRace.id, client_id: clientId, category: "winner", value: { code: activeWinner, confidence } });
            await axios.post('http://localhost:5000/api/predictions/vote', { race_id: selectedRace.id, client_id: clientId, category: "safety_car", value: scProbability });
            refreshStats();
        } catch (e) { console.error(e); }
    };

    const refreshStats = async () => {
        const res = await axios.get(`http://localhost:5000/api/predictions/stats?race_id=${selectedRace.id}`);
        setStats(res.data);
    };

    if (!selectedRace) return <div className="p-8 text-white animate-pulse">Loading Grand Prix Data...</div>;

    // AI Mock
    const aiPrediction = { winner: "VER", confidence: 78, safetyCar: 65, margin: "5-10s" };

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500 space-y-6">
            {/* 1. COMPACT HEADER STRIP */}
            <div className="bg-[#15151E] border border-[#2A2A30] rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-f1-red" />

                <div className="flex items-center gap-4 z-10">
                    <div className="w-12 h-12 bg-[#2A2A30] rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-inner">{selectedRace.round || "#"}</div>
                    <div>
                        <h2 className="text-xl font-bold text-white leading-tight">{selectedRace.name}</h2>
                        <div className="flex items-center gap-3 text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">
                            <span className="flex items-center gap-1"><MapPin size={12} /> {selectedRace.circuit || "Circuit"}</span>
                            <span className="flex items-center gap-1"><Calendar size={12} /> {selectedRace.date}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 mt-4 md:mt-0 z-10">
                    <div className="text-right hidden md:block">
                        <div className="text-xs text-gray-500 uppercase font-bold">Conditions</div>
                        <div className="text-sm text-white font-medium">{selectedRace.conditions || "Loading..."}</div>
                    </div>
                    <select
                        className="bg-[#0B0B0F] border border-[#2A2A30] text-white text-sm rounded-lg py-2 px-3 outline-none focus:border-f1-red"
                        value={selectedRace.id}
                        onChange={e => setSelectedRace(races.find(r => r.id == e.target.value))}
                    >
                        {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
            </div>


            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
                {/* LEFT: VOTING EXPERIENCE */}
                <div className={cn("flex-[1.5] bg-[#15151E] rounded-3xl border border-[#2A2A30] flex flex-col p-8 overflow-y-auto custom-scrollbar relative transition-all", userVote && "opacity-90 grayscale-[0.3]")}>

                    {/* DEMO MODE BANNER */}
                    <div className="mb-8 flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <Activity size={18} className="text-blue-400" />
                        <div>
                            <span className="text-sm font-bold text-blue-100 block">Demo Mode Active</span>
                            <span className="text-xs text-blue-300">Historical event selected. Votes are simulated for portfolio demonstration.</span>
                        </div>
                    </div>

                    {/* SECTION: WINNER PREDICTION */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Trophy size={18} className="text-yellow-500" /> Who takes the win?</h3>
                                <p className="text-xs text-gray-500 font-medium ml-7 mt-1">Top contenders based on pace analysis</p>
                            </div>
                            {userVote && <div className="flex items-center gap-1 text-xs font-bold text-f1-red uppercase border border-f1-red/30 px-2 py-1 rounded bg-f1-red/10"><Lock size={10} /> Prediction Locked</div>}
                        </div>

                        {/* 1. PRIMARY CONTENDERS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            {CONTENDERS.map(driver => (
                                <DriverCard
                                    key={driver}
                                    code={driver}
                                    meta={DRIVER_DATA[driver]}
                                    isSelected={activeWinner === driver || userVote?.winner?.code === driver}
                                    isLocked={!!userVote}
                                    onSelect={() => !userVote && setActiveWinner(driver)}
                                    type="contender"
                                />
                            ))}
                        </div>

                        {/* 2. EXPANDABLE FIELD */}
                        {!showAllDrivers && !userVote && (
                            <button
                                onClick={() => setShowAllDrivers(true)}
                                className="w-full py-3 rounded-xl border border-dashed border-[#2A2A30] text-gray-500 text-xs font-bold uppercase hover:bg-[#1A1A24] hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <ChevronRight size={14} className="rotate-90" /> Show Full Grid (20 Drivers)
                            </button>
                        )}
                        <AnimatePresence>
                            {showAllDrivers && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="grid grid-cols-2 md:grid-cols-4 gap-2 overflow-hidden"
                                >
                                    {Object.keys(DRIVER_DATA).filter(d => !CONTENDERS.includes(d)).map(driver => (
                                        <DriverCard
                                            key={driver}
                                            code={driver}
                                            meta={DRIVER_DATA[driver]}
                                            isSelected={activeWinner === driver || userVote?.winner?.code === driver}
                                            isLocked={!!userVote}
                                            onSelect={() => !userVote && setActiveWinner(driver)}
                                            type="field"
                                        />
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* CONFIDENCE SLIDER */}
                        <AnimatePresence>
                            {activeWinner && !userVote && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="mt-6 bg-[#0B0B0F] p-5 rounded-xl border border-[#2A2A30] shadow-2xl relative z-10"
                                >
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <span className="text-xs text-f1-red font-bold uppercase tracking-wider block mb-1">Prediction Detail</span>
                                            <h4 className="text-white font-bold text-lg">Confidence in {activeWinner}?</h4>
                                        </div>
                                        <span className="text-2xl font-mono font-bold text-white">{confidence}%</span>
                                    </div>
                                    <input type="range" min="0" max="100" value={confidence} onChange={(e) => setConfidence(e.target.value)}
                                        className="w-full h-2 bg-[#2A2A30] rounded-lg appearance-none cursor-pointer accent-f1-red"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-600 font-bold uppercase mt-2">
                                        <span>Gut Feeling</span>
                                        <span>Certainty</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* SECTION: WINNER MARGIN */}
                    <div className="mb-10">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Timer size={18} className="text-cyan-500" /> Winning Margin</h3>
                        <div className="flex gap-4">
                            {['< 5s', '5-10s', '10s+'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => !userVote && setActiveMargin(opt)}
                                    disabled={!!userVote}
                                    className={cn(
                                        "flex-1 py-3 rounded-xl border text-sm font-bold transition-all",
                                        (activeMargin === opt || userVote?.margin === opt)
                                            ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                                            : "bg-[#0B0B0F] border-[#2A2A30] text-gray-400 hover:border-gray-500"
                                    )}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SECTION: SAFETY CAR */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><AlertTriangle size={18} className="text-orange-500" /> Safety Car Probability</h3>
                            <div className="group relative">
                                <Info size={14} className="text-gray-500 cursor-help" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-black border border-[#2A2A30] p-2 rounded text-[10px] text-gray-300 hidden group-hover:block z-20">
                                    {selectedRace.sc_context || "Based on historical incident rates."}
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#0B0B0F] p-6 rounded-xl border border-[#2A2A30]">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-sm font-bold text-gray-400">Likelihood</span>
                                <span className={cn("text-xl font-mono font-bold", scProbability > 50 ? "text-orange-500" : "text-green-500")}>{scProbability}%</span>
                            </div>
                            <input
                                type="range" min="0" max="100" value={scProbability}
                                disabled={!!userVote}
                                onChange={(e) => setScProbability(e.target.value)}
                                className="w-full h-2 bg-[#2A2A30] rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                        </div>
                    </div>

                    {/* SUBMIT */}
                    {!userVote && (
                        <button
                            onClick={confirmVote}
                            disabled={!activeWinner || !activeMargin}
                            className="w-full mt-8 bg-f1-red hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
                        >
                            <Lock size={18} /> Lock In Prediction
                        </button>
                    )}

                    {/* FOOTER */}
                    <div className="mt-8 pt-6 border-t border-[#2A2A30] text-center">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">
                            Predictions combine historical race data, telemetry proxies, and tyre degradation models.
                        </p>
                    </div>
                </div>

                {/* RIGHT: COMPARISON DASHBOARD */}
                <div className="flex-1 flex flex-col gap-6">
                    {/* 1. COMPARISON CARD (Visible after vote) */}
                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-6 flex flex-col">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-6 flex items-center gap-2">
                            <BarChart3 size={14} /> Analysis Matrix
                        </h3>

                        {!userVote ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
                                <Brain size={48} className="text-[#2A2A30] mb-4" />
                                <p className="text-gray-500 text-sm">Cast your predictions to unlock community and AI insights.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-4 gap-2 text-[10px] font-bold text-gray-500 uppercase border-b border-[#2A2A30] pb-2">
                                    <div className="col-span-1">Source</div>
                                    <div className="col-span-2">Winner Pick</div>
                                    <div className="col-span-1 text-right">SC Probability</div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 items-center py-2 border-b border-[#2A2A30]/50">
                                    <div className="col-span-1 font-bold text-f1-red flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-f1-red" /> You</div>
                                    <div className="col-span-2 text-white font-bold">{userVote.winner.code} <span className="text-xs text-gray-500 font-normal">({userVote.winner.confidence}%)</span></div>
                                    <div className="col-span-1 text-right text-white font-mono">{userVote.safetyCar}%</div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 items-center py-2 border-b border-[#2A2A30]/50">
                                    <div className="col-span-1 font-bold text-blue-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400" /> Fans</div>
                                    <div className="col-span-2 text-white font-bold">
                                        {stats?.winner?.[0]?.code || "waiting..."}
                                        <span className="text-xs text-gray-500 font-normal ml-1">
                                            ({stats?.winner?.[0]?.percent || 0}%)
                                        </span>
                                    </div>
                                    <div className="col-span-1 text-right text-white font-mono">{stats?.safety_car_avg || 0}%</div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 items-center py-2">
                                    <div className="col-span-1 font-bold text-purple-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-400" /> AI</div>
                                    <div className="col-span-2 text-white font-bold">{aiPrediction.winner} <span className="text-xs text-gray-500 font-normal">({aiPrediction.confidence}%)</span></div>
                                    <div className="col-span-1 text-right text-white font-mono">{aiPrediction.safetyCar}%</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. COMMUNITY STATS */}
                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-6 flex flex-col flex-1 min-h-0">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-gray-400 uppercase">Community Trend</h3>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-[10px] uppercase font-bold px-2 py-1 rounded", stats?.total_votes > 0 ? "bg-green-900/20 text-green-500" : "bg-gray-800 text-gray-500")}>
                                    {stats?.total_votes > 0 ? "Active" : "Demo"}
                                </span>
                                <span className="text-xs font-mono text-gray-400">{stats?.total_votes || 0} Votes</span>
                            </div>
                        </div>
                        {stats?.total_votes > 5 && (
                            <div className="mb-4 text-[10px] text-gray-500 flex items-center gap-2">
                                <Activity size={10} /> Public Trend: Shifted towards McLaren after FP3
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                            {stats?.winner?.map((w, i) => (
                                <div key={w.code} className="group">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className={cn("font-bold", i === 0 ? "text-white" : "text-gray-400")}>{w.code}</span>
                                        <span className="text-gray-500">{w.percent}%</span>
                                    </div>
                                    <div className="h-2 bg-[#0B0B0F] rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${w.percent}%` }}
                                            className={cn("h-full rounded-full transition-colors", i === 0 ? "bg-white" : "bg-gray-700 group-hover:bg-gray-500")}
                                        />
                                    </div>
                                </div>
                            ))}
                            {(!stats?.winner || stats.winner.length === 0) && (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                    <BarChart3 size={32} className="mb-2" />
                                    <p className="text-xs">Awaiting first vote...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
