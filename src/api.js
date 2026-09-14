// api.js - Gemini AI 통신 및 로딩 팝업, 심사 제어 (보안 개선 버전)

const aiTips = [
    "우리가 내는 세금이 모여 지역 발전을 위한 소중한 '예산'이 됩니다.",
    "'공공성'이란 나 혼자만의 이익이 아니라, 많은 사람에게 두루 이익이 되는 성질을 뜻해요.",
    "지역의 문제를 해결하려면 '결과'만 보지 말고, 왜 그런 일이 생겼는지 '원인'을 정확히 분석해야 합니다.",
    "좋은 홍보물은 타겟(누구에게 보여줄지)이 명확해야 가장 큰 효과를 발휘합니다.",
    "지도에 기호를 그릴 때는 다른 사람도 쉽게 알아볼 수 있도록 '범례'를 꼭 만들어야 해요.",
    "도시를 건설할 때는 경제 발전뿐만 아니라 환경과 사람들의 행복(만족도)도 함께 생각해야 합니다."
];

window.showAILoading = function() {
    const overlay = document.getElementById('aiLoadingOverlay');
    const tipText = document.getElementById('aiLoadingTipText');
    if(overlay && tipText) {
        tipText.innerText = aiTips[Math.floor(Math.random() * aiTips.length)];
        overlay.classList.add('active');
    }
}
window.hideAILoading = function() {
    const overlay = document.getElementById('aiLoadingOverlay');
    if(overlay) overlay.classList.remove('active');
}

// 💡 공통 통신 함수 (모든 요청을 Vercel 서버로 전송)
async function requestToVercel(contents) {
    if(!window.classKey) throw new Error("학급 정보가 없습니다.");
    
    // 나의 Vercel 서버리스 함수 주소로 요청 (API 키 포함 안 함!)
    const backendUrl = '/api/gemini'; 
    
    const response = await window.fetchWithRetry(backendUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            classKey: window.classKey, 
            model: window.dynamicApiModel || 'gemini-1.5-flash',
            contents: contents 
        }) 
    });
    
    const data = await response.json();
    if(!response.ok) throw new Error(data.error?.message || "서버 통신 에러");
    return data;
}

window.getAIAdvice = async function() {
    const photoFile = document.getElementById('photoInput').files[0]; 
    const textData = document.getElementById('textDataInput').value.trim();
    
    if(!photoFile && !textData) return alert("이미지나 텍스트 자료 중 하나는 업로드해주세요.");
    window.showAILoading(); 

    try {
        let promptText = `너는 초등학교 선생님 AI 비서야. 학생이 우리 지역의 문제를 탐색하려고 해. (추가자료: "${textData}")\n이 자료를 보고 어떤 문제점이 있는지 학생 스스로 생각할 수 있도록 2~3문장으로 친절하게 힌트를 줘. 정답을 바로 말하지 말고, "이 사진을 보면 ~한 불편함이 있을 것 같지 않나요? 어떻게 해결하면 좋을까요?" 처럼 질문 형태로 유도해줘.`;
        
        const contents = []; 
        if (photoFile) { 
            const imagePart = await window.getBase64(photoFile); 
            contents.push({ parts: [{ text: promptText }, { inlineData: imagePart.inlineData }] }); 
        } else { contents.push({ parts: [{ text: promptText }] }); }
        
        // Vercel 서버로 요청
        const resultData = await requestToVercel(contents);
        const resultText = resultData.candidates[0].content.parts[0].text;
        
        const adviceArea = document.getElementById('aiAdviceArea');
        adviceArea.style.display = 'block';
        adviceArea.innerHTML = `<strong>🤖 AI 비서의 힌트:</strong><br>${resultText}`;
        window.showNotification("AI 비서가 힌트를 주었습니다!");
    } catch (error) { 
        console.error("AI 통신 오류:", error);
        alert(`통신 에러가 발생했습니다.\n(원인: ${error.message})\n\n선생님께 시스템 설정을 확인해달라고 요청해주세요.`); 
    } finally { 
        window.hideAILoading(); 
    }
}

