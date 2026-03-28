import React from "react";
import { Trophy, Medal, Star, TrendingUp, Globe, Target } from "lucide-react";

const LeaderboardTab: React.FC = () => {
  const topUsers = [
    { rank: 1, name: "CryptoWhale", profit: "1,245,678.50", strategy: "Aggressive", region: "USA", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=CryptoWhale" },
    { rank: 2, name: "SuiMaster", profit: "982,341.20", strategy: "Momentum", region: "Japan", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=SuiMaster" },
    { rank: 3, name: "QuantumTrader", profit: "845,123.45", strategy: "Scalping", region: "Germany", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=QuantumTrader" },
    { rank: 4, name: "MoonShot", profit: "756,234.12", strategy: "Aggressive", region: "Brazil", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=MoonShot" },
    { rank: 5, name: "SteadyHand", profit: "645,123.00", strategy: "Conservative", region: "UK", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=SteadyHand" },
    { rank: 6, name: "AlphaSeeker", profit: "543,210.99", strategy: "Momentum", region: "Canada", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=AlphaSeeker" },
    { rank: 7, name: "DeFiKing", profit: "432,109.88", strategy: "Scalping", region: "Singapore", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=DeFiKing" },
    { rank: 8, name: "SuiNinja", profit: "321,098.77", strategy: "Conservative", region: "Australia", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=SuiNinja" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Global Leaderboard</h2>
        <div className="flex items-center gap-2 text-white/40 bg-white/5 px-3 md:px-4 py-2 rounded-xl md:rounded-2xl border border-white/10 shrink-0">
          <Globe size={14} className="md:w-4 md:h-4" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">Top 100 Traders</span>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-10">
        {[topUsers[1], topUsers[0], topUsers[2]].map((user, i) => (
          <div
            key={user.rank}
            className={`bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden group ${
              user.rank === 1 ? "lg:-mt-6 border-orange-500/50 shadow-2xl shadow-orange-500/10" : ""
            }`}
          >
            {user.rank === 1 && (
              <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
            )}
            <div className="relative mb-4 md:mb-6">
              <img
                src={user.avatar}
                alt={user.name}
                className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-4 ${
                  user.rank === 1 ? "border-orange-500" : "border-white/10"
                } bg-white/5 group-hover:scale-110 transition-transform`}
                referrerPolicy="no-referrer"
              />
              <div className={`absolute -bottom-2 -right-2 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-black font-bold border-4 border-[#0a0a0a] text-sm md:text-base ${
                user.rank === 1 ? "bg-orange-500" : user.rank === 2 ? "bg-slate-300" : "bg-orange-300"
              }`}>
                {user.rank}
              </div>
            </div>
            <h3 className="text-lg md:text-xl font-bold mb-1 truncate max-w-full">{user.name}</h3>
            <p className="text-white/40 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-1">
              <Globe size={12} />
              {user.region}
            </p>
            <div className="w-full bg-white/5 rounded-xl md:rounded-2xl p-3 md:p-4 space-y-2">
              <div className="flex justify-between text-[10px] md:text-xs">
                <span className="text-white/40">Total Profit</span>
                <span className="font-bold text-green-400">+${user.profit}</span>
              </div>
              <div className="flex justify-between text-[10px] md:text-xs">
                <span className="text-white/40">Strategy</span>
                <span className="font-bold text-orange-500">{user.strategy}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[600px] md:min-w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/40">Rank</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/40">Trader</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/40">Strategy</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/40">Region</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/40 text-right">Total Profit</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.slice(3).map((user) => (
                <tr key={user.rank} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="px-4 md:px-8 py-4 md:py-5">
                    <span className="font-mono text-white/40 text-xs md:text-sm">#{user.rank}</span>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-5">
                    <div className="flex items-center gap-2 md:gap-3">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/5 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <span className="font-bold text-sm md:text-base group-hover:text-orange-500 transition-colors truncate max-w-[120px] md:max-w-none">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-5">
                    <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-orange-500">
                      <Target size={14} className="shrink-0" />
                      <span className="truncate">{user.strategy}</span>
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-5">
                    <span className="text-[10px] md:text-xs text-white/40 uppercase font-bold tracking-widest truncate">{user.region}</span>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-5 text-right">
                    <span className="font-bold text-green-400 text-sm md:text-base">+${user.profit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardTab;
