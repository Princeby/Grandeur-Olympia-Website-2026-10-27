const RECIPIENT = 'grandeurolympiaglobal@gmail.com';
const SENDER = 'website@grandeurolympiaglobal.com';
const MAX_BODY_BYTES = 16384;
const SERVICES = Object.freeze({
  'facility-management': 'Facility management',
  mep: 'Technical & MEP services',
  construction: 'Construction execution',
  general: 'A general enquiry'
});
const SEND_ERROR = 'We couldn’t send your enquiry. Please try again or email grandeurolympiaglobal@gmail.com.';

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders }
  });
}

async function readPayload(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
    return { error: 'Your enquiry is too long. Please shorten it and try again.', status: 413 };
  }
  const reader = request.body?.getReader();
  if (!reader) return { error: 'Please complete the form and try again.', status: 400 };
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        return { error: 'Your enquiry is too long. Please shorten it and try again.', status: 413 };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid payload');
    return { data };
  } catch {
    return { error: 'Please complete the form and try again.', status: 400 };
  } finally {
    reader.releaseLock();
  }
}

function validate(data) {
  const limits = { name: 100, email: 254, message: 2500, service: 40 };
  const values = {};
  for (const [field, max] of Object.entries(limits)) {
    if (typeof data[field] !== 'string' || !data[field].trim() || data[field].length > max) return null;
    values[field] = data[field].trim();
  }
  if (/[\x00-\x1f\x7f]/.test(values.name + values.email)) return null;
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(values.message)) return null;
  if (!/^[^\s@<>(),;:\\"\[\]]+@[^\s@<>(),;:\\"\[\]]+\.[^\s@<>(),;:\\"\[\]]+$/.test(values.email)) return null;
  if (!Object.hasOwn(SERVICES, values.service)) return null;
  return values;
}

export async function handleContact(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Please submit your enquiry using the contact form.' }, 405, { Allow: 'POST' });
  const origin = request.headers.get('Origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return json({ ok: false, error: 'Please submit your enquiry from our website.' }, 403);
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ ok: false, error: 'Please submit your enquiry using the contact form.' }, 415);
  }
  const payload = await readPayload(request);
  if (payload.error) return json({ ok: false, error: payload.error }, payload.status);
  const data = payload.data;
  // This hidden field catches simple form-filling bots without changing the layout.
  if (data.website !== undefined && (typeof data.website !== 'string' || data.website.length > 256)) {
    return json({ ok: false, error: 'Please complete the form and try again.' }, 400);
  }
  if (data.website?.trim()) return json({ ok: true });
  const values = validate(data);
  if (!values) return json({ ok: false, error: 'Please check your name, email address, service, and message.' }, 400);
  if (typeof env.CONTACT_EMAIL?.send !== 'function' || typeof env.CONTACT_RATE_LIMITER?.limit !== 'function') {
    return json({ ok: false, error: SEND_ERROR }, 503);
  }
  try {
    const client = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.CONTACT_RATE_LIMITER.limit({ key: `contact:${client}` });
    if (!success) return json({ ok: false, error: 'You’ve sent several enquiries recently. Please wait a minute before trying again.' }, 429, { 'Retry-After': '60' });
    await env.CONTACT_EMAIL.send({
      from: { email: SENDER, name: 'Grandeur Olympia website' },
      to: RECIPIENT,
      replyTo: values.email,
      subject: `Website enquiry: ${SERVICES[values.service]}`,
      text: [
        'A new enquiry was submitted through the Grandeur Olympia website.',
        '',
        `Name: ${values.name}`,
        `Email: ${values.email}`,
        `Service: ${SERVICES[values.service]}`,
        '',
        'Property or project details:',
        values.message
      ].join('\n')
    });
    return json({ ok: true });
  } catch (error) {
    // Log only a service error code, never the visitor’s name, email, or message.
    console.error('Contact email could not be accepted', error?.code || 'SEND_FAILED');
    return json({ ok: false, error: SEND_ERROR }, 502);
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/contact') return handleContact(request, env);
    if (new URL(request.url).pathname.startsWith('/api/')) return json({ ok: false, error: 'Not found.' }, 404);
    return env.ASSETS.fetch(request);
  }
};
