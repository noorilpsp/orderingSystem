const DISMISSED_KEY = "guest-split-proposal-dismissed";

export function readDismissedProposalId(sessionKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${DISMISSED_KEY}:${sessionKey}`);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function writeDismissedProposalId(sessionKey: string, proposalId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${DISMISSED_KEY}:${sessionKey}`, proposalId);
  } catch {
    // ignore
  }
}
