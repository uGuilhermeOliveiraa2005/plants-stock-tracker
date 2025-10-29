// --- Cérebro Padrão (Worker) ---
// (Usado pelo iOS/Safari)

let hasCheckedInitialStock = false;
let selectedItems = new Set();
let loopTimer = null;
let isFetching = false;

const RETRY_ON_ERROR_MS = 60000;
const API_BUFFER_MS = 10000;

async function checkAndNotify() {
  if (isFetching) return;
  isFetching = true;

  if (loopTimer) clearTimeout(loopTimer);
  let nextDelay = RETRY_ON_ERROR_MS;

  try {
    const response = await fetch("/api/stock");
    if (!response.ok) throw new Error("Worker: Falha ao buscar estoque");
    const data = await response.json();

    const stockedItems = [
      ...data.seeds.map((s) => s.name),
      ...data.gear.map((g) => g.name),
    ];
    const matches = stockedItems.filter((item) => selectedItems.has(item));

    if (matches.length > 0 && selectedItems.size > 0 && hasCheckedInitialStock) {
      postMessage({ type: 'notify', payload: matches });
    }

    hasCheckedInitialStock = true;
    const timeUntilNextUpdate = (data.nextUpdateAt + API_BUFFER_MS) - Date.now();
    nextDelay = Math.max(timeUntilNextUpdate, 30000); 

  } catch (error) {
    console.error("Worker Error:", error);
    nextDelay = RETRY_ON_ERROR_MS;
  } finally {
    isFetching = false;
    loopTimer = setTimeout(checkAndNotify, nextDelay);
  }
}

onmessage = (e) => {
  const { type, payload } = e.data;
  if (type === 'updateSelection') {
    selectedItems = new Set(payload);
    console.log('Worker: Seleção atualizada.', selectedItems);
    if (!hasCheckedInitialStock) {
      checkAndNotify();
    }
  }
};