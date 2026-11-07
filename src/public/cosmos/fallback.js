
// A software-rendered view for browsers without WebGL. Surface textures are
// projected onto a sphere, rather than displaying a stretched flat photograph.
export function createFallbackScene(canvas, { lowGraphics = false } = {}) {
  const ctx=canvas.getContext('2d');
  let id='earth', inset={side:'none',sizePx:0}, paused=matchMedia('(prefers-reduced-motion: reduce)').matches, longitude=0, zoom=1, drag=null;
  const maps={}, images={};
  let seed=144;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const stars=Array.from({length:lowGraphics?500:1700},()=>[random(),random(),random(),random()]);
  const points=Array.from({length:lowGraphics?3500:10000},()=>[random(),random(),random(),random()]);
  function web(wall){
    const nodes=Array.from({length:42},(_,i)=>{const t=i/41;return [(t-.5)*2.5,wall?(random()-.5)*1.3:Math.sin(t*7)*.3+(random()-.5)*.18];});
    const samples=[];
    for(let i=1;i<nodes.length;i++){
      const a=nodes[i-1],b=nodes[i];
      for(let j=0;j<160;j++){const t=random(),k=j%6===0?.08:.025;samples.push([a[0]+(b[0]-a[0])*t+(random()-.5)*k,a[1]+(b[1]-a[1])*t+(random()-.5)*k,random(),0]);}
      for(let j=0;j<75;j++){const a=random()*Math.PI*2,r=random()*.035;samples.push([b[0]+Math.cos(a)*r,b[1]+Math.sin(a)*r,random(),1]);}
      if(i%5===0){const end=[b[0]+(random()-.5)*.5,b[1]+(random()>.5?1:-1)*(.25+random()*.3)];for(let j=0;j<130;j++){const t=random();samples.push([b[0]+(end[0]-b[0])*t+(random()-.5)*.04,b[1]+(end[1]-b[1])*t+(random()-.5)*.04,random(),0]);}}
    }
    return samples;
  }
  const webPoints=web(false),wallPoints=web(true);
  const off=document.createElement('canvas');const resolution=lowGraphics?240:400;off.width=resolution;off.height=resolution;const oc=off.getContext('2d');
  for(const name of ['earth_daymap','earth_night','earth_clouds','saturn_bands','milkyway']){
    const image=new Image();image.src=`/cosmos/assets/${name}${lowGraphics && name!=='earth_clouds'?'_lg':''}.jpg`;
    image.onload=()=>{images[name]=image;const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const context=c.getContext('2d');context.drawImage(image,0,0);maps[name]={data:context.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};};
  }
  function sample(map,u,v){const x=((Math.floor(u*map.w)%map.w)+map.w)%map.w,y=Math.max(0,Math.min(map.h-1,Math.floor(v*map.h)));const i=(y*map.w+x)*4;return [map.data[i],map.data[i+1],map.data[i+2]];}
  const stellarMap={w:512,h:256,data:new Uint8ClampedArray(512*256*4)};
  function noise3(x,y,z){
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    let fx=x-ix,fy=y-iy,fz=z-iz;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
    const hash=(a,b,c)=>{let n=Math.imul(a,374761393)+Math.imul(b,668265263)+Math.imul(c,2147483647);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
    const mix=(a,b,t)=>a+(b-a)*t;
    return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),fx),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);
  }
  for(let y=0;y<256;y++)for(let x=0;x<512;x++){
    const theta=x/512*Math.PI*2,phi=y/256*Math.PI;
    const a=Math.sin(phi)*Math.cos(theta),b=Math.cos(phi),c=Math.sin(phi)*Math.sin(theta);
    const n=.55*noise3(a*10,b*10,c*10)+.3*noise3(a*27,b*27,c*27)+.15*noise3(a*75,b*75,c*75);
    const i=(y*512+x)*4;stellarMap.data[i]=n*255;
  }
  function sphere(stellar=false){
    const size=resolution,frame=oc.createImageData(size,size),map=maps[id==='saturn'?'saturn_bands':'earth_daymap'];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const nx=(x-size/2)/(size/2),ny=(y-size/2)/(size/2),r=nx*nx+ny*ny;if(r>1)continue;
      const nz=Math.sqrt(1-r),u=(Math.atan2(nx,nz)/(2*Math.PI)+.57+longitude) % 1,v=Math.acos(-ny)/Math.PI;
      const light=Math.max(0,-nx*.78-ny*.25+nz*.56),i=(y*size+x)*4;
      let color;
      if(stellar){const grain=sample(stellarMap,u,v)[0]/255;const edge=.35+.65*Math.pow(nz,.3);color=id==='betelgeuse'?[255,85+grain*120,15+grain*45]:[255,180+grain*75,70+grain*100];color=color.map(c=>c*(.4+grain*.85)*edge);}
      else if(map){
        color=sample(map,u,v);const illumination=.018+Math.pow(light,.7)*1.25;
        if(id==='earth' && maps.earth_clouds){const cloud=sample(maps.earth_clouds,u+longitude*.05,v)[0]/255*.8;color=color.map(c=>c*(1-cloud)+230*cloud);}
        color=color.map(c=>c*illumination);
        if(id==='earth'&&maps.earth_night&&light<.12){const night=sample(maps.earth_night,u,v);color=color.map((c,j)=>c+night[j]*(1-light/.12));}
      }else color=[25+light*35,55+light*65,80+light*100];
      frame.data[i]=color[0];frame.data[i+1]=color[1];frame.data[i+2]=color[2];frame.data[i+3]=255;
    }
    oc.putImageData(frame,0,0);
  }
  function rings(x,y,r,front){
    ctx.save();ctx.translate(x,y);ctx.rotate(-.28);
    for(let i=0;i<90;i++){const t=i/90,rr=r*(1.25+t*1.05);const gap=t>.65&&t<.7;ctx.strokeStyle=`rgba(207,188,150,${gap?.035:.28+.19*Math.sin(i*2.4)})`;ctx.lineWidth=r*.017;ctx.beginPath();ctx.ellipse(0,0,rr,rr*.32,0,front?0:Math.PI,front?Math.PI:Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function draw(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    ctx.fillStyle='#020409';ctx.fillRect(0,0,w,h);
    const local=['earth','saturn','betelgeuse','gaia-bh1'].includes(id);
    if(images.milkyway&&local){ctx.globalAlpha=.38;ctx.drawImage(images.milkyway,0,0,w,h);ctx.globalAlpha=1;}
    for(const [sx,sy,b,t] of stars){ctx.fillStyle=t>.8?`rgba(255,220,185,${.2+b*.6})`:`rgba(210,228,255,${.2+b*.65})`;ctx.beginPath();ctx.arc(sx*w,sy*h,b>.97?1.15:.45,0,Math.PI*2);ctx.fill();}
    const desktop=w>768,left=desktop?(w>1000?260:200):0,right=inset.side==='right'?inset.sizePx+36:0,top=desktop?90:100,bottom=inset.side==='bottom'?inset.sizePx:(desktop?180:240);
    const cx=(left+w-right)/2,cy=(top+h-bottom)/2,space=Math.max(120,Math.min(w-left-right,h-top-bottom)),radius=space*.37*zoom;
    if(['earth','saturn','betelgeuse','gaia-bh1'].includes(id)){
      const r=id==='saturn'?radius*.6:radius;const stellar=['betelgeuse','gaia-bh1'].includes(id);
      if(id==='saturn')rings(cx,cy,r,false);
      if(stellar||id==='earth'){const halo=ctx.createRadialGradient(cx,cy,r*.96,cx,cy,r*(stellar?1.5:1.07));halo.addColorStop(0,stellar?'rgba(255,140,42,.4)':'rgba(83,163,255,.45)');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cx,cy,r*(stellar?1.5:1.07),0,Math.PI*2);ctx.fill();}
      sphere(stellar);ctx.drawImage(off,cx-r,cy-r,r*2,r*2);
      if(id==='saturn')rings(cx,cy,r,true);
    }else{
      ctx.save();ctx.translate(cx,cy);ctx.rotate(id==='andromeda'?-.32:0);ctx.globalCompositeOperation='lighter';
      if(id==='andromeda'){ctx.save();ctx.scale(1,.38);const haze=ctx.createRadialGradient(0,0,0,0,0,radius*1.3);haze.addColorStop(0,'rgba(255,219,166,.28)');haze.addColorStop(.25,'rgba(205,188,175,.12)');haze.addColorStop(.7,'rgba(104,129,169,.045)');haze.addColorStop(1,'transparent');ctx.fillStyle=haze;ctx.fillRect(-radius*1.4,-radius*1.4,radius*2.8,radius*2.8);ctx.restore();}
      for(let i=0;i<points.length;i++){
        const [a,b,c,d]=points[i];let x,y;
        if(id==='andromeda'){const r=Math.pow(a,.8)*radius*1.3,theta=i%2*Math.PI+r/radius*7+(b-.5)*.9;x=Math.cos(theta)*r;y=Math.sin(theta)*r*.38+(c-.5)*radius*.06;ctx.fillStyle=`rgba(${Math.round(255-a*60)},${Math.round(190+a*30)},${Math.round(125+a*125)},${.15+d*.6})`;}
        else{const collection=id==='quipu'?webPoints:wallPoints;const point=collection[i%collection.length];x=point[0]*radius;y=point[1]*radius;ctx.fillStyle=point[3]?`rgba(255,222,169,${.2+point[2]*.65})`:`rgba(155,200,235,${.1+point[2]*.5})`;}
        ctx.beginPath();ctx.arc(x,y,d>.995?1.8:.55,0,Math.PI*2);ctx.fill();
      }
      if(id==='andromeda'){const glow=ctx.createRadialGradient(0,0,0,0,0,radius*.25);glow.addColorStop(0,'rgba(255,233,194,.9)');glow.addColorStop(.2,'rgba(255,217,160,.4)');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.scale(1,.5);ctx.fillRect(-radius*.3,-radius*.3,radius*.6,radius*.6);}
      ctx.restore();
    }
  }
  let last=0;
  function frame(now){if(now-last>(lowGraphics?160:100)&&!document.hidden){last=now;if(!paused)longitude+=.00035;draw();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
  canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,longitude};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(drag)longitude=drag.longitude+(event.clientX-drag.x)/700;});
  canvas.addEventListener('pointerup',()=>{drag=null;});
  canvas.addEventListener('wheel',event=>{event.preventDefault();zoom=Math.max(.45,Math.min(1.5,zoom-event.deltaY*.001));},{passive:false});
  return {objects:new Map(),flyTo(next,{onArrive}={}){id=next;zoom=1;onArrive?.();},reframeCurrent(){zoom=1;},setViewportInset(value){inset=value;},raycastAt(){return null;},resize:draw,setPaused(value){paused=value;},get paused(){return paused;},reset(){zoom=1;longitude=0;}};
}
