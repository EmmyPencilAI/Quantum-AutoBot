import { createDAppKit } from '@mysten/dapp-kit-react';
import { getJsonRpcFullnodeUrl as getFullnodeUrl } from '@mysten/sui/jsonRpc';

export const dAppKit = createDAppKit({
  networks: {
    testnet: { url: getFullnodeUrl('testnet') },
    mainnet: { url: getFullnodeUrl('mainnet') },
  } as any,
  defaultNetwork: 'testnet',
});
