"use client";

import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";

interface ShopItem {
  name: string;
  qty: number;
  emoji: string;
}

interface ApiResponse {
  reportedAt: number;
  nextUpdateAt: number;
  seeds: ShopItem[];
  gear: ShopItem[];
}

const NOTIFY_LIST_KEY = "pvbNotifyList";
const NOTIFIED_STOCKS_KEY = "pvbNotifiedStocks";
const MAX_HISTORY = 50;

const AVAILABLE_SEEDS = [
  "King Limone", "Mango", "Shroombino", "Tomatrio", "Mr Carrot",
  "Carnivorous Plant", "Cocotank", "Grape", "Watermelon", "Eggplant",
  "Dragon Fruit", "Sunflower", "Pumpkin", "Strawberry", "Cactus",
];

// --- Funções de Histórico (sem alteração nos logs) ---
const getNotifiedStocks = (): Set<string> => { /* ... (código igual) ... */ 
  try {
    const saved = localStorage.getItem(NOTIFIED_STOCKS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      console.log("📜 Histórico lido:", parsed);
      return new Set(parsed);
    }
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
  }
  console.log("📜 Histórico não encontrado ou vazio.");
  return new Set();
};

const addNotifiedStock = (stockKey: string): void => { /* ... (código igual) ... */ 
  try {
    const historySet = getNotifiedStocks();
    historySet.add(stockKey);
    const historyArray = Array.from(historySet);
    const trimmedHistory = historyArray.slice(-MAX_HISTORY);
    localStorage.setItem(NOTIFIED_STOCKS_KEY, JSON.stringify(trimmedHistory));
    console.log("💾 Histórico salvo:", trimmedHistory);
  } catch (error) {
    console.error("Erro ao salvar histórico:", error);
  }
};

const wasAlreadyNotified = (stockKey: string): boolean => { /* ... (código igual) ... */ 
  const history = getNotifiedStocks();
  return history.has(stockKey);
};

