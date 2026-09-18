// api.js - 구글 Gemini AI 통신 및 데이터 제출 로직 전담
// [개편] 1) AI 예산 즉시 지급 → 선생님 승인 시 지급
//        2) 제안서 버전 이력(최대 3차) 저장
//        3) 429 쿨다운 / 503 지수 백오프 / 잘못된 키 자동 제외
//        4) AI 비서 힌트에 사진 자료 다시 반영
//        5) [보완] 모델 변경 시 이전 모델 기록 자동 초기화 / ** 기호 정리

window.isAILoading = false;

// 제안서 이력 보관 최대 차수
window.MAX_PROPOSAL_VERSIONS = 3;

// 키 상태 관리 (429 쿨다운 / 사용 불가 키)
window.apiKeyCooldowns = {};   // { 키: 쿨다운 해제 시각(ms) }
window.apiKeyDisabled = {};    // { 키: true }

// ==========================================
// [2026-09-19 보완] 모델이 바뀌면 이전 모델에서 얻은 '기억'을 지운다
//   · 한도(429)는 모델마다 따로 계산되므로, 옛 모델에서 막힌 키도 새 모델에서는 쓸 수 있습니다.
//   · "MINIMAL을 모른다" 같은 메모도 옛 모델 이야기이므로 지웁니다.
//   → 선생님이 수업 중 모델을 바꿔도 학생이 새로고침할 필요가 없습니다.
// ==========================================
window.aiStateModel = null;   // 지금 기억하고 있는 모델 이름

window.resetAIModelState = function() {
    window.apiKeyCooldowns = {};
    window.apiKeyDisabled = {};
    window.geminiFastThinkingLevel = undefined;   // 다음 요청에서 MINIMAL부터 다시 시도
    window.geminiUseThinkingConfig = undefined;   // 다음 요청에서 생각 수준 설정을 다시 사용
};

// ==========================================
// [2026-09-19 추가] AI 대기 시간 상한 (숫자만 고치면 됩니다)
//   ※ 예전에는 시간 제한이 아예 없어서 구글이 응답하지 않으면 몇 분씩 멈췄습니다.
// ==========================================
window.AI_REQUEST_TIMEOUT_MS      = 35000;  // 요청 1건 최대 대기 (심사용)
window.AI_REQUEST_TIMEOUT_FAST_MS = 20000;  // 요청 1건 최대 대기 (가벼운 조언)
window.AI_TOTAL_DEADLINE_MS       = 75000;  // 재시도까지 포함한 전체 포기 시각 (심사용)
window.AI_TOTAL_DEADLINE_FAST_MS  = 45000;  // 재시도까지 포함한 전체 포기 시각 (가벼운 조언)
window.AI_MAX_503_TRIES           = 4;      // 서버 혼잡(503) 총 재시도 횟수

// ==========================================
// ★★★ 교과 학습 내용 (수업에서 다룬 개념) ★★★
//   여기 한 곳만 고치면 아래 네 곳의 AI 답변에 모두 반영됩니다.
//     1) AI 비서 힌트        2) 해결 제안서 1차 검토
//     3) AI 홍보 컨설팅      4) 홍보 기획안 1차 검토 (ui.js)
//
//   사용법: 아래 배열에 "개념: 설명" 형태로 한 줄씩 추가하세요.
// ==========================================
window.LEARNING_CONCEPTS = [
    // 예시)
    // "중심지: 사람들이 많이 모이는 곳. 시장, 버스터미널, 시청 주변이 대표적이다.",
    // "공공 기관: 주민 모두의 편안하고 안전한 생활을 위해 세운 곳. 시청, 경찰서, 소방서 등.",
];

// [2026-09-19 보완] 모든 AI 요청에 붙는 '꾸밈 기호 금지' 규칙
//   AI가 **굵게** 같은 기호를 쓰면 학생 화면에 별표가 그대로 보였습니다.
window.AI_PLAIN_TEXT_RULE = '\n\n※ 별표(**)나 샵(#) 같은 꾸밈 기호는 쓰지 말고, 평범한 문장으로만 써줘.';

// 위 배열을 AI에게 전달할 문장으로 만들어 준다
// [2026-09-19 보완] 학습 내용이 비어 있어도 '꾸밈 기호 금지' 규칙은 항상 붙습니다.
window.buildLearningBlock = function() {
    let block = '';
    if (Array.isArray(window.LEARNING_CONCEPTS) && window.LEARNING_CONCEPTS.length > 0) {
        block = '\n\n[우리 반이 수업에서 배운 내용]\n'
            + window.LEARNING_CONCEPTS.map(s => '- ' + s).join('\n')
            + '\n※ 이 낱말들을 억지로 나열하지 마. 학생의 글과 관련 있는 것만 1~2가지 골라,'
            + ' 초등학교 4학년이 알아들을 쉬운 말로 자연스럽게 녹여서 써줘.';
    }
    return block + window.AI_PLAIN_TEXT_RULE;
};

