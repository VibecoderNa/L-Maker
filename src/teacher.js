// teacher.js - 교사용 대시보드 (학급 설정 / 학생 모니터링 / 심사)
// [개편] 1) 예산은 선생님 승인 시점에 지급 (AI 제안치를 기본값으로 제시)
//        2) 제안서 1~3차 이력을 차수 탭으로 확인
//        3) 피드백 입력 중에는 화면이 다시 그려지지 않도록 보호
//        4) 예산 지급을 increment 방식으로 변경 (동시 저장 시 유실 방지)

import { db } from './firebase.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 학교 위치 검색 및 설정
// ==========================================
window.searchSchool = async function() {
    const query = document.getElementById('schoolSearchInput').value.trim();
    if (!query) return alert("검색할 학교 또는 장소 이름을 입력해주세요.");

    const resContainer = document.getElementById('schoolSearchResults');
    resContainer.style.display = 'block';
    resContainer.innerHTML = '<div style="padding:15px; text-align:center; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> 위치 정보를 검색 중입니다...</div>';

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=kr&limit=8`);
        const data = await response.json();

        if (data.length === 0) {
            resContainer.innerHTML = '<div style="padding:15px; text-align:center; color:#ef4444;">검색 결과가 없습니다. 학교 이름을 조금 더 정확히 입력해보세요.</div>';
            return;
        }

        let html = '';
        data.forEach(item => {
            const name = (item.name || query).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const address = item.display_name;
            html += `
            <div class="search-result-item" onclick="window.selectSchool(${item.lat}, ${item.lon}, '${name}')">
                <div class="search-result-name"><i class="fa-solid fa-location-dot" style="color:var(--primary);"></i> ${item.name || query}</div>
                <div class="search-result-address">${address}</div>
            </div>`;
        });
        resContainer.innerHTML = html;
    } catch (e) {
        resContainer.innerHTML = '<div style="padding:15px; text-align:center; color:#ef4444;">검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</div>';
    }
}

window.selectSchool = async function(lat, lng, name) {
    if (!confirm(`'${name}'을(를) 우리 학교(지도 중심)로 설정하시겠습니까?`)) return;

    document.getElementById('schoolSearchResults').style.display = 'none';
    document.getElementById('schoolSearchInput').value = name;

    window.gameState.mapCenter = { lat: parseFloat(lat), lng: parseFloat(lng) };

    if (window.classKey && window.classKey !== 'teacher_temp_global') {
        await setDoc(doc(db, "classes", window.classKey), { mapCenter: window.gameState.mapCenter }, { merge: true });
    }
    window.showNotification(`✅ 우리 학교 지도가 '${name}'(으)로 성공적으로 설정되었습니다!`);
}

// ==========================================
// 학급 개설
// ==========================================
window.generateClassCode = async function() {
    const regionSelect = document.getElementById('teacherRegionSelect');
    const regionVal = regionSelect.value;
    const regionName = regionSelect.options[regionSelect.selectedIndex].text;

    if (!regionVal) return alert("학급을 개설할 지역을 먼저 선택해주세요.");

    const randomNum = Math.floor(1000 + Math.random() * 9000).toString();
    const code = `${regionVal}_${randomNum}`;

    const offices = window.eduOffices || {};
    const defaultCenter = offices[regionVal] || { lat: 37.5662, lng: 126.9666 };

    await setDoc(doc(db, "classes", code), {
        apiKeys: [],
        apiModel: window.dynamicApiModel || window.DEFAULT_AI_MODEL,
        problems: [],
        submittedProposals: [],
        promoBoard: [],
        marketingCampaigns: [],
        mapMarkers: [],
        mapCenter: defaultCenter
    });

    const display = document.getElementById('generatedCodeDisplay');
    display.style.display = 'block';
    document.getElementById('displayFinalCode').innerText = `${regionName} ${randomNum}`;

    window.showNotification("새로운 학급 코드가 성공적으로 개설되었습니다!");
}

// ==========================================
// 학생 모니터링 (그리드)
// ==========================================
window.renderTeacherAnalysis = function() {
    const el = document.getElementById('teacherOverallStats');
    if (el) el.innerHTML = '';
}

window.renderStudentMonitor = function() {
    const grid = document.getElementById('teacherStudentGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const studentKeys = Object.keys(window.allStudentsData).sort((a, b) => {
        const na = parseInt(a, 10); const nb = parseInt(b, 10);
        if (isNaN(na) && isNaN(nb)) return a.localeCompare(b);
        if (isNaN(na)) return 1;
        if (isNaN(nb)) return -1;
        return na - nb;
    });

    if (studentKeys.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:30px;">아직 접속한 학생이 없습니다.</div>`;
        return;
    }

    studentKeys.forEach(sNum => {
        const sData = window.allStudentsData[sNum];
        const sat = sData.satisfaction || 0;
        // 접속 여부는 presence 컬렉션 기준 (10분 이상 신호가 없으면 오프라인)
        const pres = (window.presenceData && window.presenceData[sNum]) || {};
        const isOnline = pres.isOnline === true && (Date.now() - (pres.lastSeen || 0)) < 10 * 60 * 1000;
        let cLevel = window.districtLevels[0].name;
        for (let lvl of window.districtLevels) { if (sat >= lvl.threshold) cLevel = lvl.name; }

        const waitingCount1 = window.gameState.submittedProposals.filter(p =>
            (String(p.authorId) === String(sNum) || (p.author && p.author.startsWith(sNum + '번'))) && p.status === 'waiting'
        ).length;
        const waitingCount2 = (window.gameState.marketingCampaigns || []).filter(c =>
            (String(c.authorKey) === String(sNum) || (c.author && c.author.startsWith(sNum + '번'))) && c.status === 'waiting'
        ).length;
        const totalWaiting = waitingCount1 + waitingCount2;

        const waitingBadge = totalWaiting > 0
            ? `<div style="position:absolute; top:10px; left:10px; background:#ef4444; color:white; font-size:11px; font-weight:bold; padding:4px 8px; border-radius:12px; box-shadow:0 2px 5px rgba(0,0,0,0.2); animation: pulse 2s infinite; z-index:10;">심사 대기 ${totalWaiting}건</div>`
            : '';

        const displayNum = String(sNum).startsWith('judge_') ? '심사용' : `${sNum}번`;

        grid.innerHTML += `<div class="student-card ${isOnline ? 'online' : 'offline'}" style="position:relative;" onclick="window.showStudentDetails('${sNum}', true)">
            ${waitingBadge}
            <div class="status-dot" title="${isOnline ? '현재 접속 중' : '오프라인'}"></div>
            <div class="st-num">${displayNum} 학생</div><div class="st-level">${cLevel}</div>
            <div class="st-stats"><div>👥<span>${sData.visitorCount || 0}</span></div><div>⭐<span>${sData.reputation || 0}</span></div><div>❤️<span>${sat}</span></div></div>
        </div>`;
    });
    window.renderTeacherAnalysis();
}

