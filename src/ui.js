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

window.renderSharedProposals = function() {
    const board = document.getElementById('sharedProposalsBoard'); if(!board) return; board.innerHTML = '';
    
    if(window.gameState.submittedProposals.length === 0) {
        board.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">아직 등록된 제안서가 없습니다.</div>';
        return;
    }

    window.gameState.submittedProposals.forEach((p, index) => {
        let deleteBtnHtml = window.isTeacherMode ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('proposal', ${index})"><i class="fa-solid fa-trash"></i></button>` : '';
        
        let statusBadge = '';
        if(p.status === 'waiting') statusBadge = `<span style="background:#fef08a; color:#854d0e; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">⏳ 교사 확인 대기중 (1차 통과)</span>`;
        else if(p.status === 'approved') statusBadge = `<span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">✅ 선생님 최종 승인</span>`;
        else if(p.status === 'rejected') statusBadge = `<span style="background:#fecaca; color:#991b1b; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">❌ 재검토 요망</span>`;

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
    if(e.target.name === 'mediaOption') { 
        document.querySelectorAll('input[name="mediaOption"]').forEach(r => { 
            r.parentElement.style.borderColor = 'var(--border-color)'; 
            r.parentElement.style.background = '#f1f5f9'; 
        }); 
        if(e.target.parentElement.tagName === 'LABEL') {
            e.target.parentElement.style.borderColor = 'var(--accent)'; 
            e.target.parentElement.style.background = 'rgba(234, 88, 12, 0.05)';
        }
    }
});

// 💡 수정됨: 슬로건 등록 및 2번 탭으로 이동
window.goToPromoBoard = function() {
    const topic = document.getElementById('promoTopic').value.trim();
    const target = document.getElementById('promoTarget').value.trim();
    const slogan = document.getElementById('promoSlogan').value.trim();
    
    if(topic && target && slogan) {
        window.gameState.promoBoard.unshift({
            id: Date.now(), 
            author: `${document.getElementById('numInput').value}번 학생`,
            topic: topic, 
            target: target, 
            content: slogan, 
            color: window.padletColors[Math.floor(Math.random() * window.padletColors.length)]
        });
        window.updateUI(); 
        window.renderPromoBoard();
        window.showNotification("멋진 슬로건이 등록되었습니다!");
    }
    window.switchInnerTab('inner-promo-board', document.querySelectorAll('#stage2-1 .sub-tab-btn')[1]);
}

// 💡 수정됨: 학급 슬로건 모음집 렌더링
window.renderPromoBoard = function() {
    const board = document.getElementById('promoBoardArea'); if(!board) return; board.innerHTML = '';
    if(window.gameState.promoBoard.length === 0) return board.innerHTML = `<div style="color:var(--text-muted); grid-column: 1 / -1;">아직 등록된 슬로건이 없습니다. 첫 번째 슬로건을 등록해보세요!</div>`;
    
    window.gameState.promoBoard.forEach(p => {
        let deleteBtnHtml = window.isTeacherMode ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('promo', ${p.id})"><i class="fa-solid fa-trash"></i></button>` : '';
        board.innerHTML += `
        <div class="board-item-selectable" style="background: ${p.color}; position:relative;" onclick="window.selectPromoItem(${p.id}, this)">
            ${deleteBtnHtml}
            <div class="author-tag">👤 ${p.author}</div>
            <strong style="font-size: 13px; margin-bottom: 5px; color: var(--text-muted);">대상: ${p.topic} | 타겟: ${p.target}</strong>
            <div style="font-size: 16px; font-weight: bold; margin-top: 5px; line-height: 1.4; color: var(--text-main);">"${p.content}"</div>
        </div>`;
    });
}

window.selectPromoItem = function(id, element) {
    document.querySelectorAll('#promoBoardArea .board-item-selectable').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected'); 
    window.currentSelectedPromo = window.gameState.promoBoard.find(p => p.id === id);
    window.showNotification("참고할 슬로건이 선택되었습니다. 아래에 기획안을 작성해주세요!");
}

// 💡 수정됨: 홍보물 초안 임시 저장 기능
window.shareToPromoBoard = function() {
    const content = document.getElementById('promoContentInput').value.trim();
    if(!content) return alert("기획 및 매체 제작 내용을 자세히 작성해주세요.");
    window.showNotification("홍보물 초안이 임시 저장되었습니다. '마케팅 캠페인 실행하러 가기'를 눌러주세요!");
}

window.goToCampaignExecution = function() {
    if(!document.getElementById('promoContentInput').value.trim()) {
        alert("홍보물 내용을 먼저 작성하고 이동해주세요."); return;
    }
    const displayEl = document.getElementById('selectedPromoDisplay');
    displayEl.style.display = 'block'; 
    displayEl.innerHTML = `<strong>작성된 홍보 기획안을 바탕으로 마케팅 예산을 집행합니다.</strong>`;
    window.switchInnerTab('inner-promo-campaign', document.querySelectorAll('#stage2-1 .sub-tab-btn')[2]);
}

// 💡 수정됨: 캠페인 실행 및 AI 1차 예상 성과 로직
window.executeCampaign = function() {
    const content = document.getElementById('promoContentInput').value.trim();
    if(!content) return alert("이전 탭에서 홍보물 내용을 먼저 작성해주세요.");

    let mediaName = "";
    let cost = 0;
    const radio = document.querySelector('input[name="mediaOption"]:checked');
    if(!radio) return alert("광고 매체를 선택해주세요.");

    if(radio.value === 'custom') {
        mediaName = document.getElementById('customMediaName').value.trim();
        cost = parseInt(document.getElementById('customMediaBudget').value);
        if(!mediaName || isNaN(cost) || cost <= 0) return alert("자율 매체명과 올바른 필요 예산을 입력해주세요.");
    } else {
        mediaName = radio.getAttribute('data-name');
        cost = parseInt(radio.value);
    }

    if(window.gameState.budget < cost) {
        return alert(`예산이 부족합니다! (현재 보유 예산: ${window.gameState.budget}G / 필요 예산: ${cost}G)\n지도의 기호를 추가로 등록하거나 친구의 게시물에 좋아요를 받아보세요.`);
    }

    // 예산 차감
    window.gameState.budget -= cost;

    // AI 예상치 모의 계산 (추후 api.js와 연동 가능)
    const expectedVis = Math.floor(cost * (Math.random() * 0.5 + 0.8));
    const expectedRep = Math.floor((cost / 20) * (Math.random() * 0.5 + 0.8));

    const campaign = {
        id: Date.now(),
        author: `${document.getElementById('numInput').value}번 학생`,
        authorKey: window.userKey,
        media: mediaName,
        cost: cost,
        content: content,
        expectedVisitor: expectedVis,
        expectedReputation: expectedRep,
        status: 'waiting',
        likes: 0,
        likedBy: []
    };

    window.gameState.marketingCampaigns.unshift(campaign);
    window.updateUI();
    window.renderSharedMarketingBoard();

    document.getElementById('campaignResultArea').style.display = 'block';
    document.getElementById('campaignMetrics').innerHTML = `예상 방문객: <span style="color:#d97706">+${expectedVis}명</span> | 예상 평판: <span style="color:#ef4444">+${expectedRep}점</span>`;
    document.getElementById('campaignFeedback').innerHTML = `<strong>🤖 AI 비서관:</strong> "${mediaName}" 매체를 활용한 훌륭한 전략입니다! 입력하신 예산 ${cost}G가 집행되었습니다. 선생님의 최종 승인을 기다려주세요.`;
    
    window.showNotification("캠페인이 제출되었습니다! 공유 게시판에서 결과를 확인하세요.");
}

// 💡 신규: 마케팅 전략 공유 게시판 렌더링
window.renderSharedMarketingBoard = function() {
    const board = document.getElementById('sharedMarketingBoard'); if(!board) return; board.innerHTML = '';
    if(!window.gameState.marketingCampaigns || window.gameState.marketingCampaigns.length === 0) {
        board.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">아직 등록된 마케팅 전략이 없습니다.</div>'; return;
    }

    window.gameState.marketingCampaigns.forEach((c, index) => {
        let statusBadge = c.status === 'waiting'
            ? `<span style="background:#fef08a; color:#854d0e; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">⏳ 승인 대기중</span>`
            : `<span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">✅ 승인 완료</span>`;

        let teacherAction = window.isTeacherMode && c.status === 'waiting'
            ? `<button class="action-btn accent-btn" style="padding:8px; font-size:12px; margin-top:10px;" onclick="window.approveCampaign(${c.id})">이 캠페인 승인하기 ✅</button>` : '';

        let likeBtn = '';
        if(c.status === 'approved') {
            const hasLiked = c.likedBy && c.likedBy.includes(window.userKey);
            likeBtn = `<button style="background:${hasLiked ? 'var(--primary)' : '#f1f5f9'}; color:${hasLiked ? 'white' : 'var(--text-main)'}; border:1px solid var(--border-color); padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold; margin-top:10px; width:100%; transition:0.2s;" onclick="window.likeCampaign(${c.id}, '${c.authorKey}')" ${hasLiked ? 'disabled' : ''}>
                👍 친구 응원하기 (좋아요 ${c.likes || 0})
            </button>`;
        }

        let deleteBtnHtml = window.isTeacherMode ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('campaign', ${c.id})"><i class="fa-solid fa-trash"></i></button>` : '';

        let contentHtml = c.content.replace(/\n/g, '<br>');
        
        // 💡 승인된 결과만 실제 성과 노출
        let metricsHtml = c.status === 'approved' ? `<div style="background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:8px; margin-top:10px; font-size:13px; text-align:center;">
            <strong>🎉 확정 성과:</strong> 방문객 <span style="color:#d97706">+${c.expectedVisitor}명</span> | 평판 <span style="color:#ef4444">+${c.expectedReputation}점</span>
        </div>` : `<div style="background:#f1f5f9; padding:10px; border-radius:8px; margin-top:10px; font-size:12px; text-align:center; color:var(--text-muted);">선생님 승인 후 성과가 공개됩니다.</div>`;

        board.innerHTML += `
        <div style="position:relative; background:#ffffff; padding:20px; border-radius:12px; border:1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:10px;">
            ${deleteBtnHtml}
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="author-tag" style="margin:0; font-size:14px;">👤 ${c.author}</div>
                ${statusBadge}
            </div>
            <strong style="color:var(--primary); font-size:16px;"><i class="fa-solid fa-bullhorn"></i> 집행 매체: ${c.media}</strong>
            <div style="font-size:13px; color:var(--text-muted);">집행 예산: ${c.cost}G</div>
            <div style="font-size:14px; line-height:1.6; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; color:#1e293b;">${contentHtml}</div>
            ${metricsHtml}
            <div style="margin-top:auto;">
                ${teacherAction}
                ${likeBtn}
            </div>
        </div>`;
    });
}

// 💡 신규: 선생님의 2차 승인 및 성과 확정 지급 로직
window.approveCampaign = async function(id) {
    if(!window.isTeacherMode) return;
    const campaign = window.gameState.marketingCampaigns.find(c => c.id === id);
    if(campaign) {
        campaign.status = 'approved';
        window.updateUI(); // 교사용 전체 DB 저장
        window.renderSharedMarketingBoard();

        // 파이어베이스 increment를 활용하여 학생의 자원 직접 올려주기
        try {
            const targetRef = doc(db, "classes", window.classKey, "students", campaign.authorKey);
            await setDoc(targetRef, {
                visitorCount: window.fsIncrement(campaign.expectedVisitor),
                reputation: window.fsIncrement(campaign.expectedReputation)
            }, { merge: true });
            window.showNotification("캠페인이 승인되어 학생에게 확정 성과가 지급되었습니다!");
        } catch(e) { console.error("성과 지급 에러:", e); }
    }
}

// 💡 신규: 친구 좋아요 상호작용 및 자원 획득 로직
window.likeCampaign = async function(id, targetAuthorKey) {
    if(window.isTeacherMode) return window.showNotification("선생님은 관전만 가능합니다 😊");
    
    const campaign = window.gameState.marketingCampaigns.find(c => c.id === id);
    if(!campaign) return;
    if(campaign.likedBy && campaign.likedBy.includes(window.userKey)) return;

    campaign.likes = (campaign.likes || 0) + 1;
    if(!campaign.likedBy) campaign.likedBy = [];
    campaign.likedBy.push(window.userKey);

    window.updateUI(); 
    window.renderSharedMarketingBoard();
    window.showNotification("친구의 멋진 마케팅 전략을 응원했습니다!");

    // 좋아요를 받은 학생에게 예산, 방문객, 평판 소량 지급
    try {
        const targetRef = doc(db, "classes", window.classKey, "students", targetAuthorKey);
        await setDoc(targetRef, {
            budget: window.fsIncrement(30),
            visitorCount: window.fsIncrement(5),
            reputation: window.fsIncrement(1)
        }, { merge: true });
    } catch(e) { console.error("좋아요 보상 지급 실패", e); }
}

// 건물 건설 로직 및 기타 기존 로직 유지
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
    
    if(isSubNav) {
        if(tabId.startsWith('stage1')) document.getElementById('stage1Nav').classList.add('active');
        if(tabId.startsWith('stage2')) document.getElementById('stage2Nav').classList.add('active'); // 💡 사이드바 메뉴 활성화 처리
    } else {
        if(document.getElementById('stage1SubMenu')) document.getElementById('stage1SubMenu').classList.remove('active');
        if(document.getElementById('stage2SubMenu')) document.getElementById('stage2SubMenu').classList.remove('active');
    }
    
    if(tabId.startsWith('stage-map')) document.getElementById('stageMapNav').classList.add('active');
    
    document.getElementById('topbarTitle').innerText = title; window.updateUI(); 
}

