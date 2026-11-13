import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { EditablePin } from './KeywordMapPage';
import { snapToGrid, type GridLattice, type LatLng } from '../lib/grid';
import { GridOverlay } from './GridOverlay';
import { rankColor, rankMarkerText, type PinRankState } from '../lib/rank';

const FALLBACK_CENTER: [number, number] = [39.8283, -98.5795];
const PIN_SIZE_PX = 26;
const SELECTED_PIN_SIZE_PX = 32;

const iconCache = new Map<string, L.DivIcon>();

function pinIcon(
  state: PinRankState,
  { selected, isNew }: { selected: boolean; isNew: boolean },
): L.DivIcon {
  const key = `${state}|${selected}|${isNew}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const text = rankMarkerText(state);
  const size = selected ? SELECTED_PIN_SIZE_PX : PIN_SIZE_PX;
  const color = rankColor(state);
  const border = isNew ? '2px dashed #2563eb' : '2px solid white';
  const ring = selected ? '0 0 0 3px #2563eb,' : '';
  const opacity = state === 'disabled' ? 0.5 : 1;
  const fontSize = text.length >= 3 ? 9 : 11;
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:${border};box-shadow:${ring}0 1px 3px rgba(0,0,0,0.45);opacity:${opacity};display:flex;align-items:center;justify-content:center;color:white;font:700 ${fontSize}px/1 system-ui,sans-serif;">${text}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  iconCache.set(key, icon);
  return icon;
}

// A map-pin shape marking the business. The grid is centered on the business, so a rank pin
// usually sits on the same spot; the icon is lifted so its tip rests on top of that pin
// (13px = half a rank marker) instead of covering its number.
const businessIcon = L.divIcon({
  className: '',
  html: `<svg width="24" height="32" viewBox="0 0 24 32" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))"><path d="M12 31C12 31 22 18.5 22 11A10 10 0 0 0 2 11C2 18.5 12 31 12 31Z" fill="#2563eb" stroke="white" stroke-width="2"/><circle cx="12" cy="11" r="3.5" fill="white"/></svg>`,
  iconSize: [24, 32],
  iconAnchor: [12, 31 + 13],
});

function boundsOf(pins: LatLng[]): L.LatLngBounds {
  return L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
}

/**
 * Where a pin placed at `point` should go: onto the nearest grid cross if that cross lies
 * inside the pin's circle (`sizePx` across, as drawn at the current zoom), otherwise exactly
 * at `point`. So pins snap only when dropped onto a cross, and can still go anywhere else.
 */
function snapToCrossUnderPin(
  map: L.Map,
  point: LatLng,
  { lattice, sizePx }: { lattice: GridLattice | null; sizePx: number },
): LatLng {
  if (!lattice) return point;
  const cross = snapToGrid(point, lattice);
  const distancePx = map
    .latLngToContainerPoint([point.lat, point.lng])
    .distanceTo(map.latLngToContainerPoint([cross.lat, cross.lng]));
  return distancePx <= sizePx / 2 ? cross : { lat: point.lat, lng: point.lng };
}

function MapEvents({
  gridLattice,
  onMapClick,
  onCenterChange,
}: {
  gridLattice: GridLattice | null;
  onMapClick: (lat: number, lng: number) => void;
  onCenterChange: (center: LatLng) => void;
}) {
  const map = useMapEvents({
    click(e) {
      // A newly added pin is drawn selected, so its circle is the larger one.
      const point = snapToCrossUnderPin(map, e.latlng, { lattice: gridLattice, sizePx: SELECTED_PIN_SIZE_PX });
      onMapClick(point.lat, point.lng);
    },
    moveend() {
      const c = map.getCenter();
      onCenterChange({ lat: c.lat, lng: c.lng });
    },
  });
  useEffect(() => {
    const c = map.getCenter();
    onCenterChange({ lat: c.lat, lng: c.lng });
    // Report the starting center once; later changes come from moveend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

/** Zooms to fit all pins whenever `fitKey` changes (e.g. after generating a grid). */
function FitToPins({ pins, fitKey }: { pins: LatLng[]; fitKey: number }) {
  const map = useMap();
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (pins.length > 0) map.fitBounds(boundsOf(pins), { padding: [40, 40] });
    // Only refit on an explicit request, not on every pin drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

interface PinMapProps {
  pins: EditablePin[];
  getRankState: (pin: EditablePin) => PinRankState;
  business: { lat: number; lng: number; label: string } | null;
  editing: boolean;
  placingPin: boolean;
  /** Drawn as dotted lines across the map when set (while editing). */
  gridLattice: GridLattice | null;
  selectedPinId: string | null;
  fitKey: number;
  onSelectPin: (pinId: string) => void;
  onDragPin: (pinId: string, lat: number, lng: number) => void;
  onMapClick: (lat: number, lng: number) => void;
  onCenterChange: (center: LatLng) => void;
}

export function PinMap({
  pins,
  getRankState,
  business,
  editing,
  placingPin,
  gridLattice,
  selectedPinId,
  fitKey,
  onSelectPin,
  onDragPin,
  onMapClick,
  onCenterChange,
}: PinMapProps) {
  // Starting view: fit the pins if there are any, else the business, else the whole US.
  const [initialView] = useState(() => {
    if (pins.length > 0) return { bounds: boundsOf(pins).pad(0.1) };
    if (business) return { center: [business.lat, business.lng] as [number, number], zoom: 14 };
    return { center: FALLBACK_CENTER, zoom: 4 };
  });
  // Needed to measure, in pixels, whether a dragged pin landed on a grid cross.
  const [map, setMap] = useState<L.Map | null>(null);

  return (
    <div className={`h-full w-full ${placingPin ? 'cursor-crosshair' : ''}`}>
      <MapContainer {...initialView} ref={setMap} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents gridLattice={gridLattice} onMapClick={onMapClick} onCenterChange={onCenterChange} />
        <FitToPins pins={pins} fitKey={fitKey} />
        {gridLattice && <GridOverlay lattice={gridLattice} />}
        {business && (
          <Marker
            position={[business.lat, business.lng]}
            icon={businessIcon}
            zIndexOffset={2000}
            interactive={false}
            title={business.label}
          />
        )}
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            draggable={editing}
            icon={pinIcon(getRankState(pin), {
              selected: pin.id === selectedPinId,
              isNew: !!pin.isNew,
            })}
            zIndexOffset={pin.id === selectedPinId ? 1000 : 0}
            eventHandlers={{
              click: () => onSelectPin(pin.id),
              dragend: (e) => {
                const marker = e.target as L.Marker;
                const dropped = marker.getLatLng();
                const point = map
                  ? snapToCrossUnderPin(map, dropped, {
                      lattice: gridLattice,
                      sizePx: pin.id === selectedPinId ? SELECTED_PIN_SIZE_PX : PIN_SIZE_PX,
                    })
                  : dropped;
                onDragPin(pin.id, point.lat, point.lng);
              },
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
