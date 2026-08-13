"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type CitizenPosition = { lat: number; lng: number };

const citizenIcon = L.divIcon({
  className: "citizen-map-pin",
  html: "<span><i></i></span>",
  iconSize: [38, 46],
  iconAnchor: [19, 43],
});

function PositionEvents({ onChange }: { onChange: (position: CitizenPosition) => void }) {
  useMapEvents({ click: (event) => onChange({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

function Recenter({ position }: { position: CitizenPosition | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lng], 17, { duration: 0.8 });
  }, [map, position]);
  return null;
}

export default function CitizenLocationMap({
  position,
  onChange,
}: {
  position: CitizenPosition | null;
  onChange: (position: CitizenPosition) => void;
}) {
  return <MapContainer center={[7.54, -5.55]} zoom={6} className="citizen-location-map" scrollWheelZoom>
    <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <PositionEvents onChange={onChange} />
    <Recenter position={position} />
    {position ? <Marker
      position={[position.lat, position.lng]}
      icon={citizenIcon}
      draggable
      eventHandlers={{
        dragend: (event) => {
          const point = event.target.getLatLng();
          onChange({ lat: point.lat, lng: point.lng });
        },
      }}
    /> : null}
  </MapContainer>;
}
