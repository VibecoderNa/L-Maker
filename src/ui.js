// ui.js - 화면 그리기, 탭 전환, 시각적 요소(UI) 전담

window.currentEditingProposalId = null;
window.currentEditingCampaignId = null;

// 💡 수정됨: 해시태그 관련 UI를 예시 카드에서 깔끔하게 삭제했습니다.
window.renderProblemBoard = function() {
    const board = document.getElementById('problemBoard'); if(!board) return;
    
    let vipGuide = window.userKey === "0" ? `<div style="background:var(--accent); color:white; padding:8px; border-radius:8px; font-size:12px; font-weight:bold; text-align:center; margin-bottom:10px; animation: popIn 0.5s ease-out;">👉 심사위원님, 이 주제를 클릭해 주세요!</div>` : '';

    board.innerHTML = `<div class="board-item-selectable" style="background: var(--note-1);" onclick="window.selectProblem(this, '초등학교 앞 횡단보도 고장 방치')">${vipGuide}<div class="author-tag">👤 예시 자료</div><strong style="font-size: 18px; margin-bottom: 5px;">초등학교 앞 횡단보도 고장 방치</strong><div style="font-size: 14px; margin-top: 5px;">신호등이 고장나서 위험합니다.</div></div>`;
    if(window.gameState.problems) {
        window.gameState.problems.forEach((p, index) => {
            let tagsContainer = '';
            if (p.keywords && p.keywords.length > 0) {
                const tagHtml = p.keywords.map(kw => `<span class="tag">${kw}</span>`).join('');
                tagsContainer = `<div style="margin-top: auto; padding-top: 10px;">${tagHtml}</div>`;
            }
            
            let imageHtml = p.imageUrl ? `<img src="${p.imageUrl}" class="board-image">` : '';
            let deleteBtnHtml = window.isTeacherMode ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('problem', ${index})"><i class="fa-solid fa-trash"></i></button>` : '';
            board.innerHTML += `<div class="board-item-selectable" style="background: ${p.color}; position:relative;" onclick="window.selectProblem(this, '${p.title}')">${deleteBtnHtml}<div class="author-tag">👤 ${p.author}</div><strong style="font-size: 18px; margin-bottom: 5px;">${p.title}</strong>${imageHtml}<div style="font-size: 14px; margin-top: 5px; line-height: 1.4;">${p.content}</div>${tagsContainer}</div>`;
        });
    }
}

