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
    const randomNum = Math.floor(1000 + Math.random() * 9000).toString(); 
    const code = `${regionVal}_${randomNum}`; 
    
    await setDoc(doc(db, "classes", code), { apiKey: "", problems:[], submittedProposals:[], promoBoard:[], mapMarkers:[] }); 
    
    const display = document.getElementById('generatedCodeDisplay'); display.style.display = 'block'; 
    document.getElementById('displayFinalCode').innerText = `${regionName} ${randomNum}`; 
    window.showNotification("새로운 학급 코드가 개설되었습니다!"); 
    
    alert(`[학급 개설 성공]\n\n발급된 학급 코드(${regionName} ${randomNum})로 다시 로그인한 후, 시스템 설정 탭에서 반드시 'API 키'를 저장해주세요.\n저장하지 않으면 학급 내 AI 시스템(분석, 심사 등)이 작동하지 않습니다.`);
}

window.renderTeacherAnalysis = function() {
    // 💡 수정됨: '학생들의 활동 데이터를 수집 중입니다' 안내 문구 렌더링 제거 (빈 값으로 초기화)
    document.getElementById('teacherOverallStats').innerHTML = '';
}

window.renderStudentMonitor = function() {
    const grid = document.getElementById('teacherStudentGrid'); grid.innerHTML = ''; const studentKeys = Object.keys(window.allStudentsData).sort((a,b) => parseInt(a) - parseInt(b));
    if(studentKeys.length === 0) { grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:30px;">아직 접속한 학생이 없습니다.</div>`; return; }
    studentKeys.forEach(sNum => {
        let sData = window.allStudentsData[sNum]; let sat = sData.satisfaction || 0; let isOnline = sData.isOnline === true; let cLevel = window.districtLevels[0].name; for(let lvl of window.districtLevels) { if(sat >= lvl.threshold) cLevel = lvl.name; }
        
        // 💡 수정됨: 심사 대기 건수도 authorId 기반 및 '학생', '시장님' 등 호칭을 유연하게 체크하도록 필터링 강화
        const waitingCount = window.gameState.submittedProposals.filter(p => (String(p.authorId) === String(sNum) || (p.author && p.author.startsWith(sNum + '번'))) && p.status === 'waiting').length;
        
        // 💡 수정됨: 심사 대기 뱃지의 top, left 위치를 10px로 조절하여 카드 안쪽으로 배치 (잘림 문제 해결)
        const waitingBadge = waitingCount > 0 ? `<div style="position:absolute; top:10px; left:10px; background:#ef4444; color:white; font-size:11px; font-weight:bold; padding:4px 8px; border-radius:12px; box-shadow:0 2px 5px rgba(0,0,0,0.2); animation: pulse 2s infinite; z-index:10;">심사 대기 ${waitingCount}건</div>` : '';

        grid.innerHTML += `<div class="student-card ${isOnline ? 'online' : 'offline'}" style="position:relative;" onclick="window.showStudentDetails('${sNum}')">
            ${waitingBadge}
            <div class="status-dot" title="${isOnline ? '현재 접속 중' : '오프라인'}"></div>
            <div class="st-num">${sNum}번 학생</div><div class="st-level">${cLevel}</div>
            <div class="st-stats"><div>👥<span>${sData.visitorCount||0}</span></div><div>⭐<span>${sData.reputation||0}</span></div><div>❤️<span>${sat}</span></div></div>
        </div>`;
    });
    window.renderTeacherAnalysis();
}

window.showStudentDetails = function(sNum) {
    document.getElementById('monitorGridView').style.display = 'none'; document.getElementById('monitorDetailView').style.display = 'block'; const sData = window.allStudentsData[sNum] || {}; let sat = sData.satisfaction || 0; let cLevel = window.districtLevels[0].name; for(let lvl of window.districtLevels) { if(sat >= lvl.threshold) cLevel = lvl.name; }
    document.getElementById('dtNum').innerText = sNum; document.getElementById('dtLevel').innerText = cLevel; document.getElementById('dtVis').innerText = sData.visitorCount || 0; document.getElementById('dtRep').innerText = sData.reputation || 0; document.getElementById('dtSat').innerText = sat;
    
    // 💡 수정됨: 학생이 제출한 제안서를 authorId(번호) 또는 번호로 시작하는 작성자 명칭('시장님', '학생')으로 유연하게 매칭
    const proposals = window.gameState.submittedProposals.filter(p => String(p.authorId) === String(sNum) || (p.author && p.author.startsWith(sNum + '번'))); 
    
    let phtml = ''; if(proposals.length===0) phtml = '<div style="color:var(--text-muted);">작성한 제안서가 없습니다.</div>';
    
    proposals.forEach(p => { 
        let statusBadge = p.status === 'waiting' ? '<span style="color:#d97706;">⏳ 2차 심사 대기중</span>' : (p.status === 'approved' ? '<span style="color:#16a34a;">✅ 최종 승인됨</span>' : '<span style="color:#ef4444;">❌ 반려됨</span>');
        
        let reviewUi = '';
        if (p.status === 'waiting') {
            reviewUi = `
                <div style="margin-top:15px; border-top:2px dashed var(--border-color); padding-top:15px; background: rgba(255,255,255,0.7); border-radius: 8px;">
                    <strong style="color:var(--primary); font-size:14px; display:block; margin-bottom:5px;">👨‍🏫 선생님 2차 심사 (최종 승인 및 예산 지급)</strong>
                    <textarea id="t-feedback-${p.id}" rows="2" placeholder="예: 우리 지역 실정에 아주 잘 맞는 훌륭한 생각이야! 추가 예산을 지원할게." style="width:100%; margin:8px 0; padding:8px; border:1px solid var(--border-color); border-radius:6px; box-sizing:border-box; font-family:inherit;"></textarea>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <input type="number" id="t-budget-${p.id}" placeholder="추가 지급 예산" value="300" style="width:140px; padding:8px; border:1px solid var(--border-color); border-radius:6px;"> <span style="font-weight:bold; color:var(--accent);">G</span>
                        <button onclick="window.submitTeacherReview(${p.id}, true, '${sNum}')" style="margin-left:auto; background:var(--success); color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">승인하기</button>
                        <button onclick="window.submitTeacherReview(${p.id}, false, '${sNum}')" style="background:#ef4444; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">재검토 요망</button>
                    </div>
                </div>
            `;
        }

        phtml += `
        <div style="background:#f1f5f9; padding:15px; border-radius:8px; border: 1px solid ${p.status === 'waiting' ? 'var(--accent)' : 'var(--border-color)'};">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <div style="font-weight:bold; color:var(--primary);">주제: ${p.problem}</div>
                <div style="font-size:13px; font-weight:bold;">${statusBadge}</div>
            </div>
            <div style="font-size:13px; line-height:1.6; color:var(--text-main); margin-bottom:10px; background: white; padding: 10px; border-radius: 6px;">${p.proposal.replace(/\n/g, '<br>')}</div>
            <div style="font-size:12px; background:rgba(2, 132, 199, 0.05); padding:10px; border-radius:6px; border:1px solid rgba(2, 132, 199, 0.2);">
                <strong>🤖 AI 1차 평가:</strong> ${p.aiFeedback} (획득: ${p.aiBudget}G)
            </div>
            ${p.status !== 'waiting' ? `<div style="font-size:13px; margin-top:10px; background:rgba(22, 163, 74, 0.1); padding:10px; border-radius:6px; border:1px solid rgba(22, 163, 74, 0.3);"><strong>👨‍🏫 선생님 피드백:</strong> ${p.teacherFeedback} <br><span style="color:var(--accent); font-weight:bold;">(+ 추가 예산: ${p.teacherBudget}G)</span></div>` : ''}
            ${reviewUi}
        </div>`; 
    }); 
    document.getElementById('dtProposals').innerHTML = phtml;
    
    // 💡 홍보물(2단계)도 동일한 방식으로 필터링 보강
    const promos = window.gameState.promoBoard.filter(p => String(p.authorId) === String(sNum) || (p.author && p.author.startsWith(sNum + '번'))); 
    let prhtml = ''; if(promos.length===0) prhtml = '<div style="color:var(--text-muted); grid-column:1/-1;">제작한 홍보물이 없습니다.</div>';
    promos.forEach(p => { prhtml += `<div class="board-item-selectable" style="background: ${p.color}; cursor:default;"><strong style="font-size:14px; margin-bottom:5px; color:#333;">${p.type}</strong><div style="font-size:14px; line-height:1.4; color:#1e293b;">${p.content}</div></div>`; }); document.getElementById('dtPromos').innerHTML = prhtml;
    
    // 💡 지도 기호(0단계)도 동일한 방식으로 필터링 보강
    const markers = window.gameState.mapMarkers.filter(m => String(m.author) === String(sNum) || String(m.authorId) === String(sNum) || (m.author && m.author.startsWith(sNum + '번'))); 
    let mhtml = ''; if(markers.length===0) mhtml = '<div style="color:var(--text-muted); grid-column:1/-1;">등록한 기호가 없습니다.</div>';
    markers.forEach(m => { mhtml += `<div style="background:#f8fafc; border:1px solid var(--border-color); padding:10px; border-radius:8px; display:flex; align-items:center; gap:15px;"><img src="${m.imgData}" style="width:50px; height:50px; background:white; border-radius:8px;"><div><strong style="color:var(--text-main); display:block;">${m.placeName}</strong><span style="color:var(--text-muted); font-size:12px;">${m.legendDesc}</span></div></div>`; }); document.getElementById('dtMarkers').innerHTML = mhtml;
}

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

    await window.saveGameState(); // 학급 데이터에 상태 저장

    // 승인 시 해당 학생의 DB 문서에 접근하여 예산 쏴주기 (실시간 반영)
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
    window.showStudentDetails(sNum); // 화면 새로고침
    window.renderStudentMonitor(); // 대기 뱃지 업데이트를 위해 모니터 리스트도 갱신
}

window.hideStudentDetails = function() { document.getElementById('monitorDetailView').style.display = 'none'; document.getElementById('monitorGridView').style.display = 'block'; }

window.deleteItem = function(type, indexOrId) {
    if(!confirm("⚠️ 해당 게시물을 완전히 삭제하시겠습니까?")) return;
    if(type === 'problem') { window.gameState.problems.splice(indexOrId, 1); window.renderProblemBoard(); } 
    else if (type === 'proposal') { window.gameState.submittedProposals.splice(indexOrId, 1); window.renderSharedProposals(); } 
    else if (type === 'promo') { window.gameState.promoBoard = window.gameState.promoBoard.filter(p => p.id !== indexOrId); window.renderPromoBoard(); }
    window.saveGameState(); window.showNotification("게시물이 관리자 권한으로 삭제되었습니다.");
}