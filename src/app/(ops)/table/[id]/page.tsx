import { redirect, notFound } from "next/navigation";
import { getTableView } from "@/lib/pos/getTableView";
import { TableDetailClient } from "./TableDetailClient";

export const dynamic = "force-dynamic";

export default async function TablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getTableView(id);

  if (result.error === "UNAUTHORIZED") {
    redirect("/staff/login");
  }
  if (result.error === "FORBIDDEN") {
    redirect("/staff/login");
  }
  if (result.error === "NOT_FOUND") {
    notFound();
  }

  return (
    <TableDetailClient
      initialTableView={result.data}
      tableId={id}
    />
  );
}
