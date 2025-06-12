// src/gemini.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');
const { truncateTweet } = require('./utils');

const genAI = new GoogleGenerativeAI(config.googleAI.apiKey);

/**
 * Verilen başlık ve açıklamadan iki farklı Türkçe tweet metni üretir.
 * @param {string} title Astronomi görselinin başlığı.
 * @param {string} explanation Astronomi görselinin açıklaması.
 * @returns {Promise<string[]>} İki tweet metnini içeren bir dizi.
 */
async function generateTweetParts(title, explanation) {
  if (!title || !explanation) {
    console.error("⚠️ Başlık veya açıklama olmadan tweet üretilemez.");
    return ["", ""]; // Boş tweetler döndür
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // En son modeli kullanmak daha iyi olabilir

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

    console.log("⏳ Gemini AI ile tweet metinleri üretiliyor...");
    const result = await model.generateContent(prompt);
    // console.log("Gemini Ham Yanıt:", JSON.stringify(result, null, 2)); // Detaylı loglama için

    if (!result || !result.response || typeof result.response.text !== 'function') {
        console.error("❌ Gemini AI'dan geçerli bir yanıt alınamadı.");
        return ["", ""];
    }

    const rawText = await result.response.text();
    // console.log("Gemini Üretilen Metin:", rawText); // Detaylı loglama için

    const tweets = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.toLowerCase().startsWith("tweet 1:") && !line.toLowerCase().startsWith("tweet 2:")) // Etiketleri filtrele
      .map(truncateTweet);
    
    if (tweets.length < 2) {
        console.warn("⚠️ Gemini AI beklenen formatta (en az 2 tweet) çıktı vermedi. Alınan:", tweets);
        // Eksik tweetleri boş string ile tamamla
        while (tweets.length < 2) {
            tweets.push("");
        }
    }


    console.log("✍️ Tweet 1 (Üretilen):", tweets[0]);
    console.log("✍️ Tweet 2 (Üretilen):", tweets[1]);
    
    return tweets.slice(0, 2);

  } catch (error) {
    console.error('❌ Gemini AI ile tweet üretilirken hata:', error.message);
    if (error.response && error.response.data) {
        console.error("🔍 Gemini Hata Detayları:", error.response.data);
    } else if (error.candidates && error.candidates.length > 0 && error.candidates[0].finishReason) {
        console.error("🔍 Gemini Bitirme Nedeni:", error.candidates[0].finishReason, error.candidates[0].safetyRatings);
    }
    return ["", ""]; // Hata durumunda boş tweetler
  }
}

module.exports = {
  generateTweetParts,
};
