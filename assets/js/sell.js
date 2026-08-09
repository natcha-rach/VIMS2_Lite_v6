/* ==========================================================
   SELL (sell.html) — ค้นหา → ดูรายละเอียด → ขาย → บันทึก
   เชื่อมต่อ:
   sell.html → sell.js → Supabase items / item_images / sales
   การเปลี่ยน available → sold ใช้ RPC sell_item เพื่อให้เป็น transaction เดียว
   ========================================================== */

let inStockItems = [];
let itemImagesById = {};
let selectedItem = null;

// โหลดสินค้าเฉพาะสถานะ available เพื่อไม่ให้สินค้าที่ขายแล้วกลับมาเลือกขายซ้ำ
// Function: loadSellGrid — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
async function loadSellGrid() {
  const { data: items, error } = await supabaseClient
    .from("items")
    .select("*, lots(lot_name), lot_groups(group_name)")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById("sellGrid").innerHTML = `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ</div>`;
    return;
  }

  inStockItems = items || [];

  // โหลดรูปหลัก/รูปที่ 2 แยกจาก items เพราะรูปถูกเก็บใน item_images แบบ 1-to-many
  const ids = inStockItems.map((item) => item.id);
  itemImagesById = {};
  if (ids.length) {
    const { data: images, error: imageError } = await supabaseClient
      .from("item_images")
      .select("item_id, image_url, sort_order")
      .in("item_id", ids)
      .order("sort_order", { ascending: true });

    if (!imageError) {
      (images || []).forEach((image) => {
        if (!itemImagesById[image.item_id]) itemImagesById[image.item_id] = [];
        itemImagesById[image.item_id].push(image);
      });
    }
  }

  renderGrid(inStockItems);
}

// สร้างการ์ดสินค้า: คลิกได้ทั้งการ์ดเพื่อเปิดรายละเอียดก่อนขาย
// Function: renderGrid — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function renderGrid(items) {
  if (!items.length) {
    document.getElementById("sellGrid").innerHTML = `<div class="empty-state">ไม่มีของในสต็อกให้ขาย</div>`;
    return;
  }

  const html = items.map((item) => {
    const image = itemImagesById[item.id]?.[0];
    return `
      <button class="item-tile" data-id="${item.id}">
        <div class="item-tile-image">${image ? `<img src="${image.image_url}" alt="">` : "👕"}</div>
        <div class="name">${escapeHtml(item.item_name)}</div>
        <div class="meta">${escapeHtml(item.size || "-")} · ${item.condition || "-"} · ${item.tier === "head" ? "งานหัว" : "ปกติ"}</div>
        <div class="price">${formatBaht(item.current_price ?? item.sell_price)}</div>
      </button>`;
  }).join("");

  document.getElementById("sellGrid").innerHTML = html;
  document.querySelectorAll(".item-tile").forEach((tile) => {
    tile.addEventListener("click", () => openItemSaleDetail(tile.dataset.id));
  });
}

// ค้นหาแบบทันทีจากชื่อสินค้า / size / group / lot เพื่อให้ใช้หน้าร้านได้เร็ว
// Function: applySearch — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function applySearch() {
  const q = document.getElementById("searchBox").value.trim().toLowerCase();
  if (!q) return renderGrid(inStockItems);
  const filtered = inStockItems.filter((item) => {
    const haystack = [
      item.item_name,
      item.size,
      item.condition,
      item.lots?.lot_name,
      item.lot_groups?.group_name,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });
  renderGrid(filtered);
}

document.getElementById("searchBox").addEventListener("input", applySearch);

// เปิดหน้ารายละเอียด: เป็นจุดกลางระหว่าง “ค้นหา” และ “ยืนยันการขาย”
// Function: openItemSaleDetail — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
async function openItemSaleDetail(itemId) {
  const item = inStockItems.find((row) => row.id === itemId);
  if (!item) return;
  selectedItem = item;

  const images = itemImagesById[item.id] || [];
  document.getElementById("detailImage1").innerHTML = images[0] ? `<img src="${images[0].image_url}" alt="">` : "👕";
  document.getElementById("detailImage2").innerHTML = images[1] ? `<img src="${images[1].image_url}" alt="">` : "＋";
  document.getElementById("detailName").textContent = item.item_name;
  document.getElementById("detailMeta").textContent = `${item.size || "ไม่ระบุไซซ์"} · ${item.condition || "-"} · ${item.tier === "head" ? "งานหัว" : "ปกติ"}`;
  document.getElementById("detailLot").textContent = item.lots?.lot_name || "-";
  document.getElementById("detailGroup").textContent = item.lot_groups?.group_name || "-";
  document.getElementById("detailCost").textContent = formatBaht(item.cost_price);
  document.getElementById("detailBasePrice").textContent = formatBaht(item.base_price);
  document.getElementById("detailCurrentPrice").textContent = formatBaht(item.current_price ?? item.sell_price);

  // โหลดประวัติการขายเฉพาะ Item นี้ เพื่อให้รู้ว่ามีรายการขายเดิมหรือไม่
  const { data: sales } = await supabaseClient
    .from("sales")
    .select("id, sale_price, cost_price, payment_method, channel, sale_date, note")
    .eq("item_id", item.id)
    .order("sale_date", { ascending: false });
  renderSaleHistory(sales || []);

  document.getElementById("saleDetailModal").classList.remove("hidden");
}

