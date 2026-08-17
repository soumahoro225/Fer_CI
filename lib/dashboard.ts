import "server-only";

import { createClient } from "./supabase/server";

export type FerRole = "direction" | "agent" | "citoyen";

export type IncidentRecord = {
  id: string;
  reference: string;
  title: string;
  category: string;
  location: string;
  severity: "Critique" | "Élevée" | "Modérée";
  status: string;
  observations: string | null;
  reporter_first_name: string | null;
  reporter_last_name: string | null;
  reporter_phone: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
};

export type InterventionRecord = {
  id: string;
  type: string;
  contractor: string;
  progress: number;
  budget_fcfa: number;
  committed_fcfa: number;
  planned_start: string | null;
  planned_end: string | null;
  status: string;
};

export type AssetRecord = {
  id: string;
  code: string;
  type: string;
  name: string;
  condition: string;
  latitude: number;
  longitude: number;
  last_inspection: string | null;
};

export type PaymentRecord = {
  id: string;
  reference: string;
  contractor: string;
  amount_fcfa: number;
  received_at: string;
  paid_at: string | null;
  status: string;
};

export type ResourceRecord = {
  id: string;
  source: string;
  year: number;
  target_fcfa: number;
  collected_fcfa: number;
};

export type EvidenceRecord = {
  id: string;
  incident_id: string;
  media_type: "image" | "video";
  mime_type: string;
  size_bytes: number;
  original_name: string;
  storage_path: string;
  created_at: string;
  signed_url: string | null;
};

export type DashboardData = {
  generatedAt: string;
  user: { id: string; email: string; fullName: string; role: FerRole };
  incidents: IncidentRecord[];
  interventions: InterventionRecord[];
  assets: AssetRecord[];
  payments: PaymentRecord[];
  resources: ResourceRecord[];
  evidence: EvidenceRecord[];
};

export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) return null;

  const [profileResult, incidentsResult, interventionsResult, assetsResult, paymentsResult, resourcesResult, evidenceResult] =
    await Promise.all([
      supabase.from("profiles").select("full_name,role").eq("id", auth.user.id).single(),
      supabase
        .from("incidents")
        .select("id,reference,title,category,location,severity,status,observations,reporter_first_name,reporter_last_name,reporter_phone,latitude,longitude,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("interventions")
        .select("id,type,contractor,progress,budget_fcfa,committed_fcfa,planned_start,planned_end,status")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("assets")
        .select("id,code,type,name,condition,latitude,longitude,last_inspection")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("payments")
        .select("id,reference,contractor,amount_fcfa,received_at,paid_at,status")
        .order("received_at", { ascending: false })
        .limit(100),
      supabase
        .from("resources")
        .select("id,source,year,target_fcfa,collected_fcfa")
        .order("year", { ascending: false })
        .limit(100),
      supabase
        .from("incident_evidence")
        .select("id,incident_id,media_type,mime_type,size_bytes,original_name,storage_path,created_at")
        .order("created_at", { ascending: true })
        .limit(600),
    ]);

  const failure = [profileResult, incidentsResult, interventionsResult, assetsResult, paymentsResult, resourcesResult, evidenceResult].find(
    (result) => result.error,
  );
  if (failure?.error) throw new Error(`Chargement FER impossible: ${failure.error.message}`);

  const profile = profileResult.data as { full_name: string; role: FerRole };
  const evidenceRows = (evidenceResult.data ?? []) as Omit<EvidenceRecord, "signed_url">[];
  let evidence: EvidenceRecord[] = evidenceRows.map((row) => ({ ...row, signed_url: null }));
  if (evidenceRows.length) {
    const { data: signedUrls, error: signedUrlError } = await supabase.storage
      .from("incident-evidence")
      .createSignedUrls(evidenceRows.map((row) => row.storage_path), 3600);
    if (signedUrlError) throw new Error("Chargement des preuves impossible");
    evidence = evidenceRows.map((row, index) => ({ ...row, signed_url: signedUrls[index]?.signedUrl ?? null }));
  }

  return {
    generatedAt: new Date().toISOString(),
    user: {
      id: auth.user.id,
      email: auth.user.email ?? "",
      fullName: profile.full_name,
      role: profile.role,
    },
    incidents: (incidentsResult.data ?? []) as IncidentRecord[],
    interventions: (interventionsResult.data ?? []) as InterventionRecord[],
    assets: (assetsResult.data ?? []) as AssetRecord[],
    payments: (paymentsResult.data ?? []) as PaymentRecord[],
    resources: (resourcesResult.data ?? []) as ResourceRecord[],
    evidence,
  };
}
