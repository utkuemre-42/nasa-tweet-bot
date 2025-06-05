// main.js
const path = require('path');
const { fetchUniqueApod } = require('./src/nasa');
const { generateTweetParts } = require('./src/gemini');
const { downloadPhoto, uploadMediaToTwitter, postTweet, replyToTweet } = require('./src/twitter');
const { savePostedApod, logTweet, deleteTempFile } = require('./src/utils');
const config = require('./config'); // Ana config dosyasını kullanıyoruz

async function runBot() {
  console.log("🚀 NASA APOD Twitter Botu Başlatılıyor...");

  try {
    // 1. Benzersiz APOD verisi çek
    const apodData = await fetchUniqueApod();
    if (!apodData) {
      console.error("❌ Bot sonlandırılıyor: Uygun APOD verisi alınamadı.");
      return;
    }
    const { title, explanation, url: imageUrl, date: apodDate, apod_link } = apodData;
    console.log(`🌌 İşlenecek APOD: "${title}" (${apodDate})`);

    // 2. Tweet metinlerini üret
    const tweetParts = await generateTweetParts(title, explanation);
    if (!tweetParts || tweetParts.some(p => !p)) { // Eğer tweetlerden biri boşsa
        console.warn("⚠️ Gemini AI'dan eksik tweet metinleri alındı. İşlem bu APOD için durduruluyor.");
        // İsteğe bağlı olarak, bu tarihi "başarısız" olarak işaretleyebilir veya loglayabilirsiniz.
        // Şimdilik sadece bir sonraki çalıştırmada tekrar denenmesine izin veriyoruz.
        return;
    }
    const [firstTweetText, secondTweetText] = tweetParts;


    // 3. Fotoğrafı indir
    const tempPhotoPath = await downloadPhoto(imageUrl, apodDate); // apodDate'i dosya adı için kullan
    if (!tempPhotoPath) {
      console.error("❌ Bot sonlandırılıyor: Fotoğraf indirilemedi.");
      return;
    }

    // 4. Medyayı Twitter'a yükle
    const mediaId = await uploadMediaToTwitter(tempPhotoPath);
    if (!mediaId) {
      console.error("❌ Bot sonlandırılıyor: Medya yüklenemedi.");
      await deleteTempFile(tempPhotoPath); // Geçici dosyayı sil
      return;
    }

    // 5. İlk tweet'i at
    const firstTweetResponse = await postTweet(firstTweetText, mediaId);
    if (!firstTweetResponse) {
      console.error("❌ Bot sonlandırılıyor: İlk tweet atılamadı.");
      await deleteTempFile(tempPhotoPath); // Geçici dosyayı sil
      return;
    }
    console.log(`✅ İlk tweet başarıyla atıldı: ${firstTweetResponse.id}`);

    // 6. İkinci tweet'i (yanıt olarak) at (eğer varsa)
    let secondTweetResponseId = null;
    if (secondTweetText && secondTweetText.trim() !== "") {
      const secondTweetResponse = await replyToTweet(secondTweetText, firstTweetResponse.id);
      if (secondTweetResponse) {
        secondTweetResponseId = secondTweetResponse.id;
        console.log(`✅ İkinci tweet (yanıt) başarıyla atıldı: ${secondTweetResponse.id}`);
      } else {
        console.warn("⚠️ İkinci tweet (yanıt) atılamadı, ancak ilk tweet başarılı.");
      }
    } else {
        console.log("ℹ️ İkinci tweet için metin üretilmedi veya boş, yanıt atlanıyor.");
    }

    // 7. APOD tarihini kaydet
    savePostedApod(apodDate);

    // 8. Log kaydı yap
    logTweet({
      apodDate,
      title,
      apodUrl: apod_link, // APOD HTML sayfası URL'si
      imageUrl,
      firstTweetId: firstTweetResponse.id,
      firstTweetText,
      secondTweetId: secondTweetResponseId,
      secondTweetText: secondTweetText || null, // Eğer yoksa null
    });

    // 9. Geçici fotoğrafı sil
    await deleteTempFile(tempPhotoPath);

    console.log("🎉 NASA APOD Twitter Botu görevini başarıyla tamamladı!");

  } catch (error) {
    console.error('❌ Bot çalışırken ana bir hata meydana geldi:', error.message);
    if (error.stack) {
        console.error(error.stack);
    }
    // Hata durumunda indirilen geçici dosyaları silmeye çalış
    // (tempPhotoPath değişkeni bu scope'ta olmayabilir, genel bir temizlik fonksiyonu düşünülebilir)
  }
}

// Botu çalıştır
runBot();