// ==========================================
// 캐러셀 (제안서 / 캠페인 간 이동)
// ==========================================
window.currentSlideIndex = { proposal: 0, campaign: 0 };

window.changeSlide = function(type, direction) {
    const slides = document.querySelectorAll(`.slide-${type}`);
    if (slides.length === 0) return;

    slides[window.currentSlideIndex[type]].classList.remove('active');
    window.currentSlideIndex[type] += direction;

    if (window.currentSlideIndex[type] < 0) window.currentSlideIndex[type] = slides.length - 1;
    if (window.currentSlideIndex[type] >= slides.length) window.currentSlideIndex[type] = 0;

    slides[window.currentSlideIndex[type]].classList.add('active');
    const counter = document.getElementById(`counter-${type}`);
    if (counter) counter.innerText = `${window.currentSlideIndex[type] + 1} / ${slides.length}`;
}

// 제안서 안에서 1차 / 2차 / 3차 전환 (캐러셀과 별개로 동작)
window.showProposalVersion = function(proposalId, round, btnEl) {
    document.querySelectorAll(`.ver-panel-${proposalId}`).forEach(el => el.style.display = 'none');
    const panel = document.getElementById(`ver-panel-${proposalId}-${round}`);
    if (panel) panel.style.display = 'block';

    document.querySelectorAll(`.ver-tab-${proposalId}`).forEach(el => {
        el.style.background = '#ffffff';
        el.style.color = 'var(--text-muted)';
        el.style.borderColor = 'var(--border-color)';
    });
    if (btnEl) {
        btnEl.style.background = 'var(--primary)';
        btnEl.style.color = '#ffffff';
        btnEl.style.borderColor = 'var(--primary)';
    }
}

// 홍보 전략 안에서 1차 / 2차 / 3차 전환
window.showCampaignVersion = function(campaignId, round, btnEl) {
    document.querySelectorAll(`.cver-panel-${campaignId}`).forEach(el => el.style.display = 'none');
    const panel = document.getElementById(`cver-panel-${campaignId}-${round}`);
    if (panel) panel.style.display = 'block';

    document.querySelectorAll(`.cver-tab-${campaignId}`).forEach(el => {
        el.style.background = '#ffffff';
        el.style.color = 'var(--text-muted)';
        el.style.borderColor = 'var(--border-color)';
    });
    if (btnEl) {
        btnEl.style.background = 'var(--primary)';
        btnEl.style.color = '#ffffff';
        btnEl.style.borderColor = 'var(--primary)';
    }
}

