// api/gemini.js (Vercel Serverless Function)
export default async function handler(req, res) {
    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { classKey, model, contents } = req.body;

    // 1. 파이어베이스에서 해당 학급의 API 키 몰래 가져오기 (클라이언트에게 노출 안 됨)
    // 💡 필수: 아래 문자열을 실제 파이어베이스 프로젝트 ID로 변경하세요! (예: local-maker-12345)
    const PROJECT_ID = "l-maker"; 
    
    // 파이어베이스 REST API 주소
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/classes/${classKey}`;

    try {
        const dbRes = await fetch(firestoreUrl);
        const dbData = await dbRes.json();

        // API 키가 파이어베이스에 없는 경우 예외 처리
        if (!dbData.fields || !dbData.fields.apiKey || !dbData.fields.apiKey.stringValue) {
            return res.status(400).json({ error: { message: "선생님께서 아직 API 키를 설정하지 않으셨습니다." } });
        }

        const apiKey = dbData.fields.apiKey.stringValue;
        const modelToUse = model || 'gemini-3.8-flash';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

        // 2. 구글 제미나이 서버로 진짜 요청 보내기 (안전한 서버 간 통신)
        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const geminiData = await geminiRes.json();

        if (!geminiRes.ok) {
            throw new Error(geminiData.error?.message || "구글 API 에러 발생");
        }

        // 3. 결과 텍스트만 프론트엔드(학생 브라우저)로 반환
        res.status(200).json(geminiData);

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: { message: error.message } });
    }
}