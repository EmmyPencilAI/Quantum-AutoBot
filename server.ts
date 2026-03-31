import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import { SuiJsonRpcClient as SuiClient } from "@mysten/sui/jsonRpc";
import { getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import { decodeSuiPrivateKey as decodeSuiPrivateKeySDK } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromHex } from "@mysten/sui/utils";

dotenv.config();

// Helper to decode Sui private key (handles both hex and suiprivkey format)
function decodeSuiPrivateKey(key: string): Uint8Array {
  const cleanKey = key.trim();
  if (cleanKey.startsWith("suiprivkey")) {
    const { secretKey } = decodeSuiPrivateKeySDK(cleanKey);
    return secretKey;
  }
  // Remove 0x prefix if present and decode hex
  return fromHex(cleanKey.replace("0x", ""));
}

// Sui Client for Backend
const suiClient = new SuiClient({ url: getFullnodeUrl("testnet"), network: "testnet" });

// Load Firebase Config
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let db: any = null;

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    
    if (!admin.apps.length) {
      try {
        // Prioritize explicit projectId from config to avoid connecting to the wrong project
        admin.initializeApp({
          projectId: firebaseConfig.projectId,
        });
        console.log(`Firebase Admin initialized with explicit projectId: ${firebaseConfig.projectId}`);
      } catch (e) {
        console.warn("Explicit Firebase Admin initialization failed, trying default:", e);
        try {
          admin.initializeApp();
          console.log("Firebase Admin initialized with default environment config");
        } catch (e2) {
          console.error("Critical: Firebase Admin initialization failed completely:", e2);
        }
      }
    }
    
    const adminApp = admin.app();
    // Use the named database if provided, otherwise default
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    
    try {
      db = getFirestore(adminApp, dbId);
      // Test the connection immediately with a write operation
      await db.collection("health_check").doc("ping").set({ 
        lastPing: new Date().toISOString(),
        projectId: firebaseConfig.projectId,
        databaseId: dbId
      });
      console.log(`Firebase Admin connected successfully to database: ${dbId}`);
    } catch (e: any) {
      console.error(`Failed to connect to named database ${dbId}, falling back to (default):`, e.message);
      try {
        db = getFirestore(adminApp, "(default)");
        await db.collection("health_check").doc("ping").set({ 
          lastPing: new Date().toISOString(),
          projectId: firebaseConfig.projectId,
          databaseId: "(default)"
        });
        console.log("Firebase Admin connected successfully to (default) database");
      } catch (e2: any) {
        console.error("Critical: Failed to connect to both named and (default) databases:", e2.message);
      }
    }
    
    console.log(`Firebase Admin initialized for project: ${firebaseConfig.projectId}`);
  } catch (e) {
    console.error("Critical failure during Firebase Admin initialization:", e);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Community Bot Logic
const BOT_MESSAGES = [
  "🚀 Quantum Alpha strategy just hit a 15% gain on BTC/USDT!",
  "📈 Market update: BTC showing strong support at 65k. Momentum strategy looking good!",
  "📉 Market Sentiment: Bullish on Sui ecosystem tokens.",
  "🤖 Quantum Bot: Successfully settled 124 trades in the last hour.",
  "🌊 Liquidity Update: Sui Network TVL reaching new heights!",
  "⚡ Instant Settlement: Average trade settlement time is now under 2 seconds.",
  "🛡️ Security: All trades are secured by zkLogin and non-custodial smart contracts.",
  "🌟 New Milestone: 10,000 active traders now using Quantum Finance!",
  "📊 Strategy Update: Momentum strategy is currently outperforming others by 8%.",
  "🔥 Hot Pair: SUI/USDT volume is up 45% in the last 24 hours!",
  "💎 New trading pair added: SOL/USDT. Check it out in the dashboard.",
  "💰 Quantum Treasury just settled 500 USDT in profits. Distributed 50/50!",
  "Strategy Tip: Aggressive strategy works best in high volatility markets.",
  "Welcome to the Quantum Finance community! Share your insights below.",
  "Leaderboard update: Top trader just hit +10,000 USDT profit!",
  "Quantum Finance is now fully integrated with Sui Testnet.",
  "Did you know? Our Quantum engine uses advanced AI to optimize trade entries.",
];

const WHALE_ALERTS = [
  "🚨 WHALE ALERT: 500,000 USDT moved from unknown wallet to Quantum Treasury!",
  "🚨 WHALE ALERT: 300,000 USDT position opened on ETH/USDT using Aggressive Strategy!",
  "🚨 WHALE ALERT: 100,000 USDT profit settled by top trader on SOL/USDT!",
  "🚨 WHALE ALERT: 250,000 USDT liquidity added to SUI/USDT pool!",
  "🚨 WHALE ALERT: 500,000 USDT trade executed on BTC/USDT. Market volatility increasing!",
  "🚨 WHALE ALERT: 300,000 USDT funding received for high-frequency trading session!",
  "🚨 WHALE ALERT: 100,000 USDT profit shared with community treasury!",
  "🐋 WHALE ALERT: 500,000 USDT just bridged from Ethereum to Sui via Quantum!",
  "🐋 WHALE ALERT: 300,000 USDT just deposited into a high-yield Quantum strategy!",
  "🐋 WHALE ALERT: 100,000 USDT just realized by a top Quantum trader!",
  "🐋 WHALE ALERT: 500,000 USDT liquidity just moved into Quantum Alpha pool!",
  "🐋 WHALE ALERT: 300,000 USDT just entered a long position on ETH/USDT!",
];

async function postBotMessage() {
  if (!db) {
    console.warn("Bot skipped post: Firestore Admin not initialized");
    return;
  }
  try {
    const isWhale = Math.random() < 0.3;
    const message = isWhale 
      ? WHALE_ALERTS[Math.floor(Math.random() * WHALE_ALERTS.length)]
      : BOT_MESSAGES[Math.floor(Math.random() * BOT_MESSAGES.length)];
    
    const postData = {
      authorUid: "system-bot",
      authorName: "Quantum Bot",
      authorAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=quantum_bot",
      authorWallet: "0x0000000000000000000000000000000000000000",
      content: message,
      likesCount: Math.floor(Math.random() * 10),
      createdAt: new Date().toISOString()
    };
    
    console.log("Bot (Admin SDK) attempting to post:", JSON.stringify(postData));
    await db.collection("posts").add(postData);
    console.log("Bot (Admin SDK) posted successfully:", message);
  } catch (error: any) {
    console.error("Bot (Admin SDK) failed to post:", error.message || error);
  }
}

// Post every 15 minutes
if (db) {
  setInterval(postBotMessage, 900000);
  // Post one immediately on start
  setTimeout(postBotMessage, 5000);
}

// Background Trading Engine
async function processBackgroundTrades() {
  if (!db) return;
  
  try {
    const usersRef = db.collection("users");
    // Ensure the collection exists by attempting a simple get
    try {
      await usersRef.limit(1).get();
    } catch (e: any) {
      if (e.code === 5 || e.message?.includes("NOT_FOUND")) {
        console.warn("Firestore collection 'users' not found or initialized yet. Skipping background trades.");
        return;
      }
      throw e;
    }
    
    const tradingUsers = await usersRef.where("isTrading", "==", true).get();
    
    if (tradingUsers.empty) {
      // Occasionally post a generic update if no one is trading
      if (Math.random() < 0.05) {
        await postBotMessage();
      }
      return;
    }
    
    console.log(`Processing background trades for ${tradingUsers.size} users...`);
    
    const batch = db.batch();
    const now = new Date().toISOString();
    
    for (const userDoc of tradingUsers.docs) {
      const userData = userDoc.data();
      const strategy = userData.activeStrategy || "Momentum";
      
      // Simulate a small profit/loss per minute
      let profitFactor = 0.0001; // Base 0.01% per minute
      switch (strategy) {
        case "Aggressive": profitFactor = 0.0005; break;
        case "Momentum": profitFactor = 0.0002; break;
        case "Scalping": profitFactor = 0.0001; break;
        case "Conservative": profitFactor = 0.00005; break;
      }
      
      const tradingAsset = userData.tradingAsset || "USDT";
      const balanceField = tradingAsset === "USDC" ? "usdcBalance" : "usdtBalance";
      const currentAssetBalance = userData[balanceField] || 0;

      // Randomize slightly
      const actualProfit = currentAssetBalance * profitFactor * (Math.random() * 2 - 0.8);
      const newBalance = currentAssetBalance + actualProfit;
      const newTotalProfit = (userData.totalProfit || 0) + actualProfit;
      
      batch.update(userDoc.ref, {
        [balanceField]: newBalance,
        totalProfit: newTotalProfit,
        lastTradeAt: now
      });
      
      // Occasionally create a trade record
      if (Math.random() < 0.2) {
        const tradeRef = db.collection("trades").doc();
        const tradeAmount = Math.abs(actualProfit) * 10;
        batch.set(tradeRef, {
          uid: userData.uid,
          pair: userData.activePair || "BTC/USDT",
          type: actualProfit >= 0 ? "Buy" : "Sell",
          amount: tradeAmount,
          asset: tradingAsset,
          price: 65000 + (Math.random() * 1000 - 500),
          pnl: actualProfit,
          duration: Math.floor(Math.random() * 60) + 10, // Simulated duration in seconds
          timestamp: now
        });

        // Post significant trades to community
        if (tradeAmount > 500) {
          const tradeMsg = `🚀 Trade Update: ${userData.displayName || 'A trader'} just executed a ${tradeAmount.toFixed(2)} ${tradingAsset} ${actualProfit >= 0 ? 'Buy' : 'Sell'} on ${userData.activePair || 'BTC/USDT'}!`;
          await db.collection("posts").add({
            authorUid: "system-bot",
            authorName: "Quantum Bot",
            authorAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=quantum_bot",
            authorWallet: "0x0000000000000000000000000000000000000000",
            content: tradeMsg,
            likesCount: 0,
            createdAt: now
          });
        }
      }
    }
    
    await batch.commit();
    console.log(`Background trades processed successfully for ${tradingUsers.size} users`);
  } catch (error: any) {
    console.error("Error in background trading loop:", error.message || error);
    if (error.code === 7 || error.message?.includes("PERMISSION_DENIED")) {
      console.error("CRITICAL: Permission denied in background trading loop. Check Firebase Admin credentials and project permissions.");
    } else if (error.code === 5 || error.message?.includes("NOT_FOUND")) {
      console.warn("Firestore collection not found or initialized yet. Skipping background trades.");
    }
  }
}

// Run background trading every 15 seconds
if (db) {
  setInterval(processBackgroundTrades, 15000);
}

// Sui Config (Mirroring src/lib/sui.ts)
const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";
const SUI_TYPE = "0x2::sui::SUI";
const SUI_CONTRACT_ADDRESS = process.env.VITE_SUI_CONTRACT_ADDRESS || "0x7ec914c89d99920f01c2a6aba892ec63bbdae74ca522f5ca4407d961a0263876";
const SUI_TREASURY_ADDRESS = process.env.VITE_SUI_TREASURY_ADDRESS || "0x40e4e861562d786bbdc68e2ace97b579a6022e8a1d9bad850112138c301e0e41";

// USDT on Sui Testnet
const USDT_TYPE = "0x5d4b302306649423527773c6827317e943975d607a097e16f20935055b45c2ad::coin::COIN";
// USDC on Sui Testnet
const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

async function getDecimals(coinType: string): Promise<number> {
  if (coinType === SUI_TYPE || coinType.includes("sui::SUI")) return 9;
  try {
    const metadata = await suiClient.getCoinMetadata({ coinType });
    return metadata?.decimals ?? 6;
  } catch (e) {
    console.error("Error fetching coin metadata:", e);
    return 6;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Global request logger for debugging 404s
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Wallet Withdrawal Endpoint
  app.post("/api/wallet/withdraw", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    const { uid, amount, asset, walletAddress } = req.body;
    if (!uid || !amount || !walletAddress) return res.status(400).json({ error: "Invalid request" });

    try {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      const userData = userDoc.data();
      const currentWalletBalance = userData.walletBalance || 0;

      if (amount > currentWalletBalance) {
        return res.status(400).json({ error: "Insufficient trading wallet balance" });
      }

      // 1. Update Firestore first (Optimistic or Lock)
      const newWalletBalance = currentWalletBalance - amount;
      await userRef.update({
        walletBalance: newWalletBalance
      });

      // 2. Perform On-Chain Transfer from Treasury to User
      let txHash = "0x" + Math.random().toString(16).slice(2);
      let onChainError = null;
      let isSimulated = true;

      if (process.env.SUI_PRIVATE_KEY) {
        try {
          isSimulated = false;
          console.log(`Attempting REAL on-chain withdrawal for ${walletAddress} on Sui...`);
          const secretKey = decodeSuiPrivateKey(process.env.SUI_PRIVATE_KEY);
          const keypair = Ed25519Keypair.fromSecretKey(secretKey);
          const txb = new Transaction();
          const coinType = asset === "SUI" ? SUI_TYPE : (asset === "USDC" ? USDC_TYPE : USDT_TYPE);
          const decimals = await getDecimals(coinType);
          
          // Platform Fee (0.1%)
          const feePercent = 0.001;
          const feeAmount = amount * feePercent;
          const netAmount = amount - feeAmount;
          
          const rawNetAmount = Math.floor(netAmount * Math.pow(10, decimals));
          const rawFeeAmount = Math.floor(feeAmount * Math.pow(10, decimals));

          if (asset === "SUI") {
            if (rawFeeAmount > 0) {
              const [feeCoin] = txb.splitCoins(txb.gas, [rawFeeAmount]);
              txb.transferObjects([feeCoin], SUI_TREASURY_ADDRESS);
            }
            const [mainCoin] = txb.splitCoins(txb.gas, [rawNetAmount]);
            txb.transferObjects([mainCoin], walletAddress);
          } else {
            // Token Transfer (USDT/USDC)
            const coins = await suiClient.getCoins({
              owner: keypair.toSuiAddress(),
              coinType: coinType,
            });

            if (coins.data.length === 0) throw new Error(`No ${asset} coins found in treasury`);

            const coinObjectIds = coins.data.map((c) => c.coinObjectId);
            const primaryCoin = coinObjectIds[0];
            const rest = coinObjectIds.slice(1);
            
            if (rest.length > 0) {
              txb.mergeCoins(txb.object(primaryCoin), rest.map(id => txb.object(id)));
            }

            if (rawFeeAmount > 0) {
              const [feeCoin] = txb.splitCoins(txb.object(primaryCoin), [rawFeeAmount]);
              txb.transferObjects([feeCoin], SUI_TREASURY_ADDRESS);
            }

            const [mainCoin] = txb.splitCoins(txb.object(primaryCoin), [rawNetAmount]);
            txb.transferObjects([mainCoin], walletAddress);
          }
          
          txb.setGasBudget(10000000); // 0.01 SUI
          
          const result = await suiClient.signAndExecuteTransaction({
            signer: keypair,
            transaction: txb,
          });
          
          txHash = result.digest;
          await suiClient.waitForTransaction({ digest: txHash });
          console.log(`Real Sui Withdrawal TX: ${txHash}`);
        } catch (e: any) {
          console.error("Real Sui withdrawal failed:", e);
          onChainError = e.message || "Sui blockchain transaction failed";
          
          // Rollback Firestore if on-chain fails
          await userRef.update({
            walletBalance: currentWalletBalance // Rollback
          });
          return res.status(500).json({ error: "On-chain transfer failed. Balance rolled back." });
        }
      }

      // Create notification
      await db.collection("notifications").add({
        uid,
        type: "WITHDRAWAL",
        title: "Withdrawal Successful",
        message: `Successfully withdrawn ${amount.toFixed(2)} ${asset || 'USD'} to your on-chain wallet.`,
        amount,
        asset: asset || 'USD',
        txHash,
        timestamp: new Date().toISOString(),
        read: false
      });

      res.json({
        success: true,
        newWalletBalance,
        txHash,
        isSimulated,
        message: isSimulated 
          ? "Withdrawal successful (Simulated: SUI_PRIVATE_KEY not set)." 
          : "Withdrawal successful."
      });
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Trading Engine Simulation & Settlement
  app.post("/api/trading/settle", async (req, res) => {
    const { uid, walletAddress } = req.body;
    if (!db || !uid) return res.status(400).json({ error: "Invalid request" });

    try {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      const userData = userDoc.data();
      const tradingAsset = userData.tradingAsset || "USDT";
      const balanceField = tradingAsset === "USDC" ? "usdcBalance" : "usdtBalance";
      
      const currentAssetBalance = userData[balanceField] || 0;
      const initialInvestment = userData.initialInvestment || 0;
      const profit = currentAssetBalance - initialInvestment;

      // Calculate shares (50/50 split on profit)
      const userProfitShare = profit > 0 ? profit * 0.5 : profit;
      const treasuryShare = profit > 0 ? profit * 0.5 : 0;
      const totalToUser = initialInvestment + userProfitShare;

      console.log(`Settling for ${uid}: Asset=${tradingAsset}, Current=${currentAssetBalance}, Initial=${initialInvestment}, Profit=${profit}, ToUser=${totalToUser}, ToTreasury=${treasuryShare}`);
      console.log(`Using Treasury: ${SUI_TREASURY_ADDRESS}, Contract: ${SUI_CONTRACT_ADDRESS}`);

      // Update Firestore
      const walletBalance = userData.walletBalance || 0;
      const newWalletBalance = walletBalance + totalToUser;

      await userRef.update({
        isTrading: false,
        [balanceField]: 0,
        initialInvestment: 0,
        walletBalance: newWalletBalance,
        lastSettlement: {
          amount: totalToUser,
          profit: userProfitShare,
          treasury: treasuryShare,
          asset: tradingAsset,
          treasuryAddress: SUI_TREASURY_ADDRESS,
          timestamp: new Date().toISOString()
        }
      });

      // Create notification
      await db.collection("notifications").add({
        uid,
        type: "TRADE_STOPPED",
        title: "Trading Stopped",
        message: `Trading session ended. Returned ${totalToUser.toFixed(2)} ${tradingAsset} to your wallet.`,
        amount: totalToUser,
        asset: tradingAsset,
        timestamp: new Date().toISOString(),
        read: false
      });

      // Post settlement to community
      if (profit > 0) {
        await db.collection("posts").add({
          authorUid: "system-bot",
          authorName: "Quantum Bot",
          authorAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=quantum_bot",
          authorWallet: "0x0000000000000000000000000000000000000000",
          content: `🎉 Settlement Update: ${userData.displayName || 'A trader'} just settled a trading session with ${profit.toFixed(2)} ${tradingAsset} profit! Shared 50/50 with Treasury.`,
          likesCount: 0,
          createdAt: new Date().toISOString()
        });
      }

      // Real On-Chain Settlement (Sui Implementation)
      let txHash = "0x" + Math.random().toString(16).slice(2);
      let onChainError = null;

      if (process.env.SUI_PRIVATE_KEY) {
        try {
          const secretKey = decodeSuiPrivateKey(process.env.SUI_PRIVATE_KEY);
          const keypair = Ed25519Keypair.fromSecretKey(secretKey);
          
          console.log(`Attempting REAL on-chain settlement for ${walletAddress || uid} on Sui...`);
          
          const txb = new Transaction();
          const coinType = tradingAsset === "USDC" ? USDC_TYPE : USDT_TYPE;
          const decimals = await getDecimals(coinType);
          
          // Platform Fee (0.1%)
          const feePercent = 0.001;
          const feeAmount = totalToUser * feePercent;
          const netAmount = totalToUser - feeAmount;
          
          const rawNetAmount = Math.floor(netAmount * Math.pow(10, decimals));
          const rawFeeAmount = Math.floor(feeAmount * Math.pow(10, decimals));

          // Transfer the assets from Treasury back to User
          const coins = await suiClient.getCoins({
            owner: keypair.toSuiAddress(),
            coinType: coinType,
          });

          if (coins.data.length > 0) {
            const coinObjectIds = coins.data.map((c) => c.coinObjectId);
            const primaryCoin = coinObjectIds[0];
            const rest = coinObjectIds.slice(1);
            
            if (rest.length > 0) {
              txb.mergeCoins(txb.object(primaryCoin), rest.map(id => txb.object(id)));
            }

            if (rawFeeAmount > 0) {
              const [feeCoin] = txb.splitCoins(txb.object(primaryCoin), [rawFeeAmount]);
              txb.transferObjects([feeCoin], SUI_TREASURY_ADDRESS);
            }

            const [mainCoin] = txb.splitCoins(txb.object(primaryCoin), [rawNetAmount]);
            txb.transferObjects([mainCoin], walletAddress || userData.walletAddress);
            
            txb.setGasBudget(10000000); // 0.01 SUI
            
            const result = await suiClient.signAndExecuteTransaction({
              signer: keypair,
              transaction: txb,
            });
            
            txHash = result.digest;
            await suiClient.waitForTransaction({ digest: txHash });
            console.log(`Real Sui Settlement TX: ${txHash}`);
          } else {
            console.warn(`No ${tradingAsset} coins found in treasury for settlement`);
            onChainError = `No ${tradingAsset} coins found in treasury`;
          }
        } catch (e: any) {
          console.error("Real Sui settlement failed:", e);
          onChainError = e.message || "Sui blockchain transaction failed";
        }
      }
      
      res.json({
        success: true,
        totalToUser,
        userProfitShare,
        treasuryShare,
        txHash,
        onChainError,
        message: onChainError ? `Settlement recorded, but on-chain transfer failed: ${onChainError}` : "Settlement successful. Funds returned to wallet."
      });
    } catch (error: any) {
      console.error("Settlement error:", error);
      res.status(500).json({ success: false, error: error.message || "Internal server error" });
    }
  });

  // Community Comments
  app.post("/api/community/comment", async (req, res) => {
    if (!db) return res.status(500).json({ success: false, error: "Database not initialized" });
    try {
      const { postId, uid, authorName, authorAvatar, content } = req.body;
      if (!postId || !uid || !content) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      // Check if post exists
      const postRef = db.collection("posts").doc(postId);
      const postDoc = await postRef.get();
      if (!postDoc.exists) {
        return res.status(404).json({ success: false, error: "Post not found" });
      }

      const comment = {
        uid,
        authorName,
        authorAvatar,
        content,
        createdAt: new Date().toISOString()
      };

      await postRef.collection("comments").add(comment);
      await postRef.update({
        commentsCount: admin.firestore.FieldValue.increment(1)
      });

      res.json({ success: true, comment });
    } catch (error: any) {
      console.error("Comment error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/community/like", async (req, res) => {
    if (!db) return res.status(500).json({ success: false, error: "Database not initialized" });
    try {
      const { postId, uid } = req.body;
      if (!postId || !uid) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      const postRef = db.collection("posts").doc(postId);
      const postDoc = await postRef.get();
      if (!postDoc.exists) {
        return res.status(404).json({ success: false, error: "Post not found" });
      }

      const likeRef = postRef.collection("likes").doc(uid);
      const likeDoc = await likeRef.get();

      if (likeDoc.exists) {
        // Unlike
        await likeRef.delete();
        await postRef.update({
          likesCount: admin.firestore.FieldValue.increment(-1)
        });
        return res.json({ success: true, liked: false });
      } else {
        // Like
        await likeRef.set({ uid, createdAt: new Date().toISOString() });
        await postRef.update({
          likesCount: admin.firestore.FieldValue.increment(1)
        });
        return res.json({ success: true, liked: true });
      }
    } catch (error: any) {
      console.error("Like error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/trading/simulate", async (req, res) => {
    const { strategy, principal, duration, account } = req.body;
    
    if (isNaN(principal) || principal <= 0) {
        return res.status(400).json({ error: "Invalid principal amount" });
    }

    // Simple simulation logic based on strategy
    let multiplier = 1.0;
    let risk = 0.05;

    switch (strategy) {
      case "Aggressive":
        multiplier = 1.1 + (Math.random() * 0.2 - 0.1); // -10% to +30%
        risk = 0.15;
        break;
      case "Momentum":
        multiplier = 1.05 + (Math.random() * 0.1 - 0.02); // -2% to +13%
        risk = 0.08;
        break;
      case "Scalping":
        multiplier = 1.02 + (Math.random() * 0.05 - 0.01); // -1% to +6%
        risk = 0.03;
        break;
      case "Conservative":
        multiplier = 1.01 + (Math.random() * 0.02 - 0.005); // -0.5% to +2.5%
        risk = 0.01;
        break;
      default:
        multiplier = 1.0;
    }

    if (Math.random() < risk) {
        multiplier *= (0.8 + Math.random() * 0.15);
    }

    const finalBalanceVal = principal * multiplier;
    const profit = finalBalanceVal - principal;
    
    // 50/50 profit split: user gets principal + 50% of profit (if profit > 0)
    // If profit is negative, user takes the full loss
    const userShareOfProfit = profit > 0 ? profit * 0.5 : profit;
    const userFinalBalance = principal + userShareOfProfit;
    
    // Ensure we have a valid number and it's not negative
    let finalBalanceFormatted = 0;
    if (!isNaN(userFinalBalance) && isFinite(userFinalBalance)) {
      finalBalanceFormatted = Math.max(0, userFinalBalance);
    }

    console.log(`Simulation: Strategy=${strategy}, Principal=${principal}, Multiplier=${multiplier}, Profit=${profit}, UserShare=${userShareOfProfit}, Final=${finalBalanceFormatted}`);

    let txHash = null;
    let error = null;

    // Real On-Chain Settlement if Private Key is present (Sui Implementation)
    if (account && process.env.SUI_PRIVATE_KEY) {
      try {
        console.log(`Attempting on-chain settlement for ${account} on Sui with balance ${finalBalanceFormatted}`);
        // In a real Sui implementation, we would use Sui SDK to execute a Move call
        // For now, we simulate the success of the on-chain action
        txHash = "0x" + Math.random().toString(16).slice(2);
        console.log(`Sui Settlement TX simulated: ${txHash}`);
      } catch (e: any) {
        console.error("Sui settlement failed:", e);
        error = e.message || "Unknown Sui blockchain error";
      }
    } else if (!process.env.SUI_PRIVATE_KEY) {
      console.log("Skipping on-chain settlement: SUI_PRIVATE_KEY not set");
    }

    res.json({
      finalBalance: finalBalanceFormatted,
      profit: userShareOfProfit, // Return the user's share of profit
      totalProfit: profit, // Return the total profit generated
      txHash,
      error,
      timestamp: new Date().toISOString()
    });
  });

  // Leaderboard Endpoint
  app.get("/api/leaderboard", async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    try {
      const topTraders = await db.collection("users")
        .orderBy("totalProfit", "desc")
        .limit(10)
        .get();
      
      const traders = topTraders.docs.map((doc: any) => ({
        id: doc.id,
        name: doc.data().displayName || "Anonymous",
        avatar: doc.data().photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${doc.id}`,
        profit: doc.data().totalProfit || 0,
        isTrading: doc.data().isTrading || false
      }));
      
      res.json(traders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Firebase Admin Status Endpoint
  app.get("/api/admin/status", async (req, res) => {
    if (!db) {
      return res.json({ status: "error", message: "Firebase Admin not initialized" });
    }
    try {
      const config = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
      const dbId = config.firestoreDatabaseId || "(default)";
      const testDoc = await db.collection("health_check").doc("ping").get();
      res.json({ 
        status: "ok", 
        projectId: config.projectId,
        databaseId: dbId,
        lastPing: testDoc.exists ? testDoc.data()?.lastPing : "none"
      });
    } catch (e: any) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  // Crypto Prices Endpoint
  app.get("/api/prices", async (req, res) => {
    try {
      const apiKey = process.env.COINGECKO_API_KEY;
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false`;
      
      console.log(`Fetching prices from CoinGecko. API Key present: ${!!apiKey}`);
      
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (apiKey) {
        // Try both header and query param for maximum compatibility
        headers['x-cg-demo-api-key'] = apiKey;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const text = await response.text();
        console.warn(`CoinGecko API returned status ${response.status}: ${text}`);
        
        // If unauthorized or rate limited, return a fallback to keep the UI working
        if (response.status === 401 || response.status === 429 || response.status === 403) {
          console.log("Returning fallback price data due to API error");
          return res.json(getFallbackPrices());
        }
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch prices:", error);
      // Always return fallback data instead of 500 to keep the app functional
      res.json(getFallbackPrices());
    }
  });

  // Fallback price data for when API is unavailable
  function getFallbackPrices() {
    return [
      { id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 65432.10, price_change_percentage_24h: 2.5, image: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png" },
      { id: "ethereum", symbol: "eth", name: "Ethereum", current_price: 3456.78, price_change_percentage_24h: -1.2, image: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" },
      { id: "binancecoin", symbol: "bnb", name: "BNB", current_price: 580.45, price_change_percentage_24h: 0.8, image: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png" },
      { id: "solana", symbol: "sol", name: "Solana", current_price: 145.20, price_change_percentage_24h: 5.4, image: "https://assets.coingecko.com/coins/images/4128/large/solana.png" },
      { id: "ripple", symbol: "xrp", name: "XRP", current_price: 0.62, price_change_percentage_24h: -0.5, image: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png" },
      { id: "cardano", symbol: "ada", name: "Cardano", current_price: 0.45, price_change_percentage_24h: 1.1, image: "https://assets.coingecko.com/coins/images/975/large/cardano.png" },
      { id: "avalanche-2", symbol: "avax", name: "Avalanche", current_price: 35.67, price_change_percentage_24h: -2.3, image: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png" },
      { id: "polkadot", symbol: "dot", name: "Polkadot", current_price: 7.89, price_change_percentage_24h: 0.2, image: "https://assets.coingecko.com/coins/images/12171/large/polkadot.png" }
    ];
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Quantum Finance Server running on http://localhost:${PORT}`);
  });
}

startServer();
