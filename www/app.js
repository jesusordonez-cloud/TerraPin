/* TerraPin 4.0 · Obsidian Glass — SIG móvil de campo, satélite en vivo, navegación híbrida, mapas offline y proyectos
   Desarrollada por Jesús Reynaldo Ordoñez Pech */
(() => {
'use strict';

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const R = 6371000;
const hav = (a, b) => {
  const toR = d => d * Math.PI / 180;
  const dLat = toR(b[0] - a[0]), dLng = toR(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const fmtDist = m => m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m';
const fmtTime = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
const fmtBytes = b => b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB';
const fmtDate = t => new Date(t).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let toastT;
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); };
const ICON = {
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 13.4 13.4M9.9 5.2A10 10 0 0 1 22 12s-1.3 2.3-3.6 4.2M6.6 6.6C3.7 8.4 2 12 2 12s4 7 10 7c1.5 0 2.9-.3 4.1-.8"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 10 6 6 6-6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  center: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>'
};
const COLORS = ['#E4572E', '#1F7A6D', '#2F80ED', '#E3A008', '#9B51E0', '#EB5757', '#27AE60', '#1B2A24'];
const POINT_ICONS = [
  { id: 'pin', label: 'Punto', symbol: '●' },
  { id: 'tree', label: 'Árbol', symbol: '🌳' },
  { id: 'forest', label: 'Bosque', symbol: '🌲' },
  { id: 'water', label: 'Agua', symbol: '💧' },
  { id: 'camera', label: 'Foto', symbol: '📷' },
  { id: 'house', label: 'Sitio', symbol: '🏠' },
  { id: 'camp', label: 'Campamento', symbol: '⛺' },
  { id: 'vehicle', label: 'Vehículo', symbol: '🚙' },
  { id: 'trail', label: 'Camino', symbol: '🥾' },
  { id: 'wildlife', label: 'Fauna', symbol: '🐾' },
  { id: 'warning', label: 'Alerta', symbol: '⚠️' },
  { id: 'check', label: 'Revisado', symbol: '✓' }
];
const pointIconDef = id => POINT_ICONS.find(x => x.id === id) || POINT_ICONS[0];


/* ---------- IndexedDB ---------- */
let db;
const openDB = () => new Promise((res, rej) => {
  const r = indexedDB.open('terrapin', 1);
  r.onupgradeneeded = e => {
    const d = e.target.result;
    d.createObjectStore('tiles');
    d.createObjectStore('kv');
    d.createObjectStore('tracks', { keyPath: 'id' });
    d.createObjectStore('packs', { keyPath: 'id' });
  };
  r.onsuccess = e => res(e.target.result);
  r.onerror = e => rej(e.target.error);
});
const tx = (store, mode, fn) => new Promise((res, rej) => {
  const t = db.transaction(store, mode); const s = t.objectStore(store); const out = fn(s);
  t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out);
  t.onerror = e => rej(e.target.error); t.onabort = e => rej(e.target.error);
});
const kvGet = (k, def) => tx('kv', 'readonly', s => s.get(k)).then(v => v === undefined ? def : v);
const kvSet = (k, v) => tx('kv', 'readwrite', s => s.put(v, k));
const tileGet = k => new Promise(res => { const r = db.transaction('tiles').objectStore('tiles').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
const tilesPut = entries => tx('tiles', 'readwrite', s => entries.forEach(([k, v]) => s.put(v, k)));
const tilesDeletePrefix = prefix => tx('tiles', 'readwrite', s => s.delete(IDBKeyRange.bound(prefix, prefix + '\uffff')));
const tileKeys = prefix => tx('tiles', 'readonly', s => s.getAllKeys(IDBKeyRange.bound(prefix, prefix + '\uffff')));
const allTracks = () => tx('tracks', 'readonly', s => s.getAll());
const putTrack = t => tx('tracks', 'readwrite', s => s.put(t));
const delTrack = id => tx('tracks', 'readwrite', s => s.delete(id));
const allPacks = () => tx('packs', 'readonly', s => s.getAll());
const putPack = p => tx('packs', 'readwrite', s => s.put(p));
const delPack = id => tx('packs', 'readwrite', s => s.delete(id));

/* ---------- fuentes de mapas (gratuitas, sin clave) ---------- */
const RET = (window.devicePixelRatio || 1) > 1.3 ? '@2x' : '';
const SOURCES = {
  cartoVoyager: { name: 'Calles / Blanco', tag: 'OpenStreetMap · sin API', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, kb: 18, attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  esriSat: { name: 'Satélite', tag: 'Esri World Imagery', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 19, kb: 35, attr: 'Tiles &copy; Esri, Maxar, Earthstar Geographics' },
  esriTopo: { name: 'Topográfico', tag: 'Esri World Topo', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', max: 19, kb: 30, attr: 'Tiles &copy; Esri' },
  openTopo: { name: 'Curvas de nivel', tag: 'OpenTopoMap', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', sub: 'abc', max: 17, kb: 40, attr: '&copy; OSM, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' },
  osm: { name: 'OpenStreetMap', tag: 'estándar', hidden: true, url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, kb: 18, attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  osmHot: { name: 'Humanitario', tag: 'OSM HOT', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', sub: 'ab', max: 19, kb: 22, attr: '&copy; OSM, Tiles style by <a href="https://www.hotosm.org/">HOT</a>' },
  cyclosm: { name: 'Senderos y ciclismo', tag: 'CyclOSM', url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', sub: 'abc', max: 20, kb: 30, attr: '&copy; OSM, <a href="https://www.cyclosm.org">CyclOSM</a>' },
  esriNatGeo: { name: 'Nat Geo', tag: 'Esri', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', max: 16, kb: 40, attr: 'Tiles &copy; Esri, National Geographic' },
  // satélite en vivo (NASA GIBS: imagen diaria, gratuita, sin clave; {date} = día elegido)
  goesEast: { name: 'GOES-East · en vivo', tag: 'NOAA/NASA · cada 10 min', live:true, time:true, url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/{date}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png', max: 7, kb: 20, attr: 'GOES-East ABI &copy; NOAA / <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>', detail:'Geoestacionario: imagen nueva cada 10 min de todo América. Ideal para nubes, tormentas y humo' },
  nasaViirs: { name: 'Hoy · VIIRS', tag: 'NASA · imagen diaria', live:true, date:true, url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', max: 9, kb: 25, attr: 'Imagery &copy; <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>', detail:'Suomi NPP · color real · pasa cerca de las 13:30 h locales' },
  nasaNoaa20: { name: 'Hoy · NOAA-20', tag: 'NASA · imagen diaria', live:true, date:true, url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', max: 9, kb: 25, attr: 'Imagery &copy; NASA GIBS', detail:'Segunda pasada diaria; útil si VIIRS tiene nubes o franjas' },
  nasaModis: { name: 'Hoy · MODIS', tag: 'NASA Terra · imagen diaria', live:true, date:true, url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', max: 9, kb: 25, attr: 'Imagery &copy; NASA GIBS', detail:'Terra · pasa en la mañana (≈10:30 h locales)' },
  hlsS30: { name: 'HLS Sentinel 30 m', tag: 'NASA · cada 2–5 días', live:true, date:true, hls:true, url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/{date}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png', max: 12, kb: 30, attr: 'HLS &copy; NASA GIBS', detail:'Sentinel-2 armonizado a 30 m: se ven carreteras, parcelas y ríos. Solo hay imagen los días con pase; usa “Pases recientes”' },
  hlsL30: { name: 'HLS Landsat 30 m', tag: 'NASA · cada 8 días', live:true, date:true, hls:true, url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_L30_Nadir_BRDF_Adjusted_Reflectance/default/{date}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png', max: 12, kb: 30, attr: 'HLS &copy; NASA GIBS', detail:'Landsat 8/9 armonizado a 30 m. Alterna con HLS Sentinel para tener más días disponibles' },
  sentinel2: { name: 'Sentinel-2 10 m', tag: 'Copernicus · tu cuenta', live:true, s2:true, url: '', max: 15, kb: 40, attr: 'Contains modified Copernicus Sentinel data · <a href="https://dataspace.copernicus.eu">CDSE</a>', detail:'La mejor calidad gratuita: 10 m, pase cada 5 días y filtro automático de nubes. Requiere tu ID de Copernicus (Más → Sentinel-2)' },
  s2cloudless: { name: 'Sentinel-2 sin nubes', tag: 'EOX · mosaico anual 10 m', live:true, url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg', max: 17, kb: 30, attr: '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by <a href="https://eox.at">EOX</a> (CC BY-NC-SA 4.0)', detail:'Mucho más detalle (10 m) pero no es del día: mosaico sin nubes del año' },
  cartoDark: { name: 'Oscuro', tag: 'CARTO', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}' + RET + '.png', sub: 'abcd', max: 20, kb: 15, attr: '&copy; OSM &copy; CARTO' },
  // superposiciones
  hillshade: { name: 'Sombreado de relieve', overlay: true, url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', max: 16, kb: 20, attr: 'Esri Hillshade', opacity: 0.45 },
  labels: { name: 'Nombres y límites', overlay: true, url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', max: 19, kb: 8, attr: 'Esri', opacity: 1 },
  nasaFires: { name: 'Incendios activos (NASA)', overlay: true, date:true, url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Thermal_Anomalies_375m_All/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png', max: 9, kb: 4, attr: 'NASA FIRMS / GIBS', opacity: 1 },
  transport: { name: 'Transporte público', overlay: true, url: 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', sub: 'abc', max: 19, kb: 10, attr: '<a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>', opacity: 0.9 }
};
const isoDay = d => { const x = d ? new Date(d) : new Date(); return x.toISOString().slice(0,10); };
const daysAgo = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return isoDay(d); };
const satDate = () => S.settings.satDate || daysAgo(1);
const goesSlot = (d = new Date(), back = 0) => { const t = new Date(Math.floor(d.getTime() / 600000) * 600000 - back * 600000); return t.toISOString().slice(0, 16) + ':00Z'; };
const satTime = () => S.settings.satTime || goesSlot(new Date(), 3);
/* Sentinel-2 (Sentinel Hub / Copernicus Data Space): la URL se arma con la configuración del usuario */
const s2Cfg = () => ({ id: (S.settings.s2Instance || '').trim(), layer: (S.settings.s2Layer || '1_TRUE_COLOR').trim(), days: +S.settings.s2Days || 20, cc: +S.settings.s2MaxCC || 20, order: S.settings.s2Order || 'leastCC', to: S.settings.s2To || null });
const s2Stamp = () => { const c = s2Cfg(); return `${c.to || daysAgo(0)}|${c.days}|${c.cc}|${c.order}`; };
const s2Url = stamp => { const c = s2Cfg(); const [to, days, cc, order] = (stamp || s2Stamp()).split('|'); const from = isoDay(new Date(new Date(to + 'T00:00:00Z').getTime() - (+days) * 86400000)); return `https://sh.dataspace.copernicus.eu/ogc/wmts/${c.id}?REQUEST=GetTile&LAYER=${encodeURIComponent(c.layer)}&TILEMATRIXSET=PopularWebMercator256&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&TIME=${from}/${to}&MAXCC=${cc}&PRIORITY=${order}&FORMAT=image/jpeg`; };
const s2Ready = () => /^[0-9a-f-]{20,}$/i.test(s2Cfg().id);
const satStamp = src => src?.time ? satTime() : src?.s2 ? s2Stamp() : src?.date ? satDate() : null;
const cacheId = (srcId, date) => { const s = SOURCES[srcId]; if (!s) return srcId; const st = date || satStamp(s); return st ? `${srcId}@${st}` : srcId; };
const tileURL = (src, z, x, y, i = 0, date) => (src.s2 ? s2Url(date) : src.url).replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{s}', src.sub ? src.sub[i % src.sub.length] : '').replace('{date}', date || satStamp(src) || '');

/* capa de teselas con caché local primero */
const OfflineLayer = L.TileLayer.extend({
  initialize(srcId, opts) { this.srcId = srcId; this.src = SOURCES[srcId]; this.cacheKey = cacheId(srcId); L.TileLayer.prototype.initialize.call(this, this.src.s2 ? s2Url() : this.src.url, L.extend({ maxZoom: 20, maxNativeZoom: this.src.max, subdomains: this.src.sub || 'abc', attribution: this.src.attr, updateWhenIdle: true, keepBuffer: 3, date: satStamp(this.src) || '', errorTileUrl: (this.src.date || this.src.time || this.src.s2) ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' : '' }, opts)); },
  createTile(coords, done) {
    const img = document.createElement('img');
    img.alt = ''; img.setAttribute('role', 'presentation');
    const key = `${this.cacheKey}/${coords.z}/${coords.x}/${coords.y}`;
    const fromNet = () => { if (!navigator.onLine) { done(null, img); return; } img.onload = () => done(null, img); img.onerror = () => done(new Error('tile'), img); img.src = this.getTileUrl(coords); };
    tileGet(key).then(blob => {
      if (blob) { const u = URL.createObjectURL(blob); img.onload = () => { URL.revokeObjectURL(u); done(null, img); }; img.onerror = () => { URL.revokeObjectURL(u); fromNet(); }; img.src = u; }
      else fromNet();
    });
    return img;
  }
});

/* ---------- estado ---------- */
const S = {
  settings: { base: 'cartoVoyager', theme: 'dark', satDate: null, satTime: null, satAuto: true, satSource: 'goesEast', s2Instance: '', s2Layer: '1_TRUE_COLOR', s2Days: 20, s2MaxCC: 20, s2Order: 'leastCC', s2To: null, minAcc: 40, autoFollow: true, overlays: {}, order: [], opacity: {}, activeProject: null, openFolders: {} },
  folders: [], projects: [], waypoints: [], tracks: [], vectors: [], packs: [],
  layers: {}, trackLayers: {}, vectorLayers: {}, wpLayers: {}, panes: {},
  tab: null, sel: null, measure: null, rec: null, me: null, follow: false, watchId: null,
  nav: null, navLayer: null, selectedWaypoint: null
};
const save = () => Promise.all([kvSet('settings', S.settings), kvSet('folders', S.folders), kvSet('projects', S.projects), kvSet('waypoints', S.waypoints), kvSet('vectors', S.vectors)]);

/* (4.0) El acceso por usuarios se retiró: la app abre directo al mapa. */


/* ---------- mapa ---------- */
const map = L.map('map', { zoomControl: false, attributionControl: true, tap: false }).setView([20.97, -89.62], 13);
map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
let baseLayer;
const setBase = id => {
  if (SOURCES[id]?.s2 && !s2Ready()) { openS2Setup(); return; }
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = new OfflineLayer(id, { pane: 'tilePane' }).addTo(map);
  S.settings.base = id; save();
  document.querySelectorAll('.basegrid button').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  document.querySelectorAll('[data-basequick]').forEach(b => b.classList.toggle('active', b.dataset.basequick === id));
  $('#btnSat')?.classList.toggle('active', !!SOURCES[id].live);
  renderSatPanel(); refreshSatStamp();
};
document.querySelectorAll('[data-basequick]').forEach(b => b.onclick = () => setBase(b.dataset.basequick));

/* orden de capas: lista de ids (primero = arriba). ids: 'ov:xxx', 'tr:xxx', 'wp' */
const getPane = id => { if (!S.panes[id]) { const p = map.createPane('p_' + id); S.panes[id] = p; } return S.panes[id]; };
const syncOrder = () => {
  const ids = new Set(['wp', ...Object.keys(SOURCES).filter(k => SOURCES[k].overlay).map(k => 'ov:' + k), ...S.tracks.map(t => 'tr:' + t.id), ...S.vectors.map(v => 'vec:' + v.id)]);
  S.settings.order = S.settings.order.filter(i => ids.has(i));
  ids.forEach(i => { if (!S.settings.order.includes(i)) S.settings.order.unshift(i); });
  S.settings.order.forEach((id, i) => { getPane(id).style.zIndex = 590 - i; });
};
const overlayLayer = id => {
  const key = 'ov:' + id;
  if (S.settings.overlays[id]) {
    if (!S.layers[id]) S.layers[id] = new OfflineLayer(id, { pane: 'p_' + key, opacity: S.settings.opacity[key] ?? SOURCES[id].opacity }).addTo(map);
    S.layers[id].setOpacity(S.settings.opacity[key] ?? SOURCES[id].opacity);
  } else if (S.layers[id]) { map.removeLayer(S.layers[id]); delete S.layers[id]; }
};


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

/* ---------- rutas en mapa ---------- */
const trackStats = t => {
  const p = t.points; let d = 0; const cum = [0];
  for (let i = 1; i < p.length; i++) { d += hav(p[i - 1], p[i]); cum.push(d); }
  const dur = p.length > 1 ? (p[p.length - 1][3] - p[0][3]) / 1000 : 0;
  let up = 0, down = 0, hasEle = false;
  for (let i = 1; i < p.length; i++) { if (p[i][2] != null && p[i - 1][2] != null) { hasEle = true; const dz = p[i][2] - p[i - 1][2]; if (dz > 0) up += dz; else down -= dz; } }
  return { dist: d, cum, dur, up, down, hasEle, avg: dur ? d / dur * 3.6 : 0 };
};
const drawTrack = t => {
  if (S.trackLayers[t.id]) map.removeLayer(S.trackLayers[t.id]);
  if (t.visible === false || !t.points.length) { delete S.trackLayers[t.id]; return; }
  const key = 'tr:' + t.id; getPane(key);
  const g = L.featureGroup([], { pane: 'p_' + key });
  const line = L.polyline(t.points.map(p => [p[0], p[1]]), { color: t.color, weight: 5, opacity: S.settings.opacity[key] ?? 1, pane: 'p_' + key, lineCap: 'round' });
  const halo = L.polyline(t.points.map(p => [p[0], p[1]]), { color: '#fff', weight: 9, opacity: (S.settings.opacity[key] ?? 1) * 0.7, pane: 'p_' + key, interactive: false });
  g.addLayer(halo); g.addLayer(line);
  line.on('click', e => { L.DomEvent.stop(e); if (S.measure && S.measure.track === t.id) { measurePick(t, e.latlng); } else selectTrack(t.id, e.latlng); });
  g.addTo(map); S.trackLayers[t.id] = g;
};
const nearestIdx = (t, ll) => { let bi = 0, bd = Infinity; t.points.forEach((p, i) => { const d = hav(p, [ll.lat, ll.lng]); if (d < bd) { bd = d; bi = i; } }); return bi; };

/* ---------- panel de información de ruta ---------- */
const info = $('#info');
const hideInfo = () => { info.classList.remove('open','expanded'); S.sel = null; setTimeout(layoutFloatingChrome,20); };
const selectTrack = (id, ll) => {
  const t = S.tracks.find(x => x.id === id); if (!t) return;
  S.sel = id; closeSelectedPoint(); closeSheet(); exitMeasure();
  const st = trackStats(t);
  info.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center;gap:10px"><div style="min-width:0;flex:1"><div class="info-kicker">Ruta seleccionada</div><div class="row" style="min-width:0"><i class="swatch" style="background:${t.color}"></i><b style="font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</b></div><div class="muted" style="margin-top:3px">${fmtDist(st.dist)} · ${fmtTime(st.dur)} · ${esc(projName(t.projectId))}</div></div><button class="info-toggle" id="infoMore" aria-label="Ver detalles">›</button></div>
  <div class="info-details"><div class="kpis"><div class="kpi"><b>${fmtDist(st.dist)}</b><span>distancia</span></div><div class="kpi"><b>${fmtTime(st.dur)}</b><span>duración</span></div><div class="kpi"><b>${st.avg.toFixed(1)} km/h</b><span>promedio</span></div>${st.hasEle ? `<div class="kpi"><b>+${Math.round(st.up)} / −${Math.round(st.down)} m</b><span>desnivel</span></div>` : ''}<div class="kpi"><b>${t.points.length}</b><span>puntos</span></div></div>
  <div class="row" style="flex-wrap:wrap"><button class="btn sm" id="infoMeasure">Medir tramo</button><button class="btn sm ghost" id="infoCenter">Ver completa</button><button class="btn sm ghost" id="infoEdit">Editar ruta</button><button class="btn sm ghost" id="infoX">Cerrar</button></div></div>`;
  info.classList.remove('expanded'); info.classList.add('open');
  requestAnimationFrame(layoutFloatingChrome);
  $('#infoMore').onclick = () => info.classList.toggle('expanded');
  $('#infoX').onclick = hideInfo;
  $('#infoCenter').onclick = () => map.fitBounds(S.trackLayers[t.id].getBounds(), { padding: [40, 40] });
  $('#infoEdit').onclick = () => editTrack(t);
  $('#infoMeasure').onclick = () => startMeasure(t);
};

/* medición: en ruta (distancia a lo largo del trazo) o libre */
const hint = $('#hint');
const showHint = m => { hint.textContent = m; hint.classList.add('show'); };
const hideHint = () => hint.classList.remove('show');
const abIcon = l => L.divIcon({ className: '', html: `<div class="marker-ab">${l}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
const startMeasure = t => {
  exitMeasure(); info.classList.remove('open');
  S.measure = { track: t ? t.id : null, pts: [], layers: L.layerGroup().addTo(map) };
  $('#btnMeasure').classList.add('active');
  showHint(t ? 'Toca el punto A sobre la ruta' : 'Toca el punto A en el mapa');
};
const exitMeasure = () => { if (!S.measure) return; map.removeLayer(S.measure.layers); S.measure = null; $('#btnMeasure').classList.remove('active'); hideHint(); };
const measurePick = (t, ll) => {
  const m = S.measure; if (!m) return;
  if (t) { const i = nearestIdx(t, ll); ll = L.latLng(t.points[i][0], t.points[i][1]); m.pts.push({ i, ll }); }
  else m.pts.push({ ll });
  m.layers.addLayer(L.marker(ll, { icon: abIcon(m.pts.length === 1 ? 'A' : 'B'), pane: 'markerPane' }));
  if (m.pts.length === 1) { showHint(t ? 'Ahora toca el punto B sobre la ruta' : 'Ahora toca el punto B'); return; }
  const [a, b] = m.pts;
  if (t) {
    const st = trackStats(t); const i0 = Math.min(a.i, b.i), i1 = Math.max(a.i, b.i);
    const along = st.cum[i1] - st.cum[i0];
    const seg = t.points.slice(i0, i1 + 1).map(p => [p[0], p[1]]);
    m.layers.addLayer(L.polyline(seg, { color: '#F1D889', weight: 7, opacity: .95, pane: 'p_tr:' + t.id }));
    const dur = (t.points[i1][3] - t.points[i0][3]) / 1000;
    m.layers.addLayer(L.popup({ closeButton: false, autoClose: false, closeOnClick: false }).setLatLng(b.ll).setContent(`<b>Por la ruta:</b> ${fmtDist(along)}<br><b>En línea recta:</b> ${fmtDist(hav([a.ll.lat, a.ll.lng], [b.ll.lat, b.ll.lng]))}<br><b>Tiempo:</b> ${fmtTime(dur)}`));
    showHint(`A→B: ${fmtDist(along)} por la ruta. Toca Medir para salir`);
  } else {
    const d = hav([a.ll.lat, a.ll.lng], [b.ll.lat, b.ll.lng]);
    m.layers.addLayer(L.polyline([a.ll, b.ll], { color: '#F1D889', weight: 3, dashArray: '6 6' }));
    m.layers.addLayer(L.popup({ closeButton: false, autoClose: false, closeOnClick: false }).setLatLng(b.ll).setContent(`<b>Distancia:</b> ${fmtDist(d)}`));
    showHint(`${fmtDist(d)} en línea recta. Toca Medir para salir`);
  }
  m.pts = []; // permite nueva medición A/B con los siguientes toques
};
map.on('click', e => { if (S.measure && !S.measure.track) measurePick(null, e.latlng); else if (!S.measure) { hideInfo(); closeSelectedPoint(); } });
$('#btnMeasure').onclick = () => S.measure ? exitMeasure() : startMeasure(null);
$('#btnLayersQuick').onclick = () => S.tab==='layers' ? closeSheet() : openTab('layers');

/* ---------- puntos de interés ---------- */
const wpIcon = iconId => {
  const d = pointIconDef(iconId);
  return L.divIcon({ className: '', html: `<div class="marker-wp" title="${esc(d.label)}"><span>${d.symbol}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 27], popupAnchor: [0, -24] });
};
const selectedPointCard = $('#selectedPointCard');
const closeSelectedPoint = () => { S.selectedWaypoint = null; selectedPointCard?.classList.remove('open','expanded'); setTimeout(layoutFloatingChrome,20); };
const showWaypointAction = w => {
  hideInfo(); if(S.nav) closeNavigation();
  S.selectedWaypoint = w;
  const d = pointIconDef(w.icon);
  $('#spIcon').textContent = d.symbol;
  $('#spTitle').textContent = w.name || 'Punto';
  $('#spMeta').textContent = `${d.label} · ${w.lat.toFixed(6)}, ${w.lng.toFixed(6)}`;
  $('#spNotes').textContent = w.notes || 'Sin notas';
  selectedPointCard.classList.remove('expanded'); selectedPointCard.classList.add('open');
  requestAnimationFrame(layoutFloatingChrome);
  map.panTo([w.lat,w.lng], {animate:true,duration:.35});
};
$('#spMore').onclick = () => selectedPointCard?.classList.toggle('expanded');
$('#spClose').onclick = closeSelectedPoint;
$('#spNavigate').onclick = () => { const w=S.selectedWaypoint; if(!w)return; closeSelectedPoint(); routeToWaypoint(w); };
$('#spEdit').onclick = () => { const w=S.selectedWaypoint; if(!w)return; closeSelectedPoint(); editWaypoint(w); };

const drawWaypoints = () => {
  getPane('wp');
  Object.values(S.wpLayers).forEach(l => map.removeLayer(l)); S.wpLayers = {};
  if (S.settings.wpHidden) return;
  S.waypoints.forEach(w => {
    const d = pointIconDef(w.icon);
    const m = L.marker([w.lat, w.lng], { icon: wpIcon(w.icon), pane: 'p_wp', riseOnHover:true }).addTo(map);
    m.bindTooltip(w.name || d.label, {direction:'top',offset:[0,-22],opacity:.92,className:'tp-tooltip'});
    m.on('click', e => { L.DomEvent.stopPropagation(e); showWaypointAction(w); });
    S.wpLayers[w.id] = m;
  });
};
const editWaypoint = w => {
  const isNew = !w.id;
  let selectedIcon = w.icon || 'pin';
  const iconHtml = () => POINT_ICONS.map(i => `<button type="button" class="iconpick ${i.id === selectedIcon ? 'on' : ''}" data-wpicon="${i.id}"><b>${i.symbol}</b><span>${esc(i.label)}</span></button>`).join('');
  openModal(`<h3>${isNew ? 'Nuevo punto' : 'Editar punto'}</h3>
  <div class="field"><label>Nombre</label><input id="wpName" value="${esc(w.name || '')}"></div>
  <div class="field"><label>Tipo de punto / icono</label><div class="iconpicker" id="wpIcons">${iconHtml()}</div></div>
  <div class="field"><label>Notas</label><textarea id="wpNotes" rows="2">${esc(w.notes || '')}</textarea></div>
  <div class="grid2"><div class="field"><label>Latitud</label><input id="wpLat" value="${w.lat.toFixed(6)}"></div><div class="field"><label>Longitud</label><input id="wpLng" value="${w.lng.toFixed(6)}"></div></div>
  <div class="field"><label>Proyecto</label><select id="wpProj">${projOptions(w.projectId)}</select></div>
  <div class="actions">${isNew ? '' : '<button class="btn danger" id="wpDel">Eliminar</button>'}<button class="btn ghost" data-close>Cancelar</button><button class="btn" id="wpOk">Guardar</button></div>`);
  document.querySelectorAll('[data-wpicon]').forEach(b => b.onclick = () => { selectedIcon = b.dataset.wpicon; document.querySelectorAll('[data-wpicon]').forEach(x => x.classList.toggle('on', x.dataset.wpicon === selectedIcon)); });
  $('#wpOk').onclick = async () => {
    w.name = $('#wpName').value.trim() || 'Punto'; w.notes = $('#wpNotes').value.trim(); w.lat = +$('#wpLat').value; w.lng = +$('#wpLng').value; w.projectId = $('#wpProj').value || null; w.icon = selectedIcon;
    if (isNew) { w.id = uid(); S.waypoints.push(w); }
    await save(); drawWaypoints(); closeModal(); map.closePopup(); toast('Punto guardado');
  };
  const d = $('#wpDel'); if (d) d.onclick = async () => { S.waypoints = S.waypoints.filter(x => x.id !== w.id); await save(); drawWaypoints(); closeModal(); map.closePopup(); };
};
$('#btnWp').onclick = () => { $('#btnWp').classList.add('active'); const c = S.me && S.follow ? S.me : map.getCenter(); editWaypoint({ lat: c.lat, lng: c.lng, projectId: S.settings.activeProject, name: '', icon: 'pin' }); setTimeout(()=>$('#btnWp')?.classList.remove('active'),900); };
map.on('contextmenu', e => { if (S.measure) return; editWaypoint({ lat: e.latlng.lat, lng: e.latlng.lng, projectId: S.settings.activeProject, name: '', icon: 'pin' }); });

/* ---------- GPS ---------- */
const meIcon = L.divIcon({ className: '', html: '<div class="marker-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
let meMarker, accCircle;
const onPos = p => {
  const ll = [p.coords.latitude, p.coords.longitude]; S.me = L.latLng(ll);
  if (!meMarker) { meMarker = L.marker(ll, { icon: meIcon, pane: 'markerPane', interactive: false }).addTo(map); accCircle = L.circle(ll, { radius: p.coords.accuracy, color: '#2F80ED', weight: 1, fillOpacity: .08, interactive: false }).addTo(map); }
  meMarker.setLatLng(ll); accCircle.setLatLng(ll).setRadius(p.coords.accuracy);
  if (S.follow) map.panTo(ll, { animate: true, duration: .4 });
  if (S.rec) recPoint(p);
  if (S.nav) updateNavigationProgress(S.me);
  $('#sAcc').textContent = '±' + Math.round(p.coords.accuracy) + ' m';
  refreshMapHud();
};
const onPosErr = e => { toast(e.code === 1 ? 'Permite el acceso a la ubicación para usar el GPS' : 'Sin señal GPS: ' + e.message); $('#btnLocate').classList.remove('gps-on'); };
const startGPS = () => { if (S.watchId != null) return; if (!navigator.geolocation) return toast('Este dispositivo no tiene GPS'); S.watchId = navigator.geolocation.watchPosition(onPos, onPosErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 }); $('#btnLocate').classList.add('gps-on'); };
const stopGPS = () => { if (S.watchId != null) navigator.geolocation.clearWatch(S.watchId); S.watchId = null; $('#btnLocate').classList.remove('gps-on'); };
$('#btnLocate').onclick = () => {
  if (S.watchId == null) { startGPS(); S.follow = true; $('#btnLocate').classList.add('active'); toast('Buscando tu ubicación…'); }
  else if (!S.follow) { S.follow = true; $('#btnLocate').classList.add('active'); if (S.me) map.setView(S.me, Math.max(map.getZoom(), 16)); }
  else { S.follow = false; $('#btnLocate').classList.remove('active'); if (!S.rec) stopGPS(); }
};
map.on('dragstart', () => { if (S.follow) { S.follow = false; $('#btnLocate').classList.remove('active'); } });

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
const routeDistance = coords => {let d=0;for(let i=1;i<coords.length;i++)d+=hav(coords[i-1],coords[i]);return d;};
const localRoutes = (from,to) => {
  const g=buildLocalGraph(); if(g.nodes.length<2)return [];
  const a=nearestGraphNode(g,from),b=nearestGraphNode(g,to); if(a.i<0||b.i<0||a.d>3000)return [];
  const penalty=new Map(), out=[];
  for(let k=0;k<3;k++){
    const r=aStar(g,a.i,b.i,penalty); if(!r)break;
    const core=r.ids.map(i=>g.nodes[i]); if(core.length<1)break;
    const sig=r.ids.join('-'); if(out.some(x=>x.sig===sig))break;
    const startLink=a.d>8?[[from.lat,from.lng],core[0]]:null;
    const directTail=b.d>8?[core.at(-1),[to.lat,to.lng]]:null;
    const roadDist=routeDistance(core), startLinkDist=startLink?routeDistance(startLink):0, offRoadDist=directTail?routeDistance(directTail):0;
    const coords=[]; if(startLink)coords.push(startLink[0]); coords.push(...core); if(directTail)coords.push(directTail[1]);
    const dist=roadDist+startLinkDist+offRoadDist;
    const dur=roadDist/(25/3.6)+(startLinkDist+offRoadDist)/(5/3.6);
    const tailText=offRoadDist>8?` · tramo directo final ${fmtDist(offRoadDist)}`:'';
    out.push({id:'local-'+k,source:'local',label:k?'Red SIG · alternativa '+(k+1):'Red SIG local',detail:`${localLineSources().length} líneas cargadas${tailText}`,coords,mainCoords:core,startLink,directTail,roadDist,startLinkDist,offRoadDist,dist,dur,sig,snap:a.d+b.d});
    for(let i=1;i<r.ids.length;i++){const ek=edgeKey(r.ids[i-1],r.ids[i]);penalty.set(ek,(penalty.get(ek)||0)+.75);}
  }
  return out;
};
const onlineRoutes = async (from,to) => {
  if(!navigator.onLine)return [];
  const u=`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?alternatives=3&steps=true&geometries=geojson&overview=full`;
  try{
    const r=await fetch(u); if(!r.ok)return[]; const j=await r.json(); if(j.code!=='Ok'||!j.routes?.length)return[];
    const startSnap=j.waypoints?.[0]?.location?[j.waypoints[0].location[1],j.waypoints[0].location[0]]:[from.lat,from.lng];
    const endSnap=j.waypoints?.[1]?.location?[j.waypoints[1].location[1],j.waypoints[1].location[0]]:[to.lat,to.lng];
    return j.routes.map((q,i)=>{
      const main=q.geometry.coordinates.map(c=>[c[1],c[0]]);
      const startD=hav([from.lat,from.lng],startSnap), endD=hav(endSnap,[to.lat,to.lng]);
      const startLink=startD>8?[[from.lat,from.lng],startSnap]:null;
      const directTail=endD>8?[endSnap,[to.lat,to.lng]]:null;
      const coords=[]; if(startLink)coords.push(startLink[0]); coords.push(...main); if(directTail)coords.push(directTail[1]);
      const extra=startD+endD, tailText=endD>8?` · tramo directo final ${fmtDist(endD)}`:'';
      return {id:'osm-'+i,source:'osm',label:i?'Calles OSM · alternativa '+(i+1):'Calles OSM',detail:(i?'Ruta vial alternativa':'Ruta recomendada por la red OSM')+tailText,coords,mainCoords:main,startLink,directTail,roadDist:q.distance,startLinkDist:startD,offRoadDist:endD,dist:q.distance+extra,dur:q.duration+extra/(5/3.6),steps:(q.legs||[]).flatMap(l=>l.steps||[])};
    });
  }catch(e){console.warn('OSRM',e);return[];}
};
const directRoute = (from,to) => ({id:'direct',source:'direct',label:'Orientación directa',detail:'No se identificó una red conectada hasta el destino',coords:[[from.lat,from.lng],[to.lat,to.lng]],mainCoords:[],directTail:[[from.lat,from.lng],[to.lat,to.lng]],offRoadDist:hav([from.lat,from.lng],[to.lat,to.lng]),dist:hav([from.lat,from.lng],[to.lat,to.lng]),dur:null});
const ensureCurrentLocation = () => new Promise((res,rej)=>{if(S.me)return res(S.me);if(!navigator.geolocation)return rej(new Error('GPS no disponible'));navigator.geolocation.getCurrentPosition(p=>{onPos(p);res(S.me)},rej,{enableHighAccuracy:true,timeout:25000,maximumAge:5000});});
const navRouteStyle = r => r.source==='direct'?{color:'#D59A38',weight:5,dashArray:'9 8'}:{color:'#19A987',weight:7};
const activateRoute = (route,target,routes) => {
  hideInfo(); closeSelectedPoint();
  if(S.navLayer)map.removeLayer(S.navLayer);
  const g=L.layerGroup().addTo(map), style=navRouteStyle(route);
  const main=route.mainCoords?.length?route.mainCoords:(route.source==='direct'?[]:route.coords);
  if(route.startLink){g.addLayer(L.polyline(route.startLink,{color:'#fff',weight:8,opacity:.8,lineCap:'round'}));g.addLayer(L.polyline(route.startLink,{color:'#75847E',weight:3,dashArray:'4 6',opacity:.95,lineCap:'round'}));}
  if(main.length>1){g.addLayer(L.polyline(main,{color:'#fff',weight:style.weight+6,opacity:.9,lineCap:'round'}));g.addLayer(L.polyline(main,{color:'#19A987',weight:style.weight,opacity:.98,lineCap:'round'}));}
  if(route.directTail){g.addLayer(L.polyline(route.directTail,{color:'#fff',weight:9,opacity:.92,lineCap:'round'}));g.addLayer(L.polyline(route.directTail,{color:'#D59A38',weight:5,dashArray:'10 8',opacity:1,lineCap:'round'}));}
  if(route.source==='direct'&&!main.length&&!route.directTail){g.addLayer(L.polyline(route.coords,{...style,opacity:.98,lineCap:'round'}));}
  g.addLayer(L.circleMarker([target.lat,target.lng],{radius:9,color:'#fff',weight:3,fillColor:'#D59A38',fillOpacity:1}));
  S.navLayer=g; S.nav={target,route,routes}; renderRouteCard(); requestAnimationFrame(layoutFloatingChrome); const b=L.latLngBounds(route.coords); if(b.isValid())map.fitBounds(b,{paddingTopLeft:[28,150],paddingBottomRight:[28,205]}); startGPS(); updateNavigationProgress(S.me||L.latLng(route.coords[0]));
};
const closeNavigation = () => {if(S.navLayer){map.removeLayer(S.navLayer);S.navLayer=null;}S.nav=null;navCard.classList.remove('open');setTimeout(layoutFloatingChrome,20);};
const switchRoute = id => {if(!S.nav)return;const r=S.nav.routes.find(x=>x.id===id);if(r)activateRoute(r,S.nav.target,S.nav.routes);};
const renderRouteCard = () => {
  if(!S.nav)return navCard.classList.remove('open');const {route,target,routes}=S.nav;navCard.classList.add('open');requestAnimationFrame(layoutFloatingChrome);
  $('#routeTitle').textContent=target.name||'Destino'; $('#routeSource').textContent=route.label; $('#routeDist').textContent=fmtDist(route.dist); $('#routeEta').textContent=route.dur?fmtTime(route.dur):'—'; $('#routeRemain').textContent=fmtDist(route.dist);
  const tn=$('#routeTailNote'); if(tn){tn.textContent=route.offRoadDist>8?`Último tramo: ${fmtDist(route.offRoadDist)} en línea recta hasta el punto`:(route.source==='direct'?'Ruta completa en línea recta':'La red llega al destino');tn.classList.toggle('visible',true);tn.classList.toggle('direct',route.offRoadDist>8||route.source==='direct');}
  $('#routeChoices').innerHTML=routes.map(r=>`<button class="route-choice ${r.id===route.id?'active':''}" data-route="${r.id}"><b>${esc(r.label)}</b><span>${fmtDist(r.dist)}${r.offRoadDist>8?' · '+fmtDist(r.offRoadDist)+' directo':''}${r.dur?' · '+fmtTime(r.dur):''}</span></button>`).join('');
  $('#routeChoices').querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>switchRoute(b.dataset.route));
};
const updateNavigationProgress = ll => {
  if(!S.nav||!ll)return;const r=S.nav.route;let bi=0,bd=Infinity;for(let i=0;i<r.coords.length;i++){const d=hav([ll.lat,ll.lng],r.coords[i]);if(d<bd){bd=d;bi=i}}let rem=hav([ll.lat,ll.lng],r.coords[bi]);for(let i=bi+1;i<r.coords.length;i++)rem+=hav(r.coords[i-1],r.coords[i]);$('#routeRemain').textContent=fmtDist(rem);const eta=r.dur&&r.dist?Math.max(0,r.dur*(rem/r.dist)):null;$('#routeEta').textContent=eta?fmtTime(eta):'—';const status=$('#routeStatus');const inTail=r.directTail&&hav([ll.lat,ll.lng],r.directTail[0])<Math.max(120,r.offRoadDist*.45);status.textContent=rem<35?'Destino muy cerca':inTail?'Tramo final directo al punto':bd>120?'Fuera de ruta · conviene recalcular':'Navegación activa';status.classList.toggle('warn',bd>120||inTail);
};
const chooseRouteDialog = (routes,target) => {
  const cards=routes.map((r,i)=>`<button class="route-option-card" data-pickroute="${r.id}"><span class="route-net ${r.source}">${r.source==='local'?'SIG':r.source==='osm'?'OSM':'↗'}</span><span class="grow"><b>${esc(r.label)}</b><small>${esc(r.detail||'')} · ${fmtDist(r.dist)}${r.dur?' · '+fmtTime(r.dur):''}</small></span><span>›</span></button>`).join('');
  openModal(`<div class="modal-kicker">Navegación</div><h3>Ruta a ${esc(target.name||'punto')}</h3><p class="muted">TerraPin seguirá la red identificada hasta donde sea posible. Si ningún camino llega exactamente al punto, mostrará un tramo final ámbar en línea recta.</p><div class="route-option-list">${cards}</div><div class="actions"><button class="btn ghost" data-close>Cancelar</button></div>`);document.querySelectorAll('[data-pickroute]').forEach(b=>b.onclick=()=>{const r=routes.find(x=>x.id===b.dataset.pickroute);closeModal();activateRoute(r,target,routes);});
};
const routeToWaypoint = async w => {
  toast('Analizando caminos y rutas…');try{const from=await ensureCurrentLocation();const [local,osm]=await Promise.all([Promise.resolve(localRoutes(from,L.latLng(w.lat,w.lng))),onlineRoutes(from,L.latLng(w.lat,w.lng))]);let routes=[...local,...osm];if(!routes.length)routes=[directRoute(from,L.latLng(w.lat,w.lng))];routes.sort((a,b)=>{if(a.source==='direct')return 1;if(b.source==='direct')return-1;return (a.dur||a.dist)-(b.dur||b.dist)});if(routes.length===1)activateRoute(routes[0],w,routes);else chooseRouteDialog(routes,w);}catch(e){console.error(e);toast('No se pudo obtener tu ubicación para navegar');}
};
$('#routeClose').onclick=closeNavigation;
$('#routeRecalc').onclick=()=>{if(!S.nav)return;const t=S.nav.target;closeNavigation();routeToWaypoint(t);};

/* ---------- grabación ---------- */
let recLine, recTimer, wake;
const recElapsedMs = r => r ? Math.max(0, Date.now() - r.start - (r.pausedTotal||0) - (r.paused && r.pauseStarted ? Date.now()-r.pauseStarted : 0)) : 0;
const refreshRecUI = () => {
  if(!S.rec)return;
  const sec=recElapsedMs(S.rec)/1000;
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
  set('#sDist',fmtDist(S.rec.dist||0));set('#sTime',fmtTime(sec));set('#sSpeed',(S.rec.lastSpeed||0).toFixed(1));
  set('#tRecDist',fmtDist(S.rec.dist||0));set('#tRecTime',fmtTime(sec));set('#tRecPts',String(S.rec.points?.length||0));
  const st=$('#tRecState');if(st)st.textContent=S.rec.paused?'Grabación en pausa':'GPS registrando el recorrido';
  const pb=$('#tPauseRec');if(pb)pb.textContent=S.rec.paused?'Reanudar':'Pausar';
  $('#recbar')?.classList.toggle('paused',!!S.rec.paused);
  $('#trackRecHero')?.classList.toggle('paused',!!S.rec.paused);
};
const recPoint = p => {
  if (!S.rec || S.rec.paused || p.coords.accuracy > S.settings.minAcc) return;
  const pt = [p.coords.latitude, p.coords.longitude, p.coords.altitude, p.timestamp || Date.now()];
  const pts = S.rec.points; const last = pts[pts.length - 1];
  if (last) { const d = hav(last, pt); if (d < 2 && pt[3] - last[3] < 30000) return; S.rec.dist += d; S.rec.lastSpeed = p.coords.speed != null ? p.coords.speed * 3.6 : d / Math.max(1, (pt[3] - last[3]) / 1000) * 3.6; }
  pts.push(pt); recLine.addLatLng([pt[0], pt[1]]);refreshRecUI();
  if (pts.length % 5 === 0) kvSet('recording', S.rec);
};
const startRec = (resume) => {
  S.rec = resume ? Object.assign({paused:false,pausedTotal:0,pauseStarted:null,lastSpeed:0},resume) : { id: uid(), points: [], dist: 0, start: Date.now(), color: COLORS[S.tracks.length % COLORS.length], projectId: S.settings.activeProject, paused:false, pausedTotal:0, pauseStarted:null, lastSpeed:0 };
  recLine = L.polyline(S.rec.points.map(p => [p[0], p[1]]), { color: S.rec.color, weight: 5, pane: 'overlayPane' }).addTo(map);
  $('#recbar').classList.add('on'); $('#btnRec').classList.add('pulse'); $('#recIcon').innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2"/>';
  startGPS(); S.follow = true; $('#btnLocate').classList.add('active');
  clearInterval(recTimer);recTimer = setInterval(refreshRecUI,1000);refreshRecUI();
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => wake = w).catch(() => { });
  requestAnimationFrame(layoutFloatingChrome);
};
const toggleRecPause = async () => {if(!S.rec)return;if(S.rec.paused){S.rec.pausedTotal=(S.rec.pausedTotal||0)+(Date.now()-(S.rec.pauseStarted||Date.now()));S.rec.pauseStarted=null;S.rec.paused=false;}else{S.rec.paused=true;S.rec.pauseStarted=Date.now();S.rec.lastSpeed=0;}await kvSet('recording',S.rec);refreshRecUI();if(S.tab==='tracks')renderSheet();};
document.addEventListener('visibilitychange', () => { if (S.rec && document.visibilityState === 'visible' && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => wake = w).catch(() => { }); });
const stopRec = async () => {
  const r = S.rec;if(!r)return;const elapsed=recElapsedMs(r); clearInterval(recTimer); if (wake) { wake.release().catch(() => { }); wake = null; }
  $('#recbar').classList.remove('on','paused'); $('#btnRec').classList.remove('pulse'); $('#recIcon').innerHTML = '<circle cx="12" cy="12" r="7"/>';
  if(recLine)map.removeLayer(recLine);recLine=null; S.rec = null; await kvSet('recording', null);requestAnimationFrame(layoutFloatingChrome);
  if (!S.follow) stopGPS();
  if (r.points.length < 2) return toast('Ruta demasiado corta, no se guardó');
  const def = 'Ruta ' + new Date(r.start).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  openModal(`<h3>Guardar ruta</h3><div class="muted" style="margin-bottom:10px">${fmtDist(r.dist)} · ${fmtTime(elapsed / 1000)} · ${r.points.length} puntos</div>
  <div class="field"><label>Nombre</label><input id="trName" value="${esc(def)}"></div>
  <div class="field"><label>Proyecto</label><select id="trProj">${projOptions(r.projectId)}</select></div>
  <div class="field"><label>Color</label><div class="colorrow" id="trColors">${COLORS.map(c => `<button style="background:${c}" data-c="${c}" class="${c === r.color ? 'on' : ''}"></button>`).join('')}</div></div>
  <div class="actions"><button class="btn danger" id="trDiscard">Descartar</button><button class="btn" id="trOk">Guardar ruta</button></div>`);
  let color = r.color; $('#trColors').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; $('#trColors').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#trDiscard').onclick = closeModal;
  $('#trOk').onclick = async () => { const t = { id: r.id, name: $('#trName').value.trim() || def, projectId: $('#trProj').value || null, color, points: r.points, created: r.start, visible: true }; await putTrack(t); S.tracks.push(t); syncOrder(); drawTrack(t); await save(); closeModal(); toast('Ruta guardada'); selectTrack(t.id); };
};
$('#btnRec').onclick = () => S.rec ? stopRec() : startRec();

/* ---------- edición de rutas ---------- */
const editTrack = t => {
  openModal(`<h3>Editar ruta</h3>
  <div class="field"><label>Nombre</label><input id="etName" value="${esc(t.name)}"></div>
  <div class="field"><label>Proyecto</label><select id="etProj">${projOptions(t.projectId)}</select></div>
  <div class="field"><label>Color</label><div class="colorrow" id="etColors">${COLORS.map(c => `<button style="background:${c}" data-c="${c}" class="${c === t.color ? 'on' : ''}"></button>`).join('')}</div></div>
  <div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn sm ghost" id="etGpx">Exportar GPX</button><button class="btn sm ghost" id="etJson">Exportar GeoJSON</button></div>
  <div class="actions"><button class="btn danger" id="etDel">Eliminar</button><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="etOk">Guardar</button></div>`);
  let color = t.color; $('#etColors').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; $('#etColors').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#etOk').onclick = async () => { t.name = $('#etName').value.trim() || t.name; t.projectId = $('#etProj').value || null; t.color = color; await putTrack(t); drawTrack(t); closeModal(); if (S.sel === t.id) selectTrack(t.id); renderSheet(); };
  $('#etDel').onclick = async () => { if (!confirm('¿Eliminar la ruta "' + t.name + '"?')) return; await delTrack(t.id); S.tracks = S.tracks.filter(x => x.id !== t.id); if (S.trackLayers[t.id]) map.removeLayer(S.trackLayers[t.id]); hideInfo(); closeModal(); renderSheet(); toast('Ruta eliminada'); };
  $('#etGpx').onclick = () => download(t.name + '.gpx', toGPX([t], S.waypoints.filter(w => w.projectId === t.projectId)), 'application/gpx+xml');
  $('#etJson').onclick = () => download(t.name + '.geojson', JSON.stringify(toGeoJSON([t], [])), 'application/geo+json');
};
const toGPX = (tracks, wps) => `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="TerraPin — Jesús Reynaldo Ordoñez Pech" xmlns="http://www.topografix.com/GPX/1/1">\n` +
  wps.map(w => `<wpt lat="${w.lat}" lon="${w.lng}"><name>${esc(w.name)}</name>${w.notes ? `<desc>${esc(w.notes)}</desc>` : ''}</wpt>\n`).join('') +
  tracks.map(t => `<trk><name>${esc(t.name)}</name><trkseg>\n${t.points.map(p => `<trkpt lat="${p[0]}" lon="${p[1]}">${p[2] != null ? `<ele>${p[2].toFixed(1)}</ele>` : ''}<time>${new Date(p[3]).toISOString()}</time></trkpt>`).join('\n')}\n</trkseg></trk>\n`).join('') + '</gpx>';
const toGeoJSON = (tracks, wps, vectors = []) => ({ type: 'FeatureCollection', features: [
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
const download = (name, data, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };

/* importar GPX / GeoJSON / KML / KMZ / Shape */
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

/* ---------- proyectos ---------- */

/* ---------- mapa PDF profesional e impresión ---------- */
const safeFile = s => String(s || 'mapa').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'mapa';
const hexRgb = h => { h = String(h || '#0F766E').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const paleRgb = h => hexRgb(h).map(v=>Math.round(v*.28+255*.72));
const pointPdfStyle = icon => ({pin:['P','#0F766E'],tree:['A','#3B7A57'],forest:['B','#2F6B48'],water:['H','#2D78B7'],camera:['F','#6B5CA5'],house:['S','#8B5E3C'],camp:['C','#9A6B27'],vehicle:['V','#4B5563'],trail:['R','#A06B2B'],wildlife:['Fa','#7C5A3C'],warning:['!','#C46B2B'],check:['✓','#287A67']}[icon]||['P','#0F766E']);
const reportScope = (projectId,compose={}) => {
  if(typeof compose==='string') compose={areaName:compose};
  const project = projectId ? S.projects.find(p => p.id === projectId) : null;
  const tracks = projectId ? S.tracks.filter(t => t.projectId === projectId) : S.tracks.slice();
  const waypoints = projectId ? S.waypoints.filter(w => w.projectId === projectId) : S.waypoints.slice();
  const vectors = projectId ? S.vectors.filter(v => v.projectId === projectId) : S.vectors.slice();
  const title = compose.title ?? project?.reportTitle ?? project?.name ?? S.settings.reportTitle ?? 'Mapa general de campo';
  const areaName = compose.areaName ?? project?.areaName ?? S.settings.reportAreaName ?? 'Área de trabajo';
  const author = compose.author ?? project?.reportAuthor ?? S.settings.reportAuthor ?? 'Jesús Reynaldo Ordoñez Pech';
  const legendLabels = compose.legendLabels ?? project?.reportLegendLabels ?? {};
  const defaults={mapKind:'MAPA DE PRESENTACIÓN',legendTitle:'SIMBOLOGÍA',legendGroupTracks:'Rutas',legendGroupVectors:'Capas SIG',legendGroupPoints:'Puntos',metaTitle:'Información cartográfica',sourceLine:'Datos TerraPin + capas GIS importadas',orientationLine:'Norte geográfico · Escala gráfica'};
  const reportText={...defaults,...(project?.reportText||S.settings.reportText||{}),...(compose.reportText||{})};
  const layoutDefaults={legend:{x:.75,y:.60,w:.21,h:.29},north:{x:.88,y:.07,w:.09,h:.18},scale:{x:.05,y:.84,w:.30,h:.10}};
  const layout={...layoutDefaults,...(project?.reportLayout||S.settings.reportLayout||{}),...(compose.layout||{})};
  const mapStyle=compose.mapStyle||project?.reportMapStyle||S.settings.reportMapStyle||'satellite';
  const totalDist = tracks.reduce((a, t) => a + trackStats(t).dist, 0);
  const totalTime = tracks.reduce((a, t) => a + trackStats(t).dur, 0);
  return { project, tracks, waypoints, vectors, title, areaName, author, legendLabels, reportText, layout, mapStyle, totalDist, totalTime };
};
const geomCoordSets = g => {
  if(!g)return[];
  if(g.type==='Point')return [[[g.coordinates[1],g.coordinates[0]]]];
  if(g.type==='MultiPoint')return g.coordinates.map(c=>[[c[1],c[0]]]);
  if(g.type==='LineString')return [g.coordinates.map(c=>[c[1],c[0]])];
  if(g.type==='MultiLineString')return g.coordinates.map(r=>r.map(c=>[c[1],c[0]]));
  if(g.type==='Polygon')return g.coordinates.map(r=>r.map(c=>[c[1],c[0]]));
  if(g.type==='MultiPolygon')return g.coordinates.flatMap(p=>p.map(r=>r.map(c=>[c[1],c[0]])));
  return[];
};
const reportBounds = (tracks, waypoints, vectors=[]) => {
  const pts=[...tracks.flatMap(t=>t.points.map(p=>[p[0],p[1]])),...waypoints.map(w=>[w.lat,w.lng]),...vectors.flatMap(v=>geomCoordSets(v.feature?.geometry).flat())];
  if(!pts.length)return null;let minLat=Infinity,maxLat=-Infinity,minLng=Infinity,maxLng=-Infinity;pts.forEach(([lat,lng])=>{if(!Number.isFinite(lat)||!Number.isFinite(lng))return;minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);minLng=Math.min(minLng,lng);maxLng=Math.max(maxLng,lng)});if(!Number.isFinite(minLat))return null;
  if(maxLat===minLat){maxLat+=.0005;minLat-=.0005} if(maxLng===minLng){maxLng+=.0005;minLng-=.0005}
  const py=(maxLat-minLat)*.08,px=(maxLng-minLng)*.08;return{minLat:minLat-py,maxLat:maxLat+py,minLng:minLng-px,maxLng:maxLng+px};
};
const niceScale = m => { if(!Number.isFinite(m)||m<=0)return 100;const e=10**Math.floor(Math.log10(m)),q=m/e;return(q>=5?5:q>=2?2:1)*e; };
const reportProjection = (b,x,y,w,h) => {const yN=reportMercY(b.maxLat),yS=reportMercY(b.minLat),dy=Math.max(1e-12,yS-yN),dx=Math.max(1e-12,b.maxLng-b.minLng);return p=>[x+(p[1]-b.minLng)/dx*w,y+(reportMercY(p[0])-yN)/dy*h];};
const reportMercY = lat => {const s=Math.sin(Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/180);return .5-Math.log((1+s)/(1-s))/(4*Math.PI);};
const reportWorldPx=(lat,lng,z)=>{const n=256*2**z;return{x:(lng+180)/360*n,y:reportMercY(lat)*n};};
const reportTileBlob=async(srcId,z,x,y)=>{const src=SOURCES[srcId];if(!src)return null;const n=2**z,wrap=((x%n)+n)%n,key=`${cacheId(srcId)}/${z}/${wrap}/${y}`;let blob=await tileGet(key);if(blob)return blob;if(!navigator.onLine)return null;try{const r=await fetch(tileURL(src,z,wrap,y),{mode:'cors',cache:'force-cache'});if(!r.ok)return null;return await r.blob();}catch{return null;}};
const blobBitmap=async blob=>{if(!blob)return null;if(window.createImageBitmap)return await createImageBitmap(blob);return await new Promise((res,rej)=>{const i=new Image(),u=URL.createObjectURL(blob);i.onload=()=>{URL.revokeObjectURL(u);res(i)};i.onerror=e=>{URL.revokeObjectURL(u);rej(e)};i.src=u;});};
const buildReportBasemap=async(b,w=1180,h=650,sourceId=null)=>{if(!b)return null;const srcId=sourceId||(SOURCES[S.settings.base]&&!SOURCES[S.settings.base].overlay?S.settings.base:'esriSat'),src=SOURCES[srcId];if(!src)return null;let z=Math.min(src.max||18,18);for(;z>2;z--){const nw=reportWorldPx(b.maxLat,b.minLng,z),se=reportWorldPx(b.minLat,b.maxLng,z);if((se.x-nw.x)<=w*1.45&&(se.y-nw.y)<=h*1.45)break;}const nw=reportWorldPx(b.maxLat,b.minLng,z),se=reportWorldPx(b.minLat,b.maxLng,z),spanX=Math.max(1,se.x-nw.x),spanY=Math.max(1,se.y-nw.y),c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#e9eee8';ctx.fillRect(0,0,w,h);const x0=Math.floor(nw.x/256),x1=Math.floor(se.x/256),y0=Math.floor(nw.y/256),y1=Math.floor(se.y/256),jobs=[];for(let tx=x0;tx<=x1;tx++)for(let ty=y0;ty<=y1;ty++)jobs.push((async()=>{const blob=await reportTileBlob(srcId,z,tx,ty);if(!blob)return;let bm;try{bm=await blobBitmap(blob)}catch{return;}const dx=(tx*256-nw.x)*w/spanX,dy=(ty*256-nw.y)*h/spanY,dw=256*w/spanX,dh=256*h/spanY;ctx.drawImage(bm,dx,dy,dw+1,dh+1);bm.close?.();})());await Promise.all(jobs);try{return c.toDataURL('image/jpeg',.88)}catch{return null;}};
const reportLegendData = d => {
  const label=(key,fallback)=>d.legendLabels?.[key] || fallback;
  const points=[...new Set(d.waypoints.map(w=>w.icon||'pin'))].map(i=>({key:`point:${i}`,type:'point',icon:i,label:label(`point:${i}`,pointIconDef(i).label),color:pointPdfStyle(i)[1]}));
  const tracks=d.tracks.slice(0,8).map((t,i)=>({key:`track:${t.id||i}`,type:'line',label:label(`track:${t.id||i}`,t.name),color:t.color||'#0F766E'}));
  const vectors=d.vectors.slice(0,10).map((v,i)=>({key:`vector:${v.id||i}`,type:v.feature?.geometry?.type?.includes('Polygon')?'polygon':'vector',label:label(`vector:${v.id||i}`,v.name||vectorName(v.feature)),color:v.color||'#7C5CE0'}));
  return {points,tracks,vectors};
};
const reportSvg = d => {
  const b=reportBounds(d.tracks,d.waypoints,d.vectors);if(!b)return '<div class="nomap">Sin geometrías para representar</div>';
  const W=1180,H=650,P=58,xy=reportProjection(b,P,P,W-P*2,H-P*2);let shapes='';
  for(const v of d.vectors){const g=v.feature?.geometry,col=esc(v.color||'#7C5CE0');for(const set of geomCoordSets(g)){if(!set.length)continue;const pts=set.map(p=>xy(p).map(n=>n.toFixed(1)).join(',')).join(' ');if(g.type?.includes('Polygon'))shapes+=`<polygon points="${pts}" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-width="3"/>`;else shapes+=`<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round"/>`;}}
  for(const t of d.tracks){const pts=t.points.map(p=>xy(p).map(n=>n.toFixed(1)).join(',')).join(' ');shapes+=`<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><polyline points="${pts}" fill="none" stroke="${esc(t.color||'#0F766E')}" stroke-width="5" stroke-linecap="round"/>`;}
  d.waypoints.forEach(w=>{const [x,y]=xy([w.lat,w.lng]),[code,col]=pointPdfStyle(w.icon);shapes+=`<circle cx="${x}" cy="${y}" r="12" fill="${col}" stroke="#fff" stroke-width="4"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">${esc(code)}</text>`;});
  const ticks=[];for(let i=0;i<5;i++){const f=i/4,lng=b.minLng+(b.maxLng-b.minLng)*f,lat=b.maxLat-(b.maxLat-b.minLat)*f,x=P+(W-P*2)*f,y=P+(H-P*2)*f;ticks.push(`<text x="${x}" y="28" text-anchor="middle" font-size="13" fill="#394741">${lng.toFixed(3)}</text><text x="${x}" y="${H-15}" text-anchor="middle" font-size="13" fill="#394741">${lng.toFixed(3)}</text><text x="22" y="${y+4}" text-anchor="middle" font-size="13" fill="#394741" transform="rotate(-90 22 ${y+4})">${lat.toFixed(3)}</text><text x="${W-18}" y="${y+4}" text-anchor="middle" font-size="13" fill="#394741" transform="rotate(90 ${W-18} ${y+4})">${lat.toFixed(3)}</text>`)}
  return `<svg viewBox="0 0 ${W} ${H}" class="carto-svg"><rect width="${W}" height="${H}" fill="#F7F8F5"/><rect x="${P}" y="${P}" width="${W-P*2}" height="${H-P*2}" fill="#EEF2EC" stroke="#1E2A25" stroke-width="2"/>${d.basemapDataUrl?`<image href="${d.basemapDataUrl}" x="${P}" y="${P}" width="${W-P*2}" height="${H-P*2}" preserveAspectRatio="none"/>`:``}<rect x="${P}" y="${P}" width="${W-P*2}" height="${H-P*2}" fill="none" stroke="#1E2A25" stroke-width="2"/><g stroke="#ffffff" stroke-opacity=".25" stroke-width="1">${[1,2,3].map(i=>`<path d="M${P} ${P+i*(H-P*2)/4}H${W-P}"/><path d="M${P+i*(W-P*2)/4} ${P}V${H-P}"/>`).join('')}</g>${shapes}<g>${ticks.join('')}</g></svg>`;
};
const logoDataUrl = async () => {const img=new Image();img.src='icon-512.png';await img.decode();const c=document.createElement('canvas');c.width=c.height=512;c.getContext('2d').drawImage(img,0,0,512,512);return c.toDataURL('image/png');};
const drawNorthRose=(doc,x,y,size=18)=>{const r=size/2;doc.setFillColor(12,27,21);doc.setDrawColor(255,255,255);doc.setLineWidth(.6);doc.roundedRect(x-r,y-r,size,size,2,2,'FD');doc.setFillColor(255,255,255);doc.triangle(x,y-r+3,x+3,y+2,x,y-1,'F');doc.setFillColor(216,183,111);doc.triangle(x,y+r-3,x-3,y-2,x,y+1,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(Math.max(6,size*.33));doc.text('N',x,y-r-1,{align:'center'});};
const drawScaleBar=(doc,b,x,y,w)=>{const mid=(b.minLat+b.maxLat)/2,widthM=hav([mid,b.minLng],[mid,b.maxLng]),scaleM=niceScale(widthM*.22),bar=Math.min(w*.27,w*(scaleM/widthM));doc.setFillColor(255,255,255);doc.roundedRect(x-2,y-7,bar+4,12,2,2,'F');doc.setDrawColor(24,34,30);doc.setLineWidth(1.8);doc.line(x,y,x+bar,y);doc.setLineWidth(.5);[0,.5,1].forEach(f=>doc.line(x+bar*f,y-2,x+bar*f,y+2));doc.setFont('helvetica','bold');doc.setFontSize(5.5);doc.setTextColor(24,34,30);doc.text(scaleM>=1000?`${scaleM/1000} km`:`${Math.round(scaleM)} m`,x+bar/2,y-3,{align:'center'});};
const drawPdfMap=(doc,d,x,y,w,h)=>{
  const b=reportBounds(d.tracks,d.waypoints,d.vectors);doc.setFillColor(255,255,255);doc.rect(x,y,w,h,'F');if(!b){doc.setTextColor(100);doc.setFontSize(9);doc.text('Sin geometrías para representar',x+8,y+12);return null;}
  const mx=8,my=7,fx=x+mx,fy=y+my,fw=w-mx*2,fh=h-my*2;
  if(d.basemapDataUrl){try{doc.addImage(d.basemapDataUrl,'JPEG',fx,fy,fw,fh,undefined,'FAST')}catch{doc.setFillColor(233,238,232);doc.rect(fx,fy,fw,fh,'F')}}else{doc.setFillColor(233,238,232);doc.rect(fx,fy,fw,fh,'F')}
  doc.setDrawColor(255,255,255);doc.setLineWidth(.15);for(let i=1;i<4;i++){doc.line(fx,fy+i*fh/4,fx+fw,fy+i*fh/4);doc.line(fx+i*fw/4,fy,fx+i*fw/4,fy+fh)}
  const xy=reportProjection(b,fx,fy,fw,fh);
  for(const v of d.vectors){const g=v.feature?.geometry,rgb=hexRgb(v.color),pale=paleRgb(v.color);for(const set of geomCoordSets(g)){if(set.length<1)continue;const pts=set.map(xy);if(g.type?.includes('Polygon')){doc.setDrawColor(...rgb);doc.setFillColor(...pale);doc.setLineWidth(.65);for(let i=1;i<pts.length;i++)doc.line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]);if(pts.length>2)doc.line(pts.at(-1)[0],pts.at(-1)[1],pts[0][0],pts[0][1]);}else{doc.setDrawColor(...rgb);doc.setLineWidth(.85);for(let i=1;i<pts.length;i++)doc.line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]);}}}
  for(const t of d.tracks){const pts=t.points.map(p=>xy([p[0],p[1]])),rgb=hexRgb(t.color);doc.setDrawColor(255,255,255);doc.setLineWidth(2.8);for(let i=1;i<pts.length;i++)doc.line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]);doc.setDrawColor(...rgb);doc.setLineWidth(1.4);for(let i=1;i<pts.length;i++)doc.line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]);}
  d.waypoints.forEach(wp=>{const q=xy([wp.lat,wp.lng]),[code,col]=pointPdfStyle(wp.icon),rgb=hexRgb(col);doc.setFillColor(...rgb);doc.setDrawColor(255,255,255);doc.setLineWidth(.9);doc.circle(q[0],q[1],2.7,'FD');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(code.length>1?3:4.4);doc.text(code,q[0],q[1]+1.1,{align:'center'});});
  doc.setDrawColor(32,43,38);doc.setLineWidth(.55);doc.rect(fx,fy,fw,fh,'S');doc.setFont('helvetica','normal');doc.setFontSize(4.8);doc.setTextColor(48,58,54);
  for(let i=0;i<5;i++){const f=i/4,lng=b.minLng+(b.maxLng-b.minLng)*f,lat=b.maxLat-(b.maxLat-b.minLat)*f,px=fx+fw*f,py=fy+fh*f;doc.text(lng.toFixed(4),px,fy-2.1,{align:'center'});doc.text(lng.toFixed(4),px,fy+fh+4.5,{align:'center'});doc.text(lat.toFixed(4),fx-3.2,py,{align:'center',angle:90});doc.text(lat.toFixed(4),fx+fw+3.2,py,{align:'center',angle:90});}
  const n=d.layout?.north||{x:.88,y:.07,w:.09,h:.18},sc=d.layout?.scale||{x:.05,y:.84,w:.30,h:.10};drawNorthRose(doc,fx+fw*n.x,fy+fh*n.y,Math.max(12,Math.min(25,fw*n.w)));drawScaleBar(doc,b,fx+fw*sc.x,fy+fh*(sc.y+sc.h*.65),Math.max(30,fw*sc.w));return b;
};
const drawPdfLegend=(doc,d,x,y,w,h,b)=>{doc.setFillColor(250,249,245);doc.roundedRect(x,y,w,h,3,3,'F');doc.setDrawColor(224,220,210);doc.roundedRect(x,y,w,h,3,3,'S');let yy=y+8;const section=t=>{doc.setTextColor(27,37,33);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text(t,x+5,yy);yy+=5};const row=(label,color,type='line',code='')=>{if(yy>y+h-28)return;const rgb=hexRgb(color);if(type==='polygon'){doc.setFillColor(...paleRgb(color));doc.setDrawColor(...rgb);doc.rect(x+5,yy-2.4,7,4,'FD')}else if(type==='point'){doc.setFillColor(...rgb);doc.circle(x+8.5,yy-.5,2.3,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(3);doc.text(code,x+8.5,yy+.3,{align:'center'})}else{doc.setDrawColor(...rgb);doc.setLineWidth(1.1);doc.line(x+5,yy-.5,x+12,yy-.5)}doc.setTextColor(70,81,76);doc.setFont('helvetica','normal');doc.setFontSize(5.5);doc.text(String(label).slice(0,34),x+15,yy);yy+=5.2};
  section(d.reportText.legendTitle); const lg=reportLegendData(d); if(lg.tracks.length){doc.setFontSize(5.3);doc.setTextColor(115);doc.text(d.reportText.legendGroupTracks,x+5,yy);yy+=4;lg.tracks.forEach(e=>row(e.label,e.color));} if(lg.vectors.length){yy+=1;doc.setFontSize(5.3);doc.setTextColor(115);doc.text(d.reportText.legendGroupVectors,x+5,yy);yy+=4;lg.vectors.forEach(e=>row(e.label,e.color,e.type));} if(lg.points.length){yy+=1;doc.setFontSize(5.3);doc.setTextColor(115);doc.text(d.reportText.legendGroupPoints,x+5,yy);yy+=4;lg.points.forEach(e=>{const [code,col]=pointPdfStyle(e.icon);row(e.label,col,'point',code)});}
  const metaY=Math.max(yy+4,y+h-43);doc.setDrawColor(224,220,210);doc.line(x+5,metaY-4,x+w-5,metaY-4);doc.setTextColor(27,37,33);doc.setFont('helvetica','bold');doc.setFontSize(6);doc.text(d.reportText.metaTitle,x+5,metaY);doc.setFont('helvetica','normal');doc.setTextColor(82,93,88);doc.setFontSize(5.2);const rows=[`Área: ${d.areaName}`,`CRS: WGS 84 · EPSG:4326`,`Fecha: ${new Date().toLocaleDateString('es-MX')}`,`Rutas: ${d.tracks.length} · Puntos: ${d.waypoints.length}`,`Capas SIG: ${d.vectors.length}`,b?`Extensión N ${b.maxLat.toFixed(4)} · S ${b.minLat.toFixed(4)}`:'',`Elaborado por: ${d.author}`];rows.filter(Boolean).forEach((s,i)=>doc.text(s,x+5,metaY+5+i*4));};
const drawPdfLegendCompact=(doc,d,x,y,w,h)=>{doc.setFillColor(255,255,255);doc.setDrawColor(198,205,201);doc.roundedRect(x,y,w,h,2.5,2.5,'FD');let yy=y+7;doc.setTextColor(27,37,33);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text(d.reportText.legendTitle,x+4,yy);yy+=5;const lg=reportLegendData(d),rows=[...lg.tracks.map(e=>({...e,kind:'line'})),...lg.vectors.map(e=>({...e,kind:e.type})),...lg.points.map(e=>({...e,kind:'point'}))].slice(0,11);for(const e of rows){if(yy>y+h-4)break;const rgb=hexRgb(e.color);if(e.kind==='point'){doc.setFillColor(...rgb);doc.circle(x+6,yy-.5,1.8,'F')}else if(e.kind==='polygon'){doc.setFillColor(...paleRgb(e.color));doc.setDrawColor(...rgb);doc.rect(x+4,yy-2.2,5,3.4,'FD')}else{doc.setDrawColor(...rgb);doc.setLineWidth(.9);doc.line(x+4,yy-.5,x+9,yy-.5)}doc.setTextColor(63,73,68);doc.setFont('helvetica','normal');doc.setFontSize(4.8);doc.text(String(e.label).slice(0,26),x+12,yy);yy+=4.4;}};
const createReportPdf = async (projectId,compose={}) => {
  if(!window.jspdf?.jsPDF)throw new Error('Motor PDF no disponible');const data=reportScope(projectId,compose),{jsPDF}=window.jspdf;data.basemapDataUrl=await buildReportBasemap(reportBounds(data.tracks,data.waypoints,data.vectors),1180,650,data.mapStyle==='streets'?'cartoVoyager':'esriSat').catch(()=>null);const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});const W=297,H=210,M=9;const logo=await logoDataUrl().catch(()=>null);
  // Lámina cartográfica principal, estilo editorial 2.9
  doc.setFillColor(255,255,255);doc.rect(0,0,W,H,'F');if(logo)doc.addImage(logo,'PNG',M+2,M+1,14,14);doc.setTextColor(20,26,23);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text(data.title,M+20,M+7);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(82,97,90);doc.text(data.areaName,M+20,M+13);doc.setTextColor(166,126,66);doc.setFont('helvetica','bold');doc.setFontSize(6.3);doc.text(data.reportText.mapKind,W-M,M+7,{align:'right'});doc.setTextColor(102,113,108);doc.setFont('helvetica','normal');doc.setFontSize(5.5);doc.text('TerraPin Field GIS · CARTOGRAFÍA DE CAMPO',W-M,M+13,{align:'right'});doc.setDrawColor(207,213,209);doc.line(M,M+18,W-M,M+18);
  const mapX=M+2,mapY=M+23,mapW=W-M*2-4,mapH=142;const b=drawPdfMap(doc,data,mapX,mapY,mapW,mapH);const lg=data.layout?.legend||{x:.75,y:.60,w:.21,h:.29};drawPdfLegendCompact(doc,data,mapX+mapW*lg.x,mapY+mapH*lg.y,Math.max(34,mapW*lg.w),Math.max(30,mapH*lg.h));
  const fy=mapY+mapH+5,fh=24,fw=(mapW)/3;doc.setDrawColor(198,204,200);doc.setFillColor(250,251,249);for(let i=0;i<3;i++)doc.roundedRect(mapX+i*fw,fy,fw,fh,i===0?2:0,i===0?2:0,'FD');doc.setFont('helvetica','normal');doc.setFontSize(5);doc.setTextColor(102,112,107);doc.text('Elaborado por',mapX+4,fy+5);doc.text('Sistema de coordenadas',mapX+fw+4,fy+5);doc.text('Fecha',mapX+2*fw+4,fy+5);doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(28,38,34);doc.text(data.author,mapX+4,fy+11,{maxWidth:fw-8});doc.text('WGS 84 · EPSG:4326',mapX+fw+4,fy+11);doc.text(new Date().toLocaleDateString('es-MX'),mapX+2*fw+4,fy+11);doc.setFont('helvetica','normal');doc.setFontSize(5);doc.setTextColor(87,100,94);doc.text(data.reportText.orientationLine,mapX+fw+4,fy+17,{maxWidth:fw-8});doc.text(data.reportText.sourceLine,mapX+2*fw+4,fy+17,{maxWidth:fw-8});
  // page 2 - inventory
  doc.addPage('a4','landscape');doc.setFillColor(16,23,20);doc.rect(0,0,W,25,'F');if(logo)doc.addImage(logo,'PNG',M,4,17,17);doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('Inventario cartográfico',M+23,11);doc.setFontSize(8);doc.setTextColor(211,226,219);doc.text(`${data.title} · ${data.areaName}`,M+23,17);let y=35;const section=t=>{doc.setTextColor(27,37,33);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(t,M,y);y+=6};const space=n=>{if(y+n>195){doc.addPage('a4','landscape');y=18;}};
  section('Rutas registradas');if(!data.tracks.length){doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(100);doc.text('Sin rutas registradas.',M,y);y+=8}else for(const t of data.tracks){space(8);const st=trackStats(t),rgb=hexRgb(t.color);doc.setFillColor(...rgb);doc.roundedRect(M,y-2,3,5,1,1,'F');doc.setTextColor(30,40,36);doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text(t.name,M+6,y+1,{maxWidth:90});doc.setFont('helvetica','normal');doc.setTextColor(90);doc.text(`${fmtDist(st.dist)} · ${fmtTime(st.dur)} · ${new Date(t.created).toLocaleDateString('es-MX')}`,M+105,y+1);y+=7;}
  y+=4;section('Puntos de campo');if(!data.waypoints.length){doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(100);doc.text('Sin puntos registrados.',M,y)}else for(const w of data.waypoints){space(9);const [code,col]=pointPdfStyle(w.icon),rgb=hexRgb(col);doc.setFillColor(...rgb);doc.circle(M+2.5,y-.6,2.3,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(3);doc.text(code,M+2.5,y+.2,{align:'center'});doc.setTextColor(30,40,36);doc.setFontSize(7);doc.text(w.name,M+7,y,{maxWidth:80});doc.setFont('helvetica','normal');doc.setTextColor(90);doc.setFontSize(6);doc.text(`${w.lat.toFixed(6)}, ${w.lng.toFixed(6)}${w.notes?' · '+w.notes.slice(0,75):''}`,M+92,y);y+=7;}
  const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(5);doc.setTextColor(112);doc.text(`TerraPin Field GIS · ${data.title} · Elaborado por: ${data.author}`,M,H-4);doc.text(`Página ${i} de ${pages}`,W-M,H-4,{align:'right'});}return{doc,data,filename:`TerraPin-Mapa-${safeFile(data.title)}-${new Date().toISOString().slice(0,10)}.pdf`};
};
const editableText=(value,key,cls='')=>`<span class="pdf-editable ${cls}" contenteditable="true" spellcheck="false" data-edit="${key}" title="Toca para editar">${esc(value)}</span>`;
const previewLegendHtml=d=>{const l=reportLegendData(d),row=e=>`<div class="map-legend-row" data-legend-key="${esc(e.key)}"><i style="--c:${esc(e.color)}" class="${e.type}"></i>${editableText(e.label,`legend:${e.key}`,'legend-label')}</div>`;return `<div class="map-legend"><h5>${editableText(d.reportText.legendTitle,'legendTitle')}</h5>${l.tracks.length?'<small>'+editableText(d.reportText.legendGroupTracks,'legendGroupTracks')+'</small>'+l.tracks.map(row).join(''):''}${l.vectors.length?'<small>'+editableText(d.reportText.legendGroupVectors,'legendGroupVectors')+'</small>'+l.vectors.map(row).join(''):''}${l.points.length?'<small>'+editableText(d.reportText.legendGroupPoints,'legendGroupPoints')+'</small>'+l.points.map(e=>{const [code,col]=pointPdfStyle(e.icon);return `<div class="map-legend-row" data-legend-key="${esc(e.key)}"><i class="point" style="--c:${col}">${esc(code)}</i>${editableText(e.label,`legend:${e.key}`,'legend-label')}</div>`}).join(''):''}</div>`};
const widgetStyle=(q)=>`left:${(q.x*100).toFixed(2)}%;top:${(q.y*100).toFixed(2)}%;width:${(q.w*100).toFixed(2)}%;height:${(q.h*100).toFixed(2)}%`;
const previewReportBody=d=>{const L=d.layout||{legend:{x:.75,y:.60,w:.21,h:.29},north:{x:.88,y:.07,w:.09,h:.18},scale:{x:.05,y:.84,w:.30,h:.10}};return `<div class="map-sheet"><div class="map-sheet-head"><img src="icon-512.png"><div><b>${editableText(d.title,'title','map-title-edit')}</b><span>${editableText(d.areaName,'area','map-area-edit')}</span></div><aside><strong>${editableText(d.reportText.mapKind,'mapKind')}</strong><small>TerraPin Field GIS · ${new Date().toLocaleDateString('es-MX')}</small></aside></div><div class="map-sheet-main"><div class="map-canvas" id="editableMapCanvas">${reportSvg(d)}<div class="map-widget legend-widget" data-widget="legend" style="${widgetStyle(L.legend)}"><span class="widget-move">•••</span>${previewLegendHtml(d)}<span class="widget-resize"></span></div><div class="map-widget north-widget" data-widget="north" style="${widgetStyle(L.north)}"><span class="widget-move">•••</span><div class="north-rose-hi"><b>N</b><span class="s">S</span><span class="e">E</span><span class="o">O</span></div><span class="widget-resize"></span></div><div class="map-widget scale-widget" data-widget="scale" style="${widgetStyle(L.scale)}"><span class="widget-move">•••</span><div class="scale-widget-inner"><div class="scale-label"><span>0</span><span>1</span><span>2</span><span>4 km</span></div><div class="scale-line"></div></div><span class="widget-resize"></span></div></div></div><footer><span><small>Elaborado por</small><b>${editableText(d.author,'authorFooter')}</b></span><span><small>Sistema de coordenadas</small><b>WGS 84 · EPSG:4326</b><em>${editableText(d.reportText.orientationLine,'orientationLine')}</em></span><span><small>Fecha</small><b>${new Date().toLocaleDateString('es-MX')}</b><em>${editableText(d.reportText.sourceLine,'sourceLine')}</em></span></footer></div>`};
const bindMapWidgets=()=>{const canvas=$('#editableMapCanvas');if(!canvas)return;canvas.querySelectorAll('.map-widget').forEach(w=>{w.onclick=e=>{if(e.target.closest('[contenteditable="true"]'))return;canvas.querySelectorAll('.map-widget').forEach(x=>x.classList.remove('selected'));w.classList.add('selected')};let state=null;const down=e=>{if(e.target.closest('[contenteditable="true"]'))return;const resize=e.target.classList.contains('widget-resize'),cr=canvas.getBoundingClientRect(),wr=w.getBoundingClientRect();state={id:e.pointerId,resize,cr,sx:e.clientX,sy:e.clientY,left:wr.left-cr.left,top:wr.top-cr.top,width:wr.width,height:wr.height};w.setPointerCapture?.(e.pointerId);w.classList.add('selected');e.preventDefault()};const move=e=>{if(!state||e.pointerId!==state.id)return;const dx=e.clientX-state.sx,dy=e.clientY-state.sy;if(state.resize){const nw=Math.max(50,Math.min(state.cr.width-state.left,state.width+dx)),nh=Math.max(38,Math.min(state.cr.height-state.top,state.height+dy));w.style.width=nw+'px';w.style.height=nh+'px'}else{const nl=Math.max(0,Math.min(state.cr.width-state.width,state.left+dx)),nt=Math.max(0,Math.min(state.cr.height-state.height,state.top+dy));w.style.left=nl+'px';w.style.top=nt+'px'}e.preventDefault()};const up=e=>{if(!state||e.pointerId!==state.id)return;state=null};w.addEventListener('pointerdown',down);w.addEventListener('pointermove',move);w.addEventListener('pointerup',up);w.addEventListener('pointercancel',up)});};
const printPreviewData=d=>{const html=`<!doctype html><html><head><meta charset="utf-8"><title>Mapa TerraPin</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17201d;margin:0}.map-sheet{width:100%}.map-sheet-head{min-height:18mm;background:#fff;color:#151a18;border-bottom:.3mm solid #d7dad6;padding:2mm 3mm;display:flex;align-items:center;gap:3mm}.map-sheet-head img{width:17mm;height:17mm;background:#fff;border-radius:4mm}.map-sheet-head div{flex:1}.map-sheet-head b,.map-sheet-head span,.map-sheet-head aside strong,.map-sheet-head aside small{display:block}.map-sheet-head b{font-size:16pt}.map-sheet-head span{font-size:8pt;color:#52615b;margin-top:1mm}.map-sheet-head aside{text-align:right}.map-sheet-head aside strong{font-size:6.5pt;color:#a57e42}.map-sheet-head aside small{font-size:6pt;margin-top:2mm;color:#64716c}.map-sheet-main{position:relative;display:block;margin-top:2mm}.map-canvas{background:#f3f5f1;border:.3mm solid #bfc7c2;padding:.6mm}.map-canvas svg{display:block;width:100%;height:auto}.map-legend{position:absolute;right:4mm;bottom:5mm;width:48mm;max-height:62mm;overflow:hidden;border:.3mm solid #c9d0cc;background:rgba(255,255,255,.95);border-radius:3mm;padding:3mm;box-shadow:0 1.5mm 4mm rgba(0,0,0,.14)}.map-legend h5{font-size:7pt;margin:0 0 3mm}.map-legend small{display:block;font-size:5.5pt;color:#7a827e;text-transform:uppercase;margin:2mm 0 1mm}.map-legend-row{display:flex;align-items:center;gap:2mm;font-size:5.5pt;margin:1.2mm 0}.map-legend-row i{width:7mm;height:1.4mm;background:var(--c);border-radius:2mm}.map-legend-row i.polygon{height:4mm;opacity:.55}.map-legend-row i.point{height:5mm;width:5mm;border-radius:50%;color:#fff;display:grid;place-items:center;font-size:3.5pt}.map-meta{border-top:1px solid #dedad0;margin-top:3mm;padding-top:3mm;font-size:5pt}.map-meta b,.map-meta span{display:block;margin-top:1.2mm}footer{display:grid;grid-template-columns:1.1fr 1fr 1fr;border:.3mm solid #c9cecb;margin-top:2mm;padding:0;font-size:5pt;color:#26332e}footer>span{padding:2.2mm;border-right:.3mm solid #d7dad6}footer>span:last-child{border-right:0}footer small,footer b,footer em{display:block}.pdf-editable{outline:none}</style></head><body>${previewReportBody(d)}</body></html>`;const f=document.createElement('iframe');f.style.cssText='position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0';document.body.appendChild(f);f.srcdoc=html;f.onload=()=>setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch{}setTimeout(()=>f.remove(),3000)},300);};
const savePdfFile=async(doc,filename)=>{const blob=doc.output('blob');const file=typeof File!=='undefined'?new File([blob],filename,{type:'application/pdf'}):null;if(file&&navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'Mapa TerraPin',text:'Mapa cartográfico generado en TerraPin',files:[file]});}else{downloadBlob(filename,blob);toast('PDF guardado')}};
const saveReportComposition=async(projectId,c)=>{if(projectId){const p=S.projects.find(x=>x.id===projectId);if(p){p.areaName=c.areaName;p.reportTitle=c.title;p.reportAuthor=c.author;p.reportLegendLabels=c.legendLabels||{};p.reportText=c.reportText||{};p.reportLayout=c.layout||{};p.reportMapStyle=c.mapStyle||'satellite'}}else{S.settings.reportAreaName=c.areaName;S.settings.reportTitle=c.title;S.settings.reportAuthor=c.author;S.settings.reportLegendLabels=c.legendLabels||{};S.settings.reportText=c.reportText||{};S.settings.reportLayout=c.layout||{};S.settings.reportMapStyle=c.mapStyle||'satellite'}await save();};
const collectPdfEdits=(base={})=>{const root=$('#pdfPreview'),out={...base,legendLabels:{...(base.legendLabels||{})},reportText:{...(base.reportText||{})}};if(!root)return out;const text=k=>root.querySelector(`[data-edit="${k}"]`)?.textContent?.trim();out.title=text('title')||base.title;out.areaName=text('area')||base.areaName;out.author=text('authorFooter')||text('authorMeta')||base.author;['mapKind','legendTitle','legendGroupTracks','legendGroupVectors','legendGroupPoints','metaTitle','sourceLine','orientationLine'].forEach(k=>{const v=text(k);if(v)out.reportText[k]=v});root.querySelectorAll('[data-edit^="legend:"]').forEach(el=>{const k=el.dataset.edit.slice(7),v=el.textContent.trim();if(v)out.legendLabels[k]=v});const canvas=root.querySelector('#editableMapCanvas');if(canvas){out.layout={...(out.layout||{})};const cr=canvas.getBoundingClientRect();canvas.querySelectorAll('[data-widget]').forEach(w=>{const r=w.getBoundingClientRect();out.layout[w.dataset.widget]={x:(r.left-cr.left)/cr.width,y:(r.top-cr.top)/cr.height,w:r.width/cr.width,h:r.height/cr.height}})};out.mapStyle=root.closest('.composition-box')?.querySelector('[data-pdfbase].active')?.dataset.pdfbase||out.mapStyle||'satellite';return out;};
const syncEditorInputsFromPreview=()=>{const r=$('#pdfPreview');if(!r)return;const get=k=>r.querySelector(`[data-edit="${k}"]`)?.textContent?.trim()||'';if($('#pdfTitle'))$('#pdfTitle').value=get('title');if($('#pdfAreaName'))$('#pdfAreaName').value=get('area');if($('#pdfAuthor'))$('#pdfAuthor').value=get('authorFooter')||get('authorMeta');};
const bindPdfEditor=()=>{bindMapWidgets();$('#pdfPreview')?.querySelectorAll('[contenteditable="true"]').forEach(el=>{el.onfocus=()=>el.classList.add('editing');el.onblur=()=>{el.classList.remove('editing');syncEditorInputsFromPreview()};el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el.blur()}}});};
const fitCompositionPreview=()=>{const root=$('#pdfPreview'),sheet=root?.querySelector('.map-sheet');if(!root||!sheet)return;const base=760;sheet.style.width=base+'px';sheet.style.minWidth=base+'px';sheet.style.transform='none';root.style.height='auto';const available=Math.max(280,root.clientWidth-16),scale=Math.min(1,available/base);sheet.style.transform=`scale(${scale})`;sheet.style.transformOrigin='top left';root.style.height=Math.ceil(sheet.scrollHeight*scale+16)+'px';root.dataset.scale=String(scale)};
const bindCompositionPanel=()=>{const panel=$('#compositionPanel'),toggle=$('#compositionCollapse');if(!panel||!toggle)return;if(window.innerWidth<700)panel.classList.add('collapsed');toggle.onclick=()=>{panel.classList.toggle('collapsed');setTimeout(fitCompositionPreview,80)};$('#compositionPanelTitle')?.addEventListener('click',()=>{if(panel.classList.contains('collapsed')){panel.classList.remove('collapsed');setTimeout(fitCompositionPreview,80)}})};
const previewReportPdf=async(projectId,preferPrint=false)=>{try{
  const p=projectId?S.projects.find(x=>x.id===projectId):null;
  let compose={title:p?.reportTitle||p?.name||S.settings.reportTitle||'Mapa general de campo',areaName:p?.areaName||S.settings.reportAreaName||'Área de trabajo',author:p?.reportAuthor||S.settings.reportAuthor||'Jesús Reynaldo Ordoñez Pech',legendLabels:{...(p?.reportLegendLabels||S.settings.reportLegendLabels||{})},reportText:{...(p?.reportText||S.settings.reportText||{})},layout:{...(p?.reportLayout||S.settings.reportLayout||{})},mapStyle:p?.reportMapStyle||S.settings.reportMapStyle||'satellite'};
  let bundle=await createReportPdf(projectId,compose);
  const toolbar=`<div class="composition-direct-toolbar"><button class="active"><b>↖</b>Seleccionar</button><button><b>T</b>Texto</button><button><b>▣</b>Leyenda</button><button><b>▲</b>Norte</button><button><b>━</b>Escala</button></div>`;
  openModal(`<div class="composition-top"><div class="composition-brand"><img src="icon-192.png" alt=""><div class="composition-brand-copy"><strong>TerraPin</strong><span>Editor de composición cartográfica</span></div></div><div class="composition-format">A4 HORIZONTAL · PDF · 3.3</div></div><div class="composition-drawer-wrap" id="compositionDrawerWrap"><button class="composition-drawer-toggle" id="compositionDrawerToggle"><span class="drawer-icon">☷</span><span><strong>Herramientas de composición</strong><small>Texto, leyenda, norte, escala, fondo y más…</small></span><span class="drawer-chevron">⌄</span></button><div class="composition-drawer"><div class="composition-drawer-inner">${toolbar}<div class="composition-basemap"><span>Fondo de la lámina</span><button data-pdfbase="satellite" class="${compose.mapStyle!=='streets'?'active':''}">Satélite</button><button data-pdfbase="streets" class="${compose.mapStyle==='streets'?'active':''}">Calles / Blanco</button></div><div class="composition-hint"><b>EDICIÓN DIRECTA</b><span>Toca el título para editar. Arrastra Leyenda, Norte o Escala y usa el punto azul para cambiar su tamaño.</span><button id="pdfFit">Ajustar a página</button></div></div></div></div><div class="composition-stage" id="compositionStage"><div class="pdf-preview-wrap map-preview" id="pdfPreview">${previewReportBody(bundle.data)}</div></div><div class="composition-actions"><button class="btn ghost" data-close>Cerrar</button><button class="btn ghost" id="pdfPrint">Imprimir</button><button class="btn primary" id="pdfSave">Guardar PDF</button></div>`);
  modal.classList.add('composition-mode');$('#modalBox').classList.add('composition-box');bindPdfEditor();
  const drawer=$('#compositionDrawerWrap'),toggle=$('#compositionDrawerToggle');
  toggle.onclick=()=>{drawer.classList.toggle('open');requestAnimationFrame(()=>setTimeout(fitCompositionPreview,80));};
  requestAnimationFrame(()=>setTimeout(fitCompositionPreview,80));
  const rebuild=async()=>{compose=collectPdfEdits(compose);await saveReportComposition(projectId,compose);bundle=await createReportPdf(projectId,compose);$('#pdfPreview').innerHTML=previewReportBody(bundle.data);bindPdfEditor();document.querySelectorAll('[data-pdfbase]').forEach(b=>b.classList.toggle('active',b.dataset.pdfbase===compose.mapStyle));requestAnimationFrame(()=>setTimeout(fitCompositionPreview,50));return bundle};
  document.querySelectorAll('[data-pdfbase]').forEach(b=>b.onclick=async()=>{compose=collectPdfEdits(compose);compose.mapStyle=b.dataset.pdfbase;document.querySelectorAll('[data-pdfbase]').forEach(x=>x.classList.toggle('active',x===b));await rebuild()});
  $('#pdfFit').onclick=()=>fitCompositionPreview();$('#pdfSave').onclick=async()=>{const b=await rebuild();await savePdfFile(b.doc,b.filename)};$('#pdfPrint').onclick=async()=>{const b=await rebuild();printPreviewData(b.data)};if(preferPrint)setTimeout(()=>$('#pdfPrint')?.focus(),80)
}catch(e){console.error(e);toast('No se pudo generar la composición cartográfica')}};
const shareOrDownloadPdf=projectId=>previewReportPdf(projectId,false);const printReport=projectId=>previewReportPdf(projectId,true);

const projName = id => S.projects.find(p => p.id === id)?.name || 'Sin proyecto';
const folderById = id => S.folders.find(f => f.id === id);
const folderPath = id => { if(!id)return 'General'; const names=[],seen=new Set(); let f=folderById(id); while(f&&!seen.has(f.id)){seen.add(f.id);names.unshift(f.name);f=folderById(f.parentId)} return names.length?names.join(' / '):'General'; };
const folderName = id => folderPath(id);
const folderDescendants = id => { const out=new Set(); const walk=p=>S.folders.filter(f=>(f.parentId||null)===(p||null)).forEach(f=>{if(f.id!==id){out.add(f.id);walk(f.id)}}); walk(id); return out; };
const folderOptions = (selected=null, excludeId=null) => { const blocked=excludeId?new Set([excludeId,...folderDescendants(excludeId)]):new Set(); const rows=['<option value="">General</option>']; const walk=(parent,depth)=>S.folders.filter(f=>(f.parentId||null)===(parent||null)&&!blocked.has(f.id)).sort((a,b)=>a.name.localeCompare(b.name,'es')).forEach(f=>{rows.push(`<option value="${f.id}" ${f.id===selected?'selected':''}>${'— '.repeat(depth)}${esc(f.name)}</option>`);walk(f.id,depth+1)}); walk(null,0); return rows.join(''); };
const projOptions = sel => `<option value="">Sin proyecto</option>` + S.projects.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(folderPath(p.folderId))} / ${esc(p.name)}</option>`).join('');
const projectCardHtml = p => { const nt=S.tracks.filter(t=>t.projectId===p.id).length,nw=S.waypoints.filter(w=>w.projectId===p.id).length,nv=S.vectors.filter(v=>v.projectId===p.id).length; return `<div class="item ${p.id===S.settings.activeProject?'sel':''}" data-proj="${p.id}"><div class="grow"><div class="ttl">${esc(p.name)}${nv?`<span class="vector-badge">GIS ${nv}</span>`:''}</div><div class="sub">${nt} ruta(s) · ${nw} punto(s)${nv?` · ${nv} capa(s)`:''}${p.id===S.settings.activeProject?' · activo':''}</div><div class="folder-path">${esc(folderPath(p.folderId))}</div></div><button class="mini" data-pmenu="${p.id}">${ICON.more}</button></div>`; };
const folderTreeHtml = (parent=null,depth=0) => S.folders.filter(f=>(f.parentId||null)===(parent||null)).sort((a,b)=>a.name.localeCompare(b.name,'es')).map(f=>{const ps=S.projects.filter(p=>(p.folderId||null)===f.id),open=S.settings.openFolders[f.id]!==false,children=folderTreeHtml(f.id,depth+1);return `<div class="folder ${depth?'nested':''}" data-folder-id="${f.id}"><div class="fhead" data-fold="${f.id}"><span class="mini" style="color:var(--amber)">${ICON.folder}</span><span class="grow"><b>${esc(f.name)}</b><span class="folder-depth">${depth?'Subcarpeta':'Carpeta'}</span></span><span class="muted">${ps.length}</span><button class="mini" data-fmenu="${f.id}">${ICON.more}</button></div>${open?`<div class="fbody list">${ps.map(projectCardHtml).join('')}${children||(!ps.length?'<div class="muted" style="padding:6px 10px">Sin proyectos</div>':'')}</div>`:''}</div>`}).join('');
const refreshProjectHud = () => { const p=S.projects.find(x=>x.id===S.settings.activeProject); const el=$('#projectHud'); if(el)el.textContent=p?`Proyecto · ${p.name}`:'Sin proyecto activo'; };
const layoutFloatingChrome = () => {
  const stack = $('#bottomStack'), tools = document.querySelector('.fabcol'), topbar=document.querySelector('.topbar'), nav=document.querySelector('.bottom-stack .nav');
  if(!stack || !tools) return;
  const sr = stack.getBoundingClientRect();
  const clear = Math.max(142, Math.round(window.innerHeight - sr.top + 10));
  document.documentElement.style.setProperty('--tp34-stack-clear', clear + 'px');
  tools.style.setProperty('top','auto','important');
  tools.style.setProperty('bottom', clear + 'px','important');
  if(topbar&&nav){const tr=topbar.getBoundingClientRect(),nr=nav.getBoundingClientRect();document.documentElement.style.setProperty('--tp35-sheet-top',Math.max(116,Math.round(tr.bottom+7))+'px');document.documentElement.style.setProperty('--tp35-sheet-bottom',Math.max(72,Math.round(window.innerHeight-nr.top+7))+'px');document.body.classList.toggle('sheet-open',!!S.tab);}
};
const refreshMapHud = () => { const c=map.getCenter(), el=$('#mapHud'); if(!el)return; const online=navigator.onLine, gps=!!S.me; el.innerHTML=`<div class="hud-cell"><span class="hud-icon">⌖</span><div><small>Centro</small><b>${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}</b></div></div><div class="hud-cell"><span class="hud-icon">▥</span><div><small>Zoom</small><b>z${map.getZoom()}</b></div></div><div class="hud-cell ${online?'on':'off'}"><div><small>Red</small><b>${online?'En línea':'Sin red'}</b></div></div><div class="hud-cell ${gps?'on':''}"><div><small>GPS</small><b>${gps?'Activo':'Inactivo'}</b></div></div>`; layoutFloatingChrome(); };
map.on('moveend zoomend',refreshMapHud);window.addEventListener('online',refreshMapHud);window.addEventListener('offline',refreshMapHud);window.addEventListener('resize',()=>setTimeout(layoutFloatingChrome,40));window.addEventListener('orientationchange',()=>setTimeout(layoutFloatingChrome,180));
const promptName = (title, val, cb) => { openModal(`<h3>${title}</h3><div class="field"><input id="pmVal" value="${esc(val || '')}" autofocus></div><div class="actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="pmOk">Aceptar</button></div>`); setTimeout(() => $('#pmVal').focus(), 50); $('#pmOk').onclick = () => { const v = $('#pmVal').value.trim(); if (v) { closeModal(); cb(v); } }; };

/* ---------- descargas sin conexión ---------- */
const lng2x = (lng, z) => Math.floor((lng + 180) / 360 * 2 ** z);
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
const countTiles = (b, z0, z1) => { let n = 0; for (let z = z0; z <= z1; z++) n += (lng2x(b.getEast(), z) - lng2x(b.getWest(), z) + 1) * (lat2y(b.getSouth(), z) - lat2y(b.getNorth(), z) + 1); return n; };
let dl = null; // descarga en curso
const runDownload = async (pack) => {
  const src = SOURCES[pack.source]; const b = L.latLngBounds(pack.bounds); const ck = cacheId(pack.source, pack.date);
  dl = { pack, total: 0, done: 0, bytes: 0, failed: 0, ctrl: new AbortController() }; renderSheet();
  const list = []; for (let z = pack.zmin; z <= pack.zmax; z++) { const x0 = lng2x(b.getWest(), z), x1 = lng2x(b.getEast(), z), y0 = lat2y(b.getNorth(), z), y1 = lat2y(b.getSouth(), z); for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) list.push([z, x, y]); }
  const have = new Set(await tileKeys(ck + '/'));
  const todo = list.filter(([z, x, y]) => !have.has(`${ck}/${z}/${x}/${y}`));
  Object.assign(dl, { total: list.length, done: list.length - todo.length });
  let buf = []; let i = 0; let lastFlush = Date.now();
  const flush = async () => { if (buf.length) { const b2 = buf; buf = []; await tilesPut(b2); } };
  const worker = async (wi) => {
    while (i < todo.length && !dl.ctrl.signal.aborted) {
      const [z, x, y] = todo[i++]; const key = `${ck}/${z}/${x}/${y}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { const r = await fetch(tileURL(src, z, x, y, wi, pack.date), { signal: dl.ctrl.signal, cache: 'force-cache' }); if (!r.ok) throw 0; const blob = await r.blob(); buf.push([key, blob]); dl.bytes += blob.size; break; }
        catch (e) { if (dl.ctrl.signal.aborted) return; if (attempt === 1) dl.failed++; else await new Promise(r => setTimeout(r, 300)); }
      }
      dl.done++;
      if (buf.length >= 40 || Date.now() - lastFlush > 2000) { lastFlush = Date.now(); await flush(); }
    }
  };
  const conc = Math.min(16, navigator.hardwareConcurrency ? navigator.hardwareConcurrency * 3 : 8);
  const ui = setInterval(renderDlProgress, 250);
  await Promise.all(Array.from({ length: conc }, (_, k) => worker(k)));
  await flush(); clearInterval(ui);
  pack.count = list.length - dl.failed; pack.bytes = (pack.bytes || 0) + dl.bytes; pack.status = dl.ctrl.signal.aborted ? 'parcial' : (dl.failed ? 'con errores' : 'listo'); pack.updated = Date.now();
  await putPack(pack); if (!S.packs.find(p => p.id === pack.id)) S.packs.push(pack);
  const aborted = dl.ctrl.signal.aborted; dl = null;
  toast(aborted ? 'Descarga pausada; puedes continuarla después' : `Mapa "${pack.name}" descargado`);
  renderSheet();
};
const renderDlProgress = () => { const el = $('#dlProg'); if (!el || !dl) return; const pct = dl.total ? dl.done / dl.total * 100 : 0; el.querySelector('i').style.width = pct + '%'; $('#dlTxt').textContent = `${dl.done.toLocaleString()} / ${dl.total.toLocaleString()} teselas · ${fmtBytes(dl.bytes)}${dl.failed ? ' · ' + dl.failed + ' fallidas' : ''}`; };

/* selección de área arrastrando */
const selbox = $('#selbox'); let selRect;
const pickArea = () => new Promise(res => {
  closeSheet(); selbox.classList.add('on'); showHint('Arrastra para dibujar el área a descargar');
  let p0; const box = document.createElement('div'); box.style.cssText = 'position:absolute;border:2px solid #D9B45B;background:rgba(217,180,91,.18);display:none;pointer-events:none'; selbox.appendChild(box);
  const pt = e => { const t = e.touches ? e.touches[0] : e; return [t.clientX, t.clientY]; };
  const down = e => { e.preventDefault(); p0 = pt(e); box.style.display = 'block'; move(e); };
  const move = e => { if (!p0) return; e.preventDefault(); const p = pt(e); const x = Math.min(p0[0], p[0]), y = Math.min(p0[1], p[1]); box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.width = Math.abs(p[0] - p0[0]) + 'px'; box.style.height = Math.abs(p[1] - p0[1]) + 'px'; };
  const up = e => { if (!p0) return; const p = e.changedTouches ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [e.clientX, e.clientY]; const a = map.containerPointToLatLng(p0), b2 = map.containerPointToLatLng(p); cleanup(); if (Math.abs(p[0] - p0[0]) < 10) return res(null); res(L.latLngBounds(a, b2)); };
  const cleanup = () => { selbox.classList.remove('on'); selbox.innerHTML = ''; hideHint(); selbox.onmousedown = selbox.onmousemove = selbox.onmouseup = selbox.ontouchstart = selbox.ontouchmove = selbox.ontouchend = null; };
  selbox.onmousedown = selbox.ontouchstart = down; selbox.onmousemove = selbox.ontouchmove = move; selbox.onmouseup = selbox.ontouchend = up;
});
const newPackDialog = async (bounds) => {
  if (selRect) { map.removeLayer(selRect); } selRect = L.rectangle(bounds, { color: '#D9B45B', weight: 2, fillOpacity: .1, interactive: false }).addTo(map);
  const z = Math.max(1, Math.round(map.getZoom())); const bm = SOURCES[S.settings.base]?.max || 19; const z1def = Math.min(z + 3, 16, bm), z0def = Math.max(1, Math.min(z - 2, z1def - 3));
  const render = () => { const src = SOURCES[$('#pkSrc').value]; const tip=$('#pkTip'); if(tip) tip.textContent = src.s2 ? `Sentinel-2 a 10 m: pase menos nublado de los últimos ${s2Cfg().days} días (máx. ${s2Cfg().cc} % nubes). Zoom 13–15 muestra calles principales y lotes. Consume cuota de tu cuenta Copernicus.` : src.hls ? `HLS a 30 m del día ${satDate()}: carreteras, parcelas y ríos visibles hasta zoom ${src.max}.` : src.time ? `Imagen GOES de las ${satTime().slice(11,16)} UTC. Detalle máximo zoom ${src.max} (≈1 km por píxel): perfecto para nubes, tormentas y humo en tiempo casi real.` : src.date ? `Esta vista corresponde al día ${satDate()}. Su detalle máximo es zoom ${src.max} (≈300 m por píxel): ideal para contexto regional, nubes, humo o inundaciones.` : 'Consejo: zoom 15–16 es suficiente para caminar; 17–18 para ver casas y veredas. Cada nivel multiplica ×4 el tamaño.'; $('#pkZ1').max = src.max; if (+$('#pkZ1').value > src.max) $('#pkZ1').value = src.max; if (+$('#pkZ0').value > +$('#pkZ1').value) $('#pkZ0').value = Math.max(1, +$('#pkZ1').value - 3); const z0 = +$('#pkZ0').value, z1 = +$('#pkZ1').value; const n = countTiles(bounds, z0, z1); $('#pkEst').innerHTML = `<b>${n.toLocaleString()}</b> teselas · aprox. <b>${fmtBytes(n * src.kb * 1024)}</b>${n > 25000 ? '<br><span style="color:#B3371C">Área muy grande: reduce el zoom máximo o el área.</span>' : ''}`; $('#pkOk').disabled = n > 60000; };
  openModal(`<h3>Descargar mapa</h3>
  <div class="field"><label>Nombre</label><input id="pkName" value="Mapa ${S.packs.length + 1}"></div>
  <div class="field"><label>Fuente</label><select id="pkSrc">${Object.entries(SOURCES).filter(([k, s]) => !s.hidden && !(s.s2 && !s2Ready())).map(([k, s]) => `<option value="${k}" ${k === S.settings.base ? 'selected' : ''}>${s.name}${s.time ? ' · ' + satTime().slice(0,16).replace('T',' ') + ' UTC' : s.s2 ? ' · últimos ' + s2Cfg().days + ' días' : s.date ? ' · ' + satDate() : ''}${s.overlay ? ' (superposición)' : ''}</option>`).join('')}</select></div>
  <div class="grid2"><div class="field"><label>Zoom mínimo</label><input id="pkZ0" type="number" min="1" max="20" value="${z0def}"></div><div class="field"><label>Zoom máximo (detalle)</label><input id="pkZ1" type="number" min="1" max="20" value="${z1def}"></div></div>
  <div class="card" id="pkEst"></div><p class="muted" id="pkTip">Consejo: zoom 15–16 es suficiente para caminar; 17–18 para ver casas y veredas. Cada nivel multiplica ×4 el tamaño.</p>
  <div class="actions"><button class="btn ghost" data-close id="pkCancel">Cancelar</button><button class="btn" id="pkOk">Descargar</button></div>`);
  ['pkSrc', 'pkZ0', 'pkZ1'].forEach(id => $('#' + id).oninput = render); render();
  $('#pkCancel').onclick = () => { map.removeLayer(selRect); selRect = null; };
  $('#pkOk').onclick = () => { const pack = { id: uid(), name: $('#pkName').value.trim() || 'Mapa', source: $('#pkSrc').value, date: satStamp(SOURCES[$('#pkSrc').value]), bounds: [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]], zmin: +$('#pkZ0').value, zmax: Math.min(+$('#pkZ1').value, SOURCES[$('#pkSrc').value].max), created: Date.now(), bytes: 0, status: 'descargando' }; closeModal(); map.removeLayer(selRect); selRect = null; S.packs.push(pack); openTab('offline'); runDownload(pack); };
};


/* ---------- satélite en vivo (GOES · NASA GIBS · HLS · Sentinel-2) ---------- */
const satPanel = $('#satPanel');
const LIVE_SOURCES = () => Object.entries(SOURCES).filter(([, s]) => s.live && !s.overlay);
const satSel = () => S.settings.satSource && SOURCES[S.settings.satSource]?.live ? S.settings.satSource : 'goesEast';
const fmtLocal = iso => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDay = d => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const fmtAgo = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h ${m % 60} min` : `hace ${Math.floor(m / 1440)} d`; };
let s2LastDates = null, hlsDates = {};
const satStampText = (id = S.settings.base) => {
  const s = SOURCES[id]; if (!s || !s.live) return '';
  if (s.time) { const t = satTime(); return `GOES-East · ${fmtLocal(t)} hora local (${t.slice(11,16)} UTC) · ${fmtAgo(t)}`; }
  if (s.s2) { const c = s2Cfg(); if (!s2Ready()) return 'Sentinel-2 · pendiente de configurar (Más → Sentinel-2)'; const best = s2LastDates?.[0]; return `Sentinel-2 10 m · ${c.order === 'leastCC' ? 'pase menos nublado' : 'pase más reciente'} de los últimos ${c.days} días (≤${c.cc} % nubes)` + (best ? ` · probable: ${fmtDay(best.date)} (${best.cc} % nubes)` : ''); }
  if (s.hls) return `${s.name} · ${fmtDay(satDate())} · ~30 m por píxel`;
  if (s.date) { const pass = { nasaViirs: '≈13:30', nasaNoaa20: '≈12:40', nasaModis: '≈10:30' }[id] || ''; const d = satDate(); return `${s.name.replace('Hoy · ','')} · ${fmtDay(d)} · pasada ${pass} h local${d === daysAgo(0) ? ' · hoy' : d === daysAgo(1) ? ' · ayer' : ''}`; }
  return 'Sentinel-2 · mosaico sin nubes 2023 (10 m) · no es imagen del día';
};
const refreshSatStamp = () => { const el = $('#satStamp'); if (!el) return; const t = satStampText(); el.textContent = t; el.classList.toggle('show', !!t); el.classList.toggle('cloudfree', S.settings.base === 's2cloudless'); };
const reloadLiveLayers = () => {
  if (SOURCES[S.settings.base]?.live) setBase(S.settings.base);
  Object.keys(SOURCES).filter(k => SOURCES[k].overlay && SOURCES[k].date && S.settings.overlays[k]).forEach(k => { if (S.layers[k]) { map.removeLayer(S.layers[k]); delete S.layers[k]; } overlayLayer(k); });
  renderSatPanel();
};
const setSatDate = async d => { S.settings.satDate = d; await save(); reloadLiveLayers(); };
const setSatTime = async t => { S.settings.satTime = t; await save(); reloadLiveLayers(); };
/* ¿La tesela trae datos? (GIBS devuelve PNG transparente cuando no hay pase ese día) */
const tileHasData = async url => { try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return false; const bmp = await createImageBitmap(await r.blob()); const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, 24, 24); const d = g.getImageData(0, 0, 24, 24).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n > 20; } catch { return false; } };
/* Último horario GOES publicado */
let goesProbe = null;
const findLatestGoes = async () => {
  if (!navigator.onLine) return null; if (goesProbe) return goesProbe;
  goesProbe = (async () => { const src = SOURCES.goesEast; for (let back = 1; back <= 18; back++) { const t = goesSlot(new Date(), back); try { const r = await fetch(tileURL(src, 2, 1, 1, 0, t), { cache: 'no-store' }); if (r.ok && (r.headers.get('content-type') || '').includes('image')) return t; } catch {} } return null; })();
  const r = await goesProbe; goesProbe = null; return r;
};
const useLatestGoes = async (silent = false) => {
  if (!silent) toast('Buscando la imagen más reciente…');
  const t = await findLatestGoes();
  if (!t) { if (!silent) toast('No se pudo consultar GOES ahora; se usa el último horario estimado'); return; }
  if (t !== S.settings.satTime) await setSatTime(t); else renderSatPanel();
  if (!silent) toast(`Imagen GOES de ${fmtLocal(t)} (${fmtAgo(t)})`);
};
setInterval(() => { if (S.settings.satAuto && S.settings.base === 'goesEast' && navigator.onLine) useLatestGoes(true); }, 5 * 60000);
/* Pases HLS recientes sobre el centro del mapa (sondea 30 días) */
let hlsProbe = null;
const findHlsDates = async id => {
  if (!navigator.onLine) return []; const c = map.getCenter(), z = 8, key = `${id}:${lng2x(c.lng, z)}:${lat2y(c.lat, z)}`;
  if (hlsDates[key]) return hlsDates[key]; if (hlsProbe) return hlsProbe;
  hlsProbe = (async () => { const out = []; const src = SOURCES[id]; const x = lng2x(c.lng, z), y = lat2y(c.lat, z);
    for (let back = 2; back <= 32 && out.length < 6; back++) { const d = daysAgo(back); if (await tileHasData(tileURL(src, z, x, y, 0, d))) out.push(d); }
    hlsDates[key] = out; return out; })();
  const r = await hlsProbe; hlsProbe = null; return r;
};
/* Fechas reales Sentinel-2 en la vista (WFS de Sentinel Hub) */
const findS2Dates = async () => {
  if (!s2Ready() || !navigator.onLine) return null; const c = s2Cfg(), b = map.getBounds(), to = c.to || daysAgo(0), from = isoDay(new Date(new Date(to + 'T00:00:00Z').getTime() - c.days * 86400000));
  const cx = b.getCenter(), dl = 0.05; const bbox = `${(cx.lat - dl).toFixed(4)},${(cx.lng - dl).toFixed(4)},${(cx.lat + dl).toFixed(4)},${(cx.lng + dl).toFixed(4)}`;
  for (const tn of ['DSS2', 'DSS10']) { try { const r = await fetch(`https://sh.dataspace.copernicus.eu/ogc/wfs/${c.id}?REQUEST=GetFeature&TYPENAMES=${tn}&SRSNAME=EPSG:4326&BBOX=${bbox}&TIME=${from}/${to}&MAXCC=100&OUTPUTFORMAT=application/json&MAXFEATURES=40`); if (!r.ok) continue; const j = await r.json(); const feats = (j.features || []).map(f => ({ date: f.properties?.date, cc: Math.round(+f.properties?.cloudCoverPercentage || 0) })).filter(f => f.date); if (!feats.length) continue; const byDay = {}; feats.forEach(f => { if (!byDay[f.date] || byDay[f.date] > f.cc) byDay[f.date] = f.cc; }); const list = Object.entries(byDay).map(([date, cc]) => ({ date, cc })).sort((p, q) => q.date.localeCompare(p.date)); const ok = list.filter(f => f.cc <= c.cc); const sorted = c.order === 'leastCC' ? ok.slice().sort((p, q) => p.cc - q.cc) : ok; return (sorted.length ? sorted : list).slice(0, 8); } catch {} }
  return null;
};
const renderSatPanel = async () => {
  if (!satPanel) return;
  const sel = satSel(), s = SOURCES[sel], today = daysAgo(0), d = satDate(), t = satTime();
  const srcEl = $('#satSources'); if (srcEl) srcEl.innerHTML = LIVE_SOURCES().map(([k, x]) => `<button data-satsrc="${k}" class="${k === sel ? 'active' : ''}${x.time ? ' rt' : ''}${x.s2 && !s2Ready() ? ' setup' : ''}">${esc(x.name.replace('Hoy · ', '').replace(' · en vivo',''))}<small>${esc(x.tag)}</small></button>`).join('');
  const dEl = $('#satDates');
  if (dEl) {
    if (s.time) {
      const steps = [['Última', null], ['−1 h', 6], ['−3 h', 18], ['−6 h', 36], ['−12 h', 72]];
      dEl.innerHTML = steps.map(([l, b]) => `<button data-sattime="${b === null ? 'latest' : goesSlot(new Date(), b + 2)}" class="${(b === null && S.settings.satAuto) ? 'active' : ''}">${l}</button>`).join('') + `<button data-satauto class="${S.settings.satAuto ? 'active' : ''}" title="Actualizar sola cada 5 min">Auto ${S.settings.satAuto ? '●' : '○'}</button>`;
    } else if (s.s2) {
      const c = s2Cfg();
      dEl.innerHTML = s2Ready() ? `<span class="lbl">Nubes máx.</span>${[10, 20, 40, 70].map(v => `<button data-s2cc="${v}" class="${c.cc === v ? 'active' : ''}">${v} %</button>`).join('')}<span class="lbl">Ventana</span>${[10, 20, 30, 60].map(v => `<button data-s2days="${v}" class="${c.days === v ? 'active' : ''}">${v} d</button>`).join('')}<span class="lbl">Prioridad</span><button data-s2order="leastCC" class="${c.order === 'leastCC' ? 'active' : ''}">Menos nubes</button><button data-s2order="mostRecent" class="${c.order === 'mostRecent' ? 'active' : ''}">Más reciente</button><div class="passes" id="s2Passes"><small>Consultando pases reales en esta zona…</small></div>` : `<button data-s2setup class="setup">Configurar mi cuenta Copernicus</button>`;
    } else if (s.hls) {
      dEl.innerHTML = `<span class="lbl">Pases recientes</span><div class="passes" id="hlsPasses"><small>Buscando días con imagen en esta zona…</small></div><input type="date" id="satDateIn" max="${today}" value="${d}">`;
    } else if (s.date) {
      const chips = [['Hoy', today], ['Ayer', daysAgo(1)], ['Hace 2 días', daysAgo(2)], ['Hace 7 días', daysAgo(7)]];
      dEl.innerHTML = chips.map(([l, v]) => `<button data-satdate="${v}" class="${v === d ? 'active' : ''}">${l}</button>`).join('') + `<input type="date" id="satDateIn" max="${today}" value="${d}">`;
    } else dEl.innerHTML = '';
    dEl.style.display = dEl.innerHTML ? '' : 'none';
  }
  const cf = $('#satCloudFree'); if (cf) cf.classList.toggle('active', sel === 's2cloudless');
  const note = $('#satNote');
  if (note) note.innerHTML = `<b>Imagen seleccionada:</b> ${esc(satStampText(sel))}<br>${esc(s.detail || '')}` + (s.time ? '<br>Latencia ≈20–30 min. De noche la imagen es sintética en tonos azul-gris.' : s.date && !s.hls ? '<br>Si ves zonas negras, la pasada de hoy aún no está procesada: elige “Ayer”.' : '');
  satPanel.querySelectorAll('[data-satsrc]').forEach(b => b.onclick = () => { S.settings.satSource = b.dataset.satsrc; save(); renderSatPanel(); });
  satPanel.querySelectorAll('[data-satdate]').forEach(b => b.onclick = () => setSatDate(b.dataset.satdate));
  satPanel.querySelectorAll('[data-sattime]').forEach(b => b.onclick = () => { if (b.dataset.sattime === 'latest') { S.settings.satAuto = true; useLatestGoes(); } else { S.settings.satAuto = false; setSatTime(b.dataset.sattime); } });
  const au = satPanel.querySelector('[data-satauto]'); if (au) au.onclick = () => { S.settings.satAuto = !S.settings.satAuto; save(); renderSatPanel(); if (S.settings.satAuto) useLatestGoes(true); };
  const s2set = (k, v) => async () => { S.settings[k] = v; S.settings.s2To = null; s2LastDates = null; await save(); reloadLiveLayers(); };
  satPanel.querySelectorAll('[data-s2cc]').forEach(b => b.onclick = s2set('s2MaxCC', +b.dataset.s2cc));
  satPanel.querySelectorAll('[data-s2days]').forEach(b => b.onclick = s2set('s2Days', +b.dataset.s2days));
  satPanel.querySelectorAll('[data-s2order]').forEach(b => b.onclick = s2set('s2Order', b.dataset.s2order));
  satPanel.querySelectorAll('[data-s2setup]').forEach(b => b.onclick = () => { closeSatPanel(); openS2Setup(); });
  const di = $('#satDateIn'); if (di) di.onchange = () => { if (di.value) { S.settings.hlsManual = true; setSatDate(di.value); } };
  refreshSatStamp();
  if (s.hls) { const list = await findHlsDates(sel); const el = $('#hlsPasses'); if (el && satSel() === sel) { el.innerHTML = list.length ? list.map(v => `<button data-satdate="${v}" class="${v === satDate() ? 'active' : ''}">${fmtDay(v)}</button>`).join('') : '<small>No se encontraron pases en los últimos 30 días en esta zona (o sin conexión). Elige una fecha manual.</small>'; el.querySelectorAll('[data-satdate]').forEach(b => b.onclick = () => { S.settings.hlsManual = false; setSatDate(b.dataset.satdate); }); if (list.length && !list.includes(satDate()) && !S.settings.hlsManual) { S.settings.satDate = list[0]; save(); if (S.settings.base === sel) reloadLiveLayers(); else renderSatPanel(); } } }
  if (s.s2 && s2Ready()) { const list = await findS2Dates(); const el = $('#s2Passes'); if (el && satSel() === sel) { s2LastDates = list; el.innerHTML = list?.length ? `<small>Pases reales en esta zona (toca uno para verlo):</small>` + list.map(f => `<button data-s2day="${f.date}" class="${s2Cfg().to === f.date && s2Cfg().days === 0 ? 'active' : ''}">${fmtDay(f.date)} · ${f.cc} %</button>`).join('') + (s2Cfg().days === 0 ? `<button data-s2reset>Volver a ventana automática</button>` : '') : '<small>No se pudieron consultar las fechas (revisa el ID o la conexión).</small>'; el.querySelectorAll('[data-s2day]').forEach(b => b.onclick = async () => { S.settings.s2To = b.dataset.s2day; S.settings.s2Days = 0; S.settings.s2MaxCC = 100; await save(); reloadLiveLayers(); }); const rs = el.querySelector('[data-s2reset]'); if (rs) rs.onclick = async () => { S.settings.s2To = null; S.settings.s2Days = 20; S.settings.s2MaxCC = 20; await save(); reloadLiveLayers(); }; refreshSatStamp(); } }
};
const openSatPanel = (forDownload = false) => { renderSatPanel(); satPanel.classList.add('open'); if (forDownload) toast('Elige fuente y momento; luego “Guardar esta vista offline”'); };
const closeSatPanel = () => satPanel.classList.remove('open');
const showSat = k => { if (SOURCES[k].s2 && !s2Ready()) { closeSatPanel(); openS2Setup(); return; } S.settings.satSource = k; setBase(k); closeSatPanel(); if (k === 'goesEast' && S.settings.satAuto) useLatestGoes(true); if (map.getZoom() > SOURCES[k].max + 2) toast(`Esta fuente se ve mejor hasta zoom ${SOURCES[k].max}; aléjate un poco`); };
$('#btnSat').onclick = () => satPanel.classList.contains('open') ? closeSatPanel() : openSatPanel();
$('#satClose').onclick = closeSatPanel;
$('#satShow').onclick = () => showSat(satSel());
$('#satCloudFree').onclick = () => { const k = satSel() === 's2cloudless' ? (SOURCES[S.settings.satPrev]?.live ? S.settings.satPrev : 'goesEast') : (S.settings.satPrev = satSel(), 's2cloudless'); S.settings.satSource = k; save(); renderSatPanel(); if (SOURCES[S.settings.base]?.live) showSat(k); };
$('#satDownload').onclick = () => { const k = satSel(); if (SOURCES[k].s2 && !s2Ready()) return openS2Setup(); setBase(k); closeSatPanel(); newPackDialog(map.getBounds()); };
$('#satStamp').onclick = () => openSatPanel();
map.on('dragstart zoomstart', () => { if (satPanel.classList.contains('open')) closeSatPanel(); });
document.querySelector('.sheet')?.addEventListener('transitionstart', closeSatPanel);

/* ---------- configuración Sentinel-2 (Copernicus Data Space) ---------- */
const S2_LAYER_CANDIDATES = ['1_TRUE_COLOR', 'TRUE_COLOR', 'TRUE-COLOR', 'TRUE_COLOR_S2L2A', '1_TRUE-COLOR'];
const s2TestLayer = async (id, layer) => { try { const u = `https://sh.dataspace.copernicus.eu/ogc/wmts/${id}?REQUEST=GetTile&LAYER=${encodeURIComponent(layer)}&TILEMATRIXSET=PopularWebMercator256&TILEMATRIX=5&TILEROW=14&TILECOL=8&TIME=${daysAgo(60)}/${daysAgo(0)}&MAXCC=90&FORMAT=image/jpeg`; const r = await fetch(u, { cache: 'no-store' }); return r.ok && (r.headers.get('content-type') || '').includes('image'); } catch { return false; } };
const s2Guide = () => `<div class="modal-kicker">Guía</div><h3>Cuenta gratuita Copernicus</h3>
<ol class="guide"><li>Entra a <b>dataspace.copernicus.eu</b> y pulsa <b>Register</b>. Confirma el correo.</li><li>Abre <b>shapps.dataspace.copernicus.eu/dashboard</b> e inicia sesión con esa cuenta.</li><li>En el menú izquierdo elige <b>Configuration Utility</b> → <b>New configuration</b>.</li><li>Nombre: <b>TerraPin</b>. En “Create configuration based on” elige la plantilla <b>Simple Sentinel-2 L2A</b> y pulsa <b>Create configuration</b>.</li><li>Arriba aparece <b>Id</b> (un código largo con guiones). Cópialo.</li><li>Pégalo en TerraPin → Más → Sentinel-2 y pulsa <b>Probar y guardar</b>. La app detecta sola el nombre de la capa de color real.</li></ol>
<p class="muted">La cuenta gratuita incluye una cuota mensual amplia para uso personal. Cada tesela que ves o descargas consume un poco; descarga solo el área que necesites. El ID se guarda solo en tu teléfono.</p>
<div class="actions"><button class="btn" data-close>Entendido</button></div>`;
const openS2Setup = () => {
  const c = s2Cfg();
  openModal(`<div class="modal-kicker">Sentinel-2 · 10 m</div><h3>Configurar mi cuenta Copernicus</h3><p class="muted">Pega el ID de la configuración creada en el panel de Sentinel Hub de Copernicus. Si aún no tienes cuenta, sigue la guía (5 minutos).</p>
  <div class="field"><label>ID de configuración (instancia)</label><input id="s2Id" value="${esc(c.id)}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocapitalize="none" spellcheck="false"></div>
  <div class="field"><label>Capa de color real (se detecta sola)</label><input id="s2Layer" value="${esc(c.layer)}"></div>
  <div class="card" id="s2Status">${s2Ready() ? '<b>Configurado.</b> Puedes probar la conexión o cambiar el ID.' : 'Sin configurar todavía.'}</div>
  <div class="actions"><button class="btn ghost" id="s2Guide">Ver guía</button>${s2Ready() ? '<button class="btn danger" id="s2Clear">Quitar</button>' : ''}<button class="btn ghost" data-close>Cerrar</button><button class="btn" id="s2Test">Probar y guardar</button></div>`);
  $('#s2Guide').onclick = () => { openModal(s2Guide()); };
  const cl = $('#s2Clear'); if (cl) cl.onclick = async () => { S.settings.s2Instance = ''; await save(); if (S.settings.base === 'sentinel2') setBase('esriSat'); closeModal(); renderSatPanel(); toast('Sentinel-2 desactivado'); };
  $('#s2Test').onclick = async () => {
    const id = $('#s2Id').value.trim(), st = $('#s2Status'); if (!/^[0-9a-f-]{20,}$/i.test(id)) { st.innerHTML = '<b style="color:#FF9A86">El ID no parece válido.</b> Debe ser un código con guiones como 1a2b3c4d-….'; return; }
    if (!navigator.onLine) { st.textContent = 'Sin conexión: no se puede probar ahora.'; return; }
    st.textContent = 'Probando conexión con Copernicus…';
    const typed = $('#s2Layer').value.trim(); const cands = [typed, ...S2_LAYER_CANDIDATES.filter(x => x !== typed)].filter(Boolean); let found = null;
    for (const l of cands) { if (await s2TestLayer(id, l)) { found = l; break; } }
    if (!found) { st.innerHTML = '<b style="color:#FF9A86">No responde con imagen.</b> Revisa que el ID sea el de la configuración (no el de la cuenta) y que la plantilla sea Sentinel-2 L2A; también puedes escribir el nombre exacto de la capa que aparece en tu configuración.'; return; }
    S.settings.s2Instance = id; S.settings.s2Layer = found; S.settings.s2To = null; s2LastDates = null; await save();
    st.innerHTML = `<b style="color:var(--ok)">Conectado.</b> Capa detectada: ${esc(found)}.`; toast('Sentinel-2 listo'); S.settings.satSource = 'sentinel2'; renderSatPanel(); setTimeout(() => { closeModal(); showSat('sentinel2'); }, 700);
  };
};

/* ---------- búsqueda ---------- */
const doSearch = async () => {
  const q = $('#q').value.trim(); if (!q) return;
  const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) { map.setView([+m[1], +m[2]], 16); L.popup().setLatLng([+m[1], +m[2]]).setContent(`${m[1]}, ${m[2]}`).openOn(map); return; }
  if (!navigator.onLine) return toast('Sin conexión: escribe coordenadas lat, lng');
  try { const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'es' } }); const j = await r.json(); if (!j.length) return toast('No se encontró "' + q + '"'); map.setView([+j[0].lat, +j[0].lon], 15); L.popup().setLatLng([+j[0].lat, +j[0].lon]).setContent(esc(j[0].display_name)).openOn(map); $('#q').blur(); } catch { toast('No se pudo buscar'); }
};
$('#qgo').onclick = doSearch; $('#q').onkeydown = e => { if (e.key === 'Enter') doSearch(); };

/* ---------- modal / hoja ---------- */
const modal = $('#modal');
const openModal = html => { $('#modalBox').innerHTML = html; modal.classList.add('open'); modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal)); };
const closeModal = () => { modal.classList.remove('open','composition-mode'); $('#modalBox')?.classList.remove('composition-box'); };
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
const sheet = $('#sheet');
const setIdleNav = () => { document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'projects')); $('#btnLayersQuick')?.classList.remove('active'); };
const closeSheet = () => { sheet.classList.remove('open'); S.tab = null; document.body.classList.remove('sheet-open'); setIdleNav(); requestAnimationFrame(layoutFloatingChrome); };
$('#sheetClose').onclick = closeSheet;
const openTab = t => { S.tab = t; hideInfo(); closeSatPanel(); document.body.classList.add('sheet-open'); document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === t)); $('#btnLayersQuick')?.classList.toggle('active',t==='layers'); sheet.classList.add('open'); renderSheet(); requestAnimationFrame(layoutFloatingChrome); };
document.querySelectorAll('.nav button').forEach(b => b.onclick = () => S.tab === b.dataset.tab ? closeSheet() : openTab(b.dataset.tab));
const TITLES = { projects: 'Proyectos', layers: 'Capas', points: 'Puntos', tracks: 'Rutas', offline: 'Mapas sin conexión', more: 'Más' };

const bindLayerDrag = list => { if(!list)return; let item=null,dragId=null; const finish=async()=>{if(!item)return;item.classList.remove('dragging');const ids=[...list.querySelectorAll('[data-lid]')].map(x=>x.dataset.lid);const rest=S.settings.order.filter(x=>!ids.includes(x));S.settings.order=[...ids,...rest];syncOrder();await save();item=null;dragId=null;renderSheet();}; list.querySelectorAll('[data-drag]').forEach(h=>{h.onpointerdown=e=>{item=h.closest('[data-lid]');dragId=e.pointerId;item.classList.add('dragging');h.setPointerCapture?.(dragId);e.preventDefault()};h.onpointermove=e=>{if(!item||e.pointerId!==dragId)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-lid]');if(!target||target===item||target.parentElement!==list)return;const r=target.getBoundingClientRect();list.insertBefore(item,e.clientY<r.top+r.height/2?target:target.nextSibling)};h.onpointerup=finish;h.onpointercancel=finish;}); };
const renderSheet = () => { refreshProjectHud(); refreshMapHud();
  if (!S.tab) return; $('#sheetTitle').textContent = TITLES[S.tab]; const B = $('#sheetBody');
  if (S.tab === 'projects') {
    const rootProjects=S.projects.filter(p=>!p.folderId).map(projectCardHtml).join('');
    const tree=folderTreeHtml(null,0);
    B.innerHTML=`<div class="row" style="margin-bottom:12px;flex-wrap:wrap"><button class="btn sm" id="pNewFolder">Nueva carpeta</button><button class="btn sm ghost" id="pNewProj">Nuevo proyecto</button><button class="btn sm ghost" id="pImport">Importar GIS</button></div><div class="folder"><div class="fhead" data-fold="root"><span class="mini" style="color:var(--amber)">${ICON.folder}</span><span class="grow"><b>General</b><span class="folder-depth">Sin carpeta</span></span><span class="muted">${S.projects.filter(p=>!p.folderId).length}</span></div>${S.settings.openFolders.root!==false?`<div class="fbody list">${rootProjects||'<div class="muted" style="padding:6px 10px">Sin proyectos</div>'}</div>`:''}</div>${tree||(!S.projects.length?'<div class="empty"><b>Organiza tu trabajo</b>Crea una carpeta general, agrega subcarpetas y dentro de ellas tus proyectos.</div>':'')}`;
    $('#pNewFolder').onclick=()=>{openModal(`<h3>Nueva carpeta</h3><div class="field"><label>Nombre</label><input id="nfName" placeholder="Ej. Proyectos de captura de carbono"></div><div class="field"><label>Dentro de</label><select id="nfParent">${folderOptions()}</select></div><div class="actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="nfOk">Crear</button></div>`);$('#nfOk').onclick=async()=>{const name=$('#nfName').value.trim();if(!name)return;S.folders.push({id:uid(),name,parentId:$('#nfParent').value||null});await save();closeModal();renderSheet();}};
    $('#pNewProj').onclick=()=>{openModal(`<h3>Nuevo proyecto</h3><div class="field"><label>Nombre</label><input id="npName"></div><div class="field"><label>Carpeta / subcarpeta</label><select id="npFolder">${folderOptions()}</select></div><div class="actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="npOk">Crear</button></div>`);$('#npOk').onclick=async()=>{const v=$('#npName').value.trim();if(!v)return;const p={id:uid(),name:v,folderId:$('#npFolder').value||null,created:Date.now()};S.projects.push(p);S.settings.activeProject=p.id;await save();closeModal();renderSheet();toast('Proyecto creado y activado');}};
    $('#pImport').onclick=()=>$('#fileIn').click();
    B.querySelectorAll('[data-fold]').forEach(el=>el.onclick=e=>{if(e.target.closest('[data-fmenu]'))return;const k=el.dataset.fold;S.settings.openFolders[k]=S.settings.openFolders[k]===false;save();renderSheet();});
    B.querySelectorAll('[data-proj]').forEach(el=>el.onclick=async e=>{if(e.target.closest('[data-pmenu]'))return;S.settings.activeProject=el.dataset.proj;await save();renderSheet();const ts=S.tracks.filter(t=>t.projectId===el.dataset.proj&&S.trackLayers[t.id]);const vs=S.vectors.filter(v=>v.projectId===el.dataset.proj&&S.vectorLayers[v.id]);if(ts.length||vs.length){const bb=L.latLngBounds([]);ts.forEach(t=>bb.extend(S.trackLayers[t.id].getBounds()));vs.forEach(v=>{const b=S.vectorLayers[v.id].getBounds?.();if(b?.isValid?.())bb.extend(b)});if(bb.isValid())map.fitBounds(bb,{padding:[40,40]});}});
    B.querySelectorAll('[data-pmenu]').forEach(el=>el.onclick=()=>{const p=S.projects.find(x=>x.id===el.dataset.pmenu);openModal(`<h3>${esc(p.name)}</h3><div class="field"><label>Nombre</label><input id="epName" value="${esc(p.name)}"></div><div class="field"><label>Nombre del área para mapas/PDF</label><input id="epArea" value="${esc(p.areaName||'')}"></div><div class="field"><label>Título predeterminado del mapa</label><input id="epReportTitle" value="${esc(p.reportTitle||p.name||'')}"></div><div class="field"><label>Elaborado por</label><input id="epReportAuthor" value="${esc(p.reportAuthor||S.settings.reportAuthor||'Jesús Reynaldo Ordoñez Pech')}"></div><div class="field"><label>Carpeta / subcarpeta</label><select id="epFolder">${folderOptions(p.folderId)}</select></div><div class="gis-actions"><button class="btn sm ghost" id="epGpx">GPX</button><button class="btn sm ghost" id="epKml">KML</button><button class="btn sm ghost" id="epKmz">KMZ</button><button class="btn sm ghost" id="epShp">Shape</button></div><div class="gis-actions" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button class="btn sm" id="epPdf">Generar PDF</button><button class="btn sm ghost" id="epPrint">Imprimir</button></div><div class="actions"><button class="btn danger" id="epDel">Eliminar</button><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="epOk">Guardar</button></div>`);$('#epOk').onclick=async()=>{p.name=$('#epName').value.trim()||p.name;p.areaName=$('#epArea').value.trim();p.reportTitle=$('#epReportTitle').value.trim()||p.name;p.reportAuthor=$('#epReportAuthor').value.trim()||S.settings.reportAuthor||'Jesús Reynaldo Ordoñez Pech';p.folderId=$('#epFolder').value||null;await save();closeModal();renderSheet()};$('#epGpx').onclick=()=>download(p.name+'.gpx',toGPX(S.tracks.filter(t=>t.projectId===p.id),S.waypoints.filter(w=>w.projectId===p.id)),'application/gpx+xml');$('#epKml').onclick=()=>exportProjectKML(p.id);$('#epKmz').onclick=()=>exportProjectKMZ(p.id);$('#epShp').onclick=()=>exportProjectShape(p.id);$('#epPdf').onclick=()=>shareOrDownloadPdf(p.id);$('#epPrint').onclick=()=>printReport(p.id);$('#epDel').onclick=async()=>{if(!confirm('¿Eliminar el proyecto y todas sus rutas y puntos?'))return;for(const t of S.tracks.filter(t=>t.projectId===p.id)){await delTrack(t.id);if(S.trackLayers[t.id])map.removeLayer(S.trackLayers[t.id]);}S.tracks=S.tracks.filter(t=>t.projectId!==p.id);S.waypoints=S.waypoints.filter(w=>w.projectId!==p.id);S.vectors.filter(v=>v.projectId===p.id).forEach(v=>{if(S.vectorLayers[v.id])map.removeLayer(S.vectorLayers[v.id]);delete S.vectorLayers[v.id]});S.vectors=S.vectors.filter(v=>v.projectId!==p.id);S.projects=S.projects.filter(x=>x.id!==p.id);if(S.settings.activeProject===p.id)S.settings.activeProject=null;await save();drawWaypoints();closeModal();renderSheet();};});
    B.querySelectorAll('[data-fmenu]').forEach(el=>el.onclick=()=>{const f=S.folders.find(x=>x.id===el.dataset.fmenu);openModal(`<h3>Carpeta</h3><div class="field"><label>Nombre</label><input id="efName" value="${esc(f.name)}"></div><div class="field"><label>Dentro de</label><select id="efParent">${folderOptions(f.parentId,f.id)}</select></div><div class="row" style="margin:10px 0"><button class="btn sm" id="efSub">Nueva subcarpeta</button></div><div class="actions"><button class="btn danger" id="efDel">Eliminar carpeta</button><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="efOk">Guardar</button></div><p class="muted">Al eliminarla, sus proyectos y subcarpetas pasan al nivel superior.</p>`);$('#efOk').onclick=async()=>{f.name=$('#efName').value.trim()||f.name;f.parentId=$('#efParent').value||null;await save();closeModal();renderSheet()};$('#efSub').onclick=()=>{const name=prompt('Nombre de la subcarpeta');if(name?.trim()){S.folders.push({id:uid(),name:name.trim(),parentId:f.id});save().then(()=>{closeModal();renderSheet()})}};$('#efDel').onclick=async()=>{const parent=f.parentId||null;S.projects.forEach(p=>{if(p.folderId===f.id)p.folderId=parent});S.folders.forEach(x=>{if((x.parentId||null)===f.id)x.parentId=parent});S.folders=S.folders.filter(x=>x.id!==f.id);await save();closeModal();renderSheet()};});
  }
  if (S.tab === 'layers') {
    syncOrder();
    const items = S.settings.order.map((id, i) => {
      let name, color = '', on, kind;
      if (id === 'wp') { name = 'Puntos de interés'; on = !S.settings.wpHidden; kind = 'wp'; }
      else if (id.startsWith('ov:')) { const k = id.slice(3); name = SOURCES[k].name; on = !!S.settings.overlays[k]; kind = 'ov'; }
      else if (id.startsWith('vec:')) { const v=S.vectors.find(v=>'vec:'+v.id===id); if(!v)return ''; name=v.name || vectorName(v.feature); color=v.color; on=v.visible!==false; kind='vec'; }
      else { const t = S.tracks.find(t => 'tr:' + t.id === id); if (!t) return ''; name = t.name; color = t.color; on = t.visible !== false; kind = 'tr'; }
      const op = S.settings.opacity[id] ?? (kind === 'ov' ? SOURCES[id.slice(3)].opacity : 1);
      return `<div class="item" data-lid="${id}"><button class="layer-drag" data-drag aria-label="Mover capa">⠿</button><span class="layer-rank">${i+1}${i===0?'<span class="layer-front">TOP</span>':''}</span><div class="row" style="flex-direction:column;gap:2px"><button class="mini" data-up ${i === 0 ? 'disabled' : ''}>${ICON.up}</button><button class="mini" data-down ${i === S.settings.order.length - 1 ? 'disabled' : ''}>${ICON.down}</button></div><div class="grow"><div class="row"><i class="swatch" style="background:${color || (kind === 'ov' ? 'var(--teal)' : 'var(--amber)')}"></i><span class="ttl">${esc(name)}</span></div><input type="range" min="10" max="100" value="${Math.round(op * 100)}" data-op aria-label="Opacidad"></div><button class="toggle ${on ? 'on' : ''}" data-tog aria-label="Mostrar"></button></div>`;
    }).join('');
    const baseBtn = ([k, s]) => `<button data-id="${k}" class="${k === S.settings.base ? 'active' : ''}${s.date || s.time || s.s2 ? ' live' : ''}">${s.name}<span class="tag">${s.s2 && !s2Ready() ? 'Toca para configurar' : s.tag}</span></button>`;
    B.innerHTML = `<div class="section-title">Mapa base</div><div class="basegrid">${Object.entries(SOURCES).filter(([, s]) => !s.overlay && !s.live && !s.hidden).map(baseBtn).join('')}</div>
    <div class="section-title">Satélite en vivo</div><div class="basegrid">${Object.entries(SOURCES).filter(([, s]) => !s.overlay && s.live).map(baseBtn).join('')}</div>
    <div class="row" style="margin:-6px 0 14px;justify-content:space-between"><span class="muted">${esc(satStampText(SOURCES[S.settings.base]?.live ? S.settings.base : satSel()))}</span><button class="btn sm ghost" id="lySatDate">Cambiar momento / sin nubes</button></div>
    <div class="section-title">Orden de capas</div><div class="muted" style="margin-bottom:8px">Arrastra para definir qué capa se dibuja encima.</div><div class="list layer-order-list" id="layerOrderList">${items}</div><div class="sheet-end">Fin de las capas</div>`;
    B.querySelectorAll('.basegrid button').forEach(b => b.onclick = () => setBase(b.dataset.id));
    $('#lySatDate').onclick = () => { closeSheet(); openSatPanel(); };
    B.querySelectorAll('[data-lid]').forEach(el => {
      const id = el.dataset.lid;
      const apply = () => { if (id === 'wp') drawWaypoints(); else if (id.startsWith('ov:')) overlayLayer(id.slice(3)); else if(id.startsWith('vec:')) { const v=S.vectors.find(v=>'vec:'+v.id===id); if(v)drawVector(v); } else { const t = S.tracks.find(t => 'tr:' + t.id === id); drawTrack(t); } };
      el.querySelector('[data-tog]').onclick = async () => { if (id === 'wp') S.settings.wpHidden = !S.settings.wpHidden; else if (id.startsWith('ov:')) S.settings.overlays[id.slice(3)] = !S.settings.overlays[id.slice(3)]; else if(id.startsWith('vec:')) { const v=S.vectors.find(v=>'vec:'+v.id===id); if(v)v.visible=v.visible===false; } else { const t = S.tracks.find(t => 'tr:' + t.id === id); t.visible = t.visible === false; await putTrack(t); } apply(); await save(); renderSheet(); };
      el.querySelector('[data-op]').oninput = e => { S.settings.opacity[id] = e.target.value / 100; apply(); };
      el.querySelector('[data-op]').onchange = save;
      const mv = d => async () => { const o = S.settings.order; const i = o.indexOf(id); const j = i + d; if (j < 0 || j >= o.length) return;[o[i], o[j]] = [o[j], o[i]]; syncOrder(); await save(); renderSheet(); };
      el.querySelector('[data-up]').onclick = mv(-1); el.querySelector('[data-down]').onclick = mv(1);
    });
    bindLayerDrag(B.querySelector('#layerOrderList'));
  }
  if (S.tab === 'points') {
    const pid=S.settings.activeProject;
    const list=S.waypoints.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'', 'es'));
    const active = pid ? list.filter(w=>w.projectId===pid) : list;
    B.innerHTML = `<div class="points-hero"><div><span>Puntos de campo</span><b>${active.length}</b><small>${pid?'del proyecto activo':'guardados en TerraPin'}</small></div><button class="btn" id="ptNew">+ Nuevo punto</button></div>
      <div class="point-list">${active.map(w=>{const d=pointIconDef(w.icon);return `<article class="point-card" data-point="${w.id}"><div class="point-symbol">${d.symbol}</div><div class="grow"><b>${esc(w.name)}</b><span>${esc(d.label)} · ${w.lat.toFixed(5)}, ${w.lng.toFixed(5)}</span>${w.notes?`<small>${esc(w.notes)}</small>`:''}</div><button class="point-nav" data-pointnav="${w.id}">Navegar</button><button class="mini" data-pointedit="${w.id}">${ICON.more}</button></article>`}).join('') || '<div class="empty"><b>No hay puntos en este proyecto</b>Agrega un punto desde el mapa o importa un archivo GIS.</div>'}</div>`;
    $('#ptNew').onclick=()=>{ closeSheet(); const c=S.me||map.getCenter(); editWaypoint({lat:c.lat,lng:c.lng,projectId:S.settings.activeProject,name:'',icon:'pin'}); };
    B.querySelectorAll('[data-point]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;const w=S.waypoints.find(x=>x.id===el.dataset.point);if(!w)return;closeSheet();map.setView([w.lat,w.lng],Math.max(map.getZoom(),17));setTimeout(()=>showWaypointAction(w),180);});
    B.querySelectorAll('[data-pointnav]').forEach(el=>el.onclick=e=>{e.stopPropagation();const w=S.waypoints.find(x=>x.id===el.dataset.pointnav);if(!w)return;closeSheet();routeToWaypoint(w);});
    B.querySelectorAll('[data-pointedit]').forEach(el=>el.onclick=e=>{e.stopPropagation();const w=S.waypoints.find(x=>x.id===el.dataset.pointedit);if(w)editWaypoint(w);});
  }
  if (S.tab === 'tracks') {
    const groups = {}; S.tracks.slice().sort((a, b) => b.created - a.created).forEach(t => (groups[t.projectId || ''] = groups[t.projectId || ''] || []).push(t));
    const html = Object.entries(groups).map(([pid, ts]) => `<div class="muted" style="margin:10px 4px 6px">${esc(projName(pid))}</div><div class="list">${ts.map(t => { const st = trackStats(t); return `<div class="item ${S.sel === t.id ? 'sel' : ''}" data-tr="${t.id}"><i class="swatch" style="background:${t.color}"></i><div class="grow"><div class="ttl">${esc(t.name)}</div><div class="sub">${fmtDist(st.dist)} · ${fmtTime(st.dur)} · ${new Date(t.created).toLocaleDateString('es-MX')}</div></div><button class="mini ${t.visible === false ? '' : 'on'}" data-vis>${t.visible === false ? ICON.eyeoff : ICON.eye}</button><button class="mini" data-edit>${ICON.more}</button></div>`; }).join('')}</div>`).join('');
    const recHero=S.rec?`<div class="record-hero ${S.rec.paused?'paused':''}" id="trackRecHero"><div class="record-head"><span class="record-dot recording">■</span><div class="grow"><b>Grabando ruta</b><small id="tRecState">${S.rec.paused?'Grabación en pausa':'GPS registrando el recorrido'}</small></div></div><div class="record-stats"><div><strong id="tRecDist">${fmtDist(S.rec.dist||0)}</strong><span>distancia</span></div><div><strong id="tRecTime">${fmtTime(recElapsedMs(S.rec)/1000)}</strong><span>tiempo</span></div><div><strong id="tRecPts">${S.rec.points.length}</strong><span>puntos GPS</span></div></div><div class="record-actions"><button class="btn pause" id="tPauseRec">${S.rec.paused?'Reanudar':'Pausar'}</button><button class="btn danger" id="tFinishRec">Finalizar y guardar</button></div></div>`:`<div class="record-hero idle"><div class="record-head"><span class="record-dot">●</span><div class="grow"><b>Grabar nueva ruta</b><small>Registra tu recorrido con el GPS y guárdalo en el proyecto activo.</small></div></div><div class="record-actions"><button class="btn" id="tStartRec">Iniciar grabación</button></div></div>`;
    B.innerHTML = recHero+`<div class="row" style="margin-bottom:6px;flex-wrap:wrap"><button class="btn sm ghost" id="tImport">Importar GIS</button><button class="btn sm ghost" id="tExportAll" ${S.tracks.length ? '' : 'disabled'}>Exportar todo (GPX)</button></div>` + (html || '<div class="empty"><b>Aún no hay rutas guardadas</b>Usa “Grabar nueva ruta” para iniciar un recorrido GPS.</div>');
    $('#tStartRec')?.addEventListener('click',()=>{startRec();closeSheet();toast('Grabación iniciada · vuelve a Rutas para pausar o finalizar')});
    $('#tPauseRec')?.addEventListener('click',toggleRecPause);
    $('#tFinishRec')?.addEventListener('click',()=>{closeSheet();stopRec()});
    $('#tImport').onclick = () => $('#fileIn').click();
    $('#tExportAll').onclick = () => download('terrapin-rutas.gpx', toGPX(S.tracks, S.waypoints), 'application/gpx+xml');
    refreshRecUI();
    B.querySelectorAll('[data-tr]').forEach(el => {
      const t = S.tracks.find(x => x.id === el.dataset.tr);
      el.onclick = e => { if (e.target.closest('.mini')) return; if (t.visible === false) { t.visible = true; putTrack(t); drawTrack(t); } selectTrack(t.id); map.fitBounds(S.trackLayers[t.id].getBounds(), { padding: [40, 40] }); };
      el.querySelector('[data-vis]').onclick = async () => { t.visible = t.visible === false; await putTrack(t); drawTrack(t); renderSheet(); };
      el.querySelector('[data-edit]').onclick = () => editTrack(t);
    });
  }
  if (S.tab === 'offline') {
    const prog = dl ? `<div class="card"><b>Descargando "${esc(dl.pack.name)}"</b><div class="progress" id="dlProg" style="margin:8px 0"><i></i></div><div class="row" style="justify-content:space-between"><span class="muted" id="dlTxt">…</span><button class="btn sm danger" id="dlStop">Pausar</button></div></div>` : '';
    const packs = S.packs.map(p => `<div class="item" data-pk="${p.id}"><div class="grow"><div class="ttl">${esc(p.name)}</div><div class="sub">${esc(SOURCES[p.source]?.name || p.source)}${p.date ? ' · ' + (SOURCES[p.source]?.s2 ? 'hasta ' + p.date.split('|')[0] : p.date) : ''} · zoom ${p.zmin}–${p.zmax} · ${fmtBytes(p.bytes || 0)} · ${p.status}</div></div><button class="mini" data-show>${ICON.center}</button>${p.status !== 'listo' && !dl ? `<button class="mini" data-resume title="Continuar">${ICON.down}</button>` : ''}<button class="mini" data-del>${ICON.trash}</button></div>`).join('');
    B.innerHTML = `<div class="row" style="margin-bottom:12px;flex-wrap:wrap"><button class="btn sm" id="dlArea" ${dl ? 'disabled' : ''}>Dibujar área</button><button class="btn sm ghost" id="dlView" ${dl ? 'disabled' : ''}>Usar la vista actual</button><button class="btn sm ghost" id="dlSat" ${dl ? 'disabled' : ''}>Satélite del día</button></div>${prog}<div class="list">${packs || '<div class="empty"><b>Sin mapas descargados</b>Descarga el área donde vas a trabajar para usar el mapa sin señal. Puedes guardar varias fuentes de la misma zona (satélite, topográfico…).</div>'}</div><p class="muted" id="storageTxt" style="margin-top:12px"></p>`;
    navigator.storage?.estimate?.().then(e => { const el = $('#storageTxt'); if (el) el.textContent = `Espacio usado: ${fmtBytes(e.usage || 0)} de ${fmtBytes(e.quota || 0)} disponibles`; });
    $('#dlArea').onclick = async () => { const b = await pickArea(); if (b) newPackDialog(b); else openTab('offline'); };
    $('#dlView').onclick = () => newPackDialog(map.getBounds());
    $('#dlSat').onclick = () => { closeSheet(); openSatPanel(true); };
    if (dl) { $('#dlStop').onclick = () => dl.ctrl.abort(); renderDlProgress(); }
    B.querySelectorAll('[data-pk]').forEach(el => {
      const p = S.packs.find(x => x.id === el.dataset.pk);
      el.querySelector('[data-show]').onclick = () => { closeSheet(); if (p.date) { const ps = SOURCES[p.source]; if (ps?.time) S.settings.satTime = p.date; else if (ps?.s2) { const [to, days, cc, order] = p.date.split('|'); Object.assign(S.settings, { s2To: to, s2Days: +days, s2MaxCC: +cc, s2Order: order }); } else S.settings.satDate = p.date; } if (SOURCES[p.source]?.overlay) { S.settings.overlays[p.source] = true; overlayLayer(p.source); } else setBase(p.source); map.fitBounds(p.bounds); if (selRect) map.removeLayer(selRect); selRect = L.rectangle(p.bounds, { color: '#D9B45B', weight: 2, dashArray: '6 6', fill: false, interactive: false }).addTo(map); setTimeout(() => { if (selRect) { map.removeLayer(selRect); selRect = null; } }, 4000); };
      const rs = el.querySelector('[data-resume]'); if (rs) rs.onclick = () => runDownload(p);
      el.querySelector('[data-del]').onclick = async () => { if (!confirm(`¿Eliminar "${p.name}"? Si otros mapas usan la misma fuente y fecha, también se borrarán sus teselas.`)) return; await tilesDeletePrefix(cacheId(p.source, p.date) + '/'); await delPack(p.id); S.packs = S.packs.filter(x => x.id !== p.id); renderSheet(); toast('Mapa eliminado'); };
    });
  }
  if (S.tab === 'more') {
    B.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><div><b>Tema oscuro</b><div class="muted">Cristal oscuro; desactívalo para trabajar a pleno sol</div></div><button class="toggle ${S.settings.theme === 'dark' ? 'on' : ''}" id="mTheme"></button></div></div>
    <div class="card"><div class="row" style="justify-content:space-between"><div><b>Seguir mi posición al grabar</b><div class="muted">El mapa se centra en ti automáticamente</div></div><button class="toggle ${S.settings.autoFollow ? 'on' : ''}" id="mFollow"></button></div></div>
    <div class="card"><b>Precisión mínima del GPS</b><div class="muted">Se ignoran lecturas peores a <span id="mAccV">${S.settings.minAcc}</span> m. Bajo árboles o edificios puedes subirlo.</div><input type="range" min="10" max="150" step="5" value="${S.settings.minAcc}" id="mAcc"></div>
    <div class="card"><b>Almacenamiento persistente</b><div class="muted">Evita que el sistema borre tus mapas descargados</div><button class="btn sm ghost" id="mPersist" style="margin-top:8px">Solicitar</button></div>
    <div class="card"><b>Copia de seguridad</b><div class="muted">Exporta todas las carpetas, proyectos, rutas y puntos a un archivo</div><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm ghost" id="mBackup">Exportar respaldo</button><button class="btn sm ghost" id="mRestore">Restaurar respaldo</button></div></div>
    <div class="card modern-feature"><b>Sentinel-2 · 10 m (cuenta Copernicus)</b><div class="muted">${s2Ready() ? 'Configurado. Imágenes de 10 m con filtro de nubes de los últimos ' + s2Cfg().days + ' días.' : 'La mejor calidad gratuita: calles principales y lotes, pase cada 5 días, filtro de nubes. Necesita tu ID gratuito de Copernicus.'}</div><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" id="mS2">${s2Ready() ? 'Cambiar cuenta' : 'Configurar'}</button><button class="btn sm ghost" id="mS2Guide">Guía paso a paso</button></div></div>
    <div class="card modern-feature"><b>Mapas offline</b><div class="muted">Administra las áreas descargadas para trabajo sin señal.</div><button class="btn sm ghost" id="mOffline" style="margin-top:8px">Abrir mapas offline</button></div><div class="card"><b>Intercambio GIS</b><div class="muted">Importa Shape/KML/KMZ/GPX/GeoJSON y exporta toda la información en formatos GIS.</div><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm ghost" id="mImportGis">Importar GIS</button><button class="btn sm ghost" id="mKml">KML</button><button class="btn sm ghost" id="mKmz">KMZ</button><button class="btn sm ghost" id="mShp">Shape</button></div></div><div class="card"><b>Reporte general</b><div class="muted">Genera una lámina cartográfica profesional con simbología, norte, escala, rutas, capas y puntos.</div><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" id="mPdf">Generar PDF</button><button class="btn sm ghost" id="mPrint">Imprimir</button></div></div>
    <div class="card about"><b>TerraPin</b> <span class="muted">v4.2 · Obsidian Glass</span><p>Mapas sin conexión, satélite en vivo (NASA), grabación de rutas GPS, navegación híbrida, medición y proyectos por carpetas.</p><p><b>Desarrollada por Jesús Reynaldo Ordoñez Pech.</b></p><p class="muted">Mapas: OpenStreetMap y colaboradores, CARTO, Esri, OpenTopoMap, CyclOSM, OpenRailwayMap, NASA GIBS/FIRMS, NOAA GOES-East, NASA HLS, Copernicus Sentinel-2 cloudless (EOX, CC BY-NC-SA). Respeta las condiciones de uso de cada proveedor al descargar áreas grandes.</p></div>`;
    $('#mTheme').onclick = () => { setTheme(S.settings.theme === 'dark' ? 'light' : 'dark'); renderSheet(); };
    $('#mFollow').onclick = () => { S.settings.autoFollow = !S.settings.autoFollow; save(); renderSheet(); };
    $('#mAcc').oninput = e => { S.settings.minAcc = +e.target.value; $('#mAccV').textContent = e.target.value; }; $('#mAcc').onchange = save;
    $('#mPersist').onclick = async () => { const ok = await navigator.storage?.persist?.(); toast(ok ? 'Almacenamiento protegido' : 'El navegador no lo permitió'); };
    $('#mBackup').onclick = () => download('terrapin-respaldo.json', JSON.stringify({ v: 2, folders: S.folders, projects: S.projects, waypoints: S.waypoints, tracks: S.tracks, vectors:S.vectors, settings: S.settings }), 'application/json');
    $('#mS2').onclick=openS2Setup; $('#mS2Guide').onclick=()=>openModal(s2Guide());
    $('#mOffline').onclick=()=>openTab('offline'); $('#mImportGis').onclick=()=>$('#fileIn').click(); $('#mKml').onclick=()=>exportProjectKML(null); $('#mKmz').onclick=()=>exportProjectKMZ(null); $('#mShp').onclick=()=>exportProjectShape(null); $('#mPdf').onclick = () => shareOrDownloadPdf(null); $('#mPrint').onclick = () => printReport(null);
    $('#mRestore').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = async () => { try { const j = JSON.parse(await i.files[0].text()); S.folders = j.folders || []; S.projects = j.projects || []; S.waypoints = j.waypoints || []; S.vectors=j.vectors||[]; for (const t of j.tracks || []) await putTrack(t); S.tracks = await allTracks(); await save(); syncOrder(); S.tracks.forEach(drawTrack); S.vectors.forEach(drawVector); drawWaypoints(); renderSheet(); toast('Respaldo restaurado'); } catch { toast('Archivo no válido'); } }; i.click(); };
  }
};

/* ---------- tema ---------- */
const setTheme = t => { S.settings.theme = t; document.documentElement.dataset.theme = t; document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#0C1512' : '#E9ECE7'; save(); };
$('#btnTheme').onclick = () => setTheme(S.settings.theme === 'dark' ? 'light' : 'dark');

/* ---------- inicio ---------- */
(async () => {
  db = await openDB();
  Object.assign(S.settings, await kvGet('settings', {}));
  S.folders = await kvGet('folders', []); S.projects = await kvGet('projects', []); S.waypoints = await kvGet('waypoints', []); S.vectors=await kvGet('vectors', []);
  S.tracks = await allTracks(); S.packs = await allPacks();
  setTheme(S.settings.theme || 'dark');
  if (S.settings.view) map.setView(S.settings.view.c, S.settings.view.z);
  setBase(SOURCES[S.settings.base] ? S.settings.base : 'cartoVoyager');
  syncOrder(); Object.keys(SOURCES).filter(k => SOURCES[k].overlay).forEach(overlayLayer);
  S.tracks.forEach(drawTrack); S.vectors.forEach(drawVector); drawWaypoints();
  map.on('moveend', () => { S.settings.view = { c: map.getCenter(), z: map.getZoom() }; kvSet('settings', S.settings); });
  const pending = await kvGet('recording', null);
  if (pending && pending.points.length) { if (confirm('Había una grabación en curso. ¿Continuarla?')) { startRec(pending); $('#sDist').textContent = fmtDist(pending.dist); } else await kvSet('recording', null); }
  window.addEventListener('online', () => toast('Conexión restablecida')); window.addEventListener('offline', () => toast('Sin conexión: se usarán los mapas descargados'));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=4.2', {updateViaCache:'none'}).then(r=>r.update()).catch(() => { });
  L.control.scale({ imperial: false, maxWidth: 120, position: 'bottomleft' }).addTo(map);
  renderSatPanel();
  if (S.settings.base === 'goesEast' && S.settings.satAuto) useLatestGoes(true);
  window.addEventListener('online', () => { if (S.settings.base === 'goesEast' && S.settings.satAuto) useLatestGoes(true); });
  refreshProjectHud(); refreshMapHud();
  sheet.classList.remove('open'); S.tab = null; setIdleNav();
  setTimeout(() => $('#splash').classList.add('hide'), 900);
  if (!S.projects.length && !S.tracks.length && !S.vectors.length) setTimeout(() => toast('Bienvenido. Crea un proyecto, graba una ruta o prueba el satélite en vivo'), 1500);
})();
})();
