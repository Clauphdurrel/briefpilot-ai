// Integration-only network boundary; inherited by spawned test servers via NODE_OPTIONS.
const original=globalThis.fetch;
globalThis.fetch=(input,init)=>{
  const value=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  const url=new URL(value);
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('External HTTP disabled in isolated tests');
  return original(input,init);
};
