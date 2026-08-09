# VIMS2 Lite V10.1 — Change Log

## Added
- Supabase Realtime sync layer across all 4 devices.
- Online/offline + Realtime status indicator.
- `sql/migration_v10_realtime.sql` for Supabase Realtime publication.
- Bulk Draft/Resume using localStorage for Bulk Table staging.
- iPad Pro 13" responsive layout for portrait/landscape.
- Touch-friendly tablet controls.
- `CODE_MAP.md` for studying architecture and data flow.
- Function-level study comments across JavaScript files.

## Fixed
- Sale history query now uses the real `sales.sale_date` column instead of non-existent `sold_at`.
- Dashboard Realtime refresh invalidates its cached dataset and preserves the currently selected period.

## Important limitation
- Browser `File` objects cannot be restored from localStorage. If a Bulk Draft is recovered after a page refresh, text/price/Size/condition/Tier are restored, but product images must be selected again before saving.

## Existing business rules preserved
- Item images: maximum 2.
- Condition: A/B.
- Tier: normal/head (งานหัว).
- Status: available → sold; sold cannot be changed back through the Item edit RPC.
- Sale uses actual sale price and atomic `sell_item` RPC.
- Payment methods: cash / transfer / government.
- Channels: street_market / facebook / instagram.
- No device-based permissions.
