# NASA Fotoğrafları ile Twitter Botu

Bu Node.js tabanlı Twitter (X) botu, NASA'nın **Astronomy Picture of the Day (APOD)** arşivinden rastgele ve daha önce paylaşılmamış bir uzay görseli seçer. Seçilen içerik görsel formatındaysa ve uygun koşulları sağlıyorsa, Google Gemini yapay zekâ modelleri yardımıyla iki ayrı Türkçe tweet üretir:

1. Görseldeki astronomik nesneyi veya olayı tanıtan ana tweet (fotoğrafla birlikte)
2. Gözlemsel, teknik veya bilimsel bağlamı aktaran yanıt tweet'i

Her iki tweet de resmi, bilgi odaklı ve 280 karakter sınırına uygun biçimde oluşturulur. Bot, görseli indirip Twitter'a yükler, tweet zincirini paylaşır ve aynı görseli tekrar paylaşmamak için tarihi kaydeder.

## Özellikler

* **Yeni NASA APOD API desteği:** `science.nasa.gov` REST API'si üzerinden sayfalama ile son ~10 yıllık arşivden rastgele kayıt seçer (API anahtarı gerektirmez; isteğe bağlı olarak eski `api.nasa.gov` ile de uyumludur)
* **Tekrar paylaşım koruması:** Paylaşılan tarihleri `posted_apods.json` ve `logs.json` dosyalarında saklar, aynı APOD'u bir daha paylaşmaz
* **Görsel ve boyut doğrulaması:** Yalnızca resim (`image`) içeriklerini işler; indirilen dosyanın gerçekten görsel olduğunu ve Twitter'ın 5 MB medya sınırını aşmadığını doğrular
* **İçerik ve dil filtresi:** HTML etiketlerini/karakterlerini temizler ve yalnızca İngilizce/Latin alfabesi ağırlıklı kayıtları işler
* **Dayanıklı Gemini entegrasyonu:** 2 ayrı bilgilendirici Türkçe tweet üretir, 280 karakter sınırına göre kırpar; 503/429 gibi yoğunluk hatalarında yeniden dener ve yedek modellere (`gemini-3.8-flash` → `gemini-3.5-flash-lite` → `gemini-flash-latest`) geçer
* **Otomatik yeniden deneme:** Uygun ve yeni bir APOD bulunamazsa 10 kez farklı kayıt dener
* **GitHub Actions otomasyonu:** Her 6 saatte bir otomatik çalışır, güncellenen `posted_apods.json` ve `logs.json` dosyalarını repoya geri commit/push eder

## Kurulum

Projeyi kendi bilgisayarınızda çalıştırmak için aşağıdaki adımları takip edin.

### Önkoşullar

* Node.js (v18 veya üzeri; önerilen: v24)
* Twitter (X) Developer hesabı ve API anahtarları (Read and Write izinli)
* Google Gemini API anahtarı
* *(İsteğe bağlı)* Yalnızca eski `api.nasa.gov` uç noktası kullanılacaksa NASA API anahtarı

### Yerel Yapılandırma

1. Projeyi klonlayın:

```bash
git clone [https://github.com/utkuemre-42/nasa-tweet-bot.git](https://github.com/utkuemre-42/nasa-tweet-bot.git)
cd nasa-tweet-bot
```

2. Bağımlılıkları kurun:

```bash
npm install
```

3. Proje ana dizininde `.env` dosyası oluşturun ve aşağıdaki değişkenleri doldurun:

```env
TWITTER_appKey=YOUR_TWITTER_APP_KEY
TWITTER_appSecret=YOUR_TWITTER_APP_SECRET
TWITTER_accessToken=YOUR_TWITTER_ACCESS_TOKEN
TWITTER_accessSecret=YOUR_TWITTER_ACCESS_SECRET

GOOGLEAI_apiKey=YOUR_GOOGLE_AI_API_KEY

# İsteğe bağlı (boş bırakılırsa varsayılan olarak yeni science.nasa.gov API'si kullanılır)
NASA_apodUrl=[https://science.nasa.gov/wp-json/wp/v2/apod-basic](https://science.nasa.gov/wp-json/wp/v2/apod-basic)

# İsteğe bağlı (yalnızca NASA_apodUrl eski api.nasa.gov olarak ayarlanırsa gerekir)
# NASA_apiKey=YOUR_NASA_API_KEY
```

4. Botu çalıştırın:

```bash
node main.js
```

## GitHub Actions ile Otomatik Çalıştırma

`.github/workflows/bot.yml` iş akışı botu her 6 saatte bir (`0 */6 * * *` UTC) otomatik olarak çalıştırır ve **Actions** sekmesinden elle (`workflow_dispatch`) tetiklenebilir.

1. GitHub reposunda **Settings → Secrets and variables → Actions** bölümüne gidin.
2. Aşağıdaki secret değerlerini ekleyin:
   * `TWITTER_appKey`
   * `TWITTER_appSecret`
   * `TWITTER_accessToken`
   * `TWITTER_accessSecret`
   * `GOOGLEAI_apiKey`
   * `NASA_apodUrl` *(isteğe bağlı; `https://science.nasa.gov/wp-json/wp/v2/apod-basic`)*
   * `NASA_apiKey` *(isteğe bağlı)*
3. Her başarılı paylaşımdan sonra workflow, `posted_apods.json` ve `logs.json` dosyalarını otomatik olarak `main` dalına kaydeder.

## Proje Yapısı

```text
├── .github/workflows/bot.yml  # GitHub Actions zamanlayıcı ve otomatik kayıt akışı
├── src/
│   ├── nasa.js                # NASA APOD API isteği, filtreleme ve görsel doğrulama
│   ├── gemini.js              # Gemini ile tweet metni üretimi ve yedek model yönetimi
│   ├── twitter.js             # Görsel indirme, medya yükleme ve tweet/yanıt paylaşımı
│   └── utils.js               # Yardımcı fonksiyonlar, kayıt ve log yönetimi
├── config.js                  # Ortam değişkenleri ve dosya yolu yapılandırması
├── main.js                    # Ana bot akışı
├── posted_apods.json          # Daha önce paylaşılan APOD tarihleri
└── logs.json                  # Paylaşılan tweet geçmişi
```

## Örnek Çıktı

**Tweet 1:**
> NGC 7293, Helix Nebulası olarak bilinen bir gezegenimsi bulutsudur. Ölmekte olan bir yıldızın dış katmanlarının uzaya atılmasıyla oluşmuştur.

**Tweet 2 (Yanıt):**
> Yaklaşık 700 ışık yılı uzaklıktadır. Merkezi beyaz cüce yıldız, ultraviyole ışık yayarak gazları iyonize eder. Görünür ışıkta renkli halkalar bu sayede oluşur.
