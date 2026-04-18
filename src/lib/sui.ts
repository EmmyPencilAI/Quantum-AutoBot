import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl as getFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

// Connect to Sui Devnet or Testnet
export const suiClient = new SuiClient({ url: getFullnodeUrl("testnet"), network: "testnet" as any });

export const SUI_CONTRACT_ADDRESS = import.meta.env.VITE_SUI_CONTRACT_ADDRESS || "0x7ec914c89d99920f01c2a6aba892ec63bbdae74ca522f5ca4407d961a0263876";
export const SUI_TREASURY_ADDRESS = import.meta.env.VITE_SUI_TREASURY_ADDRESS || "0x40e4e861562d786bbdc68e2ace97b579a6022e8a1d9bad850112138c301e0e41";

// USDT on Sui Testnet
export const USDT_TYPE = "0x5d4b302306649423527773c6827317e943975d607a097e16f20935055b45c2ad::coin::COIN";
// USDC on Sui Testnet (Common ID)
export const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
export const SUI_TYPE = "0x2::sui::SUI";

// Platform Fee Configuration
export const PLATFORM_FEE_PERCENT = 0.001; // 0.1% - "cheap" but collected

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

export async function getLiveBalanceAccurate(address: string, coinType: string, decimals: number) {
  try {
    let cursor = null;
    let totalBalance = BigInt(0);
    while (true) {
      const result = await suiClient.getCoins({
        owner: address,
        coinType: coinType,
        ...(cursor ? { cursor } : {})
      }) as any;
      if (!result || !result.data) break;
      totalBalance += result.data.reduce((sum: bigint, c: any) => sum + BigInt(c.balance), BigInt(0));
      if (!result.hasNextPage) break;
      cursor = result.nextCursor;
    }
    return Number(totalBalance) / Math.pow(10, decimals);
  } catch (e) {
    console.error(`Error sweeping live coins for ${coinType}:`, e);
    return 0;
  }
}

export async function getSuiBalance(address: string) {
  return await getLiveBalanceAccurate(address, SUI_TYPE, 9);
}

export async function getUsdtBalance(address: string) {
  return await getLiveBalanceAccurate(address, USDT_TYPE, 6);
}

export async function getUsdcBalance(address: string) {
  return await getLiveBalanceAccurate(address, USDC_TYPE, 6);
}

export async function getAllBalances(address: string) {
  const [sui, usdt, usdc] = await Promise.all([
    getSuiBalance(address),
    getUsdtBalance(address),
    getUsdcBalance(address)
  ]);
  return { sui, usdt, usdc };
}

export const SUI_TYPE_ALT = "0x2::sui::SUI";

export async function getDecimals(coinType: string): Promise<number> {
  if (coinType === SUI_TYPE || coinType === SUI_TYPE_ALT || coinType.includes("sui::SUI")) return 9;
  try {
    const metadata = await suiClient.getCoinMetadata({ coinType });
    return metadata?.decimals ?? 6;
  } catch (e) {
    console.error("Error fetching coin metadata:", e);
    // Common defaults
    if (coinType === USDT_TYPE || coinType === USDC_TYPE) return 6;
    return 9; 
  }
}

