/* ==========================================================
   STUDY NOTE — อ่าน file นี้โดยไล่จาก function ตาม comment “Function:”
   ทุก function จะบอกหน้าที่และจุดเชื่อมต่อกับ UI / Supabase / ไฟล์อื่น
   ========================================================== */

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
// Function: formatBaht — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function formatBaht(num) {
  const n = Number(num) || 0;
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ฿";
}

// ฟอร์แมตวันที่แบบไทยสั้นๆ
// Function: formatDate — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
}
