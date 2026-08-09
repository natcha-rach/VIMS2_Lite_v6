# VIMS2 Lite V10.1 — Code Map สำหรับศึกษา

## ภาพรวม Data Flow

`HTML page → page JS → supabaseClient.js → Supabase DB/Storage/RPC → Realtime → reload หน้าอื่น`

ไม่มี Backend API แยกในเวอร์ชันนี้ ทุกอุปกรณ์ (มือถือ 1, มือถือ 2, iPad, Computer) ใช้ Supabase Project เดียวกัน

## ไฟล์หลัก

| ไฟล์ | หน้าที่ | เชื่อมต่อไปไหน |
|---|---|---|
| `index.html` | Dashboard | `dashboard.js` → lots/items/sales/expenses |
| `lots.html` | Lot | `lots.js` → lots/lot_groups/items/sales |
| `items.html` | Item, Bulk, Photo Queue, Excel | `items.js` → items/item_images/lots/lot_groups/history/storage |
| `sell.html` | หน้าขาย | `sell.js` → `sell_item` RPC → sales + items.status |
| `reports.html` | รายงาน | `reports.js` → sales/expenses/items/lots |
| `accounting.html` | บัญชี | `accounting.js` → lots/sales/expenses/app_settings |
| `supabaseClient.js` | connection + shared helpers | Supabase REST/Storage/RPC |
| `nav.js` | Sidebar + active page | DOM/localStorage |
| `realtime.js` | Sync ข้ามอุปกรณ์ + online/offline | Supabase Realtime → page reload |

## Database Flow สำคัญ

### ขายสินค้า
`click Item → sell.js → supabaseClient.rpc('sell_item') → SELECT item FOR UPDATE → INSERT sales → UPDATE items.status='sold'`

การ lock row ทำให้มือถือ 2 เครื่องกดขาย Item เดียวกันพร้อมกันไม่ได้ทั้งคู่

### แก้ Item
`edit form → items.js → rpc('update_item_with_history') → items + item_change_history`

ถ้าเปลี่ยนรูป: `Storage remove old → item_images delete → Storage upload → item_images insert → history`

### รูปสินค้า
`iPhone IMG_XXXX → Photo Queue → File object → Storage bucket item-images → item_images`

ชื่อไฟล์จาก iPhone ไม่ต้องถูกเปลี่ยน ระบบสร้าง storage path ของตัวเองด้วย `itemId/UUID.ext`

### Realtime
`อุปกรณ์ A INSERT/UPDATE → Supabase WAL/publication → Realtime → realtime.js → callback load...() → UI ของอุปกรณ์ B`

## Comment Convention

ในทุก JS file ให้ดู comment รูปแบบ:
- `Flow:` = ข้อมูลไหลจากจุดไหนไปจุดไหน
- `เชื่อม:` = function/table/RPC ที่เกี่ยวข้อง
- `ทำไม:` = เหตุผลทาง business rule
- `หมายเหตุ:` = ข้อจำกัดของ browser/Supabase

## Responsive

- `<860px`: mobile layout + bottom navigation
- `860–1023px`: tablet/desktop compact
- `1024–1400px`: iPad Pro 13" และ tablet landscape/portrait layout
- `>1400px`: desktop layout

iPad Pro 13" ไม่ถูกล็อก permission; ใช้งานได้ทุกหน้าเหมือนอุปกรณ์อื่น

## Migration

หลัง migration เดิมทั้งหมด ให้รัน:

`sql/migration_v10_realtime.sql`

Migration นี้เพิ่ม tables เข้า `supabase_realtime` และตั้ง `REPLICA IDENTITY FULL` สำหรับข้อมูลที่ต้อง sync
