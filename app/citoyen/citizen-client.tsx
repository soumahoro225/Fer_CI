/* eslint-disable @next/next/no-img-element -- local object URLs are not compatible with the Next.js image optimizer */
"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle, Camera, Check, ChevronRight, CircleUserRound, Crosshair, FileClock,
  Image as ImageIcon, LocateFixed, LogOut, MapPin, Navigation, Plus, RotateCcw,
  Send, ShieldCheck, Trash2, Video, X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import type { CitizenIncident, CitizenPortalData } from "../../lib/citizen";
import {
  EVIDENCE_BUCKET, EVIDENCE_MIME_TYPES, MAX_EVIDENCE_FILES, MAX_EVIDENCE_FILE_SIZE,
  evidenceExtension, evidenceMediaType, evidenceMimeType, formatEvidenceSize,
} from "../../lib/evidence";
import { createClient } from "../../lib/supabase/client";
import { logout } from "../login/actions";
import BrandLogo from "../brand-logo";
import { CategoryIcon, CategoryPicker } from "../category-icon";
import type { CitizenPosition } from "./location-map";

const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <div className="citizen-map-loading">Chargement de la carte…</div>,
});

type GpsState = "idle" | "locating" | "ready" | "error";
type LocationSource = "gps" | "manual_map";
type EvidenceSelection = { file: File; mimeType: string; previewUrl: string };

const statusLabels: Record<string, string> = {
  "À qualifier": "Reçu par le FER",
  Validé: "Validé",
  Planifié: "Intervention planifiée",
  "En traitement": "En cours de traitement",
  Résolu: "Résolu",
  Rejeté: "Non retenu",
};

const statusClass = (status: string) => status === "Résolu" ? "done" : status === "Rejeté" ? "rejected" : status === "À qualifier" ? "received" : "progress";
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "Citoyen";
const reportDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const isInIvoryCoast = (position: CitizenPosition) => position.lat >= 3.5 && position.lat <= 11 && position.lng >= -9 && position.lng <= -2;