window.submitProblemToBoard = async function() {
    const desc = document.getElementById('photoDesc').value.trim(); 
    const photoFile = document.getElementById('photoInput').files[0];
    
    if(!desc) return alert("💡 문제 요약을 필수로 입력해주세요."); 
    
    const btn = document.getElementById('btn-submit-problem');
    btn.disabled = true;
    
    let imageUrl = null;
    if(photoFile) {
        const imagePart = await window.getBase64(photoFile);
        imageUrl = imagePart.dataUrl;
    }

    window.gameState.problems.unshift({ 
        id: Date.now(),
        author: `${document.getElementById('numInput').value}번 시장님`, 
        title: "👀 현장 탐색 문제", 
        content: desc, 
        keywords: [], 
        color: window.padletColors[Math.floor(Math.random() * window.padletColors.length)], 
        imageUrl: imageUrl 
    });
    
    window.saveGameState(); 
    window.renderProblemBoard(); 
    window.showNotification("학급 공유 게시판에 등록되었습니다.");
    
    document.getElementById('photoDesc').value = ''; 
    document.getElementById('textDataInput').value = ''; 
    document.getElementById('photoInput').value = '';
    document.getElementById('aiAdviceArea').style.display = 'none';
    
    window.switchInnerTab('inner-board', document.querySelectorAll('#stage1-1 .sub-tab-btn')[1]);
    btn.disabled = false;
}

window.submitProposal = async function() {
    if(!window.currentSelectedProblem) return alert("해결할 문제를 먼저 선택해주세요.");
    const text = document.getElementById('proposalText').value; 
    const def = "[1. 문제 원인 분석]\n이 문제는 왜 발생했을까요?\n👉 \n\n[2. 구체적인 해결 방안]\n어떻게 해결할 수 있을지 아이디어를 적어주세요. (실현 가능성 고려)\n👉 \n\n[3. 기대 효과]\n문제가 해결되면 우리 지역 사람들에게 어떤 도움이 될까요? (공공성 고려)\n👉 \n";
    if(text === def || (text.replace(/\s+/g, '').length - def.replace(/\s+/g, '').length < 20)) return alert("해결 방안이 너무 짧습니다. 20자 이상 작성해주세요.");
    
    window.showAILoading();

    try {
        const prompt = `깐깐한 지역 문제 심사관AI. 문제: '${window.currentSelectedProblem}', 내용: "${text}"\n평가기준: 1. 실현 가능성과 공공성. 장난이거나 비현실적이면 budget:0. 구체적이면 1차 통과. (단, 예산 budget은 문제 해결의 난이도와 창의성을 고려하여 반드시 100에서 500 사이의 정수로만 제한할 것).\n반드시 JSON 응답: {"feedback": "1차 심사 코멘트", "keywords": ["#키1"], "budget": 300}`;
        const contents = [{ parts: [{ text: prompt }] }];
        
        const resultData = await requestToVercel(contents);
        const resultText = resultData.candidates[0].content.parts[0].text;
        const jsonStr = resultText.match(/\{[\s\S]*\}/)[0];
        const result = JSON.parse(jsonStr);
        const earnedBudget = result.budget || 0;
        
        const proposalData = { 
            id: Date.now(),
            author: `${document.getElementById('numInput').value}번 시장님`,
            authorId: window.userKey,
            problem: window.currentSelectedProblem, 
            proposal: text, 
            aiFeedback: result.feedback,
            keywords: result.keywords || [],
            aiBudget: earnedBudget,
            status: 'waiting', 
            teacherFeedback: '',
            teacherBudget: 0
        };

        window.gameState.budget += earnedBudget; 
        window.gameState.submittedProposals.unshift(proposalData);
        
        window.updateUI(); window.renderSharedProposals(); 
        window.showNotification(`1차 심사 완료! 기본 예산 ${earnedBudget}G 획득. 선생님의 최종 승인을 기다리세요.`);
        
        document.getElementById('proposalText').value = ''; document.getElementById('selectedProblemDisplay').style.display = 'none'; window.currentSelectedProblem = null; 
        document.querySelectorAll('#problemBoard .board-item-selectable').forEach(el => el.classList.remove('selected'));
        window.switchInnerTab('inner-explore', document.querySelectorAll('#stage1-1 .sub-tab-btn')[0]); window.switchTab('stage1-2', document.querySelectorAll('#stage1SubMenu .sub-nav-item')[1], '2) 반 해결방안 보기', true);
    } catch (error) { 
        console.error("AI 통신 오류:", error);
        alert(`통신 에러가 발생했습니다.\n(원인: ${error.message})`); 
    } finally { 
        window.hideAILoading(); 
    }
}

