import fs from "fs";

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/import \{ deriveSuiWallet, /g, 'import { ');
  content = content.replace(/deriveSuiWallet, /g, '');
  content = content.replace(/import \{ deriveSuiWallet \} from "\.\.\/lib\/sui";\n?/g, '');
  
  // Remove Wallet layer block
  content = content.replace(/\/\/ ==== UNIFIED WALLET LAYER \(STEP 3\.3\) ====[\s\S]*?\/\/ ==========================================/g, '');

  // Remove Transaction Layer block
  content = content.replace(/\/\/ ==== TRANSACTION LAYER ISOLATION \(STEP 3\.2\) ====[\s\S]*?\/\/ ================================================\n?/g, '');

  // executionAdapter
  content = content.replace(/const executionAdapter = useInitExecutionAdapter\(user\);/g, 'const executionAdapter = useInitExecutionAdapter();');

  // Replace fallback references
  content = content.replace(/walletLayer\.executionWallet!\.toSuiAddress\(\)/g, 'currentAccount?.address');
  content = content.replace(/walletLayer\.executionWallet\.toSuiAddress\(\)/g, 'currentAccount?.address');
  content = content.replace(/walletLayer\.uiWallet\?\.address \|\| "None"/g, 'currentAccount?.address || "None"');
  content = content.replace(/walletLayer\.uiWallet\?\.address/g, 'currentAccount?.address');
  content = content.replace(/const executionAddress = currentAccount\?\.address;/g, 'const executionAddress = currentAccount?.address;');
  content = content.replace(/const senderAddress = currentAccount\?\.address \|\| currentAccount\?\.address;/g, 'const senderAddress = currentAccount?.address;');


  // Fix WalletTab useEffect logic
  content = content.replace(/if \(user && walletLayer\.executionWallet\) {[\s\S]*?const activeAddress = currentAccount\?\.address \|\| legacyAddr;/g, 'if (user && currentAccount?.address) {\n      const activeAddress = currentAccount.address;');
  
  // TradingTab fake balance
  content = content.replace(/const \[walletBalance, setWalletBalance\] = useState\(0\);/g, '');
  content = content.replace(/setWalletBalance\(data\.walletBalance \|\| 0\);/g, '');
  content = content.replace(/walletBalance: walletBalance - amount,/g, '');
  content = content.replace(/walletBalance: walletBalance \+ profitSplit.user,/g, ''); // just in case
  content = content.replace(/if \(amount <= walletBalance\) {[\s\S]*?toast\.success\(`Successfully funded \${amount} \${tradingAsset} from wallet!`, { id: "fund" }\);\n      } else {/g, 'if (false) {} else {');

  // Delete API execution references in toggleTrading inside TradingTab
  content = content.replace(/const response = await fetch\("\/api\/trading\/settle"[\s\S]*?throw new Error\(result\.error \|\| "Settlement failed"\);\n          }/g, `// Replaced with smart contract interaction (TODO)
          throw new Error("Custodial settlement removed. Please use Withdraw instead.");`);

  // Delete withdraw API references in handleWithdraw
  content = content.replace(/const response = await fetch\("\/api\/wallet\/withdraw"[\s\S]*?\} else \{\n[ \t]*throw new Error\(result\.error \|\| "Withdrawal failed"\);\n[ \t]*\}/g, `// Withdrawing should use the withdrawal PTB
        const tx = await buildWithdrawSessionPTB({
           sessionId: user.tradingSessionId, // Note: You'd need to track sessionId in UI better
        });
        const result = await executionAdapter.executeTransaction(tx);
        toast.success("Withdrawal successful!", { id: "withdraw" });
        setShowWithdrawModal(false);
        setWithdrawAmount("");`);

  fs.writeFileSync(file, content);
  console.log(`Replaced in ${file}`);
}

fixFile("src/components/WalletTab.tsx");
fixFile("src/components/TradingTab.tsx");
