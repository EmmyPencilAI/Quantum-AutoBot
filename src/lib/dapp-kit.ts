import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const NETWORKS = {
  testnet: { url: 'https://sui-testnet.mystenlabs.com/graphql' },
  mainnet: { url: 'https://sui-mainnet.mystenlabs.com/graphql' },
};

export const dAppKit = createDAppKit({
  networks: NETWORKS as any,
  defaultNetwork: 'testnet',
  createClient: (name: keyof typeof NETWORKS) => new SuiGraphQLClient({
    url: NETWORKS[name]?.url || NETWORKS.testnet.url,
    network: name as any,
  }),
});
