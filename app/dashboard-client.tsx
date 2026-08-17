/* eslint-disable @next/next/no-img-element -- private signed evidence URLs must bypass the public image optimizer */
"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle, BarChart3, Bell, Camera, CheckCircle2, ChevronDown, ClipboardList, Clock3, Construction, Crosshair, ExternalLink,
  FileImage, Filter, Image as ImageIcon, Layers3, LocateFixed, LogOut, Map as MapIcon, MapPin, Menu, Phone, Plus,
  Search, Settings, ShipWheel, Signpost, Trash2, UserCheck, UserRound, Video, WalletCards, Wrench, X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardData, EvidenceRecord, IncidentRecord, StaffProfile } from "../lib/dashboard";
import {
  EVIDENCE_BUCKET, EVIDENCE_MIME_TYPES, MAX_EVIDENCE_FILES, MAX_EVIDENCE_FILE_SIZE,
  evidenceExtension, evidenceMediaType, evidenceMimeType, formatEvidenceSize,
} from "../lib/evidence";
import { createClient } from "../lib/supabase/client";
import { logout } from "./login/actions";
import BrandLogo from "./brand-logo";
import { CategoryIcon, CategoryPicker, incidentCategories } from "./category-icon";
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
  source: "FER" | "Citoyen";
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
};
type EvidenceSelection = { file: File; mimeType: string; previewUrl: string };
type StaffLocationSource = "gps" | "manual_map";
type StaffLocationState = "idle" | "locating" | "ready" | "error";

