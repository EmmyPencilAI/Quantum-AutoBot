export const CONFIG = {
  CHAIN_ID: 56, // BNB Chain Mainnet
  RPC_URL: "https://bsc-dataseed.binance.org/",
  USDT_ADDRESS: "0x55d398326f99059fF775485246999027B3197955", // USDT on BSC
  CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000", // Replace with deployed address
  TREASURY_ADDRESS: "0x0000000000000000000000000000000000000000", // Replace with treasury address
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
