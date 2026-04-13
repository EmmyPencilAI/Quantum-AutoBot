import React, { useEffect, useRef, useState } from "react";
import { Search, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

declare global {
  interface Window {
    TradingView: any;
  }
}

interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  image: string;
}

const DISPLAY_SYMBOLS = ["bitcoin", "ethereum", "solana", "sui", "binancecoin"];

const MarketsTab: React.FC = () => {
  const container = useRef<HTMLDivElement>(null);
  const [marketData, setMarketData] = useState<MarketAsset[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // ── Fetch live prices from backend ──────────────────────────────────────────
  const fetchPrices = async () => {
    try {
      const res = await fetch("/api/prices");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MarketAsset[] = await res.json();
      // Only show the main assets we support
      const filtered = data.filter((a) => DISPLAY_SYMBOLS.includes(a.id));
      setMarketData(filtered);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Failed to fetch prices:", e);
    } finally {
      setLoadingPrices(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    // Refresh every 30 seconds (same cadence as backend cache)
    const interval = setInterval(fetchPrices, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── TradingView widget ───────────────────────────────────────────────────────
  useEffect(() => {
    const initWidget = () => {
      if (container.current && window.TradingView) {
        const height = window.innerWidth < 640 ? 300 : 500;
        new window.TradingView.widget({
          container_id: container.current.id,
          width: "100%",
          height,
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

    if (window.TradingView) {
      initWidget();
    } else {
      const interval = setInterval(() => {
        if (window.TradingView) {
          initWidget();
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  const filteredAssets = marketData.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Global Markets</h2>
          {lastUpdated && (
            <p className="text-[10px] text-white/30 mt-1 font-mono">
              Live data · Last updated {lastUpdated}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80 md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-2xl pl-10 md:pl-12 pr-4 py-2.5 md:py-3 focus:outline-none focus:border-orange-500 transition-all text-xs md:text-base"
            />
          </div>
          <button
            onClick={fetchPrices}
            className="shrink-0 p-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl hover:border-orange-500/50 transition-colors"
            title="Refresh prices"
          >
            <RefreshCw size={16} className={loadingPrices ? "animate-spin text-orange-500" : "text-white/40"} />
          </button>
        </div>
      </div>

      {/* TradingView Widget */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-3xl overflow-hidden shadow-2xl">
        <div id="tradingview_widget" ref={container} className="w-full" />
      </div>

      {/* Live Market Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {loadingPrices
          ? // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl" />
                  <div className="space-y-2">
                    <div className="w-20 h-3 bg-white/5 rounded" />
                    <div className="w-14 h-2 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="w-24 h-5 bg-white/5 rounded" />
              </div>
            ))
          : filteredAssets.map((asset) => {
              const up = asset.price_change_percentage_24h >= 0;
              return (
                <div
                  key={asset.id}
                  className="bg-[#0a0a0a] border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-orange-500/50 transition-all group cursor-pointer shadow-lg"
                >
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-white/5 rounded-lg md:rounded-xl flex items-center justify-center overflow-hidden">
                        <img
                          src={asset.image}
                          alt={asset.name}
                          className="w-6 h-6 md:w-8 md:h-8 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs md:text-base truncate">{asset.name}</p>
                        <p className="text-[9px] md:text-xs text-white/40 truncate uppercase">
                          {asset.symbol}/USDT
                        </p>
                      </div>
                    </div>
                    <div className={`text-right shrink-0 ${up ? "text-green-400" : "text-red-400"}`}>
                      <div className="flex items-center justify-end gap-1 font-bold text-[10px] md:text-sm">
                        {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        <span>
                          {up ? "+" : ""}
                          {asset.price_change_percentage_24h.toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-[8px] md:text-[10px] opacity-60">24h</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <h3 className="text-lg md:text-2xl font-bold tracking-tight">
                      ${asset.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <span className="text-[8px] text-white/20 font-mono">LIVE</span>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Empty state when search finds nothing */}
      {!loadingPrices && filteredAssets.length === 0 && (
        <div className="py-12 text-center bg-[#0a0a0a] border border-white/10 rounded-2xl">
          <p className="text-white/40 text-sm">No assets match "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
};

export default MarketsTab;
