import { db } from './firebase.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.saveApiKey = async function() { 
    const key = document.getElementById('teacherApiKey').value.trim(); 
    if(!key) return alert("API 키를 입력해주세요."); 
    window.dynamicApiKey = key; window.safeSetItem('local_maker_api_key', key); 
    if (window.classKey && window.classKey !== 'teacher_temp_global') { 
        await setDoc(doc(db, "classes", window.classKey), { apiKey: key }, { merge: true }); 
    } 
    window.showNotification("✅ API 키가 성공적으로 저장되었습니다."); 
}

window.generateClassCode = async function() { 
    const regionSelect = document.getElementById('teacherRegionSelect'); 
    const regionVal = regionSelect.value; 
    const regionName = regionSelect.options[regionSelect.selectedIndex].text; 
    
    if(!regionVal) return alert("학급을 개설할 지역을 먼저 선택해주세요.");

    const randomNum = Math.floor(1000 + Math.random() * 9000).toString(); 
    const code = `${regionVal}_${randomNum}`; 
    
    await setDoc(doc(db, "classes", code), { apiKey: "", problems:[], submittedProposals:[], promoBoard:[], marketingCampaigns:[], mapMarkers:[] }); 
    
    const display = document.getElementById('generatedCodeDisplay'); display.style.display = 'block'; 
    document.getElementById('displayFinalCode').innerText = `${regionName} ${randomNum}`; 
    
    window.showNotification("새로운 학급 코드가 성공적으로 개설되었습니다!"); 
}

window.renderTeacherAnalysis = function() {
    document.getElementById('teacherOverallStats').innerHTML = '';
}

