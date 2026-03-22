import React, { useState } from "react";
import { Wallet, ArrowRight, ShieldCheck, Zap, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { ethers } from "ethers";
import { CONFIG, USDT_ABI, QUANTUM_ABI } from "../config";

interface WalletTabProps {
  account: string | null;
  balance: string;
  connectWallet: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
  showPrompt: (title: string, message: string, placeholder: string, onConfirm: (value: string) => void) => void;
  showAlert: (title: string, message: string) => void;
}

export function WalletTab({ account, balance, connectWallet, notify, showPrompt, showAlert }: WalletTabProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isFunding, setIsFunding] = useState(false);

  const handleApprove = async () => {
    if (!account) return connectWallet();
    setIsApproving(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdtContract = new ethers.Contract(CONFIG.USDT_ADDRESS, USDT_ABI, signer);
      
      const amount = ethers.parseUnits("1000000", 18); // Approve a large amount for convenience
      const tx = await usdtContract.approve(CONFIG.CONTRACT_ADDRESS, amount);
      notify("Approval transaction sent...", "info");
      await tx.wait();
      notify("USDT Approved Successfully!", "success");
    } catch (error: any) {
      console.error("Approval failed:", error);
      notify(`Approval failed: ${error.message || "Unknown error"}`, "error");
    } finally {
      setIsApproving(false);
    }
  };

  const handleFund = async () => {
    if (!account) return connectWallet();
    
    showPrompt("Fund Trading", "Enter USDT amount to fund (e.g., 100):", "100", async (amountStr) => {
      if (!amountStr || isNaN(parseFloat(amountStr))) {
        return notify("Invalid amount entered", "error");
      }
      
      setIsFunding(true);
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const quantumContract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, QUANTUM_ABI, signer);
        
        const amount = ethers.parseUnits(amountStr, 18);
        const tx = await quantumContract.deposit(amount);
        notify("Funding transaction sent...", "info");
        await tx.wait();
        notify("Trading Funded Successfully!", "success");
      } catch (error: any) {
        console.error("Funding failed:", error);
        notify(`Funding failed: ${error.message || "Unknown error"}`, "error");
      } finally {
        setIsFunding(false);
      }
    });
  };

  return (
    <div className="space-y-6 py-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-emerald-500/20 to-blue-500/10 border border-white/10 rounded-3xl p-6 sm:p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Zap size={120} />
        </div>
        
        <div className="relative z-10">
          <h2 className="text-white/60 text-sm font-medium mb-1">Total USDT Balance</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight">{balance}</span>
            <span className="text-emerald-500 font-bold text-lg">USDT</span>
          </div>
          
          <div className="mt-8 flex gap-3">
            {!account ? (
              <button 
                onClick={connectWallet}
                className="w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 transition-all active:scale-[0.98]"
              >
                <Wallet size={20} />
                Connect Wallet
              </button>
            ) : (
              <div className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="text-emerald-500" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-white/40 font-medium">Connected Wallet</p>
                    <p className="text-sm font-mono font-bold">{account.slice(0, 8)}...{account.slice(-6)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-white/40 font-medium mb-1">Network</p>
          <div className="text-sm font-bold flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            BNB Chain
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-white/40 font-medium mb-1">Status</p>
          <p className="text-sm font-bold text-emerald-500">Normal</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest px-2">Quick Actions</h3>
        <button 
          onClick={handleApprove}
          disabled={isApproving}
          className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
              {isApproving ? <Loader2 className="text-blue-500 animate-spin" size={24} /> : <ArrowRight className="text-blue-500" size={24} />}
            </div>
            <div className="text-left">
              <p className="font-bold">Approve USDT</p>
              <p className="text-xs text-white/40">Grant contract permission to trade</p>
            </div>
          </div>
          <ArrowRight className="text-white/20 group-hover:text-white/60 transition-all" size={20} />
        </button>
        
        <button 
          onClick={handleFund}
          disabled={isFunding}
          className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              {isFunding ? <Loader2 className="text-emerald-500 animate-spin" size={24} /> : <Zap className="text-emerald-500" size={24} />}
            </div>
            <div className="text-left">
              <p className="font-bold">Fund Trading</p>
              <p className="text-xs text-white/40">Deposit USDT to start auto-trading</p>
            </div>
          </div>
          <ArrowRight className="text-white/20 group-hover:text-white/60 transition-all" size={20} />
        </button>
      </div>
    </div>
  );
}
