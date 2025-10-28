"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Sprout, Wrench } from "lucide-react";

// --- (Tipos da API - Sem alteração) ---
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

// --- 1. ORDEM PERSONALIZADA DE SEMENTES (A MESMA DA PÁGINA LAST-SEEN) ---
const SEEDS_ORDER: string[] = [
  "King Limone", "Mango", "Shroombino", "Tomatrio", "Mr Carrot",
  "Carnivorous Plant", "Cocotank", "Grape", "Watermelon", "Eggplant",
  "Dragon Fruit", "Sunflower", "Pumpkin", "Strawberry", "Cactus",
];

// --- Função de Classe de Raridade (Sem alteração) ---
const getRarityClass = (name: string): string => {
  const tier1 = ["King Limone", "Mango", "Shroombino", "Tomatrio", "Mr Carrot"];
  if (tier1.includes(name)) {
    return "card-rarity-tier1";
  }
  const tier2 = ["Carnivorous Plant", "Cocotank"];
  if (tier2.includes(name)) {
    return "card-rarity-tier2";
  }
  return "";
};

// --- Componente da Página ---
export default function HomePage() {
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // --- Lógica de fetch (COM A CORREÇÃO DE ORDEM) ---
  const fetchStockData = async () => {
    console.log("Buscando novos dados da API...");
    setIsLoading(true);
    try {
      const response = await fetch("/api/stock");
      if (!response.ok) {
        throw new Error("Falha ao buscar dados da API");
      }
      const data: ApiResponse = await response.json();

      // --- 2. CORREÇÃO DA ORDEM (SORT) ---
      // Ordena as sementes pela sua ORDEM PERSONALIZADA
      data.seeds.sort((a, b) => {
        let indexA = SEEDS_ORDER.indexOf(a.name);
        let indexB = SEEDS_ORDER.indexOf(b.name);
        if (indexA === -1) indexA = SEEDS_ORDER.length;
        if (indexB === -1) indexB = SEEDS_ORDER.length;
        return indexA - indexB;
      });

      // Ordena os gears alfabeticamente para uma ordem estável
      data.gear.sort((a, b) => a.name.localeCompare(b.name));
      // --- FIM DA CORREÇÃO ---

      // Seta os dados JÁ ORDENADOS
      setApiData(data);
      
      const duration = data.nextUpdateAt - data.reportedAt;
      setTotalDuration(duration);
      const now = Date.now();
      const remaining = data.nextUpdateAt - now;
      setTimeRemaining(remaining > 0 ? remaining : 0);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- (O restante do arquivo não muda) ---

  useEffect(() => {
    fetchStockData();
  }, []);

  useEffect(() => {
    if (timeRemaining <= 0 && apiData) {
      const timer = setTimeout(() => {
        fetchStockData();
      }, 2000);
      return () => clearTimeout(timer);
    }
    const interval = setInterval(() => {
      if (apiData) {
        const now = Date.now();
        const remaining = apiData.nextUpdateAt - now;
        setTimeRemaining(remaining > 0 ? remaining : 0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemaining, apiData]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  };

  const progressPercentage =
    totalDuration > 0 ? (timeRemaining / totalDuration) * 100 : 0;

  // --- O que será renderizado (HTML/JSX) ---
  return (
    <main className="container">
      <header className="header">
        <h1>Plants vs Brainrots</h1>
        <p>Monitor de Estoque da Loja</p>
      </header>

      {/* Seção do Cronômetro */}
      <section className="timer-section">
        <h2>Próxima atualização em:</h2>
        <div className="timer-countdown">
          {isLoading ? "..." : formatTime(timeRemaining)}
        </div>
        <div className="progress-bar-outer">
          <div
            className="progress-bar-inner"
            style={{
              width: `${progressPercentage}%`,
            }}
          ></div>
        </div>
      </section>

      {/* Seção de Sementes (Seeds) */}
      <section>
        <h2 className="section-title">
          <Sprout size={24} />
          <span>Sementes (Seeds)</span>
        </h2>
        {isLoading && <div className="message">Carregando sementes...</div>}
        {!isLoading && apiData && apiData.seeds.length > 0 && (
          <div className="card-grid">
            {apiData.seeds.map((seed) => { // Agora mapeia a lista ordenada
              const imageName = `${seed.name
                .toLowerCase()
                .replace(/ /g, "-")}-seed.webp`;
              const rarityClass = getRarityClass(seed.name);

              return (
                <div
                  className={`card ${rarityClass}`}
                  key={seed.name}
                >
                  <div className="card-icon-wrapper">
                    <Image
                      src={`/images/items/${imageName}`}
                      alt={seed.name}
                      width={80}
                      height={80}
                      priority
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/images/items/Default.webp";
                      }}
                    />
                  </div>
                  <div className="card-name">{seed.name}</div>
                  <div className="card-qty">Estoque: {seed.qty}</div>
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && apiData && apiData.seeds.length === 0 && (
          <div className="message">Nenhuma semente em estoque no momento.</div>
        )}
      </section>

      {/* Seção de Equipamentos (Gears) */}
      <section>
        <h2 className="section-title">
          <Wrench size={24} />
          <span>Equipamentos (Gears)</span>
        </h2>
        {isLoading && (
          <div className="message">Carregando equipamentos...</div>
        )}
        {!isLoading && apiData && apiData.gear.length > 0 && (
          <div className="card-grid">
            {apiData.gear.map((gear) => { // Agora mapeia a lista ordenada
              const imageName = `${gear.name
                .toLowerCase()
                .replace(/ /g, "-")}.webp`;
              const rarityClass = getRarityClass(gear.name);

              return (
                <div
                  className={`card ${rarityClass}`}
                  key={gear.name}
                >
                  <div className="card-icon-wrapper">
                    <Image
                      src={`/images/items/${imageName}`}
                      alt={gear.name}
                      width={80}
                      height={80}
                      priority
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/images/items/Default.webp";
                      }}
                    />
                  </div>
                  <div className="card-name">{gear.name}</div>
                  <div className="card-qty">Estoque: {gear.qty}</div>
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && apiData && apiData.gear.length === 0 && (
          <div className="message">Nenhum equipamento em estoque no momento.</div>
        )}
      </section>
    </main>
  );
}