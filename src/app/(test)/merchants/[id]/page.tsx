import Image from "next/image";
import { Link } from "@/components/ui/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { merchants } from "@/db/schema";
import { getMerchantWithLocations } from "@/lib/queries";

export async function generateStaticParams() {
  return await db.select({ id: merchants.id }).from(merchants);
}

export default async function Page(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await props.params;
  const merchantId = decodeURIComponent(id);

  const merchant = await getMerchantWithLocations(merchantId);

  if (!merchant) {
    return notFound();
  }

  const locations = merchant.locations ?? [];

  const count = locations.length;
  let imageCount = 0;

  return (
    <div className="container space-y-6 p-4">
      <div className="border-b border-accent1 pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Image
              loading={imageCount++ < 15 ? "eager" : "lazy"}
              decoding="sync"
              src={
                locations[0]?.logoUrl?.trimEnd() ||
                locations[0]?.bannerUrl?.trimEnd() ||
                "/placeholder.svg"
              }
              alt={`Logo for ${merchant.name}`}
              width={56}
              height={56}
              quality={65}
              className="h-14 w-14 flex-shrink-0 border object-cover"
            />
            <div>
              <h1 className="text-2xl font-semibold">{merchant.name}</h1>
              <p className="text-sm text-gray-700">{merchant.legalName}</p>
            </div>
          </div>
          {locations[0]?.bannerUrl && (
            <div className="overflow-hidden rounded border">
              <Image
                loading={imageCount++ < 15 ? "eager" : "lazy"}
                decoding="sync"
                src={locations[0].bannerUrl!.trimEnd()}
                alt={`Banner for ${merchant.name}`}
                width={960}
                height={240}
                quality={65}
                className="h-40 w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DetailCard label="Legal Name" value={merchant.legalName} />
        <DetailCard label="KBO Number" value={merchant.kboNumber ?? "-"} />
        <DetailCard label="Status" value={merchant.status} />
        <DetailCard label="Business Type" value={merchant.businessType} />
        <DetailCard label="Contact Email" value={merchant.contactEmail} />
        <DetailCard label="Phone" value={merchant.contactPhone} />
        <DetailCard label="Address" value={merchant.registeredAddressLine1 ?? "-"} />
        <DetailCard label="Timezone" value={merchant.defaultTimezone} />
        <DetailCard label="Subscription Tier" value={merchant.subscriptionTier} />
        <DetailCard
          label="Subscription Expires"
          value={
            merchant.subscriptionExpiresAt
              ? new Date(merchant.subscriptionExpiresAt).toLocaleString()
              : "-"
          }
        />
        <DetailCard label="Currency" value={merchant.defaultCurrency} />
        <DetailCard
          label="Created At"
          value={
            merchant.createdAt
              ? new Date(merchant.createdAt).toLocaleString()
              : "-"
          }
        />
        <DetailCard
          label="Updated At"
          value={
            merchant.updatedAt
              ? new Date(merchant.updatedAt).toLocaleString()
              : "-"
          }
        />
      </div>

      <div className="space-y-4">
        {count > 0 && (
          <h2 className="mb-2 border-b-2 text-lg font-semibold">
            Locations ({count})
          </h2>
        )}
        <div className="flex flex-row flex-wrap gap-2">
          {locations.map((location, index) => (
            <Link
              prefetch={true}
              key={location.id ?? index}
              className="group flex h-full w-full flex-row gap-2 border px-4 py-2 hover:bg-gray-100 sm:w-[250px]"
            href={`/merchants/${merchant.id}`}
            >
              <div className="py-2">
                <Image
                  loading={imageCount++ < 15 ? "eager" : "lazy"}
                  decoding="sync"
                  src={
                    location.logoUrl?.trimEnd() ||
                    location.bannerUrl?.trimEnd() ||
                    "/placeholder.svg"
                  }
                  alt={`A small picture of ${location.name}`}
                  width={64}
                  height={64}
                  quality={65}
                  className="h-16 w-16 flex-shrink-0 object-cover"
                />
              </div>
              <div className="flex flex-grow flex-col items-start py-1">
                <div className="text-sm font-medium text-gray-700 group-hover:underline">
                  {location.name}
                </div>
                <div className="text-xs text-gray-600">
                  {location.city ?? "-"}
                </div>
                <div className="text-xs text-gray-600">
                  {location.address ?? "-"}
                </div>
                <div className="text-[11px] text-gray-500">
                  {location.phone ?? "-"} · {location.email ?? "-"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value ?? "-"}</p>
    </div>
  );
}
