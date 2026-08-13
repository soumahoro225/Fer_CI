import "server-only";

import { createClient } from "./supabase/server";
import type { FerRole } from "./dashboard";

export type CitizenIncident = {
  id: string;
  reference: string;
  title: string;
  category: string;
  location: string;
  status: string;
  observations: string | null;
  latitude: number;
  longitude: number;
  location_source: "gps" | "manual_map" | null;
  location_accuracy_m: number | null;
  created_at: string;
  updated_at: string;
};

export type CitizenPortalData = {
  user: {
    email: string;
    fullName: string;
    phone: string | null;
    role: FerRole;
  };
  incidents: CitizenIncident[];
};

export async function getCitizenPortalData(): Promise<CitizenPortalData | null> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;

  const [profileResult, incidentsResult] = await Promise.all([
    supabase.from("profiles").select("full_name,phone,role").eq("id", auth.user.id).single(),
    supabase
      .from("incidents")
      .select("id,reference,title,category,location,status,observations,latitude,longitude,location_source,location_accuracy_m,created_at,updated_at")
      .eq("created_by", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (profileResult.error || incidentsResult.error) {
    throw new Error("Chargement de l’espace citoyen impossible");
  }

  return {
    user: {
      email: auth.user.email ?? "",
      fullName: profileResult.data.full_name,
      phone: profileResult.data.phone,
      role: profileResult.data.role as FerRole,
    },
    incidents: (incidentsResult.data ?? []) as CitizenIncident[],
  };
}
