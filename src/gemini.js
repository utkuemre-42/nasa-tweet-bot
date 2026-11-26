// src/gemini.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');
const { truncateTweet } = require('./utils');

const genAI = new GoogleGenerativeAI(config.googleAI.apiKey);

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];

function isRetryableGeminiError(error) {
  const msg = String(error?.message || '');
  const status = error?.status;
  return status === 503 || status === 429 || msg.includes('503') || msg.includes('429') || msg.includes('high demand');
}

/**
 * Verilen başlık ve açıklamadan iki farklı Türkçe tweet metni üretir.
 * @param {string} title Astronomi görselinin başlığı.
 * @param {string} explanation Astronomi görselinin açıklaması.
 * @returns {Promise<string[]>} İki tweet metnini içeren bir dizi.
 */
async function generateTweetParts(title, explanation) {
  if (!title || !explanation) {
    console.error("⚠️ Başlık veya açıklama olmadan tweet üretilemez.");
    return ["", ""];
  }

  const prompt = `
      Başlık: ${title}
      Açıklama: ${explanation}
      
      Yukarıdaki astronomi görseli meta verilerine (başlık ve açıklama) dayanarak, her biri 280 karakter sınırının altında kalan iki ayrı Türkçe tweet yazın.
      
      Her bir tweet, resmi ve bilgilendirici bir üslupla yazılmış tek ve tam bir cümle olmalıdır.
      İki tweet arasında cümle yapılarını, kelimeleri veya ifadeleri tekrarlamayın.
      Tweet başına 280 karakteri aşmayın.
      Hashtag, emoji veya markdown formatlama KULLANMAYIN.
      "Tweet 1", "Tweet 2" gibi etiketler veya herhangi bir ek yorum EKLEMEYİN—yalnızca iki tweet metnini art arda çıktı olarak verin.

      Tweet 1: Görüntüde görüldüğü şekliyle astronomik nesneyi veya olayı, görsel ve kavramsal unsurlara odaklanarak tanımlayın.
      Tweet 2: Mümkünse, açıklamadan çıkarılabilecek teknik veya gözlemsel ayrıntıları (örneğin teleskop türü, pozlama süresi, konum, veri filtreleri vb.) ekleyin. Öz ve olgusal kalın. Eğer açıklamada bu tür detaylar yoksa, görselin bilimsel önemini veya gözlemlenen olayın daha geniş bağlamdaki yerini vurgulayan farklı bir cümle kurun.
      `;

  for (const modelName of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`⏳ Gemini AI (${modelName}, deneme ${attempt}) ile tweet metinleri üretiliyor...`);
        const result = await model.generateContent(prompt);

        if (!result || !result.response || typeof result.response.text !== 'function') {
          console.error(`❌ Gemini AI (${modelName}) geçerli bir yanıt döndürmedi.`);
          break;
        }

        const rawText = await result.response.text();
        const tweets = rawText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.toLowerCase().startsWith("tweet 1:") && !line.toLowerCase().startsWith("tweet 2:"))
          .map(truncateTweet);

        if (tweets.length >= 2) {
          console.log("✍️ Tweet 1 (Üretilen):", tweets[0]);
          console.log("✍️ Tweet 2 (Üretilen):", tweets[1]);
          return tweets.slice(0, 2);
        }

        console.warn(`⚠️ Gemini AI (${modelName}) beklenen formatta çıktı vermedi. Alınan:`, tweets);
        break;
      } catch (error) {
        console.error(`❌ Gemini AI (${modelName}, deneme ${attempt}) hatası:`, error.message);

        if (isRetryableGeminiError(error) && attempt < 2) {
          console.warn(`⏳ Geçici yoğunluk/limit algılandı, 5 saniye beklenip tekrar deneniyor...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        break;
      }
    }
  }

  console.error("❌ Tüm Gemini modelleri başarısız oldu, tweet üretilemedi.");
  return ["", ""];
}

module.exports = {
  generateTweetParts,
};