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
}

export default function ExploreMap({ observations, height = 600, onSelect }: ExploreMapProps) {
  // Choose a sensible center: first observation with coords or a fallback
  const firstWithCoords = observations.find(o => o.latitude && o.longitude);
  const center: [number, number] = firstWithCoords
    ? [firstWithCoords.latitude as number, firstWithCoords.longitude as number]
    : [0, 0];

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden">
      <MapContainer center={center} zoom={firstWithCoords ? 8 : 2} style={{ height: '100%', width: '100%' }}>
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
              eventHandlers={{
                click: () => onSelect && onSelect(obs),
              }}
            >
              <Popup>
                <div className="max-w-xs">
                  <strong>{obs.lepidoptera?.species || 'Unknown'}</strong>
                  <div className="text-sm">{obs.hostPlant?.species || ''}</div>
                  <div className="text-xs text-gray-600">{obs.location}</div>
                </div>
              </Popup>
            </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
