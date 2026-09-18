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

// 심사용 계정(_0000)이 AI 키를 가져올 마스터 학급. 학급을 옮기실 때 이 값만 바꾸면 됩니다.
window.MASTER_CLASS_KEY = "gyeongbuk_6007";

// 심사용 계정(_0000)이 쓸 AI 키를 보관하는 전용 문서.
// 선생님 학급과 분리되어 있어, 학급을 옮기거나 지워도 심사용 AI는 계속 작동합니다.
window.JUDGE_KEY_DOC = "_judge_master";

// AI 모델 기본값. 교사용 설정에 저장된 값이 있으면 '항상 그 값이 우선'합니다.
// 이 값은 설정이 하나도 없을 때만 쓰이는 예비값입니다.
window.DEFAULT_AI_MODEL = "gemini-3.6-flash";

window.isTeacherMode = false; window.dynamicApiKey = ""; window.dynamicApiKeys = []; window.dynamicApiModel = ""; window.classKey = ''; window.userKey = ''; window.currentUserId = ''; 
window.gameState = { budget: 500, visitorCount: 0, reputation: 0, satisfaction: 0, submittedProposals: [], problems: [], promoBoard: [], marketingCampaigns: [], builtBuildings: [], mapMarkers: [], mapCenter: null, aiUsage: { date: '', advice: 0, consulting: 0 } };
window.currentSelectedProblem = null; window.currentSelectedPromo = null;
window.allStudentsData = {}; window.presenceData = {}; window.classDataLoaded = false; window.studentDataLoaded = false;
window.initialMapCenterSet = false;

// 이 브라우저를 구분하는 값 (번호 중복 접속을 막는 데 씁니다)
window.getDeviceId = function() {
    let id = window.safeGetItem('lm_device_id');
    if (!id) {
        id = 'd_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        window.safeSetItem('lm_device_id', id);
    }
    return id;
};

// 접속 중임을 주기적으로 알린다 (2분마다)
// 브라우저가 갑자기 꺼져도 5분이 지나면 번호가 자동으로 풀립니다.
window.heartbeatTimer = null;
// ★ 접속 상태는 학생 문서가 아니라 별도 컬렉션(presence)에 기록합니다.
//   학생 문서는 실시간 구독 중이라, 거기에 쓰면 '쓰기 → 알림 → 또 쓰기'의
//   무한 고리가 생겨 하루 할당량이 순식간에 소진됩니다.
window.presenceRef = function(num) {
    return doc(db, "classes", window.classKey, "presence", String(num));
};

// ==========================================
// [2026-09-19 추가] 접속·자동 로그아웃 시간 설정
//   ※ 아래 숫자만 바꾸면 시간이 바뀝니다. (1000 = 1초)
// ==========================================
window.HEARTBEAT_MS        = 5 * 60 * 1000;   // 접속 신호를 보내는 주기 (5분)
window.PRESENCE_TIMEOUT_MS = 10 * 60 * 1000;  // 오프라인 판정 · 중복 접속 차단 (10분)
window.IDLE_WARN_MS        = 8 * 60 * 1000;   // 무활동 8분 → 경고창 (2분 남음)
window.IDLE_LOGOUT_MS      = 10 * 60 * 1000;  // 무활동 10분 → 자동 로그아웃

window.startHeartbeat = function() {
    if (window.heartbeatTimer) clearInterval(window.heartbeatTimer);
    const beat = () => {
        if (window.isTeacherMode || !window.classKey || !window.userKey) return;
        setDoc(window.presenceRef(window.userKey),
            { isOnline: true, lastSeen: Date.now(), deviceId: window.getDeviceId() }, { merge: true })
            .catch(() => {});
    };
    beat();
    // 신호 주기를 길게 잡아 데이터베이스 사용량을 아낍니다
    window.heartbeatTimer = setInterval(beat, window.HEARTBEAT_MS);
};

// ==========================================
// [2026-09-19 추가] 무활동(유휴) 자동 로그아웃
//   브라우저를 그냥 닫으면 "나 나갔어요" 신호가 끝까지 전달되지 않는 경우가 많습니다.
//   그래서 ① 일정 시간 움직임이 없으면 스스로 로그아웃하고,
//         ② 그래도 못 보낸 경우에는 마지막 신호 시각으로 오프라인을 판정합니다.
// ==========================================
window.lastActivityAt  = Date.now();
window.idleTimer       = null;
window.idleWarnShown   = false;
window.idleWatchStarted = false;
window.autoLoggingOut  = false;

// 학생이 움직였다는 표시 (마우스·키보드·터치·스크롤)
window.markActivity = function() {
    window.lastActivityAt = Date.now();
    if (window.idleWarnShown) {
        window.idleWarnShown = false;
        window.hideIdleWarning();
    }
};

window.startIdleWatch = function() {
    if (window.isTeacherMode) return;          // 선생님 화면은 자동 로그아웃하지 않습니다
    if (window.idleWatchStarted) return;       // 두 번 켜지지 않도록 막습니다
    window.idleWatchStarted = true;
    window.lastActivityAt = Date.now();

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'click', 'input']
        .forEach(ev => window.addEventListener(ev, window.markActivity, { passive: true }));

    window.idleTimer = setInterval(window.checkIdle, 1000);   // 1초마다 확인 (통신 없음)
};

window.checkIdle = function() {
    if (window.isTeacherMode || !window.classKey || !window.userKey) return;
    if (window.autoLoggingOut) return;

    const idle = Date.now() - window.lastActivityAt;

    if (idle >= window.IDLE_LOGOUT_MS) { window.autoLogout(); return; }

    if (idle >= window.IDLE_WARN_MS) {
        if (!window.idleWarnShown) window.showIdleWarning();
        window.updateIdleCountdown(window.IDLE_LOGOUT_MS - idle);
    }
};

