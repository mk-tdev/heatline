function shiftRoom() {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let previous;
  try { previous = localStorage.getItem('heatline.activeShift'); } catch {}
  const fragment = location.hash.slice(1);
  const room = uuid.test(fragment) ? fragment : uuid.test(previous) ? previous : crypto.randomUUID();
  history.replaceState(null, '', '#' + room);
  try { localStorage.setItem('heatline.activeShift', room); } catch {}
  return room;
}
