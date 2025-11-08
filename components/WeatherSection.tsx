"use client";

import { useState, useEffect } from "react";
import { Cloud, CloudSnow, Sparkles, Star, Flame, RefreshCw } from "lucide-react";

interface WeatherData {
  active: boolean;
  name: string;
  start: number;
  now: number;
}

// Configuração dos tipos de weather com cores, ícones e descrições
const WEATHER_CONFIG: Record<string, {
  displayName: string;
  description: string;
  icon: typeof Cloud;
  gradient: string;
  borderColor: string;
  glowColor: string;
  mutation: string;
  multiplier: string;
}> = {
  "Icy Blizzard": {
    displayName: "Icy Blizzard",
    description: "Nevasca congelante aumenta mutações Frozen",
    icon: CloudSnow,
    gradient: "from-cyan-500 via-blue-500 to-indigo-600",
    borderColor: "border-cyan-400",
    glowColor: "rgba(34, 211, 238, 0.4)",
    mutation: "Frozen",
    multiplier: "3x"
  },
  "Golden": {
    displayName: "Gilded Awakening",
    description: "Despertar dourado aumenta mutações Gold",
    icon: Sparkles,
    gradient: "from-yellow-400 via-yellow-500 to-amber-600",
    borderColor: "border-yellow-400",
    glowColor: "rgba(250, 204, 21, 0.4)",
    mutation: "Gold",
    multiplier: "2x"
  },
  "Prismatic Surge": {
    displayName: "Prismatic Surge",
    description: "Explosão prismática aumenta mutações Rainbow",
    icon: Sparkles,
    gradient: "from-pink-500 via-purple-500 to-indigo-500",
    borderColor: "border-purple-400",
    glowColor: "rgba(168, 85, 247, 0.4)",
    mutation: "Rainbow",
    multiplier: "6x"
  },
  "Galactic": {
    displayName: "Cosmic Bloom",
    description: "Florescimento cósmico aumenta mutações Galactic",
    icon: Star,
    gradient: "from-purple-600 via-blue-600 to-indigo-900",
    borderColor: "border-purple-500",
    glowColor: "rgba(147, 51, 234, 0.5)",
    mutation: "Galactic",
    multiplier: "7x"
  },
  "Eruption": {
    displayName: "Eruption",
    description: "Erupção vulcânica aumenta mutações Magma",
    icon: Flame,
    gradient: "from-red-600 via-orange-600 to-yellow-600",
    borderColor: "border-red-500",
    glowColor: "rgba(239, 68, 68, 0.4)",
    mutation: "Magma",
    multiplier: "5x"
  },
  "Reality Flip": {
    displayName: "Reality Flip",
    description: "Inversão da realidade aumenta mutações Upside Down",
    icon: RefreshCw,
    gradient: "from-red-500 via-pink-500 to-purple-600",
    borderColor: "border-pink-500",
    glowColor: "rgba(236, 72, 153, 0.4)",
    mutation: "Upside Down",
    multiplier: "6x"
  },
  "Underworld Rift": {
    displayName: "Underworld Rift",
    description: "Fenda do submundo aumenta mutações Underworld",
    icon: Flame,
    gradient: "from-red-800 via-red-900 to-black",
    borderColor: "border-red-700",
    glowColor: "rgba(127, 29, 29, 0.5)",
    mutation: "Underworld",
    multiplier: "6.5x"
  }
};

export default function WeatherSection() {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchWeatherData = async () => {
    try {
      const response = await fetch("/api/weather");
      if (!response.ok) throw new Error("Falha ao buscar dados do weather");
      
      const data: WeatherData = await response.json();
      setWeatherData(data);
      
      if (data.active) {
        const now = Date.now();
        const elapsed = now - data.start;
        const duration = 150000; // 2min 30s em ms
        const remaining = Math.max(0, duration - elapsed);
        setTimeRemaining(remaining);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherData();
    const interval = setInterval(fetchWeatherData, 10000); // Atualiza a cada 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!weatherData?.active || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          fetchWeatherData();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [weatherData, timeRemaining]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <section className="weather-section">
        <h2 className="section-title">
          <Cloud size={24} />
          <span>Evento Climático Ativo</span>
        </h2>
        <div className="weather-loading">
          <div className="weather-loading-spinner"></div>
          <p>Verificando eventos...</p>
        </div>
      </section>
    );
  }

  if (!weatherData?.active) {
    return (
      <section className="weather-section">
        <h2 className="section-title">
          <Cloud size={24} />
          <span>Evento Climático Ativo</span>
        </h2>
        <div className="weather-inactive">
          <div className="weather-sun-icon">☀️</div>
          <h3>Clima Normal</h3>
          <p>Nenhum evento climático ativo no momento</p>
        </div>
      </section>
    );
  }

  const config = WEATHER_CONFIG[weatherData.name] || {
    displayName: weatherData.name,
    description: "Evento especial ativo",
    icon: Cloud,
    gradient: "from-gray-500 to-gray-700",
    borderColor: "border-gray-500",
    glowColor: "rgba(107, 114, 128, 0.4)",
    mutation: "Unknown",
    multiplier: "?"
  };

  const Icon = config.icon;
  const progress = (timeRemaining / 150000) * 100;

  return (
    <section className="weather-section">
      <h2 className="section-title">
        <Icon size={24} />
        <span>Evento Climático Ativo</span>
      </h2>
      
      <div 
        className={`weather-card bg-gradient-to-br ${config.gradient}`}
        style={{ boxShadow: `0 0 40px ${config.glowColor}` }}
      >
        <div className="weather-card-glow" style={{ background: config.glowColor }}></div>
        
        <div className="weather-icon-wrapper">
          <Icon size={48} className="weather-icon" />
        </div>

        <div className="weather-info">
          <h3 className="weather-name">{config.displayName}</h3>
          <p className="weather-description">{config.description}</p>
          
          <div className="weather-stats">
            <div className="weather-stat">
              <span className="weather-stat-label">Mutação</span>
              <span className="weather-stat-value">{config.mutation}</span>
            </div>
            <div className="weather-stat">
              <span className="weather-stat-label">Multiplicador</span>
              <span className="weather-stat-value">{config.multiplier}</span>
            </div>
          </div>
        </div>

        <div className="weather-timer">
          <div className="weather-timer-label">Tempo Restante</div>
          <div className="weather-timer-value">{formatTime(timeRemaining)}</div>
          
          <div className="weather-progress-bar">
            <div 
              className="weather-progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>
    </section>
  );
}