// ==========================================
// 학생 상세 보기
// ==========================================
// force=false 로 호출되면(실시간 갱신) 선생님이 입력 중일 때는 다시 그리지 않는다
window.showStudentDetails = function(sNum, force = false) {
    const detailView = document.getElementById('monitorDetailView');

    if (!force) {
        const active = document.activeElement;
        const isTyping = active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') && detailView.contains(active);
        if (isTyping) return; // 피드백 작성 중 → 화면 유지
    }

    document.getElementById('monitorGridView').style.display = 'none';
    detailView.style.display = 'block';

    const sData = window.allStudentsData[sNum] || {};
    const sat = sData.satisfaction || 0;
    let cLevel = window.districtLevels[0].name;
    for (let lvl of window.districtLevels) { if (sat >= lvl.threshold) cLevel = lvl.name; }

    document.getElementById('dtNum').innerText = sNum;
    document.getElementById('dtLevel').innerText = cLevel;
    document.getElementById('dtVis').innerText = sData.visitorCount || 0;
    document.getElementById('dtRep').innerText = sData.reputation || 0;
    document.getElementById('dtSat').innerText = sat;

    // ────────────────────────────────
    // 1. 문제 해결 제안서
    // ────────────────────────────────
    const proposals = window.gameState.submittedProposals.filter(p =>
        String(p.authorId) === String(sNum) || (p.author && p.author.startsWith(sNum + '번'))
    );

    const prevProposalIndex = window.currentSlideIndex.proposal;
    window.currentSlideIndex.proposal = (prevProposalIndex < proposals.length) ? prevProposalIndex : 0;
    const activeProposal = window.currentSlideIndex.proposal;

    let phtml = '<div class="carousel-wrapper"><div class="carousel-content" style="flex-direction: column;">';

    if (proposals.length === 0) {
        phtml += '<div style="color:var(--text-muted); padding: 30px;">제출한 문제 해결 방안이 없습니다.</div>';
    } else {
        proposals.forEach((p, index) => {
            const statusBadge = p.status === 'waiting'
                ? '<span style="color:#d97706;">⏳ 심사 대기중</span>'
                : (p.status === 'approved' ? '<span style="color:#16a34a;">✅ 최종 승인됨</span>' : '<span style="color:#ef4444;">❌ 재검토 요청됨</span>');

            // 이력이 없는 옛 데이터도 1차로 취급
            const versions = (Array.isArray(p.versions) && p.versions.length > 0) ? p.versions : [{
                round: 1,
                proposal: p.proposal || '',
                aiFeedback: p.aiFeedback || '',
                aiBudget: p.aiBudget || 0,
                aiVerdict: p.aiVerdict || '',        // [추가]
                teacherFeedback: p.teacherFeedback || '',
                teacherBudget: p.teacherBudget || 0,
                status: p.status || 'waiting',
                submittedAt: p.submittedAt || ''
            }];
            const latestRound = versions[versions.length - 1].round;

            // 차수 탭 (2차 이상 제출한 경우에만 표시)
            let verTabs = '';
            if (versions.length > 1) {
                verTabs = `<div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap; align-items:center;">
                    <span style="font-size:12px; color:var(--text-muted); font-weight:bold; margin-right:4px;">📚 발전 과정</span>`;
                versions.forEach(v => {
                    const isLatest = v.round === latestRound;
                    verTabs += `<button class="ver-tab-${p.id}" onclick="window.showProposalVersion(${p.id}, ${v.round}, this)"
                        style="padding:5px 12px; font-size:12px; font-weight:bold; border-radius:6px; cursor:pointer;
                        border:1px solid ${isLatest ? 'var(--primary)' : 'var(--border-color)'};
                        background:${isLatest ? 'var(--primary)' : '#ffffff'};
                        color:${isLatest ? '#ffffff' : 'var(--text-muted)'};">${v.round}차${isLatest ? ' (최신)' : ''}</button>`;
                });
                verTabs += `</div>`;
            }

            // 각 차수 본문
            let verPanels = '';
            versions.forEach(v => {
                const isLatest = v.round === latestRound;
                const vStatusText = v.status === 'approved' ? '✅ 승인됨' : (v.status === 'rejected' ? '❌ 재검토 요청됨' : '⏳ 심사 대기중');

                // [2026-09-19 추가] AI 판정 배지
                //   옛 데이터에는 aiVerdict가 없으므로, 예산이 매겨져 있으면 '기준 충족'으로 봅니다.
                const vVerdict = v.aiVerdict || ((v.aiBudget || 0) > 0 ? 'ok' : '');
                const vBadge = vVerdict === 'revise'
                    ? '<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:20px; font-size:12px; font-weight:bold; margin-left:6px;">⚠️ 보완 필요</span>'
                    : (vVerdict === 'ok' ? '<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:20px; font-size:12px; font-weight:bold; margin-left:6px;">✅ 기준 충족</span>' : '');

                verPanels += `
                <div id="ver-panel-${p.id}-${v.round}" class="ver-panel-${p.id}" style="display:${isLatest ? 'block' : 'none'};">
                    ${versions.length > 1 ? `<div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${v.round}차 제출 ${v.submittedAt ? '(' + v.submittedAt + ')' : ''} · ${vStatusText}</div>` : ''}
                    <div style="font-size:14px; line-height:1.6; color:var(--text-main); margin-bottom:15px; background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">${(v.proposal || '').replace(/\n/g, '<br>')}</div>
                    <div style="font-size:13px; background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:6px; border:1px solid rgba(2, 132, 199, 0.2);">
                        <strong>🤖 AI 1차 의견:</strong>${vBadge}<br>${(v.aiFeedback || '(AI 의견이 없습니다)').replace(/\n/g, '<br>')}
                        <div style="margin-top:6px;"><strong style="color:var(--primary);">AI 제안 예산: ${v.aiBudget || 0}G</strong></div>
                    </div>
                    ${v.teacherFeedback ? `<div style="font-size:13px; margin-top:10px; background:rgba(22, 163, 74, 0.1); padding:10px; border-radius:6px; border:1px solid rgba(22, 163, 74, 0.3);"><strong>👨‍🏫 선생님 피드백:</strong> ${v.teacherFeedback}<br><span style="color:var(--accent); font-weight:bold;">(확정 예산: ${v.teacherBudget || 0}G)</span></div>` : ''}
                </div>`;
            });

            // 심사 입력란 (대기중일 때만)
            let reviewUi = '';
            if (p.status === 'waiting') {
                // [2026-09-19 변경] AI가 '보완 필요'로 본 제안서는 확정 예산 기본값을 0G로 둡니다.
                const needRevise = (p.aiVerdict === 'revise');
                const suggested = needRevise ? 0 : (p.aiBudget || 100);
                const warnBox = needRevise
                    ? `<div style="background:#fef3c7; border:1px solid #fde68a; color:#92400e; padding:10px; border-radius:6px; font-size:13px; font-weight:bold; margin-bottom:10px; line-height:1.6;">
                           ⚠️ AI 담당관은 이 제안서를 <u>보완 필요</u>로 판정했습니다. (학생이 안내를 보고도 제출을 선택함)<br>
                           내용을 확인하신 뒤 <strong>재검토</strong>로 돌려보내거나, 필요하면 예산을 직접 정해 승인해주세요.
                       </div>`
                    : '';
                reviewUi = `
                    <div style="margin-top:15px; border-top:2px dashed var(--border-color); padding-top:15px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                        <strong style="color:var(--primary); font-size:14px; display:block; margin-bottom:5px;">👨‍🏫 선생님 최종 심사</strong>
                        ${warnBox}
                        <div style="font-size:13px; color:var(--text-muted); margin-bottom:10px;">AI 담당관이 제안한 예산은 <strong style="color:var(--primary);">${suggested}G</strong>입니다. 선생님께서 조정하여 최종 확정해주세요. 승인하시면 학생에게 예산이 지급되고, AI 의견과 선생님 피드백이 함께 공개됩니다.</div>
                        <textarea id="t-feedback-${p.id}" rows="2" placeholder="예: 훌륭한 아이디어네요! 추가 예산을 지원합니다." style="width:100%; margin:8px 0; padding:8px; border:1px solid var(--border-color); border-radius:6px; box-sizing:border-box; font-family:inherit;"></textarea>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="number" id="t-budget-${p.id}" placeholder="확정 예산" value="${suggested}" style="width:140px; padding:8px; border:1px solid var(--border-color); border-radius:6px;"> <span style="font-weight:bold; color:var(--accent);">G</span>
                            <button onclick="window.submitTeacherReview(${p.id}, true, '${sNum}')" style="margin-left:auto; background:var(--success); color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">승인하기</button>
                            <button onclick="window.submitTeacherReview(${p.id}, false, '${sNum}')" style="background:#ef4444; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">재검토</button>
                        </div>
                    </div>`;
            }

            phtml += `
            <div class="carousel-slide slide-proposal ${index === activeProposal ? 'active' : ''}">
                <div style="background:#f1f5f9; padding:20px; border-radius:12px; border: 1px solid ${p.status === 'waiting' ? 'var(--accent)' : 'var(--border-color)'};">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
                        <div style="font-weight:bold; color:var(--primary); font-size:16px;">주제: ${p.problem || "미지정"}</div>
                        <div style="font-size:13px; font-weight:bold;">${statusBadge}</div>
                    </div>
                    ${verTabs}
                    ${verPanels}
                    ${reviewUi}
                </div>
            </div>`;
        });
    }
    phtml += '</div>';
    if (proposals.length > 1) {
        phtml += `<div class="carousel-controls">
            <button class="slide-btn" onclick="window.changeSlide('proposal', -1)">◀ 이전</button>
            <span class="slide-counter" id="counter-proposal">${activeProposal + 1} / ${proposals.length}</span>
            <button class="slide-btn" onclick="window.changeSlide('proposal', 1)">다음 ▶</button>
        </div>`;
    }
    phtml += '</div>';
    document.getElementById('dtProposals').innerHTML = phtml;

    // ────────────────────────────────
    // 2. 지역 마케팅 전략
    // ────────────────────────────────
    const campaigns = (window.gameState.marketingCampaigns || []).filter(c =>
        String(c.authorKey) === String(sNum) || (c.author && c.author.startsWith(sNum + '번'))
    );

    const prevCampaignIndex = window.currentSlideIndex.campaign;
    window.currentSlideIndex.campaign = (prevCampaignIndex < campaigns.length) ? prevCampaignIndex : 0;
    const activeCampaign = window.currentSlideIndex.campaign;

    let chtml = '<div class="carousel-wrapper"><div class="carousel-content" style="flex-direction: column;">';
    if (campaigns.length === 0) {
        chtml += '<div style="color:var(--text-muted); padding: 30px;">제출한 마케팅 전략이 없습니다.</div>';
    } else {
        campaigns.forEach((c, index) => {
            const statusBadge = c.status === 'waiting'
                ? '<span style="color:#d97706;">⏳ 승인 대기중</span>'
                : (c.status === 'approved' ? '<span style="color:#16a34a;">✅ 승인 완료</span>' : '<span style="color:#ef4444;">❌ 재검토 요청됨</span>');

            let reviewUi = '';
            if (c.status === 'waiting') {
                reviewUi = `
                    <div style="margin-top:15px; border-top:2px dashed var(--border-color); padding-top:15px;">
                        <strong style="color:var(--primary); font-size:14px; display:block; margin-bottom:5px;">👨‍🏫 마케팅 전략 승인 (최종 성과 산정)</strong>
                        ${(c.aiVerdict === 'revise') ? `<div style="background:#fef3c7; border:1px solid #fde68a; color:#92400e; padding:10px; border-radius:6px; font-size:13px; font-weight:bold; margin-bottom:10px; line-height:1.6;">⚠️ AI 담당관은 이 기획안을 <u>보완 필요</u>로 판정했습니다. (학생이 안내를 보고도 제출을 선택함)<br>내용을 확인하신 뒤 <strong>재검토</strong>로 돌려보내거나, 필요하면 성과를 직접 정해 승인해주세요.</div>` : ''}
                        <div style="font-size:13px; color:var(--text-muted); margin-bottom:10px;">🤖 AI 담당관이 기획안을 검토하고 제안한 예상 성과입니다. 선생님께서 조정하여 최종 확정해주세요. 승인하시면 학생에게 성과가 지급되고, AI 의견과 선생님 코멘트가 함께 공개됩니다.</div>
                        <div style="font-size:13px; background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:10px; border-radius:6px; margin-bottom:10px; line-height:1.6;">💰 이 기획안에는 광고비 <strong>${c.cost || 0}G</strong>가 이미 사용되었습니다. <strong>재검토</strong>로 돌려보내시면 광고비가 학생 예산으로 <strong>자동 환급</strong>되고, <strong>승인</strong>하시면 그대로 집행됩니다.</div>
                        <div style="display:flex; gap:10px; align-items:center; margin-bottom: 10px; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid var(--border-color);">
                            <div><strong>👥 방문객:</strong> <input type="number" id="c-vis-${c.id}" value="${c.expectedVisitor || 0}" style="width:70px; padding:5px; border-radius:4px; border:1px solid #cbd5e1;"> 명</div>
                            <div><strong>⭐ 평판:</strong> <input type="number" id="c-rep-${c.id}" value="${c.expectedReputation || 0}" style="width:70px; padding:5px; border-radius:4px; border:1px solid #cbd5e1;"> 점</div>
                        </div>
                        <textarea id="c-feedback-${c.id}" rows="2" placeholder="예: 멋진 전략이네요! 제안한 매체에 맞는 추가 성과를 보너스로 부여합니다." style="width:100%; margin:8px 0; padding:8px; border:1px solid var(--border-color); border-radius:6px; box-sizing:border-box; font-family:inherit;"></textarea>
                        <div style="display:flex; justify-content: flex-end; gap:10px;">
                            <button onclick="window.submitCampaignReview(${c.id}, true, '${sNum}')" style="background:var(--success); color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">승인 및 성과 지급</button>
                            <button onclick="window.submitCampaignReview(${c.id}, false, '${sNum}')" style="background:#ef4444; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">재검토</button>
                        </div>
                    </div>`;
            }

            const imageHtml = c.imageUrl ? `<img src="${c.imageUrl}" style="width: 100%; max-height: 250px; object-fit: contain; background: #e2e8f0; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--border-color);">` : '';

            // 이력이 없는 옛 데이터도 1차로 취급
            const cVersions = (Array.isArray(c.versions) && c.versions.length > 0) ? c.versions : [{
                round: 1, topic: c.topic || '', target: c.target || '', slogan: c.slogan || '',
                media: c.media || '', cost: c.cost || 0, content: c.content || '',
                aiFeedback: c.aiFeedback || '',
                aiVerdict: c.aiVerdict || '',        // [추가]
                expectedVisitor: c.expectedVisitor || 0, expectedReputation: c.expectedReputation || 0,
                teacherFeedback: c.teacherFeedback || '', status: c.status || 'waiting', submittedAt: c.submittedAt || ''
            }];
            const cLatestRound = cVersions[cVersions.length - 1].round;

            let cVerTabs = '';
            if (cVersions.length > 1) {
                cVerTabs = `<div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap; align-items:center;">
                    <span style="font-size:12px; color:var(--text-muted); font-weight:bold; margin-right:4px;">📚 발전 과정</span>`;
                cVersions.forEach(v => {
                    const isLatest = v.round === cLatestRound;
                    cVerTabs += `<button class="cver-tab-${c.id}" onclick="window.showCampaignVersion(${c.id}, ${v.round}, this)"
                        style="padding:5px 12px; font-size:12px; font-weight:bold; border-radius:6px; cursor:pointer;
                        border:1px solid ${isLatest ? 'var(--primary)' : 'var(--border-color)'};
                        background:${isLatest ? 'var(--primary)' : '#ffffff'};
                        color:${isLatest ? '#ffffff' : 'var(--text-muted)'};">${v.round}차${isLatest ? ' (최신)' : ''}</button>`;
                });
                cVerTabs += `</div>`;
            }

            let cVerPanels = '';
            cVersions.forEach(v => {
                const isLatest = v.round === cLatestRound;
                const vStatusText = v.status === 'approved' ? '✅ 승인됨' : (v.status === 'rejected' ? '❌ 재검토 요청됨' : '⏳ 심사 대기중');

                // [2026-09-19 추가] AI 판정 배지
                const cVerdict = v.aiVerdict || ((v.expectedVisitor || 0) > 0 ? 'ok' : '');
                const cBadge = cVerdict === 'revise'
                    ? '<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:20px; font-size:12px; font-weight:bold; margin-left:6px;">⚠️ 보완 필요</span>'
                    : (cVerdict === 'ok' ? '<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:20px; font-size:12px; font-weight:bold; margin-left:6px;">✅ 기준 충족</span>' : '');
                cVerPanels += `
                <div id="cver-panel-${c.id}-${v.round}" class="cver-panel-${c.id}" style="display:${isLatest ? 'block' : 'none'};">
                    ${cVersions.length > 1 ? `<div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${v.round}차 제출 ${v.submittedAt ? '(' + v.submittedAt + ')' : ''} · ${vStatusText} · 매체 ${v.media || '미지정'} (${v.cost || 0}G)</div>` : ''}
                    <div style="font-size: 13px; color: var(--text-muted); background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 5px;">
                        <div style="margin-bottom: 3px;"><strong style="color:var(--primary);">🎯 홍보물:</strong> ${v.topic || "미지정"}</div>
                        <div><strong style="color:var(--primary);">👥 홍보 대상:</strong> ${v.target || "미지정"}</div>
                    </div>
                    <div style="font-size: 16px; font-weight: bold; color: var(--text-main); margin-bottom: 10px; margin-top: 5px;">"${v.slogan || ""}"</div>
                    <div style="font-size:14px; line-height:1.6; color:var(--text-main); margin-bottom:15px; background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">${(v.content || '').replace(/\n/g, '<br>')}</div>
                    <div style="font-size:13px; background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:6px; border:1px solid rgba(2, 132, 199, 0.2);">
                        <strong>🤖 AI 1차 의견:</strong>${cBadge}<br>${(v.aiFeedback || '(AI 의견이 없습니다)').replace(/\n/g, '<br>')}
                        <div style="margin-top:6px;"><strong style="color:var(--primary);">AI 제안 성과:</strong> 방문객 +${v.expectedVisitor || 0}명 · 평판 +${v.expectedReputation || 0}점</div>
                    </div>
                    ${v.teacherFeedback ? `<div style="font-size:13px; margin-top:10px; background:rgba(22, 163, 74, 0.1); padding:10px; border-radius:6px; border:1px solid rgba(22, 163, 74, 0.3);"><strong>👨‍🏫 선생님 코멘트:</strong> ${v.teacherFeedback}</div>` : ''}
                </div>`;
            });

            chtml += `
            <div class="carousel-slide slide-campaign ${index === activeCampaign ? 'active' : ''}">
                <div style="background:#f1f5f9; padding:20px; border-radius:12px; border: 1px solid ${c.status === 'waiting' ? 'var(--accent)' : 'var(--border-color)'};">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
                        <div style="font-weight:bold; color:var(--primary); font-size:16px;">사용 매체: ${c.media || "미지정"} (${c.cost || 0}G)</div>
                        <div style="font-size:13px; font-weight:bold;">${statusBadge}</div>
                    </div>
                    ${imageHtml}
                    ${cVerTabs}
                    ${cVerPanels}
                    ${reviewUi}
                </div>
            </div>`;
        });
    }
    chtml += '</div>';
    if (campaigns.length > 1) {
        chtml += `<div class="carousel-controls">
            <button class="slide-btn" onclick="window.changeSlide('campaign', -1)">◀ 이전</button>
            <span class="slide-counter" id="counter-campaign">${activeCampaign + 1} / ${campaigns.length}</span>
            <button class="slide-btn" onclick="window.changeSlide('campaign', 1)">다음 ▶</button>
        </div>`;
    }
    chtml += '</div>';
    document.getElementById('dtPromos').innerHTML = chtml;

    // ────────────────────────────────
    // 3. 지도 기호
    // ────────────────────────────────
    const markers = window.gameState.mapMarkers.filter(m =>
        String(m.author) === String(sNum) || String(m.authorId) === String(sNum) || (m.author && m.author.startsWith(sNum + '번'))
    );
    let mhtml = '';
    if (markers.length === 0) mhtml = '<div style="color:var(--text-muted); grid-column:1/-1;">등록한 기호가 없습니다.</div>';
    markers.forEach(m => {
        mhtml += `<div style="background:#f8fafc; border:1px solid var(--border-color); padding:10px; border-radius:8px; display:flex; align-items:center; gap:15px;"><img src="${m.imgData}" style="width:50px; height:50px; background:white; border-radius:8px; object-fit:contain;"><div><strong style="color:var(--text-main); display:block;">${m.placeName}</strong><span style="color:var(--text-muted); font-size:12px;">${m.legendDesc}</span></div></div>`;
    });
    document.getElementById('dtMarkers').innerHTML = mhtml;
}

