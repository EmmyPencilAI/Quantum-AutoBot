import React from "react";
import { Wallet, TrendingUp, Trophy, Users, Settings as SettingsIcon, BarChart3 } from "lucide-react";
import { Tab } from "../App";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  account: string | null;
}

export function Layout({ children, activeTab, setActiveTab, account }: LayoutProps) {
  const navItems = [
    { id: "wallet", icon: Wallet, label: "Wallet" },
    { id: "markets", icon: BarChart3, label: "Markets" },
    { id: "trading", icon: TrendingUp, label: "Trading" },
    { id: "leaderboard", icon: Trophy, label: "Leaderboard" },
    { id: "community", icon: Users, label: "Community" },
    { id: "settings", icon: SettingsIcon, label: "Settings" },
  ];

  return (
    <div className="relative min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 h-16 flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 overflow-hidden">
            <img 
              src="https://drive.google.com/uc?export=view&id=16POTdSt2d2Zh_caldrCLB-vMjIwYhl3Y" 
              alt="Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback if drive link fails
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                const icon = document.createElement('div');
                icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up text-black"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>';
                e.currentTarget.parentElement?.appendChild(icon.firstChild!);
              }}
            />
          </div>
          <span className="font-bold text-lg tracking-tight">QUANTUM</span>
        </div>
        
        {account ? (
          <div className="bg-white/5 border border-white/10 rounded-full px-3 py-1 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono text-white/60">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
          </div>
        ) : (
          <div className="text-xs text-white/40 font-medium">Not Connected</div>
        )}
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-2xl border-t border-white/5 pb-safe max-w-lg mx-auto">
        <div className="flex items-center justify-around h-20 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative px-4 py-2 rounded-2xl",
                  isActive ? "text-emerald-500" : "text-white/40 hover:text-white/60"
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl -z-10" />
                )}
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
