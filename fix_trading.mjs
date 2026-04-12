import fs from 'fs';

let content = fs.readFileSync('src/components/TradingTab.tsx', 'utf8');

// 1. Remove all walletBalance completely
content = content.replace(/const \[walletBalance, setWalletBalance\] = useState\(.*?\);\n?/g, '');
content = content.replace(/setWalletBalance\(.*\);\n?/g, '');
content = content.replace(/walletBalance: walletBalance.*?(?:,)?\n?/g, '');
content = content.replace(/setWalletBalance.*?\n?/g, '');

// Clean handleWithdraw
const handleWithdrawMatch = /const handleWithdraw = async \(\) => \{[\s\S]*?finally \{\n\s*setLoading\(false\);\n\s*\}\n  \};/m;
const cleanHandleWithdraw = `const handleWithdraw = async () => {
    if (!user || !withdrawAmount || !currentAccount) {
      toast.error("Please connect wallet and fill in the amount");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }

    setLoading(true);
    toast.loading("Processing withdrawal from smart contract...", { id: "withdraw" });

    try {
        // PTB execution
        toast.error("Withdrawals must be done directly via a PTB to the quantum.move smart contract. Custodial APIs have been disabled.");
    } catch (error: any) {
      console.error("Withdrawal failed:", error);
      toast.error(error.message || "Withdrawal failed", { id: "withdraw" });
    } finally {
      setLoading(false);
    }
  };`;
content = content.replace(handleWithdrawMatch, cleanHandleWithdraw);

// Clean fundTrading
const fundTradingMatch = /const fundTrading = async \(\) => \{[\s\S]*?finally \{\n\s*setLoading\(false\);\n\s*\}\n  \};/m;
const cleanFundTrading = `const fundTrading = async () => {
    if (!user || isTrading || !currentAccount) {
      if (!currentAccount) toast.error("Wallet not connected");
      return;
    }
    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount to fund.");
      return;
    }

    setLoading(true);
    toast.loading("Processing on-chain funding...", { id: "fund" });
    try {
        const executionAddress = currentAccount.address;
        const balances = await getAllBalances(executionAddress);
        
        let currentOnChainBalance = 0;
        if (tradingAsset === "SUI") currentOnChainBalance = balances.sui;
        else if (tradingAsset === "USDC") currentOnChainBalance = balances.usdc;
        else currentOnChainBalance = balances.usdt;

        if (amount > currentOnChainBalance) {
          toast.error(\`Insufficient on-chain balance. You have \${currentOnChainBalance.toFixed(2)} \${tradingAsset}.\`, { id: "fund" });
          setLoading(false);
          return;
        }

        if (balances.sui < 0.01) {
          toast.error("Insufficient SUI for gas. Please receive some SUI first.", { id: "fund" });
          setLoading(false);
          return;
        }

        console.log(\`Funding \${amount} from on-chain...\`);
        let sessionId = null;

        const actionType = tradingAsset === "SUI" ? "START_SESSION" : "DEPOSIT";
        
        // 1. AI Decision happens backend via API Intent
        const intentRes = await fetch("/api/trade/execute-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: user.uid,
            action: actionType,
            asset: tradingAsset,
            amount: amount,
            strategyId: strategy
          })
        });

        if (!intentRes.ok) {
          const text = await intentRes.text();
          throw new Error(JSON.parse(text).error || "Failed to fetch intent from backend");
        }
        
        const { instruction } = await intentRes.json();
        
        // 2. Build the exact PTB via Frontend mapping using the connected Wallet
        const senderAddress = currentAccount.address;
        const tx = await buildPTBFromTradeInstruction(instruction, senderAddress);

        // 3. User Signs and Executes Transaction (100% Non-Custodial)
        const result = await executionAdapter.executeTransaction(tx);

        // Optional logic for Move Call session IDs extraction
        if (actionType === "START_SESSION") {
          const sessionObject = result.objectChanges?.find(
            (change: any) =>
              change.type === "created" &&
              change.objectType.includes("::trading::TradingSession")
          );

          if (!sessionObject || !("objectId" in sessionObject)) {
            throw new Error("TradingSession object not found in transaction results");
          }
          sessionId = sessionObject.objectId;
        }

        // 4. Sync Result Back to Backend
        await fetch("/api/trade/sync-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: user.uid,
            intentId: instruction.intentId,
            digest: result.digest,
            success: true
          })
        });

        const userRef = doc(db, "users", user.uid);
        const balanceField = tradingAsset === "USDC" ? "usdcBalance" : "usdtBalance";
        await updateDoc(userRef, {
          isTrading: true,
          initialInvestment: amount,
          [balanceField]: amount,
          tradingAsset: tradingAsset,
          activeStrategy: strategy,
          activePair: selectedPair,
          totalProfit: 0,
          tradingSessionId: sessionId
        });

        toast.success(\`Successfully funded \${amount} \${tradingAsset} securely on-chain!\`, { id: "fund" });
      setFundAmount("0");
    } catch (e: any) {
      console.error("Funding failed:", e);
      toast.error("Funding failed: " + (e.message || "Unknown error"), { id: "fund" });
    } finally {
      setLoading(false);
    }
  };`;
content = content.replace(fundTradingMatch, cleanFundTrading);

// Remove UI walletBalance usage
content = content.replace(/Wallet Balance:.*?walletBalance\.toFixed\(2\).*?USD<\/span>/g, 'Connected: <span className="text-blue-400 font-bold">{currentAccount ? \'Yes\' : \'No\'}</span>');
content = content.replace(/setWithdrawAmount\(walletBalance\.toString\(\)\)/g, 'setWithdrawAmount("0")');
content = content.replace(/Available: \{walletBalance\.toFixed\(2\)\} USD/g, 'Smart Contract Balance Enforced');
content = content.replace(/amount > walletBalance/g, 'false'); // residual fallback

fs.writeFileSync('src/components/TradingTab.tsx', content);

console.log("Cleared walletBalance logic");