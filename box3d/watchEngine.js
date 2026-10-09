/*!
 * Watch Engine — parametric Three.js wristwatch generator
 * Extracted verbatim from "Maoz Dayan · Private Collection" (קופסת השעונים).
 *
 * The code between the ENGINE START / ENGINE END markers is the production engine,
 * copied unchanged except for two mechanical colour-management shims
 * (see AUDIT.md §4): `__setSRGB(texture)` and the `__COLOR_MANAGED` guard.
 *
 * Units: millimetres. A built watch is centred on a virtual wrist of radius
 * WRIST_RADIUS_MM (26 mm) whose axis is the X axis; the dial faces +Z.
 */
import * as THREE from 'three';

/* ---------- colour-management shim (three r128 … r16x) ---------- */
const __REV = parseInt(THREE.REVISION, 10);
// From r152 three converts hex/CSS colours from sRGB to linear automatically.
// The engine was written for r128, where it does that conversion itself.
const __COLOR_MANAGED = __REV >= 152 && !(THREE.ColorManagement && THREE.ColorManagement.enabled === false);
function __setSRGB(t) {
  if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  else t.encoding = THREE.sRGBEncoding;
  return t;
}

/* ÉCRIN additions: a photograph of the real dial / caseback, already straightened into a disc (square canvas,
   disc filling it), painted into the engine's own texture so the geometry, crystal and lighting stay the engine's. */
function __paintDisc(canvas,img,frac){const g=canvas.getContext('2d'),S=canvas.width,r=S*frac;g.save();g.beginPath();g.arc(S/2,S/2,r,0,Math.PI*2);g.clip();g.drawImage(img,S/2-r,S/2-r,r*2,r*2);g.restore();}
function __discTexture(img){const t=new THREE.CanvasTexture(img);__setSRGB(t);t.anisotropy=8;return t;}
/* ======================= ENGINE START (verbatim except the 4 lines marked ÉCRIN / opts) ======================= */
const HEX=/^#[0-9a-fA-F]{6}$/;
const hx=(v,d)=>typeof v==='string'&&HEX.test(v.trim())?v.trim():d;
function shade(hex,a){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=a<0?0:255,t=Math.abs(a);r=Math.round((f-r)*t+r);g=Math.round((f-g)*t+g);b=Math.round((f-b)*t+b);return'#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);}
function lum(hex){const n=parseInt(hex.slice(1),16);return((n>>16)*.3+(n>>8&255)*.59+(n&255)*.11)/255;}
const pick=(v,list,d)=>list.includes(v)?v:d;
const num=(v,lo,hi,d)=>{v=parseFloat(v);return isFinite(v)?Math.min(hi,Math.max(lo,v)):d;};

function makeEnv(renderer,warm){const W1=warm?0xfff1dc:0xf4f6fa,W2=warm?0xffe2b8:0xe8ecf2;
  const env=new THREE.Scene();env.background=new THREE.Color(warm?0x1a120c:0x15171a);
  const panel=(w,h,c,x,y,z,ry,rx)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=ry||0;m.rotation.x=rx||0;env.add(m);};
  panel(8,3,W1,0,6,0,0,Math.PI/2);panel(3,5,W2,-6,2,0,Math.PI/2);panel(2,4,0x9fb4d0,6,2,-1,-Math.PI/2);panel(6,1.2,0xffffff,0,3,-6,0);panel(5,1,0xffffff,0,1,6,Math.PI);
  return new THREE.PMREMGenerator(renderer).fromScene(env,0.04).texture;
}

/* ================= watch spec ================= */
function cleanSpec(m){
  m=m||{};const b=m.bezel||{},d=m.dial||{},s=m.subdials||{},h=m.hands||{},c=m.crown||{},st=m.strap||{};
  const mat=pick(m.caseMaterial,['steel','titanium','gold','rose-gold','bronze','ceramic','bioceramic','plastic','carbon'],'steel');
  const matColor={steel:'#c8cbcf',titanium:'#a5a8ac',gold:'#d6b05a','rose-gold':'#d7a184',bronze:'#a97a4a',ceramic:'#1d1d20',bioceramic:'#3a3f55',plastic:'#2c2c2c',carbon:'#262626'}[mat];
  const dia=num(m.caseDiameterMm,26,50,40);
  return{
    caseShape:pick(m.caseShape,['round','cushion','square','tonneau','octagon','rounded-octagon'],'round'),
    dia,thick:num(m.caseThicknessMm,6,18,12),l2l:num(m.lugToLugMm,dia*.95,dia*1.45,dia*1.18),
    mat,caseColor:hx(m.caseColor,matColor),finish:pick(m.caseFinish,['polished','brushed','matte'],'polished'),
    bezel:{type:pick(b.type,['none','smooth','fluted','tachymeter','dive','gmt'],'smooth'),color:hx(b.color,hx(m.caseColor,matColor)),insert:hx(b.insertColor,'#141414'),insert2:hx(b.insertColor2,hx(b.insertColor,'#141414')),text:hx(b.textColor,'#e9e6df'),screws:!!b.screws,screwCount:Math.round(num(b.screwCount,4,12,8)),screwColor:hx(b.screwColor,null)},
    dial:{color:hx(d.color,'#1a1a1c'),finish:pick(d.finish,['sunburst','matte','gloss','guilloche','lacquer','globe','tapisserie','skeleton','aquanaut'],'matte'),idx:pick(d.indexStyle,['baton','applied','arabic','roman','dots','mixed','none','even-arabic'],'baton'),idxColor:hx(d.indexColor,'#e9e6df'),lume:hx(d.lumeColor,'#e8f0d8'),track:hx(d.trackColor,hx(d.indexColor,'#e9e6df')),accent:hx(d.accentColor,'#c43b2f'),ocean:hx(d.oceanColor,'#1f5fd6')},
    sub:{layout:(()=>{const d=String(s.layout||'').split(/[^0-9]+/).filter(x=>['3','6','9','12'].includes(x));return d.length?[...new Set(d)].slice(0,4).join('-'):'none';})(),color:hx(s.color,hx(d.color,'#1a1a1c')),ring:hx(s.ringColor,hx(d.indexColor,'#e9e6df'))},
    date:pick(String(m.dateWindow||'none'),['none','3','4.5','6'],'none'),
    roulette:m.roulette&&m.roulette.type!=='none'?{type:pick(m.roulette.type,['european','american'],'european'),gems:!!m.roulette.gems,trim:hx(m.roulette.trimColor,hx(m.caseColor,matColor))}:null,
    hands:{style:pick(h.style,['baton','sword','dauphine','mercedes','leaf','alpha','syringe','marker'],'baton'),color:hx(h.color,'#e9e6df'),sec:hx(h.secondsColor,hx(h.color,'#e9e6df')),lume:h.lume!==false},
    crown:{guards:!!c.guards,pushers:!!c.pushers},
    strap:{frame:hx(st.frameColor,null),type:pick(st.type,['leather','rubber','nato','velcro','bracelet','fabric','lanyard','integrated'],'leather'),color:hx(st.color,'#3b2618'),stitch:hx(st.stitchColor,'#d9c9a8'),stripes:Array.isArray(st.stripes)?st.stripes.map(x=>hx(x,null)).filter(Boolean).slice(0,6):[]}
  };
}

