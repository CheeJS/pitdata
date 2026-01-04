
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Trophy, Activity, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Predictions() {
    const [races, setRaces] = useState([]);
    const [clientId, setClientId] = useState(localStorage.getItem('f1_client_id'));
    const [selectedRace, setSelectedRace] = useState(null);
    const [stats, setStats] = useState(null);
    const [vote, setVote] = useState(null);
    const [loading, setLoading] = useState(false);

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
                // Default to first race
                if (res.data.length > 0) setSelectedRace(res.data[0]);
            })
            .catch(err => console.error("Error fetching races", err));
    }, []);

    // 3. Fetch Stats when race changes
    useEffect(() => {
        if (!selectedRace) return;
        setLoading(true);
        axios.get(`http://localhost:5000/api/predictions/stats?race_id=${selectedRace.id}`)
            .then(res => setStats(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [selectedRace]);

    const getVotingStatus = (race) => {
        if (!race || !race.date_iso) return { status: 'UNKNOWN' };

        const now = new Date(); // Current Time
        const raceTime = new Date(race.date_iso);

        // Window: Opens 4 days before, Closes 24h before (Qualifying)
        const openTime = new Date(raceTime);
        openTime.setDate(raceTime.getDate() - 4);

        const closeTime = new Date(raceTime);
        closeTime.setHours(raceTime.getHours() - 24);

        if (now < openTime) return { status: 'UPCOMING', date: openTime };
        if (now > closeTime) return { status: 'CLOSED' };
        return { status: 'OPEN', date: closeTime };
    };

    const votingStatus = selectedRace ? getVotingStatus(selectedRace) : { status: 'UNKNOWN' };

    const submitVote = async (category, value) => {
        if (votingStatus.status !== 'OPEN') return; // Enforce

        try {
            await axios.post('http://localhost:5000/api/predictions/vote', {
                race_id: selectedRace.id,
                client_id: clientId,
                category,
                value
            });
            // Refresh stats
            const res = await axios.get(`http://localhost:5000/api/predictions/stats?race_id=${selectedRace.id}`);
            setStats(res.data);
            setVote(value);
        } catch (e) {
            console.error("Vote failed", e);
        }
    };

    if (!selectedRace) return <div className="p-8 text-white animate-pulse">Loading Oracle...</div>;

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500 space-y-6">
            {/* HEADER */}
            <div className="flex justify-between items-end border-b border-[#2A2A30] pb-6 shrink-0">
                <div>
                    <h1 className="text-3xl font-heading font-bold italic uppercase text-white tracking-tighter">Crowd Wisdom Oracle</h1>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                        Measure your intuition against the Hive Mind
                    </p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
                {/* LEFT: VOTING BOOTH */}
                <div className="flex-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] flex flex-col p-6 overflow-y-auto custom-scrollbar relative">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">Voting Booth 🗳️</h2>
                            <p className="text-gray-500 text-xs uppercase tracking-widest">
                                {selectedRace.name} • ID: <span className="text-f1-red font-mono">{clientId?.substr(0, 6)}...</span>
                            </p>
                        </div>
                        <select
                            className="bg-[#0B0B0F] border border-[#2A2A30] text-gray-300 text-sm rounded-lg p-2 outline-none"
                            value={selectedRace.id}
                            onChange={e => setSelectedRace(races.find(r => r.id == e.target.value))}
                        >
                            {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>

                    {/* STATUS BANNER */}
                    {votingStatus.status === 'CLOSED' && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-500 text-sm font-bold animate-pulse">
                            <AlertTriangle size={16} />
                            Voting is Closed for this Event.
                        </div>
                    )}
                    {votingStatus.status === 'UPCOMING' && (
                        <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/50 rounded-xl flex items-center gap-3 text-blue-500 text-sm font-bold">
                            <Activity size={16} />
                            Points Unlocking on {votingStatus.date.toLocaleDateString()}.
                        </div>
                    )}
                    {votingStatus.status === 'OPEN' && (
                        <div className="mb-6 p-3 bg-green-500/10 border border-green-500/50 rounded-xl flex items-center gap-3 text-green-500 text-sm font-bold">
                            <Zap size={16} />
                            VOTING LIVE! Closes {votingStatus.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                        </div>
                    )}

                    {/* POLL: WINNER */}
                    <div className={cn("mb-8 transition-opacity duration-500", votingStatus.status !== 'OPEN' && "opacity-50 pointer-events-none grayscale")}>
                        <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 flex items-center gap-2"><Trophy size={14} /> Who Wins?</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {['VER', 'NOR', 'LEC', 'HAM'].map(driver => (
                                <button
                                    key={driver}
                                    onClick={() => submitVote("winner", driver)}
                                    className={cn(
                                        "p-4 rounded-xl border transition-all text-left group relative overflow-hidden",
                                        vote === driver ? "bg-f1-red border-f1-red" : "bg-[#0B0B0F] border-[#2A2A30] hover:border-gray-500"
                                    )}
                                >
                                    <span className={cn("text-xl font-bold block mb-1", vote === driver ? "text-white" : "text-gray-300")}>{driver}</span>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider group-hover:text-gray-300">Scuderia Ferrari</span>
                                    {vote === driver && <div className="absolute right-3 top-3"><Zap size={16} className="text-white fill-white" /></div>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* POLL: SAFETY CAR */}
                    <div className={cn("transition-opacity duration-500", votingStatus.status !== 'OPEN' && "opacity-50 pointer-events-none grayscale")}>
                        <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Safety Car Probability?</h3>
                        <div className="flex gap-4">
                            <button onClick={() => submitVote("safety_car", "YES")} className="flex-1 bg-[#2A2A30] hover:bg-yellow-500/20 hover:text-yellow-500 hover:border-yellow-500 border border-transparent p-4 rounded-xl font-bold transition-all">YES</button>
                            <button onClick={() => submitVote("safety_car", "NO")} className="flex-1 bg-[#2A2A30] hover:bg-green-500/20 hover:text-green-500 hover:border-green-500 border border-transparent p-4 rounded-xl font-bold transition-all">NO</button>
                        </div>
                    </div>

                </div>

                {/* RIGHT: THE ARENA (STATS) */}
                <div className="flex-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Public Wisdom 🧠</h2>
                        <div className="flex items-center gap-2 text-xs text-green-500 font-mono">
                            <Activity size={12} /> Live Updates
                        </div>
                    </div>

                    {loading ? <div className="text-gray-500 text-sm animate-pulse">Connecting to Hive Mind...</div> : (
                        <div className="space-y-6">
                            {/* CHART */}
                            <div className="bg-[#0B0B0F] p-4 rounded-xl border border-[#2A2A30]">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">Winner Distribution</h4>
                                {stats?.winner?.map((item, i) => (
                                    <div key={item.code} className="mb-3">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-bold text-white">{item.code}</span>
                                            <span className="text-gray-400">{item.percent}%</span>
                                        </div>
                                        <div className="h-2 bg-[#2A2A30] rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${item.percent}%` }}
                                                className={cn("h-full rounded-full", i === 0 ? "bg-f1-red" : "bg-gray-500")}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {(!stats?.winner || stats.winner.length === 0) && <div className="text-xs text-gray-600 text-center py-4">No votes yet. Be the first!</div>}
                            </div>

                            <div className="p-4 rounded-xl border border-dashed border-[#2A2A30] text-center">
                                <h3 className="text-gray-400 font-bold text-sm mb-2">Total Votes Cast</h3>
                                <p className="text-4xl font-mono text-white">{stats?.total_votes || 0}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
