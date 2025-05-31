# NASA Fotoğrafları ile Twitter Botu

Bu Node.js tabanlı Twitter botu, NASA'nın Astronomy Picture of the Day (APOD) API'sinden rastgele bir uzay görseli seçer. Görsel İngilizce açıklamalı ve resim formatındaysa, Gemini yapay zekâ modeli yardımıyla iki ayrı tweet üretir:

1. Görseli açıklayan kısa tanıtım tweet'i
2. Bilimsel ya da teknik içeriği aktaran ikinci tweet

Her ikisi de sade, bilgi odaklı ve 280 karakter sınırına uygun biçimde oluşturulur. Bot, fotoğrafı ve açıklamaları Twitter'da paylaşır.

## Özellikler

* Son 10 yıl içinden rastgele tarih seçimi
* Sadece görsel (fotoğraf) içeren içeriklerle çalışır
* Sadece İngilizce açıklamaları işler (diğer diller elenir)
* Gemini ile 2 ayrı bilgilendirici tweet oluşturur
* Tweet'ler otomatik olarak 280 karakter sınırına göre kırpılır
* Tweet zinciri (birinci tweet'e cevap olarak ikinci tweet)
* Uygun içerik bulunamazsa 5 kez yeniden dener
* Hata durumlarında açıklayıcı loglar

## Kurulum

Bu projeyi kendi bilgisayarınızda çalıştırmak için aşağıdaki adımları takip edin.

### Önkoşullar

* Node.js
* Aşağıdaki npm modülleri:

```
npm install twitter-api-v2 axios @google/generative-ai
```

* Twitter Developer hesabı (API anahtarları için)
* NASA API anahtarı
* Google Gemini API anahtarı

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

```
node tweet.js
```

### Örnek Çıktı
Tweet 1:
"NGC 7293, Helix Nebulası olarak bilinen bir gezegenimsi bulutsudur. Ölmekte olan bir yıldızın dış katmanlarının uzaya atılmasıyla oluşmuştur."

Tweet 2:
"Yaklaşık 700 ışık yılı uzaklıktadır. Merkezi beyaz cüce yıldız, ultraviyole ışık yayarak gazları iyonize eder. Görünür ışıkta renkli halkalar bu sayede oluşur."