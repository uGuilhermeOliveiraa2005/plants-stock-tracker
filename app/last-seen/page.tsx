"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
// 1. IMPORTAR OS NOVOS ÍCONES
import { Sprout, Wrench } from "lucide-react";

// --- (Interface - Sem alteração) ---
interface CleanItem {
  name: string;
  lastSeen: number;
}

// --- (Listas e Funções - Sem alteração) ---
const SEEDS_LIST: string[] = [
  "Carnivorous Plant", "Sunflower", "Pumpkin", "Strawberry", "Cactus",
  "Dragon Fruit", "Tomatrio", "Eggplant", "Watermelon", "Grape",
  "Cocotank", "Mr Carrot", "Shroombino", "Mango", "King Limone",
];

const SEEDS_ORDER: string[] = [
  "King Limone", "Mango", "Shroombino", "Tomatrio", "Mr Carrot",
  "Carnivorous Plant", "Cocotank", "Grape", "Watermelon", "Eggplant",
  "Dragon Fruit", "Sunflower", "Pumpkin", "Strawberry", "Cactus",
];

const formatTimeAgo = (timestamp: number, now: number): string => {
  const secondsAgo = Math.floor((now - timestamp) / 1000);
  if (secondsAgo < 60) return `agora mesmo`;
  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo < 60) return `há ${minutesAgo} min`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `há ${hoursAgo}h`;
  const daysAgo = Math.floor(hoursAgo / 24);
  return `há ${daysAgo}d`;
};

const getImageSrc = (name: string, type: "seed" | "gear"): string => {
  const formattedName = name.toLowerCase().replace(/ /g, "-");
  if (type === "seed") {
    return `/images/items/${formattedName}-seed.webp`;
  }
  return `/images/items/${formattedName}.webp`;
};

// --- Componente da Página ---
export default function LastSeenPage() {
  const [seeds, setSeeds] = useState<CleanItem[]>([]);
  const [gears, setGears] = useState<CleanItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [now, setNow] = useState<number>(Date.now());

  // --- (Lógica de fetch e timers - Sem alteração) ---
  useEffect(() => {
    const fetchLastSeenData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/last-seen");
        if (!response.ok) throw new Error("Falha ao buscar dados");
        const data: CleanItem[] = await response.json();
        const seedsArray: CleanItem[] = [];
        const gearsArray: CleanItem[] = [];
        data.forEach((item) => {
          if (SEEDS_LIST.includes(item.name)) {
            seedsArray.push(item);
          } else {
            gearsArray.push(item);
          }
        });
        seedsArray.sort((a, b) => {
          let indexA = SEEDS_ORDER.indexOf(a.name);
          let indexB = SEEDS_ORDER.indexOf(b.name);
          if (indexA === -1) indexA = SEEDS_ORDER.length;
          if (indexB === -1) indexB = SEEDS_ORDER.length;
          return indexA - indexB;
        });
        gearsArray.sort((a, b) => b.lastSeen - a.lastSeen);
        setSeeds(seedsArray);
        setGears(gearsArray);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLastSeenData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- JSX ATUALIZADO ---
  return (
    <main className="container">
      <header className="header">
        <h1>Vistos por Último</h1>
        <p>A última vez que cada item apareceu na loja</p>
      </header>

      {/* --- Seção de Sementes (Seeds) --- */}
      <section>
        {/* --- 2. MUDANÇA NO H2 --- */}
        <h2 className="section-title">
          <Sprout size={24} />
          <span>Sementes (Seeds)</span>
        </h2>
        {isLoading && <div className="message">Carregando sementes...</div>}
        {!isLoading && seeds.length === 0 && (
          <div className="message">Nenhuma semente no histórico.</div>
        )}
        {!isLoading && seeds.length > 0 && (
          <div className="list-container">
            <ul>
              {seeds.map((item) => (
                <li className="list-item" key={item.name}>
                  <div className="list-item-image">
                    <Image
                      src={getImageSrc(item.name, "seed")}
                      alt={item.name}
                      width={50}
                      height={50}
                      priority
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/images/items/Default.webp";
                      }}
                    />
                  </div>
                  <div className="list-item-info">
                    <span className="list-item-name">{item.name}</span>
                    <span className="list-item-time">
                      {formatTimeAgo(item.lastSeen, now)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* --- Seção de Equipamentos (Gears) --- */}
      <section>
        {/* --- 3. MUDANÇA NO H2 --- */}
        <h2 className="section-title">
          <Wrench size={24} />
          <span>Equipamentos (Gears)</span>
        </h2>
        {isLoading && <div className="message">Carregando equipamentos...</div>}
        {!isLoading && gears.length === 0 && (
          <div className="message">Nenhum equipamento no histórico.</div>
        )}
        {!isLoading && gears.length > 0 && (
          <div className="list-container">
            <ul>
              {gears.map((item) => (
                <li className="list-item" key={item.name}>
                  <div className="list-item-image">
                    <Image
                      src={getImageSrc(item.name, "gear")}
                      alt={item.name}
                      width={50}
                      height={50}
                      priority
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/images/items/Default.webp";
                      }}
                    />
                  </div>
                  <div className="list-item-info">
                    <span className="list-item-name">{item.name}</span>
                    <span className="list-item-time">
                      {formatTimeAgo(item.lastSeen, now)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}