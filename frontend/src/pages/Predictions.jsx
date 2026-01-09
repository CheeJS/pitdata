
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy, Activity, Zap, AlertTriangle, MapPin, Calendar, CheckCircle2, ChevronRight,
    BarChart3, Brain, Lock, Info, Timer, Sun, CloudRain, Flame, Target, TrendingUp,
    Medal, Star, XCircle, Gauge, Users, Award, Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

// --- DATA CONSTANTS ---
const DRIVER_DATA = {
    "VER": { team: "Red Bull Racing", color: "#3671C6", probability: 42, dnfRisk: 5 },
    "NOR": { team: "McLaren", color: "#F58020", probability: 28, dnfRisk: 8 },
    "LEC": { team: "Ferrari", color: "#F91536", probability: 12, dnfRisk: 12 },
    "HAM": { team: "Ferrari", color: "#F91536", probability: 8, dnfRisk: 6 },
    "PIA": { team: "McLaren", color: "#F58020", probability: 5, dnfRisk: 10 },
    "RUS": { team: "Mercedes", color: "#6CD3BF", probability: 4, dnfRisk: 9 },
    "SAI": { team: "Williams", color: "#37BEDD", probability: 0.8, dnfRisk: 15 },
    "ALO": { team: "Aston Martin", color: "#358C75", probability: 0.2, dnfRisk: 8 },
    "STR": { team: "Aston Martin", color: "#358C75", probability: 0, dnfRisk: 18 },
    "TSU": { team: "RB", color: "#6692FF", probability: 0, dnfRisk: 14 },
    "GAS": { team: "Alpine", color: "#2293D1", probability: 0, dnfRisk: 16 },
    "ALB": { team: "Williams", color: "#37BEDD", probability: 0, dnfRisk: 12 },
    "OCO": { team: "Haas F1 Team", color: "#B6BABD", probability: 0, dnfRisk: 20 },
    "HUL": { team: "Sauber", color: "#52E252", probability: 0, dnfRisk: 18 },
    "LAW": { team: "Red Bull Racing", color: "#3671C6", probability: 0, dnfRisk: 22 },
    "BEA": { team: "Haas F1 Team", color: "#B6BABD", probability: 0, dnfRisk: 25 },
    "ANT": { team: "Mercedes", color: "#6CD3BF", probability: 0, dnfRisk: 20 },
    "DOO": { team: "Alpine", color: "#2293D1", probability: 0, dnfRisk: 28 },
    "BOR": { team: "Sauber", color: "#52E252", probability: 0, dnfRisk: 22 },
    "HAD": { team: "RB", color: "#6692FF", probability: 0, dnfRisk: 24 },
};

const CONTENDERS = ['VER', 'NOR', 'LEC', 'HAM', 'PIA', 'RUS'];

// Mock user stats (would come from backend in production)
const MOCK_USER_STATS = {
    accuracy: 67,
    streak: 3,
    points: 1250,
    correctPredictions: 8,
    totalPredictions: 12,
    rank: 42,
    history: [
        { race: "Bahrain GP", predicted: "VER", actual: "VER", correct: true },
        { race: "Saudi GP", predicted: "VER", actual: "VER", correct: true },
        { race: "Australian GP", predicted: "NOR", actual: "VER", correct: false },
        { race: "Japanese GP", predicted: "VER", actual: "VER", correct: true },
    ]
};

// Mock leaderboard
const MOCK_LEADERBOARD = [
    { name: "F1Oracle", points: 2450, accuracy: 82, streak: 5 },
    { name: "PitStopPro", points: 2100, accuracy: 75, streak: 2 },
    { name: "GridWizard", points: 1980, accuracy: 71, streak: 4 },
    { name: "You", points: 1250, accuracy: 67, streak: 3, isUser: true },
    { name: "RacePredictor", points: 1150, accuracy: 64, streak: 1 },
];

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
                {selectedFor && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/10" style={{ color: meta.color }}>
                        P{selectedFor}
                    </span>
                )}
                {isSelected && isLocked && !selectedFor && <CheckCircle2 className="text-white" size={isContender ? 24 : 16} />}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: meta.color }} />
        </motion.button>
    );
};