window.showIdleWarning = function() {
    window.idleWarnShown = true;
    let el = document.getElementById('idleWarnOverlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'idleWarnOverlay';
        el.style.cssText = 'position:fixed; inset:0; z-index:11500; background:rgba(15,23,42,0.6);' +
            'display:flex; align-items:center; justify-content:center; padding:20px;';
        el.innerHTML =
            '<div style="background:#ffffff; border-radius:16px; padding:28px 24px; max-width:380px;' +
            'width:100%; text-align:center; box-shadow:0 10px 40px rgba(0,0,0,0.25);">' +
                '<div style="font-size:40px; margin-bottom:8px;">⏰</div>' +
                '<div style="font-size:20px; font-weight:bold; color:#1e293b; margin-bottom:10px;">시장님, 아직 계신가요?</div>' +
                '<div style="font-size:14px; color:#475569; line-height:1.7; margin-bottom:14px;">' +
                    '한동안 움직임이 없어서 곧 자동으로 로그아웃됩니다.<br>계속하시려면 아래 버튼을 눌러주세요.' +
                '</div>' +
                '<div id="idleCountdown" style="font-size:22px; font-weight:bold; color:#ef4444; margin-bottom:18px;">2분 0초</div>' +
                '<button onclick="window.markActivity()" style="width:100%; padding:12px; border:none; border-radius:10px;' +
                'background:#0284c7; color:#ffffff; font-size:16px; font-weight:bold; cursor:pointer;">계속 할래요</button>' +
            '</div>';
        document.body.appendChild(el);
    }
    el.style.display = 'flex';
};

window.updateIdleCountdown = function(msLeft) {
    const box = document.getElementById('idleCountdown');
    if (!box) return;
    const total = Math.max(0, Math.floor(msLeft / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    box.innerText = m > 0 ? `${m}분 ${s}초` : `${s}초`;
};

window.hideIdleWarning = function() {
    const el = document.getElementById('idleWarnOverlay');
    if (el) el.style.display = 'none';
};

window.autoLogout = async function() {
    if (window.autoLoggingOut) return;
    window.autoLoggingOut = true;

    if (window.idleTimer)      { clearInterval(window.idleTimer);      window.idleTimer = null; }
    if (window.heartbeatTimer) { clearInterval(window.heartbeatTimer); window.heartbeatTimer = null; }
    window.hideIdleWarning();
    window.showLogoutOverlay('한동안 사용하지 않아 자동으로 로그아웃합니다…');

    try {
        await Promise.race([
            setDoc(window.presenceRef(window.userKey), { isOnline: false, lastSeen: 0 }, { merge: true }),
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);
    } catch (err) { console.error("자동 로그아웃 오류:", err); }

    window.safeSetItem('lm_auto_logout', '1');
    location.reload();
};

// 자동 로그아웃으로 새로고침된 경우, 로그인 화면에서 이유를 알려준다
setTimeout(() => {
    if (window.safeGetItem('lm_auto_logout') === '1') {
        window.safeSetItem('lm_auto_logout', '0');
        if (window.showNotification) {
            window.showNotification("한동안 사용하지 않아 자동으로 로그아웃되었습니다. 다시 접속해주세요.");
        }
    }
}, 1500);

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
};

let secretClicks = 0; let secretTimeout;
window.handleSecretTeacherLogin = function() { secretClicks++; clearTimeout(secretTimeout); secretTimeout = setTimeout(() => secretClicks = 0, 1500); if (secretClicks >= 5) { secretClicks = 0; window.initSystem(true); } }
window.toggleLogoutMenu = function(e) { const menu = document.getElementById('logoutMenu'); menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; }

// ==========================================
// [2026-09-19 변경] 로그아웃 처리
//  - 예전: document.body.style.opacity = '0.5' 로 화면 전체를 반투명하게 만들었습니다.
//          아무 설명이 없어서 "화면이 뿌옇게 흐려지는" 오류처럼 보였습니다.
//  - 지금: 안내 문구가 있는 덮개를 씌워 처리 중임을 분명히 알려줍니다.
// ==========================================
window.showLogoutOverlay = function(message) {
    const text = message || '안전하게 로그아웃하고 있어요…';
    if (document.getElementById('logoutOverlay')) return;
    const el = document.createElement('div');
    el.id = 'logoutOverlay';
    el.style.cssText = 'position:fixed; inset:0; z-index:12000; background:rgba(15,23,42,0.75);' +
        'color:#ffffff; display:flex; flex-direction:column; align-items:center; justify-content:center;' +
        'gap:14px; font-weight:bold; font-size:17px; text-align:center; padding:20px;';
    el.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:30px;"></i>' +
        '<div>' + text + '</div>';
    document.body.appendChild(el);
};

window.executeLogout = async function(e) {
    if(e) e.stopPropagation();
    const ok = await window.uiConfirm("시스템을 종료하고 로그아웃합니다.\n작성 중인 내용이 있다면 먼저 제출해주세요.",
        { title: '👋 로그아웃할까요?', okText: '로그아웃', cancelText: '더 할래요' });
    if (!ok) return;

    window.showLogoutOverlay();   // [변경] body 반투명(opacity 0.5) 대신 안내 덮개

    if(!window.isTeacherMode && window.classKey && window.userKey) {
        if (window.heartbeatTimer) { clearInterval(window.heartbeatTimer); window.heartbeatTimer = null; }
        try {
            // 저장이 늦어져도 로그아웃은 반드시 진행되도록 2초만 기다린다
            await Promise.race([
                setDoc(window.presenceRef(window.userKey), { isOnline: false, lastSeen: 0 }, { merge: true }),
                new Promise(resolve => setTimeout(resolve, 2000))
            ]);
        } catch(err) { console.error("로그아웃 오류:", err); }
    }
    location.reload();
};

// ==========================================
// AI 사용 횟수 제한 (하루 단위 · 선생님이 초기화 가능)
// ==========================================
window.AI_LIMITS = { advice: 3, consulting: 3 };   // 하루 사용 가능 횟수
window.AI_COOLDOWN_MS = 10000;                     // 연타 방지 대기 시간
window.lastAICallAt = 0;
window.currentAIRequestType = null;
window.aiCooldownTimer = null;

// 심사용 계정과 선생님은 횟수 제한을 받지 않는다 (쿨다운은 그대로 적용)
window.isAiLimitExempt = function() {
    return window.isTeacherMode || window.userKey === "0" || String(window.userKey).startsWith("judge_");
};

// 날짜가 바뀌면 자동으로 0회로 초기화
window.ensureAiUsageToday = function() {
    const today = window.getTodayStr();
    if (!window.gameState.aiUsage || window.gameState.aiUsage.date !== today) {
        window.gameState.aiUsage = { date: today, advice: 0, consulting: 0 };
    }
    return window.gameState.aiUsage;
};

window.getAiRemaining = function(type) {
    if (window.isAiLimitExempt()) return Infinity;
    const usage = window.ensureAiUsageToday();
    return Math.max(0, (window.AI_LIMITS[type] || 0) - (usage[type] || 0));
};

window.canUseAI = function(type) {
    const elapsed = Date.now() - window.lastAICallAt;
    if (elapsed < window.AI_COOLDOWN_MS) {
        const left = Math.ceil((window.AI_COOLDOWN_MS - elapsed) / 1000);
        return { ok: false, message: `AI 담당관이 방금 답변을 마쳤어요. ${left}초만 기다렸다가 눌러주세요.` };
    }
    if (window.getAiRemaining(type) <= 0) {
        const label = (type === 'advice') ? 'AI 비서 힌트' : 'AI 홍보 조언';
        return { ok: false, message: `오늘의 ${label}를 모두 사용했어요. 친구들과 의논하거나 선생님께 여쭤볼까요?` };
    }
    return { ok: true };
};

window.consumeAI = function(type) {
    if (!window.isAiLimitExempt()) {
        const usage = window.ensureAiUsageToday();
        usage[type] = (usage[type] || 0) + 1;
        window.saveAiUsage();
    }
    window.updateAIButtons();
};

window.saveAiUsage = async function() {
    if (window.isTeacherMode || !window.classKey || !window.userKey) return;
    try {
        await setDoc(doc(db, "classes", window.classKey, "students", window.userKey),
            { aiUsage: window.gameState.aiUsage }, { merge: true });
    } catch (e) { console.error("AI 사용 횟수 저장 실패:", e); }
};

window.updateAIButtons = function() {
    const targets = [
        { id: 'btn-advice', type: 'advice', label: 'AI 비서에게 힌트 얻기 🤖' },
        { id: 'btn-consulting', type: 'consulting', label: 'AI 홍보 담당관에게 조언 구하기 🤖' }
    ];
    targets.forEach(t => {
        const btn = document.getElementById(t.id);
        if (!btn) return;
        if (window.isAiLimitExempt()) {
            btn.innerHTML = t.label;
            btn.disabled = false;
            btn.style.opacity = 1;
            return;
        }
        const left = window.getAiRemaining(t.type);
        const total = window.AI_LIMITS[t.type];
        btn.innerHTML = `${t.label} <span style="font-size:12px; opacity:0.75;">(${left}/${total}회 남음)</span>`;
        btn.disabled = (left <= 0);
        btn.style.opacity = (left <= 0) ? 0.5 : 1;
    });
};

// AI 호출 직후 잠시 버튼을 잠근다
window.startAICooldownUI = function() {
    ['btn-advice', 'btn-consulting'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) { btn.disabled = true; btn.style.opacity = 0.5; }
    });
    if (window.aiCooldownTimer) clearTimeout(window.aiCooldownTimer);
    window.aiCooldownTimer = setTimeout(() => { window.updateAIButtons(); }, window.AI_COOLDOWN_MS);
};

