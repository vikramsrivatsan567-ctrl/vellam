// An anonymous ID for this browser, so one person's repeat reports
// of the same street count once. No personal data is stored.
const KEY = "vellam-device-id";

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let memoryId = null;

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = makeId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId = memoryId || makeId();
    return memoryId;
  }
}
