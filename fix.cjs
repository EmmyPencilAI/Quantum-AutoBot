const fs = require('fs');
let c = fs.readFileSync('src/components/TradingTab.tsx', 'utf8');

c = c.replace(/const \[initialInvestment, setInitialInvestment\] = useState\(0\);/, 'const [initialInvestment, setInitialInvestment] = useState(0);\n    const [walletBalance, setWalletBalance] = useState(0);');

c = c.replace(/setInitialInvestment\(data\.initialInvestment \|\| 0\);/, 'setInitialInvestment(data.initialInvestment || 0);\n          setWalletBalance(data.walletBalance || 0);');

c = c.replace(/onClick=\{\(\) => setWithdrawAmount\("0"\)\}/g, 'onClick={() => setWithdrawAmount((walletBalance || 0).toString())}');

fs.writeFileSync('src/components/TradingTab.tsx', c);
