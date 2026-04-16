import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey as decodeSuiPrivateKeySDK } from "@mysten/sui/cryptography";
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
const suiClient = new SuiClient({ url: getFullnodeUrl("testnet"), network: "testnet" as any });

// Load Firebase Config
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let db: any = null;

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    
    if (!admin.apps.length) {
      // Check for service account credentials (required for Render/production)
      const serviceAccountEnv = process.env.GOOGLE_CREDENTIALS_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
      
      if (serviceAccountEnv) {
        try {
          // FIREBASE_SERVICE_ACCOUNT can be JSON string or base64 encoded
          let serviceAccount;
          try {
            serviceAccount = JSON.parse(serviceAccountEnv);
          } catch {
            // Try base64 decode
            serviceAccount = JSON.parse(Buffer.from(serviceAccountEnv, 'base64').toString('utf-8'));
          }
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: firebaseConfig.projectId,
          });
          console.log(`Firebase Admin initialized with service account for project: ${firebaseConfig.projectId}`);
        } catch (e) {
          console.error("Failed to initialize with FIREBASE_SERVICE_ACCOUNT:", e);
          // Fallback to projectId only
          admin.initializeApp({ projectId: firebaseConfig.projectId });
          console.warn("Firebase Admin initialized with projectId only (credentials may fail on Render)");
        }
      } else {
        // No service account - use projectId only (works locally with gcloud auth)
        try {
          admin.initializeApp({ projectId: firebaseConfig.projectId });
          console.log(`Firebase Admin initialized with projectId: ${firebaseConfig.projectId}`);
          console.warn("WARNING: No FIREBASE_SERVICE_ACCOUNT env var set. Firebase Admin may fail on production.");
        } catch (e) {
          console.error("Firebase Admin initialization failed:", e);
        }
      }
    }
    
    const adminApp = admin.app();
    // Use the named database if provided, otherwise default
    const dbId = firebaseConfig.firestoreDatabaseId || "";
    
    const tryConnect = async (targetDbId: string | undefined) => {
      const displayId = targetDbId || "(default)";
      console.log(`Attempting to connect to Firestore Database: ${displayId}`);
      const testDb = getFirestore(adminApp, targetDbId);
      await testDb.collection("health_check").doc("ping").set({ 
        lastPing: new Date().toISOString(),
        projectId: firebaseConfig.projectId,
        databaseId: displayId
      });
      return testDb;
    };

    try {
      // 1. Try the one from config if it looks valid
      const initialDbId = (!dbId || dbId.includes("TODO") || dbId === "") ? undefined : dbId;
      db = await tryConnect(initialDbId);
      console.log(`Firebase Admin connected successfully to database: ${initialDbId || "(default)"}`);
    } catch (e: any) {
      console.error(`Failed to connect to initial database ${dbId || "(default)"}:`, e.message);
      try {
        // 2. Try explicit (default)
        db = await tryConnect("(default)");
        console.log("Firebase Admin connected successfully to (default) database");
      } catch (e2: any) {
        console.error("Failed to connect to (default) database:", e2.message);
        try {
          // 3. Try undefined
          db = await tryConnect(undefined);
          console.log("Firebase Admin connected successfully to undefined (default) database");
        } catch (e3: any) {
          console.error("Critical: Failed to connect to any Firestore database:", e3.message);
          // Ultimate fallback to allow the object to exist even if it fails later
          db = getFirestore(adminApp);
        }
      }
    }
    
    console.log(`Firebase Admin initialized for project: ${firebaseConfig.projectId}`);
  } catch (e) {
    console.error("Critical failure during Firebase Admin initialization:", e);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Authentication middleware for backend APIs
async function authenticate(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn(`Unauthorized attempt: ${req.method} ${req.url} - Missing header`);
    return res.status(401).json({ error: "Unauthorized: Missing or invalid authorization header" });
  }

  const idToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    // Check if the UID in body/params matches the token UID for extra security
    const requestedUid = req.body.uid || req.query.uid;
    if (requestedUid && requestedUid !== decodedToken.uid) {
      console.warn(`Security Breach attempt: ${decodedToken.uid} tried to access ${requestedUid}'s data`);
      return res.status(403).json({ error: "Forbidden: You can only access your own data" });
    }
    next();
  } catch (error) {
    console.error("Authentication failed:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid ID token" });
  }
}

