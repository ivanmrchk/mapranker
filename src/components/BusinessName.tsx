import { businessProfileUrl } from '../lib/mapsUrl';

/** The business name, linked to its Google Maps profile when its ID allows one. */
export function BusinessName({ business }: { business: { placeId: string; name: string } }) {
  const profileUrl = businessProfileUrl(business);
  if (!profileUrl) return <>{business.name}</>;
  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the Google Maps profile"
      className="hover:underline"
    >
      {business.name}
    </a>
  );
}
