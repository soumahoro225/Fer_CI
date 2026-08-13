import { redirect } from "next/navigation";
import { getCitizenPortalData } from "../../lib/citizen";
import CitizenClient from "./citizen-client";

export const dynamic = "force-dynamic";

export default async function CitizenPage() {
  const data = await getCitizenPortalData();
  if (!data) redirect("/login");
  if (data.user.role !== "citoyen") redirect("/");
  return <CitizenClient initialData={data} />;
}
