import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

async function authorizedClient() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, user: null, status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", auth.user.id).maybeSingle();
  if (!profile) return { supabase, user: null, status: 403 as const };
  return { supabase, user: auth.user, status: 200 as const };
}

export async function GET() {
  const { supabase, user, status } = await authorizedClient();
  if (!user) return NextResponse.json({ error: status === 401 ? "Authentification requise" : "Accès FER refusé" }, { status });
  const { data, error } = await supabase.from("incidents").select("id,reference,title,category,location,severity,status,latitude,longitude,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) {
    console.error("incidents.select", error);
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }
  return NextResponse.json({ incidents: data });
}

export async function POST(request: Request) {
  const { supabase, user, status } = await authorizedClient();
  if (!user) return NextResponse.json({ error: status === 401 ? "Authentification requise" : "Accès FER refusé" }, { status });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }); }
  const title = String(body.title || "").trim();
  const location = String(body.location || "").trim();
  const observations = String(body.observations || "").trim();
  const category = String(body.category || "Voirie");
  const severity = String(body.severity || "Modérée");
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!title || title.length > 160 || !location || location.length > 240 || observations.length > 2000 || !["Voirie", "Feux", "Accotement", "Ouvrage", "Bac", "Péage / pesage"].includes(category) || !["Critique", "Élevée", "Modérée"].includes(severity) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Données de signalement invalides" }, { status: 400 });
  }
  const { data, error } = await supabase.from("incidents").insert({ reference: `FER-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, title, category, location, observations, severity, latitude, longitude, created_by: user.id }).select().single();
  if (error) {
    console.error("incidents.insert", error);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }
  return NextResponse.json({ incident: data }, { status: 201 });
}
