"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, Loader } from "lucide-react";

// --- (Interfaces e Constantes - Sem alteração) ---
interface CleanItem {
  name: string;
  lastSeen: number;
}
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
const STORAGE_KEY = "pvb-notif-items";
interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}
const getImageSrc = (name: string, isSeed: boolean): string => {
  const formattedName = name.toLowerCase().replace(/ /g, "-");
  if (isSeed) {
    return `/images/items/${formattedName}-seed.webp`;
  }
  return `/images/items/${formattedName}.webp`;
};

// --- Componente do Modal ---
export default function NotificationModal({
  isOpen,
  onClose,
}: NotificationModalProps) {
  const [seeds, setSeeds] = useState<CleanItem[]>([]);
  const [gears, setGears] = useState<CleanItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // --- (Efeito de buscar itens e carregar - Sem alteração) ---
  useEffect(() => {
    const fetchAllItems = async () => { /* ... (código igual) ... */ 
      setIsLoading(true);
      try {
        const response = await fetch("/api/last-seen");
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
        gearsArray.sort((a, b) => a.name.localeCompare(b.name));
        setSeeds(seedsArray);
        setGears(gearsArray);
      } catch (error) {
        console.error("Falha ao buscar lista de itens:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllItems();
  }, []);

  useEffect(() => {
    const savedItems = localStorage.getItem(STORAGE_KEY);
    if (savedItems) {
      setSelectedItems(new Set(JSON.parse(savedItems)));
    }
  }, []);

  // --- 3. Função de clique (COM A CORREÇÃO) ---
  const handleToggleItem = (name: string) => {
    const newSelectedItems = new Set(selectedItems);
    if (newSelectedItems.has(name)) {
      newSelectedItems.delete(name);
    } else {
      newSelectedItems.add(name);
    }
    setSelectedItems(newSelectedItems);
    
    // Salva no localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newSelectedItems)));

    // --- ESTA É A CORREÇÃO DE "TEMPO REAL" ---
    // Avisa o NotificationManager (na mesma página) que a seleção mudou.
    window.dispatchEvent(new CustomEvent('storage-update'));
    // ------------------------------------------
  };

  // --- (renderItemList e JSX - Sem alteração) ---
  const renderItemList = (items: CleanItem[], isSeed: boolean) => { /* ... (código igual) ... */ 
    return items.map((item) => (
      <div
        key={item.name}
        className={`modal-item ${
          selectedItems.has(item.name) ? "selected" : ""
        }`}
        onClick={() => handleToggleItem(item.name)}
      >
        <div className="modal-item-image">
          <Image
            src={getImageSrc(item.name, isSeed)}
            alt={item.name}
            width={40}
            height={40}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/items/Default.webp";
            }}
          />
        </div>
        <span className="modal-item-name">{item.name}</span>
        <div className="modal-item-checkbox">
          <div className="checkbox-dot"></div>
        </div>
      </div>
    ));
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Configurar Notificações</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </header>
        <p className="modal-desc">
          Selecione os itens que você deseja ser notificado. A notificação tocará
          automaticamente quando um item selecionado aparecer no estoque.
        </p>
        {isLoading && (
          <div className="modal-loading">
            <Loader size={32} className="spinner" />
            <span>Carregando lista de itens...</span>
          </div>
        )}
        {!isLoading && (
          <div className="modal-body">
            <h3 className="modal-subtitle">Sementes (Seeds)</h3>
            <div className="modal-item-list">
              {renderItemList(seeds, true)}
            </div>
            <h3 className="modal-subtitle">Equipamentos (Gears)</h3>
            <div className="modal-item-list">
              {renderItemList(gears, false)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}