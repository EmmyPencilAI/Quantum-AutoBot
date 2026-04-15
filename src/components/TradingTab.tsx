import React, { useState, useEffect, useRef, useMemo } from "react";
import { Play, Square, TrendingUp, Activity, AlertTriangle, ChevronRight, Zap, Target, Shield, BarChart2, ArrowDownLeft, DollarSign, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, onSnapshot, updateDoc, collection, query, where, orderBy, limit, setDoc, getDoc } from "firebase/firestore";
import { buildTransferOnChainPTB, buildStartSessionPTB, buildWithdrawSessionPTB, USDT_TYPE, USDC_TYPE, SUI_TREASURY_ADDRESS, getAllBalances } from "../lib/sui";
import { buildPTBFromTradeInstruction } from "../lib/tradeInstructions";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useInitExecutionAdapter } from "../lib/executionAdapter";
import { apiFetch } from "../lib/api";
import { toast } from "sonner";

// ── TradingView Candlestick Chart Component ─────────────────────────────────
const tvSymbolMap: Record<string, string> = {
  "BTC / USDT": "BINANCE:BTCUSDT",
  "ETH / USDT": "BINANCE:ETHUSDT",
  "BNB / USDT": "BINANCE:BNBUSDT",
  "SOL / USDT": "BINANCE:SOLUSDT",
  "SUI / USDT": "BINANCE:SUIUSDT",
  "XRP / USDT": "BINANCE:XRPUSDT",
  "ADA / USDT": "BINANCE:ADAUSDT",
  "DOGE / USDT": "BINANCE:DOGEUSDT",
  "AVAX / USDT": "BINANCE:AVAXUSDT",
  "MATIC / USDT": "BINANCE:MATICUSDT",
};

