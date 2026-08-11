# V10.1 Changelog

## Added
- Supabase Realtime สำหรับ 4 devices
- Online / Offline / Syncing indicator
- Realtime refresh ของ Items, Lots, Sell, Dashboard, Accounting, Reports
- Bulk Draft/Resume สำหรับข้อมูลตาราง
- iPad Pro 13" responsive tuning (portrait/landscape)
- Detailed code comments / data-flow documentation
- Safe realtime migration that checks table existence

## Fixed
- `sell.js` sale history ใช้ `sales.sale_date` แทน `sold_at`
- Dashboard cache ถูก invalidate เมื่อข้อมูลจาก device อื่นเปลี่ยน

## Preserved
- `lot_groups`
- `item_images`
- `item_change_history`
- Atomic `sell_item()`
- Bulk 200 / Photo Queue / Excel Import


## V10.1.1 Safety Fixes

- Fixed duplicated Realtime listener registration in `sell.js`.
- Fixed immediate stock refresh after a successful sale.
- Failed single-item image upload now rolls back the just-created Item.
- Failed Bulk image upload now cleans up uploaded Storage files and rolls back the inserted Items.
- Preserved the existing V10 schema and the already-applied Realtime migration.

## V10.1 NEXT — Bulk 200 workflow refinement

- Removed an accidental startup `clearBulkDraft()` call so Bulk Draft can actually be resumed after refresh.
- Added Photo Queue pairing modes:
  - 1 image / item — sequential filename order.
  - 2 images / item — pairs 1-2, 3-4, 5-6, ...
  - Mixed 1/2 images — manual secondary-image assignment.
- Bulk and single-item inserts now generate UUIDs in the browser before insert, making row-to-item mapping deterministic for bulk photo upload and cleanup.
- Quick Entry now rolls back the newly created Item if its image upload fails.