function caseShape(kind,R){
  const s=new THREE.Shape();
  if(kind==='round'){s.absarc(0,0,R,0,Math.PI*2,false);return s;}
  if(kind==='rounded-octagon'){const r=R*1.03,pts=[];for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;pts.push([r*Math.sin(a),r*Math.cos(a)]);}
    const t=.3,mid=(p,q,f)=>[p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f];
    for(let i=0;i<8;i++){const p=pts[i],prev=pts[(i+7)%8],next=pts[(i+1)%8],a=mid(p,prev,t),b=mid(p,next,t);i?s.lineTo(a[0],a[1]):s.moveTo(a[0],a[1]);s.quadraticCurveTo(p[0],p[1],b[0],b[1]);}s.closePath();return s;}
  if(kind==='octagon'){for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4,r=R*1.04;i?s.lineTo(r*Math.sin(a),r*Math.cos(a)):s.moveTo(r*Math.sin(a),r*Math.cos(a));}s.closePath();return s;}
  if(kind==='tonneau'){const a=R*.86,b=R*1.06,n=3.2;for(let i=0;i<=72;i++){const t=i/72*Math.PI*2,c=Math.cos(t),sn=Math.sin(t);const y=b*Math.sign(sn)*Math.pow(Math.abs(sn),2/n);let x=a*Math.sign(c)*Math.pow(Math.abs(c),2/n);x*=1-.1*Math.pow(y/b,2);i?s.lineTo(x,y):s.moveTo(x,y);}return s;}
  const hw=R*(kind==='square'?.9:.94),r=R*(kind==='square'?.16:.42);
  s.moveTo(-hw+r,-hw);s.lineTo(hw-r,-hw);s.quadraticCurveTo(hw,-hw,hw,-hw+r);s.lineTo(hw,hw-r);s.quadraticCurveTo(hw,hw,hw-r,hw);s.lineTo(-hw+r,hw);s.quadraticCurveTo(-hw,hw,-hw,hw-r);s.lineTo(-hw,-hw+r);s.quadraticCurveTo(-hw,-hw,-hw+r,-hw);
  return s;
}
function extent(kind,R){return kind==='tonneau'?{w:R*.86,h:R*1.06}:kind==='square'?{w:R*.9,h:R*.9}:kind==='cushion'?{w:R*.94,h:R*.94}:kind==='octagon'||kind==='rounded-octagon'?{w:R*1.0,h:R*1.0}:{w:R,h:R};}
function planarUV(geo,E){const p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/(2*E)+.5,p.getY(i)/(2*E)+.5);uv.needsUpdate=true;}

