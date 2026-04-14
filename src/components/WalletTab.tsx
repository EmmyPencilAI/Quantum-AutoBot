import React, { useState, useEffect } from "react";
import { Copy, Send, ArrowDownLeft, Plus, ShieldCheck, RefreshCw, TrendingUp, Zap, Droplets, AlertTriangle, ExternalLink, Smartphone, Monitor } from "lucide-react";
import { motion } from "motion/react";
import { getAllBalances, buildTransferOnChainPTB, USDT_TYPE, USDC_TYPE, SUI_TYPE, SUI_TREASURY_ADDRESS, requestTestnetGas } from "../lib/sui";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { Bell, CheckCircle2, Info, Link } from "lucide-react";
import { ConnectButton, useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import { useInitExecutionAdapter } from "../lib/executionAdapter";
import { apiFetch } from "../lib/api";
import { toast } from "sonner";
import { isValidSuiAddress, isPendingWallet, shortenAddress } from "../lib/suiAddress";
import { isMobileDevice, getWalletInstallUrl } from "../lib/platformDetect";

interface WalletTabProps {
  user: any;
}

const WalletTab: React.FC<WalletTabProps> = ({ user }) => {
  const [address, setAddress] = useState<string>("");
  const [balances, setBalances] = useState({ sui: 0, usdt: 0, usdc: 0, wallet: 0 });
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendParams, setSendParams] = useState({
    recipient: "",
    amount: "",
    chain: "Sui",
    asset: "USDT",
  });
  const [sending, setSending] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawParams, setWithdrawParams] = useState({
    amount: "",
    asset: "USDT",
    externalAddress: "",
  });
  const [withdrawing, setWithdrawing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [isRequestingGas, setIsRequestingGas] = useState(false);
  const [walletVerified, setWalletVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [firestoreWallet, setFirestoreWallet] = useState<string | null>(null);
  const [claimingLegacy, setClaimingLegacy] = useState(false);
  const [legacyClaimed, setLegacyClaimed] = useState(false);

  const chains = ["Sui"];
  const assets = ["SUI", "USDT", "USDC"];

  const currentAccount = useCurrentAccount(); // UI Wallet
  const executionAdapter = useInitExecutionAdapter();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  // Load persisted wallet state from Firestore on mount
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    getDoc(userRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        const savedWallet = data.suiWallet;
        if (isValidSuiAddress(savedWallet)) {
          setFirestoreWallet(savedWallet);
          setWalletVerified(data.walletVerified === true);
        }
        if (data.legacyClaimed === true) {
          setLegacyClaimed(true);
        }
      }
    }).catch(console.error);
  }, [user]);

  // Track on-chain address: prefer connected wallet, fall back to persisted
  useEffect(() => {
    if (currentAccount?.address) {
      setAddress(currentAccount.address);
    } else if (isValidSuiAddress(firestoreWallet)) {
      setAddress(firestoreWallet!);
    } else {
      setAddress("");
    }
  }, [currentAccount?.address, firestoreWallet]);

  /**
   * Verify wallet ownership via message signing, then persist to Firestore.
   * This is a lightweight proof-of-ownership: the user signs a known message
   * with their connected wallet, proving they control the private key.
   */
  const verifyAndLinkWallet = async () => {
    if (!currentAccount?.address || !user) return;
    setVerifying(true);
    toast.loading("Please sign the verification message in your wallet...", { id: "verify-wallet" });
    try {
      const message = new TextEncoder().encode(
        `Verify wallet ownership for Quantum Finance\nAccount: ${user.uid}\nAddress: ${currentAccount.address}\nTimestamp: ${Date.now()}`
      );

      await signPersonalMessage({ message });

      // Signature succeeded — persist wallet to Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        suiWallet: currentAccount.address,
        walletVerified: true,
        walletLinkedAt: new Date().toISOString(),
      });

      setFirestoreWallet(currentAccount.address);
      setWalletVerified(true);
      toast.success("Wallet verified and linked successfully!", { id: "verify-wallet" });

      // Log the action
      await setDoc(doc(collection(db, "notifications")), {
        uid: user.uid,
        type: "WALLET_LINKED",
        title: "Wallet Linked",
        message: `Wallet ${shortenAddress(currentAccount.address)} verified and linked to your account.`,
        timestamp: new Date().toISOString(),
        read: false,
      });
    } catch (e: any) {
      console.error("Wallet verification failed:", e);
      if (e.message?.includes("rejected") || e.message?.includes("denied")) {
        toast.error("Verification cancelled. You can verify later from the wallet tab.", { id: "verify-wallet" });
      } else {
        toast.error("Wallet verification failed: " + (e.message || "Unknown error"), { id: "verify-wallet" });
      }
    } finally {
      setVerifying(false);
    }
  };

  // General initial load: Fetch DB wallet & on-chain balances
  useEffect(() => {
    if (user) {
      refreshBalances(currentAccount?.address || "");

      // Listen for notifications
      const q = query(
        collection(db, "notifications"),
        where("uid", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(10)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [user, currentAccount?.address]);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestGas = async () => {
    if (!address) return;
    setIsRequestingGas(true);
    toast.loading("Requesting Testnet SUI...", { id: "gas" });
    try {
      await requestTestnetGas(address);
      toast.success("Gas requested! It may take a minute to reflect in your balance.", { id: "gas" });
      setTimeout(() => refreshBalances(address), 5000);
    } catch (error: any) {
      toast.error(`Faucet failed: ${error.message}`, { id: "gas" });
    } finally {
      setIsRequestingGas(false);
    }
  };

  const refreshBalances = async (addr: string) => {
    setLoading(true);
    try {
      let sui = 0, usdt = 0, usdc = 0;
      if (addr) {
        const onchain = await getAllBalances(addr);
        sui = onchain.sui; 
        usdt = onchain.usdt; 
        usdc = onchain.usdc;
      }
      
      // Fetch Firestore wallet balance
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const wallet = userSnap.exists() ? (userSnap.data().walletBalance || 0) : 0;
      
      setBalances({ sui, usdt, usdc, wallet });
    } catch (e) {
      console.error("Error refreshing balances:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!sendParams.recipient || !sendParams.amount) return;
    setSending(true);
    toast.loading("Sending transaction...", { id: "send" });
    try {
      

      let coinType = USDT_TYPE;
      if (sendParams.asset === "SUI") coinType = SUI_TYPE;
      if (sendParams.asset === "USDC") coinType = USDC_TYPE;

      // Handle Cross Chain Routing (currently mocked as Sui-to-Sui direct transfer)
      if (sendParams.chain !== "Sui") {
        throw new Error(`Cross-chain transfer to ${sendParams.chain} is not supported in this version. Only Sui-to-Sui transfers are currently active.`);
      }

      const senderAddress = currentAccount?.address;
      if (!senderAddress) throw new Error("Wallet not connected");
      const tx = await buildTransferOnChainPTB({
        senderAddress,
        to: sendParams.recipient,
        amount: parseFloat(sendParams.amount),
        coinType: coinType
      });
      const result = await executionAdapter.executeTransaction(tx);
      
      console.log("Transfer successful:", result);
      
      // Add notification
      await setDoc(doc(collection(db, "notifications")), {
        uid: user.uid,
        type: "TRANSFER_SENT",
        title: "Transfer Sent",
        message: `Successfully sent ${sendParams.amount} ${sendParams.asset} to ${sendParams.recipient.slice(0, 6)}... on ${sendParams.chain}.`,
        amount: parseFloat(sendParams.amount),
        asset: sendParams.asset,
        timestamp: new Date().toISOString(),
        read: false
      });

      toast.success(`Successfully sent ${sendParams.amount} ${sendParams.asset}!`, { id: "send" });
      setShowSendModal(false);
      refreshBalances(address);
    } catch (e: any) {
      console.error("Transfer failed:", e);
      toast.error("Transfer failed: " + (e.message || "Unknown error"), { id: "send" });
    } finally {
      setSending(false);
    }
  };

  const handleDeposit = async () => {
    setToppingUp(true);
    toast.loading("Verifying execution balances...", { id: "deposit" });
    try {
      
      
      if (!currentAccount?.address) throw new Error("Wallet not connected");
      // Execute from the execution wallet as the single source of truth
      const execBalances = await getAllBalances(currentAccount.address);
      
      const usdtAmount = execBalances.usdt;
      const usdcAmount = execBalances.usdc;
      const totalAmount = usdtAmount + usdcAmount;
      
      if (totalAmount <= 0) {
        toast.error(`No USDT or USDC found on execution wallet to deposit.`, { id: "deposit" });
        return;
      }

      toast.loading("Processing deposit...", { id: "deposit" });
      
      if (usdtAmount > 0) {
        console.log(`Depositing ${usdtAmount} USDT from on-chain...`);
        const senderAddress = currentAccount?.address; if (!senderAddress) throw new Error('Wallet not connected');
        const tx = await buildTransferOnChainPTB({
          senderAddress,
          to: SUI_TREASURY_ADDRESS,
          amount: usdtAmount,
          coinType: USDT_TYPE
        });
        await executionAdapter.executeTransaction(tx);
      }
      
      if (usdcAmount > 0) {
        console.log(`Depositing ${usdcAmount} USDC from on-chain...`);
        const senderAddress = currentAccount?.address; if (!senderAddress) throw new Error('Wallet not connected');
        const tx = await buildTransferOnChainPTB({
          senderAddress,
          to: SUI_TREASURY_ADDRESS,
          amount: usdcAmount,
          coinType: USDC_TYPE
        });
        await executionAdapter.executeTransaction(tx);
      }
      
      // 2. Update Firestore wallet balance
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        walletBalance: balances.wallet + totalAmount
      });

      // Add notification
      await setDoc(doc(collection(db, "notifications")), {
        uid: user.uid,
        type: "DEPOSIT",
        title: "Wallet Funded",
        message: `Successfully deposited ${totalAmount.toFixed(2)} USD from on-chain assets.`,
        amount: totalAmount,
        asset: "USD",
        timestamp: new Date().toISOString(),
        read: false
      });
      
      toast.success(`Successfully deposited ${totalAmount.toFixed(2)} USD!`, { id: "deposit" });
      refreshBalances(address);
    } catch (e: any) {
      console.error("Deposit failed:", e);
      toast.error("Deposit failed: " + (e.message || "Unknown error"), { id: "deposit" });
    } finally {
      setToppingUp(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawParams.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    if (amount > balances.wallet) {
      toast.error("Insufficient trading wallet balance.");
      return;
    }

    // Determine destination: explicit input takes priority, then connected wallet
    const destinationAddress = withdrawParams.externalAddress.trim() || currentAccount?.address || "";

    if (!isValidSuiAddress(destinationAddress)) {
      toast.error("Invalid Sui address. Please enter a valid 0x... address or connect your wallet.");
      return;
    }

    setWithdrawing(true);
    toast.loading("Processing withdrawal...", { id: "withdraw" });
    try {
      // apiFetch automatically attaches the Firebase ID token
      const result = await apiFetch<{ success: boolean; txHash: string; newWalletBalance: number }>(
        "/api/wallet/withdraw",
        {
          method: "POST",
          body: JSON.stringify({
            uid: user.uid,
            amount,
            asset: withdrawParams.asset,
            walletAddress: destinationAddress,
          }),
        }
      );

      if (result.success) {
        toast.success(`Successfully withdrawn ${amount} ${withdrawParams.asset} to ${shortenAddress(destinationAddress)}.`, { id: "withdraw" });
        setShowWithdrawModal(false);
        setWithdrawParams({ amount: "", asset: "USDT", externalAddress: "" });
        refreshBalances(address);
      } else {
        throw new Error("Withdrawal failed");
      }
    } catch (e: any) {
      console.error("Withdrawal failed:", e);
      toast.error("Withdrawal failed: " + (e.message || "Unknown error"), { id: "withdraw" });
    } finally {
      setWithdrawing(false);
    }
  };

  

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* Wallet Connection & Verification */}
      <div className={`bg-[#0a0a0a] border rounded-xl md:rounded-3xl p-4 flex flex-col gap-4 shadow-2xl relative overflow-hidden ${
        walletVerified ? "border-green-500/30" : currentAccount ? "border-orange-500/30" : "border-blue-500/30"
      }`}>
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Link size={120} className={walletVerified ? "text-green-500" : "text-blue-500"} />
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1 z-10 text-center md:text-left">
            <h3 className={`text-lg font-bold mb-1 flex items-center justify-center md:justify-start gap-2 ${
              walletVerified ? "text-green-400" : "text-blue-400"
            }`}>
              {walletVerified ? <ShieldCheck size={18} /> : <Link size={18} />}
              {walletVerified ? "Wallet Verified & Linked" : "Connect Your Wallet"}
            </h3>
            <p className="text-xs text-white/50 max-w-sm mx-auto md:mx-0">
              {walletVerified
                ? `Your wallet ${shortenAddress(firestoreWallet || "")} is verified and linked to your Quantum account.`
                : currentAccount
                  ? "Wallet connected! Please verify ownership to link it to your account."
                  : "Connect your Sui wallet to access on-chain features, deposits, and withdrawals."
              }
            </p>
          </div>
          <div className="z-10 flex flex-col items-center md:items-end gap-2 shrink-0">
            <ConnectButton className="!bg-blue-600 hover:!bg-blue-500 !text-white !rounded-xl !transition-all !border-none !py-2.5" />
            {currentAccount && !walletVerified && (
              <button
                onClick={verifyAndLinkWallet}
                disabled={verifying}
                className="bg-orange-500 text-black font-bold px-4 py-2 rounded-xl text-xs hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <ShieldCheck size={14} />
                {verifying ? "Signing..." : "Verify & Link Wallet"}
              </button>
            )}
            {currentAccount && walletVerified && currentAccount.address === firestoreWallet && (
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse hidden md:block"></span>
                <span className="text-green-400 font-mono bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                  ✓ Verified: {shortenAddress(currentAccount.address)}
                </span>
              </div>
            )}
            {currentAccount && walletVerified && currentAccount.address !== firestoreWallet && (
              <div className="flex flex-col items-center md:items-end gap-1">
                <span className="text-[10px] text-orange-400">Different wallet detected. Re-verify to update.</span>
                <button
                  onClick={verifyAndLinkWallet}
                  disabled={verifying}
                  className="bg-orange-500/20 text-orange-400 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-orange-500/30 transition-all disabled:opacity-50"
                >
                  {verifying ? "Signing..." : "Re-verify & Update"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Prompt for unverified connected wallets */}
        {currentAccount && !walletVerified && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex items-start gap-2 z-10">
            <AlertTriangle size={14} className="text-orange-400 shrink-0 mt-0.5" />
            <p className="text-[10px] md:text-xs text-orange-200/80">
              <span className="font-bold text-orange-400">Action required:</span> Sign a message to verify you own this wallet. This links it to your Quantum account for withdrawals and deposits.
            </p>
          </div>
        )}

        {/* Mobile / Desktop wallet install guidance — shown when no wallet is connected */}
        {!currentAccount && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 z-10">
            <div className="flex items-center gap-2 mb-2">
              {isMobileDevice() ? <Smartphone size={14} className="text-blue-400" /> : <Monitor size={14} className="text-blue-400" />}
              <span className="text-[10px] md:text-xs font-bold text-white/60">
                {isMobileDevice() ? "Mobile Wallet" : "Desktop Wallet"}
              </span>
            </div>
            <p className="text-[10px] text-white/40 mb-2">
              {isMobileDevice()
                ? "Install the Sui Wallet app to connect on mobile. After installing, open this page from the wallet's built-in browser."
                : "Install a Sui wallet browser extension to connect. Sui Wallet, Suiet, and Ethos are supported."
              }
            </p>
            <a
              href={getWalletInstallUrl().url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-blue-600/20 text-blue-400 font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-blue-600/30 transition-all"
            >
              <ExternalLink size={12} />
              {getWalletInstallUrl().label}
            </a>
          </div>
        )}
      </div>

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
          <div className="flex flex-col items-center justify-center md:justify-start gap-1 text-white/40">
            <div className="flex items-center gap-2">
              <span className="text-[9px] md:text-xs font-mono bg-white/5 px-2 md:px-3 py-1 rounded-full border border-white/10 truncate max-w-[150px] md:max-w-[200px]">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "No wallet"}
              </span>
              {address && (
                <button onClick={handleCopy} className="hover:text-orange-500 transition-colors shrink-0 p-1 relative">
                  {copied ? <ShieldCheck size={12} className="text-green-500" /> : <Copy size={12} className="md:w-3.5 md:h-3.5" />}
                  {copied && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-green-500 text-black text-[8px] px-2 py-1 rounded font-bold">COPIED</span>}
                </button>
              )}
            </div>
            {walletVerified && (
              <span className="text-[8px] md:text-[10px] text-green-400/70 block mt-1 flex items-center gap-1">
                <ShieldCheck size={10} /> Wallet verified
              </span>
            )}
            {!walletVerified && currentAccount && (
              <span className="text-[8px] md:text-[10px] text-orange-500/70 block mt-1">
                Wallet connected — verification pending
              </span>
            )}
            {!currentAccount && !walletVerified && (
              <span className="text-[8px] md:text-[10px] text-white/30 block mt-1">
                Connect a wallet to get started
              </span>
            )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {/* SUI Balance */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <RefreshCw size={60} className="text-orange-500" />
          </div>
          <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-4">Sui Balance (Gas)</p>
          <div className="flex items-end gap-1.5 md:gap-3">
            <h3 className="text-2xl md:text-3xl font-bold tracking-tighter">{balances.sui.toFixed(4)}</h3>
            <span className="text-orange-500 font-bold mb-0.5 md:mb-1 text-[10px] md:text-sm">SUI</span>
          </div>
          <div className="mt-3 md:mt-6 flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-[8px] md:text-xs text-green-400 bg-green-400/10 w-fit px-2 md:px-3 py-1 rounded-full">
              <ShieldCheck size={10} className="md:w-3 md:h-3" />
              <span>Secured</span>
            </div>
            <button
              onClick={handleRequestGas}
              disabled={isRequestingGas}
              className="flex items-center gap-1.5 text-[8px] md:text-xs text-blue-400 bg-blue-400/10 w-fit px-2 md:px-3 py-1 rounded-full hover:bg-blue-400/20 transition-colors disabled:opacity-50"
            >
              <Droplets size={10} className={`md:w-3 md:h-3 ${isRequestingGas ? "animate-pulse" : ""}`} />
              <span>{isRequestingGas ? "Requesting..." : "Get Gas"}</span>
            </button>
          </div>
        </div>

        {/* USDT Balance */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <TrendingUp size={60} className="text-green-500" />
          </div>
          <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-4">On-chain USDT</p>
          <div className="flex items-end gap-1.5 md:gap-3">
            <h3 className="text-2xl md:text-3xl font-bold tracking-tighter">{balances.usdt.toFixed(2)}</h3>
            <span className="text-green-500 font-bold mb-0.5 md:mb-1 text-[10px] md:text-sm">USDT</span>
          </div>
          <p className="mt-2 text-[8px] md:text-[10px] text-white/20">Available for trading top-up</p>
        </div>

        {/* USDC Balance */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <TrendingUp size={60} className="text-blue-500" />
          </div>
          <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-4">On-chain USDC</p>
          <div className="flex items-end gap-1.5 md:gap-3">
            <h3 className="text-2xl md:text-3xl font-bold tracking-tighter">{balances.usdc.toFixed(2)}</h3>
            <span className="text-blue-500 font-bold mb-0.5 md:mb-1 text-[10px] md:text-sm">USDC</span>
          </div>
          <p className="mt-2 text-[8px] md:text-[10px] text-white/20">Available for trading top-up</p>
        </div>

        {/* Trading Wallet Balance */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <Zap size={60} className="text-orange-500" />
          </div>
          <p className="text-white/40 text-[9px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-4">Trading Wallet</p>
          <div className="flex items-end gap-1.5 md:gap-3">
            <h3 className="text-2xl md:text-3xl font-bold tracking-tighter text-orange-500">{balances.wallet.toFixed(2)}</h3>
            <span className="text-white/40 font-bold mb-0.5 md:mb-1 text-[10px] md:text-sm">USD</span>
          </div>
          <button 
            onClick={handleDeposit}
            disabled={toppingUp}
            className="mt-3 md:mt-4 w-full bg-orange-500/10 border border-orange-500/20 text-orange-500 font-bold py-2 rounded-lg md:rounded-xl hover:bg-orange-500/20 transition-all flex items-center justify-center gap-2 text-[10px] md:text-xs disabled:opacity-50"
          >
            <Plus size={14} />
            <span>{toppingUp ? "Processing..." : "Deposit Assets"}</span>
          </button>
          <button 
            onClick={() => setShowWithdrawModal(true)}
            disabled={balances.wallet <= 0}
            className="mt-2 w-full bg-white/5 border border-white/10 text-white/60 font-bold py-2 rounded-lg md:rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-[10px] md:text-xs disabled:opacity-50"
          >
            <Send size={14} className="rotate-180" />
            <span>Withdraw to On-chain</span>
          </button>
        </div>
      </div>

      {/* Legacy Balance Migration Banner */}
      {balances.wallet > 0 && walletVerified && !legacyClaimed && (
        <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 border border-purple-500/30 rounded-xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <RefreshCw size={100} className="text-purple-500" />
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 z-10 relative">
            <div className="flex-1">
              <h3 className="text-base md:text-lg font-bold text-purple-300 mb-1 flex items-center gap-2">
                <RefreshCw size={18} className="text-purple-400" />
                Claim Your Legacy Balance
              </h3>
              <p className="text-[10px] md:text-xs text-white/50 mb-2">
                You have <span className="font-bold text-purple-300">{balances.wallet.toFixed(2)} USD</span> from before our Web3 migration.
                Claim it to your verified wallet as USDC. This is a one-time transfer.
              </p>
              <div className="flex items-center gap-2 text-[9px] text-white/30">
                <ShieldCheck size={10} className="text-green-400" />
                <span>Destination: {shortenAddress(firestoreWallet || "")} (Verified)</span>
              </div>
            </div>
            <button
              onClick={async () => {
                if (!user || claimingLegacy) return;
                setClaimingLegacy(true);
                toast.loading("Processing legacy balance claim...", { id: "claim-legacy" });
                try {
                  const result = await apiFetch<{ success: boolean; claimedAmount: number; txHash: string | null }>(
                    "/api/wallet/claim-legacy",
                    { method: "POST", body: JSON.stringify({ uid: user.uid }) }
                  );
                  if (result.success) {
                    toast.success(
                      `Successfully claimed ${result.claimedAmount?.toFixed(2)} USDC!${
                        result.txHash ? ` TX: ${result.txHash.slice(0, 12)}...` : ""
                      }`,
                      { id: "claim-legacy" }
                    );
                    setLegacyClaimed(true);
                    refreshBalances(address);
                  }
                } catch (e: any) {
                  console.error("Legacy claim failed:", e);
                  toast.error("Claim failed: " + (e.message || "Unknown error"), { id: "claim-legacy" });
                } finally {
                  setClaimingLegacy(false);
                }
              }}
              disabled={claimingLegacy}
              className="bg-purple-500 text-white font-bold px-5 py-3 rounded-xl text-xs md:text-sm hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2 shrink-0 shadow-lg shadow-purple-500/20"
            >
              <ArrowDownLeft size={16} />
              {claimingLegacy ? "Claiming..." : "Claim to Wallet"}
            </button>
          </div>
        </div>
      )}

      {/* Legacy claimed success state */}
      {legacyClaimed && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-green-400 shrink-0" />
          <p className="text-[10px] md:text-xs text-green-300">
            Your legacy balance has been successfully claimed and sent to your verified wallet.
          </p>
        </div>
      )}

      {/* Legacy balance exists but wallet not verified */}
      {balances.wallet > 0 && !walletVerified && !legacyClaimed && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-[10px] md:text-xs text-yellow-200/80">
            You have a legacy balance of <span className="font-bold">{balances.wallet.toFixed(2)} USD</span>.
            Connect and verify your wallet to claim it.
          </p>
        </div>
      )}

      {/* Notifications Section */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl p-4 md:p-8 relative overflow-hidden group shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
          <Bell size={60} className="text-purple-500 md:w-[120px] md:h-[120px]" />
        </div>
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
            <Bell size={20} />
          </div>
          <h3 className="text-base md:text-xl font-bold tracking-tight">System Notifications</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 p-3 md:p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className={`p-2 rounded-lg shrink-0 ${n.type === 'TRADE_STOPPED' ? 'bg-green-400/10 text-green-400' : 'bg-blue-400/10 text-blue-400'}`}>
                  {n.type === 'TRADE_STOPPED' ? <CheckCircle2 size={16} /> : <Info size={16} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-bold truncate">{n.title}</p>
                  <p className="text-[10px] md:text-xs text-white/40 line-clamp-2 mt-1">{n.message}</p>
                  <p className="text-[8px] md:text-[10px] text-white/20 mt-2 font-mono">{new Date(n.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
              <p className="text-xs md:text-sm text-white/20 italic">No recent notifications</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl p-4 md:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-4 md:mb-8">
          <h3 className="text-base md:text-xl font-bold tracking-tight">Recent Activity</h3>
          <button className="text-orange-500 text-[10px] md:text-sm font-bold hover:underline">View All</button>
        </div>
        <div className="space-y-2 md:space-y-4">
          {notifications.length > 0 ? (
            notifications.slice(0, 5).map((n) => (
              <div key={n.id} className="flex items-center justify-between p-3 md:p-4 bg-white/5 rounded-lg md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 ${
                    n.type === 'DEPOSIT' || n.type === 'TRADE_STOPPED' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {n.type === 'DEPOSIT' || n.type === 'TRADE_STOPPED' ? <ArrowDownLeft size={16} className="md:w-5 md:h-5" /> : <Send size={16} className="md:w-5 md:h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs md:text-base truncate">{n.title}</p>
                    <p className="text-[9px] md:text-xs text-white/40 truncate">{n.message}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-xs md:text-base ${n.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {n.amount ? (n.amount >= 0 ? "+" : "") + n.amount.toFixed(2) : ""}
                  </p>
                  <p className="text-[9px] md:text-xs text-white/40">{new Date(n.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
              <p className="text-xs md:text-sm text-white/20 italic">No recent activity</p>
            </div>
          )}
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
                <label className="text-[9px] md:text-xs font-bold text-white/40 uppercase mb-2 block">Asset</label>
                <div className="grid grid-cols-3 gap-2">
                  {assets.map((asset) => (
                    <button
                      key={asset}
                      onClick={() => setSendParams({ ...sendParams, asset })}
                      className={`py-2 md:py-3 rounded-lg md:rounded-xl border font-bold text-[10px] md:text-sm transition-all ${
                        sendParams.asset === asset
                          ? "bg-orange-500 border-orange-500 text-black"
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                      }`}
                    >
                      {asset}
                    </button>
                  ))}
                </div>
              </div>

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
                <label className="text-[9px] md:text-xs font-bold text-white/40 uppercase mb-2 block">Amount ({sendParams.asset})</label>
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

      {/* Withdraw Modal */}
      {showWithdrawModal && (() => {
        const resolvedAddress = withdrawParams.externalAddress.trim() || currentAccount?.address || "";
        const addressIsValid = isValidSuiAddress(resolvedAddress);
        const hasTypedAddress = withdrawParams.externalAddress.trim().length > 0;
        const typedAddressInvalid = hasTypedAddress && !isValidSuiAddress(withdrawParams.externalAddress.trim());
        const canSubmit = addressIsValid && !withdrawing && !!withdrawParams.amount && parseFloat(withdrawParams.amount) > 0;

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/90 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
          >
            <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Withdraw to On-chain</h3>
            
            <div className="space-y-4">
              {/* No wallet connected warning */}
              {!currentAccount && !hasTypedAddress && (
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] md:text-xs text-red-300">
                    No wallet connected. Please connect your wallet first or enter a destination address below.
                  </p>
                </div>
              )}

              <div>
                <label className="text-[9px] md:text-xs font-bold text-white/40 uppercase mb-2 block">Asset</label>
                <div className="grid grid-cols-2 gap-2">
                  {["USDT", "USDC"].map((asset) => (
                    <button
                      key={asset}
                      onClick={() => setWithdrawParams({ ...withdrawParams, asset })}
                      className={`py-2 md:py-3 rounded-lg md:rounded-xl border font-bold text-[10px] md:text-sm transition-all ${
                        withdrawParams.asset === asset
                          ? "bg-orange-500 border-orange-500 text-black"
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                      }`}
                    >
                      {asset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] md:text-xs font-bold text-white/40 uppercase mb-2 block">Amount (USD)</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={withdrawParams.amount}
                    onChange={(e) => setWithdrawParams({ ...withdrawParams, amount: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 focus:outline-none focus:border-orange-500 transition-all font-bold text-sm md:text-lg"
                  />
                  <button 
                    onClick={() => setWithdrawParams({ ...withdrawParams, amount: balances.wallet.toString() })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-500 hover:text-orange-400"
                  >
                    MAX
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-white/20">Available: {balances.wallet.toFixed(2)} USD</p>
              </div>

              <div>
                <label className="text-[9px] md:text-xs font-bold text-white/40 uppercase mb-2 block">Destination Wallet Address</label>
                <input
                  type="text"
                  placeholder={currentAccount?.address ? `Using connected: ${shortenAddress(currentAccount.address)}` : "Enter a Sui wallet address (0x...)"}
                  value={withdrawParams.externalAddress}
                  onChange={(e) => setWithdrawParams({ ...withdrawParams, externalAddress: e.target.value })}
                  className={`w-full bg-white/5 border rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 focus:outline-none transition-all font-mono text-[10px] md:text-sm ${
                    typedAddressInvalid ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-orange-500"
                  }`}
                />
                {typedAddressInvalid && (
                  <p className="mt-1 text-[10px] text-red-400">Invalid Sui address format. Must start with 0x and be 66 characters.</p>
                )}
                {!hasTypedAddress && currentAccount?.address && (
                  <p className="mt-1 text-[10px] text-green-400/60">✓ Will send to your connected wallet: {shortenAddress(currentAccount.address)}</p>
                )}
                {!hasTypedAddress && !currentAccount?.address && (
                  <p className="mt-1 text-[10px] text-red-400/80">Connect a wallet or enter a destination address above.</p>
                )}
              </div>

              <div className="bg-orange-500/10 border border-orange-500/20 p-3 md:p-4 rounded-xl md:rounded-2xl space-y-1 md:space-y-2">
                <div className="flex justify-between text-[9px] md:text-xs">
                  <span className="text-white/40">Network Fee</span>
                  <span className="font-bold">0.50 SUI (Treasury Paid)</span>
                </div>
                <div className="flex justify-between text-[9px] md:text-xs">
                  <span className="text-white/40">Destination</span>
                  <span className={`font-bold font-mono ${addressIsValid ? "text-green-400" : "text-red-400"}`}>
                    {addressIsValid ? shortenAddress(resolvedAddress, 8, 6) : "No valid address"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 md:gap-3 pt-2">
                <button
                  onClick={() => { setShowWithdrawModal(false); setWithdrawParams({ amount: "", asset: "USDT", externalAddress: "" }); }}
                  className="flex-1 bg-white/5 border border-white/10 py-3 md:py-4 rounded-lg md:rounded-2xl font-bold text-xs md:text-base hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={!canSubmit}
                  className="flex-1 bg-orange-500 text-black py-3 md:py-4 rounded-lg md:rounded-2xl font-bold text-xs md:text-base hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {withdrawing ? "Processing..." : !addressIsValid ? "Wallet Required" : "Confirm Withdrawal"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      );
      })()}

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




