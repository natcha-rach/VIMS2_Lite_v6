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
