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
        new window.TradingView.widget({
          container_id: container.current.id,
          width: "100%",
          height: 500,
          symbol: "BINANCE:BTCUSDT",
          interval: "D",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          hide_side_toolbar: false,
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
    { symbol: "BTC", name: "Bitcoin", price: "64,231.50", change: "+2.45%", up: true },
    { symbol: "ETH", name: "Ethereum", price: "3,452.12", change: "-1.12%", up: false },
    { symbol: "SOL", name: "Solana", price: "145.67", change: "+5.67%", up: true },
    { symbol: "SUI", name: "Sui", price: "1.89", change: "+12.34%", up: true },
    { symbol: "BNB", name: "BNB", price: "589.45", change: "-0.45%", up: false },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Global Markets</h2>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input
            type="text"
            placeholder="Search assets (BTC, ETH, SOL...)"
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:border-orange-500 transition-all"
          />
        </div>
      </div>

      {/* TradingView Widget */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div id="tradingview_widget" ref={container} className="w-full" />
      </div>

      {/* Market Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {marketData.map((asset) => (
          <div
            key={asset.symbol}
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 hover:border-orange-500/50 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center font-bold text-orange-500">
                  {asset.symbol[0]}
                </div>
                <div>
                  <p className="font-bold">{asset.name}</p>
                  <p className="text-xs text-white/40">{asset.symbol}/USDT</p>
                </div>
              </div>
              <div className={`text-right ${asset.up ? "text-green-400" : "text-red-400"}`}>
                <div className="flex items-center justify-end gap-1 font-bold">
                  {asset.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{asset.change}</span>
                </div>
                <p className="text-xs opacity-60">24h</p>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold tracking-tight">${asset.price}</h3>
              <button className="text-white/20 hover:text-white transition-colors">
                <Info size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketsTab;
