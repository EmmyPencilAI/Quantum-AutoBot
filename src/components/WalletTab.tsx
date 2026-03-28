import React, { useState, useEffect } from "react";
import { Copy, Send, ArrowDownLeft, Plus, ExternalLink, ShieldCheck, RefreshCw, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { deriveSuiWallet, getSuiBalance, getUsdtBalance, crossChainTransfer } from "../lib/sui";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

interface WalletTabProps {
  user: any;
}

const WalletTab: React.FC<WalletTabProps> = ({ user }) => {
  const [address, setAddress] = useState<string>("");
  const [balances, setBalances] = useState({ sui: 0, usdt: 0 });
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendParams, setSendParams] = useState({
    recipient: "",
    amount: "",
    chain: "Sui",
  });
  const [sending, setSending] = useState(false);

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
    const sui = await getSuiBalance(addr);
    const usdt = await getUsdtBalance(addr);
    setBalances({ sui, usdt });
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    // Add toast notification here if needed
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

  return (
    <div className="space-y-6">
      {/* Profile & Wallet Card */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
        <div className="relative">
          <img
            src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
            alt="Avatar"
            className="w-24 h-24 rounded-full border-4 border-orange-500/20 bg-white/5"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-0 right-0 bg-green-500 w-6 h-6 rounded-full border-4 border-[#0a0a0a]" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-3xl font-bold tracking-tight mb-2">{user?.displayName || "Quantum Explorer"}</h2>
          <div className="flex items-center justify-center md:justify-start gap-2 text-white/40">
            <span className="text-xs font-mono bg-white/5 px-3 py-1 rounded-full border border-white/10">
              {address.slice(0, 10)}...{address.slice(-10)}
            </span>
            <button onClick={handleCopy} className="hover:text-orange-500 transition-colors">
              <Copy size={14} />
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSendModal(true)}
            className="bg-orange-500 text-black font-bold px-6 py-3 rounded-2xl flex items-center gap-2 hover:scale-105 transition-all"
          >
            <Send size={18} />
            <span>Send</span>
          </button>
          <button className="bg-white/5 border border-white/10 text-white font-bold px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-white/10 transition-all">
            <ArrowDownLeft size={18} />
            <span>Receive</span>
          </button>
        </div>
      </div>

      {/* Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <RefreshCw size={120} className="text-orange-500" />
          </div>
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-4">Sui Balance (Gas)</p>
          <div className="flex items-end gap-3">
            <h3 className="text-5xl font-bold tracking-tighter">{balances.sui.toFixed(4)}</h3>
            <span className="text-orange-500 font-bold mb-2">SUI</span>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-green-400 bg-green-400/10 w-fit px-3 py-1 rounded-full">
            <ShieldCheck size={12} />
            <span>Secured by zkLogin</span>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={120} className="text-blue-500" />
          </div>
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-4">USDT Balance (Trading)</p>
          <div className="flex items-end gap-3">
            <h3 className="text-5xl font-bold tracking-tighter">{balances.usdt.toFixed(2)}</h3>
            <span className="text-blue-500 font-bold mb-2">USDT</span>
          </div>
          <button className="mt-6 w-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold py-3 rounded-2xl hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2">
            <Plus size={18} />
            <span>Fund Trading</span>
          </button>
        </div>
      </div>

      {/* Recent Activity (Placeholder for real data) */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold tracking-tight">Recent Activity</h3>
          <button className="text-orange-500 text-sm font-bold hover:underline">View All</button>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400">
                  <ArrowDownLeft size={20} />
                </div>
                <div>
                  <p className="font-bold">Received USDT</p>
                  <p className="text-xs text-white/40">From: 0x82...3921</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-400">+500.00 USDT</p>
                <p className="text-xs text-white/40">2 hours ago</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-2xl font-bold mb-6">Send USDT</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white/40 uppercase mb-2 block">Destination Chain</label>
                <div className="grid grid-cols-2 gap-2">
                  {chains.map((chain) => (
                    <button
                      key={chain}
                      onClick={() => setSendParams({ ...sendParams, chain })}
                      className={`py-3 rounded-xl border font-bold text-sm transition-all ${
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
                <label className="text-xs font-bold text-white/40 uppercase mb-2 block">Recipient Address</label>
                <input
                  type="text"
                  placeholder="Enter address"
                  value={sendParams.recipient}
                  onChange={(e) => setSendParams({ ...sendParams, recipient: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-all font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/40 uppercase mb-2 block">Amount (USDT)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={sendParams.amount}
                  onChange={(e) => setSendParams({ ...sendParams, amount: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-all font-bold text-lg"
                />
              </div>

              <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Bridge Fee</span>
                  <span className="font-bold">1.50 USDT</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Est. Time</span>
                  <span className="font-bold">~2 mins</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 bg-white/5 border border-white/10 py-4 rounded-2xl font-bold hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 bg-orange-500 text-black py-4 rounded-2xl font-bold hover:scale-105 transition-all disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Confirm"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WalletTab;
