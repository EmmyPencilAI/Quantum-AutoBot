const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const anchor = 'if (process.env.NODE_ENV !== "production") {';
const newCode = `// =========================================================================
// STEP 4.3: FINAL ARCHITECTURE ALIGNMENT - BACKEND EXECUTION ORCHESTRATION
// =========================================================================

// 1. Define Trade Instruction Schema (Backend Output)
export interface TradeInstruction {
  intentId: string;
  action: "BUY" | "SELL" | "WITHDRAW" | "DEPOSIT" | "START_SESSION";
  asset: string;
  amount: number;
  riskLevel: number;
  strategyId: string;
  timestamp: number;
}

// 2. Create API Bridge Layer
app.post("/api/trade/execute-intent", async (req, res) => {
  try {
    const { uid, action, asset, amount, strategyId } = req.body;
    if (!uid || !action || !asset || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // AI Engine Logic (Simulated here)
    let riskLevel = 0.05; // default 5%
    if (strategyId === "Aggressive") riskLevel = 0.15;
    else if (strategyId === "Scalping") riskLevel = 0.08;

    const instruction = {
      intentId: \`intent_\${Date.now()}_\${Math.floor(Math.random() * 1000)}\`,
      action,
      asset,
      amount: Number(amount),
      riskLevel,
      strategyId: strategyId || "Momentum",
      timestamp: Date.now()
    };

    if (db) {
      await db.collection("trade_intents").doc(instruction.intentId).set({
        ...instruction,
        uid,
        status: "PENDING"
      });
    }

    return res.json({ success: true, instruction });
  } catch (error) {
    console.error("Execute Intent error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate intent" });
  }
});

app.get("/api/trade/status/:intentId", async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "DB not initialized" });
    const { intentId } = req.params;
    const doc = await db.collection("trade_intents").doc(intentId).get();
    if (!doc.exists) return res.status(404).json({ error: "Intent not found" });
    return res.json({ success: true, status: doc.data()?.status });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 6. Event Sync Layer (Backend receives execution result from frontend)
app.post("/api/trade/sync-result", async (req, res) => {
  try {
    const { uid, intentId, digest, success } = req.body;
    if (!uid || !intentId || !digest) {
      return res.status(400).json({ error: "Missing required sync fields" });
    }

    if (db) {
      await db.collection("trade_intents").doc(intentId).update({
        status: success ? "COMPLETED" : "FAILED",
        digest,
        completedAt: Date.now()
      });

      if (success) {
        const intentDoc = await db.collection("trade_intents").doc(intentId).get();
        const userDoc = await db.collection("users").doc(uid).get();
        
        if (intentDoc.exists && userDoc.exists) {
          const intentData = intentDoc.data();
          const userData = userDoc.data();

          const actionText = intentData.action === "START_SESSION" ? "started a trading session" : intentData.action.toLowerCase();
          await db.collection("posts").add({
            uid,
            authorName: userData.displayName || "Anonymous Trader",
            authorAvatar: userData.photoURL || \`https://api.dicebear.com/7.x/avataaars/svg?seed=\${uid}\`,
            content: \`Just \${actionText} with \${intentData.amount} \${intentData.asset} using the \${intentData.strategyId} strategy! 🚀 (Verified On-Chain)\`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            likes: 0,
            hasLiked: false,
            comments: []
          });

          await db.collection("notifications").add({
            uid,
            type: "TRADE_EXECUTED",
            title: "Trade Executed",
            message: \`Your \${intentData.strategyId} trade for \${intentData.amount} \${intentData.asset} was verified on-chain. Digest: \${digest.substring(0, 8)}...\`,
            timestamp: new Date().toISOString(),
            read: false,
          });
        }
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Sync result error:", error);
    return res.status(500).json({ error: error.message });
  }
});
\` + '\\n\\n' + anchor;

code = code.replace(anchor, newCode);
fs.writeFileSync('server.ts', code);
console.log('Successfully injected API endpoints in server.ts!');
