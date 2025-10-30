"use client";

// 1. Importar o useCallback
import { useEffect, useState, useRef, useCallback } from "react";
import { Bell } from "lucide-react";

// --- (Interfaces e Constantes - Sem alteração) ---
interface ShopItem { name: string; qty: number; emoji: string; }
interface ApiResponse { reportedAt: number; nextUpdateAt: number; seeds: ShopItem[]; gear: ShopItem[]; }
const NOTIFY_LIST_KEY = "pvbNotifyList";
const NOTIFIED_STOCKS_KEY = "pvbNotifiedStocks";
const MAX_HISTORY = 50;
const AVAILABLE_SEEDS = [
  "King Limone", "Mango", "Shroombino", "Tomatrio", "Mr Carrot",
  "Carnivorous Plant", "Cocotank", "Grape", "Watermelon", "Eggplant",
  "Dragon Fruit", "Sunflower", "Pumpkin", "Strawberry", "Cactus",
];

// --- (Funções de Histórico - Sem alteração) ---
const getNotifiedStocks = (): Set<string> => {
  try {
    const saved = localStorage.getItem(NOTIFIED_STOCKS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      // console.log("📜 Histórico lido:", parsed);
      return new Set(parsed);
    }
  } catch (error) { console.error("Erro ao carregar histórico:", error); }
  // console.log("📜 Histórico não encontrado ou vazio.");
  return new Set();
};
const addNotifiedStock = (stockKey: string): void => {
   try {
    const historySet = getNotifiedStocks();
    historySet.add(stockKey);
    const historyArray = Array.from(historySet);
    const trimmedHistory = historyArray.slice(-MAX_HISTORY);
    localStorage.setItem(NOTIFIED_STOCKS_KEY, JSON.stringify(trimmedHistory));
    console.log("💾 Histórico salvo:", trimmedHistory);
  } catch (error) { console.error("Erro ao salvar histórico:", error); }
};
const wasAlreadyNotified = (stockKey: string): boolean => {
  const history = getNotifiedStocks();
  return history.has(stockKey);
};
// --- Fim das Funções de Histórico ---


