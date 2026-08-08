let currentPeriod = "day";

/* ---------- ตั้งค่าเริ่มต้นของตัวเลือกวันที่ ---------- */
const today = new Date();

document.getElementById("pickDate").valueAsDate = today;

const monthInput = document.getElementById("pickMonth");
monthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

const yearSelect = document.getElementById("pickYear");
const thisYear = today.getFullYear();
for (let y = thisYear; y >= thisYear - 5; y--) {
  const opt = document.createElement("option");
  opt.value = y;
  opt.textContent = `พ.ศ. ${y + 543}`;
  yearSelect.appendChild(opt);
}

/* ---------- สลับแท็บ วัน/เดือน/ปี ---------- */
document.querySelectorAll(".period-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".period-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentPeriod = tab.dataset.period;

    document.getElementById("pickerDay").style.display = currentPeriod === "day" ? "block" : "none";
    document.getElementById("pickerMonth").style.display = currentPeriod === "month" ? "block" : "none";
    document.getElementById("pickerYear").style.display = currentPeriod === "year" ? "block" : "none";

    loadReport();
  });
});

document.getElementById("pickDate").addEventListener("change", loadReport);
document.getElementById("pickMonth").addEventListener("change", loadReport);
document.getElementById("pickYear").addEventListener("change", loadReport);

/* ---------- คำนวณช่วงเวลา (start รวม, end ไม่รวม) ---------- */
function getMainRange() {
  if (currentPeriod === "day") {
    const d = document.getElementById("pickDate").valueAsDate || today;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (currentPeriod === "month") {
    const [y, m] = document.getElementById("pickMonth").value.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start, end };
  }
  // year
  const y = Number(document.getElementById("pickYear").value);
  const start = new Date(y, 0, 1);
  const end = new Date(y + 1, 0, 1);
  return { start, end };
}

/* ---------- โหลดและแสดงผลรายงาน ---------- */
async function loadReport() {
  const { start, end } = getMainRange();

  const { data: sales, error } = await supabaseClient
    .from("sales")
    .select("*, items(item_name, size, condition)")
    .gte("sale_date", start.toISOString())
    .lt("sale_date", end.toISOString())
    .order("sale_date", { ascending: false });

  if (error) {
    console.error(error);
    showToast("โหลดรายงานไม่สำเร็จ: " + error.message);
    return;
  }

  renderStats(sales);
  renderPaymentBreakdown(sales);
  renderSaleList(sales);
  await renderTrend(start, end);
}

function renderStats(sales) {
  const revenue = sales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0);
  const cost = sales.reduce((sum, s) => sum + Number(s.cost_price || 0), 0);
  const profit = revenue - cost;

  document.getElementById("repRevenue").textContent = formatBaht(revenue);
  document.getElementById("repCost").textContent = formatBaht(cost);
  document.getElementById("repCount").textContent = `${sales.length} ชิ้น`;

  const profitEl = document.getElementById("repProfit");
  profitEl.textContent = formatBaht(profit);
  profitEl.classList.remove("profit", "loss");
  profitEl.classList.add(profit >= 0 ? "profit" : "loss");
}

