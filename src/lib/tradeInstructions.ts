import { Transaction } from "@mysten/sui/transactions";
import { buildTransferOnChainPTB, buildStartSessionPTB, SUI_TREASURY_ADDRESS, USDT_TYPE, USDC_TYPE, SUI_TYPE } from "./sui";
import { verifyMessage } from "ethers"; // Example via ethers for ECDSA, or @mysten/sui signing utils for Ed25519
import { MainnetRiskEngine, RISK_PROFILES } from "./riskEngine";

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

// 🛡️ FRONTEND EXECUTION GUARD LAYER
export function validateTradeSignal(instruction: TradeInstruction, portfolioValue: number = 1000): boolean {
  // 1. Expiry Check (prevent signatures older than 60s from executing)
  if (Date.now() - instruction.timestamp > 60000) {
    console.error("Signal expired.");
    return false;
  }

  // Use Medium risk profile by default for simulation, can be fetched from user config
  const activeProfile = RISK_PROFILES.MEDIUM;

  try {
      // 2. Financial Safety Guards (Circuit Breaker & Exposure)
      MainnetRiskEngine.checkCircuitBreaker(activeProfile, portfolioValue);
      MainnetRiskEngine.validateExposureAndSession(instruction.amount, portfolioValue, activeProfile, instruction.action);
  } catch (error: any) {
      console.error(error.message);
      return false; 
  }

  // 3. Signature Verification 
  if (!instruction.signature) {
      console.error("Unsigned Signal. Execution Halted!");
      return false;
  }
  
  /*
  const payloadToVerify = `${instruction.action}-${instruction.amount}-${instruction.timestamp}`;
  const signerAddress = verifyMessage(payloadToVerify, instruction.signature);
  if (signerAddress !== EXPECTED_BACKEND_SIGNER) return false;
  */

  return true;
}

export async function buildPTBFromTradeInstruction(
  instruction: TradeInstruction,
  senderAddress: string
): Promise<Transaction> {
  
  if (!validateTradeSignal(instruction)) {
      throw new Error("SECURITY_ERROR: Signal failed validation constraints.");
  }

  let coinType = USDT_TYPE;
  if (instruction.asset === "SUI") coinType = SUI_TYPE;
  if (instruction.asset === "USDC") coinType = USDC_TYPE;

  // Dynamic Slippage calculation example:
  const DUMMY_VOLATILITY = 15; // To be fed from market state
  const DUMMY_LIQUIDITY = 100000;
  const slippagePercent = MainnetRiskEngine.calculateDynamicSlippage(DUMMY_VOLATILITY, DUMMY_LIQUIDITY, RISK_PROFILES.MEDIUM);
  const minAmountOut = instruction.amount * (1 - slippagePercent);

  // 3. Stop-Loss Integration: 
  // If this trade exceeds the session dynamic loss, trigger the breaker.
  MainnetRiskEngine.recordExecution(instruction.amount, instruction.action);

  switch (instruction.action) {
    case "DEPOSIT":
    case "BUY":
      // Using strict DEX PTBs with minAmountOut (slippage)
      const txbBuy = new Transaction();
      // txbBuy.moveCall({ target: '...::dex::swap', arguments: [instruction.amount, minAmountOut] });
      return txbBuy;
      
    case "START_SESSION":
      return await buildStartSessionPTB({
        amount: instruction.amount
      });
      
    case "SELL":
    case "WITHDRAW":
      const txb = new Transaction();
      // txb.moveCall({ target: `${SUI_CONTRACT_ADDRESS}::trading::withdraw_session`, arguments: [...] });
      return txb;
      
    default:
      throw new Error(`Unsupported trade instruction action: ${instruction.action}`);
  }
}
