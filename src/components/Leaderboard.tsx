import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { Trophy, Medal, Crown } from "lucide-react";
import { motion } from "motion/react";

export function Leaderboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "users"), 
      orderBy("totalProfit", "desc"), 
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      const leaderboardData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(leaderboardData);
      setLoading(false);
    }, (error) => {
      console.error("Leaderboard snapshot error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return <div className="py-20 text-center text-white/40">Loading rankings...</div>;

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Crown className="text-yellow-500" size={24} />
          Top Traders
        </h2>
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">USDT Profit</span>
      </div>

      <div className="space-y-3">
        {users.map((user, index) => (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            key={user.uid}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-8 text-center font-mono font-bold text-white/20">
                {index + 1}
              </div>
              <img 
                src={user.avatar} 
                alt={user.username} 
                className="w-10 h-10 rounded-xl bg-white/5"
                referrerPolicy="no-referrer"
              />
              <div>
                <p className="font-bold text-sm">{user.username}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter">
                    {user.strategy || "Momentum"}
                  </span>
                  <span className="text-[10px] text-white/40">{user.region || "Global"}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-emerald-500 font-bold font-mono">
                +${user.totalProfit.toLocaleString()}
              </p>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">USDT</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
