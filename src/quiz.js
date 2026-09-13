import { db } from './firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.uploadQuestion = async function() {
    if(!window.classKey || window.classKey === 'teacher_temp_global') return alert("모니터링할 학급에 접속한 상태에서만 문제를 출제할 수 있습니다.");
    
    const chapter = document.getElementById('qChapter').value.trim();
    const diff = document.getElementById('qDifficulty').value;
    const q = document.getElementById('qText').value.trim();
    const o1 = document.getElementById('qOpt1').value.trim();
    const o2 = document.getElementById('qOpt2').value.trim();
    const o3 = document.getElementById('qOpt3').value.trim();
    const o4 = document.getElementById('qOpt4').value.trim();
    const ans = parseInt(document.getElementById('qAnswer').value);
    const exp = document.getElementById('qExp').value.trim();

    if(!chapter || !q || !o1 || !o2) return alert("단원, 문제, 보기 최소 2개는 필수 입력입니다.");

    let options = [o1, o2]; if(o3) options.push(o3); if(o4) options.push(o4);
    if(ans >= options.length) return alert("정답 번호가 입력된 보기의 개수보다 큽니다. (O/X 문제라면 정답은 보기 1 또는 2여야 합니다.)");

    const newQ = { question: q, options: options, answer: ans, explanation: exp };

    try {
        let currentChapterData = window.classQuizBank[chapter] || { "상": [], "중": [], "하": [] };
        if(!currentChapterData["상"]) currentChapterData["상"] = [];
        if(!currentChapterData["중"]) currentChapterData["중"] = [];
        if(!currentChapterData["하"]) currentChapterData["하"] = [];
        
        currentChapterData[diff].push(newQ);

        const dataToSave = { "상": JSON.stringify(currentChapterData["상"]), "중": JSON.stringify(currentChapterData["중"]), "하": JSON.stringify(currentChapterData["하"]) };
        await setDoc(doc(db, "classes", window.classKey, "quizBank", chapter), dataToSave);
        window.showNotification("우리 반 문항이 성공적으로 등록되었습니다!");
        
        document.getElementById('qText').value = ''; document.getElementById('qOpt1').value = ''; document.getElementById('qOpt2').value = ''; document.getElementById('qOpt3').value = ''; document.getElementById('qOpt4').value = ''; document.getElementById('qExp').value = '';
    } catch(e) { console.error(e); alert("문제 등록 중 오류가 발생했습니다."); }
}

window.renderTeacherQuizList = function() {
    const listEl = document.getElementById('teacherQuizList'); if(!listEl) return; listEl.innerHTML = '';
    let html = '<h4 style="color:var(--primary); margin-bottom:10px;"><i class="fa-solid fa-chalkboard-user"></i> 우리 반 추가 문항 (수정/삭제 가능)</h4>';
    let hasClassQ = false;
    Object.keys(window.classQuizBank).forEach(chapter => {
        ['상', '중', '하'].forEach(diff => {
            const qs = window.classQuizBank[chapter][diff];
            if(qs && qs.length > 0) {
                hasClassQ = true;
                qs.forEach((qObj, index) => {
                    html += `<div style="background:#f8fafc; border:1px solid var(--primary); padding:15px; border-radius:8px; position:relative; margin-bottom:10px;"><button class="delete-btn" onclick="window.deleteQuizQuestion('${chapter}', '${diff}', ${index})"><i class="fa-solid fa-trash"></i></button><div style="font-size:12px; color:var(--primary); font-weight:bold; margin-bottom:5px;">[${chapter}] 난이도: ${diff}</div><div style="font-weight:bold; margin-bottom:10px; color:var(--text-main);">${qObj.question || qObj.q}</div><div style="font-size:13px; color:var(--text-main);">정답: ${qObj.options[qObj.answer]}</div></div>`;
                });
            }
        });
    });
    if(!hasClassQ) html += '<div style="color:var(--text-muted); font-size:13px; margin-bottom:20px;">우리 반에 직접 추가한 문항이 없습니다.</div>'; else html += '<div style="margin-bottom:20px;"></div>';

    html += '<h4 style="color:var(--success); margin-bottom:10px;"><i class="fa-solid fa-globe"></i> 기본 제공 문항 (공통, 삭제 불가)</h4>';
    let hasGlobalQ = false;
    Object.keys(window.globalQuizBank).forEach(chapter => {
        ['상', '중', '하'].forEach(diff => {
            const qs = window.globalQuizBank[chapter][diff];
            if(qs && qs.length > 0) {
                hasGlobalQ = true;
                qs.forEach((qObj, index) => { html += `<div style="background:#f1f5f9; border:1px solid var(--border-color); padding:15px; border-radius:8px; position:relative; margin-bottom:10px;"><div style="font-size:12px; color:var(--success); font-weight:bold; margin-bottom:5px;">[${chapter}] 난이도: ${diff}</div><div style="font-weight:bold; margin-bottom:10px; color:var(--text-main);">${qObj.question || qObj.q}</div><div style="font-size:13px; color:var(--text-muted);">정답: ${qObj.options[qObj.answer]}</div></div>`; });
            }
        });
    });
    if(!hasGlobalQ) html += '<div style="color:var(--text-muted); font-size:13px;">기본으로 제공되는 글로벌 문항이 없습니다.</div>';
    listEl.innerHTML = html;
}

