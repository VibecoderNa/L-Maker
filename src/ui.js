// ui.js - 화면 그리기, 탭 전환, 시각적 요소(UI) 전담

window.renderProblemBoard = function() {
    const board = document.getElementById('problemBoard'); if(!board) return;
    board.innerHTML = `<div class="board-item-selectable" style="background: var(--note-1);" onclick="window.selectProblem(this, '초등학교 앞 횡단보도 고장')"><div class="author-tag">👤 예시 자료</div><strong style="font-size: 18px; margin-bottom: 5px;">초등학교 앞 횡단보도 고장</strong><div style="font-size: 14px; margin-top: 5px;">신호등이 고장나서 위험합니다.</div><div style="margin-top: auto; padding-top: 10px;"><span class="tag">#교통안전</span><span class="tag">#사고위험</span></div></div>`;
    if(window.gameState.problems) {
        window.gameState.problems.forEach((p, index) => {
            const tagHtml = (p.keywords || []).map(kw => `<span class="tag">${kw}</span>`).join('');
            let imageHtml = p.imageUrl ? `<img src="${p.imageUrl}" class="board-image">` : '';
            let deleteBtnHtml = window.isTeacherMode ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('problem', ${index})"><i class="fa-solid fa-trash"></i></button>` : '';
            board.innerHTML += `<div class="board-item-selectable" style="background: ${p.color}; position:relative;" onclick="window.selectProblem(this, '${p.title}')">${deleteBtnHtml}<div class="author-tag">👤 ${p.author}</div><strong style="font-size: 18px; margin-bottom: 5px;">${p.title}</strong>${imageHtml}<div style="font-size: 14px; margin-top: 5px; line-height: 1.4;">${p.content}</div><div style="margin-top: auto; padding-top: 10px;">${tagHtml}</div></div>`;
        });
    }
}

window.selectProblem = function(element, desc) {
    document.querySelectorAll('#problemBoard .board-item-selectable').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected'); window.currentSelectedProblem = desc;
    const displayEl = document.getElementById('selectedProblemDisplay'); displayEl.style.display = 'block'; displayEl.innerHTML = `💡 해결할 주제: <span style="color:var(--primary);">${desc}</span>`;
    document.getElementById('proposalText').value = "[1. 문제 원인 분석]\n이 문제는 왜 발생했을까요?\n👉 \n\n[2. 구체적인 해결 방안]\n어떻게 해결할 수 있을지 아이디어를 적어주세요. (실현 가능성 고려)\n👉 \n\n[3. 기대 효과]\n문제가 해결되면 우리 지역 사람들에게 어떤 도움이 될까요? (공공성 고려)\n👉 \n";
    window.showNotification("주제가 선택되었습니다. 제안서를 작성해주세요."); window.switchInnerTab('inner-proposal', document.querySelectorAll('#stage1-1 .sub-tab-btn')[2]);
}

// 💡 수정됨: 학생이 보는 학급 공유 게시판에 상태 뱃지 및 교사 피드백 추가
window.renderSharedProposals = function() {
    const board = document.getElementById('sharedProposalsBoard'); if(!board) return; board.innerHTML = '';
    
    if(window.gameState.submittedProposals.length === 0) {
        board.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">아직 등록된 제안서가 없습니다.</div>';
        return;
    }

    window.gameState.submittedProposals.forEach((p, index) => {
        let deleteBtnHtml = window.isTeacherMode ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('proposal', ${index})"><i class="fa-solid fa-trash"></i></button>` : '';
        
        // 상태별 뱃지
        let statusBadge = '';
        if(p.status === 'waiting') statusBadge = `<span style="background:#fef08a; color:#854d0e; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">⏳ 교사 확인 대기중 (1차 통과)</span>`;
        else if(p.status === 'approved') statusBadge = `<span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">✅ 선생님 최종 승인</span>`;
        else if(p.status === 'rejected') statusBadge = `<span style="background:#fecaca; color:#991b1b; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">❌ 재검토 요망</span>`;

        // 피드백 박스 구성
        let feedbackHtml = `<div style="font-size:13px; background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:8px; border:1px solid rgba(2, 132, 199, 0.2); margin-top:10px;"><strong>🤖 AI 1차 의견:</strong> ${p.aiFeedback} <span style="color:var(--primary); font-weight:bold;">(기본 획득: ${p.aiBudget}G)</span></div>`;
        
        if(p.status !== 'waiting' && p.teacherFeedback) {
            feedbackHtml += `<div style="font-size:13px; background:rgba(22, 163, 74, 0.05); padding:10px; border-radius:8px; border:1px solid rgba(22, 163, 74, 0.3); margin-top:10px;"><strong>👨‍🏫 선생님 피드백:</strong> ${p.teacherFeedback} <br><span style="color:var(--accent); font-weight:bold;">(+ 추가 예산: ${p.teacherBudget}G)</span></div>`;
        }

        board.innerHTML += `
        <div style="position:relative; background:#f8fafc; padding:20px; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:10px;">
            ${deleteBtnHtml}
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="author-tag" style="margin:0; font-size:14px;">👤 작성자: ${p.author}</div>
                ${statusBadge}
            </div>
            <strong style="color:var(--primary); font-size:16px;">주제: ${p.problem}</strong>
            <div style="font-size:14px; line-height:1.6; background:#ffffff; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">${p.proposal.replace(/\n/g, '<br>')}</div>
            <div style="margin-top:auto;">${feedbackHtml}</div>
        </div>`;
    });
}

