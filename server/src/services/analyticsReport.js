import { analyticsTypes } from '../routes/analytics.js';
import { TravelAnalytics } from '../models/TravelAnalytics.js';
import { effectiveTraffic, trafficTypes } from './analyticsTraffic.js';
const bounded = (v, fallback, max) => Math.max(1, Math.min(max, Math.floor(Number(v) || fallback)));
const literal = value => String(value).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function analyticsFilter(query, now = new Date()) {
  const days = bounded(query.days, 7, 365);
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : new Date(now.getTime() - days * 86400000);
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : now;
  if ([query.from, query.to].some(value => value && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value))) throw Object.assign(new Error('Geçerli bir takvim tarihi seç.'), { statusCode: 400 });
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to || to - from > 366 * 86400000) throw Object.assign(new Error('Geçerli, en fazla bir yıllık tarih aralığı seç.'), { statusCode: 400 });
  const filter = { createdAt: { $gte: from, $lte: to } };
  if ([...analyticsTypes, 'booking_confirmed'].includes(query.type)) filter.type = query.type;
  for (const key of ['country', 'source', 'visitorId', 'sessionId']) if (typeof query[key] === 'string' && query[key]) filter[key] = query[key].slice(0, 100);
  if (query.q) filter.$or = ['visitorId', 'details.hotelName', 'details.origin', 'details.destination', 'path'].map(key => ({ [key]: new RegExp(literal(query.q), 'i') }));
  const traffic = trafficTypes.includes(query.traffic) || query.traffic === 'all' ? query.traffic : 'visitor';
  return { filter, traffic, from, to };
}
const distribution = field => [{ $group: { _id: `$${field}`, visitors: { $addToSet: '$visitorId' }, events: { $sum: 1 } } }, { $project: { count: { $size: '$visitors' }, events: 1 } }, { $sort: { count: -1, _id: 1 } }, { $limit: 12 }];
const stages = ['hotel_view', 'room_select', 'checkout_view', 'payment_start', 'payment_ready', 'booking_confirmed'];
export async function analyticsV2(request, response) {
  const { filter, traffic, from, to } = analyticsFilter(request.query);
  const page = bounded(request.query.page, 1, 10000), limit = bounded(request.query.limit, 25, 100);
  const pipeline = [{ $match: filter }, { $set: { trafficType: effectiveTraffic } }];
  if (traffic !== 'all') pipeline.push({ $match: { trafficType: traffic } });
  const facets = {
    totals: [{ $group: { _id: null, visitors: { $addToSet: '$visitorId' }, sessions: { $addToSet: '$sessionId' }, events: { $sum: { $cond: [{ $eq: ['$type', 'heartbeat'] }, 0, 1] } }, pageViews: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } } } }, { $project: { visitors: { $size: '$visitors' }, sessions: { $size: '$sessions' }, events: 1, pageViews: 1 } }],
    live: [{ $match: { createdAt: { $gte: new Date(Date.now() - 90000) } } }, { $group: { _id: '$visitorId' } }, { $count: 'count' }],
    confirmed: [{ $match: { type: 'booking_confirmed' } }, { $count: 'count' }],
    traffic: distribution('trafficType'), countries: distribution('country'), sources: distribution('source'), devices: distribution('device'),
    trend: [{ $match: { type: { $ne: 'heartbeat' } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, visitors: { $addToSet: '$visitorId' }, events: { $sum: 1 } } }, { $project: { count: { $size: '$visitors' }, events: 1 } }, { $sort: { _id: 1 } }],
    types: [{ $match: { type: { $ne: 'heartbeat' } } }, { $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
    hotels: [{ $match: { type: 'hotel_view' } }, { $group: { _id: '$details.hotelId', name: { $first: '$details.hotelName' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }],
    flights: [{ $match: { type: 'flight_search' } }, { $group: { _id: { origin: '$details.origin', destination: '$details.destination' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }],
    visitors: [{ $sort: { createdAt: -1, _id: -1 } }, { $group: { _id: '$visitorId', firstSeen: { $min: '$createdAt' }, lastSeen: { $first: '$createdAt' }, country: { $first: '$country' }, device: { $first: '$device' }, browser: { $first: '$browser' }, source: { $first: '$source' }, trafficTypes: { $addToSet: '$trafficType' }, sessionIds: { $addToSet: '$sessionId' }, events: { $sum: { $cond: [{ $eq: ['$type', 'heartbeat'] }, 0, 1] } }, lastType: { $first: '$type' } } }, { $sort: { lastSeen: -1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $set: { sessionCount: { $size: '$sessionIds' } } }, { $project: { sessionIds: 0 } }],
    // Consume chronological stages so an earlier out-of-order click does not hide a later valid journey.
    funnel: [{ $match: { type: { $in: stages }, sessionId: { $type: 'string', $ne: '' } } }, { $sort: { createdAt: 1, _id: 1 } },
      { $group: { _id: { visitor: '$visitorId', session: '$sessionId' }, sequence: { $push: '$type' } } },
      { $project: { reached: { $reduce: { input: '$sequence', initialValue: 0, in: { $cond: [{ $eq: ['$$this', { $arrayElemAt: [stages, '$$value'] }] }, { $add: ['$$value', 1] }, '$$value'] } } } } },
      { $group: { _id: null, ...Object.fromEntries(stages.map((stage, i) => [stage, { $sum: { $cond: [{ $gte: ['$reached', i + 1] }, 1, 0] } }])) } }],
  };
  if (request.query.visitorId) facets.journey = [{ $match: { type: { $ne: 'heartbeat' } } }, { $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { eventId: 1, sessionId: 1, createdAt: 1, type: 1, details: 1, path: 1, source: 1, trafficType: 1, classificationReason: 1 } }];
  const [result = {}] = await TravelAnalytics.aggregate([...pipeline, { $facet: facets }]).option({ maxTimeMS: 10000 });
  response.json({ ...result, totals: result.totals?.[0] || { visitors: 0, sessions: 0, events: 0, pageViews: 0 }, live: result.live?.[0]?.count || 0, funnel: result.funnel?.[0] || {}, page, limit, traffic, from, to, generatedAt: new Date().toISOString() });
}
