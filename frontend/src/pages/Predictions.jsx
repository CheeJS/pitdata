
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
    const [winningGap, setWinningGap] = useState('5-10s');
    const [dnfPredictions, setDnfPredictions] = useState([]);
    const [weather, setWeather] = useState('dry');
    const [pitStrategy, setPitStrategy] = useState({ stops: 1, tyres: ['S', 'M', 'M', 'M'] });
    const [safetyCar, setSafetyCar] = useState({ enabled: true, count: 1 });

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
        axios.get('http://localhost:5000/api/races?year=2026')
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
        setWinningGap('5-10s');
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
            return { winner: "HAM", p2: "VER", p3: "NOR", confidence: 65, safetyCar: true, winningGap: "4.2s" };
        }
        return { winner: "VER", p2: "NOR", p3: "LEC", confidence: 78, safetyCar: false, winningGap: "8.5s" };
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

            {/* 1. HEADER - DASHBOARD STYLE HERO */}
            <header className="relative overflow-hidden rounded-2xl bg-[#09090B] border border-[#222] min-h-[220px] md:min-h-[280px] mx-3 md:mx-6 mt-3 md:mt-6 shrink-0 flex flex-col justify-end p-6 md:p-10 group">
                {/* Background Flag - Full Cover with Gradient */}
                <div className="absolute inset-0 z-0">
                    {(() => {
                        const flagCodes = {
                            'Australian': 'au', 'Bahrain': 'bh', 'Saudi Arabian': 'sa', 'Japanese': 'jp',
                            'Chinese': 'cn', 'Miami': 'us', 'Emilia Romagna': 'it', 'Monaco': 'mc',
                            'Canadian': 'ca', 'Spanish': 'es', 'Austrian': 'at', 'British': 'gb',
                            'Hungarian': 'hu', 'Belgian': 'be', 'Dutch': 'nl', 'Italian': 'it',
                            'Azerbaijan': 'az', 'Singapore': 'sg', 'United States': 'us', 'Mexico': 'mx',
                            'Brazilian': 'br', 'Las Vegas': 'us', 'Qatar': 'qa', 'Abu Dhabi': 'ae'
                        };
                        const code = flagCodes[selectedRace.name] || 'un';
                        return (
                            <>
                                {/* Vivid Flag Image */}
                                <img
                                    src={`https://flagcdn.com/w1280/${code}.png`}
                                    alt=""
                                    className="w-full h-full object-cover opacity-20 md:opacity-15 md:group-hover:opacity-20 transition-opacity duration-700"
                                />
                                {/* Gradient Overlays for Text Readability */}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/80 to-transparent" />
                                <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/60 to-transparent" />
                            </>
                        );
                    })()}
                </div>

                {/* Accent Line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-f1-red to-transparent z-20" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    {/* Left: Race Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 rounded-full bg-f1-red/10 text-xs font-bold text-f1-red border border-f1-red/20 uppercase tracking-wider">
                                Predictions Open
                            </span>
                            <span className="text-gray-400 text-sm font-medium tracking-wide border-l border-gray-700 pl-3">
                                {selectedRace.date}
                            </span>
                        </div>

                        <div className="flex flex-col gap-1 mb-2">
                            <div className="flex items-center gap-3 text-white/50 text-sm md:text-base font-medium tracking-[0.2em] uppercase">
                                Round {races.findIndex(r => r.id === selectedRace.id) + 1}
                            </div>
                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white italic uppercase tracking-tighter leading-[0.9]">
                                {selectedRace.name}
                            </h1>
                        </div>

                        <div className="flex items-center gap-2 text-gray-400 mt-2">
                            <MapPin size={16} className="text-f1-red" />
                            <span className="text-sm md:text-base font-medium">{selectedRace.circuit || "Circuit"}</span>
                        </div>
                    </div>

                    {/* Right: Controls */}
                    <div className="flex flex-col items-end gap-3 z-20">
                        <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Select Race</label>
                        <select
                            className="bg-black/50 backdrop-blur-md border border-white/10 text-white text-sm rounded-lg py-3 px-4 outline-none focus:border-f1-red focus:ring-1 focus:ring-f1-red transition-all cursor-pointer min-w-[200px]"
                            value={selectedRace.id}
                            onChange={e => setSelectedRace(races.find(r => r.id == e.target.value))}
                        >
                            {races.map(r => <option key={r.id} value={r.id}>{r.name} GP</option>)}
                        </select>
                    </div>
                </div>
            </header>



            {/* 3. MAIN CONTENT */}
            <div className="flex flex-col lg:flex-row gap-4 md:gap-6 flex-1 min-h-0 overflow-hidden p-3 md:p-6">
                {/* LEFT: PREDICTION PANEL */}
                <div className={cn("flex-1 lg:flex-[1.5] bg-[#15151E] rounded-2xl md:rounded-3xl border border-[#2A2A30] flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar", userVote && "opacity-80")}>

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
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3 overflow-hidden">
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
                                        <motion.div
                                            key={`stint-${i}`}
                                            layout
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            transition={{ duration: 0.3 }}
                                            className="flex items-center"
                                        >
                                            <div className="flex flex-col items-center gap-1 group cursor-pointer relative z-10" onClick={() => cycleTyre(i)}>
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
                                                <span className="text-[10px] text-gray-500 uppercase font-bold">
                                                    {i === 0 ? 'Start' : i === pitStrategy.stops ? 'End' : `Stint ${i + 1}`}
                                                </span>
                                            </div>

                                            {i < pitStrategy.stops && (
                                                <div className="mx-2">
                                                    <ChevronRight size={20} className="text-gray-600/50" />
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>


                        {/* Winning Margin Selector */}
                        <div className="bg-[#0B0B0F] rounded-xl p-4 border border-[#2A2A30]">
                            <h4 className="text-sm font-bold text-green-400 flex items-center gap-2 mb-3">
                                <Timer size={14} /> Winning Margin
                            </h4>
                            <div className="flex bg-[#1A1A24] p-1 rounded-lg">
                                {['< 5s', '5-10s', '> 10s'].map(gap => (
                                    <button
                                        key={gap}
                                        onClick={() => !userVote && setWinningGap(gap)}
                                        disabled={!!userVote}
                                        className={cn(
                                            "flex-1 py-2 rounded-md text-xs font-bold transition-all",
                                            winningGap === gap
                                                ? "bg-green-500 text-black shadow-lg"
                                                : "text-gray-400 hover:text-white"
                                        )}
                                    >
                                        {gap}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Safety Car */}
                        <div className="bg-[#0B0B0F] rounded-xl p-4 border border-[#2A2A30]">
                            <h4 className="text-sm font-bold text-orange-400 flex items-center gap-2 mb-3">
                                <AlertTriangle size={14} /> Safety Car
                            </h4>

                            {/* Yes/No Toggle */}
                            <div className="flex bg-[#1A1A24] p-1 rounded-lg mb-3">
                                <button
                                    onClick={() => !userVote && setSafetyCar(prev => ({ ...prev, enabled: false }))}
                                    disabled={!!userVote}
                                    className={cn(
                                        "flex-1 py-2 rounded-md text-xs font-bold transition-all",
                                        !safetyCar.enabled
                                            ? "bg-gray-600 text-white shadow-lg"
                                            : "text-gray-400 hover:text-white"
                                    )}
                                >
                                    No
                                </button>
                                <button
                                    onClick={() => !userVote && setSafetyCar(prev => ({ ...prev, enabled: true }))}
                                    disabled={!!userVote}
                                    className={cn(
                                        "flex-1 py-2 rounded-md text-xs font-bold transition-all",
                                        safetyCar.enabled
                                            ? "bg-orange-500 text-black shadow-lg"
                                            : "text-gray-400 hover:text-white"
                                    )}
                                >
                                    Yes
                                </button>
                            </div>

                            {/* Count Selector - only show if Yes */}
                            <AnimatePresence>
                                {safetyCar.enabled && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="text-[10px] text-gray-500 uppercase mb-2">How many?</div>
                                        <div className="flex gap-2">
                                            {[1, 2, 3].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => !userVote && setSafetyCar(prev => ({ ...prev, count: n }))}
                                                    disabled={!!userVote}
                                                    className={cn(
                                                        "flex-1 py-2 rounded-lg text-sm font-bold transition-all border",
                                                        safetyCar.count === n
                                                            ? "bg-orange-500/20 text-orange-400 border-orange-500/50"
                                                            : "bg-[#1A1A24] text-gray-400 border-[#2A2A30] hover:text-white"
                                                    )}
                                                >
                                                    {n === 3 ? '3+' : n}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
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
                <div className="flex-1 flex flex-col gap-3 md:gap-4">
                    {/* AI vs You Comparison - Improved */}
                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-5">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                            <Brain size={14} /> AI vs Your Prediction
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* AI Prediction */}
                            <div className="bg-[#0B0B0F] rounded-xl p-4 border border-purple-500/30">
                                <div className="text-xs text-purple-400 uppercase mb-3">AI Prediction</div>
                                <div className="space-y-2">
                                    {[
                                        { pos: 1, driver: aiPrediction.winner, label: '1ST' },
                                        { pos: 2, driver: aiPrediction.p2, label: '2ND' },
                                        { pos: 3, driver: aiPrediction.p3, label: '3RD' }
                                    ].map(({ pos, driver, label }) => (
                                        <div key={pos} className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-500 w-6">{label}</span>
                                            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: DRIVER_DATA[driver]?.color || '#666' }} />
                                            <span className="text-sm font-bold text-white">{driver}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 pt-3 border-t border-[#2A2A30] grid grid-cols-2 gap-2 text-[10px]">
                                    <div>
                                        <span className="text-gray-500">Winning Gap</span>
                                        <div className="text-white font-bold">{aiPrediction.winningGap}</div>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Safety Car</span>
                                        <div className="text-white font-bold">{aiPrediction.safetyCar ? 'Yes' : 'No'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Your Prediction */}
                            <div className={cn("bg-[#0B0B0F] rounded-xl p-4 border", userVote ? "border-f1-red/30" : "border-[#2A2A30]")}>
                                <div className="text-xs text-f1-red uppercase mb-3">Your Prediction</div>
                                {podium[1] ? (
                                    <>
                                        <div className="space-y-2">
                                            {[
                                                { pos: 1, driver: podium[1], label: '1ST' },
                                                { pos: 2, driver: podium[2], label: '2ND' },
                                                { pos: 3, driver: podium[3], label: '3RD' }
                                            ].map(({ pos, driver, label }) => (
                                                <div key={pos} className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 w-6">{label}</span>
                                                    <div className="w-1 h-4 rounded-full" style={{ backgroundColor: driver ? DRIVER_DATA[driver]?.color : '#333' }} />
                                                    <span className="text-sm font-bold text-white">{driver || '?'}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-[#2A2A30] grid grid-cols-2 gap-2 text-[10px]">
                                            <div>
                                                <span className="text-gray-500">Winning Gap</span>
                                                <div className="text-white font-bold">{winningGap}</div>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Safety Car</span>
                                                <div className="text-white font-bold">{safetyCar.enabled ? `Yes (${safetyCar.count === 3 ? '3+' : safetyCar.count})` : 'No'}</div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-gray-600 py-4 text-center">Make your prediction...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Community Predictions - Enhanced with Tabs */}
                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-5 flex-1 min-h-0 flex flex-col">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                            <BarChart3 size={14} /> Community Predictions
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {/* Winner Predictions */}
                            {[
                                { code: 'VER', percent: 42, team: 'Red Bull Racing' },
                                { code: 'NOR', percent: 28, team: 'McLaren' },
                                { code: 'LEC', percent: 15, team: 'Ferrari' },
                                { code: 'HAM', percent: 8, team: 'Ferrari' },
                                { code: 'PIA', percent: 5, team: 'McLaren' },
                                { code: 'RUS', percent: 2, team: 'Mercedes' }
                            ].map((w, i) => (
                                <div key={w.code} className="group">
                                    <div className="flex justify-between items-center text-xs mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-3 rounded-full" style={{ backgroundColor: DRIVER_DATA[w.code]?.color || '#666' }} />
                                            <span className={cn("font-bold", i === 0 ? "text-white" : "text-gray-400")}>{w.code}</span>
                                            <span className="text-[10px] text-gray-600">{w.team}</span>
                                        </div>
                                        <span className={cn("font-bold", i === 0 ? "text-f1-red" : "text-gray-500")}>{w.percent}%</span>
                                    </div>
                                    <div className="h-2 bg-[#0B0B0F] rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${w.percent}%` }}
                                            className={cn("h-full rounded-full transition-colors", i === 0 ? "bg-f1-red" : "bg-gray-700 group-hover:bg-gray-500")}
                                        />
                                    </div>
                                </div>
                            ))}

                            {/* Strategy Section - Pit Stops */}
                            <div className="mt-4 pt-4 border-t border-[#2A2A30]">
                                <div className="text-[10px] text-gray-500 uppercase mb-3">Pit Stops</div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { stops: 1, percent: 45 },
                                        { stops: 2, percent: 48 },
                                        { stops: 3, percent: 7 }
                                    ].map(({ stops, percent }) => (
                                        <div key={stops} className="bg-[#0B0B0F] rounded-lg p-3 text-center">
                                            <div className="text-lg font-bold text-white">{stops}</div>
                                            <div className="text-[10px] text-gray-500">Stop{stops > 1 ? 's' : ''}</div>
                                            <div className="text-xs text-cyan-400 font-bold mt-1">{percent}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tyre Predictions */}
                            <div className="mt-4 pt-4 border-t border-[#2A2A30]">
                                <div className="text-[10px] text-gray-500 uppercase mb-3">Starting Tyre</div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { tyre: 'S', percent: 65, color: '#FF3333' },
                                        { tyre: 'M', percent: 30, color: '#FFE040' },
                                        { tyre: 'H', percent: 5, color: '#F0F0F0' }
                                    ].map(({ tyre, percent, color }) => (
                                        <div key={tyre} className="bg-[#0B0B0F] rounded-lg p-3 text-center border" style={{ borderColor: color + '30' }}>
                                            <div className="w-8 h-8 rounded-full border-2 mx-auto flex items-center justify-center font-bold" style={{ borderColor: color, color }}>
                                                {tyre}
                                            </div>
                                            <div className="text-xs font-bold mt-2" style={{ color }}>{percent}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Winning Margin Predictions */}
                            <div className="mt-4 pt-4 border-t border-[#2A2A30]">
                                <div className="text-[10px] text-gray-500 uppercase mb-3">Winning Margin</div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: '< 5s', percent: 32 },
                                        { label: '5-10s', percent: 45 },
                                        { label: '> 10s', percent: 23 }
                                    ].map(({ label, percent }) => (
                                        <div key={label} className="bg-[#0B0B0F] rounded-lg p-3 text-center">
                                            <div className="text-sm font-bold text-white mb-1">{label}</div>
                                            <div className="text-xs text-green-400 font-bold">{percent}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Safety Car Predictions */}
                            <div className="mt-4 pt-4 border-t border-[#2A2A30]">
                                <div className="text-[10px] text-gray-500 uppercase mb-3">Safety Car</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-[#0B0B0F] rounded-lg p-3 text-center">
                                        <div className="text-lg font-bold text-green-400">Yes</div>
                                        <div className="text-xs text-gray-500">67%</div>
                                    </div>
                                    <div className="bg-[#0B0B0F] rounded-lg p-3 text-center">
                                        <div className="text-lg font-bold text-gray-400">No</div>
                                        <div className="text-xs text-gray-500">33%</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
