export function getCurrentCoordinates(geolocation = globalThis.navigator?.geolocation) {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new Error('Geolocation is unavailable.'));
      return;
    }
    geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        reject(new Error('Invalid device coordinates.'));
        return;
      }
      resolve({ latitude, longitude });
    }, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  });
}