window.selectProblem = function(element, desc) {
    document.querySelectorAll('#problemBoard .board-item-selectable').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected'); window.currentSelectedProblem = desc;
    const displayEl = document.getElementById('selectedProblemDisplay'); displayEl.style.display = 'block'; displayEl.innerHTML = `💡 해결할 주제: <span style="color:var(--primary);">${desc}</span>`;
    
    window.currentEditingProposalId = null; 
    
    if(window.userKey === "0") {
        document.getElementById('proposalText').value = "[1. 문제 원인 분석]\n신고 방법 잘 모름: 고장이 나도 어른들이 바빠서 바로 신고하지 않거나, 어디에 연락해야 하는지 모릅니다.\n점검 시간과 예산 부족: 관공서에서 매일 모든 신호등을 점검하기 어렵고, 수리하는 데 시간이 걸립니다.\n\n[2. 구체적인 해결 방안]\n어린이 안전 감시단: 등하굣길에 고장 난 신호등을 발견하면 선생님이나 배움터지킴이 어르신께 즉시 알립니다.\nQR코드 간편 신고판: 신호등 기둥의 QR코드를 찍으면 10초 만에 구청에 신고되는 시스템을 만듭니다.\n스마트 안내판: 수리 전까지는 움직임을 감지하는 노란색 안내판을 세워 운전자에게 주의를 줍니다.\n\n[3. 기대 효과]\n빠른 수리와 안전: 신고와 수리가 빨라져 교통사고를 미리 막을 수 있습니다.\n우리 동네 관심 증가: 학생과 주민들이 동네 안전에 더 많은 관심을 갖게 됩니다.";
    } else {
        document.getElementById('proposalText').value = "[1. 문제 원인 분석]\n이 문제는 왜 발생했을까요?\n👉 \n\n[2. 구체적인 해결 방안]\n어떻게 해결할 수 있을지 아이디어를 적어주세요.\n👉 \n\n[3. 기대 효과]\n문제가 해결되면 우리 지역 사람들에게 어떤 도움이 될까요?\n👉 \n";
    }
    
    window.showNotification("주제가 선택되었습니다. 제안서를 작성해주세요."); 
    window.switchInnerTab('inner-proposal', document.querySelectorAll('#stage1-1 .sub-tab-btn')[2]);
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
        if(p.status === 'waiting') statusBadge = `<span style="background:#fef08a; color:#854d0e; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">⏳ 선생님 확인 대기중</span>`;
        else if(p.status === 'approved') statusBadge = `<span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">✅ 선생님 최종 승인</span>`;
        else if(p.status === 'rejected') statusBadge = `<span style="background:#fecaca; color:#991b1b; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">❌ 재검토 요망</span>`;

        let feedbackHtml = `<div style="font-size:13px; background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:8px; border:1px solid rgba(2, 132, 199, 0.2); margin-top:10px;"><strong>🤖 AI 1차 의견:</strong> ${p.aiFeedback || ""} <span style="color:var(--primary); font-weight:bold;">(기본 획득: ${p.aiBudget || 0}G)</span></div>`;
        
        if(p.status !== 'waiting' && p.teacherFeedback) {
            feedbackHtml += `<div style="font-size:13px; margin-top:10px; background:rgba(22, 163, 74, 0.1); padding:10px; border-radius:6px; border:1px solid rgba(22, 163, 74, 0.3);"><strong>👨‍🏫 선생님 코멘트:</strong> ${p.teacherFeedback} <br><span style="color:var(--accent); font-weight:bold;">(+ 추가 예산: ${p.teacherBudget || 0}G)</span></div>`;
        }

        let safeProposal = p.proposal || "";

        board.innerHTML += `
        <div style="position:relative; background:#f8fafc; padding:20px; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:10px;">
            ${deleteBtnHtml}
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="author-tag" style="margin:0; font-size:14px;">👤 작성자: ${p.author || "익명"}</div>
                ${statusBadge}
            </div>
            <strong style="color:var(--primary); font-size:16px;">주제: ${p.problem || "미지정"}</strong>
            <div style="font-size:14px; line-height:1.6; background:#ffffff; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">${safeProposal.replace(/\n/g, '<br>')}</div>
            <div style="margin-top:auto;">${feedbackHtml}</div>
        </div>`;
    });
}

window.renderMyProposals = function() {
    const list = document.getElementById('myProposalsList');
    if(!list) return;
    
    const myProps = window.gameState.submittedProposals.filter(p => String(p.authorId) === String(window.userKey));
    if(myProps.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px; background:#f8fafc; border-radius:8px; border:1px dashed var(--border-color);">아직 내가 제출한 제안서가 없습니다.</div>';
        return;
    }
    
    let html = '';
    myProps.forEach(p => {
        let statusHtml = '';
        let btnHtml = '';
        
        if(p.status === 'waiting') {
            statusHtml = '<span style="color:#d97706; font-weight:bold; background:#fef08a; padding:4px 8px; border-radius:4px; font-size:12px;">⏳ 심사 대기중</span>';
        } else if(p.status === 'approved') {
            statusHtml = '<span style="color:#166534; font-weight:bold; background:#bbf7d0; padding:4px 8px; border-radius:4px; font-size:12px;">✅ 승인 완료</span>';
        } else if(p.status === 'rejected') {
            statusHtml = '<span style="color:#991b1b; font-weight:bold; background:#fecaca; padding:4px 8px; border-radius:4px; font-size:12px;">❌ 재검토 요망</span>';
            btnHtml = `<button class="action-btn accent-btn" style="margin-top:15px; padding:10px 15px; font-size:14px;" onclick="window.editMyProposal(${p.id})"><i class="fa-solid fa-pen"></i> 다시 작성하기</button>`;
        }
        
        html += `<div style="background:#ffffff; border:1px solid var(--border-color); padding:20px; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                <strong style="color:var(--primary); font-size:16px;">주제: ${p.problem}</strong>
                <div>${statusHtml}</div>
            </div>
            <div style="font-size:14px; color:var(--text-main); margin-bottom:15px; line-height:1.6; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">${(p.proposal||'').replace(/\n/g, '<br>')}</div>
            ${p.teacherFeedback ? `<div style="font-size:14px; background:#fef2f2; padding:12px; border-radius:8px; color:#991b1b; border:1px solid #fca5a5;"><strong>👨‍🏫 선생님 코멘트:</strong> ${p.teacherFeedback}</div>` : ''}
            ${btnHtml}
        </div>`;
    });
    list.innerHTML = html;
}

