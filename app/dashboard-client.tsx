/* eslint-disable @next/next/no-img-element -- private signed evidence URLs must bypass the public image optimizer */
"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle, BarChart3, Bell, ChevronDown, ClipboardList, Construction, ExternalLink,
  FileImage, Filter, Landmark, Layers3, LogOut, Map, MapPin, Menu, Phone, Plus,
  Search, Settings, ShipWheel, Signpost, UserRound, Video, WalletCards, Wrench, X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardData } from "../lib/dashboard";
import { formatEvidenceSize } from "../lib/evidence";
import { logout } from "./login/actions";
import type { MapItem } from "./map-view";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <div className="map-loading">Chargement de la carte…</div>,
});

type Incident = MapItem & {
  databaseId: string;
  category: string;
  severity: "Critique" | "Élevée" | "Modérée";
  observations: string | null;
  reporterFirstName: string | null;
  reporterLastName: string | null;
  reporterPhone: string | null;
};

const nav = [
  ["Vue d’ensemble", BarChart3], ["Carte & réseau", Map], ["Signalements", AlertTriangle],
  ["Interventions", ClipboardList], ["Financement", WalletCards], ["Patrimoine", Signpost],
  ["Ouvrages & bacs", ShipWheel],
] as const;

const colorForSeverity = (severity: Incident["severity"]) =>
  severity === "Critique" ? "#d84b3e" : severity === "Élevée" ? "#ef8e34" : "#28707a";

