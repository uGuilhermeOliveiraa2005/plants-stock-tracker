"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell } from "lucide-react";

interface ShopItem { name: string; qty: number; emoji: string; }
interface ApiResponse { reportedAt: number; nextUpdateAt: number; seeds: ShopItem[]; gear: ShopItem[]; }
const NOTIFY_LIST_KEY = "pvbNotifyList";
const NOTIFIED_STOCKS_KEY = "pvbNotifiedStocks";
const MAX_HISTORY = 50;

// Lista atualizada com Starfruit no topo
const AVAILABLE_SEEDS = [
  "Starfruit", "King Limone", "Mango", "Shroombino", "Tomatrio", "Mr Carrot",
  "Carnivorous Plant", "Cocotank", "Grape", "Watermelon", "Eggplant",
  "Dragon Fruit", "Sunflower", "Pumpkin", "Strawberry", "Cactus",
];

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

export default function NotificationManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFruitsState, setSelectedFruitsState] = useState<Set<string>>(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showAudioBanner, setShowAudioBanner] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastProcessedStockTimestamp = useRef<number>(0); 
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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

    audioRef.current = new Audio("/notification.wav");
    audioRef.current.volume = 0.5;
    audioRef.current.load();

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
    
    return () => { 
      document.removeEventListener("click", primeAudio); 
      document.removeEventListener("touchend", primeAudio); 
    };
  }, [audioUnlocked]);

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
  }, [audioUnlocked]);

  const checkStockChanges = useCallback(async () => {
    try {
      const response = await fetch("/api/stock");
      if (!response.ok) { console.warn("Falha /api/stock"); return; }
      const data: ApiResponse = await response.json();
      const currentStockTimestamp = data.reportedAt;
      const currentStockKey = String(currentStockTimestamp);

      if (currentStockTimestamp === lastProcessedStockTimestamp.current) {
        return; 
      }

      console.log("🆕 Novo estoque detectado!", { anterior: lastProcessedStockTimestamp.current, novo: currentStockTimestamp });
      lastProcessedStockTimestamp.current = currentStockTimestamp;

      if (wasAlreadyNotified(currentStockKey)) {
        console.log(`⏭️ Estoque ${currentStockKey} JÁ notificado anteriormente. Pulando.`);
        return;
      }
      
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

      if (matchedFruits.length > 0) {
        console.log("🔔 Tocando notificação para:", matchedFruits);
        playNotificationSound();
        addNotifiedStock(currentStockKey);
      } else {
        console.log("❌ Nenhuma fruta selecionada encontrada neste novo estoque.");
      }
    } catch (error) {
      console.error("Erro ao verificar estoque:", error);
    }
  }, [playNotificationSound]);

  useEffect(() => {
    let currentSelectedFruits: Set<string>;
    try {
      const savedList = localStorage.getItem(NOTIFY_LIST_KEY);
      currentSelectedFruits = new Set<string>(savedList ? JSON.parse(savedList) as string[] : []);
    } catch (e) {
      currentSelectedFruits = new Set();
    }
    
    if (!audioUnlocked || currentSelectedFruits.size === 0) {
      console.log("Notificações em espera (Timer):", { audioUnlocked, listaVazia: currentSelectedFruits.size === 0 });
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    console.log("🚀 Iniciando/Reiniciando monitoramento de estoque (Timer 30s)...");

    checkStockChanges(); 
    intervalRef.current = setInterval(checkStockChanges, 30000);

    return () => {
        console.log("🛑 Parando monitoramento de estoque (Timer 30s).");
        if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [audioUnlocked, selectedFruitsState, checkStockChanges]); 

  useEffect(() => {
    if (!audioUnlocked) {
      console.log("Ouvinte Broadcast em espera (áudio bloqueado).");
      return;
    }

    const channel = new BroadcastChannel('stock-update-channel');

    const handleMessage = (event: MessageEvent) => {
        console.log("🔔 Ping recebido do page.tsx!", event.data);
        checkStockChanges();
    };

    console.log("🎧 Ouvindo o canal 'stock-update-channel'...");
    channel.addEventListener('message', handleMessage);
    
    return () => {
        console.log("🔇 Parando de ouvir o canal 'stock-update-channel'.");
        channel.removeEventListener('message', handleMessage);
        channel.close();
    };
  }, [checkStockChanges, audioUnlocked]);

  const toggleFruitSelection = (fruitName: string) => { 
    let currentSelected: Set<string>;
    try {
      const currentSavedList = localStorage.getItem(NOTIFY_LIST_KEY);
      currentSelected = new Set<string>(currentSavedList ? JSON.parse(currentSavedList) as string[] : []);
    } catch (e) {
      currentSelected = new Set();
    }

    if (currentSelected.has(fruitName)) {
        currentSelected.delete(fruitName);
    } else {
        currentSelected.add(fruitName);
    }

    const listArray = Array.from(currentSelected);
    try {
      localStorage.setItem(NOTIFY_LIST_KEY, JSON.stringify(listArray));
      setSelectedFruitsState(currentSelected);
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

  const saveNotifications = async () => { 
    console.log("💾 Modal Salvo (storage já foi atualizado ao clicar).");
    
    try {
      const response = await fetch("/api/stock");
      if (response.ok) {
        const data: ApiResponse = await response.json();
        const currentStockTimestamp = data.reportedAt;
        const currentStockKey = String(currentStockTimestamp);
        
        if (!wasAlreadyNotified(currentStockKey)) {
          addNotifiedStock(currentStockKey);
          console.log("✅ Estoque atual marcado como processado (sem notificação):", currentStockKey);
        }
        
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
        {selectedFruitsState.size > 0 && (
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