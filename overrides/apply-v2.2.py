from pathlib import Path
import json,re
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'terrapin')
app=(root/'app.js').read_text()
idx=(root/'index.html').read_text()
pkg=json.loads((root/'package.json').read_text())
sw=(root/'sw.js').read_text()
readme=(root/'README.md').read_text()

# package v2.2 + GIS dependencies
pkg['version']='2.2.0'
pkg['dependencies']['shpjs']='^6.2.0'
pkg['dependencies']['@mapbox/shp-write']='^0.4.3'
pkg['dependencies']['jszip']='^3.10.1'
pkg['scripts']['prepare-www'] = "rm -rf www && mkdir www && cp index.html app.js sw.js manifest.json icon-192.png icon-512.png www/ && cp node_modules/jspdf/dist/jspdf.umd.min.js www/ && cp node_modules/shpjs/dist/shp.min.js www/ && cp node_modules/@mapbox/shp-write/shpwrite.js www/ && cp node_modules/jszip/dist/jszip.min.js www/"
(root/'package.json').write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+"\n")

# manifest version description tweaks only (manifest has no version)
manifest=json.loads((root/'manifest.json').read_text())
manifest['description']='TerraPin 2.2 — mapas sin conexión, rutas GPS, capas Shape y exportación GIS.'
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")

# Service worker shell local GIS libs, cache bump
sw=sw.replace("terrapin-shell-v2.1","terrapin-shell-v2.2")
sw=sw.replace("'./jspdf.umd.min.js',", "'./jspdf.umd.min.js', './shp.min.js', './shpwrite.js', './jszip.min.js',")
(root/'sw.js').write_text(sw)

