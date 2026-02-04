
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy, Activity, Zap, AlertTriangle, MapPin, Calendar, CheckCircle2, ChevronRight,
    BarChart3, Brain, Lock, Info, Timer, Sun, CloudRain, Flame, Target, TrendingUp,
    Medal, Star, XCircle, Gauge, Users, Award, Sparkles, Clock
} from 'lucide-react';
import { cn } from '../lib/utils';
import API_BASE from '../config/api';

// --- SUB-COMPONENT: PODIUM SLOT ---
const PodiumSlot = ({ position, driver, color, onRemove, isLocked }) => {
    const heights = { 1: 'h-16 md:h-24', 2: 'h-14 md:h-20', 3: 'h-12 md:h-16' };
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
                            className="w-12 h-12 md:w-16 md:h-16 rounded-none flex items-center justify-center text-black font-heading font-bold text-lg md:text-xl border-2 border-black shadow-hard-sm"
                            style={{ backgroundColor: color }}
                        >
                            {driver}
                        </div>
                        {!isLocked && (
                            <button
                                onClick={onRemove}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold border border-white hover:bg-f1-red hover:border-black transition-colors"
                            >
                                ×
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        className="w-12 h-12 md:w-16 md:h-16 rounded-none border-2 border-dashed border-black/30 flex items-center justify-center text-gray-400 text-xs font-bold font-heading uppercase"
                    >
                        P{position}
                    </motion.div>
                )}
            </AnimatePresence>
            <div className={cn("w-16 md:w-20 rounded-none shadow-hard-sm flex flex-col items-center justify-end bg-gradient-to-t border-2 border-black", heights[position], medalColors[position])}>
                <span className="text-black font-black font-heading text-sm mb-1">{labels[position]}</span>
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
                "relative text-left transition-all overflow-hidden bg-white border",
                isSelected ? "border-current bg-gray-100" : "border-black hover:border-gray-600",
                isContender ? "p-3 md:p-4 rounded-none border-2" : "p-2 md:p-3 rounded-none opacity-80 hover:opacity-100",
                isLocked && !isSelected && "opacity-50 grayscale"
            )}
            style={{ borderColor: isSelected ? color : undefined }}
        >
            <div className="relative z-10 flex justify-between items-start">
                <div className="flex flex-col">
                    <span className={cn("font-bold text-black block", isContender ? "text-xl md:text-2xl" : "text-base md:text-lg")}>{code}</span>
                    <span className={cn("text-gray-600 font-bold uppercase", isContender ? "text-xs tracking-wider" : "text-xs")}>
                        {teamName}
                    </span>
                </div>
                {selectedFor && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/10" style={{ color: color }}>
                        P{selectedFor}
                    </span>
                )}
                {isSelected && isLocked && !selectedFor && <CheckCircle2 className="text-black" size={isContender ? 24 : 16} />}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: color }} />
        </motion.button>
    );
};

