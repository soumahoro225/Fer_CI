import { NextResponse } from "next/server";
import { parseReporterContact } from "../../../lib/reporter-contact";
import { createClient } from "../../../lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const incidentStatuses = ["À qualifier", "Validé", "Planifié", "En traitement", "Résolu", "Rejeté"] as const;
const incidentSeverities = ["Critique", "Élevée", "Modérée"] as const;
const incidentFields = "id,reference,title,category,location,severity,status,observations,reporter_first_name,reporter_last_name,reporter_phone,source,assigned_to,latitude,longitude,created_at,updated_at";

async function authorizedClient() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, user: null, status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("id,role").eq("id", auth.user.id).maybeSingle();
  if (!profile || !["direction", "agent"].includes(profile.role)) {
    return { supabase, user: null, status: 403 as const };
  }
  return { supabase, user: auth.user, status: 200 as const };
}

export async function GET() {
  const { supabase, user, status } = await authorizedClient();
  if (!user) return NextResponse.json({ error: status === 401 ? "Authentification requise" : "Accès FER refusé" }, { status });
  const { data, error } = await supabase.from("incidents").select(incidentFields).order("created_at", { ascending: false }).limit(100);
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
  const latitude = typeof body.latitude === "number" ? body.latitude : Number.NaN;
  const longitude = typeof body.longitude === "number" ? body.longitude : Number.NaN;
  const locationSource = body.locationSource === "gps" || body.locationSource === "manual_map" ? body.locationSource : null;
  const locationAccuracy = body.locationAccuracy === null || body.locationAccuracy === undefined
    ? null
    : typeof body.locationAccuracy === "number" ? body.locationAccuracy : Number.NaN;
  const reporterContact = parseReporterContact(body);
  const clientRequestId = typeof body.clientRequestId === "string" ? body.clientRequestId : "";
  const validAccuracy = locationAccuracy === null || (Number.isFinite(locationAccuracy) && locationAccuracy >= 0 && locationAccuracy <= 100000);
  if (!title || title.length > 160 || !location || location.length > 240 || observations.length > 2000 || !["Voirie", "Feux", "Accotement", "Ouvrage", "Bac", "Péage / pesage", "Orpaillage clandestin", "Insécurité", "Nuisance sonore"].includes(category) || !["Critique", "Élevée", "Modérée"].includes(severity) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !locationSource || !validAccuracy || !uuidPattern.test(clientRequestId) || !reporterContact.valid) {
    return NextResponse.json({ error: "Données de signalement invalides" }, { status: 400 });
  }
  const { data, error } = await supabase.from("incidents").insert({ reference: `FER-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, title, category, location, observations: observations || null, ...reporterContact.values, severity, latitude, longitude, source: "FER", location_source: locationSource, location_accuracy_m: locationSource === "gps" ? locationAccuracy : null, location_captured_at: new Date().toISOString(), client_request_id: clientRequestId, created_by: user.id }).select().single();
  if (error?.code === "23505") {
    const { data: existing } = await supabase
      .from("incidents")
      .select()
      .eq("client_request_id", clientRequestId)
      .eq("created_by", user.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ incident: existing, duplicate: true });
  }
  if (error) {
    console.error("incidents.insert", error);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }
  return NextResponse.json({ incident: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, user, status: authStatus } = await authorizedClient();
  if (!user) return NextResponse.json({ error: authStatus === 401 ? "Authentification requise" : "Accès FER refusé" }, { status: authStatus });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  const incidentStatus = typeof body.status === "string" ? body.status : "";
  const severity = typeof body.severity === "string" ? body.severity : "";
  const assignedTo = body.assignedTo === null ? null : typeof body.assignedTo === "string" ? body.assignedTo : undefined;
  if (!uuidPattern.test(id) || !incidentStatuses.includes(incidentStatus as typeof incidentStatuses[number]) || !incidentSeverities.includes(severity as typeof incidentSeverities[number]) || assignedTo === undefined || (assignedTo !== null && !uuidPattern.test(assignedTo))) {
    return NextResponse.json({ error: "Données de qualification invalides" }, { status: 400 });
  }

  if (assignedTo) {
    const { data: assignee, error: assigneeError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", assignedTo)
      .in("role", ["direction", "agent"])
      .maybeSingle();
    if (assigneeError) {
      console.error("incidents.assignee", assigneeError);
      return NextResponse.json({ error: "Vérification de l’agent impossible" }, { status: 500 });
    }
    if (!assignee) return NextResponse.json({ error: "Agent d’affectation invalide" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("incidents")
    .update({ status: incidentStatus, severity, assigned_to: assignedTo })
    .eq("id", id)
    .select(incidentFields)
    .maybeSingle();
  if (error) {
    console.error("incidents.update", error);
    return NextResponse.json({ error: "Mise à jour impossible" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Signalement introuvable" }, { status: 404 });
  return NextResponse.json({ incident: data });
}
