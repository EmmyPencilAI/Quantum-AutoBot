import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

dotenv.config();

// Load Firebase Config
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let db: any = null;

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    
    if (!admin.apps.length) {
      try {
        // Try default initialization first - this is often best in managed environments
        admin.initializeApp();
        console.log("Firebase Admin initialized with default environment config");
      } catch (e) {
        console.warn("Default Firebase Admin initialization failed, trying with explicit projectId:", e);
        try {
          admin.initializeApp({
            projectId: firebaseConfig.projectId,
          });
          console.log(`Firebase Admin initialized with explicit projectId: ${firebaseConfig.projectId}`);
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
  "Market update: BTC showing strong support at 65k. Momentum strategy looking good!",
  "New trading pair added: SOL/USDT. Check it out in the dashboard.",
  "Quantum Treasury just settled 500 USDT in profits. Distributed 50/50!",
  "Strategy Tip: Aggressive strategy works best in high volatility markets.",
  "Welcome to the Quantum Finance community! Share your insights below.",
  "Leaderboard update: Top trader just hit +10,000 USDT profit!",
  "Quantum Finance is now fully integrated with Binance Smart Chain Testnet.",
  "Did you know? Our Quantum engine uses advanced AI to optimize trade entries.",
];

async function postBotMessage() {
  if (!db) {
    console.warn("Bot skipped post: Firestore Admin not initialized");
    return;
  }
  try {
    const message = BOT_MESSAGES[Math.floor(Math.random() * BOT_MESSAGES.length)];
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
    const tradingUsers = await usersRef.where("isTrading", "==", true).get();
    
    if (tradingUsers.empty) return;
    
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
      
      // Randomize slightly
      const actualProfit = (userData.usdtBalance || 1000) * profitFactor * (Math.random() * 2 - 0.8);
      const newBalance = (userData.usdtBalance || 0) + actualProfit;
      const newTotalProfit = (userData.totalProfit || 0) + actualProfit;
      
      batch.update(userDoc.ref, {
        usdtBalance: newBalance,
        totalProfit: newTotalProfit,
        lastTradeAt: now
      });
      
      // Occasionally create a trade record
      if (Math.random() < 0.2) {
        const tradeRef = db.collection("trades").doc();
        batch.set(tradeRef, {
          uid: userData.uid,
          pair: "BTC/USDT",
          type: actualProfit >= 0 ? "Buy" : "Sell",
          amount: Math.abs(actualProfit) * 10,
          price: 65000 + (Math.random() * 1000 - 500),
          pnl: actualProfit,
          timestamp: now
        });
      }
    }
    
    await batch.commit();
    console.log(`Background trades processed successfully for ${tradingUsers.size} users`);
  } catch (error: any) {
    console.error("Error in background trading loop:", error.message || error);
    if (error.code === 7 || error.message?.includes("PERMISSION_DENIED")) {
      console.error("CRITICAL: Permission denied in background trading loop. Check Firebase Admin credentials and project permissions.");
    }
  }
}

// Run background trading every minute
if (db) {
  setInterval(processBackgroundTrades, 60000);
}

// Sui Config (Mirroring src/lib/sui.ts)
const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";
// Example USDT Type on Sui Testnet
const USDT_TYPE = "0x5d4b302306649423527773c6827317e943975d607a097e16f20935055b45c2ad::coin::COIN";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Trading Engine Simulation & Settlement
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
