require('dotenv').config();

const config = {
  twitter: {
    appKey: process.env.TWITTER_appKey,
    appSecret: process.env.TWITTER_appSecret,
    accessToken: process.env.TWITTER_accessToken,
    accessSecret: process.env.TWITTER_accessSecret
  },
  nasa: {
    apodUrl: process.env.NASA_apodUrl,
    apiKey: process.env.NASA_apiKey
  },
  googleAI: {
    apiKey: process.env.GOOGLEAI_apiKey
  }
};

module.exports = config;