window.getAIConsulting = async function() {
    const topic = document.getElementById('promoTopic').value; const target = document.getElementById('promoTarget').value.trim(); const slogan = document.getElementById('promoSlogan').value.trim();
    if(!topic || !target || !slogan) return alert("모두 입력해주세요."); 
    
    window.showAILoading();

    try {
        const prompt = `마케팅 AI. 주제:${topic}, 타겟:${target}, 슬로건:"${slogan}". JSON 응답: {"copywriting": ["문구1","문구2","문구3"], "imageConcept": "콘셉트"}`;
        const contents = [{ parts: [{ text: prompt }] }];
        
        const resultData = await requestToVercel(contents);
        const resultText = resultData.candidates[0].content.parts[0].text;
        
        const result = JSON.parse(resultText.match(/\{[\s\S]*\}/)[0]);
        document.getElementById('consultingText').innerHTML = `<strong><i class="fa-solid fa-pen-nib"></i> 카피라이팅</strong><ul style="margin: 10px 0; padding-left: 20px;">${result.copywriting.map(c => `<li style="margin-bottom:5px;">"${c}"</li>`).join('')}</ul><strong style="margin-top: 15px; display: inline-block;"><i class="fa-solid fa-palette"></i> 디자인 콘셉트</strong><div style="margin-top: 5px;">${result.imageConcept}</div>`;
        document.getElementById('consultingResult').style.display = 'block'; window.showNotification("컨설팅 도착!");
    } catch (error) { 
        alert(`통신 에러가 발생했습니다.\n(원인: ${error.message})`); 
    } finally { 
        window.hideAILoading(); 
    }
}

window.executeCampaign = async function() {
    if(!window.currentSelectedPromo) return alert("홍보물을 선택해주세요.");
    const checkedMedia = document.querySelector('input[name="mediaOption"]:checked'); if(!checkedMedia) return alert("매체를 선택해주세요.");
    const cost = parseInt(checkedMedia.value); if(window.gameState.budget < cost) return alert(`예산 부족!`);
    
    window.showAILoading();

    try {
        const prompt = `마케팅 분석AI. 매체: ${checkedMedia.dataset.name} (비용: ${cost}G). 파급력을 투자 비용 대비 고효율로 평가해. (단, 방문객(visitorCount)은 매체 비용을 고려하여 반드시 100에서 500 사이의 정수로, 평판(reputation)은 반드시 10에서 60 사이의 정수로 넉넉하게 부여할 것). JSON 응답: {"feedback": "코멘트", "visitorCount": 정수, "reputation": 정수}`;
        const contents = [{ parts: [{ text: prompt }] }];
        
        const resultData = await requestToVercel(contents);
        const resultText = resultData.candidates[0].content.parts[0].text;
        const result = JSON.parse(resultText.match(/\{[\s\S]*\}/)[0]);

        window.gameState.budget -= cost; window.gameState.visitorCount += result.visitorCount; window.gameState.reputation += result.reputation; window.updateUI();
        document.getElementById('campaignMetrics').innerHTML = `<span style="color: #d97706;"><i class="fa-solid fa-users"></i> 방문객 ${result.visitorCount}명 유치</span> | <span style="color: #ef4444;"><i class="fa-solid fa-star"></i> 평판 ${result.reputation}점 획득</span>`;
        document.getElementById('campaignFeedback').innerHTML = result.feedback; document.getElementById('campaignResultArea').style.display = 'block';
        window.showNotification(`마케팅 성공!`);
        window.currentSelectedPromo = null; checkedMedia.checked = false; document.getElementById('selectedPromoDisplay').style.display = 'none';
        document.querySelectorAll('#promoBoardArea .board-item-selectable').forEach(el => el.classList.remove('selected'));
    } catch (error) { 
        alert(`통신 에러가 발생했습니다.\n(원인: ${error.message})`); 
    } finally { 
        window.hideAILoading(); 
    }
}