import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, TrendingUp, AlertTriangle, CheckCircle, Flag } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

import { PixelCard } from '../components/PixelUI';

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

    if (loading) return <div className="p-8 text-black font-heading animate-pulse">LOADING STANDINGS...</div>;
    if (!data) return <div className="p-8 text-f1-red font-heading">ERROR LOAD DATA</div>;
    if (!data.drivers || data.drivers.length === 0) return <div className="p-8 text-gray-500 font-heading">NO DATA FOR YEAR</div>;

    const totalRounds = data.total_rounds || 24;
    const completedRounds = data.completed_rounds || 0;
    const remainingRounds = totalRounds - completedRounds;
    const maxPointsRemaining = remainingRounds * 26;
    const leaderPoints = data.drivers[0]?.points || 0;

    const getTeamColor = (team) => {
        const colors = {
            "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#E8002D",
            "McLaren": "#FF8000", "Aston Martin": "#229971", "Alpine": "#0093CC",
            "Williams": "#64C4FF", "RB": "#6692FF", "Audi": "#808080",
            "Haas F1 Team": "#B6BABD", "Racing Bulls": "#6692FF"
        };
        return colors[team] || colors[Object.keys(colors).find(k => team?.includes(k))] || "#666";
    };

    return (
        <div className="h-full flex flex-col overflow-hidden text-black">

            {/* ===== DESKTOP LAYOUT ===== */}
            <div className="flex flex-col flex-1 p-3 space-y-2 overflow-hidden">

                {/* Header */}
                {/* Header - Compact & Cohesive */}
                <div className="flex items-end justify-between border-b-2 border-black pb-2 shrink-0 gap-8">
                    {/* Left: Title & Progress */}
                    <div className="flex flex-col gap-1 pb-1">
                        <div className="flex items-center gap-4">
                            <h1 className="text-4xl font-heading text-black uppercase leading-none">Season Standings</h1>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="bg-white border-2 border-black text-black font-body text-lg px-2 py-0.5 outline-none shadow-hard-sm cursor-pointer"
                            >
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="h-3 w-48 border-2 border-black bg-white p-0.5">
                                <div className="h-full bg-f1-red" style={{ width: `${(completedRounds / totalRounds) * 100}%` }} />
                            </div>
                            <span className="text-sm font-bold opacity-60">{completedRounds}/{totalRounds} ROUNDS</span>
                        </div>
                    </div>
                </div>

                {/* Tables Grid */}
                <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

                    {/* Driver Table */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <PixelCard title="Driver Championship" className="h-full flex flex-col p-0 overflow-hidden">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-f1-light border-b-4 border-black z-10">
                                        <tr className="text-lg font-heading text-black uppercase">
                                            <th className="p-3 w-16">#</th>
                                            <th className="p-3">Driver</th>
                                            <th className="p-3 text-right">Pts</th>
                                            <th className="p-3 text-right">Gap</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-gray-200">
                                        {data.drivers.map((d, i) => {
                                            const gap = leaderPoints - d.points;
                                            const eliminated = gap > maxPointsRemaining;
                                            const isPodium = i < 3;
                                            const teamColor = getTeamColor(d.team);
                                            return (
                                                <tr
                                                    key={d.code}
                                                    className={cn(
                                                        "transition-all duration-200 border-l-4 group",
                                                        eliminated && "opacity-50 grayscale",
                                                        isPodium ? "hover:shadow-[inset_0_0_30px_rgba(255,0,0,0.1)]" : "hover:bg-yellow-50"
                                                    )}
                                                    style={{
                                                        borderLeftColor: teamColor,
                                                        backgroundColor: isPodium ? `${teamColor}08` : undefined
                                                    }}
                                                >
                                                    <td className="p-3 text-xl font-heading">
                                                        <span className={cn(
                                                            isPodium && "text-f1-red",
                                                            i === 0 && "text-2xl"
                                                        )}>
                                                            {i + 1}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className={cn(
                                                                    "w-3 h-8 border border-black transition-all duration-200",
                                                                    isPodium && "group-hover:shadow-[0_0_10px_currentColor]"
                                                                )}
                                                                style={{ backgroundColor: teamColor, color: teamColor }}
                                                            />
                                                            <div>
                                                                <div className={cn(
                                                                    "text-xl font-heading leading-tight",
                                                                    i === 0 && "text-2xl"
                                                                )}>{d.name}</div>
                                                                <div className="text-sm font-body uppercase text-gray-600">{d.team}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right text-xl font-heading">
                                                        <span className={cn(i === 0 && "text-2xl font-black")}>
                                                            {d.points}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right text-lg font-mono">
                                                        {i > 0 ? `-${gap}` : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </PixelCard>
                    </div>

                    {/* Constructor Table */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <PixelCard title="Constructors" className="h-full flex flex-col p-0 overflow-hidden">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-f1-light border-b-4 border-black z-10">
                                        <tr className="text-lg font-heading text-black uppercase">
                                            <th className="p-3 w-16">#</th>
                                            <th className="p-3">Team</th>
                                            <th className="p-3 text-right">Pts</th>
                                            <th className="p-3 text-right">Wins</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-gray-200">
                                        {data.constructors?.map((c, i) => {
                                            const isPodium = i < 3;
                                            const teamColor = getTeamColor(c.name);
                                            return (
                                                <tr
                                                    key={c.name}
                                                    className={cn(
                                                        "transition-all duration-200 border-l-4 group",
                                                        isPodium ? "hover:shadow-[inset_0_0_30px_rgba(255,0,0,0.1)]" : "hover:bg-yellow-50"
                                                    )}
                                                    style={{
                                                        borderLeftColor: teamColor,
                                                        backgroundColor: isPodium ? `${teamColor}08` : undefined
                                                    }}
                                                >
                                                    <td className="p-3 text-xl font-heading">
                                                        <span className={cn(
                                                            isPodium && "text-f1-red",
                                                            i === 0 && "text-2xl"
                                                        )}>
                                                            {i + 1}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className={cn(
                                                                    "w-4 h-10 border border-black transition-all duration-200",
                                                                    isPodium && "group-hover:shadow-[0_0_10px_currentColor]"
                                                                )}
                                                                style={{ backgroundColor: teamColor, color: teamColor }}
                                                            />
                                                            <span className={cn(
                                                                "text-xl font-heading",
                                                                i === 0 && "text-2xl"
                                                            )}>{c.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right text-xl font-heading">
                                                        <span className={cn(i === 0 && "text-2xl font-black")}>
                                                            {c.points}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right text-lg font-mono">{c.wins}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </PixelCard>
                    </div>
                </div>
            </div>
        </div>
    );
}
