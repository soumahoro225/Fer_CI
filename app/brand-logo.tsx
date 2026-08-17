import Image from "next/image";

export default function BrandLogo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return <span className={`brand-logo ${className}`} role="img" aria-label="GEOSIGNALE-CI — Repère et signal">
    <span className="brand-logo-symbol" aria-hidden="true"><Image className="brand-logo-source" src="/logo-signale-ci.svg" width={171} height={262} alt="" priority={priority} /></span>
    <span className="brand-logo-wording" aria-hidden="true"><strong>GEOSIGNALE-CI</strong><small>Repère &amp; signal</small></span>
  </span>;
}