window.deleteQuizQuestion = async function(chapter, diff, index) {
    if(!confirm("우리 반에 추가된 이 문제를 완전히 삭제하시겠습니까?")) return;
    let currentChapterData = window.classQuizBank[chapter]; currentChapterData[diff].splice(index, 1);
    try {
        const dataToSave = { "상": JSON.stringify(currentChapterData["상"]), "중": JSON.stringify(currentChapterData["중"]), "하": JSON.stringify(currentChapterData["하"]) };
        await setDoc(doc(db, "classes", window.classKey, "quizBank", chapter), dataToSave);
        window.showNotification("문제가 삭제되었습니다.");
    } catch(e) { alert("삭제 중 오류가 발생했습니다."); }
}

window.usedQuestions = { "상": [], "중": [], "하": [] };
window.currentQuizDifficulty = null; window.currentQuizData = null; window.quizAttempts = 0; window.selectedChapter = "";

window.startQuizSession = function() {
    const selectEl = document.getElementById('quizChapterSelect');
    if(!selectEl.value) return alert("도전할 단원을 선택해주세요.");
    if(!window.mergedQuizBank[selectEl.value]) return alert("해당 단원에 아직 문제가 없습니다.");

    window.selectedChapter = selectEl.value;
    if(window.gameState.quizStats.todayCount >= 10) { document.getElementById('quizLimitMsg').style.display = 'block'; return; }

    document.getElementById('quizLimitMsg').style.display = 'none'; document.getElementById('quizChapterSelection').style.display = 'none'; document.getElementById('quizContent').style.display = 'block';
    window.usedQuestions = { "상": [], "중": [], "하": [] };
    
    const availableDifficulties = ["상", "중", "하"].filter(diff => window.mergedQuizBank[window.selectedChapter][diff] && window.mergedQuizBank[window.selectedChapter][diff].length > 0);
    if(availableDifficulties.length === 0) { alert("이 단원에는 아직 등록된 문제가 없습니다."); window.endQuizSession(); return; }

    const randomDiff = availableDifficulties[Math.floor(Math.random() * availableDifficulties.length)];
    window.loadQuiz(randomDiff);
}

window.endQuizSession = function() { document.getElementById('quizContent').style.display = 'none'; document.getElementById('quizChapterSelection').style.display = 'block'; }

window.loadQuiz = function(difficulty) {
    window.currentQuizDifficulty = difficulty; window.quizAttempts = 0;
    document.getElementById('nextDifficultyContainer').style.display = 'none'; document.getElementById('endQuizBtn').style.display = 'none'; document.getElementById('quizFeedback').style.display = 'none'; document.getElementById('quizOptions').innerHTML = '';
    document.getElementById('quizProgress').innerText = `오늘 푼 문제: ${window.gameState.quizStats.todayCount} / 10`;

    const badgeEl = document.getElementById('quizDifficultyBadge');
    if(difficulty === '상') { badgeEl.className = 'difficulty-badge diff-high'; badgeEl.innerText = '🔥 난이도 상'; }
    else if(difficulty === '중') { badgeEl.className = 'difficulty-badge diff-mid'; badgeEl.innerText = '⭐ 난이도 중'; }
    else { badgeEl.className = 'difficulty-badge diff-low'; badgeEl.innerText = '🌱 난이도 하'; }

    const questionsArr = window.mergedQuizBank[window.selectedChapter][difficulty] || [];
    if(questionsArr.length === 0) { document.getElementById('quizQuestion').innerText = "이 난이도에 등록된 문제가 없습니다. 다른 난이도를 선택해주세요."; window.showNextDifficultyOptions(true); return; }

    let availableQuestions = questionsArr.filter((_, index) => !window.usedQuestions[difficulty].includes(index));
    if(availableQuestions.length === 0) { window.usedQuestions[difficulty] = []; availableQuestions = questionsArr; }
    
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    window.currentQuizData = availableQuestions[randomIndex];
    window.usedQuestions[difficulty].push(questionsArr.indexOf(window.currentQuizData));

    document.getElementById('quizQuestion').innerText = window.currentQuizData.question || window.currentQuizData.q;

    const optionsContainer = document.getElementById('quizOptions');
    window.currentQuizData.options.forEach((optText, index) => {
        const btn = document.createElement('button'); btn.className = 'option-btn';
        if(window.currentQuizData.options.length === 2 && (optText === 'O' || optText === 'X' || optText === 'o' || optText === 'x')) { btn.innerText = optText; btn.style.textAlign = 'center'; btn.style.fontSize = '24px'; btn.style.fontWeight = 'bold'; } 
        else { btn.innerText = `${index + 1}. ${optText}`; }
        btn.onclick = () => window.checkQuizAnswer(index, btn); optionsContainer.appendChild(btn);
    });
}

