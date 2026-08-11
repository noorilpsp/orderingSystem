import { MobileOrderingLayout } from "@/components/mobile-ordering/mobile-ordering-layout";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MobileOrderingLayout>{children}</MobileOrderingLayout>;
}
