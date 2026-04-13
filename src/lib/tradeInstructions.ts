import { Transaction } from "@mysten/sui/transactions";
import { buildStartSessionPTB, buildTransferOnChainPTB, SUI_TREASURY_ADDRESS, SUI_TYPE, USDT_TYPE, USDC_TYPE } from "./sui";
import { MainnetRiskEngine, RISK_PROFILES } from "./riskEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TradeInstruction {
  intentId: string;
  action: "BUY" | "SELL" | "WITHDRAW" | "DEPOSIT" | "START_SESSION";
  asset: string;
  amount: number;
  riskLevel: number;
  strategyId: string;
  timestamp: number;
  signature?: string;
}

// ─── Signal Validation ────────────────────────────────────────────────────────

/**
 * Frontend execution guard:
 *
 * Validates a trade instruction before any on-chain action is taken.
 *
 * NOTE on signature verification:
 * True cryptographic verification (e.g. HMAC-SHA256) requires sharing a
 * secret between the server and client, which is architecturally unsafe in a
 * browser context. The full solution is to use asymmetric keys:
 *   - Server signs with a private key
 *   - Client verifies with the corresponding public key
 * This is tracked as a TODO for the next security milestone.
 *
 * For now we enforce:
 *   1. Expiry: instruction must be < 60 seconds old
 *   2. Signature presence: a non-empty server-signed string must exist
 *   3. Signal format: signature must begin with 'srv_' (server-issued)
 *   4. Risk engine: circuit breaker + exposure limits enforced
 */
export function validateTradeSignal(
  instruction: TradeInstruction,
  portfolioValue: number = 1000
): boolean {
  // Guard 1 — Expiry (replay attack prevention)
  const AGE_LIMIT_MS = 60_000;
  if (Date.now() - instruction.timestamp > AGE_LIMIT_MS) {
    console.error("SECURITY: Trade signal is expired. Possible replay attack.");
    return false;
  }

  // Guard 2 — Signature presence
  if (!instruction.signature || instruction.signature.trim().length === 0) {
    console.error("SECURITY: Unsigned signal rejected.");
    return false;
  }

  // Guard 3 — Signature format check (server-issued signals start with 'srv_')
  // TODO: Replace with asymmetric key verification (e.g. Ed25519 verify)
  if (!instruction.signature.startsWith("srv_")) {
    console.error("SECURITY: Signal signature format invalid.");
    return false;
  }

  // Guard 4 — Risk engine checks
  const profile = RISK_PROFILES.MEDIUM;
  try {
    MainnetRiskEngine.checkCircuitBreaker(profile, portfolioValue);
    MainnetRiskEngine.validateExposureAndSession(
      instruction.amount,
      portfolioValue,
      profile,
      instruction.action
    );
  } catch (error: any) {
    console.error("RISK ENGINE:", error.message);
    return false;
  }

  return true;
}

// ─── PTB Builder ──────────────────────────────────────────────────────────────

/**
 * Constructs the Sui Programmable Transaction Block for a validated trade.
 * All transactions are signed and executed client-side — non-custodial.
 */
export async function buildPTBFromTradeInstruction(
  instruction: TradeInstruction,
  senderAddress: string
): Promise<Transaction> {

  if (!validateTradeSignal(instruction)) {
    throw new Error("SECURITY_ERROR: Signal failed validation. Transaction halted.");
  }

  let coinType = USDT_TYPE;
  if (instruction.asset === "SUI") coinType = SUI_TYPE;
  if (instruction.asset === "USDC") coinType = USDC_TYPE;

  // Apply dynamic slippage from the risk engine
  // TODO: Feed real volatility and liquidity from live market data
  const MARKET_VOLATILITY = 15;
  const LIQUIDITY_DEPTH = 100_000;
  const slippagePercent = MainnetRiskEngine.calculateDynamicSlippage(
    MARKET_VOLATILITY,
    LIQUIDITY_DEPTH,
    RISK_PROFILES.MEDIUM
  );
  const minAmountOut = instruction.amount * (1 - slippagePercent);
  console.log(
    `[PTB] Building ${instruction.action} | amount: ${instruction.amount} | minOut: ${minAmountOut.toFixed(4)} | slippage: ${(slippagePercent * 100).toFixed(2)}%`
  );

  // Record this execution in the risk engine's session tracker
  MainnetRiskEngine.recordExecution(instruction.amount, instruction.action);

  switch (instruction.action) {
    case "START_SESSION":
      // Initiates a new TradingSession object on the Move contract
      return await buildStartSessionPTB({ amount: instruction.amount });

    case "DEPOSIT":
    case "BUY": {
      // Direct transfer to treasury for non-SUI assets
      return await buildTransferOnChainPTB({
        senderAddress,
        to: SUI_TREASURY_ADDRESS,
        amount: instruction.amount,
        coinType,
      });
    }

    case "SELL":
    case "WITHDRAW": {
      // TODO: Wire to withdraw_session on the Move contract
      // txb.moveCall({ target: `${CONTRACT}::trading::withdraw_session`, arguments: [...] });
      const txbSell = new Transaction();
      return txbSell;
    }

    default:
      throw new Error(`Unsupported trade instruction action: ${instruction.action}`);
  }
}
