import { db } from './firebase.js'; 
import './map.js'; 
import './ui.js';   
import './api.js';     
import './teacher.js'; 
import { doc, setDoc, getDoc, onSnapshot, collection, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.fsIncrement = increment;

window.padletColors = ['var(--note-1)', 'var(--note-2)', 'var(--note-3)', 'var(--note-4)'];
window.districtLevels = [{ threshold: 0, name: "🌱 첫걸음을 뗀 우리 마을" }, { threshold: 40, name: "🏡 온기가 생겨나는 이웃 동네" }, { threshold: 135, name: "✨ 활력이 넘치는 자급자족 도시" }, { threshold: 290, name: "🌈 모두를 포용하는 스마트 그린 도시" }, { threshold: 540, name: "🌍 지속 가능한 미래형 모범 지역" }];

window.buildingsData = [
    { id: 'b1', tag: '복지', name: '작은 도서관 & 돌봄 쉼터', icon: 'fa-book-open-reader', costBudget: 200, reqVisitor: 10, reqReputation: 2, rewardSat: 15, desc:'기초 생활 복지 시설.' },
    { id: 'b2', tag: '의료', name: '마을 보건소 & 건강증진센터', icon: 'fa-house-medical', costBudget: 400, reqVisitor: 50, reqReputation: 10, rewardSat: 25, desc:'건강 안전망.' },
    { id: 'b3', tag: '환경', name: '로컬푸드 직매장 & 공유 마당', icon: 'fa-basket-shopping', costBudget: 600, reqVisitor: 120, reqReputation: 20, rewardSat: 40, desc:'친환경 소비 공간.' },
    { id: 'b4', tag: '문화', name: '자연 생태 숲길 & 캠핑장', icon: 'fa-campground', costBudget: 800, reqVisitor: 250, reqReputation: 35, rewardSat: 55, desc:'친환경 관광지.' },
    { id: 'b5', tag: '디지털', name: '디지털 시민 교육관', icon: 'fa-laptop-code', costBudget: 1100, reqVisitor: 400, reqReputation: 50, rewardSat: 70, desc:'미래형 교육 센터.' },
    { id: 'b6', tag: '문화', name: '역사·문화 아카이브 센터', icon: 'fa-landmark', costBudget: 1400, reqVisitor: 600, reqReputation: 70, rewardSat: 85, desc:'전통 가치 보존 공간.' },
    { id: 'b7', tag: '교통', name: '스마트 친환경 환승 주차장', icon: 'fa-charging-station', costBudget: 1800, reqVisitor: 850, reqReputation: 95, rewardSat: 110, desc:'친환경 교통망.' },
    { id: 'b8', tag: '미래', name: '자원순환 발전소', icon: 'fa-recycle', costBudget: 2400, reqVisitor: 1200, reqReputation: 120, rewardSat: 140, desc:'지속 가능한 테크 인프라.' }
];

window.eduOffices = {
    seoul: { lat: 37.5662, lng: 126.9666 },
    gyeonggi: { lat: 37.2220, lng: 127.0436 },
    incheon: { lat: 37.4561, lng: 126.7052 },
    gangwon: { lat: 37.8761, lng: 127.7289 },
    chungnam: { lat: 36.6588, lng: 126.6728 },
    chungbuk: { lat: 36.6064, lng: 127.4809 },
    daejeon: { lat: 36.3537, lng: 127.3848 },
    sejong: { lat: 36.4799, lng: 127.2887 },
    gyeongbuk: { lat: 36.5754, lng: 128.5058 },
    gyeongnam: { lat: 35.2377, lng: 128.6811 },
    daegu: { lat: 35.8582, lng: 128.6225 },
    busan: { lat: 35.1764, lng: 129.0647 },
    ulsan: { lat: 35.5521, lng: 129.3211 },
    jeonbuk: { lat: 35.8150, lng: 127.1087 },
    jeonnam: { lat: 34.8161, lng: 126.4628 },
    gwangju: { lat: 35.1601, lng: 126.8514 },
    jeju: { lat: 33.4890, lng: 126.4983 }
};

window.isTeacherMode = false; window.dynamicApiKey = ""; window.dynamicApiKeys = []; window.dynamicApiModel = "gemini-3.8-flash"; window.classKey = ''; window.userKey = ''; window.currentUserId = ''; 
window.gameState = { budget: 500, visitorCount: 0, reputation: 0, satisfaction: 0, submittedProposals: [], problems: [], promoBoard: [], marketingCampaigns: [], builtBuildings: [], mapMarkers: [], mapCenter: null };
window.currentSelectedProblem = null; window.currentSelectedPromo = null;
window.allStudentsData = {}; window.classDataLoaded = false; window.studentDataLoaded = false;
window.initialMapCenterSet = false;

window.getTodayStr = function() { const d = new Date(); const offset = d.getTimezoneOffset() * 60000; const kstTime = new Date(d.getTime() - offset + (9 * 60 * 60000)); return kstTime.toISOString().split('T')[0]; }
window.safeGetItem = function(key) { try { return localStorage.getItem(key); } catch(e) { return null; } }
window.safeSetItem = function(key, value) { try { localStorage.setItem(key, value); } catch(e) {} }
window.moveToNext = function(current, index) { if (current.value.length >= 1) { const next = document.querySelectorAll('.code-digit')[index + 1]; if (next) next.focus(); } }
window.handleBackspace = function(e, current, index) { if (e.key === 'Backspace' && current.value === '') { const prev = document.querySelectorAll('.code-digit')[index - 1]; if (prev) { prev.focus(); prev.value = ''; } } }

window.toggleSidebar = function() {
    const sidebar = document.getElementById('mainSidebar');
    const icon = document.getElementById('sidebarToggleIcon');
    sidebar.classList.toggle('collapsed');
    if(sidebar.classList.contains('collapsed')) {
        icon.classList.remove('fa-chevron-left');
        icon.classList.add('fa-chevron-right');
    } else {
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-left');
    }
}

let secretClicks = 0; let secretTimeout;
window.handleSecretTeacherLogin = function() { secretClicks++; clearTimeout(secretTimeout); secretTimeout = setTimeout(() => secretClicks = 0, 1500); if (secretClicks >= 5) { secretClicks = 0; window.initSystem(true); } }
window.toggleLogoutMenu = function(e) { const menu = document.getElementById('logoutMenu'); menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; }

window.executeLogout = async function(e) {
    if(e) e.stopPropagation();
    if(!confirm("시스템을 종료하고 안전하게 로그아웃 하시겠습니까?")) return;
    if(!window.isTeacherMode && window.classKey && window.userKey) {
        try { document.body.style.opacity = '0.5'; await setDoc(doc(db, "classes", window.classKey, "students", window.userKey), { isOnline: false }, { merge: true }); } catch(err) { console.error("로그아웃 오류:", err); }
    }
    location.reload(); 
}

window.addApiKeyUI = function() {
    const input = document.getElementById('teacherApiKeyInput');
    const val = input.value.trim();
    if(!val) return;
    if(window.dynamicApiKeys.includes(val)) return window.showNotification("이미 등록된 키입니다.");
    window.dynamicApiKeys.push(val);
    input.value = '';
    window.renderApiKeysUI();
}

window.removeApiKeyUI = function(index) {
    window.dynamicApiKeys.splice(index, 1);
    window.renderApiKeysUI();
}

window.renderApiKeysUI = function() {
    const list = document.getElementById('apiKeysList');
    list.innerHTML = '';
    if (window.dynamicApiKeys.length === 0) {
        list.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center;">등록된 키가 없습니다. 위에서 키를 추가해주세요.</div>';
        return;
    }
    window.dynamicApiKeys.forEach((key, i) => {
        let masked = key;
        if(key.length > 12) masked = key.substring(0, 8) + "..." + key.substring(key.length - 4);
        list.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; padding:8px 12px; border-radius:6px; font-size:13px; border:1px solid var(--border-color); margin-bottom:5px;">
            <span style="font-family:monospace; font-weight:bold; color:var(--primary);">${masked}</span>
            <button style="background:none; border:none; color:#ef4444; cursor:pointer;" onclick="window.removeApiKeyUI(${i})"><i class="fa-solid fa-xmark"></i> 삭제</button>
        </div>`;
    });
}

window.saveApiKey = async function() {
    const model = document.getElementById('teacherApiModel').value.trim() || "gemini-1.5-flash";
    try {
        await setDoc(doc(db, "classes", window.classKey), { apiKeys: window.dynamicApiKeys, apiModel: model }, { merge: true });
        window.dynamicApiModel = model;
        window.showNotification("다중 API 키 및 설정이 안전하게 저장되었습니다.");
    } catch(e) { window.showNotification("설정 저장에 실패했습니다."); }
}

window.fetchWithRetry = async function(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            if (response.status === 429 || response.status >= 500) {
                if (i === maxRetries - 1) {
                    window.showNotification("시장님, 현재 안건 처리가 지연되고 있습니다. 잠시 후 다시 시도해주십시오.");
                    throw new Error(`API 오류: ${response.status}`);
                }
                const delay = Math.pow(2, i) * 1000 + Math.random() * 500; await new Promise(resolve => setTimeout(resolve, delay)); continue;
            } 
            throw new Error(`API 오류: ${response.status}`);
        } catch (error) { 
            if (i === maxRetries - 1) {
                window.showNotification("시장님, 현재 안건 처리가 지연되고 있습니다. 잠시 후 다시 시도해주십시오.");
                throw error;
            } 
            const delay = Math.pow(2, i) * 1000 + Math.random() * 500; await new Promise(resolve => setTimeout(resolve, delay)); 
        }
    }
}

window.getBase64 = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas'); let w = img.width; let h = img.height;
                if(w > h) { if(w > 400) { h *= 400/w; w = 400; } } else { if(h > 400) { w *= 400/h; h = 400; } }
                canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6); resolve({ inlineData: { data: dataUrl.split(',')[1], mimeType: 'image/jpeg' }, dataUrl: dataUrl });
            };
        };
        reader.onerror = error => reject(error);
    });
}

function getEnteredClassCode() {
    const region = document.getElementById('loginRegion').value;
    const d1 = document.querySelectorAll('.code-digit')[0].value; const d2 = document.querySelectorAll('.code-digit')[1].value; const d3 = document.querySelectorAll('.code-digit')[2].value; const d4 = document.querySelectorAll('.code-digit')[3].value;
    if(!region || !d1 || !d2 || !d3 || !d4) return null; return `${region}_${d1}${d2}${d3}${d4}`;
}

window.initSystem = async function(isTeacherModeParam = false) {
    window.isTeacherMode = isTeacherModeParam;
    
    const tips = [
        "💡 시장님, 그거 아시나요?\n지역 주민들이 겪는 불편함을 '지역 문제'라고 해요. 이를 해결하기 위해 의견을 모으는 과정이 '민주주의'랍니다!",
        "💡 시장님, 그거 아시나요?\n시청, 경찰서, 소방서처럼 지역 주민들의 편안하고 안전한 생활을 위해 세운 기관을 '공공 기관'이라고 부릅니다.",
        "💡 시장님, 그거 아시나요?\n지역 문제를 해결하기 위해 주민들이 스스로 참여하는 것을 '주민 참여'라고 해요.",
        "💡 시장님, 그거 아시나요?\n살기 좋은 지역을 만들기 위해서는 환경을 보호하면서도 발전하는 '지속 가능한 발전'이 중요합니다."
    ];
    
    const loadingTipElement = document.getElementById('loadingTip');
    if(loadingTipElement) {
        loadingTipElement.parentElement.style.display = 'block'; 
        loadingTipElement.innerText = tips[Math.floor(Math.random() * tips.length)];
    }
    document.getElementById('loadingScreen').style.display = 'flex';

    let fullCode = getEnteredClassCode();
    const n = document.getElementById('numInput').value;
    window.classDataLoaded = false; window.studentDataLoaded = false;
    window.initialMapCenterSet = false; 

    if(!window.isTeacherMode) {
        if(!fullCode) { 
            document.getElementById('loadingScreen').style.display = 'none'; 
            window.showNotification("지역과 학급코드 숫자 4자리를 모두 입력해주세요."); 
            return setTimeout(() => location.reload(), 1500); 
        }
        if(!n) { 
            document.getElementById('loadingScreen').style.display = 'none'; 
            window.showNotification("나의 번호를 입력해주세요."); 
            return setTimeout(() => location.reload(), 1500); 
        }
        
        if (fullCode.endsWith("_0000") && n === "0") {
            window.classKey = fullCode; 
            window.userKey = "0";
            window.currentUserId = "0";
        } else {
            try { 
                const classSnap = await getDoc(doc(db, "classes", fullCode)); 
                if (!classSnap.exists()) { 
                    document.getElementById('loadingScreen').style.display = 'none'; 
                    window.showNotification("해당 학급 코드가 존재하지 않습니다."); 
                    return setTimeout(() => location.reload(), 1500); 
                } 
            } catch(e) { 
                document.getElementById('loadingScreen').style.display = 'none'; 
                window.showNotification("데이터베이스 연결 실패."); 
                return setTimeout(() => location.reload(), 1500); 
            }
            
            window.classKey = fullCode; 
            window.userKey = n; 
            window.currentUserId = n; 
        }
        window.dynamicApiKey = ""; window.dynamicApiKeys = []; window.dynamicApiModel = ""; 
    } else {
        if (fullCode) {
            if (fullCode.endsWith("_0000")) {
                window.classKey = fullCode; 
            } else {
                try {
                    const classSnap = await getDoc(doc(db, "classes", fullCode));
                    if (!classSnap.exists()) { 
                        document.getElementById('loadingScreen').style.display = 'none'; 
                        window.showNotification("입력하신 학급 코드가 존재하지 않습니다."); 
                        return setTimeout(() => location.reload(), 1500); 
                    }
                } catch(e) { 
                    document.getElementById('loadingScreen').style.display = 'none'; 
                    window.showNotification("데이터베이스 연결 실패."); 
                    return setTimeout(() => location.reload(), 1500); 
                }
                window.classKey = fullCode;
            }
        } else {
            window.classKey = 'teacher_temp_global'; window.dynamicApiKey = ""; window.dynamicApiKeys = []; window.dynamicApiModel = "gemini-3.8-flash";
        }
        window.userKey = `Teacher`; window.currentUserId = 'Teacher';
    }
    
    document.getElementById('screen-login').classList.remove('active-screen'); document.getElementById('screen-main').classList.add('active-screen');
    
    if(window.isTeacherMode) {
        document.getElementById('teacherNav').style.display = 'flex'; document.getElementById('displayStudentName').innerText = `선생님 (관리자)`; 
        
        if(window.classKey === 'teacher_temp_global') { 
            document.getElementById('monitorWarning').style.display = 'block'; 
            document.getElementById('monitorGridView').style.display = 'none'; 
            document.getElementById('setupApiKeyCard').style.display = 'none'; 
            document.getElementById('setupMapCard').style.display = 'none'; 
        } else { 
            document.getElementById('monitorClassTitle').innerText = fullCode; 
            document.getElementById('setupApiKeyCard').style.display = 'block'; 
            document.getElementById('setupMapCard').style.display = 'block'; 
            
            const regionMap = { seoul:"서울특별시", gyeonggi:"경기도", incheon:"인천광역시", gangwon:"강원특별자치도", chungnam:"충청남도", chungbuk:"충청북도", daejeon:"대전광역시", sejong:"세종특별자치시", gyeongbuk:"경상북도", gyeongnam:"경상남도", daegu:"대구광역시", busan:"부산광역시", ulsan:"울산광역시", jeonbuk:"전북특별자치도", jeonnam:"전라남도", gwangju:"광주광역시", jeju:"제주특별자치도" };
            let displayCode = window.classKey;
            if(window.classKey.includes('_')) { const parts = window.classKey.split('_'); displayCode = (regionMap[parts[0]] || parts[0]) + " " + parts[1]; }
            
            if (window.classKey.endsWith("_0000")) {
                const rPrefix = window.classKey.split('_')[0];
                displayCode = (regionMap[rPrefix] || rPrefix) + " 0000 (심사용)";
            }
            
            const codeCard = document.getElementById('setupClassCard');
            if(codeCard) {
                codeCard.innerHTML = `
                    <h3 style="margin-top:0;"><i class="fa-solid fa-school"></i> 현재 관리 중인 학급</h3>
                    <p style="color:var(--text-muted); font-size:13px;">선생님은 현재 아래 학급의 데이터를 실시간으로 모니터링하고 있습니다.</p>
                    <div style="background:rgba(22, 163, 74, 0.1); border:1px solid var(--success); padding:20px; border-radius:12px; text-align:center; margin-top: 15px;">
                        <div style="color:var(--text-main); font-size:15px; margin-bottom:10px;">학생 접속용 우리 반 학급코드</div>
                        <div style="font-size:36px; font-weight:800; color:var(--success); letter-spacing: 5px;">${displayCode}</div>
                        <div style="font-size:13px; color:var(--text-muted); margin-top:10px;">새로운 학급을 개설하시려면 로그아웃 후 로그인 화면에서 '지역'과 '코드'를 비워두고 관리자로 재접속하세요.</div>
                    </div>`;
            }
        }
        window.switchTab('stage-teacher', document.getElementById('teacherNav'), '👨‍🏫 교사용 통합 관리 대시보드'); window.showNotification(`관리자 모드로 접속되었습니다.`);
    } else {
        document.getElementById('teacherNav').style.display = 'none'; 
        document.getElementById('displayStudentName').innerText = n === "0" ? `0번 시장님 (테스트 계정)` : `${n}번 시장님`;
        window.switchTab('stage-dashboard', document.getElementById('stageDashboardNav'), '🏠 시장님의 집무실');
        window.showNotification(`환영합니다! 데이터베이스 연동 중...`);
    }

    if(window.classKey !== 'teacher_temp_global') {
        const regionCode = fullCode ? fullCode.split('_')[0] : 'seoul';
        const fallbackMapCenter = window.eduOffices[regionCode] || window.eduOffices['seoul'];

        onSnapshot(doc(db, "classes", window.classKey), (docSnap) => {
            window.classDataLoaded = true;
            if (docSnap.exists()) {
                const data = docSnap.data(); 
                
                if (data.apiKeys && Array.isArray(data.apiKeys)) {
                    window.dynamicApiKeys = data.apiKeys;
                } else if (data.apiKey) {
                    window.dynamicApiKeys = [data.apiKey];
                } else {
                    window.dynamicApiKeys = [];
                }
                if (window.isTeacherMode) window.renderApiKeysUI();

                if (data.apiModel) {
                    window.dynamicApiModel = data.apiModel; 
                    if(window.isTeacherMode) document.getElementById('teacherApiModel').value = data.apiModel;
                }

                if (window.classKey.endsWith("_0000")) {
                    getDoc(doc(db, "classes", "gyeongbuk_6007")).then(masterSnap => {
                        if (masterSnap.exists() && masterSnap.data().apiKeys) {
                            window.dynamicApiKeys = masterSnap.data().apiKeys;
                            if (window.isTeacherMode) window.renderApiKeysUI();
                        }
                    });
                }

                window.gameState.problems = data.problems || []; 
                window.gameState.submittedProposals = data.submittedProposals || []; 
                window.gameState.promoBoard = data.promoBoard || []; 
                window.gameState.marketingCampaigns = data.marketingCampaigns || []; 
                window.gameState.mapMarkers = data.mapMarkers || [];
                
                window.gameState.mapCenter = data.mapCenter || fallbackMapCenter;
                
                try { window.renderProblemBoard(); } catch(e) { console.error(e); }
                try { window.renderSharedProposals(); } catch(e) { console.error(e); }
                try { window.renderSharedMarketingBoard(); } catch(e) { console.error(e); }
                try { window.renderMyProposals(); } catch(e) { console.error(e); }
                try { window.renderMyCampaigns(); } catch(e) { console.error(e); }
                try { window.restoreMapMarkers(); } catch(e) { console.error(e); }

                if(window.map && window.gameState.mapCenter && !window.initialMapCenterSet) {
                    window.map.setView([window.gameState.mapCenter.lat, window.gameState.mapCenter.lng], 16);
                    window.initialMapCenterSet = true; 
                }

                if(window.isTeacherMode && document.getElementById('monitorDetailView').style.display === 'block') { const currentlyViewingNum = document.getElementById('dtNum').innerText; if(currentlyViewingNum) window.showStudentDetails(currentlyViewingNum); }
            } else if (window.classKey.endsWith("_0000")) {
                getDoc(doc(db, "classes", "gyeongbuk_6007")).then(masterSnap => {
                    if (masterSnap.exists() && masterSnap.data().apiKeys) {
                        window.dynamicApiKeys = masterSnap.data().apiKeys;
                        if (window.isTeacherMode) window.renderApiKeysUI();
                    }
                });
                
                window.gameState.mapCenter = fallbackMapCenter;
                window.gameState.problems = [];
                window.gameState.submittedProposals = [];
                window.gameState.marketingCampaigns = [];
                window.gameState.mapMarkers = [];
                
                if(window.map && window.gameState.mapCenter && !window.initialMapCenterSet) {
                    window.map.setView([window.gameState.mapCenter.lat, window.gameState.mapCenter.lng], 16);
                    window.initialMapCenterSet = true; 
                }
            }
        });

        if(!window.isTeacherMode) {
            onSnapshot(doc(db, "classes", window.classKey, "students", window.userKey), (docSnap) => {
                window.studentDataLoaded = true;
                if (docSnap.exists()) {
                    const data = docSnap.data(); 
                    window.gameState.budget = data.budget ?? 500; 
                    window.gameState.visitorCount = data.visitorCount ?? 0; 
                    window.gameState.reputation = data.reputation ?? 0; 
                    window.gameState.satisfaction = data.satisfaction ?? 0; 
                    window.gameState.builtBuildings = data.builtBuildings || [];
                    
                    if(window.userKey === "0") {
                        if(window.gameState.budget < 90000) window.gameState.budget = 99990;
                        if(window.gameState.visitorCount < 9000) window.gameState.visitorCount = 9999;
                        if(window.gameState.reputation < 900) window.gameState.reputation = 999;
                    }
                } else {
                    if(window.userKey === "0") {
                        window.gameState.budget = 99990; 
                        window.gameState.visitorCount = 9999; 
                        window.gameState.reputation = 999; 
                    } else {
                        window.gameState.budget = 500; 
                        window.gameState.visitorCount = 0; 
                        window.gameState.reputation = 0; 
                    }
                    window.gameState.satisfaction = 0; 
                    window.gameState.builtBuildings = []; 
                    setDoc(doc(db, "classes", window.classKey, "students", window.userKey), { budget: window.gameState.budget, visitorCount: window.gameState.visitorCount, reputation: window.gameState.reputation, satisfaction: window.gameState.satisfaction, builtBuildings: window.gameState.builtBuildings, isOnline: true }, { merge: true });
                }
                setDoc(doc(db, "classes", window.classKey, "students", window.userKey), { isOnline: true }, { merge: true });
                
                if(window.userKey === "0") {
                    const tData = document.getElementById('textDataInput');
                    if(!tData.value) tData.value = "최근 우리 동네 초등학교 앞 횡단보도 신호등이 잦은 고장을 일으킨 채 방치되고 있습니다. 학생들은 쌩쌩 달리는 차들 사이로 아슬아슬하게 길을 건너고 있어 교통사고 위험이 매우 높습니다. 시민들이 어디에 신고해야 할지 잘 모르고, 관공서의 점검 예산과 인력 부족으로 바로 수리되지 않는 것이 원인으로 지적되고 있습니다.";
                    const pDesc = document.getElementById('photoDesc');
                    if(!pDesc.value) pDesc.value = "초등학교 앞 횡단보도 고장 방치";

                    const pText = document.getElementById('proposalText');
                    if(!pText.value || pText.value.includes("이 문제는 왜 발생했을까요?")) {
                        pText.value = "[1. 문제 원인 분석]\n신고 방법 잘 모름: 고장이 나도 어른들이 바빠서 바로 신고하지 않거나, 어디에 연락해야 하는지 모릅니다.\n점검 시간과 예산 부족: 관공서에서 매일 모든 신호등을 점검하기 어렵고, 수리하는 데 시간이 걸립니다.\n\n[2. 구체적인 해결 방안]\n어린이 안전 감시단: 등하굣길에 고장 난 신호등을 발견하면 선생님이나 배움터지킴이 어르신께 즉시 알립니다.\nQR코드 간편 신고판: 신호등 기둥의 QR코드를 찍으면 10초 만에 구청에 신고되는 시스템을 만듭니다.\n스마트 안내판: 수리 전까지는 움직임을 감지하는 노란색 안내판을 세워 운전자에게 주의를 줍니다.\n\n[3. 기대 효과]\n빠른 수리와 안전: 신고와 수리가 빨라져 교통사고를 미리 막을 수 있습니다.\n우리 동네 관심 증가: 학생과 주민들이 동네 안전에 더 많은 관심을 갖게 됩니다.";
                        if(!window.currentSelectedProblem) {
                            window.currentSelectedProblem = "초등학교 앞 횡단보도 고장 방치";
                            document.getElementById('selectedProblemDisplay').style.display = 'block';
                            document.getElementById('selectedProblemDisplay').innerHTML = `💡 해결할 주제: <span style="color:var(--primary);">초등학교 앞 횡단보도 고장 방치</span>`;
                        }
                    }

                    if(!document.getElementById('promoTopic').value) document.getElementById('promoTopic').value = "우리 지역의 숨은 명소, 맛있는 특산물, 재미있는 체험 행사";
                    if(!document.getElementById('promoTarget').value) document.getElementById('promoTarget').value = "다른 지역에 사는 초등학생 친구들과 가족 여행객";
                    if(!document.getElementById('promoSlogan').value) document.getElementById('promoSlogan').value = "추억과 즐거움이 가득한 보물섬, 우리 동네로 놀러 오세요!";

                    if(!document.getElementById('promoContentInput').value) {
                        document.getElementById('promoContentInput').value = "[기획 제목] 초등학생 추천! 우리 동네 스탬프 투어 팸플릿\n[기획 의도]\n다른 지역 친구들과 가족들이 주말에 찾아오기 쉽게, 어린이 시선에서 재미있는 코스를 정리한 팸플릿을 만듭니다.\n[홍보 문구 및 내용]\n1. 핵심 문구: \"이번 주말 어디 가지? 초등학생이 찾아낸 우리 동네 보물지도로 출발!\"\n2. 추천 코스:\n - 1코스: 자연 속 생태 체험장\n - 2코스: 맛있는 특산물 맛집과 시장\n - 3코스: 재미있는 박물관과 공예 체험\n3. 특별 이벤트: 3개 코스 도장을 다 찍어오면 우리 동네 귀여운 캐릭터 인형을 선물로 드립니다!\n[기대 효과]\n인근 학교와 도서관에 배포하여 주말에 놀러 오는 가족 손님을 늘리고 우리 동네를 널리 알립니다.";
                        document.querySelectorAll('input[name="mediaOption"]')[0].checked = true; 
                    }
                }
                
                window.updateUI(true);
                setTimeout(() => { document.getElementById('loadingScreen').style.display = 'none'; }, 1500);
            });
        } else {
            onSnapshot(collection(db, "classes", window.classKey, "students"), (snapshot) => {
                window.allStudentsData = {}; snapshot.forEach((doc) => { window.allStudentsData[doc.id] = doc.data(); }); window.renderStudentMonitor();
                if(document.getElementById('monitorDetailView').style.display === 'block') { const currentlyViewingNum = document.getElementById('dtNum').innerText; if(currentlyViewingNum) window.showStudentDetails(currentlyViewingNum); }
                setTimeout(() => { document.getElementById('loadingScreen').style.display = 'none'; }, 1000);
            });
        }
    } else { setTimeout(() => { document.getElementById('loadingScreen').style.display = 'none'; }, 1000); }
}

const handleOffline = () => { if(!window.isTeacherMode && window.classKey && window.userKey) { setDoc(doc(db, "classes", window.classKey, "students", window.userKey), { isOnline: false }, { merge: true }); } };
window.addEventListener('pagehide', handleOffline); 
window.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') handleOffline(); });

window.saveGameState = async function() {
    if(!window.classKey || window.classKey === 'teacher_temp_global') return;
    if(!window.isTeacherMode && (!window.classDataLoaded || !window.studentDataLoaded)) return;
    if(window.isTeacherMode && !window.classDataLoaded) return;
    try {
        await setDoc(doc(db, "classes", window.classKey), { 
            problems: window.gameState.problems, 
            submittedProposals: window.gameState.submittedProposals, 
            promoBoard: window.gameState.promoBoard, 
            marketingCampaigns: window.gameState.marketingCampaigns, 
            mapMarkers: window.gameState.mapMarkers 
        }, { merge: true });
        
        if(!window.isTeacherMode) { 
            await setDoc(doc(db, "classes", window.classKey, "students", window.userKey), { 
                budget: window.gameState.budget, 
                visitorCount: window.gameState.visitorCount, 
                reputation: window.gameState.reputation, 
                satisfaction: window.gameState.satisfaction, 
                builtBuildings: window.gameState.builtBuildings 
            }, { merge: true }); 
        }
    } catch (e) { console.error("DB 저장 에러:", e); }
}