// --- SUB-COMPONENT: STAT CARD ---
const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
    <div className="bg-[#0B0B0F] border border-[#2A2A30] rounded-xl p-4 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
            <Icon size={20} className="text-white" />
        </div>
        <div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-xs text-gray-500 uppercase">{label}</div>
            {subtext && <div className="text-[10px] text-gray-600">{subtext}</div>}
        </div>
    </div>
);


export default function Predictions() {
    const [races, setRaces] = useState([]);
    const [clientId, setClientId] = useState(localStorage.getItem('f1_client_id'));
    const [selectedRace, setSelectedRace] = useState(null);
    const [stats, setStats] = useState(null);
    const [userVote, setUserVote] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Podium State
    const [podium, setPodium] = useState({ 1: null, 2: null, 3: null });
    const [selectingPosition, setSelectingPosition] = useState(1);

    // Side Predictions
    const [fastestLap, setFastestLap] = useState(null);
    const [dnfPredictions, setDnfPredictions] = useState([]);
    const [weather, setWeather] = useState('dry');
    const [pitStrategy, setPitStrategy] = useState({ stops: 1, tyres: ['S', 'M', 'M', 'M'] });
    const [scProbability, setScProbability] = useState(50);

    // Tyre Data
    const TYRE_COLORS = {
        'S': { color: '#FF3333', name: 'Soft' },
        'M': { color: '#FFE040', name: 'Medium' },
        'H': { color: '#F0F0F0', name: 'Hard' },
        'I': { color: '#39B54A', name: 'Inter' },
        'W': { color: '#366CD9', name: 'Wet' },
    };

    // Update tyres when stops change
    const updateStops = (n) => {
        if (userVote) return;
        setPitStrategy(prev => {
            // Adjust tyres array size based on stops (stops + 1 stints)
            const newTyres = [...prev.tyres];
            return { ...prev, stops: n, tyres: newTyres };
        });
    };

    const cycleTyre = (index) => {
        if (userVote) return;
        const compounds = weather === 'wet' ? ['S', 'M', 'H', 'I', 'W'] : ['S', 'M', 'H'];

        setPitStrategy(prev => {
            const currentTyre = prev.tyres[index] || 'M';
            const nextIdx = (compounds.indexOf(currentTyre) + 1) % compounds.length;
            const newTyres = [...prev.tyres];
            newTyres[index] = compounds[nextIdx];
            return { ...prev, tyres: newTyres };
        });
    };

    // User Stats
    const [userStats] = useState(MOCK_USER_STATS);

    // UI State
    const [showAllDrivers, setShowAllDrivers] = useState(false);
    const [activeTab, setActiveTab] = useState('podium'); // 'podium' | 'extras'

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
        setUserVote(null);
        setPodium({ 1: null, 2: null, 3: null });
        setFastestLap(null);
        setDnfPredictions([]);
        setShowAllDrivers(false);
        setShowResults(false);

        axios.get(`http://localhost:5000/api/predictions/stats?race_id=${selectedRace.id}`)
            .then(res => setStats(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [selectedRace]);

    // Select driver for podium
    const selectDriver = (driver) => {
        if (userVote) return;

        // Check if already in podium
        const existingPos = Object.entries(podium).find(([pos, d]) => d === driver)?.[0];
        if (existingPos) {
            // Remove from current position
            setPodium(prev => ({ ...prev, [existingPos]: null }));
            return;
        }

        // Add to next empty position
        if (!podium[1]) {
            setPodium(prev => ({ ...prev, 1: driver }));
        } else if (!podium[2]) {
            setPodium(prev => ({ ...prev, 2: driver }));
        } else if (!podium[3]) {
            setPodium(prev => ({ ...prev, 3: driver }));
        }
    };

    // Remove from podium
    const removePodium = (position) => {
        setPodium(prev => ({ ...prev, [position]: null }));
    };

    // Toggle DNF
    const toggleDNF = (driver) => {
        if (userVote) return;
        setDnfPredictions(prev =>
            prev.includes(driver)
                ? prev.filter(d => d !== driver)
                : [...prev, driver]
        );
    };

    // Submit Handlers
    const confirmVote = async () => {
        if (!podium[1]) return;

        const votePayload = {
            podium,
            fastestLap,
            dnfPredictions,
            weather,
            pitStrategy,
            scProbability
        };
        setUserVote(votePayload);

        try {
            await axios.post('http://localhost:5000/api/predictions/vote', {
                race_id: selectedRace.id,
                client_id: clientId,
                category: "winner",
                value: { code: podium[1], confidence: 75 }
            });
            refreshStats();
        } catch (e) { console.error(e); }

        // Trigger animated results after 2 seconds
        setTimeout(() => setShowResults(true), 2000);
    };

    const refreshStats = async () => {
        const res = await axios.get(`http://localhost:5000/api/predictions/stats?race_id=${selectedRace.id}`);
        setStats(res.data);
    };

    // AI prediction based on weather
    const aiPrediction = useMemo(() => {
        if (weather === 'wet') {
            return { winner: "HAM", p2: "VER", p3: "NOR", confidence: 65, safetyCar: 85, fastestLap: "VER" };
        }
        return { winner: "VER", p2: "NOR", p3: "LEC", confidence: 78, safetyCar: 55, fastestLap: "NOR" };
    }, [weather]);

    const podiumFilled = podium[1] && podium[2] && podium[3];

    if (!selectedRace) return <div className="p-8 text-white animate-pulse">Loading Grand Prix Data...</div>;

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500 overflow-hidden">
            {/* ANIMATED RESULTS OVERLAY */}
            <AnimatePresence>
                {showResults && userVote && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
                        onClick={() => setShowResults(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-8 max-w-md text-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                            >
                                <Sparkles size={64} className="text-yellow-500 mx-auto mb-4" />
                            </motion.div>
                            <h2 className="text-2xl font-bold text-white mb-2">Prediction Locked!</h2>
                            <p className="text-gray-400 mb-6">Your prediction has been recorded. Check back after the race to see your results!</p>

                            <div className="bg-[#0B0B0F] rounded-xl p-4 mb-6">
                                <div className="text-xs text-gray-500 uppercase mb-2">Your Podium</div>
                                <div className="flex justify-center gap-4 text-lg font-bold">
                                    <span className="text-yellow-400">🥇 {podium[1]}</span>
                                    <span className="text-gray-300">🥈 {podium[2]}</span>
                                    <span className="text-orange-400">🥉 {podium[3]}</span>
                                </div>
                            </div>

                            {userStats.streak > 0 && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="flex items-center justify-center gap-2 text-orange-500 mb-4"
                                >
                                    <Flame size={20} />
                                    <span className="font-bold">{userStats.streak} Race Streak!</span>
                                </motion.div>
                            )}

                            <button
                                onClick={() => setShowResults(false)}
                                className="w-full bg-f1-red hover:bg-red-600 text-white font-bold py-3 rounded-xl"
                            >
                                Continue
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 1. HEADER */}
            <div className="bg-[#15151E] border border-[#2A2A30] rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center shadow-lg relative overflow-hidden shrink-0 mx-6 mt-6">
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

                <div className="flex items-center gap-4 mt-4 md:mt-0 z-10">
                    {/* Weather Toggle */}
                    <div className="flex bg-[#0B0B0F] rounded-lg p-1 border border-[#2A2A30]">
                        <button
                            onClick={() => !userVote && setWeather('dry')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all",
                                weather === 'dry' ? "bg-yellow-500/20 text-yellow-400" : "text-gray-500"
                            )}
                        >
                            <Sun size={14} /> Dry
                        </button>
                        <button
                            onClick={() => !userVote && setWeather('wet')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all",
                                weather === 'wet' ? "bg-blue-500/20 text-blue-400" : "text-gray-500"
                            )}
                        >
                            <CloudRain size={14} /> Wet
                        </button>
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



            {/* 3. MAIN CONTENT */}
            <div className="flex gap-6 flex-1 min-h-0 overflow-hidden p-6">
                {/* LEFT: PREDICTION PANEL */}
                <div className={cn("flex-[1.5] bg-[#15151E] rounded-3xl border border-[#2A2A30] flex flex-col p-6 overflow-y-auto custom-scrollbar", userVote && "opacity-80")}>

                    {/* PODIUM VISUALIZATION */}
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                            <Trophy size={18} className="text-yellow-500" /> Podium Prediction
                        </h3>
                        <div className="flex justify-center items-end gap-4 bg-[#0B0B0F] rounded-xl p-6 relative">
                            <PodiumSlot position={2} driver={podium[2]} color={podium[2] ? DRIVER_DATA[podium[2]]?.color : '#666'} onRemove={() => removePodium(2)} isLocked={!!userVote} />
                            <PodiumSlot position={1} driver={podium[1]} color={podium[1] ? DRIVER_DATA[podium[1]]?.color : '#666'} onRemove={() => removePodium(1)} isLocked={!!userVote} />
                            <PodiumSlot position={3} driver={podium[3]} color={podium[3] ? DRIVER_DATA[podium[3]]?.color : '#666'} onRemove={() => removePodium(3)} isLocked={!!userVote} />
                        </div>
                    </div>

                    {/* DRIVER SELECTION */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm text-gray-400">Select drivers for podium (click to add/remove)</span>
                            {userVote && <span className="text-xs text-f1-red flex items-center gap-1"><Lock size={10} /> Locked</span>}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {CONTENDERS.map(driver => {
                                const podiumPos = Object.entries(podium).find(([pos, d]) => d === driver)?.[0];
                                return (
                                    <DriverCard
                                        key={driver}
                                        code={driver}
                                        meta={DRIVER_DATA[driver]}
                                        isSelected={!!podiumPos}
                                        isLocked={!!userVote}
                                        onSelect={() => selectDriver(driver)}
                                        type="contender"
                                        selectedFor={podiumPos}
                                    />
                                );
                            })}
                        </div>

                        {!showAllDrivers && !userVote && (
                            <button
                                onClick={() => setShowAllDrivers(true)}
                                className="w-full mt-3 py-2 rounded-lg border border-dashed border-[#2A2A30] text-gray-500 text-xs font-bold hover:bg-[#1A1A24]"
                            >
                                Show Full Grid
                            </button>
                        )}

                        <AnimatePresence>
                            {showAllDrivers && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="grid grid-cols-4 gap-2 mt-3 overflow-hidden">
                                    {Object.keys(DRIVER_DATA).filter(d => !CONTENDERS.includes(d)).map(driver => {
                                        const podiumPos = Object.entries(podium).find(([pos, d]) => d === driver)?.[0];
                                        return (
                                            <DriverCard
                                                key={driver}
                                                code={driver}
                                                meta={DRIVER_DATA[driver]}
                                                isSelected={!!podiumPos}
                                                isLocked={!!userVote}
                                                onSelect={() => selectDriver(driver)}
                                                type="field"
                                                selectedFor={podiumPos}
                                            />
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* SIDE PREDICTIONS */}
                    <div className="space-y-4 mb-6">
                        {/* Pit Strategy */}
                        <div className="bg-[#0B0B0F] rounded-xl p-4 border border-[#2A2A30]">
                            <h4 className="text-sm font-bold text-cyan-400 flex items-center gap-2 mb-3">
                                <Gauge size={14} /> Pit Strategy
                            </h4>

                            {/* Stop Count */}
                            <div className="flex bg-[#1A1A24] p-1 rounded-lg mb-4">
                                {[1, 2, 3].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => updateStops(n)}
                                        disabled={!!userVote}
                                        className={cn(
                                            "flex-1 py-1.5 rounded-md text-xs font-bold transition-all",
                                            pitStrategy.stops === n
                                                ? "bg-cyan-500 text-black shadow-lg"
                                                : "text-gray-400 hover:text-white"
                                        )}
                                    >
                                        {n} Stop{n > 1 ? 's' : ''}
                                    </button>
                                ))}
                            </div>

                            {/* Tyre Stints */}
                            <div className="flex items-center justify-between gap-2 overflow-hidden py-2" style={{ minHeight: '80px' }}>
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {Array.from({ length: pitStrategy.stops + 1 }).map((_, i) => (
                                        <React.Fragment key={`stint-${i}`}>
                                            <motion.div
                                                className="flex flex-col items-center gap-1 group cursor-pointer relative z-10"
                                                onClick={() => cycleTyre(i)}
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                transition={{ type: "spring", stiffness: 300, damping: 25, delay: i * 0.1 }}
                                            >
                                                <AnimatePresence mode="wait">
                                                    <motion.div
                                                        key={pitStrategy.tyres[i] || 'M'}
                                                        initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
                                                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                                                        exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="w-12 h-12 rounded-full border-4 flex items-center justify-center text-sm font-bold bg-[#15151E] shadow-lg transition-colors"
                                                        style={{
                                                            borderColor: TYRE_COLORS[pitStrategy.tyres[i] || 'M'].color,
                                                            color: TYRE_COLORS[pitStrategy.tyres[i] || 'M'].color,
                                                            boxShadow: `0 0 10px ${TYRE_COLORS[pitStrategy.tyres[i] || 'M'].color}40`
                                                        }}
                                                    >
                                                        {pitStrategy.tyres[i] || 'M'}
                                                    </motion.div>
                                                </AnimatePresence>
                                                <motion.span
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-[10px] text-gray-500 uppercase font-bold"
                                                >
                                                    {i === 0 ? 'Start' : i === pitStrategy.stops ? 'End' : `Stint ${i + 1}`}
                                                </motion.span>
                                            </motion.div>

                                            {i < pitStrategy.stops && (
                                                <motion.div
                                                    initial={{ scaleX: 0, opacity: 0 }}
                                                    animate={{ scaleX: 1, opacity: 1 }}
                                                    transition={{ delay: i * 0.1 + 0.1 }}
                                                >
                                                    <ChevronRight size={20} className="text-gray-600/50" />
                                                </motion.div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>


                        {/* Safety Car */}
                        <div className="bg-[#0B0B0F] rounded-xl p-4 border border-[#2A2A30]">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-bold text-orange-400 flex items-center gap-2">
                                    <AlertTriangle size={14} /> Safety Car
                                </h4>
                                <span className="text-lg font-mono font-bold text-orange-400">{scProbability}%</span>
                            </div>
                            <input
                                type="range" min="0" max="100" value={scProbability}
                                disabled={!!userVote}
                                onChange={(e) => setScProbability(parseInt(e.target.value))}
                                className="w-full h-2 bg-[#2A2A30] rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                        </div>
                    </div>

                    {/* SUBMIT */}
                    {!userVote && (
                        <button
                            onClick={confirmVote}
                            disabled={!podium[1]}
                            className="w-full bg-gradient-to-r from-f1-red to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <Lock size={18} /> Lock In Prediction
                        </button>
                    )}
                </div>

                {/* RIGHT: INSIGHTS & LEADERBOARD */}
                <div className="flex-1 flex flex-col gap-4">
                    {/* AI vs You Comparison */}
                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-5">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                            <Brain size={14} /> AI vs Your Prediction
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#0B0B0F] rounded-xl p-4 border border-purple-500/30">
                                <div className="text-xs text-purple-400 uppercase mb-2">AI Prediction</div>
                                <div className="text-lg font-bold text-white mb-1">
                                    🥇 {aiPrediction.winner} 🥈 {aiPrediction.p2} 🥉 {aiPrediction.p3}
                                </div>
                                <div className="text-xs text-gray-500">
                                    FL: {aiPrediction.fastestLap} | SC: {aiPrediction.safetyCar}%
                                </div>
                            </div>
                            <div className={cn("bg-[#0B0B0F] rounded-xl p-4 border", userVote ? "border-f1-red/30" : "border-[#2A2A30]")}>
                                <div className="text-xs text-f1-red uppercase mb-2">Your Prediction</div>
                                {podium[1] ? (
                                    <>
                                        <div className="text-lg font-bold text-white mb-1">
                                            🥇 {podium[1]} 🥈 {podium[2] || '?'} 🥉 {podium[3] || '?'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            FL: {fastestLap || '?'} | SC: {scProbability}%
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-gray-600">Make your prediction...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Community Stats - Coming Soon */}
                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-5 flex-1 min-h-0 flex flex-col">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                            <BarChart3 size={14} /> Community Predictions
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {stats?.winner?.length > 0 ? (
                                stats.winner.map((w, i) => (
                                    <div key={w.code} className="group">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className={cn("font-bold", i === 0 ? "text-white" : "text-gray-400")}>{w.code}</span>
                                            <span className="text-gray-500">{w.percent}%</span>
                                        </div>
                                        <div className="h-2 bg-[#0B0B0F] rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${w.percent}%` }}
                                                className={cn("h-full rounded-full transition-colors", i === 0 ? "bg-f1-red" : "bg-gray-700 group-hover:bg-gray-500")}
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                    <BarChart3 size={32} className="mb-2 text-gray-600" />
                                    <p className="text-xs text-gray-500">Be the first to predict!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
