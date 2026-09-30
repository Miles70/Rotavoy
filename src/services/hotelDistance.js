function coordinates(value) {
  if (!value || value.latitude == null || value.longitude == null || value.latitude === '' || value.longitude === '') return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null;
}

export function distanceKm(origin, destination) {
  const a = coordinates(origin);
  const b = coordinates(destination);
  if (!a || !b) return null;
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2
    + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad)
    * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function withHotelDistances(hotels, catalog, origin) {
  const catalogHotels = new Map((catalog?.data || []).map((hotel) => [hotel.id || hotel.hotelId, hotel]));
  return hotels.map((hotel) => {
    const sources = [hotel, hotel.location, catalogHotels.get(hotel.hotelId), catalogHotels.get(hotel.hotelId)?.location];
    const destination = sources.map(coordinates).find(Boolean);
    return { ...hotel, distanceKm: distanceKm(origin, destination) };
  });
}
