"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "pvb-notif-items";

export default function NotificationManager() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const workerPortRef = useRef<MessagePort | null>(null);

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
    const primeAudio = () => {
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

    // --- INICIA O *SHARED* WORKER ---
    // <<<--- CORREÇÃO PRINCIPAL: Usa SharedWorker
    if (typeof (SharedWorker) !== "undefined") {
      // Conecta ao cérebro compartilhado
      const worker = new SharedWorker("/notification.shared-worker.js");
      workerPortRef.current = worker.port;

      // --- Ouve por mensagens vindas DO worker ---
      worker.port.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'notify') {
          // O cérebro mandou tocar, nós tocamos.
          triggerNotification(payload);
        }
      };
      // Inicia a porta de comunicação
      worker.port.start();

      // --- SINCRONIZA O LOCALSTORAGE COM O WORKER ---
      
      // 1. Função unificada para enviar a seleção para o cérebro
      const updateWorkerSelection = () => {
        const currentSelection = localStorage.getItem(STORAGE_KEY);
        const selectionArray = currentSelection ? JSON.parse(currentSelection) : [];
        
        worker.port.postMessage({
          type: 'updateSelection',
          payload: selectionArray,
        });
      };
      
      // 2. Envia a seleção inicial (dispara o loop no worker)
      updateWorkerSelection(); 
    
      // 3. Ouve por mudanças de *outras* abas
      window.addEventListener('storage', updateWorkerSelection);

      // 4. Ouve pelo *nosso* evento customizado (da mesma aba)
      window.addEventListener('storage-update', updateWorkerSelection);

      // --- Função de limpeza ---
      return () => {
        // Apenas fecha a *nossa* porta de comunicação
        worker.port.close(); 
        window.removeEventListener('storage', updateWorkerSelection);
        window.removeEventListener('storage-update', updateWorkerSelection); 
        document.removeEventListener("click", primeAudio);
        document.removeEventListener("touchend", primeAudio);
      };
    } else {
      console.error("SharedWorker não é suportado neste navegador.");
      return;
    }
  }, []); // Roda só uma vez

  
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
        icon: "/images/items/Mango-seed.webp", // Ícone de exemplo
      });
    }
  };

  return null; // Não renderiza nada
}