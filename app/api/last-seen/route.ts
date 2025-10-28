import { NextResponse } from "next/server";

const EXTERNAL_API_URL = "https://plantsvsbrainrot.com/api/last-seen.php";

interface RawApiResponse {
  updatedAt: number;
  items: {
    [key: string]: number;
  };
}

export interface CleanItem {
  name: string;
  lastSeen: number;
}

export async function GET() {
  try {
    const response = await fetch(EXTERNAL_API_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      return new NextResponse("Falha ao buscar dados da API externa", {
        status: response.status,
      });
    }

    const data: RawApiResponse = await response.json();

    // --- A MÁGICA DA LIMPEZA DE DADOS (AGORA MAIS RIGOROSA) ---
    const cleanData: CleanItem[] = Object.entries(data.items)
      .filter(([key]) => {
        // --- MUDANÇA IMPORTANTE ---
        // 1. Regex: Permite apenas letras (A-Z, a-z) e espaços.
        // 2. Condição Explícita: Bloqueia a chave "Unknown".
        const isCleanName = /^[A-Za-z ]+$/.test(key);
        return isCleanName && key !== "Unknown";
      })
      .map(([name, lastSeen]) => {
        return { name, lastSeen };
      });

    // Retorna os dados JÁ LIMPOS para a nossa página
    return NextResponse.json(cleanData);
  } catch (error) {
    console.error("Erro no proxy da API last-seen:", error);
    return new NextResponse("Erro interno do servidor", { status: 500 });
  }
}