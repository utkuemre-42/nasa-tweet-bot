// src/nasa.js
const axios = require('axios');
const config = require('../config.js');
const { getRandomDate, isImageUrl, isEnglish, loadPostedApods } = require('./utils.js');

const DEFAULT_APOD_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const NASA_APOD_URL = config.nasa.apodUrl || DEFAULT_APOD_URL;
const NASA_API_KEY = config.nasa.apiKey;
const MAX_TWITTER_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ARCHIVE_PAGES = 3650; // Son ~10 yıl (tüm arşiv için 11400 yapabilirsin)

const HTML_ENTITIES = {
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lt: '<',
  gt: '>',
};

/**
 * URL'nin alan adının tam olarak eski api.nasa.gov olup olmadığını kontrol eder.
 */
function isLegacyNasaApi(urlString) {
  try {
    return new URL(urlString).hostname === 'api.nasa.gov';
  } catch {
    return false;
  }
}

/**
 * WordPress yanıtlarından gelebilecek HTML etiketlerini ve entity'leri tek geçişte temizler.
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|amp|quot|apos|nbsp|lt|gt);/gi, (match, entity) => {
      if (entity[0] === '#') {
        const isHex = entity[1] === 'x' || entity[1] === 'X';
        const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      return HTML_ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Açıklama metninden "Explanation:" önekini ve "Tomorrow's picture:" sonekini temizler.
 */
function cleanExplanation(text) {
  let cleaned = cleanText(text).replace(/^Explanation:\s*/i, '');
  const tomorrowIndex = cleaned.toLowerCase().indexOf("tomorrow's picture:");
  if (tomorrowIndex !== -1) {
    cleaned = cleaned.slice(0, tomorrowIndex);
  }
  return cleaned.trim();
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
      return candidateUrl;
    }
  }
  return null;
}

/**
 * NASA APOD API'sinden rastgele, daha önce paylaşılmamış ve uygun formatta bir görsel verisi çeker.
 * @param {number} retryCount Mevcut deneme sayısı.
 * @param {Set<number>} triedPages Bu çalışmada denenmiş sayfa numaraları.
 * @returns {Promise<object|null>}
 */
async function fetchUniqueApod(retryCount = 0, triedPages = new Set()) {
  const isLegacyApi = isLegacyNasaApi(NASA_APOD_URL);

  if (isLegacyApi && !NASA_API_KEY) {
    console.error("❌ api.nasa.gov kullanılıyor ancak NASA_apiKey bulunamadı.");
    return null;
  }

  if (retryCount >= 10) {
    console.error("❌ 10 denemede uygun ve yeni APOD verisi bulunamadı.");
    return null;
  }

  let requestLabel = '';
  let params = {};

  if (isLegacyApi) {
    const requestedDate = getRandomDate();
    const postedApods = loadPostedApods();
    if (postedApods.includes(requestedDate)) {
      console.warn(`⚠️ ${requestedDate} tarihli APOD daha önce paylaşılmış, tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1, triedPages);
    }
    requestLabel = `tarih: ${requestedDate}`;
    params = {
      api_key: NASA_API_KEY,
      date: requestedDate,
      thumbs: false,
    };
  } else {
    let randomPage = Math.floor(Math.random() * MAX_ARCHIVE_PAGES) + 1;
    while (triedPages.has(randomPage)) {
      randomPage = Math.floor(Math.random() * MAX_ARCHIVE_PAGES) + 1;
    }
    triedPages.add(randomPage);
    requestLabel = `sayfa: ${randomPage}`;
    params = {
      per_page: 1,
      page: randomPage,
    };
  }

  try {
    const postedApods = loadPostedApods();
    console.log(`⏳ (${retryCount + 1}. deneme) APOD verisi çekiliyor (${requestLabel})...`);

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
      console.warn(`🤷 (${requestLabel}): APOD API'sinden boş yanıt döndü, tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1, triedPages);
    }

    const apodDate = String(rawData.date || '').slice(0, 10);

    if (!apodDate) {
      console.warn(`🤷 (${requestLabel}): APOD tarihinde veri yok, tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1, triedPages);
    }

    if (postedApods.includes(apodDate)) {
      console.warn(`⚠️ ${apodDate} tarihli APOD daha önce paylaşılmış, tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1, triedPages);
    }

    const mediaType = (rawData.media_type || '').toLowerCase();
    const title = cleanText(rawData.title);
    const explanation = cleanExplanation(rawData.explanation);

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
      return fetchUniqueApod(retryCount + 1, triedPages);
    }

    if (!title || !explanation || !isEnglish(title) || !isEnglish(explanation)) {
      console.warn(`⚠️ ${apodDate}: Geçersiz veya İngilizce olmayan içerik algılandı. Başlık: "${title}". Tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1, triedPages);
    }

    const candidates = getCandidateImageUrls(rawData);
    const imageUrl = await pickValidImageUrl(candidates);

    if (!imageUrl) {
      console.warn(`⚠️ ${apodDate}: Twitter'a uygun (<= 5 MB) görsel URL'si bulunamadı. Tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1, triedPages);
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
    console.error(`❌ APOD verisi çekilirken hata (Deneme ${retryCount + 1}, ${requestLabel}):`, error.message);

    if (error.response) {
      console.error(`🔍 Hata Detayları (status: ${error.response.status}):`, error.response.data);

      if (error.response.status === 404 || error.response.status === 400) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchUniqueApod(retryCount + 1, triedPages);
      }

      if (error.response.status === 429) {
        console.error("RATE_LIMIT: NASA API isteği sınırına ulaşıldı. 60 saniye sonra tekrar denenecek.");
        await new Promise(resolve => setTimeout(resolve, 60000));
        return fetchUniqueApod(retryCount, triedPages);
      }

      if (error.response.status === 403) {
        console.error("FORBIDDEN: Yetki veya API anahtarı hatası. NASA_apodUrl ve NASA_apiKey değerlerini kontrol edin.");
        return null;
      }
    } else if (error.request) {
      console.error("REQUEST_ERROR: APOD API'sine istek gönderildi ancak yanıt alınamadı.");
    }

    await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
    return fetchUniqueApod(retryCount + 1, triedPages);
  }
}

module.exports = {
  fetchUniqueApod,
};