// 선생님이 우리 반 전체의 오늘 사용 횟수를 초기화
window.resetClassAiUsage = async function() {
    if (!window.isTeacherMode) return;
    if (!window.classKey || window.classKey === 'teacher_temp_global') {
        return window.uiAlert("학급에 접속한 상태에서만 사용할 수 있습니다.");
    }
    const keys = Object.keys(window.allStudentsData || {});
    if (keys.length === 0) return window.uiAlert("아직 접속한 학생이 없습니다.");
    const ok = await window.uiConfirm(`우리 반 ${keys.length}명의 오늘 AI 사용 횟수를 모두 0회로 되돌립니다.\n다음 차시를 시작할 때 사용하시면 됩니다.`,
        { title: '🔄 AI 사용 횟수를 초기화할까요?', okText: '초기화하기', cancelText: '취소' });
    if (!ok) return;

    const today = window.getTodayStr();
    let success = 0;
    let lastError = null;

    // 한 명씩 기다리지 않고 한꺼번에 처리한다 (훨씬 빠름)
    const results = await Promise.allSettled(keys.map(k =>
        setDoc(doc(db, "classes", window.classKey, "students", k),
            { aiUsage: { date: today, advice: 0, consulting: 0 } }, { merge: true })
    ));
    results.forEach(r => {
        if (r.status === 'fulfilled') success++;
        else lastError = r.reason;
    });

    if (success === keys.length) {
        window.showNotification(`${success}명의 AI 사용 횟수를 초기화했습니다.`);
    } else {
        console.error("AI 횟수 초기화 실패:", lastError);
        const code = String((lastError && lastError.code) || '');
        const msg = String((lastError && lastError.message) || '');
        if (code.includes("resource-exhausted") || msg.includes("Quota exceeded")) {
            await window.uiAlert(
                `${keys.length}명 중 ${success}명만 초기화되었습니다.\n\n오늘 데이터베이스에 저장할 수 있는 양을 모두 사용했습니다.\nFirebase 콘솔의 '사용량'을 확인해주세요. (내일 0시에 자동으로 회복됩니다)`,
                { title: '⚠️ 저장 한도를 초과했습니다' });
        } else {
            await window.uiAlert(`${keys.length}명 중 ${success}명만 초기화되었습니다.\n인터넷 연결을 확인하고 다시 시도해주세요.`,
                { title: '⚠️ 초기화를 마치지 못했습니다' });
        }
    }
    window.renderStudentMonitor();
};

