import React, { useState, useEffect } from "react";
import { Trophy, TrendingUp, User, Activity, Medal, Star } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import type { LeaderboardEntry, FirebaseUser } from "../types";

interface LeaderboardTabProps {
  user: FirebaseUser | null;
}

const LeaderboardTab: React.FC<LeaderboardTabProps> = ({ user }) => {
  const [traders, setTraders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch("/api/leaderboard");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: LeaderboardEntry[] = await response.json();
        setTraders(data);
        if (user) {
          const rank = data.findIndex((t) => t.id === user.uid);
          setCurrentUserRank(rank !== -1 ? rank + 1 : null);
        }
      } catch (error: any) {
        console.error("Error fetching leaderboard:", error);
        toast.error("Failed to load leaderboard. Retrying...");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-white/40 font-bold uppercase tracking-widest animate-pulse">Loading Rankings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
          <Trophy className="text-orange-500 w-6 h-6 md:w-8 md:h-8" />
          Global Leaderboard
        </h2>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] md:text-sm font-bold uppercase tracking-widest text-white/40">
            Live Rankings
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {traders.length > 0 ? (
          <>
            {/* Top 3 Cards */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {traders.slice(0, 3).map((trader, index) => (
                <motion.div
                  key={trader.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative bg-[#0a0a0a] border ${
                    index === 0 ? "border-orange-500/50 shadow-orange-500/10" : "border-white/10"
                  } rounded-2xl md:rounded-3xl p-6 md:p-8 overflow-hidden group shadow-2xl`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    {index === 0 ? <Medal size={120} className="text-orange-500" /> : <Star size={120} className="text-white" />}
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    <div className="relative">
                      <img
                        src={trader.avatar}
                        alt={trader.name}
                        className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-4 ${
                          index === 0 ? "border-orange-500" : "border-white/10"
                        } bg-white/5`}
                        referrerPolicy="no-referrer"
                      />
                      <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? "bg-orange-500 text-black" : "bg-white/10 text-white"
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg md:text-xl font-bold truncate max-w-[150px]">{trader.name}</h3>
                      <p className="text-white/40 text-[10px] md:text-xs font-bold uppercase tracking-widest">Top Trader</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-2xl md:text-3xl font-bold text-green-400 tracking-tighter">
                        +{trader.profit.toFixed(2)} <span className="text-xs opacity-60">USDT</span>
                      </p>
                      <div className="flex items-center justify-center gap-2 text-[10px] md:text-xs text-white/40">
                        <Activity size={12} className="text-orange-500" />
                        <span>{trader.isTrading ? "Currently Trading" : "Idle"}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Rankings Table */}
            <div className="lg:col-span-3 bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-4 md:p-6 border-bottom border-white/5 bg-white/5 flex items-center justify-between">
                <h3 className="font-bold text-sm md:text-lg">Full Rankings</h3>
                {currentUserRank && (
                  <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
                    <span className="text-[10px] md:text-xs text-orange-500 font-bold uppercase tracking-widest">
                      Your Rank: #{currentUserRank}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] md:text-xs text-white/40 uppercase font-bold tracking-widest">
                      <th className="px-4 md:px-8 py-4">Rank</th>
                      <th className="px-4 md:px-8 py-4">Trader</th>
                      <th className="px-4 md:px-8 py-4">Status</th>
                      <th className="px-4 md:px-8 py-4 text-right">Total Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {traders.map((trader, index) => (
                      <tr 
                        key={trader.id} 
                        className={`hover:bg-white/5 transition-colors group ${trader.id === user?.uid ? "bg-orange-500/5" : ""}`}
                      >
                        <td className="px-4 md:px-8 py-4 md:py-6">
                          <span className={`font-bold text-sm md:text-lg ${index < 3 ? "text-orange-500" : "text-white/40"}`}>
                            #{index + 1}
                          </span>
                        </td>
                        <td className="px-4 md:px-8 py-4 md:py-6">
                          <div className="flex items-center gap-3 md:gap-4">
                            <img
                              src={trader.avatar}
                              alt={trader.name}
                              className="w-8 h-8 md:w-12 md:h-12 rounded-full border border-white/10 bg-white/5"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="font-bold text-xs md:text-base">
                                {trader.name} {trader.id === user?.uid && <span className="text-[10px] text-orange-500 ml-1">(You)</span>}
                              </p>
                              <p className="text-[9px] md:text-xs text-white/40 font-mono">{trader.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 md:px-8 py-4 md:py-6">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${trader.isTrading ? "bg-green-500 animate-pulse" : "bg-white/10"}`} />
                            <span className="text-[10px] md:text-xs font-medium text-white/60">
                              {trader.isTrading ? "Active" : "Offline"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                          <p className="font-bold text-green-400 text-xs md:text-lg">
                            +{trader.profit.toFixed(2)} <span className="text-[10px] opacity-60">USDT</span>
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="lg:col-span-3 bg-[#0a0a0a] border border-white/10 rounded-3xl p-20 text-center space-y-4">
            <Trophy size={64} className="mx-auto text-white/10" />
            <div className="space-y-2">
              <h3 className="text-xl font-bold">No Traders Yet</h3>
              <p className="text-white/40 max-w-xs mx-auto">Be the first to start trading and claim the top spot on the leaderboard!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardTab;