/* ---------- dial + bezel texture ---------- */
function drawFace(sp,E,bi){
  const S=1024,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');const k=S/2/E,C=S/2;
  const R=sp.dia/2;const P=(r,a)=>[C+r*k*Math.sin(a),C-r*k*Math.cos(a)];
  const path=scale=>{const pts=caseShape(sp.caseShape,R*scale).getPoints(90);const p=new Path2D();pts.forEach((v,i)=>i?p.lineTo(C+v.x*k,C-v.y*k):p.moveTo(C+v.x*k,C-v.y*k));p.closePath();return p;};
  // bezel metal
  g.fillStyle=sp.bezel.color;g.fillRect(0,0,S,S);
  const bt=sp.bezel.type,rIn=R*bi,rOut=R*.955,ins=['tachymeter','dive','gmt'].includes(bt);
  if(bt==='fluted'){g.save();g.clip(path(1));for(let i=0;i<120;i++){const a=i/120*Math.PI*2;g.strokeStyle=i%2?shade(sp.bezel.color,.35):shade(sp.bezel.color,-.35);g.lineWidth=R*k*.026;g.beginPath();g.moveTo(...P(rIn,a));g.lineTo(...P(R*1.05,a));g.stroke();}g.restore();}
  if(ins){
    g.save();const ring=path(.955);ring.addPath(path(bi));g.clip(ring,'evenodd');
    g.fillStyle=sp.bezel.insert;g.fillRect(0,0,S,S);
    if(bt==='gmt'){g.fillStyle=sp.bezel.insert2;g.fillRect(0,C,S,S/2);}
    g.fillStyle=g.strokeStyle=sp.bezel.text;g.textAlign='center';g.textBaseline='middle';
    const mid=(rIn+rOut)/2,fs=(rOut-rIn)*k*.5;
    const label=(t,a,r=mid,f=fs)=>{g.save();g.translate(...P(r,a));g.rotate(a>Math.PI/2&&a<Math.PI*1.5?a+Math.PI:a);g.font=`600 ${f}px "Assistant",Arial,sans-serif`;g.fillText(t,0,0);g.restore();};
    const tick=(a,l,w)=>{g.lineWidth=w*k;g.beginPath();g.moveTo(...P(rOut,a));g.lineTo(...P(rOut-l,a));g.stroke();};
    if(bt==='tachymeter'){[500,400,300,250,200,180,160,150,140,130,120,110,100,90,80,70,65,60].forEach(v=>{const a=(3600/v)*6*Math.PI/180;tick(a,(rOut-rIn)*.22,.35);label(String(v),a,mid-(rOut-rIn)*.08,fs*.82);});}
    if(bt==='dive'){for(let i=0;i<60;i++){const a=i/60*Math.PI*2;if(i===0)continue;if(i%10===0)label(String(i),a);else if(i<15||i%5===0)tick(a,(rOut-rIn)*(i%5?.25:.45),.4);}
      g.beginPath();g.moveTo(...P(rOut-.2,-.09));g.lineTo(...P(rOut-.2,.09));g.lineTo(...P(rIn+.5,0));g.closePath();g.fill();g.fillStyle=sp.dial.lume;g.beginPath();g.arc(...P(mid,0),R*k*.03,0,7);g.fill();}
    if(bt==='gmt'){for(let i=1;i<24;i++){const a=i/24*Math.PI*2;if(i%2===0)label(String(i),a);else tick(a,(rOut-rIn)*.3,.5);}g.beginPath();g.moveTo(...P(rOut-.2,-.1));g.lineTo(...P(rOut-.2,.1));g.lineTo(...P(rIn+.5,0));g.closePath();g.fill();}
    g.restore();
  }
  // dial
  g.save();g.clip(path(bi));
  const dc=sp.dial.color,rd=R*bi;g.fillStyle=dc;g.fillRect(0,0,S,S);
  if(sp.dial.finish==='sunburst'&&g.createConicGradient){const cg=g.createConicGradient(0,C,C);for(let i=0;i<=8;i++)cg.addColorStop(i/8,i%2?shade(dc,.22):shade(dc,-.25));g.fillStyle=cg;g.fillRect(0,0,S,S);}
  if(sp.dial.finish==='guilloche'){g.strokeStyle=lum(dc)>.5?'rgba(0,0,0,.09)':'rgba(255,255,255,.08)';g.lineWidth=1.2;for(let i=0;i<36;i++){g.beginPath();g.arc(C+Math.sin(i/36*6.283)*rd*k*.18,C+Math.cos(i/36*6.283)*rd*k*.18,rd*k*.62,0,7);g.stroke();}}
  if(sp.dial.finish==='gloss'||sp.dial.finish==='lacquer'){const rg=g.createRadialGradient(C-rd*k*.3,C-rd*k*.35,0,C,C,rd*k*1.1);rg.addColorStop(0,'rgba(255,255,255,.22)');rg.addColorStop(.5,'rgba(255,255,255,0)');rg.addColorStop(1,'rgba(0,0,0,.25)');g.fillStyle=rg;g.fillRect(0,0,S,S);}
  if(sp.dial.finish==='skeleton'){const rnd=(a=>()=>(a=(a*9301+49297)%233280)/233280)(7);const br=shade(dc,.1);
    const gear=(x,y,r,t)=>{g.strokeStyle=shade(dc,.22);g.lineWidth=r*.08;g.beginPath();for(let i=0;i<=t*2;i++){const a=i/(t*2)*Math.PI*2,rr=i%2?r:r*.9;g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}g.closePath();g.stroke();
      g.lineWidth=r*.12;for(let i=0;i<5;i++){const a=i/5*Math.PI*2;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*r*.85,y+Math.sin(a)*r*.85);g.stroke();}g.fillStyle='#a3283a';g.beginPath();g.arc(x,y,r*.09,0,7);g.fill();};
    const rk=rd*k;[[0,0,.42,40],[.42,-.3,.26,30],[-.4,.35,.22,24],[.3,.45,.2,22],[-.35,-.4,.28,32],[.05,-.62,.16,18],[-.6,0,.15,16]].forEach(([x,y,r,t])=>gear(C+x*rk,C+y*rk,r*rk,t));
    g.strokeStyle=br;g.lineCap='round';[[-.8,-.2,.75,.3,.13],[-.5,.7,.6,-.6,.11],[-.2,-.85,.3,.85,.09]].forEach(([x1,y1,x2,y2,w])=>{g.lineWidth=w*rk;g.beginPath();g.moveTo(C+x1*rk,C+y1*rk);g.lineTo(C+x2*rk,C+y2*rk);g.stroke();});
    for(let i=0;i<14;i++){const a=rnd()*6.28,r=rnd()*.8*rk;g.fillStyle='#a3283a';g.beginPath();g.arc(C+Math.cos(a)*r,C+Math.sin(a)*r,rk*.018,0,7);g.fill();}g.lineCap='butt';}
  if(sp.dial.finish==='aquanaut'){const cs=rd*k*.085,gap=cs*.16,rr=cs*.2;g.save();g.translate(C,C);g.rotate(Math.PI/4);
    for(let y=-rd*k*1.5;y<rd*k*1.5;y+=cs)for(let x=-rd*k*1.5;x<rd*k*1.5;x+=cs){g.fillStyle=shade(dc,-.28);g.fillRect(x,y,cs,cs);
      const ig=g.createLinearGradient(x,y,x+cs,y+cs);ig.addColorStop(0,shade(dc,.06));ig.addColorStop(1,shade(dc,-.1));g.fillStyle=ig;
      const x0=x+gap/2,y0=y+gap/2,w=cs-gap;g.beginPath();g.moveTo(x0+rr,y0);g.arcTo(x0+w,y0,x0+w,y0+w,rr);g.arcTo(x0+w,y0+w,x0,y0+w,rr);g.arcTo(x0,y0+w,x0,y0,rr);g.arcTo(x0,y0,x0+w,y0,rr);g.fill();}g.restore();}
  if(sp.dial.finish==='tapisserie'){const cs=rd*k*.072,gap=cs*.16;for(let y=C-rd*k;y<C+rd*k;y+=cs)for(let x=C-rd*k;x<C+rd*k;x+=cs){
      g.fillStyle=shade(dc,-.16);g.fillRect(x,y,cs,cs);const ig=g.createLinearGradient(x,y,x+cs,y+cs);ig.addColorStop(0,shade(dc,.22));ig.addColorStop(1,shade(dc,-.06));g.fillStyle=ig;g.fillRect(x+gap,y+gap,cs-gap*2,cs-gap*2);}}
  if(sp.dial.finish==='matte'){const id=g.getImageData(0,0,S,S),dd=id.data;for(let i=0;i<dd.length;i+=4){const n=(Math.random()-.5)*10;dd[i]+=n;dd[i+1]+=n;dd[i+2]+=n;}g.putImageData(id,0,0);}
  // subdials
  const subs=sp.sub.layout==='none'?[]:sp.sub.layout.split('-').map(Number);
  const angOf=h=>h%12/12*Math.PI*2;
  const occupied=new Set(subs.map(h=>h%12));if(sp.date!=='none'&&sp.date!=='4.5')occupied.add(Number(sp.date)%12);
  // minute track
  g.strokeStyle=sp.dial.track;g.fillStyle=sp.dial.track;
  for(let i=0;i<60;i++){const a=i/60*Math.PI*2,big=i%5===0;g.lineWidth=(big?.45:.22)*k;g.beginPath();g.moveTo(...P(rd*.985,a));g.lineTo(...P(rd*(big?.92:.95),a));g.stroke();}
  // indices
  const ic=sp.dial.idxColor,st=sp.dial.idx;g.textAlign='center';g.textBaseline='middle';
  const romanN=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
  if(st==='none'||sp.dial.finish==='globe'){for(let i=1;i<=12;i++){const a=angOf(i);g.fillStyle=sp.dial.track;g.font=`600 ${rd*k*.075}px "Assistant",Arial,sans-serif`;g.save();g.translate(...P(rd*.86,a));g.rotate(a);g.fillText(String(i*5),0,0);g.restore();}}
  else for(let h=0;h<12;h++){if(occupied.has(h))continue;const a=angOf(h),r=rd*.8;
    const asNum=st==='arabic'||st==='roman'||(st==='mixed'&&h%3===0)||(st==='even-arabic'&&h%2===0);
    if(asNum){g.fillStyle=ic;g.font=`600 ${rd*k*(st==='roman'?.13:.17)}px ${st==='roman'?'"Frank Ruhl Libre",serif':'"Assistant",Arial,sans-serif'}`;g.fillText(st==='roman'?romanN[h]:String(h||12),...P(r*.97,a));continue;}
    if(st==='dots'){g.fillStyle=ic;g.beginPath();g.arc(...P(r,a),rd*k*(h%3?.035:.05),0,7);g.fill();g.fillStyle=sp.dial.lume;g.beginPath();g.arc(...P(r,a),rd*k*(h%3?.022:.034),0,7);g.fill();continue;}
    g.save();g.translate(...P(r,a));g.rotate(a);const L=rd*k*(h===0?.2:.15),W=rd*k*(h===0?.08:.045);
    if(st==='applied'){const lg=g.createLinearGradient(-W/2,0,W/2,0);lg.addColorStop(0,shade(ic,.4));lg.addColorStop(.5,shade(ic,-.3));lg.addColorStop(1,shade(ic,.2));g.fillStyle=lg;}else g.fillStyle=ic;
    g.fillRect(-W/2,-L/2,W,L);g.fillStyle=sp.dial.lume;g.fillRect(-W*.25,-L*.4,W*.5,L*.8);g.restore();}
  // subdials draw
  subs.forEach((h,i)=>{const a=angOf(h),cx=P(rd*.46,a),sr=rd*k*.24;
    const sg=g.createRadialGradient(cx[0],cx[1],0,cx[0],cx[1],sr);sg.addColorStop(0,shade(sp.sub.color,.08));sg.addColorStop(1,shade(sp.sub.color,-.12));
    if(sp.dial.finish!=='skeleton'){g.fillStyle=sg;g.beginPath();g.arc(cx[0],cx[1],sr,0,7);g.fill();}
    g.strokeStyle=sp.sub.ring;g.lineWidth=k*.25;g.beginPath();g.arc(cx[0],cx[1],sr*.98,0,7);g.stroke();
    for(let t=0;t<30;t++){const ta=t/30*Math.PI*2,big=t%5===0;g.lineWidth=k*(big?.3:.15);g.beginPath();g.moveTo(cx[0]+Math.sin(ta)*sr*.92,cx[1]-Math.cos(ta)*sr*.92);g.lineTo(cx[0]+Math.sin(ta)*sr*(big?.72:.8),cx[1]-Math.cos(ta)*sr*(big?.72:.8));g.stroke();}
    const ha=(i*2.1+.6);g.strokeStyle=sp.hands.color;g.lineWidth=k*.45;g.beginPath();g.moveTo(cx[0],cx[1]);g.lineTo(cx[0]+Math.sin(ha)*sr*.82,cx[1]-Math.cos(ha)*sr*.82);g.stroke();
    g.fillStyle=sp.hands.color;g.beginPath();g.arc(cx[0],cx[1],k*.6,0,7);g.fill();});
  // date
  if(sp.date!=='none'){const a=angOf(parseFloat(sp.date)),p=P(rd*.74,a),w=rd*k*.16,hh=rd*k*.12;g.save();g.translate(...p);g.rotate(sp.date==='6'?0:a-Math.PI/2+(sp.date==='3'?0:0));g.rotate(sp.date==='6'?0:-(a-Math.PI/2));
    g.fillStyle='#f4f1ea';g.fillRect(-w/2,-hh/2,w,hh);g.strokeStyle=shade(sp.caseColor,-.2);g.lineWidth=k*.3;g.strokeRect(-w/2,-hh/2,w,hh);g.fillStyle='#111';g.font=`600 ${hh*.78}px "Assistant",Arial`;g.fillText(String(new Date().getDate()),0,hh*.04);g.restore();}
  g.restore();
  const t=new THREE.CanvasTexture(c);__setSRGB(t);t.anisotropy=8;return t;
}