// ==========================================
// 교사용 API 키 관리
// 화면에는 'API 1번'처럼만 표시하고, 키 문자열은 '자세히 보기'를 눌러야 일부만 보입니다.
// ==========================================
window.apiKeyRecords = [];   // [{ key, createdAt }]

// DB에서 읽은 값을 표준 형태로 맞춘다 (예전 문자열 배열도 그대로 읽힘)
window.setApiKeyRecords = function(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    window.apiKeyRecords = arr.map(item => {
        if (typeof item === 'string') return { key: item.trim(), createdAt: '' };
        if (item && typeof item === 'object') return { key: String(item.key || '').trim(), createdAt: item.createdAt || '' };
        return { key: '', createdAt: '' };
    }).filter(r => r.key.length > 0);
    window.dynamicApiKeys = window.apiKeyRecords.map(r => r.key);
    return window.dynamicApiKeys;
};

window.addApiKeyUI = function() {
    const input = document.getElementById('teacherApiKeyInput');
    const val = input.value.trim();
    if(!val) return;
    if(window.apiKeyRecords.some(r => r.key === val)) return window.showNotification("이미 등록된 키입니다.");
    window.apiKeyRecords.push({ key: val, createdAt: window.getTodayStr() });
    window.dynamicApiKeys = window.apiKeyRecords.map(r => r.key);
    input.value = '';
    window.renderApiKeysUI();
    window.showNotification("키를 추가했습니다. 아래 [변경사항 DB에 최종 저장]을 눌러야 반영됩니다.");
};

window.removeApiKeyUI = async function(index) {
    const rec = window.apiKeyRecords[index];
    if (!rec) return;
    const ok = await window.uiConfirm(`API ${index + 1}번 키를 목록에서 뺍니다.\n아래 [변경사항 DB에 최종 저장]을 눌러야 실제로 반영됩니다.`,
        { title: '🔑 키를 삭제할까요?', okText: '삭제하기', cancelText: '취소', danger: true });
    if (!ok) return;
    window.apiKeyRecords.splice(index, 1);
    window.dynamicApiKeys = window.apiKeyRecords.map(r => r.key);
    window.renderApiKeysUI();
};

// '자세히 보기'를 누르면 앞 6자리만 잠깐 보여준다
window.toggleApiKeyDetail = function(index, btnEl) {
    const box = document.getElementById(`apikey-detail-${index}`);
    if (!box) return;
    const opened = box.style.display !== 'none';
    box.style.display = opened ? 'none' : 'block';
    if (btnEl) btnEl.innerHTML = opened
        ? '<i class="fa-solid fa-eye"></i> 자세히 보기'
        : '<i class="fa-solid fa-eye-slash"></i> 숨기기';
};

window.renderApiKeysUI = function() {
    const list = document.getElementById('apiKeysList');
    if(!list) return;

    if (!window.apiKeyRecords || window.apiKeyRecords.length === 0) {
        list.innerHTML = '<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:20px;">아직 등록된 키가 없습니다.<br>위 입력칸에 Gemini API Key를 붙여넣고 [+ 키 추가]를 눌러주세요.</div>';
        return;
    }

    list.innerHTML = window.apiKeyRecords.map((rec, i) => {
        const dateText = rec.createdAt ? `등록일 ${rec.createdAt}` : '등록일 정보 없음';
        const head = rec.key.length > 6 ? rec.key.substring(0, 6) : rec.key;
        return `
        <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:10px; padding:14px 16px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                <div>
                    <strong style="color:var(--primary); font-size:15px;">🔑 API ${i + 1}번</strong>
                    <span style="margin-left:8px; font-size:11px; font-weight:bold; color:#166534; background:#dcfce7; padding:3px 8px; border-radius:12px;">사용 중</span>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${dateText}</div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button style="background:#f8fafc; border:1px solid var(--border-color); color:var(--text-main); padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px;" onclick="window.toggleApiKeyDetail(${i}, this)"><i class="fa-solid fa-eye"></i> 자세히 보기</button>
                    <button style="background:#fef2f2; border:1px solid #fca5a5; color:#ef4444; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px;" onclick="window.removeApiKeyUI(${i})"><i class="fa-solid fa-xmark"></i> 삭제</button>
                </div>
            </div>
            <div id="apikey-detail-${i}" style="display:none; margin-top:10px; background:#f8fafc; border:1px dashed var(--border-color); border-radius:6px; padding:10px;">
                <div style="font-family:monospace; font-size:13px; color:var(--text-main); letter-spacing:1px;">${head}••••••••••••••••</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">키 전체는 화면에 표시되지 않습니다. 확인이 필요하시면 Google AI Studio에서 대조해주세요.</div>
            </div>
        </div>`;
    }).join('');
};

window.saveApiKey = async function() {
    const model = document.getElementById('teacherApiModel').value.trim() || window.DEFAULT_AI_MODEL;
    try {
        await setDoc(doc(db, "classes", window.classKey), { apiKeys: window.apiKeyRecords, apiModel: model }, { merge: true });
        window.dynamicApiModel = model;
        // 이번 접속에서 제외해 둔 키 상태를 초기화 (새 키를 넣었을 수 있으므로)
        window.apiKeyDisabled = {};
        window.apiKeyCooldowns = {};
        window.showNotification("API 키 및 설정이 안전하게 저장되었습니다.");
    } catch(e) { window.showNotification("설정 저장에 실패했습니다."); }
};

// ==========================================
// 교사용: 심사용 계정(0000) 전용 AI 키 관리
// 선생님 학급 키와 분리되어 있어, 학급을 옮기거나 지워도 심사용은 계속 작동합니다.
// ==========================================
window.judgeApiKeyRecords = [];

