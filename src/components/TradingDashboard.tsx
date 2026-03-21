import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Play, Square, Info, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CONFIG } from "../config";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface TradingDashboardProps {
  account: string | null;
  balance: string;
}

export function TradingDashboard({ account, balance }: TradingDashboardProps) {
  const [isTrading, setIsTrading] = useState(false);
  const [strategy, setStrategy] = useState(CONFIG.STRATEGIES[0]);
  const [pair, setPair] = useState(CONFIG.PAIRS[0]);
  const [amount, setAmount] = useState("");
  const [pnl, setPnl] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    let interval: any;
    if (isTrading) {
      interval = setInterval(() => {
        const change = (Math.random() * 2 - 0.9) * (strategy === "Aggressive" ? 2 : 1);
        setPnl(prev => prev + change);
        setChartData(prev => [
          ...prev.slice(-19),
          { time: new Date().toLocaleTimeString(), value: (prev[prev.length - 1]?.value || 0) + change }
        ]);
      }, 3000);
    } else {
      setPnl(0);
      setChartData([]);
    }
    return () => clearInterval(interval);
  }, [isTrading, strategy]);

  const handleStart = () => {
    if (!account) return alert("Connect wallet first");
    if (!amount || parseFloat(amount) <= 0) return alert("Enter valid amount");
    setIsTrading(true);
  };

  const handleStop = async () => {
    // Simulate settlement
    const response = await fetch("/api/trading/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy, principal: parseFloat(amount), duration: 60 })
    });
    const data = await response.json();
    alert(`Trading Stopped!\nFinal PnL: ${data.profit.toFixed(2)} USDT\nYour Share: ${(data.profit > 0 ? data.profit / 2 : data.profit).toFixed(2)} USDT`);
    setIsTrading(false);
  };

  return (
    <div className="space-y-6 py-4">
      {/* Chart Section */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-4 h-64 relative overflow-hidden">
        <div className="absolute top-4 left-4 z-10">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Live Performance</p>
          <div className="flex items-center gap-2">
            <span className={pnl >= 0 ? "text-emerald-500 text-2xl font-bold" : "text-red-500 text-2xl font-bold"}>
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-white/40">USDT</span>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={pnl >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={pnl >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={pnl >= 0 ? "#10b981" : "#ef4444"} 
              fillOpacity={1} 
              fill="url(#colorValue)" 
              strokeWidth={3}
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Controls */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Trading Pair</label>
            <div className="relative">
              <select 
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                disabled={isTrading}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold appearance-none focus:outline-none focus:border-emerald-500/50 transition-all disabled:opacity-50"
              >
                {CONFIG.PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Strategy</label>
            <div className="relative">
              <select 
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                disabled={isTrading}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold appearance-none focus:outline-none focus:border-emerald-500/50 transition-all disabled:opacity-50"
              >
                {CONFIG.STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Amount (USDT)</label>
          <div className="relative">
            <input 
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isTrading}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-xl font-bold focus:outline-none focus:border-emerald-500/50 transition-all disabled:opacity-50"
            />
            <button 
              onClick={() => setAmount(balance)}
              disabled={isTrading}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-emerald-500/20 text-emerald-500 px-2 py-1 rounded-lg hover:bg-emerald-500/30 transition-all disabled:opacity-50"
            >
              MAX
            </button>
          </div>
        </div>

        {!isTrading ? (
          <button 
            onClick={handleStart}
            className="w-full bg-emerald-500 text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
          >
            <Play size={20} fill="currentColor" />
            Start Auto-Trading
          </button>
        ) : (
          <button 
            onClick={handleStop}
            className="w-full bg-red-500 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-400 transition-all active:scale-[0.98] shadow-lg shadow-red-500/20"
          >
            <Square size={20} fill="currentColor" />
            Stop & Settle
          </button>
        )}
      </div>

      <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-3">
        <Info className="text-amber-500 shrink-0" size={18} />
        <p className="text-[11px] text-amber-200/60 leading-relaxed">
          Profits are split 50/50 between the user and the Quantum Treasury. Settlement is processed on-chain upon stopping the trade.
        </p>
      </div>
    </div>
  );
}
