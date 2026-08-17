import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (!profile || !["direction", "agent"].includes(profile.role)) {
    return NextResponse.json({ error: "Accès FER refusé" }, { status: 403 });
  }

  const latitudeHeader = request.headers.get("x-vercel-ip-latitude");
  const longitudeHeader = request.headers.get("x-vercel-ip-longitude");
  const latitude = Number(latitudeHeader);
  const longitude = Number(longitudeHeader);
  if (!latitudeHeader || !longitudeHeader || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Position IP indisponible" }, { status: 404 });
  }

  const encodedCity = request.headers.get("x-vercel-ip-city");
  let city: string | null = null;
  try {
    city = encodedCity ? decodeURIComponent(encodedCity) : null;
  } catch {
    city = encodedCity;
  }

  return NextResponse.json({ latitude, longitude, city, source: "ip" });
}
