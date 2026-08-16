export { StaffLocaleProvider, useStaffLocale, useStaffLocaleOptional, useStaffT } from "./StaffLocaleProvider";
export { translateOpsMessage, getOpsMessages } from "./messages";
export {
  OPS_LOCALE_STORAGE_KEY,
  isOpsLocale,
  readStoredOpsLocale,
  writeStoredOpsLocale,
} from "./storage";
export {
  resolveOpsCatalogName,
  opsItemsCountLabel,
  opsGuestCountLabel,
  opsTableWithCodeLabel,
  opsOrderMatchesQuery,
  orderItemMatchesQuery,
} from "./format";
export type { OpsLocale } from "./types";
export type { OpsMessageKey } from "./messages/en";
export type { OpsTranslate } from "./format";
