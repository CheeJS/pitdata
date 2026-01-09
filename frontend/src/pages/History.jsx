import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ChevronLeft, Calendar, MapPin, Trophy, Clock, Flag, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Country code to ISO 2-letter code mapping for flag images
const CODE_TO_ISO = {
    'bhr': 'bh', 'sau': 'sa', 'aus': 'au', 'jpn': 'jp',
    'chn': 'cn', 'mia': 'us', 'emi': 'it', 'mon': 'mc',
    'can': 'ca', 'esp': 'es', 'aut': 'at', 'gbr': 'gb',
    'hun': 'hu', 'bel': 'be', 'ned': 'nl', 'ita': 'it',
    'azb': 'az', 'sin': 'sg', 'usa': 'us', 'mex': 'mx',
    'bra': 'br', 'lvg': 'us', 'qat': 'qa', 'abu': 'ae'
};

// Get flag image URL from flagcdn.com
const getFlagUrl = (code) => {
    const iso = CODE_TO_ISO[code] || 'un';
    return `https://flagcdn.com/w80/${iso}.png`;
};

const AVAILABLE_YEARS = [2025, 2024, 2023, 2022, 2021, 2020];

export default function History() {
    const [view, setView] = useState('list');
    const [selectedYear, setSelectedYear] = useState(2025);
    const [races, setRaces] = useState([]);
    const [selectedRaceId, setSelectedRaceId] = useState(null);
    const [raceDetails, setRaceDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

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

    // Group races by month
    const racesByMonth = useMemo(() => {
        const groups = {};
        races.forEach(race => {
            // Parse date like "16 Mar 2025"
            const date = new Date(race.date);
            const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(race);
        });
        return groups;
    }, [races]);

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

                            {/* Year Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-2 bg-[#15151E] border border-[#2A2A30] hover:border-f1-red/50 px-4 py-2.5 rounded-lg transition-all"
                                >
                                    <Calendar size={16} className="text-f1-red" />
                                    <span className="font-bold text-white">{selectedYear} Season</span>
                                    <ChevronDown size={16} className={cn("text-gray-500 transition-transform", dropdownOpen && "rotate-180")} />
                                </button>

                                <AnimatePresence>
                                    {dropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute right-0 top-full mt-2 bg-[#15151E] border border-[#2A2A30] rounded-lg overflow-hidden shadow-xl z-50 min-w-[160px]"
                                        >
                                            {AVAILABLE_YEARS.map(year => (
                                                <button
                                                    key={year}
                                                    onClick={() => {
                                                        setSelectedYear(year);
                                                        setDropdownOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full px-4 py-3 text-left text-sm font-medium transition-colors flex items-center justify-between",
                                                        selectedYear === year
                                                            ? "bg-f1-red/10 text-f1-red"
                                                            : "text-gray-400 hover:bg-white/5 hover:text-white"
                                                    )}
                                                >
                                                    {year} Season
                                                    {selectedYear === year && <div className="w-2 h-2 rounded-full bg-f1-red" />}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Timeline */}
                        {loading && !races.length ? (
                            <div className="text-center py-20 text-gray-500">Loading Archive...</div>
                        ) : (
                            <div className="relative">
                                {/* Timeline Line */}
                                <div className="absolute left-[19px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-f1-red/50 via-[#2A2A30] to-[#2A2A30]" />

                                {Object.entries(racesByMonth).map(([month, monthRaces], monthIdx) => (
                                    <div key={month} className="mb-8">
                                        {/* Month Header */}
                                        <div className="flex items-center gap-4 mb-4 sticky top-0 bg-[#0B0B0F]/95 backdrop-blur-sm py-2 z-10">
                                            <div className="w-10 h-10 rounded-full bg-[#15151E] border-2 border-[#2A2A30] flex items-center justify-center relative z-10">
                                                <Calendar size={16} className="text-gray-500" />
                                            </div>
                                            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{month}</span>
                                        </div>

                                        {/* Races */}
                                        <div className="space-y-3 pl-[52px]">
                                            {monthRaces.map((race, idx) => (
                                                <TimelineRaceCard
                                                    key={race.id}
                                                    race={race}
                                                    onClick={() => {
                                                        setSelectedRaceId(race.id);
                                                        setView('detail');
                                                    }}
                                                    delay={monthIdx * 0.1 + idx * 0.05}
                                                />
                                            ))}
                                        </div>
                                    </div>
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

function TimelineRaceCard({ race, onClick, delay }) {
    const isPast = new Date(race.date) < new Date();
    const flagUrl = getFlagUrl(race.code);

    // Parse date for display
    const dateObj = new Date(race.date);
    const dayNum = dateObj.getDate();
    const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });

    return (
        <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration: 0.3 }}
            onClick={onClick}
            className="w-full group"
        >
            <div className="flex items-center gap-4 bg-[#15151E] hover:bg-[#1A1A24] border border-[#2A2A30] hover:border-f1-red/50 rounded-xl p-4 transition-all relative overflow-hidden">
                {/* Date Badge */}
                <div className="flex-shrink-0 w-14 text-center">
                    <div className="text-2xl font-black text-white leading-none">{dayNum}</div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase">{monthShort}</div>
                </div>

                {/* Divider */}
                <div className="w-px h-10 bg-[#2A2A30]" />

                {/* Flag Image */}
                <div className="flex-shrink-0 w-12 h-8 rounded overflow-hidden shadow-lg border border-white/10">
                    <img
                        src={flagUrl}
                        alt={race.code}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                </div>

                {/* Info */}
                <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Round {race.round}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-f1-red transition-colors truncate">
                        {race.name} <span className="font-normal text-gray-500">Grand Prix</span>
                    </h3>
                    <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
                        <MapPin size={10} /> {race.circuit}
                    </div>
                </div>

                {/* Status + Arrow */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    {isPast ? (
                        <span className="text-[10px] bg-green-500/10 text-green-500 px-2.5 py-1 rounded-full border border-green-500/20 font-bold uppercase">
                            Completed
                        </span>
                    ) : (
                        <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-full border border-amber-500/20 font-bold uppercase">
                            Upcoming
                        </span>
                    )}
                    <ChevronRight size={18} className="text-gray-600 group-hover:text-f1-red group-hover:translate-x-1 transition-all" />
                </div>
            </div>
        </motion.button>
    );
}

function RaceDetailView({ data }) {
    const [activeTab, setActiveTab] = useState('R');

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

    useEffect(() => {
        if (!tabs.find(t => t.id === activeTab) && tabs.length > 0) {
            setActiveTab(tabs[0].id);
        }
    }, [tabs, activeTab]);

    const results = data.results[activeTab] || [];

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
