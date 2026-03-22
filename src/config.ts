export const CONFIG = {
  CHAIN_ID: 56, // BNB Chain Mainnet
  RPC_URL: "https://data-seed-prebsc-1-s1.binance.org:8545/",
  USDT_ADDRESS: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", // USDT on BSC
  CONTRACT_ADDRESS: "0x231B1A524f480a0285Ac6A093DEd1931D0A28f81", // Replace with deployed address
  TREASURY_ADDRESS: "0xBebdB8db1DDc42ED3270dB48c757447e6E4Aa8a2", // Replace with treasury address
  STRATEGIES: ["Aggressive", "Momentum", "Scalping", "Conservative"],
  PAIRS: ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT"]
};

export const USDT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

export const QUANTUM_ABI = [
  "function deposit(uint256 amount) external",
  "function settle(address user, uint256 finalBalance) external",
  "function emergencyWithdraw() external",
  "function userSessions(address user) view returns (uint256 principal, uint256 startTime, bool isActive)",
  "event Deposited(address indexed user, uint256 amount)",
  "event Settled(address indexed user, uint256 principal, uint256 profit, uint256 userShare, uint256 treasuryShare)"
];