export default function NotificationManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Mantemos o state para a UI do modal, mas não o usamos na lógica de checagem
  const [selectedFruitsState, setSelectedFruitsState] = useState<Set<string>>(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showAudioBanner, setShowAudioBanner] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastProcessedStockTimestamp = useRef<number>(0); 
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Carrega a lista salva do localStorage PARA O STATE (para a UI)
  useEffect(() => {
    const savedList = localStorage.getItem(NOTIFY_LIST_KEY);
    if (savedList) {
      try {
        const parsed = JSON.parse(savedList) as string[];
        setSelectedFruitsState(new Set(parsed)); // Atualiza o state
        console.log("Lista de notificações (state) carregada:", parsed);
      } catch (error) {
        console.error("Erro ao carregar lista (state):", error);
      }
    }
    // (O resto do setup inicial igual)
    audioRef.current = new Audio("/notification.wav"); /*...*/
    audioRef.current.volume = 0.5;
    audioRef.current.load();
    const primeAudio = () => { /* ... */ 
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
    return () => { document.removeEventListener("click", primeAudio); document.removeEventListener("touchend", primeAudio); };
  }, [audioUnlocked]);

  // Monitora mudanças no estoque (LÓGICA REFINADA)
  useEffect(() => {
    // --- LÊ A SELEÇÃO DO LOCALSTORAGE AQUI ---
    const savedList = localStorage.getItem(NOTIFY_LIST_KEY);
    const currentSelectedFruits = new Set<string>(savedList ? JSON.parse(savedList) as string[] : []);
    
    // Se áudio bloqueado OU lista vazia, para tudo
    if (!audioUnlocked || currentSelectedFruits.size === 0) {
      console.log("Notificações em espera:", { audioUnlocked, listaVazia: currentSelectedFruits.size === 0 });
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    console.log("🚀 Iniciando/Reiniciando monitoramento de estoque...");

    const checkStockChanges = async () => {
      try {
        const response = await fetch("/api/stock");
        if (!response.ok) { console.warn("Falha /api/stock"); return; }
        const data: ApiResponse = await response.json();
        const currentStockTimestamp = data.reportedAt;
        const currentStockKey = String(currentStockTimestamp);

        // --- CHECAGEM 1: JÁ PROCESSAMOS ESTE ESTOQUE? ---
        if (currentStockTimestamp === lastProcessedStockTimestamp.current) {
          // console.log(`Stock ${currentStockTimestamp} já processado.`); // Log opcional (muito frequente)
          return; 
        }

        // --- NOVO ESTOQUE ---
        console.log("🆕 Novo estoque detectado!", { anterior: lastProcessedStockTimestamp.current, novo: currentStockTimestamp });
        lastProcessedStockTimestamp.current = currentStockTimestamp; // Marca como processado

        // --- CHECAGEM 2: JÁ NOTIFICAMOS ESTE ESTOQUE ANTES? ---
        if (wasAlreadyNotified(currentStockKey)) {
          console.log(`⏭️ Estoque ${currentStockKey} JÁ notificado anteriormente. Pulando.`);
          return;
        }
        
        // --- CHECAGEM 3: HÁ MATCH COM A SELEÇÃO *ATUAL*? ---
        // Lê a seleção FRESCA do localStorage DENTRO da função
        const freshSavedList = localStorage.getItem(NOTIFY_LIST_KEY);
        const freshSelectedItems = new Set<string>(freshSavedList ? JSON.parse(freshSavedList) as string[] : []);

        if (freshSelectedItems.size === 0) {
            console.log("Seleção ficou vazia. Pulando match.");
            return; // Sai se o usuário desmarcou tudo enquanto esperava
        }

        const seedsInStock = data.seeds.map((seed) => seed.name);
        const matchedFruits: string[] = [];
        for (const selectedFruit of freshSelectedItems) {
          if (seedsInStock.includes(selectedFruit)) {
            matchedFruits.push(selectedFruit);
          }
        }

        // --- NOTIFICAR E MARCAR ---
        if (matchedFruits.length > 0) {
          console.log("🔔 Tocando notificação para:", matchedFruits);
          playNotificationSound();
          addNotifiedStock(currentStockKey); // Marca como notificado
        } else {
          console.log("❌ Nenhuma fruta selecionada encontrada neste novo estoque.");
          // Não marca como notificado se não houve match
        }
      } catch (error) {
        console.error("Erro ao verificar estoque:", error);
      }
    };

    // Verifica imediatamente ao iniciar/reiniciar o monitoramento
    checkStockChanges(); 
    // Depois verifica a cada 30 segundos
    intervalRef.current = setInterval(checkStockChanges, 30000);

    // Função de limpeza do monitoramento
    return () => {
        console.log("🛑 Parando monitoramento de estoque.");
        if (intervalRef.current) clearInterval(intervalRef.current);
    }
  // Re-executa este efeito se o áudio for desbloqueado ou a SELEÇÃO DO STATE mudar
  // A mudança no state (via modal) força o reinício do useEffect, que lê o localStorage atualizado
  }, [audioUnlocked, selectedFruitsState]); 

  // --- Funções de UI (Modal, Som, Salvar) ---
  
  const playNotificationSound = () => { /* ... (lógica igual) ... */ 
      if (!audioRef.current) return;
      if (!audioUnlocked) { console.warn("⚠️ Áudio bloqueado"); setShowAudioBanner(true); return; }
      console.log("🔊 Tocando..."); audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise) { playPromise.then(() => console.log("✅ Som OK!")).catch((error) => { console.warn("❌ Falha Play:", error); setAudioUnlocked(false); setShowAudioBanner(true); }); }
  };

  // Atualiza o STATE E o localStorage
  const toggleFruitSelection = (fruitName: string) => { 
    const currentSavedList = localStorage.getItem(NOTIFY_LIST_KEY);
    const currentSelected = new Set<string>(currentSavedList ? JSON.parse(currentSavedList) as string[] : []);

    if (currentSelected.has(fruitName)) {
        currentSelected.delete(fruitName);
    } else {
        currentSelected.add(fruitName);
    }
    const listArray = Array.from(currentSelected);
    localStorage.setItem(NOTIFY_LIST_KEY, JSON.stringify(listArray));
    setSelectedFruitsState(currentSelected); // Atualiza o state para UI e para re-rodar o useEffect
    console.log(`Seleção atualizada no storage e state:`, listArray);
  };

  // Apenas fecha o modal e tenta desbloquear áudio
  const saveNotifications = () => { 
    console.log("💾 Modal Salvo (storage já foi atualizado ao clicar).");
    if (!audioUnlocked) { 
      primeAudioOnClick(); 
    }
    setIsModalOpen(false);
  };
  
  const primeAudioOnClick = () => { /* ... (lógica igual) ... */ 
    if (audioRef.current && !audioUnlocked) {
         audioRef.current.play().then(() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } setAudioUnlocked(true); setShowAudioBanner(false); console.log("✅ Áudio desbloqueado ao salvar!"); }).catch(() => { console.warn("❌ Falha ao desbloquear ao salvar."); });
      }
  };

  const getImageSrc = (name: string): string => { /* ... (lógica igual) ... */ 
      const formattedName = name.toLowerCase().replace(/ /g, "-");
      return `/images/items/${formattedName}-seed.webp`;
  };

  // --- JSX (Renderização - Nenhuma mudança aqui) ---
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