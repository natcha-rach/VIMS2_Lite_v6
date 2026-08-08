# VIMS2 Lite / Bubbles Gumps

ระบบหลังบ้านร้านเสื้อมือสองสำหรับใช้งานคนเดียว โดยตั้งใจให้เล็กและดูแลง่าย: **HTML/CSS/JS + Supabase** ไม่มี Express/Prisma และไม่มี API backend ของเราเอง

## Business flow

`Lot → คัดเป็นกลุ่ม → ลง Item → Available → Sell → Sold → วิเคราะห์กำไร`

### Lot
- 1 Lot = 1 ครั้งที่รับของเข้ามา
- ต้นทุนเฉลี่ยตั้งต้น = `ต้นทุน Lot ÷ จำนวนชิ้น`
- แต่ละ Lot สร้าง/แก้/ลบกลุ่มคัดของได้เอง เช่น `฿40–60`, `฿100`, `฿100+`, `งานหัว`
- กลุ่มมี `ราคาตั้งต้น` และ `Tier` (ปกติ / งานหัว)
- ไม่บังคับว่าทุก Lot ต้องใช้กลุ่มเหมือนกัน

### Item
- Condition: `A / B`
- Tier: `normal / head`
- สถานะ: `available / sold / damaged`
- Item มีรูปสูงสุด 2 รูป
- `cost_price` ใช้ต้นทุนเฉลี่ยของ Lot เป็นค่าเริ่มต้น
- `base_price` คือราคาตั้งต้นที่ระบบแนะนำ
- `current_price` คือราคาที่หน้าร้านใช้อยู่จริง
- ขายแล้วไม่ลบ Item เพื่อรักษาประวัติ

### Bulk receiving
หน้า Item รองรับ 2 workflow:
1. ของเข้า 2–3 ตัว: ลงทีละตัว
2. ของเข้าเป็นกระสอบ: เลือก Lot → เลือกกลุ่ม → ลงทีละตัวแบบ `บันทึก & ตัวถัดไป` หรือ Import Excel สูงสุด 200 รายการ

Excel รองรับ:
- `item_name`
- `size`
- `condition` = A/B
- `tier` = normal/head
- `price`
- `photo_count` = 1 หรือ 2

เลือกภาพจาก iPhone ตามลำดับชื่อ `IMG_....JPG` ได้เลย ไม่ต้อง rename ระบบจะจับภาพตาม `photo_count`

### Sale
ค้นหา Item → ราคาขายจริง → ช่องทางขาย → วิธีชำระ → Confirm

ช่องทาง:
- ถนนคนเดิน
- Facebook
- Instagram

วิธีชำระ:
- เงินสด
- โอน
- โครงการรัฐ

การขายใช้ RPC `sell_item` เพื่อให้สร้าง Sale และเปลี่ยน Item เป็น `sold` ใน transaction เดียว

### Dashboard
รองรับช่วงเวลา `วันนี้ / 7 วัน / เดือนนี้ / 3 เดือน / ปีนี้ / ทั้งหมด / กำหนดเอง`

แสดง:
- ยอดขาย
- กำไรขั้นต้น
- ค่าใช้จ่าย
- กำไรสุทธิ
- เงินทุนรวม
- มูลค่าต้นทุนสต็อก
- มูลค่าราคาขายคงเหลือ
- เงินสด / โอน / โครงการรัฐ
- ยอดขายตามช่องทาง
- Performance ตาม Tier
- Stock Aging
- Performance ตาม Lot + ROI
- สินค้าที่ค้าง 60+ วันสำหรับใช้พิจารณาลดราคา

## Supabase

### ฐานข้อมูลใหม่
รัน `sql/schema.sql`

### มีฐานข้อมูลเดิม
รันตามลำดับ:
1. schema เดิม
2. `sql/migration_v2.sql`
3. `sql/migration_v3.sql`

> โปรเจกต์นี้ยังตั้ง RLS แบบเปิดตามแนวคิดเดิม เพราะตั้งใจใช้คนเดียว หากจะเปิดเป็น public app ควรเพิ่ม Supabase Auth + RLS ก่อน

### Storage
Bucket `item-images` ถูกสร้างจาก schema/migration และใช้เก็บรูปสินค้า

## หมายเหตุ
- จำกัด bulk ที่ 200 รายการต่อครั้ง
- รูปต่อ Item สูงสุด 2 รูป
- Dashboard อ่านข้อมูลจาก Supabase โดยตรง
- `ROI` ในตาราง Lot เป็นกำไรของยอดขายในช่วงเวลาที่เลือก ÷ ต้นทุน Lot จึงควรดูคู่กับช่วงเวลาเสมอ

## Developer Notes / Code Map

> รอบ v4 ตั้งใจเขียน comment ในไฟล์ที่แก้ให้เห็นว่าแต่ละส่วนทำอะไร และเชื่อมกับส่วนไหนของระบบ

### `items.html`
- `bulkModal` = UI ของ Bulk Receiving 3 ขั้นตอน
- `photoQueuePanel` = staging รูปจาก iPhone ก่อนสร้าง Item
- `photoQueueItemCount` = จำนวน Item ที่ต้องการสร้างในกอง
- `photoQueueInput` = รับไฟล์รูปหลายไฟล์จากเครื่อง
- `startPhotoQueueEntry` = ส่งรูปที่จับคู่แล้วไปยัง Quick Entry

