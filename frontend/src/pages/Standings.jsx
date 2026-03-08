import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, TrendingUp, AlertTriangle, CheckCircle, Flag } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

import { PixelCard } from '../components/PixelUI';
import DriverSprite from '../components/DriverSprite';
import API_BASE from '../config/api';

function getTeamId(teamName) {
    if (!teamName) return 'red_bull';
    const lower = teamName.toLowerCase();
    if (lower.includes('red bull')) return 'red_bull';
    if (lower.includes('ferrari')) return 'ferrari';
    if (lower.includes('mclaren')) return 'mclaren';
    if (lower.includes('mercedes')) return 'mercedes';
    if (lower.includes('aston')) return 'aston_martin';
    if (lower.includes('alpine')) return 'alpine';
    if (lower.includes('williams')) return 'williams';
    if (lower.includes('haas')) return 'haas';
    if (lower.includes('audi') || lower.includes('sauber')) return 'audi';
    if (lower.includes('rb') || lower.includes('racing bulls') || lower.includes('alpha')) return 'racing_bulls';
    if (lower.includes('cadillac')) return 'cadillac';
    return 'red_bull';
}

export default function Standings() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(2026);
    const [mobileTab, setMobileTab] = useState('drivers'); // 'drivers' or 'constructors'
    const availableYears = [2026, 2025, 2024];

    useEffect(() => {
        const fetchStandings = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${API_BASE}/api/standings?year=${year}`);
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
        <div className="flex flex-col flex-1 overflow-hidden text-black">

            {/* ===== LAYOUT ===== */}
            <div className="flex flex-col flex-1 p-3 space-y-2 overflow-hidden overflow-x-hidden">

                {/* Header - Mobile-friendly */}
                <div className="border-b-2 border-black pb-2 shrink-0">
                    {/* Row 1: Title + Year */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <h1 className="text-xl md:text-4xl font-heading text-black uppercase leading-none">Standings</h1>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="bg-white border-2 border-black text-black font-body text-sm md:text-lg px-2 py-1 outline-none cursor-pointer"
                        >
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    {/* Row 2: Progress */}
                    <div className="flex items-center gap-2">
                        <div className="h-2 md:h-3 flex-1 max-w-[150px] md:max-w-[200px] border-2 border-black bg-white">
                            <div className="h-full bg-f1-red" style={{ width: `${(completedRounds / totalRounds) * 100}%` }} />
                        </div>
                        <span className="text-[10px] md:text-sm font-bold opacity-60">{completedRounds}/{totalRounds} ROUNDS</span>
                    </div>
                </div>

                {/* Mobile Tabs */}
                <div className="md:hidden flex border-2 border-black bg-white shrink-0">
                    <button
                        onClick={() => setMobileTab('drivers')}
                        className={cn(
                            "flex-1 py-2 text-sm font-heading uppercase tracking-wider transition-colors",
                            mobileTab === 'drivers' ? "bg-f1-red text-white" : "bg-white text-black"
                        )}
                    >
                        Drivers
                    </button>
                    <button
                        onClick={() => setMobileTab('constructors')}
                        className={cn(
                            "flex-1 py-2 text-sm font-heading uppercase tracking-wider transition-colors border-l-2 border-black",
                            mobileTab === 'constructors' ? "bg-f1-red text-white" : "bg-white text-black"
                        )}
                    >
                        Constructors
                    </button>
                </div>

                {/* Tables Grid */}
                <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0 overflow-hidden">

                    {/* Driver Table - show on desktop always, on mobile only when tab is 'drivers' */}
                    <div className={cn("flex-1 flex flex-col overflow-hidden", mobileTab !== 'drivers' && "hidden md:flex")}>
                        <PixelCard title="Driver Championship" className="h-full flex flex-col p-0 overflow-hidden">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-f1-light border-b-4 border-black z-10">
                                        <tr className="text-xs md:text-lg font-heading text-black uppercase">
                                            <th className="p-1 md:p-3 w-8 md:w-16">#</th>
                                            <th className="p-1 md:p-3">Driver</th>
                                            <th className="p-1 md:p-3 text-right">Pts</th>
                                            <th className="p-1 md:p-3 text-right hidden sm:table-cell">Gap</th>
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
                                                        "transition-all duration-200 border-l-4 group h-16",
                                                        eliminated && "opacity-50 grayscale",
                                                        isPodium ? "hover:shadow-[inset_0_0_30px_rgba(255,0,0,0.1)]" : "hover:bg-yellow-50"
                                                    )}
                                                    style={{
                                                        borderLeftColor: teamColor,
                                                        backgroundColor: isPodium ? `${teamColor}08` : undefined
                                                    }}
                                                >
                                                    <td className="p-1 md:p-3 text-sm md:text-xl font-heading">
                                                        <span className={cn(
                                                            isPodium && "text-f1-red",
                                                            i === 0 && "text-base md:text-2xl"
                                                        )}>
                                                            {i + 1}
                                                        </span>
                                                    </td>
                                                    <td className="p-1 md:p-3">
                                                        <div className="flex items-center gap-1 md:gap-3">
                                                            {/* Driver Sprite - Smaller on mobile */}
                                                            <div className="relative w-10 h-10 md:w-16 md:h-16 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                                <DriverSprite
                                                                    driver={d.code}
                                                                    size="xl"
                                                                    className="transform scale-[2] md:scale-[3] origin-center relative z-10 translate-y-3 md:translate-y-6"
                                                                    style={{ imageRendering: 'pixelated' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <div className={cn(
                                                                    "text-sm md:text-xl font-heading leading-tight",
                                                                    i === 0 && "text-base md:text-2xl"
                                                                )}>{d.name}</div>
                                                                <div className="text-[10px] md:text-sm font-body uppercase text-gray-600 truncate max-w-[80px] md:max-w-none">{d.team}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-1 md:p-3 text-right text-base md:text-xl font-heading">
                                                        <span className={cn(i === 0 && "text-lg md:text-2xl font-black")}>
                                                            {d.points}
                                                        </span>
                                                    </td>
                                                    <td className="p-1 md:p-3 text-right text-xs md:text-lg font-mono hidden sm:table-cell">
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

                    {/* Constructor Table - show on desktop always, on mobile only when tab is 'constructors' */}
                    <div className={cn("flex-1 flex flex-col overflow-hidden", mobileTab !== 'constructors' && "hidden md:flex")}>
                        <PixelCard title="Constructors" className="h-full flex flex-col p-0 overflow-hidden">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-f1-light border-b-4 border-black z-10">
                                        <tr className="text-xs md:text-lg font-heading text-black uppercase">
                                            <th className="p-1 md:p-3 w-8 md:w-16">#</th>
                                            <th className="p-1 md:p-3">Team</th>
                                            <th className="p-1 md:p-3 text-right">Pts</th>
                                            <th className="p-1 md:p-3 text-right hidden sm:table-cell">Wins</th>
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
                                                        "transition-all duration-200 border-l-4 group h-12 md:h-16",
                                                        isPodium ? "hover:shadow-[inset_0_0_30px_rgba(255,0,0,0.1)]" : "hover:bg-yellow-50"
                                                    )}
                                                    style={{
                                                        borderLeftColor: teamColor,
                                                        backgroundColor: isPodium ? `${teamColor}08` : undefined
                                                    }}
                                                >
                                                    <td className="p-1 md:p-3 text-sm md:text-xl font-heading">
                                                        <span className={cn(
                                                            isPodium && "text-f1-red",
                                                            i === 0 && "text-base md:text-2xl"
                                                        )}>
                                                            {i + 1}
                                                        </span>
                                                    </td>
                                                    <td className="p-1 md:p-3">
                                                        <div className="flex items-center gap-1 md:gap-3">
                                                            {/* Team Sprite - Smaller on mobile */}
                                                            <div className="relative w-10 h-10 md:w-16 md:h-16 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                                <DriverSprite
                                                                    teamId={getTeamId(c.name)}
                                                                    size="xl"
                                                                    className="transform scale-[2] md:scale-[3] origin-center relative z-10 translate-y-3 md:translate-y-6"
                                                                    style={{ imageRendering: 'pixelated' }}
                                                                />
                                                            </div>
                                                            <span className={cn(
                                                                "text-sm md:text-xl font-heading truncate max-w-[100px] md:max-w-none",
                                                                i === 0 && "text-base md:text-2xl"
                                                            )}>{c.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-1 md:p-3 text-right text-base md:text-xl font-heading">
                                                        <span className={cn(i === 0 && "text-lg md:text-2xl font-black")}>
                                                            {c.points}
                                                        </span>
                                                    </td>
                                                    <td className="p-1 md:p-3 text-right text-xs md:text-lg font-mono hidden sm:table-cell">{c.wins}</td>
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
