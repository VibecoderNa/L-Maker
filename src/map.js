// ==========================================
// 1단계: 기존 지도 그리기 (STAGE 1-1)
// ==========================================

// 💡 하드코딩된 특정 지역 좌표 제거. 서울을 초기값으로 잡되 DB 동기화 완료 시 해당 좌표로 이동함
const initialLat = 37.5665; 
const initialLng = 126.9780;
const map = L.map('map', { zoomControl: false }).setView([initialLat, initialLng], 14);
window.map = map;

L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);

let markerIdCounter = 0; const markerDB = {}; let editingId = null; let clickedLatLng = null; let isLegendEmpty = true;
const modal = document.getElementById('drawingModal'); const canvas = document.getElementById('symbolCanvas'); const ctx = canvas.getContext('2d');
map.on('click', function(e) { editingId = null; clickedLatLng = e.latlng; window.openModal(); });

window.openModal = function() { modal.classList.add('active'); document.getElementById('modalModeTitle').innerText = editingId !== null ? "수정하기" : "만들기"; if (editingId === null) { document.getElementById('placeName').value = ''; document.getElementById('legendDesc').value = ''; window.clearCanvas(); } }
window.closeModal = function() { modal.classList.remove('active'); }

let isDrawing = false; let currentColor = '#000000'; let isEraserMode = false;
function getCoordinates(e) { const rect = canvas.getBoundingClientRect(); let cX = e.clientX; let cY = e.clientY; if (e.touches && e.touches.length>0) { cX = e.touches[0].clientX; cY = e.touches[0].clientY; } return { x: (cX - rect.left)*(canvas.width/rect.width), y: (cY - rect.top)*(canvas.height/rect.height) }; }
function startPosition(e) { e.preventDefault(); isDrawing = true; draw(e); } function endPosition() { isDrawing = false; ctx.beginPath(); }
function draw(e) { if(!isDrawing) return; e.preventDefault(); const pos = getCoordinates(e); ctx.lineWidth = isEraserMode ? 20 : 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (isEraserMode) ctx.globalCompositeOperation = 'destination-out'; else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = currentColor; } ctx.lineTo(pos.x, pos.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
canvas.addEventListener('mousedown', startPosition); canvas.addEventListener('mouseup', endPosition); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseout', endPosition);
canvas.addEventListener('touchstart', startPosition, { passive: false }); canvas.addEventListener('touchend', endPosition); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchcancel', endPosition);

window.setColor = function(color, btnEl) { isEraserMode = false; currentColor = color; document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active')); document.getElementById('eraserBtn').classList.remove('active'); if(btnEl) btnEl.classList.add('active'); }
window.toggleEraser = function() { isEraserMode = true; document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active')); document.getElementById('eraserBtn').classList.add('active'); }
window.clearCanvas = function() { ctx.clearRect(0, 0, canvas.width, canvas.height); window.setColor('#000000', document.querySelectorAll('.color-btn')[0]); }

window.toggleLegend = function() {
    const list = document.getElementById('legendList');
    const icon = document.getElementById('legendToggleIcon');
    list.classList.toggle('collapsed');
    if (list.classList.contains('collapsed')) {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

window.togglePanel = function(panelId, iconId) {
    const panel = document.getElementById(panelId);
    const icon = document.getElementById(iconId);
    panel.classList.toggle('collapsed');
    if (panel.classList.contains('collapsed')) {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    } else {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    }
}

window.restoreMapMarkers = function() {
    if (!window.gameState.mapMarkers) window.gameState.mapMarkers = [];
    for (let id in markerDB) { if(markerDB[id].leafletMarker) map.removeLayer(markerDB[id].leafletMarker); delete markerDB[id]; }
    markerIdCounter = 0; const legendList = document.getElementById('legendList'); legendList.innerHTML = ''; isLegendEmpty = true;
    
    window.gameState.mapMarkers.forEach(mData => {
        const customIcon = L.icon({ iconUrl: mData.imgData, iconSize: [50, 50], iconAnchor: [25, 25], popupAnchor: [0, -28] });
        const marker = L.marker(mData.latlng, { icon: customIcon }).addTo(map);
        
        const editBtnHtml = (mData.author === window.currentUserId) || window.isTeacherMode 
            ? `<div style="display:flex; gap:5px;"><button onclick="window.editMarker(${mData.id})" style="flex:1;"><i class="fa-solid fa-pen"></i> 관리</button><button onclick="window.deleteMarker(${mData.id})" style="background:rgba(239, 68, 68, 0.8); width:auto; padding: 6px 10px;"><i class="fa-solid fa-trash"></i></button></div>` 
            : `<div style="font-size:11px; color:var(--text-muted); margin-top:10px;">${mData.author}번 시장님 기호</div>`;
        
        marker.bindPopup(`<div class="custom-popup"><h3>${mData.placeName}</h3><p>${mData.legendDesc}</p>${editBtnHtml}</div>`);
        const legendItem = window.addToLegend(mData.imgData, mData.placeName, mData.id);
        markerDB[mData.id] = { leafletMarker: marker, legendElement: legendItem, latlng: mData.latlng, placeName: mData.placeName, legendDesc: mData.legendDesc, imgData: mData.imgData, author: mData.author };
        if(mData.id >= markerIdCounter) markerIdCounter = mData.id + 1;
    });
    
    if (window.gameState.mapMarkers.length === 0) { 
        legendList.innerHTML = '<div class="empty-legend">지도에 기호를 꽂으면<br>여기에 범례가 추가됩니다!</div>'; 
        isLegendEmpty = true; 
    } else { 
        isLegendEmpty = false; 
    }

    if(window.geoMapInitStatus) refreshGeoMarkers();
    if(window.elevMapInitStatus) refreshElevMarkers();
}

window.saveMarker = function() {
    const placeName = document.getElementById('placeName').value.trim(); const legendDesc = document.getElementById('legendDesc').value.trim();
    if (!placeName || !legendDesc) return alert("장소와 설명을 적어주세요!");
    const dataURL = canvas.toDataURL("image/png"); if (dataURL.length < 500) return alert("기호를 그려주세요!");
    const customIcon = L.icon({ iconUrl: dataURL, iconSize: [50, 50], iconAnchor: [25, 25], popupAnchor: [0, -28] });

    if (editingId !== null) {
        const data = markerDB[editingId]; data.placeName = placeName; data.legendDesc = legendDesc; data.imgData = dataURL;
        data.leafletMarker.setIcon(customIcon);
        const editBtnHtml = `<div style="display:flex; gap:5px;"><button onclick="window.editMarker(${editingId})" style="flex:1;"><i class="fa-solid fa-pen"></i> 관리</button><button onclick="window.deleteMarker(${editingId})" style="background:rgba(239, 68, 68, 0.8); width:auto; padding: 6px 10px;"><i class="fa-solid fa-trash"></i></button></div>`;
        data.leafletMarker.getPopup().setContent(`<div class="custom-popup"><h3>${placeName}</h3><p>${legendDesc}</p>${editBtnHtml}</div>`);
        data.legendElement.querySelector('img').src = dataURL; data.legendElement.querySelector('.desc').innerText = placeName;
        const gMarker = window.gameState.mapMarkers.find(m => m.id === editingId); if(gMarker) { gMarker.placeName = placeName; gMarker.legendDesc = legendDesc; gMarker.imgData = dataURL; }
        data.leafletMarker.openPopup();
    } else {
        const newId = markerIdCounter++; 
        const pureLatLng = { lat: clickedLatLng.lat, lng: clickedLatLng.lng };
        const marker = L.marker(pureLatLng, { icon: customIcon }).addTo(map);
        const editBtnHtml = `<div style="display:flex; gap:5px;"><button onclick="window.editMarker(${newId})" style="flex:1;"><i class="fa-solid fa-pen"></i> 관리</button><button onclick="window.deleteMarker(${newId})" style="background:rgba(239, 68, 68, 0.8); width:auto; padding: 6px 10px;"><i class="fa-solid fa-trash"></i></button></div>`;
        marker.bindPopup(`<div class="custom-popup"><h3>${placeName}</h3><p>${legendDesc}</p>${editBtnHtml}</div>`);
        const legendItem = window.addToLegend(dataURL, placeName, newId);
        markerDB[newId] = { leafletMarker: marker, legendElement: legendItem, latlng: pureLatLng, placeName: placeName, legendDesc: legendDesc, imgData: dataURL, author: window.currentUserId };
        window.gameState.mapMarkers.push({ id: newId, latlng: pureLatLng, placeName: placeName, legendDesc: legendDesc, imgData: dataURL, author: window.currentUserId });
        marker.openPopup();
        if(!window.isTeacherMode) { window.gameState.budget += 50; window.showNotification(`새로운 기호를 추가하여 50G를 획득했습니다!`); }
    }
    window.updateUI(); window.closeModal();
}

window.deleteMarker = function(id) {
    if(!confirm("⚠️ 이 기호를 지도에서 완전히 삭제하시겠습니까?")) return;
    const data = markerDB[id];
    if(data && data.leafletMarker) map.removeLayer(data.leafletMarker);
    delete markerDB[id];
    window.gameState.mapMarkers = window.gameState.mapMarkers.filter(m => m.id !== id);
    window.restoreMapMarkers(); window.saveGameState();
    window.showNotification("지도 기호가 성공적으로 삭제되었습니다.");
}

window.addToLegend = function(imgSrc, name, markerId) {
    const legendList = document.getElementById('legendList'); if (isLegendEmpty) { legendList.innerHTML = ''; isLegendEmpty = false; }
    const item = document.createElement('div'); item.className = 'legend-item';
    item.onclick = function() { const targetMarker = markerDB[markerId]; if(targetMarker && targetMarker.leafletMarker) { map.setView(targetMarker.leafletMarker.getLatLng(), 17, { animate: true }); setTimeout(() => { targetMarker.leafletMarker.openPopup(); }, 400); } };
    item.innerHTML = `<img src="${imgSrc}" alt="기호"><div class="desc">${name}</div>`; legendList.prepend(item); return item;
}

window.editMarker = function(id) {
    const data = markerDB[id];
    if (!window.isTeacherMode && data.author && data.author !== window.currentUserId) return alert("자신이 등록한 기호만 수정할 수 있습니다!");
    editingId = id; document.getElementById('placeName').value = data.placeName; document.getElementById('legendDesc').value = data.legendDesc;
    const img = new Image(); img.onload = function() { window.clearCanvas(); ctx.drawImage(img, 0, 0); }; img.src = data.imgData;
    window.openModal(); data.leafletMarker.closePopup(); 
};

// ==========================================
// 💡 사이드바 토글 및 지도 탭 라우팅
// ==========================================
window.toggleMapMenu = function(element) {
    const menu = document.getElementById('stageMapSubMenu');
    menu.classList.toggle('active'); element.classList.add('active');
    document.getElementById('stage1Nav').classList.remove('active');
    document.getElementById('stage1SubMenu').classList.remove('active');
    document.getElementById('stage2Nav').classList.remove('active');
    document.getElementById('stage2SubMenu').classList.remove('active');
    
    if(menu.classList.contains('active')) {
        window.switchMapTab('stage-map-1', menu.querySelector('.sub-nav-item'), '1) 우리 지역의 지도를 완성해봐요');
    }
}

window.switchMapTab = function(tabId, element, title) {
    document.querySelectorAll('.tab-panel').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item, .sub-nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');
    document.getElementById('stageMapNav').classList.add('active');
    document.getElementById('topbarTitle').innerText = title;
    
    if (tabId === 'stage-map-1') {
        setTimeout(() => { window.map.invalidateSize(); }, 100);
    } 
    else if (tabId === 'stage-map-2') {
        window.switchInnerTab('inner-map-geo', document.querySelector('#stage-map-2 .sub-tab-btn.active') || document.querySelectorAll('#stage-map-2 .sub-tab-btn')[0]);
        window.initGeoMap();
    }
}

// ==========================================
// 🧭 2-1 탭: 지도 상 거리와 방위 (Leaflet 2D)
// ==========================================
window.geoMapInitStatus = false;
let geoMapObj;
let geoLayerGroup;
let geoPolyline;
let geoLeafletMarkers = {}; 

window.geoSelection = { a: null, b: null };

window.initGeoMap = function() {
    if(window.geoMapInitStatus) {
        setTimeout(() => { geoMapObj.invalidateSize(); }, 100);
        return;
    }
    
    // 💡 2번 탭 지도 역시 DB에서 설정된 우리 반 좌표를 최우선으로 적용합니다.
    const startLat = window.gameState.mapCenter ? window.gameState.mapCenter.lat : initialLat;
    const startLng = window.gameState.mapCenter ? window.gameState.mapCenter.lng : initialLng;

    geoMapObj = L.map('geoMap', { zoomControl: false }).setView([startLat, startLng], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(geoMapObj);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(geoMapObj);
    geoLayerGroup = L.layerGroup().addTo(geoMapObj);
    
    window.geoMapInitStatus = true;
    refreshGeoMarkers();
}

function refreshGeoMarkers() {
    if(!window.geoMapInitStatus) return;
    geoLayerGroup.clearLayers();
    geoLeafletMarkers = {};
    
    window.gameState.mapMarkers.forEach(m => {
        const customIcon = L.icon({ iconUrl: m.imgData, iconSize: [40, 40], iconAnchor: [20, 20] });
        const marker = L.marker(m.latlng, { icon: customIcon }).addTo(geoLayerGroup);
        
        geoLeafletMarkers[m.id] = marker;
        
        marker.on('click', () => {
            if(!window.geoSelection.a) {
                window.geoSelection.a = m;
                L.DomUtil.addClass(marker._icon, 'marker-glow-a');
                window.showNotification("출발지가 선택되었습니다. 지도에서 다른 기호를 눌러 도착지를 지정하세요.");
            } else if(!window.geoSelection.b && window.geoSelection.a.id !== m.id) {
                window.geoSelection.b = m;
                L.DomUtil.addClass(marker._icon, 'marker-glow-b');
                drawGeoPolyline();
                window.showNotification("도착지가 지정되었습니다. 좌측 패널의 [분석하기] 버튼을 누르세요.");
            } else {
                window.resetGeoSelection();
                window.geoSelection.a = m;
                L.DomUtil.addClass(marker._icon, 'marker-glow-a');
                window.showNotification("새로운 출발지가 선택되었습니다.");
            }
            updateGeoSelectionUI();
        });
        marker.bindTooltip(`<strong>${m.placeName}</strong><br><span style="font-size:11px; color:#666;">클릭하여 선택</span>`, {direction: 'top', offset: [0, -15]});
    });
}

function drawGeoPolyline() {
    if(geoPolyline) geoMapObj.removeLayer(geoPolyline);
    const latlngs = [window.geoSelection.a.latlng, window.geoSelection.b.latlng];
    geoPolyline = L.polyline(latlngs, {color: 'var(--accent)', weight: 4, dashArray: '5, 5'}).addTo(geoMapObj);
    
    geoMapObj.fitBounds(geoPolyline.getBounds(), {
        paddingTopLeft: [380, 50], 
        paddingBottomRight: [50, 50],
        maxZoom: 15
    });
}

function updateGeoSelectionUI() {
    document.getElementById('geoPointA').innerText = window.geoSelection.a ? window.geoSelection.a.placeName : "지도에서 기호를 클릭하세요";
    document.getElementById('geoPointA').style.color = window.geoSelection.a ? "var(--primary)" : "var(--text-muted)";
    document.getElementById('geoPointB').innerText = window.geoSelection.b ? window.geoSelection.b.placeName : "지도에서 기호를 클릭하세요";
    document.getElementById('geoPointB').style.color = window.geoSelection.b ? "var(--accent)" : "var(--text-muted)";
}

window.resetGeoSelection = function() {
    window.geoSelection = { a: null, b: null };
    if(geoPolyline) { geoMapObj.removeLayer(geoPolyline); geoPolyline = null; }
    
    Object.values(geoLeafletMarkers).forEach(marker => {
        if(marker._icon) {
            L.DomUtil.removeClass(marker._icon, 'marker-glow-a');
            L.DomUtil.removeClass(marker._icon, 'marker-glow-b');
        }
    });

    document.getElementById('geoResultArea').style.display = 'none'; 
    updateGeoSelectionUI();
}

window.analyzeDistanceAndBearing = function() {
    if(!window.geoSelection.a || !window.geoSelection.b) return alert("지도에서 출발지와 도착지를 모두 클릭하여 선택해주세요.");
    
    const lat1 = window.geoSelection.a.latlng.lat; const lng1 = window.geoSelection.a.latlng.lng;
    const lat2 = window.geoSelection.b.latlng.lat; const lng2 = window.geoSelection.b.latlng.lng;

    const p1 = L.latLng(lat1, lng1);
    const p2 = L.latLng(lat2, lng2);
    const dist = p1.distanceTo(p2); 
    
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;
    const dLon = toRad(lng2 - lng1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = toDeg(Math.atan2(y, x));
    brng = (brng + 360) % 360;
    
    const dirs = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
    const dirStr = dirs[Math.round(brng / 45) % 8];
    const distStr = dist > 1000 ? (dist/1000).toFixed(2) + ' km' : Math.round(dist) + ' m';

    document.getElementById('geoResultArea').style.display = 'block';
    document.getElementById('resPointA').innerText = window.geoSelection.a.placeName;
    document.getElementById('resPointB').innerText = window.geoSelection.b.placeName;
    document.getElementById('resBearing').innerText = dirStr + "쪽";
    document.getElementById('resDistance').innerText = "약 " + distStr;
    window.showNotification("거리와 방위 분석 결과가 확인되었습니다.");
}

// ==========================================
// ⛰️ 2-2 탭: 지도 속 땅의 모습 3D 관찰 (MapLibre + Chart.js)
// ==========================================
window.elevMapInitStatus = false;
let elevMapObj;
let elevMarkersList = {}; 
window.elevSelection = { a: null, b: null };
window.elevChartInstance = null;

window.initElevMap = function() {
    if(window.elevMapInitStatus) {
        setTimeout(() => { elevMapObj.resize(); }, 100);
        return;
    }

    // 💡 3D 지형 맵 역시 DB에서 설정된 우리 반 좌표를 최우선으로 적용합니다.
    const startLat = window.gameState.mapCenter ? window.gameState.mapCenter.lat : initialLat;
    const startLng = window.gameState.mapCenter ? window.gameState.mapCenter.lng : initialLng;

    elevMapObj = new maplibregl.Map({
        container: 'elevMap',
        style: {
            version: 8,
            sources: {
                osm: { type: 'raster', tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 },
                terrainSource: { 
                    type: 'raster-dem', 
                    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], 
                    encoding: 'terrarium', 
                    tileSize: 256, 
                    maxzoom: 14 
                }
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
            terrain: { source: 'terrainSource', exaggeration: 2.0 }
        },
        center: [startLng, startLat], // MapLibre는 Lng, Lat 순서
        zoom: 13,
        pitch: 60,
        bearing: 0
    });
    
    elevMapObj.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    elevMapObj.on('load', () => {
        window.elevMapInitStatus = true;
        refreshElevMarkers();
    });
}

function refreshElevMarkers() {
    if(!window.elevMapInitStatus) return;
    
    Object.values(elevMarkersList).forEach(m => m.remove());
    elevMarkersList = {};
    
    window.gameState.mapMarkers.forEach(m => {
        const el = document.createElement('div');
        el.className = 'custom-3d-marker';
        el.style.backgroundImage = `url(${m.imgData})`;
        el.style.width = '45px'; el.style.height = '45px';
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.cursor = 'pointer';
        el.style.filter = 'drop-shadow(0px 4px 4px rgba(0,0,0,0.3))';
        el.style.transition = '0.2s';
        
        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([m.latlng.lng, m.latlng.lat])
            .addTo(elevMapObj);
            
        el.addEventListener('click', () => {
            handleElevMarkerClick(m, el);
        });
        
        elevMarkersList[m.id] = marker;
    });
}

function handleElevMarkerClick(m, el) {
    if(!window.elevSelection.a) {
        window.elevSelection.a = m;
        el.classList.add('marker-glow-a');
        window.showNotification("출발지가 선택되었습니다. 도착지를 지정하세요.");
    } else if(!window.elevSelection.b && window.elevSelection.a.id !== m.id) {
        window.elevSelection.b = m;
        el.classList.add('marker-glow-b');
        drawElevPolyline();
        window.showNotification("도착지 선택 완료! 하단 [땅의 높낮이 단면도 보기] 버튼을 눌러보세요.");
    } else {
        window.resetElevSelection();
        window.elevSelection.a = m;
        el.classList.add('marker-glow-a');
        window.showNotification("새로운 출발지가 선택되었습니다.");
    }
    updateElevSelectionUI();
}

function drawElevPolyline() {
    const coords = [
        [window.elevSelection.a.latlng.lng, window.elevSelection.a.latlng.lat],
        [window.elevSelection.b.latlng.lng, window.elevSelection.b.latlng.lat]
    ];
    
    if(elevMapObj.getSource('route')) {
        elevMapObj.getSource('route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
    } else {
        elevMapObj.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
        });
        elevMapObj.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#16a34a', 'line-width': 5, 'line-dasharray': [2, 2] }
        });
    }
    
    const bounds = new maplibregl.LngLatBounds(coords[0], coords[1]);
    elevMapObj.fitBounds(bounds, { 
        padding: {top: 100, bottom: 250, left: 400, right: 100}, 
        maxZoom: 14, 
        pitch: 60 
    });
}

function updateElevSelectionUI() {
    document.getElementById('elevPointA').innerText = window.elevSelection.a ? window.elevSelection.a.placeName : "지도에서 기호를 클릭하세요";
    document.getElementById('elevPointA').style.color = window.elevSelection.a ? "var(--success)" : "var(--text-muted)";
    document.getElementById('elevPointB').innerText = window.elevSelection.b ? window.elevSelection.b.placeName : "지도에서 기호를 클릭하세요";
    document.getElementById('elevPointB').style.color = window.elevSelection.b ? "var(--accent)" : "var(--text-muted)";
}

window.resetElevSelection = function() {
    window.elevSelection = { a: null, b: null };
    if(elevMapObj && elevMapObj.getSource('route')) {
        elevMapObj.getSource('route').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
    }
    
    Object.values(elevMarkersList).forEach(marker => {
        marker.getElement().classList.remove('marker-glow-a');
        marker.getElement().classList.remove('marker-glow-b');
    });

    document.getElementById('elevChartContainer').style.display = 'none';
    if(window.elevChartInstance) { window.elevChartInstance.destroy(); window.elevChartInstance = null; }
    updateElevSelectionUI();
}

window.fetchAndDrawElevationProfile = async function() {
    if(!window.elevSelection.a || !window.elevSelection.b) return alert("지도 위에서 기호 2개를 모두 선택해주세요.");

    const lat1 = window.elevSelection.a.latlng.lat; const lng1 = window.elevSelection.a.latlng.lng;
    const lat2 = window.elevSelection.b.latlng.lat; const lng2 = window.elevSelection.b.latlng.lng;
    
    const points = 30;
    const lats = []; const lngs = []; const labels = [];
    for(let i=0; i<=points; i++) {
        const ratio = i / points;
        lats.push((lat1 + (lat2 - lat1) * ratio).toFixed(5));
        lngs.push((lng1 + (lng2 - lng1) * ratio).toFixed(5));
        
        if(i === 0) labels.push(window.elevSelection.a.placeName);
        else if (i === points) labels.push(window.elevSelection.b.placeName);
        else labels.push(''); 
    }

    try {
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats.join(',')}&longitude=${lngs.join(',')}`;
        const response = await fetch(url);
        if(!response.ok) throw new Error("API 통신 에러");
        
        const data = await response.json();
        const elevations = data.elevation; 

        document.getElementById('elevChartContainer').style.display = 'block';
        if(window.elevChartInstance) window.elevChartInstance.destroy();
        
        const ctx = document.getElementById('elevationChart').getContext('2d');
        window.elevChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '해발 고도 (m)',
                    data: elevations,
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4, 
                    pointRadius: 2,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, 
                scales: {
                    y: { beginAtZero: false, title: { display: true, text: '높이 (m)', font: {weight: 'bold'} } },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(context) { return context.parsed.y + ' m'; } } }
                }
            }
        });

    } catch (error) {
        console.error("고도 분석 오류:", error);
        alert("해발 고도 데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
}