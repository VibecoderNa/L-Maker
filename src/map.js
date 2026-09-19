// ==========================================
// 1단계: 기존 지도 그리기 (STAGE 1-1)
// ==========================================

const initialLat = 37.5665; 
const initialLng = 126.9780;
// 💡 초기 줌 레벨 16 적용 (동네 골목이 잘 보이도록)
const map = L.map('map', { zoomControl: false }).setView([initialLat, initialLng], 16);
window.map = map;

L.control.zoom({ position: 'bottomright' }).addTo(map);

// ==========================================
// [2026-09-20 추가] 배경 지도(타일) 준비
//   OpenStreetMap 타일 서버는 요청이 '어디서 왔는지'(Referer)를 확인합니다.
//   파일을 더블클릭해 여는 file:// 방식에서는 이 정보가 없어 403으로 거부됩니다.
//   그래서 그때만 OpenFreeMap(등록·키 불필요, 무제한 무료)으로 자동 전환합니다.
//   ※ 인터넷 주소(https)로 접속할 때는 지금까지와 '완전히 동일하게' 동작합니다.
// ==========================================
window.IS_FILE_MODE = (window.location.protocol === 'file:');
window.OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';

// 대체 배경 지도 안에 들어 있는 MapLibre 지도 객체를 안전하게 꺼냅니다.
window.getGlMapOf = function(targetMap) {
    try {
        const gl = targetMap && targetMap._baseGlLayer;
        if (!gl) return null;
        if (typeof gl.getMaplibreMap === 'function') return gl.getMaplibreMap();
        return gl._glMap || gl._maplibreMap || null;
    } catch (e) { return null; }
};

// 배경 지도에 없는 아이콘 때문에 뜨는 콘솔 경고를 조용히 처리합니다.
//   (지도 표시에는 영향이 없지만, 경고가 수십 줄 쌓이면 진짜 오류를 놓치기 쉽습니다)
window.silenceStyleImageWarnings = function(glMap) {
    if (!glMap || typeof glMap.on !== 'function' || glMap.__warnSilenced) return;
    glMap.__warnSilenced = true;
    try {
        glMap.on('styleimagemissing', function(e) {
            try {
                if (e && e.id && !glMap.hasImage(e.id)) {
                    glMap.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
                }
            } catch (err) { /* 무시 */ }
        });
    } catch (e) { /* 무시 */ }
};

// 탭을 열었을 때 지도를 화면 크기에 맞게 다시 그립니다.
//   ※ 첫 번째 지도는 '화면에 보이기 전'에 만들어지므로 크기가 0입니다.
//     Leaflet만 갱신하면 그 안의 배경 지도는 작은 채로 남아 가로 폭이 모자라 보입니다.
window.refreshBaseLayer = function(targetMap) {
    if (!targetMap) return;
    try { targetMap.invalidateSize(); } catch (e) { /* 무시 */ }
    const glMap = window.getGlMapOf(targetMap);
    if (glMap) {
        window.silenceStyleImageWarnings(glMap);
        try { glMap.resize(); } catch (e) { console.warn('[지도] 배경 지도 크기 조정에 실패했습니다.', e); }
    }
};

// 지도 상자의 크기가 바뀌면(사이드바 접기, 창 크기 조절 등) 자동으로 다시 맞춥니다.
//   ※ 사이드바는 0.3초에 걸쳐 접히는데, 그동안 배경 지도는 예전 폭을 기억하고 있어
//     오른쪽에 빈 띠가 남았습니다. 이제 크기 변화를 지켜보다가 알아서 고칩니다.
window.watchMapSize = function(targetMap) {
    if (!targetMap || targetMap.__sizeWatched) return;
    if (typeof ResizeObserver !== 'function') return;   // 아주 옛 브라우저는 그냥 넘어감
    try {
        const el = targetMap.getContainer();
        if (!el) return;
        targetMap.__sizeWatched = true;
        let timer = null;
        const observer = new ResizeObserver(function() {
            clearTimeout(timer);
            timer = setTimeout(function() { window.refreshBaseLayer(targetMap); }, 120);
        });
        observer.observe(el);
    } catch (e) { /* 감시에 실패해도 지도 동작에는 영향이 없습니다 */ }
};

