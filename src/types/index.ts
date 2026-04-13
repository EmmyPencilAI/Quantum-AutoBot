/**
 * Shared TypeScript types for the Quantum Finance application.
 *
 * Import these types instead of using `any` to get proper type safety
 * and IDE autocompletion across the entire codebase.
 */

import type { User as FirebaseUser } from "firebase/auth";

// Re-export Firebase User type for convenience
export type { FirebaseUser };

// ─── User ─────────────────────────────────────────────────────────────────────

/** Firestore user document shape */
export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  avatar?: string;
  suiWallet: string;

  // Financial state
  walletBalance: number;
  usdtBalance: number;
  usdcBalance: number;

  // Trading state
  isTrading: boolean;
  activeStrategy?: TradingStrategy;
  activePair?: string;
  tradingAsset?: TradingAsset;
  initialInvestment?: number;
  totalProfit?: number;
  tradingSessionId?: string | null;

  // Market data (written by trading engine)
  activePairChange24h?: number;
  marketDataSource?: "coingecko_live" | "simulated";
  lastTradeAt?: string;

  // Auth / admin
  role?: "admin" | "user";
  createdAt?: string;
  username?: string;
}

export type TradingStrategy = "Aggressive" | "Momentum" | "Scalping" | "Conservative";
export type TradingAsset = "USDT" | "USDC" | "SUI";

// ─── Trades ───────────────────────────────────────────────────────────────────

export interface TradeRecord {
  id: string;
  uid: string;
  pair: string;
  type: "BUY" | "SELL";
  amount: number;
  asset: TradingAsset;
  price: number;
  pnl: number;
  strategy: TradingStrategy;
  timestamp: string;
  pair24hChange?: number;
  dataSource?: "coingecko_live" | "simulated";
  duration?: number; // seconds
  // For chart rendering
  time?: string;
  value?: number;
}

// ─── Community ────────────────────────────────────────────────────────────────

export interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  likesCount: number;
  commentsCount: number;
  createdAt: FirestoreTimestamp | string;
}

export interface Comment {
  id: string;
  uid: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: FirestoreTimestamp | string;
}

/** Firestore server timestamp shape when read back as a JS object */
export interface FirestoreTimestamp {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | "WITHDRAWAL"
  | "DEPOSIT"
  | "TRADE_STOPPED"
  | "TRADE_EXECUTED"
  | "PROFIT_WITHDRAWAL"
  | "TRANSFER_SENT";

export interface AppNotification {
  id: string;
  uid: string;
  type: NotificationType;
  title: string;
  message: string;
  amount?: number;
  asset?: string;
  txHash?: string | null;
  timestamp: string;
  read: boolean;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  profit: number;
  isTrading: boolean;
}

// ─── Trade Intents ────────────────────────────────────────────────────────────

export type TradeAction = "BUY" | "SELL" | "WITHDRAW" | "DEPOSIT" | "START_SESSION";

export interface TradeIntent {
  intentId: string;
  uid: string;
  action: TradeAction;
  asset: string;
  amount: number;
  riskLevel: number;
  strategyId: TradingStrategy;
  signature: string;
  timestamp: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  digest?: string;
  completedAt?: number;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface WithdrawalResult {
  success: boolean;
  newWalletBalance: number;
  txHash: string | null;
  message: string;
}

export interface SettlementResult {
  success: boolean;
  totalToUser: number;
  userProfitShare: number;
  treasuryShare: number;
  txHash: string | null;
  onChainError: string | null;
  message: string;
}

export interface ProfitWithdrawalResult {
  success: boolean;
  withdrawn: number;
  txHash: string | null;
  onChainError: string | null;
}

// ─── Market Data ──────────────────────────────────────────────────────────────

export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap?: number;
  total_volume?: number;
  image: string;
}