# Modern CSS overrides and local scripts / file input
modern_css=r'''
/* ---------- TerraPin 2.2 · interfaz moderna ---------- */
:root{
  --glass:rgba(255,255,255,.86);--glass2:rgba(255,255,255,.68);
  --shadow-xl:0 22px 60px rgba(18,52,44,.18);--shadow-soft:0 10px 30px rgba(18,52,44,.12);
  --radius-xl:26px;--radius-lg:20px;
}
[data-theme="dark"]{--glass:rgba(26,43,37,.88);--glass2:rgba(26,43,37,.72);--shadow-xl:0 22px 60px rgba(0,0,0,.38);--shadow-soft:0 10px 30px rgba(0,0,0,.26)}
.topbar{top:max(10px,env(safe-area-inset-top));left:10px;right:10px;padding:8px 10px;border:1px solid rgba(255,255,255,.35);border-radius:22px;background:var(--glass);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);box-shadow:var(--shadow-soft)}
.brand{padding:2px 5px}.brand .logo{width:38px;height:38px;border-radius:13px;box-shadow:0 5px 15px rgba(31,122,109,.24)}.brand b{font-size:17px;letter-spacing:-.35px}
.search{height:42px;border-radius:15px;background:var(--panel2);border:1px solid var(--line);box-shadow:inset 0 1px rgba(255,255,255,.5)}.search input{font-size:14px}
.iconbtn{border:1px solid rgba(255,255,255,.45);background:var(--glass);backdrop-filter:blur(16px);box-shadow:var(--shadow-soft);transition:transform .18s ease,box-shadow .18s ease,background .18s ease}.iconbtn:active{transform:scale(.92)}
.fabcol{right:12px;gap:10px}.fabcol .iconbtn{width:48px;height:48px;border-radius:17px}
.nav{left:10px;right:10px;bottom:max(10px,env(safe-area-inset-bottom));height:68px;border:1px solid rgba(255,255,255,.34);border-radius:23px;background:var(--glass);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);box-shadow:var(--shadow-xl);padding:7px 6px}
.nav button{border-radius:17px;font-size:10px;gap:3px;transition:.2s ease}.nav button svg{width:21px;height:21px}.nav button.active{background:linear-gradient(145deg,var(--teal),#25998a);color:#fff;box-shadow:0 8px 20px rgba(31,122,109,.28)}
.sheet{left:8px;right:8px;bottom:86px;border-radius:28px 28px 22px 22px;border:1px solid rgba(255,255,255,.32);background:var(--glass);backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%);box-shadow:var(--shadow-xl);overflow:hidden}.sheet header{padding:5px 18px 13px}.sheet .body{padding:4px 14px 20px}.sheet .grab{width:48px;height:5px;border-radius:10px;margin:9px auto;background:var(--line)}
.card,.item,.folder,.empty{border:1px solid var(--line);box-shadow:0 7px 22px rgba(21,62,52,.07)}.card{border-radius:20px;padding:15px;background:linear-gradient(145deg,var(--panel),var(--panel2))}.item{border-radius:17px;margin-bottom:7px;padding:11px 12px;background:var(--panel)}.item.sel{border-color:rgba(31,122,109,.42);box-shadow:0 8px 24px rgba(31,122,109,.14);background:linear-gradient(145deg,var(--tealSoft),var(--panel))}
.folder{border-radius:20px;overflow:hidden;margin-bottom:10px}.fhead{padding:13px 12px;background:linear-gradient(145deg,var(--panel),var(--panel2))}.fbody{padding:7px}
.btn{border-radius:15px;font-weight:750;letter-spacing:-.12px;box-shadow:0 6px 16px rgba(31,122,109,.14);transition:.18s ease}.btn:not(.ghost):not(.danger){background:linear-gradient(145deg,var(--teal),#249887)}.btn.ghost{background:var(--panel);border:1px solid var(--line);box-shadow:none}.btn:active{transform:scale(.97)}
.modal{backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.modal .box{border-radius:26px;border:1px solid rgba(255,255,255,.32);box-shadow:var(--shadow-xl);background:var(--panel);padding:20px}.modal h3{font-size:21px;letter-spacing:-.5px;margin-top:0}
.field input,.field select,.field textarea{border-radius:14px;border:1px solid var(--line);background:var(--panel2);padding:12px 13px}.basegrid button{border-radius:16px;padding:12px}.basegrid button.active{box-shadow:0 7px 20px rgba(31,122,109,.16)}
.recbar{left:12px;right:12px;border-radius:22px;background:var(--glass);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.34);box-shadow:var(--shadow-soft)}
.gis-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.gis-actions .btn{width:100%}.format-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;background:var(--tealSoft);color:var(--teal);font-size:11px;font-weight:800}.vector-badge{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:rgba(155,81,224,.12);color:#8a43d6;font-size:10px;font-weight:800;margin-left:5px}.import-note{padding:11px 12px;border-radius:15px;background:var(--tealSoft);color:var(--ink2);font-size:12px;line-height:1.45;margin:8px 0 12px}.import-note b{color:var(--teal)}
@media(min-width:700px){.topbar{left:18px;right:18px}.nav{left:50%;right:auto;transform:translateX(-50%);width:min(650px,calc(100vw - 36px))}.sheet{left:50%;right:auto;transform:translateX(-50%) translateY(115%);width:min(680px,calc(100vw - 24px))}.sheet.open{transform:translateX(-50%) translateY(0)}.gis-actions{grid-template-columns:repeat(4,minmax(0,1fr))}}
'''
idx=idx.replace('</style>',modern_css+'\n</style>')
idx=idx.replace('<input type="file" id="fileIn" accept=".gpx,.geojson,.json,.kml" hidden>', '<input type="file" id="fileIn" accept=".gpx,.geojson,.json,.kml,.kmz,.zip,.shp,.shx,.dbf,.prj,.cpg" multiple hidden>')
idx=idx.replace('<script src="jspdf.umd.min.js"></script>\n<script src="app.js"></script>', '<script src="jspdf.umd.min.js"></script>\n<script src="shp.min.js"></script>\n<script src="shpwrite.js"></script>\n<script src="jszip.min.js"></script>\n<script src="app.js"></script>')
(root/'index.html').write_text(idx)

# State/save vectors
old="folders: [], projects: [], waypoints: [], tracks: [], packs: [],\n  layers: {}, trackLayers: {}, wpLayers: {}, panes: {},"
new="folders: [], projects: [], waypoints: [], tracks: [], vectors: [], packs: [],\n  layers: {}, trackLayers: {}, vectorLayers: {}, wpLayers: {}, panes: {},"
assert old in app
app=app.replace(old,new)
app=app.replace("const save = () => Promise.all([kvSet('settings', S.settings), kvSet('folders', S.folders), kvSet('projects', S.projects), kvSet('waypoints', S.waypoints)]);", "const save = () => Promise.all([kvSet('settings', S.settings), kvSet('folders', S.folders), kvSet('projects', S.projects), kvSet('waypoints', S.waypoints), kvSet('vectors', S.vectors)]);")

# sync order vectors
app=app.replace("...S.tracks.map(t => 'tr:' + t.id)]);", "...S.tracks.map(t => 'tr:' + t.id), ...S.vectors.map(v => 'vec:' + v.id)]);")