function strapTexture(sp){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const s=sp.strap;
  g.fillStyle=s.color;g.fillRect(0,0,256,256);
  if(s.type==='integrated'){const cs=18;g.save();g.translate(128,128);g.rotate(Math.PI/4);for(let y=-200;y<200;y+=cs)for(let x=-200;x<200;x+=cs){g.fillStyle=shade(s.color,-.3);g.fillRect(x,y,cs,cs);g.fillStyle=shade(s.color,-.04);g.fillRect(x+2.5,y+2.5,cs-5,cs-5);}g.restore();}
  if((s.type==='nato'||s.type==='fabric'||s.type==='velcro')&&s.stripes.length){const n=s.stripes.length;s.stripes.forEach((col,i)=>{g.fillStyle=col;g.fillRect(i*256/n,0,256/n+1,256);});}
  if(s.type==='nato'||s.type==='fabric'||s.type==='velcro'){g.globalAlpha=.12;for(let y=0;y<256;y+=3){g.fillStyle=y%6?'#000':'#fff';g.fillRect(0,y,256,1);}g.globalAlpha=1;}
  if(s.type==='leather'||s.type==='lanyard'){const id=g.getImageData(0,0,256,256),d=id.data;for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*18;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}g.putImageData(id,0,0);
    g.strokeStyle=s.stitch;g.lineWidth=3;g.setLineDash([10,8]);[22,234].forEach(x=>{g.beginPath();g.moveTo(x,0);g.lineTo(x,256);g.stroke();});}
  if(s.type==='rubber'){g.fillStyle='rgba(0,0,0,.25)';for(let y=0;y<256;y+=32)g.fillRect(40,y,176,10);}
  const t=new THREE.CanvasTexture(c);__setSRGB(t);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}

function ribbon(pts,X,hw,ht,mat,sgn){
  const grp=new THREE.Group();const n=pts.length;const T=[],N=[],V=[0];
  for(let i=0;i<n;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];const t=b.clone().sub(a).normalize();T.push(t);N.push(new THREE.Vector3().crossVectors(X,t).multiplyScalar(sgn).normalize());if(i)V.push(V[i-1]+pts[i].distanceTo(pts[i-1]));}
  const faces=[[1,1,-1,1],[1,-1,-1,-1],[1,1,1,-1],[-1,1,-1,-1]]; // [xA,nA,xB,nB] corner signs
  faces.forEach(f=>{const pos=[],uv=[],idx=[];
    for(let i=0;i<n;i++){[[f[0],f[1]],[f[2],f[3]]].forEach(([xs,ns],j)=>{const p=pts[i].clone().addScaledVector(X,xs*hw).addScaledVector(N[i],ns*ht);pos.push(p.x,p.y,p.z);uv.push(j,V[i]/(hw*2));});
      if(i<n-1){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,mat);m.castShadow=true;grp.add(m);});
  return grp;
}

function handShape(style,L,w){
  const s=new THREE.Shape(),tail=L*.16;
  if(style==='dauphine'||style==='alpha'){const ww=style==='alpha'?w*.8:w*1.3;s.moveTo(0,-tail);s.lineTo(ww/2,L*.12);s.lineTo(0,L);s.lineTo(-ww/2,L*.12);s.closePath();}
  else if(style==='sword'){s.moveTo(-w*.25,-tail);s.lineTo(w*.25,-tail);s.lineTo(w*.6,L*.2);s.lineTo(w*.45,L*.86);s.lineTo(0,L);s.lineTo(-w*.45,L*.86);s.lineTo(-w*.6,L*.2);s.closePath();}
  else if(style==='leaf'){s.moveTo(0,-tail);s.quadraticCurveTo(w*1.2,L*.45,0,L);s.quadraticCurveTo(-w*1.2,L*.45,0,-tail);}
  else if(style==='syringe'){s.moveTo(-w*.22,-tail);s.lineTo(w*.22,-tail);s.lineTo(w*.22,L*.62);s.lineTo(w*.5,L*.66);s.lineTo(w*.5,L*.8);s.lineTo(w*.08,L*.82);s.lineTo(0,L);s.lineTo(-w*.08,L*.82);s.lineTo(-w*.5,L*.8);s.lineTo(-w*.5,L*.66);s.lineTo(-w*.22,L*.62);s.closePath();}
  else{s.moveTo(-w/2,-tail);s.lineTo(w/2,-tail);s.lineTo(w/2,L);s.lineTo(-w/2,L);s.closePath();}
  return s;
}

const WHEELS={european:'0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26'.split(','),
  american:'0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,00,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14,2'.split(',')};
