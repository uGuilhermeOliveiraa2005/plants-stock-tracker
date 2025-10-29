"use client";

import { useEffect, useRef } from "react";

// Tipos da API /api/stock
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

const STORAGE_KEY = "pvb-notif-items";
const RETRY_ON_ERROR_MS = 60000; // 1 minuto
const API_BUFFER_MS = 10000; // 10s de "gordura" (tempo para API atualizar)
const API_POLL_LATE_MS = 15000; // Se API atrasar, checa a cada 15s

export default function NotificationManager() { 
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initialCheckCompleted = useRef<boolean>(false); 
  const audioUnlocked = useRef<boolean>(false); 

  // 1. Setup inicial (Roda uma vez)
  useEffect(() => {
    // Pede permissão para Notificações visuais
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Carrega o áudio
    audioRef.current = new Audio("/notification.wav");
    audioRef.current.volume = 0.5;
    audioRef.current.load();

    // "Prime" do Áudio (Ouvinte de clique)
    const primeAudio = () => { /* ... (lógica igual) ... */ 
      if (audioRef.current && !audioUnlocked.current) {
        audioRef.current.play()
          .then(() => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            audioUnlocked.current = true;
            console.log("Áudio desbloqueado pelo usuário.");
            document.removeEventListener("click", primeAudio);
            document.removeEventListener("touchend", primeAudio);
          })
          .catch(() => {
            console.warn("Tentativa de desbloquear áudio falhou (normal na 1ª vez).");
          });
      }
    };
    document.addEventListener("click", primeAudio);
    document.addEventListener("touchend", primeAudio);
    
    // Inicia o loop de checagem
    scheduleNextCheck();

    // Função de limpeza
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("click", primeAudio);
      document.removeEventListener("touchend", primeAudio);
    };
  }, []); // Roda só uma vez

  
  // 2. Função Principal de Checagem
  const checkStock = async () => {
    console.log("Verificando estoque...");
    try {
      // 1. Pega as escolhas do usuário do localStorage
      const savedItems = localStorage.getItem(STORAGE_KEY);
      // --- CORREÇÃO DE TIPO AQUI ---
      const selectedItemsArray: string[] = savedItems ? JSON.parse(savedItems) as string[] : [];
      const selectedItems = new Set<string>(selectedItemsArray); // Garante que o Set é de strings
      // --- FIM DA CORREÇÃO ---
      
      // 2. Busca o estoque ATUAL
      const response = await fetch("/api/stock");
      if (!response.ok) throw new Error("Falha ao buscar estoque");
      
      const data: ApiResponse = await response.json();

      // 3. Pega os nomes dos itens em estoque
      const stockedItems = new Set<string>([ // Garante que o Set é de strings
        ...data.seeds.map((s) => s.name),
        ...data.gear.map((g) => g.name),
      ]);

      // 4. Verifica se algum item selecionado está no estoque
      let matchFound = false;
      const matches: string[] = []; // Garante que matches é string[]
      if (selectedItems.size > 0) {
        for (const selected of selectedItems) {
          if (stockedItems.has(selected)) {
            matchFound = true;
            matches.push(selected); // Adiciona ao array de strings
            // break; // Removemos o break para pegar TODOS os matches
          }
        }
      }

      // 5. LÓGICA DE NOTIFICAÇÃO
      if (matchFound && initialCheckCompleted.current) {
        console.log("ITEM DESEJADO ENCONTRADO!", matches);
        // --- CORREÇÃO DE TIPO AQUI (embora já corrigido acima) ---
        triggerNotification(matches); // Passa o array de strings
      } else if (initialCheckCompleted.current) {
         console.log("Estoque checado, nenhum item desejado encontrado.");
      } else {
         console.log("Checagem inicial de estoque concluída. Notificações ativadas para a próxima atualização.");
      }

      // 6. Marca que a primeira checagem foi feita
      initialCheckCompleted.current = true;

      // 7. Retorna o timestamp da próxima atualização para agendamento
      return data.nextUpdateAt;

    } catch (error) {
      console.error("Erro ao checar estoque:", error);
      return null;
    }
  };

  // 3. Função de Agendamento (Sem alteração)
  const scheduleNextCheck = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const nextUpdateTimestamp = await checkStock();
    let nextDelay = RETRY_ON_ERROR_MS;
    if (nextUpdateTimestamp) {
        const timeUntilNextUpdate = (nextUpdateTimestamp + API_BUFFER_MS) - Date.now();
        nextDelay = Math.max(timeUntilNextUpdate, API_POLL_LATE_MS); 
    }
    console.log(`Próxima checagem agendada em ${Math.round(nextDelay / 1000)}s`);
    timerRef.current = setTimeout(scheduleNextCheck, nextDelay);
  };


  // 4. Função que Toca o Som e Mostra a Notificação
  // --- GARANTE QUE O PARÂMETRO É string[] ---
  const triggerNotification = (matches: string[]) => { 
    if (audioUnlocked.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Erro ao tocar áudio:", e));
    } else if (!audioUnlocked.current) {
        console.warn("Tentativa de notificação, mas o áudio não foi desbloqueado pelo usuário.");
    }

    if (Notification.permission === "granted") {
      const title = "Item Desejado no Estoque!";
      const body = `Itens encontrados: ${matches.join(", ")}`;
      new Notification(title, {
        body: body,
        icon: "/images/items/Mango-seed.webp",
      });
    }
  };

  return null;
}