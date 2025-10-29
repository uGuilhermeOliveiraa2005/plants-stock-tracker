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

// --- REMOVEMOS a prop isIOS ---
export default function NotificationManager() { 
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref para saber se já fizemos a primeira checagem (evitar notificação no load)
  const initialCheckCompleted = useRef<boolean>(false); 

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
    const primeAudio = () => { /* ... (lógica igual, não precisa mexer) ... */
      if (audioRef.current) {
        audioRef.current.play()
          .then(() => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            console.log("Áudio desbloqueado.");
            document.removeEventListener("click", primeAudio);
            document.removeEventListener("touchend", primeAudio);
          })
          .catch(() => {});
      }
    };
    document.addEventListener("click", primeAudio);
    document.addEventListener("touchend", primeAudio);
    
    // --- LÓGICA DE TIMER E FETCH (SEM WORKERS) ---
    // Inicia o loop de checagem imediatamente
    checkAndNotify();

    // --- Função de limpeza ---
    return () => {
      // Limpa o timer quando o componente "morre"
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("click", primeAudio);
      document.removeEventListener("touchend", primeAudio);
    };
  }, []); // Roda só uma vez

  
  // 2. A Função Principal (O "Cérebro" agora local)
  const checkAndNotify = async () => {
    // Limpa qualquer timer antigo (segurança)
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    let nextDelay = RETRY_ON_ERROR_MS; // Delay padrão em caso de erro

    try {
      // 1. Pega as escolhas do usuário DIRETAMENTE do localStorage
      const savedItems = localStorage.getItem(STORAGE_KEY);
      const selectedItems = new Set(savedItems ? JSON.parse(savedItems) : []);
      
      // 2. Busca o estoque ATUAL
      const response = await fetch("/api/stock");
      if (!response.ok) throw new Error("Falha ao buscar estoque");
      
      const data: ApiResponse = await response.json();

      // 3. Pega os nomes de TODOS os itens em estoque
      const stockedItems = [
        ...data.seeds.map((s) => s.name),
        ...data.gear.map((g) => g.name),
      ];

      // 4. Compara o estoque com as escolhas do usuário
      const matches = stockedItems.filter((item) => selectedItems.has(item));

      // 5. LÓGICA DE NOTIFICAÇÃO (CORRIGIDA)
      // Só notifica se:
      // a) Encontrou itens
      // b) O usuário selecionou algo
      // c) JÁ fizemos a primeira checagem (evita notificação no load)
      if (matches.length > 0 && selectedItems.size > 0 && initialCheckCompleted.current) {
        console.log("ITEM DESEJADO ENCONTRADO!", matches);
        triggerNotification(matches);
      } else if (initialCheckCompleted.current) {
         console.log("Estoque checado, nenhum item desejado encontrado ou nada selecionado.");
      } else {
         console.log("Checagem inicial de estoque concluída. Notificações ativadas para a próxima atualização.");
      }

      // 6. Atualiza a flag (sempre depois da checagem)
      initialCheckCompleted.current = true;

      // 7. Calcula o delay para a *próxima* checagem
      const timeUntilNextUpdate = (data.nextUpdateAt + API_BUFFER_MS) - Date.now();
      nextDelay = Math.max(timeUntilNextUpdate, 30000); // Mínimo de 30s
      
      console.log(`Próxima checagem em ${Math.round(nextDelay / 1000)}s`);

    } catch (error) {
      console.error("Erro no NotificationManager:", error);
      nextDelay = RETRY_ON_ERROR_MS; // Tenta de novo em 1 min se der erro
    } finally {
      // 8. Agenda a próxima execução
      timerRef.current = setTimeout(checkAndNotify, nextDelay);
    }
  };

  // 3. Função que Toca o Som e Mostra a Notificação (Sem alteração)
  const triggerNotification = (matches: string[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Erro ao tocar áudio:", e));
    }

    if (Notification.permission === "granted") {
      const title = "Item Desejado no Estoque!";
      const body = `Itens encontrados: ${matches.join(", ")}`;
      new Notification(title, {
        body: body,
        icon: "/images/items/Mango-seed.webp", // Ícone de exemplo
      });
    }
  };

  return null; // Não renderiza nada
}