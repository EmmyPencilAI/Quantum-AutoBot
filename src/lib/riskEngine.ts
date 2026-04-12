export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export const RISK_PROFILES = {
    LOW: { maxTradePercent: 0.02, maxTotalExposure: 0.10, maxDailyLoss: 0.05, maxSlippage: 0.005, cooldownMs: 300000 },
    MEDIUM: { maxTradePercent: 0.05, maxTotalExposure: 0.20, maxDailyLoss: 0.10, maxSlippage: 0.015, cooldownMs: 60000 },
    HIGH: { maxTradePercent: 0.10, maxTotalExposure: 0.40, maxDailyLoss: 0.20, maxSlippage: 0.03, cooldownMs: 15000 }
};

interface SessionState {
    tradesExecuted: number;
    totalSpend: number;
    dailyLoss: number;
    currentExposure: number;
    isCircuitBroken: boolean;
}

export class MainnetRiskEngine {
    private static session: SessionState = {
        tradesExecuted: 0,
        totalSpend: 0,
        dailyLoss: 0,
        currentExposure: 0,
        isCircuitBroken: false
    };

    private static readonly MAX_TRADES_PER_SESSION = 50;
    private static readonly MAX_SPEND_PER_SESSION = 10000; // in USD/USDT

    /**
     * 1. CIRCUIT BREAKER SYSTEM
     * Halts all trading if catastrophic losses or limits are breached.
     */
    static checkCircuitBreaker(profile: any, portfolioValue: number): void {
        if (this.session.isCircuitBroken) {
            throw new Error("CIRCUIT BREAKER ENGAGED: Trading is halted.");
        }
        
        const lossPercent = this.session.dailyLoss / portfolioValue;
        if (lossPercent >= profile.maxDailyLoss) {
            this.session.isCircuitBroken = true;
            throw new Error("CIRCUIT BREAKER: Daily loss exceeded limit");
        }
    }

    /**
     * 2. PORTFOLIO EXPOSURE CONTROL & 6. SESSION LIMIT HARD CAP
     */
    static validateExposureAndSession(tradeAmount: number, portfolioValue: number, profile: any, action: string): void {
        if (this.session.tradesExecuted >= this.MAX_TRADES_PER_SESSION) {
            throw new Error("SESSION HARD CAP: Max trades per session reached.");
        }
        if (this.session.totalSpend + tradeAmount > this.MAX_SPEND_PER_SESSION) {
            throw new Error("SESSION HARD CAP: Max spend per session reached.");
        }

        const tradePercent = tradeAmount / portfolioValue;
        if (tradePercent > profile.maxTradePercent) {
            throw new Error(`RISK LIMIT: Trade size (${tradePercent * 100}%) exceeds max ${profile.maxTradePercent * 100}%`);
        }

        if (action === "BUY") {
            const newExposure = (this.session.currentExposure + tradeAmount) / portfolioValue;
            if (newExposure > profile.maxTotalExposure) {
                throw new Error(`RISK LIMIT: Trade exceeds max total portfolio exposure of ${profile.maxTotalExposure * 100}%`);
            }
        }
    }

    /**
     * 4. DYNAMIC SLIPPAGE MODEL
     * Tethers slippage to live market volatility and clamps it.
     */
    static calculateDynamicSlippage(volatility: number, liquidity: number, profile: any): number {
        if (liquidity < 50000) {
            throw new Error("RISK LIMIT: DEX Liquidity too low for safe execution.");
        }
        
        // Base slippage increases with volatility
        let dynamicSlippage = 0.001 + (volatility * 0.0005); 
        
        // Clamp to user's risk profile max
        return Math.min(dynamicSlippage, profile.maxSlippage);
    }

    /**
     * Record execution to update session limits
     */
    static recordExecution(tradeAmount: number, action: string) {
        this.session.tradesExecuted++;
        if (action === "BUY") {
            this.session.totalSpend += tradeAmount;
            this.session.currentExposure += tradeAmount;
        } else if (action === "SELL") {
            this.session.currentExposure = Math.max(0, this.session.currentExposure - tradeAmount);
        }
    }
}