// 로딩 중 보여줄 학습 팁 (4학년 사회 '우리 지역' 관련 개념)
// ※ "💡 시장님, 그거 아시나요?" 제목은 index.html에 이미 있으므로 본문에는 넣지 않습니다.
window.aiLoadingTips = [
    "지역 주민들이 함께 겪는 불편함을 '지역 문제'라고 해요. 여러 사람에게 영향을 주기 때문에 함께 해결해야 한답니다.",
    "시청, 도청, 경찰서, 소방서처럼 주민 모두의 편안하고 안전한 생활을 위해 세운 곳을 '공공 기관'이라고 불러요.",
    "주민이 지역의 일에 의견을 내고 참여하는 것을 '주민 참여'라고 해요. 지금 쓰는 제안서도 훌륭한 참여 방법이랍니다.",
    "좋은 해결 방안은 정말로 실천할 수 있어야 해요. 이것을 '실현 가능성'이라고 부릅니다.",
    "나 혼자가 아니라 여러 사람에게 두루 도움이 되는 성질을 '공공성'이라고 해요.",
    "환경을 지키면서도 함께 발전하는 것을 '지속 가능한 발전'이라고 합니다.",
    "우리가 낸 세금이 모여 도로를 고치고 도서관을 짓는 데 쓰여요. 이 돈을 '예산'이라고 부릅니다.",
    "사람들이 많이 모이는 곳을 '중심지'라고 해요. 시장, 버스터미널, 시청 주변이 대표적이랍니다."
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 기다리는 동안 학습 팁을 5초마다 바꿔 보여준다
// ==========================================
window.tipTimers = {};

window.startTipRotation = function(elementId, intervalMs = 10000) {
    window.stopTipRotation(elementId);
    const first = document.getElementById(elementId);
    if (!first) return;
    let idx = Math.floor(Math.random() * window.aiLoadingTips.length);
    first.innerText = window.aiLoadingTips[idx];
    window.tipTimers[elementId] = setInterval(() => {
        const el = document.getElementById(elementId);
        if (!el) { window.stopTipRotation(elementId); return; }
        idx = (idx + 1) % window.aiLoadingTips.length;
        el.style.transition = 'opacity 0.25s';
        el.style.opacity = '0';
        setTimeout(() => {
            const el2 = document.getElementById(elementId);
            if (el2) { el2.innerText = window.aiLoadingTips[idx]; el2.style.opacity = '1'; }
        }, 250);
    }, intervalMs);

    // [2026-09-19 추가] 경과 시간을 1초마다 표시합니다.
    //   숫자가 계속 올라가야 "멈춘 것"이 아니라 "일하는 중"으로 보입니다.
    const startedAt = Date.now();
    window.tipTimers[elementId + '-sec'] = setInterval(() => {
        const secEl = document.getElementById(elementId + '-sec');
        if (!secEl) return;
        secEl.innerText = `${Math.floor((Date.now() - startedAt) / 1000)}초`;
    }, 1000);
};

window.stopTipRotation = function(elementId) {
    [elementId, elementId + '-sec'].forEach(key => {
        if (window.tipTimers[key]) {
            clearInterval(window.tipTimers[key]);
            delete window.tipTimers[key];
        }
    });
};

// 기다리는 동안 보여줄 인라인 안내 상자
window.buildWaitingBox = function(title, tipElementId) {
    return `<div style="display:flex; align-items:center; gap:8px; font-weight:bold; color:var(--primary);">
        <i class="fa-solid fa-spinner fa-spin"></i> ${title}
        <span id="${tipElementId}-sec" style="margin-left:auto; font-size:13px; font-weight:bold; color:var(--text-muted);">0초</span>
    </div>
    <div style="margin-top:12px; padding:12px 14px; background:#ffffff; border-radius:8px; border:1px dashed var(--border-color);">
        <div style="font-size:12px; font-weight:bold; color:var(--primary); margin-bottom:6px;">💡 기다리는 동안 알아두면 좋아요</div>
        <div id="${tipElementId}" style="font-size:14px; line-height:1.6; color:var(--text-main);"></div>
    </div>`;
};

// ==========================================
// 공통: Gemini API 호출
// ==========================================
window.getUsableApiKeys = function() {
    const all = (window.dynamicApiKeys && window.dynamicApiKeys.length > 0)
        ? window.dynamicApiKeys
        : (window.dynamicApiKey ? [window.dynamicApiKey] : []);
    return all.map(k => String(k).trim()).filter(k => k.length > 0);
}

// options.fast = true  →  '빠른 모드'
//   AI 비서 힌트, 홍보 컨설팅처럼 판정이 필요 없는 가벼운 조언에 씁니다.
//   생각 과정을 최소로 줄여 응답을 빠르게 합니다.
//   제안서·홍보 심사처럼 판정이 필요한 곳에서는 쓰지 않습니다.
window.callGeminiAPI = async function(prompt, inlineData = null, options = {}) {
    const fast = options && options.fast === true;

    // 교사용 설정에 저장된 모델이 항상 우선입니다. 아래 값은 설정이 없을 때만 쓰는 예비값입니다.
    // [2026-09-19 보완] 예비값 3.8 → 3.6 (3.8은 출시 직후라 503이 잦음)
    const model = window.dynamicApiModel || window.DEFAULT_AI_MODEL || "gemini-3.6-flash";

    // [2026-09-19 보완] 모델이 바뀌었으면 이전 모델의 기록(쿨다운·생각 수준 메모)을 지운다
    //   ※ 키를 고르기 '전에' 해야 옛 모델에서 막힌 키도 다시 쓸 수 있습니다.
    if (window.aiStateModel !== model) {
        if (window.aiStateModel) {
            console.info(`[AI] 모델이 ${window.aiStateModel} → ${model}(으)로 바뀌어 이전 모델의 기록을 지웁니다.`);
        }
        window.resetAIModelState();
        window.aiStateModel = model;
    }

    const allKeys = window.getUsableApiKeys();
    if (allKeys.length === 0) {
        const e = new Error("NO_API_KEY");
        e.userMessage = "AI 담당관과 아직 연결되지 않았습니다. 잠시 후 다시 눌러보세요.";
        throw e;
    }

    const now = Date.now();
    const keys = allKeys.filter(k =>
        !window.apiKeyDisabled[k] && (!window.apiKeyCooldowns[k] || window.apiKeyCooldowns[k] <= now)
    );

    if (keys.length === 0) {
        // 전부 쿨다운 중이면 언제 풀리는지 알려준다
        const times = allKeys
            .filter(k => !window.apiKeyDisabled[k])
            .map(k => window.apiKeyCooldowns[k] || 0);
        const wait = times.length > 0 ? Math.max(0, Math.ceil((Math.min(...times) - now) / 1000)) : 60;
        const e = new Error("ALL_KEYS_COOLDOWN");
        e.userMessage = `지금은 AI 담당관이 많이 바쁩니다. 약 ${wait}초 후에 다시 시도해주세요.`;
        throw e;
    }

    const parts = [{ text: prompt }];
    if (inlineData) parts.push({ inlineData: inlineData });

    // Gemini 3 계열은 '사고 수준'을 낮추면 훨씬 빠르고 토큰도 적게 씁니다.
    // 혹시 모델이 이 항목을 지원하지 않으면 아래 400 처리에서 자동으로 빼고 다시 시도합니다.
    if (window.geminiFastThinkingLevel === undefined) window.geminiFastThinkingLevel = "MINIMAL";
    const defaultMaxTokens = fast ? 1024 : 4096;

    const buildBody = (useThinking, maxTokens) => {
        const gc = { maxOutputTokens: maxTokens || defaultMaxTokens };
        if (useThinking && /^gemini-3/.test(model)) {
            gc.thinkingConfig = { thinkingLevel: fast ? window.geminiFastThinkingLevel : "LOW" };
            if (fast) gc.temperature = 0.7;
        } else {
            gc.temperature = 0.7;
        }
        return { contents: [{ parts: parts }], generationConfig: gc };
    };
    if (window.geminiUseThinkingConfig === undefined) window.geminiUseThinkingConfig = true;
    let body = buildBody(window.geminiUseThinkingConfig);

    // ===== [2026-09-19 추가] 무한 대기 방지 장치 =====
    //  예전에는 fetch에 시간 제한이 없어서, 구글이 응답을 주지 않으면
    //  화면이 몇 분이고 그대로 멈춰 있었습니다.
    const perRequestMs = fast
        ? (window.AI_REQUEST_TIMEOUT_FAST_MS || 20000)
        : (window.AI_REQUEST_TIMEOUT_MS || 35000);
    const totalDeadline = Date.now() + (fast
        ? (window.AI_TOTAL_DEADLINE_FAST_MS || 45000)
        : (window.AI_TOTAL_DEADLINE_MS || 75000));
    const maxBusyTries = window.AI_MAX_503_TRIES || 4;
    let busyTries = 0;
    const timeLeft = () => totalDeadline - Date.now();

    const fetchWithTimeout = async (url, init, ms) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(3000, ms));
        try {
            return await fetch(url, Object.assign({}, init, { signal: controller.signal }));
        } finally {
            clearTimeout(timer);
        }
    };
    // ===============================================

    let lastError = null;
    let retriedLonger = false;   // 길이 제한으로 끊겼을 때 딱 한 번만 더 길게 요청

    outer:
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

        // 503(서버 혼잡)은 키를 바꿔도 소용없으므로 잠깐 쉬었다가 재시도
        for (let attempt = 0; attempt < 3; attempt++) {

            // [2026-09-19 추가] 전체 대기 시간을 넘기면 더 버티지 않고 포기한다
            if (timeLeft() <= 2000) {
                console.warn("[AI] 전체 대기 시간을 넘겨 요청을 중단합니다.");
                if (!lastError) lastError = new Error("TOTAL_TIMEOUT");
                lastError.userMessage = "AI 담당관의 응답이 너무 늦어 중단했습니다. 잠시 후 다시 시도해주세요.";
                break outer;
            }

            try {
                const response = await fetchWithTimeout(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }, Math.min(perRequestMs, timeLeft()));

                if (response.ok) {
                    const result = await response.json();

                    // 답변 조각(parts)을 전부 합쳐서 읽습니다.
                    const text = window.extractGeminiText(result);
                    const finishReason = result?.candidates?.[0]?.finishReason || "";

                    // (1) 길이 제한에 걸려 끊긴 경우 → 한도를 늘려 '이번 요청만' 한 번 더 보낸다
                    // [2026-09-19 보완] 예전에는 여기서 생각 수준 설정을 '접속 내내' 꺼버려서,
                    //   그 뒤의 모든 요청이 기본(더 높은) 생각 수준으로 가며 오히려 느려졌습니다.
                    //   이제는 설정은 그대로 두고, 이번 한 번만 길이 한도를 8192로 늘립니다.
                    if (finishReason === "MAX_TOKENS" && !retriedLonger) {
                        retriedLonger = true;
                        body = buildBody(window.geminiUseThinkingConfig, 8192);
                        console.warn("[AI] 답변이 길이 제한에 걸렸습니다. 이번 요청만 한도를 늘려 다시 요청합니다.");
                        attempt--;   // 이 재요청은 재시도 횟수로 세지 않는다
                        continue;
                    }

                    // (2) 안전 필터에 막힌 경우 → 재시도해도 소용없으므로 바로 안내
                    const blockReason = result?.promptFeedback?.blockReason || "";
                    if (!text && (blockReason || finishReason === "SAFETY")) {
                        const e = new Error("BLOCKED");
                        e.userMessage = "AI가 답변하기 어려운 표현이 있었어요. 문장을 조금 바꿔서 다시 시도해주세요.";
                        throw e;
                    }

                    // (3) 정상 응답
                    if (text) return text;

                    // (4) 빈 답변 → 같은 키로 한 번 더 시도
                    console.warn(`[AI] 빈 답변이 돌아왔습니다(finishReason=${finishReason || "없음"}). 다시 시도합니다.`);
                    lastError = new Error("EMPTY_RESPONSE");
                    lastError.userMessage = "AI가 답변을 만들지 못했습니다. 잠시 후 다시 시도해주세요.";
                    if (attempt < 2 && timeLeft() > 5000) { await sleep(800 * (attempt + 1)); continue; }
                    break;
                }

                // 오류 본문에서 구글이 준 설명을 꺼내둔다 (선생님 디버깅용)
                let detail = "";
                try {
                    const errBody = await response.json();
                    detail = errBody?.error?.message || "";
                } catch (_) {}

                if (response.status === 429) {
                    // 한도 초과 → 이 키는 60초 쉬게 하고 다음 키로
                    window.apiKeyCooldowns[key] = Date.now() + 60000;
                    console.warn(`[AI] ${i + 1}번 키 한도 초과(429). 60초간 사용을 멈추고 다음 키로 넘어갑니다.`);
                    lastError = new Error("RATE_LIMIT");
                    lastError.userMessage = "AI 담당관에게 요청이 몰리고 있습니다. 잠시 후 다시 시도해주세요.";
                    break; // 다음 키
                }

                if (response.status === 404) {
                    // 모델명 문제 → 키를 바꿔도 동일하므로 즉시 중단
                    console.error(`[AI] 모델(${model})을 찾을 수 없습니다. 교사용 설정에서 모델명을 확인해주세요.`, detail);
                    const e = new Error("MODEL_NOT_FOUND");
                    e.userMessage = "AI 설정에 문제가 있습니다. 선생님께 알려주세요.";
                    throw e;
                }

                if (response.status >= 500) {
                    // [2026-09-19 변경] 503은 '구글 쪽 모델 혼잡'입니다.
                    //   키를 바꿔도 결과가 같으므로, 키 개수와 상관없이 총 재시도 횟수를 제한합니다.
                    busyTries++;
                    console.warn(`[AI] 구글 서버 혼잡(${response.status}). 재시도 ${busyTries}/${maxBusyTries}.`, detail);
                    lastError = new Error(`SERVER_${response.status}`);
                    lastError.userMessage = "지금 AI 담당관에게 요청이 몰려 있습니다(서버 혼잡). 1~2분 뒤에 다시 시도해주세요.";
                    if (busyTries >= maxBusyTries) break outer;
                    const wait = Math.min(4000, 800 * Math.pow(2, attempt));
                    if (wait + 3000 >= timeLeft()) break outer;
                    await sleep(wait);
                    continue;
                }

                // 400인데 설정(generationConfig) 문제라면, 키 문제가 아니라 요청 형식 문제다.
                if (response.status === 400 &&
                    /thinking|generation_?config|generationConfig|Unknown name|Invalid value/i.test(detail)) {

                    // 빠른 모드의 생각 수준(MINIMAL)을 모르는 모델이면 LOW로 내린다.
                    if (fast && window.geminiUseThinkingConfig && window.geminiFastThinkingLevel === "MINIMAL") {
                        console.warn("[AI] 이 모델은 MINIMAL 생각 수준을 지원하지 않습니다. LOW로 내려 다시 시도합니다.");
                        window.geminiFastThinkingLevel = "LOW";
                        body = buildBody(window.geminiUseThinkingConfig);
                        attempt--;   // 이 재요청은 재시도 횟수로 세지 않는다
                        continue;
                    }

                    // 그래도 안 되면 사고 수준 설정 자체를 빼고 한 번 더 시도한다.
                    if (window.geminiUseThinkingConfig) {
                        console.warn("[AI] 이 모델은 사고 수준 설정을 지원하지 않습니다. 설정을 빼고 다시 시도합니다.");
                        window.geminiUseThinkingConfig = false;
                        body = buildBody(false);
                        attempt--;   // 이 재요청은 재시도 횟수로 세지 않는다
                        continue;
                    }
                }

                // 그 외 400 / 403 등 → 키 자체가 잘못됨. 이번 접속 동안 이 키는 제외
                window.apiKeyDisabled[key] = true;
                console.error(`[AI] ${i + 1}번 키를 사용할 수 없습니다(${response.status}). 목록에서 제외합니다.`, detail);
                lastError = new Error(`INVALID_KEY_${response.status}`);
                lastError.userMessage = "AI 설정에 문제가 있습니다. 선생님께 알려주세요.";
                break; // 다음 키

            } catch (err) {
                // BLOCKED / 모델명 오류는 재시도 없이 바로 밖으로 내보냅니다.
                if (err.message === "MODEL_NOT_FOUND" || err.message === "BLOCKED") throw err;

                // [2026-09-19 추가] 제한 시간 안에 응답이 오지 않아 끊은 경우
                if (err.name === 'AbortError') {
                    console.warn(`[AI] ${Math.round(perRequestMs / 1000)}초 안에 응답이 오지 않아 요청을 끊었습니다.`);
                    lastError = new Error("REQUEST_TIMEOUT");
                    lastError.userMessage = "AI 담당관의 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.";
                    break;   // 같은 키로 또 오래 기다리지 않고 다음 키로
                }

                // 네트워크 오류 등
                lastError = err;
                if (!err.userMessage) lastError.userMessage = "인터넷 연결을 확인하고 다시 시도해주세요.";
                if (attempt < 2 && timeLeft() > 5000) { await sleep(1000 * Math.pow(2, attempt)); continue; }
                break;
            }
        }
    }

    throw lastError || new Error("UNKNOWN_ERROR");
}

