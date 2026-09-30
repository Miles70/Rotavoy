import { Router } from 'express';
import { getNuiteeStatus, searchNuiteeAirports, searchNuiteeFlights } from '../services/nuiteeApi.js';
import { validateFlightSearch } from '../services/flightSearch.js';

export const flightsRouter = Router();
flightsRouter.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
flightsRouter.get('/status', (_req, res) => res.json(getNuiteeStatus()));
flightsRouter.get('/airports', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2 || q.length > 100) return res.status(400).json({ code: 'INVALID_SEARCH' });
    res.json(await searchNuiteeAirports(q));
  } catch (error) { next(error); }
});
flightsRouter.post('/search', async (req, res, next) => {
  try {
    const body = validateFlightSearch(req.body);
    const payload = await searchNuiteeFlights(body);
    if (payload?.error || !Array.isArray(payload?.data)) return res.status(502).json({ code: 'FLIGHT_UNAVAILABLE' });
    res.json({ ...payload, environment: getNuiteeStatus().environment });
  } catch (error) { next(error); }
});
flightsRouter.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.statusCode || 502;
  res.status(status).json({ code: error.code || (status === 429 ? 'RATE_LIMIT' : status === 504 ? 'TIMEOUT' : 'FLIGHT_UNAVAILABLE') });
});
