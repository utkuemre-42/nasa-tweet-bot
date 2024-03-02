const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('./config.json'); // Yapılandırma dosyasını yükle

// Twitter API keys from config file
const client = new TwitterApi({
  appKey: config.twitter.appKey,
  appSecret: config.twitter.appSecret,
  accessToken: config.twitter.accessToken,
  accessSecret: config.twitter.accessSecret,
});

const NASA_APOD_URL = config.nasa.apodUrl;
const NASA_API_KEY = config.nasa.apiKey;

const genAI = new GoogleGenerativeAI(config.googleAI.apiKey);

// Function to get a random date
function getRandomDate() {
  const start = new Date(new Date().setFullYear(new Date().getFullYear() - 10));
  const end = new Date();
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
}

// Function to summarize text using AI
async function summarizeAI(longText) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro"});
  const prompt = `Return a less than 140 character (assuming every letter ise one character) Turkish tweet from the following text: ${longText}`;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = await response.text(); // Ensure the text is awaited correctly
  return text;
}

// Function to download the photo and tweet
async function tweetRandomNasaPhoto() {
  try {
    const date = getRandomDate();
    const response = await axios.get(`${NASA_APOD_URL}?api_key=${NASA_API_KEY}&date=${date}`);
    const { url, title, explanation } = response.data;
    // Summarize the explanation to fit within Twitter's character limit
    const summarizedText = await summarizeAI(explanation);
	console.log(summarizedText);
    // Download the image
    const filePath = path.resolve(__dirname, 'nasaPhoto.jpg');
    const writer = fs.createWriteStream(filePath);
    const photoResponse = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });
    photoResponse.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Upload to Twitter
    const mediaId = await client.v1.uploadMedia(filePath);
    // Tweet with the image and summarized text
    const tweet = await client.v2.tweet({ text: `🌌 ${summarizedText}`, media: { media_ids: [mediaId] } });
    console.log(`Tweet successfully posted, tweet id: ${tweet.data.id}`);

    // Delete the downloaded photo
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Call the function to post the tweet
tweetRandomNasaPhoto();
