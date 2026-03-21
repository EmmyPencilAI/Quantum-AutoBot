import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Search, Star } from 'lucide-react';

interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
}

export const Markets: React.FC = () => {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('/api/prices');
        const data = await response.json();
        if (Array.isArray(data)) {
          setCoins(data);
        }
      } catch (error) {
        console.error('Error fetching prices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const filteredCoins = coins.filter(coin => 
    coin.name.toLowerCase().includes(search.toLowerCase()) ||
    coin.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Market Overview</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search coins..."
            className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-48"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* TradingView Widget Placeholder */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 h-64 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent" />
        <div className="text-center z-10">
          <TrendingUp className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-50" />
          <p className="text-white/60 text-sm">TradingView Chart Integration</p>
          <p className="text-xs text-white/40 mt-1">Live data for {filteredCoins[0]?.name || 'BTC'}/USDT</p>
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse h-20" />
          ))
        ) : (
          filteredCoins.map((coin) => (
            <motion.div
              key={coin.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{coin.symbol.toUpperCase()}</span>
                    <span className="text-xs text-white/40">{coin.name}</span>
                  </div>
                  <div className="text-xs text-white/40 mt-1">
                    MCap: ${(coin.market_cap / 1e9).toFixed(2)}B
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-bold text-white">
                  ${coin.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className={`text-xs flex items-center justify-end gap-1 mt-1 ${coin.price_change_percentage_24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {coin.price_change_percentage_24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
