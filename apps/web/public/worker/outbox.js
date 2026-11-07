// Shared by the worker page and the service worker. A shift has one receipt per browser.
const shadeDB = new Promise((resolve, reject) => {
  const request = indexedDB.open('heatline-shade', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('shifts', { keyPath: 'room' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function updateShift(room, change) {
  const db = await shadeDB;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shifts', 'readwrite');
    const store = tx.objectStore('shifts');
    const req = store.get(room);
    let state;
    req.onsuccess = () => {
      state = req.result || { room, receipt: crypto.randomUUID(), stage: 'choice', delivery: 'none' };
      change(state);
      store.put(state);
    };
    tx.oncomplete = () => resolve(state);
    tx.onabort = () => reject(tx.error);
  });
}

async function flushReceipts() {
  const db = await shadeDB;
  const shifts = await new Promise((resolve, reject) => {
    const req = db.transaction('shifts').objectStore('shifts').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  for (const shift of shifts.filter(s => s.delivery === 'pending')) {
    const response = await fetch('/api/shade', {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: {'Content-Type':'application/json', 'X-Heatline-Shift':shift.room},
      body: JSON.stringify({receipt:shift.receipt}), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok || !(await response.json()).received) throw new Error('Delivery pending');
    await updateShift(shift.room, state => { state.delivery = 'sent'; });
  }
}
