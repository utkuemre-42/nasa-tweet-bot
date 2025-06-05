// src/twitter.js
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config'); // Ana dizindeki config.js'e ulaşır

const client = new TwitterApi({
  appKey: config.twitter.appKey,
  appSecret: config.twitter.appSecret,
  accessToken: config.twitter.accessToken,
  accessSecret: config.twitter.accessSecret,
});

// Geçici resimlerin saklanacağı klasör (ana dizinde temp_images)
const TEMP_IMAGE_DIR = path.resolve(__dirname, '../temp_images');
if (!fs.existsSync(TEMP_IMAGE_DIR)){
    fs.mkdirSync(TEMP_IMAGE_DIR, { recursive: true });
    console.log(`📂 Geçici resim klasörü oluşturuldu: ${TEMP_IMAGE_DIR}`);
}


/**
 * Verilen URL'den bir fotoğrafı geçici bir dosyaya indirir.
 * @param {string} imageUrl İndirilecek fotoğrafın URL'si.
 * @param {string} date APOD tarihi, dosya adı için kullanılacak.
 * @returns {Promise<string|null>} İndirilen dosyanın yolu veya hata durumunda null.
 */
async function downloadPhoto(imageUrl, date) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    console.error("⚠️ Geçersiz resim URL'si, indirme işlemi yapılamadı.");
    return null;
  }
  // Dosya adını APOD tarihinden ve rastgele bir bileşenden oluşturarak benzersizliği artır.
  const imageName = `apod_${date}_${Date.now()}.jpg`;
  const filePath = path.join(TEMP_IMAGE_DIR, imageName);

  try {
    console.log(`📥 Fotoğraf indiriliyor: ${imageUrl} -> ${filePath}`);
    const writer = fs.createWriteStream(filePath);
    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Fotoğraf başarıyla indirildi: ${filePath}`);
        resolve(filePath);
      });
      writer.on('error', (error) => {
        console.error(`❌ Fotoğraf indirilirken yazma hatası (${filePath}):`, error.message);
        // Hata durumunda dosyayı silmeye çalış, eğer varsa
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) console.error(`⚠️ İndirme hatası sonrası dosya silinemedi (${filePath}):`, unlinkErr.message);
            });
        }
        reject(null); // Hata durumunda null döndür
      });
    });
  } catch (error) {
    console.error(`❌ Fotoğraf indirilirken genel hata (${imageUrl}):`, error.message);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Hata durumunda oluşturulmuş olabilecek dosyayı sil
    }
    return null;
  }
}


/**
 * Verilen fotoğrafı Twitter'a yükler.
 * @param {string} filePath Yüklenecek fotoğrafın dosya yolu.
 * @returns {Promise<string|null>} Yüklenen medyanın ID'si veya hata durumunda null.
 */
async function uploadMediaToTwitter(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`⚠️ Medya yüklenemedi: Dosya bulunamadı (${filePath})`);
    return null;
  }
  try {
    console.log(`🔼 Medya Twitter'a yükleniyor: ${filePath}`);
    // Twitter API v1.1 uploadMedia kullanılıyor (twitter-api-v2 kütüphanesi bunu sarmalar)
    const mediaId = await client.v1.uploadMedia(filePath);
    console.log(`✅ Medya başarıyla yüklendi. ID: ${mediaId}`);
    return mediaId;
  } catch (error) {
    console.error(`❌ Medya Twitter'a yüklenirken hata (${filePath}):`, error.message);
     if (error.data && error.data.errors) { // Twitter API'sinden gelen spesifik hata mesajları
        console.error("Twitter API Hata Detayları:", JSON.stringify(error.data.errors, null, 2));
    }
    return null;
  }
}

/**
 * Metin ve medya ile bir tweet atar.
 * @param {string} text Tweet metni.
 * @param {string} mediaId Tweet'e eklenecek medyanın ID'si.
 * @returns {Promise<object|null>} Atılan tweetin verisi veya hata durumunda null.
 */
async function postTweet(text, mediaId) {
  if (!text || text.trim() === "") {
    console.warn("⚠️ Boş tweet metni, tweet atılmayacak.");
    return null;
  }
  if (!mediaId) {
    console.error("⚠️ Medya ID'si yok, tweet atılamaz.");
    return null; // Medyasız tweet atmak istemiyoruz bu bot için
  }

  try {
    console.log(`🕊️ Tweet atılıyor: "${text}" (Medya ID: ${mediaId})`);
    // Twitter API v2 tweet endpoint'i kullanılıyor
    const tweetResponse = await client.v2.tweet({ text, media: { media_ids: [mediaId] } });
    if (tweetResponse && tweetResponse.data) {
        console.log(`✅ Tweet başarıyla atıldı. ID: ${tweetResponse.data.id}`);
        return tweetResponse.data;
    } else {
        console.error('❌ Tweet atıldı ancak API yanıtı beklenmedik formatta:', tweetResponse);
        return null;
    }
  } catch (error) {
    console.error('❌ Tweet atılırken hata:', error.message);
    if (error.data && error.data.detail) { // v2 API'den gelen genel hata
        console.error("Twitter API Hata Detayı (v2):", error.data.detail);
    } else if (error.data && error.data.errors) { // v2 API'den gelen spesifik hatalar (örn: field errors)
         console.error("Twitter API Hata Detayları (v2):", JSON.stringify(error.data.errors, null, 2));
    }  else if (error.code === 403) { // Örneğin duplicate tweet hatası (status code 403, error code 187)
         console.error("Twitter API 403 Hatası (Muhtemelen duplicate tweet veya izin sorunu):", error.data ? error.data.detail : "Detay yok");
    }
    return null;
  }
}

/**
 * Belirli bir tweet'e yanıt olarak bir tweet atar.
 * @param {string} text Yanıt tweet'inin metni.
 * @param {string} originalTweetId Yanıt verilecek orijinal tweet'in ID'si.
 * @returns {Promise<object|null>} Atılan yanıt tweetinin verisi veya hata durumunda null.
 */
async function replyToTweet(text, originalTweetId) {
  if (!text || text.trim() === "") {
    console.warn("⚠️ Boş yanıt metni, yanıt atılmayacak.");
    return null;
  }
  if (!originalTweetId) {
    console.error("⚠️ Orijinal tweet ID'si yok, yanıt atılamaz.");
    return null;
  }
  try {
    console.log(`↪️ Yanıt tweet atılıyor (Tweet ID: ${originalTweetId}): "${text}"`);
    const replyResponse = await client.v2.reply(text, originalTweetId);
     if (replyResponse && replyResponse.data) {
        console.log(`✅ Yanıt tweet başarıyla atıldı. ID: ${replyResponse.data.id}`);
        return replyResponse.data;
    } else {
        console.error('❌ Yanıt tweet atıldı ancak API yanıtı beklenmedik formatta:', replyResponse);
        return null;
    }
  } catch (error) {
    console.error(`❌ Yanıt tweet atılırken hata (Yanıt verilen ID: ${originalTweetId}):`, error.message);
     if (error.data && error.data.detail) {
        console.error("Twitter API Hata Detayı:", error.data.detail);
    } else if (error.data && error.data.errors) {
         console.error("Twitter API Hata Detayları:", JSON.stringify(error.data.errors, null, 2));
    }
    return null;
  }
}

module.exports = {
  downloadPhoto,
  uploadMediaToTwitter,
  postTweet,
  replyToTweet,
};
