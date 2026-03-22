import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import { CONFIG, USDT_ABI, QUANTUM_ABI } from "./config";
import { Layout } from "./components/Layout";
import { TradingDashboard } from "./components/TradingDashboard";
import { WalletTab } from "./components/WalletTab";
import { Leaderboard } from "./components/Leaderboard";
import { Community } from "./components/Community";
import { Settings } from "./components/Settings";
import { Markets } from "./components/Markets";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X, CheckCircle2, AlertCircle, Info as InfoIcon } from "lucide-react";

declare global {
  interface Window {
    ethereum?: any;
    TradingView?: any;
  }
}

export type Tab = "wallet" | "trading" | "leaderboard" | "community" | "settings" | "markets";

interface Notification {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ModalConfig {
  title: string;
  message: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
  type: "alert" | "confirm" | "prompt";
  placeholder?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("wallet");
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0.00");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showRiskWarning, setShowRiskWarning] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [promptValue, setPromptValue] = useState("");

  // Trading State (Lifted for persistence)
  const [isTrading, setIsTrading] = useState(() => {
    const saved = localStorage.getItem("isTrading");
    return saved === "true";
  });
  const [tradingAmount, setTradingAmount] = useState(() => localStorage.getItem("tradingAmount") || "");
  const [tradingPnl, setTradingPnl] = useState(() => parseFloat(localStorage.getItem("tradingPnl") || "0"));
  const [tradingChartData, setTradingChartData] = useState<any[]>(() => {
    const saved = localStorage.getItem("tradingChartData");
    return saved ? JSON.parse(saved) : [];
  });
  const [tradingStrategy, setTradingStrategy] = useState(() => localStorage.getItem("tradingStrategy") || CONFIG.STRATEGIES[0]);
  const [tradingPair, setTradingPair] = useState(() => localStorage.getItem("tradingPair") || CONFIG.PAIRS[0]);
  const [tradingHistory, setTradingHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem("tradingHistory");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("isTrading", isTrading.toString());
    localStorage.setItem("tradingAmount", tradingAmount);
    localStorage.setItem("tradingPnl", tradingPnl.toString());
    localStorage.setItem("tradingChartData", JSON.stringify(tradingChartData));
    localStorage.setItem("tradingStrategy", tradingStrategy);
    localStorage.setItem("tradingPair", tradingPair);
    localStorage.setItem("tradingHistory", JSON.stringify(tradingHistory));
  }, [isTrading, tradingAmount, tradingPnl, tradingChartData, tradingStrategy, tradingPair, tradingHistory]);

