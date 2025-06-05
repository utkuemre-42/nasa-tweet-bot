// src/utils.js
const fs = require('fs');
const path = require('path');
const config = require('../config'); // config.js'nin kök dizinde olduğunu varsayıyoruz

/**
 * Belirtilen aralıkta rastgele bir tarih oluşturur (son 10 yıl).
 * @returns {string} 'YYYY-MM-DD' formatında rastgele tarih.
 */
function getRandomDate() {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 10); // Son 10 yıl
  const end = new Date();
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
    .toISOString().split('T')[0];
}

/**
 * Verilen URL'nin bir resim URL'si olup olmadığını kontrol eder.
 * @param {string} url Kontrol edilecek URL.
 * @returns {boolean} Resim URL'si ise true, değilse false.
 */
function isImageUrl(url) {
  return typeof url === 'string' && /\.(jpg|jpeg|png|gif)$/i.test(url);
}

/**
 * Verilen metnin sadece İngilizce karakterler içerip içermediğini kontrol eder.
 * @param {string} text Kontrol edilecek metin.
 * @returns {boolean} Sadece İngilizce ise true, değilse false.
 */
function isEnglish(text) {
  return typeof text === 'string' && /^[\x00-\x7F]*$/.test(text);
}

/**
 * Tweet metnini 280 karakter sınırına göre kısaltır.
 * @param {string} text Kısaltılacak metin.
 * @returns {string} Kısaltılmış veya orijinal metin.
 */
function truncateTweet(text) {
  if (typeof text !== 'string') return '';
  return text.length <= 280 ? text : text.slice(0, 277) + '...';
}

/**
 * Daha önce paylaşılan APOD tarihlerini JSON dosyasından yükler.
 * @returns {string[]} Paylaşılmış APOD tarihlerinin listesi.
 */
function loadPostedApods() {
  try {
    if (fs.existsSync(config.postedApodsPath)) {
      const data = fs.readFileSync(config.postedApodsPath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('⚠️ Paylaşılan APOD listesi yüklenirken hata:', error.message);
    return []; // Hata durumunda boş liste döndür
  }
}

/**
 * Yeni paylaşılan bir APOD tarihini JSON dosyasına kaydeder.
 * @param {string} date Kaydedilecek APOD tarihi ('YYYY-MM-DD').
 */
function savePostedApod(date) {
  if (typeof date !== 'string') {
    console.error('⚠️ Geçersiz tarih formatı, APOD tarihi kaydedilemedi.');
    return;
  }
  const postedApods = loadPostedApods();
  if (!postedApods.includes(date)) {
    postedApods.push(date);
    try {
      fs.writeFileSync(config.postedApodsPath, JSON.stringify(postedApods, null, 2));
      console.log(`💾 APOD tarihi (${date}) başarıyla kaydedildi.`);
    } catch (error) {
      console.error('⚠️ APOD tarihi kaydedilirken hata:', error.message);
    }
  }
}

/**
 * Atılan tweet bilgilerini logs.json dosyasına kaydeder.
 * @param {object} logData Kaydedilecek log verisi (tarih, başlık, url, tweetId vb.).
 */
function logTweet(logData) {
  if (typeof logData !== 'object' || logData === null) {
    console.error('⚠️ Geçersiz log verisi, log kaydedilemedi.');
    return;
  }
  let logs = [];
  try {
    if (fs.existsSync(config.logsPath)) {
      const data = fs.readFileSync(config.logsPath, 'utf8');
      logs = JSON.parse(data);
    }
  } catch (error) {
    console.error('⚠️ Log dosyası okunurken/ayrıştırılırken hata:', error.message);
    // Hata durumunda mevcut logları kaybetmemek için devam et, yeni loglar eklenecek.
  }

  logs.push({ timestamp: new Date().toISOString(), ...logData });

  try {
    fs.writeFileSync(config.logsPath, JSON.stringify(logs, null, 2));
    console.log('📊 Tweet logları başarıyla kaydedildi.');
  } catch (error) {
    console.error('⚠️ Tweet logları kaydedilirken hata:', error.message);
  }
}

/**
 * Geçici olarak indirilen medya dosyasını siler.
 * @param {string} filePath Silinecek dosyanın yolu.
 */
async function deleteTempFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Geçici dosya silindi: ${filePath}`);
        }
    } catch (error) {
        console.error(`⚠️ Geçici dosya silinirken hata (${filePath}):`, error.message);
    }
}

module.exports = {
  getRandomDate,
  isImageUrl,
  isEnglish,
  truncateTweet,
  loadPostedApods,
  savePostedApod,
  logTweet,
  deleteTempFile
};
