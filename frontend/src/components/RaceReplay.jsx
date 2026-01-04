import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Play, Pause, Zap, Timer, TrendingUp, Settings, Map as MapIcon, ChevronDown, Monitor, ChevronUp, ChevronRight, Flag, Thermometer, Droplets, Wind } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function RaceReplay({ raceId: initialRaceId }) {
    // --- STATE ---
    const [raceId, setRaceId] = useState(initialRaceId || 0);
    const [raceList, setRaceList] = useState([]);
    const [activeDriver, setActiveDriver] = useState(null);
    const [replayData, setReplayData] = useState(null);
    const [telemetry, setTelemetry] = useState(null);
    const [maxTime, setMaxTime] = useState(0);
    const [timeOffset, setTimeOffset] = useState(0);

    const [raceTime, setRaceTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(20);

    const [loading, setLoading] = useState(false);

    // --- INIT & FETCH ---
    useEffect(() => {
        const init = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/races');
                setRaceList(res.data);
                if (!raceId && res.data.length > 0) {
                    setRaceId(res.data[0].id);
                } else if (initialRaceId) {
                    setRaceId(initialRaceId);
                }
            } catch (e) { console.error("Failed to fetch races", e); }
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
            try {
                const [repRes] = await Promise.all([
                    axios.get(`http://localhost:5000/api/replay/${raceId}`)
                ]);

                setReplayData(repRes.data);
                // Telemetry fetched via separate effect now

                // --- CALIBRATION ---

                // --- CALIBRATION ---
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

                if (repRes.data.data[1] && repRes.data.data[1][0]) {
                    setActiveDriver(repRes.data.data[1][0].driver);
                }
            } catch (error) { console.error("Failed to fetch replay data", error); }
            finally { setLoading(false); }
        };
        fetchData();

    }, [raceId]);

    // --- TELEMETRY FETCHING ---
    useEffect(() => {
        if (!raceId || !activeDriver) return;
        const fetchTel = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/telemetry/${raceId}?driver=${activeDriver}`);
                setTelemetry(res.data);
            } catch (e) {
                console.error("Telemetry fetch error", e);
                setTelemetry(null);
            }
        }
        fetchTel();
    }, [raceId, activeDriver]);



    // --- LOOP ---
    useEffect(() => {
        let animationFrame;
        let lastStamp = performance.now();

        const loop = (now) => {
            if (!isPlaying) return;
            const delta = (now - lastStamp) / 1000;
            lastStamp = now;

            setRaceTime(prev => {
                const next = prev + (delta * speed);
                if (next >= maxTime) {
                    setIsPlaying(false);
                    return maxTime;
                }
                return next;
            });
            animationFrame = requestAnimationFrame(loop);
        };

        if (isPlaying) {
            lastStamp = performance.now();
            animationFrame = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying, speed, maxTime]);

    // --- COMPUTED: LIVE STATUS & WEATHER ---
    const { currentStatus, currentWeather } = useMemo(() => {
        if (!replayData?.events) return { currentStatus: 'GREEN', currentWeather: null };

        const effectiveTime = raceTime + timeOffset;
        let status = 'GREEN';
        // Default to first weather so widget is visible at T=0
        let weather = replayData.events.find(e => e.status === 'WEATHER')?.weather || null;

        // Iterate chronologically
        for (const ev of replayData.events) {
            if (ev.time > effectiveTime) break;
            if (ev.status !== 'WEATHER') status = ev.status;
            if (ev.status === 'WEATHER') weather = ev.weather;
        }
        return { currentStatus: status, currentWeather: weather };
    }, [replayData, raceTime, timeOffset]);







    // --- COMPUTED: POSITIONS ---
    const currentPositions = useMemo(() => {
        if (!replayData) return [];

        const positions = [];
        const drivers = replayData.data[1] ? replayData.data[1].map(d => d.driver) : [];
        const effectiveTime = raceTime + timeOffset;

        drivers.forEach(driver => {
            let currentLapData = null;
            let prevLapTime = 0;
            let lapNum = 1;

            for (let l = 1; l <= replayData.totalLaps; l++) {
                const dData = replayData.data[l]?.find(d => d.driver === driver);
                if (!dData) continue;

                const finishTime = dData.cummulative;
                const duration = dData.time;
                const startTime = finishTime - duration;

                if (effectiveTime <= finishTime) {
                    if (effectiveTime >= startTime) {
                        currentLapData = dData;
                        prevLapTime = startTime;
                        lapNum = l;
                    } else if (l === 1) {
                        currentLapData = dData;
                        prevLapTime = startTime;
                        lapNum = 1;
                    }
                    break;
                }
            }

            if (!currentLapData) {
                const lastData = replayData.data[replayData.totalLaps]?.find(d => d.driver === driver);
                if (lastData && effectiveTime > lastData.cummulative) {
                    currentLapData = lastData;
                    prevLapTime = lastData.cummulative - lastData.time;
                    lapNum = replayData.totalLaps;
                }
            }

            if (currentLapData) {
                const lapDuration = currentLapData.time;
                let progress = (effectiveTime - prevLapTime) / lapDuration;
                progress = Math.max(0, Math.min(1, progress));

                positions.push({
                    driver: driver,
                    position: currentLapData.position,
                    tyre: currentLapData.tyre,
                    progress: progress,
                    lap: lapNum,
                    score: lapNum + progress
                });
            }
        });

        positions.sort((a, b) => b.score - a.score);
        positions.forEach((p, i) => p.rank = i + 1);

        return positions;
    }, [replayData, raceTime, timeOffset]);


    // Chart Data
    const telemetryChartData = useMemo(() => {
        if (!telemetry) return [];

        // We use the Main Driver's distance as the X-Axis truth.
        // Comparison driver data needs to be interpolated or mapped if their distances don't align perfectly, 
        // but for simplicity/performance in this MVP, we will attempt to find the nearest point or just map by index if length matches (unlikely).
        // Better approach for Recharts: Create a merged dataset.
        // Since both are sampled at 1/10th, distances should be roughly similar range (0 to ~5000m).

        // We will just map main telemetry and lookup comparison by finding closest distance.
        // This is O(N*M) naive, or O(N) if sorted. Both are sorted.

        const data = [];

        for (let i = 0; i < telemetry.distance.length; i++) {
            const dist = telemetry.distance[i];
            data.push({
                dist,
                speed: telemetry.speed[i],
                throttle: telemetry.throttle[i],
                brake: telemetry.brake[i],
                gear: telemetry.gear ? telemetry.gear[i] : 0,
                rpm: telemetry.rpm ? telemetry.rpm[i] : 0,
            });
        }
        return data;
    }, [telemetry]);

    const activeDriverState = currentPositions.find(p => p.driver === activeDriver);
    // Live Values
    const currentTelemetryIndex = useMemo(() => {
        if (!telemetryChartData.length || !activeDriverState) return -1;
        // Simple binary search or approximation? 
        // Data is sorted by distance. 
        // LERP not strictly needed for display, finding nearest index is fine for now.
        const targetDist = (telemetryChartData[telemetryChartData.length - 1]?.dist || 0) * (activeDriverState?.progress || 0);
        return telemetryChartData.findIndex(d => d.dist >= targetDist);
    }, [telemetryChartData, activeDriverState]);

    const liveValues = useMemo(() => {
        if (currentTelemetryIndex === -1) return { speed: 0, throttle: 0, brake: 0, gear: 0, rpm: 0 };
        return telemetryChartData[currentTelemetryIndex] || { speed: 0, throttle: 0, brake: 0, gear: 0, rpm: 0 };
    }, [currentTelemetryIndex, telemetryChartData]);

    const cursorDist = (telemetryChartData[telemetryChartData.length - 1]?.dist || 0) * (activeDriverState?.progress || 0);

    if (!raceId && loading) return <div className="text-gray-500 animate-pulse p-8">Loading Application...</div>;

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-500 h-full flex flex-col">
            {/* HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 border-b border-[#2A2A30] pb-6 shrink-0">
                <div className="flex-1 space-y-4">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-3xl font-heading font-bold italic tracking-tighter uppercase">Race Replay</h2>
                        <div className="flex items-center gap-3">
                            <span className="bg-f1-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide">CANVAS ENGINE</span>
                            {/* RACE STATUS WIDGET */}
                            <div className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-2 border",
                                currentStatus === 'GREEN' ? "bg-green-500/20 text-green-500 border-green-500/50" :
                                    currentStatus === 'YELLOW' ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50" :
                                        currentStatus === 'SC' || currentStatus === 'VSC' ? "bg-orange-500/20 text-orange-500 border-orange-500/50" :
                                            "bg-red-500/20 text-red-500 border-red-500/50"
                            )}>
                                <Flag size={12} fill="currentColor" /> {currentStatus === 'SC' ? 'SAFETY CAR' : currentStatus === 'VSC' ? 'VIRTUAL SC' : currentStatus + " FLAG"}
                            </div>
                        </div>
                    </div>
                    <div className="relative inline-block w-64">
                        <select value={raceId} onChange={(e) => { setRaceId(parseInt(e.target.value)); setRaceTime(0); }} className="w-full appearance-none bg-[#1A1A22] border border-[#2A2A30] text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:border-f1-red transition-colors cursor-pointer">
                            <option value={0} disabled>Select Race...</option>
                            {raceList.map(r => <option key={r.id} value={r.id}>{r.name} ({r.year})</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500"><ChevronDown size={14} /></div>
                    </div>
                </div>

                {/* WEATHER & TIME WIDGET */}
                <div className="flex gap-4">
                    {currentWeather && (
                        <div className="bg-[#1A1A22] border border-[#2A2A30] rounded-xl p-3 flex items-center gap-4 text-xs font-medium text-gray-400">
                            <div className="flex items-center gap-1.5">
                                <Thermometer size={14} className="text-white" />
                                <span className="text-white font-bold">{currentWeather.temp}°C</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Zap size={14} className={currentWeather.track_temp > 40 ? "text-orange-500" : "text-gray-500"} />
                                <span>Track {currentWeather.track_temp}°C</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Droplets size={14} className={currentWeather.rain ? "text-blue-500" : "text-gray-500"} />
                                <span className={currentWeather.rain ? "text-blue-500 font-bold" : ""}>{currentWeather.rain ? "RAIN" : "Dry"}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Wind size={14} className="text-gray-500" />
                                <span>{currentWeather.humidity}%</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* CONTROLS */}
                <div className="flex flex-wrap items-center gap-4 bg-[#1A1A22] p-2 rounded-xl border border-[#2A2A30] shadow-xl">
                    <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
                        {[1, 5, 20, 50].map(s => (
                            <button key={s} onClick={() => setSpeed(s)} className={cn("px-2 py-1 text-xs font-bold rounded hover:bg-white/10 transition-colors w-10 text-center", speed === s ? "bg-white text-black" : "text-gray-500")}>
                                {s}x
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 flex items-center justify-center bg-f1-red rounded-lg hover:bg-red-600 transition-colors text-white shadow-[0_0_15px_rgba(225,6,0,0.4)]">
                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <div className="flex flex-col min-w-[200px] px-2">
                        <div className="flex justify-between text-xs font-bold uppercase text-gray-500 mb-1">
                            <span>{new Date(raceTime * 1000).toISOString().substr(11, 8)}</span>
                            <span>{activeDriver} L{activeDriverState?.lap || 1}</span>
                        </div>
                        <input
                            type="range" min="0" max={maxTime} step="1" value={raceTime} disabled={!replayData}
                            onChange={(e) => { setRaceTime(parseFloat(e.target.value)); setIsPlaying(false); }}
                            className="w-full accent-f1-red h-1.5 bg-[#2A2A30] rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">

                {/* LEADERBOARD (React DOM) */}
                <div className="lg:col-span-4 xl:col-span-3 bg-[#15151E] rounded-3xl border border-[#2A2A30] overflow-hidden flex flex-col max-h-[70vh]">
                    <div className="p-4 border-b border-[#2A2A30] bg-[#1A1A22]"><h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2"><TrendingUp size={14} /> Live Order</h3></div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        <div className="flex flex-col gap-1">
                            {currentPositions.map((driver) => {
                                const meta = replayData.drivers ? replayData.drivers[driver.driver] : null;
                                const teamColor = meta?.color || '#3A3A40';

                                return (
                                    <motion.div
                                        key={driver.driver}
                                        layout
                                        transition={{ type: "spring", stiffness: 60, damping: 15 }}
                                        onClick={() => setActiveDriver(driver.driver)}
                                        className={cn(
                                            "flex items-center gap-3 p-2 rounded-lg border-l-4 cursor-pointer group relative overflow-hidden transition-colors",
                                            activeDriver === driver.driver ? "bg-white/10" : "bg-[#1A1A22] hover:bg-white/5",
                                            "border-y border-r border-transparent"
                                        )}
                                        style={{ borderLeftColor: teamColor }}
                                    >
                                        <span className={cn("font-heading font-bold text-lg w-6 text-center", activeDriver === driver.driver ? "text-f1-red" : "text-gray-600")}>{driver.rank}</span>
                                        <div className="flex-1 min-w-0 z-10">
                                            <div className="flex justify-between items-baseline">
                                                <div className={cn("font-bold text-sm truncate", activeDriver === driver.driver ? "text-white" : "text-gray-300")}>{driver.driver}</div>
                                                {meta && <div className="text-[9px] uppercase font-bold text-gray-500 truncate max-w-[80px]">{meta.team}</div>}
                                            </div>
                                            <div className="text-[10px] text-gray-500">Lap {driver.lap}</div>
                                        </div>
                                        <TyreIcon compound={driver.tyre} />
                                        {/* Progress Bar background opacity lowered */}
                                        <div className="absolute left-0 bottom-0 h-0.5 bg-white/10" style={{ width: `${driver.progress * 100}%` }}></div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* CANVAS MAP & TELEMETRY */}
                <div className="lg:col-span-8 xl:col-span-9 space-y-6 flex flex-col max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">

                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-6 relative min-h-[400px] flex items-center justify-center overflow-hidden group">
                        <div className="absolute top-6 left-6 z-10">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Circuit</div>
                            <div className="text-2xl font-heading font-bold text-white mb-2">{raceList.find(r => r.id === raceId)?.name || "Live Track"}</div>

                            {/* Map Mode Toggles */}

                        </div>

                        {replayData?.map ? (
                            <CanvasMap
                                map={replayData.map}
                                positions={currentPositions}
                                activeDriver={activeDriver}
                                drivers={replayData.drivers}
                                telemetry={telemetry}
                                mapMode={'standard'}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-gray-600"><MapIcon size={48} className="opacity-20" /><span className="text-xs font-bold opacity-50">Map Unavailable</span></div>
                        )}
                    </div>

                    <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] p-6 min-h-[300px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="bg-black/40 p-2 rounded-lg border border-white/5"><Monitor size={16} className="text-f1-red" /></div>
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Live Telemetry</h3>
                                    <div className="font-bold text-white text-sm flex items-center gap-2">
                                        {activeDriver || "Select Driver"}

                                        {/* COMPARE DROPDOWN */}

                                    </div>
                                </div>
                            </div>
                            {/* TELEMETRY LEGEND / LIVE VALUES */}
                            <div className="flex items-center gap-4 text-xs font-medium">
                                {/* GEAR GAUGE */}
                                <div className="bg-[#1A1A22] rounded px-2 py-1 border border-[#2A2A30] flex flex-col items-center min-w-[40px]">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Gear</span>
                                    <span className="text-xl font-heading font-bold text-white">{liveValues.gear || "N"}</span>
                                </div>
                                <div className="w-px h-8 bg-[#2A2A30]"></div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#E10600]"></div>
                                    <span className="text-gray-400">Speed <span className="text-white font-bold ml-1">{Math.round(liveValues.speed)} km/h</span></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#00A19B]"></div>
                                    <span className="text-gray-400">Throttle <span className="text-white font-bold ml-1">{Math.round(liveValues.throttle)}%</span></span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={telemetryChartData}>
                                    <Tooltip contentStyle={{ backgroundColor: '#1A1A22', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ padding: 0 }} labelStyle={{ display: 'none' }} />
                                    <XAxis dataKey="dist" hide />
                                    <YAxis hide domain={['auto', 'auto']} />
                                    <Line type="monotone" dataKey="speed" stroke="#E10600" strokeWidth={2} dot={false} isAnimationActive={false} />
                                    <Line type="monotone" dataKey="throttle" stroke="#00A19B" strokeWidth={1.5} dot={false} strokeOpacity={0.7} isAnimationActive={false} />
                                    {/* COMPARISON LINES */}

                                    {/* <Line type="monotone" dataKey="brake" stroke="#fff" strokeWidth={1} dot={false} strokeOpacity={0.5} isAnimationActive={false} /> */}
                                    <ReferenceLine x={cursorDist} stroke="white" strokeDasharray="3 3" />

                                    {/* Corner Annotations */}
                                    {replayData?.map?.corners?.map((c, i) => (
                                        <ReferenceLine key={i} x={c.distance} stroke="#333" strokeDasharray="2 2">
                                            {/* Label logic can be complex in Recharts, using label string for now */}
                                            {/* Recharts ReferenceLine label prop takes a string or React Element */}
                                        </ReferenceLine>
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ----- CANVAS MAP COMPONENT -----
function CanvasMap({ map, positions, activeDriver, drivers, telemetry, mapMode }) {
    const canvasRef = useRef(null);

    // Auto-Scale Logic
    const { minX, maxX, minY, maxY, w, h } = useMemo(() => {
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

        // Fit the track aspect ratio
        const scale = Math.min(availW / w, availH / h);

        // Offset to center
        const offsetX = padding + (availW - w * scale) / 2;
        const offsetY = padding + (availH - h * scale) / 2;

        const toScreen = (gx, gy) => ({
            x: offsetX + (gx - minX) * scale,
            y: offsetY + (gy - minY) * scale // Y might need flip depending on Coord System? Assuming fastf1 is cartesian.
        });

        // 1. Draw Track
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // STANDARD MODE
        ctx.beginPath();
        ctx.strokeStyle = '#3A3A40';
        ctx.lineWidth = 6;
        map.x.forEach((xi, i) => {
            const pos = toScreen(xi, map.y[i]);
            if (i === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        });
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        map.x.forEach((xi, i) => {
            const pos = toScreen(xi, map.y[i]);
            if (i === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
        });
        ctx.stroke();

        // 2. Draw ALL Drivers
        // Draw non-active drivers first so active is on top
        positions.forEach(p => {
            if (p.driver === activeDriver) return; // Skip active, draw last

            const rawIdx = p.progress * (map.x.length - 1);
            const idx = Math.floor(rawIdx);
            const nextIdx = Math.min(idx + 1, map.x.length - 1);
            const ratio = rawIdx - idx;

            const gx = map.x[idx] + (map.x[nextIdx] - map.x[idx]) * ratio;
            const gy = map.y[idx] + (map.y[nextIdx] - map.y[idx]) * ratio;
            const screenPos = toScreen(gx, gy);

            const meta = drivers ? drivers[p.driver] : null;
            const color = meta?.color || '#666';

            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.8;
            ctx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        // 3. Draw Active Driver (Red Dot + Glow)
        const activeState = positions.find(p => p.driver === activeDriver);
        if (activeState) {
            const rawIdx = activeState.progress * (map.x.length - 1);
            const idx = Math.floor(rawIdx);
            const nextIdx = Math.min(idx + 1, map.x.length - 1);
            const ratio = rawIdx - idx;

            // LERP
            const gx = map.x[idx] + (map.x[nextIdx] - map.x[idx]) * ratio;
            const gy = map.y[idx] + (map.y[nextIdx] - map.y[idx]) * ratio;
            const screenPos = toScreen(gx, gy);

            // Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#E10600';

            ctx.beginPath();
            ctx.fillStyle = '#E10600';
            ctx.arc(screenPos.x, screenPos.y, 8, 0, Math.PI * 2);
            ctx.fill();

            // Driver Label
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 12px Arial";
            ctx.fillText(activeDriver, screenPos.x + 12, screenPos.y + 4);

            // Ring
            ctx.beginPath();
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2;
            ctx.arc(screenPos.x, screenPos.y, 8, 0, Math.PI * 2);
            ctx.stroke();
        }

    }, [map, positions, activeDriver, minX, maxX, minY, maxY, w, h, mapMode, telemetry]); // Redraw when positions or mode change

    return <canvas ref={canvasRef} className="w-full h-full block" />;
}

function TyreIcon({ compound }) {
    if (!compound) return null;
    let color = '#ccc'; let letter = '?';
    const c = compound.toUpperCase();
    if (c.includes('SOFT')) { color = '#FF3B30'; letter = 'S'; }
    if (c.includes('MEDIUM')) { color = '#FFCC00'; letter = 'M'; }
    if (c.includes('HARD')) { color = '#F2F2F7'; letter = 'H'; }
    if (c.includes('INTER')) { color = '#34C759'; letter = 'I'; }
    if (c.includes('WET')) { color = '#007AFF'; letter = 'W'; }
    return (<div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-[1.5px]" style={{ borderColor: color, color: color }}>{letter}</div>)
}