# Insert vector drawing before routes section
marker='/* ---------- rutas en mapa ---------- */'
vector_code=r'''
/* ---------- capas vectoriales importadas (Shape/GeoJSON) ---------- */
const vectorGeomLabel = g => ({ Polygon:'Polígono', MultiPolygon:'Multipolígono', LineString:'Línea', MultiLineString:'Multilínea', Point:'Punto', MultiPoint:'Multipunto' }[g?.type] || g?.type || 'Vector');
const vectorName = (feature, fallback='Capa vectorial') => {
  const p = feature?.properties || {};
  return p.name || p.nombre || p.NAME || p.NOMBRE || p.Name || fallback;
};
const vectorPopup = v => {
  const p = v.feature?.properties || {};
  const rows = Object.entries(p).filter(([,x]) => x !== null && x !== undefined && String(x).trim() !== '').slice(0,10).map(([k,x]) => `<div><b>${esc(k)}:</b> ${esc(x)}</div>`).join('');
  return `<div style="min-width:190px"><b>${esc(v.name || vectorName(v.feature))}</b><div class="muted" style="margin:4px 0 7px">${esc(vectorGeomLabel(v.feature?.geometry))}</div>${rows || '<span class="muted">Sin atributos</span>'}</div>`;
};
const drawVector = v => {
  if (S.vectorLayers[v.id]) map.removeLayer(S.vectorLayers[v.id]);
  if (v.visible === false || !v.feature?.geometry) { delete S.vectorLayers[v.id]; return; }
  const key='vec:'+v.id; getPane(key);
  const color=v.color || '#9B51E0'; const opacity=S.settings.opacity[key] ?? 0.82;
  const layer=L.geoJSON(v.feature, {
    pane:'p_'+key,
    style: () => ({color,weight:4,opacity,fillColor:color,fillOpacity:Math.min(.22,opacity*.28)}),
    pointToLayer:(ft,ll)=>L.circleMarker(ll,{pane:'p_'+key,radius:7,color:'#fff',weight:2,fillColor:color,fillOpacity:opacity})
  });
  layer.bindPopup(vectorPopup(v)); layer.addTo(map); S.vectorLayers[v.id]=layer;
};
const addVectorFeature = (feature, projectId, sourceName='Shape') => {
  if (!feature?.geometry) return null;
  const v={id:uid(),projectId:projectId||null,name:vectorName(feature,sourceName),source:sourceName,color:COLORS[(S.vectors.length+3)%COLORS.length],visible:true,feature:JSON.parse(JSON.stringify(feature))};
  S.vectors.push(v); drawVector(v); return v;
};
'''
assert marker in app
app=app.replace(marker,vector_code+'\n'+marker)

# Replace toGeoJSON to merge props and vectors add GIS exporters before download
pat=r"const toGeoJSON = \(tracks, wps\) => \(\{ type: 'FeatureCollection', features: \[\.\.\.tracks\.map\(t => \(\{ type: 'Feature'.*?\}\)\)\] \}\);\nconst download ="
m=re.search(pat,app,re.S)
if not m:
    raise SystemExit('toGeoJSON block not found')
