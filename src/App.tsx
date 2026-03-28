import React, { useState, useEffect } from "react";
import { auth, googleProvider, facebookProvider, appleProvider, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { TrendingUp, Shield, Globe, Zap, ArrowRight, Chrome, Facebook, Apple } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Layout from "./components/Layout";
import WalletTab from "./components/WalletTab";
import MarketsTab from "./components/MarketsTab";
import TradingTab from "./components/TradingTab";
import LeaderboardTab from "./components/LeaderboardTab";
import CommunityTab from "./components/CommunityTab";
import SettingsTab from "./components/SettingsTab";
import { deriveSuiWallet } from "./lib/sui";

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user document exists in Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const keypair = deriveSuiWallet(user.uid);
          await setDoc(userRef, {
            uid: user.uid,
            username: user.displayName || "Quantum Trader",
            avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
            suiWallet: keypair.toSuiAddress(),
            suiBalance: 0,
            usdtBalance: 1000, // Starting demo balance
            totalProfit: 0,
            activeStrategy: "None",
            isTrading: false,
            region: "Global",
            createdAt: new Date().toISOString(),
          });
        }
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (provider: any) => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Login failed:", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center animate-bounce shadow-2xl shadow-orange-500/20">
            <TrendingUp size={32} className="text-black" />
          </div>
          <p className="text-white/40 font-bold uppercase tracking-widest animate-pulse">Initializing Quantum...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl w-full text-center space-y-10 relative z-10"
        >
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/20">
              <TrendingUp size={40} className="text-black" />
            </div>
            <h1 className="text-6xl font-bold tracking-tighter uppercase italic">Quantum Finance</h1>
            <p className="text-xl text-white/60 font-medium">
              The next generation of non-custodial trading on Sui. Powered by zkLogin.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => handleLogin(googleProvider)}
              className="w-full bg-white text-black font-bold py-5 rounded-3xl flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
            >
              <Chrome size={24} />
              <span>Continue with Google</span>
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleLogin(facebookProvider)}
                className="bg-[#1877F2] text-white font-bold py-5 rounded-3xl flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
              >
                <Facebook size={24} />
                <span>Facebook</span>
              </button>
              <button
                onClick={() => handleLogin(appleProvider)}
                className="bg-white text-black font-bold py-5 rounded-3xl flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl"
              >
                <Apple size={24} />
                <span>Apple</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/10">
            <div className="flex flex-col items-center gap-2">
              <Shield className="text-orange-500" size={24} />
              <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Non-Custodial</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Globe className="text-blue-500" size={24} />
              <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Cross-Chain</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Zap className="text-green-500" size={24} />
              <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Instant Settlement</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} user={user}>
      {activeTab === 0 && <WalletTab user={user} />}
      {activeTab === 1 && <MarketsTab />}
      {activeTab === 2 && <TradingTab />}
      {activeTab === 3 && <LeaderboardTab />}
      {activeTab === 4 && <CommunityTab user={user} />}
      {activeTab === 5 && <SettingsTab user={user} />}
    </Layout>
  );
};

export default App;
