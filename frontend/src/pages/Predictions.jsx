
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy, Activity, Zap, AlertTriangle, MapPin, Calendar, CheckCircle2, ChevronRight,
    BarChart3, Brain, Lock, Info, Timer, Sun, CloudRain, Flame, Target, TrendingUp,
    Medal, Star, XCircle, Gauge, Users, Award, Sparkles, Clock
} from 'lucide-react';
import { cn } from '../lib/utils';

// --- SUB-COMPONENT: PODIUM SLOT ---
const PodiumSlot = ({ position, driver, color, onRemove, isLocked }) => {
    const heights = { 1: 'h-24', 2: 'h-20', 3: 'h-16' };
    const positions = { 1: 'order-2', 2: 'order-1', 3: 'order-3' };
    const labels = { 1: '1ST', 2: '2ND', 3: '3RD' };
    const medalColors = {
        1: 'from-yellow-400 to-yellow-600',
        2: 'from-gray-300 to-gray-500',
        3: 'from-orange-400 to-orange-600'
    };

    return (
        <div className={cn("flex flex-col items-center gap-2", positions[position])}>
            <AnimatePresence mode="wait">
                {driver ? (
                    <motion.div
                        key={driver}
                        initial={{ scale: 0, y: -20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0, y: 20 }}
                        className="relative"
                    >
                        <div
                            className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-lg border-2 shadow-lg"
                            style={{ backgroundColor: color + '30', borderColor: color }}
                        >
                            {driver}
                        </div>
                        {!isLocked && (
                            <button
                                onClick={onRemove}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600"
                            >
                                ×
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        className="w-16 h-16 rounded-xl border-2 border-dashed border-[#2A2A30] flex items-center justify-center text-gray-600 text-xs"
                    >
                        P{position}
                    </motion.div>
                )}
            </AnimatePresence>
            <div className={cn("w-20 rounded-t-lg flex flex-col items-center justify-end bg-gradient-to-t", heights[position], medalColors[position])}>
                <span className="text-black font-bold text-sm mb-1">{labels[position]}</span>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: DRIVER CARD ---
const DriverCard = ({ code, meta, isSelected, isLocked, onSelect, type = 'contender', selectedFor }) => {
    const isContender = type === 'contender';
    // Fallback if meta is missing
    const teamName = meta?.team ? meta.team.replace(" F1 Team", "").split(' ')[0] : "Team";
    const color = meta?.color || "#666";

    return (
        <motion.button
            onClick={onSelect}
            disabled={isLocked}
            whileHover={!isLocked ? { scale: 1.02, borderColor: color } : {}}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "relative text-left transition-all overflow-hidden bg-[#0B0B0F] border",
                isSelected ? "border-current bg-[#1A1A24]" : "border-[#2A2A30] hover:border-gray-600",
                isContender ? "p-4 rounded-xl border-2" : "p-3 rounded-lg opacity-80 hover:opacity-100",
                isLocked && !isSelected && "opacity-50 grayscale"
            )}
            style={{ borderColor: isSelected ? color : undefined }}
        >
            <div className="relative z-10 flex justify-between items-start">
                <div className="flex flex-col">
                    <span className={cn("font-bold text-white block", isContender ? "text-2xl" : "text-lg")}>{code}</span>
                    <span className={cn("text-gray-500 font-bold uppercase", isContender ? "text-xs tracking-wider" : "text-[10px]")}>
                        {teamName}
                    </span>
                </div>
                {selectedFor && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/10" style={{ color: color }}>
                        P{selectedFor}
                    </span>
                )}
                {isSelected && isLocked && !selectedFor && <CheckCircle2 className="text-white" size={isContender ? 24 : 16} />}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: color }} />
        </motion.button>
    );
};

