import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { EditablePin } from './KeywordMapPage';

const FALLBACK_CENTER: [number, number] = [39.8283, -98.5795];

function rankColor(pin: EditablePin, rank: number | null): string {
  if (!pin.enabled) return '#9ca3af';
  if (rank === null) return '#9ca3af';
  if (rank <= 3) return '#16a34a';
  if (rank <= 7) return '#f59e0b';
  return '#dc2626';
}

function pinIcon(color: string, selected: boolean) {
  const size = selected ? 22 : 16;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.45);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface PinMapProps {
  pins: EditablePin[];
  rankByPin: Map<string, number | null>;
  editing: boolean;
  placingPin: boolean;
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  onDragPin: (pinId: string, lat: number, lng: number) => void;
  onMapClick: (lat: number, lng: number) => void;
}

export function PinMap({
  pins,
  rankByPin,
  editing,
  placingPin,
  selectedPinId,
  onSelectPin,
  onDragPin,
  onMapClick,
}: PinMapProps) {
  const [center] = useState<[number, number]>(() => {
    if (pins.length === 0) return FALLBACK_CENTER;
    const lat = pins.reduce((sum, pin) => sum + pin.lat, 0) / pins.length;
    const lng = pins.reduce((sum, pin) => sum + pin.lng, 0) / pins.length;
    return [lat, lng];
  });

  return (
    <div className={`h-full w-full ${placingPin ? 'cursor-crosshair' : ''}`}>
      <MapContainer center={center} zoom={13} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onMapClick={onMapClick} />
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            draggable={editing}
            icon={pinIcon(rankColor(pin, rankByPin.get(pin.id) ?? null), pin.id === selectedPinId)}
            eventHandlers={{
              click: () => onSelectPin(pin.id),
              dragend: (e) => {
                const marker = e.target as L.Marker;
                const pos = marker.getLatLng();
                onDragPin(pin.id, pos.lat, pos.lng);
              },
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
