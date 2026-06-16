// One-off screenshot driver for the campsite-fit feature. Reuses the zero-dep
// raw-WebSocket CDP approach from cdp-shot.cjs, but parameterized: navigate to a
// URL, run an optional setup script in the page, wait for a readiness predicate,
// then capture. Chrome must already be running with --remote-debugging-port=9222.
// We DO NOT launch or kill chrome here — the caller owns the PID (see the shell
// harness) so chrome is always killed by explicit PID, never pkill -f.
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const URL_ARG = process.argv[2];
const NAME = process.argv[3];
const MODE = process.argv[4] || 'detail'; // 'detail' | 'finder'
const OUTDIR = process.argv[5] || 'screenshots';

function httpGet(path) {
  return new Promise((res, rej) => {
    http.get('http://127.0.0.1:9222' + path, (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
  });
}
function httpPut(path) {
  return new Promise((res, rej) => {
    const r = http.request('http://127.0.0.1:9222' + path, { method: 'PUT' }, (resp) => { let d = ''; resp.on('data', (c) => d += c); resp.on('end', () => res(JSON.parse(d))); });
    r.on('error', rej); r.end();
  });
}

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.cbs = new Map(); this.buf = Buffer.alloc(0); }
  connect() {
    return new Promise((resolve, reject) => {
      const u = new URL(this.wsUrl);
      this.sock = net.connect(u.port, u.hostname, () => {
        const key = crypto.randomBytes(16).toString('base64');
        this.sock.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.hostname}:${u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      });
      let handsh = false;
      this.sock.on('data', (chunk) => {
        if (!handsh) {
          const s = chunk.toString('binary'); const i = s.indexOf('\r\n\r\n');
          if (i === -1) return; handsh = true;
          const rest = Buffer.from(s.slice(i + 4), 'binary');
          if (rest.length) this._onBytes(rest); resolve();
        } else this._onBytes(chunk);
      });
      this.sock.on('error', reject);
    });
  }
  _onBytes(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 2) {
      const b1 = this.buf[1]; let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (this.buf.length < off + len) return;
      const payload = this.buf.slice(off, off + len); this.buf = this.buf.slice(off + len);
      try { this._onMsg(JSON.parse(payload.toString('utf8'))); } catch (e) {}
    }
  }
  _onMsg(msg) { if (msg.id && this.cbs.has(msg.id)) { this.cbs.get(msg.id)(msg); this.cbs.delete(msg.id); } }
  send(method, params) {
    const id = ++this.id; const data = JSON.stringify({ id, method, params: params || {} });
    const payload = Buffer.from(data, 'utf8'); const mask = crypto.randomBytes(4);
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
    let header; const len = payload.length;
    if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
    this.sock.write(Buffer.concat([header, mask, masked]));
    return new Promise((res) => { this.cbs.set(id, res); });
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const tab = await httpPut('/json/new?' + encodeURIComponent(URL_ARG));
  const cdp = new CDP(tab.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: URL_ARG });

  async function evalJS(expr) {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  }

  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    if (MODE === 'detail') {
      const v = await evalJS(`!!document.querySelector('.cgfit .cg-card-name') && !!document.querySelector('.cg-fit-honesty')`);
      if (v) { ready = true; break; }
    } else {
      // finder: wait for the async dataset to hydrate the list (cards present)
      const v = await evalJS(`(function(){var l=document.getElementById('cg-list');return l && l.querySelectorAll('.cg-card-name').length>0;})()`);
      if (v) { ready = true; break; }
    }
  }
  console.log('ready:', ready);

  if (MODE === 'detail') {
    // Scroll the honest fit section into view and capture just that region.
    await evalJS(`(function(){var s=document.querySelector('.cgfit');if(s)s.scrollIntoView({block:'start'});return true;})()`);
    await sleep(700);
  } else {
    // Finder: pick the Classic 33FB rig + apply the Full-hookup filter, then
    // let the list re-render. This exercises the new per-site fit + hookup pills.
    const applied = await evalJS(`(function(){
      var rig=document.getElementById('cg-rig');
      // choose the longest rig option (Classic 33FB) to make fit% meaningful
      var best=null,bl=0;
      for(var i=0;i<rig.options.length;i++){var v=parseFloat(rig.options[i].value);if(!isNaN(v)&&v>bl){bl=v;best=i;}}
      if(best!=null){rig.selectedIndex=best;rig.dispatchEvent(new Event('change',{bubbles:true}));}
      var hk=document.getElementById('cg-hookup');
      hk.value='full';hk.dispatchEvent(new Event('change',{bubbles:true}));
      return JSON.stringify({rig:rig.value, hookup:hk.value, cards:document.querySelectorAll('#cg-list .cg-card-name').length});
    })()`);
    console.log('finder applied:', applied);
    await sleep(1200);
    await evalJS(`window.scrollTo(0, Math.max(0, (document.querySelector('.cg-controls')||{offsetTop:0}).offsetTop - 20))`);
    await sleep(500);
  }

  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: MODE === 'detail' });
  fs.writeFileSync(`${OUTDIR}/${NAME}.png`, Buffer.from(r.result.data, 'base64'));
  console.log('saved', NAME);
  await cdp.send('Page.close').catch(() => {});
  process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
