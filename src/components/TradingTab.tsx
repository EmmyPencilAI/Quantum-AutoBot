import React, { useState, useEffect } from "react";
import { Play, Square, TrendingUp, Activity, AlertTriangle, ChevronRight, Zap, Target, Shield, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, onSnapshot, updateDoc, collection, query, where, orderBy, limit } from "firebase/firestore";

interface TradingTabProps {
  user: any;
}

const TradingTab: React.FC<TradingTabProps> = ({ user }) => {
  const [isTrading, setIsTrading] = useState(false);
  const [strategy, setStrategy] = useState("Momentum");
  const [pnl, setPnl] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync with Firestore
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsTrading(data.isTrading || false);
        setStrategy(data.activeStrategy || "Momentum");
        setPnl(data.totalProfit || 0);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // Fetch trade history for chart
    const tradesRef = collection(db, "trades");
    const q = query(
      tradesRef,
      where("uid", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(20)
    );

    const unsubscribeTrades = onSnapshot(q, (snapshot) => {
      const trades = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        time: new Date(doc.data().timestamp).toLocaleTimeString(),
        value: doc.data().pnl
      })).reverse();
      
      // If we have trades, use them for the chart. 
      // Otherwise, create some dummy data based on current PnL
      if (trades.length > 0) {
        setHistory(trades);
      } else {
        setHistory([{ time: "Start", value: 0 }]);
      }
    }, (error) => {
      // Don't throw for history fetch errors, just log
      console.error("Error fetching trade history:", error);
    });

    return () => {
      unsubscribeUser();
      unsubscribeTrades();
    };
  }, [user]);

  const toggleTrading = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        isTrading: !isTrading,
        activeStrategy: strategy
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const changeStrategy = async (newStrategy: string) => {
    if (!user || isTrading) return;
    setStrategy(newStrategy);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        activeStrategy: newStrategy
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const strategies = [
    { name: "Aggressive", icon: Zap, color: "text-red-400", bg: "bg-red-400/10", desc: "High risk, high reward. Focuses on volatility." },
    { name: "Momentum", icon: Target, color: "text-orange-400", bg: "bg-orange-400/10", desc: "Follows market trends and breakouts." },
    { name: "Scalping", icon: Activity, color: "text-blue-400", bg: "bg-blue-400/10", desc: "Small profits from frequent trades." },
    { name: "Conservative", icon: Shield, color: "text-green-400", bg: "bg-green-400/10", desc: "Low risk, steady growth. Focuses on stability." },
  ];

  useEffect(() => {
    let interval: any;
    if (isTrading) {
      interval = setInterval(() => {
        const change = (Math.random() - 0.45) * 5; // Slight upward bias
        setPnl((prev) => prev + change);
        setHistory((prev) => [...prev.slice(-19), { time: new Date().toLocaleTimeString(), value: pnl + change }]);
      }, 2000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTrading, pnl]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Quantum Trading Engine</h2>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isTrading ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-sm font-bold uppercase tracking-widest text-white/40">
            {isTrading ? "System Online" : "System Offline"}
          </span>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex items-center gap-4">
        <AlertTriangle className="text-orange-500 shrink-0" size={24} />
        <p className="text-xs md:text-sm font-medium text-orange-200/80">
          ⚠️ <span className="font-bold text-orange-500 uppercase">Warning:</span> Trading is risky. Profits are not guaranteed. Venture into the unknown responsibly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Strategy Selection */}
        <div className="lg:col-span-1 space-y-3 md:space-y-4">
          <h3 className="text-base md:text-lg font-bold tracking-tight mb-2 md:mb-4">Select Strategy</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 md:gap-4">
            {strategies.map((s) => (
              <button
                key={s.name}
                onClick={() => changeStrategy(s.name)}
                disabled={isTrading || loading}
                className={`flex items-center gap-3 md:gap-4 p-4 md:p-5 rounded-2xl md:rounded-3xl border transition-all text-left ${
                  strategy === s.name
                    ? "bg-white/5 border-orange-500 shadow-lg shadow-orange-500/10"
                    : "bg-[#0a0a0a] border-white/10 opacity-60 hover:opacity-100"
                }`}
              >
                <div className={`w-10 h-10 md:w-12 md:h-12 shrink-0 ${s.bg} ${s.color} rounded-xl md:rounded-2xl flex items-center justify-center`}>
                  <s.icon size={20} className="md:w-6 md:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm md:text-lg truncate">{s.name}</p>
                  <p className="text-[10px] md:text-xs text-white/40 leading-tight line-clamp-1 md:line-clamp-2">{s.desc}</p>
                </div>
                {strategy === s.name && <ChevronRight className="text-orange-500 shrink-0" size={16} />}
              </button>
            ))}
          </div>

          <button
            onClick={toggleTrading}
            disabled={loading}
            className={`w-full py-4 md:py-6 rounded-2xl md:rounded-3xl font-bold text-lg md:text-xl flex items-center justify-center gap-2 md:gap-3 transition-all ${
              isTrading
                ? "bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20"
                : "bg-orange-500 text-black hover:scale-[1.02] shadow-xl shadow-orange-500/20"
            }`}
          >
            {isTrading ? (
              <>
                <Square size={20} className="md:w-6 md:h-6" fill="currentColor" />
                <span className="truncate">{loading ? "Processing..." : "Stop Trading"}</span>
              </>
            ) : (
              <>
                <Play size={20} className="md:w-6 md:h-6" fill="currentColor" />
                <span className="truncate">{loading ? "Processing..." : "Start Trading"}</span>
              </>
            )}
          </button>
        </div>

        {/* Live PnL & Activity */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-8 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
              <div>
                <p className="text-white/40 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1">Live Profit/Loss</p>
                <h3 className={`text-3xl md:text-5xl font-bold tracking-tighter ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} <span className="text-xl md:text-2xl opacity-60">USDT</span>
                </h3>
              </div>
              <div className="sm:text-right">
                <p className="text-white/40 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1">Active Strategy</p>
                <p className="text-lg md:text-xl font-bold text-orange-500">{strategy}</p>
              </div>
            </div>

            <div className="h-48 md:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={pnl >= 0 ? "#4ade80" : "#f87171"} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={pnl >= 0 ? "#4ade80" : "#f87171"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                    itemStyle={{ color: pnl >= 0 ? "#4ade80" : "#f87171" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={pnl >= 0 ? "#4ade80" : "#f87171"}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    animationDuration={500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trade Activity Feed */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <BarChart2 size={20} className="text-orange-500" />
                <span>Trade Activity Feed</span>
              </h3>
              <div className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                Live Updates
              </div>
            </div>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2 scrollbar-hide">
              <AnimatePresence>
                {history.length > 0 && history[0].time !== "Start" ? (
                  history.slice().reverse().map((trade) => (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${trade.type === "Buy" ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"}`}>
                          {trade.type === "Buy" ? "BUY" : "SELL"}
                        </div>
                        <div>
                          <p className="font-bold">{trade.pair}</p>
                          <p className="text-xs text-white/40">Price: ${trade.price.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(4)} USDT
                        </p>
                        <p className="text-xs text-white/40">{trade.time}</p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-white/20">
                    <TrendingUp size={48} className="mb-4 opacity-10" />
                    <p className="font-bold">No active trades</p>
                    <p className="text-xs">Start the engine to begin trading</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingTab;
