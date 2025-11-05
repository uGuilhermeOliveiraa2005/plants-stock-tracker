"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell } from "lucide-react";

interface ShopItem { name: string; qty: number; emoji: string; }
interface ApiResponse { reportedAt: number; nextUpdateAt: number; seeds: ShopItem[]; gear: ShopItem[]; }

const NOTIFY_LIST_KEY = "pvbNotifyList";
const NOTIFIED_STOCKS_KEY = "pvbNotifiedStocks";
const LAST_CHECK_KEY = "pvbLastCheckTimestamp";
const MAX_HISTORY = 100;
const DEBOUNCE_TIME = 5000; // 5 segundos de debounce entre verificações

// Lista atualizada com Starfruit no topo
const AVAILABLE_SEEDS = [
  "Starfruit", "King Limone", "Mango", "Shroombino", "Tomatrio", "Mr Carrot",
  "Carnivorous Plant", "Cocotank", "Grape", "Watermelon", "Eggplant",
  "Dragon Fruit", "Sunflower", "Pumpkin", "Strawberry", "Cactus",
];

// Sistema robusto de histórico de notificações
const getNotifiedStocks = (): Set<string> => {
  try {
    const saved = localStorage.getItem(NOTIFIED_STOCKS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      return new Set(parsed);
    }
  } catch (error) { 
    console.error("Erro ao carregar histórico:", error); 
  }
  return new Set();
};

const addNotifiedStock = (stockKey: string): void => {
  try {
    const historySet = getNotifiedStocks();
    historySet.add(stockKey);
    const historyArray = Array.from(historySet);
    const trimmedHistory = historyArray.slice(-MAX_HISTORY);
    localStorage.setItem(NOTIFIED_STOCKS_KEY, JSON.stringify(trimmedHistory));
    console.log("💾 Histórico atualizado. Total de stocks notificados:", trimmedHistory.length);
  } catch (error) { 
    console.error("Erro ao salvar histórico:", error); 
  }
};

const wasAlreadyNotified = (stockKey: string): boolean => {
  const history = getNotifiedStocks();
  const result = history.has(stockKey);
  if (result) {
    console.log(`✅ Stock ${stockKey} JÁ foi notificado anteriormente`);
  }
  return result;
};

