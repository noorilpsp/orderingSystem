import { redirect } from "next/navigation"

/** Business Info is folded into the single Store settings page. */
export default function BusinessInfoRedirectPage() {
  redirect("/dashboard/stores")
}