newblock=r'''const toGeoJSON = (tracks, wps, vectors = []) => ({ type: 'FeatureCollection', features: [
  ...tracks.map(t => ({ type:'Feature', properties:{ ...(t.properties || {}), name:t.name, color:t.color, created:t.created, terrapin:'route' }, geometry:{ type:'LineString', coordinates:t.points.map(p => p[2] != null ? [p[1],p[0],p[2]] : [p[1],p[0]]) } })),
  ...wps.map(w => ({ type:'Feature', properties:{ ...(w.properties || {}), name:w.name, notes:w.notes, icon:w.icon || 'pin', terrapin:'waypoint' }, geometry:{ type:'Point', coordinates:[w.lng,w.lat] } })),
  ...vectors.map(v => ({ ...JSON.parse(JSON.stringify(v.feature)), properties:{ ...(v.feature?.properties || {}), name:v.name || vectorName(v.feature), terrapin:'vector' } }))
] });
const safeGisFile = s => String(s || 'terrapin').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60) || 'terrapin';
const xml = s => esc(s).replace(/&#39;/g,'&apos;');
const projectGeoJSON = projectId => {
  const tracks = projectId ? S.tracks.filter(t => t.projectId === projectId) : S.tracks;
  const wps = projectId ? S.waypoints.filter(w => w.projectId === projectId) : S.waypoints;
  const vectors = projectId ? S.vectors.filter(v => v.projectId === projectId) : S.vectors;
  return toGeoJSON(tracks,wps,vectors);
};
const geomKml = g => {
  if (!g) return '';
  const coords = a => a.map(c => `${c[0]},${c[1]}${c[2] != null ? ','+c[2] : ''}`).join(' ');
  if (g.type === 'Point') return `<Point><coordinates>${coords([g.coordinates])}</coordinates></Point>`;
  if (g.type === 'LineString') return `<LineString><tessellate>1</tessellate><coordinates>${coords(g.coordinates)}</coordinates></LineString>`;
  if (g.type === 'Polygon') return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(g.coordinates[0] || [])}</coordinates></LinearRing></outerBoundaryIs>${(g.coordinates || []).slice(1).map(r => `<innerBoundaryIs><LinearRing><coordinates>${coords(r)}</coordinates></LinearRing></innerBoundaryIs>`).join('')}</Polygon>`;
  if (g.type === 'MultiPoint') return `<MultiGeometry>${g.coordinates.map(c => geomKml({type:'Point',coordinates:c})).join('')}</MultiGeometry>`;
  if (g.type === 'MultiLineString') return `<MultiGeometry>${g.coordinates.map(c => geomKml({type:'LineString',coordinates:c})).join('')}</MultiGeometry>`;
  if (g.type === 'MultiPolygon') return `<MultiGeometry>${g.coordinates.map(c => geomKml({type:'Polygon',coordinates:c})).join('')}</MultiGeometry>`;
  return '';
};
const toKML = (gj,title='TerraPin') => `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(title)}</name>${gj.features.map((f,i) => { const p=f.properties||{}; const ext=Object.entries(p).filter(([k,v])=>!['name','color'].includes(k)&&v!=null).map(([k,v])=>`<Data name="${xml(k)}"><value>${xml(v)}</value></Data>`).join(''); return `<Placemark><name>${xml(p.name || 'Elemento '+(i+1))}</name>${p.color ? `<Style><LineStyle><color>ff${String(p.color).replace('#','').match(/../g)?.reverse().join('') || '6d7a1f'}</color><width>4</width></LineStyle></Style>`:''}${ext?`<ExtendedData>${ext}</ExtendedData>`:''}${geomKml(f.geometry)}</Placemark>`; }).join('')}</Document></kml>`;
const downloadBlob = (name, blob) => { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1600); };
const exportProjectKML = projectId => { const p=S.projects.find(x=>x.id===projectId); const n=p?.name || 'TerraPin'; download(n+'.kml',toKML(projectGeoJSON(projectId),n),'application/vnd.google-earth.kml+xml'); };
const exportProjectKMZ = async projectId => { if (!window.JSZip) return toast('Componente KMZ no disponible'); const p=S.projects.find(x=>x.id===projectId); const n=p?.name || 'TerraPin'; const z=new JSZip(); z.file('doc.kml',toKML(projectGeoJSON(projectId),n)); const blob=await z.generateAsync({type:'blob',compression:'DEFLATE'}); downloadBlob(n+'.kmz',blob); toast('KMZ generado'); };
const exportProjectShape = async projectId => { if (!window.shpwrite) return toast('Componente Shape no disponible'); const p=S.projects.find(x=>x.id===projectId); const n=p?.name || 'TerraPin'; const gj=projectGeoJSON(projectId); if (!gj.features.length) return toast('El proyecto no tiene geometrías'); try { const out=await window.shpwrite.zip(gj,{folder:safeGisFile(n),filename:safeGisFile(n),outputType:'blob',types:{point:'puntos',polyline:'lineas',polygon:'poligonos'}}); const blob=out instanceof Blob?out:new Blob([out],{type:'application/zip'}); downloadBlob(n+'-shape.zip',blob); toast('Shape generado'); } catch(err){ console.error(err); toast('No se pudo generar el Shape'); } };
'''
app=app[:m.start()]+newblock+app[m.end()-len('const download ='):]

