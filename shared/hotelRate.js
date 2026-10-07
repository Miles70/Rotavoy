// Only fields observed in LiteAPI hotel rates; absent facts stay absent.
export function rateTerms(value, prebook = false) {
  const rates = prebook ? (value?.roomTypes || []).flatMap(room => room.rates || []) : Array.isArray(value?.rates) ? value.rates : [];
  const amount = prebook ? value?.price ?? value?.sellingPriceToUser : value?.suggestedSellingPrice?.amount;
  return {
    total: amount == null ? null : Number(amount),
    currency: prebook ? value?.currency || null : value?.suggestedSellingPrice?.currency || null,
    boardChangeNotice: prebook && value?.boardChanged === true,
    cancellationChangeNotice: prebook && value?.cancellationChanged === true,
    bookingConditions: prebook && typeof value?.termsAndConditions === 'string' ? value.termsAndConditions.replace(/<[^>]*>/g, ' ').trim() : '',
    rooms: rates.map(rate => ({
      name: rate.name || null,
      adults: rate.adultCount ?? null,
      children: rate.childCount ?? null,
      meal: rate.boardType || null,
      mealName: rate.boardName || null,
      cancellation: rate.cancellationPolicies || null,
      taxes: Array.isArray(rate.retailRate?.taxesAndFees) ? rate.retailRate.taxesAndFees.map(tax => ({ included: tax.included, description: tax.description, amount: tax.amount, currency: tax.currency })) : null,
      remarks: typeof rate.remarks === 'string' ? rate.remarks.replace(/<[^>]*>/g, ' ').trim() : null,
    })),
  };
}
export function changedTerms(before, after) {
  const changes = [];
  if (before?.total !== after?.total || before?.currency !== after?.currency) changes.push('Toplam fiyat');
  if (after?.boardChangeNotice && !before?.boardChangeNotice) changes.push('Yemek planı');
  if (after?.cancellationChangeNotice && !before?.cancellationChangeNotice) changes.push('İptal koşulları');
  if (after?.bookingConditions && before?.bookingConditions && after.bookingConditions !== before.bookingConditions) changes.push('Rezervasyon koşulları');
  // Missing prebook fields are unknown, never evidence that a condition vanished.
  after?.rooms?.forEach((room, index) => {
    const old = before?.rooms?.[index];
    if (!old) return;
    if (room.meal && old.meal && room.meal !== old.meal) changes.push('Yemek planı');
    if (room.cancellation && old.cancellation && JSON.stringify(room.cancellation) !== JSON.stringify(old.cancellation)) changes.push('İptal koşulları');
    if (room.taxes !== null && JSON.stringify(room.taxes) !== JSON.stringify(old.taxes)) changes.push('Vergi ve ücretler');
  });
  return [...new Set(changes)];
}
export function mergeTerms(before, after) {
  return { ...after, rooms: after.rooms.length ? after.rooms.map((room, i) => ({ ...before?.rooms?.[i], ...Object.fromEntries(Object.entries(room).filter(([, v]) => v !== null)) })) : before?.rooms || [] };
}
export function guardRateTerms(response, accepted, data) {
  const confirmed = rateTerms(data, true);
  const changes = changedTerms(accepted, confirmed);

  if (!accepted || changes.length) {
    response.status(409).json({ code: 'RATE_CHANGED', message: accepted ? `${changes.join(', ')} güncellendi. Ödeme öncesinde yeni koşulları onayla.` : 'Ödeme öncesinde fiyat ve koşulları onayla.', changes, confirmedTerms: mergeTerms(accepted, confirmed) });
    return false;
  }
  return true;
}
