// --- Escopo do SharedWorker ---
// Este script é único e compartilhado por todas as abas.

let hasCheckedInitialStock = false;
let selectedItems = new Set();
let loopTimer = null;
let isFetching = false;
let ports = []; // Array de todas as abas conectadas

// Constantes
const RETRY_ON_ERROR_MS = 60000; // 1 minuto
const API_BUFFER_MS = 10000; // <<<--- CORREÇÃO 1: Aumentado para 10s

/**
 * Função de checagem (agora única)
 */
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

    // <<<--- CORREÇÃO 2: Lógica anti-reload e anti-vazio
    if (matches.length > 0 && selectedItems.size > 0 && hasCheckedInitialStock) {
      console.log("SharedWorker: Item desejado encontrado!", matches);
      // Avisa TODAS as abas para tocarem o som
      ports.forEach(port => {
        port.postMessage({ type: 'notify', payload: matches });
      });
    }

    // Flag anti-reload (só notifica a partir da segunda checagem)
    hasCheckedInitialStock = true;
    
    // Calcula o próximo delay
    const timeUntilNextUpdate = (data.nextUpdateAt + API_BUFFER_MS) - Date.now();
    nextDelay = Math.max(timeUntilNextUpdate, 30000); // Mínimo de 30s

  } catch (error) {
    console.error("SharedWorker Error:", error);
    nextDelay = RETRY_ON_ERROR_MS;
  } finally {
    isFetching = false;
    // <<<--- CORREÇÃO 3: O loop único (não duplica)
    if (loopTimer) clearTimeout(loopTimer);
    loopTimer = setTimeout(checkAndNotify, nextDelay);
  }
}

/**
 * Quando uma nova aba se conecta...
 */
onconnect = (e) => {
  const port = e.ports[0];
  ports.push(port);

  // Ouve por mensagens daquela aba (ex: atualização de seleção)
  port.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type === 'updateSelection') {
      selectedItems = new Set(payload);
      console.log('SharedWorker: Seleção atualizada por uma aba.', selectedItems);
    }
  };

  // Inicia a porta
  port.start();

  // Inicia o loop de checagem (apenas se for a primeira aba a se conectar)
  if (ports.length === 1) {
    console.log("SharedWorker: Primeira aba conectada. Iniciando loop.");
    checkAndNotify();
  }

  // Limpa a porta se a aba for fechada
  port.onclose = () => { // (Adicionado para robustez)
     ports = ports.filter(p => p !== port);
     if (ports.length === 0) {
        console.log("SharedWorker: Última aba fechada. Parando loop.");
        if(loopTimer) clearTimeout(loopTimer);
        loopTimer = null;
        hasCheckedInitialStock = false; // Reseta para a próxima vez
     }
  };
};