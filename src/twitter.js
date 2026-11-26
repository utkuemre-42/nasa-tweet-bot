// src/twitter.js
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const client = new TwitterApi({
  appKey: config.twitter.appKey,
  appSecret: config.twitter.appSecret,
  accessToken: config.twitter.accessToken,
  accessSecret: config.twitter.accessSecret,
});

const TEMP_IMAGE_DIR = path.resolve(__dirname, '../temp_images');
if (!fs.existsSync(TEMP_IMAGE_DIR)) {
  fs.mkdirSync(TEMP_IMAGE_DIR, { recursive: true });
  console.log(`📂 Geçici resim klasörü oluşturuldu: ${TEMP_IMAGE_DIR}`);
}

const MAX_TWITTER_IMAGE_BYTES = 5 * 1024 * 1024; // Twitter görsel sınırı: 5 MB

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

/**
 * Verilen URL'den bir fotoğrafı doğrular ve geçici bir dosyaya indirir.
 * @param {string} imageUrl İndirilecek fotoğrafın URL'si.
 * @param {string} date APOD tarihi, dosya adı için kullanılacak.
 * @returns {Promise<string|null>} İndirilen dosyanın yolu veya hata durumunda null.
 */
async function downloadPhoto(imageUrl, date) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    console.error("⚠️ Geçersiz resim URL'si, indirme işlemi yapılamadı.");
    return null;
  }

  let filePath = null;

  try {
    console.log(`📥 Fotoğraf indiriliyor: ${imageUrl}`);
    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'nasa-tweet-bot/1.0',
        'Accept': 'image/*,*/*;q=0.8',
      },
    });

    const contentType = (response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) {
      console.error(`❌ İndirilen içerik görsel değil (content-type: ${contentType || 'yok'}): ${imageUrl}`);
      response.data.destroy();
      return null;
    }

    const contentLength = Number(response.headers['content-length'] || 0);
    if (contentLength > MAX_TWITTER_IMAGE_BYTES) {
      console.error(`❌ Görsel Twitter'ın 5 MB sınırını aşıyor (${(contentLength / 1024 / 1024).toFixed(2)} MB): ${imageUrl}`);
      response.data.destroy();
      return null;
    }

    const ext = MIME_TO_EXT[contentType] || '.jpg';
    const imageName = `apod_${date}_${Date.now()}${ext}`;
    filePath = path.join(TEMP_IMAGE_DIR, imageName);

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return await new Promise((resolve) => {
      const cleanupAndFail = (reason, err) => {
        console.error(`❌ Fotoğraf indirilirken ${reason} (${filePath}):`, err.message);
        writer.destroy();
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, () => {});
        }
        resolve(null);
      };

      response.data.on('error', (err) => cleanupAndFail('akış hatası', err));
      writer.on('error', (err) => cleanupAndFail('yazma hatası', err));

      writer.on('finish', () => {
        try {
          const { size } = fs.statSync(filePath);
          if (size === 0 || size > MAX_TWITTER_IMAGE_BYTES) {
            console.error(`❌ İndirilen dosya geçersiz veya 5 MB sınırını aşıyor (${(size / 1024 / 1024).toFixed(2)} MB).`);
            fs.unlinkSync(filePath);
            return resolve(null);
          }
          console.log(`✅ Fotoğraf başarıyla indirildi (${(size / 1024).toFixed(0)} KB): ${filePath}`);
          resolve(filePath);
        } catch (statErr) {
          cleanupAndFail('dosya doğrulama hatası', statErr);
        }
      });
    });
  } catch (error) {
    console.error(`❌ Fotoğraf indirilirken genel hata (${imageUrl}):`, error.message);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return null;
  }
}

/**
 * Verilen fotoğrafı Twitter'a yükler.
 * @param {string} filePath Yüklenecek fotoğrafın dosya yolu.
 * @returns {Promise<string|null>}
 */
async function uploadMediaToTwitter(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`⚠️ Medya yüklenemedi: Dosya bulunamadı (${filePath})`);
    return null;
  }
  try {
    console.log(`🔼 Medya Twitter'a yükleniyor: ${filePath}`);
    const mediaId = await client.v1.uploadMedia(filePath);
    console.log(`✅ Medya başarıyla yüklendi. ID: ${mediaId}`);
    return mediaId;
  } catch (error) {
    console.error(`❌ Medya Twitter'a yüklenirken hata (${filePath}):`, error.message);
    if (error.data && error.data.errors) {
      console.error("Twitter API Hata Detayları:", JSON.stringify(error.data.errors, null, 2));
    }
    return null;
  }
}

/**
 * Metin ve medya ile bir tweet atar.
 * @param {string} text
 * @param {string} mediaId
 * @returns {Promise<object|null>}
 */
async function postTweet(text, mediaId) {
  if (!text || text.trim() === "") {
    console.warn("⚠️ Boş tweet metni, tweet atılmayacak.");
    return null;
  }
  if (!mediaId) {
    console.error("⚠️ Medya ID'si yok, tweet atılamaz.");
    return null;
  }

  try {
    console.log(`🕊️ Tweet atılıyor: "${text}" (Medya ID: ${mediaId})`);
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
    if (error.data && error.data.detail) {
      console.error("Twitter API Hata Detayı (v2):", error.data.detail);
    } else if (error.data && error.data.errors) {
      console.error("Twitter API Hata Detayları (v2):", JSON.stringify(error.data.errors, null, 2));
    } else if (error.code === 403) {
      console.error("Twitter API 403 Hatası (Muhtemelen duplicate tweet veya izin sorunu):", error.data ? error.data.detail : "Detay yok");
    }
    return null;
  }
}

/**
 * Belirli bir tweet'e yanıt olarak bir tweet atar.
 * @param {string} text
 * @param {string} originalTweetId
 * @returns {Promise<object|null>}
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