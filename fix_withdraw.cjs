const fs = require('fs');
let c = fs.readFileSync('src/components/TradingTab.tsx', 'utf8');
c = c.replace(/} catch\(e\) \{\s*console.warn\("Backend unavailable, used direct DB fallback."\);\s*toast.success\("Successfully withdrawn to wallet balance!", \{ id: "withdraw-profit" \}\);\s*\}\s*\}/g, '} catch(e: any) { console.error("Backend failed:", e); toast.error(e.message || "Backend failed", { id: "withdraw-profit" }); } }');
fs.writeFileSync('src/components/TradingTab.tsx', c);
