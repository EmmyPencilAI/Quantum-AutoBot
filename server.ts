import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  app.use(express.json());

  // Trading Engine Simulation & Settlement
  app.post("/api/trading/simulate", async (req, res) => {
    const { strategy, principal, duration, account } = req.body;
    
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
    const finalBalanceFormatted = Math.max(0, finalBalanceVal);

    let txHash = null;
    let error = null;

    // Real On-Chain Settlement if Private Key is present
    if (account && process.env.OWNER_PRIVATE_KEY) {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, QUANTUM_ABI, wallet);
        
        // Convert to Wei (18 decimals)
        const finalBalanceWei = ethers.parseUnits(finalBalanceFormatted.toFixed(18), 18);
        
        const tx = await contract.settle(account, finalBalanceWei);
        txHash = tx.hash;
        await tx.wait();
      } catch (e: any) {
        console.error("On-chain settlement failed:", e);
        error = e.message;
      }
    }

    res.json({
      finalBalance: finalBalanceFormatted,
      profit: Math.max(-principal, profit),
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