export default function Predictions() {
    const [races, setRaces] = useState([]);
    const [activeDrivers, setActiveDrivers] = useState([]);
    const [driverMap, setDriverMap] = useState({});

    const [clientId, setClientId] = useState(localStorage.getItem('f1_client_id'));
    const [selectedRace, setSelectedRace] = useState(null);
    const [stats, setStats] = useState(null);
    const [userVote, setUserVote] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Podium State
    const [podium, setPodium] = useState({ 1: null, 2: null, 3: null });

    // Side Predictions
    const [winningGap, setWinningGap] = useState('5-10s');
    const [dnfPredictions, setDnfPredictions] = useState([]);
    const [weather, setWeather] = useState('dry');
    const [pitStrategy, setPitStrategy] = useState({ stops: 1, tyres: ['S', 'M', 'M', 'M'] });
    const [safetyCar, setSafetyCar] = useState({ enabled: true, count: 1 });

    // UI State
    const [showAllDrivers, setShowAllDrivers] = useState(false);

    // Mock User Stats (kept for UI flavor)
    const [userStats] = useState({
        accuracy: 67, streak: 3, points: 1250, correctPredictions: 8, totalPredictions: 12, rank: 42
    });

    const TYRE_COLORS = {
        'S': { color: '#FF3333', name: 'Soft' },
        'M': { color: '#FFE040', name: 'Medium' },
        'H': { color: '#F0F0F0', name: 'Hard' },
        'I': { color: '#39B54A', name: 'Inter' },
        'W': { color: '#366CD9', name: 'Wet' },
    };

    // 1. Initialize Identity & Fetch Data
    useEffect(() => {
        if (!clientId) {
            const newId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('f1_client_id', newId);
            setClientId(newId);
        }

        // Fetch Drivers
        axios.get('http://localhost:5000/api/drivers?year=2026')
            .then(res => {
                setActiveDrivers(res.data);
                // Create lookup map
                const map = {};
                res.data.forEach(d => map[d.code] = d);
                setDriverMap(map);
            })
            .catch(err => console.error("Error fetching drivers", err));

        // Fetch Races
        axios.get('http://localhost:5000/api/races?year=2026')
            .then(res => {
                setRaces(res.data);
                if (res.data.length > 0) setSelectedRace(res.data[0]);
            })
            .catch(err => console.error("Error fetching races", err));
    }, []); // Run once on mount (ignoring clientId dep to avoid double fetch)

    // 2. Fetch Stats when Race Changes
    useEffect(() => {
        if (!selectedRace) return;
        setLoading(true);
        setUserVote(null);
        setPodium({ 1: null, 2: null, 3: null });
        setWinningGap('5-10s');
        setDnfPredictions([]);
        setShowAllDrivers(false);
        setShowResults(false);

        axios.get(`http://localhost:5000/api/predictions/stats?race_id=${selectedRace.id}`)
            .then(res => setStats(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [selectedRace]);

    // Derived States
    // Top Contenders: Sort by 'probability' (or just pick top 6 from list)
    // Theoretically the API should return them sorted or we sort here
    const contenders = useMemo(() => {
        return activeDrivers.slice(0, 6).map(d => d.code);
    }, [activeDrivers]);

    const isPredictionWindowOpen = useMemo(() => {
        // Dev: Allow unlocking via URL param ?unlock=true
        if (typeof window !== 'undefined' && window.location.search.includes('unlock=true')) return true;

        if (!selectedRace || !selectedRace.predictions) return true; // Default open if unknown
        return selectedRace.predictions.is_open;
    }, [selectedRace]);

    // Helpers
    const updateStops = (n) => {
        if (userVote || !isPredictionWindowOpen) return;
        setPitStrategy(prev => {
            const newTyres = [...prev.tyres];
            return { ...prev, stops: n, tyres: newTyres };
        });
    };

    const cycleTyre = (index) => {
        if (userVote || !isPredictionWindowOpen) return;
        const compounds = weather === 'wet' ? ['S', 'M', 'H', 'I', 'W'] : ['S', 'M', 'H'];
        setPitStrategy(prev => {
            const currentTyre = prev.tyres[index] || 'M';
            const nextIdx = (compounds.indexOf(currentTyre) + 1) % compounds.length;
            const newTyres = [...prev.tyres];
            newTyres[index] = compounds[nextIdx];
            return { ...prev, tyres: newTyres };
        });
    };

    const selectDriver = (driver) => {
        if (userVote || !isPredictionWindowOpen) return;
        const existingPos = Object.entries(podium).find(([pos, d]) => d === driver)?.[0];
        if (existingPos) {
            setPodium(prev => ({ ...prev, [existingPos]: null }));
            return;
        }
        if (!podium[1]) setPodium(prev => ({ ...prev, 1: driver }));
        else if (!podium[2]) setPodium(prev => ({ ...prev, 2: driver }));
        else if (!podium[3]) setPodium(prev => ({ ...prev, 3: driver }));
    };

    const removePodium = (position) => {
        if (userVote || !isPredictionWindowOpen) return;
        setPodium(prev => ({ ...prev, [position]: null }));
    };

    const confirmVote = async () => {
        if (!podium[1]) return;

        const votePayload = {
            podium,
            winningGap,
            dnfPredictions,
            weather,
            pitStrategy,
            safetyCar
        };
        setUserVote(votePayload);

        try {
            await axios.post('http://localhost:5000/api/predictions/vote', {
                race_id: selectedRace.id,
                client_id: clientId,
                value: votePayload // Sending full payload
            });
            refreshStats();
        } catch (e) { console.error(e); }
        setTimeout(() => setShowResults(true), 2000);
    };

    const refreshStats = async () => {
        if (!selectedRace) return;
        const res = await axios.get(`http://localhost:5000/api/predictions/stats?race_id=${selectedRace.id}`);
        setStats(res.data);
    };

    // AI Prediction Mock (Static for now, could be dynamic later)
    const aiPrediction = { winner: "VER", p2: "NOR", p3: "LEC", confidence: 78, safetyCar: false, winningGap: "8.5s" };

    if (!selectedRace) return <div className="p-8 text-white animate-pulse">Loading Grand Prix Data...</div>;

    const locked = !!userVote || !isPredictionWindowOpen;

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500 overflow-hidden">
            {/* RESULT OVERLAY (Keep existing logic) */}
            <AnimatePresence>
                {showResults && userVote && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
                        onClick={() => setShowResults(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }}
                            className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-8 max-w-md text-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <Sparkles size={64} className="text-yellow-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-2">Prediction Locked!</h2>
                            <p className="text-gray-400 mb-6">Good luck! Check the results after the race.</p>
                            <button onClick={() => setShowResults(false)} className="w-full bg-f1-red hover:bg-red-600 text-white font-bold py-3 rounded-xl">Continue</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HEADER */}
            <header className="relative overflow-hidden rounded-2xl bg-[#09090B] border border-[#222] min-h-[220px] md:min-h-[280px] mx-3 md:mx-6 mt-3 md:mt-6 shrink-0 flex flex-col justify-end p-6 md:p-10 group">
                <div className="absolute inset-0 z-0">
                    <img
                        src={`https://flagcdn.com/w1280/${selectedRace.code?.slice(0, 2) || 'un'}.png`}
                        alt=""
                        className="w-full h-full object-cover opacity-15"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/80 to-transparent" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            {isPredictionWindowOpen ? (
                                <span className="px-3 py-1 rounded-full bg-green-500/10 text-xs font-bold text-green-400 border border-green-500/20 uppercase tracking-wider flex items-center gap-2">
                                    <Clock size={12} /> Predictions Open
                                </span>
                            ) : (
                                <span className="px-3 py-1 rounded-full bg-red-500/10 text-xs font-bold text-red-500 border border-red-500/20 uppercase tracking-wider flex items-center gap-2">
                                    <Lock size={12} /> Predictions Closed
                                </span>
                            )}
                            <span className="text-gray-400 text-sm font-medium tracking-wide border-l border-gray-700 pl-3">
                                {selectedRace.date}
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-white italic uppercase tracking-tighter leading-[0.9]">
                            {selectedRace.name}
                        </h1>
                    </div>
                    <div className="flex flex-col items-end gap-3 z-20">
                        <select
                            className="bg-black/50 backdrop-blur-md border border-white/10 text-white text-sm rounded-lg py-3 px-4 outline-none focus:border-f1-red"
                            value={selectedRace.id}
                            onChange={e => setSelectedRace(races.find(r => r.id == e.target.value))}
                        >
                            {races.map(r => <option key={r.id} value={r.id}>{r.name} GP</option>)}
                        </select>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <div className="flex flex-col lg:flex-row gap-4 md:gap-6 flex-1 min-h-0 overflow-hidden p-3 md:p-6">

                {/* LEFT: INPUT */}
                <div className={cn("flex-1 lg:flex-[1.5] bg-[#15151E] rounded-2xl border border-[#2A2A30] flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar", locked && "opacity-90 pointer-events-none")}>
                    {/* PODIUM */}
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                            <Trophy size={18} className="text-yellow-500" /> Podium Prediction
                        </h3>
                        <div className="flex justify-center items-end gap-4 bg-[#0B0B0F] rounded-xl p-6 relative">
                            <PodiumSlot position={2} driver={podium[2]} color={podium[2] ? driverMap[podium[2]]?.color : '#666'} onRemove={() => removePodium(2)} isLocked={locked} />
                            <PodiumSlot position={1} driver={podium[1]} color={podium[1] ? driverMap[podium[1]]?.color : '#666'} onRemove={() => removePodium(1)} isLocked={locked} />
                            <PodiumSlot position={3} driver={podium[3]} color={podium[3] ? driverMap[podium[3]]?.color : '#666'} onRemove={() => removePodium(3)} isLocked={locked} />
                        </div>
                    </div>

                    {/* DRIVERS */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm text-gray-400">Select Drivers</span>
                            {locked && <span className="text-xs text-f1-red flex items-center gap-1"><Lock size={10} /> Locked</span>}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {/* Show Contenders First */}
                            {contenders.map(code => {
                                const pPos = Object.entries(podium).find(([p, d]) => d === code)?.[0];
                                return (
                                    <DriverCard key={code} code={code} meta={driverMap[code]} isSelected={!!pPos} isLocked={locked} onSelect={() => selectDriver(code)} selectedFor={pPos} />
                                )
                            })}
                        </div>

                        {/* Show Others Button */}
                        {!showAllDrivers && !locked && (
                            <button onClick={() => setShowAllDrivers(true)} className="w-full mt-3 py-2 rounded-lg border border-dashed border-[#2A2A30] text-gray-500 text-xs font-bold hover:bg-[#1A1A24]">
                                Show Full Grid
                            </button>
                        )}

                        <AnimatePresence>
                            {showAllDrivers && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3 overflow-hidden">
                                    {activeDrivers.filter(d => !contenders.includes(d.code)).map(d => {
                                        const pPos = Object.entries(podium).find(([p, code]) => code === d.code)?.[0];
                                        return (
                                            <DriverCard key={d.code} type="field" code={d.code} meta={d} isSelected={!!pPos} isLocked={locked} onSelect={() => selectDriver(d.code)} selectedFor={pPos} />
                                        )
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* EXTRAS (Keep existing UI for Pit, Gap, SC but disable if locked) */}
                    <div className="space-y-4 mb-6">
                        {/* Winning Margin */}
                        <div className="bg-[#0B0B0F] rounded-xl p-4 border border-[#2A2A30]">
                            <h4 className="text-sm font-bold text-green-400 flex items-center gap-2 mb-3"><Timer size={14} /> Winning Margin</h4>
                            <div className="flex bg-[#1A1A24] p-1 rounded-lg">
                                {['< 5s', '5-10s', '> 10s'].map(gap => (
                                    <button key={gap} onClick={() => !locked && setWinningGap(gap)} disabled={locked}
                                        className={cn("flex-1 py-2 rounded-md text-xs font-bold transition-all", winningGap === gap ? "bg-green-500 text-black" : "text-gray-400 hover:text-white")}
                                    >{gap}</button>
                                ))}
                            </div>
                        </div>

                        {/* PIT STRATEGY */}
                        <div className="bg-[#0B0B0F] rounded-xl p-4 border border-[#2A2A30]">
                            <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2 mb-3"><Activity size={14} /> Pit Stops</h4>
                            <div className="flex bg-[#1A1A24] p-1 rounded-lg">
                                {[1, 2, 3].map(stops => (
                                    <button key={stops} onClick={() => !locked && setPitStrategy(prev => ({ ...prev, stops }))} disabled={locked}
                                        className={cn("flex-1 py-2 rounded-md text-xs font-bold transition-all", pitStrategy.stops === stops ? "bg-blue-500 text-black" : "text-gray-400 hover:text-white")}
                                    >{stops} Stop{stops > 1 ? 's' : ''}</button>
                                ))}
                            </div>
                        </div>

                        {/* SAFETY CAR */}
                        <div className="bg-[#0B0B0F] rounded-xl p-4 border border-[#2A2A30]">
                            <h4 className="text-sm font-bold text-orange-400 flex items-center gap-2 mb-3"><AlertTriangle size={14} /> Safety Car</h4>
                            <div className="flex bg-[#1A1A24] p-1 rounded-lg">
                                {['Yes', 'No'].map(opt => (
                                    <button key={opt} onClick={() => !locked && setSafetyCar(prev => ({ ...prev, enabled: opt === 'Yes' }))} disabled={locked}
                                        className={cn("flex-1 py-2 rounded-md text-xs font-bold transition-all", (safetyCar.enabled ? 'Yes' : 'No') === opt ? "bg-orange-500 text-black" : "text-gray-400 hover:text-white")}
                                    >{opt}</button>
                                ))}
                            </div>
                        </div>

                        {/* DNF */}
                        <div className="bg-[#0B0B0F] rounded-xl p-4 border border-[#2A2A30]">
                            <h4 className="text-sm font-bold text-red-500 flex items-center gap-2 mb-3"><XCircle size={14} /> First DNF</h4>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                {activeDrivers.map(d => (
                                    <button key={d.code} onClick={() => !locked && setDnfPredictions(prev => prev.includes(d.code) ? [] : [d.code])} disabled={locked}
                                        className={cn("py-1 rounded text-[10px] font-bold border transition-all", dnfPredictions.includes(d.code) ? "bg-red-500 border-red-500 text-white" : "border-[#2A2A30] text-gray-500 hover:border-gray-500")}
                                    >
                                        {d.code}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {!locked && (
                        <button onClick={confirmVote} disabled={!podium[1]} className="w-full bg-f1-red hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2">
                            <Lock size={18} /> Lock In Prediction
                        </button>
                    )}
                </div>

                {/* RIGHT: COMMUNITY STATS (Dynamic) */}
                <div className="flex-1 flex flex-col gap-4">
                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-5 flex-1 flex flex-col min-h-0">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                            <BarChart3 size={14} /> Community Predictions {stats?.total_votes > 0 && <span className="ml-auto text-xs text-gray-500">{stats.total_votes} votes</span>}
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                            {!stats || stats.total_votes === 0 ? (
                                <div className="text-center text-gray-500 py-10">
                                    <p>No community data yet.</p>
                                    <p className="text-xs">Be the first to predict!</p>
                                </div>
                            ) : (
                                <>
                                    {/* WINNER STATS */}
                                    <div>
                                        <div className="text-[10px] text-gray-500 uppercase mb-2">Predicted Winner</div>
                                        {/* Display Top 5 P1 Picks */}
                                        {stats.podium[1].slice(0, 5).map((p, i) => (
                                            <div key={p.code} className="group mb-2">
                                                <div className="flex justify-between items-center text-xs mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1 h-3 rounded-full" style={{ backgroundColor: driverMap[p.code]?.color || '#666' }} />
                                                        <span className="font-bold text-white">{p.code}</span>
                                                    </div>
                                                    <span className="font-bold text-f1-red">{p.percent}%</span>
                                                </div>
                                                <div className="h-1.5 bg-[#0B0B0F] rounded-full overflow-hidden">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${p.percent}%` }} className="h-full bg-f1-red rounded-full" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* WINNING GAP */}
                                    <div className="pt-3 border-t border-[#2A2A30]">
                                        <div className="text-[10px] text-gray-500 uppercase mb-2">Winning Margin</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['< 5s', '5-10s', '> 10s'].map(gap => {
                                                const count = stats.winningGap[gap] || 0;
                                                const pct = Math.round((count / stats.total_votes) * 100) || 0;
                                                return (
                                                    <div key={gap} className="bg-[#0B0B0F] rounded-lg p-2 text-center">
                                                        <div className="text-xs text-gray-400">{gap}</div>
                                                        <div className="text-sm font-bold text-green-400">{pct}%</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* SAFETY CAR */}
                                    <div className="pt-3 border-t border-[#2A2A30]">
                                        <div className="text-[10px] text-gray-500 uppercase mb-2">Safety Car Probability</div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-[#0B0B0F] rounded-lg p-2 text-center">
                                                <div className="text-xs text-gray-400">Yes</div>
                                                <div className="text-lg font-bold text-orange-400">{Math.round((stats.safetyCar.yes / stats.total_votes) * 100) || 0}%</div>
                                            </div>
                                            <div className="flex-1 bg-[#0B0B0F] rounded-lg p-2 text-center">
                                                <div className="text-xs text-gray-400">No</div>
                                                <div className="text-lg font-bold text-gray-600">{Math.round((stats.safetyCar.no / stats.total_votes) * 100) || 0}%</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* PIT STRATEGY */}
                                    <div className="pt-3 border-t border-[#2A2A30]">
                                        <div className="text-[10px] text-gray-500 uppercase mb-2">Pit Stops Distribution</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[1, 2, 3].map(stops => {
                                                const count = stats.pitStrategy?.stop_dist?.[stops] || 0;
                                                const pct = Math.round((count / stats.total_votes) * 100) || 0;
                                                return (
                                                    <div key={stops} className="bg-[#0B0B0F] rounded-lg p-2 text-center">
                                                        <div className="text-xs text-gray-400">{stops} Stop{stops > 1 ? 's' : ''}</div>
                                                        <div className="text-sm font-bold text-blue-400">{pct}%</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>



                                    {/* DNF */}
                                    <div className="pt-3 border-t border-[#2A2A30]">
                                        <div className="text-[10px] text-gray-500 uppercase mb-2">Top DNF Risk</div>
                                        {Object.entries(stats.dnfPredictions || {})
                                            .sort(([, a], [, b]) => b - a)
                                            .slice(0, 3)
                                            .map(([code, count]) => (
                                                <div key={code} className="flex justify-between items-center mb-1 bg-[#0B0B0F] p-2 rounded">
                                                    <span className="text-xs font-bold text-white">{code}</span>
                                                    <span className="text-xs font-bold text-red-500">{Math.round((count / stats.total_votes) * 100)}%</span>
                                                </div>
                                            ))
                                        }
                                        {Object.keys(stats.dnfPredictions || {}).length === 0 && <div className="text-xs text-center text-gray-600 italic py-2">No DNFs predicted</div>}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