window.hideStudentDetails = function() {
    document.getElementById('monitorDetailView').style.display = 'none';
    document.getElementById('monitorGridView').style.display = 'block';
}

// ==========================================
// 제안서 심사 (승인 시 예산 지급)
// ==========================================
window.submitTeacherReview = async function(proposalId, isApproved, sNum) {
    const feedbackEl = document.getElementById(`t-feedback-${proposalId}`);
    const budgetEl = document.getElementById(`t-budget-${proposalId}`);
    if (!feedbackEl || !budgetEl) return alert("심사 항목을 찾을 수 없습니다. 화면을 새로 고친 뒤 다시 시도해주세요.");

    const targetProposal = window.gameState.submittedProposals.find(p => p.id === proposalId);
    if (!targetProposal) return alert("제안서를 찾을 수 없습니다.");
    if (targetProposal.status !== 'waiting') return alert("이미 처리된 제안서입니다.");

    const typed = feedbackEl.value.trim();
    if (!isApproved && typed.length < 5) {
        await window.uiAlert("재검토를 요청할 때는 어떤 점을 고치면 좋을지 꼭 적어주세요.\n학생이 무엇을 보완해야 할지 알 수 있어야 합니다.",
            { title: '✏️ 피드백을 적어주세요' });
        feedbackEl.focus();
        return;
    }
    const feedbackText = typed || '훌륭한 제안입니다! 우리 지역을 위해 꼭 필요한 아이디어네요.';

    let finalBudget = 0;
    if (isApproved) {
        const parsed = parseInt(budgetEl.value, 10);
        finalBudget = isNaN(parsed) ? 0 : Math.max(0, parsed);
        const ok = await window.uiConfirm(`이 제안서를 승인하고 학생에게 ${finalBudget}G를 지급합니다.\n승인하면 AI 의견과 선생님 피드백이 학생에게 공개됩니다.`,
            { title: '✅ 제안서를 승인할까요?', okText: '승인하기', cancelText: '조금 더 볼게요' });
        if (!ok) return;
    } else {
        const ok = await window.uiConfirm("재검토(반려)로 처리합니다.\n학생이 선생님 코멘트를 보고 수정해 다시 제출할 수 있습니다.",
            { title: '↩️ 재검토를 요청할까요?', okText: '재검토 요청', cancelText: '취소', danger: true });
        if (!ok) return;
    }

    const newStatus = isApproved ? 'approved' : 'rejected';

    // 최상위 + 최신 차수 이력에 함께 반영
    targetProposal.status = newStatus;
    targetProposal.teacherFeedback = feedbackText;
    targetProposal.teacherBudget = finalBudget;

    if (Array.isArray(targetProposal.versions) && targetProposal.versions.length > 0) {
        const latest = targetProposal.versions[targetProposal.versions.length - 1];
        latest.status = newStatus;
        latest.teacherFeedback = feedbackText;
        latest.teacherBudget = finalBudget;
    }

    // 예산 지급 (increment 방식 · 중복 지급 방지)
    if (isApproved && finalBudget > 0 && !targetProposal.budgetPaid) {
        try {
            const targetStudentKey = targetProposal.authorId;
            if (targetStudentKey) {
                await setDoc(doc(db, "classes", window.classKey, "students", targetStudentKey),
                    { budget: window.fsIncrement(finalBudget) }, { merge: true });
                targetProposal.budgetPaid = true;
            }
        } catch (e) {
            console.error("학생 예산 지급 오류", e);
            alert("예산 지급에 실패했습니다. 인터넷 상태를 확인하고 다시 시도해주세요.");
            return;
        }
    }

    await window.saveGameState();

    window.showNotification(isApproved
        ? `승인 완료! 학생에게 예산 ${finalBudget}G가 지급되었습니다.`
        : "재검토(반려) 처리되었습니다. 학생이 수정해서 다시 제출할 수 있습니다.");

    window.showStudentDetails(sNum, true);
    window.renderStudentMonitor();
}