// 이미지 변환이 멈추는 것을 막기 위한 안전장치 (최대 10초)
window.safeGetBase64 = async function(file) {
    return await Promise.race([
        window.getBase64(file),
        new Promise((_, reject) => setTimeout(() => reject(new Error("IMAGE_TIMEOUT")), 10000))
    ]);
}

// 전체 화면 로딩창 제어 (제출 전용)
window.aiLoadingStatusTimer = null;

window.showAILoading = function() {
    const overlay = document.getElementById('aiLoadingOverlay');
    if (overlay) overlay.classList.add('active');
    window.startTipRotation('aiLoadingTipText', 10000);

    // 오래 걸리면 상황을 알려준다 (구글 서버가 붐빌 때가 많습니다)
    const status = document.getElementById('aiLoadingStatus');
    if (status) status.innerText = '';
    const startedAt = Date.now();
    if (window.aiLoadingStatusTimer) clearInterval(window.aiLoadingStatusTimer);
    window.aiLoadingStatusTimer = setInterval(() => {
        const el = document.getElementById('aiLoadingStatus');
        if (!el) return;
        const sec = Math.floor((Date.now() - startedAt) / 1000);
        // [2026-09-19 변경] 5초부터 경과 시간을 보여줍니다.
        if (sec >= 60) el.innerText = `${sec}초째 기다리는 중… AI 담당관에게 요청이 아주 많이 몰렸어요. 조금만 더 기다려주세요.`;
        else if (sec >= 30) el.innerText = `${sec}초째 기다리는 중… 차례를 기다리고 있어요.`;
        else if (sec >= 5) el.innerText = `${sec}초째 열심히 검토하는 중이에요…`;
    }, 1000);
}

