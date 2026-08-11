/* ==========================================================
   reports.js — รายงานยอดขาย/กำไร/เงินรับ
   Data flow:
   reports.html -> reports.js -> Supabase (sales, expenses, items, lots)
   หน้านี้เป็น read-only report: ไม่แก้ข้อมูลธุรกรรมโดยตรง
   ========================================================== */
const CHANNEL_LABELS = { street_market: "ถนนคนเดิน", facebook: "Facebook", instagram: "Instagram" };
function escapeHtml(v="") { return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c])); }
const TIER_LABELS = { normal: "ปกติ", head: "งานหัว / Premium" };
const today = new Date();
let currentPeriod = "day";

function formatBaht(value) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function formatDate(value) { return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function showToast(msg) { const t=document.getElementById("toast"); if(!t)return; t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2500); }
function percent(a,b) { return b ? (a/b)*100 : 0; }

/* ---------- ตั้งค่า date/month/year selector ---------- */
const pickDate = document.getElementById("pickDate");
pickDate.value = today.toISOString().slice(0,10);
const pickMonth = document.getElementById("pickMonth");
pickMonth.value = today.toISOString().slice(0,7);
const yearSelect = document.getElementById("pickYear");
for (let y=today.getFullYear(); y>=today.getFullYear()-5; y--) { const opt=document.createElement("option"); opt.value=y; opt.textContent=`พ.ศ. ${y+543}`; yearSelect.appendChild(opt); }
yearSelect.value = today.getFullYear();

document.querySelectorAll(".period-tab").forEach(tab=>tab.addEventListener("click",()=>{
  document.querySelectorAll(".period-tab").forEach(t=>t.classList.remove("active"));
  tab.classList.add("active"); currentPeriod=tab.dataset.period;
  document.getElementById("pickerDay").style.display=currentPeriod==="day"?"block":"none";
  document.getElementById("pickerMonth").style.display=currentPeriod==="month"?"block":"none";
  document.getElementById("pickerYear").style.display=currentPeriod==="year"?"block":"none";
  loadReport();
}));
pickDate.addEventListener("change",loadReport); pickMonth.addEventListener("change",loadReport); yearSelect.addEventListener("change",loadReport);

/* ---------- คำนวณช่วงเวลา ---------- */
function getMainRange() {
  if (currentPeriod === "day") { const d=pickDate.valueAsDate||today; const start=new Date(d.getFullYear(),d.getMonth(),d.getDate()); const end=new Date(start); end.setDate(end.getDate()+1); return {start,end}; }
  if (currentPeriod === "month") { const [y,m]=pickMonth.value.split("-").map(Number); return {start:new Date(y,m-1,1),end:new Date(y,m,1)}; }
  const y=Number(yearSelect.value); return {start:new Date(y,0,1),end:new Date(y+1,0,1)};
}

async function loadReport() {
  const {start,end}=getMainRange();
  try {
    /* Query ครั้งเดียวแล้วคำนวณหลายมุมใน browser เพื่อให้หน้า report ตอบสนองเร็ว */
    const [salesR, expensesR, itemsR, lotsR] = await Promise.all([
      supabaseClient.from("sales").select("id,item_id,sale_date,channel,sale_price,cost_price,payment_method,note,items(item_name,size,condition,tier)").gte("sale_date",start.toISOString()).lt("sale_date",end.toISOString()).order("sale_date",{ascending:false}),
      supabaseClient.from("expenses").select("id,expense_date,amount,category,note").gte("expense_date",start.toISOString().slice(0,10)).lte("expense_date",new Date(end.getTime()-86400000).toISOString().slice(0,10)),
      supabaseClient.from("items").select("id,item_name,size,condition,tier,lot_id"),
      supabaseClient.from("lots").select("id,lot_name,total_cost,total_items,purchase_date")
    ]);
    const err=salesR.error||expensesR.error||itemsR.error||lotsR.error; if(err) throw err;
    const sales=salesR.data||[], expenses=expensesR.data||[], items=itemsR.data||[], lots=lotsR.data||[];
    renderStats(sales,expenses); renderPaymentBreakdown(sales); renderChannelBreakdown(sales); renderTierBreakdown(sales,items); renderLotBreakdown(sales,items,lots); renderWeekendBreakdown(sales); renderSaleList(sales); await renderTrend(start,end);
  } catch(err) { console.error(err); showToast("โหลดรายงานไม่สำเร็จ: "+(err.message||err)); }
}