export default function CitizenClient({ initialData }: { initialData: CitizenPortalData }) {
  const profileNameParts = initialData.user.fullName.trim().split(/\s+/).filter(Boolean);
  const defaultReporterLastName = profileNameParts[0] ?? "";
  const defaultReporterFirstName = profileNameParts.slice(1).join(" ");
  const [incidents, setIncidents] = useState(initialData.incidents);
  const [reportOpen, setReportOpen] = useState(false);
  const [position, setPosition] = useState<CitizenPosition | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsMessage, setGpsMessage] = useState("La position n’est demandée qu’après votre accord.");
  const [manualOpen, setManualOpen] = useState(false);
  const [latitudeText, setLatitudeText] = useState("");
  const [longitudeText, setLongitudeText] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successReference, setSuccessReference] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [clientRequestId, setClientRequestId] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceSelection[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const evidenceFilesRef = useRef<EvidenceSelection[]>([]);

  useEffect(() => {
    evidenceFilesRef.current = evidenceFiles;
  }, [evidenceFiles]);

  useEffect(() => () => {
    evidenceFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  useEffect(() => {
    if (!reportOpen || submitting) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReportOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [reportOpen, submitting]);

  function resetLocation() {
    setPosition(null);
    setLocationSource(null);
    setAccuracy(null);
    setConfirmed(false);
    setGpsState("idle");
    setGpsMessage("La position n’est demandée qu’après votre accord.");
    setManualOpen(false);
    setLatitudeText("");
    setLongitudeText("");
  }

  function openReport() {
    setSuccessReference("");
    setSuccessMessage("");
    setFormError("");
    setUploadMessage("");
    evidenceFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setEvidenceFiles([]);
    resetLocation();
    setClientRequestId(crypto.randomUUID());
    setReportOpen(true);
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

  async function uploadEvidence(incident: CitizenIncident) {
    if (!evidenceFiles.length) return;
    const supabase = createClient();
    for (let index = 0; index < evidenceFiles.length; index += 1) {
      const selection = evidenceFiles[index];
      const mediaType = evidenceMediaType(selection.mimeType);
      if (!mediaType) throw new Error("Type de preuve invalide");
      setUploadMessage(`Envoi de la preuve ${index + 1} sur ${evidenceFiles.length}…`);
      const storagePath = `${initialData.user.id}/${incident.id}/${clientRequestId}-${index}.${evidenceExtension(selection.file)}`;
      const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(storagePath, selection.file, {
        cacheControl: "3600",
        contentType: selection.mimeType,
        upsert: false,
      });
      const uploadStatus = Number((uploadError as { statusCode?: string | number } | null)?.statusCode);
      const alreadyUploaded = uploadStatus === 409 || /already exists|duplicate/i.test(uploadError?.message ?? "");
      if (uploadError && !alreadyUploaded) throw uploadError;

      const { error: metadataError } = await supabase.from("incident_evidence").insert({
        incident_id: incident.id,
        storage_path: storagePath,
        media_type: mediaType,
        mime_type: selection.mimeType,
        size_bytes: selection.file.size,
        original_name: (selection.file.name.trim() || `preuve-${index + 1}`).slice(0, 200),
        uploaded_by: initialData.user.id,
      });
      if (metadataError && metadataError.code !== "23505") throw metadataError;
    }
  }

  function selectPosition(next: CitizenPosition, source: LocationSource = "manual_map", nextAccuracy: number | null = null) {
    setPosition(next);
    setLocationSource(source);
    setAccuracy(nextAccuracy);
    setConfirmed(false);
    setLatitudeText(next.lat.toFixed(6));
    setLongitudeText(next.lng.toFixed(6));
    if (source === "manual_map") {
      setGpsState("ready");
      setGpsMessage("Point placé manuellement. Vérifiez puis confirmez la position.");
    }
  }

  function locateMe() {
    setConfirmed(false);
    if (!("geolocation" in navigator)) {
      setGpsState("error");
      setGpsMessage("Ce téléphone ne prend pas en charge la géolocalisation. Placez le point sur la carte.");
      setManualOpen(true);
      return;
    }
    setGpsState("locating");
    setGpsMessage("Recherche de votre position en cours…");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const nextPosition = { lat: result.coords.latitude, lng: result.coords.longitude };
        if (!isInIvoryCoast(nextPosition)) {
          setGpsState("error");
          setGpsMessage("La position détectée semble être hors de Côte d’Ivoire. Placez le point manuellement.");
          setManualOpen(true);
          return;
        }
        const nextAccuracy = Math.round(result.coords.accuracy);
        selectPosition(nextPosition, "gps", nextAccuracy);
        setGpsState("ready");
        setGpsMessage(nextAccuracy > 100
          ? `Position trouvée, précision faible d’environ ${nextAccuracy} m. Ajustez le point si nécessaire.`
          : `Position trouvée avec une précision d’environ ${nextAccuracy} m.`);
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Vous avez refusé l’accès à la position. Placez le point sur la carte ou saisissez les coordonnées.",
          2: "Votre position est indisponible. Activez le GPS ou placez le point manuellement.",
          3: "La recherche a pris trop de temps. Réessayez ou placez le point manuellement.",
        };
        setGpsState("error");
        setGpsMessage(messages[error.code] || "La position n’a pas pu être obtenue. Placez le point manuellement.");
        setManualOpen(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function applyCoordinates() {
    const lat = Number(latitudeText);
    const lng = Number(longitudeText);
    if (!latitudeText.trim() || !longitudeText.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 3.5 || lat > 11 || lng < -9 || lng > -2) {
      setGpsState("error");
      setGpsMessage("Saisissez des coordonnées situées en Côte d’Ivoire.");
      return;
    }
    selectPosition({ lat, lng });
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!position || !locationSource || !confirmed) {
      setFormError("Confirmez la position du signalement avant l’envoi.");
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    setFormError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/citoyen/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId,
          title: String(data.get("title") || ""),
          category: String(data.get("category") || ""),
          location: String(data.get("location") || ""),
          observations: String(data.get("observations") || ""),
          reporterFirstName: String(data.get("reporterFirstName") || ""),
          reporterLastName: String(data.get("reporterLastName") || ""),
          reporterPhone: String(data.get("reporterPhone") || ""),
          latitude: position.lat,
          longitude: position.lng,
          accuracy,
          locationSource,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setFormError(payload.error || "Envoi impossible. Vos informations sont conservées.");
        return;
      }
      const incident = payload.incident as CitizenIncident;
      setIncidents((current) => current.some((item) => item.id === incident.id) ? current : [incident, ...current]);
      try {
        await uploadEvidence(incident);
      } catch (error) {
        console.error("citizen.evidence.upload", error);
        setFormError(`Le signalement ${incident.reference} est enregistré, mais toutes les preuves n’ont pas pu être envoyées. Vérifiez votre réseau puis appuyez de nouveau sur « Envoyer le signalement ».`);
        return;
      }
      setSuccessReference(incident.reference);
      setSuccessMessage(evidenceFiles.length
        ? `${evidenceFiles.length} preuve(s) jointe(s) au signalement.`
        : "Aucune photo ou vidéo jointe.");
      setReportOpen(false);
      form.reset();
      evidenceFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setEvidenceFiles([]);
      setUploadMessage("");
    } catch {
      setFormError("Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="citizen-shell">
    <header className="citizen-header">
      <div className="citizen-logo"><BrandLogo className="citizen-header-logo" priority /><div><strong>GEOSIGNALE-CI</strong><small>Espace citoyen</small></div></div>
      <div className="citizen-user"><CircleUserRound /><div><strong>{initialData.user.fullName}</strong><small>{initialData.user.phone}</small></div><form action={logout}><button aria-label="Se déconnecter" title="Se déconnecter"><LogOut /></button></form></div>
    </header>

    <section className="citizen-hero">
      <div><span className="citizen-eyebrow"><ShieldCheck /> Service citoyen géolocalisé</span><h1>Bonjour {firstName(initialData.user.fullName)},</h1><p>Un problème dans votre communauté ? Signalez-le en quelques instants avec sa position exacte.</p><button className="citizen-report-cta" onClick={openReport}><Plus />Faire un signalement</button></div>
      <div className="citizen-hero-visual"><Navigation /><span>Votre signalement aide les équipes à intervenir au bon endroit.</span></div>
    </section>

    {successReference ? <section className="citizen-success" role="status"><span><Check /></span><div><strong>Signalement envoyé avec succès</strong><p>Conservez votre référence <b>{successReference}</b>. {successMessage}</p></div><button onClick={() => setSuccessReference("")} aria-label="Fermer"><X /></button></section> : null}

    <section className="citizen-content">
      <div className="citizen-section-head"><div><small>MES SIGNALEMENTS</small><h2>Suivre mes demandes</h2><p>Vous ne voyez ici que les signalements créés avec votre compte.</p></div><span>{incidents.length}</span></div>
      {incidents.length ? <div className="citizen-report-list">{incidents.map((item) => <article key={item.id} className="citizen-report-card">
        <CategoryIcon category={item.category} />
        <div className="citizen-report-copy"><div><strong>{item.title}</strong><span className={`citizen-status ${statusClass(item.status)}`}>{statusLabels[item.status] || item.status}</span></div><p>{item.location}</p><small>{item.reference} · {reportDate.format(new Date(item.created_at))}</small></div>
        <ChevronRight />
      </article>)}</div> : <div className="citizen-empty"><span><FileClock /></span><h3>Aucun signalement pour le moment</h3><p>Votre premier signalement et son état de traitement apparaîtront ici.</p><button onClick={openReport}><Plus />Faire mon premier signalement</button></div>}
    </section>

    {reportOpen ? <div className="citizen-report-overlay" role="presentation">
      <form className="citizen-report-form" role="dialog" aria-modal="true" aria-labelledby="citizen-report-title" onSubmit={submitReport}>
        <div className="citizen-form-head"><div><small>NOUVEAU SIGNALEMENT</small><h2 id="citizen-report-title">Que se passe-t-il ?</h2><p>Décrivez le problème puis confirmez sa position.</p></div><button type="button" aria-label="Fermer" onClick={() => setReportOpen(false)} disabled={submitting}><X /></button></div>
        {formError ? <div className="login-error" role="alert">{formError}</div> : null}
        <section className="citizen-form-section"><div className="citizen-step"><span>1</span><div><strong>Décrire le problème</strong><small>Informations visibles par les équipes de traitement</small></div></div>
          <CategoryPicker />
          <label>Intitulé<input name="title" required minLength={3} maxLength={160} autoFocus placeholder="Ex. Gros nid-de-poule sur la chaussée" /></label>
          <label>Commune ou point de repère<input name="location" required minLength={2} maxLength={240} placeholder="Ex. Cocody, près du carrefour…" /></label>
          <label>Informations complémentaires<textarea name="observations" maxLength={2000} placeholder="Précisez la taille, le danger ou tout repère utile…" /></label>
          <div className="citizen-contact-note">Ces renseignements sont facultatifs et préremplis depuis votre compte. Vous pouvez les modifier ou les effacer.</div>
          <div className="citizen-contact-grid"><label>Nom de la personne qui signale (facultatif)<input name="reporterLastName" maxLength={100} autoComplete="family-name" defaultValue={defaultReporterLastName} placeholder="Ex. Soumahoro" /></label><label>Prénom(s) (facultatif)<input name="reporterFirstName" maxLength={100} autoComplete="given-name" defaultValue={defaultReporterFirstName} placeholder="Ex. Ibrahim" /></label></div>
          <label>Numéro de téléphone (facultatif)<input name="reporterPhone" type="tel" inputMode="tel" maxLength={30} autoComplete="tel" defaultValue={initialData.user.phone ?? ""} placeholder="Ex. +225 07 00 00 00 00" /></label>
        </section>

        <section className="citizen-form-section"><div className="citizen-step"><span>2</span><div><strong>Ajouter des preuves</strong><small>Photos ou vidéos prises sur place — facultatif</small></div></div>
          <label className="citizen-evidence-picker"><Camera /><span><strong>Ajouter des photos ou vidéos</strong><small>3 fichiers maximum · 40 Mo par fichier</small></span><input type="file" accept={EVIDENCE_MIME_TYPES.join(",")} multiple onChange={selectEvidence} disabled={submitting || evidenceFiles.length >= MAX_EVIDENCE_FILES} /></label>
          {evidenceFiles.length ? <div className="citizen-evidence-grid">{evidenceFiles.map((item, index) => <article key={`${item.file.name}-${item.file.lastModified}-${index}`}>
            <div className="citizen-evidence-preview">{evidenceMediaType(item.mimeType) === "video" ? <video src={item.previewUrl} muted preload="metadata" /> : ["image/heic", "image/heif"].includes(item.mimeType) ? <ImageIcon /> : <img src={item.previewUrl} alt={`Aperçu de ${item.file.name}`} />}</div>
            <div><strong>{item.file.name}</strong><small>{evidenceMediaType(item.mimeType) === "video" ? <Video /> : <ImageIcon />}{formatEvidenceSize(item.file.size)}</small></div>
            <button type="button" aria-label={`Retirer ${item.file.name}`} onClick={() => removeEvidence(index)} disabled={submitting}><Trash2 /></button>
          </article>)}</div> : <div className="citizen-evidence-empty"><ImageIcon /><span>Les preuves permettent aux équipes de mieux évaluer le signalement.</span></div>}
        </section>

        <section className="citizen-form-section"><div className="citizen-step"><span>3</span><div><strong>Localiser le problème</strong><small>Votre position n’est jamais suivie en continu</small></div></div>
          <button type="button" className="citizen-locate" onClick={locateMe} disabled={gpsState === "locating"}><LocateFixed />{gpsState === "locating" ? "Recherche en cours…" : "Utiliser ma position actuelle"}</button>
          <div className={`citizen-gps-message ${gpsState}`} aria-live="polite"><Crosshair /><span>{gpsMessage}</span></div>
          <div className="citizen-map-box"><LocationMap position={position} onChange={(point) => selectPosition(point)} /><p><MapPin />Touchez la carte ou déplacez le repère pour corriger la position.</p></div>
          <button type="button" className="citizen-manual-toggle" onClick={() => setManualOpen((open) => !open)}>Saisir les coordonnées manuellement</button>
          {manualOpen ? <div className="citizen-coordinates"><label>Latitude<input type="number" inputMode="decimal" step="any" value={latitudeText} onChange={(event) => { setLatitudeText(event.target.value); setConfirmed(false); }} placeholder="5.347000" /></label><label>Longitude<input type="number" inputMode="decimal" step="any" value={longitudeText} onChange={(event) => { setLongitudeText(event.target.value); setConfirmed(false); }} placeholder="-4.020000" /></label><button type="button" onClick={applyCoordinates}>Appliquer</button></div> : null}
          {position ? <div className={`citizen-position-confirm ${confirmed ? "confirmed" : ""}`}><div><strong>{confirmed ? "Position confirmée" : "Cette position est-elle correcte ?"}</strong><small>{position.lat.toFixed(6)}, {position.lng.toFixed(6)}{accuracy !== null ? ` · précision ${Math.round(accuracy)} m` : " · position manuelle"}</small></div><button type="button" onClick={() => setConfirmed(true)} disabled={confirmed}>{confirmed ? <Check /> : <MapPin />}{confirmed ? "Confirmée" : "Confirmer"}</button></div> : null}
        </section>

        {uploadMessage ? <div className="citizen-upload-message" role="status"><Camera /><span>{uploadMessage}</span></div> : null}
        <div className="citizen-form-note"><AlertTriangle /><span>La priorité et la planification seront déterminées par les équipes techniques compétentes.</span></div>
        <div className="citizen-form-actions"><button type="button" onClick={() => { resetLocation(); setFormError(""); }} disabled={submitting}><RotateCcw />Réinitialiser la position</button><button className="citizen-primary" disabled={submitting || !confirmed}><Send />{submitting ? "Envoi en cours…" : "Envoyer le signalement"}</button></div>
      </form>
    </div> : null}
  </main>;
}