window.loadJudgeKeysForUI = async function() {
    try {
        const snap = await getDoc(doc(db, "classes", window.JUDGE_KEY_DOC));
        const raw = snap.exists() ? snap.data().apiKeys : [];
        const modelEl = document.getElementById('judgeApiModel');
        if (modelEl) modelEl.value = (snap.exists() && snap.data().apiModel) ? snap.data().apiModel : '';
        window.judgeApiKeyRecords = (Array.isArray(raw) ? raw : []).map(item =>
            (typeof item === 'string')
                ? { key: item.trim(), createdAt: '' }
                : { key: String((item && item.key) || '').trim(), createdAt: (item && item.createdAt) || '' }
        ).filter(r => r.key.length > 0);
    } catch (e) {
        console.error("심사용 키를 불러오지 못했습니다.", e);
        window.judgeApiKeyRecords = [];
    }
    window.renderJudgeApiKeysUI();
};

window.addJudgeApiKeyUI = function() {
    const input = document.getElementById('judgeApiKeyInput');
    const val = input.value.trim();
    if (!val) return;
    if (window.judgeApiKeyRecords.some(r => r.key === val)) return window.showNotification("이미 등록된 키입니다.");
    window.judgeApiKeyRecords.push({ key: val, createdAt: window.getTodayStr() });
    input.value = '';
    window.renderJudgeApiKeysUI();
    window.showNotification("키를 추가했습니다. 아래 [심사용 키 저장]을 눌러야 반영됩니다.");
};

window.removeJudgeApiKeyUI = async function(index) {
    if (!window.judgeApiKeyRecords[index]) return;
    const ok = await window.uiConfirm(`심사용 API ${index + 1}번 키를 목록에서 뺍니다.\n아래 [심사용 키 저장]을 눌러야 실제로 반영됩니다.`,
        { title: '🏅 심사용 키를 삭제할까요?', okText: '삭제하기', cancelText: '취소', danger: true });
    if (!ok) return;
    window.judgeApiKeyRecords.splice(index, 1);
    window.renderJudgeApiKeysUI();
};

window.toggleJudgeApiKeyDetail = function(index, btnEl) {
    const box = document.getElementById(`judgekey-detail-${index}`);
    if (!box) return;
    const opened = box.style.display !== 'none';
    box.style.display = opened ? 'none' : 'block';
    if (btnEl) btnEl.innerHTML = opened
        ? '<i class="fa-solid fa-eye"></i> 자세히 보기'
        : '<i class="fa-solid fa-eye-slash"></i> 숨기기';
};

window.renderJudgeApiKeysUI = function() {
    const list = document.getElementById('judgeApiKeysList');
    if (!list) return;
    if (window.judgeApiKeyRecords.length === 0) {
        list.innerHTML = '<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:20px;">등록된 심사용 키가 없습니다.<br>키를 등록하지 않으면 우리 학급 키를 대신 사용합니다.</div>';
        return;
    }
    list.innerHTML = window.judgeApiKeyRecords.map((rec, i) => {
        const dateText = rec.createdAt ? `등록일 ${rec.createdAt}` : '등록일 정보 없음';
        const head = rec.key.length > 6 ? rec.key.substring(0, 6) : rec.key;
        return `
        <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:10px; padding:14px 16px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                <div>
                    <strong style="color:var(--accent); font-size:15px;">🏅 심사용 API ${i + 1}번</strong>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${dateText}</div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button style="background:#f8fafc; border:1px solid var(--border-color); color:var(--text-main); padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px;" onclick="window.toggleJudgeApiKeyDetail(${i}, this)"><i class="fa-solid fa-eye"></i> 자세히 보기</button>
                    <button style="background:#fef2f2; border:1px solid #fca5a5; color:#ef4444; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px;" onclick="window.removeJudgeApiKeyUI(${i})"><i class="fa-solid fa-xmark"></i> 삭제</button>
                </div>
            </div>
            <div id="judgekey-detail-${i}" style="display:none; margin-top:10px; background:#f8fafc; border:1px dashed var(--border-color); border-radius:6px; padding:10px;">
                <div style="font-family:monospace; font-size:13px; letter-spacing:1px;">${head}••••••••••••••••</div>
            </div>
        </div>`;
    }).join('');
};

window.saveJudgeApiKeys = async function() {
    const modelEl = document.getElementById('judgeApiModel');
    const model = (modelEl && modelEl.value.trim()) || "";   // 비우면 우리 학급 설정을 따른다
    try {
        await setDoc(doc(db, "classes", window.JUDGE_KEY_DOC), {
            apiKeys: window.judgeApiKeyRecords,
            apiModel: model,
            note: "심사용 계정(_0000) 전용 AI 키입니다. 학급 데이터와 섞이지 않습니다."
        }, { merge: true });
        window.showNotification("심사용 AI 키가 저장되었습니다. 이제 모든 지역의 심사용 계정이 이 키를 사용합니다.");
        await window.loadJudgeKeysForUI();
    } catch (e) {
        console.error("심사용 키 저장 실패", e);
        window.showNotification("심사용 키 저장에 실패했습니다.");
    }
};

