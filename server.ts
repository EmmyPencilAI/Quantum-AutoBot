import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Trading Engine Simulation
  // In a real app, this would connect to Binance/Bybit APIs
  app.post("/api/trading/simulate", (req, res) => {
    const { strategy, principal, duration } = req.body;
    
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

    // Simulate loss chance
    if (Math.random() < risk) {
        multiplier *= (0.8 + Math.random() * 0.15); // significant loss
    }

    const finalBalance = principal * multiplier;
    const profit = finalBalance - principal;

    res.json({
      finalBalance: Math.max(0, finalBalance),
      profit: Math.max(-principal, profit),
      timestamp: new Date().toISOString()
    });
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
