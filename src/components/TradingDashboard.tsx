import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Play, Square, Info, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CONFIG } from "../config";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface TradingDashboardProps {
  account: string | null;
  balance: string;
  showAlert: (title: string, message: string) => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
  isTrading: boolean;
  setIsTrading: (val: boolean) => void;
  pnl: number;
  setPnl: (val: number | ((prev: number) => number)) => void;
  chartData: any[];
  setChartData: (val: any[] | ((prev: any[]) => any[])) => void;
  amount: string;
  setAmount: (val: string) => void;
  strategy: string;
  setStrategy: (val: string) => void;
  pair: string;
  setPair: (val: string) => void;
  history: any[];
  updateBalance: () => Promise<void>;
}

export function TradingDashboard({ 
  account, 
  balance, 
  showAlert, 
  notify,
  isTrading,
  setIsTrading,
  pnl,
  setPnl,
  chartData,
  setChartData,
  amount,
  setAmount,
  strategy,
  setStrategy,
  pair,
  setPair,
  history,
  updateBalance
}: TradingDashboardProps) {

  const handleStart = () => {
    if (!account) return notify("Connect wallet first", "error");
    if (!amount || parseFloat(amount) <= 0) return notify("Enter valid amount", "error");
    if (parseFloat(amount) > parseFloat(balance)) return notify("Insufficient balance", "error");
    
    setIsTrading(true);
    notify("Auto-trading started!", "success");
  };

  const handleStop = async () => {
    if (!account) return notify("Connect wallet first", "error");
    
    const principalVal = parseFloat(amount);
    if (isNaN(principalVal) || principalVal <= 0) {
      return notify("Invalid trading amount", "error");
    }

    try {
      notify("Settling trades...", "info");
      const response = await fetch("/api/trading/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          strategy, 
          principal: principalVal, 
          duration: 60,
          account: account.toLowerCase()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Server error during settlement");
      }
      
      if (data.error) {
        notify(`Settlement error: ${data.error}`, "error");
        return;
      }
      
      // Simulate returning balance + profit
      const finalProfit = data.profit > 0 ? data.profit * 0.8 : data.profit; // 80/20 split
      const txMsg = data.txHash ? `\n\nTransaction: ${data.txHash.slice(0, 10)}...` : "";
      
      showAlert("Trading Settled", `Final PnL: ${data.profit.toFixed(2)} USDT\nYour Share: ${finalProfit.toFixed(2)} USDT\n\nFunds have been returned to your wallet.${txMsg}`);
      
      setIsTrading(false);
      setPnl(0);
      setChartData([]);
      
      setTimeout(async () => {
        await updateBalance();
      }, 2000);
      
    } catch (error: any) {
      console.error("Settlement failed:", error);
      notify(`Settlement failed: ${error.message || "Unknown error"}`, "error");
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Bio Section */}
      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
        <p className="text-[11px] text-emerald-200/60 leading-relaxed text-center italic">
          "Quantum Finance operates as a core financial engine under Thalexa, an advanced platform developed by Gugu Robotics—built to unify intelligence, automation, and capital into a single decentralized ecosystem."
        </p>
      </div>

      {/* Chart Section */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-3 sm:p-4 h-56 sm:h-64 relative overflow-hidden">
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
      <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
            Stop Trade
          </button>
        )}
      </div>

      {/* Trade History Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">Trade History</h3>
          <span className="text-[10px] font-bold text-white/20">{history.length} Recent Trades</span>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {history.length === 0 ? (
              <div className="p-8 text-center text-white/20 text-xs italic">
                No trades recorded yet. Start auto-trading to see history.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {history.map((trade) => (
                  <div key={trade.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${trade.type === 'up' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                        {trade.type === 'up' ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingDown size={16} className="text-red-500" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold">{trade.pair}</p>
                        <p className="text-[10px] text-white/40">{trade.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${trade.type === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {trade.type === 'up' ? '+' : '-'}{trade.amount}
                      </p>
                      <p className="text-[10px] text-white/20 uppercase font-bold tracking-tighter">USDT</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-3">
        <Info className="text-amber-500 shrink-0" size={18} />
        <p className="text-[11px] text-amber-200/60 leading-relaxed">
          Profits are split 80/20 between the user and the Quantum Treasury. Settlement is processed on-chain upon stopping the trade.
        </p>
      </div>
    </div>
  );
}
