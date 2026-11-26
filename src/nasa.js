// src/nasa.js
const axios = require('axios');
const config = require('../config.js');
const { getRandomDate, isEnglish, loadPostedApods } = require('./utils.js');

const DEFAULT_APOD_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const NASA_APOD_URL = config.nasa.apodUrl || DEFAULT_APOD_URL;
const NASA_API_KEY = config.nasa.apiKey;

/**
 * URL'nin doğrudan bir görsel dosyasına işaret edip etmediğini kontrol eder.
 * Query parametrelerini (?w=1024 vb.) yok sayarak pathname üzerinden bakar.
 */
function hasImageExtension(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const { pathname } = new URL(urlString);
    return /\.(jpe?g|png|gif|webp)$/i.test(pathname);
  } catch {
    return false;
  }
}

/**
 * APOD yanıtından indirilebilir gerçek görsel URL'sini çıkarır.
 */
function extractImageUrl(apodData) {
  if (!apodData) return null;

  // 1. Yeni API'de doğrudan görsel hdurl içinde gelir
  if (apodData.hdurl && hasImageExtension(apodData.hdurl)) {
    return apodData.hdurl;
  }

  // 2. Eski API uyumluluğu: url doğrudan görselse
  if (apodData.url && hasImageExtension(apodData.url)) {
    return apodData.url;
  }

  // 3. Yedek: basic_html içindeki ilk <img src="...">
  if (typeof apodData.basic_html === 'string') {
    const imgMatch = apodData.basic_html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  // 4. Uzantısız görsel/proxy URL'leri için son çare (hdurl varsa)
  if (apodData.hdurl && /^https?:\/\//i.test(apodData.hdurl)) {
    return apodData.hdurl;
  }

  return null;
}

/**
 * WordPress yanıtlarından gelebilecek HTML etiketlerini ve temel entity'leri temizler.
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#8217;|&apos;/g, "'")
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * NASA APOD API'sinden rastgele, daha önce paylaşılmamış ve uygun formatta bir görsel verisi çeker.
 * @param {number} retryCount Mevcut deneme sayısı.
 * @returns {Promise<object|null>} APOD verisi veya hata durumunda null.
 */
async function fetchUniqueApod(retryCount = 0) {
  const isLegacyApi = NASA_APOD_URL.includes('api.nasa.gov');

  if (isLegacyApi && !NASA_API_KEY) {
    console.error("❌ api.nasa.gov kullanılıyor ancak NASA_apiKey bulunamadı.");
    return null;
  }

  if (isLegacyApi && (NASA_API_KEY === 'YOUR_NASA_API_KEY' || (NASA_API_KEY === 'DEMO_KEY' && retryCount > 2))) {
    console.warn("⚠️ DEMO_KEY kullanılıyor veya anahtar güncellenmemiş. API limitlerine takılabilirsiniz.");
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

    // Yeni API dizi ([{...}]), eski API obje ({...}) döndürebilir
    const rawData = Array.isArray(response.data) ? response.data[0] : response.data;

    if (!rawData || typeof rawData !== 'object') {
      console.warn(`🤷 ${requestedDate}: APOD API'sinden veri dönmedi (boş yanıt), tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    const apodDate = String(rawData.date || requestedDate).slice(0, 10);

    // API istenen tarih yerine başka bir tarih döndürdüyse tekrar paylaşmayı engelle
    if (postedApods.includes(apodDate)) {
      console.warn(`⚠️ API'den dönen ${apodDate} tarihli APOD zaten paylaşılmış (istenen: ${requestedDate}), tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    const mediaType = (rawData.media_type || '').toLowerCase();
    const imageUrl = extractImageUrl(rawData);
    const title = cleanText(rawData.title);
    const explanation = cleanText(rawData.explanation);

    const [year, month, day] = apodDate.split('-');
    const fallbackLink = (year && month && day)
      ? `https://apod.nasa.gov/apod/ap${year.slice(2)}${month}${day}.html`
      : 'https://science.nasa.gov/apod/';

    const apodLink = rawData.permalink
      || (rawData.url && !hasImageExtension(rawData.url) ? rawData.url : fallbackLink);

    console.log("🗓️ APOD Tarihi:", apodDate);
    console.log("🔗 APOD Sayfası:", apodLink);

    if (mediaType !== 'image' || !imageUrl) {
      console.warn(`⚠️ ${apodDate}: Medya türü resim değil (${mediaType || 'bilinmiyor'}) veya görsel URL'si bulunamadı. Tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    if (!title || !explanation || !isEnglish(title) || !isEnglish(explanation)) {
      console.warn(`⚠️ ${apodDate}: Geçersiz veya İngilizce olmayan içerik algılandı. Başlık: "${title}". Tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    console.log(`👍 ${apodDate}: Uygun APOD verisi bulundu: "${title}"`);
    console.log("🖼️ Görsel URL:", imageUrl);

    return {
      ...rawData,
      date: apodDate,
      title,
      explanation,
      url: imageUrl,       // main.js görseli bu alandan indiriyor
      hdurl: imageUrl,
      apod_link: apodLink, // logs.json için makale linki
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