window.addBaseLayer = function(targetMap, maxZoom) {
    window.watchMapSize(targetMap);
    if (window.IS_FILE_MODE && typeof L.maplibreGL === 'function' && typeof maplibregl !== 'undefined') {
        try {
            const glLayer = L.maplibreGL({ style: window.OPENFREEMAP_STYLE }).addTo(targetMap);
            targetMap._baseGlLayer = glLayer;   // 나중에 크기를 다시 맞출 때 사용
            setTimeout(function() { window.silenceStyleImageWarnings(window.getGlMapOf(targetMap)); }, 0);
            try {
                if (targetMap.attributionControl) {
                    targetMap.attributionControl.addAttribution('&copy; OpenStreetMap contributors | OpenFreeMap');
                }
            } catch (e) { /* 저작자 표시 추가 실패는 지도 동작과 무관 */ }
            console.info('[지도] 파일 실행 모드입니다. OpenFreeMap 배경 지도를 사용합니다.');
            return glLayer;
        } catch (e) {
            console.warn('[지도] 대체 배경 지도를 쓰지 못해 기본 지도로 전환합니다.', e);
        }
    }
    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: maxZoom || 19
    }).addTo(targetMap);
};

window.addBaseLayer(map, 19);

// 기호 고유번호는 시각(ms)으로 만든다.
// 예전처럼 0,1,2… 로 세면 학생마다 같은 번호가 생겨 서로의 기호가 지워졌습니다.
window.makeMarkerId = function() {
    let id = Date.now();
    while (window.gameState && window.gameState.mapMarkers && window.gameState.mapMarkers.some(m => m.id === id)) id++;
    return id;
};

const markerDB = {}; let editingId = null; let clickedLatLng = null; let isLegendEmpty = true;
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
    const legendList = document.getElementById('legendList'); legendList.innerHTML = ''; isLegendEmpty = true;
    
    window.gameState.mapMarkers.forEach(mData => {
        const customIcon = L.icon({ iconUrl: mData.imgData, iconSize: [50, 50], iconAnchor: [25, 25], popupAnchor: [0, -28] });
        const marker = L.marker(mData.latlng, { icon: customIcon }).addTo(map);
        
        const editBtnHtml = (mData.author === window.currentUserId) || window.isTeacherMode 
            ? `<div style="display:flex; gap:5px;"><button onclick="window.editMarker(${mData.id})" style="flex:1;"><i class="fa-solid fa-pen"></i> 관리</button><button onclick="window.deleteMarker(${mData.id})" style="background:rgba(239, 68, 68, 0.8); width:auto; padding: 6px 10px;"><i class="fa-solid fa-trash"></i></button></div>` 
            : `<div style="font-size:11px; color:var(--text-muted); margin-top:10px;">${mData.author}번 시장님 기호</div>`;
        
        marker.bindPopup(`<div class="custom-popup"><h3>${mData.placeName}</h3><p>${mData.legendDesc}</p>${editBtnHtml}</div>`);
        const legendItem = window.addToLegend(mData.imgData, mData.placeName, mData.id);
        markerDB[mData.id] = { leafletMarker: marker, legendElement: legendItem, latlng: mData.latlng, placeName: mData.placeName, legendDesc: mData.legendDesc, imgData: mData.imgData, author: mData.author };
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
    if (!placeName || !legendDesc) return window.uiAlert("장소 이름과 기호의 뜻을 모두 적어주세요!", { title: '✏️ 빠진 내용이 있어요' });
    // [2026-09-19 변경] 지도에는 최대 50px로만 보이므로 110px이면 충분합니다.
    const raw = canvas.toDataURL("image/png");
    if (raw.length < 1500) return window.uiAlert("기호를 먼저 그려주세요!", { title: '✏️ 기호가 비어 있어요' });
    const dataURL = window.shrinkSymbol(canvas, window.SYMBOL_SAVE_SIZE);
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
        const newId = window.makeMarkerId(); 
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
    window.updateUI();          // 내 예산 저장
    window.saveClassState();    // 지도 기호는 학급 공용 자료
    window.closeModal();
}

// ==========================================
// [2026-09-19 변경] 기호 그림 저장 용량 줄이기
//   기호는 지도에서 50px, 범례에서 36px로만 보입니다.
//   그런데 예전에는 150px PNG로 저장해 기호 하나가 약 17KB나 차지했습니다.
//   35개만 모여도 약 600KB로, 학급 저장 공간(1MB)을 금방 채웠습니다.
//   이제 110px로 줄이고, 용량이 훨씬 작은 WebP 형식을 함께 시도합니다.
//   (WebP를 지원하지 않는 옛 브라우저에서는 자동으로 PNG를 사용합니다)
// ==========================================
window.SYMBOL_SAVE_SIZE = 110;      // 저장할 기호 그림의 한 변 길이(px)
window.SYMBOL_WEBP_QUALITY = 0.85;  // WebP 화질 (0~1, 높을수록 선명하고 용량이 큼)

window.shrinkSymbol = function(sourceCanvas, size) {
    try {
        const px = size || window.SYMBOL_SAVE_SIZE;
        const small = document.createElement('canvas');
        small.width = px;
        small.height = px;
        const sctx = small.getContext('2d');
        sctx.imageSmoothingQuality = 'high';
        sctx.clearRect(0, 0, px, px);
        sctx.drawImage(sourceCanvas, 0, 0, px, px);

        // PNG와 WebP를 모두 만들어 본 뒤 더 작은 쪽을 고른다
        let best = small.toDataURL("image/png");
        try {
            const webp = small.toDataURL("image/webp", window.SYMBOL_WEBP_QUALITY);
            // 브라우저가 WebP를 모르면 PNG를 돌려주므로 형식을 꼭 확인한다
            if (webp.indexOf('data:image/webp') === 0 && webp.length < best.length) best = webp;
        } catch (e) { /* WebP 미지원 브라우저는 PNG를 그대로 사용 */ }

        return best;
    } catch (e) {
        console.warn("기호 축소 실패, 원본을 사용합니다.", e);
        return sourceCanvas.toDataURL("image/png");
    }
};

// 이미 저장된 기호 그림 하나를 다시 작게 줄인다
function reshrinkStoredSymbol(dataUrl, size) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
            try {
                const c = document.createElement('canvas');
                c.width = size;
                c.height = size;
                const cctx = c.getContext('2d');
                cctx.imageSmoothingQuality = 'high';
                cctx.clearRect(0, 0, size, size);
                cctx.drawImage(img, 0, 0, size, size);
                resolve(window.shrinkSymbol(c, size));
            } catch (err) { reject(err); }
        };
        img.onerror = function() { reject(new Error("기호 그림을 읽지 못했습니다.")); };
        img.src = dataUrl;
    });
}

