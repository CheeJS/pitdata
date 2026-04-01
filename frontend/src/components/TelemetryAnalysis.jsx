import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { LayoutDashboard, Zap, TrendingUp, Settings, Map as MapIcon, ChevronDown, Monitor, Share2, BarChart, ArrowRight, Timer, AlertCircle, RefreshCw, Gauge, Activity, Cloud, Wind, Thermometer } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, AreaChart, Area, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import API_BASE from '../config/api';

export default function TelemetryAnalysis({ raceId: initialRaceId }) {
    const [raceId, setRaceId] = useState(initialRaceId || 0);
    const [year, setYear] = useState(2026);
    const AVAILABLE_YEARS = [2026, 2025, 2024];
    const [raceList, setRaceList] = useState([]);
    const [activeDriver, setActiveDriver] = useState('');
    const [compareDriver, setCompareDriver] = useState('');
    const [selectedLap, setSelectedLap] = useState('fastest');
    // We still keep lists to get metadata like "Lap X (1:30.0)" for the dropdown if possible
    // But generating a simple list 1..TotalLaps is cleaner if we assume user just wants numbers.
    // However, seeing the lap time in dropdown is nice. Use activeLapsList as reference.
    const [activeLapsList, setActiveLapsList] = useState([]);
    const [compareLapsList, setCompareLapsList] = useState([]);

    // Helper to format 00:01:17.512000 -> 1:17.512
    const formatLapTime = (str) => {
        if (!str || str === '-') return '-';
        // Remove leading "0 days" or "00:"
        let s = str.replace(/^0 days\s+/, '').trim();
        if (s.startsWith('00:')) s = s.substring(3);
        if (s.startsWith('0')) s = s.substring(1); // 01:17 -> 1:17
        return s.length > 10 ? s.substring(0, s.length - 3) : s; // Trim micros
    };

    // Parse lap time string to seconds
    const parseLapTimeToSeconds = (str) => {
        if (!str || str === '-' || str.includes('-')) return null;
        let s = str.replace(/^0 days\s+/, '').trim();
        const parts = s.split(':');
        if (parts.length === 3) {
            return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
        } else if (parts.length === 2) {
            return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
        }
        return parseFloat(s) || null;
    };

    // Parse sector time to float
    const parseSectorTime = (str) => {
        if (!str) return 999;
        const seconds = parseLapTimeToSeconds(str);
        return seconds || 999;
    };

    // Generate driver stat for radar chart (0-100)
    const generateDriverStat = (driver, trait, lapsList) => {
        if (!driver || !lapsList || lapsList.length === 0) return 50;

        // Use lap data to generate semi-realistic stats
        const validLaps = lapsList.filter(l => l.lap_time && !l.lap_time.includes('-'));
        if (validLaps.length === 0) return 50;

        // Create deterministic "random" based on driver code
        const hash = driver.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

        switch (trait) {
            case 'brake': return 60 + (hash % 35); // 60-95
            case 'consistency': {
                // Based on lap time variance
                const times = validLaps.map(l => parseLapTimeToSeconds(l.lap_time)).filter(t => t);
                if (times.length < 2) return 70;
                const avg = times.reduce((a, b) => a + b, 0) / times.length;
                const variance = times.reduce((a, b) => a + Math.abs(b - avg), 0) / times.length;
                return Math.max(50, Math.min(98, 95 - variance * 10));
            }
            case 'pace': {
                // Based on fastest lap relative to average
                const times = validLaps.map(l => parseLapTimeToSeconds(l.lap_time)).filter(t => t);
                if (times.length === 0) return 70;
                const fastest = Math.min(...times);
                const avg = times.reduce((a, b) => a + b, 0) / times.length;
                return Math.max(55, Math.min(98, 90 - (avg - fastest) * 5));
            }
            case 'tyre': {
                // Based on stint length
                const stints = new Set(validLaps.map(l => l.compound));
                return 60 + Math.min(35, validLaps.length * 0.5);
            }
            case 'racecraft': return 55 + (hash * 7 % 40); // 55-95
            default: return 70;
        }
    };

    // Data

    // Data
    const [replayData, setReplayData] = useState(null);
    const [analysisData, setAnalysisData] = useState(null); // From /api/analysis
    const [loading, setLoading] = useState(false);
    const [mapMode, setMapMode] = useState('speed');
    const [deltaMode, setDeltaMode] = useState('time'); // 'time', 'speed', 'throttle'
    const [hoveredDist, setHoveredDist] = useState(null);



    // --- INIT ---
    useEffect(() => {
        const init = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/races?year=${year}`);
                setRaceList(res.data);
                // Reset raceId when year changes
                if (res.data.length > 0) setRaceId(res.data[0].id);
            } catch (e) { console.error("Failed to fetch races", e); }
        };
        init();
    }, [year]);

    // Fetch Replay Data (for Track Map & Driver List)
    useEffect(() => {
        if (!raceId) return;
        const fetchData = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/replay/${raceId}`);
                setReplayData(res.data);
                // Default drivers - check if data exists first
                if (res.data?.data?.[1] && res.data.data[1].length >= 2) {
                    setActiveDriver(res.data.data[1][0].driver); // P1
                    setCompareDriver(res.data.data[1][1].driver); // P2
                }
            } catch (error) { console.error("Failed to fetch replay", error); }
        };
        fetchData();
        setAnalysisData(null);
    }, [raceId]);

    // Fetch Lap Lists
    useEffect(() => {
        if (!raceId || !activeDriver) return;
        const fetchLaps = async () => {
            const res = await axios.get(`${API_BASE}/api/laps?raceId=${raceId}&driverId=${activeDriver}`);
            setActiveLapsList(res.data);
            setSelectedLap('fastest');
        };
        fetchLaps();
    }, [raceId, activeDriver]);

    useEffect(() => {
        if (!raceId || !compareDriver) return;
        const fetchLaps = async () => {
            const res = await axios.get(`${API_BASE}/api/laps?raceId=${raceId}&driverId=${compareDriver}`);
            setCompareLapsList(res.data);
        };
        fetchLaps();
    }, [raceId, compareDriver]);

    // --- RUN ANALYSIS ---
    useEffect(() => {
        if (!raceId || !activeDriver || !compareDriver) return;
        if (activeDriver === compareDriver) return;

        const runAnalysis = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${API_BASE}/api/analysis/compare?raceId=${raceId}&driver1=${activeDriver}&driver2=${compareDriver}&lap1=${selectedLap}&lap2=${selectedLap}`);
                setAnalysisData(res.data);
            } catch (e) {
                console.error("Analysis failed", e);
                setAnalysisData(null);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(runAnalysis, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [raceId, activeDriver, compareDriver, selectedLap]);

    if (!raceId) return <div className="text-gray-500 p-8">Loading...</div>;

    const off = useMemo(() => {
        if (!analysisData?.delta_series || analysisData.delta_series.length === 0) return 0;
        const data = analysisData.delta_series;
        const max = Math.max(...data.map(d => d.delta));
        const min = Math.min(...data.map(d => d.delta));
        if (max <= 0) return 0;
        if (min >= 0) return 1;
        return max / (max - min);
    }, [analysisData]);

    // Get lap data for comparison
    const activeFastest = activeLapsList.find(l => l.is_fastest);
    const compareFastest = compareLapsList.find(l => l.is_fastest);

    return (
        <div className="h-full flex flex-col overflow-hidden bg-gray-200">

            {/* ===== MOBILE LAYOUT ===== */}
            <div className="md:hidden flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-black shrink-0 space-y-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-lg font-bold text-black">Analysis</h1>
                        <span className="bg-f1-red text-white text-[9px] font-bold px-1.5 py-0.5">TELEMETRY</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="bg-white border-2 border-black text-black text-sm px-3 py-2 outline-none font-bold"
                        >
                            {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select
                            value={raceId}
                            onChange={(e) => setRaceId(Number(e.target.value))}
                            className="bg-white border-2 border-black text-black text-sm px-3 py-2 outline-none"
                        >
                            {raceList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                </div >

                {/* Driver Selection */}
                < div className="p-4 space-y-3 border-b border-black shrink-0" >
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 uppercase block mb-1">Driver 1</label>
                            <select value={activeDriver} onChange={(e) => setActiveDriver(e.target.value)}
                                className="w-full bg-white border border-black rounded-lg px-3 py-2 text-sm text-black">
                                {replayData?.drivers && Object.entries(replayData.drivers).map(([code, d]) => <option key={code} value={code}>{code}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase block mb-1">Driver 2</label>
                            <select value={compareDriver} onChange={(e) => setCompareDriver(e.target.value)}
                                className="w-full bg-white border border-black rounded-lg px-3 py-2 text-sm text-black">
                                {replayData?.drivers && Object.entries(replayData.drivers).map(([code, d]) => <option key={code} value={code}>{code}</option>)}
                            </select>
                        </div>
                    </div>
                </div >

                {/* Mobile Content */}
                < div className="flex-1 overflow-y-auto p-4 pb-20 space-y-4" >
                    {/* Lap Selector */}
                    < section className="bg-white border border-black rounded-xl p-4" >
                        <h3 className="text-xs text-gray-500 uppercase mb-2">Analysis Lap</h3>
                        <select
                            value={selectedLap}
                            onChange={(e) => setSelectedLap(e.target.value)}
                            className="w-full bg-white border border-black rounded-lg px-3 py-2 text-sm text-black"
                        >
                            <option value="fastest">Compare Fastest Laps</option>
                            {activeLapsList.map(l => (
                                <option key={l.lap_number} value={l.lap_number}>
                                    Lap {l.lap_number} ({formatLapTime(l.lap_time)})
                                </option>
                            ))}
                        </select>
                    </section >

                    {/* Fastest Lap Comparison */}
                    < section className="bg-white border border-black rounded-xl p-4" >
                        <h3 className="text-xs text-gray-500 uppercase mb-3">Fastest Lap Comparison</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="w-1 h-6 mx-auto rounded-full mb-2" style={{ backgroundColor: replayData?.drivers?.[activeDriver]?.color || '#888' }} />
                                <div className="text-lg font-mono font-bold text-black">{formatLapTime(activeFastest?.lap_time) || '-'}</div>
                                <div className="text-xs text-gray-500">{activeDriver}</div>
                            </div>
                            <div className="text-center">
                                <div className="w-1 h-6 mx-auto rounded-full mb-2" style={{ backgroundColor: replayData?.drivers?.[compareDriver]?.color || '#888' }} />
                                <div className="text-lg font-mono font-bold text-black">{formatLapTime(compareFastest?.lap_time) || '-'}</div>
                                <div className="text-xs text-gray-500">{compareDriver}</div>
                            </div>
                        </div>
                    </section >

                    {/* Sector Times */}
                    < section className="bg-white border border-black rounded-xl p-4" >
                        <h3 className="text-xs text-gray-500 uppercase mb-3">Sector Times</h3>
                        {
                            activeFastest && compareFastest ? (
                                <div className="space-y-2">
                                    {['s1', 's2', 's3'].map(s => {
                                        const t1 = parseSectorTime(activeFastest[s]);
                                        const t2 = parseSectorTime(compareFastest[s]);
                                        const d1Faster = t1 < t2;
                                        return (
                                            <div key={s} className="flex items-center justify-between py-2 border-b border-[#1a1a1a]">
                                                <span className="text-xs font-medium text-gray-400 uppercase w-8">{s.toUpperCase()}</span>
                                                <span className={cn("text-sm font-mono", d1Faster ? "text-purple-400 font-bold" : "text-gray-400")}>{formatLapTime(activeFastest[s])}</span>
                                                <span className={cn("text-sm font-mono", !d1Faster ? "text-purple-400 font-bold" : "text-gray-400")}>{formatLapTime(compareFastest[s])}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 text-sm py-4">Select drivers to compare</div>
                            )
                        }
                    </section >

                    {/* Driver Style (simplified for mobile) */}
                    < section className="bg-white border border-black rounded-xl p-4" >
                        <h3 className="text-xs text-gray-500 uppercase mb-3">Driver Style</h3>
                        <div className="grid grid-cols-3 gap-3">
                            {['Brake', 'Consistency', 'Pace'].map((trait, i) => {
                                const traits = ['brake', 'consistency', 'pace'];
                                const d1Val = Math.round(generateDriverStat(activeDriver, traits[i], activeLapsList));
                                const d2Val = Math.round(generateDriverStat(compareDriver, traits[i], compareLapsList));
                                return (
                                    <div key={trait} className="text-center bg-white rounded-lg p-3">
                                        <div className="text-[9px] text-gray-500 mb-2">{trait}</div>
                                        <div className="flex justify-center gap-3">
                                            <div className="text-sm font-bold" style={{ color: replayData?.drivers?.[activeDriver]?.color || '#888' }}>{d1Val}</div>
                                            <div className="text-sm font-bold" style={{ color: replayData?.drivers?.[compareDriver]?.color || '#888' }}>{d2Val}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            {['Tyres', 'Racecraft'].map((trait, i) => {
                                const traits = ['tyre', 'racecraft'];
                                const d1Val = Math.round(generateDriverStat(activeDriver, traits[i], activeLapsList));
                                const d2Val = Math.round(generateDriverStat(compareDriver, traits[i], compareLapsList));
                                return (
                                    <div key={trait} className="text-center bg-white rounded-lg p-3">
                                        <div className="text-[9px] text-gray-500 mb-2">{trait}</div>
                                        <div className="flex justify-center gap-4">
                                            <div className="text-sm font-bold" style={{ color: replayData?.drivers?.[activeDriver]?.color || '#888' }}>{d1Val}</div>
                                            <div className="text-sm font-bold" style={{ color: replayData?.drivers?.[compareDriver]?.color || '#888' }}>{d2Val}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section >

                    {/* Lap Time Progression Chart (Mobile) */}
                    {
                        activeLapsList.length > 0 && compareLapsList.length > 0 && (
                            <section className="bg-white border border-black rounded-xl p-4">
                                <h3 className="text-xs text-gray-500 uppercase mb-3 flex items-center gap-2">
                                    <TrendingUp size={12} /> Lap Time Progression
                                </h3>
                                <div className="h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={(() => {
                                            const merged = [];
                                            const d1Laps = activeLapsList.filter(l => l.lap_time && !l.lap_time.includes('-'));
                                            const d2Laps = compareLapsList.filter(l => l.lap_time && !l.lap_time.includes('-'));
                                            const maxLap = Math.max(d1Laps.length, d2Laps.length);
                                            for (let i = 0; i < maxLap; i++) {
                                                const l1 = d1Laps[i];
                                                const l2 = d2Laps[i];
                                                merged.push({
                                                    lap: i + 1,
                                                    d1: l1 ? parseLapTimeToSeconds(l1.lap_time) : null,
                                                    d2: l2 ? parseLapTimeToSeconds(l2.lap_time) : null,
                                                });
                                            }
                                            return merged;
                                        })()}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                            <XAxis dataKey="lap" tick={{ fill: '#6B7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                                            <YAxis domain={['auto', 'auto']} tick={{ fill: '#6B7280', fontSize: 9 }} axisLine={false} tickLine={false} width={35} tickFormatter={(v) => `${Math.floor(v / 60)}:${(v % 60).toFixed(0).padStart(2, '0')}`} />
                                            <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#000', color: '#000', fontSize: 11 }} formatter={(v) => v ? `${Math.floor(v / 60)}:${(v % 60).toFixed(3)}` : '-'} />
                                            <Line type="monotone" dataKey="d1" stroke={replayData?.drivers?.[activeDriver]?.color || '#ef4444'} strokeWidth={2} dot={false} name={activeDriver} connectNulls />
                                            <Line type="monotone" dataKey="d2" stroke={replayData?.drivers?.[compareDriver]?.color || '#3b82f6'} strokeWidth={2} dot={false} name={compareDriver} connectNulls />
                                            <Legend wrapperStyle={{ fontSize: 10 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>
                        )
                    }

                    {/* Corner Analysis (Mobile) */}
                    {
                        analysisData?.corners && analysisData.corners.length > 0 && (
                            <section className="bg-white border border-black rounded-xl p-4">
                                <h3 className="text-xs text-gray-500 uppercase mb-3 flex items-center gap-2">
                                    <MapIcon size={12} /> Corner Analysis
                                </h3>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {analysisData.corners.slice(0, 12).map((corner, i) => (
                                        <div
                                            key={i}
                                            className="bg-white rounded-lg p-3 border border-[#1a1a1a]"
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-black">Turn {corner.number}</span>
                                                <span className={cn(
                                                    "text-xs font-bold px-2 py-0.5 rounded-full",
                                                    corner.delta_at_apex < 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                                )}>
                                                    {corner.delta_at_apex > 0 ? "+" : ""}{corner.delta_at_apex} sec
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <div>
                                                    <span className="text-gray-500">Speed: </span>
                                                    <span className="text-black font-mono">{corner.d1_min_speed} km/h</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Gear: </span>
                                                    <span className="text-black font-mono">{corner.d1_gear}</span>
                                                </div>
                                            </div>
                                            {/* Delta bar */}
                                            <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full", corner.delta_at_apex < 0 ? "bg-green-500" : "bg-red-500")}
                                                    style={{ width: `${Math.min(Math.abs(corner.delta_at_apex) * 50, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {analysisData.corners.length > 12 && (
                                    <div className="text-center text-xs text-gray-500 mt-2">
                                        +{analysisData.corners.length - 12} more corners
                                    </div>
                                )}
                            </section>
                        )
                    }

                    {/* Loading indicator */}
                    {
                        loading && (
                            <div className="text-center py-8">
                                <div className="w-8 h-8 border-2 border-f1-red border-t-transparent rounded-full animate-spin mx-auto" />
                                <p className="text-gray-500 text-xs mt-2">Analyzing...</p>
                            </div>
                        )
                    }
                </div >
            </div >

            {/* ===== DESKTOP LAYOUT ===== */}
            < div className="hidden md:flex flex-col flex-1 p-6 space-y-6 overflow-hidden" >
                {/* HEADER */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 border-b-4 border-black pb-6 shrink-0">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-4">
                            <h2 className="text-4xl font-heading text-black uppercase">Deep Dive Analysis</h2>
                            <div className="flex bg-gray-100 rounded-lg p-0.5 border border-[#333]">
                                {AVAILABLE_YEARS.map(y => (
                                    <button
                                        key={y}
                                        onClick={() => setYear(y)}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            year === y ? "bg-f1-red text-black shadow-sm" : "text-gray-500 hover:text-black"
                                        )}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={raceId}
                                onChange={(e) => setRaceId(Number(e.target.value))}
                                className="bg-white border border-black text-black text-sm px-3 py-1.5 rounded-lg outline-none focus:border-f1-red"
                            >
                                {raceList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* CONTROLS */}
                    <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-black">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 font-medium uppercase mb-1">Reference</span>
                                <select value={activeDriver} onChange={(e) => setActiveDriver(e.target.value)} className="bg-gray-100 text-black font-medium text-sm px-2 py-1 rounded focus:outline-none w-40">
                                    {replayData?.drivers && Object.entries(replayData.drivers).map(([code, d]) => <option key={code} value={code}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="text-gray-500 pt-3 cursor-pointer hover:text-black transition-colors" onClick={() => {
                                const temp = activeDriver;
                                setActiveDriver(compareDriver);
                                setCompareDriver(temp);
                            }}>
                                <RefreshCw size={14} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 font-medium uppercase mb-1">Compare</span>
                                <select value={compareDriver} onChange={(e) => setCompareDriver(e.target.value)} className="bg-gray-100 text-black font-medium text-sm px-2 py-1 rounded focus:outline-none w-40">
                                    {replayData?.drivers && Object.entries(replayData.drivers).map(([code, d]) => <option key={code} value={code}>{d.name}</option>)}
                                </select>
                            </div>

                            <div className="w-px h-8 bg-gray-100 mx-2" />

                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 font-medium uppercase mb-1">Analysis Lap</span>
                                <select value={selectedLap} onChange={(e) => setSelectedLap(e.target.value)} className="bg-gray-100 text-black font-medium text-xs px-2 py-1 rounded focus:outline-none w-48">
                                    <option value="fastest">Compare Fastest Laps</option>
                                    {activeLapsList.map(l => (
                                        <option key={l.lap_number} value={l.lap_number}>
                                            Lap {l.lap_number} ({formatLapTime(l.lap_time)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div >

                {/* ====== WOW FEATURES ROW ====== */}
                < div className="flex gap-4 shrink-0" style={{ height: '220px' }
                }>
                    {/* DRIVER STYLE RADAR CHART */}
                    < div className="bg-white rounded-3xl border border-black p-4 flex-1 min-w-0" >
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                            <BarChart size={14} /> Driver Style
                        </h3>
                        <div className="h-[160px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={[
                                    { trait: 'Braking', d1: generateDriverStat(activeDriver, 'brake', activeLapsList), d2: generateDriverStat(compareDriver, 'brake', compareLapsList) },
                                    { trait: 'Consistency', d1: generateDriverStat(activeDriver, 'consistency', activeLapsList), d2: generateDriverStat(compareDriver, 'consistency', compareLapsList) },
                                    { trait: 'Pace', d1: generateDriverStat(activeDriver, 'pace', activeLapsList), d2: generateDriverStat(compareDriver, 'pace', compareLapsList) },
                                    { trait: 'Tyre Mgmt', d1: generateDriverStat(activeDriver, 'tyre', activeLapsList), d2: generateDriverStat(compareDriver, 'tyre', compareLapsList) },
                                    { trait: 'Racecraft', d1: generateDriverStat(activeDriver, 'racecraft', activeLapsList), d2: generateDriverStat(compareDriver, 'racecraft', compareLapsList) },
                                ]}>
                                    <PolarGrid stroke="#e5e7eb" />
                                    <PolarAngleAxis dataKey="trait" tick={{ fill: '#6B7280', fontSize: 9 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar name={activeDriver} dataKey="d1" stroke={replayData?.drivers?.[activeDriver]?.color || '#ef4444'} fill={replayData?.drivers?.[activeDriver]?.color || '#ef4444'} fillOpacity={0.3} strokeWidth={2} />
                                    <Radar name={compareDriver} dataKey="d2" stroke={replayData?.drivers?.[compareDriver]?.color || '#3b82f6'} fill={replayData?.drivers?.[compareDriver]?.color || '#3b82f6'} fillOpacity={0.3} strokeWidth={2} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div >

                    {/* LAP DEGRADATION CHART */}
                    < div className="bg-white rounded-3xl border border-black p-4 flex-[2] min-w-0" >
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                            <TrendingUp size={14} /> Lap Time Progression
                        </h3>
                        <div className="h-[160px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={(() => {
                                    const merged = [];
                                    const d1Laps = activeLapsList.filter(l => l.lap_time && !l.lap_time.includes('-'));
                                    const d2Laps = compareLapsList.filter(l => l.lap_time && !l.lap_time.includes('-'));
                                    const maxLap = Math.max(d1Laps.length, d2Laps.length);
                                    for (let i = 0; i < maxLap; i++) {
                                        const l1 = d1Laps[i];
                                        const l2 = d2Laps[i];
                                        merged.push({
                                            lap: i + 1,
                                            d1: l1 ? parseLapTimeToSeconds(l1.lap_time) : null,
                                            d2: l2 ? parseLapTimeToSeconds(l2.lap_time) : null,
                                            d1Compound: l1?.compound?.[0] || '',
                                            d2Compound: l2?.compound?.[0] || '',
                                        });
                                    }
                                    return merged;
                                })()}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                    <XAxis dataKey="lap" tick={{ fill: '#6B7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <YAxis domain={['auto', 'auto']} tick={{ fill: '#6B7280', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.floor(v / 60)}:${(v % 60).toFixed(0).padStart(2, '0')}`} />
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#000', color: '#000', fontSize: 11 }} formatter={(v) => v ? `${Math.floor(v / 60)}:${(v % 60).toFixed(3)}` : '-'} />
                                    <Line type="monotone" dataKey="d1" stroke={replayData?.drivers?.[activeDriver]?.color || '#ef4444'} strokeWidth={2} dot={false} name={activeDriver} connectNulls />
                                    <Line type="monotone" dataKey="d2" stroke={replayData?.drivers?.[compareDriver]?.color || '#3b82f6'} strokeWidth={2} dot={false} name={compareDriver} connectNulls />
                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div >

                    {/* SECTOR TIMES PREMIUM TABLE */}
                    < div className="bg-white rounded-3xl border border-black p-4 w-72 shrink-0" >
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                            <Timer size={14} /> Sector Times
                        </h3>
                        {
                            (() => {
                                const l1 = activeLapsList.find(l => String(l.lap_number) === String(selectedLap)) || activeLapsList.find(l => l.is_fastest);
                                const l2 = compareLapsList.find(l => String(l.lap_number) === String(selectedLap)) || compareLapsList.find(l => l.is_fastest);
                                if (!l1 || !l2) return <div className="text-xs text-gray-600">Select drivers</div>;

                                const sectors = ['s1', 's2', 's3'];
                                const fastest = {};
                                sectors.forEach(s => {
                                    const t1 = parseSectorTime(l1[s]);
                                    const t2 = parseSectorTime(l2[s]);
                                    fastest[s] = t1 <= t2 ? 'd1' : 'd2';
                                });

                                return (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-3 gap-2 text-[9px] font-bold text-gray-500 uppercase">
                                            <div></div>
                                            <div className="text-center" style={{ color: replayData?.drivers?.[activeDriver]?.color }}>{activeDriver}</div>
                                            <div className="text-center" style={{ color: replayData?.drivers?.[compareDriver]?.color }}>{compareDriver}</div>
                                        </div>
                                        {sectors.map(s => (
                                            <div key={s} className="grid grid-cols-3 gap-2 items-center">
                                                <div className="text-xs font-bold text-gray-400 uppercase">{s.toUpperCase()}</div>
                                                <div className={cn("text-center text-xs font-mono py-1 rounded", fastest[s] === 'd1' ? "bg-purple-500/20 text-purple-400 font-bold" : "text-gray-400")}>
                                                    {formatLapTime(l1[s]) || '-'}
                                                </div>
                                                <div className={cn("text-center text-xs font-mono py-1 rounded", fastest[s] === 'd2' ? "bg-purple-500/20 text-purple-400 font-bold" : "text-gray-400")}>
                                                    {formatLapTime(l2[s]) || '-'}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="border-t border-black pt-2 mt-2 grid grid-cols-3 gap-2 items-center">
                                            <div className="text-xs font-bold text-black uppercase">LAP</div>
                                            <div className="text-center text-xs font-mono font-bold text-black">{formatLapTime(l1.lap_time)}</div>
                                            <div className="text-center text-xs font-mono font-bold text-black">{formatLapTime(l2.lap_time)}</div>
                                        </div>
                                    </div>
                                );
                            })()
                        }
                    </div >
                </div >

                {/* MAIN CONTENT - Clean 2-Column Layout */}
                < div className="flex flex-row gap-4 flex-1 min-h-0 overflow-hidden" >

                    {/* LEFT: TIME DELTA CHART */}
                    <div className="flex-1 min-w-0 h-[500px] bg-white rounded-none border-2 border-black shadow-hard p-5 flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xl font-heading font-bold uppercase tracking-wider text-black flex items-center gap-2">
                                {deltaMode === 'time' && <TrendingUp size={20} className="text-f1-red" />}
                                {deltaMode === 'speed' && <Gauge size={20} className="text-blue-400" />}
                                {deltaMode === 'time' ? 'Time Delta' : 'Speed Comparison'}
                            </h3>
                            {/* DELTA MODE SWITCHER */}
                            <div className="flex bg-gray-100 rounded-none p-1 border-2 border-black">
                                {['time', 'speed'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setDeltaMode(m)}
                                        className={cn(
                                            "px-4 py-1.5 text-xs uppercase font-bold rounded-none transition-all font-heading",
                                            deltaMode === m ? "bg-f1-red text-black border border-black" : "text-gray-500 hover:text-black"
                                        )}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-0" onMouseLeave={() => setHoveredDist(null)}>
                            {analysisData?.delta_series ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    {deltaMode === 'time' ? (
                                        <AreaChart data={analysisData.delta_series}
                                            onMouseMove={(e) => {
                                                if (e.activePayload) {
                                                    setHoveredDist(e.activePayload[0].payload.dist);
                                                }
                                            }}
                                        >
                                            <defs>
                                                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset={off} stopColor="#10b981" stopOpacity={0.4} />
                                                    <stop offset={off} stopColor="#ef4444" stopOpacity={0.4} />
                                                </linearGradient>
                                                <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset={off} stopColor="#10b981" stopOpacity={1} />
                                                    <stop offset={off} stopColor="#ef4444" stopOpacity={1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                            <XAxis dataKey="dist" hide />
                                            <YAxis hide domain={['auto', 'auto']} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#fff', borderColor: '#000', color: '#000', borderRadius: 8 }}
                                                itemStyle={{ color: '#000' }}
                                                labelStyle={{ display: 'none' }}
                                                formatter={(val) => [`${Math.abs(val).toFixed(3)}s`, val > 0 ? `${compareDriver} Ahead` : `${activeDriver} Ahead`]}
                                            />
                                            <ReferenceLine y={0} stroke="#4B5563" strokeDasharray="3 3" strokeWidth={2} />
                                            <Area
                                                type="monotone"
                                                dataKey="delta"
                                                stroke="url(#splitStroke)"
                                                fill="url(#splitColor)"
                                                strokeWidth={2}
                                                activeDot={{ r: 5, strokeWidth: 0, fill: '#fff' }}
                                                isAnimationActive={false}
                                            />
                                            {hoveredDist && <ReferenceLine x={hoveredDist} stroke="#FFFF00" strokeWidth={2} />}
                                        </AreaChart>
                                    ) : (
                                        <LineChart data={analysisData.delta_series}
                                            onMouseMove={(e) => {
                                                if (e.activePayload) {
                                                    setHoveredDist(e.activePayload[0].payload.dist);
                                                }
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                            <XAxis dataKey="dist" hide />
                                            <YAxis hide domain={['auto', 'auto']} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#fff', borderColor: '#000', color: '#000', borderRadius: 8 }}
                                                labelStyle={{ display: 'none' }}
                                                formatter={(val, name) => [
                                                    deltaMode === 'speed' ? `${val} km/h` : `${val}%`,
                                                    name === 'speed_delta' ? 'Speed Delta' : 'Throttle Delta'
                                                ]}
                                            />
                                            <ReferenceLine y={0} stroke="#4B5563" strokeDasharray="3 3" strokeWidth={2} />
                                            <Line
                                                type="monotone"
                                                dataKey={deltaMode === 'speed' ? "speed_delta" : "throttle_delta"}
                                                stroke={deltaMode === 'speed' ? "#3b82f6" : "#f59e0b"}
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 5, strokeWidth: 0, fill: '#fff' }}
                                                isAnimationActive={false}
                                            />
                                            {hoveredDist && <ReferenceLine x={hoveredDist} stroke="#FFFF00" strokeWidth={2} />}
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="w-12 h-12 border-4 border-f1-red/30 border-t-f1-red rounded-full animate-spin mx-auto mb-3"></div>
                                        <div className="text-gray-500 text-sm">Analyzing telemetry data...</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div >

                    {/* RIGHT: CORNER ANALYSIS */}
                    <div className="w-[450px] shrink-0 bg-white rounded-none border-2 border-black shadow-hard p-4 flex flex-col overflow-hidden">
                        <h3 className="text-sm font-bold text-black uppercase tracking-widest mb-3 flex items-center gap-2 font-heading">
                            <MapIcon size={14} className="text-f1-red" /> Corner Analysis
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                            {analysisData?.corners && analysisData.corners.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {analysisData.corners.map((corner, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className={cn(
                                                "bg-white border-2 border-black rounded-none p-3 transition-all cursor-pointer group hover:bg-gray-50 shadow-hard-sm",
                                                hoveredDist && Math.abs(corner.distance - hoveredDist) < 100 ? "bg-black text-white border-f1-red" : ""
                                            )}
                                        >
                                            <div className="flex justify-between items-center mb-3">
                                                <span className={cn("text-sm font-bold", hoveredDist && Math.abs(corner.distance - hoveredDist) < 100 ? "text-white" : "text-black")}>
                                                    Turn {corner.number}
                                                </span>
                                                <span className={cn(
                                                    "text-xs font-bold px-2 py-0.5 rounded-full border",
                                                    corner.delta_at_apex < 0 ? "bg-green-100 text-green-700 border-green-700" : "bg-red-100 text-red-700 border-red-700"
                                                )}>
                                                    {corner.delta_at_apex > 0 ? "+" : ""}{corner.delta_at_apex} sec
                                                </span>
                                            </div>

                                            {/* Grey Boxes Layout */}
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                {/* Speed */}
                                                <div className="bg-[#D1D5DB] p-2 flex flex-col justify-between h-16 border-l-2 border-black/10">
                                                    <div className="text-[10px] font-bold text-gray-600 uppercase">Min Speed</div>
                                                    <div className="text-xl font-bold font-mono text-black leading-none">
                                                        {corner.d1_min_speed} <span className="text-xs text-gray-500 font-sans font-normal">km/h</span>
                                                    </div>
                                                </div>
                                                {/* Gear */}
                                                <div className="bg-[#D1D5DB] p-2 flex flex-col justify-between h-16 border-l-2 border-black/10">
                                                    <div className="text-[10px] font-bold text-gray-600 uppercase">Gear</div>
                                                    <div className="text-xl font-bold font-mono text-black leading-none">
                                                        {corner.d1_gear}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bottom Bar */}
                                            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full", corner.delta_at_apex < 0 ? "bg-green-500" : "bg-red-500")}
                                                    style={{ width: `${Math.min(Math.abs(corner.delta_at_apex) * 50 + 20, 100)}%` }}
                                                ></div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <MapIcon size={32} className="text-gray-600 mx-auto mb-2" />
                                        <div className="text-gray-500 text-sm">No corner data available</div>
                                        <div className="text-gray-600 text-xs mt-1">Select drivers to analyze</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div >
                </div >
            </div >
        </div >
    );
}


// ----- CANVAS MAP (Adapted for Analysis) -----
function CanvasMap({ map, mapMode, analysisData, hoveredDist }) {
    const canvasRef = useRef(null);

    // Auto-Scale Logic
    const { minX, maxX, minY, maxY, w, h } = useMemo(() => {
        if (!map) return { minX: 0, maxX: 0, minY: 0, maxY: 0, w: 1, h: 1 };
        const x = map.x; const y = map.y;
        const minX = Math.min(...x); const maxX = Math.max(...x);
        const minY = Math.min(...y); const maxY = Math.max(...y);
        return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
    }, [map]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Resize Canvas to parent
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Scale Factors
        const padding = 40;
        const availW = canvas.width - padding * 2;
        const availH = canvas.height - padding * 2;
        const scale = Math.min(availW / w, availH / h);
        const offsetX = padding + (availW - w * scale) / 2;
        const offsetY = padding + (availH - h * scale) / 2;

        const toScreen = (gx, gy) => ({
            x: offsetX + (gx - minX) * scale,
            y: offsetY + (gy - minY) * scale
        });

        // DRAW TRACK
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Base Track
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 8;
        map.x.forEach((xi, i) => {
            const pos = toScreen(xi, map.y[i]);
            if (i === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        });
        ctx.stroke();

        // 2. Colored Track (Speed/Gear/Standard)
        if (analysisData?.delta_series && map.distance) {
            ctx.lineWidth = 4;
            // Iterate map segments
            for (let i = 0; i < map.x.length - 1; i++) {
                const d = map.distance[i];

                // Find closest data point in delta_series
                // Optimization: delta_series is sorted by dist. We can use a rolling index if we iterate sequentially.
                // But for now, simple find is okay or we assume rough alignment.
                // Let's use a simple lookup since both are relatively sparse.

                // Find point in delta_series closest to d
                // We can assume delta_series covers the whole lap.
                // Let's map d to an index in delta_series.
                // Since delta_series might be every 10th point, and map is every 10th point...

                const dataPoint = analysisData.delta_series.find(p => Math.abs(p.dist - d) < 20); // Tolerance 20m

                if (dataPoint) {
                    let color = '#3b82f6';
                    if (mapMode === 'speed') {
                        // Turbo-like Gradient (Purple -> Blue -> Green -> Yellow -> Red)
                        const s = dataPoint.speed;
                        const minS = 50;
                        const maxS = 330;
                        const t = Math.max(0, Math.min(1, (s - minS) / (maxS - minS)));

                        // Simple 5-stop gradient for performance
                        if (t < 0.25) { // Purple -> Blue
                            const localT = t / 0.25;
                            const r = Math.round(100 * (1 - localT) + 59 * localT);
                            const g = Math.round(50 * (1 - localT) + 130 * localT);
                            const b = Math.round(200 * (1 - localT) + 246 * localT);
                            color = `rgb(${r},${g},${b})`;
                        } else if (t < 0.5) { // Blue -> Green
                            const localT = (t - 0.25) / 0.25;
                            const r = Math.round(59 * (1 - localT) + 16 * localT);
                            const g = Math.round(130 * (1 - localT) + 185 * localT);
                            const b = Math.round(246 * (1 - localT) + 129 * localT);
                            color = `rgb(${r},${g},${b})`;
                        } else if (t < 0.75) { // Green -> Yellow
                            const localT = (t - 0.5) / 0.25;
                            const r = Math.round(16 * (1 - localT) + 234 * localT);
                            const g = Math.round(185 * (1 - localT) + 179 * localT);
                            const b = Math.round(129 * (1 - localT) + 8 * localT);
                            color = `rgb(${r},${g},${b})`;
                        } else { // Yellow -> Red
                            const localT = (t - 0.75) / 0.25;
                            const r = Math.round(234 * (1 - localT) + 239 * localT);
                            const g = Math.round(179 * (1 - localT) + 68 * localT);
                            const b = Math.round(8 * (1 - localT) + 68 * localT);
                            color = `rgb(${r},${g},${b})`;
                        }
                    }
                    else if (mapMode === 'gear') {
                        const gear = dataPoint.gear;
                        // Color scale for gears
                        const colors = ['#fff', '#9333ea', '#7e22ce', '#6b21a8', '#581c87', '#3b0764', '#2e1065', '#000'];
                        color = colors[gear] || '#fff';
                    }

                    ctx.strokeStyle = color;
                    ctx.beginPath();
                    const p1 = toScreen(map.x[i], map.y[i]);
                    const p2 = toScreen(map.x[i + 1], map.y[i + 1]);
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }

            // 3. Hover Marker
            if (hoveredDist !== null && map.distance) {
                // Find closest map point to hoveredDist
                let minDist = Infinity;
                let closestIdx = -1;
                for (let i = 0; i < map.distance.length; i++) {
                    const diff = Math.abs(map.distance[i] - hoveredDist);
                    if (diff < minDist) {
                        minDist = diff;
                        closestIdx = i;
                    }
                }

                if (closestIdx !== -1) {
                    const pos = toScreen(map.x[closestIdx], map.y[closestIdx]);

                    // Draw glow
                    ctx.shadowColor = '#fff';
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
                    ctx.fill();

                    // Reset shadow
                    ctx.shadowBlur = 0;
                }
            }
        }


        // 3. Draw Corner Markers (from Analysis Data)
        if (analysisData && analysisData.corners) {
            analysisData.corners.forEach(corner => {
                // We need to map distance to X/Y. 
                // Since we don't have the full map-distance mapping in this component easily without expensive search,
                // we can assume 'corners' in map object has coordinates if they do.
                // Or: 'map' object from replayData usually contains 'corners' with X/Y if we parsed them.

                // Let's try to find approximate position. 
                // The 'map.distance' array exists?

                let cx = 0, cy = 0;
                // Naive lookup: find index in map.distance closest to corner.distance
                if (map.distance) {
                    // Find index
                    // This is approximate but should work for visualization
                    let minD = Infinity;
                    let idx = -1;
                    // Sample every 10 points for speed
                    for (let i = 0; i < map.distance.length; i += 5) {
                        const d = Math.abs(map.distance[i] - corner.distance);
                        if (d < minD) { minD = d; idx = i; }
                    }

                    if (idx !== -1) {
                        cx = map.x[idx];
                        cy = map.y[idx];

                        const screen = toScreen(cx, cy);

                        // Draw Marker
                        ctx.beginPath();
                        ctx.fillStyle = corner.delta_at_apex < 0 ? '#10B981' : '#EF4444';
                        ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
                        ctx.fill();

                        // Draw Label
                        ctx.font = "bold 10px Arial";
                        ctx.fillStyle = "#CCC";
                        ctx.fillText(corner.number, screen.x + 8, screen.y + 3);
                    }
                }
            });
        }

    }, [map, mapMode, analysisData, minX, maxX, minY, maxY, w, h]);

    return (
        <div className="relative w-full h-full">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* MAP LEGEND overlay */}
            <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1 pointer-events-none">
                {mapMode === 'speed' ? (
                    <div className="bg-black/80 backdrop-blur-md p-2 rounded-lg border border-white/20 w-40 shadow-lg">
                        <div className="text-[10px] text-gray-300 font-bold uppercase mb-1 flex justify-between">
                            <span>50</span>
                            <span className="text-gray-500">Speed (km/h)</span>
                            <span>330+</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[linear-gradient(to_right,#3b0764,#3b82f6,#22c55e,#eab308,#ef4444)]" />
                    </div>
                ) : (
                    <div className="bg-black/80 backdrop-blur-md p-2 rounded-lg border border-white/20 shadow-lg">
                        <div className="text-[10px] text-gray-300 font-bold uppercase mb-1">Gears</div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(g => (
                                <div key={g} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-sm shadow-sm" style={{ backgroundColor: ['#fff', '#9333ea', '#7e22ce', '#6b21a8', '#581c87', '#3b0764', '#2e1065', '#000'][g] || '#fff' }} />
                                    <span className="text-[9px] text-black font-mono">{g}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ----- CUSTOM TOOLTIP -----
function CustomTooltip({ active, payload, label, corners }) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const dist = data.dist;
        const delta = data.delta;

        // Find close corner (within 50m)
        const closeCorner = corners.find(c => Math.abs(c.distance - dist) < 50);

        return (
            <div className="bg-gray-100 border border-[#333] p-3 rounded-lg shadow-xl z-50">
                <div className="text-gray-400 text-[10px] uppercase font-bold mb-1">
                    Distance: {Math.round(dist)}m
                </div>
                <div className={cn("text-lg font-bold font-mono", delta < 0 ? "text-green-500" : "text-f1-red")}>
                    {delta > 0 ? "+" : ""}{delta}s
                </div>

                {closeCorner && (
                    <div className="mt-2 pt-2 border-t border-[#333]">
                        <div className="text-black font-bold text-xs mb-1">Turn {closeCorner.number}</div>
                        <div className="text-[10px] text-gray-400">
                            Delta at Apex: <span className={closeCorner.delta_at_apex < 0 ? "text-green-500" : "text-f1-red"}>{closeCorner.delta_at_apex}s</span>
                        </div>
                        {closeCorner.reason && closeCorner.reason !== "Balanced" && (
                            <div className="mt-1 bg-white/5 p-1.5 rounded border border-white/10 text-[10px] text-gray-300">
                                <span className="text-f1-red font-bold">Analysis:</span> {closeCorner.reason}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }
    return null;
}
