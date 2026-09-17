// api.js - 구글 Gemini AI 통신 및 데이터 제출 로직 전담
// [개편] 1) AI 예산 즉시 지급 → 선생님 승인 시 지급
//        2) 제안서 버전 이력(최대 3차) 저장
//        3) 429 쿨다운 / 503 지수 백오프 / 잘못된 키 자동 제외
//        4) AI 비서 힌트에 사진 자료 다시 반영

window.isAILoading = false;

// 제안서 이력 보관 최대 차수
window.MAX_PROPOSAL_VERSIONS = 3;

// 키 상태 관리 (429 쿨다운 / 사용 불가 키)
window.apiKeyCooldowns = {};   // { 키: 쿨다운 해제 시각(ms) }
window.apiKeyDisabled = {};    // { 키: true }

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
// 공통: Gemini API 호출
// ==========================================
window.getUsableApiKeys = function() {
    const all = (window.dynamicApiKeys && window.dynamicApiKeys.length > 0)
        ? window.dynamicApiKeys
        : (window.dynamicApiKey ? [window.dynamicApiKey] : []);
    return all.map(k => String(k).trim()).filter(k => k.length > 0);
}

window.callGeminiAPI = async function(prompt, inlineData = null) {
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

    const model = window.dynamicApiModel || "gemini-3.8-flash";
    const parts = [{ text: prompt }];
    if (inlineData) parts.push({ inlineData: inlineData });
    const body = { contents: [{ parts: parts }], generationConfig: { temperature: 0.7 } };

    let lastError = null;

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

        // 503(서버 혼잡)은 키를 바꿔도 소용없으므로 같은 키로 1초 → 2초 → 4초 재시도
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (response.ok) {
                    const result = await response.json();
                    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!text) {
                        lastError = new Error("EMPTY_RESPONSE");
                        lastError.userMessage = "AI가 답변을 만들지 못했습니다. 내용을 조금 바꿔서 다시 시도해주세요.";
                        break;
                    }
                    return text;
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
                    console.warn(`[AI] 구글 서버 혼잡(${response.status}). ${attempt + 1}번째 재시도 준비.`);
                    lastError = new Error(`SERVER_${response.status}`);
                    lastError.userMessage = "AI 담당관이 잠시 쉬고 있습니다. 잠시 후 다시 시도해주세요.";
                    if (attempt < 2) { await sleep(1000 * Math.pow(2, attempt)); continue; }
                    break; // 다음 키
                }

                // 400 / 403 등 → 키 자체가 잘못됨. 이번 접속 동안 이 키는 제외
                window.apiKeyDisabled[key] = true;
                console.error(`[AI] ${i + 1}번 키를 사용할 수 없습니다(${response.status}). 목록에서 제외합니다.`, detail);
                lastError = new Error(`INVALID_KEY_${response.status}`);
                lastError.userMessage = "AI 설정에 문제가 있습니다. 선생님께 알려주세요.";
                break; // 다음 키

            } catch (err) {
                if (err.message === "MODEL_NOT_FOUND") throw err;
                // 네트워크 오류 등
                lastError = err;
                if (!err.userMessage) lastError.userMessage = "인터넷 연결을 확인하고 다시 시도해주세요.";
                if (attempt < 2) { await sleep(1000 * Math.pow(2, attempt)); continue; }
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
window.showAILoading = function() {
    const overlay = document.getElementById('aiLoadingOverlay');
    const tipText = document.getElementById('aiLoadingTipText');
    if (tipText) tipText.innerText = window.aiLoadingTips[Math.floor(Math.random() * window.aiLoadingTips.length)];
    if (overlay) overlay.classList.add('active');
}
window.hideAILoading = function() {
    const overlay = document.getElementById('aiLoadingOverlay');
    if (overlay) overlay.classList.remove('active');
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
    adviceArea.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 비서가 자료를 살펴보고 있습니다...';

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
- 초등학교 4학년이 이해할 수 있는 쉬운 말로, 3문장 이내로 다정하게 써줘.`;

        const resText = await window.callGeminiAPI(prompt, inlineData);
        adviceArea.innerHTML = `<strong>💡 AI 비서의 힌트:</strong><br>${resText.replace(/\n/g, '<br>')}`;

    } catch (e) {
        console.error("AI 힌트 오류:", e);
        const msg = e.userMessage || "잠시 후 다시 시도해주세요.";
        adviceArea.innerHTML = `<span style="color:#ef4444;">${msg}</span>`;
    } finally {
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
// ==========================================
window.submitProposal = async function() {
    if (window.isAILoading) return;

    if (!window.currentSelectedProblem) {
        return window.showNotification("먼저 학급 공유 게시판에서 해결할 문제를 선택해주세요!");
    }

    const text = document.getElementById('proposalText').value.trim();
    if (text.length < 20) return window.showNotification("제안서를 조금 더 자세히 작성해주세요.");

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

        const prompt = `너는 초등학교 4학년 학생의 지역 문제 해결 제안서를 1차로 검토하는 따뜻하고 긍정적인 AI 비서야.
최종 심사는 선생님이 하시고, 너는 선생님께 전달할 1차 의견을 쓰는 역할이야.

해결하려는 문제: ${window.currentSelectedProblem}
학생의 제안 내용: ${text}

검토 기준: 1) 실현 가능성 - 초등학생 수준에서 실제로 해볼 수 있는가
          2) 공공성 - 나 혼자가 아니라 여러 사람에게 도움이 되는가

첫 번째 줄에는 다른 말 없이 50부터 150 사이의 정수 하나만 적어줘. (제안의 구체성과 공공성을 고려한 예상 예산)
두 번째 줄부터는 학생에게 전할 의견을 써줘. 칭찬을 먼저 하고, 더 좋아질 수 있는 점을 한 가지 덧붙여줘.
초등학교 4학년이 읽을 수 있는 쉬운 말로 3문장 이내로 써줘.`;

        const resText = await window.callGeminiAPI(prompt);

        // AI 응답에서 예상 예산과 의견을 분리 (숫자는 반드시 50~150으로 제한)
        const lines = resText.split('\n');
        let aiBudget = 100;
        let aiFeedback = resText.trim();

        const firstLineNum = parseInt(String(lines[0]).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(firstLineNum)) {
            aiBudget = Math.min(150, Math.max(50, firstLineNum));
            const rest = lines.slice(1).join('\n').trim();
            if (rest) aiFeedback = rest;
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
    resText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 담당관이 기획안을 살펴보고 있습니다...';

    try {
        const prompt = `너는 초등학교 4학년 학생의 지역 홍보 기획을 돕는 친절한 마케팅 전문가 AI야.

홍보할 거리(홍보물): ${topic}
홍보 대상(누구에게): ${target}
핵심 슬로건: ${slogan}

이 기획에서 잘한 점을 먼저 구체적으로 칭찬해줘.
그다음 타겟에게 잘 닿으려면 어떤 매체(포스터, 영상, 안내 방송, 학교 게시판 등)를 쓰면 좋을지 한 가지 추천하고 이유도 짧게 알려줘.
초등학교 4학년이 이해할 수 있는 쉬운 말로 3문장 이내로 다정하게 써줘.`;

        const answer = await window.callGeminiAPI(prompt);
        resText.innerHTML = answer.replace(/\n/g, '<br>');

    } catch (e) {
        console.error("AI 컨설팅 오류:", e);
        const msg = e.userMessage || "잠시 후 다시 시도해주세요.";
        resText.innerHTML = `<span style="color:#ef4444;">${msg}</span>`;
    } finally {
        window.isAILoading = false;
    }
}