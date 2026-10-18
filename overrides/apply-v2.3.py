from pathlib import Path
import re, shutil, json

import sys
root = Path(sys.argv[1] if len(sys.argv)>1 else 'terrapin')
app_p = root/'app.js'; idx_p=root/'index.html'; pkg_p=root/'package.json'; man_p=root/'manifest.json'
app=app_p.read_text(); idx=idx_p.read_text(); pkg=pkg_p.read_text(); man=man_p.read_text()

# Version labels
app=app.replace('/* TerraPin 2.2 — mapas sin conexión, rutas GPS, Shape y proyectos', '/* TerraPin 2.3 — SIG de campo, navegación híbrida, mapas offline y proyectos')
pkg=pkg.replace('"version": "2.2.0"','"version": "2.3.0"')
# manifest may or may not contain version; improve description if present
man=man.replace('Mapas sin conexión, rutas GPS y proyectos', 'SIG de campo con navegación, mapas sin conexión, rutas GPS y proyectos')

# State: navigation mode
old="""  layers: {}, trackLayers: {}, vectorLayers: {}, wpLayers: {}, panes: {},
  tab: null, sel: null, measure: null, rec: null, me: null, follow: false, watchId: null
};"""
new="""  layers: {}, trackLayers: {}, vectorLayers: {}, wpLayers: {}, panes: {},
  tab: null, sel: null, measure: null, rec: null, me: null, follow: false, watchId: null,
  nav: null, navLayer: null
};"""
assert old in app
app=app.replace(old,new)

# Waypoint popup: add navigation button
old="""    m.bindPopup(() => `<div style="font-size:20px;margin-bottom:3px">${d.symbol}</div><b>${esc(w.name)}</b><br>${esc(w.notes || '')}<br><span style="color:#777">${w.lat.toFixed(5)}, ${w.lng.toFixed(5)}</span><br><a href="#" data-wp="${w.id}">Editar</a>`);
    m.on('popupopen', e => { e.popup.getElement().querySelector('[data-wp]').onclick = ev => { ev.preventDefault(); editWaypoint(w); }; });"""
new="""    m.bindPopup(() => `<div class="wp-popup"><div class="wp-popup-icon">${d.symbol}</div><b>${esc(w.name)}</b><div class="wp-popup-notes">${esc(w.notes || '')}</div><div class="wp-popup-coord">${w.lat.toFixed(5)}, ${w.lng.toFixed(5)}</div><div class="wp-popup-actions"><button type="button" class="wp-nav" data-navwp="${w.id}">Ir aquí</button><button type="button" class="wp-edit" data-wp="${w.id}">Editar</button></div></div>`);
    m.on('popupopen', e => { const el=e.popup.getElement(); const ed=el.querySelector('[data-wp]'); const go=el.querySelector('[data-navwp]'); if(ed)ed.onclick = ev => { ev.preventDefault(); editWaypoint(w); }; if(go)go.onclick = ev => { ev.preventDefault(); map.closePopup(); routeToWaypoint(w); }; });"""
assert old in app
app=app.replace(old,new)

# Update GPS onPos with nav updates
old="""  if (S.follow) map.panTo(ll, { animate: true, duration: .4 });
  if (S.rec) recPoint(p);
  $('#sAcc').textContent = '±' + Math.round(p.coords.accuracy) + ' m';"""
new="""  if (S.follow) map.panTo(ll, { animate: true, duration: .4 });
  if (S.rec) recPoint(p);
  if (S.nav) updateNavigationProgress(S.me);
  $('#sAcc').textContent = '±' + Math.round(p.coords.accuracy) + ' m';
  refreshMapHud();"""
assert old in app
app=app.replace(old,new)

