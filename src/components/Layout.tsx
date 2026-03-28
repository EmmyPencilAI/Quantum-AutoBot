import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, BarChart3, TrendingUp, Trophy, Users, Settings, LogOut } from "lucide-react";
import { auth } from "../firebase";

interface LayoutProps {
  activeTab: number;
  setActiveTab: (tab: number) => void;
  children: React.ReactNode;
  user: any;
}

const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children, user }) => {
  const tabs = [
    { id: 0, name: "Wallet", icon: Wallet },
    { id: 1, name: "Markets", icon: BarChart3 },
    { id: 2, name: "Trading", icon: TrendingUp },
    { id: 3, name: "Leaderboard", icon: Trophy },
    { id: 4, name: "Community", icon: Users },
    { id: 5, name: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row font-sans">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0a0a0a] border-r border-white/10 p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="text-black" />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase">Quantum</h1>
        </div>

        <nav className="flex-1 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? "bg-orange-500 text-black font-semibold"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <tab.icon size={20} />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
              alt="Avatar"
              className="w-10 h-10 rounded-full bg-white/10"
              referrerPolicy="no-referrer"
            />
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.displayName || "User"}</p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header (Mobile) */}
        <header className="md:hidden flex items-center justify-between p-4 bg-[#0a0a0a] border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
              <TrendingUp size={18} className="text-black" />
            </div>
            <span className="font-bold uppercase tracking-wider">Quantum</span>
          </div>
          <button onClick={() => auth.signOut()} className="text-red-400">
            <LogOut size={20} />
          </button>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Nav (Mobile) */}
        <nav className="md:hidden flex justify-around p-3 bg-[#0a0a0a] border-t border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === tab.id ? "text-orange-500" : "text-white/40"
              }`}
            >
              <tab.icon size={20} />
              <span className="text-[10px] uppercase font-bold tracking-tighter">{tab.name}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
};

export default Layout;
