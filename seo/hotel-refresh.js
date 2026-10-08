export function publicHotelFacts(hotel) {
 return { name: hotel.name, address: hotel.address || '', city: hotel.city || '', country: hotel.country || '', image: hotel.main_photo || '', stars: hotel.stars, latitude: hotel.latitude, longitude: hotel.longitude };
}
export function hotelFactsChanged(existing, hotel, descriptionHash) {
 return descriptionHash !== existing.source.descriptionHash || Object.entries(publicHotelFacts(hotel)).some(([key, value]) => value !== existing[key]);
}