document.addEventListener('change', function(e) {
    if(e.target.name === 'mediaOption') { document.querySelectorAll('input[name="mediaOption"]').forEach(r => { r.parentElement.style.borderColor = 'var(--border-color)'; r.parentElement.style.background = '#f1f5f9'; }); e.target.parentElement.style.borderColor = 'var(--accent)'; e.target.parentElement.style.background = 'rgba(234, 88, 12, 0.05)'; }
});

window.shareToPromoBoard = function() {
    const type = document.getElementById('promoType').value; const content = document.getElementById('promoContentInput').value.trim();
    if(!content) return alert("내용을 작성해주세요.");
    window.gameState.promoBoard.unshift({ id: Date.now(), author: `${document.getElementById('numInput').value}번 학생`, type: type, content: content, color: window.padletColors[Math.floor(Math.random() * window.padletColors.length)] });
    window.updateUI(); window.renderPromoBoard(); document.getElementById('promoContentInput').value = ''; window.showNotification("게시판 공유됨!"); window.switchInnerTab('inner-promo-board', document.querySelectorAll('#stage2 .sub-tab-btn')[1]);
}

window.renderPromoBoard = function() {
    const board = document.getElementById('promoBoardArea'); if(!board) return; board.innerHTML = '';
    if(window.gameState.promoBoard.length === 0) return board.innerHTML = `<div style="color:var(--text-muted); grid-column: 1 / -1;">아직 홍보물이 없습니다.</div>`;
    window.gameState.promoBoard.forEach(p => {
        let deleteBtnHtml = window.isTeacherMode ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('promo', ${p.id})"><i class="fa-solid fa-trash"></i></button>` : '';
        board.innerHTML += `<div class="board-item-selectable" style="background: ${p.color}; position:relative;" onclick="window.selectPromoItem(${p.id}, this)">${deleteBtnHtml}<div class="author-tag">👤 ${p.author}</div><strong style="font-size: 14px; margin-bottom: 5px; color: #333;">${p.type}</strong><div style="font-size: 14px; margin-top: 5px; line-height: 1.4; color: #1e293b;">${p.content}</div></div>`;
    });
}

window.selectPromoItem = function(id, element) {
    document.querySelectorAll('#promoBoardArea .board-item-selectable').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected'); window.currentSelectedPromo = window.gameState.promoBoard.find(p => p.id === id);
    document.getElementById('selectedPromoDisplay').style.display = 'block'; document.getElementById('selectedPromoDisplay').innerHTML = `<strong>선택 홍보물:</strong> ${window.currentSelectedPromo.type} (작성: ${window.currentSelectedPromo.author})`;
    window.showNotification("마케팅 홍보물이 선택되었습니다."); window.switchInnerTab('inner-promo-campaign', document.querySelectorAll('#stage2 .sub-tab-btn')[2]);
}

window.renderBuildings = function() {
    const grid = document.getElementById('buildingGrid'); if(!grid) return; grid.innerHTML = '';
    window.buildingsData.forEach(b => {
        const isBuilt = window.gameState.builtBuildings.includes(b.id);
        const meetBudget = window.gameState.budget >= b.costBudget; const meetVisitor = window.gameState.visitorCount >= b.reqVisitor; const meetRep = window.gameState.reputation >= b.reqReputation;
        const canBuild = meetBudget && meetVisitor && meetRep && !isBuilt;

        let buttonHtml = isBuilt ? `<button class="action-btn" style="background: var(--success); color: white;" disabled><i class="fa-solid fa-check"></i> 건설 완료</button>`
            : `<button class="action-btn" onclick="window.buildFacility('${b.id}')" ${canBuild ? '' : 'disabled'}>${canBuild ? '건설하기' : '조건 부족'}</button>`;
        grid.innerHTML += `<div class="building-card ${isBuilt ? 'built' : ''}"><div class="b-header"><div class="b-icon"><i class="fa-solid ${b.icon}"></i></div><div><span class="b-tag">${b.tag}</span><h4 class="b-title">${b.name}</h4></div></div><div class="b-desc">${b.desc}</div><div style="margin-top: auto;"><div class="b-req-list"><div class="req-item ${isBuilt?'met':(meetBudget?'met':'lacking')}">💰 ${b.costBudget}G</div><div class="req-item ${isBuilt?'met':(meetVisitor?'met':'lacking')}">👥 ${b.reqVisitor}</div><div class="req-item ${isBuilt?'met':(meetRep?'met':'lacking')}">⭐ ${b.reqReputation}</div></div><div class="b-reward">💖 만족도 +${b.rewardSat}</div>${buttonHtml}</div></div>`;
    });
}

