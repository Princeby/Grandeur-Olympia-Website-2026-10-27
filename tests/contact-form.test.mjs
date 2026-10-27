import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../quiet.js', import.meta.url), 'utf8');
const start = source.indexOf("  const enquiryForm=$('[data-enquiry-form]');");
const end = source.indexOf('  // The four service photographs', start);
const formCode = source.slice(start, end);
class Element {
  constructor(){ this.attributes={}; this.textContent=''; }
  setAttribute(name,value){ this.attributes[name]=value; }
  removeAttribute(name){ delete this.attributes[name]; }
}
function setup(fetch) {
  const status = new Element();
  const arrow = { tagName: 'svg' };
  const button = { disabled: false, firstChild: { textContent: 'Send enquiry ' }, children: [arrow] };
  const service = { value: '', options: [{ value: '' }, { value: 'mep' }] };
  const values = { name: 'Website test', email: 'visitor@example.com', service: 'mep', message: 'Please help with our building.', website: '' };
  const form = Object.assign(new Element(), {
    action: 'https://grandeurolympiaglobal.com/api/contact',
    resetCount: 0, valid: true,
    querySelector(){ return button; }, reportValidity(){ return this.valid; },
    reset(){ this.resetCount++; }, addEventListener(name,handler){ this[name]=handler; }
  });
  vm.runInNewContext(formCode, {
    $: selector => ({ '[data-enquiry-form]': form, '#enquiry-service': service, '[data-enquiry-status]': status })[selector],
    window: { location: { search: '?service=mep' } }, URLSearchParams,
    FormData: class { get(name){ return values[name]; } },
    fetch, AbortController, setTimeout, clearTimeout, email: 'grandeurolympiaglobal@gmail.com'
  });
  return { form, button, arrow, status, service, submit: () => form.submit({ preventDefault(){} }) };
}

test('submit in the background, preserve SVG, reset only after acceptance', async () => {
  let resolveFetch, calls=0, payload;
  const state = setup((url, options) => {
    calls++; payload={ url, options };
    return new Promise(resolve => { resolveFetch=resolve; });
  });
  assert.equal(state.service.value, 'mep');
  const pending=state.submit();
  assert.equal(state.button.disabled, true);
  assert.equal(state.button.firstChild.textContent, 'Sending… ');
  assert.equal(state.button.children[0], state.arrow);
  assert.equal(state.form.resetCount, 0);
  await state.submit();
  assert.equal(calls, 1, 'A rapid second click must not send another enquiry');
  assert.equal(payload.url, 'https://grandeurolympiaglobal.com/api/contact');
  assert.equal(payload.options.method, 'POST');
  assert.equal(JSON.parse(payload.options.body).email, 'visitor@example.com');
  resolveFetch({ ok: true, json: async () => ({ ok: true }) });
  await pending;
  assert.equal(state.form.resetCount, 1);
  assert.match(state.status.textContent, /has been sent/);
  assert.equal(state.button.disabled, false);
  assert.equal(state.button.firstChild.textContent, 'Send enquiry ');
  assert.equal(state.form.attributes['aria-busy'], undefined);
});

test('delivery failure retains typed details and displays the server message', async () => {
  const state=setup(async () => ({ ok: false, json: async () => ({ ok: false, error: 'Please wait a minute before trying again.' }) }));
  await state.submit();
  assert.equal(state.form.resetCount, 0);
  assert.equal(state.status.attributes.role, 'alert');
  assert.equal(state.status.textContent, 'Please wait a minute before trying again.');
  assert.equal(state.button.disabled, false);
});

test('network failures and invalid server responses stay understandable', async () => {
  for (const fetch of [
    async () => { throw new TypeError('Failed to fetch'); },
    async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } }),
    async () => ({ ok: true, json: async () => ({}) })
  ]) {
    const state=setup(fetch);await state.submit();
    assert.equal(state.form.resetCount, 0);
    assert.match(state.status.textContent, /couldn’t confirm/);
    assert.doesNotMatch(state.status.textContent, /Unexpected token|Failed to fetch/);
    assert.equal(state.button.disabled, false);
  }
});

test('browser validation prevents requests for incomplete forms', async () => {
  let calls=0;const state=setup(async () => { calls++; });
  state.form.valid=false;await state.submit();assert.equal(calls, 0);
});
