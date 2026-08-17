"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl } from "react-leaflet";
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

const incidentIcon = (item: MapItem, selected: boolean) => L.divIcon({
  className: "category-map-marker-host",
  html: `<span class="category-map-marker${selected ? " selected" : ""}" style="--marker-accent:${item.color}"><span class="category-icon ${categoryIconClass(item.category)}"></span></span>`,
  iconSize: [42, 50],
  iconAnchor: [21, 46],
  popupAnchor: [0, -42],
});

export default function MapView({ items, selected, onSelect }: { items: MapItem[]; selected: MapItem | null; onSelect: (item: MapItem) => void }) {
  return <MapContainer center={[6.2, -5.1]} zoom={7} zoomControl={false} className="leaflet-map">
    <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <ZoomControl position="bottomright" />
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
