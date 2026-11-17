/* Same resource URLs and bytes as the local adapter, supplied by static bundles. */
const base = new URL('./', self.location.href).pathname;
let indexPromise;
const chunks = new Map();
const pending = new Map();
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
async function index() {
  const version=new URL(self.location.href).searchParams.get('bundled')||'1';
  if (!indexPromise) indexPromise = fetch(new URL('resource-index.json?v='+encodeURIComponent(version), self.location.href), {cache: 'no-cache'}).then(async response => {
    if (!response.ok) throw new Error('Resource index unavailable');
    const value = await response.json();
    if (value.schema !== 1 || value.kind !== 'chicken-kicks-bundled-resources') throw new Error('Invalid resource index');
    return value;
  }).catch(error => {indexPromise = null; throw error;});
  return indexPromise;
}
async function chunk(number, descriptor) {
  if (chunks.has(number)) {
    const value = chunks.get(number); chunks.delete(number); chunks.set(number, value); return value;
  }
  if (pending.has(number)) return pending.get(number);
  const task = (async () => {
    for(let attempt=0;attempt<5;attempt++){
      try{
        const url=new URL(descriptor.file,self.location.href);
        if(attempt)url.searchParams.set('verified',descriptor.sha256);
        const response = await fetch(url,{cache:attempt?'reload':'default'});
        if (!response.ok) throw new Error('Resource download failed: HTTP '+response.status);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length !== descriptor.bytes) throw new Error('Resource download truncated');
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        const actual = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
        if (actual !== descriptor.sha256) throw new Error('Resource checksum mismatch');
        const expanded=descriptor.encoding==='gzip'?new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()):bytes;
        chunks.set(number, expanded);
        while (chunks.size > 6) chunks.delete(chunks.keys().next().value);
        return expanded;
      }catch(error){
        if(attempt===4)throw error;
        await new Promise(resolve=>setTimeout(resolve,400*2**attempt));
      }
    }
  })();
  pending.set(number, task);
  try {return await task;} finally {pending.delete(number);}
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(base + '__local/')) return;
  event.respondWith((async () => {
    if (event.request.method !== 'GET') return new Response('', {status: 405});
    try {
      const metadata = await index();
      const path = '/' + url.pathname.slice(base.length);
      const entry = metadata.entries.find(entry => entry.url === path);
      if (!entry) return new Response('', {status: 404});
      const bytes = new Uint8Array(entry.bytes);
      let offset = 0;
      for (const segment of entry.segments) {
        const data = await chunk(segment.chunk, metadata.chunks[segment.chunk]);
        bytes.set(data.subarray(segment.offset, segment.offset + segment.bytes), offset);
        offset += segment.bytes;
      }
      return new Response(bytes, {headers: {'Content-Type': entry.type, 'Content-Length': String(entry.bytes), 'X-Content-Type-Options': 'nosniff'}});
    } catch (error) {return new Response(error.message, {status: 503, headers: {'Content-Type': 'text/plain'}});}
  })());
});
