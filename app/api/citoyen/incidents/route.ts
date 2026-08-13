import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const categories = ["Voirie", "Feux", "Accotement", "Ouvrage", "Bac", "Péage / pesage", "Orpaillage clandestin", "Insécurité"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function citizenClient() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, user: null, status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "citoyen") return { supabase, user: null, status: 403 as const };
  return { supabase, user: auth.user, status: 200 as const };
}

const incidentFields = "id,reference,title,category,location,status,observations,latitude,longitude,location_source,location_accuracy_m,created_at,updated_at";

export async function GET() {
  const { supabase, user, status } = await citizenClient();
  if (!user) return NextResponse.json({ error: status === 401 ? "Authentification requise" : "Espace citoyen requis" }, { status });
  const { data, error } = await supabase
    .from("incidents")
    .select(incidentFields)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("citizen.incidents.select", error.message);
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }
  return NextResponse.json({ incidents: data });
}

export async function POST(request: Request) {
  const { supabase, user, status } = await citizenClient();
  if (!user) return NextResponse.json({ error: status === 401 ? "Authentification requise" : "Espace citoyen requis" }, { status });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }); }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const observations = typeof body.observations === "string" ? body.observations.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";
  const locationSource = body.locationSource === "gps" || body.locationSource === "manual_map" ? body.locationSource : null;
  const latitude = body.latitude;
  const longitude = body.longitude;
  const accuracy = body.accuracy === null || body.accuracy === undefined ? null : body.accuracy;
  const clientRequestId = typeof body.clientRequestId === "string" ? body.clientRequestId : "";

  const validCoordinates = typeof latitude === "number"
    && Number.isFinite(latitude)
    && latitude >= 3.5
    && latitude <= 11
    && typeof longitude === "number"
    && Number.isFinite(longitude)
    && longitude >= -9
    && longitude <= -2;
  const validAccuracy = accuracy === null
    || (typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 100000);

  if (
    title.length < 3 || title.length > 160
    || location.length < 2 || location.length > 240
    || observations.length > 2000
    || !categories.includes(category)
    || !validCoordinates
    || !validAccuracy
    || !locationSource
    || !uuidPattern.test(clientRequestId)
  ) {
    return NextResponse.json({ error: "Données de signalement invalides" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      title,
      category,
      location,
      observations: observations || null,
      severity: "Modérée",
      status: "À qualifier",
      latitude,
      longitude,
      source: "Citoyen",
      location_source: locationSource,
      location_accuracy_m: locationSource === "gps" ? accuracy : null,
      location_captured_at: new Date().toISOString(),
      client_request_id: clientRequestId,
      created_by: user.id,
    })
    .select(incidentFields)
    .single();

  if (error?.code === "23505") {
    const { data: existing } = await supabase
      .from("incidents")
      .select(incidentFields)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (existing) return NextResponse.json({ incident: existing, duplicate: true });
  }
  if (error) {
    console.error("citizen.incidents.insert", error.message);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }
  return NextResponse.json({ incident: data }, { status: 201 });
}
