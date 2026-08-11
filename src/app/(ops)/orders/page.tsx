import { redirect } from "next/navigation";
import { getOrdersView } from "@/lib/orders/getOrdersView";
import { getOrdersStaffProfile } from "@/lib/orders/getOrdersStaffProfile";
import { OrdersClient } from "./OrdersClient";

export const dynamic = "force-dynamic";

const ORDERS_LOGIN_REDIRECT = "/staff/login?returnTo=%2Forders";

export default async function OrdersPage() {
  const [result, staffProfile] = await Promise.all([
    getOrdersView(),
    getOrdersStaffProfile(),
  ]);

  if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
    redirect(ORDERS_LOGIN_REDIRECT);
  }

  const loadError =
    result.error === "LOAD_ERROR"
      ? result.message ?? "Failed to load orders. Please try again."
      : null;

  return (
    <OrdersClient
      initialOrdersView={result.error === "NO_LOCATION" ? null : "data" in result ? result.data : null}
      loadError={loadError}
      staffProfile={staffProfile}
    />
  );
}
