let editingLotId = null;
let lotsCache = [];
let activeLotId = null;
let activeGroups = [];

const $ = (id) => document.getElementById(id);

function escapeHtml(v = "") {
  return String(v).replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
}

function setDefaultPurchaseDate() { $("purchaseDate").valueAsDate = new Date(); }
function updateAvgCost() {
  const cost = Number($("totalCost").value || 0);
  const count = Number($("totalItems").value || 0);
  $("avgCostPreview").textContent = count > 0 ? `ต้นทุนเฉลี่ย: ${formatBaht(cost / count)} / ชิ้น` : "ต้นทุนเฉลี่ย: - / ชิ้น";
}

$("totalCost").addEventListener("input", updateAvgCost);
$("totalItems").addEventListener("input", updateAvgCost);
setDefaultPurchaseDate();

$("lotForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    lot_name: $("lotName").value.trim(),
    purchase_date: $("purchaseDate").value,
    source: $("source").value.trim(),
    total_cost: Number($("totalCost").value),
    total_items: Number($("totalItems").value),
    note: $("note").value.trim(),
  };
  if (payload.total_items < 0 || payload.total_cost < 0) return showToast("ต้นทุน/จำนวนไม่ถูกต้อง");

  const query = editingLotId
    ? supabaseClient.from("lots").update(payload).eq("id", editingLotId)
    : supabaseClient.from("lots").insert(payload);
  const { error } = await query;
  if (error) return showToast("บันทึกไม่สำเร็จ: " + error.message);

  showToast(editingLotId ? "แก้ไขล็อตเรียบร้อย" : "สร้างล็อตเรียบร้อย");
  exitEditMode();
  await loadLots();
});

$("cancelLotEdit").addEventListener("click", exitEditMode);
function exitEditMode() {
  editingLotId = null;
  $("lotForm").reset();
  setDefaultPurchaseDate();
  updateAvgCost();
  $("lotFormTitle").textContent = "เพิ่มล็อตใหม่";
  $("lotSubmitBtn").textContent = "บันทึกล๊อต";
  $("cancelLotEdit").classList.add("hidden");
}

