"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle, Check, ChevronRight, CircleUserRound, Crosshair, FileClock,
  LocateFixed, LogOut, MapPin, Navigation, Plus, RotateCcw, Send, ShieldCheck, X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { CitizenIncident, CitizenPortalData } from "../../lib/citizen";
import { logout } from "../login/actions";
import type { CitizenPosition } from "./location-map";

const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <div className="citizen-map-loading">Chargement de la carte…</div>,
});

type GpsState = "idle" | "locating" | "ready" | "error";
type LocationSource = "gps" | "manual_map";

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
  const [clientRequestId, setClientRequestId] = useState("");

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
    setFormError("");
    resetLocation();
    setClientRequestId(crypto.randomUUID());
    setReportOpen(true);
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
      setSuccessReference(incident.reference);
      setReportOpen(false);
      form.reset();
    } catch {
      setFormError("Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="citizen-shell">
    <header className="citizen-header">
      <div className="citizen-logo"><span>FER</span><div><strong>Routes CI</strong><small>Espace citoyen</small></div></div>
      <div className="citizen-user"><CircleUserRound /><div><strong>{initialData.user.fullName}</strong><small>{initialData.user.phone}</small></div><form action={logout}><button aria-label="Se déconnecter" title="Se déconnecter"><LogOut /></button></form></div>
    </header>

    <section className="citizen-hero">
      <div><span className="citizen-eyebrow"><ShieldCheck /> Service officiel du FER</span><h1>Bonjour {firstName(initialData.user.fullName)},</h1><p>Un problème sur la route ? Signalez-le en quelques instants avec sa position exacte.</p><button className="citizen-report-cta" onClick={openReport}><Plus />Faire un signalement</button></div>
      <div className="citizen-hero-visual"><Navigation /><span>Votre signalement aide les équipes à intervenir au bon endroit.</span></div>
    </section>

    {successReference ? <section className="citizen-success" role="status"><span><Check /></span><div><strong>Signalement envoyé avec succès</strong><p>Conservez votre référence <b>{successReference}</b>. Son avancement apparaît ci-dessous.</p></div><button onClick={() => setSuccessReference("")} aria-label="Fermer"><X /></button></section> : null}

    <section className="citizen-content">
      <div className="citizen-section-head"><div><small>MES SIGNALEMENTS</small><h2>Suivre mes demandes</h2><p>Vous ne voyez ici que les signalements créés avec votre compte.</p></div><span>{incidents.length}</span></div>
      {incidents.length ? <div className="citizen-report-list">{incidents.map((item) => <article key={item.id} className="citizen-report-card">
        <div className="citizen-report-icon"><MapPin /></div>
        <div className="citizen-report-copy"><div><strong>{item.title}</strong><span className={`citizen-status ${statusClass(item.status)}`}>{statusLabels[item.status] || item.status}</span></div><p>{item.location}</p><small>{item.reference} · {reportDate.format(new Date(item.created_at))}</small></div>
        <ChevronRight />
      </article>)}</div> : <div className="citizen-empty"><span><FileClock /></span><h3>Aucun signalement pour le moment</h3><p>Votre premier signalement et son état de traitement apparaîtront ici.</p><button onClick={openReport}><Plus />Faire mon premier signalement</button></div>}
    </section>

    {reportOpen ? <div className="citizen-report-overlay" role="presentation">
      <form className="citizen-report-form" role="dialog" aria-modal="true" aria-labelledby="citizen-report-title" onSubmit={submitReport}>
        <div className="citizen-form-head"><div><small>NOUVEAU SIGNALEMENT</small><h2 id="citizen-report-title">Que se passe-t-il ?</h2><p>Décrivez le problème puis confirmez sa position.</p></div><button type="button" aria-label="Fermer" onClick={() => setReportOpen(false)} disabled={submitting}><X /></button></div>
        {formError ? <div className="login-error" role="alert">{formError}</div> : null}
        <section className="citizen-form-section"><div className="citizen-step"><span>1</span><div><strong>Décrire le problème</strong><small>Informations visibles par les équipes FER</small></div></div>
          <label>Type de dégradation<select name="category" required defaultValue="Voirie"><option>Voirie</option><option>Feux</option><option>Accotement</option><option>Ouvrage</option><option>Bac</option><option>Péage / pesage</option></select></label>
          <label>Intitulé<input name="title" required minLength={3} maxLength={160} autoFocus placeholder="Ex. Gros nid-de-poule sur la chaussée" /></label>
          <label>Commune ou point de repère<input name="location" required minLength={2} maxLength={240} placeholder="Ex. Cocody, près du carrefour…" /></label>
          <label>Informations complémentaires<textarea name="observations" maxLength={2000} placeholder="Précisez la taille, le danger ou tout repère utile…" /></label>
        </section>

        <section className="citizen-form-section"><div className="citizen-step"><span>2</span><div><strong>Localiser le problème</strong><small>Votre position n’est jamais suivie en continu</small></div></div>
          <button type="button" className="citizen-locate" onClick={locateMe} disabled={gpsState === "locating"}><LocateFixed />{gpsState === "locating" ? "Recherche en cours…" : "Utiliser ma position actuelle"}</button>
          <div className={`citizen-gps-message ${gpsState}`} aria-live="polite"><Crosshair /><span>{gpsMessage}</span></div>
          <div className="citizen-map-box"><LocationMap position={position} onChange={(point) => selectPosition(point)} /><p><MapPin />Touchez la carte ou déplacez le repère pour corriger la position.</p></div>
          <button type="button" className="citizen-manual-toggle" onClick={() => setManualOpen((open) => !open)}>Saisir les coordonnées manuellement</button>
          {manualOpen ? <div className="citizen-coordinates"><label>Latitude<input type="number" inputMode="decimal" step="any" value={latitudeText} onChange={(event) => { setLatitudeText(event.target.value); setConfirmed(false); }} placeholder="5.347000" /></label><label>Longitude<input type="number" inputMode="decimal" step="any" value={longitudeText} onChange={(event) => { setLongitudeText(event.target.value); setConfirmed(false); }} placeholder="-4.020000" /></label><button type="button" onClick={applyCoordinates}>Appliquer</button></div> : null}
          {position ? <div className={`citizen-position-confirm ${confirmed ? "confirmed" : ""}`}><div><strong>{confirmed ? "Position confirmée" : "Cette position est-elle correcte ?"}</strong><small>{position.lat.toFixed(6)}, {position.lng.toFixed(6)}{accuracy !== null ? ` · précision ${Math.round(accuracy)} m` : " · position manuelle"}</small></div><button type="button" onClick={() => setConfirmed(true)} disabled={confirmed}>{confirmed ? <Check /> : <MapPin />}{confirmed ? "Confirmée" : "Confirmer"}</button></div> : null}
        </section>

        <div className="citizen-form-note"><AlertTriangle /><span>La priorité et la planification seront déterminées par les équipes techniques du FER.</span></div>
        <div className="citizen-form-actions"><button type="button" onClick={() => { resetLocation(); setFormError(""); }} disabled={submitting}><RotateCcw />Réinitialiser la position</button><button className="citizen-primary" disabled={submitting || !confirmed}><Send />{submitting ? "Envoi en cours…" : "Envoyer au FER"}</button></div>
      </form>
    </div> : null}
  </main>;
}
