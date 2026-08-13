import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { getDashboardData } from "../lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();
  if (!data) redirect("/login");
  return <DashboardClient initialData={data} />;
}
