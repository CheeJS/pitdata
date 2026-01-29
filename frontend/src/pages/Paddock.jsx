import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, ArrowBigUp, ArrowBigDown, Plus, ChevronLeft, Send, Users, Activity, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import API_BASE from '../config/api';

export default function Paddock() {
    const [view, setView] = useState('feed'); // 'feed' | 'thread'
    const [threads, setThreads] = useState([]);
    const [activeThread, setActiveThread] = useState(null);
    const [loading, setLoading] = useState(false);

    // Create Thread State
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newCategory, setNewCategory] = useState('General');

    // Identity
    const [nickname, setNickname] = useState('');
    const [isNicknameSet, setIsNicknameSet] = useState(false);

    const getClientId = () => {
        let id = localStorage.getItem('f1_client_id');
        if (!id) {
            id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('f1_client_id', id);
        }
        return id;
    };
    const clientId = getClientId();

    useEffect(() => {
        const savedName = localStorage.getItem('f1_nickname');
        if (savedName) {
            setNickname(savedName);
            setIsNicknameSet(true);
        }
        fetchThreads();
    }, []);

    const fetchThreads = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/paddock/threads`);
            setThreads(res.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const fetchThreadDetail = async (id) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/paddock/threads/${id}?client_id=${clientId}`);
            setActiveThread(res.data);
            setView('thread');
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleVote = async (e, type, id, direction) => {
        e.stopPropagation();
        try {
            const res = await axios.post(`${API_BASE}/api/paddock/vote`, {
                client_id: clientId,
                item_type: type,
                item_id: id,
                direction
            });

            // Optimistic update (or refetch)
            if (type === 'thread') {
                if (view === 'feed') {
                    setThreads(prev => prev.map(t => t.id === id ? { ...t, score: res.data.new_score } : t));
                } else if (activeThread) {
                    setActiveThread(prev => ({ ...prev, score: res.data.new_score, user_vote: direction === activeThread.user_vote ? 0 : direction }));
                }
            } else {
                // Comment vote
                setActiveThread(prev => ({
                    ...prev,
                    comments: prev.comments.map(c => c.id === id ? { ...c, score: res.data.new_score } : c)
                }));
            }
        } catch (err) { console.error(err); }
    };

    const handleCreateThread = async () => {
        if (!newTitle.trim() || !newContent.trim()) return;
        try {
            await axios.post(`${API_BASE}/api/paddock/threads`, {
                client_id: clientId,
                nickname,
                title: newTitle,
                content: newContent,
                category: newCategory
            });
            setShowCreate(false);
            setNewTitle('');
            setNewContent('');
            fetchThreads();
        } catch (err) { console.error(err); }
    };

    const handlePostComment = async (content) => {
        try {
            await axios.post(`${API_BASE}/api/paddock/threads/${activeThread.id}/comments`, {
                client_id: clientId,
                nickname,
                content
            });
            fetchThreadDetail(activeThread.id); // Refresh to show new comment
        } catch (err) { console.error(err); }
    };

    // --- Sub-Components ---

    if (!isNicknameSet) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="bg-[#1A1A20] p-8 rounded-none border border-[#2A2A30] w-full max-w-md text-center">
                    <div className="w-16 h-16 bg-f1-red/10 rounded-none flex items-center justify-center text-f1-red mx-auto mb-4">
                        <Users size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Enter The Paddock</h2>
                    <p className="text-gray-400 mb-6">Set your radio name to join the discussion.</p>
                    <input
                        className="w-full bg-[#0B0B0F] border border-[#2A2A30] rounded-none p-3 text-white mb-4"
                        placeholder="Nickname..."
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                    />
                    <button
                        onClick={() => { localStorage.setItem('f1_nickname', nickname); setIsNicknameSet(true); }}
                        disabled={!nickname.trim()}
                        className="w-full bg-f1-red py-3 rounded-none font-bold text-white disabled:opacity-50"
                    >
                        Join Session
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto h-[calc(100vh-6rem)] flex flex-col bg-gray-200">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    {view === 'thread' && (
                        <button onClick={() => setView('feed')} className="p-2 hover:bg-white/10 rounded-none">
                            <ChevronLeft />
                        </button>
                    )}
                    <h1 className="text-4xl font-heading font-bold text-black italic tracking-wider">
                        {view === 'feed' ? 'THE PADDOCK' : 'DISCUSSION'}
                    </h1>
                </div>
                {view === 'feed' && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-f1-red hover:bg-red-600 text-white px-4 py-2 rounded-none font-bold flex items-center gap-2"
                    >
                        <Plus size={18} /> New Topic
                    </button>
                )}
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1A1A20] p-6 rounded-none w-full max-w-lg border border-[#333]">
                        <h2 className="text-xl font-bold text-white mb-4">Start a Discussion</h2>
                        <input
                            className="w-full bg-[#0B0B0F] border border-[#333] p-3 rounded-none text-white mb-3 font-bold"
                            placeholder="Title"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                        />
                        <textarea
                            className="w-full bg-[#0B0B0F] border border-[#333] p-3 rounded-none text-white mb-4 h-32"
                            placeholder="What's on your mind?"
                            value={newContent}
                            onChange={e => setNewContent(e.target.value)}
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white px-4 py-2">Cancel</button>
                            <button onClick={handleCreateThread} className="bg-f1-red text-white px-6 py-2 rounded-none font-bold">Post</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-800">
                {view === 'feed' ? (
                    <div className="space-y-3">
                        {threads.map(t => (
                            <div
                                key={t.id}
                                onClick={() => fetchThreadDetail(t.id)}
                                className="bg-[#1A1A20] hover:bg-[#222] border border-[#2A2A30] hover:border-f1-red/30 p-4 rounded-none cursor-pointer transition-all group flex gap-4"
                            >
                                {/* Vote Column */}
                                <div className="flex flex-col items-center gap-1 min-w-[30px]">
                                    <div className="text-xs font-bold text-gray-400">{t.score}</div>
                                </div>

                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-white group-hover:text-f1-red transition-colors mb-1">{t.title}</h3>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <span className="font-medium text-gray-400">{t.nickname}</span>
                                        <span>•</span>
                                        <span className="bg-white px-2 py-0.5 rounded text-gray-400">{t.category}</span>
                                        <span>•</span>
                                        <div className="flex items-center gap-1">
                                            <MessageCircle size={12} /> {t.comment_count} comments
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    activeThread && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Original Post */}
                            <div className="bg-[#1A1A20] border border-[#2A2A30] p-6 rounded-none relative overflow-hidden">
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center gap-2">
                                        <button onClick={(e) => handleVote(e, 'thread', activeThread.id, 1)} className={cn("p-1 rounded hover:bg-white/10", activeThread.user_vote === 1 ? "text-f1-red" : "text-gray-500")}><ArrowBigUp /></button>
                                        <span className={cn("font-bold", activeThread.user_vote === 1 ? "text-f1-red" : activeThread.user_vote === -1 ? "text-blue-500" : "text-white")}>{activeThread.score}</span>
                                        <button onClick={(e) => handleVote(e, 'thread', activeThread.id, -1)} className={cn("p-1 rounded hover:bg-white/10", activeThread.user_vote === -1 ? "text-blue-500" : "text-gray-500")}><ArrowBigDown /></button>
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold text-white mb-2">{activeThread.title}</h2>
                                        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed border-l-2 border-[#333] pl-4">{activeThread.content}</p>
                                        <div className="mt-4 pt-4 border-t border-[#333] text-xs text-gray-500 flex justify-between">
                                            <span>Posted by <span className="text-white font-bold">{activeThread.nickname}</span></span>
                                            <span>{new Date(activeThread.timestamp).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Comments Section */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Pit Lane ({activeThread.comments.length})</h3>

                                {/* Comment Input */}
                                <CommentComposer onSubmit={handlePostComment} />

                                <div className="space-y-4 mt-6">
                                    {activeThread.comments.length === 0 && <div className="text-gray-600 text-center italic">No radio chatter yet.</div>}
                                    {activeThread.comments.map(c => (
                                        <div key={c.id} className="bg-white p-4 rounded-none border border-black">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-sm font-bold text-f1-red">{c.nickname}</span>
                                                <span className="text-[10px] text-gray-600">{new Date(c.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                            <p className="text-gray-300 text-sm">{c.content}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

function CommentComposer({ onSubmit }) {
    const [text, setText] = useState('');
    return (
        <div className="bg-[#1A1A20] p-4 rounded-none border border-[#2A2A30] flex gap-3">
            <textarea
                className="flex-1 bg-transparent text-white resize-none h-10 min-h-[40px] pt-2"
                placeholder="Reply to this thread..."
                value={text}
                onChange={e => setText(e.target.value)}
            />
            <button
                onClick={() => { if (text.trim()) { onSubmit(text); setText(''); } }}
                disabled={!text.trim()}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-none transition-colors disabled:opacity-50"
            >
                <Send size={18} />
            </button>
        </div>
    )
}
