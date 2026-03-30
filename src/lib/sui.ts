import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

// Connect to Sui Devnet or Testnet
export const suiClient = new SuiClient({ 
  url: getFullnodeUrl("testnet"),
  network: "testnet",
});

export const SUI_CONTRACT_ADDRESS = import.meta.env.VITE_SUI_CONTRACT_ADDRESS || "0x7ec914c89d99920f01c2a6aba892ec63bbdae74ca522f5ca4407d961a0263876";
export const SUI_TREASURY_ADDRESS = import.meta.env.VITE_SUI_TREASURY_ADDRESS || "0xe7768fa3f1907ddfd5bda7d7760e637b9d5a4887fa3f94482bc20a11e37db472";

// USDT on Sui Testnet
export const USDT_TYPE = "0x5d4b302306649423527773c6827317e943975d607a097e16f20935055b45c2ad::coin::COIN";
// USDC on Sui Testnet (Common ID)
export const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

/**
 * Simplified zkLogin wallet derivation for the AI Studio environment.
 */
export function deriveSuiWallet(uid: string): Ed25519Keypair {
  // Use a deterministic seed from the UID
  const encoder = new TextEncoder();
  const seed = encoder.encode(uid.padEnd(32, "0")).slice(0, 32);
  return Ed25519Keypair.fromSecretKey(seed);
}

/**
 * Request gas from Sui Testnet Faucet
 */
export async function requestTestnetGas(address: string) {
  try {
    console.log(`Requesting gas for ${address} on Sui Testnet...`);
    const response = await fetch("https://faucet.testnet.sui.io/gas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        FixedAmountRequest: {
          recipient: address,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Faucet request failed: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error requesting gas:", error);
    throw error;
  }
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
  try {
    const balance = await suiClient.getBalance({ owner: address, coinType: USDT_TYPE });
    return Number(balance.totalBalance) / 1e6; // USDT usually has 6 decimals
  } catch (e) {
    console.error("Error fetching USDT balance:", e);
    return 0;
  }
}

export async function getUsdcBalance(address: string) {
  try {
    const balance = await suiClient.getBalance({ owner: address, coinType: USDC_TYPE });
    return Number(balance.totalBalance) / 1e6; // USDC usually has 6 decimals
  } catch (e) {
    console.error("Error fetching USDC balance:", e);
    return 0;
  }
}

export async function getAllBalances(address: string) {
  const [sui, usdt, usdc] = await Promise.all([
    getSuiBalance(address),
    getUsdtBalance(address),
    getUsdcBalance(address)
  ]);
  return { sui, usdt, usdc };
}

export const SUI_TYPE = "0x2::sui::SUI";

export async function getDecimals(coinType: string): Promise<number> {
  if (coinType === SUI_TYPE || coinType.includes("sui::SUI")) return 9;
  try {
    const metadata = await suiClient.getCoinMetadata({ coinType });
    return metadata?.decimals ?? 6;
  } catch (e) {
    console.error("Error fetching coin metadata:", e);
    return 6; // Default to 6 for USDT/USDC if fetch fails
  }
}

/**
 * Real on-chain transfer for USDT or SUI
 */
export async function transferOnChain(params: {
  signer: Ed25519Keypair;
  to: string;
  amount: number;
  coinType?: string;
}) {
  const { signer, to, amount, coinType = SUI_TYPE } = params;
  const txb = new Transaction();
  const decimals = await getDecimals(coinType);
  const rawAmount = Math.floor(amount * Math.pow(10, decimals));

  if (rawAmount <= 0) throw new Error("Amount must be greater than 0");

  if (coinType === SUI_TYPE || coinType.includes("sui::SUI")) {
    // SUI Transfer
    const [coin] = txb.splitCoins(txb.gas, [rawAmount]);
    txb.transferObjects([coin], to);
  } else {
    // Token Transfer (e.g. USDT)
    const coins = await suiClient.getCoins({
      owner: signer.toSuiAddress(),
      coinType: coinType,
    });

    if (coins.data.length === 0) throw new Error(`No coins found for type: ${coinType}`);

    // Calculate total balance to ensure we have enough
    const totalBalance = coins.data.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0));
    if (totalBalance < BigInt(rawAmount)) {
      throw new Error(`Insufficient balance. Have ${Number(totalBalance) / Math.pow(10, decimals)}, need ${amount}`);
    }

    const coinObjectIds = coins.data.map((c) => c.coinObjectId);
    const primaryCoin = coinObjectIds[0];
    const rest = coinObjectIds.slice(1);
    
    if (rest.length > 0) {
      txb.mergeCoins(txb.object(primaryCoin), rest.map(id => txb.object(id)));
    }

    const [coin] = txb.splitCoins(txb.object(primaryCoin), [rawAmount]);
    txb.transferObjects([coin], to);
  }

  const result = await suiClient.signAndExecuteTransaction({
    signer,
    transaction: txb,
  });

  // Wait for effects to be sure it's processed
  await suiClient.waitForTransaction({ digest: result.digest });

  return result;
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

// Real cross-chain routing would use a bridge like Wormhole.
// For Sui-to-Sui, we'll use a direct transfer.
export async function crossChainTransfer(params: {
  signer: Ed25519Keypair;
  fromAddress: string;
  toAddress: string;
  amount: number;
  destinationChain: string;
  coinType?: string;
}) {
  const { signer, toAddress, amount, destinationChain, coinType } = params;
  console.log(`Routing transfer to ${destinationChain}...`, params);

  if (destinationChain === "Sui") {
    return await transferOnChain({
      signer,
      to: toAddress,
      amount,
      coinType: coinType || USDT_TYPE
    });
  }

  // For other chains, we simulate the bridge process
  // In a real app, this would involve locking assets on Sui and emitting a VAA
  return new Promise((resolve) => setTimeout(() => resolve({ 
    success: true, 
    digest: "0x" + Math.random().toString(16).slice(2) 
  }), 2000));
}