// Migration to fix missing totalProfit fields (確保 Leaderboard 顯示所有用戶)
async function fixMissingTotalProfit() {
  if (!db) return;
  try {
    console.log("Starting migration to fix missing totalProfit fields...");
    const usersSnapshot = await db.collection("users").get();
    let fixedCount = 0;
    const batch = db.batch();
    
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      if (data.totalProfit === undefined) {
        batch.update(doc.ref, { totalProfit: 0 });
        fixedCount++;
      }
      // Periodically commit large batches
      if (fixedCount % 400 === 0 && fixedCount > 0) {
        await batch.commit();
      }
    }
    
    if (fixedCount > 0) {
      await batch.commit();
      console.log(`Migration completed: Fixed ${fixedCount} users.`);
    } else {
      console.log("Migration completed: No users required fixing.");
    }
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

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
      commentsCount: 0,
      createdAt: new Date().toISOString()
    };
    
    console.log("Bot (Admin SDK) attempting to post to 'posts' collection...");
    await db.collection("posts").add(postData);
    console.log("Bot (Admin SDK) posted successfully:", message);
  } catch (error: any) {
    console.error("Bot (Admin SDK) failed to post. Error Code:", error.code, "Message:", error.message || error);
    if (error.code === 5) {
      console.error("Diagnostic: 5 NOT_FOUND often means the database ID in firebase-applet-config.json is incorrect or the database was deleted.");
    }
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
      
      // AI Strategy Parameters
      let profitFactor = 0.001; 
      let winRate = 0.5;
      let isAggressive = strategy === "Aggressive";
      
      switch (strategy) {
        case "Aggressive": 
          // High ROI: ~0.5% to 1.5% per update
          profitFactor = 0.005 + (Math.random() * 0.01); 
          winRate = 1.0; // 100% Win Rate as requested
          break;
        case "Momentum": 
          profitFactor = 0.002; 
          winRate = 0.65;
          break;
        case "Scalping": 
          profitFactor = 0.0015; 
          winRate = 0.75;
          break;
        case "Conservative": 
          profitFactor = 0.0008; 
          winRate = 0.85;
          break;
      }
      
      const tradingAsset = userData.tradingAsset || "USDT";
      const balanceField = tradingAsset === "USDC" ? "usdcBalance" : "usdtBalance";
      const currentAssetBalance = userData[balanceField] || 0;

      // Lot Size Logic: Start at 0.05 and grow overtime
      let currentLotSize = userData.currentLotSize || 0.05;
      // Grow lot size by 0.1% every update while trading
      currentLotSize = Math.min(10.0, currentLotSize + (currentLotSize * 0.001));

      // Randomize profit based on win rate
      let actualProfit = 0;
      const isWin = Math.random() < winRate;
      
      if (isWin) {
        actualProfit = currentAssetBalance * profitFactor * (0.8 + Math.random() * 0.4);
      } else {
        // Loss is usually smaller than profit for these strategies
        actualProfit = -currentAssetBalance * (profitFactor * 0.5) * (0.5 + Math.random() * 0.5);
      }
      
      const newBalance = currentAssetBalance + actualProfit;
      const newTotalProfit = (userData.totalProfit || 0) + actualProfit;
      
      // Auto Reversal Logic
      let currentTrend = userData.currentTrend || "Long";
      let trendProbability = isAggressive ? 0.15 : 0.05; 
      if (Math.random() < trendProbability) {
        currentTrend = currentTrend === "Long" ? "Short" : "Long";
      }

      batch.update(userDoc.ref, {
        [balanceField]: newBalance,
        totalProfit: newTotalProfit,
        lastTradeAt: now,
        currentTrend: currentTrend,
        currentLotSize: currentLotSize
      });
      
      // Trade Frequency: Targeting ~1,500 trades daily
      // 86400s / 5s interval = 17280 intervals. 1500 / 17280 = ~0.087 probability
      const tradeProbability = isAggressive ? 0.087 : 0.05; 
      
      if (Math.random() < tradeProbability) {
        const tradeRef = db.collection("trades").doc();
        // Trade amount influenced by lot size
        const tradeAmount = currentLotSize * 1000; 
        
        const tradeType = currentTrend === "Long" ? "BUY" : "SELL";
        
        batch.set(tradeRef, {
          uid: userData.uid,
          pair: userData.activePair || "BTC/USDT",
          type: tradeType,
          amount: tradeAmount,
          lotSize: currentLotSize,
          asset: tradingAsset,
          price: 65000 + (Math.random() * 1000 - 500),
          pnl: actualProfit,
          duration: Math.floor(Math.random() * 60) + 10,
          timestamp: now,
          isAggressive: isAggressive
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
            commentsCount: 0,
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

// Run background trading every 5 seconds for real-time feel
if (db) {
  setInterval(processBackgroundTrades, 5000);
  // Run migration on startup
  fixMissingTotalProfit();
}

// Sui Config (Mirroring src/lib/sui.ts)
const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";
const SUI_TYPE = "0x2::sui::SUI";
const SUI_CONTRACT_ADDRESS = process.env.VITE_SUI_CONTRACT_ADDRESS || "0x7ec914c89d99920f01c2a6aba892ec63bbdae74ca522f5ca4407d961a0263876";
const SUI_TREASURY_ADDRESS = process.env.VITE_SUI_TREASURY_ADDRESS || "0x40e4e861562d786bbdc68e2ace97b579a6022e8a1d9bad850112138c301e0e41";

async function findAdminCap(address: string): Promise<string | null> {
  try {
    const objects = await suiClient.getOwnedObjects({
      owner: address,
      filter: { StructType: `${SUI_CONTRACT_ADDRESS}::trading::AdminCap` },
    });
    return objects.data[0]?.data?.objectId || null;
  } catch (e) {
    console.error("Error finding AdminCap:", e);
    return null;
  }
}

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
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(cors());
  app.use(express.json());

  // Vite middleware for development - Move to TOP but skip for /api
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        fs: {
          allow: [process.cwd()]
        }
      },
      appType: "spa",
    });
    
    app.use((req, res, next) => {
      if (req.url.startsWith('/api')) {
        return next();
      }
      vite.middlewares(req, res, next);
    });
  }

  // Global request logger for debugging 404s
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Health check endpoint to verify API is running
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), dbConnected: !!db });
  });

  // Wallet Withdrawal Endpoint
  app.post("/api/wallet/withdraw", authenticate, async (req, res) => {
    if (!db) return res.status(500).json({ error: "Database not initialized" });
    const { uid, amount, asset, walletAddress } = req.body;
    if (!uid || !amount || !walletAddress) return res.status(400).json({ error: "Invalid request" });
    
    // Safety: ensure UID matches token (handled in authenticate middleware but double checking)
    if ((req as any).user.uid !== uid) return res.status(403).json({ error: "Unauthorized access" });

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
          // FIX: Don't rollback - allow the DB withdrawal to succeed even if on-chain fails
          // The on-chain transfer can be retried manually by admin
          console.log(`On-chain failed but DB withdrawal preserved for ${uid}. Amount: ${amount}. Error: ${onChainError}`);
          isSimulated = true; // Mark as simulated since on-chain didn't complete
        }
      }

      // Create notification
      const notifTitle = onChainError ? "Withdrawal Processed (Pending On-Chain)" : "Withdrawal Successful";
      const notifMessage = onChainError 
        ? `Withdrawn ${amount.toFixed(2)} ${asset || 'USD'} from trading wallet. On-chain transfer pending.`
        : `Successfully withdrawn ${amount.toFixed(2)} ${asset || 'USD'} to your on-chain wallet.`;

      await db.collection("notifications").add({
        uid,
        type: "WITHDRAWAL",
        title: notifTitle,
        message: notifMessage,
        amount,
        asset: asset || 'USD',
        txHash,
        onChainError: onChainError || null,
        timestamp: new Date().toISOString(),
        read: false
      });

      res.json({
        success: true,
        newWalletBalance,
        txHash,
        isSimulated,
        onChainError: onChainError || null,
        message: onChainError 
          ? `Withdrawal processed. On-chain transfer pending: ${onChainError}`
          : isSimulated 
            ? "Withdrawal successful (Simulated: SUI_PRIVATE_KEY not set)." 
            : "Withdrawal successful."
      });
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Trading Engine Simulation & Settlement
  app.post("/api/trading/settle", authenticate, async (req, res) => {
    const { uid, walletAddress } = req.body;
    if (!db || !uid) return res.status(400).json({ error: "Invalid request" });

    // Safety: ensure UID matches token
    if ((req as any).user.uid !== uid) return res.status(403).json({ error: "Unauthorized access" });

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

      // Track treasury commission (50% profit share)
      if (treasuryShare > 0) {
        const treasuryRef = db.collection("treasury").doc("balance");
        const treasuryDoc = await treasuryRef.get();
        const currentTreasuryBalance = treasuryDoc.exists ? (treasuryDoc.data().totalBalance || 0) : 0;
        
        await treasuryRef.set({
          totalBalance: currentTreasuryBalance + treasuryShare,
          lastUpdated: new Date().toISOString(),
          walletAddress: SUI_TREASURY_ADDRESS
        }, { merge: true });

        await db.collection("treasury_commissions").add({
          uid,
          userName: userData.displayName || "Unknown",
          amount: treasuryShare,
          asset: tradingAsset,
          type: "SETTLEMENT_COMMISSION",
          userProfit: profit,
          userShare: userProfitShare,
          treasuryWallet: SUI_TREASURY_ADDRESS,
          timestamp: new Date().toISOString()
        });

        console.log(`Treasury commission recorded: +${treasuryShare.toFixed(2)} ${tradingAsset} from ${userData.displayName || uid}`);
      }

      // Create notification
      await db.collection("notifications").add({
        uid,
        type: "TRADE_STOPPED",
        title: "Trading Stopped",
        message: `Trading session ended. Returned ${totalToUser.toFixed(2)} ${tradingAsset} to your wallet. Platform fee: ${treasuryShare.toFixed(2)} ${tradingAsset}.`,
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
          const adminAddress = keypair.toSuiAddress();
          
          console.log(`Attempting REAL on-chain settlement for ${walletAddress || uid} on Sui...`);
          
          const txb = new Transaction();
          const coinType = tradingAsset === "USDC" ? USDC_TYPE : USDT_TYPE;
          const decimals = await getDecimals(coinType);
          
          // If it's a contract-based SUI session, use the contract
          if (tradingAsset === "SUI" && userData.tradingSessionId) {
            console.log(`Using Move contract for SUI settlement. Session: ${userData.tradingSessionId}`);
            
            const adminCapId = await findAdminCap(adminAddress);
            if (!adminCapId) throw new Error("AdminCap not found for the provided private key");

            const rawFinalAmount = Math.floor(totalToUser * 1e9);
            
            txb.moveCall({
              target: `${SUI_CONTRACT_ADDRESS}::trading::settle_session`,
              arguments: [
                txb.object(adminCapId),
                txb.object(userData.tradingSessionId),
                txb.pure.u64(rawFinalAmount),
                txb.pure.u64(Date.now()),
              ],
            });
          }

          // Platform Fee (0.1%)
          const feePercent = 0.001;
          const feeAmount = totalToUser * feePercent;
          const netAmount = totalToUser - feeAmount;
          
          const rawNetAmount = Math.floor(netAmount * Math.pow(10, decimals));
          const rawFeeAmount = Math.floor(feeAmount * Math.pow(10, decimals));
          
          // Transfer the assets from Treasury back to User
          const coins = await suiClient.getCoins({
            owner: adminAddress,
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
            
            txb.setGasBudget(20000000); // 0.02 SUI
            
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

  // Withdraw profit without stopping trade
  app.post("/api/trading/withdraw-profit", authenticate, async (req, res) => {
    const { uid, walletAddress } = req.body;
    if (!db || !uid) return res.status(400).json({ error: "Invalid request" });

    // Safety: ensure UID matches token
    if ((req as any).user.uid !== uid) return res.status(403).json({ error: "Unauthorized access" });

    try {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      const userData = userDoc.data();
      if (!userData.isTrading) return res.status(400).json({ error: "No active trading session" });

      const tradingAsset = userData.tradingAsset || "USDT";
      const balanceField = tradingAsset === "USDC" ? "usdcBalance" : "usdtBalance";
      
      const currentAssetBalance = userData[balanceField] || 0;
      const initialInvestment = userData.initialInvestment || 0;
      const profit = currentAssetBalance - initialInvestment;

      if (profit <= 0) return res.status(400).json({ error: "No profit to withdraw" });

      // Calculate shares (50/50 split on profit)
      const userProfitShare = profit * 0.5;
      const treasuryShare = profit * 0.5;

      // Update Firestore
      const walletBalance = userData.walletBalance || 0;
      const newWalletBalance = walletBalance + userProfitShare;

      await userRef.update({
        [balanceField]: initialInvestment, // Reset trading balance to initial
        walletBalance: newWalletBalance
        // totalProfit is cumulative, do not subtract withdrawn profit from it
      });

      // Create notification
      await db.collection("notifications").add({
        uid,
        type: "PROFIT_WITHDRAWAL",
        title: "Profit Withdrawn",
        message: `Withdrawn ${userProfitShare.toFixed(2)} ${tradingAsset} profit to your wallet balance.`,
        amount: userProfitShare,
        asset: tradingAsset,
        timestamp: new Date().toISOString(),
        read: false
      });

      // Real On-Chain Transfer (Simulated for demo, but structured for real Sui)
      let txHash = "0x" + Math.random().toString(16).slice(2);
      let onChainError = null;

      if (process.env.SUI_PRIVATE_KEY) {
        try {
          const secretKey = decodeSuiPrivateKey(process.env.SUI_PRIVATE_KEY);
          const keypair = Ed25519Keypair.fromSecretKey(secretKey);
          const txb = new Transaction();
          const coinType = tradingAsset === "USDC" ? USDC_TYPE : USDT_TYPE;
          const decimals = await getDecimals(coinType);
          
          const rawNetAmount = Math.floor(userProfitShare * Math.pow(10, decimals));
          const rawFeeAmount = Math.floor(treasuryShare * Math.pow(10, decimals));

          const coins = await suiClient.getCoins({
            owner: keypair.toSuiAddress(),
            coinType: coinType,
          });

          if (coins.data.length > 0) {
            const coinObjectIds = coins.data.map((c) => c.coinObjectId);
            const primaryCoin = coinObjectIds[0];
            const rest = coinObjectIds.slice(1);
            if (rest.length > 0) txb.mergeCoins(txb.object(primaryCoin), rest.map(id => txb.object(id)));

            if (rawFeeAmount > 0) {
              const [feeCoin] = txb.splitCoins(txb.object(primaryCoin), [rawFeeAmount]);
              txb.transferObjects([feeCoin], SUI_TREASURY_ADDRESS);
            }

            const [mainCoin] = txb.splitCoins(txb.object(primaryCoin), [rawNetAmount]);
            txb.transferObjects([mainCoin], walletAddress || userData.walletAddress);
            
            txb.setGasBudget(10000000);
            const result = await suiClient.signAndExecuteTransaction({ signer: keypair, transaction: txb });
            txHash = result.digest;
          }
        } catch (e: any) {
          console.error("Real Sui profit withdrawal failed:", e);
          onChainError = e.message;
        }
      }

      res.json({ success: true, withdrawn: userProfitShare, txHash, onChainError });
    } catch (error: any) {
      console.error("Profit withdrawal error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Community Endpoints handled directly via Firestore SDK from frontend now

  app.post("/api/trading/simulate", authenticate, async (req, res) => {
    const { strategy, principal, duration, account } = req.body;
    
    if (isNaN(principal) || principal <= 0) {
        return res.status(400).json({ error: "Invalid principal amount" });
    }

    // Simple simulation logic based on strategy
    let multiplier = 1.0;
    let risk = 0.05;

    switch (strategy) {
      case "Aggressive":
        // 100% Win Rate: multiplier always > 1.0
        // ROI 200-400%: multiplier between 3.0 and 5.0
        multiplier = 3.0 + (Math.random() * 2.0); 
        risk = 0; // No losses
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
        console.log(`Attempting REAL on-chain settlement for ${account} on Sui with balance ${finalBalanceFormatted}`);
        
        const secretKey = decodeSuiPrivateKey(process.env.SUI_PRIVATE_KEY);
        const keypair = Ed25519Keypair.fromSecretKey(secretKey);
        const adminAddress = keypair.toSuiAddress();
        
        const txb = new Transaction();
        // Default to USDT for simulation if not specified
        const coinType = USDT_TYPE; 
        const decimals = await getDecimals(coinType);
        const rawAmount = Math.floor(finalBalanceFormatted * Math.pow(10, decimals));

        if (rawAmount > 0) {
          const coins = await suiClient.getCoins({
            owner: adminAddress,
            coinType: coinType,
          });

          if (coins.data.length > 0) {
            const coinObjectIds = coins.data.map((c) => c.coinObjectId);
            const primaryCoin = coinObjectIds[0];
            const rest = coinObjectIds.slice(1);
            
            if (rest.length > 0) {
              txb.mergeCoins(txb.object(primaryCoin), rest.map(id => txb.object(id)));
            }

            const [mainCoin] = txb.splitCoins(txb.object(primaryCoin), [rawAmount]);
            txb.transferObjects([mainCoin], account);
            
            txb.setGasBudget(20000000); // 0.02 SUI
            
            const result = await suiClient.signAndExecuteTransaction({
              signer: keypair,
              transaction: txb,
            });
            
            txHash = result.digest;
            await suiClient.waitForTransaction({ digest: txHash });
            console.log(`Sui Settlement TX successful: ${txHash}`);
          } else {
            console.warn(`No coins found in treasury for settlement to ${account}`);
            error = "Treasury has insufficient funds for this settlement";
          }
        } else {
          console.log("Settlement amount is 0, skipping on-chain transaction");
          txHash = "none";
        }
      } catch (e: any) {
        console.error("Sui settlement failed:", e);
        error = e.message || "Sui blockchain transaction failed";
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

  // Production static file serving - MUST be AFTER all API routes
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Only serve index.html for non-API GET requests (SPA fallback)
    app.get("*", (req, res) => {
      if (req.url.startsWith('/api')) {
        return res.status(404).json({ error: "API endpoint not found" });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Quantum Finance Server running on http://localhost:${PORT}`);
    console.log(`API routes registered. NODE_ENV=${process.env.NODE_ENV}`);
  });
}

startServer().catch((err) => {
  console.error("FATAL: Server failed to start:", err);
  process.exit(1);
});
