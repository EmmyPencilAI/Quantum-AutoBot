const fs = require('fs'); let c = fs.readFileSync('src/components/TradingTab.tsx', 'utf8'); c = c.replace('onClick={() => setWithdrawAmount(\\
0\\)}', 'onClick={() => setWithdrawAmount((walletBalance || 0).toString())}'); fs.writeFileSync('src/components/TradingTab.tsx', c);
