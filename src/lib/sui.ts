import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { generateNonce, generateRandomness } from "@mysten/zklogin";
import axios from "axios";

// Connect to Sui Devnet or Testnet
export const suiClient = new SuiJsonRpcClient({ 
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet"
});

export const SUI_CONTRACT_ADDRESS = import.meta.env.VITE_SUI_CONTRACT_ADDRESS || "0x7ec914c89d99920f01c2a6aba892ec63bbdae74ca522f5ca4407d961a0263876";
export const SUI_TREASURY_ADDRESS = import.meta.env.VITE_SUI_TREASURY_ADDRESS || "0xe7768fa3f1907ddfd5bda7d7760e637b9d5a4887fa3f94482bc20a11e37db472";

/**
 * Simplified zkLogin wallet derivation for the AI Studio environment.
 */
export function deriveSuiWallet(uid: string): Ed25519Keypair {
  // Use a deterministic seed from the UID
  const encoder = new TextEncoder();
  const seed = encoder.encode(uid.padEnd(32, "0")).slice(0, 32);
  return Ed25519Keypair.fromSecretKey(seed);
}

export async function getSuiBalance(address: string) {
  try {
    const balance = await suiClient.getBalance({ owner: address });
    return Number(balance.totalBalance) / 1e9; // Convert from Mist to SUI
  } catch (e) {
    console.error("Error fetching SUI balance:", e);
    return 0;
  }
}

export async function getUsdtBalance(address: string) {
  // USDT on Sui Testnet (Example ID, would be real on Mainnet)
  const USDT_TYPE = "0x5d4b302306649423527773c6827317e943975d607a097e16f20935055b45c2ad::coin::COIN";
  try {
    const balance = await suiClient.getBalance({ owner: address, coinType: USDT_TYPE });
    return Number(balance.totalBalance) / 1e6; // USDT usually has 6 decimals
  } catch (e) {
    console.error("Error fetching USDT balance:", e);
    return 0;
  }
}

// Settlement logic: Shares profit between user and treasury
export async function settleTradeOnChain(params: {
  userAddress: string;
  principal: number;
  profit: number;
}) {
  console.log(`Settling trade on-chain for ${params.userAddress}...`, params);
  // In a real implementation:
  // 1. Call Move contract function `settle_trade(principal, profit, treasury_addr)`
  // 2. Contract handles the 50/50 split and transfers
  return new Promise((resolve) => setTimeout(() => resolve({ 
    success: true, 
    txId: "0x" + Math.random().toString(16).slice(2) 
  }), 2000));
}

// Mock cross-chain routing for demonstration
// We'll use a simulated real-routing logic that would call a bridge like Wormhole.
export async function crossChainTransfer(params: {
  fromAddress: string;
  toAddress: string;
  amount: number;
  destinationChain: string;
}) {
  console.log(`Routing cross-chain transfer to ${params.destinationChain}...`, params);
  // In a real implementation:
  // 1. Lock/Burn on Sui
  // 2. Wait for VAA (Wormhole)
  // 3. Mint/Release on Destination
  return new Promise((resolve) => setTimeout(() => resolve({ success: true, txId: "0x..." }), 2000));
}