window.hideAILoading = function() {
    const overlay = document.getElementById('aiLoadingOverlay');
    if (overlay) overlay.classList.remove('active');
    window.stopTipRotation('aiLoadingTipText');
    if (window.aiLoadingStatusTimer) { clearInterval(window.aiLoadingStatusTimer); window.aiLoadingStatusTimer = null; }
    const status = document.getElementById('aiLoadingStatus');
    if (status) status.innerText = '';
}

// ==========================================
// 1단계: AI 비서에게 힌트 얻기 (인라인 로딩)
// ==========================================
window.getAIAdvice = async function() {
    if (window.isAILoading) return;

    const textData = document.getElementById('textDataInput').value.trim();
    const photoFile = document.getElementById('photoInput').files[0];

    // 사진만 올려도 힌트를 받을 수 있게 한다
    if (!textData && !photoFile) {
        return window.showNotification("현장 사진을 올리거나, 조사한 내용을 적은 뒤에 눌러주세요!");
    }
    if (!photoFile && textData.length < 10) {
        return window.showNotification("조사한 내용을 조금 더 자세히 적어주세요! (사진만 올려도 괜찮아요)");
    }

    window.isAILoading = true;

    const adviceArea = document.getElementById('aiAdviceArea');
    adviceArea.style.display = 'block';
    adviceArea.innerHTML = window.buildWaitingBox('AI 비서가 자료를 살펴보고 있습니다...', 'adviceTipText');
    window.startTipRotation('adviceTipText', 10000);

    try {
        let inlineData = null;
        if (photoFile) {
            try {
                const imagePart = await window.safeGetBase64(photoFile);
                inlineData = imagePart.inlineData;
            } catch (e) {
                console.error("이미지 변환 실패", e);
                adviceArea.innerHTML = '<span style="color:#ef4444;">사진을 읽지 못했습니다. 다른 사진으로 바꾸거나, 글로만 적어서 다시 눌러주세요.</span>';
                return;
            }
        }

        const prompt = `너는 초등학교 4학년 학생의 지역 문제 탐색을 돕는 친절한 AI 비서야.
${photoFile ? "학생이 직접 찍은 현장 사진이 함께 첨부되어 있어. 사진 속 장면을 꼭 살펴보고 답해줘." : ""}
학생이 조사한 자료: "${textData || "(글 없이 사진만 올렸습니다)"}"

이 자료를 보고 학생이 '우리 지역의 문제'로 삼을 만한 핵심 주제를 1~2가지 짚어줘.
- 정답을 바로 알려주지 말고, 학생이 스스로 생각하도록 질문을 섞어줘.
- 초등학교 4학년이 이해할 수 있는 쉬운 말로, 3문장 이내로 다정하게 써줘.${window.buildLearningBlock()}`;

        const resText = await window.callGeminiAPI(prompt, inlineData, { fast: true });   // 가벼운 조언 → 빠른 모드
        // [2026-09-19 보완] AI 답변을 안전하게 화면에 넣는다 (<, > 등이 화면을 깨뜨리지 않도록)
        adviceArea.innerHTML = `<strong>💡 AI 비서의 힌트:</strong><br>${window.aiTextToHtml(resText)}`;

    } catch (e) {
        console.error("AI 힌트 오류:", e);
        const msg = e.userMessage || "잠시 후 다시 시도해주세요.";
        adviceArea.innerHTML = `<span style="color:#ef4444;">${msg}</span>`;
    } finally {
        window.stopTipRotation('adviceTipText');
        window.isAILoading = false;
    }
}

