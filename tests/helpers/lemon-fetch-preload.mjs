// Test process only: redirect the fixed Lemon Squeezy origin to the local mock.
// This module is loaded by the integration runner, never by production source.
const original = globalThis.fetch;
const target = process.env.BILLING_TEST_API_URL;
if (!target || !/^http:\/\/127\.0\.0\.1:\d+$/.test(target)) throw new Error('Missing local billing test endpoint');
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('https://api.lemonsqueezy.com/v1/')) return original(target + new URL(url).pathname, init);
  return original(input, init);
};
