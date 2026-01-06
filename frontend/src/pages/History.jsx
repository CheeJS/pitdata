import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronLeft, Calendar, MapPin, Trophy, Clock, Flag } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function History() {
    const [view, setView] = useState('list'); // 'list' | 'detail'
    const [selectedYear, setSelectedYear] = useState(2025);
    const [races, setRaces] = useState([]);
    const [selectedRaceId, setSelectedRaceId] = useState(null);
    const [raceDetails, setRaceDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch Race List
    useEffect(() => {
        setLoading(true);
        axios.get(`http://localhost:5000/api/races?year=${selectedYear}`)
            .then(res => {
                setRaces(res.data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [selectedYear]);

    // Fetch Race Details when race selected
    useEffect(() => {
        if (!selectedRaceId) return;
        setLoading(true);
        axios.get(`http://localhost:5000/api/results/${selectedRaceId}`)
            .then(res => {
                setRaceDetails(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [selectedRaceId]);

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            <AnimatePresence mode="wait">
                {view === 'list' ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex-1 overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="mb-8 flex justify-between items-center">
                            <div>
                                <h1 className="text-4xl font-bold font-heading mb-2">Race Archive</h1>
                                <p className="text-gray-500">Explore past race results and telemetry.</p>
                            </div>
                            <div className="flex bg-[#15151E] rounded-lg p-1 border border-[#2A2A30]">
                                {[2025, 2024].map(y => (
                                    <button
                                        key={y}
                                        onClick={() => setSelectedYear(y)}
                                        className={cn(
                                            "px-4 py-2 rounded-md text-sm font-bold transition-all",
                                            selectedYear === y ? "bg-f1-red text-white shadow-lg" : "text-gray-500 hover:text-white"
                                        )}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Grid */}
                        {loading && !races.length ? (
                            <div className="text-center py-20 text-gray-500">Loading Archive...</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {races.map((race) => (
                                    <RaceCard
                                        key={race.id}
                                        race={race}
                                        onClick={() => {
                                            setSelectedRaceId(race.id);
                                            setView('detail');
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                        {!loading && races.length === 0 && (
                            <div className="text-center py-20 text-gray-500">No races found for this season.</div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="detail"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex-1 flex flex-col min-h-0"
                    >
                        <button
                            onClick={() => { setView('list'); setSelectedRaceId(null); setRaceDetails(null); }}
                            className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors w-fit"
                        >
                            <ChevronLeft size={20} /> Back to {selectedYear} Season
                        </button>

                        {loading || !raceDetails ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500">Loading Results...</div>
                        ) : (
                            <RaceDetailView data={raceDetails} />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function RaceCard({ race, onClick }) {
    const isPast = new Date(race.date) < new Date();

    // Fallback/Mock winner if not provided in list API yet (we only fetch basics there)
    // Actually, backend get_latest_results fetcher returns mostly everything but `get_races_list` might send simpler data.
    // Assuming `get_races` returns basic info.

    return (
        <button
            onClick={onClick}
            className="text-left group bg-[#15151E] hover:bg-[#1A1A24] border border-[#2A2A30] hover:border-f1-red/50 p-5 rounded-xl transition-all relative overflow-hidden flex flex-col gap-3"
        >
            <div className="flex justify-between items-start w-full">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Round {race.round}</span>
                {isPast ? (
                    <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded border border-green-500/20 font-bold uppercase">Completed</span>
                ) : (
                    <span className="text-[10px] bg-gray-500/10 text-gray-500 px-2 py-0.5 rounded border border-gray-500/20 font-bold uppercase">Upcoming</span>
                )}
            </div>

            <div>
                <h3 className="text-lg font-bold text-white group-hover:text-f1-red transition-colors line-clamp-1">{race.name}</h3>
                <div className="flex items-center gap-2 text-gray-500 text-xs mt-1">
                    <MapPin size={12} /> {race.circuit}
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-xs mt-1">
                    <Calendar size={12} /> {new Date(race.date).toLocaleDateString()}
                </div>
            </div>

            {/* Decorative Element */}
            <div className="absolute right-0 bottom-0 opacity-5 group-hover:opacity-10 transition-opacity">
                <Flag size={64} />
            </div>
        </button>
    )
}

function RaceDetailView({ data }) {
    const [activeTab, setActiveTab] = useState('R'); // R, S, SS, Q, FP3, FP2, FP1

    // Check available sessions in data.results keys
    const availableSessions = Object.keys(data.results);
    const tabs = [
        { id: 'R', label: 'Race' },
        { id: 'S', label: 'Sprint' },
        { id: 'SS', label: 'Sprint Quali' },
        { id: 'Q', label: 'Qualifying' },
        { id: 'FP3', label: 'FP3' },
        { id: 'FP2', label: 'FP2' },
        { id: 'FP1', label: 'FP1' },
    ].filter(t => availableSessions.includes(t.id));

    // If active tab not available, switch to first available
    useEffect(() => {
        if (!tabs.find(t => t.id === activeTab) && tabs.length > 0) {
            setActiveTab(tabs[0].id);
        }
    }, [tabs, activeTab]);

    const results = data.results[activeTab] || [];

    // Sort results: Pos 1 at top. Handle 'NC' or strings.
    const sortedResults = [...results].sort((a, b) => {
        const pa = parseInt(a.pos) || 999;
        const pb = parseInt(b.pos) || 999;
        return pa - pb;
    });

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Header */}
            <div className="bg-[#15151E] rounded-2xl border border-[#2A2A30] p-6 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">{data.raceName}</h2>
                    <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
                        <span className="flex items-center gap-1"><Calendar size={14} /> {data.date}</span>
                        <span className="flex items-center gap-1"><MapPin size={14} /> {data.circuit}</span>
                    </div>
                </div>
                {/* Winner Badge (Race Only) */}
                {activeTab === 'R' && data.winner && (
                    <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Winner</div>
                        <div className="text-2xl font-bold text-white">{data.winner}</div>
                        <div className="text-sm text-f1-red font-bold">{data.winnerTeam}</div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-[#2A2A30]">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors",
                            activeTab === tab.id
                                ? "border-f1-red text-white"
                                : "border-transparent text-gray-500 hover:text-gray-300"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-[#15151E] rounded-xl border border-[#2A2A30] overflow-hidden flex-1 flex flex-col">
                <div className="overflow-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#0B0B0F] text-gray-400 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 border-b border-[#2A2A30]">
                            <tr>
                                <th className="px-6 py-4 w-16">Pos</th>
                                <th className="px-6 py-4">Driver</th>
                                <th className="px-6 py-4">Constructor</th>
                                <th className="px-6 py-4 text-right">Time/Gap</th>
                                {activeTab === 'R' && <th className="px-6 py-4 text-right">Pts</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2A2A30]">
                            {sortedResults.map((row, i) => {
                                const isPodium = i < 3 && (activeTab === 'R' || activeTab === 'S');
                                const bgClass = isPodium ? 'bg-gradient-to-r from-white/5 to-transparent' : '';

                                return (
                                    <tr key={i} className={cn("hover:bg-white/5 transition-colors group", bgClass)}>
                                        <td className="px-6 py-4 font-heading font-bold text-lg text-gray-500 group-hover:text-white">
                                            {row.pos}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {/* Color Bar */}
                                                <div className="w-1 h-8 rounded-full" style={{ backgroundColor: getTeamColor(row.team) }}></div>
                                                <div>
                                                    <div className="font-bold text-white leading-tight">{row.driver}</div>
                                                    <div className="text-[10px] text-gray-500 uppercase">{row.code}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-400">
                                            {row.team}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-sm text-gray-300 group-hover:text-white">
                                            {row.time}
                                        </td>
                                        {activeTab === 'R' && (
                                            <td className="px-6 py-4 text-right">
                                                {row.pts > 0 && (
                                                    <span className="inline-block min-w-[30px] text-center font-bold bg-[#2A2A30] py-1 px-2 rounded text-xs">
                                                        {row.pts}
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {sortedResults.length === 0 && (
                        <div className="p-10 text-center text-gray-500">No results available for this session.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper (Duplicated from App.jsx, ideally should be in utils)
function getTeamColor(teamName) {
    if (!teamName) return '#ccc';
    const lower = teamName.toLowerCase();
    if (lower.includes('ferrari')) return '#E8002d';
    if (lower.includes('mclaren')) return '#FF8000';
    if (lower.includes('red bull')) return '#3671C6';
    if (lower.includes('mercedes')) return '#27F4D2';
    if (lower.includes('aston')) return '#225941';
    if (lower.includes('alpine')) return '#0093cc';
    if (lower.includes('williams')) return '#64C4FF';
    if (lower.includes('haas')) return '#B6BABD';
    if (lower.includes('sauber') || lower.includes('kick')) return '#52e252';
    if (lower.includes('rb') || lower.includes('alpha')) return '#6692FF';
    return '#666';
}
