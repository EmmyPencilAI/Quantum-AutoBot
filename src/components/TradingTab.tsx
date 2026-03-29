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
  const [selectedPair, setSelectedPair] = useState("BTC / USDT");
  const [pnl, setPnl] = useState(0);
  const [initialInvestment, setInitialInvestment] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fundAmount, setFundAmount] = useState("100");
  const [walletBalance, setWalletBalance] = useState(0);

  // Sync with Firestore
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsTrading(data.isTrading || false);
        setStrategy(data.activeStrategy || "Momentum");
        setSelectedPair(data.activePair || "BTC / USDT");
        setPnl(data.totalProfit || 0);
        setInitialInvestment(data.initialInvestment || 0);
        setWalletBalance(data.walletBalance || 0);
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
      limit(100)
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
      
      if (isTrading) {
        // Settlement logic
        const response = await fetch("/api/trading/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid })
        });
        const result = await response.json();
        if (result.success) {
          console.log("Settlement successful:", result);
        } else {
          throw new Error(result.error || "Settlement failed");
        }
      } else {
        // Start trading
        if (initialInvestment <= 0) {
          alert("Please fund your trading account first.");
          setLoading(false);
          return;
        }
        await updateDoc(userRef, {
          isTrading: true,
          activeStrategy: strategy,
          activePair: selectedPair
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const fundTrading = async () => {
    if (!user || isTrading) return;
    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (amount > walletBalance) {
      alert("Insufficient wallet balance. Please receive funds first.");
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      // Deduct from wallet balance and add to trading balance
      await updateDoc(userRef, {
        walletBalance: walletBalance - amount,
        usdtBalance: (initialInvestment || 0) + amount,
        initialInvestment: (initialInvestment || 0) + amount
      });
      setFundAmount("100");
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

  const changePair = async (newPair: string) => {
    if (!user || isTrading) return;
    setSelectedPair(newPair);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        activePair: newPair
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const tradingPairs = [
    { symbol: "BTC / USDT", logo: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png" },
    { symbol: "ETH / USDT", logo: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" },
    { symbol: "BNB / USDT", logo: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png" },
    { symbol: "SOL / USDT", logo: "https://assets.coingecko.com/coins/images/4128/large/solana.png" },
    { symbol: "SUI / USDT", logo: "https://assets.coingecko.com/coins/images/26375/large/sui_logo.png" },
    { symbol: "XRP / USDT", logo: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png" },
    { symbol: "ADA / USDT", logo: "https://assets.coingecko.com/coins/images/975/large/cardano.png" },
    { symbol: "DOGE / USDT", logo: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png" },
    { symbol: "AVAX / USDT", logo: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png" },
    { symbol: "MATIC / USDT", logo: "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon_2x.png" }
  ];

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

  const activePairData = tradingPairs.find(p => p.symbol === selectedPair) || tradingPairs[0];

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Quantum Trading Engine</h2>
        <div className="flex items-center gap-2 md:gap-3">
          <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${isTrading ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <span className="text-[10px] md:text-sm font-bold uppercase tracking-widest text-white/40">
            {isTrading ? "System Online" : "System Offline"}
          </span>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-orange-500/10 border border-orange-500/20 p-3 md:p-4 rounded-xl md:rounded-2xl flex items-start md:items-center gap-3 md:gap-4">
        <AlertTriangle className="text-orange-500 shrink-0 w-5 h-5 md:w-6 md:h-6" />
        <p className="text-[10px] md:text-sm font-medium text-orange-200/80 leading-tight">
          ⚠️ <span className="font-bold text-orange-500 uppercase">Warning:</span> Trading is risky. Profits are not guaranteed. Venture into the unknown responsibly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Pair & Strategy Selection */}
        <div className="lg:col-span-1 space-y-4 md:space-y-6">
          {/* Fund Trading */}
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500">Fund Trading Account</h3>
            <div className="flex gap-2">
              <input
                type="number"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                disabled={isTrading || loading}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-500/50"
                placeholder="Amount (USDT)"
              />
              <button
                onClick={fundTrading}
                disabled={isTrading || loading}
                className="bg-orange-500 text-black px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 transition-transform disabled:opacity-50"
              >
                Deposit
              </button>
            </div>
            <p className="text-[10px] text-white/40">
              Wallet Balance: <span className="text-white font-bold">{walletBalance.toFixed(2)} USDT</span>
            </p>
            <p className="text-[10px] text-white/40">
              Trading Balance: <span className="text-white font-bold">{initialInvestment.toFixed(2)} USDT</span>
            </p>
          </div>

          {/* Pair Selection */}
          <div className="space-y-3 md:space-y-4">
            <h3 className="text-sm md:text-lg font-bold tracking-tight mb-1 md:mb-4">Select Trading Pair</h3>
            <div className="grid grid-cols-2 gap-2">
              {tradingPairs.map((pair) => (
                <button
                  key={pair.symbol}
                  onClick={() => changePair(pair.symbol)}
                  disabled={isTrading || loading}
                  className={`py-2.5 md:py-3 px-3 md:px-4 rounded-xl md:rounded-2xl border text-[10px] md:text-sm font-bold transition-all flex items-center gap-2 ${
                    selectedPair === pair.symbol
                      ? "bg-orange-500 text-black border-orange-500 shadow-lg shadow-orange-500/20"
                      : "bg-[#0a0a0a] border-white/10 text-white/60 hover:border-white/20"
                  }`}
                >
                  <img src={pair.logo} alt={pair.symbol} className="w-4 h-4 md:w-5 md:h-5 object-contain" referrerPolicy="no-referrer" />
                  <span className="truncate">{pair.symbol}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Strategy Selection */}
          <div className="space-y-3 md:space-y-4">
            <h3 className="text-sm md:text-lg font-bold tracking-tight mb-1 md:mb-4">Select Strategy</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 md:gap-4">
              {strategies.map((s) => (
                <button
                  key={s.name}
                  onClick={() => changeStrategy(s.name)}
                  disabled={isTrading || loading}
                  className={`flex items-center gap-3 md:gap-4 p-3 md:p-5 rounded-xl md:rounded-3xl border transition-all text-left ${
                    strategy === s.name
                      ? "bg-white/5 border-orange-500 shadow-lg shadow-orange-500/10"
                      : "bg-[#0a0a0a] border-white/10 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className={`w-8 h-8 md:w-12 md:h-12 shrink-0 ${s.bg} ${s.color} rounded-lg md:rounded-2xl flex items-center justify-center`}>
                    <s.icon size={16} className="md:w-6 md:h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs md:text-lg truncate">{s.name}</p>
                    <p className="text-[8px] md:text-xs text-white/40 leading-tight line-clamp-1 md:line-clamp-2">{s.desc}</p>
                  </div>
                  {strategy === s.name && <ChevronRight className="text-orange-500 shrink-0 md:w-4 md:h-4" size={14} />}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={toggleTrading}
            disabled={loading}
            className={`w-full py-4 md:py-6 rounded-xl md:rounded-3xl font-bold text-base md:text-xl flex items-center justify-center gap-2 md:gap-3 transition-all ${
              isTrading
                ? "bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20"
                : "bg-orange-500 text-black hover:scale-[1.02] shadow-xl shadow-orange-500/20"
            }`}
          >
            {isTrading ? (
              <>
                <Square size={18} className="md:w-6 md:h-6" fill="currentColor" />
                <span className="truncate text-sm md:text-xl">{loading ? "Processing..." : "Stop Trading"}</span>
              </>
            ) : (
              <>
                <Play size={18} className="md:w-6 md:h-6" fill="currentColor" />
                <span className="truncate text-sm md:text-xl">{loading ? "Processing..." : "Start Trading"}</span>
              </>
            )}
          </button>
        </div>

        {/* Live PnL & Activity */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-8 relative overflow-hidden shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-8">
              <div>
                <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-1">Live Profit/Loss</p>
                <h3 className={`text-2xl md:text-5xl font-bold tracking-tighter ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} <span className="text-base md:text-2xl opacity-60">USDT</span>
                </h3>
              </div>
              <div className="sm:text-right flex flex-col sm:items-end gap-2">
                <div>
                  <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-1">Active Pair</p>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <img src={activePairData.logo} alt={selectedPair} className="w-5 h-5 md:w-6 md:h-6 object-contain" referrerPolicy="no-referrer" />
                    <p className="text-base md:text-xl font-bold text-white">{selectedPair}</p>
                  </div>
                </div>
                <div>
                  <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-1">Active Strategy</p>
                  <p className="text-base md:text-xl font-bold text-orange-500">{strategy}</p>
                </div>
              </div>
            </div>

            <div className="h-40 md:h-64 w-full">
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
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="text-base md:text-xl font-bold tracking-tight flex items-center gap-2">
                <BarChart2 size={18} className="text-orange-500 md:w-5 md:h-5" />
                <span>Trade Activity Feed</span>
              </h3>
              <div className="text-[9px] md:text-xs text-white/40 bg-white/5 px-2 md:px-3 py-1 rounded-full border border-white/10">
                Live Updates
              </div>
            </div>
            <div className="space-y-3 md:space-y-4 max-h-48 md:max-h-64 overflow-y-auto pr-2 scrollbar-hide">
              <AnimatePresence>
                {history.length > 0 && history[0].time !== "Start" ? (
                  history.slice().reverse().map((trade: any) => (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/5"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center font-bold text-[10px] md:text-xs ${trade.type === "Buy" ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"}`}>
                          {trade.type === "Buy" ? "BUY" : "SELL"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs md:text-base truncate">{trade.pair}</p>
                          <p className="text-[9px] md:text-xs text-white/40 truncate">
                            {trade.amount?.toFixed(2) || "0.00"} USDT • {trade.duration || 0}s
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold text-xs md:text-base ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(4)} USDT
                        </p>
                        <p className="text-[9px] md:text-xs text-white/40">{trade.time}</p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 md:py-10 text-white/20">
                    <TrendingUp size={32} className="mb-3 md:mb-4 opacity-10 md:w-12 md:h-12" />
                    <p className="font-bold text-sm md:text-base">No active trades</p>
                    <p className="text-[10px] md:text-xs">Start the engine to begin trading</p>
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
