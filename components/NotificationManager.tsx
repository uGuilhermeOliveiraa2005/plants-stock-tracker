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
    if (!audioUnlocked || selectedFruits.size === 0) {
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

        // Atualiza o timestamp da última verificação
        lastStockDataRef.current = currentStockKey;

        // Verifica se alguma fruta selecionada está no estoque
        const seedsInStock = new Set(data.seeds.map((seed) => seed.name));
        let matchFound = false;

        for (const fruit of selectedFruits) {
          if (seedsInStock.has(fruit)) {
            matchFound = true;
            console.log(`Notificação! Fruta encontrada: ${fruit}`);
            break;
          }
        }

        if (matchFound) {
          playNotificationSound();
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
          console.log("Áudio desbloqueado com sucesso!");
        })
        .catch((e) => {
          console.warn("Erro ao desbloquear áudio:", e);
        });
    }
  };

  const playNotificationSound = () => {
    if (!audioRef.current || !audioUnlocked) {
      console.warn("Áudio não está pronto para tocar");
      return;
    }

    console.log("Tocando som de notificação...");
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((error) => {
      console.warn("Não foi possível tocar o som:", error);
      setShowAudioBanner(true);
    });
  };

  const toggleFruitSelection = (fruitName: string) => {
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

  const saveNotifications = () => {
    const listArray = Array.from(selectedFruits);
    localStorage.setItem(NOTIFY_LIST_KEY, JSON.stringify(listArray));
    console.log("Lista salva:", listArray);

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