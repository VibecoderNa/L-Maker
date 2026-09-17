// api.js - 구글 Gemini AI 통신 및 데이터 제출 로직 전담

window.isAILoading = false;

window.callGeminiAPI = async function(prompt) {
    const keys = (window.dynamicApiKeys && window.dynamicApiKeys.length > 0) 
                 ? window.dynamicApiKeys 
                 : (window.dynamicApiKey ? [window.dynamicApiKey] : []);
                 
    if (keys.length === 0) throw new Error("API Key is missing");
    
    const model = window.dynamicApiModel || "gemini-3.8-flash";
    const data = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } };
    
    for (let i = 0; i < keys.length; i++) {
        const currentKey = keys[i].trim();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const result = await response.json();
                return result.candidates[0].content.parts[0].text;
            }
            
            if (response.status === 429) {
                if (i < keys.length - 1) {
                    console.warn(`[Failover] ${i+1}번째 API 키 한도 초과. 1초 대기 후 다음 키로 교체합니다...`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); 
                    continue; 
                } else {
                    throw new Error("모든 API 키가 한도를 초과했습니다.");
                }
            } 
            else if (response.status >= 500) {
                if (i < keys.length - 1) {
                    console.warn(`[Failover] 서버 오류(${response.status}). 1초 대기 후 다음 키로 시도합니다...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue; 
                } else {
                    throw new Error(`API 서버 오류(${response.status})`);
                }
            } else {
                throw new Error(`API 연결 오류: ${response.status}`);
            }
        } catch(err) {
            if (i === keys.length - 1) {
                window.showNotification("시장님, 현재 안건 처리가 지연되고 있습니다. 잠시 후 다시 시도해주십시오.");
                throw err;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

window.getAIAdvice = async function() {
    if(window.isAILoading) return;

    const textData = document.getElementById('textDataInput').value.trim();
    if(!textData || textData.length < 10) return window.showNotification("자료를 조금 더 자세히 입력해주세요!");

    window.isAILoading = true;

    const adviceArea = document.getElementById('aiAdviceArea');
    adviceArea.style.display = 'block';
    adviceArea.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 비서가 자료를 분석 중입니다...';

    try {
        const keys = (window.dynamicApiKeys && window.dynamicApiKeys.length > 0) ? window.dynamicApiKeys : (window.dynamicApiKey ? [window.dynamicApiKey] : []);
        if(keys.length === 0) {
            adviceArea.innerHTML = "💡 [AI 데모 결과] 입력하신 자료를 보니 '안전 문제'와 '환경 문제'가 핵심인 것 같습니다. 이 중 하나를 선택해볼까요?";
            return;
        }

        const prompt = `너는 초등학교 4학년 학생들의 사회 문제 해결을 돕는 친절한 AI 비서야.
학생이 조사한 자료: "${textData}"
이 자료를 바탕으로, 학생이 지역 문제로 삼을 만한 핵심 주제 1~2가지를 아주 쉽고 다정하게 3문장 이내로 요약해서 힌트를 줘.`;
        
        const resText = await window.callGeminiAPI(prompt);
        adviceArea.innerHTML = `<strong>💡 AI 비서의 힌트:</strong><br>${resText.replace(/\n/g, '<br>')}`;
    } catch(e) {
        adviceArea.innerHTML = `<span style="color:#ef4444;">오류가 발생했습니다. 잠시 후 다시 시도해주세요.</span>`;
    } finally {
        window.isAILoading = false;
    }
}

window.submitProblemToBoard = async function() {
    const title = document.getElementById('photoDesc').value.trim();
    const content = document.getElementById('textDataInput').value.trim();
    if(!title) return window.showNotification("우리가 해결해야 할 문제가 무엇인지 적어주세요!");

    let imageUrl = null;
    const photoFile = document.getElementById('photoInput').files[0];
    if(photoFile) {
        try {
            const imagePart = await window.getBase64(photoFile);
            imageUrl = imagePart.dataUrl;
        } catch(e) { console.error("이미지 업로드 실패", e); }
    }

    const problem = {
        title: title,
        content: content ? (content.substring(0, 50) + "...") : "자료가 첨부되었습니다.",
        author: `${document.getElementById('numInput').value}번 시장님`,
        imageUrl: imageUrl,
        color: window.padletColors[Math.floor(Math.random() * window.padletColors.length)]
    };

    window.gameState.problems.push(problem);
    window.updateUI(); window.renderProblemBoard();
    
    document.getElementById('photoDesc').value = '';
    document.getElementById('textDataInput').value = '';
    document.getElementById('photoInput').value = '';
    document.getElementById('aiAdviceArea').style.display = 'none';

    window.showNotification("문제가 학급 게시판에 즉시 등록되었습니다!");
    window.switchInnerTab('inner-board', document.querySelectorAll('#stage1-1 .sub-tab-btn')[1]);
}

window.submitProposal = async function() {
    if(window.isAILoading) return;

    const text = document.getElementById('proposalText').value.trim();
    if(text.length < 20) return window.showNotification("제안서를 조금 더 자세히 작성해주세요.");

    window.isAILoading = true;
    document.getElementById('aiLoadingOverlay').classList.add('active'); 
    
    const tips = [
        "💡 시장님, 그거 아시나요?\n지역 주민들이 겪는 불편함을 '지역 문제'라고 해요. 이를 해결하기 위해 의견을 모으는 과정이 바로 '민주주의'랍니다!",
        "💡 시장님, 그거 아시나요?\n시청, 도청, 경찰서, 소방서처럼 지역 주민들의 편안하고 안전한 생활을 위해 국가가 세운 기관을 '공공 기관'이라고 부릅니다.",
        "💡 시장님, 그거 아시나요?\n지역 문제를 해결하기 위해 주민들이 스스로 참여하는 것을 '주민 참여'라고 해요. 우리가 만드는 이 제안서도 훌륭한 참여 방법이랍니다!",
        "💡 시장님, 그거 아시나요?\n살기 좋은 지역을 만들기 위해서는 환경을 보호하면서도 경제가 발전하는 '지속 가능한 발전'을 생각해야 해요."
    ];
    document.getElementById('aiLoadingTipText').innerText = tips[Math.floor(Math.random() * tips.length)];

    try {
        let aiFeedback = "훌륭한 제안입니다! 실현 가능성과 공공성이 돋보입니다.";
        let aiBudget = 100;

        const keys = (window.dynamicApiKeys && window.dynamicApiKeys.length > 0) ? window.dynamicApiKeys : (window.dynamicApiKey ? [window.dynamicApiKey] : []);
        if(keys.length > 0) {
            const prompt = `너는 초등학교 4학년 학생들의 지역 문제 해결 제안서를 평가하는 따뜻하고 긍정적인 AI 시장 비서야.
제안할 문제: ${window.currentSelectedProblem}
학생의 제안 내용: ${text}
평가 기준: 1. 실현 가능성(학생 수준에서 상상할 수 있는가), 2. 공공성(많은 사람에게 도움이 되는가)
위 내용을 바탕으로 학생에게 칭찬과 보완점을 포함한 짧은 피드백(3문장 이내)을 주고, 첫 줄에는 무조건 50~150 사이의 숫자로 획득 예산(G)만 적어줘.`;
            
            const resText = await window.callGeminiAPI(prompt);
            const lines = resText.split('\n');
            const parsedBudget = parseInt(lines[0].replace(/[^0-9]/g, ''));
            if(!isNaN(parsedBudget)) {
                aiBudget = parsedBudget;
                aiFeedback = lines.slice(1).join('\n').trim();
            } else {
                aiFeedback = resText.trim();
            }
        }

        if(window.currentEditingProposalId) {
            const index = window.gameState.submittedProposals.findIndex(x => x.id === window.currentEditingProposalId);
            if(index !== -1) {
                const p = window.gameState.submittedProposals.splice(index, 1)[0];
                p.proposal = text;
                p.aiFeedback = aiFeedback;
                p.aiBudget = aiBudget;
                p.status = 'waiting';
                p.teacherFeedback = ''; 
                
                window.gameState.submittedProposals.unshift(p);
            }
            window.currentEditingProposalId = null; 
        } else {
            window.gameState.submittedProposals.unshift({
                id: Date.now(),
                author: `${document.getElementById('numInput').value}번 시장님`,
                authorId: window.userKey,
                problem: window.currentSelectedProblem,
                proposal: text,
                aiFeedback: aiFeedback,
                aiBudget: aiBudget,
                teacherFeedback: '',
                teacherBudget: 0,
                status: 'waiting'
            });
        }

        window.gameState.budget += aiBudget;
        window.updateUI();
        window.renderSharedProposals();

        window.showNotification("제안서가 성공적으로 제출되어 선생님의 승인을 기다립니다!");
        window.switchInnerTab('inner-my-proposal', document.querySelectorAll('#stage1-1 .sub-tab-btn')[3]); 
        window.renderMyProposals();
        
    } catch(e) {
        console.error(e);
        window.showNotification("오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
        window.isAILoading = false;
        document.getElementById('aiLoadingOverlay').classList.remove('active');
    }
}

window.getAIConsulting = async function() {
    if(window.isAILoading) return;

    const topic = document.getElementById('promoTopic').value.trim();
    const target = document.getElementById('promoTarget').value.trim();
    const slogan = document.getElementById('promoSlogan').value.trim();
    
    if(!topic || !target || !slogan) return window.showNotification("홍보 대상, 타겟 설정, 슬로건을 모두 작성한 후 조언을 구해보세요.");

    window.isAILoading = true;

    const resArea = document.getElementById('consultingResult');
    const resText = document.getElementById('consultingText');
    resArea.style.display = 'block';
    resText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 담당관이 분석 중입니다...';

    try {
        const keys = (window.dynamicApiKeys && window.dynamicApiKeys.length > 0) ? window.dynamicApiKeys : (window.dynamicApiKey ? [window.dynamicApiKey] : []);
        if(keys.length === 0) {
            resText.innerHTML = "💡 [AI 데모 결과] 타겟층의 관심을 끌 수 있는 훌륭한 슬로건입니다! 이제 이를 바탕으로 포스터나 영상을 기획해보세요.";
            return;
        }

        const prompt = `너는 초등학교 4학년을 돕는 친절한 마케팅 전문가 AI야.
학생이 정한 홍보 대상: ${topic}
홍보 타겟: ${target}
핵심 슬로건: ${slogan}
이 기획의 장점을 칭찬해주고, 어떤 매체(예: 유튜브, SNS, 포스터 등)를 활용하면 좋을지 아주 쉽고 다정하게 3문장 이내로 조언해줘.`;
        
        const answer = await window.callGeminiAPI(prompt);
        resText.innerHTML = answer.replace(/\n/g, '<br>');
    } catch(e) {
        resText.innerHTML = `<span style="color:#ef4444;">오류가 발생했습니다. 잠시 후 다시 시도해주세요.</span>`;
    } finally {
        window.isAILoading = false;
    }
}