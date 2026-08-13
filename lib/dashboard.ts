import "server-only";

import { createClient } from "./supabase/server";

export type FerRole = "direction" | "agent";

export type IncidentRecord = {
  id: string;
  reference: string;
  title: string;
  category: string;
  location: string;
  severity: "Critique" | "Élevée" | "Modérée";
  status: string;
  observations: string | null;
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

export type DashboardData = {
  generatedAt: string;
  user: { email: string; fullName: string; role: FerRole };
  incidents: IncidentRecord[];
  interventions: InterventionRecord[];
  assets: AssetRecord[];
  payments: PaymentRecord[];
  resources: ResourceRecord[];
};

export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) return null;

  const [profileResult, incidentsResult, interventionsResult, assetsResult, paymentsResult, resourcesResult] =
    await Promise.all([
      supabase.from("profiles").select("full_name,role").eq("id", auth.user.id).single(),
      supabase
        .from("incidents")
        .select("id,reference,title,category,location,severity,status,observations,latitude,longitude,created_at")
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
    ]);

  const failure = [profileResult, incidentsResult, interventionsResult, assetsResult, paymentsResult, resourcesResult].find(
    (result) => result.error,
  );
  if (failure?.error) throw new Error(`Chargement FER impossible: ${failure.error.message}`);

  const profile = profileResult.data as { full_name: string; role: FerRole };

  return {
    generatedAt: new Date().toISOString(),
    user: {
      email: auth.user.email ?? "",
      fullName: profile.full_name,
      role: profile.role,
    },
    incidents: (incidentsResult.data ?? []) as IncidentRecord[],
    interventions: (interventionsResult.data ?? []) as InterventionRecord[],
    assets: (assetsResult.data ?? []) as AssetRecord[],
    payments: (paymentsResult.data ?? []) as PaymentRecord[],
    resources: (resourcesResult.data ?? []) as ResourceRecord[],
  };
}
