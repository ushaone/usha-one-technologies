export class APIError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireValue(condition, status, message) {
  if (!condition) throw new APIError(status, message);
}
export function identifier(value, label = 'Identifier') {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/.test(value), 400, `Invalid ${label}`);
  return value;
}
export async function readJSON(request, limit = 12000) {
  requireValue((request.headers.get('content-type') || '').split(';')[0].trim() === 'application/json', 415, 'JSON required');
  const reader = request.body?.getReader();
  requireValue(reader, 400, 'Body required');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new APIError(413, 'Payload too large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const value = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
    requireValue(value && typeof value === 'object' && !Array.isArray(value), 400, 'JSON object required');
    return value;
  } catch (e) { if (e instanceof APIError) throw e; throw new APIError(400, 'Invalid JSON'); }
  finally { reader.releaseLock(); }
}
export function fields(body, allowed) {
  requireValue(Object.keys(body).every(k => allowed.includes(k)), 400, 'Unknown request field');
}
export async function timeout(promise, ms = 15000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new APIError(504, 'Provider timeout')), ms); })]); }
  finally { clearTimeout(timer); }
}
