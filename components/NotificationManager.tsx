"use client";

import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";

interface ShopItem {
  name: string;
  qty: number;
  emoji: string;
}

interface ApiResponse {
  reportedAt: number; // Usaremos reportedAt como a chave única do estoque
  nextUpdateAt: number;
  seeds: ShopItem[];
  gear: ShopItem[];
}

const NOTIFY_LIST_KEY = "pvbNotifyList";
const NOTIFIED_STOCKS_KEY = "pvbNotifiedStocks";
const MAX_HISTORY = 50;

// Lista completa de sementes disponíveis
const AVAILABLE_SEEDS = [
  "King Limone", "Mango", "Shroombino", "Tomatrio", "Mr Carrot",
  "Carnivorous Plant", "Cocotank", "Grape", "Watermelon", "Eggplant",
  "Dragon Fruit", "Sunflower", "Pumpkin", "Strawberry", "Cactus",
];

// --- FUNÇÕES DE HISTÓRICO REFINADAS COM LOGS ---
const getNotifiedStocks = (): Set<string> => {
  try {
    const saved = localStorage.getItem(NOTIFIED_STOCKS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as string[]; // Garante que é string[]
      console.log("📜 Histórico lido:", parsed);
      return new Set(parsed);
    }
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
  }
  console.log("📜 Histórico não encontrado ou vazio.");
  return new Set();
};

const addNotifiedStock = (stockKey: string): void => {
  try {
    // Lê o histórico ATUAL antes de adicionar
    const historySet = getNotifiedStocks();
    historySet.add(stockKey);
    
    const historyArray = Array.from(historySet);
    const trimmedHistory = historyArray.slice(-MAX_HISTORY); // Limita tamanho
    
    localStorage.setItem(NOTIFIED_STOCKS_KEY, JSON.stringify(trimmedHistory));
    console.log("💾 Histórico salvo:", trimmedHistory);
  } catch (error) {
    console.error("Erro ao salvar histórico:", error);
  }
};

// Não precisa de log aqui, pois getNotifiedStocks já loga
const wasAlreadyNotified = (stockKey: string): boolean => {
  const history = getNotifiedStocks();
  return history.has(stockKey);
};
// --- FIM DAS FUNÇÕES DE HISTÓRICO ---