function enterEditMode(lot) {
  editingLotId = lot.id;
  $("lotName").value = lot.lot_name || "";
  $("purchaseDate").value = lot.purchase_date || "";
  $("source").value = lot.source || "";
  $("totalCost").value = lot.total_cost ?? 0;
  $("totalItems").value = lot.total_items ?? 0;
  $("note").value = lot.note || "";
  $("lotFormTitle").textContent = "แก้ไขล็อต";
  $("lotSubmitBtn").textContent = "บันทึกการแก้ไข";
  $("cancelLotEdit").classList.remove("hidden");
  updateAvgCost();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadLots() {
  const { data, error } = await supabaseClient.from("lots").select("*").order("purchase_date", { ascending: false });
  if (error) {
    console.error(error);
    $("lotList").innerHTML = `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</div>`;
    return;
  }
  lotsCache = data || [];
  if (!lotsCache.length) {
    $("lotList").innerHTML = `<div class="empty-state">ยังไม่มีล็อต เพิ่มล็อตแรกด้านบนได้เลย</div>`;
    return;
  }
  const lotIds = lotsCache.map(l => l.id);
  const [groupsR, itemsR, salesR] = await Promise.all([
    supabaseClient.from("lot_groups").select("*").in("lot_id", lotIds).order("sort_order").order("created_at"),
    supabaseClient.from("items").select("id,lot_id,status,cost_price,current_price" ).in("lot_id", lotIds),
    supabaseClient.from("sales").select("item_id,sale_price,cost_price,sale_date").order("sale_date", { ascending: false })
  ]);
  if (groupsR.error || itemsR.error || salesR.error) console.warn(groupsR.error || itemsR.error || salesR.error);
  const groupsByLot = {};
  (groupsR.data || []).forEach(g => (groupsByLot[g.lot_id] ||= []).push(g));
  const items = itemsR.data || [];
  const itemById = Object.fromEntries(items.map(i => [i.id, i]));
  const statsByLot = {};
  lotsCache.forEach(l => statsByLot[l.id] = { total: 0, available: 0, sold: 0, damaged: 0, revenue: 0, profit: 0, stockCost: 0 });
  items.forEach(i => {
    const s = statsByLot[i.lot_id]; if (!s) return;
    s.total++;
    s[i.status] = (s[i.status] || 0) + 1;
    if (i.status === "available") s.stockCost += Number(i.cost_price || 0);
  });
  (salesR.data || []).forEach(s => {
    const i = itemById[s.item_id]; const st = i && statsByLot[i.lot_id]; if (!st) return;
    st.revenue += Number(s.sale_price || 0);
    st.profit += Number(s.sale_price || 0) - Number(s.cost_price || i.cost_price || 0);
  });

  $("lotList").innerHTML = lotsCache.map(lot => {
    const avg = Number(lot.total_items) > 0 ? Number(lot.total_cost) / Number(lot.total_items) : 0;
    const st = statsByLot[lot.id] || {};
    const groups = groupsByLot[lot.id] || [];
    return `<div class="tag-card lot-card">
      <div class="lot-row">
        <div class="lot-title-block"><div class="lot-name">${escapeHtml(lot.lot_name)}</div><div class="lot-meta">${formatDate(lot.purchase_date)}${lot.source ? " · " + escapeHtml(lot.source) : ""}</div></div>
        <div class="lot-summary"><div class="lot-cost">${formatBaht(lot.total_cost)}</div><div class="lot-meta">${lot.total_items} ชิ้น · เฉลี่ย ${formatBaht(avg)}/ชิ้น</div></div>
      </div>
      <div class="lot-metrics">
        <div><b>${st.total || 0}</b><span>ลงสินค้า</span></div><div><b>${st.available || 0}</b><span>พร้อมขาย</span></div><div><b>${st.sold || 0}</b><span>ขายแล้ว</span></div><div><b>${formatBaht(st.profit || 0)}</b><span>กำไรจากการขาย</span></div>
      </div>
      <div class="group-preview"><div class="group-preview-head"><b>กลุ่มคัด ${groups.length ? `(${groups.length})` : ""}</b><button class="btn btn-primary btn-sm" data-action="groups" data-id="${lot.id}">จัดกลุ่ม / แก้ไข</button></div>
        ${groups.length ? `<div class="group-chip-list">${groups.map(g => `<span class="group-chip"><b>${escapeHtml(g.group_name)}</b><small>${g.tier === "head" ? "งานหัว" : "ปกติ"} · ${formatBaht(g.base_price)}</small></span>`).join("")}</div>` : `<div class="empty-inline">ยังไม่มีกลุ่ม — กด “จัดกลุ่ม / แก้ไข” เพื่อสร้างกลุ่มเฉพาะ Lot นี้</div>`}
      </div>
      ${lot.note ? `<div class="lot-note">${escapeHtml(lot.note)}</div>` : ""}
      <div class="item-actions"><a class="btn btn-ghost btn-sm" href="items.html?lot=${encodeURIComponent(lot.id)}">ดูสินค้าใน Lot</a><button class="btn btn-ghost btn-sm" data-action="edit" data-id="${lot.id}">แก้ไข Lot</button><button class="btn btn-danger btn-sm" data-action="delete" data-id="${lot.id}">ลบ</button></div>
    </div>`;
  }).join("");

  document.querySelectorAll('[data-action="edit"]').forEach(btn => btn.addEventListener("click", () => {
    const lot = lotsCache.find(l => l.id === btn.dataset.id); if (lot) enterEditMode(lot);
  }));
  document.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener("click", () => handleDelete(btn.dataset.id)));
  document.querySelectorAll('[data-action="groups"]').forEach(btn => btn.addEventListener("click", () => openGroupManager(btn.dataset.id)));
}

async function handleDelete(lotId) {
  const lot = lotsCache.find(l => l.id === lotId);
  if (!lot) return;
  const ok = confirm(`ลบล็อต “${lot.lot_name}” ใช่ไหม?\n\nสินค้าที่เคยอยู่ในล็อตจะยังอยู่ แต่ lot_id จะถูกตัดออก และกลุ่มของล็อตจะถูกลบ`);
  if (!ok) return;
  const { error } = await supabaseClient.from("lots").delete().eq("id", lotId);
  if (error) return showToast("ลบไม่สำเร็จ: " + error.message);
  showToast("ลบล็อตเรียบร้อย");
  if (editingLotId === lotId) exitEditMode();
  loadLots();
}

async function openGroupManager(lotId) {
  activeLotId = lotId;
  const lot = lotsCache.find(l => l.id === lotId); if (!lot) return;
  $("groupModalTitle").textContent = `กลุ่มคัด: ${lot.lot_name}`;
  $("groupModalMeta").textContent = `${lot.total_items} ชิ้น · ต้นทุนเฉลี่ย ${formatBaht(Number(lot.total_items) ? Number(lot.total_cost) / Number(lot.total_items) : 0)} / ชิ้น`;
  $("groupModal").classList.remove("hidden");
  $("groupModal").setAttribute("aria-hidden", "false");
  resetGroupForm();
  await loadGroupsForLot();
}

