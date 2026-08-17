export function siteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const vercelDeploymentUrl = process.env.VERCEL_URL?.trim();
  const fallbackUrl = process.env.NODE_ENV === "production"
    ? "https://geosignale-ci.vercel.app"
    : "http://localhost:3000";
  const value = configuredUrl || vercelProductionUrl || vercelDeploymentUrl || fallbackUrl;
  const absoluteUrl = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return absoluteUrl.replace(/\/$/, "");
}
