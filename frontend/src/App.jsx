import React, { useState, useEffect } from 'react';
import { Flag, Trophy, Calendar, ChevronRight, Activity, Zap, Timer, MapPin, BarChart, Brain } from 'lucide-react';
import axios from 'axios';
import { cn } from './lib/utils';
import RaceReplay from './components/RaceReplay';
import TelemetryAnalysis from './components/TelemetryAnalysis';
import Standings from './pages/Standings';
import Simulations from './pages/Simulations';
import Predictions from './pages/Predictions';
import History from './pages/History';

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

function DashboardView({ data }) {
  const winnerColor = getTeamColor(data.winnerTeam);
  const winnerGradient = `linear-gradient(135deg, ${winnerColor}20 0%, transparent 100%)`;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
        {/* Background Decor */}
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-f1-red/10 to-transparent blur-[100px] pointer-events-none"
          style={{ '--tw-gradient-from': `${winnerColor}20` }}
        />
      </header>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox
          label="Fastest Lap"
          value={data.fastestLap?.time || "N/A"}
          sub={data.fastestLap?.driver || "N/A"}
          icon={<Timer />}
          color="purple"
        />
        <StatBox
          label="Dominance"
          value="2.6s"
          sub="Gap to P2"
          icon={<Activity />}
          color="red"
        />
        <StatBox
          label="Conditions"
          value="Dry/Hot"
          sub="Track Temp 42°C"
          icon={<Zap />}
          color="yellow"
        />
        <StatBox
          label="Safety Cars"
          value="0"
          sub="Clean Race"
          icon={<Flag />}
          color="green"
        />
      </div>

      {/* Results Table */}
      <div className="bg-[#15151E] rounded-3xl border border-[#2A2A30] overflow-hidden">
        <div className="p-6 border-b border-[#2A2A30] flex justify-between items-center">
          <h3 className="text-xl font-bold tracking-wide">Race Classification</h3>
          <button className="text-sm font-medium text-gray-500 hover:text-white transition-colors">View Full Standings</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#1F1F27] text-gray-400 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Pos</th>
                <th className="px-6 py-4">Driver</th>
                <th className="px-6 py-4">Time/Gap</th>
                <th className="px-6 py-4 text-right">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A30]">
              {(data.results['R'] || []).map((row) => {
                const teamColor = getTeamColor(row.team);
                return (
                  <tr key={row.pos} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 font-heading font-bold text-xl text-gray-500 group-hover:text-white transition-colors">
                      {row.pos}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: teamColor }}></div>
                        <div>
                          <div className="font-bold text-lg leading-tight">{row.driver}</div>
                          <div className="text-xs text-gray-500 uppercase font-medium">{row.team}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-400 group-hover:text-white">{row.time}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block min-w-[30px] text-center font-bold bg-[#2A2A30] py-1 px-2 rounded text-sm group-hover:bg-white group-hover:text-black transition-colors">
                        {row.pts}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
