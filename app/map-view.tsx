"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl } from "react-leaflet";
export type MapItem={id:string;title:string;location:string;status:string;lat:number;lng:number;color:string};
const icon=(c:string,on:boolean)=>L.divIcon({className:"pin",html:`<span style="--pin:${c}" class="${on?"on":""}"><i></i></span>`,iconSize:[32,40],iconAnchor:[16,36],popupAnchor:[0,-32]});
export default function MapView({items,selected,onSelect}:{items:MapItem[];selected:MapItem|null;onSelect:(x:MapItem)=>void}){return <MapContainer center={[6.2,-5.1]} zoom={7} zoomControl={false} className="leaflet-map"><TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><ZoomControl position="bottomright"/>{items.map(x=><Marker key={x.id} position={[x.lat,x.lng]} icon={icon(x.color,selected?.id===x.id)} eventHandlers={{click:()=>onSelect(x)}}><Popup><strong>{x.title}</strong><br/>{x.location}<br/><small>{x.status}</small></Popup></Marker>)}</MapContainer>}
