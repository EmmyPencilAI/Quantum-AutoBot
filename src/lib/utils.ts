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
 * Utility for joining tailwind classes reliably
 */
export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
