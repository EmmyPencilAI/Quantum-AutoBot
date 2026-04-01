import React, { useState, useEffect } from "react";
import { auth, googleProvider, facebookProvider, appleProvider, db, handleFirestoreError, OperationType } from "./firebase";
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

import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "sonner";

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    // Safety timeout to ensure loading screen doesn't stay forever
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000); // 10 seconds max loading

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          console.log("User authenticated:", user.uid);
          const path = `users/${user.uid}`;
          try {
            // Ensure user document exists in Firestore
            const userRef = doc(db, "users", user.uid);
            
            // Try to get document from server first to ensure connectivity
            let userSnap;
            try {
              userSnap = await getDoc(userRef);
            } catch (e: any) {
              if (e.message?.includes("offline")) {
                console.warn("Firestore is offline, trying cache...");
                userSnap = await getDoc(userRef);
              } else {
                throw e;
              }
            }
            
            if (!userSnap.exists()) {
              console.log("Creating new user profile...");
              const keypair = deriveSuiWallet(user.uid);
              await setDoc(userRef, {
                uid: user.uid,
                username: user.displayName || "Quantum Trader",
                avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                suiWallet: keypair.toSuiAddress(),
                suiBalance: 0,
                walletBalance: 0, // Starting wallet balance
                usdtBalance: 0, 
                usdcBalance: 0,
                totalProfit: 0,
                activeStrategy: "None",
                isTrading: false,
                region: "Global",
                createdAt: new Date().toISOString(),
              });
            }
            setUser(user);
          } catch (error) {
            console.error("Firestore operation failed:", error);
            handleFirestoreError(error, OperationType.WRITE, path);
          }
        } else {
          setUser(null);
        }
      } catch (e) {
        console.error("Auth state change error:", e);
      } finally {
        setLoading(false);
        clearTimeout(timeout);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleLogin = async (provider: any) => {
    try {
      setLoading(true);
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error("Login failed:", e);
      // Log specific error codes to help debugging
      if (e.code === 'auth/popup-blocked') {
        alert("Please enable popups for this site to sign in.");
      } else if (e.code === 'auth/operation-not-allowed') {
        alert("This sign-in provider is not enabled in your Firebase Console.");
      } else if (e.code === 'auth/unauthorized-domain') {
        alert("This domain is not authorized in Firebase. Add " + window.location.hostname + " to Authorized Domains in Firebase Console.");
      } else {
        alert("Login error: " + e.message);
      }
    } finally {
      setLoading(false);
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

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30">
        <Toaster position="top-center" expand={true} richColors />
        {!user ? (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 md:p-6 font-sans relative overflow-hidden">
          {/* Background Accents */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl w-full text-center space-y-8 md:space-y-10 relative z-10"
          >
            <div className="flex flex-col items-center gap-4 md:gap-6">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-orange-500 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/20">
                <TrendingUp size={32} className="text-black md:w-10 md:h-10" />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase italic leading-none">Quantum Finance</h1>
              <p className="text-base md:text-xl text-white/60 font-medium max-w-[280px] md:max-w-none mx-auto">
                The next generation of non-custodial trading on Sui. Powered by zkLogin.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:gap-4">
              <button
                onClick={() => handleLogin(googleProvider)}
                className="w-full bg-white text-black font-bold py-4 md:py-5 rounded-2xl md:rounded-3xl flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl text-sm md:text-base"
              >
                <Chrome size={20} className="md:w-6 md:h-6" />
                <span>Continue with Google</span>
              </button>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <button
                  onClick={() => handleLogin(facebookProvider)}
                  className="bg-[#1877F2] text-white font-bold py-4 md:py-5 rounded-2xl md:rounded-3xl flex items-center justify-center gap-2 md:gap-3 hover:scale-105 transition-all shadow-xl text-xs md:text-base"
                >
                  <Facebook size={18} className="md:w-6 md:h-6" />
                  <span>Facebook</span>
                </button>
                <button
                  onClick={() => handleLogin(appleProvider)}
                  className="bg-white text-black font-bold py-4 md:py-5 rounded-2xl md:rounded-3xl flex items-center justify-center gap-2 md:gap-3 hover:scale-105 transition-all shadow-xl text-xs md:text-base"
                >
                  <Apple size={18} className="md:w-6 md:h-6" />
                  <span>Apple</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 md:gap-6 pt-8 md:pt-10 border-t border-white/10">
              <div className="flex flex-col items-center gap-1 md:gap-2">
                <Shield className="text-orange-500 md:w-6 md:h-6" size={18} />
                <p className="text-[8px] md:text-[10px] uppercase font-bold tracking-widest text-white/40">Non-Custodial</p>
              </div>
              <div className="flex flex-col items-center gap-1 md:gap-2">
                <Globe className="text-blue-500 md:w-6 md:h-6" size={18} />
                <p className="text-[8px] md:text-[10px] uppercase font-bold tracking-widest text-white/40">Cross-Chain</p>
              </div>
              <div className="flex flex-col items-center gap-1 md:gap-2">
                <Zap className="text-green-500 md:w-6 md:h-6" size={18} />
                <p className="text-[8px] md:text-[10px] uppercase font-bold tracking-widest text-white/40">Instant Settlement</p>
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <Layout activeTab={activeTab} setActiveTab={setActiveTab} user={user}>
          {activeTab === 0 && <WalletTab user={user} />}
          {activeTab === 1 && <MarketsTab />}
          {activeTab === 2 && <TradingTab user={user} />}
          {activeTab === 3 && <LeaderboardTab user={user} />}
          {activeTab === 4 && <CommunityTab user={user} />}
          {activeTab === 5 && <SettingsTab user={user} />}
        </Layout>
      )}
    </div>
    </ErrorBoundary>
  );
};

export default App;