const formatFcfa = (value: number) => {
  if (!value) return "0 FCFA";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mds`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  return `${value.toLocaleString("fr-FR")} FCFA`;
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const reporterContact = (incident: Incident) => {
  const name = [incident.reporterFirstName, incident.reporterLastName].filter(Boolean).join(" ");
  return [name, incident.reporterPhone].filter(Boolean).join(" · ");
};

export default function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const initialIncidents: Incident[] = initialData.incidents.map((item) => ({
    id: item.reference,
    databaseId: item.id,
    category: item.category,
    title: item.title,
    location: item.location,
    severity: item.severity,
    status: item.status,
    observations: item.observations,
    reporterFirstName: item.reporter_first_name,
    reporterLastName: item.reporter_last_name,
    reporterPhone: item.reporter_phone,
    lat: item.latitude,
    lng: item.longitude,
    color: colorForSeverity(item.severity),
  }));
  const [active, setActive] = useState("Vue d’ensemble");
  const [items, setItems] = useState(initialIncidents);
  const [selected, setSelected] = useState<Incident | null>(initialIncidents[0] ?? null);
  const [modal, setModal] = useState(false);
  const [layers, setLayers] = useState(false);
  const [query, setQuery] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const newIncidentButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!modal && !accountOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(false);
        setAccountOpen(false);
        newIncidentButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [modal, accountOpen]);

  const filtered = useMemo(
    () => items.filter((item) => `${item.title} ${item.location} ${item.category} ${item.id} ${reporterContact(item)}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const selectedEvidence = selected
    ? initialData.evidence.filter((evidence) => evidence.incident_id === selected.databaseId)
    : [];
  const totalBudget = initialData.interventions.reduce((sum, row) => sum + Number(row.budget_fcfa), 0);
  const totalCommitted = initialData.interventions.reduce((sum, row) => sum + Number(row.committed_fcfa), 0);
  const totalResources = initialData.resources.reduce((sum, row) => sum + Number(row.collected_fcfa), 0);
  const unpaid = initialData.payments.filter((row) => !row.paid_at && row.status !== "Payé");
  const unpaidAmount = unpaid.reduce((sum, row) => sum + Number(row.amount_fcfa), 0);
  const openIncidents = items.filter((row) => !["Résolu", "Rejeté"].includes(row.status)).length;
  const runningInterventions = initialData.interventions.filter((row) => row.status === "En cours").length;
  const engagementRate = totalBudget > 0 ? Math.round((totalCommitted / totalBudget) * 1000) / 10 : 0;
  const generatedAt = new Date(initialData.generatedAt).getTime();
  const paymentAlerts = unpaid.filter((row) => (generatedAt - new Date(row.received_at).getTime()) / 86_400_000 >= 50).length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError("");
    setSubmitting(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(data.get("title")), category: String(data.get("category")),
          location: String(data.get("location")), observations: String(data.get("observations")),
          reporterFirstName: String(data.get("reporterFirstName") || ""),
          reporterLastName: String(data.get("reporterLastName") || ""),
          reporterPhone: String(data.get("reporterPhone") || ""),
          severity: String(data.get("severity")), latitude: Number(data.get("latitude")),
          longitude: Number(data.get("longitude")),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setFormError(payload.error || "Enregistrement impossible");
        return;
      }
      const row = payload.incident;
      const incident: Incident = {
        id: row.reference, databaseId: row.id, category: row.category, title: row.title,
        location: row.location, severity: row.severity, status: row.status,
        observations: row.observations, reporterFirstName: row.reporter_first_name,
        reporterLastName: row.reporter_last_name, reporterPhone: row.reporter_phone,
        lat: row.latitude, lng: row.longitude,
        color: colorForSeverity(row.severity),
      };
      setItems((current) => [incident, ...current]);
      setSelected(incident);
      setModal(false);
      form.reset();
    } catch {
      setFormError("Connexion au serveur impossible");
    } finally {
      setSubmitting(false);
    }
  }

  const currentDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(initialData.generatedAt));
  const currentTitle = active === "Vue d’ensemble" ? "État du réseau et des financements" : active;

  return <main className="app-shell">
    {mobileOpen && <button className="mobile-backdrop" aria-label="Fermer la navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><span>FER</span><i /></div><div><strong>Signale CI</strong><small>Pilotage territorial</small></div></div>
      <nav aria-label="Navigation principale"><p>PILOTAGE</p>{nav.map(([label, Icon]) => <button key={label} className={active === label ? "active" : ""} onClick={() => { setActive(label); setMobileOpen(false); }}><Icon size={18} />{label}{label === "Signalements" && <em>{items.length}</em>}</button>)}<p>ADMINISTRATION</p><button disabled title="Bientôt disponible"><Wrench size={18} />Équipes & prestataires</button><button onClick={() => { setAccountOpen(true); setMobileOpen(false); }}><Settings size={18} />Mon compte</button></nav>
      <div className="side-foot"><span /><div><strong>Système opérationnel</strong><small>Données Supabase actives</small></div></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><button className="mobile" aria-label="Ouvrir la navigation" onClick={() => setMobileOpen(true)}><Menu /></button><div><p>Plateforme de pilotage</p><h1>{active}</h1></div><div className="top-actions"><label className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Route, ouvrage, décompte…" aria-label="Rechercher" /></label><button className="icon" aria-label="Notifications" disabled><Bell size={19} /></button><div className="profile-wrap"><button className="profile" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}><span>{initials(initialData.user.fullName)}</span><div><strong>{initialData.user.fullName}</strong><small>{initialData.user.role === "direction" ? "Direction" : "Agent technique"}</small></div><ChevronDown size={15} /></button>{profileOpen && <div className="profile-menu"><button onClick={() => { setAccountOpen(true); setProfileOpen(false); }}><UserRound size={16} />Mon compte</button><form action={logout}><button type="submit"><LogOut size={16} />Se déconnecter</button></form></div>}</div></div></header>
      <div className="content"><section className="heading"><div><p>{currentDate}</p><h2>{currentTitle}</h2><span>Les chiffres ci-dessous proviennent de la base Signale CI.</span></div><div><button ref={newIncidentButton} className="primary" onClick={() => setModal(true)}><Plus size={18} />Nouveau signalement</button></div></section>
        {active !== "Vue d’ensemble" && <section className="module-banner"><strong>{active}</strong><span>Ce module est en cours d’enrichissement. Les données réelles disponibles restent visibles ci-dessous.</span></section>}
        <section className="objectives"><span>OBJECTIFS FER</span><div><p><i className={engagementRate <= 100 ? "ok" : "warn"} />Engagements / budget <b>{engagementRate}%</b></p><p><i className={paymentAlerts ? "warn" : "ok"} />Décomptes proches de 60 jours <b>{paymentAlerts}</b></p><p><i className="ok" />Patrimoine inventorié <b>{initialData.assets.length}</b></p><p><i className="ok" />Ressources enregistrées <b>{initialData.resources.length}</b></p></div></section>
        <section className="kpis"><article><span className="kicon red"><AlertTriangle /></span><div><small>Signalements ouverts</small><strong>{openIncidents}</strong><p>{items.length} signalement(s) au total</p></div></article><article><span className="kicon amber"><Construction /></span><div><small>Interventions en cours</small><strong>{runningInterventions}</strong><p>{initialData.interventions.length} intervention(s) enregistrée(s)</p></div></article><article><span className="kicon green"><Landmark /></span><div><small>Ressources mobilisées</small><strong>{formatFcfa(totalResources)}</strong><p>Données déclarées dans Signale CI</p></div></article><article><span className="kicon blue"><WalletCards /></span><div><small>Décomptes à régler</small><strong>{formatFcfa(unpaidAmount)}</strong><p>{unpaid.length} décompte(s) ouvert(s)</p></div></article></section>
        <section className="main-grid"><article className="card map-card"><div className="card-head"><div><h3>Carte opérationnelle</h3><p>Signalements géolocalisés enregistrés</p></div><div className="map-actions"><button onClick={() => setLayers(!layers)}><Layers3 size={16} />Couches<ChevronDown size={14} /></button><button disabled title="Bientôt disponible"><Filter size={16} />Filtres</button>{layers && <div className="layer-menu"><label><input type="checkbox" defaultChecked />Signalements</label><label><input type="checkbox" disabled />Interventions — bientôt</label><label><input type="checkbox" disabled />Patrimoine — bientôt</label></div>}</div></div><div className="map-wrap"><MapView items={filtered} selected={selected} onSelect={(item) => setSelected(item as Incident)} />{!items.length && <div className="map-empty"><MapPin /><strong>Aucun signalement cartographié</strong><span>Ajoutez le premier signalement pour faire apparaître un point sur la carte.</span></div>}<div className="legend"><span><i className="crit" />Critique</span><span><i className="work" />Élevée</span><span><i className="asset" />Modérée</span></div></div></article>
          <article className="card alerts"><div className="card-head"><div><h3>Alertes prioritaires</h3><p>Signalements nécessitant une action</p></div><span className="record-count">{filtered.length}</span></div><div className="alert-list">{filtered.slice(0, 8).map((item) => <button key={item.id} className={selected?.id === item.id ? "selected" : ""} onClick={() => setSelected(item)}><span className="alert-icon" style={{ background: `${item.color}18`, color: item.color }}><MapPin size={18} /></span><span className="alert-copy"><strong>{item.title}</strong><small>{item.location}</small>{reporterContact(item) && <em>Contact : {reporterContact(item)}</em>}<em>{item.id} · {item.status}</em></span><b className={`severity s-${item.severity[0]}`}>{item.severity}</b></button>)}{!filtered.length && <div className="empty-state"><AlertTriangle /><strong>{query ? "Aucun résultat" : "Aucun signalement"}</strong><span>{query ? "Modifiez votre recherche." : "La base Signale CI ne contient pas encore de signalement."}</span></div>}</div></article></section>
        {selected ? <section className="card incident-detail"><div className="card-head"><div><h3>Détail du signalement</h3><p>{selected.id} · {selected.category}</p></div><b className={`severity s-${selected.severity[0]}`}>{selected.severity}</b></div><div className="incident-detail-body"><div className="incident-summary"><div><strong>{selected.title}</strong><span><MapPin />{selected.location}</span>{reporterContact(selected) ? <span><Phone />{reporterContact(selected)}</span> : <span>Déclarant non renseigné</span>}</div><p>{selected.observations || "Aucune information complémentaire."}</p></div><div className="incident-evidence"><div><strong>Photos et vidéos</strong><span>{selectedEvidence.length} preuve(s)</span></div>{selectedEvidence.length ? <div className="incident-evidence-grid">{selectedEvidence.map((evidence) => <article key={evidence.id}>{evidence.signed_url ? evidence.media_type === "video" ? <video controls preload="metadata" src={evidence.signed_url} /> : <img src={evidence.signed_url} alt={`Preuve : ${evidence.original_name}`} /> : <div className="incident-evidence-unavailable"><FileImage />Indisponible</div>}<div><span>{evidence.media_type === "video" ? <Video /> : <FileImage />}{evidence.original_name}</span><small>{formatEvidenceSize(evidence.size_bytes)}</small>{evidence.signed_url ? <a href={evidence.signed_url} target="_blank" rel="noreferrer">Ouvrir <ExternalLink /></a> : null}</div></article>)}</div> : <div className="incident-evidence-empty"><FileImage /><span>Aucune photo ou vidéo jointe à ce signalement.</span></div>}</div></div></section> : null}
        <section className="bottom-grid"><article className="card performance"><div className="card-head"><div><h3>Avancement des interventions</h3><p>Données réelles par intervention</p></div><span className="record-count">{initialData.interventions.length}</span></div><div className="progress-list">{initialData.interventions.slice(0, 5).map((row) => <div key={row.id}><p><strong>{row.type}</strong><span>{row.progress}%</span></p><small>{row.contractor} · {row.status}</small><progress value={row.progress} max="100" /></div>)}{!initialData.interventions.length && <div className="empty-state compact"><Construction /><strong>Aucune intervention</strong><span>Les travaux planifiés apparaîtront ici.</span></div>}</div></article>
          <article className="card finance"><div className="card-head"><div><h3>Maîtrise financière</h3><p>Engagements issus des interventions</p></div></div><div className="donut-row"><div className="donut" style={{ background: `conic-gradient(var(--green2) 0 ${Math.min(engagementRate, 100)}%,#e4ece9 ${Math.min(engagementRate, 100)}%)` }}><strong>{engagementRate}%</strong><span>engagé</span></div><div className="finance-data"><p><span>Budget</span><b>{formatFcfa(totalBudget)}</b></p><p><span>Engagé</span><b>{formatFcfa(totalCommitted)}</b></p><p><span>À régler</span><b>{formatFcfa(unpaidAmount)}</b></p><progress value={Math.min(engagementRate, 100)} max="100" /></div></div>{!totalBudget && <div className="finance-note">Aucun budget d’intervention enregistré.</div>}</article></section>
      </div>
    </section>
    {modal && <div className="modal-bg" role="presentation" onMouseDown={() => setModal(false)}><form className="modal" role="dialog" aria-modal="true" aria-labelledby="incident-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><h3 id="incident-title">Nouveau signalement</h3><p>Enregistrer un problème géolocalisé</p></div><button type="button" aria-label="Fermer" onClick={() => setModal(false)}><X /></button></div>{formError && <div className="login-error" role="alert">{formError}</div>}<label>Intitulé<input name="title" required maxLength={160} autoFocus placeholder="Ex. Nid-de-poule important" /></label><div className="form-row"><label>Catégorie<select name="category"><option>Voirie</option><option>Feux</option><option>Accotement</option><option>Ouvrage</option><option>Bac</option><option>Péage / pesage</option><option>Orpaillage clandestin</option><option>Insécurité</option><option>Nuisance sonore</option></select></label><label>Priorité<select name="severity"><option>Critique</option><option>Élevée</option><option>Modérée</option></select></label></div><label>Localisation<input name="location" required maxLength={240} placeholder="Route, commune ou point de repère" /></label><div className="form-row"><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" required defaultValue="5.348" /></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" required defaultValue="-4.006" /></label></div><div className="form-row"><label>Prénom du déclarant (facultatif)<input name="reporterFirstName" maxLength={100} autoComplete="given-name" /></label><label>Nom du déclarant (facultatif)<input name="reporterLastName" maxLength={100} autoComplete="family-name" /></label></div><label>Téléphone du déclarant (facultatif)<input name="reporterPhone" type="tel" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="Ex. +225 07 00 00 00 00" /></label><label>Observations<textarea name="observations" maxLength={2000} placeholder="Décrivez le problème et les risques…" /></label><div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(false)}>Annuler</button><button className="primary" disabled={submitting}>{submitting ? "Enregistrement…" : "Enregistrer"}</button></div></form></div>}
    {accountOpen && <AccountModal user={initialData.user} onClose={() => setAccountOpen(false)} />}
  </main>;
}

function AccountModal({ user, onClose }: { user: DashboardData["user"]; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(""); setError("");
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") || "");
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (!currentPassword) return setError("Saisissez votre mot de passe actuel.");
    if (password.length < 12) return setError("Le mot de passe doit contenir au moins 12 caractères.");
    if (password !== confirmation) return setError("Les deux mots de passe ne correspondent pas.");
    setPending(true);
    const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, password }) });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) return setError(payload.error || "Modification impossible");
    setMessage("Mot de passe modifié avec succès.");
    event.currentTarget.reset();
  }

  return <div className="modal-bg" role="presentation" onMouseDown={onClose}><div className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><h3 id="account-title">Mon compte</h3><p>Identité et sécurité du compte FER</p></div><button type="button" aria-label="Fermer" onClick={onClose}><X /></button></div><div className="account-summary"><span>{initials(user.fullName)}</span><div><strong>{user.fullName}</strong><small>{user.email}</small><em>{user.role === "direction" ? "Direction" : "Agent technique"}</em></div></div><form onSubmit={changePassword}>{error && <div className="login-error" role="alert">{error}</div>}{message && <div className="success-message" role="status">{message}</div>}<h4>Changer le mot de passe</h4><label>Mot de passe actuel<input name="currentPassword" type="password" required autoComplete="current-password" /></label><label>Nouveau mot de passe<input name="password" type="password" required minLength={12} autoComplete="new-password" /></label><label>Confirmer le mot de passe<input name="confirmation" type="password" required minLength={12} autoComplete="new-password" /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Fermer</button><button className="primary" disabled={pending}>{pending ? "Modification…" : "Modifier"}</button></div></form></div></div>;
}
