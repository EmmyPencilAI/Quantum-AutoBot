/**
 * Formats a number with comma separators and specified decimals
 * Example: 1234567.89 -> "1,234,567.89"
 */
export const formatNumber = (num: number, decimals: number = 2): string => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Formats large values with M or K suffixes to prevent UI breaks
 * Example: 1500000 -> "1.5M", 15000 -> "15K"
 */
export const formatLargeNumber = (num: number, decimals: number = 2): string => {
  if (Math.abs(num) >= 1_000_000) {
    return (num / 1_000_000).toFixed(decimals) + "M";
  }
  if (Math.abs(num) >= 10_000) {
    return (num / 1_000).toFixed(decimals) + "K";
  }
  // Fall back to standard comma separated logic for smaller amounts
  return formatNumber(num, decimals);
};

/**
 * Utility for joining tailwind classes reliably
 */
export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