// ==========================================
// [2026-09-19 추가] 이미 쌓인 기호 그림 일괄 정리 도구
//   사용법: 선생님(또는 학생) 화면에서 F12 → 콘솔에 아래를 입력
//           await window.compactMapSymbols()
//   예전 방식(150px PNG)으로 저장된 기호들을 한 번에 다시 줄여 저장합니다.
// ==========================================
window.compactMapSymbols = async function(size) {
    const px = size || window.SYMBOL_SAVE_SIZE;

    if (!window.gameState || !Array.isArray(window.gameState.mapMarkers)) {
        console.warn("[기호 정리] 지도 기호 자료를 찾지 못했습니다. 로그인 후 다시 실행해주세요.");
        return null;
    }

    const markers = window.gameState.mapMarkers;
    if (markers.length === 0) {
        console.log("[기호 정리] 정리할 기호가 없습니다.");
        return null;
    }

    const before = JSON.stringify(markers).length;
    let done = 0;
    let skipped = 0;

    for (const m of markers) {
        if (!m.imgData || typeof m.imgData !== 'string') { skipped++; continue; }
        try {
            const shrunk = await reshrinkStoredSymbol(m.imgData, px);
            if (shrunk && shrunk.length < m.imgData.length) {
                m.imgData = shrunk;
                done++;
            } else {
                skipped++;   // 이미 충분히 작은 기호
            }
        } catch (e) {
            console.warn("[기호 정리] 건너뜀:", m.placeName, e);
            skipped++;
        }
    }

    const after = JSON.stringify(markers).length;
    const saved = before - after;
    const percent = before > 0 ? Math.round((saved / before) * 100) : 0;

    console.log(`[기호 정리] 압축 ${done}개 / 건너뜀 ${skipped}개`);
    console.log(`[기호 정리] ${before.toLocaleString()} → ${after.toLocaleString()} 바이트 (${percent}% 감소, 약 ${Math.round(saved / 1024)}KB 확보)`);

    if (done > 0) {
        window.restoreMapMarkers();
        await window.saveClassState();
        if (window.showNotification) {
            window.showNotification(`지도 기호 ${done}개를 정리했습니다. 저장 공간 약 ${Math.round(saved / 1024)}KB를 확보했어요!`);
        }
    } else {
        console.log("[기호 정리] 줄일 수 있는 기호가 없어 저장하지 않았습니다.");
    }

    return { before: before, after: after, done: done, skipped: skipped };
};

