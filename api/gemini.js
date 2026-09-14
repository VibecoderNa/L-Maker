// api/gemini.js (Vercel Serverless Function)
export default async function handler(req, res) {
    // 💡 CORS 정책 허용 (로컬 환경에서 통신 차단 방지)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 브라우저 사전 요청(Preflight) 통과 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: { message: 'Method Not Allowed' } });
    }

    const { classKey, model, contents } = req.body;

    if (!classKey) {
        return res.status(400).json({ error: { message: '학급 코드가 누락되었습니다.' } });
    }

    // 파이어베이스 프로젝트 ID
    const PROJECT_ID = "l-maker"; 
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/classes/${classKey}`;

    try {
        const dbRes = await fetch(firestoreUrl);
        const dbData = await dbRes.json();

        if (!dbData.fields || !dbData.fields.apiKey || !dbData.fields.apiKey.stringValue) {
            return res.status(400).json({ error: { message: "등록되지 않은 학급이거나 선생님의 Gemini API 키가 설정되지 않았습니다." } });
        }

        const apiKey = dbData.fields.apiKey.stringValue;
        const modelToUse = model || 'gemini-3.8-flash';
        
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const geminiData = await geminiRes.json();

        if (!geminiRes.ok) {
            return res.status(geminiRes.status).json({ 
                error: { message: geminiData.error?.message || "Gemini API 통신 중 오류가 발생했습니다." } 
            });
        }

        return res.status(200).json(geminiData);

    } catch (error) {
        console.error("Serverless Function Error:", error);
        return res.status(500).json({ error: { message: "서버 내부 오류가 발생했습니다: " + error.message } });
    }
}