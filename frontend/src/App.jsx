import React, { useState, useEffect } from 'react';
import { Flag, Trophy, Calendar, ChevronRight, ChevronUp, ChevronDown, Activity, Zap, Timer, MapPin, BarChart, Brain } from 'lucide-react';
import axios from 'axios';
import { cn } from './lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import RaceReplay from './components/RaceReplay';
import TelemetryAnalysis from './components/TelemetryAnalysis';
import Standings from './pages/Standings';
import Simulations from './pages/Simulations';
import Predictions from './pages/Predictions';
import History from './pages/History';
import RaceControlFeed from './components/RaceControlFeed';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [raceData, setRaceData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch real data
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/latest-results');
        setRaceData(response.data);
      } catch (error) {
        console.error("Using fallback data due to API error:", error);
        // Fallback data for design preview
        setRaceData({
          raceName: "Italian Grand Prix",
          circuit: "Monza",
          date: "01 Sep 2024",
          winner: "Charles Leclerc",
          winnerTeam: "Ferrari",
          fastestLap: { driver: "Lando Norris", time: "1:21.046" },
          results: [
            { pos: 1, driver: "Charles Leclerc", team: "Ferrari", time: "1:14:40.727", pts: 25 },
            { pos: 2, driver: "Oscar Piastri", team: "McLaren", time: "+2.664s", pts: 18 },
            { pos: 3, driver: "Lando Norris", team: "McLaren", time: "+6.153s", pts: 16 },
            { pos: 4, driver: "Carlos Sainz", team: "Ferrari", time: "+15.621s", pts: 12 },
            { pos: 5, driver: "Lewis Hamilton", team: "Mercedes", time: "+22.820s", pts: 10 },
          ]
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white flex font-body selection:bg-f1-red selection:text-white">
      {/* Sidebar - Sleek & Minimal */}
      <aside className="fixed left-0 top-0 h-full w-20 lg:w-64 bg-[#121216] border-r border-[#2A2A30] flex flex-col z-50 transition-all duration-300">
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-[#2A2A30]">
          <div className="w-8 h-8 bg-gradient-to-tr from-f1-red to-red-600 rounded-lg flex items-center justify-center font-bold italic tracking-tighter shadow-[0_0_15px_rgba(225,6,0,0.4)]">F1</div>
          <span className="hidden lg:block ml-3 font-heading text-xl font-bold tracking-widest text-white">INSIGHT</span>
        </div>

        <nav className="flex-1 py-8 px-2 lg:px-4 space-y-2">
          <NavItem icon={<Activity />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Timer />} label="Race Replay" active={activeTab === 'replay'} onClick={() => setActiveTab('replay')} />
          <NavItem icon={<BarChart />} label="Analysis" active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} />
          <NavItem icon={<Trophy />} label="Standings" active={activeTab === 'standings'} onClick={() => setActiveTab('standings')} />
          <NavItem icon={<Brain />} label="Simulations" active={activeTab === 'simulations'} onClick={() => setActiveTab('simulations')} />
          <NavItem icon={<Calendar />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <NavItem icon={<Zap />} label="Predictions" active={activeTab === 'predictions'} onClick={() => setActiveTab('predictions')} />
        </nav>

        <div className="p-4 border-t border-[#2A2A30] hidden lg:block">
          <div className="bg-[#1A1A20] rounded-xl p-4 border border-[#2A2A30]">
            <div className="text-xs text-gray-500 font-medium mb-2">NEXT RACE</div>
            <div className="font-bold text-sm">Azerbaijan GP</div>
            <div className="text-xs text-f1-red mt-1 font-bold">In 2 Weeks</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 lg:ml-64 p-8 lg:p-12 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex h-[50vh] items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-f1-red border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <DashboardView data={raceData} />}
              {activeTab === 'replay' && <RaceReplay raceId={raceData?.raceId} />}
              {activeTab === 'analysis' && <TelemetryAnalysis raceId={raceData?.raceId} />}
              {activeTab === 'standings' && <Standings />}
              {activeTab === 'simulations' && <Simulations />}
              {activeTab === 'history' && <History />}
              {activeTab === 'predictions' && <Predictions />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-xl transition-all duration-300 group relative",
        active
          ? "bg-gradient-to-r from-f1-red/10 to-transparent text-f1-red"
          : "text-gray-500 hover:text-white hover:bg-white/5"
      )}
    >
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-f1-red rounded-r-full" />}
      {React.cloneElement(icon, { size: 20, className: active ? "text-f1-red" : "text-gray-500 group-hover:text-white transition-colors" })}
      <span className="hidden lg:block font-medium tracking-wide text-sm">{label}</span>
    </button>
  )
}

// Helper to get font size based on name length
function getFontSize(name) {
  if (!name) return 'text-xl';
  return name.length > 3 ? 'text-lg' : 'text-xl';
}

