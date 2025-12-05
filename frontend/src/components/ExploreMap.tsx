import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons when bundling
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl as string,
  iconRetinaUrl: markerIconRetinaUrl as string,
  shadowUrl: markerShadowUrl as string,
});

// Custom green pin icon for observations
const greenPinIcon = L.icon({
  iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2322c55e" stroke="white" stroke-width="1"><path d="M12 2C6.48 2 2 6.48 2 12c0 6 10 18 10 18s10-12 10-18c0-5.52-4.48-10-10-10zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>',
  iconSize: [12, 20],
  iconAnchor: [6, 20],
  popupAnchor: [0, -20],
});

interface Observation {
  id: string;
  lepidoptera: { species?: string };
  hostPlant: { species?: string };
  latitude?: number;
  longitude?: number;
  location?: string;
}

interface ExploreMapProps {
  observations: Observation[];
  height?: string | number;
  onSelect?: (obs: Observation) => void;
  isModalOpen?: boolean;
}

export default function ExploreMap({ observations, height = 600, onSelect, isModalOpen = false }: ExploreMapProps) {
  // Choose a sensible center: first observation with coords or a fallback
  const firstWithCoords = observations.find(o => o.latitude && o.longitude);
  const center: [number, number] = firstWithCoords
    ? [firstWithCoords.latitude as number, firstWithCoords.longitude as number]
    : [0, 0];

  return (
    <div
      style={{ height, zIndex: isModalOpen ? 0 : undefined }}
      className={`rounded-lg overflow-hidden relative ${isModalOpen ? 'pointer-events-none' : 'z-0'}`}
    >
      <MapContainer
        center={center}
        zoom={firstWithCoords ? 8 : 2}
        style={{ height: '100%', width: '100%', zIndex: isModalOpen ? 0 : undefined }}
      >
        <LayersControl position="topright">
          {/* Satellite (default) - Esri World Imagery */}
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>

          {/* OpenStreetMap standard */}
          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          {/* (Terrain option removed) */}
        </LayersControl>

        {observations
          .filter(o => typeof o.latitude === 'number' && typeof o.longitude === 'number')
          .map((obs) => (
            <Marker
              key={obs.id}
              position={[obs.latitude as number, obs.longitude as number]}
              icon={greenPinIcon}
              eventHandlers={{
                click: () => onSelect && onSelect(obs),
              }}
            />
        ))}
      </MapContainer>
    </div>
  );
}
