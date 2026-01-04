import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { LayoutDashboard, Zap, TrendingUp, Settings, Map as MapIcon, ChevronDown, Monitor, Share2, BarChart, ArrowRight, Timer, AlertCircle, RefreshCw, Gauge, Activity, Cloud, Wind, Thermometer } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, AreaChart, Area, CartesianGrid } from 'recharts';

export default function TelemetryAnalysis({ raceId: initialRaceId }) {
    // --- STATE ---
    const [raceId, setRaceId] = useState(initialRaceId || 0);
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
                const res = await axios.get('http://localhost:5000/api/races');
                setRaceList(res.data);
                if (!raceId && res.data.length > 0) setRaceId(res.data[0].id);
                else if (initialRaceId) setRaceId(initialRaceId);
            } catch (e) { console.error("Failed to fetch races", e); }
        };
        init();
    }, [initialRaceId]);

    // Fetch Replay Data (for Track Map & Driver List)
    useEffect(() => {
        if (!raceId) return;
        const fetchData = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/replay/${raceId}`);
                setReplayData(res.data);
                // Default drivers
                if (res.data.data[1] && res.data.data[1].length >= 2) {
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
            const res = await axios.get(`http://localhost:5000/api/laps?raceId=${raceId}&driverId=${activeDriver}`);
            setActiveLapsList(res.data);
            setSelectedLap('fastest');
        };
        fetchLaps();
    }, [raceId, activeDriver]);

    useEffect(() => {
        if (!raceId || !compareDriver) return;
        const fetchLaps = async () => {
            const res = await axios.get(`http://localhost:5000/api/laps?raceId=${raceId}&driverId=${compareDriver}`);
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
                const res = await axios.get(`http://localhost:5000/api/analysis/compare?raceId=${raceId}&driver1=${activeDriver}&driver2=${compareDriver}&lap1=${selectedLap}&lap2=${selectedLap}`);
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

    return (
        <div className="p-6 space-y-6 animate-in fade-in zoom-in duration-500 h-screen flex flex-col overflow-hidden">
            {/* HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 border-b border-[#2A2A30] pb-6 shrink-0">
                <div className="flex-1 space-y-2">
                    <h2 className="text-3xl font-heading font-bold italic tracking-tighter uppercase text-white">Deep Dive Analysis</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">{raceList.find(r => r.id === raceId)?.name}</span>
                        <span className="bg-f1-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide">TELEMETRY ENGINE</span>
                    </div>
                </div>

                {/* CONTROLS */}
                <div className="flex items-center gap-4 bg-[#15151E] p-3 rounded-xl border border-[#2A2A30]">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-bold uppercase mb-1">Reference</span>
                            <select value={activeDriver} onChange={(e) => setActiveDriver(e.target.value)} className="bg-[#2A2A30] text-white font-bold text-sm px-2 py-1 rounded focus:outline-none w-40">
                                {replayData?.drivers && Object.entries(replayData.drivers).map(([code, d]) => <option key={code} value={code}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="text-gray-500 pt-3 cursor-pointer hover:text-white transition-colors" onClick={() => {
                            const temp = activeDriver;
                            setActiveDriver(compareDriver);
                            setCompareDriver(temp);
                        }}>
                            <RefreshCw size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-bold uppercase mb-1">Compare</span>
                            <select value={compareDriver} onChange={(e) => setCompareDriver(e.target.value)} className="bg-[#2A2A30] text-white font-bold text-sm px-2 py-1 rounded focus:outline-none w-40">
                                {replayData?.drivers && Object.entries(replayData.drivers).map(([code, d]) => <option key={code} value={code}>{d.name}</option>)}
                            </select>
                        </div>

                        <div className="w-px h-8 bg-[#2A2A30] mx-2" />

                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-bold uppercase mb-1">Analysis Lap</span>
                            <select value={selectedLap} onChange={(e) => setSelectedLap(e.target.value)} className="bg-[#2A2A30] text-white font-bold text-xs px-2 py-1 rounded focus:outline-none w-48">
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
            </div>

            {/* GLOBAL CONTEXT BAR */}
            <div className="flex items-center gap-6 bg-[#15151E]/50 px-4 py-2 rounded-lg border border-[#2A2A30] shrink-0 mx-2">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                    <span className="text-f1-red font-bold uppercase">Session</span>
                    <span className="text-white">{analysisData?.session_name || 'Loading...'}</span>
                </div>
                <div className="w-px h-4 bg-[#2A2A30]" />
                <div className="flex items-center gap-4 text-xs text-gray-400 font-mono">
                    <div className="flex items-center gap-1.5" title="Track Temp">
                        <Thermometer size={12} className="text-orange-500" />
                        <span>{analysisData?.conditions?.trackTemp ? `${analysisData.conditions.trackTemp}°C` : '--'}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Air Temp">
                        <Cloud size={12} className="text-blue-400" />
                        <span>{analysisData?.conditions?.airTemp ? `${analysisData.conditions.airTemp}°C` : '--'}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Wind">
                        <Wind size={12} className="text-gray-400" />
                        <span>{analysisData?.conditions?.windSpeed ? `${analysisData.conditions.windSpeed}m/s` : '--'}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Humidity">
                        <span className="font-bold text-blue-500">%</span>
                        <span>{analysisData?.conditions?.humidity ? `${analysisData.conditions.humidity}%` : '--'}</span>
                    </div>
                </div>
                <div className="w-px h-4 bg-[#2A2A30]" />
                <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                    <span className="text-green-500 font-bold uppercase">DRS</span>
                    <span className="text-white">Enabled</span>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex flex-row gap-4 flex-1 min-h-0 overflow-hidden pr-2">

                {/* LEFT: MAP & SUMMARY (4 Cols) */}
                {/* LEFT: SUMMARY, STINTS, MAP (4 Cols) */}
                {/* LEFT [Col-2]: SUMMARY & STINTS */}
                <div style={{ flex: 3 }} className="min-w-0 flex flex-col gap-4 overflow-hidden h-full">
                    {/* 1. SUMMARY CARD */}
                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-4 shrink-0">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2"><Timer size={14} /> Lap Comp</h3>
                        {loading ? (
                            <div className="text-sm text-gray-500 animate-pulse">Calculating...</div>
                        ) : analysisData?.error ? (
                            <div className="text-xs text-red-500 font-bold bg-red-500/10 p-2 rounded border border-red-500/50 flex items-start gap-2">
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                <span>{analysisData.error}</span>
                            </div>
                        ) : analysisData ? (
                            <div className="space-y-2">
                                <div className="flex items-baseline justify-between mb-2">
                                    <span className="text-xl font-heading font-bold text-white">{activeDriver}</span>
                                    <span className={cn("text-sm font-bold font-mono", analysisData.lap_time_diff < 0 ? "text-green-500" : "text-f1-red")}>
                                        {analysisData.lap_time_diff > 0 ? "+" : ""}{analysisData.lap_time_diff}s
                                    </span>
                                    <span className="text-xl font-heading font-bold text-gray-500">{compareDriver}</span>
                                </div>

                                {/* SECTOR TABLE */}
                                {(() => {
                                    const l1 = activeLapsList.find(l => String(l.lap_number) === String(selectedLap)) || activeLapsList.find(l => l.is_fastest);
                                    const l2 = compareLapsList.find(l => String(l.lap_number) === String(selectedLap)) || compareLapsList.find(l => l.is_fastest);
                                    if (!l1 || !l2) return null;

                                    const formatTime = (t) => t ? formatLapTime(t) : '-';

                                    return (
                                        <div className="bg-[#00000040] rounded-xl p-2 text-sm font-mono space-y-1">
                                            <div className="grid grid-cols-[3rem_1fr_1fr] gap-1 text-gray-400 font-bold uppercase border-b border-gray-700 pb-1 mb-1">
                                                <div>Metric</div>
                                                <div className="text-right">{activeDriver}</div>
                                                <div className="text-right">{compareDriver}</div>
                                            </div>
                                            <div className="grid grid-cols-[3rem_1fr_1fr] gap-1">
                                                <div className="text-gray-400">Lap</div>
                                                <div className="text-right text-white space-x-2">
                                                    <span>{formatTime(l1.lap_time)}</span>
                                                    <span className={cn("px-1 rounded text-[10px] font-bold text-black",
                                                        l1.compound === 'SOFT' ? 'bg-red-500' :
                                                            l1.compound === 'MEDIUM' ? 'bg-yellow-400' :
                                                                l1.compound === 'HARD' ? 'bg-white' : 'bg-green-500')}>
                                                        {l1.compound?.[0]}
                                                    </span>
                                                </div>
                                                <div className="text-right text-white space-x-2">
                                                    <span>{formatTime(l2.lap_time)}</span>
                                                    <span className={cn("px-1 rounded text-[10px] font-bold text-black",
                                                        l2.compound === 'SOFT' ? 'bg-red-500' :
                                                            l2.compound === 'MEDIUM' ? 'bg-yellow-400' :
                                                                l2.compound === 'HARD' ? 'bg-white' : 'bg-green-500')}>
                                                        {l2.compound?.[0]}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-[3rem_1fr_1fr] gap-1">
                                                <div className="text-gray-400">S1</div>
                                                <div className="text-right text-gray-200">{formatTime(l1.s1)}</div>
                                                <div className="text-right text-gray-200">{formatTime(l2.s1)}</div>
                                            </div>
                                            <div className="grid grid-cols-[3rem_1fr_1fr] gap-1">
                                                <div className="text-gray-400">S2</div>
                                                <div className="text-right text-gray-200">{formatTime(l1.s2)}</div>
                                                <div className="text-right text-gray-200">{formatTime(l2.s2)}</div>
                                            </div>
                                            <div className="grid grid-cols-[3rem_1fr_1fr] gap-1">
                                                <div className="text-gray-400">S3</div>
                                                <div className="text-right text-gray-200">{formatTime(l1.s3)}</div>
                                                <div className="text-right text-gray-200">{formatTime(l2.s3)}</div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="text-xs text-gray-600">Select drivers.</div>
                        )}
                    </div>

                    {/* 2. STINT STRATEGY (Flex Fill) */}
                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-4 shrink-0">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2"><Zap size={14} /> Tyre Strategy</h3>
                        <div className="space-y-2">
                            {[
                                { driver: activeDriver, laps: activeLapsList },
                                { driver: compareDriver, laps: compareLapsList }
                            ].map(({ driver, laps }) => {
                                if (!laps || laps.length === 0) return null;
                                const stints = [];
                                let current = null;
                                const sorted = [...laps].sort((a, b) => a.lap_number - b.lap_number);
                                sorted.forEach(l => {
                                    const compound = l.compound || 'UNKNOWN';
                                    if (!current || current.compound !== compound) {
                                        if (current) stints.push(current);
                                        current = { compound, start: l.lap_number, end: l.lap_number, count: 0 };
                                    }
                                    current.end = l.lap_number;
                                    current.count++;
                                });
                                if (current) stints.push(current);

                                const getColor = (c) => {
                                    if (c === 'SOFT') return 'bg-red-500';
                                    if (c === 'MEDIUM') return 'bg-yellow-400';
                                    if (c === 'HARD') return 'bg-white';
                                    if (c === 'INTERMEDIATE') return 'bg-green-500';
                                    if (c === 'WET') return 'bg-blue-500';
                                    return 'bg-gray-500';
                                };

                                return (
                                    <div key={driver}>
                                        <div className="flex justify-between items-baseline mb-1">
                                            <div className="text-xs font-bold text-white">{driver}</div>
                                        </div>
                                        <div className="flex gap-0.5 h-2 w-full bg-[#00000040] rounded-sm overflow-hidden">
                                            {stints.map((s, i) => (
                                                <div key={i} style={{ flex: s.count }} className={cn("h-full opacity-90", getColor(s.compound))} title={`${s.count}L`} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>


                {/* MIDDLE [Col-5]: CHART & CORNERS */}
                <div style={{ flex: 5 }} className="min-w-0 flex flex-col gap-4 overflow-hidden h-full">
                    {/* DELTA CHART */}
                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-4 h-[260px] shrink-0 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                {deltaMode === 'time' && <TrendingUp size={14} />}
                                {deltaMode === 'speed' && <Gauge size={14} />}
                                {deltaMode === 'throttle' && <Activity size={14} />}
                                {deltaMode === 'time' ? 'Time Delta' : deltaMode === 'speed' ? 'Speed Delta' : 'Throttle Delta'}
                            </h3>
                            {/* DELTA MODE SWITCHER */}
                            <div className="flex bg-[#0E0E12] rounded p-0.5 border border-[#2A2A30]">
                                {['time', 'speed', 'throttle'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setDeltaMode(m)}
                                        className={cn(
                                            "px-2 py-0.5 text-[10px] uppercase font-bold rounded transition-colors",
                                            deltaMode === m ? "bg-[#2A2A30] text-white" : "text-gray-500 hover:text-gray-300"
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
                                                    <stop offset={off} stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset={off} stopColor="#ef4444" stopOpacity={0.3} />
                                                </linearGradient>
                                                <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset={off} stopColor="#10b981" stopOpacity={1} />
                                                    <stop offset={off} stopColor="#ef4444" stopOpacity={1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A30" vertical={false} />
                                            <XAxis dataKey="dist" hide />
                                            <YAxis hide domain={['auto', 'auto']} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#15151E', borderColor: '#2A2A30', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                                labelStyle={{ display: 'none' }}
                                                formatter={(val) => [`${Math.abs(val)}s`, val > 0 ? `${compareDriver} Ahead` : `${activeDriver} Ahead`]}
                                            />
                                            <ReferenceLine y={0} stroke="#4B5563" strokeDasharray="3 3" />
                                            <Area
                                                type="monotone"
                                                dataKey="delta"
                                                stroke="url(#splitStroke)"
                                                fill="url(#splitColor)"
                                                strokeWidth={2}
                                                activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
                                                isAnimationActive={false}
                                            />
                                            {hoveredDist && <ReferenceLine x={hoveredDist} stroke="#FFFF00" />}
                                        </AreaChart>
                                    ) : (
                                        <LineChart data={analysisData.delta_series}
                                            onMouseMove={(e) => {
                                                if (e.activePayload) {
                                                    setHoveredDist(e.activePayload[0].payload.dist);
                                                }
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A30" vertical={false} />
                                            <XAxis dataKey="dist" hide />
                                            <YAxis hide domain={['auto', 'auto']} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#15151E', borderColor: '#2A2A30', color: '#fff' }}
                                                labelStyle={{ display: 'none' }}
                                                formatter={(val, name) => [
                                                    deltaMode === 'speed' ? `${val} km/h` : `${val}%`,
                                                    name === 'speed_delta' ? 'Speed Delta' : 'Throttle Delta'
                                                ]}
                                            />
                                            <ReferenceLine y={0} stroke="#4B5563" strokeDasharray="3 3" />
                                            <Line
                                                type="monotone"
                                                dataKey={deltaMode === 'speed' ? "speed_delta" : "throttle_delta"}
                                                stroke={deltaMode === 'speed' ? "#3b82f6" : "#f59e0b"}
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
                                                isAnimationActive={false}
                                            />
                                            {hoveredDist && <ReferenceLine x={hoveredDist} stroke="#FFFF00" />}
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-600 text-xs">Select drivers</div>
                            )}
                        </div>
                    </div>


                    {/* CORNER GRID (Flex scroll) */}
                    <div className="flex-1 min-h-0 bg-[#15151E] rounded-3xl border border-[#2A2A30] p-4 flex flex-col overflow-hidden">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2"><MapIcon size={14} /> Corner Analysis</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {analysisData?.corners ? (
                                    analysisData.corners.map((corner, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className={cn(
                                                "bg-[#1A1A22] border border-[#2A2A30] rounded-xl p-2.5 transition-colors cursor-pointer group",
                                                hoveredDist && Math.abs(corner.distance - hoveredDist) < 100 ? "border-white bg-[#2A2A30]" : "hover:border-gray-500"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-gray-500 uppercase">T{corner.number}</span>
                                                <span className={cn("text-[9px] font-bold px-1 rounded", corner.delta_at_apex < 0 ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}>
                                                    {corner.delta_at_apex > 0 ? "+" : ""}{corner.delta_at_apex}s
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-gray-500">Min</span>
                                                    <span className="text-white font-bold">{corner.d1_min_speed}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-gray-500">Gear</span>
                                                    <span className="text-white font-bold">{corner.d1_gear}</span>
                                                </div>
                                                <div className="h-1 w-full bg-[#2A2A30] rounded-full mt-1 overflow-hidden">
                                                    <div
                                                        className={cn("h-full", corner.delta_at_apex < 0 ? "bg-green-500" : "bg-red-500")}
                                                        style={{ width: `${Math.min(Math.abs(corner.delta_at_apex) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className="col-span-full text-center text-gray-700 py-10">Analysis data unavailable</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT [Col-4]: TRACK MAP */}
                <div style={{ flex: 4 }} className="min-w-0 bg-[#15151E] rounded-3xl border border-[#2A2A30] p-4 flex-1 min-h-0 relative overflow-hidden flex flex-col">
                    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-black/50 p-1 rounded backdrop-blur-sm">Track Viz</h3>
                        <div className="flex gap-1">
                            <button onClick={() => setMapMode('speed')} className={cn("p-1 rounded border transition-colors bg-black/50 backdrop-blur-sm", mapMode === 'speed' ? "border-f1-red text-f1-red" : "border-gray-700 text-gray-500 hover:text-white")}><Zap size={10} /></button>
                            <button onClick={() => setMapMode('gear')} className={cn("p-1 rounded border transition-colors bg-black/50 backdrop-blur-sm", mapMode === 'gear' ? "border-purple-600 text-purple-600" : "border-gray-700 text-gray-500 hover:text-white")}><Settings size={10} /></button>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        {replayData?.map && (
                            <CanvasMap
                                map={replayData.map}
                                mapMode={mapMode}
                                analysisData={analysisData}
                                hoveredDist={hoveredDist}
                            />
                        )}
                    </div>
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
                                    <span className="text-[9px] text-white font-mono">{g}</span>
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
            <div className="bg-[#1A1A22] border border-[#333] p-3 rounded-lg shadow-xl z-50">
                <div className="text-gray-400 text-[10px] uppercase font-bold mb-1">
                    Distance: {Math.round(dist)}m
                </div>
                <div className={cn("text-lg font-bold font-mono", delta < 0 ? "text-green-500" : "text-f1-red")}>
                    {delta > 0 ? "+" : ""}{delta}s
                </div>

                {closeCorner && (
                    <div className="mt-2 pt-2 border-t border-[#333]">
                        <div className="text-white font-bold text-xs mb-1">Turn {closeCorner.number}</div>
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