# Replace import block through projects marker
start=app.index('/* importar GPX / GeoJSON / KML */')
end=app.index('/* ---------- proyectos ---------- */', start)
import_code=r'''/* importar GPX / GeoJSON / KML / KMZ / Shape */
const featureTitle = (ft,fallback='Elemento') => { const p=ft?.properties||{}; return p.name || p.nombre || p.NAME || p.NOMBRE || p.Name || fallback; };
const importFeatureCollection = async (input, pid, sourceName='Importación') => {
  const collections = Array.isArray(input) ? input : [input]; let added=0, vectors=0;
  const addTrack = async (name, pts, properties={}) => { if (pts.length < 2) return; const t={id:uid(),name:name||sourceName,projectId:pid,color:COLORS[S.tracks.length%COLORS.length],points:pts,created:Date.now(),visible:true,properties}; await putTrack(t); S.tracks.push(t); drawTrack(t); added++; };
  for (const g of collections) {
    const feats = g?.type === 'FeatureCollection' ? g.features : (g?.type === 'Feature' ? [g] : []);
    for (const ft of feats) {
      const geo=ft.geometry; if (!geo) continue; const props=ft.properties||{}; const name=featureTitle(ft,sourceName); const stamp=Date.now();
      if (geo.type==='Point') { S.waypoints.push({id:uid(),lat:geo.coordinates[1],lng:geo.coordinates[0],name,notes:props.notes||props.descripcion||props.DESCRIPCIO||'',icon:props.icon||'pin',projectId:pid,properties:props}); added++; }
      else if (geo.type==='MultiPoint') { geo.coordinates.forEach((c,i)=>S.waypoints.push({id:uid(),lat:c[1],lng:c[0],name:`${name} ${i+1}`,notes:'',icon:'pin',projectId:pid,properties:props})); added+=geo.coordinates.length; }
      else if (geo.type==='LineString') await addTrack(name,geo.coordinates.map(c=>[c[1],c[0],c[2]??null,stamp]),props);
      else if (geo.type==='MultiLineString') { for (let i=0;i<geo.coordinates.length;i++) await addTrack(geo.coordinates.length>1?`${name} ${i+1}`:name,geo.coordinates[i].map(c=>[c[1],c[0],c[2]??null,stamp]),props); }
      else if (geo.type==='Polygon' || geo.type==='MultiPolygon') { addVectorFeature(ft,pid,sourceName); vectors++; }
      else { addVectorFeature(ft,pid,sourceName); vectors++; }
    }
  }
  await save(); drawWaypoints(); syncOrder(); renderSheet();
  return {added,vectors};
};
const importShapeFiles = async files => {
  if (!window.shp) throw new Error('shpjs no disponible');
  const pid=S.settings.activeProject; let total=0, vectors=0;
  const zips=files.filter(f=>/\.zip$/i.test(f.name));
  for (const z of zips) { const gj=await window.shp(await z.arrayBuffer()); const r=await importFeatureCollection(gj,pid,z.name.replace(/\.zip$/i,'')); total+=r.added; vectors+=r.vectors; }
  const shpFiles=files.filter(f=>/\.shp$/i.test(f.name));
  for (const sf of shpFiles) {
    const base=sf.name.replace(/\.shp$/i,'').toLowerCase(); const pick=ext=>files.find(x=>x.name.replace(/\.[^.]+$/,'').toLowerCase()===base && new RegExp('\\.'+ext+'$','i').test(x.name));
    const dbf=pick('dbf'),prj=pick('prj'),cpg=pick('cpg');
    const obj={shp:await sf.arrayBuffer()}; if(dbf)obj.dbf=await dbf.arrayBuffer(); if(prj)obj.prj=await prj.text(); if(cpg)obj.cpg=await cpg.text();
    const gj=await window.shp(obj); const r=await importFeatureCollection(gj,pid,sf.name.replace(/\.shp$/i,'')); total+=r.added; vectors+=r.vectors;
  }
  return {added:total,vectors};
};
$('#fileIn').onchange = async e => {
  const files=[...e.target.files]; if(!files.length)return; const pid=S.settings.activeProject;
  try {
    if (files.some(f=>/\.(zip|shp)$/i.test(f.name))) {
      const r=await importShapeFiles(files); toast(`Shape importado: ${r.added} elemento(s)${r.vectors ? ` · ${r.vectors} polígono(s)` : ''}`);
    } else {
      for (const f of files) {
        if (/\.kmz$/i.test(f.name)) { if(!window.JSZip) throw new Error('JSZip no disponible'); const z=await JSZip.loadAsync(await f.arrayBuffer()); const entry=Object.values(z.files).find(x=>/\.kml$/i.test(x.name)); if(!entry) throw new Error('KMZ sin KML'); const txt=await entry.async('text'); const x=new DOMParser().parseFromString(txt,'application/xml'); const feats=[]; for(const pm of x.getElementsByTagName('Placemark')){const ls=pm.getElementsByTagName('LineString')[0],pt=pm.getElementsByTagName('Point')[0],poly=pm.getElementsByTagName('Polygon')[0],name=pm.getElementsByTagName('name')[0]?.textContent||f.name;if(ls){const c=ls.getElementsByTagName('coordinates')[0]?.textContent.trim().split(/\s+/).map(v=>v.split(',').map(Number))||[];feats.push({type:'Feature',properties:{name},geometry:{type:'LineString',coordinates:c}})}else if(pt){const c=pt.getElementsByTagName('coordinates')[0]?.textContent.trim().split(',').map(Number)||[];feats.push({type:'Feature',properties:{name},geometry:{type:'Point',coordinates:c}})}else if(poly){const rings=[...poly.getElementsByTagName('LinearRing')].map(r=>(r.getElementsByTagName('coordinates')[0]?.textContent.trim().split(/\s+/).map(v=>v.split(',').map(Number))||[]));feats.push({type:'Feature',properties:{name},geometry:{type:'Polygon',coordinates:rings}})}} await importFeatureCollection({type:'FeatureCollection',features:feats},pid,f.name); continue; }
        const txt=await f.text();
        if (/\.(gpx|kml)$/i.test(f.name)) {
          const x=new DOMParser().parseFromString(txt,'application/xml'); const feats=[];
          if(/\.gpx$/i.test(f.name)){
            for(const trk of x.getElementsByTagName('trk')){const pts=[...trk.getElementsByTagName('trkpt')].map(p=>[+p.getAttribute('lon'),+p.getAttribute('lat'),p.getElementsByTagName('ele')[0]?+p.getElementsByTagName('ele')[0].textContent:null]);feats.push({type:'Feature',properties:{name:trk.getElementsByTagName('name')[0]?.textContent||f.name},geometry:{type:'LineString',coordinates:pts}})}
            for(const w of x.getElementsByTagName('wpt')) feats.push({type:'Feature',properties:{name:w.getElementsByTagName('name')[0]?.textContent||'Punto',notes:w.getElementsByTagName('desc')[0]?.textContent||''},geometry:{type:'Point',coordinates:[+w.getAttribute('lon'),+w.getAttribute('lat')]}});
          } else {
            for(const pm of x.getElementsByTagName('Placemark')){const ls=pm.getElementsByTagName('LineString')[0],pt=pm.getElementsByTagName('Point')[0],poly=pm.getElementsByTagName('Polygon')[0],name=pm.getElementsByTagName('name')[0]?.textContent||f.name;if(ls){const c=ls.getElementsByTagName('coordinates')[0]?.textContent.trim().split(/\s+/).map(v=>v.split(',').map(Number))||[];feats.push({type:'Feature',properties:{name},geometry:{type:'LineString',coordinates:c}})}else if(pt){const c=pt.getElementsByTagName('coordinates')[0]?.textContent.trim().split(',').map(Number)||[];feats.push({type:'Feature',properties:{name},geometry:{type:'Point',coordinates:c}})}else if(poly){const rings=[...poly.getElementsByTagName('LinearRing')].map(r=>(r.getElementsByTagName('coordinates')[0]?.textContent.trim().split(/\s+/).map(v=>v.split(',').map(Number))||[]));feats.push({type:'Feature',properties:{name},geometry:{type:'Polygon',coordinates:rings}})}}
          }
          await importFeatureCollection({type:'FeatureCollection',features:feats},pid,f.name);
        } else { const g=JSON.parse(txt); await importFeatureCollection(g,pid,f.name); }
      }
      toast('Importación completada');
    }
  } catch(err){ console.error(err); toast('No se pudo importar: revisa el archivo Shape/ZIP y su proyección'); }
  finally { e.target.value=''; }
};

'''
app=app[:start]+import_code+app[end:]

