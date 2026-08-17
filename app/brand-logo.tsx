import Image from "next/image";

export default function BrandLogo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return <Image className={`brand-logo ${className}`} src="/logo-signale-ci.png" width={171} height={262} alt="Signale CI — Repère et signal" priority={priority} />;
}
