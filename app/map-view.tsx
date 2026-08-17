"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import { categoryIconClass } from "./category-icon";

export type MapItem = {
  id: string;
  title: string;
  category: string;
  location: string;
  status: string;
  lat: number;
  lng: number;
  color: string;
};

export type MapViewport = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
};

const incidentIcon = (item: MapItem, selected: boolean) => L.divIcon({
  className: "category-map-marker-host",
  html: `<span class="category-map-marker${selected ? " selected" : ""}" style="--marker-accent:${item.color}"><span class="category-icon ${categoryIconClass(item.category)}"></span></span>`,
  iconSize: [34, 40],
  iconAnchor: [17, 38],
  popupAnchor: [0, -34],
});

function ViewportObserver({ onViewportChange }: { onViewportChange: (viewport: MapViewport) => void }) {
  const map = useMap();
  const reportViewport = useCallback(() => {
    const bounds = map.getBounds();
    onViewportChange({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
      zoom: map.getZoom(),
    });
  }, [map, onViewportChange]);

  useMapEvents({ moveend: reportViewport, zoomend: reportViewport });
  useEffect(() => reportViewport(), [reportViewport]);
  return null;
}

type MapViewProps = {
  items: MapItem[];
  selected: MapItem | null;
  onSelect: (item: MapItem) => void;
  onViewportChange: (viewport: MapViewport) => void;
};

export default function MapView({ items, selected, onSelect, onViewportChange }: MapViewProps) {
  return <MapContainer center={[6.2, -5.1]} zoom={7} zoomControl={false} className="leaflet-map">
    <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <ZoomControl position="bottomright" />
    <ViewportObserver onViewportChange={onViewportChange} />
    {items.map((item) => <Marker
      key={item.id}
      position={[item.lat, item.lng]}
      icon={incidentIcon(item, selected?.id === item.id)}
      eventHandlers={{ click: () => onSelect(item) }}
      title={`${item.category} : ${item.title}`}
    >
      <Popup><strong>{item.title}</strong><br />{item.category}<br />{item.location}<br /><small>{item.status}</small></Popup>
    </Marker>)}
  </MapContainer>;
}
