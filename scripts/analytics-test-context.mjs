// Call before the first page navigation. Never commit or print the admin token/proof.
export async function markAnalyticsTest(context, { apiBaseUrl, adminToken, fixture = false } = {}) {
  let proof = 'unverified-fixture-test';
  if (!fixture) {
    if (!apiBaseUrl || !adminToken) throw new Error('A verified analytics test context requires apiBaseUrl and adminToken.');
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/admin/analytics/context`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ kind: 'test' }) });
    if (!response.ok) throw new Error(`Analytics test context rejected: ${response.status}`);
    proof = (await response.json()).proof;
  }
  await context.addInitScript(value => {
    globalThis.sessionStorage.setItem('rotavoy_analytics_test_proof_v2', value);
  }, proof);
}
