import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Play, Pause, Zap, TrendingUp, ChevronDown, ChevronUp, Flag, Thermometer, Droplets, RotateCcw, ArrowUp, ArrowDown, Timer, Circle, Wrench, AlertTriangle, List } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function RaceReplay({ raceId: initialRaceId, onPlayingChange }) {
    const [raceId, setRaceId] = useState(initialRaceId || 0);
    const [raceList, setRaceList] = useState([]);
    const [activeDriver, setActiveDriver] = useState(null);
    const [replayData, setReplayData] = useState(null);
    const [maxTime, setMaxTime] = useState(0);
    const [timeOffset, setTimeOffset] = useState(0);
    const [raceTime, setRaceTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(20);
    const [loading, setLoading] = useState(false);
    const [raceEvents, setRaceEvents] = useState([]);
    const [mobileTab, setMobileTab] = useState('map'); // 'map', 'standings', 'events'
    const [showLeaderboard, setShowLeaderboard] = useState(true); // Toggle mini leaderboard

    // Use refs to avoid re-render loops
    const prevPositionsRef = useRef({});
    const prevTyresRef = useRef({});
    const feedRef = useRef(null);
    const positionChangesRef = useRef({});
    const [, forceUpdate] = useState(0);

    // Init
    useEffect(() => {
        const init = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/races');
                setRaceList(res.data);
                if (!raceId && res.data.length > 0) setRaceId(res.data[0].id);
                else if (initialRaceId) setRaceId(initialRaceId);
            } catch (e) { console.error(e); }
        };
        init();
    }, [initialRaceId]);

    useEffect(() => {
        if (!raceId) return;
        const fetchData = async () => {
            setLoading(true);
            setReplayData(null);
            setIsPlaying(false);
            setRaceTime(0);
            prevPositionsRef.current = {};
            prevTyresRef.current = {};
            positionChangesRef.current = {};
            setRaceEvents([]);
            try {
                const repRes = await axios.get(`http://localhost:5000/api/replay/${raceId}`);
                setReplayData(repRes.data);

                let minStart = Infinity;
                if (repRes.data.data[1]) {
                    repRes.data.data[1].forEach(d => {
                        if (d.cummulative && d.time) {
                            const start = d.cummulative - d.time;
                            if (start < minStart) minStart = start;
                        }
                    });
                }
                if (minStart === Infinity) minStart = 0;
                setTimeOffset(minStart);

                let max = 0;
                const lastLapData = repRes.data.data[repRes.data.totalLaps];
                if (lastLapData) {
                    const lastFinish = Math.max(...lastLapData.map(d => d.cummulative || 0));
                    max = lastFinish - minStart;
                }
                setMaxTime(max || 7200);

                if (repRes.data.data[1]?.[0]) setActiveDriver(repRes.data.data[1][0].driver);
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [raceId]);

    // Animation Loop using ref to avoid state dependencies
    const raceTimeRef = useRef(raceTime);
    raceTimeRef.current = raceTime;

    useEffect(() => {
        if (!isPlaying) return;

        let animationFrame;
        let lastStamp = performance.now();

        const loop = (now) => {
            const delta = (now - lastStamp) / 1000;
            lastStamp = now;

            const next = raceTimeRef.current + (delta * speed);
            if (next >= maxTime) {
                setIsPlaying(false);
                setRaceTime(maxTime);
                return;
            }
            setRaceTime(next);
            animationFrame = requestAnimationFrame(loop);
        };

        animationFrame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying, speed, maxTime]);

    // Status & Weather
    const { currentStatus, currentWeather } = useMemo(() => {
        if (!replayData?.events) return { currentStatus: 'GREEN', currentWeather: null };
        const effectiveTime = raceTime + timeOffset;
        let status = 'GREEN';
        let weather = replayData.events.find(e => e.status === 'WEATHER')?.weather || null;
        for (const ev of replayData.events) {
            if (ev.time > effectiveTime) break;
            if (ev.status !== 'WEATHER') status = ev.status;
            if (ev.status === 'WEATHER') weather = ev.weather;
        }
        return { currentStatus: status, currentWeather: weather };
    }, [replayData, raceTime, timeOffset]);

    // Positions
    const currentPositions = useMemo(() => {
        if (!replayData) return [];
        const positions = [];
        const drivers = replayData.data[1] ? replayData.data[1].map(d => d.driver) : [];
        const effectiveTime = raceTime + timeOffset;

        drivers.forEach(driver => {
            let currentLapData = null, prevLapTime = 0, lapNum = 1;

            for (let l = 1; l <= replayData.totalLaps; l++) {
                const dData = replayData.data[l]?.find(d => d.driver === driver);
                if (!dData) continue;
                const finishTime = dData.cummulative, duration = dData.time, startTime = finishTime - duration;

                if (effectiveTime <= finishTime) {
                    if (effectiveTime >= startTime) { currentLapData = dData; prevLapTime = startTime; lapNum = l; }
                    else if (l === 1) { currentLapData = dData; prevLapTime = startTime; lapNum = 1; }
                    break;
                }
            }

            if (!currentLapData) {
                const lastData = replayData.data[replayData.totalLaps]?.find(d => d.driver === driver);
                if (lastData && effectiveTime > lastData.cummulative) {
                    currentLapData = lastData; prevLapTime = lastData.cummulative - lastData.time; lapNum = replayData.totalLaps;
                }
            }

            if (currentLapData) {
                let progress = (effectiveTime - prevLapTime) / currentLapData.time;
                progress = Math.max(0, Math.min(1, progress));
                positions.push({ driver, tyre: currentLapData.tyre, progress, lap: lapNum, score: lapNum + progress });
            }
        });

        positions.sort((a, b) => b.score - a.score);
        positions.forEach((p, i) => {
            p.rank = i + 1;
            p.interval = i === 0 ? null : ((positions[i - 1].lap + positions[i - 1].progress) - (p.lap + p.progress)) * 85;
        });
        return positions;
    }, [replayData, raceTime, timeOffset]);

    // Detect overtakes using refs to avoid render loops
    useEffect(() => {
        if (currentPositions.length === 0) return;

        const newPosMap = {};
        currentPositions.forEach(p => { newPosMap[p.driver] = p.rank; });

        let hasChanges = false;
        const newChanges = {};

        Object.entries(newPosMap).forEach(([driver, newRank]) => {
            const oldRank = prevPositionsRef.current[driver];
            if (oldRank && oldRank !== newRank) {
                newChanges[driver] = oldRank - newRank;
                hasChanges = true;

                if (oldRank > newRank) {
                    const overtaken = Object.entries(newPosMap).find(([d, r]) => prevPositionsRef.current[d] === newRank)?.[0];
                    setRaceEvents(prev => [...prev, {
                        type: 'OVERTAKE',
                        lap: currentPositions.find(p => p.driver === driver)?.lap || 1,
                        driver,
                        overtaken,
                        id: `${driver}-${Date.now()}`
                    }]);
                } else {
                    // Position lost
                    setRaceEvents(prev => [...prev, {
                        type: 'LOST',
                        lap: currentPositions.find(p => p.driver === driver)?.lap || 1,
                        driver,
                        positions: Math.abs(oldRank - newRank),
                        id: `${driver}-lost-${Date.now()}`
                    }]);
                }
            }
        });

        prevPositionsRef.current = newPosMap;

        // Detect pit stops by tyre changes
        currentPositions.forEach(p => {
            const prevTyre = prevTyresRef.current[p.driver];
            if (prevTyre && prevTyre !== p.tyre) {
                setRaceEvents(prev => [...prev, {
                    type: 'PIT',
                    lap: p.lap,
                    driver: p.driver,
                    fromTyre: prevTyre,
                    toTyre: p.tyre,
                    id: `${p.driver}-pit-${Date.now()}`
                }]);
            }
            prevTyresRef.current[p.driver] = p.tyre;
        });

        if (hasChanges) {
            positionChangesRef.current = newChanges;
            forceUpdate(n => n + 1);
            setTimeout(() => {
                positionChangesRef.current = {};
                forceUpdate(n => n + 1);
            }, 2500);
        }
    }, [currentPositions]);

    // Auto-scroll feed to bottom
    useEffect(() => {
        if (feedRef.current && raceEvents.length > 0) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [raceEvents]);

    const currentRaceName = raceList.find(r => r.id === raceId)?.name || '';
    const activeDriverState = currentPositions.find(p => p.driver === activeDriver);
    const battles = currentPositions.filter(p => p.interval && p.interval < 1.5).slice(0, 3);
    const positionChanges = positionChangesRef.current;

    if (loading) return <div className="text-gray-500 animate-pulse p-8">Loading...</div>;

    return (
        <div className="h-full flex flex-col bg-[#0A0A0F]" style={{ overflow: 'hidden', maxHeight: '100%' }}>
            {/* ===== MOBILE TOP BAR ===== */}
            <div className="md:hidden flex flex-col bg-[#111] border-b border-[#222] shrink-0">
                {/* Row 1: Race Selector */}
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-f1-red animate-pulse" />
                            <span className="text-[10px] font-bold text-f1-red uppercase">Live</span>
                        </div>
                        <select
                            value={raceId}
                            onChange={(e) => { setRaceId(parseInt(e.target.value)); setRaceTime(0); }}
                            className="flex-1 bg-[#0a0a0a] text-white font-medium text-sm border border-[#222] rounded-lg px-3 py-2.5 focus:outline-none focus:border-f1-red"
                        >
                            {raceList.map(r => <option key={r.id} value={r.id} className="bg-[#1A1A22]">{r.name}</option>)}
                        </select>
                    </div>
                    <div className={cn("ml-3 px-3 py-1.5 rounded text-[10px] font-bold uppercase shrink-0",
                        currentStatus === 'GREEN' ? "bg-green-500 text-white" : currentStatus === 'YELLOW' ? "bg-yellow-500 text-black" : "bg-red-500 text-white")}>
                        {currentStatus}
                    </div>
                </div>

                {/* Row 2: Playback Controls */}
                <div className="flex items-center gap-3 px-4 py-3 border-t border-[#1a1a1a]">
                    {/* Play/Pause */}
                    <button onClick={() => setRaceTime(0)} className="p-2 text-gray-500 hover:text-white">
                        <RotateCcw size={18} />
                    </button>
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-11 h-11 flex items-center justify-center bg-f1-red rounded-full text-white shrink-0"
                    >
                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                    </button>

                    {/* Progress Bar - Full Width */}
                    <div className="flex-1 flex items-center gap-2">
                        <input
                            type="range"
                            min="0"
                            max={maxTime}
                            step="1"
                            value={raceTime}
                            onChange={(e) => { setRaceTime(parseFloat(e.target.value)); setIsPlaying(false); }}
                            className="flex-1 accent-f1-red h-2 bg-[#222] rounded-full appearance-none cursor-pointer"
                        />
                    </div>

                    {/* Lap Counter */}
                    <div className="text-center shrink-0 pl-2">
                        <div className="text-[10px] text-gray-500 uppercase">Lap</div>
                        <div className="text-sm font-mono font-bold text-white">{activeDriverState?.lap || 1}/{replayData?.totalLaps || '—'}</div>
                    </div>
                </div>

                {/* Speed Controls Row */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1a1a1a] bg-[#0a0a0a]">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-gray-500 uppercase mr-1">Speed</span>
                        {[1, 5, 20, 50].map(s => (
                            <button
                                key={s}
                                onClick={() => setSpeed(s)}
                                className={cn("px-2.5 py-1 text-[10px] font-bold rounded transition-colors",
                                    speed === s ? "bg-f1-red text-white" : "bg-[#111] text-gray-500 hover:text-white")}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                    {currentWeather && (
                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                            <span><Thermometer size={10} className="inline mr-0.5" />{currentWeather.temp}°C</span>
                            <span className={currentWeather.rain ? "text-blue-400" : ""}><Droplets size={10} className="inline mr-0.5" />{currentWeather.rain ? "WET" : "DRY"}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== DESKTOP TOP BAR ===== */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-2 bg-[#15151E] border-b border-[#2A2A30] px-3 md:px-4 py-2 shrink-0">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-f1-red animate-pulse" />
                        <span className="text-xs font-bold text-white uppercase">Live</span>
                    </div>
                    <select value={raceId} onChange={(e) => { setRaceId(parseInt(e.target.value)); setRaceTime(0); }}
                        className="bg-transparent text-white font-bold text-xs md:text-sm focus:outline-none cursor-pointer border-none max-w-[120px] md:max-w-none truncate">
                        {raceList.map(r => <option key={r.id} value={r.id} className="bg-[#1A1A22]">{r.name}</option>)}
                    </select>
                    <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        currentStatus === 'GREEN' ? "bg-green-500" : currentStatus === 'YELLOW' ? "bg-yellow-500 text-black" : "bg-red-500")}>
                        {currentStatus}
                    </div>
                </div>

                {currentWeather && (
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                        <span><Thermometer size={10} className="inline mr-1" />{currentWeather.temp}°C</span>
                        <span className={currentWeather.rain ? "text-blue-400" : ""}><Droplets size={10} className="inline mr-1" />{currentWeather.rain ? "WET" : "DRY"}</span>
                    </div>
                )}

                <div className="flex items-center gap-1 md:gap-2">
                    <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">L{activeDriverState?.lap || 1}/{replayData?.totalLaps || '—'}</span>
                    <button onClick={() => setRaceTime(0)} className="p-1 text-gray-500 hover:text-white"><RotateCcw size={12} /></button>
                    <div className="hidden sm:flex bg-black/30 rounded p-0.5">
                        {[1, 5, 20, 50].map(s => (
                            <button key={s} onClick={() => setSpeed(s)} className={cn("px-1.5 py-0.5 text-[9px] font-bold rounded", speed === s ? "bg-white text-black" : "text-gray-500")}>{s}x</button>
                        ))}
                    </div>
                    <button onClick={() => setIsPlaying(!isPlaying)} className="w-7 h-7 flex items-center justify-center bg-f1-red rounded text-white">
                        {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <input type="range" min="0" max={maxTime} step="1" value={raceTime} onChange={(e) => { setRaceTime(parseFloat(e.target.value)); setIsPlaying(false); }}
                        className="w-16 sm:w-24 accent-f1-red h-1 bg-[#2A2A30] rounded appearance-none cursor-pointer" />
                    <span className="text-[10px] text-gray-400 font-mono w-14 hidden sm:inline">{new Date(raceTime * 1000).toISOString().substr(11, 8)}</span>
                </div>
            </div>

            {/* ===== MOBILE LAYOUT ===== */}
            <div className="md:hidden flex-1 flex flex-col overflow-hidden" style={{ minHeight: 'calc(100vh - 180px)' }}>
                {/* Full-screen Track Map - Clean View */}
                <div className="flex-1 relative bg-[#050508]" style={{ minHeight: '350px' }}>
                    {/* Mini Leaderboard Toggle - Top Right */}
                    <button
                        onClick={() => setShowLeaderboard(!showLeaderboard)}
                        className="absolute top-3 right-3 z-20 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-[#333] flex items-center gap-1.5"
                    >
                        <List size={14} className="text-gray-400" />
                        <span className="text-[10px] text-gray-400">P1-5</span>
                        {showLeaderboard ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                    </button>

                    {/* Mini Leaderboard - Top 5 Positions */}
                    <AnimatePresence>
                        {showLeaderboard && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-14 right-3 z-20 bg-black/80 backdrop-blur-sm rounded-lg border border-[#222] overflow-hidden"
                            >
                                {currentPositions.slice(0, 5).map((d) => {
                                    const meta = replayData?.drivers?.[d.driver];
                                    return (
                                        <div
                                            key={d.driver}
                                            onClick={() => setActiveDriver(d.driver)}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-1.5 border-b border-[#1a1a1a] last:border-b-0 cursor-pointer",
                                                activeDriver === d.driver && "bg-white/10"
                                            )}
                                        >
                                            <span className={cn(
                                                "w-4 text-center font-bold text-xs",
                                                d.rank === 1 ? "text-f1-red" : d.rank <= 3 ? "text-white" : "text-gray-500"
                                            )}>{d.rank}</span>
                                            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: meta?.color || '#444' }} />
                                            <span className="text-xs font-medium text-white w-10">{d.driver}</span>
                                            <span className="text-[10px] text-gray-500 font-mono">
                                                {d.interval ? `+${d.interval.toFixed(1)}` : 'Leader'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* The Map */}
                    {replayData?.map ? (
                        <SVGTrackMap
                            map={replayData.map}
                            positions={currentPositions}
                            activeDriver={activeDriver}
                            drivers={replayData.drivers}
                            showAllLabels={true}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-8 h-8 border-2 border-f1-red border-t-transparent rounded-full animate-spin mx-auto" />
                                <div className="text-gray-500 text-sm mt-2">Loading track...</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Compact Position Ticker - Bottom */}
                <div className="bg-[#0a0a0a] border-t border-[#222] shrink-0">
                    {/* Horizontal Scroll Position Strip */}
                    <div className="flex overflow-x-auto py-2 px-2 gap-1 no-scrollbar">
                        {currentPositions.slice(0, 20).map((d) => {
                            const meta = replayData?.drivers?.[d.driver];
                            const isTop3 = d.rank <= 3;
                            const isActive = activeDriver === d.driver;
                            return (
                                <button
                                    key={d.driver}
                                    onClick={() => setActiveDriver(d.driver)}
                                    className={cn(
                                        "flex items-center gap-1 px-2 py-1 rounded shrink-0 transition-all",
                                        isActive ? "bg-white/10 ring-1 ring-white/30" : "bg-[#111]",
                                        isTop3 && !isActive && "bg-[#151515]"
                                    )}
                                >
                                    <span className={cn(
                                        "text-[10px] font-bold w-3",
                                        d.rank === 1 ? "text-f1-red" : d.rank <= 3 ? "text-white" : "text-gray-500"
                                    )}>{d.rank}</span>
                                    <div className="w-0.5 h-3 rounded-full" style={{ backgroundColor: meta?.color || '#444' }} />
                                    <span className="text-[10px] font-medium text-white">{d.driver}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected Driver Info Bar */}
                    {activeDriver && (
                        <div className="flex items-center justify-between px-3 py-2 border-t border-[#1a1a1a] bg-[#0d0d0d]">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-5 rounded-full" style={{ backgroundColor: replayData?.drivers?.[activeDriver]?.color || '#888' }} />
                                <div>
                                    <div className="text-xs font-bold text-white">{activeDriver}</div>
                                    <div className="text-[9px] text-gray-500">{replayData?.drivers?.[activeDriver]?.team || 'Unknown'}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-center">
                                    <div className="text-[9px] text-gray-500 uppercase">Pos</div>
                                    <div className="text-sm font-bold text-white">P{currentPositions.find(p => p.driver === activeDriver)?.rank || '-'}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[9px] text-gray-500 uppercase">Gap</div>
                                    <div className="text-sm font-mono text-gray-300">
                                        {(() => {
                                            const pos = currentPositions.find(p => p.driver === activeDriver);
                                            return pos?.interval ? `+${pos.interval.toFixed(1)}s` : 'Leader';
                                        })()}
                                    </div>
                                </div>
                                <TyreIcon compound={currentPositions.find(p => p.driver === activeDriver)?.tyre || 'M'} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== DESKTOP LAYOUT ===== */}
            <div className="hidden md:flex flex-1" style={{ overflow: 'hidden', minHeight: 0 }}>
                {/* LEFT: LEADERBOARD */}
                <div className="w-56 bg-[#12121A] border-r border-[#2A2A30] flex flex-col min-h-0">
                    <div className="p-2 border-b border-[#2A2A30] text-[9px] font-bold uppercase text-gray-500 shrink-0">Standings</div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <AnimatePresence>
                            {currentPositions.map((d) => {
                                const meta = replayData?.drivers?.[d.driver];
                                const posChange = positionChangesRef.current[d.driver];
                                return (
                                    <motion.div key={d.driver} layout transition={{ type: "spring", stiffness: 200, damping: 25 }}
                                        onClick={() => setActiveDriver(d.driver)}
                                        className={cn("flex items-center gap-2 px-2 py-1 cursor-pointer border-l-[3px]",
                                            activeDriver === d.driver ? "bg-white/10" : "hover:bg-white/5")}
                                        style={{ borderLeftColor: meta?.color || '#444' }}>
                                        <div className="w-4 text-center relative">
                                            <span className={cn("font-black text-xs", d.rank === 1 ? "text-f1-red" : d.rank <= 3 ? "text-white" : "text-gray-500")}>{d.rank}</span>
                                            {posChange && <span className={cn("absolute -top-1 -right-1 text-[7px] font-bold", posChange > 0 ? "text-green-400" : "text-red-400")}>{posChange > 0 ? '▲' : '▼'}</span>}
                                        </div>
                                        <span className={cn("flex-1 font-bold text-[10px]", activeDriver === d.driver ? "text-white" : "text-gray-300")}>{d.driver}</span>
                                        <span className={cn("text-[9px] font-mono w-10 text-right", d.interval && d.interval < 1 ? "text-orange-400" : "text-gray-500")}>
                                            {d.interval ? `+${d.interval.toFixed(1)}` : '—'}
                                        </span>
                                        <TyreIcon compound={d.tyre} />
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                </div>

                {/* CENTER: SVG TRACK MAP */}
                <div className="flex-1 relative overflow-hidden bg-[#0A0A0F] min-h-0">
                    <div className="absolute top-4 left-4 z-10">
                        <div className="text-xl font-heading font-black text-white uppercase">{currentRaceName}</div>
                        <div className="text-xs text-gray-500 mt-0.5">Lap {activeDriverState?.lap || 1} / {replayData?.totalLaps || '—'}</div>
                    </div>

                    {replayData?.map && (
                        <SVGTrackMap
                            map={replayData.map}
                            positions={currentPositions}
                            activeDriver={activeDriver}
                            drivers={replayData.drivers}
                        />
                    )}
                </div>

                {/* RIGHT: INFO PANEL - Hidden on mobile */}
                <div className="hidden md:block w-64 bg-[#12121A] border-l border-[#2A2A30] relative" style={{ overflow: 'hidden' }}>
                    <div className="absolute inset-0 flex flex-col">
                        {/* Selected Driver Card */}
                        {activeDriverState && (
                            <div className="p-3 border-b border-[#2A2A30] shrink-0">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: replayData?.drivers?.[activeDriver]?.color || '#fff' }} />
                                    <div className="flex-1">
                                        <div className="font-bold text-white text-sm">{activeDriver}</div>
                                        <div className="text-[9px] text-gray-500">{replayData?.drivers?.[activeDriver]?.team}</div>
                                    </div>
                                    <TyreIcon compound={activeDriverState.tyre} size="lg" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-black/40 rounded-lg p-2 text-center">
                                        <div className="text-2xl font-heading font-black text-white">{activeDriverState.rank}</div>
                                        <div className="text-[8px] text-gray-500 uppercase">Pos</div>
                                    </div>
                                    <div className="flex-1 bg-black/40 rounded-lg p-2 text-center">
                                        <div className="text-2xl font-heading font-black text-white">{activeDriverState.lap}</div>
                                        <div className="text-[8px] text-gray-500 uppercase">Lap</div>
                                    </div>
                                    <div className="flex-1 bg-black/40 rounded-lg p-2 text-center">
                                        <div className="text-lg font-heading font-black text-orange-400">
                                            {activeDriverState.interval ? `+${activeDriverState.interval.toFixed(1)}` : '—'}
                                        </div>
                                        <div className="text-[8px] text-gray-500 uppercase">Gap</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Battles */}
                        <div className="p-3 border-b border-[#2A2A30] shrink-0">
                            <div className="text-[9px] font-bold uppercase text-gray-500 mb-2 flex items-center gap-1">
                                <Circle size={6} className="text-orange-500 fill-orange-500" /> Battles
                            </div>
                            {battles.length > 0 ? (
                                <div className="space-y-1">
                                    {battles.map(b => {
                                        const ahead = currentPositions.find(x => x.rank === b.rank - 1);
                                        if (!ahead) return null;
                                        return (
                                            <div key={b.driver} className="flex items-center justify-between bg-orange-500/10 rounded px-2 py-1">
                                                <span className="text-[10px] font-bold text-white">{ahead.driver}</span>
                                                <span className="text-[9px] font-mono font-bold text-orange-400">{b.interval?.toFixed(2)}s</span>
                                                <span className="text-[10px] font-bold text-white">{b.driver}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-[10px] text-gray-600 italic">No close battles</div>
                            )}
                        </div>

                        {/* Events Feed */}
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            <div className="p-2 text-[9px] font-bold uppercase text-gray-500 flex items-center justify-between shrink-0 border-b border-[#2A2A30]">
                                <span className="flex items-center gap-1"><Timer size={10} /> Race Feed</span>
                                <span className="text-[8px] font-mono text-gray-600">{raceEvents.length} events</span>
                            </div>
                            <div ref={feedRef} className="flex-1 overflow-y-auto px-2 py-2 min-h-0 scroll-smooth">
                                <div className="space-y-1">
                                    {raceEvents.map((e) => (
                                        <motion.div key={e.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "flex items-center gap-2 rounded px-2 py-1.5 border",
                                                e.type === 'OVERTAKE' && "bg-green-500/10 border-green-500/20",
                                                e.type === 'LOST' && "bg-red-500/10 border-red-500/20",
                                                e.type === 'PIT' && "bg-yellow-500/10 border-yellow-500/20"
                                            )}>
                                            {e.type === 'OVERTAKE' && <ArrowUp size={10} className="text-green-400 shrink-0" />}
                                            {e.type === 'LOST' && <ArrowDown size={10} className="text-red-400 shrink-0" />}
                                            {e.type === 'PIT' && <Wrench size={10} className="text-yellow-400 shrink-0" />}

                                            <div className="flex-1 text-[9px]">
                                                {e.type === 'OVERTAKE' && (
                                                    <>
                                                        <span className="font-bold text-green-400">{e.driver}</span>
                                                        <span className="text-gray-400"> passes </span>
                                                        <span className="text-gray-300">{e.overtaken}</span>
                                                    </>
                                                )}
                                                {e.type === 'LOST' && (
                                                    <>
                                                        <span className="font-bold text-red-400">{e.driver}</span>
                                                        <span className="text-gray-400"> loses P{e.positions}</span>
                                                    </>
                                                )}
                                                {e.type === 'PIT' && (
                                                    <>
                                                        <span className="font-bold text-yellow-400">{e.driver}</span>
                                                        <span className="text-gray-400"> pits </span>
                                                        <TyreIcon compound={e.fromTyre} />
                                                        <span className="text-gray-500 mx-0.5">→</span>
                                                        <TyreIcon compound={e.toTyre} />
                                                    </>
                                                )}
                                            </div>
                                            <span className="text-[8px] text-gray-500 shrink-0 bg-black/30 px-1.5 py-0.5 rounded">L{e.lap}</span>
                                        </motion.div>
                                    ))}
                                    {raceEvents.length === 0 && (
                                        <div className="text-[9px] text-gray-600 italic text-center py-4">Events will appear here...</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>{/* Close absolute container */}
                </div>
            </div>
        </div>
    );
}

// SVG Track Map - Smooth GPU-accelerated transforms
function SVGTrackMap({ map, positions, activeDriver, drivers, showAllLabels = false }) {
    const containerRef = useRef(null);
    const [dims, setDims] = useState({ width: 800, height: 400 });

    const bounds = useMemo(() => {
        const xs = map.x, ys = map.y;
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
    }, [map]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateDims = () => {
            const rect = container.getBoundingClientRect();
            setDims({ width: rect.width, height: rect.height });
        };

        updateDims();
        const observer = new ResizeObserver(updateDims);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const padding = 50;
    const scale = Math.min((dims.width - padding * 2) / bounds.w, (dims.height - padding * 2) / bounds.h);
    const offsetX = padding + ((dims.width - padding * 2) - bounds.w * scale) / 2;
    const offsetY = padding + ((dims.height - padding * 2) - bounds.h * scale) / 2;

    const toScreen = (gx, gy) => ({
        x: offsetX + (gx - bounds.minX) * scale,
        y: offsetY + (gy - bounds.minY) * scale
    });

    const trackPath = useMemo(() => {
        return map.x.map((x, i) => {
            const p = toScreen(x, map.y[i]);
            return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        }).join(' ');
    }, [map, dims, bounds, scale, offsetX, offsetY]);

    return (
        <div ref={containerRef} className="absolute inset-0">
            <svg width={dims.width} height={dims.height} className="absolute inset-0">
                {/* Track */}
                <path d={trackPath} fill="none" stroke="#1a1a1a" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                <path d={trackPath} fill="none" stroke="#2A2A30" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                <path d={trackPath} fill="none" stroke="#3A3A40" strokeWidth="1" strokeDasharray="4 4" />

                {/* Cars - using native SVG transform attribute */}
                {positions.map(p => {
                    const rawIdx = p.progress * (map.x.length - 1);
                    const idx = Math.floor(rawIdx);
                    const nextIdx = Math.min(idx + 1, map.x.length - 1);
                    const ratio = rawIdx - idx;

                    const gx = map.x[idx] + (map.x[nextIdx] - map.x[idx]) * ratio;
                    const gy = map.y[idx] + (map.y[nextIdx] - map.y[idx]) * ratio;
                    const pos = toScreen(gx, gy);

                    const dx = map.x[nextIdx] - map.x[idx];
                    const dy = map.y[nextIdx] - map.y[idx];
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                    const meta = drivers?.[p.driver];
                    const color = meta?.color || '#666';
                    const isActive = p.driver === activeDriver;
                    const isTop10 = p.rank <= 10;
                    const showLabel = isActive || (showAllLabels && isTop10);
                    const w = isActive ? 16 : 10;
                    const h = isActive ? 6 : 4;

                    return (
                        <g key={p.driver} transform={`translate(${pos.x}, ${pos.y}) rotate(${angle})`}>
                            {isActive && <ellipse cx={0} cy={0} rx={12} ry={8} fill={color} opacity={0.3} />}
                            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2} fill={color} />
                            {showLabel && (
                                <text
                                    x={14}
                                    y={4}
                                    fill="white"
                                    fontSize={isActive ? "10" : "8"}
                                    fontWeight="bold"
                                    transform={`rotate(${-angle})`}
                                    style={{ textShadow: '0 0 3px rgba(0,0,0,0.8)' }}
                                >
                                    {p.driver}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function TyreIcon({ compound, size = 'sm' }) {
    if (!compound) return null;
    let color = '#888', letter = '?';
    const c = compound.toUpperCase();
    if (c.includes('SOFT')) { color = '#FF3B30'; letter = 'S'; }
    if (c.includes('MEDIUM')) { color = '#FFCC00'; letter = 'M'; }
    if (c.includes('HARD')) { color = '#E5E5E5'; letter = 'H'; }
    if (c.includes('INTER')) { color = '#34C759'; letter = 'I'; }
    if (c.includes('WET')) { color = '#007AFF'; letter = 'W'; }
    const sizeClass = size === 'lg' ? 'w-6 h-6 text-[10px]' : 'w-4 h-4 text-[8px]';
    return <div className={cn("rounded-full flex items-center justify-center font-black border-2", sizeClass)} style={{ borderColor: color, color, backgroundColor: `${color}20` }}>{letter}</div>;
}