window.buildFacility = function(id) {
    if(window.isTeacherMode) return window.showNotification("관리자 모드에서는 건설할 수 없습니다.");
    const b = window.buildingsData.find(x => x.id === id);
    if(!b || window.gameState.builtBuildings.includes(id) || window.gameState.budget < b.costBudget || window.gameState.visitorCount < b.reqVisitor || window.gameState.reputation < b.reqReputation) return window.showNotification("조건 부족.");
    window.gameState.budget -= b.costBudget; window.gameState.satisfaction += b.rewardSat; window.gameState.builtBuildings.push(b.id);
    window.showNotification(`🎉 '${b.name}' 건설 완료!`); window.updateUI();
}

window.updateUI = function(skipSave = false) {
    document.getElementById('budgetDisplay').innerText = window.gameState.budget.toLocaleString(); document.getElementById('visitorDisplay').innerText = window.gameState.visitorCount.toLocaleString(); document.getElementById('reputationDisplay').innerText = window.gameState.reputation.toLocaleString();
    let satPercent = Math.min(100, Math.floor((window.gameState.satisfaction / 540) * 100)); document.getElementById('satisfactionDisplay').innerText = satPercent;
    if (!skipSave) window.saveGameState(); window.updateTycoonLevel(); window.renderBuildings();
}

window.updateTycoonLevel = function() {
    let currentLevel = window.districtLevels[0]; let nextLevel = null;
    for(let i = 0; i < window.districtLevels.length; i++) { if(window.gameState.satisfaction >= window.districtLevels[i].threshold) { currentLevel = window.districtLevels[i]; nextLevel = window.districtLevels[i+1] || null; } }
    const levelNameEl = document.getElementById('currentLevelName'); if(levelNameEl) levelNameEl.innerText = currentLevel.name;
    const bar = document.getElementById('levelProgressBar'); const text = document.getElementById('levelProgressText'); const desc = document.getElementById('nextLevelDesc');
    if(bar && text && desc) {
        if(nextLevel) { const progressCurrent = window.gameState.satisfaction - currentLevel.threshold; const progressTarget = nextLevel.threshold - currentLevel.threshold; const percentage = Math.min((progressCurrent / progressTarget) * 100, 100); bar.style.width = `${percentage}%`; text.innerText = `만족도 ${window.gameState.satisfaction} / ${nextLevel.threshold}`; desc.innerText = `다음 단계 '${nextLevel.name}'(으)로 성장하기 위해 만족도 ${nextLevel.threshold - window.gameState.satisfaction}이(가) 더 필요합니다.`; } 
        else { bar.style.width = '100%'; bar.style.background = 'var(--accent)'; text.innerText = `만족도 ${window.gameState.satisfaction} (최고 단계 달성)`; text.style.color = 'var(--text-main)'; desc.innerText = `축하합니다! 지속 가능한 미래형 모범 지역으로 성장했습니다!`; }
    }
}

window.switchTab = function(tabId, element, title, isSubNav = false) {
    document.querySelectorAll('.tab-panel').forEach(t => t.classList.remove('active')); document.querySelectorAll('.nav-item, .sub-nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active'); element.classList.add('active');
    if(isSubNav) document.getElementById('stage1Nav').classList.add('active'); else document.getElementById('stage1SubMenu').classList.remove('active');
    
    // 서브 메뉴 클릭 시 부모 메뉴(stageMapNav 등) 활성화 처리
    if(tabId.startsWith('stage-map')) document.getElementById('stageMapNav').classList.add('active');
    
    document.getElementById('topbarTitle').innerText = title; window.updateUI(); 
}

window.toggleStage1Menu = function(element) {
    const menu = document.getElementById('stage1SubMenu'); menu.classList.toggle('active'); element.classList.add('active');
    if(document.getElementById('stageMapNav')) document.getElementById('stageMapNav').classList.remove('active'); 
    if(document.getElementById('stageMapSubMenu')) document.getElementById('stageMapSubMenu').classList.remove('active');
    if(document.getElementById('teacherNav')) document.getElementById('teacherNav').classList.remove('active'); 
    document.getElementById('stage2Nav').classList.remove('active'); document.getElementById('stage3Nav').classList.remove('active');
    if(menu.classList.contains('active')) window.switchTab('stage1-1', menu.querySelector('.sub-nav-item'), '1) 우리 지역의 문제를 탐색하고 해결 방안을 제안해요.', true);
}
window.switchInnerTab = function(innerTabId, element) { const parentPanel = element.closest('.tab-panel'); parentPanel.querySelectorAll('.inner-tab-panel').forEach(t => t.classList.remove('active')); parentPanel.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active')); document.getElementById(innerTabId).classList.add('active'); element.classList.add('active'); }
window.showNotification = function(msg) { const noti = document.getElementById('notification'); noti.innerText = msg; noti.classList.add('show'); setTimeout(() => noti.classList.remove('show'), 3500); }