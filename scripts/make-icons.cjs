#!/usr/bin/env node
// One-off: rasterize favicon.svg → PNG icons (apple-touch 180, PWA 192/512)
// via headless Chrome screenshot. No image libs on this box, so we render an
// exact-sized HTML page wrapping the SVG and screenshot it. Run from repo root.
const { execSync } = require('child_process');
const { writeFileSync, readFileSync, mkdtempSync, existsSync } = require('fs');
const { join } = require('path');
const os = require('os');
const net = require('net');
const http = require('http');

const SVG = readFileSync('src/assets/favicon.svg', 'utf8');
const OUT = 'src/assets';
const SIZES = [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['favicon-32.png', 32]];

// Minimal CDP screenshot (reuse the WS approach already proven in cdp-shot.cjs,
// but inline + tiny since we only need Page.captureScreenshot of a data: URL).
function wsKey(){return require('crypto').randomBytes(16).toString('base64');}
function connectWS(port, path){
  return new Promise((res,rej)=>{
    const key=wsKey();
    const sock=net.connect(port,'127.0.0.1',()=>{
      sock.write(`GET ${path} HTTP/1.1\r\nHost:127.0.0.1:${port}\r\nUpgrade:websocket\r\nConnection:Upgrade\r\nSec-WebSocket-Key:${key}\r\nSec-WebSocket-Version:13\r\n\r\n`);
    });
    let buf=Buffer.alloc(0),up=false;
    sock.on('data',d=>{buf=Buffer.concat([buf,d]);if(!up){const i=buf.indexOf('\r\n\r\n');if(i>=0){up=true;buf=buf.slice(i+4);res({sock,rest:buf});}}});
    sock.on('error',rej);
  });
}
function frame(obj){
  const p=Buffer.from(JSON.stringify(obj));const len=p.length;let hdr;
  const mask=require('crypto').randomBytes(4);
  if(len<126){hdr=Buffer.from([0x81,0x80|len]);}
  else if(len<65536){hdr=Buffer.from([0x81,0x80|126,len>>8&255,len&255]);}
  else {hdr=Buffer.from([0x81,0x80|127,0,0,0,0,len>>24&255,len>>16&255,len>>8&255,len&255]);}
  const masked=Buffer.alloc(len);for(let i=0;i<len;i++)masked[i]=p[i]^mask[i%4];
  return Buffer.concat([hdr,mask,masked]);
}
function parse(buf){
  const out=[];let off=0;
  while(off+2<=buf.length){
    const b1=buf[off+1];let len=b1&127;let ho=2;
    if(len===126){len=buf.readUInt16BE(off+2);ho=4;}
    else if(len===127){len=Number(buf.readBigUInt64BE(off+2));ho=10;}
    if(off+ho+len>buf.length)break;
    out.push(buf.slice(off+ho,off+ho+len).toString());off+=ho+len;
  }
  return {msgs:out,rest:buf.slice(off)};
}

(async()=>{
  // launch chrome
  const ud=mkdtempSync(join(os.tmpdir(),'ico-'));
  const port=9333;
  const chrome=require('child_process').spawn('google-chrome',
    ['--headless=new',`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,
     '--no-sandbox','--disable-gpu','--hide-scrollbars'],{stdio:'ignore',detached:true});
  await new Promise(r=>setTimeout(r,1500));
  for(const [name,size] of SIZES){
    const html=`<!doctype html><meta charset=utf8><style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${SVG}`;
    const dataUrl='data:text/html;base64,'+Buffer.from(html).toString('base64');
    // get a target
    const tgt=await new Promise((res,rej)=>{const rq=http.request(`http://127.0.0.1:${port}/json/new`,{method:'PUT'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));});rq.on('error',rej);rq.end();});
    const wsPath=new URL(tgt.webSocketDebuggerUrl).pathname;
    const {sock,rest}=await connectWS(port,wsPath);
    let acc=rest;let id=0;const pending={};
    sock.on('data',d=>{acc=Buffer.concat([acc,d]);const {msgs,rest}=parse(acc);acc=rest;for(const m of msgs){try{const o=JSON.parse(m);if(o.id&&pending[o.id]){pending[o.id](o);}}catch(e){}}});
    const send=(method,params)=>new Promise(r=>{id++;pending[id]=r;sock.write(frame({id,method,params:params||{}}));});
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:size,height:size,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:dataUrl});
    await new Promise(r=>setTimeout(r,500));
    const shot=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:size,height:size,scale:1}});
    writeFileSync(join(OUT,name),Buffer.from(shot.result.data,'base64'));
    console.log('wrote',name,size+'px');
    sock.end();
  }
  try{process.kill(-chrome.pid);}catch(e){}
  // Wrap the 32px PNG in a valid .ico container (PNG-compressed ICO entry, fine
  // for all evergreen browsers + Win Vista+). Single 32x32 entry.
  const png32 = readFileSync(join(OUT,'favicon-32.png'));
  const ico = Buffer.alloc(6 + 16 + png32.length);
  ico.writeUInt16LE(0,0);            // reserved
  ico.writeUInt16LE(1,2);            // type 1 = icon
  ico.writeUInt16LE(1,4);            // image count
  ico.writeUInt8(32,6);              // width
  ico.writeUInt8(32,7);              // height
  ico.writeUInt8(0,8);               // palette
  ico.writeUInt8(0,9);               // reserved
  ico.writeUInt16LE(1,10);           // color planes
  ico.writeUInt16LE(32,12);          // bpp
  ico.writeUInt32LE(png32.length,14);// data size
  ico.writeUInt32LE(6+16,18);        // data offset
  png32.copy(ico,6+16);
  writeFileSync(join(OUT,'favicon.ico'),ico);
  require('fs').unlinkSync(join(OUT,'favicon-32.png'));
  console.log('wrote favicon.ico (32px)');
  console.log('done');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
