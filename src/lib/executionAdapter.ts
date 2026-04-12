import { suiClient, deriveSuiWallet } from "./sui";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useEffect } from "react";

// Global context that UI components populate using dapp-kit hooks
export const executionContext = {
  uiWallet: null as any,
  signAndExecute: null as any,
  userUid: null as string | null,
};

export const executionAdapter = {
  async executeTransaction(tx: Transaction) {
    if (executionContext.uiWallet?.address && executionContext.signAndExecute) {
      console.log("[EXECUTION FINAL MODE]", {
        mode: "DAPP_WALLET",
        signer: executionContext.uiWallet.address,
        layer: "execution_adapter"
      });
      const result = await executionContext.signAndExecute({
        transaction: tx
      });
      
      // Wait for completion and ensure we get objectChanges back for the UI
      const finalResult = await suiClient.waitForTransaction({ 
        digest: result.digest,
        options: { showObjectChanges: true, showEffects: true }
      });
      return finalResult;
    }

    if (!executionContext.userUid) {
      throw new Error("No wallet connected and no fallback execution context available.");
    }

    const legacyKeypair = deriveSuiWallet(executionContext.userUid);
    
    console.log("[EXECUTION FINAL MODE]", {
      mode: "LEGACY_WALLET",
      signer: legacyKeypair.toSuiAddress(),
      layer: "execution_adapter"
    });

    return await legacyExecute(tx, legacyKeypair);
  }
};

async function legacyExecute(tx: Transaction, keypair: Ed25519Keypair) {
  const result = await suiClient.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: tx,
    options: {
      showObjectChanges: true,
      showEffects: true,
    }
  });
  await suiClient.waitForTransaction({ digest: result.digest });
  return result;
}

/**
 * Hook to inject dapp-kit execution context into our global adapter.
 * Components that need to run transactions should use this hook to ensure 
 * the adapter has access to the current UI wallet and execution function.
 */
export function useInitExecutionAdapter(user: any) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  useEffect(() => {
    executionContext.uiWallet = currentAccount;
    executionContext.signAndExecute = signAndExecuteTransaction;
    executionContext.userUid = user?.uid || null;
  }, [currentAccount, signAndExecuteTransaction, user]);

  return executionAdapter;
}
