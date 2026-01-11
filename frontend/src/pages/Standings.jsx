import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, TrendingUp, AlertTriangle, CheckCircle, Flag } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Standings() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStandings = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/standings?year=2025');
                // Backend might return error key
                if (res.data.error) throw new Error(res.data.error);
                setData(res.data);
            } catch (e) {
                console.error("Standings Error", e);
            } finally {
                setLoading(false);
            }
        };
        fetchStandings();
    }, []);

    if (loading) return <div className="p-8 text-white animate-pulse">Computing Championship Scenarios...</div>;
    if (!data) return <div className="p-8 text-red-500">Failed to load standings data</div>;

    // WDC Math
    const totalRounds = data.total_rounds;
    const completedRounds = data.completed_rounds;
    const remainingRounds = totalRounds - completedRounds;
    const maxPointsRemaining = remainingRounds * 26; // 25 + 1 FL (ignoring sprints for MVP)
    const leaderPoints = data.drivers[0].points;

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 h-screen flex flex-col overflow-hidden animate-in fade-in duration-500">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#2A2A30] pb-4 md:pb-6 shrink-0">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold italic uppercase text-white tracking-tighter">Season Standings</h1>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">{completedRounds} / {totalRounds} Rounds Completed</span>
                        <div className="h-1 w-24 bg-[#2A2A30] rounded-full overflow-hidden">
                            <div className="h-full bg-f1-red" style={{ width: `${(completedRounds / totalRounds) * 100}%` }} />
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-[#15151E] px-2 sm:px-3 py-1.5 rounded-lg border border-[#2A2A30]">
                    <Trophy size={16} className="text-yellow-500 shrink-0" />
                    <span className="text-white font-bold text-xs sm:text-sm truncate">Leader: {data.drivers[0].name} ({leaderPoints} pts)</span>
                </div>
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-hidden">

                {/* LEFT: CHAMPIONSHIP TABLE */}
                <div className="flex-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-[#2A2A30] bg-black/20 flex justify-between items-center">
                        <h3 className="text-sm font-bold uppercase text-gray-400 flex items-center gap-2">
                            <Flag size={14} /> WDC Contenders
                        </h3>
                        <span className="text-[10px] text-gray-500 uppercase font-mono">{maxPointsRemaining} pts remaining</span>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar flex-1 p-2">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                                <tr className="text-[10px] text-gray-500 uppercase border-b border-[#2A2A30]">
                                    <th className="p-2 w-8">Pos</th>
                                    <th className="p-2">Driver</th>
                                    <th className="p-2 text-right">Pts</th>
                                    <th className="p-2 text-right">Gap</th>
                                    <th className="p-2 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {data.drivers.map((d, i) => {
                                    const gap = leaderPoints - d.points;
                                    const eliminated = gap > maxPointsRemaining;

                                    const teamColors = {
                                        "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#E8002D",
                                        "McLaren": "#FF8000", "Aston Martin": "#229971", "Alpine": "#0093CC",
                                        "Williams": "#64C4FF", "RB": "#6692FF", "Kick Sauber": "#52E252", "Haas F1 Team": "#B6BABD"
                                    };
                                    const color = teamColors[d.team] || teamColors[Object.keys(teamColors).find(k => d.team && d.team.includes(k))] || "#FFF";

                                    return (
                                        <tr key={d.code} className={cn("border-b border-[#2A2A30] hover:bg-white/5 transition-colors", eliminated ? "opacity-60 grayscale-[0.5]" : "")}>
                                            <td className="p-3 font-mono text-gray-400">{i + 1}</td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                    <div>
                                                        <div className="font-bold text-white leading-tight">{d.name}</div>
                                                        <div className="text-[10px] text-gray-500 uppercase">{d.team}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right font-mono text-white">{d.points}</td>
                                            <td className="p-3 text-right font-mono text-gray-400">-{gap}</td>
                                            <td className="p-3 text-center">
                                                {eliminated ? (
                                                    <span className="bg-red-500/10 text-red-500 text-[10px] px-2 py-0.5 rounded border border-red-500/20 font-bold uppercase">Eliminated</span>
                                                ) : (
                                                    <span className="bg-green-500/10 text-green-500 text-[10px] px-2 py-0.5 rounded border border-green-500/20 font-bold uppercase flex items-center justify-center gap-1">
                                                        <CheckCircle size={10} /> Math Possible
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT: CONSTRUCTOR STANDINGS + CHART */}
                <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-hidden">

                    {/* CONSTRUCTOR STANDINGS TABLE */}
                    <div className="flex-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-[#2A2A30] bg-black/20 flex justify-between items-center">
                            <h3 className="text-sm font-bold uppercase text-gray-400 flex items-center gap-2">
                                <Trophy size={14} className="text-yellow-500" /> WCC Contenders
                            </h3>
                            <span className="text-[10px] text-gray-500 uppercase font-mono">{maxPointsRemaining * 2} pts remaining</span>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar flex-1 p-2">
                            <table className="w-full text-left border-collapse min-w-[400px]">
                                <thead>
                                    <tr className="text-[10px] text-gray-500 uppercase border-b border-[#2A2A30]">
                                        <th className="p-2 w-8">Pos</th>
                                        <th className="p-2">Constructor</th>
                                        <th className="p-2 text-right">Pts</th>
                                        <th className="p-2 text-right">Wins</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {data.constructors?.map((c, i) => {
                                        const teamColors = {
                                            "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#E8002D",
                                            "McLaren": "#FF8000", "Aston Martin": "#229971", "Alpine": "#0093CC",
                                            "Williams": "#64C4FF", "RB": "#6692FF", "Kick Sauber": "#52E252", "Haas F1 Team": "#B6BABD",
                                            "Racing Bulls": "#6692FF"
                                        };
                                        const color = teamColors[c.name] || teamColors[Object.keys(teamColors).find(k => c.name && c.name.includes(k))] || "#FFF";

                                        return (
                                            <tr key={c.name} className="border-b border-[#2A2A30] hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-mono text-gray-400">{i + 1}</td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                        <div>
                                                            <div className="font-bold text-white leading-tight">{c.name}</div>
                                                            <div className="text-[10px] text-gray-500 uppercase">{c.drivers?.join(' • ')}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right font-mono text-white">{c.points}</td>
                                                <td className="p-3 text-right font-mono text-gray-400">{c.wins}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