window.toggleStage1Menu = function(element) {
    const menu = document.getElementById('stage1SubMenu'); menu.classList.toggle('active'); element.classList.add('active');
    if(document.getElementById('stageMapNav')) document.getElementById('stageMapNav').classList.remove('active'); 
    if(document.getElementById('stageMapSubMenu')) document.getElementById('stageMapSubMenu').classList.remove('active');
    if(document.getElementById('teacherNav')) document.getElementById('teacherNav').classList.remove('active'); 
    if(document.getElementById('stage2SubMenu')) document.getElementById('stage2SubMenu').classList.remove('active');
    document.getElementById('stage2Nav').classList.remove('active'); document.getElementById('stage3Nav').classList.remove('active');
    if(menu.classList.contains('active')) window.switchTab('stage1-1', menu.querySelector('.sub-nav-item'), '1) 우리 지역의 문제를 탐색하고 해결 방안을 제안해요.', true);
}

// 💡 신규: 홍보해요 서브메뉴 토글 로직
window.toggleStage2Menu = function(element) {
    const menu = document.getElementById('stage2SubMenu'); menu.classList.toggle('active'); element.classList.add('active');
    if(document.getElementById('stageMapNav')) document.getElementById('stageMapNav').classList.remove('active'); 
    if(document.getElementById('stageMapSubMenu')) document.getElementById('stageMapSubMenu').classList.remove('active');
    if(document.getElementById('stage1Nav')) document.getElementById('stage1Nav').classList.remove('active');
    if(document.getElementById('stage1SubMenu')) document.getElementById('stage1SubMenu').classList.remove('active');
    if(document.getElementById('teacherNav')) document.getElementById('teacherNav').classList.remove('active'); 
    document.getElementById('stage3Nav').classList.remove('active');
    if(menu.classList.contains('active')) window.switchTab('stage2-1', menu.querySelector('.sub-nav-item'), '1) 우리 지역을 어떻게 알릴지 계획해요', true);
}

window.switchInnerTab = function(innerTabId, element) { const parentPanel = element.closest('.tab-panel'); parentPanel.querySelectorAll('.inner-tab-panel').forEach(t => t.classList.remove('active')); parentPanel.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active')); document.getElementById(innerTabId).classList.add('active'); element.classList.add('active'); }
window.showNotification = function(msg) { const noti = document.getElementById('notification'); noti.innerText = msg; noti.classList.add('show'); setTimeout(() => noti.classList.remove('show'), 3500); }