export default function NotificationManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFruits, setSelectedFruits] = useState<Set<string>>(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showAudioBanner, setShowAudioBanner] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Ref para o *timestamp* do último estoque PROCESSADO (não necessariamente notificado)
  const lastProcessedStockTimestamp = useRef<number>(0); 
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // Ref para o interval

  // Carrega a lista salva do localStorage
  useEffect(() => {
    const savedList = localStorage.getItem(NOTIFY_LIST_KEY);
    if (savedList) {
      try {
        const parsed = JSON.parse(savedList) as string[];
        setSelectedFruits(new Set(parsed));
        console.log("Lista de notificações carregada:", parsed);
      } catch (error) {
        console.error("Erro ao carregar lista de notificações:", error);
      }
    }
    
    // Configura o áudio
    audioRef.current = new Audio("/notification.wav");
    audioRef.current.volume = 0.5;
    audioRef.current.load();

    // Listener para desbloquear áudio (apenas se não estiver desbloqueado)
    const primeAudio = () => { /* ... (lógica igual) ... */ 
       if (audioRef.current && !audioUnlocked) { // Usa o state audioUnlocked
        audioRef.current.play()
          .then(() => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            setAudioUnlocked(true); // Atualiza o state
            setShowAudioBanner(false); // Esconde o banner
            console.log("✅ Áudio desbloqueado com sucesso!");
            document.removeEventListener("click", primeAudio);
            document.removeEventListener("touchend", primeAudio);
          })
          .catch((e) => {
            console.warn("❌ Erro ao desbloquear áudio (normal na 1ª vez):", e);
          });
      }
    };
    
    // Só adiciona o listener se o áudio não estiver desbloqueado
     if (!audioUnlocked) {
        document.addEventListener("click", primeAudio);
        document.addEventListener("touchend", primeAudio);
     } else {
        setShowAudioBanner(false); // Já está desbloqueado, esconde banner
     }

    // Função de limpeza do setup
    return () => {
      document.removeEventListener("click", primeAudio);
      document.removeEventListener("touchend", primeAudio);
    };

  }, [audioUnlocked]); // Re-executa se audioUnlocked mudar (para remover listeners)

  // Monitora mudanças no estoque (LÓGICA REFINADA)
  useEffect(() => {
    // SE não tiver áudio desbloqueado, NÃO FAZ NADA (não inicia o timer)
    if (!audioUnlocked) {
      console.log("Notificações em espera (áudio bloqueado).");
      // Garante que qualquer timer antigo seja limpo se o áudio for bloqueado de novo
      if (intervalRef.current) clearInterval(intervalRef.current); 
      return; 
    }
    
    // Se a lista estiver vazia, NÃO FAZ NADA (não inicia o timer)
    if (selectedFruits.size === 0) {
        console.log("Notificações em espera (nenhum item selecionado).");
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
    }

    console.log("🚀 Iniciando monitoramento de estoque...");

    const checkStockChanges = async () => {
      try {
        const response = await fetch("/api/stock");
        if (!response.ok) {
            console.warn("Falha ao buscar /api/stock, tentando novamente...");
            return; // Sai da função, o interval vai tentar de novo
        }

        const data: ApiResponse = await response.json();
        const currentStockTimestamp = data.reportedAt; // Chave única do estoque

        // Se é a mesma atualização que já PROCESSAMOS, ignora
        if (currentStockTimestamp === lastProcessedStockTimestamp.current) {
          console.log(`Stock ${currentStockTimestamp} já processado. Aguardando próximo.`);
          return; 
        }

        // NOVO ESTOQUE DETECTADO!
        console.log("🆕 Novo estoque detectado!", {
          anterior: lastProcessedStockTimestamp.current,
          novo: currentStockTimestamp,
        });

        // Atualiza o timestamp do último estoque PROCESSADO
        lastProcessedStockTimestamp.current = currentStockTimestamp;

        // Verifica se JÁ NOTIFICAMOS sobre ESTE estoque específico
        if (wasAlreadyNotified(String(currentStockTimestamp))) { // Converte para string
          console.log(`⏭️ Estoque ${currentStockTimestamp} JÁ notificado anteriormente. Pulando.`);
          return;
        }

        // Verifica se alguma fruta selecionada está no estoque
        const seedsInStock = data.seeds.map((seed) => seed.name);
        const matchedFruits: string[] = [];
        const currentSelected = new Set(selectedFruits); // Pega a seleção atual

        // Para cada fruta SELECIONADA, verifica se está no estoque
        for (const selectedFruit of currentSelected) {
          if (seedsInStock.includes(selectedFruit)) {
            matchedFruits.push(selectedFruit);
          }
        }

        // Se encontrou algum match, notifica E MARCA
        if (matchedFruits.length > 0) {
          console.log("🔔 Tocando notificação para:", matchedFruits);
          playNotificationSound();
          
          // MARCA ESTE estoque como notificado
          addNotifiedStock(String(currentStockTimestamp)); // Converte para string
        } else {
          console.log("❌ Nenhuma fruta selecionada encontrada no estoque atual.");
          // Mesmo sem match, marcamos como processado (já feito acima)
          // e adicionamos ao histórico para não re-checar se não houver match de novo
          addNotifiedStock(String(currentStockTimestamp)); 
        }
      } catch (error) {
        console.error("Erro ao verificar estoque:", error);
      }
    };

    // Verifica imediatamente ao iniciar o monitoramento
    checkStockChanges(); 

    // Depois verifica a cada 30 segundos
    intervalRef.current = setInterval(checkStockChanges, 30000);

    // Função de limpeza do monitoramento
    return () => {
        console.log("🛑 Parando monitoramento de estoque.");
        if (intervalRef.current) clearInterval(intervalRef.current);
    }
  // Re-executa este efeito se o áudio for desbloqueado ou a seleção mudar
  }, [audioUnlocked, selectedFruits]); 

  // --- Funções de UI (Modal, Som, Salvar) ---
  
  // (Função playNotificationSound ligeiramente ajustada para robustez)
  const playNotificationSound = () => {
    if (!audioRef.current) {
        console.error("AudioRef não está definido!");
        return;
    }
    if (!audioUnlocked) { // Checa o state
      console.warn("⚠️ Áudio não está desbloqueado para tocar");
      setShowAudioBanner(true); // Mostra o banner se tentar tocar bloqueado
      return;
    }

    console.log("🔊 Tocando som de notificação...");
    audioRef.current.currentTime = 0;
    const playPromise = audioRef.current.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => console.log("✅ Som tocado com sucesso!"))
        .catch((error) => {
          console.warn("❌ Não foi possível tocar o som:", error);
          // Se falhar (ex: usuário revogou permissão?), bloqueia de novo
          setAudioUnlocked(false); 
          setShowAudioBanner(true);
        });
    }
  };

  const toggleFruitSelection = (fruitName: string) => { /* ... (lógica igual) ... */ 
    setSelectedFruits((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fruitName)) {
        newSet.delete(fruitName);
      } else {
        newSet.add(fruitName);
      }
      return newSet;
    });
  };

  const saveNotifications = () => { /* ... (lógica igual) ... */ 
    const listArray = Array.from(selectedFruits);
    localStorage.setItem(NOTIFY_LIST_KEY, JSON.stringify(listArray));
    console.log("💾 Lista salva:", listArray);
    // Tenta desbloquear o áudio se ainda não estiver, ao salvar
    if (!audioUnlocked) { 
      primeAudioOnClick(); // Chama uma função específica para o botão salvar
    }
    setIsModalOpen(false);
  };
  
  // Função para tentar desbloquear áudio no clique do botão Salvar
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
            console.warn("❌ Falha ao desbloquear áudio ao salvar.");
          });
      }
  };


  const getImageSrc = (name: string): string => { /* ... (lógica igual) ... */ 
      const formattedName = name.toLowerCase().replace(/ /g, "-");
      return `/images/items/${formattedName}-seed.webp`;
  };

  // --- JSX (Renderização) ---
  return (
    <>
      {/* Banner de Desbloqueio de Áudio */}
      {showAudioBanner && !audioUnlocked && ( // Mostra só se precisar
        <div className="audio-banner" onClick={primeAudioOnClick}> {/* Usa a função específica */}
          <Bell size={20} />
          <span>Clique aqui para ativar as notificações sonoras</span>
        </div>
      )}

      {/* Botão de Notificações no Navbar */}
      <button
        className="nav-icon-btn"
        onClick={() => setIsModalOpen(true)}
        title="Configurar Notificações"
        aria-label="Configurar Notificações"
      >
        <Bell size={20} />
        {selectedFruits.size > 0 && (
          <span className="notification-badge">{selectedFruits.size}</span>
        )}
      </button>

      {/* Modal de Seleção */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Notificar-me quando aparecer:</h2>
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
                Selecione as sementes que você deseja monitorar.
              </p>
              <div className="fruit-list">
                {AVAILABLE_SEEDS.map((fruitName) => (
                  <button
                    key={fruitName}
                    type="button"
                    className={`fruit-item ${
                      selectedFruits.has(fruitName) ? "selected" : ""
                    }`}
                    onClick={() => toggleFruitSelection(fruitName)}
                  >
                    <img
                      src={getImageSrc(fruitName)}
                      alt={fruitName}
                      width={32}
                      height={32}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/images/items/Default.webp";
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
              <button className="btn-primary" onClick={saveNotifications}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elemento de Áudio */}
      <audio ref={audioRef} src="/notification.wav" preload="auto" />
    </>
  );
}