export default function NotificationManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFruitsState, setSelectedFruitsState] = useState<Set<string>>(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showAudioBanner, setShowAudioBanner] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastProcessedStockTimestamp = useRef<number>(0); 
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- (useEffect de Setup Inicial - Sem alteração) ---
  useEffect(() => {
    // Tenta carregar a lista salva do localStorage PARA O STATE (para a UI)
    try {
      const savedList = localStorage.getItem(NOTIFY_LIST_KEY);
      if (savedList) {
        const parsed = JSON.parse(savedList) as string[];
        setSelectedFruitsState(new Set(parsed)); 
        console.log("Lista de notificações (state) carregada:", parsed);
      }
    } catch (error) { 
      console.error("Erro ao carregar lista (state):", error); 
    }

    // Configura o áudio
    audioRef.current = new Audio("/notification.wav");
    audioRef.current.volume = 0.5;
    audioRef.current.load();

    // Tenta desbloquear o áudio com a primeira interação
    const primeAudio = () => {
        if (audioRef.current && !audioUnlocked) {
            audioRef.current.play().then(() => {
                if(audioRef.current){ audioRef.current.pause(); audioRef.current.currentTime = 0;}
                setAudioUnlocked(true); setShowAudioBanner(false); console.log("✅ Áudio desbloqueado!");
                document.removeEventListener("click", primeAudio); document.removeEventListener("touchend", primeAudio);
            }).catch((e) => { console.warn("❌ Erro ao desbloquear:", e); });
        }
    };
    if (!audioUnlocked) {
        document.addEventListener("click", primeAudio); document.addEventListener("touchend", primeAudio);
    } else { setShowAudioBanner(false); }
    
    // Limpeza dos event listeners
    return () => { 
      document.removeEventListener("click", primeAudio); 
      document.removeEventListener("touchend", primeAudio); 
    };
  }, [audioUnlocked]); // Depende apenas de 'audioUnlocked'


  // --- 2. FUNÇÃO DE SOM (Envolvida em useCallback) ---
  const playNotificationSound = useCallback(() => {
      if (!audioRef.current) return;
      if (!audioUnlocked) { 
          console.warn("⚠️ Áudio bloqueado"); 
          setShowAudioBanner(true); 
          return; 
      }
      console.log("🔊 Tocando..."); 
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise) { 
          playPromise.then(() => console.log("✅ Som OK!"))
                     .catch((error) => { 
                         console.warn("❌ Falha Play:", error); 
                         setAudioUnlocked(false); 
                         setShowAudioBanner(true); 
                     }); 
      }
  }, [audioUnlocked]); // Depende do state 'audioUnlocked'

  
  // --- 3. LÓGICA DE CHECAGEM (Movida para fora e envolvida em useCallback) ---
  const checkStockChanges = useCallback(async () => {
    try {
      const response = await fetch("/api/stock");
      if (!response.ok) { console.warn("Falha /api/stock"); return; }
      const data: ApiResponse = await response.json();
      const currentStockTimestamp = data.reportedAt;
      const currentStockKey = String(currentStockTimestamp);

      // CHECAGEM 1: JÁ PROCESSAMOS ESTE ESTOQUE?
      // Usar o .current garante que lemos o valor mais recente do ref
      if (currentStockTimestamp === lastProcessedStockTimestamp.current) {
        // console.log(`Stock ${currentStockTimestamp} já processado.`);
        return; 
      }

      // NOVO ESTOQUE
      console.log("🆕 Novo estoque detectado!", { anterior: lastProcessedStockTimestamp.current, novo: currentStockTimestamp });
      lastProcessedStockTimestamp.current = currentStockTimestamp; // Marca como processado

      // CHECAGEM 2: JÁ NOTIFICAMOS ESTE ESTOQUE ANTES?
      if (wasAlreadyNotified(currentStockKey)) {
        console.log(`⏭️ Estoque ${currentStockKey} JÁ notificado anteriormente. Pulando.`);
        return;
      }
      
      // CHECAGEM 3: HÁ MATCH COM A SELEÇÃO *ATUAL*?
      // Lê a seleção FRESCA do localStorage
      let freshSelectedItems: Set<string>;
      try {
        const freshSavedList = localStorage.getItem(NOTIFY_LIST_KEY);
        freshSelectedItems = new Set<string>(freshSavedList ? JSON.parse(freshSavedList) as string[] : []);
      } catch (e) {
        console.error("Erro ao ler lista fresca", e);
        freshSelectedItems = new Set();
      }

      if (freshSelectedItems.size === 0) {
          console.log("Seleção ficou vazia. Pulando match.");
          return;
      }

      const seedsInStock = data.seeds.map((seed) => seed.name);
      const matchedFruits: string[] = [];
      for (const selectedFruit of freshSelectedItems) {
        if (seedsInStock.includes(selectedFruit)) {
          matchedFruits.push(selectedFruit);
        }
      }

      // NOTIFICAR E MARCAR
      if (matchedFruits.length > 0) {
        console.log("🔔 Tocando notificação para:", matchedFruits);
        playNotificationSound(); // Chama a função estável
        addNotifiedStock(currentStockKey); // Marca como notificado
      } else {
        console.log("❌ Nenhuma fruta selecionada encontrada neste novo estoque.");
      }
    } catch (error) {
      console.error("Erro ao verificar estoque:", error);
    }
  }, [playNotificationSound]); // Depende da função 'playNotificationSound'


  // --- 4. useEffect DE MONITORAMENTO (TIMER DE 30s) ---
  // (Este é o timer de segurança, caso o Broadcast falhe)
  useEffect(() => {
    // Lê a lista do storage para decidir se inicia o timer
    let currentSelectedFruits: Set<string>;
    try {
      const savedList = localStorage.getItem(NOTIFY_LIST_KEY);
      currentSelectedFruits = new Set<string>(savedList ? JSON.parse(savedList) as string[] : []);
    } catch (e) {
      currentSelectedFruits = new Set();
    }
    
    // Se áudio bloqueado OU lista vazia, para tudo
    if (!audioUnlocked || currentSelectedFruits.size === 0) {
      console.log("Notificações em espera (Timer):", { audioUnlocked, listaVazia: currentSelectedFruits.size === 0 });
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    console.log("🚀 Iniciando/Reiniciando monitoramento de estoque (Timer 30s)...");

    // Verifica imediatamente ao (re)iniciar o monitoramento
    checkStockChanges(); 
    // Depois verifica a cada 30 segundos
    intervalRef.current = setInterval(checkStockChanges, 30000);

    // Função de limpeza do monitoramento
    return () => {
        console.log("🛑 Parando monitoramento de estoque (Timer 30s).");
        if (intervalRef.current) clearInterval(intervalRef.current);
    }
  // Re-executa se o áudio for desbloqueado, a seleção (state) mudar, ou a função de checagem for recriada
  }, [audioUnlocked, selectedFruitsState, checkStockChanges]); 


  // --- 5. NOVO useEffect: Ouvinte do BroadcastChannel ---
  // (Dispara a checagem IMEDIATAMENTE ao receber o "aviso" da page.tsx)
  useEffect(() => {
    // Só ouve se o áudio estiver desbloqueado
    if (!audioUnlocked) {
      console.log("Ouvinte Broadcast em espera (áudio bloqueado).");
      return;
    }

    const channel = new BroadcastChannel('stock-update-channel');

    const handleMessage = (event: MessageEvent) => {
        console.log("🔔 Ping recebido do page.tsx!", event.data);
        // Roda a checagem!
        // A lógica de 'lastProcessedStockTimestamp.current' dentro dela
        // garante que o estoque não seja processado duas vezes.
        checkStockChanges();
    };

    console.log("🎧 Ouvindo o canal 'stock-update-channel'...");
    channel.addEventListener('message', handleMessage);
    
    // Limpeza
    return () => {
        console.log("🔇 Parando de ouvir o canal 'stock-update-channel'.");
        channel.removeEventListener('message', handleMessage);
        channel.close();
    };
  }, [checkStockChanges, audioUnlocked]); // Depende da função e do estado do áudio


  // --- (O restante das funções de UI - Sem alteração) ---

  // Atualiza o STATE E o localStorage
  const toggleFruitSelection = (fruitName: string) => { 
    // Lê a lista ATUAL do storage
    let currentSelected: Set<string>;
    try {
      const currentSavedList = localStorage.getItem(NOTIFY_LIST_KEY);
      currentSelected = new Set<string>(currentSavedList ? JSON.parse(currentSavedList) as string[] : []);
    } catch (e) {
      currentSelected = new Set();
    }

    // Modifica a lista
    if (currentSelected.has(fruitName)) {
        currentSelected.delete(fruitName);
    } else {
        currentSelected.add(fruitName);
    }

    // Salva no storage e no state
    const listArray = Array.from(currentSelected);
    try {
      localStorage.setItem(NOTIFY_LIST_KEY, JSON.stringify(listArray));
      setSelectedFruitsState(currentSelected); // Atualiza o state para UI e para re-rodar o useEffect de monitoramento
      console.log(`Seleção atualizada no storage e state:`, listArray);
    } catch (e) {
      console.error("Erro ao salvar seleção", e);
    }
  };
  
  const primeAudioOnClick = () => { 
    if (audioRef.current && !audioUnlocked) {
         audioRef.current.play().then(() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } setAudioUnlocked(true); setShowAudioBanner(false); console.log("✅ Áudio desbloqueado ao salvar!"); }).catch(() => { console.warn("❌ Falha ao desbloquear ao salvar."); });
      }
  };

 // Salva as notificações e marca o estoque atual como "já processado"
  const saveNotifications = async () => { 
    console.log("💾 Modal Salvo (storage já foi atualizado ao clicar).");
    
    // Marca o estoque atual como já processado para não notificar imediatamente
    try {
      const response = await fetch("/api/stock");
      if (response.ok) {
        const data: ApiResponse = await response.json();
        const currentStockTimestamp = data.reportedAt;
        const currentStockKey = String(currentStockTimestamp);
        
        // Adiciona o estoque atual ao histórico sem tocar som
        if (!wasAlreadyNotified(currentStockKey)) {
          addNotifiedStock(currentStockKey);
          console.log("✅ Estoque atual marcado como processado (sem notificação):", currentStockKey);
        }
        
        // Atualiza o ref para sincronizar
        lastProcessedStockTimestamp.current = currentStockTimestamp;
      }
    } catch (error) {
      console.error("Erro ao marcar estoque atual:", error);
    }
    
    if (!audioUnlocked) { 
      primeAudioOnClick(); 
    }
    setIsModalOpen(false);
  };

  const getImageSrc = (name: string): string => {
      const formattedName = name.toLowerCase().replace(/ /g, "-");
      return `/images/items/${formattedName}-seed.webp`;
  };

  // --- JSX (Renderização - Sem alteração) ---
  return (
    <>
      {showAudioBanner && !audioUnlocked && (
        <div className="audio-banner" onClick={primeAudioOnClick}>
          <Bell size={20} />
          <span>Clique aqui para ativar as notificações sonoras</span>
        </div>
      )}
      <button className="nav-icon-btn" onClick={() => setIsModalOpen(true)} title="Configurar Notificações" aria-label="Configurar Notificações">
        <Bell size={20} />
        {selectedFruitsState.size > 0 && ( /* Usa o state para o badge */
          <span className="notification-badge">{selectedFruitsState.size}</span>
        )}
      </button>
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Notificar-me:</h2><button className="modal-close" onClick={() => setIsModalOpen(false)} aria-label="Fechar">×</button></div>
            <div className="modal-body">
              <p className="modal-description">Selecione as sementes que deseja monitorar.</p>
              <div className="fruit-list">
                {AVAILABLE_SEEDS.map((fruitName) => (
                  <button key={fruitName} type="button" className={`fruit-item ${selectedFruitsState.has(fruitName) ? "selected" : ""}`} onClick={() => toggleFruitSelection(fruitName)}>
                    <img src={getImageSrc(fruitName)} alt={fruitName} width={32} height={32} onError={(e) => {(e.target as HTMLImageElement).src = "/images/items/Default.webp";}}/>
                    <span>{fruitName}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer"><button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button><button className="btn-primary" onClick={saveNotifications}>Salvar</button></div>
          </div>
        </div>
      )}
      <audio ref={audioRef} src="/notification.wav" preload="auto" />
    </>
  );
}