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
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle } from "lucide-react";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export type Tab = "wallet" | "trading" | "leaderboard" | "community" | "settings";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("wallet");
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0.00");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showRiskWarning, setShowRiskWarning] = useState(true);

  // Wallet Connection
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
        
        // Sign in to Firebase anonymously or with wallet (simplified for this dApp)
        // In a real app, use a wallet-based auth flow
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Wallet connection failed:", error);
      }
    } else {
      alert("Please open this dApp inside a Web3 wallet browser (MetaMask, TokenPocket, etc.)");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch User Profile
  useEffect(() => {
    if (account && isAuthReady) {
      const userRef = doc(db, "users", account.toLowerCase());
      const unsub = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        } else {
          // Initialize profile
          const initialProfile = {
            uid: account.toLowerCase(),
            username: `User_${account.slice(2, 6)}`,
            totalProfit: 0,
            lastActive: new Date().toISOString(),
            avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${account}`
          };
          setDoc(userRef, initialProfile);
          setUserProfile(initialProfile);
        }
      });
      return () => unsub();
    }
  }, [account, isAuthReady]);

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
        return <WalletTab account={account} balance={balance} connectWallet={connectWallet} />;
      case "trading":
        return <TradingDashboard account={account} balance={balance} />;
      case "leaderboard":
        return <Leaderboard />;
      case "community":
        return <Community userProfile={userProfile} />;
      case "settings":
        return <Settings userProfile={userProfile} />;
      default:
        return <WalletTab account={account} balance={balance} connectWallet={connectWallet} />;
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
    </div>
  );
}