# Insert navigation engine after map dragstart before recording
anchor="""map.on('dragstart', () => { if (S.follow) { S.follow = false; $('#btnLocate').classList.remove('active'); } });

/* ---------- grabación ---------- */"""
nav_code=r'''map.on('dragstart', () => { if (S.follow) { S.follow = false; $('#btnLocate').classList.remove('active'); } });

/* ---------- navegación híbrida: OSM + red SIG local ---------- */
const navCard = $('#routeCard');
const routeClass = p => String(p?.highway || p?.tipo || p?.TIPO || p?.clase || p?.CLASE || p?.surface || p?.SURFACE || p?.name || '').toLowerCase();
const routeFactor = p => {
  const s=routeClass(p);
  if (/motorway|trunk|primary|secondary|paviment|asphalt|asfalto|carretera/.test(s)) return .98;
  if (/calle|residential|tertiary|road|avenida/.test(s)) return 1;
  if (/gravel|terracer|unpaved|tierra|rural/.test(s)) return 1.08;
  if (/track|saca.?cosecha|brecha|forestal|service/.test(s)) return 1.14;
  if (/path|trail|sendero|vereda/.test(s)) return 1.24;
  return 1.05;
};
const routeKind = p => {
  const s=routeClass(p);
  if (/terracer|gravel|unpaved|tierra/.test(s)) return 'terracería';
  if (/saca.?cosecha|track|brecha|forestal/.test(s)) return 'camino rural';
  if (/path|trail|sendero|vereda/.test(s)) return 'sendero';
  if (/street|calle|avenida|residential|primary|secondary|tertiary|carretera/.test(s)) return 'vialidad';
  return 'trazo SIG';
};
const localLineSources = () => {
  const out=[];
  S.tracks.forEach(t=>{ if(t.points?.length>1) out.push({name:t.name||'Línea',props:t.properties||{},coords:t.points.map(p=>[p[0],p[1]])}); });
  S.vectors.forEach(v=>{ const g=v.feature?.geometry, p=v.feature?.properties||{}; if(!g)return; if(g.type==='LineString')out.push({name:v.name||'Línea',props:p,coords:g.coordinates.map(c=>[c[1],c[0]])}); if(g.type==='MultiLineString')g.coordinates.forEach((r,i)=>out.push({name:(v.name||'Línea')+' '+(i+1),props:p,coords:r.map(c=>[c[1],c[0]])})); });
  return out;
};
const buildLocalGraph = () => {
  const nodes=[], byKey=new Map(), adj=[]; const endpoints=[];
  const nodeFor=(p,end=false)=>{ const key=`${Math.round(p[0]*1e5)},${Math.round(p[1]*1e5)}`; let i=byKey.get(key); if(i===undefined){i=nodes.length;byKey.set(key,i);nodes.push([p[0],p[1]]);adj.push([]);} if(end)endpoints.push(i); return i; };
  const edge=(a,b,props,name,extra=1)=>{ if(a===b)return; const d=hav(nodes[a],nodes[b]); if(!Number.isFinite(d)||d<.3)return; const f=routeFactor(props)*extra, kind=routeKind(props); adj[a].push({to:b,d,c:d*f,name,kind}); adj[b].push({to:a,d,c:d*f,name,kind}); };
  localLineSources().forEach(line=>{ const c=line.coords.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])); if(c.length<2)return; let prev=nodeFor(c[0],true); for(let i=1;i<c.length;i++){const cur=nodeFor(c[i],i===c.length-1);edge(prev,cur,line.props,line.name);prev=cur;} });
  // Une extremos casi coincidentes para tolerar redes Shape con pequeños desfases topológicos.
  const grid=new Map(), cell=.00022; const key=p=>`${Math.floor(p[0]/cell)},${Math.floor(p[1]/cell)}`;
  [...new Set(endpoints)].forEach(i=>{ const p=nodes[i], [a,b]=key(p).split(',').map(Number); for(let x=a-1;x<=a+1;x++)for(let y=b-1;y<=b+1;y++){const arr=grid.get(`${x},${y}`)||[]; for(const j of arr){const d=hav(p,nodes[j]); if(d<=18)edge(i,j,{},'Conexión topológica',1.25);} } const k=key(p); if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i); });
  return {nodes,adj};
};
class MinHeap{constructor(){this.a=[]} push(x){const a=this.a;a.push(x);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p][0]<=x[0])break;a[i]=a[p];i=p}a[i]=x} pop(){const a=this.a;if(!a.length)return null;const r=a[0],x=a.pop();if(a.length){let i=0;while(1){let l=i*2+1,rn=l+1;if(l>=a.length)break;let c=rn<a.length&&a[rn][0]<a[l][0]?rn:l;if(a[c][0]>=x[0])break;a[i]=a[c];i=c}a[i]=x}return r} get size(){return this.a.length}}
const nearestGraphNode=(g,ll)=>{let bi=-1,bd=Infinity; for(let i=0;i<g.nodes.length;i++){const d=hav([ll.lat,ll.lng],g.nodes[i]);if(d<bd){bd=d;bi=i}}return {i:bi,d:bd};};
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
const aStar=(g,start,end,penalty=new Map())=>{
  const n=g.nodes.length, dist=new Float64Array(n);dist.fill(Infinity); const prev=new Int32Array(n);prev.fill(-1); const pq=new MinHeap();dist[start]=0;pq.push([0,start]);
  while(pq.size){const [score,u]=pq.pop();const hu=hav(g.nodes[u],g.nodes[end]);if(score>dist[u]+hu+1)continue;if(u===end)break;for(const e of g.adj[u]){const nd=dist[u]+e.c*(1+(penalty.get(edgeKey(u,e.to))||0));if(nd<dist[e.to]){dist[e.to]=nd;prev[e.to]=u;pq.push([nd+hav(g.nodes[e.to],g.nodes[end]),e.to]);}}}
  if(!Number.isFinite(dist[end]))return null;const ids=[];for(let u=end;u!==-1;u=prev[u]){ids.push(u);if(u===start)break;}if(ids.at(-1)!==start)return null;ids.reverse();return {ids,cost:dist[end]};
};
const routeDistance = coords => {let d=0;for(let i=1;i<coords.length;i++)d+=hav(coords[i-1],coords[i]);return d};
const localRoutes = (from,to) => {
  const g=buildLocalGraph(); if(g.nodes.length<2)return [];
  const a=nearestGraphNode(g,from),b=nearestGraphNode(g,to); if(a.i<0||b.i<0||a.d>2200||b.d>2200)return [];
  const penalty=new Map(), out=[]; for(let k=0;k<3;k++){const r=aStar(g,a.i,b.i,penalty);if(!r)break;const core=r.ids.map(i=>g.nodes[i]);const coords=[[from.lat,from.lng],...core,[to.lat,to.lng]];const sig=r.ids.join('-');if(out.some(x=>x.sig===sig))break;const dist=routeDistance(coords), dur=dist/(25/3.6); out.push({id:'local-'+k,source:'local',label:k?'Red SIG · alternativa '+(k+1):'Red SIG local',detail:`${localLineSources().length} líneas cargadas`,coords,dist,dur,sig,snap:a.d+b.d}); for(let i=1;i<r.ids.length;i++){const ek=edgeKey(r.ids[i-1],r.ids[i]);penalty.set(ek,(penalty.get(ek)||0)+.75);} }
  return out;
};
const onlineRoutes = async (from,to) => {
  if(!navigator.onLine)return [];
  const u=`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?alternatives=3&steps=true&geometries=geojson&overview=full`;
  try{const r=await fetch(u);if(!r.ok)return[];const j=await r.json();if(j.code!=='Ok'||!j.routes?.length)return[];return j.routes.map((q,i)=>({id:'osm-'+i,source:'osm',label:i?'Calles OSM · alternativa '+(i+1):'Calles OSM',detail:i?'Ruta vial alternativa':'Ruta recomendada por la red OSM',coords:q.geometry.coordinates.map(c=>[c[1],c[0]]),dist:q.distance,dur:q.duration,steps:(�h���