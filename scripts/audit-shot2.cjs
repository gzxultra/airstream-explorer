// Screenshot with lazy-load forced: scroll through full height, then capture.
// Usage: node audit-shot2.cjs <url> <outpath.png> <width> <height> [waitMs]
const net=require('net'),http=require('http'),crypto=require('crypto'),fs=require('fs');
const URL_=process.argv[2],OUT=process.argv[3],W=+(process.argv[4]||1280),H=+(process.argv[5]||900),WAIT=+(process.argv[6]||1400);
function httpPut(p){return new Promise((res,rej)=>{const r=http.request('http://127.0.0.1:9222'+p,{method:'PUT'},(x)=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(JSON.parse(d)));});r.on('error',rej);r.end();});}
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
// Force every lazy <img> to eager + decode, and step-scroll to trip IntersectionObservers.
await cdp.send('Runtime.evaluate',{expression:`(async()=>{
  document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager');
  document.querySelectorAll('img[data-src]').forEach(i=>{if(!i.src)i.src=i.dataset.src;});
  const h=document.body.scrollHeight; for(let y=0;y<h;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}
  window.scrollTo(0,0);
  try{await Promise.all([...document.images].filter(i=>i.src).map(i=>i.decode().catch(()=>{})));}catch(e){}
  try{await document.fonts.ready;}catch(e){}
})()`,returnByValue:true,awaitPromise:true});
await sleep(700);
const r=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
fs.writeFileSync(OUT,Buffer.from(r.result.data,'base64'));console.log('saved',OUT);
await cdp.send('Page.close').catch(()=>{});process.exit(0);})().catch(e=>{console.error('ERR',e&&e.message);process.exit(1);});
