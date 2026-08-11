import { redirect } from "next/navigation";
import { getCounterView } from "@/lib/counter/getCounterView";
import { CounterClient } from "./CounterClient";

export const dynamic = "force-dynamic";

export default async function CounterPage() {
  const result = await getCounterView();

  if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
    redirect("/staff/login");
  }

  return (
    <CounterClient
      initialCounterView={result.error === "NO_LOCATION" ? null : result.data}
    />
  );
}