# Project counts/vector export modal/buttons
app=app.replace("const nt = S.tracks.filter(t => t.projectId === p.id).length, nw = S.waypoints.filter(w => w.projectId === p.id).length; return `<div class=\"item ${p.id === S.settings.activeProject ? 'sel' : ''}\" data-proj=\"${p.id}\"><div class=\"grow\"><div class=\"ttl\">${esc(p.name)}</div><div class=\"sub\">${nt} ruta(s) · ${nw} punto(s)${p.id === S.settings.activeProject ? ' · activo' : ''}</div></div><button class=\"mini\" data-pmenu=\"${p.id}\">${ICON.more}</button></div>`;",
"const nt = S.tracks.filter(t => t.projectId === p.id).length, nw = S.waypoints.filter(w => w.projectId === p.id).length, nv=S.vectors.filter(v=>v.projectId===p.id).length; return `<div class=\"item ${p.id === S.settings.activeProject ? 'sel' : ''}\" data-proj=\"${p.id}\"><div class=\"grow\"><div class=\"ttl\">${esc(p.name)}${nv?`<span class=\"vector-badge\">GIS ${nv}</span>`:''}</div><div class=\"sub\">${nt} ruta(s) · ${nw} punto(s)${nv?` · ${nv} capa(s)`:''}${p.id === S.settings.activeProject ? ' · activo' : ''}</div></div><button class=\"mini\" data-pmenu=\"${p.id}\">${ICON.more}</button></div>`;")
app=app.replace('Importar GPX/KML</button>', 'Importar GIS</button>')