// Sistema de debounce para evitar verificações múltiplas
const getLastCheckTime = (): number => {
  try {
    const saved = localStorage.getItem(LAST_CHECK_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
};

const setLastCheckTime = (timestamp: number): void => {
  try {
    localStorage.setItem(LAST_CHECK_KEY, timestamp.toString());
  } catch (error) {
    console.error("Erro ao salvar timestamp:", error);
  }
};

const canCheckNow = (): boolean => {
  const now = Date.now();
  const lastCheck = getLastCheckTime();
  const timeSinceLastCheck = now - lastCheck;
  
  if (timeSinceLastCheck < DEBOUNCE_TIME) {
    console.log(`⏳ Debounce ativo. Última verificação há ${Math.floor(timeSinceLastCheck / 1000)}s`);
    return false;
  }
  
  return true;
};

export default function NotificationManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFruitsState, setSelectedFruitsState] = useState<Set<string>>(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showAudioBanner, setShowAudioBanner] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastProcessedStockTimestamp = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef<boolean>(false); // Lock para evitar verificações simultâneas
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Carregar seleções ao montar
  useEffect(() => {
    try {
      const savedList = localStorage.getItem(NOTIFY_LIST_KEY);
      if (savedList) {
        const parsed = JSON.parse(savedList) as string[];
        setSelectedFruitsState(new Set(parsed)); 
        console.log("📋 Lista de notificações carregada:", parsed);
      }
    } catch (error) { 
      console.error("Erro ao carregar lista:", error); 
    }

    audioRef.current = new Audio("/notification.wav");
    audioRef.current.volume = 0.5;
    audioRef.current.load();

    const primeAudio = () => {
      if (audioRef.current && !audioUnlocked) {
        audioRef.current.play().then(() => {
          if(audioRef.current){ 
            audioRef.current.pause(); 
            audioRef.current.currentTime = 0;
          }
          setAudioUnlocked(true); 
          setShowAudioBanner(false); 
          console.log("✅ Áudio desbloqueado!");
          document.removeEventListener("click", primeAudio); 
          document.removeEventListener("touchend", primeAudio);
        }).catch((e) => { 
          console.warn("❌ Erro ao desbloquear áudio:", e); 
        });
      }
    };
    
    if (!audioUnlocked) {
      document.addEventListener("click", primeAudio); 
      document.addEventListener("touchend", primeAudio);
    } else { 
      setShowAudioBanner(false); 
    }
    
    return () => { 
      document.removeEventListener("click", primeAudio); 
      document.removeEventListener("touchend", primeAudio); 
    };
  }, [audioUnlocked]);

  const playNotificationSound = useCallback(() => {
    if (!audioRef.current) return;
    if (!audioUnlocked) { 
      console.warn("⚠️ Áudio bloqueado pelo navegador"); 
      setShowAudioBanner(true); 
      return; 
    }
    
    console.log("🔊 Tocando notificação sonora..."); 
    audioRef.current.currentTime = 0;
    const playPromise = audioRef.current.play();
    
    if (playPromise) { 
      playPromise
        .then(() => console.log("✅ Som reproduzido com sucesso!"))
        .catch((error) => { 
          console.warn("❌ Falha ao reproduzir som:", error); 
          setAudioUnlocked(false); 
          setShowAudioBanner(true); 
        }); 
    }
  }, [audioUnlocked]);

  const checkStockChanges = useCallback(async () => {
    // 🔒 Lock: Impede verificações simultâneas
    if (isCheckingRef.current) {
      console.log("🔒 Verificação já em andamento, pulando...");
      return;
    }

    // ⏳ Debounce: Impede verificações muito frequentes
    if (!canCheckNow()) {
      console.log("⏳ Debounce ativo, pulando verificação");
      return;
    }

    isCheckingRef.current = true;
    console.log("🔍 Iniciando verificação de mudança de estoque...");

    try {
      const response = await fetch("/api/stock");
      if (!response.ok) { 
        console.warn("⚠️ Falha ao buscar /api/stock"); 
        return; 
      }

      const data: ApiResponse = await response.json();
      const currentStockTimestamp = data.reportedAt;
      const currentStockKey = String(currentStockTimestamp);

      console.log("📊 Stock atual:", {
        timestamp: currentStockTimestamp,
        key: currentStockKey,
        ultimoProcessado: lastProcessedStockTimestamp.current
      });

      // Verifica se é um novo stock
      if (currentStockTimestamp === lastProcessedStockTimestamp.current) {
        console.log("ℹ️ Stock não mudou, mantendo o atual");
        return;
      }

      console.log("🆕 NOVO ESTOQUE DETECTADO!", { 
        anterior: lastProcessedStockTimestamp.current, 
        novo: currentStockTimestamp 
      });

      // Verifica se já foi notificado ANTES de atualizar o timestamp
      if (wasAlreadyNotified(currentStockKey)) {
        console.log(`⏭️ Stock ${currentStockKey} já foi notificado anteriormente. Pulando som.`);
        // Atualiza o timestamp mesmo assim para não verificar novamente
        lastProcessedStockTimestamp.current = currentStockTimestamp;
        setLastCheckTime(Date.now());
        return;
      }

      // Atualiza o timestamp e debounce
      lastProcessedStockTimestamp.current = currentStockTimestamp;
      setLastCheckTime(Date.now());
      
      // Pega lista atualizada do localStorage
      let freshSelectedItems: Set<string>;
      try {
        const freshSavedList = localStorage.getItem(NOTIFY_LIST_KEY);
        freshSelectedItems = new Set<string>(
          freshSavedList ? JSON.parse(freshSavedList) as string[] : []
        );
      } catch (e) {
        console.error("Erro ao ler lista de seleção:", e);
        freshSelectedItems = new Set();
      }

      if (freshSelectedItems.size === 0) {
        console.log("ℹ️ Nenhuma fruta selecionada para notificação");
        // Mesmo sem seleção, marca como processado para não verificar de novo
        addNotifiedStock(currentStockKey);
        return;
      }

      // Verifica se alguma fruta selecionada está no stock
      const seedsInStock = data.seeds.map((seed) => seed.name);
      const matchedFruits: string[] = [];
      
      for (const selectedFruit of freshSelectedItems) {
        if (seedsInStock.includes(selectedFruit)) {
          matchedFruits.push(selectedFruit);
        }
      }

      // Marca como notificado ANTES de tocar o som
      addNotifiedStock(currentStockKey);

      if (matchedFruits.length > 0) {
        console.log("🎯 MATCH! Frutas encontradas:", matchedFruits);
        
        // Toca o som
        playNotificationSound();
        
        console.log("✅ Notificação enviada para:", matchedFruits.join(", "));
      } else {
        console.log("❌ Nenhuma fruta selecionada encontrada neste stock");
      }

    } catch (error) {
      console.error("❌ Erro ao verificar estoque:", error);
    } finally {
      isCheckingRef.current = false;
      console.log("🔓 Verificação concluída, lock liberado");
    }
  }, [playNotificationSound]);

  // Timer de verificação periódica (30 segundos)
  useEffect(() => {
    let currentSelectedFruits: Set<string>;
    try {
      const savedList = localStorage.getItem(NOTIFY_LIST_KEY);
      currentSelectedFruits = new Set<string>(
        savedList ? JSON.parse(savedList) as string[] : []
      );
    } catch (e) {
      currentSelectedFruits = new Set();
    }
    
    if (!audioUnlocked || currentSelectedFruits.size === 0) {
      console.log("⏸️ Timer pausado:", { 
        audioDesbloqueado: audioUnlocked, 
        temSeleção: currentSelectedFruits.size > 0 
      });
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    console.log("⏰ Timer de 30s ativado");

    // Verificação inicial
    checkStockChanges();
    
    // Timer de 30 segundos
    intervalRef.current = setInterval(() => {
      console.log("⏰ Timer disparado (30s)");
      checkStockChanges();
    }, 30000);

    return () => {
      console.log("🛑 Timer de 30s desativado");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [audioUnlocked, selectedFruitsState, checkStockChanges]);

  // BroadcastChannel para detectar atualizações da página principal
  useEffect(() => {
    if (!audioUnlocked) {
      console.log("📡 BroadcastChannel em espera (áudio bloqueado)");
      return;
    }

    try {
      broadcastChannelRef.current = new BroadcastChannel('stock-update-channel');

      const handleMessage = (event: MessageEvent) => {
        console.log("📡 Broadcast recebido do page.tsx:", event.data);
        
        // Usa debounce para evitar múltiplas chamadas
        if (canCheckNow()) {
          checkStockChanges();
        } else {
          console.log("⏳ Broadcast ignorado (debounce ativo)");
        }
      };

      console.log("📡 BroadcastChannel ativo, escutando...");
      broadcastChannelRef.current.addEventListener('message', handleMessage);
      
      return () => {
        console.log("📡 BroadcastChannel desativado");
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.removeEventListener('message', handleMessage);
          broadcastChannelRef.current.close();
          broadcastChannelRef.current = null;
        }
      };
    } catch (error) {
      console.error("Erro ao configurar BroadcastChannel:", error);
    }
  }, [checkStockChanges, audioUnlocked]);

  const toggleFruitSelection = (fruitName: string) => { 
    let currentSelected: Set<string>;
    try {
      const currentSavedList = localStorage.getItem(NOTIFY_LIST_KEY);
      currentSelected = new Set<string>(
        currentSavedList ? JSON.parse(currentSavedList) as string[] : []
      );
    } catch (e) {
      currentSelected = new Set();
    }

    if (currentSelected.has(fruitName)) {
      currentSelected.delete(fruitName);
      console.log(`➖ Removido: ${fruitName}`);
    } else {
      currentSelected.add(fruitName);
      console.log(`➕ Adicionado: ${fruitName}`);
    }

    const listArray = Array.from(currentSelected);
    try {
      localStorage.setItem(NOTIFY_LIST_KEY, JSON.stringify(listArray));
      setSelectedFruitsState(currentSelected);
      console.log(`💾 Seleção atualizada:`, listArray);
    } catch (e) {
      console.error("Erro ao salvar seleção", e);
    }
  };
  
  const primeAudioOnClick = () => { 
    if (audioRef.current && !audioUnlocked) {
      audioRef.current.play()
        .then(() => { 
          if (audioRef.current) { 
            audioRef.current.pause(); 
            audioRef.current.currentTime = 0; 
          } 
          setAudioUnlocked(true); 
          setShowAudioBanner(false); 
          console.log("✅ Áudio desbloqueado ao salvar!"); 
        })
        .catch(() => { 
          console.warn("❌ Falha ao desbloquear ao salvar."); 
        });
    }
  };

  const saveNotifications = async () => { 
    console.log("💾 Salvando configurações de notificação...");
    
    try {
      const response = await fetch("/api/stock");
      if (response.ok) {
        const data: ApiResponse = await response.json();
        const currentStockTimestamp = data.reportedAt;
        const currentStockKey = String(currentStockTimestamp);
        
        // Marca o stock atual como já processado (sem tocar som)
        if (!wasAlreadyNotified(currentStockKey)) {
          addNotifiedStock(currentStockKey);
          lastProcessedStockTimestamp.current = currentStockTimestamp;
          console.log("✅ Stock atual marcado como processado:", currentStockKey);
        }
      }
    } catch (error) {
      console.error("Erro ao marcar estoque atual:", error);
    }
    
    if (!audioUnlocked) { 
      primeAudioOnClick(); 
    }
    
    setIsModalOpen(false);
    console.log("✅ Configurações salvas!");
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
      
      <button 
        className="nav-icon-btn" 
        onClick={() => setIsModalOpen(true)} 
        title="Configurar Notificações" 
        aria-label="Configurar Notificações"
      >
        <Bell size={20} />
        {selectedFruitsState.size > 0 && (
          <span className="notification-badge">{selectedFruitsState.size}</span>
        )}
      </button>
      
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Notificar-me:</h2>
              <button 
                className="modal-close" 
                onClick={() => setIsModalOpen(false)} 
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <p className="modal-description">
                Selecione as sementes que deseja monitorar. Você será notificado quando elas aparecerem no estoque.
              </p>
              
              <div className="fruit-list">
                {AVAILABLE_SEEDS.map((fruitName) => (
                  <button 
                    key={fruitName} 
                    type="button" 
                    className={`fruit-item ${selectedFruitsState.has(fruitName) ? "selected" : ""}`} 
                    onClick={() => toggleFruitSelection(fruitName)}
                  >
                    <img 
                      src={getImageSrc(fruitName)} 
                      alt={fruitName} 
                      width={32} 
                      height={32} 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/items/Default.webp";
                      }}
                    />
                    <span>{fruitName}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={saveNotifications}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      
      <audio ref={audioRef} src="/notification.wav" preload="auto" />
    </>
  );
}