async function loadGroupsForLot() {
  if (!activeLotId) return;
  const { data, error } = await supabaseClient.from("lot_groups").select("*").eq("lot_id", activeLotId).order("sort_order").order("created_at");
  if (error) return showToast("โหลดกลุ่มไม่สำเร็จ: " + error.message);
  activeGroups = data || [];
  const { data: items, error: itemErr } = await supabaseClient.from("items").select("group_id,status").eq("lot_id", activeLotId);
  if (itemErr) console.warn(itemErr);
  const countByGroup = {};
  (items || []).forEach(i => { if (i.group_id) countByGroup[i.group_id] = (countByGroup[i.group_id] || 0) + 1; });
  $("groupSummary").innerHTML = activeGroups.length ? `<span>${activeGroups.length} กลุ่ม</span><span>${Object.values(countByGroup).reduce((a,b)=>a+b,0)} รายการถูกผูกกลุ่มแล้ว</span>` : `<span>ยังไม่มีกลุ่ม</span><span>สร้างกลุ่มเพื่อเริ่มคัดสินค้า</span>`;
  $("groupList").innerHTML = activeGroups.length ? activeGroups.map(g => `<div class="group-manage-row"><div><b>${escapeHtml(g.group_name)}</b><span>${g.tier === "head" ? "งานหัว / Premium" : "ปกติ"} · ราคาตั้งต้น ${formatBaht(g.base_price)} · ${countByGroup[g.id] || 0} รายการ</span></div><div class="group-row-actions"><button class="btn btn-ghost btn-sm" data-group-edit="${g.id}">แก้ไข</button><button class="btn btn-danger btn-sm" data-group-delete="${g.id}" ${countByGroup[g.id] ? "disabled title=\"กลุ่มนี้มีสินค้าอยู่\"" : ""}>ลบ</button></div></div>`).join("") : `<div class="empty-state">ยังไม่มีกลุ่ม</div>`;
  document.querySelectorAll("[data-group-edit]").forEach(btn => btn.addEventListener("click", () => editGroup(btn.dataset.groupEdit)));
  document.querySelectorAll("[data-group-delete]").forEach(btn => btn.addEventListener("click", () => deleteGroup(btn.dataset.groupDelete)));
}

function resetGroupForm() {
  $("groupId").value = ""; $("groupName").value = ""; $("groupBasePrice").value = ""; $("groupTier").value = "normal"; $("groupSortOrder").value = activeGroups.length || 0;
  $("groupSubmitBtn").textContent = "เพิ่มกลุ่ม"; $("cancelGroupEdit").classList.add("hidden");
}
function editGroup(id) {
  const g = activeGroups.find(x => x.id === id); if (!g) return;
  $("groupId").value = g.id; $("groupName").value = g.group_name; $("groupBasePrice").value = g.base_price; $("groupTier").value = g.tier; $("groupSortOrder").value = g.sort_order || 0;
  $("groupSubmitBtn").textContent = "บันทึกกลุ่ม"; $("cancelGroupEdit").classList.remove("hidden"); $("groupName").focus();
}
$("cancelGroupEdit").addEventListener("click", resetGroupForm);
$("groupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const payload = { lot_id: activeLotId, group_name: $("groupName").value.trim(), base_price: Number($("groupBasePrice").value || 0), tier: $("groupTier").value, sort_order: Number($("groupSortOrder").value || 0) };
  if (!payload.group_name) return showToast("กรุณาใส่ชื่อกลุ่ม");
  const id = $("groupId").value;
  const { error } = id ? await supabaseClient.from("lot_groups").update(payload).eq("id", id) : await supabaseClient.from("lot_groups").insert(payload);
  if (error) return showToast("บันทึกกลุ่มไม่สำเร็จ: " + error.message);
  showToast(id ? "แก้ไขกลุ่มแล้ว" : "เพิ่มกลุ่มแล้ว");
  resetGroupForm(); await loadGroupsForLot(); await loadLots();
});
async function deleteGroup(id) {
  const g = activeGroups.find(x => x.id === id); if (!g) return;
  if (!confirm(`ลบกลุ่ม “${g.group_name}” ใช่ไหม?`)) return;
  const { error } = await supabaseClient.from("lot_groups").delete().eq("id", id);
  if (error) return showToast("ลบกลุ่มไม่สำเร็จ: " + error.message);
  showToast("ลบกลุ่มแล้ว"); await loadGroupsForLot(); await loadLots();
}
function closeGroupModal() { $("groupModal").classList.add("hidden"); $("groupModal").setAttribute("aria-hidden", "true"); activeLotId = null; activeGroups = []; }
document.querySelectorAll("[data-close-group]").forEach(el => el.addEventListener("click", closeGroupModal));
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("groupModal").classList.contains("hidden")) closeGroupModal(); });

function showToast(msg) { const t = $("toast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(window.__toast); window.__toast = setTimeout(() => t.classList.remove("show"), 2600); }

loadLots();

// Realtime: Lot/Group ที่เพิ่มจากอีก Device จะปรากฏในหน้าปัจจุบันโดยไม่ต้อง Refresh
window.addEventListener('vims:realtime', (event) => {
  const table = event.detail?.table;
  if (['lots', 'lot_groups'].includes(table)) loadLots();
});
