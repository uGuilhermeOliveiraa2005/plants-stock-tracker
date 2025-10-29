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
const LAST_NOTIFIED_KEY = "pvbLastNotified"; // Armazena quando foi a última notificação

// Lista completa de sementes disponíveis
const AVAILABLE_SEEDS = [
  "King Limone",
  "Mango",
  "Shroombino",
  "Tomatrio",
  "Mr Carrot",
  "Carnivorous Plant",
  "Cocotank",
  "Grape",
  "Watermelon",
  "Eggplant",
  "Dragon Fruit",
  "Sunflower",
  "Pumpkin",
  "Strawberry",
  "Cactus",
];

export default function NotificationManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFruits, setSelectedFruits] = useState<Set<string>>(new Set());
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showAudioBanner, setShowAudioBanner] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastStockDataRef = useRef<string>("");
  const hasNotifiedForCurrentStock = useRef<boolean>(false);

  // Carrega a lista salva do localStorage
  useEffect(() => {
    const savedList = localStorage.getItem(NOTIFY_LIST_KEY);
    if (savedList) {
      try {
        const parsed = JSON.parse(savedList);
        setSelectedFruits(new Set(parsed));
        console.log("Lista de notificações carregada:", parsed);
      } catch (error) {
        console.error("Erro ao carregar lista de notificações:", error);
      }
    }
  }, []);

  // Monitora mudanças no estoque
  useEffect(() => {
    // SE não tiver áudio desbloqueado OU lista vazia, não faz nada
    if (!audioUnlocked || selectedFruits.size === 0) {
      console.log("Notificações desabilitadas:", {
        audioUnlocked,
        listaVazia: selectedFruits.size === 0,
      });
      return;
    }

    const checkStockChanges = async () => {
      try {
        const response = await fetch("/api/stock");
        if (!response.ok) return;

        const data: ApiResponse = await response.json();
        const currentStockKey = `${data.reportedAt}`;

        // Se é a mesma atualização, ignora
        if (currentStockKey === lastStockDataRef.current) {
          return;
        }

        // NOVO ESTOQUE DETECTADO!
        console.log("🆕 Novo estoque detectado!", {
          anterior: lastStockDataRef.current,
          novo: currentStockKey,
        });

        // Atualiza o timestamp da última verificação
        lastStockDataRef.current = currentStockKey;
        hasNotifiedForCurrentStock.current = false; // Reseta o flag de notificação

        // Verifica no localStorage se já notificamos para este reportedAt
        const lastNotified = localStorage.getItem(LAST_NOTIFIED_KEY);
        if (lastNotified === currentStockKey) {
          console.log("⏭️ Já notificamos para este estoque antes (via localStorage)");
          hasNotifiedForCurrentStock.current = true;
          return;
        }

        // Verifica se alguma fruta selecionada está no estoque
        const seedsInStock = data.seeds.map((seed) => seed.name);
        const matchedFruits: string[] = [];

        console.log("Verificando estoque:", {
          seedsNoEstoque: seedsInStock,
          frutasSelecionadas: Array.from(selectedFruits),
        });

        // Para cada fruta SELECIONADA, verifica se está no estoque
        for (const selectedFruit of selectedFruits) {
          if (seedsInStock.includes(selectedFruit)) {
            matchedFruits.push(selectedFruit);
            console.log(`✅ Match encontrado: ${selectedFruit}`);
          }
        }

        // Se encontrou algum match E ainda não notificou
        if (matchedFruits.length > 0 && !hasNotifiedForCurrentStock.current) {
          console.log("🔔 Tocando notificação para:", matchedFruits);
          playNotificationSound();
          
          // Marca como notificado
          hasNotifiedForCurrentStock.current = true;
          localStorage.setItem(LAST_NOTIFIED_KEY, currentStockKey);
          console.log("💾 Salvou notificação no localStorage:", currentStockKey);
        } else if (matchedFruits.length === 0) {
          console.log("❌ Nenhuma fruta selecionada encontrada no estoque");
        }
      } catch (error) {
        console.error("Erro ao verificar estoque:", error);
      }
    };

    // Verifica imediatamente
    checkStockChanges();

    // Depois verifica a cada 30 segundos
    const interval = setInterval(checkStockChanges, 30000);

    return () => clearInterval(interval);
  }, [audioUnlocked, selectedFruits]);

  const unlockAudio = () => {
    console.log("Desbloqueando áudio...");
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          audioRef.current!.pause();
          audioRef.current!.currentTime = 0;
          setAudioUnlocked(true);
          setShowAudioBanner(false);
          console.log("✅ Áudio desbloqueado com sucesso!");
        })
        .catch((e) => {
          console.warn("❌ Erro ao desbloquear áudio:", e);
        });
    }
  };

  const playNotificationSound = () => {
    if (!audioRef.current || !audioUnlocked) {
      console.warn("⚠️ Áudio não está pronto para tocar");
      return;
    }

    console.log("🔊 Tocando som de notificação...");
    audioRef.current.currentTime = 0;
    
    // Tenta tocar o áudio
    const playPromise = audioRef.current.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log("✅ Som tocado com sucesso!");
        })
        .catch((error) => {
          console.warn("❌ Não foi possível tocar o som:", error);
          setShowAudioBanner(true);
          setAudioUnlocked(false);
        });
    }
  };

  const toggleFruitSelection = (fruitName: string) => {
    setSelectedFruits((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fruitName)) {
        newSet.delete(fruitName);
        console.log(`➖ Removido: ${fruitName}`);
      } else {
        newSet.add(fruitName);
        console.log(`➕ Adicionado: ${fruitName}`);
      }
      return newSet;
    });
  };

  const saveNotifications = () => {
    const listArray = Array.from(selectedFruits);
    localStorage.setItem(NOTIFY_LIST_KEY, JSON.stringify(listArray));
    console.log("💾 Lista salva:", listArray);

    if (!audioUnlocked) {
      unlockAudio();
    }

    setIsModalOpen(false);
  };

  const getImageSrc = (name: string): string => {
    const formattedName = name.toLowerCase().replace(/ /g, "-");
    return `/images/items/${formattedName}-seed.webp`;
  };

  return (
    <>
      {/* Banner de Desbloqueio de Áudio */}
      {showAudioBanner && (
        <div className="audio-banner" onClick={unlockAudio}>
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
                Selecione as sementes raras que você deseja monitorar. Você
                será notificado com um som quando aparecerem na loja.
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