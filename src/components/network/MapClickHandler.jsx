import { useMapEvents } from "react-leaflet";

// Must be rendered inside <MapContainer>. Captures map clicks when active.
export default function MapClickHandler({ active, onClick }) {
  useMapEvents({
    click(e) {
      if (active) onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}