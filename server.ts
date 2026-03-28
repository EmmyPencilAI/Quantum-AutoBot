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
    const app = admin.initializeApp({
      credential: admin.credential.applicationDefault(), // This might fail if no default creds
      projectId: firebaseConfig.projectId,
    });
    
    // Fallback if applicationDefault fails (common in this environment)
    // Note: admin.apps.length check might be tricky if we already initialized above
    
    // Use the specific database ID if provided
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    db = getFirestore(app, dbId);
    
    console.log(`Firebase Admin initialized in server for database: ${dbId}`);
  } catch (e) {
    console.error("Failed to initialize Firebase Admin:", e);
    // Try one more time with just projectId if it failed
    try {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
      if (!admin.apps.length) {
        const app = admin.initializeApp({
          projectId: firebaseConfig.projectId,
        });
        const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
        db = getFirestore(app, dbId);
        console.log(`Firebase Admin initialized (fallback) for database: ${dbId}`);
      }
    } catch (err) {
      console.error("Fallback Firebase Admin initialization failed:", err);
    }
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
  if (!db) return;
  try {
    const message = BOT_MESSAGES[Math.floor(Math.random() * BOT_MESSAGES.length)];
    await db.collection("posts").add({
      authorUid: "system-bot",
      authorName: "Quantum Bot",
      authorAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=quantum_bot",
      authorWallet: "0x0000000000000000000000000000000000000000",
      content: message,
      likes: Math.floor(Math.random() * 10),
      createdAt: new Date().toISOString()
    });
    console.log("Bot posted message:", message);
  } catch (error) {
    console.error("Bot failed to post:", error);
  }
}

// Post every 15 minutes
if (db) {
  setInterval(postBotMessage, 900000);
  // Post one immediately on start
  setTimeout(postBotMessage, 5000);
}

// Contract Config (Mirroring src/config.ts)
const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const CONTRACT_ADDRESS = "0x231B1A524f480a0285Ac6A093DEd1931D0A28f81";
const QUANTUM_ABI = [
  "function settle(address user, uint256 finalBalance) external",
  "function userSessions(address user) view returns (uint256 principal, uint256 startTime, bool isActive)"
];

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

    // Real On-Chain Settlement if Private Key is present
    if (account && process.env.OWNER_PRIVATE_KEY) {
      try {
        console.log(`Attempting on-chain settlement for ${account} with balance ${finalBalanceFormatted}`);
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, QUANTUM_ABI, wallet);
        
        // Convert to Wei (18 decimals) safely
        // We use a fixed precision string to avoid scientific notation and pattern issues
        const balanceStr = finalBalanceFormatted.toFixed(18);
        console.log(`Settlement: account=${account}, balanceStr=${balanceStr}`);
        const finalBalanceWei = ethers.parseUnits(balanceStr, 18);
        
        const tx = await contract.settle(account, finalBalanceWei);
        console.log(`Settlement TX sent: ${tx.hash}`);
        txHash = tx.hash;
        await tx.wait();
        console.log(`Settlement TX confirmed: ${tx.hash}`);
      } catch (e: any) {
        console.error("On-chain settlement failed:", e);
        error = e.message || "Unknown blockchain error";
      }
    } else if (!process.env.OWNER_PRIVATE_KEY) {
      console.log("Skipping on-chain settlement: OWNER_PRIVATE_KEY not set");
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

  // Crypto Prices Endpoint
  app.get("/api/prices", async (req, res) => {
    try {
      const apiKey = process.env.COINGECKO_API_KEY;
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false${apiKey ? `&x_cg_demo_api_key=${apiKey}` : ""}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const text = await response.text();
        console.warn(`CoinGecko API returned status ${response.status}: ${text}`);
        if (response.status === 429) {
          return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
        }
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch prices:", error);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

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
