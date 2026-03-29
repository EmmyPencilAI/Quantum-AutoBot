import React, { useState, useEffect } from "react";
import { Copy, Send, ArrowDownLeft, Plus, ExternalLink, ShieldCheck, RefreshCw, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { deriveSuiWallet, getSuiBalance, getUsdtBalance, crossChainTransfer, transferOnChain, USDT_TYPE, SUI_TREASURY_ADDRESS } from "../lib/sui";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

interface WalletTabProps {
  user: any;
}

const WalletTab: React.FC<WalletTabProps> = ({ user }) => {
  const [address, setAddress] = useState<string>("");
  const [balances, setBalances] = useState({ sui: 0, usdt: 0, wallet: 0 });
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendParams, setSendParams] = useState({
    recipient: "",
    amount: "",
    chain: "Sui",
  });
  const [sending, setSending] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const chains = ["Sui", "BNB Chain", "Tron", "Solana"];

  useEffect(() => {
    if (user) {
      const keypair = deriveSuiWallet(user.uid);
      const addr = keypair.toSuiAddress();
      setAddress(addr);
      refreshBalances(addr);
    }
  }, [user]);

  const refreshBalances = async (addr: string) => {
    setLoading(true);
    try {
      const sui = await getSuiBalance(addr);
      const usdt = await getUsdtBalance(addr);
      
      // Fetch Firestore wallet balance
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const wallet = userSnap.exists() ? (userSnap.data().walletBalance || 0) : 0;
      
      setBalances({ sui, usdt, wallet });
    } catch (e) {
      console.error("Error refreshing balances:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!sendParams.recipient || !sendParams.amount) return;
    setSending(true);
    try {
      const result = await crossChainTransfer({
        fromAddress: address,
        toAddress: sendParams.recipient,
        amount: parseFloat(sendParams.amount),
        destinationChain: sendParams.chain,
      });
      console.log("Transfer successful:", result);
      setShowSendModal(false);
      refreshBalances(address);
    } catch (e) {
      console.error("Transfer failed:", e);
    } finally {
      setSending(false);
    }
  };

  const handleTopUp = async () => {
    if (balances.usdt <= 0) {
      alert("No USDT found on-chain to top up.");
      return;
    }
    
    setToppingUp(true);
    try {
      const keypair = deriveSuiWallet(user.uid);
      const amount = balances.usdt;
      
      console.log(`Topping up ${amount} USDT from on-chain...`);
      
      // 1. Transfer USDT on-chain to Treasury
      const result = await transferOnChain({
        signer: keypair,
        to: SUI_TREASURY_ADDRESS,
        amount: amount,
        coinType: USDT_TYPE
      });
      
      console.log("On-chain transfer successful:", result.digest);
      
      // 2. Update Firestore wallet balance
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        walletBalance: balances.wallet + amount
      });
      
      alert(`Successfully topped up ${amount.toFixed(2)} USDT!`);
      refreshBalances(address);
    } catch (e: any) {
      console.error("Top up failed:", e);
      alert("Top up failed: " + (e.message || "Unknown error"));
    } finally {
      setToppingUp(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* Profile & Wallet Card */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl p-4 md:p-8 flex flex-col md:flex-row items-center gap-4 md:gap-8 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <ShieldCheck size={120} className="text-orange-500" />
        </div>
        <div className="relative shrink-0">
          <img
            src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
            alt="Avatar"
            className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-orange-500/20 bg-white/5"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-0 right-0 bg-green-500 w-4 h-4 md:w-6 md:h-6 rounded-full border-2 md:border-4 border-[#0a0a0a]" />
        </div>
        <div className="flex-1 text-center md:text-left min-w-0 z-10">
          <h2 className="text-xl md:text-3xl font-bold tracking-tight mb-1 md:mb-2 truncate">{user?.displayName || "Quantum Explorer"}</h2>
          <div className="flex items-center justify-center md:justify-start gap-2 text-white/40">
            <span className="text-[9px] md:text-xs font-mono bg-white/5 px-2 md:px-3 py-1 rounded-full border border-white/10 truncate max-w-[150px] md:max-w-[200px]">
              {address.slice(0, 6)}...{address.slice(-6)}
            </span>
            <button onClick={handleCopy} className="hover:text-orange-500 transition-colors shrink-0 p-1 relative">
              {copied ? <ShieldCheck size={12} className="text-green-500" /> : <Copy size={12} className="md:w-3.5 md:h-3.5" />}
              {copied && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-green-500 text-black text-[8px] px-2 py-1 rounded font-bold">COPIED</span>}
            </button>
          </div>
        </div>
        <div className="flex gap-2 md:gap-3 w-full md:w-auto z-10">
          <button
            onClick={() => setShowSendModal(true)}
            className="flex-1 md:flex-none bg-orange-500 text-black font-bold px-3 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-all text-xs md:text-base"
          >
            <Send size={16} className="md:w-4.5 md:h-4.5" />
            <span>Send</span>
          </button>
          <button 
            onClick={() => setShowReceiveModal(true)}
            className="flex-1 md:flex-none bg-white/5 border border-white/10 text-white font-bold px-3 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all text-xs md:text-base"
          >
            <ArrowDownLeft size={16} className="md:w-4.5 md:h-4.5" />
            <span>Receive</span>
          </button>
        </div>
      </div>

      {/* Balances Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl p-4 md:p-8 relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <RefreshCw size={60} className="text-orange-500 md:w-[120px] md:h-[120px]" />
          </div>
          <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-4">Sui Balance (Gas)</p>
          <div className="flex items-end gap-1.5 md:gap-3">
            <h3 className="text-2xl md:text-5xl font-bold tracking-tighter">{balances.sui.toFixed(4)}</h3>
            <span className="text-orange-500 font-bold mb-0.5 md:mb-2 text-[10px] md:text-base">SUI</span>
          </div>
          <div className="mt-3 md:mt-6 flex items-center gap-1.5 text-[8px] md:text-xs text-green-400 bg-green-400/10 w-fit px-2 md:px-3 py-1 rounded-full">
            <ShieldCheck size={10} className="md:w-3 md:h-3" />
            <span>Secured by zkLogin</span>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl p-4 md:p-8 relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <TrendingUp size={60} className="text-blue-500 md:w-[120px] md:h-[120px]" />
          </div>
          <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-4">Wallet Balance (USDT)</p>
          <div className="flex items-end gap-1.5 md:gap-3">
            <h3 className="text-2xl md:text-5xl font-bold tracking-tighter">{balances.wallet.toFixed(2)}</h3>
            <span className="text-blue-500 font-bold mb-0.5 md:mb-2 text-[10px] md:text-base">USDT</span>
          </div>
          <div className="mt-2 text-[8px] md:text-[10px] text-white/20 font-mono">
            On-chain: {balances.usdt.toFixed(2)} USDT
          </div>
          <button 
            onClick={handleTopUp}
            disabled={toppingUp || balances.usdt <= 0}
            className="mt-3 md:mt-4 w-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold py-2 md:py-3 rounded-lg md:rounded-2xl hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2 text-[10px] md:text-base disabled:opacity-50"
          >
            <Plus size={14} className="md:w-4.5 md:h-4.5" />
            <span>{toppingUp ? "Processing..." : "Top Up from On-chain"}</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl p-4 md:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-4 md:mb-8">
          <h3 className="text-base md:text-xl font-bold tracking-tight">Recent Activity</h3>
          <button className="text-orange-500 text-[10px] md:text-sm font-bold hover:underline">View All</button>
        </div>
        <div className="space-y-2 md:space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 md:p-4 bg-white/5 rounded-lg md:rounded-2xl border border-white/5">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-green-500/10 rounded-lg md:rounded-xl flex items-center justify-center text-green-400 shrink-0">
                  <ArrowDownLeft size={16} className="md:w-5 md:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs md:text-base truncate">Received USDT</p>
                  <p className="text-[9px] md:text-xs text-white/40 truncate">From: 0x82...3921</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-green-400 text-xs md:text-base">+500.00</p>
                <p className="text-[9px] md:text-xs text-white/40">2h ago</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/90 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
          >
            <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Send USDT</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[9px] md:text-xs font-bold text-white/40 uppercase mb-2 block">Destination Chain</label>
                <div className="grid grid-cols-2 gap-2">
                  {chains.map((chain) => (
                    <button
                      key={chain}
                      onClick={() => setSendParams({ ...sendParams, chain })}
                      className={`py-2 md:py-3 rounded-lg md:rounded-xl border font-bold text-[10px] md:text-sm transition-all ${
                        sendParams.chain === chain
                          ? "bg-orange-500 border-orange-500 text-black"
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                      }`}
                    >
                      {chain}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] md:text-xs font-bold text-white/40 uppercase mb-2 block">Recipient Address</label>
                <input
                  type="text"
                  placeholder="Enter address"
                  value={sendParams.recipient}
                  onChange={(e) => setSendParams({ ...sendParams, recipient: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 focus:outline-none focus:border-orange-500 transition-all font-mono text-[10px] md:text-sm"
                />
              </div>

              <div>
                <label className="text-[9px] md:text-xs font-bold text-white/40 uppercase mb-2 block">Amount (USDT)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={sendParams.amount}
                  onChange={(e) => setSendParams({ ...sendParams, amount: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 focus:outline-none focus:border-orange-500 transition-all font-bold text-sm md:text-lg"
                />
              </div>

              <div className="bg-orange-500/10 border border-orange-500/20 p-3 md:p-4 rounded-xl md:rounded-2xl space-y-1 md:space-y-2">
                <div className="flex justify-between text-[9px] md:text-xs">
                  <span className="text-white/40">Bridge Fee</span>
                  <span className="font-bold">1.50 USDT</span>
                </div>
                <div className="flex justify-between text-[9px] md:text-xs">
                  <span className="text-white/40">Est. Time</span>
                  <span className="font-bold">~2 mins</span>
                </div>
              </div>

              <div className="flex gap-2 md:gap-3 pt-2">
                <button
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 py-3 md:py-4 rounded-lg md:rounded-2xl font-bold text-xs md:text-base hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 bg-orange-500 text-black py-3 md:py-4 rounded-lg md:rounded-2xl font-bold text-xs md:text-base hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Confirm"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/90 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-8 w-full max-w-md shadow-2xl text-center"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
              <ArrowDownLeft size={32} className="text-orange-500 md:w-10 md:h-10" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold mb-2">Receive Assets</h3>
            <p className="text-white/40 text-xs md:text-sm mb-6 md:mb-8">Share your Sui address to receive USDT or SUI</p>
            
            <div className="bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 mb-6 md:mb-8 break-all font-mono text-[10px] md:text-sm relative group">
              {address}
              <button 
                onClick={handleCopy}
                className="absolute top-2 right-2 p-2 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-orange-500"
              >
                <Copy size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleCopy}
                className="w-full bg-orange-500 text-black py-3 md:py-4 rounded-lg md:rounded-2xl font-bold text-xs md:text-base hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                {copied ? <ShieldCheck size={18} /> : <Copy size={18} />}
                <span>{copied ? "Address Copied!" : "Copy Full Address"}</span>
              </button>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="w-full bg-white/5 border border-white/10 py-3 md:py-4 rounded-lg md:rounded-2xl font-bold text-xs md:text-base hover:bg-white/10 transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WalletTab;
