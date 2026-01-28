import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Play, Pause, Square, FastForward, Rewind, Map as MapIcon, RotateCcw, ChevronDown, ChevronRight, ChevronUp, Timer, Flag, AlertTriangle, Info as InfoIcon, AlertCircle, X, Thermometer, Droplets, Clock, List, Circle, Zap, ArrowUp, ArrowDown, Wrench, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';



const getStatusClasses = (status) => {
    const s = (status || "").toUpperCase();
    if (s === 'GREEN') return 'bg-green-500 text-black border-2 border-black';
    if (s === 'YELLOW') return 'bg-yellow-400 text-black border-2 border-black';
    if (s === 'RED' || s === 'SUSPENDED') return 'bg-f1-red text-black border-2 border-black';
    if (s === 'SC' || s === 'VSC' || s === 'ABORTED' || s === 'DELAYED') return 'bg-orange-500 text-black border-2 border-black';
    if (s === 'FORMATION') return 'bg-blue-500 text-black border-2 border-black';
    if (s === 'CHEQUERED') return 'bg-black text-black border-2 border-white';
    return 'bg-gray-200 text-black border-2 border-black';
};

export default function RaceReplay({ raceId: initialRaceId, onPlayingChange }) {
    const [raceId, setRaceId] = useState(initialRaceId || 0);
    const [raceList, setRaceList] = useState([]);
    const [activeDriver, setActiveDriver] = useState(null);
    const [replayData, setReplayData] = useState(null);
    const [maxTime, setMaxTime] = useState(0);
    const [timeOffset, setTimeOffset] = useState(0);
    const [raceTime, setRaceTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(5);
    const [loading, setLoading] = useState(false);
    const [mobileTab, setMobileTab] = useState('map'); // 'map', 'standings', 'events'
    const [showLeaderboard, setShowLeaderboard] = useState(true); // Toggle mini leaderboard
    const [year, setYear] = useState(2026);
    const [error, setError] = useState(null);
    const AVAILABLE_YEARS = [2026, 2025, 2024];

    // Calculate Local Time
    const localTime = useMemo(() => {
        if (!replayData?.startTime) return null;
        try {
            const start = new Date(replayData.startTime);
            // Add timeOffset to align with the actual lap data, + raceTime for playback progress
            return new Date(start.getTime() + ((timeOffset + raceTime) * 1000));
        } catch (e) { return null; }
    }, [replayData, raceTime, timeOffset]);



    // Use refs to avoid re-render loops (still needed for map/interpolation but not for events)
    const prevPositionsRef = useRef({});
    const prevTyresRef = useRef({});
    const feedRef = useRef(null);
    const [, forceUpdate] = useState(0); // Kept for map smoothness if needed
    const positionChangesRef = useRef({});


    // Load Race List when Year changes
    useEffect(() => {
        const fetchRaces = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/races?year=${year}`);
                setRaceList(res.data);

                // If initialRaceId is provided and valid for this year, use it. Otherwise default to first race.
                // Note: We prioritize initialRaceId only on first load (if we had a way to track that), 
                // but since year defaults to 2026/2025, we might need to sync year with initialRaceId if advanced.
                // For now, simple logic: pick first race of the year.
                if (res.data.length > 0) {
                    setRaceId(res.data[0].id);
                }
            } catch (e) { console.error(e); }
        };
        fetchRaces();
    }, [year]);

    useEffect(() => {
        if (!raceId) return;
        const fetchData = async () => {
            setLoading(true);
            setReplayData(null);
            setIsPlaying(false);
            setRaceTime(0);
            prevPositionsRef.current = {}; // Reset position history
            prevTyresRef.current = {};
            positionChangesRef.current = {};

            setError(null);
            try {
                const repRes = await axios.get(`http://localhost:5000/api/replay/${raceId}`);

                // Handle expected missing data (200 OK with error code)
                if (repRes.data.code === 'NO_DATA' || repRes.data.error) {
                    if (year >= 2026) {
                        setError(`This race hasn't happened yet! Try selecting ${year - 1} or ${year - 2} from the year dropdown above to watch past races.`);
                    } else {
                        setError("Replay telemetry not available for this race.");
                    }
                    return;
                }

                setReplayData(repRes.data);

                let minStart = Infinity;
                if (repRes.data?.data?.[1]) {
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
                const totalLaps = repRes.data?.totalLaps;
                const lastLapData = totalLaps && repRes.data?.data ? repRes.data.data[totalLaps] : null;
                if (lastLapData) {
                    const lastFinish = Math.max(...lastLapData.map(d => d.cummulative || 0));
                    max = lastFinish - minStart;
                }
                setMaxTime(max || 7200);

                if (repRes.data?.data?.[1]?.[0]) setActiveDriver(repRes.data.data[1][0].driver);
            } catch (error) {
                // Only log unexpected errors
                if (error.response?.status !== 404) {
                    console.error("RaceReplay Error:", error);
                }
                setError("Replay telemetry not available for this race.");
            }
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

        // The flag events and lap data may use different time references.
        // Calculate effective time in flag timeline.
        const effectiveTimeInFlags = raceTime + timeOffset;

        let status = 'GREEN';
        let weather = replayData.events.find(e => e.status === 'WEATHER')?.weather || null;

        // Sort events by time just in case
        const sortedEvents = [...replayData.events];

        // Inject synthetic GREEN flag at the start of the replay (timeOffset)
        // This ensures pre-race states (Aborted/Formation) are cleared when the race actually starts (Lap 1)
        sortedEvents.push({ time: timeOffset, status: 'GREEN', category: 'FLAG' });



        sortedEvents.sort((a, b) => a.time - b.time);

        for (const ev of sortedEvents) {
            if (ev.time > effectiveTimeInFlags) break;

            // 1. Critical Message Overrides (Aborted, Delayed, etc)
            // Check raw message content for keywords
            if (ev.category === 'MESSAGE') {
                const msg = (ev.status || "").toUpperCase();
                if (msg.includes('ABORTED START')) status = 'ABORTED';
                else if (msg.includes('FORMATION LAP')) status = 'FORMATION';
                else if (msg.includes('DELAYED')) status = 'DELAYED';
                else if (msg.includes('SUSPENDED')) status = 'SUSPENDED';
            }

            // 2. Official Flags (Override everything if newer)
            if (ev.category === 'FLAG') {
                status = ev.status;
            } else if (!ev.category && (ev.status === 'SC' || ev.status === 'VSC' || ev.status === 'RED' || ev.status === 'YELLOW' || ev.status === 'GREEN')) {
                // Legacy fallback
                status = ev.status;
            }

            if (ev.status === 'WEATHER') weather = ev.weather;
        }

        return { currentStatus: status, currentWeather: weather };
    }, [replayData, raceTime, timeOffset]);

    // Positions
    const currentPositions = useMemo(() => {
        if (!replayData) return [];

        // If no lap data (future race or just entry list), build grid from metadata
        const hasLaps = replayData.totalLaps > 0;

        if (!hasLaps || raceTime <= 0) {
            const positions = [];
            // Use replayData.drivers to build the grid
            Object.entries(replayData.drivers || {}).forEach(([code, meta]) => {
                // Check if driver is retired/DNF even at start
                const statusLower = (meta.status || '').toLowerCase();
                const isRetired = statusLower.includes('retired') ||
                    statusLower.includes('dnf') ||
                    statusLower.includes('dns') ||
                    statusLower.includes('accident') ||
                    statusLower.includes('collision') ||
                    statusLower.includes('disqualified') ||
                    statusLower === 'nc' ||
                    (statusLower !== '' && statusLower !== 'finished' && !statusLower.startsWith('+') && statusLower !== 'entry'); // 'Entry' is valid active status for future

                if (isRetired) {
                    positions.push({
                        driver: code,
                        rank: 99, // Will be sorted to bottom
                        position: 99,
                        progress: 0,
                        isInPit: false,
                        tyre: null,
                        lap: 0,
                        gap: 0,
                        status: 'OUT',
                        score: -10000 + ((meta.grid || 99) / 1000), // Retired at start
                        interval: null
                    });
                } else {
                    positions.push({
                        driver: code,
                        rank: meta.grid || 99,
                        position: meta.grid || 99,
                        progress: 0,
                        isInPit: false,
                        tyre: null,
                        lap: 0,
                        gap: 0,
                        status: 'Active',
                        score: 100 - (meta.grid || 99), // Higher grid = higher score for proper sorting
                        interval: null
                    });
                }
            });
            return positions.sort((a, b) => (b.score - a.score) || a.driver.localeCompare(b.driver));
        }

        const positions = [];
        const drivers = Object.keys(replayData.drivers); // Use all drivers from metadata
        const effectiveTime = raceTime + timeOffset;

        drivers.forEach(driver => {
            // EARLY EXIT: If driver is retired/DNF, immediately send to bottom
            const driverMeta = replayData.drivers[driver];
            const statusLower = (driverMeta?.status || '').toLowerCase();

            // Check if driver has ANY valid lap data (time and position both present)
            let hasValidLapData = false;
            for (let l = 1; l <= replayData.totalLaps; l++) {
                const lapData = replayData.data[l]?.find(d => d.driver === driver);
                if (lapData && lapData.time != null && lapData.position != null) {
                    hasValidLapData = true;
                    break;
                }
            }

            // Drivers with NO valid lap data at all should be marked as OUT immediately
            if (!hasValidLapData) {
                positions.push({
                    driver,
                    tyre: 'M',
                    progress: 0,
                    lap: 0,
                    score: -10000, // Bottom of standings
                    status: 'OUT'
                });
                return; // Skip further processing
            }

            const isDriverRetired = statusLower.includes('retired') ||
                statusLower.includes('dnf') ||
                statusLower.includes('dns') ||
                statusLower.includes('accident') ||
                statusLower.includes('collision') ||
                statusLower.includes('disqualified') ||
                statusLower === 'nc' ||
                (statusLower !== '' && statusLower !== 'finished' && !statusLower.startsWith('+') && statusLower !== 'finished');

            // REMOVED EARLY EXIT: Mid-race DNFs should race until they stop.
            // Only drivers with NO valid data (handled above) are skipped early.

            // if (isDriverRetired) { ... } -> Removed logic to allow processing laps

            let currentLapData = null, prevLapTime = 0, lapNum = 1;
            let lastCompletedLap = null;

            for (let l = 1; l <= replayData.totalLaps; l++) {
                const dData = replayData.data[l]?.find(d => d.driver === driver);

                // If no data for this lap, we can't project future. 
                // However, we remember the last valid lap to show 'Finished' if needed.
                if (!dData) {
                    if (!lastCompletedLap && l === 1) {
                        // Driver has no Lap 1 data (DNS/Formation Lap Crash?)
                        // If everyone else has Lap 1, this driver is likely OUT.
                        // But if NO ONE has Lap 1 (start of race), we shouldn't show OUT.
                        // We'll handle 'Start of Race' via effectiveTime check outside.
                    }
                    continue;
                }

                // Handle incomplete lap data: if time or position is null, driver has bad data
                // Skip this driver entirely - they're effectively OUT
                if (dData.time == null && dData.position == null) {
                    // Both missing = completely invalid record, skip entirely
                    continue;
                }

                const finishTime = dData.cummulative;
                // Use PREVIOUS lap's finish as THIS lap's start (or 0 for Lap 1)
                // This covers the "Red Flag Gap" where Session Time >> Sum(LapTimes).
                let startTime = 0;
                if (l > 1) {
                    const prevData = replayData.data[l - 1]?.find(d => d.driver === driver);
                    if (prevData && prevData.cummulative) startTime = prevData.cummulative;
                    else if (dData.time) startTime = finishTime - dData.time; // Fallback
                    else startTime = finishTime; // Last resort: no lag
                } else {
                    // Lap 1: Start is finish - time (approx) or timeOffset
                    startTime = dData.time ? (finishTime - dData.time) : timeOffset;
                }

                if (effectiveTime < startTime) {
                    // We are before this lap starts.
                    // If l > 1, we must be in the previous lap (handled by previous iteration).
                    // If l === 1, we are at pre-race.
                    break;
                }

                if (effectiveTime <= finishTime) {
                    // We are IN this lap (or in the Red Flag gap leading up to it)
                    currentLapData = dData;
                    prevLapTime = startTime;
                    lapNum = l;
                    break;
                }

                // If we passed this lap, save it as last completed
                lastCompletedLap = { ...dData, lap: l };
            }

            if (currentLapData) {
                const segmentDuration = currentLapData.cummulative - prevLapTime;
                let progress = 0;
                let isInPit = false;

                // Red Flag & Massive Gap Handling
                const isRedFlag = currentStatus === 'RED' || currentStatus === 'SUSPENDED';
                const isGap = segmentDuration > 600; // 10 minutes gap implies stoppage

                if (isRedFlag) {
                    // Find when RED flag started
                    let redFlagStartTime = effectiveTime;
                    if (replayData?.events) {
                        for (let i = replayData.events.length - 1; i >= 0; i--) {
                            const ev = replayData.events[i];
                            if (ev.time <= effectiveTime && (ev.status === 'RED' || ev.status === 'SUSPENDED')) {
                                redFlagStartTime = ev.time;
                                break;
                            }
                        }
                    }

                    // Calculate driver's position at red flag start (what would their normal progress be?)
                    let positionAtRedFlag = 0;
                    if (segmentDuration > 0 && redFlagStartTime >= prevLapTime) {
                        positionAtRedFlag = Math.min(1, (redFlagStartTime - prevLapTime) / Math.min(segmentDuration, 120));
                    }

                    // Time since red flag started
                    const timeSinceRedFlag = effectiveTime - redFlagStartTime;
                    const inLapDuration = 90; // ~90 seconds to drive to pit
                    const pitProgress = 0.95; // Pit entry position on track



                    if (timeSinceRedFlag < inLapDuration) {
                        // Animate from position at red flag toward pit entry
                        const animationProgress = timeSinceRedFlag / inLapDuration;
                        progress = positionAtRedFlag + (pitProgress - positionAtRedFlag) * animationProgress;
                        isInPit = false;
                    } else {
                        // Parked in pit
                        progress = pitProgress;
                        isInPit = true;
                    }
                } else if (isGap) {
                    // Large gap but NOT Red Flag (after restart) - normal proportional racing
                    progress = (effectiveTime - prevLapTime) / segmentDuration;
                } else if (segmentDuration > 0) {
                    // Normal Racing
                    progress = (effectiveTime - prevLapTime) / segmentDuration;
                }

                progress = Math.max(0, Math.min(1, progress));

                positions.push({
                    driver,
                    tyre: currentLapData.tyre,
                    progress,
                    lap: lapNum,
                    score: lapNum + progress,
                    isInPit // Pass to renderer
                });
            } else if (lastCompletedLap) {
                // finished all available laps or DNF after this point

                // Use the robust statusLower check defined earlier
                const isRetired = statusLower.includes('retired') ||
                    statusLower.includes('dnf') ||
                    statusLower.includes('dns') ||
                    statusLower.includes('accident') ||
                    statusLower.includes('collision') ||
                    statusLower.includes('disqualified') ||
                    statusLower === 'nc' ||
                    (statusLower !== '' && statusLower !== 'finished' && !statusLower.startsWith('+') && statusLower !== 'finished');

                // Fallback: If status fails (e.g. says "Finished" erroneously) but driver stopped early
                const timeSinceLastLap = effectiveTime - lastCompletedLap.cummulative;
                // If stopped for > 5 mins AND completed < 90% of race -> assume DNF
                const isProbableDNF = (timeSinceLastLap > 300) && (lastCompletedLap.lap < replayData.totalLaps * 0.9);

                if (isRetired || isProbableDNF) {
                    // Drop to bottom immediately
                    positions.push({
                        driver,
                        tyre: lastCompletedLap.tyre,
                        progress: 1,
                        lap: lastCompletedLap.lap,
                        score: -10000 + (lastCompletedLap.lap / 1000), // Sort retired drivers by lap count at bottom (Desperate fix)
                        status: 'OUT'
                    });
                } else {
                    // Just finished (e.g. race winner awaiting others)
                    positions.push({
                        driver,
                        tyre: lastCompletedLap.tyre,
                        progress: 1,
                        lap: lastCompletedLap.lap,
                        score: lastCompletedLap.lap + 1
                    });
                }
            } else {
                // No data found at all (or Pre-Race)
                // If raceTime is very small (start of race), show on grid (Lap 0)
                // Use raceTime, not effectiveTime, since effectiveTime includes session offset
                const driverInfo = replayData.drivers[driver];
                const isRetired = driverInfo && (driverInfo.status === 'Retired' || driverInfo.status === 'DNF' || driverInfo.status === 'DNS');

                if (raceTime < 60 && !isRetired) { // arbitrary buffer for start, if not already OUT
                    positions.push({ driver, tyre: 'M', progress: 0, lap: 0, score: 0 });
                } else {
                    // Truly DNF/DNS
                    // Truly DNF/DNS or Retired before race
                    positions.push({ driver, tyre: 'M', progress: 0, lap: 0, score: -10000, status: 'OUT' });
                }
            }
        });

        positions.sort((a, b) => (b.score - a.score) || a.driver.localeCompare(b.driver));
        positions.forEach((p, i) => {
            p.rank = i + 1;

            // OUT drivers should not have intervals calculated (they show "OUT" in UI)
            if (p.status === 'OUT') {
                p.interval = null;
                return;
            }

            // For active drivers, find the last active (non-OUT) driver above them
            if (i === 0) {
                p.interval = null; // Leader
            } else {
                // Find the previous active driver (skip any OUT drivers)
                let prevActiveDriver = null;
                for (let j = i - 1; j >= 0; j--) {
                    if (positions[j].status !== 'OUT') {
                        prevActiveDriver = positions[j];
                        break;
                    }
                }

                if (prevActiveDriver) {
                    p.interval = ((prevActiveDriver.lap + prevActiveDriver.progress) - (p.lap + p.progress)) * 85;
                } else {
                    // All drivers above are OUT, this driver is effectively the leader among active drivers
                    p.interval = null;
                }
            }
        });
        return positions;
    }, [replayData, raceTime, timeOffset, currentStatus]);

    // Detect overtakes using refs to avoid render loops
    // --- PRE-CALCULATE ALL RACING EVENTS (Overtakes, Pits) ---
    // This fixes the sync issue: Events are derived from data, not state accumulation.
    const allRaceEvents = useMemo(() => {
        if (!replayData || !replayData.data) return [];

        const events = [];
        const drivers = Object.keys(replayData.drivers);

        // Helper to get lap data
        const getLap = (d, n) => replayData.data[n]?.find(l => l.driver === d);

        // 1. Pit Stops (Tyre Changes)
        drivers.forEach(d => {
            let lastTyre = null;
            // Find all laps this driver did
            for (let l = 1; l <= replayData.totalLaps; l++) {
                const lapData = getLap(d, l);
                if (!lapData) continue;

                const currentTyre = lapData.tyre;
                if (!lastTyre) {
                    lastTyre = currentTyre;
                    continue;
                }

                if (currentTyre && currentTyre !== lastTyre) {
                    events.push({
                        id: `${d}-pit-${l}`,
                        type: 'PIT',
                        time: lapData.cummulative - (lapData.time || 0) + 20, // Approx pit exit
                        lap: l,
                        driver: d,
                        fromTyre: lastTyre,
                        toTyre: currentTyre
                    });
                    lastTyre = currentTyre;
                }
            }
        });

        // 1b. Fast Pit Lookup for Overtake Filtering
        const pittingMoves = new Set(); // "driver-lap"
        events.filter(e => e.type === 'PIT').forEach(e => pittingMoves.add(`${e.driver}-${e.lap}`));

        // 2. Overtakes (Gains only for simplicity based on user request "Overtakes")
        for (let l = 1; l <= replayData.totalLaps; l++) {
            const lapDrivers = replayData.data[l];
            if (!lapDrivers) continue;

            // Sort by position, filtering out entries with null/undefined position (drivers with no valid data)
            const sorted = [...lapDrivers]
                .filter(d => d.position != null && d.time != null)
                .sort((a, b) => a.position - b.position);

            // Create Map of Prev Lap Ranks to identify victims
            // Who held Position X in Lap L-1?
            const prevLapDrivers = replayData.data[l - 1] || [];
            const prevRankMap = {}; // Position -> Driver
            prevLapDrivers.forEach(d => { prevRankMap[d.position] = d.driver; });

            // Grid as fallback for Lap 1
            if (l === 1) {
                // Approximate from grid if available
                Object.entries(replayData.drivers).forEach(([d, meta]) => {
                    if (meta.grid) prevRankMap[meta.grid] = d;
                });
            }

            sorted.forEach((curr) => {
                // Check previous lap position
                const prevLap = getLap(curr.driver, l - 1);
                // If lap 1, compare to Grid
                const prevPos = prevLap ? prevLap.position : (replayData.drivers[curr.driver]?.grid || 99);
                const currPos = curr.position;

                if (prevPos && currPos < prevPos) {
                    // GAINED POSITION (Overtake?)
                    // Smart Filter: Did I pass someone who is PITTING or OUT?
                    // We gained spots from currPos to prevPos-1.
                    // The primary victim is the one who was exactly at 'currPos' in the previous lap.
                    const victimDriver = prevRankMap[currPos];

                    let isFakeOvertake = false;
                    if (victimDriver) {
                        const isVictimPitting = pittingMoves.has(`${victimDriver}-${l}`);
                        const victimInfo = replayData.drivers[victimDriver];
                        const isVictimDNF = victimInfo && (victimInfo.status === 'Retired' || victimInfo.status === 'DNF' || victimInfo.status === 'DNS');

                        // Also check if victim has no valid lap data
                        const victimLapData = replayData.data[l]?.find(d => d.driver === victimDriver);
                        const victimHasNoData = !victimLapData || victimLapData.time == null || victimLapData.position == null;

                        if (isVictimPitting || isVictimDNF || victimHasNoData) {
                            isFakeOvertake = true;
                        }
                    }

                    if (!isFakeOvertake) {
                        events.push({
                            id: `${curr.driver}-gain-${l}`,
                            type: 'OVERTAKE',
                            time: curr.cummulative - (curr.time / 2), // Mid-lap approx
                            lap: l,
                            driver: curr.driver,
                            startPos: prevPos,
                            endPos: currPos
                        });
                    }
                } else if (prevPos && currPos > prevPos) {
                    events.push({
                        id: `${curr.driver}-lost-${l}`,
                        type: 'LOST',
                        time: curr.cummulative - (curr.time / 2),
                        lap: l,
                        driver: curr.driver,
                        positions: currPos - prevPos
                    });
                }
            });
        }

        // 3. Flags
        if (replayData.events) {
            replayData.events.forEach((ev, i) => {
                events.push({
                    id: `flag-${ev.id || ev.time}-${i}`, // Use DB ID or fall back to time+index
                    type: ev.status === 'SC' || ev.status === 'VSC' ? 'SC' : 'FLAG',
                    flagType: ev.status,
                    time: ev.time,
                    message: ev.status,
                    category: ev.category // Pass category
                });
            });
        }

        return events.sort((a, b) => a.time - b.time);
    }, [replayData]);


    // Derived Visible Events based on Time (Sync Fix)
    const visibleEvents = useMemo(() => {
        // Unified Time Reference:
        // All events (Flags and Laps) are now aligned to Session Time.
        // raceTime = Time elapsed since Race Start (Lap 1).
        // timeOffset = Session Time at Race Start.
        const effectiveTime = raceTime + timeOffset;

        return allRaceEvents.filter(e => {
            // Show all events in feed that have happened by this time
            return e.time <= effectiveTime && e.time > (effectiveTime - 300); // 5 min window for relevance? Or just all history?
            // Actually, for a "Feed", we usually want all history up to this point, reverse sorted.
            // Let's keep it simple: Show everything up to current time.
            return e.time <= effectiveTime;
        });
    }, [allRaceEvents, raceTime, timeOffset]);


    // Smooth Position Interpolation Effect (Kept separate from events)
    useEffect(() => {
        if (currentPositions.length === 0) return;
        const newPosMap = {};
        currentPositions.forEach(p => { newPosMap[p.driver] = p.rank; });

        const newChanges = {};
        let hasChanges = false;

        Object.entries(newPosMap).forEach(([driver, newRank]) => {
            const oldRank = prevPositionsRef.current[driver];
            if (oldRank && oldRank !== newRank) {
                newChanges[driver] = oldRank - newRank;
                hasChanges = true;
            }
        });

        prevPositionsRef.current = newPosMap;

        if (hasChanges) {
            positionChangesRef.current = newChanges;
            forceUpdate(n => n + 1);
            setTimeout(() => {
                positionChangesRef.current = {};
                forceUpdate(n => n + 1);
            }, 2500);
        }
    }, [currentPositions]);


    // Auto-scroll feed: Keep at TOP for reverse order (Latest first)
    useEffect(() => {
        const el = feedRef.current;
        if (el && visibleEvents.length > 0) {
            el.scrollTop = 0;
        }
    }, [visibleEvents.length]);

    const currentRaceName = raceList.find(r => r.id === raceId)?.name || '';
    const activeDriverState = currentPositions.find(p => p.driver === activeDriver);
    const battles = currentPositions.filter(p => p.interval && p.interval < 1.5).slice(0, 3);
    const positionChanges = positionChangesRef.current;

    if (loading) return <div className="text-gray-600 animate-pulse p-8">Loading...</div>;

    return (
        <div className="h-full flex flex-col bg-gray-200 overflow-hidden relative" style={{ overflow: 'hidden', maxHeight: '100%' }}>
            {/* ===== MOBILE TOP BAR ===== */}
            <div className="md:hidden flex flex-col bg-white border-b-4 border-black shrink-0">
                {/* Row 1: Race Selector */}
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 flex-1">
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="bg-white text-black font-body text-xl border-2 border-black px-2 py-1 outline-none w-20 shadow-hard-sm"
                        >
                            {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select
                            value={raceId}
                            onChange={(e) => {
                                const newId = parseInt(e.target.value);
                                setRaceId(newId);
                                setReplayData(null);
                                setRaceTime(0);

                                prevPositionsRef.current = {};
                            }}
                            className="flex-1 bg-white text-black font-body text-lg border-2 border-black px-3 py-1 focus:outline-none shadow-hard-sm"
                        >
                            {raceList.map(r => <option key={r.id} value={r.id} className="bg-gray-100">{r.name}</option>)}
                        </select>
                    </div>
                    <div className={cn("ml-3 px-3 py-1 font-heading text-xs font-bold uppercase shrink-0 shadow-hard-sm",
                        getStatusClasses(currentStatus))}>
                        {currentStatus}
                    </div>
                </div>

                {/* Row 2: Playback Controls */}
                <div className="flex items-center gap-3 px-4 py-3 border-t-2 border-black bg-gray-100">
                    {/* Play/Pause */}
                    <button onClick={() => setRaceTime(0)} className="p-2 text-gray-600 hover:text-black">
                        <RotateCcw size={18} />
                    </button>
                    <button
                        disabled={!!error}
                        onClick={() => !error && setIsPlaying(!isPlaying)}
                        className={cn("w-12 h-12 flex items-center justify-center bg-f1-red border-2 border-black text-black shrink-0 shadow-hard-sm active:translate-y-1 active:shadow-none transition-all", !!error && "opacity-50 cursor-not-allowed")}
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
                            disabled={!!error}
                            onChange={(e) => {
                                setRaceTime(parseFloat(e.target.value));
                                setIsPlaying(false);
                                setRaceEvents([]);
                                prevPositionsRef.current = {};
                            }}
                            className={cn("flex-1 accent-f1-red h-2 bg-[#222] rounded-none appearance-none cursor-pointer", !!error && "opacity-50 cursor-not-allowed")}
                        />
                    </div>

                    {/* Lap Counter */}
                    <div className="text-center shrink-0 pl-2">
                        <div className="text-[10px] text-gray-600 uppercase font-heading">Lap</div>
                        <div className="text-lg font-heading font-bold text-black">{activeDriverState?.lap || 1}/{replayData?.totalLaps || '—'}</div>
                    </div>
                </div>

                {/* Speed Controls Row */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-black bg-white">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-gray-600 uppercase mr-1">Speed</span>
                        {[1, 5, 20, 50].map(s => (
                            <button
                                key={s}
                                onClick={() => setSpeed(s)}
                                className={cn("px-2.5 py-1 text-[10px] font-bold rounded transition-colors",
                                    speed === s ? "bg-f1-red text-black" : "bg-white text-gray-600 hover:text-black")}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                    {currentWeather && (
                        <div className="flex items-center gap-3 text-[10px] text-gray-600">
                            <span><Thermometer size={10} className="inline mr-0.5" />{currentWeather.temp}°C</span>
                            <span className={currentWeather.rain ? "text-blue-400" : ""}><Droplets size={10} className="inline mr-0.5" />{currentWeather.rain ? "WET" : "DRY"}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== DESKTOP TOP BAR ===== */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-2 bg-white border-b border-black px-3 md:px-4 py-2 shrink-0">
                <div className="flex items-center gap-2 md:gap-3">
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-transparent text-gray-600 font-bold text-xs focus:outline-none cursor-pointer border-none">
                        {AVAILABLE_YEARS.map(y => <option key={y} value={y} className="bg-gray-100">{y}</option>)}
                    </select>
                    <select value={raceId} onChange={(e) => {
                        const newId = parseInt(e.target.value);
                        setRaceId(newId);
                        setReplayData(null);
                        setRaceTime(0);

                        prevPositionsRef.current = {};
                    }}
                        className="bg-transparent text-black font-bold text-xs md:text-sm focus:outline-none cursor-pointer border-none max-w-[120px] md:max-w-none truncate">
                        {raceList.map(r => <option key={r.id} value={r.id} className="bg-gray-100">{r.name}</option>)}
                    </select>
                    <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        getStatusClasses(currentStatus))}>
                        {currentStatus}
                    </div>
                </div>

                {/* CENTRAL TICKER: Race Control Messages */}
                <div className="flex-1 flex items-center justify-center mx-4 min-h-[32px] overflow-hidden">
                    <AnimatePresence mode="popLayout">
                        {visibleEvents.filter(e => {
                            // 1. ALWAYS SHOW: Safety Cars, Red Flags, VSC
                            if (e.type === 'SC' || (e.type === 'FLAG' && ['RED', 'SC', 'VSC'].includes(e.flagType))) return true;

                            // 2. NEVER SHOW: Routine Green/Yellow Flags in ticker (noisy)
                            if (e.type === 'FLAG' && ['GREEN', 'YELLOW'].includes(e.flagType)) return false;

                            // 3. SHOW ALL GENERIC MESSAGES (Penalties, Investigations, Notes, etc.)
                            // This ensures we don't accidentally hide important info by over-filtering
                            return e.category === 'MESSAGE' || (e.type !== 'FLAG' && e.type !== 'SC' && !['OVERTAKE', 'PIT', 'LOST'].includes(e.type));
                        }).slice(-1).map((e) => (
                            <motion.div
                                key={e.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 text-center md:text-left"
                            >
                                {e.type === 'SC' ? <AlertTriangle size={12} className="text-orange-400 shrink-0" /> :
                                    (e.type === 'FLAG' && e.flagType === 'RED') ? <Flag size={12} className="text-red-500 fill-red-500 shrink-0" /> :
                                        (e.type === 'FLAG' && e.flagType === 'YELLOW') ? <Flag size={12} className="text-yellow-400 fill-yellow-400 shrink-0" /> :
                                            (e.category === 'Penalty') ? <AlertCircle size={12} className="text-red-400 shrink-0" /> :
                                                <InfoIcon size={12} className="text-gray-600 shrink-0" />}

                                <span className={cn(
                                    "text-xs font-bold uppercase shrink-0",
                                    (e.type === 'SC' || e.category === 'SafetyCar') ? "text-orange-400" :
                                        (e.type === 'FLAG' && e.flagType === 'RED') ? "text-red-500" :
                                            (e.type === 'FLAG' && e.flagType === 'YELLOW') ? "text-yellow-400" :
                                                (e.category === 'Penalty') ? "text-red-400" : "text-gray-300",
                                    (e.message && e.message.length > 80) ? "hidden lg:block" : ""
                                )}>
                                    {e.type === 'SC' ? 'SAFETY CAR' :
                                        (e.type === 'FLAG' && ['RED', 'GREEN', 'YELLOW'].includes(e.flagType)) ? `${e.flagType} FLAG` :
                                            (e.type === 'FLAG') ? 'RACE CONTROL' :
                                                (e.category || 'INFO')}
                                </span>
                                <span className="text-xs text-gray-600 whitespace-normal leading-tight max-w-[280px] md:max-w-[500px] line-clamp-2">
                                    {e.message || e.status}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {currentWeather && (
                    <div className="flex items-center gap-3 text-[10px] text-gray-600">
                        <span><Thermometer size={10} className="inline mr-1" />{currentWeather.temp}°C</span>
                        <span className={currentWeather.rain ? "text-blue-400" : ""}><Droplets size={10} className="inline mr-1" />{currentWeather.rain ? "WET" : "DRY"}</span>
                    </div>
                )}

                <div className="flex items-center gap-1 md:gap-2">
                    {/* Local Race Time Clock */}
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded border border-gray-600 mx-2">
                        <Clock size={14} className="text-gray-400" />
                        <span className="text-xs font-mono font-bold text-white">
                            {localTime ? localTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                        </span>
                    </div>

                    <span className="text-xs text-gray-700 font-mono hidden sm:inline">L{activeDriverState?.lap || 1}/{replayData?.totalLaps || '—'}</span>
                    <button onClick={() => setRaceTime(0)} className="p-1 text-gray-600 hover:text-black"><RotateCcw size={14} /></button>
                    <div className="hidden sm:flex bg-gray-700 rounded p-0.5">
                        {[1, 5, 20, 50].map(s => (
                            <button key={s} onClick={() => setSpeed(s)} className={cn("px-2 py-1 text-xs font-bold rounded", speed === s ? "bg-white text-black" : "text-gray-300 hover:text-white")}>{s}x</button>
                        ))}
                    </div>
                    <button disabled={!!error} onClick={() => !error && setIsPlaying(!isPlaying)} className={cn("w-7 h-7 flex items-center justify-center bg-f1-red rounded text-black", !!error && "opacity-50 cursor-not-allowed")}>
                        {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max={maxTime}
                        step="1"
                        value={raceTime}
                        disabled={!!error}
                        onChange={(e) => {
                            setRaceTime(parseFloat(e.target.value));
                            setIsPlaying(false);
                            // Clear position history on scrub to prevent artifacts
                            prevPositionsRef.current = {};
                        }}
                        className={cn("w-16 sm:w-24 accent-f1-red h-1 bg-[#2A2A30] rounded appearance-none cursor-pointer", !!error && "opacity-50 cursor-not-allowed")}
                    />
                    <span className="text-[10px] text-gray-600 font-mono w-14 hidden sm:inline">{new Date(raceTime * 1000).toISOString().substr(11, 8)}</span>
                </div>
            </div>

            {/* ===== MOBILE LAYOUT ===== */}
            <div className="md:hidden flex-1 flex flex-col overflow-hidden" style={{ minHeight: 'calc(100vh - 180px)' }}>
                {/* Full-screen Track Map - Clean View */}
                <div className="flex-1 relative bg-gray-50" style={{ minHeight: '350px' }}>
                    {/* Mini Leaderboard Toggle - Top Right */}
                    <button
                        onClick={() => setShowLeaderboard(!showLeaderboard)}
                        className="absolute top-3 right-3 z-20 bg-black/70 backdrop-blur-sm rounded-none px-2 py-1.5 border border-[#333] flex items-center gap-1.5"
                    >
                        <List size={14} className="text-gray-600" />
                        <span className="text-[10px] text-gray-600">P1-5</span>
                        {showLeaderboard ? <ChevronUp size={12} className="text-gray-600" /> : <ChevronDown size={12} className="text-gray-600" />}
                    </button>

                    {/* Mini Leaderboard - Top 5 Positions */}
                    <AnimatePresence>
                        {showLeaderboard && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-14 right-3 z-20 bg-black/80 backdrop-blur-sm rounded-none border border-black overflow-hidden"
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
                                                d.rank === 1 ? "text-f1-red" : d.rank <= 3 ? "text-black" : "text-gray-600"
                                            )}>{d.rank}</span>
                                            <div className="w-1 h-4 rounded-none" style={{ backgroundColor: meta?.color || '#444' }} />
                                            <span className="text-xs font-medium text-black w-10">{d.driver}</span>
                                            <span className="text-[10px] text-gray-600 font-mono">
                                                {d.interval ? `+${d.interval.toFixed(1)}` : 'Leader'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* The Map */}
                    {error ? (
                        <div className="h-full flex items-center justify-center flex-col p-8 text-center text-gray-600">
                            <AlertTriangle size={48} className="mb-4 text-yellow-500" />
                            <div className="font-bold text-black text-lg mb-2">Data Unavailable</div>
                            <div className="text-sm text-gray-300 mb-4 max-w-md">{error}</div>
                            {year >= 2026 && (
                                <div className="mt-4 p-4 bg-f1-red/5 border border-f1-red/20 rounded-none max-w-sm backdrop-blur-sm">
                                    <div className="text-f1-red text-xs font-bold mb-2 flex items-center gap-2 justify-center uppercase tracking-wider">

                                        Available Replays
                                    </div>
                                    <div className="text-xs text-gray-300">
                                        Select from the year selector above
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : replayData?.map ? (
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
                                <div className="w-8 h-8 border-2 border-f1-red border-t-transparent rounded-none animate-spin mx-auto" />
                                <div className="text-gray-600 text-sm mt-2">Loading track...</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Compact Position Ticker - Bottom */}
                <div className="bg-white border-t border-black shrink-0">
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
                                        isActive ? "bg-white/10 ring-1 ring-white/30" : "bg-white",
                                        isTop3 && !isActive && "bg-[#151515]"
                                    )}
                                >
                                    <span className={cn(
                                        "text-[10px] font-bold w-3",
                                        d.rank === 1 ? "text-f1-red" : d.rank <= 3 ? "text-black" : "text-gray-600"
                                    )}>{d.rank}</span>
                                    <div className="w-0.5 h-3 rounded-none" style={{ backgroundColor: meta?.color || '#444' }} />
                                    <span className="text-[10px] font-medium text-black">{d.driver}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected Driver Info Bar */}
                    {activeDriver && (
                        <div className="flex items-center justify-between px-3 py-2 border-t border-black bg-gray-50">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-5 rounded-none" style={{ backgroundColor: replayData?.drivers?.[activeDriver]?.color || '#888' }} />
                                <div>
                                    <div className="text-xs font-bold text-black">{activeDriver}</div>
                                    <div className="text-[9px] text-gray-600">{replayData?.drivers?.[activeDriver]?.team || 'Unknown'}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-center">
                                    <div className="text-[9px] text-gray-600 uppercase">Pos</div>
                                    <div className="text-sm font-bold text-black">P{currentPositions.find(p => p.driver === activeDriver)?.rank || '-'}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[9px] text-gray-600 uppercase">Gap</div>
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
            <div className="hidden md:flex flex-1" style={{ overflow: 'hidden', minHeight: '400px' }}>
                {/* LEFT: LEADERBOARD */}
                <div className="w-56 bg-white border-r border-black flex flex-col min-h-0">
                    <div className="p-2 border-b border-black text-[9px] font-bold uppercase text-gray-600 shrink-0">Standings</div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {currentPositions.length === 0 ? (
                            <div className="p-4 text-center text-gray-600 text-xs">
                                <div className="text-gray-600 mb-1">No position data</div>
                                <div className="text-[10px]">Select a race with telemetry</div>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {currentPositions.map((d) => {
                                    const meta = replayData?.drivers?.[d.driver] || F1_2026_GRID.find(g => g.driver === d.driver);
                                    const posChange = positionChangesRef.current[d.driver];
                                    return (
                                        <motion.div key={d.driver} layout transition={{ type: "spring", stiffness: 200, damping: 25 }}
                                            onClick={() => setActiveDriver(d.driver)}
                                            className={cn("flex items-center gap-2 px-2 py-1 cursor-pointer border-l-[3px]",
                                                activeDriver === d.driver ? "bg-white/10" : "hover:bg-white/5")}
                                            style={{ borderLeftColor: meta?.color || '#444' }}>
                                            <div className="w-5 text-center relative">
                                                <span className={cn("font-black text-sm", d.rank === 1 ? "text-f1-red" : d.rank <= 3 ? "text-black" : "text-gray-700")}>{d.rank}</span>
                                                {posChange && <span className={cn("absolute -top-1 -right-1 text-[9px] font-bold", posChange > 0 ? "text-green-600" : "text-red-600")}>{posChange > 0 ? '▲' : '▼'}</span>}
                                            </div>
                                            <span className={cn("flex-1 font-bold text-xs truncate", activeDriver === d.driver ? "text-black" : "text-gray-600")}>{d.driver}</span>
                                            <span className={cn("text-[10px] font-mono w-12 text-right", (d.status === 'DNF' || d.status === 'OUT') ? "text-red-600" : d.interval && d.interval < 1 ? "text-orange-600" : "text-gray-700")}>
                                                {(d.status === 'DNF' || d.status === 'OUT') ? 'OUT' : d.interval ? `+${d.interval.toFixed(1)}` : '—'}
                                            </span>
                                            <TyreIcon compound={d.tyre} />
                                        </motion.div>
                                    )
                                })}
                            </AnimatePresence>
                        )}
                    </div>
                </div>

                {/* CENTER: SVG TRACK MAP */}
                <div className="flex-1 relative overflow-hidden bg-white min-h-0">
                    <div className="absolute top-4 left-4 z-10">
                        <div className="text-lg font-heading font-black text-black uppercase">{currentRaceName}</div>
                        <div className="text-sm text-gray-700 mt-0.5">Lap {activeDriverState?.lap || 1} / {replayData?.totalLaps || '—'}</div>
                    </div>

                    {error ? (
                        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center flex-col text-center z-50 bg-gray-100">
                            {/* Grid pattern background */}
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                            <div className="relative z-10 px-8">
                                <AlertTriangle size={64} className="mb-4 text-yellow-500 mx-auto" />
                                <h3 className="text-2xl font-bold text-black mb-3">REPLAY UNAVAILABLE</h3>
                                <p className="text-gray-300 max-w-md text-lg mb-4">{error}</p>
                                {year >= 2026 ? (
                                    <div className="mt-6 p-5 bg-f1-red/5 border border-f1-red/20 rounded-none max-w-lg mx-auto backdrop-blur-sm">
                                        <div className="text-f1-red text-sm font-bold mb-3 flex items-center gap-2 justify-center uppercase tracking-wider">
                                            Available Replays
                                        </div>
                                        <div className="text-sm text-gray-300">
                                            Select from the year selector above to watch past race replays
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-600 mt-4">We are gradually adding historical telemetry data.</p>
                                )}
                            </div>
                        </div>
                    ) : replayData?.map ? (
                        <SVGTrackMap
                            map={replayData.map}
                            positions={currentPositions}
                            activeDriver={activeDriver}
                            drivers={replayData.drivers}
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center flex-col text-center">
                            {/* Placeholder track visual */}
                            <svg width="300" height="200" viewBox="0 0 300 200" className="opacity-20 mb-4">
                                <ellipse cx="150" cy="100" rx="130" ry="80" fill="none" stroke="#333" strokeWidth="20" strokeDasharray="10,5" />
                            </svg>
                            <p className="text-gray-600 text-sm">Track map loading...</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: INFO PANEL - Hidden on mobile */}
                <div className="hidden md:block w-64 bg-white border-l border-black relative" style={{ overflow: 'hidden' }}>
                    <div className="absolute inset-0 flex flex-col">
                        {/* Selected Driver Card */}
                        {activeDriverState && (
                            <div className="p-3 border-b border-black shrink-0">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1.5 h-8 rounded-none" style={{ backgroundColor: replayData?.drivers?.[activeDriver]?.color || '#fff' }} />
                                    <div className="flex-1">
                                        <div className="font-bold text-black text-base">{activeDriver}</div>
                                        <div className="text-xs text-gray-600">{replayData?.drivers?.[activeDriver]?.team}</div>
                                    </div>
                                    <TyreIcon compound={activeDriverState.tyre} size="lg" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-gray-100 border border-gray-300 rounded-none p-2 text-center">
                                        <div className="text-2xl font-heading font-black text-black">{activeDriverState.rank}</div>
                                        <div className="text-[10px] text-gray-600 uppercase font-bold">Pos</div>
                                    </div>
                                    <div className="flex-1 bg-gray-100 border border-gray-300 rounded-none p-2 text-center">
                                        <div className="text-2xl font-heading font-black text-black">{activeDriverState.lap}</div>
                                        <div className="text-[10px] text-gray-600 uppercase font-bold">Lap</div>
                                    </div>
                                    <div className="flex-1 bg-gray-100 border border-gray-300 rounded-none p-2 text-center">
                                        <div className="text-lg font-heading font-black text-orange-600">
                                            {activeDriverState.interval ? `+${activeDriverState.interval.toFixed(1)}` : '—'}
                                        </div>
                                        <div className="text-[10px] text-gray-600 uppercase font-bold">Gap</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Battles */}
                        <div className="p-3 border-b border-black shrink-0">
                            <div className="text-xs font-bold uppercase text-gray-700 mb-2 flex items-center gap-1">
                                <Circle size={8} className="text-orange-500 fill-orange-500" /> Battles
                            </div>
                            {battles.length > 0 ? (
                                <div className="space-y-1.5">
                                    {battles.map(b => {
                                        const ahead = currentPositions.find(x => x.rank === b.rank - 1);
                                        if (!ahead) return null;
                                        return (
                                            <div key={b.driver} className="flex items-center justify-between bg-orange-100 border border-orange-300 rounded px-2 py-1.5">
                                                <span className="text-xs font-bold text-black">{ahead.driver}</span>
                                                <span className="text-xs font-mono font-bold text-orange-600">{b.interval?.toFixed(2)}s</span>
                                                <span className="text-xs font-bold text-black">{b.driver}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-xs text-gray-500 italic">No close battles</div>
                            )}
                        </div>

                        {/* Events Feed */}
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            <div className="p-2 text-xs font-bold uppercase text-gray-700 flex items-center justify-between shrink-0 border-b border-black">
                                <span className="flex items-center gap-1"><Timer size={12} /> Race Feed</span>
                                <span className="text-[10px] font-mono text-gray-600">{visibleEvents.length} events</span>
                            </div>
                            <div ref={feedRef} className="flex-1 overflow-y-auto px-2 pt-2 pb-4 min-h-0 scroll-smooth">
                                <div className="space-y-1.5">

                                    {visibleEvents.filter(e => ['OVERTAKE', 'LOST', 'PIT', 'SC', 'FLAG'].includes(e.type)).reverse().map((e) => (
                                        <motion.div key={e.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "flex items-center gap-2 rounded px-2.5 py-2 border-2",
                                                e.type === 'OVERTAKE' && "bg-green-100 border-green-500",
                                                e.type === 'LOST' && "bg-red-100 border-red-400",
                                                e.type === 'PIT' && "bg-gray-100 border-gray-400",
                                                e.type === 'SC' && "bg-yellow-200 border-yellow-500",
                                                (e.type === 'FLAG' && e.flagType === 'RED') && "bg-red-200 border-red-600",
                                                (e.type === 'FLAG' && e.flagType === 'GREEN') && "bg-green-100 border-green-500",
                                                (e.type === 'FLAG' && e.flagType === 'YELLOW') && "bg-yellow-100 border-yellow-500",
                                                (e.type === 'FLAG' && !['RED', 'GREEN', 'YELLOW'].includes(e.flagType)) && "bg-gray-100 border-gray-400"
                                            )}>
                                            {e.type === 'OVERTAKE' && <ArrowUp size={12} className="text-green-700 shrink-0" />}
                                            {e.type === 'LOST' && <ArrowDown size={12} className="text-red-700 shrink-0" />}
                                            {e.type === 'PIT' && <Wrench size={12} className="text-gray-700 shrink-0" />}
                                            {e.type === 'SC' && <AlertTriangle size={12} className="text-yellow-700 shrink-0" />}
                                            {(e.type === 'FLAG' && e.flagType === 'GREEN') && <Flag size={12} className="text-green-700 shrink-0" />}
                                            {(e.type === 'FLAG' && e.flagType === 'YELLOW') && <Flag size={12} className="text-yellow-700 shrink-0" />}
                                            {(e.type === 'FLAG' && !['RED', 'GREEN', 'YELLOW'].includes(e.flagType)) && <Zap size={12} className="text-gray-700 shrink-0" />}

                                            <div className="flex-1 text-xs">
                                                {e.type === 'OVERTAKE' && (
                                                    <>
                                                        <span className="font-bold text-green-800">{e.driver}</span>
                                                        <span className="text-gray-700"> moves up to P{e.endPos}</span>
                                                    </>
                                                )}
                                                {e.type === 'LOST' && (
                                                    <>
                                                        <span className="font-bold text-red-800">{e.driver}</span>
                                                        <span className="text-gray-700"> drops {e.positions} pos</span>
                                                    </>
                                                )}
                                                {e.type === 'PIT' && (
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-black tracking-wider">{e.driver}</span>
                                                            <span className="text-[10px] text-gray-600 uppercase tracking-widest">PIT STOP</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 bg-black/40 rounded px-1.5 py-1 mt-0.5 border border-white/5">
                                                            <div className="flex items-center gap-1">
                                                                <TyreIcon compound={e.fromTyre} size="sm" />
                                                                <ArrowRight size={8} className="text-gray-600" />
                                                                <TyreIcon compound={e.toTyre} size="sm" />
                                                            </div>
                                                            {/* Optional: Add pit duration if available in generic data */}
                                                        </div>
                                                    </div>
                                                )}
                                                {e.type === 'SC' && (
                                                    <span className="font-bold text-yellow-800 tracking-wider">
                                                        {e.message === 'VSC' ? 'VIRTUAL SAFETY CAR' : 'SAFETY CAR DEPLOYED'}
                                                    </span>
                                                )}
                                                {(e.type === 'FLAG' && e.flagType === 'RED') && (
                                                    <span className="font-bold text-red-800 tracking-wider">RED FLAG</span>
                                                )}
                                                {(e.type === 'FLAG' && e.flagType === 'GREEN') && (
                                                    <span className="font-bold text-green-800 tracking-wider">GREEN FLAG</span>
                                                )}
                                                {(e.type === 'FLAG' && e.flagType === 'YELLOW') && (
                                                    <span className="font-bold text-yellow-700 tracking-wider">YELLOW FLAG</span>
                                                )}
                                                {(e.type === 'FLAG' && !['RED', 'GREEN', 'YELLOW'].includes(e.flagType)) && (
                                                    <span className="font-bold text-gray-700 tracking-wider">{e.message}</span>
                                                )}

                                            </div>
                                            {(e.type !== 'PIT' && e.lap) && <span className="text-[10px] text-gray-700 shrink-0 bg-gray-200 px-1.5 py-0.5 rounded font-bold">L{e.lap}</span>}
                                        </motion.div>
                                    ))}
                                    {visibleEvents.length === 0 && (
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
        }).join(' ') + " Z";
    }, [map, dims, bounds, scale, offsetX, offsetY]);

    return (
        <div ref={containerRef} className="absolute inset-0">
            <svg width={dims.width} height={dims.height} className="absolute inset-0">
                {/* Track */}
                <path d={trackPath} fill="none" stroke="#111" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
                <path d={trackPath} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                <path d={trackPath} fill="none" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />

                {/* Start/Finish Line & Pit Label */}
                {(() => {
                    if (map.x.length < 2) return null;
                    const sp = toScreen(map.x[0], map.y[0]);
                    const dx = map.x[1] - map.x[0], dy = map.y[1] - map.y[0];
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    return (
                        <g transform={`translate(${sp.x}, ${sp.y}) rotate(${angle})`}>
                            <line x1={0} y1={-8} x2={0} y2={8} stroke="black" strokeWidth="2" />
                            <text x={4} y={-10} fill="black" fontSize="8" fontWeight="bold" transform={`rotate(${-angle})`}>PIT / START</text>
                        </g>
                    );
                })()}

                {/* Corner Numbers */}
                {map.corners && map.corners.map((corner, i) => {
                    if (!corner.x || !corner.y) return null;
                    const pos = toScreen(corner.x, corner.y);
                    return (
                        <g key={`corner-${i}`} transform={`translate(${pos.x}, ${pos.y})`}>
                            <circle r={10} fill="white" stroke="black" strokeWidth={2} />
                            <text
                                x={0}
                                y={4}
                                fill="black"
                                fontSize="9"
                                fontWeight="bold"
                                textAnchor="middle"
                            >
                                {corner.number}
                            </text>
                        </g>
                    );
                })}

                {/* Cars - using native SVG transform attribute */}
                {positions.map(p => {
                    const rawIdx = p.progress * (map.x.length - 1);
                    const idx = Math.floor(rawIdx);
                    // Ensure we don't go out of bounds
                    const safeIdx = Math.min(idx, map.x.length - 2);
                    const nextIdx = safeIdx + 1;
                    const ratio = rawIdx - safeIdx;

                    const gx = map.x[safeIdx] + (map.x[nextIdx] - map.x[safeIdx]) * ratio;
                    const gy = map.y[safeIdx] + (map.y[nextIdx] - map.y[safeIdx]) * ratio;
                    const pos = toScreen(gx, gy);

                    const dx = map.x[nextIdx] - map.x[safeIdx];
                    const dy = map.y[nextIdx] - map.y[safeIdx];
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                    // Pit Lane Offset Logic:
                    // Use explicit flag from logic
                    const isPit = p.isInPit;
                    const yOffset = isPit ? 12 : 0; // Shift 'down' (right relative to track) significantly for pit lane

                    const meta = drivers?.[p.driver];
                    const color = meta?.color || '#666';
                    const isActive = p.driver === activeDriver;
                    const isTop10 = p.rank <= 10;
                    const showLabel = isActive || (showAllLabels && isTop10);
                    const w = isActive ? 16 : 10;
                    const h = isActive ? 6 : 4;

                    return (
                        (p.status !== 'DNF' && p.status !== 'OUT' && !(p.lap === 0 && p.isInPit)) && ( // Hide if DNF or DNS (lap 0 in pit)
                            <g key={p.driver} transform={`translate(${pos.x}, ${pos.y}) rotate(${angle}) translate(0, ${yOffset})`}>
                                {isActive && <ellipse cx={0} cy={0} rx={14} ry={10} fill={color} opacity={0.3} />}
                                <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2} fill={color} stroke={isPit ? 'black' : 'black'} strokeWidth={isPit ? 2 : 1.5} />
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
                        ));
                })}
            </svg>
        </div>
    );
}
// InfoIcon replaced with lucide-react import
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
    return <div className={cn("rounded-none flex items-center justify-center font-black border-2", sizeClass)} style={{ borderColor: color, color, backgroundColor: `${color}20` }}>{letter}</div>;
}