window.deleteMarker = async function(id) {
    const ok = await window.uiConfirm("이 기호를 지도에서 완전히 지웁니다.\n지운 기호는 되돌릴 수 없습니다.",
        { title: '🗑️ 기호를 삭제할까요?', okText: '삭제하기', cancelText: '취소', danger: true });
    if (!ok) return;
    const data = markerDB[id];
    if(data && data.leafletMarker) map.removeLayer(data.leafletMarker);
    delete markerDB[id];
    window.gameState.mapMarkers = window.gameState.mapMarkers.filter(m => m.id !== id);
    window.restoreMapMarkers(); window.saveClassState();
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
    if (!data) return;
    if (!window.isTeacherMode && data.author && data.author !== window.currentUserId) return window.uiAlert("자기가 만든 기호만 고칠 수 있어요!", { title: '🔒 수정할 수 없어요' });
    editingId = id; document.getElementById('placeName').value = data.placeName; document.getElementById('legendDesc').value = data.legendDesc;
    const img = new Image(); img.onload = function() { window.clearCanvas(); ctx.drawImage(img, 0, 0); }; img.src = data.imgData;
    window.openModal(); data.leafletMarker.closePopup(); 
};

// ==========================================
// 💡 [신규] 우리 학교로 돌아가기 (홈 버튼) 기능
// ==========================================
window.goToSchoolCenter = function(targetMapName) {
    const targetLat = window.gameState.mapCenter ? window.gameState.mapCenter.lat : initialLat;
    const targetLng = window.gameState.mapCenter ? window.gameState.mapCenter.lng : initialLng;
    const targetZoom = 16;

    if (targetMapName === 'map' && window.map) {
        window.map.setView([targetLat, targetLng], targetZoom, { animate: true });
    } else if (targetMapName === 'geoMap' && geoMapObj) {
        geoMapObj.setView([targetLat, targetLng], targetZoom, { animate: true });
    } else if (targetMapName === 'elevMap' && elevMapObj) {
        elevMapObj.flyTo({ center: [targetLng, targetLat], zoom: targetZoom, pitch: 60, bearing: 0 });
    }
}

// ==========================================
// 💡 [신규] 기호 인벤토리 (목록에서 기호 선택) 기능
// ==========================================
window.openMarkerInventory = function(type) {
    const modal = document.getElementById('markerInventoryModal');
    const listContainer = document.getElementById('inventoryList');
    listContainer.innerHTML = '';
    
    if (!window.gameState.mapMarkers || window.gameState.mapMarkers.length === 0) {
        listContainer.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px; font-size:14px; background:#f8fafc; border-radius:8px;">등록된 기호가 없습니다.<br>지도에 먼저 기호를 등록해주세요.</div>';
    } else {
        // 기존 검색 결과용 스타일(search-result-item)을 활용하여 예쁘게 렌더링
        window.gameState.mapMarkers.forEach(m => {
            const item = document.createElement('div');
            item.className = 'search-result-item'; 
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '15px';
            item.innerHTML = `
                <img src="${m.imgData}" style="width:36px; height:36px; object-fit:contain; border:1px solid var(--border-color); border-radius:8px; background:white;">
                <div>
                    <div style="font-weight:bold; color:var(--text-main); font-size:14px; margin-bottom:3px;">${m.placeName}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${m.legendDesc}</div>
                </div>
            `;
            item.onclick = function() {
                window.selectMarkerFromInventory(m, type);
                modal.classList.remove('active'); // 선택하면 창이 자동으로 닫힘
            };
            listContainer.appendChild(item);
        });
    }
    modal.classList.add('active');
}

// 인벤토리에서 선택한 기호를 강제로 클릭(이벤트 발생) 처리하는 함수
window.selectMarkerFromInventory = function(m, type) {
    if (type === 'geo') {
        const marker = geoLeafletMarkers[m.id];
        if (marker) {
            geoMapObj.setView(m.latlng, 16, { animate: true }); // 지도를 해당 마커로 스르륵 이동
            marker.fire('click'); // Leaflet 마커 클릭 이벤트 강제 발생
        }
    } else if (type === 'elev') {
        const marker = elevMarkersList[m.id];
        if (marker) {
            elevMapObj.flyTo({ center: [m.latlng.lng, m.latlng.lat], zoom: 16, pitch: 60, bearing: 0 }); // 지형도를 해당 마커로 스르륵 이동
            marker.getElement().click(); // MapLibre DOM 요소 클릭 강제 발생
        }
    }
}

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
        setTimeout(() => { window.refreshBaseLayer(window.map); }, 100);
        setTimeout(() => { window.refreshBaseLayer(window.map); }, 400);   // 느린 기기 대비 한 번 더
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
        setTimeout(() => { window.refreshBaseLayer(geoMapObj); }, 100);
        setTimeout(() => { window.refreshBaseLayer(geoMapObj); }, 400);   // 느린 기기 대비 한 번 더
        return;
    }
    
    const startLat = window.gameState.mapCenter ? window.gameState.mapCenter.lat : initialLat;
    const startLng = window.gameState.mapCenter ? window.gameState.mapCenter.lng : initialLng;

    geoMapObj = L.map('geoMap', { zoomControl: false }).setView([startLat, startLng], 16);
    L.control.zoom({ position: 'bottomright' }).addTo(geoMapObj);
    window.addBaseLayer(geoMapObj);
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
                window.showNotification("출발지가 선택되었습니다. 도착지를 지정하세요.");
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
    geoPolyline = L.polyline(latlngs, {color: '#ea580c', weight: 4, dashArray: '5, 5'}).addTo(geoMapObj);
    
    geoMapObj.fitBounds(geoPolyline.getBounds(), {
        paddingTopLeft: [380, 50], 
        paddingBottomRight: [50, 50],
        maxZoom: 17
    });
}

