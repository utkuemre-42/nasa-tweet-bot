// src/nasa.js
const axios = require('axios');
const config = require('../config.js'); // Ana dizindeki config.js'e ulaşır
const { getRandomDate, isImageUrl, isEnglish, loadPostedApods } = require('./utils.js'); // Aynı dizindeki utils.js

const NASA_APOD_URL = config.nasa.apodUrl;
const NASA_API_KEY = config.nasa.apiKey;

/**
 * NASA APOD API'sinden rastgele, daha önce paylaşılmamış ve uygun formatta bir görsel verisi çeker.
 * @param {number} retryCount Mevcut deneme sayısı.
 * @returns {Promise<object|null>} APOD verisi veya hata durumunda null.
 */
async function fetchUniqueApod(retryCount = 0) {
  if (!NASA_API_KEY) {
    console.error("❌ NASA API anahtarı (NASA_apiKey) config dosyasında veya .env içerisinde bulunamadı.");
    return null;
  }
  if (NASA_API_KEY === 'YOUR_NASA_API_KEY' || NASA_API_KEY === 'DEMO_KEY' && retryCount > 2) {
      console.warn("⚠️ DEMO_KEY kullanılıyor veya anahtar güncellenmemiş. API limitlerine takılabilirsiniz veya bazı tarihlerde veri alamayabilirsiniz.");
  }


  if (retryCount >= 10) {
    console.error("❌ 10 denemede uygun ve yeni APOD verisi bulunamadı.");
    return null;
  }

  try {
    const date = getRandomDate();
    const postedApods = loadPostedApods();

    if (postedApods.includes(date)) {
      console.warn(`⚠️ ${date} tarihli APOD daha önce paylaşılmış, tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    console.log(`⏳ (${retryCount + 1}. deneme) ${date} için APOD verisi çekiliyor...`);
    const response = await axios.get(NASA_APOD_URL, {
        params: {
            api_key: NASA_API_KEY,
            date: date,
            thumbs: false // Bazı API versiyonlarında thumbnail önizlemelerini engellemek için
        }
    });
    const apodData = response.data;

    if (!apodData || !apodData.url) {
        console.warn(`🤷 ${date}: APOD API'sinden geçerli veri alınamadı (URL yok), tekrar deneniyor... Yanıt:`, apodData);
        return fetchUniqueApod(retryCount + 1);
    }

    const { url, title, explanation, media_type } = apodData;
    const apodDate = apodData.date; // API'den gelen gerçek tarihi kullanmak daha güvenilir

    // APOD linkini oluştur
    const [year, month, day] = apodDate.split("-");
    const apodLink = `https://apod.nasa.gov/apod/ap${year.slice(2)}${month}${day}.html`;
    apodData.apod_link = apodLink; // Veriye linki ekle

    console.log("🗓️ APOD Tarihi:", apodDate);
    console.log("🔗 APOD Sayfası:", apodLink);


    if (media_type !== 'image' || !isImageUrl(url)) {
      console.warn(`⚠️ ${date}: Medya türü resim değil (${media_type}) veya URL geçersiz (${url}). Tekrar deneniyor...`);
      return fetchUniqueApod(retryCount + 1);
    }

    if (!isEnglish(title) || !isEnglish(explanation)) {
      console.warn(`⚠️ ${date}: İngilizce olmayan içerik algılandı. Başlık: "${title}". Tekrar deneniyor...`);
      // Gerekirse burada başlık ve açıklamayı loglayabilirsiniz.
      return fetchUniqueApod(retryCount + 1);
    }
    
    console.log(`👍 ${date}: Uygun APOD verisi bulundu: "${title}"`);
    return apodData;

  } catch (error) {
    console.error(`❌ APOD verisi çekilirken hata (Deneme ${retryCount + 1}, Tarih: ${error.config && error.config.params ? error.config.params.date : 'bilinmiyor'}):`, error.message);
    if (error.response) {
        console.error("🔍 Hata Detayları (status: " + error.response.status + "):", error.response.data);
        const requestDate = error.response.config && error.response.config.params ? error.response.config.params.date : 'bilinmeyen tarih';
        if (error.response.status === 404) {
            console.warn(`🤷 ${requestDate} tarihinde APOD bulunamadı, tekrar deneniyor...`);
            // 404 için çok sık deneme yapmamak adına biraz daha uzun bekleme eklenebilir veya deneme sayısı azaltılabilir.
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
            return fetchUniqueApod(retryCount + 1);
        }
         if (error.response.status === 429) { // Rate limit
            console.error("RATE_LIMIT: NASA API isteği sınırına ulaşıldı. 60 saniye sonra tekrar denenecek.");
            await new Promise(resolve => setTimeout(resolve, 60000));
            return fetchUniqueApod(retryCount); // Rate limit sonrası aynı deneme sayısı ile tekrar dene
        }
         if (error.response.status === 403) { // Forbidden - Genellikle API key ile ilgili sorun
            console.error("FORBIDDEN: NASA API anahtarı geçersiz veya yetkisi yok. Lütfen .env dosyasındaki NASA_apiKey değerini kontrol edin.");
            // Bu durumda botun devam etmesi anlamsız olabilir, programı sonlandırmayı düşünebilirsiniz.
            return null; // Veya process.exit(1);
        }
    } else if (error.request) {
        console.error("REQUEST_ERROR: APOD API'sine istek gönderildi ancak yanıt alınamadı.");
    }
    
    // Diğer genel hatalar için kısa bir bekleme ve yeniden deneme
    await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000)); // Deneme sayısına göre artan bekleme
    return fetchUniqueApod(retryCount + 1);
  }
}

module.exports = {
  fetchUniqueApod,
};
