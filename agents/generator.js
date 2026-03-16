const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  REVIEW_REPLY_SYSTEM, REVIEW_REPLY_PROMPT,
  MESSAGE_GENERATE_SYSTEM, MESSAGE_GENERATE_PROMPT,
  CAMPAIGN_GENERATE_SYSTEM, CAMPAIGN_GENERATE_PROMPT,
  LESSON_REPLY_SYSTEM, LESSON_REPLY_PROMPT,
  BIRTHDAY_MESSAGE_PROMPT,
} = require('./prompts');

let genAI;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY が設定されていません');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * Gemini API 呼び出し（通常応答）
 * @param {string|undefined} systemInstruction - undefined可（空文字は渡さない）
 * @param {string} prompt
 */
async function callGemini(systemInstruction, prompt, maxRetries = 3) {
  const modelConfig = { model: 'gemini-2.0-flash' };
  if (systemInstruction) modelConfig.systemInstruction = systemInstruction;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const model = getClient().getGenerativeModel(modelConfig);
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const isRateLimit = err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit && attempt < maxRetries - 1) {
        const wait = Math.pow(2, attempt) * 2000;
        console.warn(`[Gemini] レート制限。${wait}ms 後にリトライ (${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      console.error('[Gemini] API エラー:', err.message);
      throw err;
    }
  }
}

/**
 * Gemini API ストリーミング呼び出し（SSE用）
 */
async function* callGeminiStream(systemInstruction, prompt) {
  const modelConfig = { model: 'gemini-2.0-flash' };
  if (systemInstruction) modelConfig.systemInstruction = systemInstruction;

  const model = getClient().getGenerativeModel(modelConfig);
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// ── 公開関数 ────────────────────────────────────────────────────

async function generateReviewReply(facilityName, rating, content) {
  return callGemini(
    REVIEW_REPLY_SYSTEM,
    fill(REVIEW_REPLY_PROMPT, { facility_name: facilityName, rating, content })
  );
}

async function* streamReviewReply(facilityName, rating, content) {
  yield* callGeminiStream(
    REVIEW_REPLY_SYSTEM,
    fill(REVIEW_REPLY_PROMPT, { facility_name: facilityName, rating, content })
  );
}

async function generateMessage(facilityName, purpose, target, channel) {
  return callGemini(
    MESSAGE_GENERATE_SYSTEM,
    fill(MESSAGE_GENERATE_PROMPT, { facility_name: facilityName, purpose, target, channel })
  );
}

async function generateCampaign(facilityName, campaignType, details, period) {
  return callGemini(
    CAMPAIGN_GENERATE_SYSTEM,
    fill(CAMPAIGN_GENERATE_PROMPT, { facility_name: facilityName, campaign_type: campaignType, details, period })
  );
}

async function generateLessonReply(facilityName, memberName, datetime, instructor, lessonType) {
  return callGemini(
    LESSON_REPLY_SYSTEM,
    fill(LESSON_REPLY_PROMPT, { facility_name: facilityName, member_name: memberName, datetime, instructor, lesson_type: lessonType })
  );
}

async function generateBirthdayMessage(facilityName, memberName, rank, coupon = '') {
  // systemInstruction なし（undefined で渡す）
  return callGemini(
    undefined,
    fill(BIRTHDAY_MESSAGE_PROMPT, { facility_name: facilityName, member_name: memberName, rank, coupon })
  );
}

module.exports = {
  generateReviewReply,
  streamReviewReply,
  generateMessage,
  generateCampaign,
  generateLessonReply,
  generateBirthdayMessage,
};
