import React, { useState, useEffect, useMemo } from "react";
import { Play, Square, TrendingUp, Activity, AlertTriangle, ChevronRight, Zap, Target, Shield, BarChart2, ArrowDownLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, onSnapshot, updateDoc, collection, query, where, orderBy, limit, setDoc, getDoc } from "firebase/firestore";
import { buildTransferOnChainPTB, buildStartSessionPTB, buildWithdrawSessionPTB, USDT_TYPE, USDC_TYPE, SUI_TREASURY_ADDRESS, getAllBalances } from "../lib/sui";
import { buildPTBFromTradeInstruction } from "../lib/tradeInstructions";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useInitExecutionAdapter } from "../lib/executionAdapter";
import { apiFetch } from "../lib/api";
import { toast } from "sonner";

interface TradingTabProps {
  user: any;
}

const TradingTab: React.FC<TradingTabProps> = ({ user }) => {
  const [isTrading, setIsTrading] = useState(false);
  const [strategy, setStrategy] = useState("Momentum");
  const [selectedPair, setSelectedPair] = useState("BTC / USDT");
  const [pnl, setPnl] = useState(0);
  const [initialInvestment, setInitialInvestment] = useState(0);
    const [walletBalance, setWalletBalance] = useState(0);
    const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fundAmount, setFundAmount] = useState("0");
  
  const [tradingAsset, setTradingAsset] = useState("USDT");
  const [tradingSessionId, setTradingSessionId] = useState<string | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAsset, setWithdrawAsset] = useState("USDT");

  const currentAccount = useCurrentAccount(); // Added for UI/Execution isolation
  const executionAdapter = useInitExecutionAdapter();

  

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
        setInitialInvestment(data.isTrading ? (data.initialInvestment || 0) : 0);
        if (data.tradingAsset) setTradingAsset(data.tradingAsset);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // Fetch only THIS user's trade history — never read other users' trades
    const tradesRef = collection(db, "trades");
    const q = query(
      tradesRef,
      where("uid", "==", user.uid),   // PRIVACY: scoped to current user only
      orderBy("timestamp", "desc"),
      limit(200)
    );

    const unsubscribeTrades = onSnapshot(q, (snapshot) => {
      const userTrades = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        time: new Date(doc.data().timestamp).toLocaleString(undefined, { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        value: doc.data().pnl
      })).reverse();
      
      setHistory(userTrades.length > 0 ? userTrades : [{ time: "Start", value: 0 }]);
      setGlobalActivity(userTrades.slice(0, 50)); // Only own trades in activity feed
    }, (error) => {
      console.error("Error fetching trade history:", error);
    });

    return () => {
      unsubscribeUser();
      unsubscribeTrades();
    };
  }, [user]);

  const [globalActivity, setGlobalActivity] = useState<any[]>([]);

  const toggleTrading = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const isDemoMode = import.meta.env.VITE_MODE === "demo";
      
      if (isTrading) {
        // Settlement logic
        if (isDemoMode) {
          // Demo mode: Just stop trading and show success
          setIsTrading(false);
          setPnl(0);
          setInitialInvestment(0);
          toast.success("Trading stopped! Demo mode.", { id: "settle" });
        } else {
          if (!tradingSessionId) {
            toast.error("Trading session ID not found. Resetting state...", { id: "settle" });
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
              isTrading: false,
              initialInvestment: 0,
              totalProfit: 0,
              tradingSessionId: null,
            });
            setIsTrading(false);
            setLoading(false);
            return;
          }

          toast.loading("Settling trades on-chain...", { id: "settle" });
          
          // Execute on-chain withdrawal
          const tx = buildWithdrawSessionPTB(tradingSessionId);
          const txResult = await executionAdapter.executeTransaction(tx);
          
          if (!txResult) {
            throw new Error("On-chain settlement failed or was rejected");
          }
          
          // apiFetch sends Firebase ID token in Authorization header
          const result = await apiFetch<{ success: boolean; totalToUser: number; txHash: string | null }>(
            "/api/trading/settle",
            {
              method: "POST",
              body: JSON.stringify({ uid: user.uid, walletAddress: currentAccount?.address }),
            }
          );
          if (result.success) {
            console.log("Settlement successful:", result);
            toast.success(
              `Settlement complete! ${result.totalToUser?.toFixed(2)} USD returned to wallet.${
                result.txHash ? ` TX: ${result.txHash.slice(0, 12)}...` : ""
              }`,
              { id: "settle" }
            );
          } else {
            throw new Error("Settlement failed");
          }
        }
      } else {
        // Start trading
        if (initialInvestment <= 0) {
          toast.error("Please fund your trading account first.");
          setLoading(false);
          return;
        }
        
        if (isDemoMode) {
          // Demo mode: Just start trading
          setIsTrading(true);
          toast.success("Trading engine started! (Demo mode)", { id: "settle" });
        } else {
          const userRef = doc(db, "users", user.uid);
          if (!userRef) {
            toast.error("Firestore not available.", { id: "settle" });
            setLoading(false);
            return;
          }
          await updateDoc(userRef, {
            isTrading: true,
            activeStrategy: strategy,
            activePair: selectedPair,
            timestamp: new Date().toISOString()
          });
          toast.success("Trading engine started!");
        }
      }
    } catch (e: any) {
      console.error("Trading toggle failed:", e);
      toast.error("Action failed: " + (e.message || "Unknown error"), { id: "settle" });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !withdrawAmount || !withdrawAddress) {
      toast.error("Please fill in all fields");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }

    setLoading(true);
    toast.loading("Processing withdrawal...", { id: "withdraw" });

    try {
      const userRef = doc(db, "users", user.uid);
      const isDemoMode = import.meta.env.VITE_MODE === "demo";
      
      let currentBalance = 0;
      try {
        const { getDoc } = await import("firebase/firestore");
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
           const data = userDoc.data();
           currentBalance = data.walletBalance || 0;
           if (amount > currentBalance) {
              toast.error("Insufficient wallet balance", { id: "withdraw" });
              setLoading(false);
              return;
           }
        }
      } catch (e) {
           console.error("Balance check failed", e);
           toast.error("Failed to check balance", { id: "withdraw" });
           setLoading(false);
           return;
      }

      if (isDemoMode) {
        toast.success("Withdrawal successful! (Demo mode)", { id: "withdraw" });
      } else {
        try {
          await apiFetch("/api/wallet/withdraw", {
            method: "POST",
            body: JSON.stringify({
              uid: user.uid,
              amount,
              asset: withdrawAsset,
              walletAddress: withdrawAddress,
            }),
          });
          toast.success("Withdrawal successfully submitted to network!", { id: "withdraw" });
        } catch (e: any) {
          console.error("Withdrawal error:", e);
          toast.error(e.message || "Withdrawal failed.", { id: "withdraw" });
        }
      }
      
      setShowWithdrawModal(false);
      setWithdrawAmount("");
    } catch (error: any) {
      console.error("Withdrawal failed:", error);
      toast.error(error.message || "Withdrawal failed", { id: "withdraw" });
    } finally {
      setLoading(false);
    }
  };

    const fundTrading = async () => {
      if (!user || isTrading || !currentAccount) {
        if (!currentAccount) toast.error("Wallet not connected");
        return;
      }
      const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount to fund.");
      return;
    }

    setLoading(true);
    toast.loading("Processing on-chain funding...", { id: "fund" });
    try {
        const executionAddress = currentAccount.address;
        const balances = await getAllBalances(executionAddress);
        
        let currentOnChainBalance = 0;
        if (tradingAsset === "SUI") currentOnChainBalance = balances.sui;
        else if (tradingAsset === "USDC") currentOnChainBalance = balances.usdc;
        else currentOnChainBalance = balances.usdt;

        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        const currentWalletBalance = userDoc.exists() ? (userDoc.data().walletBalance || 0) : 0;
        
        const useInternalBalance = amount <= currentWalletBalance;

        if (amount > currentOnChainBalance && !useInternalBalance) {
          toast.error(`Insufficient balance. You have ${currentOnChainBalance.toFixed(2)} ${tradingAsset} on-chain and ${currentWalletBalance.toFixed(2)} USD in app wallet.`, { id: "fund" });
          setLoading(false);
          return;
        }

        if (!useInternalBalance && balances.sui < 0.01) {
          toast.error("Insufficient SUI for gas. Please receive some SUI first.", { id: "fund" });
          setLoading(false);
          return;
        }

        if (useInternalBalance) {
          console.log(`Funding ${amount} from internal app balance...`);
          const balanceField = tradingAsset === "USDC" ? "usdcBalance" : "usdtBalance";
          await updateDoc(userRef, {
            isTrading: true,
            initialInvestment: amount,
            [balanceField]: amount,
            walletBalance: currentWalletBalance - amount,
            tradingAsset: tradingAsset,
            activeStrategy: strategy,
            activePair: selectedPair,
            totalProfit: 0,
            tradingSessionId: null
          });
          toast.success(`Successfully funded ${amount} ${tradingAsset} from your App Wallet!`, { id: "fund" });
          setFundAmount("0");
          setLoading(false);
          return;
        }

        console.log(`Funding ${amount} from on-chain...`);
        let sessionId = null;

        const actionType = tradingAsset === "SUI" ? "START_SESSION" : "DEPOSIT";
        
        // 1. Request trade intent from backend (requires authenticated user)
        const { instruction } = await apiFetch<{ instruction: any }>(
          "/api/trade/execute-intent",
          {
            method: "POST",
            body: JSON.stringify({
              uid: user.uid,
              action: actionType,
              asset: tradingAsset,
              amount: amount,
              strategyId: strategy,
            }),
          }
        );
        
        // 2. Build the exact PTB via Frontend mapping using the connected Wallet
        const senderAddress = currentAccount.address;
        const tx = await buildPTBFromTradeInstruction(instruction, senderAddress);

        // 3. User Signs and Executes Transaction (100% Non-Custodial)
        const result = await executionAdapter.executeTransaction(tx);

        // Optional logic for Move Call session IDs extraction
        if (actionType === "START_SESSION") {
          const sessionObject = result.objectChanges?.find(
            (change: any) =>
              change.type === "created" &&
              change.objectType.includes("::trading::TradingSession")
          );

          if (!sessionObject || !("objectId" in sessionObject)) {
            throw new Error("TradingSession object not found in transaction results");
          }
          sessionId = sessionObject.objectId;
        }

        // 4. Sync verified on-chain result back to backend
        await apiFetch("/api/trade/sync-result", {
          method: "POST",
          body: JSON.stringify({
            uid: user.uid,
            intentId: instruction.intentId,
            digest: result.digest,
            success: true,
          }),
        });

        // const userRef = doc(db, "users", user.uid); // Already defined above
        const balanceField = tradingAsset === "USDC" ? "usdcBalance" : "usdtBalance";
        await updateDoc(userRef, {
          isTrading: true,
          initialInvestment: amount,
          [balanceField]: amount,
          tradingAsset: tradingAsset,
          activeStrategy: strategy,
          activePair: selectedPair,
          totalProfit: 0,
          tradingSessionId: sessionId
        });

        toast.success(`Successfully funded ${amount} ${tradingAsset} securely on-chain!`, { id: "fund" });
      setFundAmount("0");
    } catch (e: any) {
      console.error("Funding failed:", e);
      toast.error("Funding failed: " + (e.message || "Unknown error"), { id: "fund" });
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
    } catch (e: any) {
      console.error("Strategy change failed:", e);
      toast.error("Strategy change failed: " + (e.message || "Unknown error"));
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
    } catch (e: any) {
      console.error("Pair change failed:", e);
      toast.error("Pair change failed: " + (e.message || "Unknown error"));
    }
  };

  const withdrawProfit = async () => {
    if (!user || pnl <= 0) return;
    setLoading(true);
    toast.loading("Withdrawing profit to wallet balance...", { id: "withdraw-profit" });
    try {
      const isDemoMode = import.meta.env.VITE_MODE === "demo";
        const userRef = doc(db, "users", user.uid);
        
        try {
          const { getDoc } = await import("firebase/firestore");
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
             const data = userDoc.data();
             const currentWalletBalance = data.walletBalance || 0;
             const currentProfit = data.totalProfit || 0;
             
             if (currentProfit > 0) {
               await updateDoc(userRef, {
                   walletBalance: currentWalletBalance + currentProfit,
                   totalProfit: 0
               });
               setPnl(0);
             }
          }
        } catch (dbErr) {
             console.error("Direct db withdraw failed", dbErr);
        }

        if (isDemoMode) {
          toast.success(`Successfully withdrawn to wallet! (Demo mode)`, { id: "withdraw-profit" });
        } else {
          try {
            const result = await apiFetch<{ success: boolean; withdrawn: number }>(
              "/api/trading/withdraw-profit",
              {
                method: "POST",
                body: JSON.stringify({ uid: user.uid, walletAddress: currentAccount?.address }),
              }
            );
            if (result.success) {
              toast.success(`Withdrawn ${result.withdrawn?.toFixed(2)} to wallet balance!`, { id: "withdraw-profit" });
            }
          } catch (e: any) {
            console.error("Profit withdrawal failed:", e);
            toast.error(e.message || "Profit withdrawal failed", { id: "withdraw-profit" });
          }
        }
      } catch (e: any) {
        console.error("Profit withdrawal failed:", e);
        toast.error(e.message || "Withdrawal failed", { id: "withdraw-profit" });
      } finally {
        setLoading(false);
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
    // The background trading engine in server.ts handles trade generation
    // We just listen to Firestore updates for real-time data
    return () => {};
  }, [isTrading]);

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
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500">Fund Trading Account</h3>
            <button 
              onClick={() => setShowWithdrawModal(true)}
              className="text-[10px] font-bold text-orange-500 hover:underline flex items-center gap-1"
            >
              Withdraw to On-chain Wallet
            </button>
          </div>
          
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
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-500/50"
              placeholder={`Amount (${tradingAsset})`}
            />
            <button
              onClick={fundTrading}
              disabled={isTrading || loading}
              className="bg-orange-500 text-black px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 transition-transform disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? "Processing..." : "Fund & Start"}
            </button>
          </div>
          <p className="text-[10px] text-white/40">
            Connected: <span className="text-blue-400 font-bold">{currentAccount ? 'Yes' : 'No'}</span>
          </p>
          <p className="text-[10px] text-white/40">
            Trading Balance: <span className="text-green-400 font-bold">{(initialInvestment + pnl).toFixed(2)} {tradingAsset}</span>
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

          {isTrading && (
            <div className="space-y-3">
              <button
                onClick={withdrawProfit}
                disabled={loading || pnl <= 0}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-green-500/10 border border-green-500/20 text-green-500 hover:bg-green-500/20 disabled:opacity-50"
              >
                <ArrowDownLeft size={16} />
                <span>Withdraw Profit to Wallet Balance</span>
              </button>
              <button
                onClick={toggleTrading}
                disabled={loading}
                className="w-full py-4 md:py-6 rounded-xl md:rounded-3xl font-bold text-base md:text-xl flex items-center justify-center gap-2 md:gap-3 transition-all bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 shadow-xl shadow-red-500/5"
              >
                <Square size={18} className="md:w-6 md:h-6" fill="currentColor" />
                <span className="truncate text-sm md:text-xl">{loading ? "Processing..." : "Stop & Withdraw to Wallet Balance"}</span>
              </button>
            </div>
          )}
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
                <Activity size={18} className="text-orange-500 md:w-5 md:h-5" />
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
                    <p className="text-xs md:text-sm font-bold uppercase tracking-widest">Waiting for trades...</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl md:text-2xl font-bold mb-6">Withdraw to On-chain Wallet</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 block">Select Asset</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["USDT", "USDC", "SUI"].map((a) => (
                      <button
                        key={a}
                        onClick={() => setWithdrawAsset(a)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${withdrawAsset === a ? "bg-orange-500 border-orange-500 text-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 block">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-bold focus:outline-none focus:border-orange-500/50 transition-all"
                    />
                    <button 
                      onClick={() => setWithdrawAmount((walletBalance || 0).toString())}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-500 hover:text-orange-400"
                    >
                      MAX
                    </button>
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">Smart Contract Balance Enforced</p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 block">Destination Address</label>
                  <input
                    type="text"
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-mono text-xs focus:outline-none focus:border-orange-500/50 transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowWithdrawModal(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={loading || !withdrawAmount || !withdrawAddress}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
                  >
                    {loading ? "Processing..." : "Withdraw"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TradingTab;


