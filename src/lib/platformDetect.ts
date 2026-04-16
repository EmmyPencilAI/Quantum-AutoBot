/**
 * Platform detection and wallet installation guidance utilities.
 * 
 * Used to detect whether the user is on mobile or desktop and provide
 * appropriate wallet installation/connection guidance.
 */

/**
 * Detect if user is on a mobile device.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Detect if user is on iOS specifically.
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Detect if user is on Android specifically.
 */
export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

/**
 * Get the appropriate wallet install URL for the user's platform.
 */
export function getWalletInstallUrl(): { url: string; label: string } {
  if (isIOS()) {
    return {
      url: "https://apps.apple.com/app/sui-wallet/id6476572140",
      label: "Install Sui Wallet from App Store",
    };
  }
  if (isAndroid()) {
    return {
      url: "https://play.google.com/store/apps/details?id=com.mystenlabs.suiwallet",
      label: "Install Sui Wallet from Play Store",
    };
  }
  // Desktop — Chrome extension
  return {
    url: "https://chromewebstore.google.com/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil",
    label: "Install Sui Wallet Extension",
  };
}