export default function Predictions() {
    const [activeDrivers, setActiveDrivers] = useState([]);
    const [driverMap, setDriverMap] = useState({});

    const [clientId, setClientId] = useState(localStorage.getItem('f1_client_id'));
    const [selectedRace, setSelectedRace] = useState(null);
    const [voteWindow, setVoteWindow] = useState({ is_open: false, status: 'LOADING' });
    const [stats, setStats] = useState(null);
    const [userVote, setUserVote] = useState(null);
    const [loading, setLoading] = useState(true);
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
    const [showPredictionForm, setShowPredictionForm] = useState(false);
    const [podiumTab, setPodiumTab] = useState(1);



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

    // Country Code Mapping (ISO Alpha-3 to Alpha-2 for FlagCDN)
    const COUNTRY_MAP = {
        'BHR': 'bh', 'SAU': 'sa', 'AUS': 'au', 'JPN': 'jp', 'CHN': 'cn', 'USA': 'us',
        'MIA': 'us', 'EMI': 'it', 'MON': 'mc', 'CAN': 'ca', 'ESP': 'es', 'AUT': 'at',
        'GBR': 'gb', 'HUN': 'hu', 'BEL': 'be', 'NED': 'nl', 'ITA': 'it', 'AZE': 'az',
        'SIN': 'sg', 'MEX': 'mx', 'BRA': 'br', 'LVG': 'us', 'QAT': 'qa', 'ABU': 'ae',
        'UNK': 'un'
    };

    const getFlagCode = (raceCode) => {
        if (!raceCode) return 'un';
        // Try direct map first
        const code = raceCode.toUpperCase();
        if (COUNTRY_MAP[code]) return COUNTRY_MAP[code];
        // Fallback to slicing if not in map (risky but better than nothing for straightforward ones like IT from ITA)
        return code.slice(0, 2).toLowerCase();
    };

    // 1. Initialize Identity & Fetch Data
    // 1. Initialize Identity & Fetch Data
    useEffect(() => {
        if (!clientId) {
            const newId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('f1_client_id', newId);
            setClientId(newId);
        }

        // Fetch Drivers - Reverted to 2026 as backend now supports fallback
        axios.get(`${API_BASE}/api/drivers?year=2026`)
            .then(res => {
                setActiveDrivers(res.data);
                // Create lookup map
                const map = {};
                res.data.forEach(d => map[d.code] = d);
                setDriverMap(map);
            })
            .catch(err => console.error("Error fetching drivers", err));

        // Fetch Active Race for Predictions (auto-selected by backend)
        axios.get(`${API_BASE}/api/predictions/active-race?year=2026`)
            .then(res => {
                if (res.data.race) {
                    setSelectedRace(res.data.race);
                    setVoteWindow(res.data.vote_window || { is_open: false, status: 'CLOSED' });
                }
            })
            .catch(err => console.error("Error fetching active race", err))
            .finally(() => setLoading(false));
    }, []); // Run once on mount

    // 2. Fetch Stats and Comments when Race Changes
    useEffect(() => {
        if (!selectedRace) return;
        setLoading(true);

        // CHECK LOCAL STORAGE FOR EXISTING VOTE
        const savedVote = localStorage.getItem(`f1_vote_${selectedRace.id}`);
        if (savedVote) {
            try {
                const parsed = JSON.parse(savedVote);
                setUserVote(parsed);
                setPodium(parsed.podium || {});
                if (parsed.winningGap) setWinningGap(parsed.winningGap);
                if (parsed.pitStrategy) setPitStrategy(parsed.pitStrategy);
                if (parsed.safetyCar) setSafetyCar(parsed.safetyCar);
            } catch (e) {
                console.error("Error parsing saved vote", e);
                setUserVote(null);
            }
        } else {
            setUserVote(null);
            setPodium({ 1: null, 2: null, 3: null });
            setWinningGap('5-10s');
            setDnfPredictions([]);
            setPitStrategy({ stops: 1, tyres: ['S', 'M', 'M', 'M'] });
            setSafetyCar({ enabled: true, count: 1 });
        }

        setShowAllDrivers(false);
        setShowResults(false);

        axios.get(`${API_BASE}/api/predictions/stats?race_id=${selectedRace.id}`)
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

        // Use vote window from backend
        return voteWindow.is_open;
    }, [voteWindow]);

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
        setShowPredictionForm(false); // Hide the form after submission

        // SAVE TO LOCAL STORAGE
        localStorage.setItem(`f1_vote_${selectedRace.id}`, JSON.stringify(votePayload));

        try {
            await axios.post(`${API_BASE}/api/predictions/vote`, {
                race_id: selectedRace.id,
                client_id: clientId,
                value: votePayload
            });
            refreshStats();
        } catch (e) { console.error(e); }
        setTimeout(() => setShowResults(true), 1000);
    };

    const refreshStats = async () => {
        if (!selectedRace) return;
        const res = await axios.get(`${API_BASE}/api/predictions/stats?race_id=${selectedRace.id}`);
        setStats(res.data);
    };

    // AI Prediction Mock (Static for now, could be dynamic later)
    const aiPrediction = { winner: "VER", p2: "NOR", p3: "LEC", confidence: 78, safetyCar: false, winningGap: "8.5s" };

    if (!selectedRace) return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[50vh]">
            <Trophy className="w-12 h-12 text-gray-300 mb-4 animate-pulse" />
            <div className="text-xl font-heading uppercase font-bold text-gray-400 animate-pulse">Loading Grand Prix Data...</div>
        </div>
    );

    const locked = !!userVote || !isPredictionWindowOpen;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-f1-light relative font-body">
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
                            className="bg-f1-paper rounded-none border-2 border-black p-8 max-w-md text-center shadow-lg"
                            onClick={e => e.stopPropagation()}
                        >
                            <Sparkles size={64} className="text-yellow-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-black mb-2 font-heading uppercase">Prediction Locked!</h2>
                            <p className="text-gray-600 mb-6">Good luck! Check the results after the race.</p>
                            <button onClick={() => setShowResults(false)} className="w-full bg-f1-red hover:bg-red-600 text-black font-heading uppercase font-bold py-3 rounded-none border-2 border-black shadow-hard-sm">Continue</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HEADER */}
            <header className="relative overflow-hidden bg-white border-b-2 border-black min-h-[140px] md:min-h-[200px] shrink-0 flex flex-col justify-end p-4 md:p-8">
                <div className="absolute inset-0 z-0">
                    <img
                        src={`https://flagcdn.com/w1280/${getFlagCode(selectedRace.code)}.png`}
                        alt=""
                        className="w-full h-full object-cover opacity-15 grayscale"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            {voteWindow.is_open ? (
                                <span className="px-3 py-1 bg-emerald-100 text-xs font-heading font-black text-emerald-700 border border-emerald-700 uppercase tracking-wide flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Voting Open
                                </span>
                            ) : voteWindow.status === 'CLOSED_TOO_EARLY' ? (
                                <span className="px-3 py-1 bg-yellow-100 text-xs font-heading font-black text-yellow-700 border border-yellow-700 uppercase tracking-wide flex items-center gap-1">
                                    <Clock size={12} className="text-yellow-700" />
                                    Opens Soon
                                </span>
                            ) : (
                                <span className="px-3 py-1 bg-red-100 text-xs font-heading font-black text-red-600 border border-red-600 uppercase tracking-wide">
                                    Voting Closed
                                </span>
                            )}
                            <span className="text-gray-600 text-xs font-bold font-mono">
                                {selectedRace.date} • RD {selectedRace.round}
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-6xl font-heading uppercase text-black tracking-tighter mb-1">
                            {selectedRace.name}
                        </h1>
                        <p className="text-gray-600 font-medium">Join the community prediction for this race</p>
                    </div>
                    <div className="z-20">
                        <div className={`
                            px-4 py-2 text-sm font-bold font-heading uppercase border-2 border-black shadow-hard-sm
                            ${voteWindow.is_open ? 'bg-f1-green text-black' : 'bg-f1-red text-white'}
                        `}>
                            {voteWindow.is_open ? 'VOTING OPEN' :
                                voteWindow.status === 'CLOSED_TOO_EARLY' ? 'VOTING OPENS SOON' : 'VOTING CLOSED'
                            }
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <div className="flex flex-col gap-4 md:gap-6 flex-1 min-h-0 overflow-hidden p-4 md:p-6 bg-f1-light">

                {/* MAKE PREDICTION BUTTON */}
                {!locked && !showPredictionForm && (
                    <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setShowPredictionForm(true)}
                        className="w-full bg-f1-paper hover:bg-white text-black font-heading uppercase font-bold text-lg md:text-xl py-4 md:py-6 rounded-none border-2 border-black shadow-hard transition-all flex items-center justify-center gap-3 min-h-[80px]"
                    >
                        <Zap className="text-f1-red" size={24} />
                        Join the Community Prediction
                        <ChevronRight className="text-gray-400" size={24} />
                    </motion.button>
                )}

                {/* USER PREDICTION FORM (Collapsible) */}
                <AnimatePresence>
                    {showPredictionForm && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className={cn("bg-f1-paper rounded-none border-2 border-black overflow-hidden shadow-hard", locked && "opacity-90 pointer-events-none")}
                        >
                            <div className="p-4 md:p-6">
                                <div className="flex items-center justify-between mb-6 border-b border-black/10 pb-4">
                                    <h3 className="text-lg font-heading uppercase font-bold text-black flex items-center gap-2">
                                        <Trophy size={18} className="text-f1-red" /> Your Prediction
                                    </h3>
                                    {!locked && (
                                        <button onClick={() => setShowPredictionForm(false)} className="text-gray-500 hover:text-black text-xs font-bold font-heading uppercase">
                                            Cancel
                                        </button>
                                    )}
                                </div>

                                {/* PODIUM */}
                                <div className="mb-8">
                                    <div className="text-xs font-bold font-heading uppercase text-gray-500 mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-f1-red" /> Click to Select Podium
                                    </div>
                                    <div className="flex justify-center items-end gap-2 md:gap-4 bg-white/50 border border-black p-6 shadow-inner">
                                        <PodiumSlot position={2} driver={podium[2]} color={podium[2] ? driverMap[podium[2]]?.color : '#666'} onRemove={() => removePodium(2)} isLocked={locked} />
                                        <PodiumSlot position={1} driver={podium[1]} color={podium[1] ? driverMap[podium[1]]?.color : '#666'} onRemove={() => removePodium(1)} isLocked={locked} />
                                        <PodiumSlot position={3} driver={podium[3]} color={podium[3] ? driverMap[podium[3]]?.color : '#666'} onRemove={() => removePodium(3)} isLocked={locked} />
                                    </div>
                                </div>

                                {/* DRIVER SELECTION */}
                                <div className="mb-8">
                                    <div className="text-xs font-bold font-heading uppercase text-gray-500 mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-f1-red" /> Contenders
                                    </div>
                                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
                                        {contenders.map(code => {
                                            const pPos = Object.entries(podium).find(([p, d]) => d === code)?.[0];
                                            return (
                                                <DriverCard key={code} code={code} meta={driverMap[code]} isSelected={!!pPos} isLocked={locked} onSelect={() => selectDriver(code)} selectedFor={pPos} />
                                            )
                                        })}
                                    </div>
                                    {!showAllDrivers && !locked && (
                                        <button onClick={() => setShowAllDrivers(true)} className="w-full mt-4 py-3 rounded-none border-2 border-dashed border-gray-300 text-gray-500 text-xs font-bold uppercase font-heading hover:border-black hover:text-black hover:bg-white transition-colors">
                                            View Full Grid
                                        </button>
                                    )}
                                    <AnimatePresence>
                                        {showAllDrivers && (
                                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3 overflow-hidden">
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

                                {/* EXTRAS */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                    <div className="bg-white rounded-none p-4 border-2 border-black shadow-hard-sm">
                                        <div className="text-xs font-bold font-heading uppercase text-gray-500 mb-2">Winning Gap</div>
                                        <div className="flex flex-col gap-1.5">
                                            {['< 5s', '5-10s', '> 10s'].map(gap => (
                                                <button key={gap} onClick={() => !locked && setWinningGap(gap)} disabled={locked}
                                                    className={cn("py-2 rounded-sm text-xs font-bold border font-heading uppercase transition-all", winningGap === gap ? "bg-black text-white border-black" : "bg-gray-50 text-gray-600 border-transparent hover:border-black hover:text-black")}
                                                >{gap}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-none p-4 border-2 border-black shadow-hard-sm">
                                        <div className="text-xs font-bold font-heading uppercase text-gray-500 mb-2">Pit Stops</div>
                                        <div className="flex flex-col gap-1.5">
                                            {[1, 2, 3].map(stops => (
                                                <button key={stops} onClick={() => !locked && setPitStrategy(prev => ({ ...prev, stops }))} disabled={locked}
                                                    className={cn("py-2 rounded-sm text-xs font-bold border font-heading uppercase transition-all", pitStrategy.stops === stops ? "bg-black text-white border-black" : "bg-gray-50 text-gray-600 border-transparent hover:border-black hover:text-black")}
                                                >{stops} Stop{stops > 1 ? 's' : ''}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-none p-4 border-2 border-black shadow-hard-sm">
                                        <div className="text-xs font-bold font-heading uppercase text-gray-500 mb-2">Safety Car</div>
                                        <div className="flex flex-col gap-1.5">
                                            {['Yes', 'No'].map(opt => (
                                                <button key={opt} onClick={() => !locked && setSafetyCar(prev => ({ ...prev, enabled: opt === 'Yes' }))} disabled={locked}
                                                    className={cn("py-2 rounded-sm text-xs font-bold border font-heading uppercase transition-all", (safetyCar.enabled ? 'Yes' : 'No') === opt ? "bg-black text-white border-black" : "bg-gray-50 text-gray-600 border-transparent hover:border-black hover:text-black")}
                                                >{opt}</button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* DNF Section Removed */}
                                </div>

                                {!locked && (
                                    <button onClick={confirmVote} disabled={!podium[1]} className="w-full bg-f1-red hover:bg-black text-white font-heading uppercase font-bold text-lg py-4 rounded-none border-2 border-black shadow-hard transform active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                        Lock In Prediction
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* COMMUNITY PREDICTIONS - Main Content */}
                <div className="bg-f1-paper rounded-none border-2 border-black p-4 md:p-6 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar shadow-hard">
                    <div className="flex items-center justify-between mb-6 border-b border-black/10 pb-4">
                        <h3 className="text-xl font-heading uppercase font-bold text-black flex items-center gap-2">
                            <Users className="text-black" /> Community Pulse
                        </h3>
                        {stats?.total_votes > 0 && (
                            <span className="px-3 py-1 bg-black text-white text-xs font-bold font-heading uppercase rounded-full">
                                {stats.total_votes} Votes Cast
                            </span>
                        )}
                    </div>

                    {!stats || stats.total_votes === 0 ? (
                        <div className="text-center text-gray-500 py-16 flex-1 flex flex-col items-center justify-center bg-white/50 border-2 border-dashed border-gray-300 m-4">
                            <Activity size={48} className="text-gray-300 mb-4" />
                            <p className="text-xl font-heading uppercase font-bold text-gray-400 mb-2">No Data Yet</p>
                            <p className="text-sm font-medium">Be the first to predict this race!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* MY PREDICTION SUMMARY CARD (only if voted) */}
                            {userVote && (
                                <div className="bg-f1-paper text-black rounded-none p-5 border-2 border-f1-red shadow-hard-sm flex flex-col relative overflow-hidden group min-h-[220px]">
                                    <div className="absolute top-0 right-0 p-2 opacity-5 text-f1-red rotate-12 scale-150 transform transition-transform group-hover:scale-125"><Zap size={120} /></div>
                                    <div className="text-xs font-bold font-heading uppercase text-f1-red mb-4 flex items-center gap-1.5 relative z-10 border-b-2 border-f1-red/10 pb-2">
                                        <Zap size={14} /> Your Prediction
                                    </div>
                                    <div className="flex-1 flex flex-col gap-3 relative z-10">
                                        {/* Podium List */}
                                        <div className="flex flex-col gap-2">
                                            {[1, 2, 3].map((pos) => (
                                                <div
                                                    key={pos}
                                                    className="flex items-center justify-between p-3 bg-white border-l-4 shadow-sm transition-all"
                                                    style={{ borderLeftColor: driverMap[userVote.podium[pos]]?.color || '#ccc' }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={cn(
                                                            "text-sm font-black font-heading w-8",
                                                            pos === 1 ? "text-f1-red" : "text-gray-400"
                                                        )}>
                                                            {pos === 1 ? 'P1' : pos === 2 ? 'P2' : 'P3'}
                                                        </span>
                                                        <span className="font-bold font-heading text-lg text-black">
                                                            {userVote.podium[pos]}
                                                        </span>
                                                    </div>
                                                    {pos === 1 && <Trophy size={16} className="text-f1-red" />}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mt-auto pt-2 border-t border-black/5">
                                            <div className="bg-white p-2 border border-black/5">
                                                <span className="block text-xs font-heading font-medium text-gray-400 uppercase mb-0.5">Gap</span>
                                                <span className="font-bold text-sm text-black">{userVote.winningGap}</span>
                                            </div>
                                            <div className="bg-white p-2 border border-black/5">
                                                <span className="block text-xs font-heading font-medium text-gray-400 uppercase mb-0.5">Strategy</span>
                                                <span className="font-bold text-sm text-black">{userVote.pitStrategy?.stops} Stop(s)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* COMMUNITY PODIUM PREDICTIONS */}
                            <div className="bg-white rounded-none p-5 border-2 border-black shadow-hard-sm flex flex-col min-h-[220px]">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="text-xs font-bold font-heading uppercase text-gray-500 flex items-center gap-1.5">
                                        <Trophy size={14} /> Community Podium
                                    </div>
                                    <div className="flex bg-gray-100 rounded-none border border-black p-0.5">
                                        {[1, 2, 3].map(pos => (
                                            <button
                                                key={pos}
                                                onClick={() => setPodiumTab(pos)}
                                                className={cn(
                                                    "px-3 py-0.5 text-xs font-bold font-heading uppercase transition-all",
                                                    podiumTab === pos ? "bg-black text-white shadow-sm" : "text-gray-500 hover:text-black"
                                                )}
                                            >
                                                P{pos}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1 space-y-3">
                                    {stats.podium[podiumTab] && stats.podium[podiumTab].slice(0, 5).map((p, i) => {
                                        const isUserPick = userVote?.podium?.[podiumTab] === p.code;
                                        return (
                                            <div key={p.code} className="relative group">
                                                <div className="flex justify-between items-end text-sm mb-1 relative z-10">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-3 rounded-none" style={{ backgroundColor: driverMap[p.code]?.color || '#666' }} />
                                                        <span className="font-bold text-black font-heading uppercase text-base leading-none">{p.code}</span>
                                                        {isUserPick && (
                                                            <span className="ml-1 px-1.5 py-[1px] bg-black text-white text-[8px] font-bold rounded-sm uppercase tracking-wide">You</span>
                                                        )}
                                                    </div>
                                                    <span className="font-black text-black text-xs">{p.percent}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 border border-black/30 rounded-none overflow-hidden relative">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${p.percent}%` }}
                                                        className="h-full absolute left-0 top-0"
                                                        style={{ backgroundColor: driverMap[p.code]?.color || '#666' }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!stats.podium[podiumTab] || stats.podium[podiumTab].length === 0) && (
                                        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs font-medium italic py-4">
                                            No predictions for P{podiumTab} yet
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* WINNING MARGIN */}
                            <div className="bg-white rounded-none p-5 border-2 border-black shadow-hard-sm flex flex-col">
                                <div className="text-xs font-bold font-heading uppercase text-gray-500 mb-4 flex items-center gap-1.5">
                                    <Timer size={14} /> Winning Margin
                                </div>
                                <div className="space-y-4 flex-1">
                                    {['< 5s', '5-10s', '> 10s'].map(gap => {
                                        const count = stats.winningGap[gap] || 0;
                                        const pct = Math.round((count / stats.total_votes) * 100) || 0;
                                        const isUserPick = userVote?.winningGap === gap;
                                        return (
                                            <div key={gap}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold font-heading uppercase text-gray-600">{gap}</span>
                                                        {isUserPick && <span className="text-[9px] font-bold text-f1-red uppercase bg-f1-red/10 px-1 rounded-sm">You</span>}
                                                    </div>
                                                    <span className="text-sm font-black text-black">{pct}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 border border-black/20 rounded-none overflow-hidden">
                                                    {pct > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-black" />}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* SAFETY CAR & PIT STOPS */}
                            <div className="bg-white rounded-none p-5 border-2 border-black shadow-hard-sm flex flex-col">
                                <div className="text-xs font-bold font-heading uppercase text-gray-500 mb-4 flex items-center gap-1.5">
                                    <AlertTriangle size={14} /> Race Factors
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold font-heading uppercase text-gray-600">Safety Car</span>
                                                {userVote?.safetyCar?.enabled && <span className="text-[9px] font-bold text-f1-red uppercase bg-f1-red/10 px-1 rounded-sm">You</span>}
                                            </div>
                                            <span className="text-lg font-black text-black">{Math.round((stats.safetyCar.yes / stats.total_votes) * 100) || 0}% <span className="text-xs font-medium text-gray-500">YES</span></span>
                                        </div>
                                        <div className="w-full h-3 bg-gray-100 border border-black rounded-none overflow-hidden flex">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.round((stats.safetyCar.yes / stats.total_votes) * 100) || 0}%` }}
                                                className="h-full bg-f1-red"
                                            />
                                        </div>
                                    </div>

                                    <div className="border-t border-black/10 pt-4">
                                        <div className="text-xs font-bold font-heading uppercase text-gray-500 mb-3">Pit Strategy Consensus</div>
                                        <div className="flex gap-2">
                                            {[1, 2, 3].map(stops => {
                                                const count = stats.pitStrategy?.stop_dist?.[stops] || 0;
                                                const pct = Math.round((count / stats.total_votes) * 100) || 0;
                                                const isHighest = pct >= 50;
                                                const isUserPick = userVote?.pitStrategy?.stops === stops;
                                                return (
                                                    <div key={stops} className={cn("flex-1 p-2 text-center border transition-all relative", isHighest ? "bg-black text-white border-black" : "bg-gray-50 text-gray-600 border-gray-200")}>
                                                        {isUserPick && <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-f1-red rounded-full border border-black" />}
                                                        <div className="text-xs font-heading uppercase opacity-80">{stops} Stop</div>
                                                        <div className="text-lg font-black leading-none mt-1">{pct}%</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>


            </div>
        </div>
    );
}