oldmodal='<div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn sm ghost" id="epGpx">Exportar proyecto (GPX)</button><button class="btn sm ghost" id="epPdf">Generar PDF</button><button class="btn sm ghost" id="epPrint">Imprimir</button></div>'
newmodal='<div class="import-note"><b>Exportación GIS</b><br>El proyecto puede salir como GPX, KML, KMZ o Shape ZIP conservando rutas, puntos y capas vectoriales.</div><div class="gis-actions"><button class="btn sm ghost" id="epGpx">GPX</button><button class="btn sm ghost" id="epKml">KML</button><button class="btn sm ghost" id="epKmz">KMZ</button><button class="btn sm ghost" id="epShp">Shape</button></div><div class="gis-actions" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button class="btn sm" id="epPdf">Generar PDF</button><button class="btn sm ghost" id="epPrint">Imprimir</button></div>'
assert oldmodal in app
app=app.replace(oldmodal,newmodal)
app=app.replace("$('#epGpx').onclick = () => download(p.name + '.gpx', toGPX(S.tracks.filter(t => t.projectId === p.id), S.waypoints.filter(w => w.projectId === p.id)), 'application/gpx+xml'); $('#epPdf').onclick",
"$('#epGpx').onclick = () => download(p.name + '.gpx', toGPX(S.tracks.filter(t => t.projectId === p.id), S.waypoints.filter(w => w.projectId === p.id)), 'application/gpx+xml'); $('#epKml').onclick=()=>exportProjectKML(p.id); $('#epKmz').onclick=()=>exportProjectKMZ(p.id); $('#epShp').onclick=()=>exportProjectShape(p.id); $('#epPdf').onclick")
# project delete vectors
app=app.replace("S.waypoints = S.waypoints.filter(w => w.projectId !== p.id); S.projects = S.projects.filter", "S.waypoints = S.waypoints.filter(w => w.projectId !== p.id); S.vectors.filter(v=>v.projectId===p.id).forEach(v=>{if(S.vectorLayers[v.id])map.removeLayer(S.vectorLayers[v.id]);delete S.vectorLayers[v.id];}); S.vectors = S.vectors.filter(v=>v.projectId!==p.id); S.projects = S.projects.filter")

# project centering include vector bounds
oldcenter="const ts = S.tracks.filter(t => t.projectId === el.dataset.proj && S.trackLayers[t.id]); if (ts.length) { const bb = L.latLngBounds([]); ts.forEach(t => bb.extend(S.trackLayers[t.id].getBounds())); map.fitBounds(bb, { padding: [40, 40] }); }"
newcenter="const ts = S.tracks.filter(t => t.projectId === el.dataset.proj && S.trackLayers[t.id]); const vs=S.vectors.filter(v=>v.projectId===el.dataset.proj && S.vectorLayers[v.id]); if (ts.length||vs.length) { const bb = L.latLngBounds([]); ts.forEach(t => bb.extend(S.trackLayers[t.id].getBounds())); vs.forEach(v=>{const b=S.vectorLayers[v.id].getBounds?.();if(b?.isValid?.())bb.extend(b);}); if(bb.isValid())map.fitBounds(bb, { padding: [40, 40] }); }"
assert oldcenter in app
app=app.replace(oldcenter,newcenter)

# Layer handling vectors
old="else if (id.startsWith('ov:')) { const k = id.slice(3); name = SOURCES[k].name; on = !!S.settings.overlays[k]; kind = 'ov'; }\n      else { const t = S.tracks.find(t => 'tr:' + t.id === id); if (!t) return ''; name = t.name; color = t.color; on = t.visible !== false; kind = 'tr'; }"
new="else if (id.startsWith('ov:')) { const k = id.slice(3); name = SOURCES[k].name; on = !!S.settings.overlays[k]; kind = 'ov'; }\n      else if (id.startsWith('vec:')) { const v=S.vectors.find(v=>'vec:'+v.id===id); if(!v)return ''; name=v.name || vectorName(v.feature); color=v.color; on=v.visible!==false; kind='vec'; }\n      else { const t = S.tracks.find(t => 'tr:' + t.id === id); if (!t) return ''; name = t.name; color = t.color; on = t.visible !== false; kind = 'tr'; }"
assert old in app
app=app.replace(old,new)
app=app.replace("const apply = () => { if (id === 'wp') drawWaypoints(); else if (id.startsWith('ov:')) overlayLayer(id.slice(3)); else { const t = S.tracks.find(t => 'tr:' + t.id === id); drawTrack(t); } };", "const apply = () => { if (id === 'wp') drawWaypoints(); else if (id.startsWith('ov:')) overlayLayer(id.slice(3)); else if(id.startsWith('vec:')) { const v=S.vectors.find(v=>'vec:'+v.id===id); if(v)drawVector(v); } else { const t = S.tracks.find(t => 'tr:' + t.id === id); drawTrack(t); } };")
app=app.replace("else if (id.startsWith('ov:')) S.settings.overlays[id.slice(3)] = !S.settings.overlays[id.slice(3)]; else { const t = S.tracks.find(t => 'tr:' + t.id === id); t.visible = t.visible === false; await putTrack(t); }", "else if (id.startsWith('ov:')) S.settings.overlays[id.slice(3)] = !S.settings.overlays[id.slice(3)]; else if(id.startsWith('vec:')) { const v=S.vectors.find(v=>'vec:'+v.id===id); if(v)v.visible=v.visible===false; } else { const t = S.tracks.find(t => 'tr:' + t.id === id); t.visible = t.visible === false; await putTrack(t); }")