// ==========================================
// 이미지 변환 (사진이 깨져도 화면이 멈추지 않도록 처리)
// ==========================================
window.getBase64 = function(file) {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error("파일이 없습니다."));
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let w = img.width; let h = img.height;
                    // [2026-09-19 변경] 화면에는 최대 250px로만 보이므로 260px이면 충분합니다.
                    // 학급 저장 공간(1MB)이 사진 때문에 금방 차는 것을 막습니다.
                    const MAX = 260;
                    if(w > h) { if(w > MAX) { h *= MAX/w; w = MAX; } } else { if(h > MAX) { w *= MAX/h; h = MAX; } }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    // [2026-09-19 변경] JPEG와 WebP를 모두 만들어 더 작은 쪽을 고릅니다.
                    //   WebP는 같은 화질에서 용량이 30% 정도 작습니다.
                    //   옛 브라우저가 WebP를 모르면 자동으로 JPEG를 사용합니다.
                    let dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                    let mime = 'image/jpeg';
                    try {
                        const webp = canvas.toDataURL('image/webp', 0.55);
                        if (webp.indexOf('data:image/webp') === 0 && webp.length < dataUrl.length) {
                            dataUrl = webp;
                            mime = 'image/webp';
                        }
                    } catch (e) { /* WebP 미지원 브라우저는 JPEG 사용 */ }
                    resolve({ inlineData: { data: dataUrl.split(',')[1], mimeType: mime }, dataUrl: dataUrl });
                } catch (err) { reject(err); }
            };
            img.onerror = () => reject(new Error("이미지를 읽을 수 없습니다. (지원하지 않는 형식일 수 있어요)"));
            img.src = event.target.result;
        };
        reader.onerror = () => reject(new Error("파일을 여는 데 실패했습니다."));
        reader.readAsDataURL(file);
    });
};

function getEnteredClassCode() {
    const region = document.getElementById('loginRegion').value;
    const d1 = document.querySelectorAll('.code-digit')[0].value; const d2 = document.querySelectorAll('.code-digit')[1].value; const d3 = document.querySelectorAll('.code-digit')[2].value; const d4 = document.querySelectorAll('.code-digit')[3].value;
    if(!region || !d1 || !d2 || !d3 || !d4) return null; return `${region}_${d1}${d2}${d3}${d4}`;
};

window.initSystem = async function(isTeacherModeParam = false) {
    window.isTeacherMode = isTeacherModeParam;
    
    const tips = [
        "지역 주민들이 함께 겪는 불편함을 '지역 문제'라고 해요. 여러 사람에게 영향을 주기 때문에 함께 해결해야 한답니다.",
        "시청, 도청, 경찰서, 소방서처럼 주민 모두의 편안하고 안전한 생활을 위해 세운 곳을 '공공 기관'이라고 불러요.",
        "주민이 지역의 일에 의견을 내고 참여하는 것을 '주민 참여'라고 해요.",
        "환경을 지키면서도 함께 발전하는 것을 '지속 가능한 발전'이라고 합니다.",
        "지도에서 위쪽은 북쪽이에요. 방위표가 있으면 방향을 정확히 알 수 있답니다.",
        "자주 나오는 장소는 '기호'로 간단히 그리고, 그 뜻을 '범례'에 적어요.",
        "사람들이 많이 모이는 곳을 '중심지'라고 해요. 시장, 버스터미널, 시청 주변이 대표적이에요.",
        "우리가 낸 세금이 모여 도로를 고치고 도서관을 짓는 데 쓰여요. 이 돈을 '예산'이라고 부릅니다."
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
            
            // 같은 번호로 다른 친구가 이미 접속해 있는지 확인한다
            try {
                const sSnap = await getDoc(doc(db, "classes", fullCode, "presence", String(n)));
                if (sSnap.exists()) {
                    const sData = sSnap.data();
                    const lastSeen = sData.lastSeen || 0;
                    const stillFresh = (Date.now() - lastSeen) < window.PRESENCE_TIMEOUT_MS;   // 10분 (위 설정값)
                    const otherDevice = sData.deviceId && sData.deviceId !== window.getDeviceId();
                    if (sData.isOnline === true && stillFresh && otherDevice) {
                        document.getElementById('loadingScreen').style.display = 'none';
                        window.showNotification(`${n}번은 지금 다른 친구가 사용 중이에요. 다른 번호로 접속해주세요. (잠시 뒤 자동으로 풀립니다)`);
                        return setTimeout(() => location.reload(), 3000);
                    }
                }
            } catch (e) { console.warn("번호 중복 확인을 건너뜁니다.", e); }

            window.classKey = fullCode; 
            window.userKey = n; 
            window.currentUserId = n;

            // 이 번호를 지금 내가 쓰고 있다고 곧바로 기록한다
            // (신호를 기다리지 않아야 바로 뒤에 들어오는 친구를 막을 수 있습니다)
            try {
                await setDoc(doc(db, "classes", fullCode, "presence", String(n)),
                    { isOnline: true, lastSeen: Date.now(), deviceId: window.getDeviceId() }, { merge: true });
            } catch (e) { console.warn("접속 기록을 남기지 못했습니다.", e); }
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
            window.classKey = 'teacher_temp_global'; window.dynamicApiKey = ""; window.dynamicApiKeys = []; window.dynamicApiModel = "";
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
            const aiCard = document.getElementById('setupAiLimitCard');
            if(aiCard) aiCard.style.display = 'none';
            const judgeCard = document.getElementById('setupJudgeKeyCard');
            if(judgeCard) judgeCard.style.display = 'none';
            const judgeHint = document.getElementById('judgeKeyHint');
            if(judgeHint) judgeHint.style.display = 'none';
        } else { 
            document.getElementById('monitorClassTitle').innerText = fullCode; 
            document.getElementById('setupApiKeyCard').style.display = 'block'; 
            document.getElementById('setupMapCard').style.display = 'block'; 
            const aiCard = document.getElementById('setupAiLimitCard');
            if(aiCard) aiCard.style.display = 'block';
            // 심사용 키 카드는 심사용 학급(0000)으로 접속했을 때만 보여준다
            const judgeCard = document.getElementById('setupJudgeKeyCard');
            const judgeHint = document.getElementById('judgeKeyHint');
            if (window.classKey.endsWith("_0000")) {
                if(judgeCard) { judgeCard.style.display = 'block'; window.loadJudgeKeysForUI(); }
                if(judgeHint) judgeHint.style.display = 'none';
            } else {
                if(judgeCard) judgeCard.style.display = 'none';
                if(judgeHint) judgeHint.style.display = 'block';
            }
            
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

    window.updateAIButtons();

    if(window.classKey !== 'teacher_temp_global') {
        const regionCode = fullCode ? fullCode.split('_')[0] : 'seoul';
        const fallbackMapCenter = window.eduOffices[regionCode] || window.eduOffices['seoul'];

        onSnapshot(doc(db, "classes", window.classKey), (docSnap) => {
            window.classDataLoaded = true;
            if (docSnap.exists()) {
                const data = docSnap.data(); 
                
                if (data.apiKeys && Array.isArray(data.apiKeys) && data.apiKeys.length > 0) {
                    window.setApiKeyRecords(data.apiKeys);
                } else if (data.apiKey) {
                    window.setApiKeyRecords([data.apiKey]);
                } else if (!window.classKey.endsWith("_0000")) {
                    // 심사용 학급은 마스터 학급의 키를 빌려 쓰므로 여기서 비우지 않는다
                    window.setApiKeyRecords([]);
                }
                if (window.isTeacherMode) window.renderApiKeysUI();

                if (data.apiModel) {
                    window.dynamicApiModel = data.apiModel; 
                    if(window.isTeacherMode) document.getElementById('teacherApiModel').value = data.apiModel;
                }

                if (window.classKey.endsWith("_0000")) {
                    window.loadJudgeApiKeys();
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
                window.loadJudgeApiKeys();
                
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
                    window.gameState.aiUsage = data.aiUsage || { date: window.getTodayStr(), advice: 0, consulting: 0 };
                    
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
                    window.gameState.aiUsage = { date: window.getTodayStr(), advice: 0, consulting: 0 };
                    setDoc(doc(db, "classes", window.classKey, "students", window.userKey), { budget: window.gameState.budget, visitorCount: window.gameState.visitorCount, reputation: window.gameState.reputation, satisfaction: window.gameState.satisfaction, builtBuildings: window.gameState.builtBuildings, aiUsage: window.gameState.aiUsage }, { merge: true });
                }

                window.ensureAiUsageToday();
                window.updateAIButtons();
                
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
                        const firstMedia = document.querySelectorAll('input[name="mediaOption"]')[0];
                        if(firstMedia) firstMedia.checked = true; 
                    }
                }
                
                window.updateUI(true);
                window.startHeartbeat();
                window.startIdleWatch();        // [추가] 무활동 감시 시작
                setTimeout(() => { document.getElementById('loadingScreen').style.display = 'none'; }, 1500);
            });
        } else {
            // 접속 상태는 별도 컬렉션에서 가져온다
            window.presenceData = {};
            onSnapshot(collection(db, "classes", window.classKey, "presence"), (snap) => {
                window.presenceData = {};
                snap.forEach((d) => { window.presenceData[d.id] = d.data(); });
                try { window.renderStudentMonitor(); } catch(e) {}
            });

            onSnapshot(collection(db, "classes", window.classKey, "students"), (snapshot) => {
                window.allStudentsData = {}; snapshot.forEach((doc) => { window.allStudentsData[doc.id] = doc.data(); }); window.renderStudentMonitor();
                if(document.getElementById('monitorDetailView').style.display === 'block') { const currentlyViewingNum = document.getElementById('dtNum').innerText; if(currentlyViewingNum) window.showStudentDetails(currentlyViewingNum); }
                setTimeout(() => { document.getElementById('loadingScreen').style.display = 'none'; }, 1000);
            });
        }
    } else { setTimeout(() => { document.getElementById('loadingScreen').style.display = 'none'; }, 1000); }
};

