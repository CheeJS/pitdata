import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, TrendingUp, AlertTriangle, CheckCircle, Flag } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export default function Standings() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(2025);
    const availableYears = [2026, 2025, 2024];

    useEffect(() => {
        const fetchStandings = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`http://localhost:5000/api/standings?year=${year}`);
                if (res.data.error) throw new Error(res.data.error);
                setData(res.data);
            } catch (e) {
                console.error("Standings Error", e);
            } finally {
                setLoading(false);
            }
        };
        fetchStandings();
    }, [year]);

    if (loading) return <div className="p-8 text-white animate-pulse">Loading standings...</div>;
    if (!data) return <div className="p-8 text-red-500">Failed to load standings data</div>;
    if (!data.drivers || data.drivers.length === 0) return <div className="p-8 text-gray-500">No standings data available for this year.</div>;

    const totalRounds = data.total_rounds || 24;
    const completedRounds = data.completed_rounds || 0;
    const remainingRounds = totalRounds - completedRounds;
    const maxPointsRemaining = remainingRounds * 26;
    const leaderPoints = data.drivers[0]?.points || 0;

    const getTeamColor = (team) => {
        const colors = {
            "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#E8002D",
            "McLaren": "#FF8000", "Aston Martin": "#229971", "Alpine": "#0093CC",
            "Williams": "#64C4FF", "RB": "#6692FF", "Kick Sauber": "#52E252",
            "Haas F1 Team": "#B6BABD", "Racing Bulls": "#6692FF"
        };
        return colors[team] || colors[Object.keys(colors).find(k => team?.includes(k))] || "#666";
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">

            {/* ===== MOBILE LAYOUT ===== */}
            <div className="md:hidden flex-1 overflow-y-auto space-y-4 p-4 pb-20">

                {/* Header */}
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-lg font-bold text-white">Standings</h1>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="bg-[#222] border border-[#333] text-white text-xs rounded-lg px-2 py-1 outline-none focus:border-f1-red"
                        >
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{completedRounds}/{totalRounds} rounds</span>
                        <div className="h-1 w-20 bg-[#222] rounded-full overflow-hidden">
                            <div className="h-full bg-f1-red" style={{ width: `${(completedRounds / totalRounds) * 100}%` }} />
                        </div>
                    </div>
                </div>

                {/* Driver Championship */}
                <section className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
                        <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Driver Championship</h3>
                        <span className="text-[10px] text-gray-600">{data.drivers.length} drivers</span>
                    </div>
                    <div className="divide-y divide-[#1a1a1a]">
                        {data.drivers.map((d, i) => {
                            const gap = leaderPoints - d.points;
                            const eliminated = gap > maxPointsRemaining;
                            return (
                                <div key={d.code} className={cn("flex items-center justify-between px-4 py-3", eliminated && "opacity-50")}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-gray-500 w-5">{i + 1}</span>
                                        <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: getTeamColor(d.team) }} />
                                        <div>
                                            <div className="text-sm font-medium text-white">{d.name}</div>
                                            <div className="text-[10px] text-gray-600">{d.team}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-mono text-white">{d.points}</div>
                                        {i > 0 && <div className="text-[10px] text-gray-600">-{gap}</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Constructor Championship */}
                <section className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#222]">
                        <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Constructor Championship</h3>
                    </div>
                    <div className="divide-y divide-[#1a1a1a]">
                        {data.constructors?.map((c, i) => (
                            <div key={c.name} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-gray-500 w-5">{i + 1}</span>
                                    <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: getTeamColor(c.name) }} />
                                    <div>
                                        <div className="text-sm font-medium text-white">{c.name}</div>
                                        <div className="text-[10px] text-gray-600">{c.wins} wins</div>
                                    </div>
                                </div>
                                <span className="text-sm font-mono text-white">{c.points}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* ===== DESKTOP LAYOUT ===== */}
            <div className="hidden md:flex flex-col flex-1 p-6 space-y-6 overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-end border-b border-[#222] pb-6 shrink-0">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">Season Standings</h1>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="bg-[#222] border border-[#333] text-white text-sm font-medium rounded-lg px-3 py-1.5 outline-none focus:border-f1-red cursor-pointer"
                            >
                                {availableYears.map(y => <option key={y} value={y}>{y} Season</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-gray-500">{completedRounds}/{totalRounds} rounds completed</span>
                            <div className="h-1 w-24 bg-[#222] rounded-full overflow-hidden">
                                <div className="h-full bg-f1-red" style={{ width: `${(completedRounds / totalRounds) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-[#111] px-3 py-1.5 rounded-lg border border-[#222]">
                            <Trophy size={16} className="text-yellow-500" />
                            <span className="text-white font-medium text-sm">Leader: {data.drivers[0].name} ({leaderPoints} pts)</span>
                        </div>
                        {maxPointsRemaining > 0 && (
                            <div className="text-xs text-gray-500">
                                <span className="text-f1-red font-bold">{maxPointsRemaining}</span> pts remaining
                            </div>
                        )}
                    </div>
                </div>

                {/* Tables Grid */}
                <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">

                    {/* Driver Table */}
                    <div className="flex-1 bg-[#111] rounded-2xl border border-[#222] flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#222] flex justify-between items-center">
                            <h3 className="text-xs font-medium text-gray-500 uppercase">Driver Championship</h3>
                            <span className="text-[10px] text-gray-600">{maxPointsRemaining} pts remaining</span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-[#111]">
                                    <tr className="text-[10px] text-gray-500 uppercase border-b border-[#222]">
                                        <th className="p-3 w-10">Pos</th>
                                        <th className="p-3">Driver</th>
                                        <th className="p-3 text-right">Pts</th>
                                        <th className="p-3 text-right">Gap</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1a1a1a]">
                                    {data.drivers.map((d, i) => {
                                        const gap = leaderPoints - d.points;
                                        const eliminated = gap > maxPointsRemaining;
                                        return (
                                            <tr key={d.code} className={cn("hover:bg-white/5", eliminated && "opacity-50")}>
                                                <td className="p-3 text-sm font-bold text-gray-500">{i + 1}</td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: getTeamColor(d.team) }} />
                                                        <div>
                                                            <div className="text-sm font-medium text-white">{d.name}</div>
                                                            <div className="text-[10px] text-gray-600">{d.team}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right text-sm font-mono text-white">{d.points}</td>
                                                <td className="p-3 text-right text-sm font-mono text-gray-500">
                                                    {i > 0 ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span>-{gap}</span>
                                                            {eliminated && (
                                                                <span className="inline-flex items-center gap-1 text-[9px] text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded">
                                                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full"></span>
                                                                    ELIMINATED
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Constructor Table */}
                    <div className="flex-1 bg-[#111] rounded-2xl border border-[#222] flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#222]">
                            <h3 className="text-xs font-medium text-gray-500 uppercase">Constructor Championship</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-[#111]">
                                    <tr className="text-[10px] text-gray-500 uppercase border-b border-[#222]">
                                        <th className="p-3 w-10">Pos</th>
                                        <th className="p-3">Team</th>
                                        <th className="p-3 text-right">Pts</th>
                                        <th className="p-3 text-right">Wins</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1a1a1a]">
                                    {data.constructors?.map((c, i) => (
                                        <tr key={c.name} className="hover:bg-white/5">
                                            <td className="p-3 text-sm font-bold text-gray-500">{i + 1}</td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: getTeamColor(c.name) }} />
                                                    <span className="text-sm font-medium text-white">{c.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right text-sm font-mono text-white">{c.points}</td>
                                            <td className="p-3 text-right text-sm font-mono text-gray-500">{c.wins}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
