// ==========================================================
// ตั้งค่าการเชื่อมต่อ Supabase
// วิธีหาค่า: Supabase Dashboard -> Project Settings -> API
// SUPABASE_URL      = Project URL
// SUPABASE_ANON_KEY = anon public key
// ==========================================================
const SUPABASE_URL = "https://golabqevqnoqfmgregil.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbGFicWV2cW5vcWZtZ3JlZ2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3OTkzNDYsImV4cCI6MjEwMTM3NTM0Nn0.XOxahIDmNRhVNrb-Wdl24K75UVNlh0vN04e2a3aWH1I";

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