/**
 * Real on-chain transfer for USDT or SUI with platform fee collection
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
  
  // Calculate platform fee
  const feePercent = to === SUI_TREASURY_ADDRESS ? 0 : PLATFORM_FEE_PERCENT;
  const feeAmount = amount * feePercent;
  const netAmount = amount - feeAmount;

  const rawNetAmount = Math.floor(netAmount * Math.pow(10, decimals));
  const rawFeeAmount = Math.floor(feeAmount * Math.pow(10, decimals));

  if (rawNetAmount <= 0) throw new Error("Amount too small after fees");

  if (coinType === SUI_TYPE || coinType === SUI_TYPE_ALT || coinType.includes("sui::SUI")) {
    // SUI Transfer
    if (rawFeeAmount > 0) {
      const [feeCoin] = txb.splitCoins(txb.gas, [rawFeeAmount]);
      txb.transferObjects([feeCoin], SUI_TREASURY_ADDRESS);
    }
    const [mainCoin] = txb.splitCoins(txb.gas, [rawNetAmount]);
    txb.transferObjects([mainCoin], to);
  } else {
    // Token Transfer (e.g. USDT)
    const totalNeeded = BigInt(rawNetAmount) + BigInt(rawFeeAmount);
    
    let allCoins: any[] = [];
    let cursor = null;
    let totalBalance = BigInt(0);

    while (true) {
      const result = await suiClient.getCoins({
        owner: signer.toSuiAddress(),
        coinType: coinType,
        ...(cursor ? { cursor } : {})
      }) as any;

      allCoins.push(...result.data);
      totalBalance += result.data.reduce((sum: bigint, c: any) => sum + BigInt(c.balance), BigInt(0));

      if (totalBalance >= totalNeeded || !result.hasNextPage) {
        break;
      }
      cursor = result.nextCursor;
    }

    if (allCoins.length === 0) throw new Error(`No coins found for type: ${coinType}`);

    if (totalBalance < totalNeeded) {
      throw new Error(`Insufficient balance. Have ${Number(totalBalance) / Math.pow(10, decimals)}, need ${amount}`);
    }

    const coinObjectIds = allCoins.map((c) => c.coinObjectId);
    
    // FAST PATH: If depositing exactly 100% of balance with zero platform fee,
    // skip arbitrary merge/split constraints and directly transfer objects.
    if (totalBalance === totalNeeded && rawFeeAmount <= 0) {
      txb.transferObjects(coinObjectIds.map(id => txb.object(id)), to);
    } else {
      // SLOW PATH: Complex partial merge/split
      const primaryCoin = coinObjectIds[0];
      const rest = coinObjectIds.slice(1);
      
      if (rest.length > 0) {
        txb.mergeCoins(txb.object(primaryCoin), rest.map(id => txb.object(id)));
      }

      if (rawFeeAmount > 0) {
        const [feeCoin] = txb.splitCoins(txb.object(primaryCoin), [rawFeeAmount]);
        txb.transferObjects([feeCoin], SUI_TREASURY_ADDRESS);
      }
      
      if (totalBalance === totalNeeded) {
        txb.transferObjects([txb.object(primaryCoin)], to);
      } else {
        const [mainCoin] = txb.splitCoins(txb.object(primaryCoin), [rawNetAmount]);
        txb.transferObjects([mainCoin], to);
      }
    }
  }

  // Set a robust gas budget to prevent out-of-gas when merging/transferring multiple objects
  txb.setGasBudget(50000000); // 0.05 SUI

  const result = await suiClient.signAndExecuteTransaction({
    signer,
    transaction: txb,
  });

  await suiClient.waitForTransaction({ digest: result.digest });
  return result;
}

export async function startSessionOnChain({
  signer,
  amount,
}: {
  signer: Ed25519Keypair;
  amount: number;
}): Promise<string> {
  const txb = new Transaction();
  const rawAmount = Math.floor(amount * 1e9); // SUI has 9 decimals

  const [coin] = txb.splitCoins(txb.gas, [rawAmount]);
  
  txb.moveCall({
    target: `${SUI_CONTRACT_ADDRESS}::trading::start_session`,
    arguments: [
      txb.object(coin),
      txb.pure.u64(rawAmount),
      txb.pure.u64(Date.now()),
    ],
  });

  txb.setGasBudget(10000000); // 0.01 SUI

  const result = await suiClient.signAndExecuteTransaction({
    signer,
    transaction: txb,
    options: {
      showObjectChanges: true,
    },
  });

  // Find the TradingSession object ID in objectChanges
  const sessionObject = result.objectChanges?.find(
    (change: any) =>
      change.type === "created" &&
      change.objectType.includes("::trading::TradingSession")
  );

  if (!sessionObject || !("objectId" in sessionObject)) {
    throw new Error("TradingSession object not found in transaction results");
  }

  return sessionObject.objectId;
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

  throw new Error(`Cross-chain transfer to ${destinationChain} is not supported in this version. Only Sui-to-Sui transfers are currently active.`);
}