function DashboardView({ data }) {
  const winnerColor = getTeamColor(data.winnerTeam);

  // Fetch standings for WDC chart + Constructors
  const [standingsData, setStandingsData] = React.useState(null);
  React.useEffect(() => {
    axios.get('http://localhost:5000/api/standings?year=2025')
      .then(res => { if (!res.data.error) setStandingsData(res.data); })
      .catch(e => console.error("Standings fetch error", e));
  }, []);

  // Extract Podium (P1, P2, P3) from results
  const raceResults = data.results?.['R'] || [];
  const podium = raceResults.slice(0, 3);

  return (
    <div className="space-y-10">
      {/* Header / Hero */}
      <header className="relative overflow-hidden rounded-3xl bg-[#15151E] border border-[#2A2A30] p-8 lg:p-12">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full bg-white/5 text-xs font-bold uppercase tracking-wider text-gray-400 border border-white/10 flex items-center gap-2">
                <Flag size={12} /> Finished
              </span>
              <span className="text-gray-500 text-sm font-medium">{data.date}</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-black italic tracking-tighter uppercase mb-2">
              {data.raceName}
            </h1>
            <div className="flex items-center gap-2 text-gray-400 font-medium text-lg">
              <MapPin size={18} className="text-f1-red" />
              {data.circuit}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-right">
              <div className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Winner</div>
              <div className="text-3xl lg:text-4xl font-bold text-white mb-1">{data.winner}</div>
              <div
                className="text-sm font-bold uppercase tracking-wider inline-block px-3 py-1 rounded-lg"
                style={{ backgroundColor: `${winnerColor}20`, color: winnerColor }}
              >
                {data.winnerTeam}
              </div>
            </div>
          </div>
        </div>
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-f1-red/10 to-transparent blur-[100px] pointer-events-none"
          style={{ '--tw-gradient-from': `${winnerColor}20` }}
        />
      </header>

      {/* Row 2: Podium + WDC Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Podium Visual - MINIMALIST REDESIGN */}
        <div className="lg:col-span-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] p-6 flex flex-col">
          <h3 className="text-sm font-bold uppercase text-gray-400 mb-6 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" /> Podium
          </h3>
          <div className="flex items-end justify-center h-full pb-4 gap-2">
            {/* P2 */}
            {podium[1] && (
              <div className="flex flex-col items-center w-1/3">
                <div className="mb-2 text-center">
                  <div className="text-xl font-bold text-white">{podium[1].code}</div>
                  <div className="text-[10px] text-gray-400 uppercase truncate max-w-[80px]">{podium[1].team}</div>
                </div>
                <div
                  className="w-full h-32 rounded-t-lg relative"
                  style={{ backgroundColor: `${getTeamColor(podium[1].team)}` }}
                >
                  <div className="absolute top-2 w-full text-center text-4xl font-black text-white/25">2</div>
                </div>
              </div>
            )}
            {/* P1 */}
            {podium[0] && (
              <div className="flex flex-col items-center w-5/12">
                <div className="mb-2 text-center">
                  <div className="text-2xl font-black text-white">{podium[0].code}</div>
                  <div className="text-[10px] text-gray-400 uppercase truncate max-w-[100px]">{podium[0].team}</div>
                </div>
                <div
                  className="w-full h-40 rounded-t-lg relative shadow-[0_0_50px_rgba(0,0,0,0.5)] z-10"
                  style={{ backgroundColor: `${getTeamColor(podium[0].team)}` }}
                >
                  <Trophy size={24} className="absolute top-3 left-1/2 -translate-x-1/2 text-white/30" />
                  {/* Centered Number */}
                  <div className="absolute inset-0 flex items-center justify-center text-6xl font-black text-white/25">1</div>
                </div>
              </div>
            )}
            {/* P3 */}
            {podium[2] && (
              <div className="flex flex-col items-center w-1/3">
                <div className="mb-2 text-center">
                  <div className="text-xl font-bold text-white">{podium[2].code}</div>
                  <div className="text-[10px] text-gray-400 uppercase truncate max-w-[80px]">{podium[2].team}</div>
                </div>
                <div
                  className="w-full h-24 rounded-t-lg relative"
                  style={{ backgroundColor: `${getTeamColor(podium[2].team)}` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-5xl font-black text-white/25">3</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* WDC Fight Chart */}
        {standingsData && (
          <div className="lg:col-span-2 bg-[#15151E] rounded-3xl border border-[#2A2A30] p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold uppercase text-white flex items-center gap-2">
                <Trophy size={18} className="text-yellow-500" /> WDC Fight
              </h3>
              <div className="flex gap-2 text-[10px] font-bold flex-wrap justify-end">
                {/* ... existing avatars ... */}
                {standingsData.drivers.slice(0, 4).map((d) => {
                  const color = getTeamColor(d.team);
                  return (
                    <div key={d.code} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-gray-400">{d.code}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={standingsData.races.map((r, i) => ({
                  name: r.substring(0, 3).toUpperCase(),
                  fullRace: r,
                  ...standingsData.drivers.slice(0, 4).reduce((acc, d) => ({ ...acc, [d.code]: d.history[i] || 0 }), {})
                }))}>
                  {/* ... chart config ... */}
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A30" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} dy={5} />
                  <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const sorted = [...payload].sort((a, b) => b.value - a.value);
                        const fullRaceName = payload[0].payload.fullRace;
                        return (
                          <div className="bg-[#15151E] border border-[#2A2A30] rounded-lg p-3 shadow-xl z-50">
                            <div className="text-[10px] text-gray-400 mb-2 font-bold uppercase border-b border-[#2A2A30] pb-1">
                              {fullRaceName || label}
                            </div>
                            {sorted.map((p) => (
                              <div key={p.name} className="flex items-center justify-between gap-4 text-xs font-bold mb-1 last:mb-0">
                                <span style={{ color: p.stroke }}>{p.name}</span>
                                <span className="text-white">{p.value} pts</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {standingsData.drivers.slice(0, 4).map((d) => {
                    const color = getTeamColor(d.team);
                    return (
                      <Line
                        key={d.code} type="monotone" dataKey={d.code}
                        stroke={color} strokeWidth={3} dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Row 3: Race Control + Constructors + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Race Control Feed */}
        <div className="lg:col-span-1 h-[400px]">
          <RaceControlFeed raceId={data.raceId || 72} />
        </div>

        {/* Constructor Standings Widget - FIXED NAMES (USE .name NOT .team) */}
        {standingsData && standingsData.constructors && (
          <div className="lg:col-span-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] p-6 h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold uppercase text-gray-400 flex items-center gap-2">
                <BarChart size={16} className="text-blue-400" /> Constructor Standings
              </h3>
              <button
                onClick={() => setActiveTab('standings')}
                className="text-[10px] font-bold text-blue-400 hover:text-white transition-colors uppercase bg-blue-500/10 px-2 py-1 rounded-md"
              >
                View Full
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
              {standingsData.constructors.map((c, i) => {
                const maxPts = standingsData.constructors[0]?.points || 1;
                const pct = (c.points / maxPts) * 100;
                const teamName = c.name || c.team;
                const color = getTeamColor(teamName);
                const change = c.change || 0;

                return (
                  <div key={teamName} className="group relative z-10 w-full mb-3 last:mb-0">
                    <div className="flex justify-between text-xs mb-1 w-full items-center">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-bold text-white group-hover:text-white transition-colors truncate">{i + 1}. {teamName}</span>
                        {change !== 0 && (
                          <div className={`flex items-center gap-0.5 text-[10px] ${change > 0 ? "text-green-500" : "text-red-500"}`}>
                            {change > 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            <span>{Math.abs(change)}</span>
                          </div>
                        )}
                        {change === 0 && <span className="text-gray-600 text-[10px]">-</span>}
                      </div>
                      <span className="text-gray-400 font-mono group-hover:text-gray-300 whitespace-nowrap">{c.points} pts</span>
                    </div>
                    <div className="h-2 bg-[#2A2A30] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 relative"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      >
                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top 10 Classification */}
        <div className="lg:col-span-1 bg-[#15151E] rounded-3xl border border-[#2A2A30] overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-[#2A2A30] flex justify-between items-center bg-[#1F1F27]">
            <h3 className="text-sm font-bold uppercase tracking-wide">{data.raceName || "Race"} Top 10</h3>
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left">
              <tbody className="divide-y divide-[#2A2A30]">
                {raceResults.slice(0, 10).map((row) => {
                  const teamColor = getTeamColor(row.team);
                  return (
                    <tr key={row.pos} className="hover:bg-white/5 transition-colors group">
                      <td className="px-4 py-3 font-heading font-bold text-lg text-gray-500 group-hover:text-white transition-colors w-12">
                        {row.pos}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-6 rounded-full" style={{ backgroundColor: teamColor }}></div>
                          <div>
                            <div className="font-bold text-sm leading-tight">{row.code || row.driver?.split(' ').pop()}</div>
                            <div className="text-[10px] text-gray-500 uppercase">{row.team?.split(' ')[0]}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <span className="inline-block min-w-[24px] text-center font-bold bg-[#2A2A30] py-0.5 px-1.5 rounded text-xs">
                          {row.pts}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div >
    </div >
  )
}

function StatBox({ label, value, sub, icon, color }) {
  const colors = {
    purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    red: 'text-f1-red bg-f1-red/10 border-f1-red/20',
    yellow: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
    green: 'text-green-500 bg-green-500/10 border-green-500/20'
  }

  return (
    <div className="bg-[#1A1A22] p-5 rounded-2xl border border-[#2A2A30] hover:border-[#3F3F46] transition-all group">
      <div className="flex justify-between items-start mb-4">
        <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">{label}</span>
        <div className={cn("p-2 rounded-lg", colors[color])}>
          {React.cloneElement(icon, { size: 16 })}
        </div>
      </div>
      <div className="text-2xl font-bold font-heading mb-1">{value}</div>
      <div className="text-sm text-gray-500">{sub}</div>
    </div>
  )
}

function PlaceholderView({ title }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
      <div className="w-16 h-16 bg-[#1A1A22] rounded-full flex items-center justify-center text-gray-500 border border-[#2A2A30]">
        <Activity size={32} />
      </div>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-gray-500 max-w-sm">Use the navigation to explore F1 insights. This module is under development.</p>
    </div>
  )
}

// Helper to map team names to colors
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
