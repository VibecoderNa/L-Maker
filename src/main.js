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

window.isTeacherMode = false; window.dynamicApiKey = ""; window.dynamicApiModel = "gemini-3.8-flash"; window.classKey = ''; window.userKey = ''; window.currentUserId = ''; 
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

// 💡 수정됨: 학생들 글이 날아가지 않도록 강제 새로고침(location.reload) 삭제 및 텍스트 순화
window.fetchWithRetry = async function(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            if (response.status === 429 || response.status >= 500) {
                if (i === maxRetries - 1) {
                    alert("시장님, 현재 안건 처리가 지연되고 있습니다. 잠시 후 다시 시도해주십시오.");
                    throw new Error(`API 오류: ${response.status}`);
                }
                const delay = Math.pow(2, i) * 1000 + Math.random() * 500; await new Promise(resolve => setTimeout(resolve, delay)); continue;
            } 
            throw new Error(`API 오류: ${response.status}`);
        } catch (error) { 
            if (i === maxRetries - 1) {
                alert("시장님, 현재 안건 처리가 지연되고 있습니다. 잠시 후 다시 시도해주십시오.");
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
        "지도에 기호를 표시할 때는 다른 사람들이 쉽게 알아볼 수 있도록 '범례'를 꼭 만들어야 해요.",
        "좋은 해결 방안은 실현 가능성이 높고, 많은 사람들에게 도움이 되는 '공공성'을 갖춰야 합니다.",
        "우리 지역의 장점을 알릴 때는 누구에게(타겟), 어떤 내용(핵심 슬로건)을 전달할지 명확히 해야 해요.",
        "도시를 건설할 때는 경제 발전뿐만 아니라 환경과 사람들의 행복(만족도)도 함께 생각하는 '지속 가능한 발전'이 중요합니다."
    ];
    
    const loadingTipElement = document.getElementById('loadingTip');
    if(loadingTipElement) {
        loadingTipElement.parentElement.style.display = 'block'; 
        loadingTipElement.innerText = tips[Math.floor(Math.random() * tips.length)];
    }
    document.getElementById('loadingScreen').style.display = 'flex';

    const fullCode = getEnteredClassCode();
    const n = document.getElementById('numInput').value;
    window.classDataLoaded = false; window.studentDataLoaded = false;
    window.initialMapCenterSet = false; 

    if(!window.isTeacherMode) {
        if(!fullCode) { document.getElementById('loadingScreen').style.display = 'none'; alert("지역과 학급코드 숫자 4자리를 모두 입력해주세요."); return location.reload(); }
        if(!n) { document.getElementById('loadingScreen').style.display = 'none'; alert("나의 번호를 입력해주세요."); return location.reload(); }
        
        try { 
            const classSnap = await getDoc(doc(db, "classes", fullCode)); 
            if (!classSnap.exists()) { document.getElementById('loadingScreen').style.display = 'none'; alert("해당 학급 코드가 존재하지 않습니다."); return location.reload(); } 
        } catch(e) { document.getElementById('loadingScreen').style.display = 'none'; alert("데이터베이스 연결 실패."); return location.reload(); }
        
        window.classKey = fullCode; window.userKey = n; window.currentUserId = n; window.dynamicApiKey = ""; window.dynamicApiModel = ""; 
    } else {
        if (fullCode) {
            try {
                const classSnap = await getDoc(doc(db, "classes", fullCode));
                if (!classSnap.exists()) { document.getElementById('loadingScreen').style.display = 'none'; alert("입력하신 학급 코드가 존재하지 않습니다."); return location.reload(); }
            } catch(e) { document.getElementById('loadingScreen').style.display = 'none'; alert("데이터베이스 연결 실패."); return location.reload(); }
            window.classKey = fullCode;
            window.dynamicApiKey = window.safeGetItem('local_maker_api_key') || "";
            window.dynamicApiModel = window.safeGetItem('local_maker_api_model') || "gemini-3.8-flash";
        } else {
            window.classKey = 'teacher_temp_global'; window.dynamicApiKey = ""; window.dynamicApiModel = "gemini-3.8-flash";
        }
        window.userKey = `Teacher`; window.currentUserId = 'Teacher';
    }
    
    document.getElementById('screen-login').classList.remove('active-screen'); document.getElementById('screen-main').classList.add('active-screen');
    
    if(window.isTeacherMode) {
        document.getElementById('teacherNav').style.display = 'flex'; document.getElementById('displayStudentName').innerText = `선생님 (관리자)`; 
        document.getElementById('teacherApiKey').value = window.dynamicApiKey;
        document.getElementById('teacherApiModel').value = window.dynamicApiModel || "gemini-3.8-flash";
        
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
        document.getElementById('teacherNav').style.display = 'none'; document.getElementById('displayStudentName').innerText = `${n}번 시장님`;
        window.switchTab('stage-dashboard', document.getElementById('stageDashboardNav'), '🏠 시장님의 집무실');
        window.showNotification(`환영합니다! 데이터베이스 연동 중...`);
    }

    if(window.classKey !== 'teacher_temp_global') {
        onSnapshot(doc(db, "classes", window.classKey), (docSnap) => {
            window.classDataLoaded = true;
            if (docSnap.exists()) {
                const data = docSnap.data(); 
                if (data.apiKey) window.dynamicApiKey = data.apiKey; 
                if (data.apiModel) window.dynamicApiModel = data.apiModel; 
                window.gameState.problems = data.problems || []; 
                window.gameState.submittedProposals = data.submittedProposals || []; 
                window.gameState.promoBoard = data.promoBoard || []; 
                window.gameState.marketingCampaigns = data.marketingCampaigns || []; 
                window.gameState.mapMarkers = data.mapMarkers || [];
                
                if (data.mapCenter) {
                    window.gameState.mapCenter = data.mapCenter;
                }
                
                try { window.renderProblemBoard(); } catch(e) { console.error(e); }
                try { window.renderSharedProposals(); } catch(e) { console.error(e); }
                try { window.renderPromoBoard(); } catch(e) { console.error(e); }
                try { window.renderSharedMarketingBoard(); } catch(e) { console.error(e); }
                try { window.restoreMapMarkers(); } catch(e) { console.error(e); }

                if(window.map && window.gameState.mapCenter && !window.initialMapCenterSet) {
                    window.map.setView([window.gameState.mapCenter.lat, window.gameState.mapCenter.lng], 16);
                    window.initialMapCenterSet = true; 
                }

                if(window.isTeacherMode && document.getElementById('monitorDetailView').style.display === 'block') { const currentlyViewingNum = document.getElementById('dtNum').innerText; if(currentlyViewingNum) window.showStudentDetails(currentlyViewingNum); }
            }
        });

        if(!window.isTeacherMode) {
            onSnapshot(doc(db, "classes", window.classKey, "students", window.userKey), (docSnap) => {
                window.studentDataLoaded = true;
                if (docSnap.exists()) {
                    const data = docSnap.data(); window.gameState.budget = data.budget ?? 500; window.gameState.visitorCount = data.visitorCount ?? 0; window.gameState.reputation = data.reputation ?? 0; window.gameState.satisfaction = data.satisfaction ?? 0; window.gameState.builtBuildings = data.builtBuildings || [];
                } else {
                    window.gameState.budget = 500; window.gameState.visitorCount = 0; window.gameState.reputation = 0; window.gameState.satisfaction = 0; window.gameState.builtBuildings = []; 
                    setDoc(doc(db, "classes", window.classKey, "students", window.userKey), { budget: 500, visitorCount: 0, reputation: 0, satisfaction: 0, builtBuildings: [], isOnline: true }, { merge: true });
                }
                setDoc(doc(db, "classes", window.classKey, "students", window.userKey), { isOnline: true }, { merge: true });
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
window.addEventListener('pagehide', handleOffline); window.addEventListener('beforeunload', handleOffline); window.addEventListener('unload', handleOffline);

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