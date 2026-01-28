import React, { useState, useEffect, useRef } from 'react';
import { Flag, Trophy, Calendar, ChevronRight, ChevronUp, ChevronDown, Activity, Zap, Timer, MapPin, BarChart, Brain, Menu, X, Thermometer, MessageSquare, Clock } from 'lucide-react';
import axios from 'axios';
import { cn } from './lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import RaceReplay from './components/RaceReplay';
import TelemetryAnalysis from './components/TelemetryAnalysis';
import Standings from './pages/Standings';
import Simulations from './pages/Simulations';
import Predictions from './pages/Predictions';
import History from './pages/History';
import RaceControlFeed from './components/RaceControlFeed';
import Paddock from './pages/Paddock';
import DriverSprite from './components/DriverSprite';
import { DashboardSkeleton, PageTransition } from './components/ui/Skeleton';
import CountdownTimer from './components/ui/CountdownTimer';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [raceData, setRaceData] = useState(null);
  const [standingsData, setStandingsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Fetch real data in parallel
    const fetchData = async () => {
      try {
        const [resultsRes, standingsRes] = await Promise.all([
          axios.get('http://localhost:5000/api/latest-results'),
          axios.get('http://localhost:5000/api/standings?year=2026')
        ]);

        setRaceData(resultsRes.data);
        if (standingsRes.data && !standingsRes.data.error) {
          setStandingsData(standingsRes.data);
        }
      } catch (error) {
        console.error("Using fallback data due to API error:", error);
        // Fallback data for design preview
        setRaceData({
          raceName: "Italian Grand Prix",
          circuit: "Monza",
          date: "2024-09-01T15:00:00Z",
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
    <div className="min-h-screen bg-f1-light text-black flex flex-col md:flex-row font-body selection:bg-f1-red selection:text-white scanlines">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b-4 border-black flex items-center justify-between px-4 z-50 text-black">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-f1-red to-red-600 rounded-none flex items-center justify-center font-bold italic tracking-tighter shadow-hard-sm border border-black text-white">F1</div>
          <span className="font-heading text-lg font-bold tracking-widest text-black">INSIGHT</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-none transition-colors"
        >
          {mobileMenuOpen ? <X size={24} className="text-black" /> : <Menu size={24} className="text-black" />}
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
        "md:hidden fixed top-14 right-0 h-[calc(100%-3.5rem)] w-64 bg-white border-l-4 border-black z-50 transition-transform duration-300 ease-in-out",
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
          <MobileNavItem icon={<MessageSquare />} label="The Paddock" active={activeTab === 'paddock'} onClick={() => handleTabChange('paddock')} />
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-[#1A1A20] rounded-none p-4 border border-[#2A2A30]">
            <div className="text-xs text-gray-500 font-medium mb-2">NEXT RACE</div>
            <div className="font-bold text-sm">Azerbaijan GP</div>
            <div className="text-xs text-f1-red mt-1 font-bold">In 2 Weeks</div>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-20 lg:w-64 bg-f1-light border-r-4 border-black flex-col z-50 transition-all duration-300">
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b-4 border-black bg-f1-red text-white">
          <div className="w-8 h-8 bg-black flex items-center justify-center font-bold tracking-tighter border-2 border-white">F1</div>
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
          <NavItem icon={<MessageSquare />} label="The Paddock" active={activeTab === 'paddock'} onClick={() => setActiveTab('paddock')} />
        </nav>

        <div className="p-4 border-t-4 border-black hidden lg:block">
          <div className="bg-white rounded-none p-4 border-2 border-black shadow-hard-sm">
            <div className="text-xs text-gray-500 font-medium mb-2 font-heading uppercase">NEXT RACE</div>
            <div className="font-bold text-sm text-black">Azerbaijan GP</div>
            <div className="text-xs text-f1-red mt-1 font-bold">In 2 Weeks</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "transition-all duration-300",
        activeTab === 'replay'
          ? "fixed inset-0 top-14 md:top-0 left-0 md:left-20 lg:left-64 overflow-y-auto z-0 bg-gray-200"
          : "flex-1 pt-14 pb-16 md:pb-0 md:pt-0 md:ml-20 lg:ml-64 p-4 md:p-8 lg:p-12 overflow-y-auto min-h-screen"
      )} style={activeTab === 'replay' ? { height: '100dvh' } : {}}>
        <div className={cn(
          "mx-auto transition-all duration-300",
          activeTab === 'replay' ? "w-full h-full max-w-none" : "max-w-7xl"
        )}>
          <AnimatePresence mode="wait">
            {loading ? (
              <DashboardSkeleton key="loading" />
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                {activeTab === 'dashboard' && <DashboardView data={raceData} standingsData={standingsData} />}
                {activeTab === 'replay' && <RaceReplay raceId={raceData?.raceId} />}
                {activeTab === 'analysis' && <TelemetryAnalysis raceId={raceData?.raceId} />}
                {activeTab === 'standings' && <Standings />}
                {activeTab === 'simulations' && <Simulations />}
                {activeTab === 'history' && <History />}
                {activeTab === 'predictions' && <Predictions />}
                {activeTab === 'paddock' && <Paddock />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-black flex items-center justify-around px-2 z-50">
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
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 transition-all duration-200 group relative border-b-2 border-transparent",
        active
          ? "bg-f1-red text-white border-black font-bold shadow-hard-sm animate-glow-pulse"
          : "text-gray-600 hover:bg-black hover:text-white hover:shadow-[0_0_15px_rgba(255,0,0,0.3)] hover:shadow-hard-sm"
      )}
    >
      {active && <div className="hidden lg:block absolute right-2 w-2 h-2 bg-white" />}
      <motion.span
        className="inline-flex"
        whileHover={{ rotate: active ? 0 : 10 }}
        transition={{ duration: 0.2 }}
      >
        {React.cloneElement(icon, { size: 20, className: active ? "text-white" : "text-black group-hover:text-white transition-colors duration-200" })}
      </motion.span>
      <span className="hidden lg:block font-heading tracking-wide text-sm pt-1">{label}</span>
    </motion.button>
  )
}

function MobileNavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-none transition-all duration-300 relative",
        active
          ? "bg-gradient-to-r from-f1-red/20 to-transparent text-f1-red"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      )}
    >
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-f1-red rounded-none-full" />}
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
        "flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-none transition-colors",
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

function DashboardView({ data, standingsData }) {
  const winnerColor = getTeamColor(data.winnerTeam);

  // Standings data is now passed as a prop from App to improve loading performance

  // Extract Podium (P1, P2, P3) from results
  const [resultType, setResultType] = useState('R');

  // Extract Results based on toggle
  const raceResults = data.results?.[resultType] || [];
  // Podium always follows Race results for the Hero/Podium cards, or should it change? 
  // Usually Podium is for the Race. Let's keep Podium fixed to Race for now to avoid confusion 
  // or switch it if the user wants Q1/Q2/Q3 distinct views? 
  // For 'Qualifying', podium is Top 3 Qualifiers. 
  const displayPodium = data.results?.['R']?.slice(0, 3) || [];
  const podium = displayPodium; // Keep podium fixed to Race for Hero visuals?
  // User asked for "Qualifying Results", usually meaning the list.
  // Let's keep Hero/Podium focused on the MAIN Event (Race) unless we want full Q mode.
  // I will make the LIST dynamic.

  return (
    <div className="space-y-4 md:space-y-8">

      {/* ===== MOBILE LAYOUT (shown below md) ===== */}
      <div className="md:hidden space-y-4">

        {/* Latest Race or Next Race Card */}
        {data.mode === 'NEXT_RACE' ? (
          <section className="bg-[#0A0A0A]/90 backdrop-blur-md border border-white/5 rounded-none p-4 relative overflow-hidden pixel-shadow">
            <div className="absolute top-0 right-0 p-4 opacity-50">
              <div className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">UPCOMING</div>
            </div>
            <div className="mb-4">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Next Race</span>
              <h2 className="text-xl font-bold text-white leading-tight mt-1">{data.raceName}</h2>
              <p className="text-xs text-gray-400">{data.circuit} • {new Date(data.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p>
            </div>

            {/* Countdown Mini */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <CountdownTimer targetDate={data.date} />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#222]">
              <div className="text-xs text-gray-400">Round {data.round}</div>
              <div className="flex items-center gap-2">
                {/* Flag */}
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-[#0A0A0A]/90 backdrop-blur-md border border-white/5 rounded-none p-4 pixel-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Latest Race</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-500 font-medium">Finished</span>
            </div>
            <h2 className="text-lg font-bold text-white mb-1">{data.raceName}</h2>
            <p className="text-sm text-gray-400 mb-3">{data.circuit} • {data.date}</p>
            <div className="flex items-center gap-3 pt-3 border-t border-[#222]">
              <div className="w-1 h-8 rounded-none" style={{ backgroundColor: winnerColor }} />
              <div>
                <div className="text-xs text-gray-500 uppercase">Winner</div>
                <div className="text-sm font-bold text-white">{data.winner}</div>
              </div>
            </div>
          </section>
        )}

        {/* Podium - Minimal Horizontal */}
        <section className="bg-[#0A0A0A]/90 backdrop-blur-md border border-white/5 rounded-none p-4 pixel-shadow">
          <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-4">Podium</h3>
          <div className="flex items-end justify-center gap-2 h-28">
            {/* P2 */}
            {podium[1] && (
              <div className="flex-1 flex flex-col items-center">
                <DriverSprite driver={podium[1].code} size="md" />
                <span className="text-xs font-bold text-white mb-1">{podium[1].code}</span>
                <div className="w-full h-16 rounded-none-lg flex items-center justify-center relative overflow-hidden"
                  style={{ backgroundColor: getTeamColor(podium[1].team) }}>
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                  <span className="text-2xl font-black text-white/30 z-10">2</span>
                </div>
              </div>
            )}
            {/* P1 */}
            {podium[0] && (
              <div className="flex-1 flex flex-col items-center">
                <DriverSprite driver={podium[0].code} size="lg" />
                <span className="text-sm font-bold text-white mb-1">{podium[0].code}</span>
                <div className="w-full h-24 rounded-none-lg flex items-center justify-center relative overflow-hidden"
                  style={{ backgroundColor: getTeamColor(podium[0].team) }}>
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                  <span className="text-3xl font-black text-white/30 z-10">1</span>
                </div>
              </div>
            )}
            {/* P3 */}
            {podium[2] && (
              <div className="flex-1 flex flex-col items-center">
                <DriverSprite driver={podium[2].code} size="md" />
                <span className="text-xs font-bold text-white mb-1">{podium[2].code}</span>
                <div className="w-full h-12 rounded-none-lg flex items-center justify-center relative overflow-hidden"
                  style={{ backgroundColor: getTeamColor(podium[2].team) }}>
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                  <span className="text-xl font-black text-white/30 z-10">3</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Championship Standings - Clean List */}
        {standingsData && (
          <section className="bg-[#0A0A0A]/90 backdrop-blur-md border border-white/5 rounded-none p-4 pixel-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Championship</h3>
              <span className="text-[10px] text-gray-600">{standingsData.drivers?.length || 0} drivers</span>
            </div>
            <div className="space-y-0 divide-y divide-[#1a1a1a]">
              {standingsData.drivers?.slice(0, 5).map((driver, i) => (
                <div key={driver.code} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-500 w-5">{i + 1}</span>
                    <div className="w-0.5 h-4 rounded-none" style={{ backgroundColor: getTeamColor(driver.team) }} />
                    <span className="text-sm font-medium text-white">{driver.name}</span>
                  </div>
                  <span className="text-sm text-gray-400 font-mono">{driver.points} pts</span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* ===== DESKTOP LAYOUT (shown at md+) ===== */}
      <div className="hidden md:block space-y-6">

        {/* ========== CINEMATIC HERO ========== */}
        <header className="relative overflow-hidden bg-white border-4 border-black min-h-[320px] group shadow-hard">

          {/* Background Effects - Enhanced with gradients */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-f1-light opacity-90" />
            {/* Animated racing stripe gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-f1-red/5 to-transparent animate-racing-stripe" />
            {/* Diagonal accent stripe */}
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-f1-red/10 via-f1-red/5 to-transparent" />
            {/* Bottom edge glow */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/5 to-transparent" />
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'linear-gradient(#000 2px, transparent 2px), linear-gradient(90deg, #000 2px, transparent 2px)',
              backgroundSize: '32px 32px'
            }} />
            {/* Corner accent */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-f1-red/10 to-transparent rounded-br-full" />
          </div>

          {/* Content */}
          <div className="relative z-10 p-8 lg:p-10 flex flex-col min-h-[320px] text-black">

            {data.mode === 'NEXT_RACE' ? (
              /* ===== NEXT RACE MODE ===== */
              <>
                {/* Top Badge Row */}
                <div className="flex items-center justify-between mb-auto">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-none bg-f1-red/90 text-white text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(230,0,0,0.4)] animate-pulse">
                      <div className="w-2 h-2 rounded-none bg-white animate-pulse" />
                      Race Week
                    </div>
                    <span className="text-gray-500 text-sm font-medium">Round {data.round} of 24</span>
                  </div>
                  <div className="text-right hidden lg:block">
                    <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Race Day</div>
                    <div className="text-3xl font-black text-black">{new Date(data.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex items-center justify-between gap-8 mt-8 flex-wrap">
                  <div>
                    <div className="text-black text-sm font-medium mb-2 flex items-center gap-2">
                      <MapPin size={14} className="text-f1-red" />
                      {data.circuit}
                    </div>
                    <h1 className="text-6xl lg:text-8xl font-black text-black uppercase tracking-tighter leading-[0.85] italic">
                      {data.raceName?.replace(' Grand Prix', '')}
                      <span className="block text-3xl lg:text-4xl not-italic text-gray-500 mt-2 tracking-normal">Grand Prix</span>
                    </h1>
                  </div>

                  {/* Countdown */}
                  <div className="text-right">
                    {/* Time Display */}
                    <div className="flex justify-end mb-4">
                      <TimeDisplay date={data.date} circuit={data.circuit} />
                    </div>

                    <div className="text-gray-500 text-xs uppercase tracking-widest mb-3 font-bold">Lights Out In</div>
                    <div className="flex items-center justify-end gap-3 text-black">
                      <CountdownTimer targetDate={data.date} large />
                    </div>
                  </div>
                </div>

                {/* Session Strip */}
                {data.sessions && (
                  <div className="mt-8 pt-6 border-t-2 border-black/10">
                    <div className="flex items-center gap-6 overflow-x-auto">
                      {[
                        { key: 'fp1', label: 'FP1' },
                        { key: 'fp2', label: 'FP2' },
                        { key: 'fp3', label: 'FP3' },
                        { key: 'qualifying', label: 'QUALI' },
                        { key: 'sprint', label: 'SPRINT' },
                      ].map(({ key, label }) => {
                        const time = data.sessions[key];
                        if (!time) return null;
                        return (
                          <div key={key} className="flex-shrink-0 text-center">
                            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1">{label}</div>
                            <div className="text-sm font-bold text-black">{new Date(time).toLocaleTimeString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        );
                      })}
                      <div className="flex-shrink-0 text-center px-4 py-2 rounded-none bg-f1-red text-white border-2 border-black shadow-hard-sm">
                        <div className="text-[10px] uppercase font-bold text-white tracking-widest mb-1">Race</div>
                        <div className="text-sm font-bold text-white">{new Date(data.date).toLocaleTimeString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ===== RESULTS MODE ===== */
              <>
                {/* Top Row */}
                <div className="flex items-center justify-between mb-auto">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-none bg-green-500/20 text-green-400 text-xs font-bold uppercase tracking-widest border border-green-500/30">
                      ✓ Race Complete
                    </span>
                    <span className="text-gray-500 text-sm">{data.date}</span>
                  </div>
                </div>

                {/* Main */}
                {/* Main */}
                <div className="flex-1 flex items-end justify-between gap-8 mt-6">
                  <div className="flex-1">
                    <div className="text-black text-sm font-medium mb-2 flex items-center gap-2">
                      <MapPin size={14} className="text-green-500" />
                      {data.circuit}
                    </div>
                    <h1 className="text-5xl lg:text-7xl font-black text-black uppercase tracking-tighter leading-[0.85] italic">
                      {data.raceName?.replace(' Grand Prix', '')}
                      <span className="block text-2xl lg:text-3xl not-italic text-gray-500 mt-2 tracking-normal">Grand Prix</span>
                    </h1>
                  </div>

                  {/* Winner Spotlight */}
                  {/* Winner Spotlight */}
                  <div className="text-right">
                    <div className="text-gray-500 text-xs uppercase tracking-widest mb-2 font-bold">Race Winner</div>
                    <div className="text-5xl lg:text-6xl font-black text-black italic tracking-tight">{data.winner}</div>
                    <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-none border-2 border-black bg-white"
                      style={{ color: winnerColor }}>
                      <div className="w-3 h-3 rounded-none border border-black" style={{ backgroundColor: winnerColor }} />
                      <span className="font-bold">{data.winnerTeam}</span>
                    </div>
                  </div>
                </div>

                {/* Podium Strip */}
                {podium.length > 0 && (
                  <div className="mt-8 pt-6 border-t-2 border-black/10">
                    <div className="flex items-end justify-center gap-4">
                      {/* P2 */}
                      {podium[1] && (
                        <div className="flex flex-col items-center">
                          <DriverSprite driver={podium[1].code} size="lg" />
                          <span className="text-sm font-bold text-black mb-2">{podium[1].code}</span>
                          <div className="w-24 h-20 rounded-none border-2 border-black flex items-center justify-center relative overflow-hidden"
                            style={{ backgroundColor: getTeamColor(podium[1].team) }}>
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                            <span className="text-3xl font-black text-black/20 z-10">2</span>
                          </div>
                        </div>
                      )}
                      {/* P1 */}
                      {podium[0] && (
                        <div className="flex flex-col items-center">
                          <DriverSprite driver={podium[0].code} size="xl" />
                          <Trophy className="text-yellow-500 mb-2" size={20} />
                          <span className="text-lg font-bold text-black mb-2">{podium[0].code}</span>
                          <div className="w-28 h-28 rounded-none border-2 border-black flex items-center justify-center relative overflow-hidden shadow-hard-sm"
                            style={{ backgroundColor: getTeamColor(podium[0].team) }}>
                            <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
                            <span className="text-4xl font-black text-black/20 z-10">1</span>
                          </div>
                        </div>
                      )}
                      {/* P3 */}
                      {podium[2] && (
                        <div className="flex flex-col items-center">
                          <DriverSprite driver={podium[2].code} size="lg" />
                          <span className="text-sm font-bold text-black mb-2">{podium[2].code}</span>
                          <div className="w-24 h-16 rounded-none border-2 border-black flex items-center justify-center relative overflow-hidden"
                            style={{ backgroundColor: getTeamColor(podium[2].team) }}>
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                            <span className="text-2xl font-black text-black/20 z-10">3</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </header>

        {/* ========== RESULTS GRID (Q / RACE / CONSTRUCTORS) ========== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[500px]">

          {/* 1. Qualifying Results */}
          <div className="bg-white rounded-none border-4 border-black flex flex-col overflow-hidden shadow-hard">
            <div className="p-4 border-b-4 border-black flex justify-between items-center bg-f1-light">
              <h3 className="text-xs font-bold text-black uppercase tracking-widest font-heading">Qualifying Results</h3>
              <span className="text-[10px] bg-black text-white px-2 py-0.5 font-bold">Sat</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-black">
              {(!data.results?.Q || data.results.Q.length === 0) ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                  <div className="text-center">
                    <div className="mb-2">Upcoming</div>
                    <div className="flex gap-2 text-[10px] text-gray-400">
                      <span>Q1</span><span>Q2</span><span>Q3</span>
                    </div>
                  </div>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-black border-b-2 border-black/10">
                      <th className="py-2 text-left pl-2 font-heading">#</th>
                      <th className="py-2 text-left font-heading">Driver</th>
                      <th className="py-2 text-right pr-2 font-heading">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.results.Q.map((r) => (
                      <tr key={r.pos} className="hover:bg-yellow-100 transition-none group">
                        <td className="py-2 pl-2 font-mono text-black font-bold">{r.pos}</td>
                        <td className="py-2">
                          <div className="font-bold text-black">{r.driver}</div>
                          <div className="text-[10px] text-gray-500 truncate max-w-[80px]">{r.team}</div>
                        </td>
                        <td className="py-2 pr-2 text-right font-mono text-gray-600">{r.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 2. Race Results */}
          <div className="bg-white rounded-none border-4 border-black flex flex-col overflow-hidden shadow-hard">
            <div className="p-4 border-b-4 border-black flex justify-between items-center bg-f1-light">
              <h3 className="text-xs font-bold text-f1-red uppercase tracking-widest font-heading">Race Results</h3>
              <span className="text-[10px] bg-f1-red text-white px-2 py-0.5 font-bold">Sun</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-black">
              {(!data.results?.R || data.results.R.length === 0) ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">Upcoming</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-black border-b-2 border-black/10">
                      <th className="py-2 text-left pl-2 font-heading">#</th>
                      <th className="py-2 text-left font-heading">Driver</th>
                      <th className="py-2 text-right pr-2 font-heading">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.results.R.map((r) => (
                      <tr key={r.pos} className="hover:bg-yellow-100 transition-none group">
                        <td className={`py-2 pl-2 font-mono font-bold ${r.pos <= 3 ? 'text-f1-red' : 'text-gray-500'}`}>{r.pos}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-6 border border-black" style={{ backgroundColor: getTeamColor(r.team) }} />
                            <div>
                              <div className="font-bold text-black">{r.driver}</div>
                              <div className="text-[10px] text-gray-500 truncate max-w-[80px]">{r.team}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-2 text-right font-mono font-bold text-black">{r.pts > 0 ? `+${r.pts}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 3. Constructor Results (Event) */}
          <div className="bg-white rounded-none border-4 border-black flex flex-col overflow-hidden shadow-hard">
            <div className="p-4 border-b-4 border-black flex justify-between items-center bg-f1-light">
              <h3 className="text-xs font-bold text-black uppercase tracking-widest font-heading">Constructor Results</h3>
              <span className="text-[10px] bg-black text-white px-2 py-0.5 font-bold">Event</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-black">
              {(!data.results?.C || data.results.C.length === 0) ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">Upcoming</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-black border-b-2 border-black/10">
                      <th className="py-2 text-left pl-2 font-heading">Team</th>
                      <th className="py-2 text-right pr-2 font-heading">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.results.C.map((c, i) => (
                      <tr key={c.team} className="hover:bg-yellow-100 transition-none group">
                        <td className="py-3 pl-2 flex items-center gap-2">
                          <div className="w-1 h-8 border border-black" style={{ backgroundColor: getTeamColor(c.team) }} />
                          <span className="font-bold text-black">{c.team}</span>
                        </td>
                        <td className="py-3 pr-2 text-right font-mono font-bold text-black text-sm">{c.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
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
    <div className="bg-[#1A1A22] p-5 rounded-none border border-[#2A2A30] hover:border-[#3F3F46] transition-all group">
      <div className="flex justify-between items-start mb-4">
        <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">{label}</span>
        <div className={cn("p-2 rounded-none", colors[color])}>
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
      <div className="w-16 h-16 bg-[#1A1A22] rounded-none flex items-center justify-center text-gray-500 border border-[#2A2A30]">
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
  if (lower.includes('audi')) return '#808080';
  if (lower.includes('rb') || lower.includes('alpha')) return '#6692FF';
  return '#666';
}

function WeekendSchedule({ sessions }) {
  if (!sessions) return null;

  const schedule = [
    { id: 'media', label: 'Media Day', time: null, date: 'Thursday' }, // Generic placeholder
    { id: 'fp1', label: 'Practice 1', time: sessions.fp1 },
    { id: 'fp2', label: 'Practice 2', time: sessions.fp2 },
    { id: 'fp3', label: 'Practice 3', time: sessions.fp3 },
    { id: 'quali', label: 'Qualifying', time: sessions.qualifying },
    { id: 'race', label: 'Race', time: sessions.sprint || sessions.date } // Fallback logic
    // Note: 'date' in root object is usually Race Date. 'sessions.race' isn't in API, use root date or derived.
  ];

  // Helper to format
  const formatTime = (iso) => {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', weekday: 'short' });
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {schedule.map((s) => {
        if (!s.time && s.id !== 'media') return null; // Skip empty sessions
        return (
          <div key={s.id} className="bg-[#0A0A0A]/80 backdrop-blur-sm border border-white/5 rounded-none p-3 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:border-f1-red/30 transition-colors duration-300">
            {/* Active Indicator (Mock logic: if generic date matches?) */}
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">{s.label}</div>
            <div className="text-sm font-bold text-white">{s.id === 'media' ? 'All Day' : formatTime(s.time)}</div>
            {s.id === 'media' && <div className="absolute top-0 right-0 p-1"><div className="w-1.5 h-1.5 rounded-none bg-green-500"></div></div>}
          </div>
        )
      })}
    </div>
  )
}


// Timezone Utilities
const TIMEZONES = {
  // Primary names
  'Albert Park Circuit': 'Australia/Melbourne',
  'Bahrain International Circuit': 'Asia/Bahrain',
  'Jeddah Corniche Circuit': 'Asia/Riyadh',
  'Suzuka Circuit': 'Asia/Tokyo',
  'Shanghai International Circuit': 'Asia/Shanghai',
  'Miami International Autodrome': 'America/New_York',
  'Autodromo Enzo e Dino Ferrari': 'Europe/Rome',
  'Circuit de Monaco': 'Europe/Monaco',
  'Circuit Gilles-Villeneuve': 'America/Toronto',
  'Circuit de Barcelona-Catalunya': 'Europe/Madrid',
  'Red Bull Ring': 'Europe/Vienna',
  'Silverstone Circuit': 'Europe/London',
  'Hungaroring': 'Europe/Budapest',
  'Circuit de Spa-Francorchamps': 'Europe/Brussels',
  'Zandvoort': 'Europe/Amsterdam',
  'Monza': 'Europe/Rome',
  'Baku City Circuit': 'Asia/Baku',
  'Marina Bay Street Circuit': 'Asia/Singapore',
  'Circuit of the Americas': 'America/Chicago',
  'Autodromo Hermanos Rodriguez': 'America/Mexico_City',
  'Interlagos': 'America/Sao_Paulo',
  'Las Vegas Strip Circuit': 'America/Los_Angeles',
  'Lusail International Circuit': 'Asia/Qatar',
  'Yas Marina Circuit': 'Asia/Dubai',
  // Alternative names / fallbacks
  'Melbourne': 'Australia/Melbourne',
  'Bahrain': 'Asia/Bahrain',
  'Jeddah': 'Asia/Riyadh',
  'Suzuka': 'Asia/Tokyo',
  'Shanghai': 'Asia/Shanghai',
  'Miami': 'America/New_York',
  'Imola': 'Europe/Rome',
  'Monaco': 'Europe/Monaco',
  'Montreal': 'America/Toronto',
  'Barcelona': 'Europe/Madrid',
  'Spielberg': 'Europe/Vienna',
  'Silverstone': 'Europe/London',
  'Budapest': 'Europe/Budapest',
  'Spa-Francorchamps': 'Europe/Brussels',
  'Baku': 'Asia/Baku',
  'Singapore': 'Asia/Singapore',
  'Austin': 'America/Chicago',
  'Mexico City': 'America/Mexico_City',
  'Sao Paulo': 'America/Sao_Paulo',
  'São Paulo': 'America/Sao_Paulo',
  'Las Vegas': 'America/Los_Angeles',
  'Lusail': 'Asia/Qatar',
  'Abu Dhabi': 'Asia/Dubai',
  'Yas Marina': 'Asia/Dubai'
};

function TimeDisplay({ date, circuit }) {
  const [showLocal, setShowLocal] = React.useState(true); // Toggle between My Time and Track Time

  if (!date) return null;

  const raceDate = new Date(date);
  const trackTimezone = TIMEZONES[circuit] || 'UTC';

  // Format My Time (Local Browser Time)
  const myTime = raceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Format Track Time
  let trackTime = 'Unknown';
  try {
    trackTime = raceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: trackTimezone });
  } catch (e) {
    trackTime = "--:--";
  }

  return (
    <div
      onClick={() => setShowLocal(!showLocal)}
      className="group relative bg-[#EDEDED] border-2 border-black px-2 py-1 shadow-hard-sm cursor-pointer hover:bg-white transition-colors select-none flex items-center gap-3"
      title="Click to switch timezone"
    >
      {/* Icon Area */}
      <div className="flex flex-col items-center justify-center border-r-2 border-black/10 pr-2">
        <Clock size={16} className="text-black group-hover:text-f1-red transition-colors" />
      </div>

      {/* Time Data */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 font-heading">
            {showLocal ? "Local Time" : "Track Time"}
          </span>
          {/* Pixel Indicator */}
          <div className="flex gap-0.5">
            <div className={cn("w-1 h-1 bg-black", showLocal ? "bg-f1-red" : "opacity-20")} />
            <div className={cn("w-1 h-1 bg-black", !showLocal ? "bg-f1-red" : "opacity-20")} />
          </div>
        </div>
        <div className="text-2xl font-black font-heading text-black leading-none mt-0.5">
          {showLocal ? myTime : trackTime}
        </div>
      </div>

      {/* Hover Hint */}
      <div className="hidden group-hover:flex absolute -bottom-5 right-0 bg-black text-white text-[8px] px-1 py-0.5 font-bold uppercase tracking-wider">
        Switch
      </div>
    </div>
  );
}