# Tracks import button label
app=app.replace('>Importar</button><button class="btn sm ghost" id="tExportAll"', '>Importar GIS</button><button class="btn sm ghost" id="tExportAll"')

# More page backup and about version + GIS export general card
app=app.replace("JSON.stringify({ v: 1, folders: S.folders, projects: S.projects, waypoints: S.waypoints, tracks: S.tracks, settings: S.settings })", "JSON.stringify({ v: 2, folders: S.folders, projects: S.projects, waypoints: S.waypoints, tracks: S.tracks, vectors:S.vectors, settings: S.settings })")
app=app.replace("S.waypoints = j.waypoints || []; for (const t of j.tracks || [])", "S.waypoints = j.waypoints || []; S.vectors=j.vectors||[]; for (const t of j.tracks || [])")
app=app.replace("S.tracks.forEach(drawTrack); drawWaypoints(); renderSheet(); toast('Respaldo restaurado');", "S.tracks.forEach(drawTrack); S.vectors.forEach(drawVector); drawWaypoints(); renderSheet(); toast('Respaldo restaurado');")
app=app.replace('TerraPin</b> <span class="muted">v2.1</span>', 'TerraPin</b> <span class="muted">v2.2</span>')
# Insert GIS card before report general in More
needle='<div class="card"><b>Reporte general</b><div class="muted">Genera un informe moderno con croquis, rutas, métricas y puntos de campo.</div>'
if needle in app:
    app=app.replace(needle,'<div class="card"><b>Intercambio GIS</b><div class="muted">Importa Shape/KML/KMZ/GPX/GeoJSON y exporta toda la información en formatos GIS.</div><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm ghost" id="mImportGis">Importar GIS</button><button class="btn sm ghost" id="mKml">KML</button><button class="btn sm ghost" id="mKmz">KMZ</button><button class="btn sm ghost" id="mShp">Shape</button></div></div>'+needle)
    app=app.replace("$('#mPdf').onclick = () => shareOrDownloadPdf(null); $('#mPrint').onclick = () => printReport(null);", "$('#mImportGis').onclick=()=>$('#fileIn').click(); $('#mKml').onclick=()=>exportProjectKML(null); $('#mKmz').onclick=()=>exportProjectKMZ(null); $('#mShp').onclick=()=>exportProjectShape(null); $('#mPdf').onclick = () => shareOrDownloadPdf(null); $('#mPrint').onclick = () => printReport(null);")

# Init load/draw vectors
app=app.replace("S.folders = await kvGet('folders', []); S.projects = await kvGet('projects', []); S.waypoints = await kvGet('waypoints', []);", "S.folders = await kvGet('folders', []); S.projects = await kvGet('projects', []); S.waypoints = await kvGet('waypoints', []); S.vectors=await kvGet('vectors', []);")
app=app.replace("S.tracks.forEach(drawTrack); drawWaypoints();", "S.tracks.forEach(drawTrack); S.vectors.forEach(drawVector); drawWaypoints();",1)
app=app.replace("if (!S.projects.length && !S.tracks.length)", "if (!S.projects.length && !S.tracks.length && !S.vectors.length)")

# fix report Scope optionally vectors? keep report route/points design; add count via no change

# Version comment / readme
app=app.replace('TerraPin — mapas sin conexión, rutas GPS y proyectos','TerraPin 2.2 — mapas sin conexión, rutas GPS, Shape y proyectos')
(root/'app.js').write_text(app)

readme=readme.replace('TerraPin 2.1','TerraPin 2.2').replace('v2.1','v2.2')
readme += '\n\n## GIS en TerraPin 2.2\n\n- Importación de Shapefile desde ZIP o selección conjunta de SHP/SHX/DBF/PRJ/CPG.\n- Importación de KML, KMZ, GPX y GeoJSON.\n- Exportación por proyecto a GPX, KML, KMZ y Shapefile ZIP.\n- Las capas poligonales importadas conservan su geometría y atributos como capas vectoriales.\n- Las dependencias GIS se integran dentro del APK para trabajar sin conexión una vez instalada la aplicación.\n'
(root/'README.md').write_text(readme)
print('patched',len(app),len(idx))