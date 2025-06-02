const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('./config');

const client = new TwitterApi({
  appKey: config.twitter.appKey,
  appSecret: config.twitter.appSecret,
  accessToken: config.twitter.accessToken,
  accessSecret: config.twitter.accessSecret,
});

const NASA_APOD_URL = config.nasa.apodUrl;
const NASA_API_KEY = config.nasa.apiKey;
const genAI = new GoogleGenerativeAI(config.googleAI.apiKey);

function getRandomDate() {
  const start = new Date(new Date().setFullYear(new Date().getFullYear() - 10));
  const end = new Date();
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
}

function isImageUrl(url) {
  return /\.(jpg|jpeg|png|gif)$/i.test(url);
}

function isEnglish(text) {
  return /^[\x00-\x7F]*$/.test(text);
}

function truncateTweet(text) {
  return text.length <= 280 ? text : text.slice(0, 277) + '...';
}

async function generateTweetParts(title, explanation) {
  const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

  const prompt = `
    Title: ${title}
    Explanation: ${explanation}
    
    Given the following astronomy image metadata including a title and explanation, write two distinct Turkish tweets that each stay under 280 characters.
    
    Each tweet should be a single complete sentence written in formal, informative Turkish.
    
    Do not repeat sentence structures, words, or phrasing between the two tweets.
    
    Do not exceed 280 characters per tweet.
    
    Do not include hashtags, emojis, or markdown formatting.
    
    Do not add labels like "Tweet 1", "Tweet 2", or any extra commentary—just output the two tweet texts, one after the other.
    
    Tweet 1: Describe the astronomical object or event as seen in the image, with a focus on the visual and conceptual elements.
    
    Tweet 2: Include technical or observational details (e.g. telescope type, exposure duration, location, data filters, etc). Stay concise and factual.
    `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const rawText = await response.text();

  const tweets = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(truncateTweet);

  return tweets.slice(0, 2);
}

async function tweetRandomNasaPhoto(retryCount = 0) {
  if (retryCount >= 5) {
    console.error("❌ 5 denemede uygun görsel ve açıklama bulunamadı.");
    return;
  }

  try {
    const date = getRandomDate();
    const response = await axios.get(`${NASA_APOD_URL}?api_key=${NASA_API_KEY}&date=${date}`);
    const { url, title, explanation } = response.data;

    const apodDate = response.data.date;
    const [year, month, day] = apodDate.split("-");
    const apodLink = `https://apod.nasa.gov/apod/ap${year.slice(2)}${month}${day}.html`;

    console.log("APOD Tarihi:", apodDate);
    console.log("APOD Sayfası:", apodLink);

    if (!isImageUrl(url)) {
      console.warn("⚠️ Görsel değil, tekrar deneniyor...");
      return tweetRandomNasaPhoto(retryCount + 1);
    }

    if (!isEnglish(title) || !isEnglish(explanation)) {
      console.warn("⚠️ İngilizce olmayan içerik algılandı, tekrar deneniyor...");
      return tweetRandomNasaPhoto(retryCount + 1);
    }

    const tweetParts = await generateTweetParts(title, explanation);
    console.log("Tweet 1:", tweetParts[0]);
    console.log("Tweet 2:", tweetParts[1]);

    const filePath = path.resolve(__dirname, 'nasaPhoto.jpg');
    const writer = fs.createWriteStream(filePath);
    const photoResponse = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });
    photoResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const mediaId = await client.v1.uploadMedia(filePath);
    const firstTweet = await client.v2.tweet({ text: tweetParts[0], media: { media_ids: [mediaId] } });
    console.log(`✅ İlk tweet atıldı: ${firstTweet.data.id}`);

    if (tweetParts[1]) {
      const secondTweet = await client.v2.reply(tweetParts[1], firstTweet.data.id);
      console.log(`✅ İkinci tweet atıldı: ${secondTweet.data.id}`);
    }

    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('❌ Bir hata meydana geldi:', error.message);
    if (error.response?.status === 429) {
      console.error("❌ API isteği sınırına ulaşıldı (rate limit). Daha sonra tekrar deneyin.");
    } else if (error.response?.data) {
      console.error("🔍 Hata detayları:", error.response.data);
    }
  }
}

tweetRandomNasaPhoto();