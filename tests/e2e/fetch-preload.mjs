// Loaded only by the E2E subprocess. Production has no mock endpoint selector.
const original = globalThis.fetch;
const target = 'http://127.0.0.1:3182';
globalThis.fetch = (input, init) => {
  const value = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(value);
  if (['api.lemonsqueezy.com', 'api.openai.com'].includes(url.hostname)) return original(target + url.pathname, init);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('External HTTP disabled in E2E tests');
  return original(input, init);
};
