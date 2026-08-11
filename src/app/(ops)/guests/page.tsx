import { redirect } from "next/navigation"
import { getGuestsView } from "@/lib/guests/getGuestsView"
import { GuestsClient } from "./GuestsClient"

export const dynamic = "force-dynamic"

export default async function GuestsPage() {
  const result = await getGuestsView()

  if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
    redirect("/staff/login")
  }

  return <GuestsClient initialGuestsView={result.error === "NO_LOCATION" ? null : result.data} />
}
