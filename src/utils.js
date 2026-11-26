// src/utils.js
const fs = require('fs');
const config = require('../config');

/**
 * Belirtilen aralıkta rastgele bir tarih oluşturur (son 10 yıl, üst sınır dün).
 * @returns {string} 'YYYY-MM-DD' formatında rastgele tarih.
 */
function getRandomDate() {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 10);
  // ABD saat dilimi farkı nedeniyle henüz yayınlanmamış bugünü hariç tut
  const end = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
    .toISOString()
    .split('T')[0];
}

/**
 * Verilen URL'nin (query parametreleri hariç) bir resim URL'si olup olmadığını kontrol eder.
 * @param {string} url Kontrol edilecek URL.
 * @returns {boolean} Resim URL'si ise true, değilse false.
 */
function isImageUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const { pathname } = new URL(url);
    return /\.(jpe?g|png|gif|webp)$/i.test(pathname);
  } catch {
    return false;
  }
}

/**
 * Metnin İngilizce/Latin alfabesi ağırlıklı olup olmadığını kontrol eder.
 * WordPress'in ürettiği tipografik karakterlere (’ — °) ve aksanlı isimlere izin verir;
 * Kiril, Arapça, CJK gibi farklı alfabeleri eler.
 * @param {string} text Kontrol edilecek metin.
 * @returns {boolean}
 */
function isEnglish(text) {
  if (typeof text !== 'string' || text.trim().length === 0) return false;
  return !/[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text);
}

/**
 * Tweet metnini 280 karakter sınırına göre kısaltır.
 * @param {string} text Kısaltılacak metin.
 * @returns {string}
 */
function truncateTweet(text) {
  if (typeof text !== 'string') return '';
  return text.length <= 280 ? text : text.slice(0, 277) + '...';
}

/**
 * Daha önce paylaşılan APOD tarihlerini JSON dosyasından yükler.
 * @returns {string[]}
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
    return [];
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
 * @param {object} logData
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
 * @param {string} filePath
 */
async function deleteTempFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
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
  deleteTempFile,
};