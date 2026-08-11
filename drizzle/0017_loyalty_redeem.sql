-- Allow earn + redeem ledger rows per order; add redeem kind.

ALTER TYPE loyalty_ledger_kind ADD VALUE IF NOT EXISTS 'redeem';

DROP INDEX IF EXISTS loyalty_ledger_entries_order_id_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_entries_order_kind_uidx
  ON loyalty_ledger_entries (order_id, kind);