  useEffect(() => {
    let interval: any;
    if (isTrading) {
      interval = setInterval(() => {
        const change = (Math.random() * 2 - 0.9) * (tradingStrategy === "Aggressive" ? 2 : 1);
        setTradingPnl(prev => prev + change);
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        
        setTradingChartData(prev => {
          const newData = [
            ...prev.slice(-19),
            { time: timeStr, value: (prev[prev.length - 1]?.value || 0) + change }
          ];
          return newData;
        });

        setTradingHistory(prev => {
          const newTrade = {
            id: Math.random().toString(36).substring(2, 9),
            time: timeStr,
            type: change >= 0 ? "up" : "down",
            amount: Math.abs(change).toFixed(4),
            pair: tradingPair
          };
          return [newTrade, ...prev.slice(0, 99)];
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isTrading, tradingStrategy, tradingPair]);

  const notify = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const showAlert = (title: string, message: string) => {
    setModal({ title, message, type: "alert" });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModal({ title, message, type: "confirm", onConfirm });
  };

  const showPrompt = (title: string, message: string, placeholder: string, onConfirm: (value: string) => void) => {
    setPromptValue("");
    setModal({ title, message, type: "prompt", placeholder, onConfirm });
  };

  // Wallet Connection
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
        
        // Graceful auth for community features
        try {
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
        } catch (authError) {
          console.warn("Firebase anonymous auth failed, community features may be limited:", authError);
        }
        
        notify("Wallet connected successfully!", "success");
      } catch (error: any) {
        console.error("Wallet connection failed:", error);
        notify(error.message || "Wallet connection failed", "error");
      }
    } else {
      showAlert("Wallet Not Found", "Please open this dApp inside a Web3 wallet browser (MetaMask, TokenPocket, etc.)");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch User Profile (Firestore)
  const fetchProfile = useCallback(async () => {
    if (account && auth.currentUser) {
      try {
        const profileRef = doc(db, "users", auth.currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          setUserProfile({ uid: auth.currentUser.uid, ...profileSnap.data() });
        } else {
          const newProfile = {
            walletAddress: account.toLowerCase(),
            username: `User_${account.slice(2, 6)}`,
            totalProfit: 0,
            avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${account}`,
            lastActive: new Date().toISOString(),
            role: "user"
          };
          await setDoc(profileRef, newProfile);
          setUserProfile({ uid: auth.currentUser.uid, ...newProfile });
        }
      } catch (error) {
        console.error("Firestore profile error:", error);
      }
    }
  }, [account]);

  useEffect(() => {
    if (isAuthReady && account) {
      fetchProfile();
    }
  }, [fetchProfile, isAuthReady, account]);

  // Fetch Balance
  const updateBalance = useCallback(async () => {
    if (account) {
      try {
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const usdtContract = new ethers.Contract(CONFIG.USDT_ADDRESS, USDT_ABI, provider);
        const bal = await usdtContract.balanceOf(account);
        setBalance(ethers.formatUnits(bal, 18));
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      }
    }
  }, [account]);

  useEffect(() => {
    updateBalance();
    const interval = setInterval(updateBalance, 30000);
    return () => clearInterval(interval);
  }, [updateBalance]);

  const renderTab = () => {
    switch (activeTab) {
      case "wallet":
        return <WalletTab account={account} balance={balance} connectWallet={connectWallet} notify={notify} showPrompt={showPrompt} showAlert={showAlert} />;
      case "trading":
        return (
          <TradingDashboard 
            account={account} 
            balance={balance} 
            showAlert={showAlert} 
            notify={notify}
            isTrading={isTrading}
            setIsTrading={setIsTrading}
            pnl={tradingPnl}
            setPnl={setTradingPnl}
            chartData={tradingChartData}
            setChartData={setTradingChartData}
            amount={tradingAmount}
            setAmount={setTradingAmount}
            strategy={tradingStrategy}
            setStrategy={setTradingStrategy}
            pair={tradingPair}
            setPair={setTradingPair}
            history={tradingHistory}
            updateBalance={updateBalance}
            refreshProfile={fetchProfile}
            setActiveTab={setActiveTab}
          />
        );
      case "leaderboard":
        return <Leaderboard />;
      case "community":
        return <Community userProfile={userProfile} notify={notify} />;
      case "settings":
        return <Settings userProfile={userProfile} showConfirm={showConfirm} notify={notify} refreshProfile={fetchProfile} />;
      case "markets":
        return <Markets />;
      default:
        return <WalletTab account={account} balance={balance} connectWallet={connectWallet} notify={notify} showPrompt={showPrompt} showAlert={showAlert} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">
      <AnimatePresence>
        {showRiskWarning && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-50 bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 max-w-4xl mx-auto w-full px-4">
              <AlertTriangle className="text-amber-500 shrink-0" size={20} />
              <p className="text-xs text-amber-200/80 leading-tight">
                ⚠️ Crypto trading is highly risky. Profits are not guaranteed. Quantum Finance is an automated trading tool, not financial advice.
              </p>
              <button 
                onClick={() => setShowRiskWarning(false)}
                className="text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Layout activeTab={activeTab} setActiveTab={setActiveTab} account={account}>
        <div className="pt-16 pb-24 max-w-lg mx-auto px-4 min-h-screen flex flex-col">
          {renderTab()}
        </div>
      </Layout>

      {/* Notifications */}
      <div className="fixed bottom-24 left-4 right-4 z-[100] pointer-events-none flex flex-col gap-2">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`pointer-events-auto p-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl ${
                n.type === "success" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" :
                n.type === "error" ? "bg-red-500/20 border-red-500/30 text-red-400" :
                "bg-blue-500/20 border-blue-500/30 text-blue-400"
              }`}
            >
              {n.type === "success" ? <CheckCircle2 size={18} /> : 
               n.type === "error" ? <AlertCircle size={18} /> : 
               <InfoIcon size={18} />}
              <p className="text-sm font-medium">{n.message}</p>
              <button onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))} className="ml-auto opacity-50 hover:opacity-100">
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Custom Modal */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => modal.type === "alert" && setModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-2">{modal.title}</h3>
              <p className="text-white/60 text-sm mb-6 leading-relaxed">{modal.message}</p>
              
              {modal.type === "prompt" && (
                <input
                  type="text"
                  autoFocus
                  placeholder={modal.placeholder}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:border-emerald-500/50 mb-6"
                />
              )}

              <div className="flex gap-3">
                {modal.type !== "alert" && (
                  <button
                    onClick={() => {
                      modal.onCancel?.();
                      setModal(null);
                    }}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => {
                    if (modal.type === "prompt") {
                      modal.onConfirm?.(promptValue);
                    } else {
                      modal.onConfirm?.();
                    }
                    setModal(null);
                  }}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
                >
                  {modal.type === "alert" ? "OK" : "Confirm"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
