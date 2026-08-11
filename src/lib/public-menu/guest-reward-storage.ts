const STORAGE_PREFIX = "guest-selected-reward:";

export function selectedRewardStorageKey(storeSlug: string): string {
  return `${STORAGE_PREFIX}${storeSlug}`;
}

export function readSelectedRewardId(storeSlug: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(selectedRewardStorageKey(storeSlug));
  } catch {
    return null;
  }
}

export function writeSelectedRewardId(storeSlug: string, rewardId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(selectedRewardStorageKey(storeSlug), rewardId);
}

export function clearSelectedRewardId(storeSlug: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(selectedRewardStorageKey(storeSlug));
}
