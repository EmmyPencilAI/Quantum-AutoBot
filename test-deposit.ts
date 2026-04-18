import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const suiClient = new SuiClient({ url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' });

async function testDeposit() {
  const kp = new Ed25519Keypair();
  const address = kp.toSuiAddress();
  console.log(`Generated Testnet Address: ${address}`);

  // Request faucet
  console.log("Requesting testnet SUI...");
  const res = await fetch('https://faucet.testnet.sui.io/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ FixedAmountRequest: { recipient: address } })
  });
  await res.json();
  
  // Wait for faucet to settle
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Get all coins
  const result = await suiClient.getCoins({ owner: address, coinType: '0x2::sui::SUI' });
  if (result.data.length === 0) {
    console.error("No coins received from faucet.");
    return;
  }
  
  const totalBalance = result.data.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0));
  console.log(`Total Balance: ${totalBalance}`);
  
  // Mock transfer logic for EXACT balance (similar to Deposit)
  // But wait, gas must be paid. We will deposit (totalBalance - gasReservation)
  const gasBudget = BigInt(10000000); // 0.01 SUI
  const amountToDeposit = totalBalance - gasBudget;
  const rawNetAmount = amountToDeposit;

  console.log(`Depositing exact amount: ${rawNetAmount}`);

  const txb = new Transaction();
  const coinObjectIds = result.data.map(c => c.coinObjectId);
  const primaryCoin = coinObjectIds[0];
  const rest = coinObjectIds.slice(1);
  
  if (rest.length > 0) {
    txb.mergeCoins(txb.gas, rest.map(id => txb.object(id)));
  }

  // Split EXACT amount
  const [mainCoin] = txb.splitCoins(txb.gas, [rawNetAmount.toString()]);
  txb.transferObjects([mainCoin], "0x40e4e861562d786bbdc68e2ace97b579a6022e8a1d9bad850112138c301e0e41");
  
  txb.setGasBudget(Number(gasBudget));

  console.log("Executing transaction...");
  try {
    const txResult = await suiClient.signAndExecuteTransaction({
      signer: kp,
      transaction: txb,
    });
    console.log("Success! Digest:", txResult.digest);
  } catch (err: any) {
    console.error("Test Deposit Failed:", err.message);
  }
}

testDeposit();