// ==========================================
// 1단계: 학급 공유 게시판에 문제 등록
// ==========================================
window.submitProblemToBoard = async function() {
    const title = document.getElementById('photoDesc').value.trim();
    const content = document.getElementById('textDataInput').value.trim();
    if (!title) return window.showNotification("우리가 해결해야 할 문제가 무엇인지 적어주세요!");

    const btn = document.getElementById('btn-submit-problem');
    if (btn) btn.disabled = true;

    try {
        let imageUrl = null;
        const photoFile = document.getElementById('photoInput').files[0];
        if (photoFile) {
            try {
                const imagePart = await window.safeGetBase64(photoFile);
                imageUrl = imagePart.dataUrl;
            } catch (e) {
                console.error("이미지 업로드 실패", e);
                window.showNotification("사진을 읽지 못해 글만 등록합니다.");
            }
        }

        // 내용을 자르지 않고 전부 저장한다 (화면에서만 줄여 보여줌)
        window.gameState.problems.unshift({
            id: Date.now(),
            title: title,
            content: content || "자료가 첨부되었습니다.",
            author: `${document.getElementById('numInput').value}번 시장님`,
            authorId: window.userKey,
            imageUrl: imageUrl,
            color: window.padletColors[Math.floor(Math.random() * window.padletColors.length)]
        });

        window.saveGameState();
        window.renderProblemBoard();

        document.getElementById('photoDesc').value = '';
        document.getElementById('textDataInput').value = '';
        document.getElementById('photoInput').value = '';
        document.getElementById('aiAdviceArea').style.display = 'none';

        window.showNotification("문제가 학급 게시판에 등록되었습니다!");
        window.switchInnerTab('inner-board', document.querySelectorAll('#stage1-1 .sub-tab-btn')[1]);

    } catch (e) {
        console.error("문제 등록 오류:", e);
        window.showNotification("등록 중 문제가 생겼습니다. 다시 시도해주세요.");
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ==========================================
// 1단계: 해결 제안서 제출 (AI 1차 검토 → 선생님 최종 심사)
//   AI가 '적합 / 보완필요'를 판정합니다.
//   - 적합    : 예상 예산 50~150G를 제안하고 선생님께 전달
//   - 보완필요 : 예산 0G. 제출하지 않고 학생에게 바로 고칠 기회를 줍니다.
//               (학생이 원하면 '그래도 제출할래요'로 선생님께 보낼 수 있습니다)
// ==========================================
window.submitProposal = async function() {
    if (window.isAILoading) return;

    if (!window.currentSelectedProblem) {
        return window.showNotification("먼저 학급 공유 게시판에서 해결할 문제를 선택해주세요!");
    }

    const text = document.getElementById('proposalText').value.trim();
    if (text.length < 20) return window.showNotification("제안서를 조금 더 자세히 작성해주세요.");

    window.clearAIReviseBox('proposalText');   // 지난번 보완 요청 안내 지우기

    window.isAILoading = true;
    window.showAILoading();

    try {
        // 키가 아직 도착하지 않았을 수 있으므로 잠시 기다린다
        if (window.getUsableApiKeys().length === 0) {
            const ready = window.ensureApiKeysReady ? await window.ensureApiKeysReady() : false;
            if (!ready) {
                window.showNotification("AI 담당관과 아직 연결되지 않았습니다. 잠시 후 다시 제출해주세요.");
                return;
            }
        }

        // ── 판정(적합/보완필요)을 요구하는 프롬프트 ──
        const prompt = `너는 초등학교 4학년 학생이 낸 '지역 문제 해결 제안서'를 1차로 검토하는 AI 담당관이야.
최종 심사는 선생님이 하시고, 너는 선생님께 전달할 1차 의견을 쓰는 역할이야.
무조건 칭찬만 하면 안 돼. 기준에 맞지 않으면 분명하게 '보완필요'로 판정해야 해.

해결하려는 문제: ${window.currentSelectedProblem}
학생의 제안 내용: ${text}

[평가 기준]
1) 관련성 - 위에 적힌 문제를 실제로 해결하는 내용인가
2) 실현 가능성 - 초등학생과 지역 주민이 실제로 해볼 수 있는가
3) 공공성 - 나 혼자가 아니라 여러 사람에게 도움이 되는가
4) 구체성 - 누가, 무엇을, 어떻게 하는지 알 수 있게 썼는가${window.buildLearningBlock()}

[반드시 '보완필요'로 판정해야 하는 경우]
- 위에 적힌 문제와 상관없는 내용이거나, 장난으로 쓴 글일 때
- 뜻을 알 수 없는 글자나 같은 말의 반복일 때
- "열심히 하자", "깨끗이 쓰자"처럼 방법 없이 다짐만 있을 때
- 초등학생이나 우리 지역에서 도저히 할 수 없는 방법일 때
  (예: 수백억 원 쓰기, 법을 새로 만들기, 사람을 가두거나 크게 벌주기, 24시간 감시하기)
- 특정한 사람을 탓하거나 미워하는 내용일 때

[출력 형식] 반드시 이대로 지켜줘.
첫 번째 줄에는 "판정|예산" 형식으로만 적어. 다른 말은 절대 쓰지 마.
 - 기준에 맞으면:      적합|(50부터 150 사이 정수. 구체적이고 공공성이 클수록 높게)
 - 기준에 맞지 않으면: 보완필요|0
두 번째 줄부터는 학생에게 전할 의견을 써줘.
 - '적합'일 때: 잘한 점을 먼저 칭찬하고, 더 좋아질 점 한 가지를 덧붙여줘.
 - '보완필요'일 때: 노력한 점을 짧게 인정한 뒤, 어떤 기준에 맞지 않았는지 알려주고,
   어떻게 고쳐 쓰면 좋을지 구체적인 방법을 두 가지 알려줘. 마지막에 다시 써보자고 응원해줘.
초등학교 4학년이 읽을 수 있는 쉬운 말로, 4문장 이내로 써줘.`;

        const resText = await window.callGeminiAPI(prompt);

        // ── AI의 판정과 예상 예산을 읽어낸다 ──
        const parsedHead = window.splitAIHead(resText);
        let aiVerdict = window.detectAIVerdict(parsedHead.head);
        let aiFeedback = parsedHead.body || resText.trim();

        const numMatch = String(parsedHead.head).match(/(\d+)/);
        const headNum = numMatch ? parseInt(numMatch[1], 10) : NaN;

        if (aiVerdict === null) {
            // AI가 형식을 지키지 않은 경우: 예전 방식대로 '적합'으로 보고, 전체를 의견으로 사용
            aiVerdict = 'ok';
            if (isNaN(headNum)) aiFeedback = resText.trim();
        }

        const aiBudget = (aiVerdict === 'ok')
            ? (isNaN(headNum) ? 100 : Math.min(150, Math.max(50, headNum)))
            : 0;   // 보완이 필요하면 예산을 제안하지 않는다

        // ── 보완 필요 → 제출하지 않고 바로 고칠 기회를 준다 ──
        if (aiVerdict === 'revise') {
            window.hideAILoading();
            window.showAIReviseBox('proposalText', aiFeedback);
            const goAnyway = await window.uiConfirm(
                aiFeedback + "\n\n─────────────\n고쳐서 다시 내면 더 좋은 평가를 받을 수 있어요.\n그래도 지금 그대로 내고 싶다면 오른쪽 버튼을 눌러주세요.",
                { title: '🤖 AI 담당관: 조금만 더 보완해봐요', okText: '그래도 제출할래요', cancelText: '고쳐서 다시 쓸게요' }
            );
            if (!goAnyway) {
                window.showNotification("AI 담당관의 의견을 참고해 제안서를 고쳐서 다시 제출해주세요.");
                return;   // 제출하지 않음 (기록·예산 변화 없음)
            }
        }

        const today = window.getTodayStr();
        const authorName = `${document.getElementById('numInput').value}번 시장님`;

        if (window.currentEditingProposalId) {
            // ── 반려된 제안서를 고쳐서 다시 제출하는 경우 ──
            const index = window.gameState.submittedProposals.findIndex(x => x.id === window.currentEditingProposalId);
            if (index !== -1) {
                const p = window.gameState.submittedProposals.splice(index, 1)[0];

                if (!Array.isArray(p.versions)) p.versions = [];

                // 예전 형식(이력 없는 데이터)이면 지금 내용을 1차로 먼저 기록
                if (p.versions.length === 0) {
                    p.versions.push({
                        round: 1,
                        proposal: p.proposal || '',
                        aiFeedback: p.aiFeedback || '',
                        aiBudget: p.aiBudget || 0,
                        aiVerdict: p.aiVerdict || '',
                        teacherFeedback: p.teacherFeedback || '',
                        teacherBudget: p.teacherBudget || 0,
                        status: p.status || 'rejected',
                        submittedAt: p.submittedAt || ''
                    });
                }

                const nextRound = p.versions[p.versions.length - 1].round + 1;
                p.versions.push({
                    round: nextRound,
                    proposal: text,
                    aiFeedback: aiFeedback,
                    aiBudget: aiBudget,
                    aiVerdict: aiVerdict,
                    teacherFeedback: '',
                    teacherBudget: 0,
                    status: 'waiting',
                    submittedAt: today
                });

                // 오래된 차수부터 정리 (최대 3차 보관)
                while (p.versions.length > window.MAX_PROPOSAL_VERSIONS) p.versions.shift();

                // 최신 내용을 최상위에 반영
                p.proposal = text;
                p.aiFeedback = aiFeedback;
                p.aiBudget = aiBudget;
                p.aiVerdict = aiVerdict;
                p.teacherFeedback = '';
                p.teacherBudget = 0;
                p.status = 'waiting';
                p.round = nextRound;
                p.submittedAt = today;
                p.budgetPaid = p.budgetPaid || false;

                window.gameState.submittedProposals.unshift(p);
                window.showNotification(`${nextRound}차 제안서를 제출했습니다! 선생님의 심사를 기다려주세요.`);
            }
            window.currentEditingProposalId = null;

        } else {
            // ── 처음 제출하는 경우 ──
            window.gameState.submittedProposals.unshift({
                id: Date.now(),
                author: authorName,
                authorId: window.userKey,
                problem: window.currentSelectedProblem,
                proposal: text,
                aiFeedback: aiFeedback,
                aiBudget: aiBudget,
                aiVerdict: aiVerdict,
                teacherFeedback: '',
                teacherBudget: 0,
                status: 'waiting',
                round: 1,
                submittedAt: today,
                budgetPaid: false,
                versions: [{
                    round: 1,
                    proposal: text,
                    aiFeedback: aiFeedback,
                    aiBudget: aiBudget,
                    aiVerdict: aiVerdict,
                    teacherFeedback: '',
                    teacherBudget: 0,
                    status: 'waiting',
                    submittedAt: today
                }]
            });
            window.showNotification("제안서를 제출했습니다! AI 담당관의 1차 검토를 거쳐 선생님께 전달되었어요.");
        }

        // ※ 예산은 여기서 지급하지 않습니다. 선생님이 승인하실 때 지급됩니다.
        window.saveGameState();
        window.updateUI(true);
        window.renderSharedProposals();

        document.getElementById('proposalText').value = '';
        window.clearAIReviseBox('proposalText');
        document.getElementById('selectedProblemDisplay').style.display = 'none';
        window.currentSelectedProblem = null;
        document.querySelectorAll('#problemBoard .board-item-selectable').forEach(el => el.classList.remove('selected'));

        window.switchInnerTab('inner-my-proposal', document.querySelectorAll('#stage1-1 .sub-tab-btn')[3]);
        window.renderMyProposals();

    } catch (e) {
        console.error("제안서 제출 오류:", e);
        window.showNotification(e.userMessage || "제출 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.");
    } finally {
        window.isAILoading = false;
        window.hideAILoading();
    }
}


// ==========================================
// 2단계: AI 홍보 담당관에게 조언 구하기 (인라인 로딩)
// ==========================================
window.getAIConsulting = async function() {
    if (window.isAILoading) return;

    const topic = document.getElementById('promoTopic').value.trim();
    const target = document.getElementById('promoTarget').value.trim();
    const slogan = document.getElementById('promoSlogan').value.trim();

    if (!topic || !target || !slogan) {
        return window.showNotification("홍보물, 홍보 대상, 슬로건을 모두 작성한 후 조언을 구해보세요.");
    }

    window.isAILoading = true;

    const resArea = document.getElementById('consultingResult');
    const resText = document.getElementById('consultingText');
    resArea.style.display = 'block';
    resText.innerHTML = window.buildWaitingBox('AI 담당관이 기획안을 살펴보고 있습니다...', 'consultingTipText');
    window.startTipRotation('consultingTipText', 10000);

    try {
        const prompt = `너는 초등학교 4학년 학생의 지역 홍보 기획을 돕는 친절한 마케팅 전문가 AI야.

홍보할 거리(홍보물): ${topic}
홍보 대상(누구에게): ${target}
핵심 슬로건: ${slogan}

이 기획에 대해 아래 세 가지를 순서대로 알려줘.
1) 잘한 점: 홍보물·홍보 대상·슬로건 중에서 특히 잘 생각한 점을 구체적으로 칭찬해줘.
2) 슬로건 다듬기: 지금 슬로건의 좋은 점을 짚어준 뒤, 홍보 대상의 눈에 더 잘 띄도록 고친 슬로건을 한 가지 제안해줘. 제안하는 슬로건은 따옴표로 감싸서 보여줘.
3) 매체 추천: 홍보 대상에게 잘 닿을 매체(포스터, 영상, 안내 방송, 학교 게시판 등)를 한 가지 추천하고 이유도 짧게 알려줘.
초등학교 4학년이 이해할 수 있는 쉬운 말로, 다정하게 4문장 이내로 써줘.${window.buildLearningBlock()}`;

        const answer = await window.callGeminiAPI(prompt, null, { fast: true });   // 가벼운 조언 → 빠른 모드
        // [2026-09-19 보완] AI 답변을 안전하게 화면에 넣는다
        resText.innerHTML = window.aiTextToHtml(answer);

    } catch (e) {
        console.error("AI 컨설팅 오류:", e);
        const msg = e.userMessage || "잠시 후 다시 시도해주세요.";
        resText.innerHTML = `<span style="color:#ef4444;">${msg}</span>`;
    } finally {
        window.stopTipRotation('consultingTipText');
        window.isAILoading = false;
    }
}

// ==========================================
// AI 답변 해석 도우미
// ==========================================

// [2026-09-19 보완] AI가 쓴 꾸밈 기호를 걷어낸다
//   **굵게** → 굵게 / "### 제목" → "제목" / "* 항목" → "• 항목"
//   여기서 한 번에 정리하므로 힌트·컨설팅·제안서·홍보 의견 모두에 적용됩니다.
window.cleanAIText = function(raw) {
    return String(raw || '')
        .replace(/\*\*(.+?)\*\*/g, '$1')      // **굵게** → 굵게
        .replace(/__(.+?)__/g, '$1')          // __굵게__ → 굵게
        .replace(/\*\*/g, '')                 // 짝이 안 맞고 남은 **
        .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')   // 줄 맨 앞의 # 제목 기호
        .replace(/^[ \t]*[*\-][ \t]+/gm, '• ')      // 줄 맨 앞의 * 또는 - 목록 기호
        .trim();
};

// [2026-09-19 보완] AI 답변을 화면에 안전하게 넣기 위한 변환 (<, > 등을 글자로 바꿈)
window.aiTextToHtml = function(raw) {
    return String(raw || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
};

// AI 답변 조각(parts)을 전부 합쳐서 글자만 꺼낸다.
// ※ '생각 과정(thought)' 조각은 제외합니다.
// ※ parts[0].text 하나만 읽으면 답변이 끊기거나 비어 보이는 문제가 생깁니다.
window.extractGeminiText = function(result) {
    const parts = result?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return "";
    const joined = parts
        .filter(p => p && p.thought !== true && typeof p.text === 'string')
        .map(p => p.text)
        .join('');
    return window.cleanAIText(joined);   // [2026-09-19 보완] 꾸밈 기호 정리
};

// 첫 줄에서 판정을 읽는다 → 'ok' / 'revise' / null(형식을 안 지킨 경우)
window.detectAIVerdict = function(headLine) {
    const s = String(headLine || '');
    if (/보완\s*필요|부적합|재작성|미흡|반려/.test(s)) return 'revise';
    if (/적합|통과|승인/.test(s)) return 'ok';
    return null;
};

// 첫 줄(판정·숫자)과 나머지 의견을 나눈다.
// AI가 "적합|90 아주 좋아요." 처럼 한 줄에 다 써도 문장이 사라지지 않게 합니다.
window.splitAIHead = function(rawText) {
    const lines = String(rawText || '').split('\n');
    let head = (lines[0] || '').trim();
    let body = lines.slice(1).join('\n').trim();

    const m = head.match(/^\s*(?:판정\s*[:：]?)?\s*(적합|보완\s*필요|부적합|통과|미흡)\s*[|,/:：\-]?\s*([0-9]+(?:\s*[,|/]\s*[0-9]+)?)?\s*(.*)$/);
    if (m) {
        head = `${m[1]} ${m[2] || ''}`.trim();
        const rest = (m[3] || '').trim();
        if (rest) body = body ? (rest + '\n' + body) : rest;
    }
    return { head, body };
};

// 입력칸 바로 아래에 '보완 요청' 안내 상자를 띄운다 (index.html 수정 없이 동적 생성)
window.showAIReviseBox = function(anchorElementId, feedbackText) {
    const anchor = document.getElementById(anchorElementId);
    if (!anchor) return;
    const boxId = anchorElementId + '-aiReviseBox';
    let box = document.getElementById(boxId);
    if (!box) {
        box = document.createElement('div');
        box.id = boxId;
        anchor.parentNode.insertBefore(box, anchor.nextSibling);
    }
    box.style.cssText = 'margin-top:12px; padding:14px; border-radius:10px; background:#fffbeb;' +
        'border:1px solid #fde68a; color:#92400e; font-size:14px; line-height:1.7;';
    box.innerHTML = `<strong>🤖 AI 담당관의 보완 요청</strong><br>${window.textToHtml(feedbackText)}`;
};

window.clearAIReviseBox = function(anchorElementId) {
    const box = document.getElementById(anchorElementId + '-aiReviseBox');
    if (box) box.remove();
};