/* ==========================================================
   STUDY NOTE — อ่าน file นี้โดยไล่จาก function ตาม comment “Function:”
   ทุก function จะบอกหน้าที่และจุดเชื่อมต่อกับ UI / Supabase / ไฟล์อื่น
   ========================================================== */

// ==========================================================
// nav.js — ควบคุมเมนู sidebar
// จอแคบ (<860px): เมนูอยู่เป็นแถบด้านล่างจอเสมอ (bottom nav bar)
// จอกว้าง (>=860px): เมนูอยู่ถาวรข้างซ้ายเสมอ กดย่อเหลือไอคอนได้
// โหลดในทุกหน้า ทำงานทันทีตอนโหลดสคริปต์ (ไม่ต้องรอ DOMContentLoaded
// เพราะ script อยู่ท้าย body องค์ประกอบ DOM พร้อมแล้ว)
// ==========================================================
(function () {
  const sidebar = document.getElementById("sidebar");
  const collapseBtn = document.getElementById("navCollapse");

  if (!sidebar) return; // กันพลาดกรณีหน้าไหนไม่มี sidebar

  function applyCollapsedState(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
  }

  // โหลดสถานะย่อเมนู (มีผลเฉพาะจอกว้าง)
  const savedCollapsed = localStorage.getItem("shirtShopSidebarCollapsed") === "true";
  applyCollapsedState(savedCollapsed);

  collapseBtn?.addEventListener("click", () => {
    const collapsed = !document.body.classList.contains("sidebar-collapsed");
    localStorage.setItem("shirtShopSidebarCollapsed", collapsed);
    applyCollapsedState(collapsed);
  });

  // ไฮไลต์เมนูของหน้าปัจจุบัน
  const currentPage = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".sidebar-links a").forEach((a) => {
    if (a.getAttribute("href") === currentPage) a.classList.add("active");
  });
})();
