// Minimal Chrome DevTools Protocol driver over a raw WebSocket (no deps).
// Implements just enough of RFC6455 (client masking, single text frames,
// fragmentation reassembly) to drive Page/Runtime/Emulation for screenshots.
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const FILE = process.argv[2];           // file:// URL to load
const OUTDIR = process.argv[3] || 'screenshots';

function httpGet(path) {
  return new Promise((res, rej) => {
    http.get('http://127.0.0.1:9222' + path, (r) => {
      let d = ''; r.on('data', (c) => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}
function httpPut(path) {
  return new Promise((res, rej) => {
    const r = http.request('http://127.0.0.1:9222' + path, { method: 'PUT' }, (resp) => {
      let d = ''; resp.on('data', (c) => d += c); resp.on('end', () => res(JSON.parse(d)));
    });
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
        this.sock.write(
          `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
          `Host: ${u.hostname}:${u.port}\r\n` +
          `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      });
      let handsh = false;
      this.sock.on('data', (chunk) => {
        if (!handsh) {
          const s = chunk.toString('binary');
          const i = s.indexOf('\r\n\r\n');
          if (i === -1) return;
          handsh = true;
          const rest = Buffer.from(s.slice(i + 4), 'binary');
          if (rest.length) this._onBytes(rest);
          resolve();
        } else this._onBytes(chunk);
      });
      this.sock.on('error', reject);
    });
  }
  _onBytes(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 2) {
      const b1 = this.buf[1];
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (this.buf.length < off + len) return;
      const payload = this.buf.slice(off, off + len);
      this.buf = this.buf.slice(off + len);
      try { this._onMsg(JSON.parse(payload.toString('utf8'))); } catch (e) {}
    }
  }
  _onMsg(msg) {
    if (msg.id && this.cbs.has(msg.id)) { this.cbs.get(msg.id)(msg); this.cbs.delete(msg.id); }
  }
  send(method, params) {
    const id = ++this.id;
    const data = JSON.stringify({ id, method, params: params || {} });
    const payload = Buffer.from(data, 'utf8');
    const mask = crypto.randomBytes(4);
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
    let header;
    const len = payload.length;
    if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
    this.sock.write(Buffer.concat([header, mask, masked]));
    return new Promise((res) => { this.cbs.set(id, res); });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // Open a fresh tab pointed at our file (PUT, per CDP for /json/new with URL).
  const tab = await httpPut('/json/new?' + encodeURIComponent(FILE));
  const cdp = new CDP(tab.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: FILE });
  // Poll the DOM until the family grid + toggle exist and JS has run.
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const r = await cdp.send('Runtime.evaluate', {
      expression: `(function(){var t=document.getElementById('view-toggle');var f=document.querySelectorAll('.fam-grid .fam').length;var vfam=document.getElementById('view-families');return JSON.stringify({toggle:!!t,fams:f,famHidden: vfam?vfam.hasAttribute('hidden'):null});})()`,
      returnByValue: true,
    });
    try {
      const v = JSON.parse(r.result.result.value);
      if (v.toggle && v.fams === 12) { ready = true; break; }
    } catch (e) {}
  }
  console.log('hub ready:', ready);
  await sleep(600); // let fonts/hero settle

  async function shot(name) {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(`${OUTDIR}/${name}.png`, Buffer.from(r.result.data, 'base64'));
    console.log('saved', name);
  }

  // State 1: default "By family"
  await shot('hub-by-family');

  // Toggle to "All floorplans" by clicking the data-view="all" control.
  const click = await cdp.send('Runtime.evaluate', {
    expression: `(function(){var a=document.querySelector('.viewseg-btn[data-view="all"]');if(!a)return 'no-btn';a.click();var va=document.getElementById('view-all');var vf=document.getElementById('view-families');return JSON.stringify({allHidden:va.hasAttribute('hidden'),famHidden:vf.hasAttribute('hidden'),hash:location.hash});})()`,
    returnByValue: true,
  });
  console.log('after toggle:', click.result.result.value);
  await sleep(700);
  await shot('hub-all-floorplans');

  // Also capture just the toggle bar region for the editorial-look check.
  await cdp.send('Runtime.evaluate', { expression: `window.scrollTo(0,0)`, returnByValue: true });
  await sleep(300);
  await shot('hub-toggle-top');

  await cdp.send('Page.close').catch(() => {});
  process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