const TradingViewChart: React.FC<{ pair: string }> = ({ pair }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbolMap[pair] || "BINANCE:BTCUSDT",
      interval: "15",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(10, 10, 10, 1)",
      gridColor: "rgba(255, 255, 255, 0.03)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [pair]);

  return (
    <div className="tradingview-widget-container h-[300px] md:h-[450px] w-full rounded-xl overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
};

interface TradingTabProps {
  user: any;
}


const TradingTab: React.FC<TradingTabProps> = ({ user }) => {
  // ── State ─────────────────────────────────────────────────────────────────
  const [isTrading, setIsTrading] = useState(false);
  const [strategy, setStrategy] = useState("Momentum");
  const [selectedPair, setSelectedPair] = useState("BTC / USDT");
  const [pnl, setPnl] = useState(0);
  const [initialInvestment, setInitialInvestment] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [tradingAsset, setTradingAsset] = useState("USDT");
  const [tradingSessionId, setTradingSessionId] = useState<string | null>(null);
  const [globalActivity, setGlobalActivity] = useState<any[]>([]);

  const currentAccount = useCurrentAccount();
  const executionAdapter = useInitExecutionAdapter();

  // ── Sync with Firestore ───────────────────────────────────────────────────
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
        if (data.tradingAsset) setTradingAsset(data.tradingAsset);
        if (data.tradingSessionId) setTradingSessionId(data.tradingSessionId);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // Fetch trade history
    const tradesRef = collection(db, "trades");
    const q = query(
      tradesRef,
      where("uid", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(200)
    );

    const unsubscribeTrades = onSnapshot(q, (snapshot) => {
      const userTrades = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        time: new Date(doc.data().timestamp).toLocaleString(undefined, { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        }),
        value: doc.data().pnl
      })).reverse();
      
      setHistory(userTrades.length > 0 ? userTrades : [{ time: "Start", value: 0, isMarker: false }]);
      setGlobalActivity(userTrades.slice(0, 50));
    }, (error) => {
      console.error("Error fetching trade history:", error);
    });

    return () => {
      unsubscribeUser();
      unsubscribeTrades();
    };
  }, [user]);

  // ── Trading Pairs & Strategies ────────────────────────────────────────────
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
    { symbol: "MATIC / USDT", logo: "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon_2x.png" },
  ];

  const strategies = [
    { name: "Aggressive", icon: Zap, color: "text-red-400", bg: "bg-red-400/10", desc: "High risk, high reward. Focuses on volatility." },
    { name: "Momentum", icon: Target, color: "text-orange-400", bg: "bg-orange-400/10", desc: "Follows market trends and breakouts." },
    { name: "Scalping", icon: Activity, color: "text-blue-400", bg: "bg-blue-400/10", desc: "Small profits from frequent trades." },
    { name: "Conservative", icon: Shield, color: "text-green-400", bg: "bg-green-400/10", desc: "Low risk, steady growth. Focuses on stability." },
  ];

  const activePairData = tradingPairs.find(p => p.symbol === selectedPair) || tradingPairs[0];
  const fundAmountNum = parseFloat(fundAmount) || 0;
  const canFund = fundAmountNum > 0 && fundAmountNum <= walletBalance && !loading && !isTrading;
  const canStartTrading = initialInvestment > 0 && !isTrading && !loading;

  // ── Fund Trading Account ──────────────────────────────────────────────────
  const fundTrading = async () => {
    if (!user || !canFund) return;
    setLoading(true);
    toast.loading("Funding trading account...", { id: "fund" });

    try {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      const currentWalletBalance = userDoc.exists() ? (userDoc.data().walletBalance || 0) : 0;

      if (fundAmountNum > currentWalletBalance) {
        toast.error("Insufficient wallet balance.", { id: "fund" });
        setLoading(false);
        return;
      }

      // Only add to existing investment if user is actively trading
      // Otherwise reset to prevent stale balance accumulation
      const isCurrentlyTrading = userDoc.exists() ? (userDoc.data().isTrading || false) : false;
      const existingInvestment = isCurrentlyTrading ? (userDoc.data().initialInvestment || 0) : 0;
      const balanceField = tradingAsset === "USDC" ? "usdcBalance" : "usdtBalance";
      const existingAssetBalance = isCurrentlyTrading ? (userDoc.data()[balanceField] || 0) : 0;
      
      await updateDoc(userRef, {
        initialInvestment: existingInvestment + fundAmountNum,
        [balanceField]: existingAssetBalance + fundAmountNum,
        // Clear stale values from the other asset when not trading
        ...(isCurrentlyTrading ? {} : { usdtBalance: tradingAsset === "USDT" ? fundAmountNum : 0, usdcBalance: tradingAsset === "USDC" ? fundAmountNum : 0 }),
        walletBalance: currentWalletBalance - fundAmountNum,
        tradingAsset: tradingAsset,
        totalProfit: isCurrentlyTrading ? (userDoc.data().totalProfit || 0) : 0,
      });

      toast.success(`Funded $${fundAmountNum.toFixed(2)} to trading account!`, { id: "fund" });
      setFundAmount("");
    } catch (e: any) {
      console.error("Funding failed:", e);
      toast.error("Funding failed: " + (e.message || "Unknown error"), { id: "fund" });
    } finally {
      setLoading(false);
    }
  };

  // ── Start Trading ─────────────────────────────────────────────────────────
  const startTrading = async () => {
    if (!user || !canStartTrading) return;
    setLoading(true);
    toast.loading("Starting trading engine...", { id: "start" });

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        isTrading: true,
        activeStrategy: strategy,
        activePair: selectedPair,
        totalProfit: 0,
        timestamp: new Date().toISOString(),
      });
      toast.success("Trading engine started!", { id: "start" });
    } catch (e: any) {
      console.error("Start trading failed:", e);
      toast.error("Failed to start: " + (e.message || "Unknown error"), { id: "start" });
    } finally {
      setLoading(false);
    }
  };

  // ── Stop Trading & Withdraw ───────────────────────────────────────────────
  const stopAndWithdraw = async () => {
    if (!user || !isTrading) return;
    setLoading(true);
    toast.loading("Stopping trade and withdrawing...", { id: "stop" });

    try {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) throw new Error("User not found");

      const data = userDoc.data();
      const currentWalletBalance = data.walletBalance || 0;
      const currentInvestment = data.initialInvestment || 0;
      const profit = data.totalProfit || 0;
      
      // Use the actual trading engine balance as source of truth
      // The backend modifies usdtBalance/usdcBalance every cycle
      const asset = data.tradingAsset || "USDT";
      const engineBalance = asset === "USDC" ? (data.usdcBalance || 0) : (data.usdtBalance || 0);
      
      // The real return is the engine balance (which already includes profits/losses)
      // If engine never ran (balance is 0 but investment exists), fall back to investment + profit
      const totalReturn = engineBalance > 0 ? engineBalance : (currentInvestment + profit);

      // Return all funds to wallet balance and clear trading states
      await updateDoc(userRef, {
        isTrading: false,
        walletBalance: currentWalletBalance + totalReturn,
        initialInvestment: 0,
        usdtBalance: 0,
        usdcBalance: 0,
        totalProfit: 0,
        tradingSessionId: null,
      });

      const actualProfit = totalReturn - currentInvestment;
      if (actualProfit > 0.001) {
        toast.success(`Trade closed! Returned $${totalReturn.toFixed(2)} (Profit: +$${actualProfit.toFixed(2)})`, { id: "stop" });
      } else if (actualProfit < -0.001) {
        toast.success(`Trade closed. Returned $${totalReturn.toFixed(2)} (Loss: $${actualProfit.toFixed(2)})`, { id: "stop" });
      } else {
        toast.success(`Trade closed. $${totalReturn.toFixed(2)} returned to wallet.`, { id: "stop" });
      }

      // Add Trade Session End marker to database natively
      if (currentInvestment > 0) {
        await setDoc(doc(collection(db, "trades")), {
          uid: user.uid,
          pair: selectedPair,
          type: "SESSION_END",
          amount: Math.abs(actualProfit),
          asset: asset,
          pnl: actualProfit,
          strategy: strategy,
          timestamp: new Date().toISOString(),
          isMarker: true,
          markerLabel: actualProfit >= 0 ? `+${actualProfit.toFixed(2)}` : `${actualProfit.toFixed(2)}`
        });
      }
      
    } catch (e: any) {
      console.error("Stop trading failed:", e);
      toast.error("Failed to stop: " + (e.message || "Unknown error"), { id: "stop" });
    } finally {
      setLoading(false);
    }
  };

  const changePair = (newPair: string) => {
    if (isTrading) return;
    setSelectedPair(newPair);
  };

  const changeStrategy = (newStrategy: string) => {
    if (isTrading) return;
    setStrategy(newStrategy);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* Header */}
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

      {/* ═══════ IDLE STATE: Setup & Fund ═══════ */}
      {!isTrading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* LEFT COLUMN: Fund + Config */}
          <div className="lg:col-span-1 space-y-4 md:space-y-6">

            {/* Trading Balance Card */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 md:p-6 shadow-xl">
              <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-2">Trading Balance</p>
              <div className="flex items-end gap-2">
                <h3 className="text-3xl md:text-4xl font-bold tracking-tighter text-orange-400">
                  ${initialInvestment.toFixed(2)}
                </h3>
                <span className="text-white/40 font-bold mb-1 text-xs">{tradingAsset}</span>
              </div>
              <p className="mt-2 text-[10px] text-white/30">
                Wallet balance: <span className="text-white/50 font-bold">${walletBalance.toFixed(2)}</span>
              </p>
            </div>

            {/* Fund Trading */}
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500 flex items-center gap-2">
                <DollarSign size={14} /> Fund Trading Account
              </h3>
              <p className="text-[10px] text-white/40">
                Enter the amount you want to allocate for trading from your wallet balance.
              </p>

              <div className="flex gap-2 mb-2">
                {["SUI", "USDT", "USDC"].map((asset) => (
                  <button
                    key={asset}
                    onClick={() => setTradingAsset(asset)}
                    disabled={isTrading || loading}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                      tradingAsset === asset
                        ? "bg-orange-500 border-orange-500 text-black"
                        : "bg-white/5 border-white/10 text-white/40"
                    }`}
                  >
                    {asset}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  disabled={isTrading || loading}
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50"
                  placeholder={`Amount (max $${walletBalance.toFixed(2)})`}
                />
                <button
                  onClick={fundTrading}
                  disabled={!canFund}
                  className="bg-orange-500 text-black px-5 py-2.5 rounded-xl text-xs font-bold hover:scale-105 transition-transform disabled:opacity-50 whitespace-nowrap"
                >
                  {loading ? "Processing..." : "Fund"}
                </button>
              </div>
            </div>

            {/* Select Trading Pair */}
            <div className="space-y-3">
              <h3 className="text-sm md:text-lg font-bold tracking-tight">Select Trading Pair</h3>
              <div className="grid grid-cols-2 gap-2">
                {tradingPairs.map((pair) => (
                  <button
                    key={pair.symbol}
                    onClick={() => changePair(pair.symbol)}
                    disabled={loading}
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

            {/* Select Strategy */}
            <div className="space-y-3">
              <h3 className="text-sm md:text-lg font-bold tracking-tight">Select Strategy</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 md:gap-3">
                {strategies.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => changeStrategy(s.name)}
                    disabled={loading}
                    className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all text-left ${
                      strategy === s.name
                        ? "bg-white/5 border-orange-500 shadow-lg shadow-orange-500/10"
                        : "bg-[#0a0a0a] border-white/10 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className={`w-8 h-8 md:w-10 md:h-10 shrink-0 ${s.bg} ${s.color} rounded-lg md:rounded-xl flex items-center justify-center`}>
                      <s.icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs md:text-base truncate">{s.name}</p>
                      <p className="text-[8px] md:text-xs text-white/40 leading-tight line-clamp-1">{s.desc}</p>
                    </div>
                    {strategy === s.name && <ChevronRight className="text-orange-500 shrink-0" size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Summary + Start */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Trade Summary Card */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl">
              <h3 className="text-lg md:text-xl font-bold mb-6 flex items-center gap-2">
                <BarChart2 size={20} className="text-orange-500" /> Trade Summary
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <p className="text-[9px] md:text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Investment</p>
                  <p className="text-xl md:text-2xl font-bold text-orange-400">${initialInvestment.toFixed(2)}</p>
                  <p className="text-[9px] text-white/30 mt-1">{tradingAsset}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <p className="text-[9px] md:text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Trading Pair</p>
                  <div className="flex items-center gap-2 mt-1">
                    <img src={activePairData.logo} alt={selectedPair} className="w-5 h-5 md:w-6 md:h-6 object-contain" referrerPolicy="no-referrer" />
                    <p className="text-lg md:text-xl font-bold">{selectedPair}</p>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <p className="text-[9px] md:text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Strategy</p>
                  <p className="text-lg md:text-xl font-bold text-orange-400">{strategy}</p>
                </div>
              </div>

              {initialInvestment <= 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] md:text-xs text-yellow-200/80">
                    Fund your trading account first before starting a trade.
                  </p>
                </div>
              )}

              <button
                onClick={startTrading}
                disabled={!canStartTrading}
                className="w-full py-4 md:py-6 rounded-xl md:rounded-2xl font-bold text-base md:text-xl flex items-center justify-center gap-2 md:gap-3 transition-all bg-green-500 text-black hover:bg-green-400 shadow-xl shadow-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Play size={20} fill="currentColor" />
                <span>{loading ? "Starting..." : "Start Trading"}</span>
              </button>
            </div>

            {/* Recent Trade History (preview while idle) */}
            {history.length > 1 && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl">
                <h3 className="text-sm md:text-base font-bold mb-4 flex items-center gap-2 text-white/60">
                  <Activity size={16} /> Previous Trade History
                </h3>
                <div className="h-32 md:h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="colorValueIdle" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                        itemStyle={{ color: "#a855f7" }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorValueIdle)" animationDuration={500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ ACTIVE STATE: Live Trading ═══════ */}
      {isTrading && (
        <div className="space-y-4 md:space-y-6">
          {/* Active Trade Info Bar */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl md:rounded-2xl p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="text-xs md:text-sm font-bold text-green-400">Trade Active</p>
                <p className="text-[10px] text-white/40">
                  {selectedPair} · {strategy} · ${initialInvestment.toFixed(2)} invested
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <img src={activePairData.logo} alt={selectedPair} className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
              <span className="text-sm font-bold">{selectedPair}</span>
              <span className="text-[10px] text-orange-400 font-bold bg-orange-400/10 px-2 py-0.5 rounded-full">{strategy}</span>
            </div>
          </div>

          {/* Live PnL + TradingView Chart */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-8 relative overflow-hidden shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-8">
              <div>
                <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-1">Live Profit/Loss</p>
                <h3 className={`text-3xl md:text-5xl font-bold tracking-tighter ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)} <span className="text-base md:text-2xl opacity-60">USDT</span>
                </h3>
              </div>
              <div className="sm:text-right">
                <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-1">Total Balance</p>
                <p className="text-lg md:text-2xl font-bold">${(initialInvestment + pnl).toFixed(2)}</p>
              </div>
            </div>

            {/* TradingView Candlestick Chart */}
            <TradingViewChart pair={selectedPair} />
          </div>

          {/* PnL Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Invested</p>
              <p className="text-base md:text-xl font-bold">${initialInvestment.toFixed(2)}</p>
            </div>
            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Current Value</p>
              <p className="text-base md:text-xl font-bold">${(initialInvestment + pnl).toFixed(2)}</p>
            </div>
            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-xs text-white/40 font-bold uppercase tracking-widest mb-1">P&L</p>
              <p className={`text-base md:text-xl font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
              </p>
            </div>
            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 md:p-4">
              <p className="text-[9px] md:text-xs text-white/40 font-bold uppercase tracking-widest mb-1">ROI</p>
              <p className={`text-base md:text-xl font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {initialInvestment > 0 ? `${((pnl / initialInvestment) * 100).toFixed(2)}%` : "0.00%"}
              </p>
            </div>
          </div>

          {/* Stop & Withdraw Button */}
          <button
            onClick={stopAndWithdraw}
            disabled={loading}
            className="w-full py-4 md:py-6 rounded-xl md:rounded-2xl font-bold text-base md:text-xl flex items-center justify-center gap-2 md:gap-3 transition-all bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 shadow-xl shadow-red-500/5"
          >
            <Square size={18} fill="currentColor" />
            <span>{loading ? "Processing..." : "Stop & Withdraw to Wallet"}</span>
          </button>

          {/* Trade Activity Feed */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="text-base md:text-xl font-bold tracking-tight flex items-center gap-2">
                <Activity size={18} className="text-orange-500" />
                <span>Trade Activity Feed</span>
              </h3>
              <div className="text-[9px] md:text-xs text-white/40 bg-white/5 px-2 md:px-3 py-1 rounded-full border border-white/10">
                Live Updates
              </div>
            </div>
            <div className="space-y-3 md:space-y-4 max-h-[400px] md:max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence>
                {globalActivity.length > 0 ? (
                  globalActivity.map((trade: any) => (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/5"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center font-bold text-[10px] md:text-xs ${trade.type === "Buy" || trade.type === "BUY" ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"}`}>
                          {trade.type === "Buy" || trade.type === "BUY" ? "BUY" : "SELL"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs md:text-base truncate">{trade.pair}</p>
                          <p className="text-[9px] md:text-xs text-white/40 truncate">
                            {(trade.amount && trade.amount >= 0.01) ? trade.amount.toFixed(2) : (trade.amount ? trade.amount.toFixed(6) : "0.00")} USDT • {trade.duration || 0}s
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold text-xs md:text-base ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {trade.pnl >= 0 ? "+" : ""}{Math.abs(trade.pnl) >= 0.01 ? trade.pnl.toFixed(4) : trade.pnl.toFixed(8)} USDT
                        </p>
                        <p className="text-[9px] md:text-xs text-white/40">{trade.time}</p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 md:py-10 text-white/20">
                    <TrendingUp size={32} className="mb-3 md:mb-4 opacity-10" />
                    <p className="text-xs md:text-sm font-bold uppercase tracking-widest">Waiting for trades...</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingTab;
