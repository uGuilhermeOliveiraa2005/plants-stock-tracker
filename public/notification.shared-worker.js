// --- Cérebro Premium (SharedWorker) ---
// (Usado por Chrome/PC/Android)

let hasCheckedInitialStock = false;
let selectedItems = new Set();
let loopTimer = null;
let isFetching = false;
let ports = [];

const RETRY_ON_ERROR_MS = 60000;
const API_BUFFER_MS = 10000; // 10s de buffer

async function checkAndNotify() {
  if (isFetching) return;
  isFetching = true;

  let nextDelay = RETRY_ON_ERROR_MS;

  try {
    const response = await fetch("/api/stock");
    if (!response.ok) throw new Error("SharedWorker: Falha ao buscar estoque");
    const data = await response.json();

    const stockedItems = [
      ...data.seeds.map((s) => s.name),
      ...data.gear.map((g) => g.name),
    ];
    const matches = stockedItems.filter((item) => selectedItems.has(item));

    if (matches.length > 0 && selectedItems.size > 0 && hasCheckedInitialStock) {
      ports.forEach(port => {
        port.postMessage({ type: 'notify', payload: matches });
      });
    }

    hasCheckedInitialStock = true;
    const timeUntilNextUpdate = (data.nextUpdateAt + API_BUFFER_MS) - Date.now();
    nextDelay = Math.max(timeUntilNextUpdate, 30000); 

  } catch (error) {
    console.error("SharedWorker Error:", error);
    nextDelay = RETRY_ON_ERROR_MS;
  } finally {
    isFetching = false;
    if (loopTimer) clearTimeout(loopTimer);
    loopTimer = setTimeout(checkAndNotify, nextDelay);
  }
}

onconnect = (e) => {
  const port = e.ports[0];
  ports.push(port);

  port.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type === 'updateSelection') {
      selectedItems = new Set(payload);
      console.log('SharedWorker: Seleção atualizada.', selectedItems);
    }
  };
  port.start();

  if (ports.length === 1) {
    checkAndNotify();
  }

  port.onclose = () => {
     ports = ports.filter(p => p !== port);
     if (ports.length === 0) {
        if(loopTimer) clearTimeout(loopTimer);
        loopTimer = null;
        hasCheckedInitialStock = false;
     }
  };
};