// ==========================================
// 마케팅 전략 심사
// ==========================================
window.submitCampaignReview = async function(campaignId, isApproved, sNum) {
    const feedbackEl = document.getElementById(`c-feedback-${campaignId}`);
    if (!feedbackEl) return alert("심사 항목을 찾을 수 없습니다. 화면을 새로 고친 뒤 다시 시도해주세요.");

    const targetCampaign = window.gameState.marketingCampaigns.find(c => c.id === campaignId);
    if (!targetCampaign) return alert("캠페인을 찾을 수 없습니다.");
    if (targetCampaign.status !== 'waiting') return alert("이미 처리된 캠페인입니다.");

    const typedC = feedbackEl.value.trim();
    if (!isApproved && typedC.length < 5) {
        await window.uiAlert("재검토를 요청할 때는 어떤 점을 고치면 좋을지 꼭 적어주세요.\n학생이 무엇을 보완해야 할지 알 수 있어야 합니다.",
            { title: '✏️ 피드백을 적어주세요' });
        feedbackEl.focus();
        return;
    }
    const feedbackText = typedC || '멋진 마케팅 전략입니다! 예산이 성공적으로 집행되었습니다.';

    // [2026-09-19 추가] 재검토(반려)로 돌려보내면 학생이 낸 광고비를 환급합니다.
    //   이미 환급한 기획안은 costRefunded가 true라서 두 번 돌려주지 않습니다.
    const refundCost = (!isApproved && targetCampaign.costRefunded !== true)
        ? (targetCampaign.cost || 0)
        : 0;

    let finalVis = targetCampaign.expectedVisitor || 0;
    let finalRep = targetCampaign.expectedReputation || 0;

    if (isApproved) {
        const visEl = document.getElementById(`c-vis-${campaignId}`);
        const repEl = document.getElementById(`c-rep-${campaignId}`);
        if (visEl) finalVis = parseInt(visEl.value, 10) || 0;
        if (repEl) finalRep = parseInt(repEl.value, 10) || 0;
        const ok = await window.uiConfirm(`이 홍보 전략을 승인하고 방문객 ${finalVis}명, 평판 ${finalRep}점을 지급합니다.`,
            { title: '✅ 홍보 전략을 승인할까요?', okText: '승인하기', cancelText: '조금 더 볼게요' });
        if (!ok) return;
    } else {
        const refundMsg = refundCost > 0
            ? `\n\n💰 학생에게 광고비 ${refundCost}G를 돌려줍니다.`
            : '';
        const ok = await window.uiConfirm("재검토(반려)로 처리합니다.\n학생이 선생님 코멘트를 보고 보완해 다시 제출할 수 있습니다." + refundMsg,
            { title: '↩️ 재검토를 요청할까요?', okText: '재검토 요청', cancelText: '취소', danger: true });
        if (!ok) return;
    }

    // [2026-09-19 추가] 광고비 환급을 '상태를 바꾸기 전에' 먼저 처리합니다.
    //   환급에 실패했는데 상태만 반려로 바뀌면 다시 시도할 수 없기 때문입니다.
    if (refundCost > 0) {
        try {
            const refundStudentKey = targetCampaign.authorKey;
            if (refundStudentKey) {
                await setDoc(doc(db, "classes", window.classKey, "students", refundStudentKey),
                    { budget: window.fsIncrement(refundCost) }, { merge: true });
                targetCampaign.costRefunded = true;
            }
        } catch (e) {
            console.error("광고비 환급 오류", e);
            alert("광고비 환급에 실패했습니다. 인터넷 상태를 확인하고 다시 시도해주세요.");
            return;
        }
    }

    targetCampaign.status = isApproved ? 'approved' : 'rejected';
    targetCampaign.teacherFeedback = feedbackText;
    targetCampaign.expectedVisitor = finalVis;
    targetCampaign.expectedReputation = finalRep;

    if (Array.isArray(targetCampaign.versions) && targetCampaign.versions.length > 0) {
        const latestC = targetCampaign.versions[targetCampaign.versions.length - 1];
        latestC.status = targetCampaign.status;
        latestC.teacherFeedback = feedbackText;
        latestC.expectedVisitor = finalVis;
        latestC.expectedReputation = finalRep;
    }

    if (isApproved && !targetCampaign.rewardPaid) {
        try {
            const targetStudentKey = targetCampaign.authorKey;
            if (targetStudentKey) {
                await setDoc(doc(db, "classes", window.classKey, "students", targetStudentKey), {
                    visitorCount: window.fsIncrement(finalVis),
                    reputation: window.fsIncrement(finalRep)
                }, { merge: true });
                targetCampaign.rewardPaid = true;
            }
        } catch (e) {
            console.error("성과 지급 오류", e);
            alert("성과 지급에 실패했습니다. 인터넷 상태를 확인하고 다시 시도해주세요.");
            return;
        }
    }

    await window.saveGameState();

    window.showNotification(isApproved
        ? "마케팅 전략이 승인되어 방문객과 평판이 지급되었습니다."
        : (refundCost > 0
            ? `재검토(반려) 처리되었습니다. 광고비 ${refundCost}G를 학생에게 돌려주었습니다.`
            : "재검토(반려) 처리되었습니다."));

    window.showStudentDetails(sNum, true);
    window.renderStudentMonitor();
}