const nav = [
  ["Vue d’ensemble", BarChart3], ["Carte & réseau", MapIcon], ["Signalements", AlertTriangle],
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
const roleLabel = (role: DashboardData["user"]["role"]) => role === "direction" ? "Direction" : role === "agent" ? "Agent technique" : "Citoyen";
const reporterContact = (incident: Incident) => {
  const name = [incident.reporterFirstName, incident.reporterLastName].filter(Boolean).join(" ");
  return [name, incident.reporterPhone].filter(Boolean).join(" · ");
};

const incidentFromRecord = (item: IncidentRecord): Incident => ({
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
  source: item.source,
  assignedTo: item.assigned_to,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  lat: item.latitude,
  lng: item.longitude,
  color: colorForSeverity(item.severity),
});

export default function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const initialIncidents: Incident[] = initialData.incidents.map(incidentFromRecord);
  const [active, setActive] = useState("Vue d’ensemble");
  const [items, setItems] = useState(initialIncidents);
  const [selected, setSelected] = useState<Incident | null>(initialIncidents[0] ?? null);
  const [modal, setModal] = useState(false);
  const [layers, setLayers] = useState(false);
  const [query, setQuery] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientRequestId, setClientRequestId] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceSelection[]>([]);
  const [evidence, setEvidence] = useState(initialData.evidence);
  const [uploadMessage, setUploadMessage] = useState("");
  const [latitudeText, setLatitudeText] = useState("");
  const [longitudeText, setLongitudeText] = useState("");
  const [locationSource, setLocationSource] = useState<StaffLocationSource | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationState, setLocationState] = useState<StaffLocationState>("idle");
  const [locationMessage, setLocationMessage] = useState("La position sera détectée à l’ouverture du formulaire.");
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const newIncidentButton = useRef<HTMLButtonElement>(null);
  const evidenceFilesRef = useRef<EvidenceSelection[]>([]);

  useEffect(() => {
    evidenceFilesRef.current = evidenceFiles;
  }, [evidenceFiles]);

  useEffect(() => () => {
    evidenceFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  useEffect(() => {
    if (!modal && !accountOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!submitting) setModal(false);
        setAccountOpen(false);
        newIncidentButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [modal, accountOpen, submitting]);

  const filtered = useMemo(
    () => items.filter((item) => `${item.title} ${item.location} ${item.category} ${item.id} ${reporterContact(item)}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const selectedEvidence = selected
    ? evidence.filter((item) => item.incident_id === selected.databaseId)
    : [];
  const totalBudget = initialData.interventions.reduce((sum, row) => sum + Number(row.budget_fcfa), 0);
  const totalCommitted = initialData.interventions.reduce((sum, row) => sum + Number(row.committed_fcfa), 0);
  const unpaid = initialData.payments.filter((row) => !row.paid_at && row.status !== "Payé");
  const unpaidAmount = unpaid.reduce((sum, row) => sum + Number(row.amount_fcfa), 0);
  const categoryKpis = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1));
    return incidentCategories.map((category) => ({
      ...category,
      count: counts.get(category.value) ?? 0,
    }));
  }, [items]);
  const engagementRate = totalBudget > 0 ? Math.round((totalCommitted / totalBudget) * 1000) / 10 : 0;
  const generatedAt = new Date(initialData.generatedAt).getTime();
  const paymentAlerts = unpaid.filter((row) => (generatedAt - new Date(row.received_at).getTime()) / 86_400_000 >= 50).length;

  function locateDevice() {
    setLocationState("locating");
    setLocationMessage("Recherche de la position fournie par votre navigateur…");
    if (!("geolocation" in navigator)) {
      setLocationState("error");
      setLocationMessage("Ce navigateur ne prend pas en charge la géolocalisation. Saisissez les coordonnées manuellement.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitudeText(position.coords.latitude.toFixed(6));
        setLongitudeText(position.coords.longitude.toFixed(6));
        setLocationSource("gps");
        setLocationAccuracy(Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null);
        setLocationState("ready");
        setLocationMessage(`Position précise détectée${Number.isFinite(position.coords.accuracy) ? ` à environ ${Math.round(position.coords.accuracy)} m` : ""}.`);
      },
      (error) => {
        setLocationState("error");
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage("Localisation refusée. Autorisez-la dans les paramètres du navigateur, puis appuyez sur « Me localiser ».");
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage("La localisation a pris trop de temps. Vérifiez que le service de localisation de l’ordinateur est activé, puis réessayez.");
        } else {
          setLocationMessage("Position indisponible. Activez le service de localisation de l’ordinateur, puis appuyez sur « Me localiser ».");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function editCoordinate(axis: "latitude" | "longitude", value: string) {
    if (axis === "latitude") setLatitudeText(value);
    else setLongitudeText(value);
    setLocationSource("manual_map");
    setLocationAccuracy(null);
    setLocationState("ready");
    setLocationMessage("Coordonnées modifiées manuellement. Vérifiez leur exactitude avant l’enregistrement.");
  }

  function openIncidentModal() {
    setFormError("");
    setUploadMessage("");
    setLatitudeText("");
    setLongitudeText("");
    setLocationSource(null);
    setLocationAccuracy(null);
    setLocationState("idle");
    setLocationMessage("Recherche de votre position…");
    evidenceFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setEvidenceFiles([]);
    setClientRequestId(crypto.randomUUID());
    setModal(true);
    locateDevice();
  }

  function selectEvidence(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    setFormError("");
    if (!incoming.length) return;
    if (evidenceFiles.length + incoming.length > MAX_EVIDENCE_FILES) {
      setFormError(`Vous pouvez joindre au maximum ${MAX_EVIDENCE_FILES} photos ou vidéos.`);
      return;
    }
    const next: EvidenceSelection[] = [];
    for (const file of incoming) {
      const mimeType = evidenceMimeType(file);
      if (!mimeType || !evidenceMediaType(mimeType)) {
        next.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        setFormError(`Le fichier « ${file.name} » n’est pas une photo ou une vidéo acceptée.`);
        return;
      }
      if (!file.size || file.size > MAX_EVIDENCE_FILE_SIZE) {
        next.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        setFormError(`Le fichier « ${file.name} » dépasse la limite de 40 Mo.`);
        return;
      }
      next.push({ file, mimeType, previewUrl: URL.createObjectURL(file) });
    }
    setEvidenceFiles((current) => [...current, ...next]);
  }

  function removeEvidence(index: number) {
    setEvidenceFiles((current) => {
      URL.revokeObjectURL(current[index].previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function uploadEvidence(incident: Incident): Promise<EvidenceRecord[]> {
    if (!evidenceFiles.length) return [];
    const supabase = createClient();
    const uploaded: EvidenceRecord[] = [];
    for (let index = 0; index < evidenceFiles.length; index += 1) {
      const selection = evidenceFiles[index];
      const mediaType = evidenceMediaType(selection.mimeType);
      if (!mediaType) throw new Error("Type de preuve invalide");
      setUploadMessage(`Envoi de la preuve ${index + 1} sur ${evidenceFiles.length}…`);
      const storagePath = `${initialData.user.id}/${incident.databaseId}/${clientRequestId}-${index}.${evidenceExtension(selection.file)}`;
      const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(storagePath, selection.file, {
        cacheControl: "3600",
        contentType: selection.mimeType,
        upsert: false,
      });
      const uploadStatus = Number((uploadError as { statusCode?: string | number } | null)?.statusCode);
      const alreadyUploaded = uploadStatus === 409 || /already exists|duplicate/i.test(uploadError?.message ?? "");
      if (uploadError && !alreadyUploaded) throw uploadError;

      const metadata = {
        incident_id: incident.databaseId,
        storage_path: storagePath,
        media_type: mediaType,
        mime_type: selection.mimeType,
        size_bytes: selection.file.size,
        original_name: (selection.file.name.trim() || `preuve-${index + 1}`).slice(0, 200),
        uploaded_by: initialData.user.id,
      };
      const fields = "id,incident_id,media_type,mime_type,size_bytes,original_name,storage_path,created_at";
      const { data: inserted, error: metadataError } = await supabase.from("incident_evidence").insert(metadata).select(fields).single();
      let row = inserted;
      if (metadataError?.code === "23505") {
        const { data: existing, error: existingError } = await supabase.from("incident_evidence").select(fields).eq("storage_path", storagePath).single();
        if (existingError) throw existingError;
        row = existing;
      } else if (metadataError) {
        throw metadataError;
      }
      if (!row) throw new Error("Métadonnées de preuve indisponibles");
      const { data: signed, error: signedError } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(storagePath, 3600);
      if (signedError) throw signedError;
      uploaded.push({ ...row, media_type: row.media_type as "image" | "video", signed_url: signed.signedUrl });
    }
    return uploaded;
  }

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
          clientRequestId,
          title: String(data.get("title")), category: String(data.get("category")),
          location: String(data.get("location")), observations: String(data.get("observations")),
          reporterFirstName: String(data.get("reporterFirstName") || ""),
          reporterLastName: String(data.get("reporterLastName") || ""),
          reporterPhone: String(data.get("reporterPhone") || ""),
          severity: String(data.get("severity")), latitude: Number(data.get("latitude")),
          longitude: Number(data.get("longitude")), locationSource,
          locationAccuracy,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setFormError(payload.error || "Enregistrement impossible");
        return;
      }
      const incident = incidentFromRecord(payload.incident as IncidentRecord);
      setItems((current) => current.some((item) => item.databaseId === incident.databaseId) ? current : [incident, ...current]);
      setSelected(incident);
      try {
        const uploaded = await uploadEvidence(incident);
        if (uploaded.length) setEvidence((current) => [...current, ...uploaded]);
      } catch (error) {
        console.error("staff.evidence.upload", error);
        setFormError(`Le signalement ${incident.id} est enregistré, mais toutes les preuves n’ont pas pu être envoyées. Vérifiez votre réseau puis appuyez de nouveau sur « Enregistrer ».`);
        return;
      }
      setModal(false);
      form.reset();
      evidenceFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setEvidenceFiles([]);
      setUploadMessage("");
    } catch {
      setFormError("Connexion au serveur impossible");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateIncidentWorkflow(databaseId: string, status: string, severity: Incident["severity"], assignedTo: string | null) {
    try {
      const response = await fetch("/api/incidents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: databaseId, status, severity, assignedTo }),
      });
      const payload = await response.json();
      if (!response.ok) return String(payload.error || "Mise à jour impossible");
      const updated = incidentFromRecord(payload.incident as IncidentRecord);
      setItems((current) => current.map((item) => item.databaseId === databaseId ? updated : item));
      setSelected((current) => current?.databaseId === databaseId ? updated : current);
      return null;
    } catch {
      return "Connexion au serveur impossible";
    }
  }

  async function deleteIncident(databaseId: string) {
    try {
      const response = await fetch("/api/incidents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: databaseId }),
      });
      const payload = await response.json();
      if (!response.ok) return String(payload.error || "Suppression impossible");
      const replacement = items.find((item) => item.databaseId !== databaseId) ?? null;
      setItems((current) => current.filter((item) => item.databaseId !== databaseId));
      setEvidence((current) => current.filter((item) => item.incident_id !== databaseId));
      setSelected((current) => current?.databaseId === databaseId ? replacement : current);
      if (payload.evidenceCleanupPending) console.warn("Le signalement est supprimé, mais le nettoyage de certaines preuves reste en attente.");
      return null;
    } catch {
      return "Connexion au serveur impossible";
    }
  }

  const currentDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(initialData.generatedAt));
  const currentTitle = active === "Vue d’ensemble" ? "État du réseau et des financements" : active;

  return <main className="app-shell">
    {mobileOpen && <button className="mobile-backdrop" aria-label="Fermer la navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="brand brand-with-logo"><BrandLogo className="sidebar-logo" priority /></div>
      <nav aria-label="Navigation principale"><p>PILOTAGE</p>{nav.map(([label, Icon]) => <button key={label} className={active === label ? "active" : ""} onClick={() => { setActive(label); setMobileOpen(false); }}><Icon size={18} />{label}{label === "Signalements" && <em>{items.length}</em>}</button>)}<p>ADMINISTRATION</p><button disabled title="Bientôt disponible"><Wrench size={18} />Équipes & prestataires</button><button onClick={() => { setAccountOpen(true); setMobileOpen(false); }}><Settings size={18} />Mon compte</button></nav>
      <div className="side-foot"><span /><div><strong>Système opérationnel</strong><small>Données Supabase actives</small></div></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><button className="mobile" aria-label="Ouvrir la navigation" onClick={() => setMobileOpen(true)}><Menu /></button><div><p>Plateforme de pilotage</p><h1>{active}</h1></div><div className="top-actions"><label className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un signalement…" aria-label="Rechercher" /></label><button className="icon" aria-label="Notifications" disabled><Bell size={19} /></button><div className="profile-wrap"><button className="profile" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}><span>{initials(initialData.user.fullName)}</span><div><strong>{initialData.user.fullName}</strong><small>{roleLabel(initialData.user.role)}</small></div><ChevronDown size={15} /></button>{profileOpen && <div className="profile-menu"><button onClick={() => { setAccountOpen(true); setProfileOpen(false); }}><UserRound size={16} />Mon compte</button><form action={logout}><button type="submit"><LogOut size={16} />Se déconnecter</button></form></div>}</div></div></header>
      <div className="content"><section className="heading"><div><p>{currentDate}</p><h2>{currentTitle}</h2><span>Les chiffres ci-dessous proviennent de la base GEOSIGNALE-CI.</span></div><div><button ref={newIncidentButton} className="primary" onClick={openIncidentModal}><Plus size={18} />Nouveau signalement</button></div></section>
        {active === "Signalements" ? <SignalementsModule items={items} evidence={evidence} staff={initialData.staff} selected={selected} onSelect={setSelected} query={query} onQueryChange={setQuery} onUpdate={updateIncidentWorkflow} onDelete={deleteIncident} canDelete={initialData.user.role === "direction"} /> : <>
        {active !== "Vue d’ensemble" && <section className="module-banner"><strong>{active}</strong><span>Ce module est en cours d’enrichissement. Les données réelles disponibles restent visibles ci-dessous.</span></section>}
        <section className="objectives"><span>OBJECTIFS FER</span><div><p><i className={engagementRate <= 100 ? "ok" : "warn"} />Engagements / budget <b>{engagementRate}%</b></p><p><i className={paymentAlerts ? "warn" : "ok"} />Décomptes proches de 60 jours <b>{paymentAlerts}</b></p><p><i className="ok" />Patrimoine inventorié <b>{initialData.assets.length}</b></p><p><i className="ok" />Ressources enregistrées <b>{initialData.resources.length}</b></p></div></section>
        <section className="kpis" aria-label="Nombre de signalements par catégorie">
          <article><span className="kicon green"><BarChart3 /></span><div><small>Total des signalements</small><strong>{items.length}</strong></div></article>
          {categoryKpis.map((category) => <article key={category.value}><span className="kicon category-kicon"><CategoryIcon category={category.value} /></span><div><small>{category.label}</small><strong>{category.count}</strong></div></article>)}
        </section>
        <section className="main-grid"><article className="card map-card"><div className="card-head"><div><h3>Carte opérationnelle</h3><p>Signalements géolocalisés enregistrés</p></div><div className="map-actions"><button onClick={() => setLayers(!layers)}><Layers3 size={16} />Couches<ChevronDown size={14} /></button><button disabled title="Bientôt disponible"><Filter size={16} />Filtres</button>{layers && <div className="layer-menu"><label><input type="checkbox" defaultChecked />Signalements</label><label><input type="checkbox" disabled />Interventions — bientôt</label><label><input type="checkbox" disabled />Patrimoine — bientôt</label></div>}</div></div><div className="map-wrap"><MapView items={filtered} selected={selected} onSelect={(item) => setSelected(item as Incident)} />{!items.length && <div className="map-empty"><MapPin /><strong>Aucun signalement cartographié</strong><span>Ajoutez le premier signalement pour faire apparaître un point sur la carte.</span></div>}<div className="legend"><span><i className="crit" />Critique</span><span><i className="work" />Élevée</span><span><i className="asset" />Modérée</span></div></div></article>
          <article className="card alerts"><div className="card-head"><div><h3>Alertes prioritaires</h3><p>Signalements nécessitant une action</p></div><span className="record-count">{filtered.length}</span></div><div className="alert-list">{filtered.slice(0, 8).map((item) => <button key={item.id} className={selected?.id === item.id ? "selected" : ""} onClick={() => setSelected(item)}><CategoryIcon category={item.category} /><span className="alert-copy"><strong>{item.title}</strong><small>{item.location}</small>{reporterContact(item) && <em>Contact : {reporterContact(item)}</em>}<em>{item.id} · {item.status}</em></span><b className={`severity s-${item.severity[0]}`}>{item.severity}</b></button>)}{!filtered.length && <div className="empty-state"><AlertTriangle /><strong>{query ? "Aucun résultat" : "Aucun signalement"}</strong><span>{query ? "Modifiez votre recherche." : "La base GEOSIGNALE-CI ne contient pas encore de signalement."}</span></div>}</div></article></section>
        {selected ? <section className="card incident-detail"><div className="card-head"><div><h3>Détail du signalement</h3><p>{selected.id} · {selected.category}</p></div><b className={`severity s-${selected.severity[0]}`}>{selected.severity}</b></div><div className="incident-detail-body"><div className="incident-summary"><div><strong>{selected.title}</strong><span><MapPin />{selected.location}</span>{reporterContact(selected) ? <span><Phone />{reporterContact(selected)}</span> : <span>Déclarant non renseigné</span>}</div><p>{selected.observations || "Aucune information complémentaire."}</p></div><div className="incident-evidence"><div><strong>Photos et vidéos</strong><span>{selectedEvidence.length} preuve(s)</span></div>{selectedEvidence.length ? <div className="incident-evidence-grid">{selectedEvidence.map((evidence) => <article key={evidence.id}>{evidence.signed_url ? evidence.media_type === "video" ? <video controls preload="metadata" src={evidence.signed_url} /> : <img src={evidence.signed_url} alt={`Preuve : ${evidence.original_name}`} /> : <div className="incident-evidence-unavailable"><FileImage />Indisponible</div>}<div><span>{evidence.media_type === "video" ? <Video /> : <FileImage />}{evidence.original_name}</span><small>{formatEvidenceSize(evidence.size_bytes)}</small>{evidence.signed_url ? <a href={evidence.signed_url} target="_blank" rel="noreferrer">Ouvrir <ExternalLink /></a> : null}</div></article>)}</div> : <div className="incident-evidence-empty"><FileImage /><span>Aucune photo ou vidéo jointe à ce signalement.</span></div>}</div></div></section> : null}
        <section className="bottom-grid"><article className="card performance"><div className="card-head"><div><h3>Avancement des interventions</h3><p>Données réelles par intervention</p></div><span className="record-count">{initialData.interventions.length}</span></div><div className="progress-list">{initialData.interventions.slice(0, 5).map((row) => <div key={row.id}><p><strong>{row.type}</strong><span>{row.progress}%</span></p><small>{row.contractor} · {row.status}</small><progress value={row.progress} max="100" /></div>)}{!initialData.interventions.length && <div className="empty-state compact"><Construction /><strong>Aucune intervention</strong><span>Les travaux planifiés apparaîtront ici.</span></div>}</div></article>
          <article className="card finance"><div className="card-head"><div><h3>Maîtrise financière</h3><p>Engagements issus des interventions</p></div></div><div className="donut-row"><div className="donut" style={{ background: `conic-gradient(var(--green2) 0 ${Math.min(engagementRate, 100)}%,#e4ece9 ${Math.min(engagementRate, 100)}%)` }}><strong>{engagementRate}%</strong><span>engagé</span></div><div className="finance-data"><p><span>Budget</span><b>{formatFcfa(totalBudget)}</b></p><p><span>Engagé</span><b>{formatFcfa(totalCommitted)}</b></p><p><span>À régler</span><b>{formatFcfa(unpaidAmount)}</b></p><progress value={Math.min(engagementRate, 100)} max="100" /></div></div>{!totalBudget && <div className="finance-note">Aucun budget d’intervention enregistré.</div>}</article></section>
        </>}
      </div>
    </section>
    {modal && <div className="modal-bg" role="presentation" onMouseDown={() => { if (!submitting) setModal(false); }}>
      <form className="modal incident-modal" role="dialog" aria-modal="true" aria-labelledby="incident-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><h3 id="incident-title">Nouveau signalement</h3><p>Enregistrer un problème géolocalisé</p></div><button type="button" aria-label="Fermer" onClick={() => setModal(false)} disabled={submitting}><X /></button></div>
        {formError && <div className="login-error" role="alert">{formError}</div>}
        <label>Intitulé<input name="title" required maxLength={160} autoFocus placeholder="Ex. Nid-de-poule important" /></label>
        <CategoryPicker legend="Catégorie" />
        <label>Priorité<select name="severity"><option>Critique</option><option>Élevée</option><option>Modérée</option></select></label>
        <label>Localisation<input name="location" required maxLength={240} placeholder="Route, commune ou point de repère" /></label>
        <div className="form-row"><label>Latitude<input name="latitude" type="number" inputMode="decimal" step="any" min="-90" max="90" required value={latitudeText} onChange={(event) => editCoordinate("latitude", event.target.value)} placeholder="Détection automatique…" /></label><label>Longitude<input name="longitude" type="number" inputMode="decimal" step="any" min="-180" max="180" required value={longitudeText} onChange={(event) => editCoordinate("longitude", event.target.value)} placeholder="Détection automatique…" /></label></div>
        <div className={`staff-location-status ${locationState}`} role="status"><Crosshair /><span>{locationMessage}</span><button type="button" onClick={locateDevice} disabled={locationState === "locating"}><LocateFixed />{locationState === "locating" ? "Localisation…" : "Me localiser"}</button></div>
        <div className="form-row"><label>Prénom du déclarant (facultatif)<input name="reporterFirstName" maxLength={100} autoComplete="given-name" /></label><label>Nom du déclarant (facultatif)<input name="reporterLastName" maxLength={100} autoComplete="family-name" /></label></div>
        <label>Téléphone du déclarant (facultatif)<input name="reporterPhone" type="tel" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="Ex. +225 07 00 00 00 00" /></label>
        <label>Observations<textarea name="observations" maxLength={2000} placeholder="Décrivez le problème et les risques…" /></label>
        <label className="citizen-evidence-picker"><Camera /><span><strong>Ajouter des photos ou vidéos justificatives</strong><small>3 fichiers maximum · 40 Mo par fichier</small></span><input type="file" accept={EVIDENCE_MIME_TYPES.join(",")} multiple onChange={selectEvidence} disabled={submitting || evidenceFiles.length >= MAX_EVIDENCE_FILES} /></label>
        {evidenceFiles.length ? <div className="citizen-evidence-grid">{evidenceFiles.map((item, index) => <article key={`${item.file.name}-${item.file.lastModified}-${index}`}><div className="citizen-evidence-preview">{evidenceMediaType(item.mimeType) === "video" ? <video src={item.previewUrl} muted preload="metadata" /> : ["image/heic", "image/heif"].includes(item.mimeType) ? <ImageIcon /> : <img src={item.previewUrl} alt={`Aperçu de ${item.file.name}`} />}</div><div><strong>{item.file.name}</strong><small>{evidenceMediaType(item.mimeType) === "video" ? <Video /> : <ImageIcon />}{formatEvidenceSize(item.file.size)}</small></div><button type="button" aria-label={`Retirer ${item.file.name}`} onClick={() => removeEvidence(index)} disabled={submitting}><Trash2 /></button></article>)}</div> : <div className="citizen-evidence-empty"><ImageIcon /><span>Ajoutez une photo ou une vidéo pour faciliter l’évaluation du signalement.</span></div>}
        {uploadMessage ? <div className="citizen-upload-message" role="status"><Camera /><span>{uploadMessage}</span></div> : null}
        <div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(false)} disabled={submitting}>Annuler</button><button className="primary" disabled={submitting}>{submitting ? "Enregistrement…" : "Enregistrer"}</button></div>
      </form>
    </div>}
    {accountOpen && <AccountModal user={initialData.user} onClose={() => setAccountOpen(false)} />}
  </main>;
}

const workflowStatuses = ["À qualifier", "Validé", "Planifié", "En traitement", "Résolu", "Rejeté"];

type SignalementsModuleProps = {
  items: Incident[];
  evidence: EvidenceRecord[];
  staff: StaffProfile[];
  selected: Incident | null;
  onSelect: (incident: Incident) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onUpdate: (databaseId: string, status: string, severity: Incident["severity"], assignedTo: string | null) => Promise<string | null>;
  onDelete: (databaseId: string) => Promise<string | null>;
  canDelete: boolean;
};

function SignalementsModule({ items, evidence, staff, selected, onSelect, query, onQueryChange, onUpdate, onDelete, canDelete }: SignalementsModuleProps) {
  const [category, setCategory] = useState("Toutes");
  const [status, setStatus] = useState("Tous");
  const [severity, setSeverity] = useState("Toutes");
  const [assignee, setAssignee] = useState("Tous");
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b, "fr")), [items]);
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesQuery = !normalizedQuery || `${item.id} ${item.title} ${item.location} ${item.category} ${item.status} ${reporterContact(item)}`.toLocaleLowerCase("fr").includes(normalizedQuery);
    const matchesCategory = category === "Toutes" || item.category === category;
    const matchesStatus = status === "Tous" || item.status === status;
    const matchesSeverity = severity === "Toutes" || item.severity === severity;
    const matchesAssignee = assignee === "Tous" || (assignee === "none" ? !item.assignedTo : item.assignedTo === assignee);
    return matchesQuery && matchesCategory && matchesStatus && matchesSeverity && matchesAssignee;
  }), [assignee, category, items, normalizedQuery, severity, status]);
  const staffById = useMemo(() => new globalThis.Map(staff.map((profile) => [profile.id, profile.full_name])), [staff]);

  return <section className="signals-module" aria-labelledby="signals-module-title">
    <div className="signals-intro"><div><span>GESTION OPÉRATIONNELLE</span><h3 id="signals-module-title">Qualification des signalements</h3><p>Analysez les demandes citoyennes et internes, contrôlez les preuves, définissez la priorité puis affectez un responsable.</p></div><span className="signals-total">{items.length}<small>au total</small></span></div>
    <div className="signals-kpis">
      <article><span className="signal-kpi-icon amber"><Clock3 /></span><div><strong>{items.filter((item) => item.status === "À qualifier").length}</strong><small>À qualifier</small></div></article>
      <article><span className="signal-kpi-icon red"><AlertTriangle /></span><div><strong>{items.filter((item) => item.severity === "Critique" && !["Résolu", "Rejeté"].includes(item.status)).length}</strong><small>Critiques ouverts</small></div></article>
      <article><span className="signal-kpi-icon blue"><UserCheck /></span><div><strong>{items.filter((item) => item.assignedTo).length}</strong><small>Affectés</small></div></article>
      <article><span className="signal-kpi-icon green"><CheckCircle2 /></span><div><strong>{items.filter((item) => item.status === "Résolu").length}</strong><small>Résolus</small></div></article>
    </div>
    <div className="signals-filters card">
      <label className="signals-search"><span>Rechercher</span><div><Search /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Référence, lieu, déclarant…" /></div></label>
      <label><span>Catégorie</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Toutes</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Statut</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>Tous</option>{workflowStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Priorité</span><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option>Toutes</option><option>Critique</option><option>Élevée</option><option>Modérée</option></select></label>
      <label><span>Affectation</span><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="Tous">Toutes</option><option value="none">Non affectés</option>{staff.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></label>
    </div>
    <div className="signals-workspace">
      <article className="card signals-list-panel">
        <div className="signals-panel-head"><div><strong>Signalements</strong><span>{filteredItems.length} résultat(s)</span></div></div>
        <div className="signals-list">
          {filteredItems.map((item) => <button type="button" key={item.databaseId} className={`signal-row ${selected?.databaseId === item.databaseId ? "selected" : ""}`} onClick={() => onSelect(item)}>
            <CategoryIcon category={item.category} />
            <span className="signal-row-top"><b>{item.id}</b><em className={`signal-source ${item.source === "Citoyen" ? "citizen" : "internal"}`}>{item.source}</em><time>{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.createdAt))}</time></span>
            <strong>{item.title}</strong>
            <span className="signal-row-location"><MapPin />{item.location}</span>
            <span className="signal-row-bottom"><em className={`signal-status status-${item.status.toLocaleLowerCase("fr").replaceAll(" ", "-")}`}>{item.status}</em><b className={`severity s-${item.severity[0]}`}>{item.severity}</b><small>{item.assignedTo ? staffById.get(item.assignedTo) || "Agent FER" : "Non affecté"}</small></span>
          </button>)}
          {!filteredItems.length && <div className="signals-empty"><AlertTriangle /><strong>Aucun signalement trouvé</strong><span>Modifiez les filtres ou enregistrez un nouveau signalement.</span></div>}
        </div>
      </article>
      {selected ? <IncidentWorkflow key={selected.databaseId} incident={selected} evidence={evidence.filter((item) => item.incident_id === selected.databaseId)} staff={staff} onUpdate={onUpdate} onDelete={onDelete} canDelete={canDelete} /> : <article className="card signals-detail-empty"><ClipboardList /><strong>Sélectionnez un signalement</strong><span>La fiche, les preuves et le circuit de traitement apparaîtront ici.</span></article>}
    </div>
  </section>;
}

