// ==========================================================
// ตั้งค่าการเชื่อมต่อ Supabase
// วิธีหาค่า: Supabase Dashboard -> Project Settings -> API
// SUPABASE_URL      = Project URL (ห้ามใส่ /rest/v1/ ต่อท้าย)
// SUPABASE_ANON_KEY = anon public key / publishable frontend key
// หมายเหตุ: createClient() จะจัดการ /rest/v1, /auth, /storage ให้เอง
// ==========================================================
const SUPABASE_URL = "https://cphhutlxvbinaycmsekm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwaGh1dGx4dmJpbmF5Y21zZWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMTcyNzEsImV4cCI6MjEwMTc5MzI3MX0._8Qjqrnnlot6Lt5vGuQQg_PgfZ9YavBxLxMG22ctxvc";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// แปลง payment_method (english) <-> ป้ายที่แสดงผล (ไทย)
const PAYMENT_LABELS = {
  cash: "เงินสด",
  transfer: "เงินโอน",
  government: "โครงการรัฐบาล",
};

// ฟอร์แมตตัวเลขเป็นสกุลเงินบาท
function formatBaht(num) {
  const n = Number(num) || 0;
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ฿";
}

// ฟอร์แมตวันที่แบบไทยสั้นๆ
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
}


// ==========================================================
// V10.1 REALTIME / MULTI-DEVICE SYNC
// ==========================================================
// หน้าที่:
//   สร้างช่องทาง Realtime กลางสำหรับทุกหน้า
//
// Flow:
//   Supabase DB change
//      ↓
//   postgres_changes
//      ↓
//   dispatchEvent("vims:realtime")
//      ↓
//   หน้าที่กำลังเปิดอยู่ reload ข้อมูลของตัวเอง
//
// ตารางที่ติดตาม:
//   lots, lot_groups, items, item_images, sales, expenses
//
// หมายเหตุ:
//   การ Sync จริงต้องเปิด Realtime publication ใน Supabase
//   ด้วย sql/migration_v10_1_realtime.sql ก่อนใช้งานจริง
// ==========================================================
(function initVimsRealtime() {
  let channel = null;
  let started = false;

  function ensureSyncIndicator() {
    if (document.getElementById('vimsSyncStatus')) return;
    const el = document.createElement('div');
    el.id = 'vimsSyncStatus';
    el.className = 'vims-sync-status online';
    el.innerHTML = '<span class="sync-dot"></span><span class="sync-text">กำลังเชื่อมต่อ...</span>';
    document.body.appendChild(el);
  }

  function setSyncStatus(state, text) {
    ensureSyncIndicator();
    const el = document.getElementById('vimsSyncStatus');
    if (!el) return;
    el.classList.remove('online', 'offline', 'syncing');
    el.classList.add(state);
    const label = el.querySelector('.sync-text');
    if (label) label.textContent = text;
  }

  function emitChange(payload) {
    window.dispatchEvent(new CustomEvent('vims:realtime', { detail: payload }));
  }

  function start() {
    if (started || !window.supabase?.createClient || !window.supabaseClient) return;
    started = true;
    ensureSyncIndicator();

    // Channel เดียวต่อหน้า เพื่อลดจำนวน WebSocket subscription ที่ไม่จำเป็น
    channel = window.supabaseClient.channel('vims2-lite-realtime');
    ['lots', 'lot_groups', 'items', 'item_images', 'sales', 'expenses'].forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          setSyncStatus('syncing', 'Syncing...');
          emitChange({ table, payload });
          // ให้ข้อความกลับเป็น Online หลังจากหน้าได้ event แล้ว
          window.setTimeout(() => setSyncStatus('online', 'Realtime พร้อม'), 350);
        }
      );
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setSyncStatus('online', 'Realtime พร้อม');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncStatus('offline', 'Realtime ขัดข้อง');
    });
  }

  window.addEventListener('online', () => setSyncStatus('online', 'ออนไลน์ · Realtime พร้อม'));
  window.addEventListener('offline', () => setSyncStatus('offline', 'ออฟไลน์ · ยังไม่ Sync'));

  // script ถูกโหลดท้าย body จึงเริ่มได้ทันที แต่รอ DOM อีก tick เพื่อให้ indicator อยู่ใน body แน่นอน
  window.setTimeout(start, 0);
  window.vimsRealtime = { start, setSyncStatus, emitChange };
})();