// ==========================================
// 게시물 삭제 (관리자 권한)
// ==========================================
// 고유 id로 먼저 찾고, 없으면 예전 방식(배열 위치)으로 처리
window.deleteItem = async function(type, indexOrId) {
    const ok = await window.uiConfirm("해당 게시물을 완전히 삭제합니다.\n삭제한 내용은 되돌릴 수 없습니다.",
        { title: '🗑️ 게시물을 삭제할까요?', okText: '삭제하기', cancelText: '취소', danger: true });
    if (!ok) return;

    if (type === 'problem') {
        const byId = window.gameState.problems.findIndex(p => p.id === indexOrId);
        if (byId !== -1) window.gameState.problems.splice(byId, 1);
        else window.gameState.problems.splice(indexOrId, 1);
        window.renderProblemBoard();
    } else if (type === 'proposal') {
        const byId = window.gameState.submittedProposals.findIndex(p => p.id === indexOrId);
        if (byId !== -1) window.gameState.submittedProposals.splice(byId, 1);
        else window.gameState.submittedProposals.splice(indexOrId, 1);
        window.renderSharedProposals();
        if (typeof window.renderMyProposals === 'function') window.renderMyProposals();
    } else if (type === 'campaign') {
        window.gameState.marketingCampaigns = window.gameState.marketingCampaigns.filter(c => c.id !== indexOrId);
        window.renderSharedMarketingBoard();
        if (typeof window.renderMyCampaigns === 'function') window.renderMyCampaigns();
    }

    window.saveGameState();
    window.showNotification("게시물이 관리자 권한으로 삭제되었습니다.");
}