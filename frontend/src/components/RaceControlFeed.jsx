import React, { useState, useEffect, useRef } from 'react';
import { Flag, AlertTriangle, AlertCircle, Info, Filter } from 'lucide-react';
import axios from 'axios';
import { cn } from "../lib/utils";
import API_BASE from '../config/api';

export default function RaceControlFeed({ raceId }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All'); // All, Flag, SafetyCar, Penalty
    const scrollRef = useRef(null);

    // Fetch Messages
    useEffect(() => {
        if (!raceId) return;
        setLoading(true);
        axios.get(`${API_BASE}/api/race-control/${raceId}`)
            .then(res => {
                setMessages(res.data.messages || []);
            })
            .catch(err => console.error("Error fetching race control:", err))
            .finally(() => setLoading(false));
    }, [raceId]);

    // Auto-scroll to bottom on load
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const filteredMessages = messages.filter(m => {
        if (filter === 'All') return true;
        if (filter === 'Flag') return m.category === 'Flag';
        if (filter === 'SafetyCar') return m.category === 'SafetyCar';
        if (filter === 'Penalty') return m.category === 'Penalty';
        return true;
    });

    const getIcon = (category) => {
        switch (category) {
            case 'Flag': return <Flag size={14} className="text-yellow-400" />;
            case 'SafetyCar': return <AlertTriangle size={14} className="text-orange-400" />;
            case 'Penalty': return <AlertCircle size={14} className="text-red-400" />;
            default: return <Info size={14} className="text-gray-400" />;
        }
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full bg-[#0B0B0F] border border-[#2A2A30] rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-[#2A2A30] flex justify-between items-center bg-[#15151E]">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    RACE CONTROL MESSAGES
                </h3>

                <div className="flex gap-1">
                    {['All', 'Flag', 'SafetyCar', 'Penalty'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors",
                                filter === f ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            {f === 'SafetyCar' ? 'SC' : f}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar"
            >
                {loading ? (
                    <div className="text-center p-8 text-gray-500 text-xs animate-pulse">Loading Feed...</div>
                ) : filteredMessages.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 text-xs">No messages found.</div>
                ) : (
                    filteredMessages.map((msg, i) => (
                        <div key={i} className="flex gap-3 items-start p-2 rounded hover:bg-white/5 transition-colors group">
                            <div className="w-16 shrink-0 text-[10px] font-mono text-gray-500 pt-0.5">
                                {msg.time}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    {getIcon(msg.category)}
                                    <span className={cn(
                                        "text-xs font-bold uppercase",
                                        msg.category === 'Penalty' ? "text-red-400" :
                                            msg.category === 'SafetyCar' ? "text-orange-400" :
                                                msg.category === 'Flag' ? "text-yellow-400" : "text-gray-300"
                                    )}>
                                        {msg.category === 'SafetyCar' ? 'Safety Car' : msg.category}
                                    </span>
                                    {msg.lap && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A2A30] text-gray-400">
                                            LAP {msg.lap}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-300 font-medium leading-relaxed">
                                    {msg.message}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