window.renderStudentMonitor = function() {
    const grid = document.getElementById('teacherStudentGrid'); grid.innerHTML = ''; const studentKeys = Object.keys(window.allStudentsData).sort((a,b) => parseInt(a) - parseInt(b));
    if(studentKeys.length === 0) { grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:30px;">아직 접속한 학생이 없습니다.</div>`; return; }
    
    studentKeys.forEach(sNum => {
        let sData = window.allStudentsData[sNum]; let sat = sData.satisfaction || 0; let isOnline = sData.isOnline === true; let cLevel = window.districtLevels[0].name; for(let lvl of window.districtLevels) { if(sat >= lvl.threshold) cLevel = lvl.name; }
        
        const waitingCount1 = window.gameState.submittedProposals.filter(p => (String(p.authorId) === String(sNum) || (p.author && p.author.startsWith(sNum + '번'))) && p.status === 'waiting').length;
        const waitingCount2 = (window.gameState.marketingCampaigns || []).filter(c => (String(c.authorKey) === String(sNum) || (c.author && c.author.startsWith(sNum + '번'))) && c.status === 'waiting').length;
        const totalWaiting = waitingCount1 + waitingCount2;
        
        const waitingBadge = totalWaiting > 0 ? `<div style="position:absolute; top:10px; left:10px; background:#ef4444; color:white; font-size:11px; font-weight:bold; padding:4px 8px; border-radius:12px; box-shadow:0 2px 5px rgba(0,0,0,0.2); animation: pulse 2s infinite; z-index:10;">승인 대기 ${totalWaiting}건</div>` : '';

        grid.innerHTML += `<div class="student-card ${isOnline ? 'online' : 'offline'}" style="position:relative;" onclick="window.showStudentDetails('${sNum}')">
            ${waitingBadge}
            <div class="status-dot" title="${isOnline ? '현재 접속 중' : '오프라인'}"></div>
            <div class="st-num">${sNum}번 학생</div><div class="st-level">${cLevel}</div>
            <div class="st-stats"><div>👥<span>${sData.visitorCount||0}</span></div><div>⭐<span>${sData.reputation||0}</span></div><div>❤️<span>${sat}</span></div></div>
        </div>`;
    });
    window.renderTeacherAnalysis();
}

// 💡 신규: 교사용 슬라이더 제어 로직
window.currentSlideIndex = { proposal: 0, campaign: 0 };
window.changeSlide = function(type, direction) {
    const slides = document.querySelectorAll(`.slide-${type}`);
    if(slides.length === 0) return;
    
    slides[window.currentSlideIndex[type]].classList.remove('active');
    window.currentSlideIndex[type] += direction;
    
    if(window.currentSlideIndex[type] < 0) window.currentSlideIndex[type] = slides.length - 1;
    if(window.currentSlideIndex[type] >= slides.length) window.currentSlideIndex[type] = 0;
    
    slides[window.currentSlideIndex[type]].classList.add('active');
    const counter = document.getElementById(`counter-${type}`);
    if(counter) counter.innerText = `${window.currentSlideIndex[type] + 1} / ${slides.length}`;
}

window.showStudentDetails = function(sNum) {
    document.getElementById('monitorGridView').style.display = 'none'; document.getElementById('monitorDetailView').style.display = 'block'; 
    const sData = window.allStudentsData[sNum] || {}; let sat = sData.satisfaction || 0; let cLevel = window.districtLevels[0].name; for(let lvl of window.districtLevels) { if(sat >= lvl.threshold) cLevel = lvl.name; }
    document.getElementById('dtNum').innerText = sNum; document.getElementById('dtLevel').innerText = cLevel; document.getElementById('dtVis').innerText = sData.visitorCount || 0; document.getElementById('dtRep').innerText = sData.reputation || 0; document.getElementById('dtSat').innerText = sat;
    
    // 💡 1. 문제 해결 방안 슬라이더 생성
    const proposals = window.gameState.submittedProposals.filter(p => String(p.authorId) === String(sNum) || (p.author && p.author.startsWith(sNum + '번'))); 
    window.currentSlideIndex.proposal = 0;
    
    let phtml = '<div class="carousel-wrapper"><div class="carousel-content" style="flex-direction: column;">'; 
    if(proposals.length === 0) {
        phtml += '<div style="color:var(--text-muted); padding: 30px;">제출한 문제 해결 방안이 없습니다.</div>';
    } else {
        proposals.forEach((p, index) => { 
            let statusBadge = p.status === 'waiting' ? '<span style="color:#d97706;">⏳ 심사 대기중</span>' : (p.status === 'approved' ? '<span style="color:#16a34a;">✅ 최종 승인됨</span>' : '<span style="color:#ef4444;">❌ 반려됨</span>');
            
            let reviewUi = '';
            if (p.status === 'waiting') {
                reviewUi = `
                    <div style="margin-top:15px; border-top:2px dashed var(--border-color); padding-top:15px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                        <strong style="color:var(--primary); font-size:14px; display:block; margin-bottom:5px;">👨‍🏫 선생님 승인 (피드백 및 예산 지급)</strong>
                        <textarea id="t-feedback-${p.id}" rows="2" placeholder="예: 훌륭한 아이디어네요! 추가 예산을 지원합니다." style="width:100%; margin:8px 0; padding:8px; border:1px solid var(--border-color); border-radius:6px; box-sizing:border-box; font-family:inherit;"></textarea>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="number" id="t-budget-${p.id}" placeholder="추가 예산" value="300" style="width:140px; padding:8px; border:1px solid var(--border-color); border-radius:6px;"> <span style="font-weight:bold; color:var(--accent);">G</span>
                            <button onclick="window.submitTeacherReview(${p.id}, true, '${sNum}')" style="margin-left:auto; background:var(--success); color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">승인하기</button>
                            <button onclick="window.submitTeacherReview(${p.id}, false, '${sNum}')" style="background:#ef4444; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">재검토</button>
                        </div>
                    </div>`;
            }

            phtml += `
            <div class="carousel-slide slide-proposal ${index === 0 ? 'active' : ''}">
                <div style="background:#f1f5f9; padding:20px; border-radius:12px; border: 1px solid ${p.status === 'waiting' ? 'var(--accent)' : 'var(--border-color)'};">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <div style="font-weight:bold; color:var(--primary); font-size:16px;">주제: ${p.problem}</div>
                        <div style="font-size:13px; font-weight:bold;">${statusBadge}</div>
                    </div>
                    <div style="font-size:14px; line-height:1.6; color:var(--text-main); margin-bottom:15px; background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">${p.proposal.replace(/\n/g, '<br>')}</div>
                    <div style="font-size:13px; background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:6px; border:1px solid rgba(2, 132, 199, 0.2);">
                        <strong>🤖 AI 1차 평가:</strong> ${p.aiFeedback} <strong style="color:var(--primary);">(획득: ${p.aiBudget}G)</strong>
                    </div>
                    ${p.status !== 'waiting' ? `<div style="font-size:13px; margin-top:10px; background:rgba(22, 163, 74, 0.1); padding:10px; border-radius:6px; border:1px solid rgba(22, 163, 74, 0.3);"><strong>👨‍🏫 선생님 피드백:</strong> ${p.teacherFeedback} <br><span style="color:var(--accent); font-weight:bold;">(+ 추가 예산: ${p.teacherBudget}G)</span></div>` : ''}
                    ${reviewUi}
                </div>
            </div>`; 
        }); 
    }
    phtml += '</div>';
    if(proposals.length > 1) {
        phtml += `<div class="carousel-controls">
            <button class="slide-btn" onclick="window.changeSlide('proposal', -1)">◀ 이전</button>
            <span class="slide-counter" id="counter-proposal">1 / ${proposals.length}</span>
            <button class="slide-btn" onclick="window.changeSlide('proposal', 1)">다음 ▶</button>
        </div>`;
    }
    phtml += '</div>';
    document.getElementById('dtProposals').innerHTML = phtml;
    
    // 💡 2. 지역 마케팅 전략 슬라이더 생성 (undefined 해결 및 승인 UI 추가)
    const campaigns = (window.gameState.marketingCampaigns || []).filter(c => String(c.authorKey) === String(sNum) || (c.author && c.author.startsWith(sNum + '번'))); 
    window.currentSlideIndex.campaign = 0;

    let chtml = '<div class="carousel-wrapper"><div class="carousel-content" style="flex-direction: column;">';
    if(campaigns.length === 0) {
        chtml += '<div style="color:var(--text-muted); padding: 30px;">제출한 마케팅 전략이 없습니다.</div>';
    } else {
        campaigns.forEach((c, index) => {
            let statusBadge = c.status === 'waiting' ? '<span style="color:#d97706;">⏳ 승인 대기중</span>' : '<span style="color:#16a34a;">✅ 승인 완료</span>';
            
            let reviewUi = '';
            if (c.status === 'waiting') {
                reviewUi = `
                    <div style="margin-top:15px; border-top:2px dashed var(--border-color); padding-top:15px;">
                        <strong style="color:var(--primary); font-size:14px; display:block; margin-bottom:5px;">👨‍🏫 마케팅 전략 승인 (방문객 및 평판 확정)</strong>
                        <textarea id="c-feedback-${c.id}" rows="2" placeholder="예: 멋진 전략이네요! 예산 집행을 승인합니다." style="width:100%; margin:8px 0; padding:8px; border:1px solid var(--border-color); border-radius:6px; box-sizing:border-box; font-family:inherit;"></textarea>
                        <div style="display:flex; justify-content: flex-end; gap:10px;">
                            <button onclick="window.submitCampaignReview(${c.id}, true, '${sNum}')" style="background:var(--success); color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">승인 및 성과 지급</button>
                            <button onclick="window.submitCampaignReview(${c.id}, false, '${sNum}')" style="background:#ef4444; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">재검토</button>
                        </div>
                    </div>`;
            }

            let imageHtml = c.imageUrl ? `<img src="${c.imageUrl}" style="width: 100%; max-height: 250px; object-fit: contain; background: #e2e8f0; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--border-color);">` : '';

            chtml += `
            <div class="carousel-slide slide-campaign ${index === 0 ? 'active' : ''}">
                <div style="background:#f1f5f9; padding:20px; border-radius:12px; border: 1px solid ${c.status === 'waiting' ? 'var(--accent)' : 'var(--border-color)'};">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <div style="font-weight:bold; color:var(--primary); font-size:16px;">마케팅 매체: ${c.media} (${c.cost}G)</div>
                        <div style="font-size:13px; font-weight:bold;">${statusBadge}</div>
                    </div>
                    
                    ${imageHtml}
                    
                    <div style="font-size: 13px; color: var(--text-muted);">대상: ${c.topic} | 타겟: ${c.target}</div>
                    <div style="font-size: 16px; font-weight: bold; color: var(--text-main); margin-bottom: 10px;">"${c.slogan}"</div>
                    <div style="font-size:14px; line-height:1.6; color:var(--text-main); margin-bottom:15px; background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">${c.content.replace(/\n/g, '<br>')}</div>
                    
                    <div style="font-size:13px; background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:6px; border:1px solid rgba(2, 132, 199, 0.2);">
                        <strong>📊 AI 1차 예상 성과:</strong> 방문객 <span style="color:#d97706;">+${c.expectedVisitor}명</span> | 평판 <span style="color:#ef4444;">+${c.expectedReputation}점</span>
                    </div>
                    
                    ${c.status !== 'waiting' && c.teacherFeedback ? `<div style="font-size:13px; margin-top:10px; background:rgba(22, 163, 74, 0.1); padding:10px; border-radius:6px; border:1px solid rgba(22, 163, 74, 0.3);"><strong>👨‍🏫 선생님 코멘트:</strong> ${c.teacherFeedback}</div>` : ''}
                    
                    ${reviewUi}
                </div>
            </div>`;
        });
    }
    chtml += '</div>';
    if(campaigns.length > 1) {
        chtml += `<div class="carousel-controls">
            <button class="slide-btn" onclick="window.changeSlide('campaign', -1)">◀ 이전</button>
            <span class="slide-counter" id="counter-campaign">1 / ${campaigns.length}</span>
            <button class="slide-btn" onclick="window.changeSlide('campaign', 1)">다음 ▶</button>
        </div>`;
    }
    chtml += '</div>';
    document.getElementById('dtPromos').innerHTML = chtml;
    
    // 3. 지도 등록 기호 (패들렛 유지)
    const markers = window.gameState.mapMarkers.filter(m => String(m.author) === String(sNum) || String(m.authorId) === String(sNum) || (m.author && m.author.startsWith(sNum + '번'))); 
    let mhtml = ''; if(markers.length===0) mhtml = '<div style="color:var(--text-muted); grid-column:1/-1;">등록한 기호가 없습니다.</div>';
    markers.forEach(m => { mhtml += `<div style="background:#f8fafc; border:1px solid var(--border-color); padding:10px; border-radius:8px; display:flex; align-items:center; gap:15px;"><img src="${m.imgData}" style="width:50px; height:50px; background:white; border-radius:8px; object-fit:contain;"><div><strong style="color:var(--text-main); display:block;">${m.placeName}</strong><span style="color:var(--text-muted); font-size:12px;">${m.legendDesc}</span></div></div>`; }); document.getElementById('dtMarkers').innerHTML = mhtml;
}

// 1단계: 해결 제안서 선생님 승인 로직
window.submitTeacherReview = async function(proposalId, isApproved, sNum) {
    const feedbackEl = document.getElementById(`t-feedback-${proposalId}`);
    const budgetEl = document.getElementById(`t-budget-${proposalId}`);
    const feedbackText = feedbackEl.value.trim() || (isApproved ? '훌륭한 제안입니다! 우리 지역을 위해 꼭 필요한 아이디어네요.' : '조금 더 구체적이고 현실적인 방안으로 수정해서 다시 제안해주세요.');
    const extraBudget = isApproved ? (parseInt(budgetEl.value) || 0) : 0;

    const targetProposal = window.gameState.submittedProposals.find(p => p.id === proposalId);
    if(!targetProposal) return alert("제안서를 찾을 수 없습니다.");

    targetProposal.status = isApproved ? 'approved' : 'rejected';
    targetProposal.teacherFeedback = feedbackText;
    targetProposal.teacherBudget = extraBudget;

    await window.saveGameState(); 

    if(isApproved && extraBudget > 0) {
        try {
            const targetStudentKey = targetProposal.authorId;
            if(targetStudentKey) {
                const studentRef = doc(db, "classes", window.classKey, "students", targetStudentKey);
                const snap = await getDoc(studentRef);
                if(snap.exists()) {
                    const currentBudget = snap.data().budget || 0;
                    await setDoc(studentRef, { budget: currentBudget + extraBudget }, { merge: true });
                }
            }
        } catch(e) { console.error("학생 예산 추가 지급 오류", e); }
    }

    window.showNotification(isApproved ? `승인 완료! 학생에게 추가 예산 ${extraBudget}G가 지급되었습니다.` : "재검토(반려) 처리되었습니다.");
    window.showStudentDetails(sNum); 
    window.renderStudentMonitor(); 
}

// 💡 2단계: 마케팅 전략 선생님 승인 로직 신설
window.submitCampaignReview = async function(campaignId, isApproved, sNum) {
    const feedbackEl = document.getElementById(`c-feedback-${campaignId}`);
    const feedbackText = feedbackEl.value.trim() || (isApproved ? '멋진 마케팅 전략입니다! 예산이 성공적으로 집행되었습니다.' : '전략을 조금 더 보완해서 다시 제출해주세요.');

    const targetCampaign = window.gameState.marketingCampaigns.find(c => c.id === campaignId);
    if(!targetCampaign) return alert("캠페인을 찾을 수 없습니다.");

    targetCampaign.status = isApproved ? 'approved' : 'rejected';
    targetCampaign.teacherFeedback = feedbackText;

    await window.saveGameState();

    if(isApproved) {
        try {
            const targetStudentKey = targetCampaign.authorKey;
            if(targetStudentKey) {
                const studentRef = doc(db, "classes", window.classKey, "students", targetStudentKey);
                await setDoc(studentRef, {
                    visitorCount: window.fsIncrement(targetCampaign.expectedVisitor),
                    reputation: window.fsIncrement(targetCampaign.expectedReputation)
                }, { merge: true });
            }
        } catch(e) { console.error("성과 지급 오류", e); }
    }

    window.showNotification(isApproved ? "마케팅 전략이 승인되어 방문객/평판이 지급되었습니다." : "재검토(반려) 처리되었습니다.");
    window.showStudentDetails(sNum);
    window.renderStudentMonitor();
}

window.hideStudentDetails = function() { document.getElementById('monitorDetailView').style.display = 'none'; document.getElementById('monitorGridView').style.display = 'block'; }

window.deleteItem = function(type, indexOrId) {
    if(!confirm("⚠️ 해당 게시물을 완전히 삭제하시겠습니까?")) return;
    if(type === 'problem') { window.gameState.problems.splice(indexOrId, 1); window.renderProblemBoard(); } 
    else if (type === 'proposal') { window.gameState.submittedProposals.splice(indexOrId, 1); window.renderSharedProposals(); } 
    else if (type === 'campaign') { window.gameState.marketingCampaigns = window.gameState.marketingCampaigns.filter(c => c.id !== indexOrId); window.renderSharedMarketingBoard(); }
    window.saveGameState(); window.showNotification("게시물이 관리자 권한으로 삭제되었습니다.");
}