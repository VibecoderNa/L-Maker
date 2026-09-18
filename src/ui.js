// ui.js - 화면 그리기, 탭 전환, 시각적 요소(UI) 전담
// [개편] 1) AI 1차 의견은 선생님 심사 후 선생님 코멘트와 함께 공개
//        2) 학생 화면에서도 1~3차 발전 과정을 탭으로 확인
//        3) 좋아요 보상이 실제로 지급되도록 firebase 연결 (import 누락 수정)
//        4) 홍보 전략 재제출 시 광고비가 중복으로 빠지지 않도록 수정
//        5) 메뉴 이동만으로 학급 데이터가 저장되지 않도록 분리

import { db } from './firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.currentEditingProposalId = null;
window.currentEditingCampaignId = null;

// 1번 탭('홍보 계획 세우기')을 실제로 거쳤는지 표시한다.
// 심사용 계정처럼 입력칸이 미리 채워져 있어도, 이 버튼을 누르지 않으면 제출할 수 없다.
window.promoPlanConfirmed = false;

// 홍보 전략 이력 보관 최대 차수
window.MAX_CAMPAIGN_VERSIONS = 3;

// ==========================================
// 앱 디자인에 맞춘 확인창 / 알림창
// (브라우저 기본 confirm/alert 대신 사용합니다)
// ==========================================
window.closeUiDialog = function() {
    const el = document.getElementById('uiDialogOverlay');
    if (el) el.remove();
};

window.uiConfirm = function(message, opts) {
    const o = opts || {};
    const title = o.title || '⚠️ 잠깐만요, 시장님!';
    const okText = o.okText || '네, 진행할게요';
    const cancelText = o.cancelText || '아니요';
    const danger = o.danger === true;

    return new Promise(resolve => {
        window.closeUiDialog();
        const overlay = document.createElement('div');
        overlay.id = 'uiDialogOverlay';
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.45); backdrop-filter:blur(3px); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;';
        overlay.innerHTML = `
            <div style="background:#ffffff; border-radius:16px; padding:28px; max-width:460px; width:100%; box-shadow:0 20px 45px rgba(0,0,0,0.2); text-align:center;">
                <div style="font-size:19px; font-weight:800; color:${danger ? '#ef4444' : 'var(--accent)'}; margin-bottom:14px;">${title}</div>
                <div style="font-size:15px; line-height:1.7; color:var(--text-main); background:#f8fafc; padding:16px; border-radius:10px; border:1px solid var(--border-color); text-align:left; white-space:pre-line;">${window.escapeHtml(message)}</div>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button id="uiDialogCancel" style="flex:1; padding:12px; border-radius:10px; border:1px solid var(--border-color); background:#f1f5f9; color:var(--text-main); font-weight:bold; font-size:15px; cursor:pointer;">${cancelText}</button>
                    <button id="uiDialogOk" style="flex:1; padding:12px; border-radius:10px; border:none; background:${danger ? '#ef4444' : 'var(--accent)'}; color:#ffffff; font-weight:bold; font-size:15px; cursor:pointer;">${okText}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const done = (v) => { window.closeUiDialog(); resolve(v); };
        document.getElementById('uiDialogOk').onclick = () => done(true);
        document.getElementById('uiDialogCancel').onclick = () => done(false);
        overlay.onclick = (e) => { if (e.target === overlay) done(false); };
    });
};

window.uiAlert = function(message, opts) {
    const o = opts || {};
    const title = o.title || '📢 알려드립니다';
    return new Promise(resolve => {
        window.closeUiDialog();
        const overlay = document.createElement('div');
        overlay.id = 'uiDialogOverlay';
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.45); backdrop-filter:blur(3px); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;';
        overlay.innerHTML = `
            <div style="background:#ffffff; border-radius:16px; padding:28px; max-width:460px; width:100%; box-shadow:0 20px 45px rgba(0,0,0,0.2); text-align:center;">
                <div style="font-size:19px; font-weight:800; color:var(--primary); margin-bottom:14px;">${title}</div>
                <div style="font-size:15px; line-height:1.7; color:var(--text-main); background:#f8fafc; padding:16px; border-radius:10px; border:1px solid var(--border-color); text-align:left; white-space:pre-line;">${window.escapeHtml(message)}</div>
                <button id="uiDialogOk" style="width:100%; margin-top:20px; padding:12px; border-radius:10px; border:none; background:var(--primary); color:#ffffff; font-weight:bold; font-size:15px; cursor:pointer;">확인했어요</button>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('uiDialogOk').onclick = () => { window.closeUiDialog(); resolve(true); };
    });
};

