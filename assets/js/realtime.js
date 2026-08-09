/* ==========================================================
   realtime.js — ชั้นกลางสำหรับ Sync ทุกอุปกรณ์
   Flow: Supabase Realtime → event ของ table → reload function ของหน้าปัจจุบัน
   ใช้กับมือถือ 1, มือถือ 2, iPad และ Computer ได้เหมือนกัน
   ไม่มีการแบ่ง Permission; ทุกอุปกรณ์ใช้ฐานข้อมูลเดียวกัน
   ========================================================== */

(function () {
  // แสดงสถานะออนไลน์/Realtime ให้ผู้ใช้รู้ทันทีว่าเครื่องกำลังเชื่อมกับฐานข้อมูลหรือไม่
  function ensureSyncIndicator() {
    if (document.getElementById('syncIndicator')) return;
    const el = document.createElement('div');
    el.id = 'syncIndicator';
    el.className = 'sync-indicator sync-connecting';
    el.innerHTML = '<span class="sync-dot"></span><span class="sync-text">กำลังเชื่อมต่อ…</span>';
    document.body.appendChild(el);
  }

  // เปลี่ยนข้อความสถานะของ Sync และเก็บเวลาที่ Sync สำเร็จล่าสุดไว้ให้ดูได้
  function setSyncStatus(state, text) {
    const el = document.getElementById('syncIndicator');
    if (!el) return;
    el.className = `sync-indicator sync-${state}`;
    const textEl = el.querySelector('.sync-text');
    if (textEl) textEl.textContent = text;
  }

  // เมื่อออนไลน์/ออฟไลน์เปลี่ยน จะอัปเดต UI ทันทีและไม่หลอกผู้ใช้ว่าข้อมูลถูกส่งแล้ว
  function updateNetworkState() {
    if (navigator.onLine) setSyncStatus('online', 'ออนไลน์ · Sync พร้อม');
    else setSyncStatus('offline', 'ออฟไลน์ · ยังไม่ Sync');
  }

  // เรียก reload ของหน้าปัจจุบันแบบ debounce เพื่อไม่ให้ Realtime หลาย event ยิง query ซ้อนกัน
  function scheduleReload(reloadFn) {
    clearTimeout(window.__vimsRealtimeReloadTimer);
    window.__vimsRealtimeReloadTimer = setTimeout(() => {
      if (typeof reloadFn !== 'function' || !navigator.onLine) return;
      reloadFn();
      setSyncStatus('online', `Sync ล่าสุด ${new Date().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}`);
    }, 250);
  }

  // ผูก table กับ callback ที่ต้อง refresh เมื่อข้อมูลใน Supabase เปลี่ยนจากอุปกรณ์ใดก็ตาม
  function subscribeTable(table, reloadFn) {
    return supabaseClient
      .channel(`vims2:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => scheduleReload(reloadFn))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncStatus('online', 'ออนไลน์ · Realtime พร้อม');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncStatus('offline', 'Realtime ขัดข้อง · ตรวจอินเทอร์เน็ต');
      });
  }

  // เลือกเฉพาะ table ที่เกี่ยวข้องกับหน้า เพื่อลดจำนวน realtime event ที่แต่ละเครื่องต้องรับ
  function startPageSubscriptions() {
    const page = location.pathname.split('/').pop() || 'index.html';
    const reload = (name) => typeof window[name] === 'function' ? window[name] : null;
    const subscriptions = {
      'index.html': [['items', () => { dashboardRows = null; loadDashboard(rangeFromPreset(activeRange)); }], ['sales', () => { dashboardRows = null; loadDashboard(rangeFromPreset(activeRange)); }], ['expenses', () => { dashboardRows = null; loadDashboard(rangeFromPreset(activeRange)); }], ['lots', () => { dashboardRows = null; loadDashboard(rangeFromPreset(activeRange)); }]],
      'lots.html': [['lots', reload('loadLots')], ['lot_groups', reload('loadLots')], ['items', reload('loadLots')], ['sales', reload('loadLots')]],
      'items.html': [['lots', reload('loadLots')], ['lot_groups', reload('loadLots')], ['items', reload('loadItems')], ['item_images', reload('loadItems')], ['item_change_history', reload('loadItems')]],
      'sell.html': [['items', reload('loadSellGrid')], ['item_images', reload('loadSellGrid')], ['sales', reload('loadSellGrid')]],
      'reports.html': [['sales', reload('loadReport')], ['expenses', reload('loadReport')], ['items', reload('loadReport')], ['lots', reload('loadReport')]],
      'accounting.html': [['lots', reload('loadAll')], ['sales', reload('loadAll')], ['expenses', reload('loadAll')], ['app_settings', reload('loadAll')]],
    };

    (subscriptions[page] || []).forEach(([table, fn]) => {
      if (fn) subscribeTable(table, fn);
    });
  }

  // เริ่มระบบ Sync หลัง DOM พร้อม เพื่อให้ indicator ถูกสร้างก่อน subscribe
  function initRealtimeSync() {
    ensureSyncIndicator();
    updateNetworkState();
    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);
    startPageSubscriptions();
  }

  window.VIMSRealtime = { initRealtimeSync, setSyncStatus };
  initRealtimeSync();
})();