// ★ 탭을 오갈 때마다 저장하지 않도록 상태를 기억한다
window.offlineMarked = false;

const handleOffline = () => {
    if (window.isTeacherMode || !window.classKey || !window.userKey) return;
    if (window.offlineMarked) return;              // 이미 기록했으면 다시 쓰지 않는다
    window.offlineMarked = true;
    if (window.heartbeatTimer) { clearInterval(window.heartbeatTimer); window.heartbeatTimer = null; }
    window.heartbeatStarted = false;
    setDoc(window.presenceRef(window.userKey), { isOnline: false, lastSeen: 0 }, { merge: true }).catch(() => {});
};

const handleOnlineAgain = () => {
    if (window.isTeacherMode || !window.classKey || !window.userKey) return;
    if (!window.offlineMarked) return;
    window.offlineMarked = false;
    window.startHeartbeat();                        // 돌아오면 다시 신호를 보낸다
};

window.addEventListener('pagehide', handleOffline);
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') handleOffline();
    else handleOnlineAgain();
});

// ★ 저장을 '학급 문서'와 '내 문서'로 나눕니다.
//   학급 문서는 반 전체가 구독 중이라, 한 번 쓰면 인원수만큼 읽기가 발생합니다.
//   예산처럼 나만의 값이 바뀐 경우에는 학급 문서를 건드리지 않아야 합니다.
window.canSaveNow = function() {
    if(!window.classKey || window.classKey === 'teacher_temp_global') return false;
    if(!window.isTeacherMode && (!window.classDataLoaded || !window.studentDataLoaded)) return false;
    if(window.isTeacherMode && !window.classDataLoaded) return false;
    return true;
};

// 나의 지표만 저장 (반 친구들에게 알림이 가지 않습니다)
window.saveStudentState = async function() {
    if (!window.canSaveNow() || window.isTeacherMode) return;
    try {
        await setDoc(doc(db, "classes", window.classKey, "students", window.userKey), {
            budget: window.gameState.budget,
            visitorCount: window.gameState.visitorCount,
            reputation: window.gameState.reputation,
            satisfaction: window.gameState.satisfaction,
            builtBuildings: window.gameState.builtBuildings
        }, { merge: true });
    } catch (e) { window.reportSaveError(e); }
};

// 학급 공용 자료만 저장 (게시판·제안서·홍보·지도 기호가 바뀌었을 때만)
window.saveClassState = async function() {
    if (!window.canSaveNow()) return;
    try {
        await setDoc(doc(db, "classes", window.classKey), {
            problems: window.gameState.problems,
            submittedProposals: window.gameState.submittedProposals,
            promoBoard: window.gameState.promoBoard,
            marketingCampaigns: window.gameState.marketingCampaigns,
            mapMarkers: window.gameState.mapMarkers
        }, { merge: true });
    } catch (e) { window.reportSaveError(e); }
};