function renderPaymentBreakdown(sales) {
  const byPayment = {};
  sales.forEach((s) => {
    if (!byPayment[s.payment_method]) byPayment[s.payment_method] = { count: 0, total: 0 };
    byPayment[s.payment_method].count += 1;
    byPayment[s.payment_method].total += Number(s.sale_price || 0);
  });

  const rows = Object.keys(byPayment).length
    ? Object.entries(byPayment)
        .map(
          ([method, v]) =>
            `<tr><td>${PAYMENT_LABELS[method] || method}</td><td style="text-align:right">${v.count}</td><td style="text-align:right">${formatBaht(v.total)}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="empty-state">ไม่มีรายการขายในช่วงนี้</td></tr>`;

  document.getElementById("repPaymentBreakdown").innerHTML = rows;
}

function renderSaleList(sales) {
  if (!sales.length) {
    document.getElementById("repSaleList").innerHTML = `<div class="empty-state">ไม่มีรายการขายในช่วงนี้</div>`;
    return;
  }

  const html = sales
    .map((s) => {
      const name = s.items ? s.items.item_name : "(ไม่พบข้อมูลสินค้า)";
      const meta = s.items ? `${s.items.size || ""} ${s.items.condition ? "· " + s.items.condition : ""}` : "";
      return `
      <div class="sale-row">
        <div>
          <div class="sale-name">${name}</div>
          <div class="sale-meta">${formatDate(s.sale_date)} · ${PAYMENT_LABELS[s.payment_method] || s.payment_method} ${meta}</div>
        </div>
        <div class="sale-price">${formatBaht(s.sale_price)}</div>
      </div>`;
    })
    .join("");

  document.getElementById("repSaleList").innerHTML = html;
}

/* ---------- ตารางแนวโน้ม: ปรับตามช่วงที่เลือก ---------- */
async function renderTrend(mainStart, mainEnd) {
  const titleEl = document.getElementById("repTrendTitle");
  const col1El = document.getElementById("repTrendCol1");

  if (currentPeriod === "day") {
    titleEl.textContent = "แนวโน้ม 7 วันล่าสุด";
    col1El.textContent = "วันที่";
    const trendStart = new Date(mainStart);
    trendStart.setDate(trendStart.getDate() - 6);
    const { data, error } = await supabaseClient
      .from("sales")
      .select("sale_date, sale_price, cost_price")
      .gte("sale_date", trendStart.toISOString())
      .lt("sale_date", mainEnd.toISOString());
    if (error) { console.error(error); return; }

    const buckets = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(trendStart);
      d.setDate(d.getDate() + i);
      buckets[d.toDateString()] = { count: 0, revenue: 0, profit: 0, label: formatDate(d) };
    }
    data.forEach((s) => {
      const key = new Date(s.sale_date).toDateString();
      if (!buckets[key]) return;
      buckets[key].count += 1;
      buckets[key].revenue += Number(s.sale_price || 0);
      buckets[key].profit += Number(s.sale_price || 0) - Number(s.cost_price || 0);
    });
    renderTrendRows(Object.values(buckets));
    return;
  }

  if (currentPeriod === "month") {
    titleEl.textContent = "แนวโน้มรายวันในเดือนนี้";
    col1El.textContent = "วันที่";
    const { data, error } = await supabaseClient
      .from("sales")
      .select("sale_date, sale_price, cost_price")
      .gte("sale_date", mainStart.toISOString())
      .lt("sale_date", mainEnd.toISOString());
    if (error) { console.error(error); return; }

    const buckets = {};
    data.forEach((s) => {
      const d = new Date(s.sale_date);
      const key = d.toDateString();
      if (!buckets[key]) buckets[key] = { count: 0, revenue: 0, profit: 0, label: formatDate(d) };
      buckets[key].count += 1;
      buckets[key].revenue += Number(s.sale_price || 0);
      buckets[key].profit += Number(s.sale_price || 0) - Number(s.cost_price || 0);
    });
    const rows = Object.values(buckets).sort((a, b) => (a.label < b.label ? 1 : -1));
    renderTrendRows(rows, "ยังไม่มีรายการขายในเดือนนี้");
    return;
  }

  // year
  titleEl.textContent = "แนวโน้มรายเดือนในปีนี้";
  col1El.textContent = "เดือน";
  const { data, error } = await supabaseClient
    .from("sales")
    .select("sale_date, sale_price, cost_price")
    .gte("sale_date", mainStart.toISOString())
    .lt("sale_date", mainEnd.toISOString());
  if (error) { console.error(error); return; }

  const monthNames = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const buckets = {};
  data.forEach((s) => {
    const d = new Date(s.sale_date);
    const key = d.getMonth();
    if (!buckets[key]) buckets[key] = { count: 0, revenue: 0, profit: 0, label: monthNames[key] };
    buckets[key].count += 1;
    buckets[key].revenue += Number(s.sale_price || 0);
    buckets[key].profit += Number(s.sale_price || 0) - Number(s.cost_price || 0);
  });
  const rows = Object.keys(buckets)
    .sort((a, b) => a - b)
    .map((k) => buckets[k]);
  renderTrendRows(rows, "ยังไม่มีรายการขายในปีนี้");
}

function renderTrendRows(rows, emptyMsg) {
  const withSales = rows.filter((r) => r.count > 0);
  if (!withSales.length) {
    document.getElementById("repTrendBody").innerHTML = `<tr><td colspan="4" class="empty-state">${emptyMsg || "ไม่มีข้อมูล"}</td></tr>`;
    return;
  }
  const html = withSales
    .map((r) => {
      const profitClass = r.profit >= 0 ? "profit" : "loss";
      return `<tr><td>${r.label}</td><td style="text-align:right">${r.count}</td><td style="text-align:right">${formatBaht(r.revenue)}</td><td style="text-align:right" class="${profitClass}">${formatBaht(r.profit)}</td></tr>`;
    })
    .join("");
  document.getElementById("repTrendBody").innerHTML = html;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

loadReport();
