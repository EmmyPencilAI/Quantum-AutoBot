import React, { useEffect, useRef } from "react";
import { Search, TrendingUp, TrendingDown, Info } from "lucide-react";

declare global {
  interface Window {
    TradingView: any;
  }
}

const MarketsTab: React.FC = () => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (container.current && window.TradingView) {
        // Adjust height based on screen size
        const height = window.innerWidth < 640 ? 300 : 500;
        new window.TradingView.widget({
          container_id: container.current.id,
          width: "100%",
          height: height,
          symbol: "BINANCE:BTCUSDT",
          interval: "D",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          hide_side_toolbar: window.innerWidth < 640,
          allow_symbol_change: true,
          details: true,
          hotlist: true,
          calendar: true,
          show_popup_button: true,
          popup_width: "1000",
          popup_height: "650",
          backgroundColor: "#0a0a0a",
          gridColor: "rgba(255, 255, 255, 0.05)",
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      const scriptElement = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
      if (scriptElement) scriptElement.remove();
    };
  }, []);

  const marketData = [
    { symbol: "BTC", name: "Bitcoin", price: "64,231.50", change: "+2.45%", up: true, logo: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png" },
    { symbol: "ETH", name: "Ethereum", price: "3,452.12", change: "-1.12%", up: false, logo: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" },
    { symbol: "SOL", name: "Solana", price: "145.67", change: "+5.67%", up: true, logo: "https://assets.coingecko.com/coins/images/4128/large/solana.png" },
    { symbol: "SUI", name: "Sui", price: "1.89", change: "+12.34%", up: true, logo: "https://assets.coingecko.com/coins/images/26375/large/sui_logo.png" },
    { symbol: "BNB", name: "BNB", price: "589.45", change: "-0.45%", up: false, logo: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png" },
  ];

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Global Markets</h2>
        <div className="relative w-full sm:w-80 md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 md:w-4.5 md:h-4.5" size={16} />
          <input
            type="text"
            placeholder="Search assets..."
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-2xl pl-10 md:pl-12 pr-4 py-2.5 md:py-3 focus:outline-none focus:border-orange-500 transition-all text-xs md:text-base"
          />
        </div>
      </div>

      {/* TradingView Widget */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl overflow-hidden shadow-2xl">
        <div id="tradingview_widget" ref={container} className="w-full" />
      </div>

      {/* Market Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {marketData.map((asset) => (
          <div
            key={asset.symbol}
            className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-orange-500/50 transition-all group cursor-pointer shadow-lg"
          >
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-white/5 rounded-lg md:rounded-xl flex items-center justify-center overflow-hidden">
                  <img src={asset.logo} alt={asset.name} className="w-6 h-6 md:w-8 md:h-8 object-contain" referrerPolicy="no-referrer" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs md:text-base truncate">{asset.name}</p>
                  <p className="text-[9px] md:text-xs text-white/40 truncate">{asset.symbol}/USDT</p>
                </div>
              </div>
              <div className={`text-right shrink-0 ${asset.up ? "text-green-400" : "text-red-400"}`}>
                <div className="flex items-center justify-end gap-1 font-bold text-[10px] md:text-sm">
                  {asset.up ? <TrendingUp size={10} className="md:w-3.5 md:h-3.5" /> : <TrendingDown size={10} className="md:w-3.5 md:h-3.5" />}
                  <span>{asset.change}</span>
                </div>
                <p className="text-[8px] md:text-[10px] opacity-60">24h</p>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <h3 className="text-lg md:text-2xl font-bold tracking-tight">${asset.price}</h3>
              <button className="text-white/20 hover:text-white transition-colors shrink-0 p-1">
                <Info size={14} className="md:w-4.5 md:h-4.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketsTab;