// ==========================================
// 공통 도우미 (학생이 입력한 <, ' 등으로 화면이 깨지지 않도록 처리)
// ==========================================
window.escapeHtml = function(str) {
    return String(str === null || str === undefined ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
window.textToHtml = function(str) {
    return window.escapeHtml(str).replace(/\n/g, '<br>');
}
window.escapeForAttr = function(str) {
    return String(str === null || str === undefined ? '' : str)
        .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}
// 제안서의 차수 이력을 꺼낸다 (옛 데이터는 1차로 변환)
window.getProposalVersions = function(p) {
    if (Array.isArray(p.versions) && p.versions.length > 0) return p.versions;
    return [{
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
}

// 홍보 전략의 차수 이력을 꺼낸다 (옛 데이터는 1차로 변환)
window.getCampaignVersions = function(c) {
    if (Array.isArray(c.versions) && c.versions.length > 0) return c.versions;
    return [{
        round: 1,
        topic: c.topic || '',
        target: c.target || '',
        slogan: c.slogan || '',
        media: c.media || '',
        cost: c.cost || 0,
        content: c.content || '',
        aiFeedback: c.aiFeedback || '',
        aiVerdict: c.aiVerdict || '',        // [추가]
        expectedVisitor: c.expectedVisitor || 0,
        expectedReputation: c.expectedReputation || 0,
        teacherFeedback: c.teacherFeedback || '',
        status: c.status || 'waiting',
        submittedAt: c.submittedAt || ''
    }];
}

// ==========================================
// 1단계: 학급 공유 게시판 (문제 목록)
// ==========================================
window.renderProblemBoard = function() {
    const board = document.getElementById('problemBoard');
    if (!board) return;

    const vipGuide = window.userKey === "0"
        ? `<div style="background:var(--accent); color:white; padding:8px; border-radius:8px; font-size:12px; font-weight:bold; text-align:center; margin-bottom:10px;">👉 심사위원님, 이 주제를 클릭해 주세요!</div>`
        : '';

    board.innerHTML = `<div class="board-item-selectable" style="background: var(--note-1);" onclick="window.selectProblem(this, '초등학교 앞 횡단보도 고장 방치')">${vipGuide}<div class="author-tag">👤 예시 자료</div><strong style="font-size: 18px; margin-bottom: 5px;">초등학교 앞 횡단보도 고장 방치</strong><div style="font-size: 14px; margin-top: 5px;">신호등이 고장나서 위험합니다.</div></div>`;

    if (window.gameState.problems) {
        window.gameState.problems.forEach((p, index) => {
            let tagsContainer = '';
            if (p.keywords && p.keywords.length > 0) {
                const tagHtml = p.keywords.map(kw => `<span class="tag">${window.escapeHtml(kw)}</span>`).join('');
                tagsContainer = `<div style="margin-top: auto; padding-top: 10px;">${tagHtml}</div>`;
            }

            const imageHtml = p.imageUrl ? `<img src="${p.imageUrl}" class="board-image">` : '';
            // 고유 id가 있으면 id로, 없으면 예전 방식(위치)으로 삭제
            const delKey = (p.id !== undefined && p.id !== null) ? p.id : index;
            const deleteBtnHtml = window.isTeacherMode
                ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('problem', ${delKey})"><i class="fa-solid fa-trash"></i></button>`
                : '';

            // 내용은 전부 저장하고, 카드에서만 4줄까지 보여준다
            board.innerHTML += `<div class="board-item-selectable" style="background: ${p.color}; position:relative;" onclick="window.selectProblem(this, '${window.escapeForAttr(p.title)}')">${deleteBtnHtml}<div class="author-tag">👤 ${window.escapeHtml(p.author)}</div><strong style="font-size: 18px; margin-bottom: 5px;">${window.escapeHtml(p.title)}</strong>${imageHtml}<div style="font-size: 14px; margin-top: 5px; line-height: 1.4; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden;">${window.textToHtml(p.content)}</div>${tagsContainer}</div>`;
        });
    }
}

window.selectProblem = function(element, desc) {
    document.querySelectorAll('#problemBoard .board-item-selectable').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    window.currentSelectedProblem = desc;

    const displayEl = document.getElementById('selectedProblemDisplay');
    displayEl.style.display = 'block';
    displayEl.innerHTML = `💡 해결할 주제: <span style="color:var(--primary);">${window.escapeHtml(desc)}</span>`;

    window.currentEditingProposalId = null;

    if (window.userKey === "0") {
        document.getElementById('proposalText').value = "[1. 문제 원인 분석]\n신고 방법 잘 모름: 고장이 나도 어른들이 바빠서 바로 신고하지 않거나, 어디에 연락해야 하는지 모릅니다.\n점검 시간과 예산 부족: 관공서에서 매일 모든 신호등을 점검하기 어렵고, 수리하는 데 시간이 걸립니다.\n\n[2. 구체적인 해결 방안]\n어린이 안전 감시단: 등하굣길에 고장 난 신호등을 발견하면 선생님이나 배움터지킴이 어르신께 즉시 알립니다.\nQR코드 간편 신고판: 신호등 기둥의 QR코드를 찍으면 10초 만에 구청에 신고되는 시스템을 만듭니다.\n스마트 안내판: 수리 전까지는 움직임을 감지하는 노란색 안내판을 세워 운전자에게 주의를 줍니다.\n\n[3. 기대 효과]\n빠른 수리와 안전: 신고와 수리가 빨라져 교통사고를 미리 막을 수 있습니다.\n우리 동네 관심 증가: 학생과 주민들이 동네 안전에 더 많은 관심을 갖게 됩니다.";
    } else {
        document.getElementById('proposalText').value = "[1. 문제 원인 분석]\n이 문제는 왜 발생했을까요?\n👉 \n\n[2. 구체적인 해결 방안]\n어떻게 해결할 수 있을지 아이디어를 적어주세요.\n👉 \n\n[3. 기대 효과]\n문제가 해결되면 우리 지역 사람들에게 어떤 도움이 될까요?\n👉 \n";
    }

    window.showNotification("주제가 선택되었습니다. 제안서를 작성해주세요.");
    window.switchInnerTab('inner-proposal', document.querySelectorAll('#stage1-1 .sub-tab-btn')[2]);
}

// ==========================================
// 1단계: 우리 반 해결 방안 살펴보기
// ==========================================
window.renderSharedProposals = function() {
    const board = document.getElementById('sharedProposalsBoard');
    if (!board) return;
    board.innerHTML = '';

    if (window.gameState.submittedProposals.length === 0) {
        board.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">아직 등록된 제안서가 없습니다.</div>';
        return;
    }

    window.gameState.submittedProposals.forEach((p, index) => {
        const delKey = (p.id !== undefined && p.id !== null) ? p.id : index;
        const deleteBtnHtml = window.isTeacherMode
            ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('proposal', ${delKey})"><i class="fa-solid fa-trash"></i></button>`
            : '';

        let statusBadge = '';
        if (p.status === 'waiting') statusBadge = `<span style="background:#fef08a; color:#854d0e; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">⏳ 심사 진행중</span>`;
        else if (p.status === 'approved') statusBadge = `<span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">✅ 선생님 최종 승인</span>`;
        else if (p.status === 'rejected') statusBadge = `<span style="background:#fecaca; color:#991b1b; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">❌ 재검토 요망</span>`;

        // 심사가 끝난 제안서만 AI 의견과 선생님 코멘트를 공개한다
        let feedbackHtml = '';
        if (p.status === 'waiting') {
            feedbackHtml = `<div style="font-size:13px; color:#b45309; background:#fef3c7; padding:10px; border-radius:8px; border:1px solid #fde68a; margin-top:10px; text-align:center;">🤖 AI 담당관과 👨‍🏫 선생님이 함께 심사하고 있습니다.</div>`;
        } else {
            if (p.aiFeedback) {
                feedbackHtml += `<div style="font-size:13px; background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:8px; border:1px solid rgba(2, 132, 199, 0.2); margin-top:10px;"><strong>🤖 AI 1차 의견:</strong> ${window.textToHtml(p.aiFeedback)}</div>`;
            }
            if (p.teacherFeedback) {
                feedbackHtml += `<div style="font-size:13px; margin-top:10px; background:rgba(22, 163, 74, 0.1); padding:10px; border-radius:6px; border:1px solid rgba(22, 163, 74, 0.3);"><strong>👨‍🏫 선생님 코멘트:</strong> ${window.textToHtml(p.teacherFeedback)}${p.status === 'approved' ? `<br><span style="color:var(--accent); font-weight:bold;">(확정 예산: ${p.teacherBudget || 0}G)</span>` : ''}</div>`;
            }
        }

        const roundBadge = (p.round && p.round > 1)
            ? `<span style="background:#e0f2fe; color:#075985; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; margin-left:6px;">${p.round}차 수정본</span>`
            : '';

        board.innerHTML += `
        <div style="position:relative; background:#f8fafc; padding:20px; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:10px;">
            ${deleteBtnHtml}
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <div class="author-tag" style="margin:0; font-size:14px;">👤 작성자: ${window.escapeHtml(p.author || "익명")}${roundBadge}</div>
                ${statusBadge}
            </div>
            <strong style="color:var(--primary); font-size:16px;">주제: ${window.escapeHtml(p.problem || "미지정")}</strong>
            <div style="font-size:14px; line-height:1.6; background:#ffffff; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">${window.textToHtml(p.proposal)}</div>
            <div style="margin-top:auto;">${feedbackHtml}</div>
        </div>`;
    });
}

// ==========================================
// 1단계: 나의 제안 관리 (차수별 발전 과정)
// ==========================================
window.showMyProposalVersion = function(proposalId, round, btnEl) {
    document.querySelectorAll(`.myver-panel-${proposalId}`).forEach(el => el.style.display = 'none');
    const panel = document.getElementById(`myver-panel-${proposalId}-${round}`);
    if (panel) panel.style.display = 'block';

    document.querySelectorAll(`.myver-tab-${proposalId}`).forEach(el => {
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

window.renderMyProposals = function() {
    const list = document.getElementById('myProposalsList');
    if (!list) return;

    const myProps = window.gameState.submittedProposals.filter(p => String(p.authorId) === String(window.userKey));
    if (myProps.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px; background:#f8fafc; border-radius:8px; border:1px dashed var(--border-color);">아직 내가 제출한 제안서가 없습니다.</div>';
        return;
    }

    let html = '';
    myProps.forEach(p => {
        let statusHtml = '';
        let btnHtml = '';

        if (p.status === 'waiting') {
            statusHtml = '<span style="color:#d97706; font-weight:bold; background:#fef08a; padding:4px 8px; border-radius:4px; font-size:12px;">⏳ 심사 대기중</span>';
        } else if (p.status === 'approved') {
            statusHtml = '<span style="color:#166534; font-weight:bold; background:#bbf7d0; padding:4px 8px; border-radius:4px; font-size:12px;">✅ 승인 완료</span>';
        } else if (p.status === 'rejected') {
            statusHtml = '<span style="color:#991b1b; font-weight:bold; background:#fecaca; padding:4px 8px; border-radius:4px; font-size:12px;">❌ 재검토 요망</span>';
            btnHtml = `<button class="action-btn accent-btn" style="margin-top:15px; padding:10px 15px; font-size:14px;" onclick="window.editMyProposal(${p.id})"><i class="fa-solid fa-pen"></i> 다시 작성하기</button>`;
        }

        // 심사 진행 단계 표시
        const step2Done = true; // 제출되면 AI 1차 검토는 이미 끝난 상태
        const step3Done = (p.status !== 'waiting');
        const stepHtml = `<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; font-size:12px; margin-bottom:12px;">
            <span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:20px; font-weight:bold;">✅ 제출 완료</span>
            <span style="color:var(--text-muted);">→</span>
            <span style="background:${step2Done ? '#dcfce7' : '#f1f5f9'}; color:${step2Done ? '#166534' : '#94a3b8'}; padding:4px 10px; border-radius:20px; font-weight:bold;">${step2Done ? '✅' : '⏳'} AI 1차 검토</span>
            <span style="color:var(--text-muted);">→</span>
            <span style="background:${step3Done ? (p.status === 'approved' ? '#dcfce7' : '#fee2e2') : '#fef3c7'}; color:${step3Done ? (p.status === 'approved' ? '#166534' : '#991b1b') : '#b45309'}; padding:4px 10px; border-radius:20px; font-weight:bold;">${step3Done ? (p.status === 'approved' ? '✅' : '❌') : '⏳'} 선생님 최종 심사</span>
        </div>`;

        const versions = window.getProposalVersions(p);
        const latestRound = versions[versions.length - 1].round;

        // 차수 탭 (2차 이상 제출했을 때만)
        let verTabs = '';
        if (versions.length > 1) {
            verTabs = `<div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap; align-items:center;">
                <span style="font-size:12px; color:var(--text-muted); font-weight:bold; margin-right:4px;">📚 내가 발전시킨 과정</span>`;
            versions.forEach(v => {
                const isLatest = v.round === latestRound;
                verTabs += `<button class="myver-tab-${p.id}" onclick="window.showMyProposalVersion(${p.id}, ${v.round}, this)"
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
            const reviewed = (v.status === 'approved' || v.status === 'rejected');

            let vFeedback = '';
            if (!reviewed) {
                vFeedback = `<div style="font-size:13px; color:#b45309; background:#fef3c7; padding:12px; border-radius:8px; border:1px solid #fde68a; margin-top:10px; text-align:center;">
                    <strong>⏳ AI 담당관의 1차 검토가 끝났습니다.</strong><br>
                    선생님의 최종 심사가 끝나면 AI 의견과 선생님 피드백을 함께 확인할 수 있어요.
                </div>`;
            } else {
                if (v.aiFeedback) {
                    vFeedback += `<div style="font-size:13px; background:rgba(2, 132, 199, 0.05); padding:12px; border-radius:8px; border:1px solid rgba(2, 132, 199, 0.2); margin-top:10px;"><strong>🤖 AI 1차 의견:</strong> ${window.textToHtml(v.aiFeedback)}</div>`;
                }
                if (v.teacherFeedback) {
                    const tone = v.status === 'approved'
                        ? 'background:rgba(22, 163, 74, 0.1); color:#166534; border:1px solid rgba(22, 163, 74, 0.35);'
                        : 'background:#fef2f2; color:#991b1b; border:1px solid #fca5a5;';
                    vFeedback += `<div style="font-size:14px; padding:12px; border-radius:8px; margin-top:10px; ${tone}"><strong>👨‍🏫 선생님 코멘트:</strong> ${window.textToHtml(v.teacherFeedback)}${v.status === 'approved' ? `<br><strong style="color:var(--accent);">🎉 예산 ${v.teacherBudget || 0}G가 지급되었습니다!</strong>` : ''}</div>`;
                }
            }

            verPanels += `
            <div id="myver-panel-${p.id}-${v.round}" class="myver-panel-${p.id}" style="display:${isLatest ? 'block' : 'none'};">
                ${versions.length > 1 ? `<div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${v.round}차 제출 ${v.submittedAt ? '(' + v.submittedAt + ')' : ''}</div>` : ''}
                <div style="font-size:14px; color:var(--text-main); line-height:1.6; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">${window.textToHtml(v.proposal)}</div>
                ${vFeedback}
            </div>`;
        });

        html += `<div style="background:#ffffff; border:1px solid var(--border-color); padding:20px; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center; gap:8px;">
                <strong style="color:var(--primary); font-size:16px;">주제: ${window.escapeHtml(p.problem)}</strong>
                <div>${statusHtml}</div>
            </div>
            ${stepHtml}
            ${verTabs}
            ${verPanels}
            ${btnHtml}
        </div>`;
    });
    list.innerHTML = html;
}

window.editMyProposal = async function(id) {
    const p = window.gameState.submittedProposals.find(x => x.id === id);
    if (!p) return;

    const versions = window.getProposalVersions(p);
    if (versions.length >= window.MAX_PROPOSAL_VERSIONS) {
        const ok = await window.uiConfirm(
            `시장님, 이미 ${versions.length}차까지 제안서를 작성하셨습니다.\n\n다시 제출하면 가장 오래된 1차 기록이 사라집니다.\n그래도 계속하시겠습니까?`,
            { title: '⚠️ 기록이 사라질 수 있습니다', okText: '네, 다시 쓸게요', cancelText: '그대로 둘게요' }
        );
        if (!ok) return;
    }

    window.currentEditingProposalId = id;
    window.currentSelectedProblem = p.problem;

    document.getElementById('selectedProblemDisplay').style.display = 'block';
    document.getElementById('selectedProblemDisplay').innerHTML = `💡 해결할 주제: <span style="color:var(--primary);">${window.escapeHtml(p.problem)}</span>`;
    document.getElementById('proposalText').value = p.proposal || '';

    window.switchInnerTab('inner-proposal', document.querySelectorAll('#stage1-1 .sub-tab-btn')[2]);
    window.showNotification("기존 내용을 불러왔습니다. 선생님 피드백을 참고해 고쳐서 다시 제출해주세요.");
}

// ==========================================
// 2단계: 홍보 전략
// ==========================================
document.addEventListener('change', function(e) {
    if (e.target.name === 'mediaOption') {
        document.querySelectorAll('input[name="mediaOption"]').forEach(r => {
            r.parentElement.style.borderColor = 'var(--border-color)';
            r.parentElement.style.background = '#f1f5f9';
        });
        if (e.target.parentElement.tagName === 'LABEL') {
            e.target.parentElement.style.borderColor = 'var(--accent)';
            e.target.parentElement.style.background = 'rgba(234, 88, 12, 0.05)';
        }
    }
});

window.goToPromoStep2 = function() {
    const topic = document.getElementById('promoTopic').value.trim();
    const target = document.getElementById('promoTarget').value.trim();
    const slogan = document.getElementById('promoSlogan').value.trim().replace(/^["']+|["']+$/g, '');

    if (!topic || !target || !slogan) {
        return window.showNotification("홍보물, 홍보 대상, 핵심 슬로건을 모두 작성해주세요.");
    }

    document.getElementById('displayStrategyTopic').innerText = topic;
    document.getElementById('displayStrategyTarget').innerText = target;
    document.getElementById('displayStrategySlogan').innerText = `"${slogan}"`;

    window.currentEditingCampaignId = null;
    window.promoPlanConfirmed = true;   // 1번 탭을 정상적으로 거쳤음

    if (window.userKey === "0") {
        document.getElementById('promoContentInput').value = "[기획 제목] 초등학생 추천! 우리 동네 스탬프 투어 팸플릿\n[기획 의도]\n다른 지역 친구들과 가족들이 주말에 찾아오기 쉽게, 어린이 시선에서 재미있는 코스를 정리한 팸플릿을 만듭니다.\n[홍보 문구 및 내용]\n1. 핵심 문구: \"이번 주말 어디 가지? 초등학생이 찾아낸 우리 동네 보물지도로 출발!\"\n2. 추천 코스:\n - 1코스: 자연 속 생태 체험장\n - 2코스: 맛있는 특산물 맛집과 시장\n - 3코스: 재미있는 박물관과 공예 체험\n3. 특별 이벤트: 3개 코스 도장을 다 찍어오면 우리 동네 귀여운 캐릭터 인형을 선물로 드립니다!\n[기대 효과]\n인근 학교와 도서관에 배포하여 주말에 놀러 오는 가족 손님을 늘리고 우리 동네를 널리 알립니다.";
        const firstMedia = document.querySelectorAll('input[name="mediaOption"]')[0];
        if (firstMedia) firstMedia.checked = true;
    } else {
        document.getElementById('promoContentInput').value = '';
    }

    window.showNotification("홍보 계획을 세웠습니다! 이제 홍보 방법을 정해볼까요?");
    window.switchInnerTab('inner-promo-campaign', document.querySelectorAll('#stage2-1 .sub-tab-btn')[1]);
}

// 홍보 전략의 차수 전환 (학생 화면)
window.showMyCampaignVersion = function(campaignId, round, btnEl) {
    document.querySelectorAll(`.mycver-panel-${campaignId}`).forEach(el => el.style.display = 'none');
    const panel = document.getElementById(`mycver-panel-${campaignId}-${round}`);
    if (panel) panel.style.display = 'block';

    document.querySelectorAll(`.mycver-tab-${campaignId}`).forEach(el => {
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

window.renderMyCampaigns = function() {
    const list = document.getElementById('myCampaignsList');
    if (!list) return;

    const myCamps = window.gameState.marketingCampaigns.filter(c => String(c.authorKey) === String(window.userKey));
    if (myCamps.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px; background:#f8fafc; border-radius:8px; border:1px dashed var(--border-color);">아직 제출한 홍보 방법이 없습니다.</div>';
        return;
    }

    let html = '';
    myCamps.forEach(c => {
        let statusHtml = '';
        let btnHtml = '';

        if (c.status === 'waiting') {
            statusHtml = '<span style="color:#d97706; font-weight:bold; background:#fef08a; padding:4px 8px; border-radius:4px; font-size:12px;">⏳ 심사 대기중</span>';
        } else if (c.status === 'approved') {
            statusHtml = '<span style="color:#166534; font-weight:bold; background:#bbf7d0; padding:4px 8px; border-radius:4px; font-size:12px;">✅ 홍보 성공!</span>';
        } else if (c.status === 'rejected') {
            statusHtml = '<span style="color:#991b1b; font-weight:bold; background:#fecaca; padding:4px 8px; border-radius:4px; font-size:12px;">❌ 재검토 요망</span>';
            btnHtml = `<button class="action-btn accent-btn" style="margin-top:15px; padding:10px 15px; font-size:14px;" onclick="window.editMyCampaign(${c.id})"><i class="fa-solid fa-pen"></i> 다시 작성하기</button>`;
        }

        // 심사 진행 단계 표시 (제안서와 동일한 흐름)
        const step3Done = (c.status !== 'waiting');
        const stepHtml = `<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; font-size:12px; margin-bottom:12px;">
            <span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:20px; font-weight:bold;">✅ 제출 완료</span>
            <span style="color:var(--text-muted);">→</span>
            <span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:20px; font-weight:bold;">✅ AI 1차 검토</span>
            <span style="color:var(--text-muted);">→</span>
            <span style="background:${step3Done ? (c.status === 'approved' ? '#dcfce7' : '#fee2e2') : '#fef3c7'}; color:${step3Done ? (c.status === 'approved' ? '#166534' : '#991b1b') : '#b45309'}; padding:4px 10px; border-radius:20px; font-weight:bold;">${step3Done ? (c.status === 'approved' ? '✅' : '❌') : '⏳'} 선생님 최종 심사</span>
        </div>`;

        const versions = window.getCampaignVersions(c);
        const latestRound = versions[versions.length - 1].round;

        let verTabs = '';
        if (versions.length > 1) {
            verTabs = `<div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap; align-items:center;">
                <span style="font-size:12px; color:var(--text-muted); font-weight:bold; margin-right:4px;">📚 내가 발전시킨 과정</span>`;
            versions.forEach(v => {
                const isLatest = v.round === latestRound;
                verTabs += `<button class="mycver-tab-${c.id}" onclick="window.showMyCampaignVersion(${c.id}, ${v.round}, this)"
                    style="padding:5px 12px; font-size:12px; font-weight:bold; border-radius:6px; cursor:pointer;
                    border:1px solid ${isLatest ? 'var(--primary)' : 'var(--border-color)'};
                    background:${isLatest ? 'var(--primary)' : '#ffffff'};
                    color:${isLatest ? '#ffffff' : 'var(--text-muted)'};">${v.round}차${isLatest ? ' (최신)' : ''}</button>`;
            });
            verTabs += `</div>`;
        }

        let verPanels = '';
        versions.forEach(v => {
            const isLatest = v.round === latestRound;
            const reviewed = (v.status === 'approved' || v.status === 'rejected');
            const cleanSlogan = (v.slogan || "").replace(/^["']+|["']+$/g, '');

            // 심사가 끝나야 AI 의견과 성과가 공개된다
            let vFeedback = '';
            if (!reviewed) {
                vFeedback = `<div style="font-size:13px; color:#b45309; background:#fef3c7; padding:12px; border-radius:8px; border:1px solid #fde68a; margin-top:10px; text-align:center;">
                    <strong>⏳ AI 담당관의 1차 검토가 끝났습니다.</strong><br>
                    선생님의 최종 심사가 끝나면 AI 의견과 홍보 효과를 함께 확인할 수 있어요.
                </div>`;
            } else {
                if (v.aiFeedback) {
                    vFeedback += `<div style="font-size:13px; background:rgba(2, 132, 199, 0.05); padding:12px; border-radius:8px; border:1px solid rgba(2, 132, 199, 0.2); margin-top:10px;"><strong>🤖 AI 1차 의견:</strong> ${window.textToHtml(v.aiFeedback)}</div>`;
                }
                if (v.status === 'approved') {
                    vFeedback += `<div style="font-size:13px; background:rgba(22, 163, 74, 0.1); padding:12px; border-radius:8px; border:1px solid rgba(22, 163, 74, 0.35); color:#166534; margin-top:10px;">
                        <strong>🎉 홍보 효과:</strong> 방문객 +${v.expectedVisitor || 0}명 · 평판 +${v.expectedReputation || 0}점
                        ${v.teacherFeedback ? `<br><strong>👨‍🏫 선생님 코멘트:</strong> ${window.textToHtml(v.teacherFeedback)}` : ''}
                    </div>`;
                } else if (v.teacherFeedback) {
                    vFeedback += `<div style="font-size:14px; background:#fef2f2; padding:12px; border-radius:8px; color:#991b1b; border:1px solid #fca5a5; margin-top:10px;"><strong>👨‍🏫 선생님 코멘트:</strong> ${window.textToHtml(v.teacherFeedback)}<br><span style="font-size:12px;">다시 제출해도 광고비는 한 번만 사용됩니다.</span></div>`;
                }
            }

            verPanels += `
            <div id="mycver-panel-${c.id}-${v.round}" class="mycver-panel-${c.id}" style="display:${isLatest ? 'block' : 'none'};">
                ${versions.length > 1 ? `<div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${v.round}차 제출 ${v.submittedAt ? '(' + v.submittedAt + ')' : ''}</div>` : ''}
                <div style="font-size:13px; color:var(--text-muted); background:#f8fafc; padding:10px; border-radius:8px; border:1px solid var(--border-color); margin-bottom:8px;">
                    <div style="margin-bottom:3px;"><strong style="color:var(--primary);">🎯 홍보물:</strong> ${window.escapeHtml(v.topic || "미지정")}</div>
                    <div><strong style="color:var(--primary);">👥 홍보 대상:</strong> ${window.escapeHtml(v.target || "미지정")}</div>
                </div>
                <div style="font-weight:bold; margin-bottom:8px;">"${window.escapeHtml(cleanSlogan)}"</div>
                <div style="font-size:14px; color:var(--text-main); line-height:1.6; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">${window.textToHtml(v.content)}</div>
                ${vFeedback}
            </div>`;
        });

        html += `<div style="background:#ffffff; border:1px solid var(--border-color); padding:20px; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center; gap:8px;">
                <strong style="color:var(--primary); font-size:16px;">매체: ${window.escapeHtml(c.media)} (${c.cost}G)</strong>
                <div>${statusHtml}</div>
            </div>
            ${stepHtml}
            ${verTabs}
            ${verPanels}
            ${btnHtml}
        </div>`;
    });
    list.innerHTML = html;
}

window.editMyCampaign = async function(id) {
    const c = window.gameState.marketingCampaigns.find(x => x.id === id);
    if (!c) return;

    const cVers = window.getCampaignVersions(c);
    if (cVers.length >= window.MAX_CAMPAIGN_VERSIONS) {
        const ok = await window.uiConfirm(
            `시장님, 이미 ${cVers.length}차까지 홍보 전략을 작성하셨습니다.\n\n다시 제출하면 가장 오래된 1차 기록이 사라집니다.\n그래도 계속하시겠습니까?`,
            { title: '⚠️ 기록이 사라질 수 있습니다', okText: '네, 다시 쓸게요', cancelText: '그대로 둘게요' }
        );
        if (!ok) return;
    }

    window.currentEditingCampaignId = id;
    window.promoPlanConfirmed = true;   // 이미 세운 계획을 이어서 고치는 것이므로 통과
    const cleanSlogan = (c.slogan || "").replace(/^["']+|["']+$/g, '');

    // 1번 탭 입력칸까지 함께 채워야 다시 제출할 때 내용이 유지된다
    document.getElementById('promoTopic').value = c.topic || '';
    document.getElementById('promoTarget').value = c.target || '';
    document.getElementById('promoSlogan').value = cleanSlogan;

    document.getElementById('displayStrategyTopic').innerText = c.topic || '-';
    document.getElementById('displayStrategyTarget').innerText = c.target || '-';
    document.getElementById('displayStrategySlogan').innerText = `"${cleanSlogan}"`;
    document.getElementById('promoContentInput').value = c.content || '';

    window.switchInnerTab('inner-promo-campaign', document.querySelectorAll('#stage2-1 .sub-tab-btn')[1]);
    window.showNotification("기존 내용을 불러왔습니다. 선생님 코멘트를 참고해 보완한 뒤 다시 제출해주세요.");
}

window.isCampaignSubmitting = false;

// ==========================================
// 2단계: 마케팅 전략 제출 (AI 1차 검토 → 선생님 최종 심사)
// ==========================================
window.executeCampaign = async function() {
    if (window.isCampaignSubmitting || window.isAILoading) return;

    // ① 1번 탭('홍보 계획 세우기')을 거쳤는지 확인한다
    const topic = document.getElementById('promoTopic').value.trim();
    const target = document.getElementById('promoTarget').value.trim();
    const slogan = document.getElementById('promoSlogan').value.trim().replace(/^["\']+|["\']+$/g, '');

    if (!window.promoPlanConfirmed || !topic || !target || !slogan) {
        window.showNotification("먼저 '1. 홍보 계획 세우기'에서 홍보물과 홍보 대상을 정하고 [홍보 방법 정하러 가기]를 눌러주세요!");
        const firstTab = document.querySelectorAll('#stage2-1 .sub-tab-btn')[0];
        if (firstTab) window.switchInnerTab('inner-promo-strategy', firstTab);
        return;
    }

    // ② 기획안과 매체 확인
    const content = document.getElementById('promoContentInput').value.trim();
    if (content.length < 20) return window.showNotification("상세 기획안 및 홍보 문구를 조금 더 자세히 작성해주세요.");

    let mediaName = "";
    let cost = 0;
    const radio = document.querySelector('input[name="mediaOption"]:checked');
    if (!radio) return window.showNotification("광고 매체를 선택해주세요.");

    if (radio.value === 'custom') {
        mediaName = document.getElementById('customMediaName').value.trim();
        cost = parseInt(document.getElementById('customMediaBudget').value, 10);
        if (!mediaName || isNaN(cost) || cost <= 0) return window.showNotification("자율 매체명과 필요 예산을 올바르게 입력해주세요.");
    } else {
        mediaName = radio.getAttribute('data-name');
        cost = parseInt(radio.value, 10);
    }

    // ③ 예산 확인 (다시 제출하는 경우 이전 광고비는 돌려준다)
    let refund = 0;
    if (window.currentEditingCampaignId) {
        const existing = window.gameState.marketingCampaigns.find(x => x.id === window.currentEditingCampaignId);
        if (existing) refund = existing.cost || 0;
    }
    if (window.gameState.budget + refund < cost) {
        return window.showNotification(`예산이 부족합니다! (사용 가능 예산: ${window.gameState.budget + refund}G / 필요 예산: ${cost}G)`);
    }

    window.clearAIReviseBox('promoContentInput');   // [추가] 지난번 보완 요청 안내 지우기

    window.isCampaignSubmitting = true;
    const submitBtn = document.getElementById('btn-campaign');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 담당관이 검토하는 중입니다...';
    }
    window.showAILoading();

    try {
        // ④ AI 1차 검토 (예상 성과 산정 + 의견)
        if (window.getUsableApiKeys && window.getUsableApiKeys().length === 0) {
            const ready = window.ensureApiKeysReady ? await window.ensureApiKeysReady() : false;
            if (!ready) {
                window.showNotification("AI 담당관과 아직 연결되지 않았습니다. 잠시 후 다시 제출해주세요.");
                return;
            }
        }

        const visMin = Math.max(10, Math.floor(cost * 0.5));
        const visMax = Math.max(visMin + 10, Math.floor(cost * 2));
        const repMin = Math.max(1, Math.floor(cost / 40));
        const repMax = Math.max(repMin + 1, Math.floor(cost / 10));

        // ── [2026-09-19 변경] 판정(적합/보완필요)을 요구하는 프롬프트 ──
        const prompt = `너는 초등학교 4학년 학생이 낸 '지역 홍보 기획안'을 1차로 검토하는 AI 홍보 담당관이야.
최종 심사는 선생님이 하시고, 너는 선생님께 전달할 1차 의견과 예상 성과를 쓰는 역할이야.
무조건 칭찬만 하면 안 돼. 기준에 맞지 않으면 분명하게 '보완필요'로 판정해야 해.

홍보할 거리(홍보물): ${topic}
홍보 대상(누구에게): ${target}
핵심 슬로건: ${slogan}
선택한 광고 매체: ${mediaName} (${cost}G)
상세 기획안: ${content}

[평가 기준]
1) 홍보 대상에게 잘 닿는 매체와 내용인가
2) 슬로건과 기획안이 홍보물의 매력을 잘 드러내는가
3) 초등학생이 실제로 해볼 수 있는 기획인가
4) 무엇을 어떻게 만들고 어디에 알릴지 구체적으로 썼는가

[반드시 '보완필요'로 판정해야 하는 경우]
- 홍보물·홍보 대상과 상관없는 내용이거나, 장난으로 쓴 글일 때
- 뜻을 알 수 없는 글자나 같은 말의 반복일 때
- "많이 알리자"처럼 방법 없이 다짐만 있을 때
- 사실이 아닌 내용으로 사람들을 속이는 홍보일 때
- 초등학생이 도저히 할 수 없는 방법일 때 (예: 전국 TV 광고 직접 제작, 연예인 섭외)

[출력 형식] 반드시 이대로 지켜줘.
첫 번째 줄에는 "판정|방문객수,평판점수" 형식으로만 적어. 다른 말은 절대 쓰지 마.
 - 기준에 맞으면:      적합|(방문객수는 ${visMin}부터 ${visMax}, 평판점수는 ${repMin}부터 ${repMax} 사이의 정수)
   기획이 대상과 잘 맞고 구체적일수록 높은 숫자를, 막연하거나 짧으면 낮은 숫자를 줘.
 - 기준에 맞지 않으면: 보완필요|0,0
두 번째 줄부터는 학생에게 전할 의견을 써줘.
 - '적합'일 때: 잘한 점을 먼저 칭찬하고, 더 좋아질 점 한 가지를 덧붙여줘.
 - '보완필요'일 때: 노력한 점을 짧게 인정한 뒤, 어떤 기준에 맞지 않았는지 알려주고,
   어떻게 고쳐 쓰면 좋을지 구체적인 방법을 두 가지 알려줘. 마지막에 다시 써보자고 응원해줘.
초등학교 4학년이 읽을 수 있는 쉬운 말로, 4문장 이내로 써줘.`;

        const resText = await window.callGeminiAPI(prompt);

        // ── [2026-09-19 변경] AI의 판정과 예상 성과를 읽어낸다 ──
        const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
        const parsedHead = window.splitAIHead(resText);
        let aiVerdict = window.detectAIVerdict(parsedHead.head);
        let aiFeedback = parsedHead.body || resText.trim();

        const numMatch = String(parsedHead.head).match(/(\d+)\D+(\d+)/);

        if (aiVerdict === null) {
            // AI가 형식을 지키지 않은 경우: 예전 방식대로 '적합'으로 보고, 전체를 의견으로 사용
            aiVerdict = 'ok';
            if (!numMatch) aiFeedback = resText.trim();
        }

        let expectedVis = 0;
        let expectedRep = 0;
        if (aiVerdict === 'ok') {
            expectedVis = numMatch ? clamp(parseInt(numMatch[1], 10), visMin, visMax) : Math.floor(cost * 1.0);
            expectedRep = numMatch ? clamp(parseInt(numMatch[2], 10), repMin, repMax) : Math.floor(cost / 20);
        }

        // ── [2026-09-19 추가] 보완 필요 → 제출하지 않고 바로 고칠 기회를 준다 ──
        //     이 경우 광고비도 빠지지 않습니다. (예산 차감은 아래 ⑤에서 일어납니다)
        if (aiVerdict === 'revise') {
            window.hideAILoading();
            window.showAIReviseBox('promoContentInput', aiFeedback);
            const goAnyway = await window.uiConfirm(
                aiFeedback + "\n\n─────────────\n고쳐서 다시 내면 더 좋은 성과를 받을 수 있어요.\n그래도 지금 그대로 내고 싶다면 오른쪽 버튼을 눌러주세요.",
                { title: '🤖 AI 담당관: 조금만 더 보완해봐요', okText: '그래도 제출할래요', cancelText: '고쳐서 다시 쓸게요' }
            );
            if (!goAnyway) {
                window.showNotification("AI 담당관의 의견을 참고해 기획안을 고쳐서 다시 제출해주세요.");
                return;   // 제출하지 않음 (예산 차감·기록 변화 없음)
            }
        }

        // ⑤ 저장
        const today = window.getTodayStr();
        let imageUrl = null;
        const photoFile = document.getElementById('promoImageInput').files[0];
        if (photoFile) {
            try {
                const imagePart = await (window.safeGetBase64 ? window.safeGetBase64(photoFile) : window.getBase64(photoFile));
                imageUrl = imagePart.dataUrl;
            } catch (e) {
                console.error("이미지 업로드 실패", e);
                window.showNotification("포스터 이미지를 읽지 못해 글만 제출합니다.");
            }
        }

        window.gameState.budget = window.gameState.budget + refund - cost;

        const newVersion = {
            round: 1,
            topic: topic, target: target, slogan: slogan,
            media: mediaName, cost: cost, content: content,
            aiFeedback: aiFeedback,
            aiVerdict: aiVerdict,                                  // [추가]
            expectedVisitor: expectedVis, expectedReputation: expectedRep,
            teacherFeedback: '', status: 'waiting', submittedAt: today
        };

        if (window.currentEditingCampaignId) {
            const index = window.gameState.marketingCampaigns.findIndex(x => x.id === window.currentEditingCampaignId);
            if (index !== -1) {
                const c = window.gameState.marketingCampaigns.splice(index, 1)[0];

                if (!Array.isArray(c.versions) || c.versions.length === 0) {
                    c.versions = window.getCampaignVersions(c);
                }
                newVersion.round = c.versions[c.versions.length - 1].round + 1;
                c.versions.push(newVersion);
                while (c.versions.length > window.MAX_CAMPAIGN_VERSIONS) c.versions.shift();

                c.topic = topic; c.target = target; c.slogan = slogan;
                if (imageUrl) c.imageUrl = imageUrl;
                c.media = mediaName; c.cost = cost; c.content = content;
                c.aiFeedback = aiFeedback;
                c.aiVerdict = aiVerdict;                           // [추가]
                c.expectedVisitor = expectedVis;
                c.expectedReputation = expectedRep;
                c.teacherFeedback = '';
                c.status = 'waiting';
                c.round = newVersion.round;
                c.submittedAt = today;
                c.rewardPaid = c.rewardPaid || false;

                window.gameState.marketingCampaigns.unshift(c);
                window.showNotification(`${newVersion.round}차 홍보 전략을 제출했습니다! 선생님의 심사를 기다려주세요.`);
            }
            window.currentEditingCampaignId = null;
        } else {
            window.gameState.marketingCampaigns.unshift({
                id: Date.now(),
                author: `${document.getElementById('numInput').value}번 시장님`,
                authorKey: window.userKey,
                topic: topic, target: target, slogan: slogan,
                imageUrl: imageUrl,
                media: mediaName, cost: cost, content: content,
                aiFeedback: aiFeedback,
                aiVerdict: aiVerdict,                                  // [추가]
                expectedVisitor: expectedVis, expectedReputation: expectedRep,
                teacherFeedback: '',
                status: 'waiting',
                round: 1,
                submittedAt: today,
                rewardPaid: false,
                likes: 0, likedBy: [],
                versions: [newVersion]
            });
            window.showNotification("홍보 전략을 제출했습니다! AI 담당관의 1차 검토를 거쳐 선생님께 전달되었어요.");
        }

        window.saveGameState();
        window.updateUI(true);
        window.renderSharedMarketingBoard();
        window.clearAIReviseBox('promoContentInput');   // [추가] 보완 요청 안내 정리

        document.getElementById('campaignResultArea').style.display = 'block';
        document.getElementById('campaignFeedback').innerHTML = `
            <div style="font-size:18px; margin-bottom:10px;"><strong>🤝 기획안을 제출했습니다!</strong></div>
            "${window.escapeHtml(mediaName)}" 매체를 활용한 전략이 접수되었습니다.<br>
            🤖 <strong>AI 담당관</strong>의 1차 검토를 마치고 👨‍🏫 <strong>선생님</strong>께 전달되었어요. 승인을 기다려주세요!
        `;

        const myTab = document.querySelectorAll('#stage2-1 .sub-tab-btn')[2];
        if (myTab) window.switchInnerTab('inner-my-campaign', myTab);
        window.renderMyCampaigns();

    } catch (e) {
        console.error("홍보 전략 제출 오류:", e);
        window.showNotification(e.userMessage || "제출 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.");
    } finally {
        window.isCampaignSubmitting = false;
        window.hideAILoading();
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    }
}

window.renderSharedMarketingBoard = function() {
    const board = document.getElementById('sharedMarketingBoard');
    if (!board) return;
    board.innerHTML = '';

    const approvedCampaigns = (window.gameState.marketingCampaigns || []).filter(c => c && c.status === 'approved');

    if (approvedCampaigns.length === 0) {
        board.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">아직 선생님이 최종 승인한 마케팅 전략이 없습니다. 멋진 기획을 올려 첫 번째 마케터가 되어보세요!</div>';
        return;
    }

    approvedCampaigns.forEach((c) => {
        const hasLiked = c.likedBy && c.likedBy.includes(window.userKey);
        const isMine = String(c.authorKey) === String(window.userKey);
        const disabled = hasLiked || isMine || window.isTeacherMode;
        const btnLabel = isMine ? `내 기획입니다 (좋아요 ${c.likes || 0})` : `👍 친구 응원하기 (좋아요 ${c.likes || 0})`;

        const likeBtn = `<button style="background:${hasLiked ? 'var(--primary)' : '#f1f5f9'}; color:${hasLiked ? 'white' : 'var(--text-main)'}; border:1px solid var(--border-color); padding:8px 12px; border-radius:8px; cursor:${disabled ? 'default' : 'pointer'}; font-weight:bold; margin-top:10px; width:100%; transition:0.2s; opacity:${disabled ? 0.7 : 1};" onclick="window.likeCampaign(${c.id}, '${window.escapeForAttr(c.authorKey)}')" ${disabled ? 'disabled' : ''}>
            ${btnLabel}
        </button>`;

        const imageHtml = c.imageUrl ? `<img src="${c.imageUrl}" style="width: 100%; max-height: 200px; object-fit: contain; background: #e2e8f0; border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--border-color);">` : '';
        const cleanSlogan = (c.slogan || "").replace(/^["']+|["']+$/g, '');

        const metricsHtml = `<div style="background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:8px; margin-top:10px; font-size:13px; text-align:center;">
            <strong>🎉 홍보 효과:</strong> 방문객 <span style="color:#d97706">+${c.expectedVisitor || 0}명</span> | 평판 <span style="color:#ef4444">+${c.expectedReputation || 0}점</span>
        </div>`;

        const aiHtml = c.aiFeedback
            ? `<div style="font-size:13px; background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:8px; border:1px solid rgba(2, 132, 199, 0.2); margin-top:10px;"><strong>🤖 AI 1차 의견:</strong> ${window.textToHtml(c.aiFeedback)}</div>`
            : '';
        const teacherHtml = c.teacherFeedback
            ? `<div style="font-size:13px; background:rgba(22, 163, 74, 0.1); padding:10px; border-radius:8px; border:1px solid rgba(22, 163, 74, 0.3); margin-top:10px;"><strong>👨‍🏫 선생님 코멘트:</strong> ${window.textToHtml(c.teacherFeedback)}</div>`
            : '';

        const deleteBtnHtml = window.isTeacherMode ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('campaign', ${c.id})"><i class="fa-solid fa-trash"></i></button>` : '';

        board.innerHTML += `
        <div style="position:relative; background:#ffffff; padding:20px; border-radius:12px; border:1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:10px;">
            ${deleteBtnHtml}
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="author-tag" style="margin:0; font-size:14px;">👤 ${window.escapeHtml(c.author || "익명")}</div>
                <span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">✅ 홍보 성공!</span>
            </div>
            ${imageHtml}
            <div style="font-size: 13px; color: var(--text-muted); background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 5px;">
                <div style="margin-bottom: 3px;"><strong style="color:var(--primary);">🎯 홍보물:</strong> ${window.escapeHtml(c.topic || "미지정")}</div>
                <div><strong style="color:var(--primary);">👥 홍보 대상:</strong> ${window.escapeHtml(c.target || "미지정")}</div>
            </div>
            <div style="font-size: 16px; font-weight: bold; color: var(--text-main); margin-bottom: 5px; margin-top: 5px;">"${window.escapeHtml(cleanSlogan)}"</div>
            <div style="font-size:14px; line-height:1.6; background:#ffffff; padding:12px; border-radius:8px; border:1px solid #e2e8f0; color:#1e293b;">${window.textToHtml(c.content)}</div>
            <div style="font-size:13px; color:var(--text-muted); margin-top: 5px;"><i class="fa-solid fa-bullhorn"></i> 사용 매체: ${window.escapeHtml(c.media || "미지정")} (${c.cost || 0}G)</div>
            ${metricsHtml}
            ${aiHtml}
            ${teacherHtml}
            <div style="margin-top:auto;">${likeBtn}</div>
        </div>`;
    });
}

window.likeCampaign = async function(id, targetAuthorKey) {
    if (window.isTeacherMode) return window.showNotification("선생님은 관전만 가능합니다 😊");

    const campaign = window.gameState.marketingCampaigns.find(c => c.id === id);
    if (!campaign) return;
    if (String(campaign.authorKey) === String(window.userKey)) {
        return window.showNotification("내 기획에는 좋아요를 누를 수 없어요 😊");
    }
    if (campaign.likedBy && campaign.likedBy.includes(window.userKey)) return;

    campaign.likes = (campaign.likes || 0) + 1;
    if (!campaign.likedBy) campaign.likedBy = [];
    campaign.likedBy.push(window.userKey);

    window.updateUI(true);
    window.saveClassState();      // 좋아요 수는 학급 공용 자료이므로 함께 저장
    window.renderSharedMarketingBoard();

    try {
        const targetRef = doc(db, "classes", window.classKey, "students", String(targetAuthorKey));
        await setDoc(targetRef, {
            budget: window.fsIncrement(30),
            visitorCount: window.fsIncrement(5),
            reputation: window.fsIncrement(1)
        }, { merge: true });
        window.showNotification("친구의 멋진 마케팅 전략을 응원했습니다! 친구에게 30G가 전달되었어요.");
    } catch (e) {
        console.error("좋아요 보상 지급 실패", e);
        window.showNotification("응원은 기록되었지만 보상 전달에 실패했습니다. 선생님께 알려주세요.");
    }
}

// ==========================================
// 3단계: 지역 건설
// ==========================================
window.renderBuildings = function() {
    const grid = document.getElementById('buildingGrid');
    if (!grid) return;
    grid.innerHTML = '';

    window.buildingsData.forEach(b => {
        const isBuilt = window.gameState.builtBuildings.includes(b.id);
        const meetBudget = window.gameState.budget >= b.costBudget;
        const meetVisitor = window.gameState.visitorCount >= b.reqVisitor;
        const meetRep = window.gameState.reputation >= b.reqReputation;
        const canBuild = meetBudget && meetVisitor && meetRep && !isBuilt;

        const buttonHtml = isBuilt
            ? `<button class="action-btn" style="background: var(--success); color: white;" disabled><i class="fa-solid fa-check"></i> 건설 완료</button>`
            : `<button class="action-btn" onclick="window.buildFacility('${b.id}')" ${canBuild ? '' : 'disabled'}>${canBuild ? '건설하기' : '조건 부족'}</button>`;

        grid.innerHTML += `<div class="building-card ${isBuilt ? 'built' : ''}"><div class="b-header"><div class="b-icon"><i class="fa-solid ${b.icon}"></i></div><div><span class="b-tag">${b.tag}</span><h4 class="b-title">${b.name}</h4></div></div><div class="b-desc">${b.desc}</div><div style="margin-top: auto;"><div class="b-req-list"><div class="req-item ${isBuilt ? 'met' : (meetBudget ? 'met' : 'lacking')}">💰 ${b.costBudget}G</div><div class="req-item ${isBuilt ? 'met' : (meetVisitor ? 'met' : 'lacking')}">👥 ${b.reqVisitor}</div><div class="req-item ${isBuilt ? 'met' : (meetRep ? 'met' : 'lacking')}">⭐ ${b.reqReputation}</div></div><div class="b-reward">💖 만족도 +${b.rewardSat}</div>${buttonHtml}</div></div>`;
    });
}

window.buildFacility = function(id) {
    if (window.isTeacherMode) return window.showNotification("관리자 모드에서는 건설할 수 없습니다.");

    const b = window.buildingsData.find(x => x.id === id);
    if (!b) return;
    if (window.gameState.builtBuildings.includes(id)) return window.showNotification("이미 건설한 시설입니다.");

    const lacking = [];
    if (window.gameState.budget < b.costBudget) lacking.push(`예산 ${b.costBudget - window.gameState.budget}G`);
    if (window.gameState.visitorCount < b.reqVisitor) lacking.push(`방문객 ${b.reqVisitor - window.gameState.visitorCount}명`);
    if (window.gameState.reputation < b.reqReputation) lacking.push(`평판 ${b.reqReputation - window.gameState.reputation}점`);
    if (lacking.length > 0) return window.showNotification(`아직 부족해요! (${lacking.join(', ')} 더 필요)`);

    window.gameState.budget -= b.costBudget;
    window.gameState.satisfaction += b.rewardSat;
    window.gameState.builtBuildings.push(b.id);

    const normalState = document.getElementById('normalState');
    const constructionState = document.getElementById('constructionState');
    const dynamicIcon = document.getElementById('dynamicBuildIcon');
    const fill = document.getElementById('fastProgressFill');

    if (normalState && constructionState && dynamicIcon && fill) {
        dynamicIcon.className = `fa-solid ${b.icon} pop-icon`;
        normalState.style.display = 'none';
        constructionState.style.display = 'flex';
        fill.style.width = '0%';

        setTimeout(() => { fill.style.width = '100%'; }, 50);

        setTimeout(() => {
            constructionState.style.display = 'none';
            normalState.style.display = 'flex';
            if (typeof confetti === 'function') {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, zIndex: 9999 });
            }
            window.showNotification(`🎉 '${b.name}' 건설 완료! 만족도가 올랐습니다!`);
            window.updateUI();
        }, 1200);
    } else {
        window.showNotification(`🎉 '${b.name}' 건설 완료!`);
        window.updateUI();
    }
}

// ==========================================
// 상단 지표 / 단계 / 탭
// ==========================================
window.updateUI = function(skipSave = false) {
    const budgetEl = document.getElementById('budgetDisplay');
    const visitorEl = document.getElementById('visitorDisplay');
    const repEl = document.getElementById('reputationDisplay');
    const satEl = document.getElementById('satisfactionDisplay');

    if (budgetEl) budgetEl.innerText = window.gameState.budget.toLocaleString();
    if (visitorEl) visitorEl.innerText = window.gameState.visitorCount.toLocaleString();
    if (repEl) repEl.innerText = window.gameState.reputation.toLocaleString();
    if (satEl) satEl.innerText = Math.min(100, Math.floor((window.gameState.satisfaction / 540) * 100));

    // 상단 지표(예산·방문객 등)는 나만의 값이므로 내 문서만 저장한다.
    // 학급 공용 자료를 바꾼 곳에서는 saveClassState()를 따로 호출합니다.
    if (!skipSave) window.saveStudentState();
    window.updateTycoonLevel();
    window.renderBuildings();
}

window.updateTycoonLevel = function() {
    let currentLevel = window.districtLevels[0];
    let nextLevel = null;
    for (let i = 0; i < window.districtLevels.length; i++) {
        if (window.gameState.satisfaction >= window.districtLevels[i].threshold) {
            currentLevel = window.districtLevels[i];
            nextLevel = window.districtLevels[i + 1] || null;
        }
    }
    const levelNameEl = document.getElementById('currentLevelName');
    if (levelNameEl) levelNameEl.innerText = currentLevel.name;

    const bar = document.getElementById('levelProgressBar');
    const text = document.getElementById('levelProgressText');
    const desc = document.getElementById('nextLevelDesc');
    if (bar && text && desc) {
        if (nextLevel) {
            const progressCurrent = window.gameState.satisfaction - currentLevel.threshold;
            const progressTarget = nextLevel.threshold - currentLevel.threshold;
            const percentage = Math.min((progressCurrent / progressTarget) * 100, 100);
            bar.style.width = `${percentage}%`;
            text.innerText = `만족도 ${window.gameState.satisfaction} / ${nextLevel.threshold}`;
            desc.innerText = `다음 단계 '${nextLevel.name}'(으)로 성장하기 위해 만족도 ${nextLevel.threshold - window.gameState.satisfaction}이(가) 더 필요합니다.`;
        } else {
            bar.style.width = '100%';
            bar.style.background = 'var(--accent)';
            text.innerText = `만족도 ${window.gameState.satisfaction} (최고 단계 달성)`;
            text.style.color = 'var(--text-main)';
            desc.innerText = `축하합니다! 지속 가능한 미래형 모범 지역으로 성장했습니다!`;
        }
    }
}

window.switchTab = function(tabId, element, title, isSubNav = false) {
    document.querySelectorAll('.tab-panel').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item, .sub-nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    element.classList.add('active');

    if (isSubNav) {
        if (tabId.startsWith('stage1')) document.getElementById('stage1Nav').classList.add('active');
        if (tabId.startsWith('stage2')) document.getElementById('stage2Nav').classList.add('active');
    } else {
        if (document.getElementById('stage1SubMenu')) document.getElementById('stage1SubMenu').classList.remove('active');
        if (document.getElementById('stage2SubMenu')) document.getElementById('stage2SubMenu').classList.remove('active');
    }
    if (tabId.startsWith('stage-map')) document.getElementById('stageMapNav').classList.add('active');

    document.getElementById('topbarTitle').innerText = title;

    // 메뉴를 옮기는 것만으로는 저장하지 않는다 (화면만 갱신)
    window.updateUI(true);
}

window.toggleStage1Menu = function(element) {
    const menu = document.getElementById('stage1SubMenu');
    menu.classList.toggle('active');
    element.classList.add('active');
    if (document.getElementById('stageMapNav')) document.getElementById('stageMapNav').classList.remove('active');
    if (document.getElementById('stageMapSubMenu')) document.getElementById('stageMapSubMenu').classList.remove('active');
    if (document.getElementById('teacherNav')) document.getElementById('teacherNav').classList.remove('active');
    if (document.getElementById('stage2SubMenu')) document.getElementById('stage2SubMenu').classList.remove('active');
    document.getElementById('stage2Nav').classList.remove('active');
    document.getElementById('stage3Nav').classList.remove('active');
    if (menu.classList.contains('active')) window.switchTab('stage1-1', menu.querySelector('.sub-nav-item'), '1) 우리 지역의 문제를 탐색하고 해결 방안을 제안해요.', true);
}

window.toggleStage2Menu = function(element) {
    const menu = document.getElementById('stage2SubMenu');
    menu.classList.toggle('active');
    element.classList.add('active');
    if (document.getElementById('stageMapNav')) document.getElementById('stageMapNav').classList.remove('active');
    if (document.getElementById('stageMapSubMenu')) document.getElementById('stageMapSubMenu').classList.remove('active');
    if (document.getElementById('stage1Nav')) document.getElementById('stage1Nav').classList.remove('active');
    if (document.getElementById('stage1SubMenu')) document.getElementById('stage1SubMenu').classList.remove('active');
    if (document.getElementById('teacherNav')) document.getElementById('teacherNav').classList.remove('active');
    document.getElementById('stage3Nav').classList.remove('active');
    if (menu.classList.contains('active')) window.switchTab('stage2-1', menu.querySelector('.sub-nav-item'), '1) 홍보 계획 세우기', true);
}

window.switchInnerTab = function(innerTabId, element) {
    const parentPanel = element.closest('.tab-panel');
    parentPanel.querySelectorAll('.inner-tab-panel').forEach(t => t.classList.remove('active'));
    parentPanel.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(innerTabId).classList.add('active');
    element.classList.add('active');
}

window.showNotification = function(msg) {
    const noti = document.getElementById('notification');
    if (!noti) return;
    noti.innerText = msg;
    noti.classList.add('show');
    setTimeout(() => noti.classList.remove('show'), 3500);
}