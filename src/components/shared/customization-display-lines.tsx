"use client";

import type { GuestCustomizationGroup } from "@/lib/guest-menu/types";
import {
  customizationIntentTextClass,
  formatCustomizationOptionLabel,
  getCustomizationDisplayIntent,
  resolveCustomizationDisplayPrice,
  type CustomizationDisplaySurface,
} from "@/lib/menu/customization-display";
import { resolveCustomizationOptionPrice } from "@/lib/public-menu/resolve-customization-option-price";
import { resolveCatalogText, type CatalogI18n } from "@/lib/catalog-i18n";
import { useGuestLocale } from "@/lib/guest-i18n";
import { useStaffLocaleOptional } from "@/lib/ops-i18n";
import { useGuestLocalization } from "@/lib/hooks/useGuestLocalization";
import { useMerchantLocalization } from "@/lib/hooks/useMerchantLocalization";
import { cn } from "@/lib/utils";

type GuestSelectedOptions = Record<string, string[]>;

type OpsCustomization = {
  groupName: string;
  optionName: string;
  optionPrice: number;
  quantity: number;
  groupI18n?: CatalogI18n | null;
  optionI18n?: CatalogI18n | null;
};

function GuestCustomizationDisplayLines({
  groups,
  selectedOptions,
  textSizeClassName = "text-xs",
}: {
  groups: GuestCustomizationGroup[];
  selectedOptions?: GuestSelectedOptions | null;
  textSizeClassName?: string;
}) {
  const { locale } = useGuestLocale();
  const { formatMoney } = useGuestLocalization();

  if (!selectedOptions) return null;

  const lines = Object.entries(selectedOptions).flatMap(([groupId, optionIds]) => {
    const group = groups.find((entry) => entry.id === groupId);
    if (!group || optionIds.length === 0) return [];

    const siblingPrices = group.options.map((option) =>
      resolveCustomizationOptionPrice(option, selectedOptions, groups),
    );

    return optionIds.map((optionId) => {
      const option = group.options.find((entry) => entry.id === optionId);
      const optionNameEn = option?.name ?? optionId;
      const groupNameEn = group.name;
      const resolvedPrice = option
        ? resolveCustomizationOptionPrice(option, selectedOptions, groups)
        : 0;
      // Conditional add-ons are already deltas; absolute size menus still need sibling deltas.
      const price = option?.conditionalPrices
        ? resolvedPrice
        : resolveCustomizationDisplayPrice(resolvedPrice, siblingPrices);
      return {
        key: `${groupId}-${optionId}`,
        groupNameEn,
        optionNameEn,
        groupName: resolveCatalogText(locale, { name: groupNameEn }, group.i18n).name,
        optionName: resolveCatalogText(locale, { name: optionNameEn }, option?.i18n).name,
        price,
      };
    });
  });

  if (lines.length === 0) return null;

  return (
    <>
      {lines.map((line) => {
        const intent = getCustomizationDisplayIntent({
          optionName: line.optionNameEn,
          groupName: line.groupNameEn,
          price: line.price,
        });
        return (
          <p key={line.key} className={cn(textSizeClassName)}>
            <span className="text-foreground/70">{line.groupName}:</span>{" "}
            <span className={customizationIntentTextClass(intent, "guest")}>
              {line.optionName}
              {line.price > 0 ? ` (+${formatMoney(line.price)})` : ""}
            </span>
          </p>
        );
      })}
    </>
  );
}