### `assets/js/items.js`
- `loadLots()` → Supabase table `lots`
- `loadGroups()` → Supabase table `lot_groups`
- `uploadItemImages()` → Supabase Storage bucket `item-images` + table `item_images`
- `startGroup()` → เริ่ม Bulk Entry แบบกรอกทีละตัว
- `openPhotoQueue()` → เปิด staging รูป
- `renderPhotoQueue()` → แสดงรูปและ mapping primary/secondary
- `buildPhotoPairsFromQueue()` → แปลง staging เป็น `[รูปหลัก, รูปที่ 2]` ต่อ Item
- `prepareQueuedItem()` → ส่งคู่รูปเข้า Quick Entry
- `quickEntryForm submit` → insert `items` แล้ว upload `item_images`
- Excel Import → อ่าน Excel ใน browser ด้วย SheetJS แล้ว insert `items` ตรงเข้า Supabase

### `assets/css/items.css`
- ส่วน `PHOTO QUEUE` เป็น style เฉพาะ staging รูปจำนวนมาก

### Supabase connection
`assets/js/supabaseClient.js` สร้าง `supabaseClient` ซึ่งถูกใช้โดย `items.js`, `lots.js`, `sell.js`, `dashboard.js` และหน้าอื่น ๆ

### Data flow ของ Bulk Receiving
Browser → `items.js` → Supabase `items` → Supabase Storage `item-images` → `item_images`

ไม่มี Express/Prisma/API server ตรงกลาง


## v5 — Bulk Table Review

รอบ v5 เปลี่ยน Bulk Receiving ให้มี **staging table** ก่อนบันทึกจริง:

`Photo Queue / Excel → Bulk Table → Validate → Supabase items → Storage → item_images`

### ทำไมต้องมี staging table
- ผู้ใช้เห็น 50–200 รายการพร้อมกันก่อนกดบันทึก
- แก้ `ชื่อ / Size / A-B / Tier / ราคาขาย` ได้ในจุดเดียว
- ต้นทุนเฉลี่ยจาก Lot ถูกใส่ให้โดยอัตโนมัติและแก้ไม่ได้จากตาราง
- Excel ไม่ insert ทันทีอีกต่อไป แต่เข้า workflow เดียวกับ Photo Queue
- ลดความเสี่ยงจากการ import ผิดแล้วต้องไปลบข้อมูลใน Supabase ทีหลัง

### Code map v5
- `startPhotoQueueEntry()` → แปลงรูปจาก Photo Queue เป็น staging rows → เปิด `Bulk Table`
- `showBulkTable()` → เปิดตารางและซ่อน Quick Entry
- `renderBulkTable()` → สร้างแถว HTML จาก `bulkTableState.rows`
- `updateBulkTableField()` → เขียนค่าจาก input/select กลับเข้า staging state
- `validateBulkTable()` → ตรวจชื่อสินค้าและจำนวนรูปก่อน Database
- `saveBulkTable()` → insert `items` เป็นชุด → upload รูป → เขียน `item_images`
- Excel handler → อ่าน SheetJS → map `photo_count` → สร้าง staging rows → ใช้ `saveBulkTable()`

### Data flow v5
```text
iPhone photos ─┐
               ├→ Photo Queue ─→ Bulk Table ─→ Supabase items
Excel ─────────┘                         └────→ Storage → item_images
```

> Comment ใน `items.js` เน้นอธิบาย **หน้าที่ + จุดเชื่อมต่อ** ของแต่ละ function ไม่ได้ใส่ comment ทุกบรรทัดที่เป็น syntax ธรรมดา เพื่อไม่ให้ไฟล์รกจนอ่าน business flow ยาก

## v6 — Bulk Table Power Workflow

### Keyboard / Excel shortcuts

- `Enter` — ไปแถวถัดไปในคอลัมน์เดิม
- `Shift + Enter` — ย้อนกลับหนึ่งแถว
- `Ctrl + Enter` — Fill ค่าจากช่องที่กำลัง focus ลงทุกแถวด้านล่าง
- `Ctrl + V` — วางข้อมูลหลายเซลล์จาก Excel/Google Sheets โดยเริ่มจากช่องที่กำลัง focus
- ปุ่ม `↓ Fill ลง` — ทำงานเหมือน Ctrl+Enter
- ปุ่ม `คัดลอกแถว` — คัดลอกข้อมูลแถวปัจจุบันเป็น TSV
- ปุ่ม `วางจาก Excel` — อ่าน Clipboard และเติมข้อมูลลงตาราง

### Data flow ของ Bulk Table

```text
Photo Queue / Excel
        ↓
 bulkTableState (browser staging)
        ↓
 renderBulkTable()
        ↓
 updateBulkTableField()
        ↓
 Keyboard / Fill Down / Paste
        ↓
 validateBulkTable()
        ↓
 saveBulkTable
        ↓
 Supabase items
        ↓
 Supabase Storage + item_images
```

### Comment convention

- `// UI` = อธิบาย DOM/interaction ในหน้า HTML
- `// state` = อธิบายข้อมูลชั่วคราวใน browser
- `// Supabase` = จุดที่อ่าน/เขียน Database หรือ Storage
- `// business rule` = กฎของร้าน เช่น 1–2 รูป, สูงสุด 200 Item, A/B, available/sold
- `// keyboard` = workflow สำหรับการลงข้อมูลจำนวนมาก

แนวคิดคือไม่ใส่ comment ทุกบรรทัดที่เป็น JavaScript พื้นฐาน แต่จะใส่ comment ที่อธิบาย “โค้ดส่วนนี้เชื่อมกับอะไรและทำไปเพื่ออะไร” เพื่อให้กลับมาแก้ต่อได้ง่าย
