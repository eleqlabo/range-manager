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
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

async function callGemini(systemInstruction, prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const model = getClient().getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction,
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const isRateLimit = err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
        continue;
      }
      throw err;
    }
  }
}

// ストリーミング版（SSE用）
async function* callGeminiStream(systemInstruction, prompt) {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction,
  });
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

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
  return callGemini(
    '',
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
