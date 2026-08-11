import { redirect } from "next/navigation";
import { getKdsView } from "@/lib/kds/getKdsView";
import { KdsClient } from "./KdsClient";

export const dynamic = "force-dynamic";

export default async function KDSPage() {
  const result = await getKdsView();

  if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
    redirect("/staff/login");
  }

  if (result.error === "KDS_DISABLED") {
    redirect("/orders");
  }

  return <KdsClient initialKdsView={result.error === "NO_LOCATION" ? null : result.data} />;
}