const REDS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const pocketColor=n=>n==='0'||n==='00'?'green':REDS.has(+n)?'red':'black';
function rouletteTexture(ro){
  const S=1024,C=S/2,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');const nums=WHEELS[ro.type],N=nums.length,R=C*.99,tr=ro.trim;
  const P=(r,a)=>[C+r*Math.sin(a),C-r*Math.cos(a)];
  g.fillStyle=shade(tr,-.35);g.beginPath();g.arc(C,C,R,0,7);g.fill();
  nums.forEach((n,i)=>{const a0=(i-.5)/N*Math.PI*2,a1=(i+.5)/N*Math.PI*2,col=pocketColor(n);
    g.fillStyle=col==='green'?'#1f7a4a':col==='red'?'#a8202b':'#141416';g.beginPath();g.moveTo(...P(R*.6,a0));g.arc(C,C,R*.97,a0-Math.PI/2,a1-Math.PI/2);g.lineTo(...P(R*.6,a1));g.arc(C,C,R*.6,a1-Math.PI/2,a0-Math.PI/2,true);g.closePath();g.fill();
    g.save();g.translate(...P(R*.85,i/N*Math.PI*2));g.rotate(i/N*Math.PI*2);g.fillStyle='#f3ead8';g.font=`600 ${R*.085}px "Assistant",Arial,sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(n,0,0);g.restore();});
  g.strokeStyle=tr;g.lineWidth=R*.012;for(let i=0;i<N;i++){const a=(i-.5)/N*Math.PI*2;g.beginPath();g.moveTo(...P(R*.6,a));g.lineTo(...P(R*.97,a));g.stroke();}
  [R*.97,R*.74,R*.6].forEach(r=>{g.lineWidth=R*.016;g.beginPath();g.arc(C,C,r,0,7);g.stroke();});
  const cg=g.createRadialGradient(C-R*.12,C-R*.12,0,C,C,R*.6);cg.addColorStop(0,shade(tr,.45));cg.addColorStop(.6,tr);cg.addColorStop(1,shade(tr,-.4));g.fillStyle=cg;g.beginPath();g.arc(C,C,R*.58,0,7);g.fill();
  g.strokeStyle=shade(tr,-.45);g.lineWidth=R*.02;for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;g.beginPath();g.moveTo(...P(R*.12,a));g.lineTo(...P(R*.5,a));g.stroke();}
  if(ro.gems){for(let i=0;i<N;i++){const p=P(R*.67,i/N*Math.PI*2),rg=g.createRadialGradient(p[0],p[1],0,p[0],p[1],R*.03);rg.addColorStop(0,'#ffffff');rg.addColorStop(.5,'#dfe9ff');rg.addColorStop(1,'rgba(160,180,220,.2)');g.fillStyle=rg;g.beginPath();g.arc(p[0],p[1],R*.026,0,7);g.fill();}}
  const t=new THREE.CanvasTexture(c);__setSRGB(t);t.anisotropy=8;return t;
}

const LANDS={na:[[-168,66],[-160,70],[-140,70],[-120,72],[-95,72],[-80,70],[-65,60],[-55,52],[-66,45],[-70,42],[-76,35],[-81,31],[-80,25],[-83,29],[-90,30],[-97,27],[-97,22],[-92,18],[-87,21],[-88,16],[-83,10],[-79,9],[-86,13],[-92,14],[-105,20],[-110,24],[-112,31],[-117,32],[-124,40],[-124,48],[-135,58],[-150,60],[-165,62]],
 sa:[[-79,9],[-72,12],[-62,10],[-52,5],[-50,0],[-35,-6],[-39,-14],[-41,-22],[-48,-26],[-53,-34],[-58,-38],[-65,-42],[-67,-50],[-69,-55],[-74,-52],[-74,-42],[-71,-30],[-70,-18],[-76,-14],[-81,-5],[-80,1],[-77,8]],
 gl:[[-73,78],[-60,82],[-30,83],[-20,75],[-22,70],[-40,65],[-45,60],[-52,64],[-55,70],[-68,76]],
 eu:[[-10,36],[-9,43],[-2,43],[-5,48],[2,51],[8,54],[8,57],[5,62],[14,68],[25,71],[40,68],[40,60],[30,55],[30,45],[28,41],[22,37],[15,38],[12,44],[6,43],[0,39],[-5,36]],
 af:[[-17,21],[-16,28],[-10,35],[0,36],[10,37],[11,33],[20,31],[32,31],[35,28],[43,12],[51,11],[42,0],[40,-10],[40,-16],[35,-24],[33,-30],[26,-34],[18,-35],[15,-27],[12,-17],[13,-6],[9,-1],[9,4],[3,6],[-8,4],[-14,10],[-17,15]],
 uk:[[-5,50],[1,51],[2,53],[-1,55],[-3,59],[-6,58],[-5,55],[-3,54],[-5,52]],is:[[-24,64],[-14,64],[-14,66],[-22,66]],
 cu:[[-85,22],[-80,23],[-74,20],[-78,20],[-84,21.5]]};
function globeTexture(ocean,land){
  const Wd=2048,Ht=1024,c=document.createElement('canvas');c.width=Wd;c.height=Ht;const g=c.getContext('2d');
  const og=g.createLinearGradient(0,0,0,Ht);og.addColorStop(0,shade(ocean,-.25));og.addColorStop(.5,ocean);og.addColorStop(1,shade(ocean,-.3));g.fillStyle=og;g.fillRect(0,0,Wd,Ht);
  g.strokeStyle='rgba(255,255,255,.07)';g.lineWidth=2;for(let i=0;i<220;i++){const y=Math.random()*Ht,x=Math.random()*Wd;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+20,y-6,x+44,y);g.stroke();}
  const X=lo=>(lo+180)/360*Wd,Y=la=>(90-la)/180*Ht;
  Object.values(LANDS).forEach(poly=>{const pth=new Path2D();poly.forEach(([lo,la],i)=>i?pth.lineTo(X(lo),Y(la)):pth.moveTo(X(lo),Y(la)));pth.closePath();
    g.save();g.clip(pth);const lg=g.createLinearGradient(0,0,Wd,Ht);lg.addColorStop(0,shade(land,.35));lg.addColorStop(.5,land);lg.addColorStop(1,shade(land,-.2));g.fillStyle=lg;g.fillRect(0,0,Wd,Ht);
    for(let i=0;i<9000;i++){g.fillStyle=Math.random()<.5?'rgba(0,0,0,.18)':'rgba(255,255,255,.35)';g.fillRect(Math.random()*Wd,Math.random()*Ht,2,2);}g.restore();
    g.strokeStyle=shade(land,-.45);g.lineWidth=3;g.stroke(pth);});
  const t=new THREE.CanvasTexture(c);__setSRGB(t);t.anisotropy=8;return t;
}

const RW=26; // wrist / cushion radius in mm
function lumeMask(cv,hex){const g=cv.getContext('2d'),S=cv.width,id=g.getImageData(0,0,S,S),d=id.data,n=parseInt(hex.slice(1),16),r=n>>16,gg=n>>8&255,b=n&255;
  const o=document.createElement('canvas');o.width=o.height=S;const og=o.getContext('2d'),od=og.createImageData(S,S),q=od.data;
  for(let i=0;i<d.length;i+=4){const dist=Math.abs(d[i]-r)+Math.abs(d[i+1]-gg)+Math.abs(d[i+2]-b),v=dist<75?255:0;q[i]=q[i+1]=q[i+2]=v;q[i+3]=255;}og.putImageData(od,0,0);return new THREE.CanvasTexture(o);}
function movementTexture(sp,auto){const S=1024,C=S/2,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');
  g.fillStyle='#5d636a';g.fillRect(0,0,S,S);
  const bridge=(pts,col)=>{const p=new Path2D();pts.forEach(([x,y],i)=>i?p.lineTo(C+x*C,C+y*C):p.moveTo(C+x*C,C+y*C));p.closePath();g.save();g.clip(p);g.fillStyle=col;g.fillRect(0,0,S,S);
    g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=7;for(let x=-S;x<S*2;x+=26){g.beginPath();g.moveTo(x,0);g.lineTo(x+S*.35,S);g.stroke();}g.restore();g.strokeStyle='rgba(40,44,48,.6)';g.lineWidth=3;g.stroke(p);};
  bridge([[-.9,-.1],[-.2,-.75],[.35,-.7],[.2,-.1],[-.3,.15]],'#8d939a');
  bridge([[.15,.05],[.85,-.15],[.8,.45],[.3,.6]],'#878d94');
  bridge([[-.85,.2],[-.25,.25],[0,.8],[-.55,.7]],'#90969d');
  g.strokeStyle='#d8c08a';g.lineWidth=5;g.beginPath();g.arc(C+.52*C,C+.22*C,.24*C,0,7);g.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2;g.beginPath();g.moveTo(C+.52*C,C+.22*C);g.lineTo(C+.52*C+Math.cos(a)*.24*C,C+.22*C+Math.sin(a)*.24*C);g.stroke();}
  g.strokeStyle='rgba(216,192,138,.7)';g.lineWidth=2;g.beginPath();for(let t=0;t<40;t+=.1){const r=.02*C+t*.004*C;g.lineTo(C+.52*C+Math.cos(t)*r,C+.22*C+Math.sin(t)*r);}g.stroke();
  [[-.2,-.3],[.3,-.35],[-.55,-.05],[.6,.05],[-.4,.45],[0,.35],[.2,.5],[-.1,-.55],[.45,-.55]].forEach(([x,y])=>{g.fillStyle='#e8e2d4';g.beginPath();g.arc(C+x*C,C+y*C,15,0,7);g.fill();g.fillStyle='#a3283a';g.beginPath();g.arc(C+x*C,C+y*C,9,0,7);g.fill();});
  [[-.6,-.45],[.7,.3],[-.7,.45],[.05,-.82]].forEach(([x,y])=>{g.fillStyle='#4a5f8a';g.beginPath();g.arc(C+x*C,C+y*C,13,0,7);g.fill();g.strokeStyle='#22304a';g.lineWidth=3;g.beginPath();g.moveTo(C+x*C-9,C+y*C);g.lineTo(C+x*C+9,C+y*C);g.stroke();});
  const t=new THREE.CanvasTexture(c);__setSRGB(t);t.anisotropy=8;return t;}
function rotorTexture(col){const S=512,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');g.fillStyle=col;g.fillRect(0,0,S,S);
  g.strokeStyle='rgba(255,255,255,.25)';g.lineWidth=2;for(let r=20;r<S;r+=9){g.beginPath();g.arc(S/2,S/2,r,0,7);g.stroke();}
  const t=new THREE.CanvasTexture(c);__setSRGB(t);return t;}

function buildWatch(raw,mv,opts){mv=mv||{type:'automatic'};opts=opts||{};/* ÉCRIN: opts = {dialImage, backImage, photoHands} */
  const sp=cleanSpec(raw);const R=sp.dia/2,ex=extent(sp.caseShape,R),E=Math.max(ex.w,ex.h)*1.02;
  const grp=new THREE.Group(),disp=[],strapParts=[];const track=o=>{disp.push(o);return o;};
  const metal=['steel','titanium','gold','rose-gold','bronze'].includes(sp.mat);
  const caseMat=track(new THREE.MeshPhysicalMaterial({color:sp.caseColor,metalness:metal?1:.05,roughness:metal?(sp.finish==='polished'?.18:sp.finish==='brushed'?.36:.5):(sp.mat==='ceramic'?.22:sp.mat==='bioceramic'?.55:.45),clearcoat:metal?0:(sp.mat==='ceramic'?.6:sp.mat==='bioceramic'?0:.3),clearcoatRoughness:.15,envMapIntensity:metal?1.2:(lum(sp.caseColor)<.2?.45:.8)}));
  const Tc=sp.thick*.55,bev=.8;
  const ext=(shape,depth,b,opts)=>{const g=new THREE.ExtrudeGeometry(shape,Object.assign({depth,bevelEnabled:b>0,bevelThickness:b,bevelSize:b,bevelSegments:3,curveSegments:72},opts||{}));return track(g);};
  // case
  const cg=ext(caseShape(sp.caseShape,R*.985),Tc,bev);cg.translate(0,0,bev);const caseM=new THREE.Mesh(cg,caseMat);grp.add(caseM);
  const caseTop=Tc+bev*2;
  // bezel
  const ins=['tachymeter','dive','gmt'].includes(sp.bezel.type);const bi=ins?.78:(sp.bezel.type==='none'?.93:.86);
  const tex=track(drawFace(sp,E,bi));if(opts.dialImage)__paintDisc(tex.image,opts.dialImage,R*bi/(2*E));
  const bShape=caseShape(sp.caseShape,R);bShape.holes.push(caseShape(sp.caseShape,R*bi));
  const bg=ext(bShape,sp.bezel.type==='none'?.3:1.1,.45);planarUV(bg,E);bg.translate(0,0,caseTop-.25);
  const bezelCap=track(new THREE.MeshPhysicalMaterial({map:tex,metalness:ins?(metal?.35:.1):(metal?1:.05),roughness:ins?.35:caseMat.roughness,clearcoat:ins?1:caseMat.clearcoat,envMapIntensity:1.1}));
  const bezelSide=metal?caseMat:track(new THREE.MeshPhysicalMaterial({color:sp.bezel.color,roughness:.3,metalness:.05,clearcoat:.6}));
  grp.add(new THREE.Mesh(bg,[bezelCap,bezelSide]));
  const bezelTop=caseTop-.25+(sp.bezel.type==='none'?.3:1.1)+.9;
  if(sp.bezel.screws){const sm=track(new THREE.MeshStandardMaterial({color:sp.bezel.screwColor||shade(sp.bezel.color,.45),metalness:metal?1:.2,roughness:.3})),sg=track(new THREE.CylinderGeometry(1.05,1.05,.6,6));
    const n=sp.bezel.screwCount,off=sp.caseShape==='octagon'?Math.PI/8:(n===6?Math.PI/6:0);const rr=R*(bi+.98)/2*(sp.caseShape==='octagon'?1.04:1);for(let i=0;i<n;i++){const a=off+i*Math.PI*2/n,m=new THREE.Mesh(sg,sm);m.rotation.x=Math.PI/2;m.rotation.y=a;m.position.set(rr*Math.sin(a),rr*Math.cos(a),bezelTop-.55);grp.add(m);}}
  // dial
  const dg=track(new THREE.ShapeGeometry(caseShape(sp.caseShape,R*bi),72));planarUV(dg,E);
  const lumeTex=track(lumeMask(tex.image,sp.dial.lume));
  const dialMat=track(new THREE.MeshPhysicalMaterial({emissiveMap:lumeTex,emissive:'#8dffc4',emissiveIntensity:0,map:tex,roughness:sp.dial.finish==='gloss'||sp.dial.finish==='lacquer'?.15:sp.dial.finish==='sunburst'?.32:.7,metalness:sp.dial.finish==='sunburst'?.35:0,clearcoat:sp.dial.finish==='lacquer'?1:0,envMapIntensity:.9}));
  if(opts.dialImage){dialMat.emissiveMap=tex;dialMat.emissive.set(0xffffff);dialMat.emissiveIntensity=.66;dialMat.color.set(0x303030);dialMat.roughness=.85;dialMat.metalness=0;dialMat.clearcoat=0;dialMat.envMapIntensity=.12;}/* ÉCRIN: a photo carries its own light */const dial=new THREE.Mesh(dg,dialMat);dial.position.z=caseTop+.1;dial.receiveShadow=true;grp.add(dial);
  // hands
  const rd=R*bi,hz=caseTop+.1;
  let wheel=null;
  if(sp.roulette){const wt=track(rouletteTexture(sp.roulette));wheel=new THREE.Mesh(track(new THREE.CircleGeometry(rd*.66,96)),track(new THREE.MeshPhysicalMaterial({map:wt,roughness:.18,metalness:.2,clearcoat:1,envMapIntensity:1})));wheel.position.z=hz+.06;grp.add(wheel);
    const ptr=new THREE.Mesh(track(new THREE.ConeGeometry(rd*.035,rd*.07,3)),track(new THREE.MeshStandardMaterial({color:sp.roulette.trim,metalness:1,roughness:.2})));ptr.rotation.z=Math.PI;ptr.position.set(0,rd*.69,hz+.15);grp.add(ptr);}
  let globeTop=0;
  if(sp.dial.finish==='globe'){const a=rd*.7,h=Math.min(5,rd*.28),Rg=(a*a+h*h)/(2*h),th=Math.asin(a/Rg);
    const gg=track(new THREE.SphereGeometry(Rg,96,40,0,Math.PI*2,0,th));gg.rotateX(Math.PI/2);
    const Mx=new THREE.Matrix4().makeRotationY(-30*Math.PI/180).multiply(new THREE.Matrix4().makeRotationX(-22*Math.PI/180));
    const pa=gg.attributes.position,ua=gg.attributes.uv,v3=new THREE.Vector3();
    for(let i=0;i<pa.count;i++){v3.set(pa.getX(i),pa.getY(i),pa.getZ(i)).normalize().applyMatrix4(Mx);const lon=Math.atan2(v3.x,v3.z),lat=Math.asin(Math.max(-1,Math.min(1,v3.y)));ua.setXY(i,(lon/Math.PI+1)/2,lat/Math.PI+.5);}ua.needsUpdate=true;
    const gt=track(globeTexture(sp.dial.ocean,sp.dial.idxColor));
    const globe=new THREE.Mesh(gg,track(new THREE.MeshPhysicalMaterial({map:gt,bumpMap:gt,bumpScale:.35,roughness:.4,metalness:.25,clearcoat:.6,envMapIntensity:1.1})));
    globe.position.z=hz+h-Rg;globe.castShadow=true;grp.add(globe);globeTop=hz+h;}
  const hm=track(new THREE.MeshStandardMaterial({color:sp.hands.color,metalness:lum(sp.hands.color)>.55?.85:.2,roughness:.25}));
  const lm=track(new THREE.MeshStandardMaterial({color:sp.dial.lume,emissive:'#8dffc4',emissiveIntensity:0,roughness:.6}));
  const mkHand=(L,w,z)=>{const p=new THREE.Group();const g=ext(handShape(sp.hands.style,L,w),.25,0,{curveSegments:16});p.add(new THREE.Mesh(g,hm));
    if(sp.hands.lume&&sp.hands.style!=='leaf'){const lg=ext(handShape(sp.hands.style==='syringe'?'baton':sp.hands.style,L*.62,w*.42),.08,0,{curveSegments:16});const l=new THREE.Mesh(lg,lm);l.position.set(0,L*.22,.25);p.add(l);}
    p.position.z=z;p.children.forEach(c=>c.castShadow=true);grp.add(p);return p;};
  let hour,minute;
  if(sp.hands.style==='marker'){hour=new THREE.Group();minute=new THREE.Group();minute.position.z=hz+.2;grp.add(minute);
    const st=new THREE.Shape();for(let i=0;i<8;i++){const a=i/8*Math.PI*2,r=i%2?rd*.035:rd*.1;i?st.lineTo(r*Math.sin(a),r*Math.cos(a)):st.moveTo(r*Math.sin(a),r*Math.cos(a));}st.closePath();
    const star=new THREE.Mesh(ext(st,.5,.15),hm);star.position.y=rd*.76;minute.add(star);
    const tip=new THREE.Mesh(track(new THREE.ConeGeometry(rd*.03,rd*.08,3)),lm);tip.position.set(0,rd*.86,.3);minute.add(tip);}
  else{hour=mkHand(rd*.52,rd*.085,hz+.3);minute=mkHand(rd*.84,rd*.07,hz+.65);}
  const sec=new THREE.Group();const smat=track(new THREE.MeshStandardMaterial({color:sp.hands.sec,metalness:.3,roughness:.35}));
  const sb=new THREE.Mesh(track(new THREE.BoxGeometry(rd*.018,rd*1.12,.15)),smat);sb.position.y=rd*.34;sec.add(sb);
  const cw=new THREE.Mesh(track(new THREE.CircleGeometry(rd*.045,20)),smat);cw.position.set(0,-rd*.12,.08);sec.add(cw);
  sec.position.z=hz+1.0;grp.add(sec);if(sp.hands.style==='marker'||globeTop)sec.visible=false;
  const cap=new THREE.Mesh(track(new THREE.CylinderGeometry(rd*.035,rd*.035,.5,20)),smat);cap.rotation.x=Math.PI/2;cap.position.z=hz+1.15;if(!globeTop)grp.add(cap);if(opts.photoHands){hour.visible=minute.visible=sec.visible=cap.visible=false;}
  // crystal
  const glassMat=track(new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:0,transparent:true,opacity:.12,clearcoat:1,envMapIntensity:2.4,depthWrite:false}));
  if(sp.caseShape==='round'){const a=R*bi*1.02,h=Math.max(Math.min(2,(bezelTop-hz-1.25)+.9),globeTop?globeTop+1.2-(bezelTop-.5):0),Rc=(a*a+h*h)/(2*h),th=Math.asin(a/Rc);const cr=new THREE.Mesh(track(new THREE.SphereGeometry(Rc,64,12,0,Math.PI*2,0,th)),glassMat);cr.rotation.x=Math.PI/2;cr.position.z=bezelTop-.5+h-Rc;grp.add(cr);}
  else{const cr=new THREE.Mesh(track(new THREE.ShapeGeometry(caseShape(sp.caseShape,R*bi*1.02),48)),glassMat);cr.position.z=bezelTop-.3;grp.add(cr);}
  // lugs
  const integ=sp.strap.type==='integrated';const Ws=integ?ex.w*1.3:Math.min(26,Math.max(14,Math.round(sp.dia*.5))),L2=sp.l2l/2,ly0=ex.h*.7,lugLen=L2-ly0;
  const lugG=track(new THREE.BoxGeometry(2.8,lugLen,Tc*.85));
  const lan=sp.strap.type==='lanyard';
  if(!lan&&!integ)[[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sy])=>{const l=new THREE.Mesh(lugG,caseMat);l.position.set(sx*(Ws/2+1.5),sy*(ly0+lugLen/2),Tc*.55);l.castShadow=true;grp.add(l);});
  // crown & pushers
  const crG=track(new THREE.CylinderGeometry(2.4,2.4,3.4,24));const crown=new THREE.Mesh(crG,caseMat);if(lan){crown.position.set(0,ex.h*1.1+2.2,Tc*.6+.5);}else{crown.rotation.z=Math.PI/2;crown.position.set(ex.w+1.4,0,Tc*.6+.5);}grp.add(crown);
  const knurl=new THREE.Mesh(track(new THREE.CylinderGeometry(2.5,2.5,2.2,24,1,true)),track(new THREE.MeshStandardMaterial({color:shade(sp.caseColor,-.25),metalness:metal?1:0,roughness:.5,wireframe:true})));knurl.rotation.copy(crown.rotation);knurl.position.copy(crown.position);grp.add(knurl);
  if(sp.crown.pushers){[Math.PI/3,Math.PI*2/3].forEach(a=>{const p=new THREE.Mesh(track(new THREE.CylinderGeometry(1.3,1.3,3.6,18)),caseMat);p.rotation.z=-a;const r=Math.max(ex.w,ex.h)*.98+1.4;p.position.set(r*Math.sin(a),r*Math.cos(a),Tc*.6+.5);grp.add(p);});}
  if(sp.crown.guards){[-1,1].forEach(s=>{const gd=new THREE.Mesh(track(new THREE.BoxGeometry(3,1.6,Tc*.7)),caseMat);gd.position.set(ex.w+.9,s*3.6,Tc*.55);grp.add(gd);});}
  // strap
  const X=new THREE.Vector3(1,0,0),thick=sp.strap.type==='bracelet'||sp.strap.type==='rubber'||integ?2.6:2.0,Rs=RW+thick/2+.2;
  const strapMat=sp.strap.type==='bracelet'?null:track(new THREE.MeshStandardMaterial({map:track(strapTexture(sp)),roughness:sp.strap.type==='rubber'||integ?.75:sp.strap.type==='leather'?.55:.9,metalness:0,side:THREE.DoubleSide}));
  if(lan){const fc=sp.strap.frame||sp.strap.color,fm=track(new THREE.MeshPhysicalMaterial({color:fc,roughness:.6,metalness:0,envMapIntensity:.6}));
    const fs=caseShape('octagon',Math.max(ex.w,ex.h)*1.12);fs.holes.push(caseShape(sp.caseShape,R*.96));const fg=ext(fs,Tc*.55,.6);fg.translate(0,0,.5);grp.add(new THREE.Mesh(fg,fm));
    const fy=Math.max(ex.w,ex.h)*1.12*1.04;const tab=new THREE.Mesh(track(new THREE.BoxGeometry(9,7,Tc*.6)),fm);tab.position.set(0,fy+1.5,Tc*.45);grp.add(tab);
    const bail=new THREE.Mesh(track(new THREE.TorusGeometry(3.2,.9,10,28)),fm);bail.position.set(0,fy+6,Tc*.45);grp.add(bail);
    const Rl=RW+1.1,pts=[new THREE.Vector3(0,fy+8,Tc*.45),new THREE.Vector3(0,fy+12,Tc*.1-3)];for(let a=.95;a<=5.35;a+=.12)pts.push(new THREE.Vector3(0,Rl*Math.sin(a),-RW+Rl*Math.cos(a)));
    const lc=new THREE.CatmullRomCurve3(pts);const lr=ribbon(lc.getSpacedPoints(110),X,4.5,.7,strapMat,1);strapParts.push(lr);grp.add(lr);}
  else [1,-1].forEach(sg=>{
    const pts=[new THREE.Vector3(0,sg*(L2-1.6),Tc*.45),new THREE.Vector3(0,sg*(L2+1.2),Tc*.1-2)];
    for(let a=1.0;a<=2.95;a+=.12)pts.push(new THREE.Vector3(0,sg*Rs*Math.sin(a),-RW+Rs*Math.cos(a)));
    const curve=new THREE.CatmullRomCurve3(pts);const sp2=curve.getSpacedPoints(70);
    if(strapMat){const rb=ribbon(sp2,X,Ws/2,thick/2,strapMat,sg);strapParts.push(rb);grp.add(rb);}
    else{const len=curve.getLength(),n=Math.floor(len/3.7),bm=track(new THREE.MeshStandardMaterial({color:sp.caseColor,metalness:metal?1:.1,roughness:metal?.32:.4})),cm=caseMat;
      const og=track(new THREE.BoxGeometry(Ws*.3,3.3,thick)),ig=track(new THREE.BoxGeometry(Ws*.36,3.1,thick*1.08));
      const oi=new THREE.InstancedMesh(og,bm,n*2),ii=new THREE.InstancedMesh(ig,cm,n);const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),one=new THREE.Vector3(1,1,1);
      for(let i=0;i<n;i++){const u=(i+.5)/n,p=curve.getPointAt(u),t=curve.getTangentAt(u),nn=new THREE.Vector3().crossVectors(X,t).multiplyScalar(sg).normalize();
        q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X,t,nn));
        [-1,1].forEach((s,j)=>{m4.compose(p.clone().addScaledVector(X,s*Ws*.33),q,one);oi.setMatrixAt(i*2+j,m4);});m4.compose(p,q,one);ii.setMatrixAt(i,m4);}
      oi.castShadow=ii.castShadow=true;strapParts.push(oi,ii);grp.add(oi,ii);}
  });
  // case back with exhibition window
  let rotor=null;
  if(mv.type!=='quartz'){const wr=Math.min(ex.w,ex.h)*.74;const back=new THREE.Mesh(track(new THREE.CircleGeometry(wr,72)),track(new THREE.MeshStandardMaterial({map:track(opts.backImage?__discTexture(opts.backImage):movementTexture(sp,mv.type==='automatic')),metalness:opts.backImage?0:.6,roughness:opts.backImage?.85:.35,envMapIntensity:opts.backImage?.12:1,emissive:opts.backImage?0xffffff:0,emissiveIntensity:opts.backImage?.78:0})));back.rotation.y=Math.PI;if(opts.backImage){back.material.emissiveMap=back.material.map;back.material.color.set(0x5a5a5a);}back.position.z=-.05;grp.add(back);
    const rim=new THREE.Mesh(track(new THREE.RingGeometry(wr,wr+1.2,72)),caseMat);rim.rotation.y=Math.PI;rim.position.z=-.08;grp.add(rim);
    if(mv.type==='automatic'&&!opts.backImage){rotor=new THREE.Group();const rm=new THREE.Mesh(track(new THREE.CircleGeometry(wr*.95,48,0,Math.PI)),track(new THREE.MeshStandardMaterial({map:track(rotorTexture(metal?sp.caseColor:'#b9bec4')),metalness:.9,roughness:.25,side:THREE.DoubleSide})));
      rm.rotation.z=Math.PI/2;rotor.add(rm);const hub=new THREE.Mesh(track(new THREE.CylinderGeometry(wr*.08,wr*.08,.6,20)),caseMat);hub.rotation.x=Math.PI/2;rotor.add(hub);rotor.rotation.y=Math.PI;rotor.position.z=-.45;grp.add(rotor);}
    const glassB=new THREE.Mesh(track(new THREE.CircleGeometry(wr,48)),glassMat);glassB.rotation.y=Math.PI;glassB.position.z=-.9;grp.add(glassB);}
  grp.traverse(o=>{if(o.isMesh&&!o.material.transparent)o.castShadow=true;});
  if(!__COLOR_MANAGED)grp.traverse(o=>{if(!o.material)return;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.userData.lin)return;m.userData.lin=true;if(m.color)m.color.convertSRGBToLinear();if(m.emissive)m.emissive.convertSRGBToLinear();});});
  // wrap so wrist centre is the origin
  const outer=new THREE.Group();grp.position.z=RW;outer.add(grp);
  return{root:outer,hands:{hour,minute,sec},rotor,strapParts,lume:[dialMat,lm],wheel,wheelNums:sp.roulette?WHEELS[sp.roulette.type]:null,dispose(){disp.forEach(d=>d.dispose&&d.dispose());}};
}
function setTime(h){const d=new Date(),s=d.getSeconds()+d.getMilliseconds()/1000,m=d.getMinutes()+s/60,hr=d.getHours()%12+m/60;
  h.sec.rotation.z=-s/60*Math.PI*2;h.minute.rotation.z=-m/60*Math.PI*2;h.hour.rotation.z=-hr/12*Math.PI*2;}

function mvtOf(w){const m=(w.model&&w.model.movementType)||'',t=((w.info&&w.info.movement)||'')+' '+m;
  const type=/quartz|קוורץ/i.test(t)?'quartz':/manual|ידני|hand-wound/i.test(t)?'manual':'automatic';
  const chrono=/chrono|כרונוגרף/i.test(t)||!!(w.model&&w.model.crown&&w.model.crown.pushers);return{type,chrono};}
/* ======================= ENGINE END ======================= */

/* ---------- utilities (extracted from the viewer, logic unchanged) ---------- */

/** Wrist / cushion radius the strap is wrapped around, in mm. */
export const WRIST_RADIUS_MM = RW;

/**
 * Studio reflection environment used by the original viewer (PMREM of soft light panels).
 * warm=false is the neutral version used on the watch detail page; warm=true is the box scene.
 */
export function createStudioEnvironment(renderer, warm = false) {
  if (__REV < 152) return makeEnv(renderer, warm);
  // three ≥ r152: same light panels, but the backdrop is calibrated so that
  // chrome / steel / white gold reflect with the same brightness as on r128
  // (r128's PMREM produced a much lighter ambient reflection; measured on test spheres).
  const W1 = warm ? 0xfff1dc : 0xf4f6fa, W2 = warm ? 0xffe2b8 : 0xe8ecf2;
  const env = new THREE.Scene(); env.background = new THREE.Color(warm ? 0x968878 : 0x828c9c);
  const panel = (w, h, c, x, y, z, ry, rx) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; m.rotation.x = rx || 0; env.add(m); };
  panel(8, 3, W1, 0, 6, 0, 0, Math.PI / 2); panel(3, 5, W2, -6, 2, 0, Math.PI / 2); panel(2, 4, 0x9fb4d0, 6, 2, -1, -Math.PI / 2); panel(6, 1.2, 0xffffff, 0, 3, -6, 0); panel(5, 1, 0xffffff, 0, 1, 6, Math.PI);
  const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(env, 0.04).texture; pm.dispose();
  return tex;
}

/**
 * The exact light rig of the original watch detail viewer.
 * Intensities are compensated (×π) on three ≥ r155, where lights are physically based.
 * Returns the created lights (already added to `scene`).
 */
export function createStudioLighting(scene) {
  const k = __REV >= 155 ? Math.PI : 1;
  const hemi = new THREE.HemisphereLight(0xf2f4f8, 0x1a1612, 0.6 * k);
  const key = new THREE.DirectionalLight(0xffffff, 1.1 * k); key.position.set(60, 120, 140);
  const rim = new THREE.DirectionalLight(0xbfd0ff, 0.5 * k); rim.position.set(-100, 40, -80);
  scene.add(hemi, key, rim);
  return [hemi, key, rim];
}

/**
 * The dark wrist pedestal from the detail viewer (cylinder of WRIST_RADIUS_MM along X).
 */
export function createWristPedestal() {
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(RW, RW, 110, 64),
    new THREE.MeshStandardMaterial({ color: 0x101417, roughness: 0.8, envMapIntensity: 0.25 })
  );
  ped.rotation.z = Math.PI / 2;
  return ped;
}

/** Recommended camera framing used by the original detail viewer. */
export const VIEW = {
  fov: 30, near: 1, far: 3000,
  target: [0, 8, 20],
  theta: -0.5, phi: 1.15,
  radiusLandscape: 235, radiusPortrait: 165,
  watchTiltX: -0.25,           // applied to watch.root.rotation.x
  backView: { theta: Math.PI - 0.35, phi: 1.75 },
  toneMapping: 'ACESFilmic', exposure: 1.0,
};

/** Spherical → cartesian camera position, as in the original orbit controller. */
export function viewPosition(radius = VIEW.radiusLandscape, theta = VIEW.theta, phi = VIEW.phi, target = VIEW.target) {
  return [
    target[0] + radius * Math.sin(phi) * Math.sin(theta),
    target[1] + radius * Math.cos(phi),
    target[2] + radius * Math.sin(phi) * Math.cos(theta),
  ];
}

/** Per-frame update: live hands + spinning rotor (same rates as the original). */
export function animateWatch(watch, dt, { reducedMotion = false } = {}) {
  if (!watch) return;
  setTime(watch.hands);
  if (watch.rotor && !reducedMotion) watch.rotor.rotation.z += dt * 0.5;
}

/** Night mode: luminous paint glows. Same intensity as the original (2.6). */
export function setLume(watch, on) {
  if (watch) watch.lume.forEach(m => { m.emissiveIntensity = on ? 2.6 : 0; });
}

/** Case-back view: hide the strap so the exhibition back and rotor are visible. */
export function setStrapVisible(watch, visible) {
  if (watch) watch.strapParts.forEach(p => { p.visible = visible; });
}

/** Roulette dials: spin with the original physics; `update(dt)` returns the result once it stops. */
export function createRouletteSpinner(watch) {
  let v = 0, spinning = false;
  return {
    get spinning() { return spinning; },
    spin(reducedMotion = false) { if (!watch || !watch.wheel) return false; v = reducedMotion ? 40 : 9 + Math.random() * 6; spinning = true; return true; },
    update(dt) {
      const wh = watch && watch.wheel; if (!wh || !spinning) return null;
      wh.rotation.z += v * dt; v *= Math.pow(0.42, dt);
      if (v < 0.05) {
        spinning = false; const nums = watch.wheelNums, N = nums.length;
        let a = wh.rotation.z % (Math.PI * 2); if (a < 0) a += Math.PI * 2;
        const n = nums[Math.round(a / (Math.PI * 2) * N) % N];
        return { number: n, color: pocketColor(n) };
      }
      return null;
    },
  };
}

/**
 * Movement descriptor from a full watch record ({info, model}).
 * Decides automatic / manual / quartz and chronograph; drives the case-back rendering.
 */
export { mvtOf as movementOf };

export { buildWatch, setTime, cleanSpec, WHEELS, pocketColor };
