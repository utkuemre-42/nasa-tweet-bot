const { TwitterApi } = require('twitter-api-v2');
const config = require('./config');

const client = new TwitterApi({
  appKey: config.twitter.appKey,
  appSecret: config.twitter.appSecret,
  accessToken: config.twitter.accessToken,
  accessSecret: config.twitter.accessSecret,
});

async function testTweet() {
  try {
    console.log("Sadece metin tweeti deneniyor...");
    // Dikkat: Medya eklemiyoruz, sadece düz yazı
    const tweet = await client.v2.tweet("Bu API üzerinden atılan otomatik bir test tweetidir. " + new Date().toISOString());
    console.log("✅ Tweet BAŞARIYLA atıldı! ID:", tweet.data.id);
  } catch (error) {
    console.error("❌ HATA:", error.message);
    if (error.response?.data) {
      console.error("Detay:", error.response.data);
    }
  }
}

testTweet();