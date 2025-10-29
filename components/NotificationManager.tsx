"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "pvb-notif-items";

// 1. ACEITA A PROP "isIOS"
export default function NotificationManager({ isIOS }: { isIOS: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const workerPortRef = useRef<Worker | MessagePort | null>(null);

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

    // --- 2. O "SWITCHER" INTELIGENTE ---
    let workerInterface: Worker | SharedWorker;
    let port: Worker | MessagePort;
    let isShared = false;

    if (isIOS) {
      // É iOS? Usa o Worker padrão (Plano B)
      console.log("iOS detectado pelo servidor. Usando Worker padrão.");
      workerInterface = new Worker("/notification.worker.js");
      port = workerInterface as Worker;
      isShared = false;
    } else {
      // Não é iOS? Tenta usar o SharedWorker "Premium" (Plano A)
      try {
        console.log("Não-iOS. Tentando SharedWorker 'Premium'.");
        workerInterface = new SharedWorker("/notification.shared-worker.js");
        port = (workerInterface as SharedWorker).port;
        isShared = true;
      } catch (e) {
        // Se falhar (ex: navegador muito antigo), usa o Worker padrão
        console.warn("SharedWorker falhou. Usando Worker padrão como fallback.", e);
        workerInterface = new Worker("/notification.worker.js");
        port = workerInterface as Worker;
        isShared = false;
      }
    }
    // ------------------------------------

    workerPortRef.current = port;

    // Ouve por mensagens vindas DO worker
    port.onmessage = (e: MessageEvent) => {
      const { type, payload } = e.data;
      if (type === 'notify') {
        triggerNotification(payload);
      }
    };
    
    if (isShared) {
      (port as MessagePort).start();
    }

    // Função unificada para enviar a seleção para o cérebro
    const updateWorkerSelection = () => {
      const currentSelection = localStorage.getItem(STORAGE_KEY);
      const selectionArray = currentSelection ? JSON.parse(currentSelection) : [];
      port.postMessage({
        type: 'updateSelection',
        payload: selectionArray,
      });
    };
    
    updateWorkerSelection(); 
    window.addEventListener('storage', updateWorkerSelection);
    window.addEventListener('storage-update', updateWorkerSelection);

    // Função de limpeza
    return () => {
      if (isShared && port) {
        (port as MessagePort).close(); 
      } else if (!isShared && workerInterface) {
        (workerInterface as Worker).terminate();
      }
      window.removeEventListener('storage', updateWorkerSelection);
      window.removeEventListener('storage-update', updateWorkerSelection); 
      document.removeEventListener("click", primeAudio);
      document.removeEventListener("touchend", primeAudio);
    };
  }, [isIOS]); // Adiciona isIOS como dependência (para segurança)

  
  // Função que Toca o Som e Mostra a Notificação
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
        icon: "/images/items/Mango-seed.webp",
      });
    }
  };

  return null;
}