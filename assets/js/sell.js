let inStockItems = [];

async function loadSellGrid() {
  const { data: items, error } = await supabaseClient
    .from("items")
    .select("*")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById("sellGrid").innerHTML = `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ</div>`;
    return;
  }

  inStockItems = items;
  renderGrid(items);
}

function renderGrid(items) {
  if (!items.length) {
    document.getElementById("sellGrid").innerHTML = `<div class="empty-state">ไม่มีของในสต็อกให้ขาย</div>`;
    return;
  }

  const html = items
    .map(
      (item) => `
      <button class="item-tile" data-id="${item.id}">
        <div class="name">${item.item_name}</div>
        <div class="meta">${item.size || ""} ${item.condition ? "· " + item.condition : ""}</div>
        <div class="price">${formatBaht(item.sell_price)}</div>
      </button>`
    )
    .join("");

  document.getElementById("sellGrid").innerHTML = html;

  document.querySelectorAll(".item-tile").forEach((tile) => {
    tile.addEventListener("click", () => openSellModal(tile.dataset.id));
  });
}

document.getElementById("searchBox").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = inStockItems.filter((i) => i.item_name.toLowerCase().includes(q));
  renderGrid(filtered);
});

function openSellModal(itemId) {
  const item = inStockItems.find((i) => i.id === itemId);
  if (!item) return;

  document.getElementById("modalItemId").value = item.id;
  document.getElementById("modalItemName").textContent = item.item_name;
  document.getElementById("modalItemMeta").textContent =
    `${item.size || ""} ${item.condition ? "· " + item.condition : ""} · ต้นทุน ${formatBaht(item.cost_price)}`;
  document.getElementById("salePrice").value = item.sell_price;
  document.getElementById("sellModal").classList.remove("hidden");
}

document.getElementById("cancelSell").addEventListener("click", () => {
  document.getElementById("sellModal").classList.add("hidden");
});

document.getElementById("sellForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const itemId = document.getElementById("modalItemId").value;
  const item = inStockItems.find((i) => i.id === itemId);
  if (!item) return;
  const salePrice = Number(document.getElementById("salePrice").value);
  const paymentMethod = document.getElementById("paymentMethod").value;
  const channel = document.getElementById("channel").value;
  if (salePrice < 0) return;

  const { error } = await supabaseClient.rpc("sell_item", {
    p_item_id: item.id,
    p_sale_price: salePrice,
    p_payment_method: paymentMethod,
    p_channel: channel,
    p_note: null
  });
  if (error) {
    console.error(error);
    showToast("บันทึกการขายไม่สำเร็จ: " + error.message);
    return;
  }
  document.getElementById("sellModal").classList.add("hidden");
  showToast(`ขาย "${item.item_name}" สำเร็จ`);
  loadSellGrid();
});

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

loadSellGrid();
