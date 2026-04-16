/**
 * Sui address validation and utilities.
 *
 * Used across the app to validate wallet addresses before any
 * on-chain transaction, wallet persistence, or fund transfer.
 */

/**
 * Validates a Sui address format.
 * Valid Sui addresses are 66 characters: "0x" prefix + 64 hex chars.
 */
export function isValidSuiAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  if (typeof address !== "string") return false;
  // Must start with "0x" and be exactly 66 characters (0x + 64 hex)
  return /^0x[0-9a-fA-F]{64}$/.test(address);
}

/**
 * Returns true if the value is the legacy placeholder, not a real wallet.
 */
export function isPendingWallet(value: string | null | undefined): boolean {
  return !value || value === "Pending Web3 Wallet" || value === "";
}

/**
 * Shorten a Sui address for display: "0xabcd...ef12"
 */
export function shortenAddress(address: string, prefixLen = 6, suffixLen = 4): string {
  if (!address || address.length < prefixLen + suffixLen + 3) return address || "";
  return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}