window.checkQuizAnswer = function(selectedIndex, selectedBtn) {
    if(document.querySelector('.option-btn.correct')) return;
    document.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected')); selectedBtn.classList.add('selected');

    const isCorrect = (selectedIndex === window.currentQuizData.answer);
    const feedbackEl = document.getElementById('quizFeedback');
    
    if(isCorrect) {
        selectedBtn.classList.remove('selected'); selectedBtn.classList.add('correct');
        let reward = 0; if(window.currentQuizDifficulty === '상') reward = 100; else if(window.currentQuizDifficulty === '중') reward = 70; else if(window.currentQuizDifficulty === '하') reward = 50;
        window.gameState.budget += reward; window.updateQuizStats(true);
        feedbackEl.className = 'quiz-feedback feedback-success'; feedbackEl.innerHTML = `🎉 정답입니다! 예산 ${reward}G를 획득했습니다!<br><div style="font-size:14px; font-weight:normal; margin-top:10px; color:var(--text-main);">${window.currentQuizData.explanation}</div>`; feedbackEl.style.display = 'block';
        window.showNotification(`퀴즈 정답! ${reward}G 획득`); window.showNextDifficultyOptions();
    } else {
        window.quizAttempts++; selectedBtn.classList.remove('selected'); selectedBtn.classList.add('wrong');
        
        if(window.quizAttempts === 1) {
            feedbackEl.className = 'quiz-feedback feedback-error'; feedbackEl.innerHTML = `🤔 아쉽게 틀렸어요! <strong>한 번 더</strong> 신중하게 생각해서 다른 보기를 선택해보세요.`; feedbackEl.style.display = 'block';
        } else {
            window.gameState.budget += 10; window.updateQuizStats(false);
            const allBtns = document.querySelectorAll('.option-btn'); if(allBtns[window.currentQuizData.answer]) allBtns[window.currentQuizData.answer].classList.add('correct');
            let ansText = window.currentQuizData.answer + 1 + "번"; if(window.currentQuizData.options.length === 2 && (window.currentQuizData.options[0] === 'O' || window.currentQuizData.options[0] === 'X')) ansText = window.currentQuizData.options[window.currentQuizData.answer];
            feedbackEl.className = 'quiz-feedback feedback-error'; feedbackEl.innerHTML = `💦 아쉽네요! 정답은 <strong>${ansText}</strong>이었습니다. <br><span style="color:var(--accent);">위로금 10G를 드립니다! 다음에는 꼭 맞출 수 있을 거예요.</span><br><div style="font-size:14px; font-weight:normal; margin-top:10px; color:var(--text-main);">${window.currentQuizData.explanation}</div>`; feedbackEl.style.display = 'block';
            window.showNotification("격려금 10G가 지급되었습니다."); window.showNextDifficultyOptions();
        }
    }
}

window.updateQuizStats = function(isCorrect) {
    let stats = window.gameState.quizStats; stats.todayCount++; stats.totalSolved++; if(isCorrect) stats.correctCount++; else stats.incorrectCount++;
    stats.history.push({ date: window.getTodayStr(), chapter: window.selectedChapter, difficulty: window.currentQuizDifficulty, question: window.currentQuizData.question || window.currentQuizData.q, isCorrect: isCorrect });
    window.updateUI(); document.getElementById('quizProgress').innerText = `오늘 푼 문제: ${stats.todayCount} / 10`;
}

window.showNextDifficultyOptions = function(forceShow = false) {
    document.querySelectorAll('.option-btn').forEach(btn => { btn.style.pointerEvents = 'none'; });
    const stats = window.gameState.quizStats; const container = document.getElementById('nextDifficultyContainer'); container.style.display = 'block';
    if(stats.todayCount >= 10 && !forceShow) { container.querySelector('h4').innerText = "오늘의 고시 한도를 모두 소진했습니다. 내일 다시 도전하세요!"; container.querySelector('.diff-btn-group').style.display = 'none'; document.getElementById('endQuizBtn').style.display = 'inline-block'; } 
    else { container.querySelector('h4').innerText = forceShow ? "다른 난이도를 선택해주세요." : "다음 문제의 난이도를 직접 선택하세요!"; container.querySelector('.diff-btn-group').style.display = 'flex'; document.getElementById('endQuizBtn').style.display = 'none'; }
}

window.nextQuiz = function(action) {
    let nextDiff = window.currentQuizDifficulty;
    if(action === 'up') { if(window.currentQuizDifficulty === '하') nextDiff = '중'; else if(window.currentQuizDifficulty === '중') nextDiff = '상'; else if(window.currentQuizDifficulty === '상') { alert("이미 최고 난이도입니다."); nextDiff = '상'; } } 
    else if(action === 'keep') { nextDiff = window.currentQuizDifficulty; } 
    else if(action === 'down') { if(window.currentQuizDifficulty === '상') nextDiff = '중'; else if(window.currentQuizDifficulty === '중') nextDiff = '하'; else if(window.currentQuizDifficulty === '하') { alert("이미 최저 난이도입니다."); nextDiff = '하'; } }
    window.loadQuiz(nextDiff);
}