function IncidentWorkflow({ incident, evidence, staff, onUpdate, onDelete, canDelete }: { incident: Incident; evidence: EvidenceRecord[]; staff: StaffProfile[]; onUpdate: SignalementsModuleProps["onUpdate"]; onDelete: SignalementsModuleProps["onDelete"]; canDelete: boolean }) {
  const [status, setStatus] = useState(incident.status);
  const [severity, setSeverity] = useState(incident.severity);
  const [assignedTo, setAssignedTo] = useState(incident.assignedTo ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setMessage(""); setError("");
    const updateError = await onUpdate(incident.databaseId, status, severity, assignedTo || null);
    setPending(false);
    if (updateError) return setError(updateError);
    setMessage("Qualification et affectation enregistrées.");
  }

  async function removeIncident() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    const removalError = await onDelete(incident.databaseId);
    if (removalError) {
      setDeleting(false);
      setDeleteError(removalError);
    }
  }

  return <article className="card signal-detail-panel">
    <div className="signal-detail-head"><div className="signal-detail-title"><CategoryIcon category={incident.category} /><div><span>{incident.id} · {incident.category}</span><h3>{incident.title}</h3></div></div><b className={`severity s-${incident.severity[0]}`}>{incident.severity}</b></div>
    <div className="signal-detail-meta">
      <span><MapPin />{incident.location}</span>
      <span><Clock3 />Reçu le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(incident.createdAt))}</span>
      <a href={`https://www.openstreetmap.org/?mlat=${incident.lat}&mlon=${incident.lng}#map=17/${incident.lat}/${incident.lng}`} target="_blank" rel="noreferrer"><Crosshair />{incident.lat.toFixed(6)}, {incident.lng.toFixed(6)}<ExternalLink /></a>
    </div>
    <section className="signal-detail-section"><h4>Déclarant</h4>{reporterContact(incident) ? <div className="signal-contact"><UserRound /><div><strong>{[incident.reporterFirstName, incident.reporterLastName].filter(Boolean).join(" ") || "Identité non renseignée"}</strong><span>{incident.reporterPhone || "Téléphone non renseigné"}</span></div></div> : <p className="signal-muted">Le déclarant n’a pas communiqué ses coordonnées.</p>}</section>
    <section className="signal-detail-section"><h4>Observations</h4><p className="signal-observations">{incident.observations || "Aucune information complémentaire."}</p></section>
    <section className="signal-detail-section"><div className="signal-proof-title"><h4>Photos et vidéos</h4><span>{evidence.length} preuve(s)</span></div>{evidence.length ? <div className="incident-evidence-grid signal-proof-grid">{evidence.map((item) => <article key={item.id}>{item.signed_url ? item.media_type === "video" ? <video controls preload="metadata" src={item.signed_url} /> : <img src={item.signed_url} alt={`Preuve : ${item.original_name}`} /> : <div className="incident-evidence-unavailable"><FileImage />Indisponible</div>}<div><span>{item.media_type === "video" ? <Video /> : <FileImage />}{item.original_name}</span><small>{formatEvidenceSize(item.size_bytes)}</small>{item.signed_url ? <a href={item.signed_url} target="_blank" rel="noreferrer">Ouvrir <ExternalLink /></a> : null}</div></article>)}</div> : <div className="incident-evidence-empty"><FileImage /><span>Aucune preuve jointe.</span></div>}</section>
    <form className="signal-workflow-form" onSubmit={save}>
      <div className="signal-proof-title"><h4>Qualification et affectation</h4><span>Traitement FER</span></div>
      {error && <div className="login-error" role="alert">{error}</div>}{message && <div className="success-message" role="status">{message}</div>}
      <div><label>Statut<select value={status} onChange={(event) => setStatus(event.target.value)} disabled={pending}>{workflowStatuses.map((value) => <option key={value}>{value}</option>)}</select></label><label>Priorité<select value={severity} onChange={(event) => setSeverity(event.target.value as Incident["severity"])} disabled={pending}><option>Critique</option><option>Élevée</option><option>Modérée</option></select></label></div>
      <label>Responsable<select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} disabled={pending}><option value="">Non affecté</option>{staff.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name} — {profile.role === "direction" ? "Direction" : "Agent"}</option>)}</select></label>
      <button className="primary" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer les modifications"}</button>
    </form>
    {canDelete && <section className="signal-danger-zone" aria-labelledby={`delete-${incident.databaseId}`}>
      <div><h4 id={`delete-${incident.databaseId}`}>Zone d’administration</h4><p>La suppression retire définitivement le signalement et ses preuves. Les interventions liées sont conservées.</p></div>
      {deleteError && <div className="login-error" role="alert">{deleteError}</div>}
      {!confirmDelete ? <button type="button" className="signal-delete-button" onClick={() => setConfirmDelete(true)}><Trash2 />Supprimer ce signalement</button> : <div className="signal-delete-confirm"><strong>Confirmer la suppression de {incident.id} ?</strong><div><button type="button" className="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Annuler</button><button type="button" className="signal-delete-button" onClick={removeIncident} disabled={deleting}><Trash2 />{deleting ? "Suppression…" : "Supprimer définitivement"}</button></div></div>}
    </section>}
  </article>;
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

  return <div className="modal-bg" role="presentation" onMouseDown={onClose}><div className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><h3 id="account-title">Mon compte</h3><p>Identité et sécurité du compte GEOSIGNALE-CI</p></div><button type="button" aria-label="Fermer" onClick={onClose}><X /></button></div><div className="account-summary"><span>{initials(user.fullName)}</span><div><strong>{user.fullName}</strong><small>{user.email}</small><em>{roleLabel(user.role)}</em></div></div><form onSubmit={changePassword}>{error && <div className="login-error" role="alert">{error}</div>}{message && <div className="success-message" role="status">{message}</div>}<h4>Changer le mot de passe</h4><label>Mot de passe actuel<input name="currentPassword" type="password" required autoComplete="current-password" /></label><label>Nouveau mot de passe<input name="password" type="password" required minLength={12} autoComplete="new-password" /></label><label>Confirmer le mot de passe<input name="confirmation" type="password" required minLength={12} autoComplete="new-password" /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Fermer</button><button className="primary" disabled={pending}>{pending ? "Modification…" : "Modifier"}</button></div></form></div></div>;
}
