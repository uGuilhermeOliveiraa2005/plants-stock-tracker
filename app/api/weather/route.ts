import { NextResponse } from "next/server";

const EXTERNAL_API_URL = "https://plantsvsbrainrot.com/api/weather.php";

export interface WeatherResponse {
  active: boolean;
  name: string;
  start: number;
  now: number;
}

export async function GET() {
  try {
    const response = await fetch(EXTERNAL_API_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      return new NextResponse("Falha ao buscar dados da API de weather", {
        status: response.status,
      });
    }

    const data: WeatherResponse = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro no proxy da API de weather:", error);
    return new NextResponse("Erro interno do servidor", { status: 500 });
  }
}