// Function: renderSaleHistory — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function renderSaleHistory(sales) {
  const el = document.getElementById("saleHistory");
  if (!sales.length) {
    el.innerHTML = `<div class="empty-state small">ยังไม่มีประวัติการขาย</div>`;
    return;
  }
  el.innerHTML = sales.map((sale) => {
    const profit = Number(sale.sale_price || 0) - Number(sale.cost_price || 0);
    return `<div class="sale-history-row">
      <div><b>${formatBaht(sale.sale_price)}</b><span>${formatDateTime(sale.sale_date)}</span></div>
      <div><span>${paymentLabel(sale.payment_method)}</span><span>${channelLabel(sale.channel)}</span></div>
      <strong class="${profit >= 0 ? "profit" : "loss"}">${profit >= 0 ? "+" : ""}${formatBaht(profit)}</strong>
    </div>`;
  }).join("");
}

// จากรายละเอียด → เปิดฟอร์มขายจริง โดยใช้ current_price เป็นราคาเริ่มต้น
// Function: openSellConfirm — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function openSellConfirm() {
  if (!selectedItem) return;
  document.getElementById("modalItemId").value = selectedItem.id;
  document.getElementById("modalItemName").textContent = selectedItem.item_name;
  document.getElementById("modalItemMeta").textContent = `${selectedItem.size || ""} ${selectedItem.condition ? "· " + selectedItem.condition : ""} · ต้นทุน ${formatBaht(selectedItem.cost_price)}`;
  document.getElementById("salePrice").value = selectedItem.current_price ?? selectedItem.sell_price ?? 0;
  document.getElementById("sellModal").classList.remove("hidden");
}

// Function: closeModal — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

document.getElementById("closeSaleDetail").addEventListener("click", () => closeModal("saleDetailModal"));
document.getElementById("cancelDetailSale").addEventListener("click", () => closeModal("saleDetailModal"));
document.getElementById("cancelSell").addEventListener("click", () => closeModal("sellModal"));
document.getElementById("openSellConfirm").addEventListener("click", () => {
  closeModal("saleDetailModal");
  openSellConfirm();
});

// Confirm การขาย: ใช้ RPC ที่ lock row + insert sale + update status ใน transaction เดียว
// เชื่อม: sell.js → Supabase RPC sell_item → sales + items.status/sold_at
// ถ้าขั้นตอนใดล้มเหลว Database จะ rollback ทั้งชุด
document.getElementById("sellForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const itemId = document.getElementById("modalItemId").value;
  const item = inStockItems.find((row) => row.id === itemId);
  if (!item) return;

  const salePrice = Number(document.getElementById("salePrice").value);
  const paymentMethod = document.getElementById("paymentMethod").value;
  const channel = document.getElementById("channel").value;
  if (!Number.isFinite(salePrice) || salePrice < 0) return showToast("ราคาขายไม่ถูกต้อง");

  const submitButton = document.querySelector("#sellForm button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "กำลังบันทึก...";

  const { error } = await supabaseClient.rpc("sell_item", {
    p_item_id: item.id,
    p_sale_price: salePrice,
    p_payment_method: paymentMethod,
    p_channel: channel,
    p_note: null,
  });

  submitButton.disabled = false;
  submitButton.textContent = "ยืนยันการขาย";

  if (error) {
    console.error(error);
    showToast("บันทึกการขายไม่สำเร็จ: " + error.message);
    return;
  }

  closeModal("sellModal");
  selectedItem = null;
  showToast(`ขาย “${item.item_name}” สำเร็จ`);
  await loadSellGrid();
});

// Function: paymentLabel — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function paymentLabel(value) {
  return ({ cash: "เงินสด", transfer: "โอน", government: "โครงการรัฐ" })[value] || value || "-";
}
// Function: channelLabel — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function channelLabel(value) {
  return ({ street_market: "ถนนคนเดิน", facebook: "Facebook", instagram: "Instagram" })[value] || value || "-";
}
// Function: formatDateTime — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}
// Function: escapeHtml — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}
// Function: showToast — หน้าที่หลักของฟังก์ชันนี้; ดู query/RPC/DOM ภายในเพื่อไล่ Data Flow
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => t.classList.remove("show"), 2500);
}

loadSellGrid();
