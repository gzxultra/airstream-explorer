// Flexible audit screenshotter over CDP (no deps).
// Usage: node audit-shot.cjs <url> <outpath.png> <width> <height> <full:0|1> [waitMs]
const net = require('net'); const http = require('http'); const crypto = require('crypto'); const fs = require('fs');
const URL_ = process.argv[2];
const OUT = process.argv[3];
const W = parseInt(process.argv[4] || '1280', 10);
const H = parseInt(process.argv[5] || '900', 10);
const FULL = (process.argv[6] || '1') === '1';
const WAIT = parseInt(process.argv[7] || '1400', 10);
function httpPut(path){return new Promise((res,rej)=>{const r=http.request('http://127.0.0.1:9222'+path,{method:'PUT'},(resp)=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res(JSON.parse(d)));});r.on('error',rej);r.end();});}
class CDP{constructor(u){this.wsUrl=u;this.id=0;this.cbs=new Map();this.buf=Buffer.alloc(0);}
connect(){return new Promise((resolve,reject)=>{const u=new URL(this.wsUrl);this.sock=net.connect(u.port,u.hostname,()=>{const key=crypto.randomBytes(16).toString('base64');this.sock.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.hostname}:${u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);});let h=false;this.sock.on('data',(chunk)=>{if(!h){const s=chunk.toString('binary');const i=s.indexOf('\r\n\r\n');if(i===-1)return;h=true;const rest=Buffer.from(s.slice(i+4),'binary');if(rest.length)this._b(rest);resolve();}else this._b(chunk);});this.sock.on('error',reject);});}
_b(chunk){this.buf=Buffer.concat([this.buf,chunk]);while(this.buf.length>=2){const b1=this.buf[1];let len=b1&0x7f,off=2;if(len===126){if(this.buf.length<4)return;len=this.buf.readUInt16BE(2);off=4;}else if(len===127){if(this.buf.length<10)return;len=Number(this.buf.readBigUInt64BE(2));off=10;}if(this.buf.length<off+len)return;const p=this.buf.slice(off,off+len);this.buf=this.buf.slice(off+len);try{this._m(JSON.parse(p.toString('utf8')));}catch(e){}}}
_m(msg){if(msg.id&&this.cbs.has(msg.id)){this.cbs.get(msg.id)(msg);this.cbs.delete(msg.id);}}
send(method,params){const id=++this.id;const data=JSON.stringify({id,method,params:params||{}});const payload=Buffer.from(data,'utf8');const mask=crypto.randomBytes(4);const masked=Buffer.alloc(payload.length);for(let i=0;i<payload.length;i++)masked[i]=payload[i]^mask[i%4];let header;const len=payload.length;if(len<126)header=Buffer.from([0x81,0x80|len]);else if(len<65536){header=Buffer.alloc(4);header[0]=0x81;header[1]=0x80|126;header.writeUInt16BE(len,2);}else{header=Buffer.alloc(10);header[0]=0x81;header[1]=0x80|127;header.writeBigUInt64BE(BigInt(len),2);}this.sock.write(Buffer.concat([header,mask,masked]));return new Promise((res)=>{this.cbs.set(id,res);});}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const tab=await httpPut('/json/new?'+encodeURIComponent(URL_));const cdp=new CDP(tab.webSocketDebuggerUrl);await cdp.connect();
await cdp.send('Page.enable');await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:W<700});
await cdp.send('Page.navigate',{url:URL_});await sleep(WAIT);
// settle: wait for fonts + any hero img decode
await cdp.send('Runtime.evaluate',{expression:`(async()=>{try{await document.fonts.ready;}catch(e){} })()`,returnByValue:true});
await sleep(400);
const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:FULL});
fs.writeFileSync(OUT,Buffer.from(r.result.data,'base64'));
console.log('saved',OUT);await cdp.send('Page.close').catch(()=>{});process.exit(0);})().catch(e=>{console.error('ERR',e&&e.message);process.exit(1);});
