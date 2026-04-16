import { suiClient } from "./sui";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useEffect } from "react";

// Global context that UI components populate using dapp-kit hooks
export const executionContext = {
  uiWallet: null as any,
  signAndExecute: null as any,
};

export const executionAdapter = {
  async executeTransaction(tx: Transaction) {
    if (!executionContext.uiWallet?.address || !executionContext.signAndExecute) {
      throw new Error("Wallet not connected. Please connect your wallet to execute transactions.");
    }

    console.log("[EXECUTION FINAL MODE]", {
      mode: "DAPP_WALLET",
      signer: executionContext.uiWallet.address,
      layer: "execution_adapter"
    });
    
    // Execute via connected wallet
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
};

export function useInitExecutionAdapter() {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  useEffect(() => {
    executionContext.uiWallet = currentAccount;
    executionContext.signAndExecute = signAndExecuteTransaction;
  }, [currentAccount, signAndExecuteTransaction]);

  return executionAdapter;
}
