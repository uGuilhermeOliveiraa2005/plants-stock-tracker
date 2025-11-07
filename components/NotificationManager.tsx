"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell } from "lucide-react";

// --- (Interfaces e Constantes - Com Starfruit adicionada) ---
interface ShopItem { name: string; qty: number; emoji: string; }
interface ApiResponse { reportedAt: number; nextUpdateAt: number; seeds: ShopItem[]; gear: ShopItem[]; }
const NOTIFY_LIST_KEY = "pvbNotifyList";
const NOTIFIED_STOCKS_KEY = "pvbNotifiedStocks";
const MAX_HISTORY = 50;
const AVAILABLE_SEEDS = [
  "Starfruit", "King Limone", "Mango", "Shroombino", "Tomatrio", "Mr Carrot",
  "Carnivorous Plant", "Cocotank", "Grape", "Watermelon", "Eggplant",
  "Dragon Fruit", "Sunflower", "Pumpkin", "Strawberry", "Cactus",
];

// --- (Funções de Histórico - Sem alteração) ---
const getNotifiedStocks = (): Set<string> => {
  try {
    const saved = localStorage.getItem(NOTIFIED_STOCKS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      return new Set(parsed);
    }
  } catch (error) { console.error("Erro ao carregar histórico:", error); }
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastProcessedStockTimestamp = useRef<number>(0); 

  // --- (useEffect de Setup Inicial - Modificado) ---
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

    // Limpeza
    return () => { };
  }, []); // Executa apenas uma vez


  // --- 2. FUNÇÃO DE SOM (Modificada para auto-unlock) ---
  const playNotificationSound = useCallback(() => {
      if (!audioRef.current) return;
      
      console.log("🔊 Tentando tocar..."); 
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      
      if (playPromise) { 
          playPromise.then(() => {
              console.log("✅ Som tocou com sucesso!");
              // Se conseguiu tocar, marca como desbloqueado
              if (!audioUnlocked) {
                setAudioUnlocked(true);
              }
          }).catch((error) => { 
              console.warn("❌ Falha ao tocar:", error); 
              // Se falhou, tenta desbloquear na próxima interação
              setAudioUnlocked(false);
          }); 
      }
  }, [audioUnlocked]);

  
  // --- 3. NOVA LÓGICA DE PROCESSAMENTO (Recebe dados, não busca) ---
  const processStockData = useCallback((data: ApiResponse) => {
    try {
      const currentStockTimestamp = data.reportedAt;
      const currentStockKey = String(currentStockTimestamp);

      // CHECAGEM 1: JÁ PROCESSAMOS ESTE ESTOQUE NESTA ABA?
      if (currentStockTimestamp === lastProcessedStockTimestamp.current) {
        console.log("⏭️ Estoque já processado nesta aba. Pulando.");
        return; 
      }

      // CHECAGEM 2: JÁ NOTIFICAMOS ESTE ESTOQUE GLOBALMENTE (qualquer aba)?
      if (wasAlreadyNotified(currentStockKey)) {
        console.log(`⏭️ Estoque ${currentStockKey} JÁ notificado anteriormente (global). Pulando.`);
        lastProcessedStockTimestamp.current = currentStockTimestamp;
        return;
      }

      // NOVO ESTOQUE - Marca como processado LOCALMENTE (ref)
      console.log("🆕 Novo estoque detectado!", { anterior: lastProcessedStockTimestamp.current, novo: currentStockTimestamp });
      lastProcessedStockTimestamp.current = currentStockTimestamp;
      
      // CHECAGEM 3: HÁ MATCH COM A SELEÇÃO *ATUAL*?
      let freshSelectedItems: Set<string>;
      try {
        const freshSavedList = localStorage.getItem(NOTIFY_LIST_KEY);
        freshSelectedItems = new Set<string>(freshSavedList ? JSON.parse(freshSavedList) as string[] : []);
      } catch (e) {
        console.error("Erro ao ler lista fresca", e);
        freshSelectedItems = new Set();
      }

      if (freshSelectedItems.size === 0) {
          console.log("Seleção vazia. Pulando match.");
          // IMPORTANTE: Marca como processado globalmente MESMO sem match
          addNotifiedStock(currentStockKey);
          return;
      }

      const seedsInStock = data.seeds.map((seed) => seed.name);
      const matchedFruits: string[] = [];
      
      for (const selectedFruit of freshSelectedItems) {
        if (seedsInStock.includes(selectedFruit)) {
          matchedFruits.push(selectedFruit);
        }
      }

      // SEMPRE marca como processado globalmente ANTES de qualquer ação
      addNotifiedStock(currentStockKey);
      
      // NOTIFICAR apenas se houver match
      if (matchedFruits.length > 0) {
        console.log("🔔 Tocando notificação para:", matchedFruits);
        playNotificationSound();
      } else {
        console.log("❌ Nenhuma fruta selecionada encontrada neste estoque.");
      }
    } catch (error) {
      console.error("Erro ao processar estoque:", error);
    }
  }, [playNotificationSound]);


  // --- 4. useEffect: Ouvinte do BroadcastChannel (Modificado) ---
  useEffect(() => {
    // Lê a lista do storage para decidir se inicia o listener
    let currentSelectedFruits: Set<string>;
    try {
      const savedList = localStorage.getItem(NOTIFY_LIST_KEY);
      currentSelectedFruits = new Set<string>(savedList ? JSON.parse(savedList) as string[] : []);
    } catch (e) {
      currentSelectedFruits = new Set();
    }
    
    // Se lista vazia, não precisa ouvir
    if (currentSelectedFruits.size === 0) {
      console.log("Notificações em espera (lista vazia).");
      return;
    }

    const channel = new BroadcastChannel('stock-update-channel');

    const handleMessage = (event: MessageEvent<ApiResponse>) => {
        console.log("🔔 Dados de estoque recebidos!", event.data?.reportedAt);
        
        const stockData = event.data;
        if (stockData && stockData.reportedAt) {
          processStockData(stockData);
        } else {
          console.warn("Mensagem de broadcast recebida sem dados válidos.");
        }
    };

    console.log("🎧 Ouvindo o canal 'stock-update-channel'...");
    channel.addEventListener('message', handleMessage);
    
    // Limpeza
    return () => {
        console.log("🔇 Parando de ouvir o canal 'stock-update-channel'.");
        channel.removeEventListener('message', handleMessage);
        channel.close();
    };
  }, [processStockData, selectedFruitsState]);


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
      setSelectedFruitsState(currentSelected);
      console.log(`Seleção atualizada no storage e state:`, listArray);
    } catch (e) {
      console.error("Erro ao salvar seleção", e);
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
    
    // Tenta desbloquear o áudio ao salvar (se tiver pelo menos uma fruta selecionada)
    if (selectedFruitsState.size > 0 && audioRef.current && !audioUnlocked) {
      audioRef.current.play().then(() => { 
        if (audioRef.current) { 
          audioRef.current.pause(); 
          audioRef.current.currentTime = 0; 
        } 
        setAudioUnlocked(true);
        console.log("✅ Áudio desbloqueado ao salvar!");
      }).catch(() => { 
        console.warn("❌ Falha ao desbloquear ao salvar."); 
      });
    }
    
    setIsModalOpen(false);
  };

  const getImageSrc = (name: string): string => {
      const formattedName = name.toLowerCase().replace(/ /g, "-");
      return `/images/items/${formattedName}-seed.webp`;
  };

  // --- JSX (Renderização - Banner de áudio removido) ---
  return (
    <>
      <button className="nav-icon-btn" onClick={() => setIsModalOpen(true)} title="Configurar Notificações" aria-label="Configurar Notificações">
        <Bell size={20} />
        {selectedFruitsState.size > 0 && (
          <span className="notification-badge">{selectedFruitsState.size}</span>
        )}
      </button>
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Notificar-me:</h2><button className="modal-close" onClick={() => setIsModalOpen(false)} aria-label="Fechar">×</button></div>
            <div className="modal-body">
              <p className="modal-description">Selecione as sementes que deseja monitorar. As notificações serão ativadas automaticamente.</p>
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