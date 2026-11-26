// src/nasa.js
const axios = require('axios');
const config = require('../config.js');
const { getRandomDate, isImageUrl, isEnglish, loadPostedApods } = require('./utils.js');

const DEFAULT_APOD_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const NASA_APOD_URL = config.nasa.apodUrl || DEFAULT_APOD_URL;
const NASA_API_KEY = config.nasa.apiKey;
const MAX_TWITTER_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * WordPress yanıtlarından gelebilecek HTML etiketlerini ve sayısal/adlandırılmış entity'leri temizler.
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, ' ')
<<<<<<< HEAD
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
=======
>>>>>>> 05265d8497f5b5d4d372a4c2af03fbf76892f66e
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * APOD yanıtındaki olası görsel URL adaylarını öncelik sırasıyla toplar.
 */
function getCandidateImageUrls(apodData) {
  if (!apodData) return [];
  const candidates = [];

  if (apodData.hdurl && isImageUrl(apodData.hdurl)) {
    candidates.push(apodData.hdurl);
  }
  if (apodData.url && isImageUrl(apodData.url)) {
    candidates.push(apodData.url);
  }
  if (typeof apodData.basic_html === 'string') {
    const imgMatch = apodData.basic_html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      candidates.push(imgMatch[1]);
    }
  }
  if (apodData.hdurl && /^https?:\/\//i.test(apodData.hdurl)) {
    candidates.push(apodData.hdurl);
  }

  return [...new Set(candidates)];
}

/**
 * HEAD isteğiyle görselin gerçekten resim olup olmadığını ve 5 MB altında kaldığını kontrol eder.
 * Sunucu HEAD isteğini reddederse engellemez, asıl doğrulamayı downloadPhoto'ya bırakır.
 */
async function pickValidImageUrl(candidates) {
  for (const candidateUrl of candidates) {
    try {
      const headRes = await axios.head(candidateUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'nasa-tweet-bot/1.0' },
      });
      const contentType = (headRes.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const contentLength = Number(headRes.headers['content-length'] || 0);

      if (contentType && !contentType.startsWith('image/')) {
        console.warn(`⚠️ Aday URL görsel değil (${contentType}), atlanıyor: ${candidateUrl}`);
        continue;
      }
      if (contentLength > MAX_TWITTER_IMAGE_BYTES) {
        console.warn(`⚠️ Aday görsel 5 MB'tan büyük (${(contentLength / 1024 / 1024).toFixed(2)} MB), alternatif aranıyor: ${candidateUrl}`);
        continue;
      }
      return candidateUrl;
    } catch {
      // Sunucu HEAD desteklemiyorsa adayı yine de kabul et
      return candidateUrl;
    }
  }
  return null;
}

/**
 * NASA APOD API'sinden rastgele, daha önce paylaşılmamış ve uygun formatta bir görsel verisi çeker.
 * @param {number} retryCount Mevcut deneme sayısı.
 * @returns {Promise<object|null>}
 */
async function fetchUniqueApod(retryCount = 0) {
  const isLegacyApi = NASA_APOD_URL.includes('api.nasa.gov');

  if (isLegacyApi && !NASA_API_KEY) {
    console.error("❌ api.nasa.gov kullanılıyor ancak NASA_apiKey bulunamadı.");
    return null;
  }

  if (retryCount >= 10) {
    console.error("❌ 10 denemede uygun ve yeni APOD verisi bulunamadı.");
    return null;
  }

  const requestedDate = getRandomDate();

  try {
    const postedApods = loadPostedApods();

    if (postedApods.includes(requestedDate)) {
      console.warn(`⚠️ ${requestedDate} tarihli APOD daha önce paylaşılmış, tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    console.log(`⏳ (${retryCount + 1}. deneme) ${requestedDate} için APOD verisi çekiliyor...`);

    const params = { date: requestedDate };
    if (isLegacyApi) {
      params.api_key = NASA_API_KEY;
      params.thumbs = false;
    }

    const response = await axios.get(NASA_APOD_URL, {
      params,
      timeout: 15000,
      headers: {
        'User-Agent': 'nasa-tweet-bot/1.0',
        'Accept': 'application/json',
      },
    });

    const rawData = Array.isArray(response.data) ? response.data[0] : response.data;

    if (!rawData || typeof rawData !== 'object') {
      console.warn(`🤷 ${requestedDate}: APOD API'sinden boş yanıt döndü, tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    const apodDate = String(rawData.date || requestedDate).slice(0, 10);

    if (postedApods.includes(apodDate)) {
      console.warn(`⚠️ API'den dönen ${apodDate} tarihli APOD zaten paylaşılmış, tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    const mediaType = (rawData.media_type || '').toLowerCase();
    const title = cleanText(rawData.title);
    const explanation = cleanText(rawData.explanation);

    const [year, month, day] = apodDate.split('-');
    const fallbackLink = (year && month && day)
      ? `https://apod.nasa.gov/apod/ap${year.slice(2)}${month}${day}.html`
      : 'https://science.nasa.gov/apod/';

    const apodLink = rawData.permalink
      || (rawData.url && !isImageUrl(rawData.url) ? rawData.url : fallbackLink);

    console.log("🗓️ APOD Tarihi:", apodDate);
    console.log("🔗 APOD Sayfası:", apodLink);

    if (mediaType !== 'image') {
      console.warn(`⚠️ ${apodDate}: Medya türü resim değil (${mediaType || 'bilinmiyor'}). Tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    if (!title || !explanation || !isEnglish(title) || !isEnglish(explanation)) {
      console.warn(`⚠️ ${apodDate}: Geçersiz veya İngilizce olmayan içerik algılandı. Başlık: "${title}". Tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    const candidates = getCandidateImageUrls(rawData);
    const imageUrl = await pickValidImageUrl(candidates);

    if (!imageUrl) {
      console.warn(`⚠️ ${apodDate}: Twitter'a uygun (<= 5 MB) görsel URL'si bulunamadı. Tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    console.log(`👍 ${apodDate}: Uygun APOD verisi bulundu: "${title}"`);
    console.log("🖼️ Görsel URL:", imageUrl);

    return {
      ...rawData,
      date: apodDate,
      title,
      explanation,
      url: imageUrl,
      hdurl: imageUrl,
      apod_link: apodLink,
      media_type: mediaType,
    };

  } catch (error) {
    console.error(`❌ APOD verisi çekilirken hata (Deneme ${retryCount + 1}, Tarih: ${requestedDate}):`, error.message);

    if (error.response) {
      console.error(`🔍 Hata Detayları (status: ${error.response.status}):`, error.response.data);

      if (error.response.status === 404) {
        console.warn(`🤷 ${requestedDate} tarihinde APOD bulunamadı, tekrar deneniyor...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchUniqueApod(retryCount + 1);
      }

      if (error.response.status === 429) {
        console.error("RATE_LIMIT: NASA API isteği sınırına ulaşıldı. 60 saniye sonra tekrar denenecek.");
        await new Promise(resolve => setTimeout(resolve, 60000));
        return fetchUniqueApod(retryCount);
      }

      if (error.response.status === 403) {
        console.error("FORBIDDEN: Yetki veya API anahtarı hatası. NASA_apodUrl ve NASA_apiKey değerlerini kontrol edin.");
        return null;
      }
    } else if (error.request) {
      console.error("REQUEST_ERROR: APOD API'sine istek gönderildi ancak yanıt alınamadı.");
    }

    await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
    return fetchUniqueApod(retryCount + 1);
  }
}

module.exports = {
  fetchUniqueApod,
};