import React, { useState, useEffect } from 'react';
import { Flag, Trophy, Calendar, ChevronRight, ChevronUp, ChevronDown, Activity, Zap, Timer, MapPin, BarChart, Brain, Menu, X } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Close mobile menu when tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-white flex flex-col md:flex-row font-body selection:bg-f1-red selection:text-white">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#121216] border-b border-[#2A2A30] flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-f1-red to-red-600 rounded-lg flex items-center justify-center font-bold italic tracking-tighter shadow-[0_0_15px_rgba(225,6,0,0.4)]">F1</div>
          <span className="font-heading text-lg font-bold tracking-widest text-white">INSIGHT</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-out Menu */}
      <aside className={cn(
        "md:hidden fixed top-14 right-0 h-[calc(100%-3.5rem)] w-64 bg-[#121216] border-l border-[#2A2A30] z-50 transition-transform duration-300 ease-in-out",
        mobileMenuOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <nav className="py-6 px-4 space-y-2">
          <MobileNavItem icon={<Activity />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
          <MobileNavItem icon={<Timer />} label="Race Replay" active={activeTab === 'replay'} onClick={() => handleTabChange('replay')} />
          <MobileNavItem icon={<BarChart />} label="Analysis" active={activeTab === 'analysis'} onClick={() => handleTabChange('analysis')} />
          <MobileNavItem icon={<Trophy />} label="Standings" active={activeTab === 'standings'} onClick={() => handleTabChange('standings')} />
          <MobileNavItem icon={<Brain />} label="Simulations" active={activeTab === 'simulations'} onClick={() => handleTabChange('simulations')} />
          <MobileNavItem icon={<Calendar />} label="History" active={activeTab === 'history'} onClick={() => handleTabChange('history')} />
          <MobileNavItem icon={<Zap />} label="Predictions" active={activeTab === 'predictions'} onClick={() => handleTabChange('predictions')} />
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-[#1A1A20] rounded-xl p-4 border border-[#2A2A30]">
            <div className="text-xs text-gray-500 font-medium mb-2">NEXT RACE</div>
            <div className="font-bold text-sm">Azerbaijan GP</div>
            <div className="text-xs text-f1-red mt-1 font-bold">In 2 Weeks</div>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-20 lg:w-64 bg-[#121216] border-r border-[#2A2A30] flex-col z-50 transition-all duration-300">
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
      <main className="flex-1 pt-14 pb-16 md:pb-0 md:pt-0 md:ml-20 lg:ml-64 p-4 md:p-8 lg:p-12 overflow-y-auto">
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

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#111] border-t border-[#222] flex items-center justify-around px-2 z-50">
        <BottomNavItem icon={<Activity size={20} />} label="Home" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
        <BottomNavItem icon={<Trophy size={20} />} label="Standings" active={activeTab === 'standings'} onClick={() => handleTabChange('standings')} />
        <BottomNavItem icon={<Brain size={20} />} label="Simulate" active={activeTab === 'simulations'} onClick={() => handleTabChange('simulations')} />
        <BottomNavItem icon={<Calendar size={20} />} label="History" active={activeTab === 'history'} onClick={() => handleTabChange('history')} />
      </nav>
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

function MobileNavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative",
        active
          ? "bg-gradient-to-r from-f1-red/20 to-transparent text-f1-red"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      )}
    >
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-f1-red rounded-r-full" />}
      {React.cloneElement(icon, { size: 20, className: active ? "text-f1-red" : "text-gray-400" })}
      <span className="font-medium tracking-wide text-sm">{label}</span>
    </button>
  )
}

function BottomNavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-lg transition-colors",
        active ? "text-white" : "text-gray-500"
      )}
    >
      {React.cloneElement(icon, { className: active ? "text-f1-red" : "text-gray-500" })}
      <span className="text-[10px] font-medium">{label}</span>
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
    <div className="space-y-4 md:space-y-8">

      {/* ===== MOBILE LAYOUT (shown below md) ===== */}
      <div className="md:hidden space-y-4">

        {/* Latest Race Card - Clean & Simple */}
        <section className="bg-[#111] border border-[#222] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Latest Race</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-500 font-medium">Finished</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-1">{data.raceName}</h2>
          <p className="text-sm text-gray-400 mb-3">{data.circuit} • {data.date}</p>
          <div className="flex items-center gap-3 pt-3 border-t border-[#222]">
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: winnerColor }} />
            <div>
              <div className="text-xs text-gray-500 uppercase">Winner</div>
              <div className="text-sm font-bold text-white">{data.winner}</div>
            </div>
          </div>
        </section>

        {/* Podium - Minimal Horizontal */}
        <section className="bg-[#111] border border-[#222] rounded-xl p-4">
          <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-4">Podium</h3>
          <div className="flex items-end justify-center gap-2 h-28">
            {/* P2 */}
            {podium[1] && (
              <div className="flex-1 flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{podium[1].code}</span>
                <div className="w-full h-16 rounded-t-lg flex items-center justify-center"
                  style={{ backgroundColor: getTeamColor(podium[1].team) }}>
                  <span className="text-2xl font-black text-white/30">2</span>
                </div>
              </div>
            )}
            {/* P1 */}
            {podium[0] && (
              <div className="flex-1 flex flex-col items-center">
                <span className="text-sm font-bold text-white mb-1">{podium[0].code}</span>
                <div className="w-full h-24 rounded-t-lg flex items-center justify-center"
                  style={{ backgroundColor: getTeamColor(podium[0].team) }}>
                  <span className="text-3xl font-black text-white/30">1</span>
                </div>
              </div>
            )}
            {/* P3 */}
            {podium[2] && (
              <div className="flex-1 flex flex-col items-center">
                <span className="text-xs font-bold text-white mb-1">{podium[2].code}</span>
                <div className="w-full h-12 rounded-t-lg flex items-center justify-center"
                  style={{ backgroundColor: getTeamColor(podium[2].team) }}>
                  <span className="text-xl font-black text-white/30">3</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Championship Standings - Clean List */}
        {standingsData && (
          <section className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Championship</h3>
              <span className="text-[10px] text-gray-600">{standingsData.drivers?.length || 0} drivers</span>
            </div>
            <div className="space-y-0 divide-y divide-[#1a1a1a]">
              {standingsData.drivers?.slice(0, 5).map((driver, i) => (
                <div key={driver.code} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-500 w-5">{i + 1}</span>
                    <div className="w-0.5 h-4 rounded-full" style={{ backgroundColor: getTeamColor(driver.team) }} />
                    <span className="text-sm font-medium text-white">{driver.name}</span>
                  </div>
                  <span className="text-sm text-gray-400 font-mono">{driver.points} pts</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Constructor Standings - Clean List */}
        {standingsData?.constructors && (
          <section className="bg-[#111] border border-[#222] rounded-xl p-4">
            <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-4">Constructors</h3>
            <div className="space-y-0 divide-y divide-[#1a1a1a]">
              {standingsData.constructors.slice(0, 5).map((c, i) => {
                const teamName = c.name || c.team;
                return (
                  <div key={teamName} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-500 w-5">{i + 1}</span>
                      <div className="w-0.5 h-4 rounded-full" style={{ backgroundColor: getTeamColor(teamName) }} />
                      <span className="text-sm font-medium text-white">{teamName}</span>
                    </div>
                    <span className="text-sm text-gray-400 font-mono">{c.points} pts</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Race Results - Simple Table */}
        <section className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#222]">
            <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Race Results</h3>
          </div>
          <div className="divide-y divide-[#1a1a1a]">
            {raceResults.slice(0, 10).map((row) => (
              <div key={row.pos} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-500 w-5">{row.pos}</span>
                  <div className="w-0.5 h-4 rounded-full" style={{ backgroundColor: getTeamColor(row.team) }} />
                  <div>
                    <span className="text-sm font-medium text-white">{row.code}</span>
                    <span className="text-xs text-gray-600 ml-2">{row.team?.split(' ')[0]}</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-400 bg-[#1a1a1a] px-2 py-0.5 rounded">{row.pts} pts</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ===== DESKTOP LAYOUT (shown at md+) ===== */}
      <div className="hidden md:block space-y-8">

        {/* Header / Hero - Desktop */}
        <header className="relative overflow-hidden rounded-2xl bg-[#09090B] border border-[#222] min-h-[280px] p-10 group flex flex-col justify-end">
          {/* Background Flag - Full Cover with Gradient */}
          <div className="absolute inset-0 z-0">
            {(() => {
              const flagCodes = {
                'Australian': 'au', 'Bahrain': 'bh', 'Saudi Arabian': 'sa', 'Japanese': 'jp',
                'Chinese': 'cn', 'Miami': 'us', 'Emilia Romagna': 'it', 'Monaco': 'mc',
                'Canadian': 'ca', 'Spanish': 'es', 'Austrian': 'at', 'British': 'gb',
                'Hungarian': 'hu', 'Belgian': 'be', 'Dutch': 'nl', 'Italian': 'it',
                'Azerbaijan': 'az', 'Singapore': 'sg', 'United States': 'us', 'Mexico': 'mx',
                'Brazilian': 'br', 'Las Vegas': 'us', 'Qatar': 'qa', 'Abu Dhabi': 'ae'
              };
              // Extract country name from "Australian Grand Prix" -> "Australian"
              const country = data.raceName?.replace(' Grand Prix', '') || 'Australian';
              const code = flagCodes[country] || 'un';

              return (
                <>
                  <img
                    src={`https://flagcdn.com/w1280/${code}.png`}
                    alt=""
                    className="w-full h-full object-cover opacity-20 transition-opacity duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/80 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/60 to-transparent" />
                </>
              );
            })()}
          </div>

          {/* Accent Line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-transparent z-20" />

          <div className="relative z-10 flex justify-between items-end gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-full bg-green-500/10 text-xs font-bold text-green-500 border border-green-500/20 uppercase tracking-wider">
                  Finished
                </span>
                <span className="text-gray-400 text-sm font-medium tracking-wide border-l border-gray-700 pl-3">
                  {data.date}
                </span>
              </div>

              <div className="flex flex-col gap-1 mb-2">
                <h1 className="text-5xl lg:text-7xl font-black text-white italic uppercase tracking-tighter leading-[0.9]">
                  {data.raceName?.replace(' Grand Prix', '')}
                  <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 block md:inline md:text-5xl ml-2 not-italic tracking-normal">GP</span>
                </h1>
              </div>

              <div className="flex items-center gap-2 text-gray-400 mt-3">
                <MapPin size={16} className="text-green-500" />
                <span className="text-base font-medium">{data.circuit}</span>
              </div>
            </div>

            <div className="text-right z-20">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">Winner</div>
              <div className="text-4xl lg:text-5xl font-black text-white italic tracking-tight mb-2">{data.winner}</div>
              <div className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg backdrop-blur-md border border-white/10"
                style={{ backgroundColor: `${winnerColor}15`, color: winnerColor }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: winnerColor }} />
                {data.winnerTeam}
              </div>
            </div>
          </div>
        </header>

        {/* Row 2: Podium + WDC Chart */}
        <div className="grid grid-cols-3 gap-6">
          {/* Podium */}
          <div className="bg-[#111] rounded-2xl border border-[#222] p-6 flex flex-col">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-6">Podium</h3>
            <div className="flex items-end justify-center flex-1 pb-4 gap-3">
              {podium[1] && (
                <div className="flex flex-col items-center w-1/3">
                  <div className="text-lg font-bold text-white mb-2">{podium[1].code}</div>
                  <div className="w-full h-28 rounded-t-lg flex items-center justify-center"
                    style={{ backgroundColor: getTeamColor(podium[1].team) }}>
                    <span className="text-4xl font-black text-white/25">2</span>
                  </div>
                </div>
              )}
              {podium[0] && (
                <div className="flex flex-col items-center w-5/12">
                  <div className="text-xl font-bold text-white mb-2">{podium[0].code}</div>
                  <div className="w-full h-36 rounded-t-lg flex items-center justify-center"
                    style={{ backgroundColor: getTeamColor(podium[0].team) }}>
                    <span className="text-5xl font-black text-white/25">1</span>
                  </div>
                </div>
              )}
              {podium[2] && (
                <div className="flex flex-col items-center w-1/3">
                  <div className="text-lg font-bold text-white mb-2">{podium[2].code}</div>
                  <div className="w-full h-20 rounded-t-lg flex items-center justify-center"
                    style={{ backgroundColor: getTeamColor(podium[2].team) }}>
                    <span className="text-3xl font-black text-white/25">3</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* WDC Chart */}
          {standingsData && (
            <div className="col-span-2 bg-[#111] rounded-2xl border border-[#222] p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Championship Battle</h3>
                <div className="flex gap-3 text-xs">
                  {standingsData.drivers.slice(0, 4).map((d) => (
                    <div key={d.code} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getTeamColor(d.team) }} />
                      <span className="text-gray-400">{d.code}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={standingsData.races.map((r, i) => ({
                    name: r.substring(0, 3).toUpperCase(),
                    ...standingsData.drivers.slice(0, 4).reduce((acc, d) => ({ ...acc, [d.code]: d.history[i] || 0 }), {})
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} width={30} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px' }} />
                    {standingsData.drivers.slice(0, 4).map((d) => (
                      <Line key={d.code} type="monotone" dataKey={d.code}
                        stroke={getTeamColor(d.team)} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Race Control + Constructors + Results */}
        <div className="grid grid-cols-3 gap-6">
          <div className="h-[380px]">
            <RaceControlFeed raceId={data.raceId || 72} />
          </div>

          {/* Constructor Standings */}
          {standingsData?.constructors && (
            <div className="bg-[#111] rounded-2xl border border-[#222] p-6 flex flex-col h-[380px]">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Constructors</h3>
              <div className="flex-1 space-y-3 overflow-y-auto">
                {standingsData.constructors.map((c, i) => {
                  const teamName = c.name || c.team;
                  const maxPts = standingsData.constructors[0]?.points || 1;
                  return (
                    <div key={teamName}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-white">{i + 1}. {teamName}</span>
                        <span className="text-gray-500 font-mono">{c.points}</span>
                      </div>
                      <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(c.points / maxPts) * 100}%`, backgroundColor: getTeamColor(teamName) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top 10 Results */}
          <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden flex flex-col h-[380px]">
            <div className="px-4 py-3 border-b border-[#222]">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Top 10</h3>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#1a1a1a]">
              {raceResults.slice(0, 10).map((row) => (
                <div key={row.pos} className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-600 w-5">{row.pos}</span>
                    <div className="w-0.5 h-5 rounded-full" style={{ backgroundColor: getTeamColor(row.team) }} />
                    <div>
                      <div className="text-sm font-medium text-white">{row.code}</div>
                      <div className="text-[10px] text-gray-600">{row.team?.split(' ')[0]}</div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-500 bg-[#1a1a1a] px-2 py-0.5 rounded">{row.pts}</span>
                </div>
              ))}
            </div>
          </div>
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
