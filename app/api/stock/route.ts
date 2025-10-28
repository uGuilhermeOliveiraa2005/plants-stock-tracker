import { NextResponse } from "next/server";

// URL da API externa
const EXTERNAL_API_URL = "https://plantsvsbrainrot.com/api/seed-shop.php";

/**
 * Esta função age como um "proxy" ou "ponte".
 * O cliente (navegador) chama /api/stock, e esta função
 * no servidor busca os dados da API externa, evitando CORS.
 */
export async function GET() {
  try {
    const response = await fetch(EXTERNAL_API_URL, {
      // 'no-store' garante que sempre pegamos os dados mais recentes
      cache: "no-store",
    });

    if (!response.ok) {
      // Se a API externa falhar, repassa o erro
      return new NextResponse("Falha ao buscar dados da API externa", {
        status: response.status,
      });
    }

    const data = await response.json();

    // Retorna os dados para o nosso cliente (o app/page.tsx)
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro no proxy da API:", error);
    return new NextResponse("Erro interno do servidor", { status: 500 });
  }
}