function updateGeoSelectionUI() {
    document.getElementById('geoPointA').innerText = window.geoSelection.a ? window.geoSelection.a.placeName : "지도에서 클릭하세요";
    document.getElementById('geoPointA').style.color = window.geoSelection.a ? "var(--primary)" : "var(--text-muted)";
    document.getElementById('geoPointB').innerText = window.geoSelection.b ? window.geoSelection.b.placeName : "지도에서 클릭하세요";
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
    if(!window.geoSelection.a || !window.geoSelection.b) return window.uiAlert("지도에서 출발지와 도착지를 모두 클릭해주세요.", { title: '📍 두 곳을 선택해주세요' });
    
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

    const startLat = window.gameState.mapCenter ? window.gameState.mapCenter.lat : initialLat;
    const startLng = window.gameState.mapCenter ? window.gameState.mapCenter.lng : initialLng;

    // 땅의 높이 자료 (3D 지형 효과에 사용) - 두 방식 모두 같은 자료를 씁니다.
    const terrainSource = {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14
    };

    // 인터넷 주소(https)로 접속했을 때 쓰는 기존 방식 - 지금까지와 동일합니다.
    const osmStyle = {
        version: 8,
        sources: {
            osm: { type: 'raster', tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 },
            terrainSource: terrainSource
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        terrain: { source: 'terrainSource', exaggeration: 2.0 }
    };

    elevMapObj = new maplibregl.Map({
        container: 'elevMap',
        // 파일 실행 모드에서는 OpenStreetMap 타일이 거부되므로 OpenFreeMap을 씁니다.
        style: window.IS_FILE_MODE ? window.OPENFREEMAP_STYLE : osmStyle,
        center: [startLng, startLat], 
        zoom: 16,
        pitch: 60,
        bearing: 0
    });
    
    window.silenceStyleImageWarnings(elevMapObj);

    elevMapObj.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    elevMapObj.on('load', () => {
        // OpenFreeMap 스타일에는 땅 높이 자료가 없으므로 여기서 직접 붙여 3D 효과를 만듭니다.
        if (window.IS_FILE_MODE) {
            try {
                if (!elevMapObj.getSource('terrainSource')) elevMapObj.addSource('terrainSource', terrainSource);
                elevMapObj.setTerrain({ source: 'terrainSource', exaggeration: 2.0 });
            } catch (e) {
                console.warn('[지도] 3D 지형 효과를 적용하지 못했습니다. 평면으로 표시됩니다.', e);
            }
        }
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
        window.showNotification("도착지 선택 완료! 하단 [땅의 높낮이 알아보기] 버튼을 눌러보세요.");
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
        maxZoom: 16, 
        pitch: 60 
    });
}

function updateElevSelectionUI() {
    document.getElementById('elevPointA').innerText = window.elevSelection.a ? window.elevSelection.a.placeName : "지도에서 클릭하세요";
    document.getElementById('elevPointA').style.color = window.elevSelection.a ? "var(--success)" : "var(--text-muted)";
    document.getElementById('elevPointB').innerText = window.elevSelection.b ? window.elevSelection.b.placeName : "지도에서 클릭하세요";
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
    if(!window.elevSelection.a || !window.elevSelection.b) return window.uiAlert("지도 위에서 기호 2개를 모두 선택해주세요.", { title: '📍 두 곳을 선택해주세요' });

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
                    // 💡 라벨 용어 순화됨 (해발 고도 -> 땅의 높이)
                    label: '땅의 높이 (m)',
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
        window.uiAlert("땅의 높낮이 정보를 불러오지 못했습니다.\n잠시 후 다시 시도해주세요.", { title: '⛰️ 자료를 못 받았어요' });
    }
}