export default function PublicStoreMenuPage() {
  // GuestMenuPage stays mounted in GuestStoreChrome so returning from
  // checkout/confirmation does not wait on a full menu remount.
  return null;
}
