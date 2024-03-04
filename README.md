# NASA Fotoğrafları ile Twitter Botu

Bu bot, NASA'nın Astronomy Picture of the Day (APOD) API'sini kullanarak rastgele uzay fotoğrafları seçer, bu fotoğrafların açıklamalarını Twitter'da paylaşıma uygun olmaları için 140 karakterin altına düşürür ardından Türkçe'ye çevirir ve sonrasında ise bu metinle birlikte fotoğrafı Twitter'da paylaşır.

## Özellikler

- Rastgele bir tarih seçme ve bu tarihe ait NASA APOD fotoğrafını çekme.
- Fotoğrafın açıklamasını özetleyerek Twitter karakter limitine uygun hale getirme.
- Fotoğrafı ve özetlenmiş metni Twitter'da paylaşma.

## Kurulum

Bu projeyi kendi bilgisayarınızda çalıştırmak için aşağıdaki adımları takip edin.

### Önkoşullar

- Node.js kurulu olmalıdır.
- twitter-api-v2 , axios ve @google/generative-ai modüllerinin de kurulu olması gerekmektedir.
- Twitter ve Google Cloud Platform'da gerekli API anahtarlarına da sahip olmalısınız.

### Yapılandırma

1. Projeyi klonlayın veya indirin.


2. Bağımlılıkları kurun.


3. `config.json` dosyasını oluşturun ve aşağıdaki yapıyla doldurun:

```json
{
  "twitter": {
    "appKey": "YOUR_TWITTER_APP_KEY",
    "appSecret": "YOUR_TWITTER_APP_SECRET",
    "accessToken": "YOUR_TWITTER_ACCESS_TOKEN",
    "accessSecret": "YOUR_TWITTER_ACCESS_SECRET"
  },
  "nasa": {
    "apodUrl": "https://api.nasa.gov/planetary/apod",
    "apiKey": "YOUR_NASA_API_KEY"
  },
  "googleAI": {
    "apiKey": "YOUR_GOOGLE_AI_API_KEY"
  }
}
```

4. Çalıştırın