function OpsCustomizationDisplayLinesInner({
  customizations,
  surface = "ops",
  showPrice = true,
  compact = false,
  textSizeClassName = "text-xs",
  formatMoney,
  locale,
}: {
  customizations?: OpsCustomization[] | null;
  surface?: CustomizationDisplaySurface;
  showPrice?: boolean;
  compact?: boolean;
  textSizeClassName?: string;
  formatMoney: (amount: number) => string;
  locale: "en" | "ar";
}) {
  if (!customizations || customizations.length === 0) return null;

  const resolved = customizations.map((customization) => ({
    groupNameEn: customization.groupName,
    optionNameEn: customization.optionName,
    groupName: resolveCatalogText(locale, { name: customization.groupName }, customization.groupI18n)
      .name,
    optionName: resolveCatalogText(
      locale,
      { name: customization.optionName },
      customization.optionI18n,
    ).name,
    optionPrice: customization.optionPrice,
    quantity: customization.quantity,
  }));

  if (compact) {
    return (
      <p className={cn("mt-0.5 truncate", textSizeClassName)}>
        {resolved.map((customization, index) => {
          const intent = getCustomizationDisplayIntent({
            optionName: customization.optionNameEn,
            groupName: customization.groupNameEn,
            price: customization.optionPrice,
          });
          const label = `${customization.groupName}: ${formatCustomizationOptionLabel({
            optionName: customization.optionName,
            quantity: customization.quantity,
            optionPrice: customization.optionPrice,
            showPrice,
            formatMoney,
          })}`;
          return (
            <span key={`${customization.groupNameEn}-${customization.optionNameEn}-${index}`}>
              {index > 0 ? (
                <span className="text-muted-foreground"> · </span>
              ) : null}
              <span className={customizationIntentTextClass(intent, surface)}>
                {label}
              </span>
            </span>
          );
        })}
      </p>
    );
  }

  return (
    <ul className="mt-1 space-y-0.5">
      {resolved.map((customization, index) => {
        const intent = getCustomizationDisplayIntent({
          optionName: customization.optionNameEn,
          groupName: customization.groupNameEn,
          price: customization.optionPrice,
        });
        return (
          <li
            key={`${customization.groupNameEn}-${customization.optionNameEn}-${index}`}
            className={cn("truncate", textSizeClassName, customizationIntentTextClass(intent, surface))}
          >
            <span className={surface === "ops" ? "text-white/45" : "text-foreground/70"}>
              {customization.groupName}:
            </span>{" "}
            {formatCustomizationOptionLabel({
              optionName: customization.optionName,
              quantity: customization.quantity,
              optionPrice: customization.optionPrice,
              showPrice,
              formatMoney,
            })}
          </li>
        );
      })}
    </ul>
  );
}

function OpsCustomizationDisplayLinesGuest(
  props: Omit<Parameters<typeof OpsCustomizationDisplayLinesInner>[0], "formatMoney" | "locale">,
) {
  const { locale } = useGuestLocale();
  const { formatMoney } = useGuestLocalization();
  return <OpsCustomizationDisplayLinesInner {...props} formatMoney={formatMoney} locale={locale} />;
}

function OpsCustomizationDisplayLinesMerchant(
  props: Omit<Parameters<typeof OpsCustomizationDisplayLinesInner>[0], "formatMoney" | "locale">,
) {
  const staffLocale = useStaffLocaleOptional();
  const { formatMoney } = useMerchantLocalization();
  return (
    <OpsCustomizationDisplayLinesInner
      {...props}
      formatMoney={formatMoney}
      locale={staffLocale?.locale ?? "en"}
    />
  );
}

function OpsCustomizationDisplayLines({
  customizations,
  surface = "ops",
  showPrice = true,
  compact = false,
  textSizeClassName = "text-xs",
}: {
  customizations?: OpsCustomization[] | null;
  surface?: CustomizationDisplaySurface;
  showPrice?: boolean;
  compact?: boolean;
  textSizeClassName?: string;
}) {
  const shared = {
    customizations,
    surface,
    showPrice,
    compact,
    textSizeClassName,
  };

  // Guest menu/confirmation runs outside TenantProvider - use guest money formatting.
  if (surface === "guest") {
    return <OpsCustomizationDisplayLinesGuest {...shared} />;
  }

  return <OpsCustomizationDisplayLinesMerchant {...shared} />;
}

export { GuestCustomizationDisplayLines, OpsCustomizationDisplayLines };