function renderStats(sales,expenses) {
  const revenue=sales.reduce((a,s)=>a+Number(s.sale_price||0),0); const cost=sales.reduce((a,s)=>a+Number(s.cost_price||0),0); const profit=revenue-cost; const expenseTotal=expenses.reduce((a,e)=>a+Number(e.amount||0),0); const net=profit-expenseTotal;
  document.getElementById("repRevenue").textContent=formatBaht(revenue); document.getElementById("repCost").textContent=formatBaht(cost); document.getElementById("repCount").textContent=`${sales.length} ชิ้น`; document.getElementById("repProfit").textContent=formatBaht(profit); document.getElementById("repExpenses").textContent=formatBaht(expenseTotal); document.getElementById("repNetProfit").textContent=formatBaht(net);
  ["repProfit","repNetProfit"].forEach(id=>{const el=document.getElementById(id);el.classList.remove("profit","loss");el.classList.add(Number(id==="repProfit"?profit:net)>=0?"profit":"loss");});
}
function renderPaymentBreakdown(sales) {
  const by={}; sales.forEach(s=>{by[s.payment_method] ||= {count:0,total:0};by[s.payment_method].count++;by[s.payment_method].total+=Number(s.sale_price||0);});
  const rows=Object.keys(by).length?Object.entries(by).map(([k,v])=>`<tr><td>${PAYMENT_LABELS[k]||k}</td><td style="text-align:right">${v.count}</td><td style="text-align:right">${formatBaht(v.total)}</td></tr>`).join(""):"<tr><td colspan=3 class=empty-state>ไม่มีรายการขาย</td></tr>";
  document.getElementById("repPaymentBreakdown").innerHTML=rows;
}
function renderChannelBreakdown(sales) {
  const by={}; sales.forEach(s=>{const k=s.channel||"other";by[k] ||= {count:0,revenue:0,profit:0};by[k].count++;by[k].revenue+=Number(s.sale_price||0);by[k].profit+=Number(s.sale_price||0)-Number(s.cost_price||0);});
  document.getElementById("repChannelBreakdown").innerHTML=Object.keys(by).length?Object.entries(by).sort((a,b)=>b[1].revenue-a[1].revenue).map(([k,v])=>`<tr><td>${CHANNEL_LABELS[k]||k}</td><td style="text-align:right">${v.count}</td><td style="text-align:right">${formatBaht(v.revenue)}</td><td style="text-align:right" class="${v.profit>=0?'profit':'loss'}">${formatBaht(v.profit)}</td></tr>`).join(""):"<tr><td colspan=4 class=empty-state>ไม่มีรายการขาย</td></tr>";
}
function renderTierBreakdown(sales,items) {
  const by={normal:{count:0,revenue:0,profit:0},head:{count:0,revenue:0,profit:0}}; const map=Object.fromEntries(items.map(i=>[i.id,i]));
  sales.forEach(s=>{const k=map[s.item_id]?.tier==="head"?"head":"normal";by[k].count++;by[k].revenue+=Number(s.sale_price||0);by[k].profit+=Number(s.sale_price||0)-Number(s.cost_price||0);});
  document.getElementById("repTierBreakdown").innerHTML=Object.entries(by).map(([k,v])=>`<tr><td>${TIER_LABELS[k]}</td><td style="text-align:right">${v.count}</td><td style="text-align:right">${formatBaht(v.revenue)}</td><td style="text-align:right" class="${v.profit>=0?'profit':'loss'}">${formatBaht(v.profit)}</td></tr>`).join("");
}
function renderLotBreakdown(sales,items,lots) {
  const map=Object.fromEntries(items.map(i=>[i.id,i])); const by=Object.fromEntries(lots.map(l=>[l.id,{lot:l,sold:0,revenue:0,profit:0}]));
  sales.forEach(s=>{const i=map[s.item_id],r=i&&by[i.lot_id];if(!r)return;r.sold++;r.revenue+=Number(s.sale_price||0);r.profit+=Number(s.sale_price||0)-Number(s.cost_price||0);});
  const rows=Object.values(by).filter(x=>x.sold).sort((a,b)=>b.profit-a.profit); document.getElementById("repLotBreakdown").innerHTML=rows.length?rows.map(x=>`<tr><td><b>${x.lot.lot_name}</b><small class="table-sub">${x.lot.total_items} ชิ้น · ${x.sold} ขาย</small></td><td style="text-align:right">${formatBaht(x.lot.total_cost)}</td><td style="text-align:right">${x.sold}</td><td style="text-align:right">${formatBaht(x.revenue)}</td><td style="text-align:right" class="${x.profit>=0?'profit':'loss'}">${formatBaht(x.profit)}</td><td style="text-align:right">${percent(x.profit,x.lot.total_cost).toFixed(1)}%</td></tr>`).join(""):"<tr><td colspan=6 class=empty-state>ไม่มีรายการขาย</td></tr>";
}
function renderWeekendBreakdown(sales) {
  const by={6:{label:"เสาร์",count:0,revenue:0,profit:0},0:{label:"อาทิตย์",count:0,revenue:0,profit:0}};
  sales.filter(s=>s.channel==="street_market").forEach(s=>{const k=new Date(s.sale_date).getDay();if(!by[k])return;by[k].count++;by[k].revenue+=Number(s.sale_price||0);by[k].profit+=Number(s.sale_price||0)-Number(s.cost_price||0);});
  document.getElementById("repWeekendBreakdown").innerHTML=[6,0].map(k=>{const v=by[k];return `<div class="weekend-report-card"><span>${v.label}</span><b>${formatBaht(v.revenue)}</b><small>${v.count} ชิ้น · กำไร ${formatBaht(v.profit)}</small></div>`;}).join("");
}
function renderSaleList(sales) {
  document.getElementById("repSaleList").innerHTML=sales.length?sales.map(s=>`<div class="sale-row"><div><div class="sale-name">${escapeHtml(s.items?.item_name||"สินค้า")}</div><div class="sale-meta">${formatDate(s.sale_date)} · ${PAYMENT_LABELS[s.payment_method]||s.payment_method} · ${CHANNEL_LABELS[s.channel]||s.channel||"-"}</div></div><div class="sale-price">${formatBaht(s.sale_price)}</div></div>`).join(""):"<div class=empty-state>ไม่มีรายการขายในช่วงนี้</div>";
}
async function renderTrend(start,end) {
  const title=document.getElementById("repTrendTitle"),col=document.getElementById("repTrendCol1"); let trendStart=new Date(start),trendEnd=new Date(end),labelFn;
  if(currentPeriod==="day"){title.textContent="แนวโน้ม 7 วันล่าสุด";col.textContent="วันที่";trendStart.setDate(trendStart.getDate()-6);labelFn=d=>formatDate(d).split(" ").slice(0,2).join(" ");}
  else if(currentPeriod==="month"){title.textContent="แนวโน้มรายวันในเดือนนี้";col.textContent="วันที่";labelFn=d=>formatDate(d).split(" ").slice(0,2).join(" ");}
  else {title.textContent="แนวโน้มรายเดือนในปีนี้";col.textContent="เดือน";labelFn=d=>new Intl.DateTimeFormat("th-TH",{month:"short"}).format(d);}
  const {data,error}=await supabaseClient.from("sales").select("sale_date,sale_price,cost_price").gte("sale_date",trendStart.toISOString()).lt("sale_date",trendEnd.toISOString()); if(error){console.error(error);return;}
  const buckets={}; data.forEach(s=>{const d=new Date(s.sale_date);const key=currentPeriod==="year"?`${d.getFullYear()}-${d.getMonth()}`:d.toDateString();buckets[key] ||= {count:0,revenue:0,profit:0,label:labelFn(d)};buckets[key].count++;buckets[key].revenue+=Number(s.sale_price||0);buckets[key].profit+=Number(s.sale_price||0)-Number(s.cost_price||0);});
  const rows=Object.values(buckets); document.getElementById("repTrendBody").innerHTML=rows.length?rows.sort((a,b)=>a.label<b.label?1:-1).map(r=>`<tr><td>${r.label}</td><td style="text-align:right">${r.count}</td><td style="text-align:right">${formatBaht(r.revenue)}</td><td style="text-align:right" class="${r.profit>=0?'profit':'loss'}">${formatBaht(r.profit)}</td></tr>`).join(""):"<tr><td colspan=4 class=empty-state>ยังไม่มีรายการขาย</td></tr>";
}

loadReport();

// Realtime: รายงานจะโหลดข้อมูลใหม่เมื่อยอดขาย/ค่าใช้จ่าย/สินค้าเปลี่ยนจาก Device อื่น
window.addEventListener('vims:realtime', (event) => {
  if (['sales', 'expenses', 'items', 'lots'].includes(event.detail?.table)) loadReport();
});