window.editMyProposal = function(id) {
    const p = window.gameState.submittedProposals.find(x => x.id === id);
    if(!p) return;
    
    window.currentEditingProposalId = id; 
    window.currentSelectedProblem = p.problem;
    
    document.getElementById('selectedProblemDisplay').style.display = 'block';
    document.getElementById('selectedProblemDisplay').innerHTML = `💡 해결할 주제: <span style="color:var(--primary);">${p.problem}</span>`;
    document.getElementById('proposalText').value = p.proposal; 
    
    window.switchInnerTab('inner-proposal', document.querySelectorAll('#stage1-1 .sub-tab-btn')[2]);
    window.showNotification("기존 내용을 불러왔습니다. 수정하여 다시 제출해주세요.");
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

window.goToPromoStep2 = function() {
    const topic = document.getElementById('promoTopic').value.trim();
    const target = document.getElementById('promoTarget').value.trim();
    let slogan = document.getElementById('promoSlogan').value.trim().replace(/^["']+|["']+$/g, '');
    
    // 💡 수정됨: 딱딱한 alert를 부드러운 showNotification으로 교체[cite: 3]
    if(!topic || !target || !slogan) {
        return window.showNotification("홍보 대상, 타겟 설정, 핵심 슬로건을 모두 작성해주세요.");
    }
    
    document.getElementById('displayStrategyTopic').innerText = topic;
    document.getElementById('displayStrategyTarget').innerText = target;
    document.getElementById('displayStrategySlogan').innerText = `"${slogan}"`;
    
    window.currentEditingCampaignId = null;
    
    if(window.userKey === "0") {
        document.getElementById('promoContentInput').value = "[기획 제목] 초등학생 추천! 우리 동네 스탬프 투어 팸플릿\n[기획 의도]\n다른 지역 친구들과 가족들이 주말에 찾아오기 쉽게, 어린이 시선에서 재미있는 코스를 정리한 팸플릿을 만듭니다.\n[홍보 문구 및 내용]\n1. 핵심 문구: \"이번 주말 어디 가지? 초등학생이 찾아낸 우리 동네 보물지도로 출발!\"\n2. 추천 코스:\n - 1코스: 자연 속 생태 체험장\n - 2코스: 맛있는 특산물 맛집과 시장\n - 3코스: 재미있는 박물관과 공예 체험\n3. 특별 이벤트: 3개 코스 도장을 다 찍어오면 우리 동네 귀여운 캐릭터 인형을 선물로 드립니다!\n[기대 효과]\n인근 학교와 도서관에 배포하여 주말에 놀러 오는 가족 손님을 늘리고 우리 동네를 널리 알립니다.";
        document.querySelectorAll('input[name="mediaOption"]')[0].checked = true;
    } else {
        document.getElementById('promoContentInput').value = '';
    }
    
    window.showNotification("전략 수립 완료! 멋진 포스터와 기획안을 작성해보세요.");
    window.switchInnerTab('inner-promo-campaign', document.querySelectorAll('#stage2-1 .sub-tab-btn')[1]);
}

window.renderMyCampaigns = function() {
    const list = document.getElementById('myCampaignsList');
    if(!list) return;
    
    const myCamps = window.gameState.marketingCampaigns.filter(c => String(c.authorKey) === String(window.userKey));
    if(myCamps.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px; background:#f8fafc; border-radius:8px; border:1px dashed var(--border-color);">아직 제출한 홍보 방법이 없습니다.</div>';
        return;
    }
    
    let html = '';
    myCamps.forEach(c => {
        let statusHtml = '';
        let btnHtml = '';
        
        if(c.status === 'waiting') {
            statusHtml = '<span style="color:#d97706; font-weight:bold; background:#fef08a; padding:4px 8px; border-radius:4px; font-size:12px;">⏳ 심사 대기중</span>';
        } else if(c.status === 'approved') {
            statusHtml = '<span style="color:#166534; font-weight:bold; background:#bbf7d0; padding:4px 8px; border-radius:4px; font-size:12px;">✅ 홍보 성공!</span>';
        } else if(c.status === 'rejected') {
            statusHtml = '<span style="color:#991b1b; font-weight:bold; background:#fecaca; padding:4px 8px; border-radius:4px; font-size:12px;">❌ 재검토 요망</span>';
            btnHtml = `<button class="action-btn accent-btn" style="margin-top:15px; padding:10px 15px; font-size:14px;" onclick="window.editMyCampaign(${c.id})"><i class="fa-solid fa-pen"></i> 다시 작성하기</button>`;
        }
        
        let cleanSlogan = (c.slogan || "").replace(/^["']+|["']+$/g, '');

        html += `<div style="background:#ffffff; border:1px solid var(--border-color); padding:20px; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center;">
                <strong style="color:var(--primary); font-size:16px;">매체: ${c.media} (${c.cost}G)</strong>
                <div>${statusHtml}</div>
            </div>
            <div style="font-weight:bold; margin-bottom:5px;">"${cleanSlogan}"</div>
            <div style="font-size:14px; color:var(--text-main); margin-bottom:15px; line-height:1.6; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">${(c.content||'').replace(/\n/g, '<br>')}</div>
            ${c.teacherFeedback ? `<div style="font-size:14px; background:#fef2f2; padding:12px; border-radius:8px; color:#991b1b; border:1px solid #fca5a5;"><strong>👨‍🏫 선생님 코멘트:</strong> ${c.teacherFeedback}</div>` : ''}
            ${btnHtml}
        </div>`;
    });
    list.innerHTML = html;
}

window.editMyCampaign = function(id) {
    const c = window.gameState.marketingCampaigns.find(x => x.id === id);
    if(!c) return;
    
    window.currentEditingCampaignId = id; 
    let cleanSlogan = (c.slogan || "").replace(/^["']+|["']+$/g, '');
    
    document.getElementById('displayStrategyTopic').innerText = c.topic;
    document.getElementById('displayStrategyTarget').innerText = c.target;
    document.getElementById('displayStrategySlogan').innerText = `"${cleanSlogan}"`;
    document.getElementById('promoContentInput').value = c.content; 
    
    window.switchInnerTab('inner-promo-campaign', document.querySelectorAll('#stage2-1 .sub-tab-btn')[1]);
    window.showNotification("기존 내용을 불러왔습니다. 예산과 내용을 보완하여 다시 제출해주세요.");
}

window.executeCampaign = async function() {
    const topic = document.getElementById('displayStrategyTopic').innerText;
    const target = document.getElementById('displayStrategyTarget').innerText;
    const slogan = document.getElementById('displayStrategySlogan').innerText.replace(/^["']+|["']+$/g, '');
    const content = document.getElementById('promoContentInput').value.trim();
    
    // 💡 수정됨: alert 교체[cite: 3]
    if(!content) return window.showNotification("상세 기획안 및 홍보 문구를 작성해주세요.");

    let mediaName = "";
    let cost = 0;
    const radio = document.querySelector('input[name="mediaOption"]:checked');
    if(!radio) return window.showNotification("광고 매체를 선택해주세요.");

    if(radio.value === 'custom') {
        mediaName = document.getElementById('customMediaName').value.trim();
        cost = parseInt(document.getElementById('customMediaBudget').value);
        // 💡 수정됨: alert 교체[cite: 3]
        if(!mediaName || isNaN(cost) || cost <= 0) return window.showNotification("자율 매체명과 필요 예산을 올바르게 입력해주세요.");
    } else {
        mediaName = radio.getAttribute('data-name');
        cost = parseInt(radio.value);
    }

    if(window.gameState.budget < cost) {
        // 💡 수정됨: alert 교체[cite: 3]
        return window.showNotification(`예산 부족! (현재 보유: ${window.gameState.budget}G / 필요 예산: ${cost}G)\n기호를 등록하거나 친구에게 좋아요를 받으세요.`);
    }

    let imageUrl = null;
    const photoFile = document.getElementById('promoImageInput').files[0];
    if(photoFile) {
        try {
            const imagePart = await window.getBase64(photoFile);
            imageUrl = imagePart.dataUrl;
        } catch(e) { console.error("이미지 업로드 실패", e); }
    }

    window.gameState.budget -= cost;

    const expectedVis = Math.floor(cost * (Math.random() * 0.5 + 0.8));
    const expectedRep = Math.floor((cost / 20) * (Math.random() * 0.5 + 0.8));

    if (window.currentEditingCampaignId) {
        const index = window.gameState.marketingCampaigns.findIndex(x => x.id === window.currentEditingCampaignId);
        if (index !== -1) {
            const c = window.gameState.marketingCampaigns.splice(index, 1)[0];
            c.topic = topic;
            c.target = target;
            c.slogan = slogan;
            if(imageUrl) c.imageUrl = imageUrl;
            c.media = mediaName;
            c.cost = cost;
            c.content = content;
            c.expectedVisitor = expectedVis;
            c.expectedReputation = expectedRep;
            c.status = 'waiting';
            c.teacherFeedback = ''; 
            
            window.gameState.marketingCampaigns.unshift(c);
        }
        window.currentEditingCampaignId = null; 
    } else {
        const campaign = {
            id: Date.now(),
            author: `${document.getElementById('numInput').value}번 시장님`,
            authorKey: window.userKey,
            topic: topic,
            target: target,
            slogan: slogan,
            imageUrl: imageUrl, 
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
    }

    window.updateUI();
    window.renderSharedMarketingBoard();

    document.getElementById('campaignResultArea').style.display = 'block';
    document.getElementById('campaignFeedback').innerHTML = `
        <div style="font-size:18px; margin-bottom:10px;"><strong>🤝 기획안 검토 중입니다!</strong></div>
        "${mediaName}" 매체를 활용한 전략이 성공적으로 제출되었습니다.<br>
        현재 👨‍🏫 <strong>선생님</strong>과 🤖 <strong>AI 홍보 담당관</strong>이 시장님의 전략을 검토하며 최종 성과를 의논하고 있습니다. 승인을 기다려주세요!
    `;
    
    window.showNotification("홍보 방법이 성공적으로 제출되었습니다!");
}

window.renderSharedMarketingBoard = function() {
    const board = document.getElementById('sharedMarketingBoard'); if(!board) return; board.innerHTML = '';
    
    const approvedCampaigns = (window.gameState.marketingCampaigns || []).filter(c => c && c.status === 'approved');

    if(approvedCampaigns.length === 0) {
        board.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">아직 선생님이 최종 승인한 마케팅 전략이 없습니다. 멋진 기획을 올려 첫 번째 마케터가 되어보세요!</div>'; return;
    }

    approvedCampaigns.forEach((c) => {
        const hasLiked = c.likedBy && c.likedBy.includes(window.userKey);
        let likeBtn = `<button style="background:${hasLiked ? 'var(--primary)' : '#f1f5f9'}; color:${hasLiked ? 'white' : 'var(--text-main)'}; border:1px solid var(--border-color); padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold; margin-top:10px; width:100%; transition:0.2s;" onclick="window.likeCampaign(${c.id}, '${c.authorKey}')" ${hasLiked ? 'disabled' : ''}>
            👍 친구 응원하기 (좋아요 ${c.likes || 0})
        </button>`;

        let imageHtml = c.imageUrl ? `<img src="${c.imageUrl}" style="width: 100%; max-height: 200px; object-fit: contain; background: #e2e8f0; border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--border-color);">` : '';
        
        let safeContent = c.content || "";
        let contentHtml = safeContent.replace(/\n/g, '<br>');
        let safeTopic = c.topic || "미지정";
        let safeTarget = c.target || "미지정";
        let safeMedia = c.media || "미지정";
        
        let cleanSlogan = (c.slogan || "").replace(/^["']+|["']+$/g, '');

        let metricsHtml = `<div style="background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:8px; margin-top:10px; font-size:13px; text-align:center;">
            <strong>🎉 홍보 효과:</strong> 방문객 <span style="color:#d97706">+${c.expectedVisitor || 0}명</span> | 평판 <span style="color:#ef4444">+${c.expectedReputation || 0}점</span>
        </div>`;

        let deleteBtnHtml = window.isTeacherMode ? `<button class="delete-btn" onclick="event.stopPropagation(); window.deleteItem('campaign', ${c.id})"><i class="fa-solid fa-trash"></i></button>` : '';

        board.innerHTML += `
        <div style="position:relative; background:#ffffff; padding:20px; border-radius:12px; border:1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:10px;">
            ${deleteBtnHtml}
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="author-tag" style="margin:0; font-size:14px;">👤 ${c.author || "익명"}</div>
                <span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">✅ 홍보 성공!</span>
            </div>
            
            ${imageHtml}
            
            <div style="font-size: 13px; color: var(--text-muted); background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 5px;">
                <div style="margin-bottom: 3px;"><strong style="color:var(--primary);">🎯 홍보 대상:</strong> ${safeTopic}</div>
                <div><strong style="color:var(--primary);">👥 타겟 설정:</strong> ${safeTarget}</div>
            </div>
            
            <div style="font-size: 16px; font-weight: bold; color: var(--text-main); margin-bottom: 5px; margin-top: 5px;">"${cleanSlogan}"</div>
            
            <div style="font-size:14px; line-height:1.6; background:#ffffff; padding:12px; border-radius:8px; border:1px solid #e2e8f0; color:#1e293b;">${contentHtml}</div>
            
            <div style="font-size:13px; color:var(--text-muted); margin-top: 5px;"><i class="fa-solid fa-bullhorn"></i> 사용 매체: ${safeMedia} (${c.cost || 0}G)</div>
            
            ${metricsHtml}
            <div style="margin-top:auto;">
                ${likeBtn}
            </div>
        </div>`;
    });
}

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

    try {
        const targetRef = doc(db, "classes", window.classKey, "students", targetAuthorKey);
        await setDoc(targetRef, {
            budget: window.fsIncrement(30),
            visitorCount: window.fsIncrement(5),
            reputation: window.fsIncrement(1)
        }, { merge: true });
    } catch(e) { console.error("좋아요 보상 지급 실패", e); }
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
    if(!b || window.gameState.builtBuildings.includes(id) || window.gameState.budget < b.costBudget || window.gameState.visitorCount < b.reqVisitor || window.gameState.reputation < b.reqReputation) {
        return window.showNotification("조건 부족.");
    }
    
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
        if(tabId.startsWith('stage2')) document.getElementById('stage2Nav').classList.add('active');
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

window.toggleStage2Menu = function(element) {
    const menu = document.getElementById('stage2SubMenu'); menu.classList.toggle('active'); element.classList.add('active');
    if(document.getElementById('stageMapNav')) document.getElementById('stageMapNav').classList.remove('active'); 
    if(document.getElementById('stageMapSubMenu')) document.getElementById('stageMapSubMenu').classList.remove('active');
    if(document.getElementById('stage1Nav')) document.getElementById('stage1Nav').classList.remove('active');
    if(document.getElementById('stage1SubMenu')) document.getElementById('stage1SubMenu').classList.remove('active');
    if(document.getElementById('teacherNav')) document.getElementById('teacherNav').classList.remove('active'); 
    document.getElementById('stage3Nav').classList.remove('active');
    if(menu.classList.contains('active')) window.switchTab('stage2-1', menu.querySelector('.sub-nav-item'), '1) 홍보 계획 세우기', true);
}

window.switchInnerTab = function(innerTabId, element) { 
    const parentPanel = element.closest('.tab-panel'); 
    parentPanel.querySelectorAll('.inner-tab-panel').forEach(t => t.classList.remove('active')); 
    parentPanel.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(innerTabId).classList.add('active'); 
    element.classList.add('active'); 
}

window.showNotification = function(msg) { const noti = document.getElementById('notification'); noti.innerText = msg; noti.classList.add('show'); setTimeout(() => noti.classList.remove('show'), 3500); }