window.reportSaveError = function(e) {
    console.error("DB 저장 에러:", e);
    const code = String((e && e.code) || '');
    const msg = String((e && e.message) || '');
    if (code.includes("resource-exhausted") || msg.includes("Quota exceeded")) {
        window.showNotification("⚠️ 오늘 저장 가능한 양을 모두 사용했습니다. 선생님께 알려주세요!");
    } else if (msg.includes("longer than") || code.includes("invalid-argument")) {
        window.showNotification("⚠️ 저장 공간이 가득 찼습니다! 선생님께 알려주세요. (사진이나 기호를 정리해야 합니다)");
    } else {
        window.showNotification("⚠️ 저장에 실패했습니다. 인터넷 연결을 확인해주세요.");
    }
};

// 둘 다 저장 (학급 자료와 내 지표가 함께 바뀐 경우)
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
    } catch (e) { 
        console.error("DB 저장 에러:", e); 
        const code = String((e && e.code) || '');
        const msg = String((e && e.message) || '');
        if (code.includes("resource-exhausted") || msg.includes("Quota exceeded")) {
            window.showNotification("⚠️ 오늘 저장 가능한 양을 모두 사용했습니다. 선생님께 알려주세요!");
        } else if (msg.includes("longer than") || code.includes("invalid-argument")) {
            window.showNotification("⚠️ 저장 공간이 가득 찼습니다! 선생님께 알려주세요. (사진이나 기호를 정리해야 합니다)");
        } else {
            window.showNotification("⚠️ 저장에 실패했습니다. 인터넷 연결을 확인해주세요.");
        }
    }
};

// ==========================================
// AI 키가 준비될 때까지 잠시 기다린다
// (심사용 계정은 마스터 학급에서 키를 받아오므로 로그인 직후 잠깐 비어 있습니다)
// ==========================================
// 심사용 계정이 쓸 AI 키를 불러온다
// ① 심사용 전용 문서(_judge_master) → ② 없으면 예비 학급(MASTER_CLASS_KEY)
window.loadJudgeApiKeys = async function() {
    try {
        const jSnap = await getDoc(doc(db, "classes", window.JUDGE_KEY_DOC));
        if (jSnap.exists()) {
            const j = jSnap.data();
            if (Array.isArray(j.apiKeys) && j.apiKeys.length > 0) {
                window.setApiKeyRecords(j.apiKeys);
                if (j.apiModel) window.dynamicApiModel = j.apiModel;
                if (window.isTeacherMode) window.renderApiKeysUI();
                return true;
            }
        }
    } catch (e) {
        console.warn("[AI] 심사용 전용 키 문서를 읽지 못했습니다. 예비 학급으로 넘어갑니다.", e);
    }

    try {
        const mSnap = await getDoc(doc(db, "classes", window.MASTER_CLASS_KEY));
        if (mSnap.exists()) {
            const m = mSnap.data();
            if (Array.isArray(m.apiKeys) && m.apiKeys.length > 0) window.setApiKeyRecords(m.apiKeys);
            else if (m.apiKey) window.setApiKeyRecords([m.apiKey]);
            if (m.apiModel) window.dynamicApiModel = m.apiModel;
            if (window.isTeacherMode) window.renderApiKeysUI();
            return (window.dynamicApiKeys || []).length > 0;
        }
    } catch (e) {
        console.error("[AI] 심사용 AI 키를 불러오지 못했습니다.", e);
    }
    return false;
};

window.ensureApiKeysReady = async function(maxWaitMs = 6000) {
    const hasKeys = () => (Array.isArray(window.dynamicApiKeys) && window.dynamicApiKeys.length > 0) || !!window.dynamicApiKey;
    if (hasKeys()) return true;

    // 심사용 학급이면 전용 문서에서 직접 한 번 더 가져온다
    if (window.classKey && window.classKey.endsWith("_0000")) {
        await window.loadJudgeApiKeys();
    }
    if (hasKeys()) return true;

    // 일반 학급이면 실시간 수신이 도착할 때까지 짧게 기다린다
    const startedAt = Date.now();
    while (!hasKeys() && (Date.now() - startedAt) < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    return hasKeys();
};

;(function attachAILimits() {
    const originalCall = window.callGeminiAPI;
    const originalAdvice = window.getAIAdvice;
    const originalConsulting = window.getAIConsulting;

    // 실제로 AI 응답을 받아온 경우에만 횟수를 차감한다
    // [2026-09-19 수정] 세 번째 인자(options)를 그대로 넘겨준다.
    //   예전에는 (prompt, inlineData)만 받아서 { fast: true } 가 사라졌고,
    //   그래서 '빠른 모드'가 한 번도 실제로 켜지지 않았습니다.
    window.callGeminiAPI = async function(...args) {
        await window.ensureApiKeysReady();
        window.lastAICallAt = Date.now();
        window.startAICooldownUI();
        const result = await originalCall.apply(this, args);
        if (window.currentAIRequestType) {
            window.consumeAI(window.currentAIRequestType);
            window.currentAIRequestType = null;
        }
        return result;
    };

    window.getAIAdvice = async function() {
        const check = window.canUseAI('advice');
        if (!check.ok) return window.showNotification(check.message);
        window.currentAIRequestType = 'advice';
        try { await originalAdvice.apply(this, arguments); }
        finally { window.currentAIRequestType = null; window.updateAIButtons(); }
    };

    window.getAIConsulting = async function() {
        const check = window.canUseAI('consulting');
        if (!check.ok) return window.showNotification(check.message);
        window.currentAIRequestType = 'consulting';
        try { await originalConsulting.apply(this, arguments); }
        finally { window.currentAIRequestType = null; window.updateAIButtons(); }
    };
})();