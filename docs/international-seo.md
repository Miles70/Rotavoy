# Rotavoy uluslararası SEO — uygulama ve teslim

## Mevcut durumdan çıkan bulgular

- React + Vite SPA, bütün yollar için aynı `index.html` dosyasını sunuyordu. Otel adı, içeriği, canonical ve çok dilli ilişkiler ilk HTTP HTML’inde bulunmuyordu.
- Sitemap yalnızca sekiz genel adres içeriyordu; otel ve uçuşlar listelenmiyordu. `/travel` ile `/` yineleniyordu.
- `/flights` bütünüyle noindex idi. Kalıcı keşif sayfaları ile tarihli sonuçlar ayrılmamıştı. Account/uçuş checkout için merkezi indeksleme politikası yoktu.
- Dil yalnızca tarayıcı/depolama üzerinden seçiliyordu. Her çevirinin ayrı URL’si yoktu.
- Canlı kök alan adı `https://www.rotavoy.com` adresine 308 yönlendirmesi yapıyor. Eski canonical/sitemap `www` kullanmıyordu.

## Seçilen mimari

Vite korunur. Tarihsiz, yayın onaylı katalog sayfaları ayrı ve hafif bir React girişinden SSG ile oluşturulur. İlk HTTP yanıtı başlık, metin, tesis bilgileri, dahili bağlantılar, canonical/hreflang ve JSON-LD içerir. Aynı bileşen tarayıcıda hydrate edilir; robotlara özel farklı içerik sunulmaz. Cüzdan/Stripe/booking uygulaması bu sayfaların giriş paketine eklenmez.

Mevcut uygulama, canlı arama ve ödeme için korunur. SEO sayfalarının CTA’ları mevcut formlara geçer; dil `lang` parametresinden seçilerek mevcut depolama sisteminde sürdürülür. Uçuş CTA’sı kalkış/varış havalimanlarını doldurur, tarih/yolcu seçimini kullanıcıya bırakır; otomatik API araması başlatmaz.

SSG tercihinin nedeni mevcut küçük, seçilmiş kataloğun CDN’den hızlı sunulabilmesi, Railway/Nuitee kesintisinde tesis içeriğinin kaybolmaması ve sayfa talebi veya build başına sağlayıcı maliyeti oluşmamasıdır. Next.js göçü ve booking backend yeniden yazımı yoktur.

## Hazır kapsam

On dil: `tr`, `en`, `de`, `fr`, `ru`, `ar`, `es`, `pt`, `it`, `zh`. Ülke varyantı kopyaları yoktur; dil hedeflemesi ilgili tüm pazarlara açıktır. Örneğin `en` yalnızca İngiltere’ye, `pt` yalnızca Brezilya’ya sınırlandırılmaz. Dil URL’de sabittir; karşılık gelen sayfa dil bağlantılarından açılır. Her sayfa kendine canonical verir, diğer dillere canonical verilmez. `x-default` İngilizce karşılığıdır.

İlk yayın grubu **100 sayfa**, dil başına 10 sayfa:

| Tür | Örnek URL | Her dilde sayı |
| --- | --- | --- |
| Keşif ana sayfası | `/tr` | 1 |
| Otel ve uçuş merkezleri | `/tr/hotels`, `/tr/flights` | 2 |
| Destinasyon | `/tr/hotels/antalya` | 1 |
| Otel profilleri | `/tr/travel/hotels/lp55de7` | 3 |
| Kalıcı havalimanı rotaları | `/tr/flights/ayt-fra` | 3 |

Gerçek oteller: Megasaray Westbeach Antalya (`lp55de7`), Sealife Family Resort Hotel (`lp4f7bd`), Rixos Downtown Antalya (`lp22e91`). 8 Ekim 2026’da mevcut production backend’in halka açık Nuitee katalog endpointinden alındı. Açıklamalar sağlayıcı metninin 10 dilli editoryal özetleridir; veri kaynağı, kaynak metin ve hash snapshot içinde tutulur. Fiyat, stok, yorum/puan veya oda şartları uydurulmaz. Aile/erişilebilirlik/yıldız filtre sayfaları otomatik üretilmez.

Rotalar: **AYT → FRA**, **IST → DXB**, **LHR → AYT**. Şehirdeki tüm havalimanları yerine belirli IATA kodları kullanılır. Bunlar arama planlama sayfalarıdır; seferin mevcut olduğunu, direkt uçuşu, havayolunu veya fiyatı garanti etmez. Gerçek sonuçlar mevcut uçuş API’sinde aranır.

## Teknik geliştirmeler

- `npm run build` Vite çıktısından sonra katalogdan HTML ve sitemap oluşturur; ağ isteği sıfırdır.
- Katalog değişince sitemap yeniden üretilir. `/sitemap.xml` bir sitemap indexidir; dil ilişkili URL’ler 1.000 kayıtlık XML parçalara ayrılır. Gerçek içerik güncellemesi olmayan sayfalara sahte günlük lastmod verilmez.
- `robots.txt` API’yi sınırlar. Ödeme/account sayfaları taranabilir bırakılır; HTTP HTML ve X-Robots-Tag üzerinden noindex okunabilir. robots ile noindex’in görünmesi engellenmez.
- Tarihli otel/uçuş aramaları, admin, account, checkout ve geçici canlı otel ekranları noindex’tir. Sitemap yalnızca kalıcı canonical sayfalar ve mevcut genel bilgi sayfalarını içerir.
- `/flights` ve `/hotels` temiz, tam yüklemeli istekleri İngilizce keşif sayfalarına yönlenir. Query içeren formlar çalışmaya devam eder. `/travel` köke yönlenir ve query korunur. Yayındaki otellerin eski temiz detay adresleri İngilizce profiline yönlenir; tarih/dil içeren canlı detay linkleri korunur.
- Vercel `cleanUrls` statik `.html` dosyalarını uzantısız sunar. Bulunmayan adresler `api/page.js` üzerinden gerçek HTTP 404 ve noindex alır; her adres için 200 SPA fallback kaldırılmıştır. Function yalnızca küçük `dist/index.html` ve manifest dosyasını paketler; otel sayfalarını ve sağlayıcı erişim anahtarlarını paketlemez.
- SPA gezinmelerinde merkezi metadata yönetimi eski canonical/noindex etiketlerini kaldırır; tek canonical kalır.
- Görünür içeriğe uygun WebPage, BreadcrumbList, ItemList ve Hotel şemaları vardır. Uçuş rezervasyon/Offer, AggregateRating ve sahte fiyat şemaları eklenmez. Schema Google zengin sonuç garantisi değildir.
- Sayfa içeriği dilde gerçek HTML, Arapça RTL, mobil kartlar, klavye odağı ve açık/koyu görünüm içerir. Genişliği/yüksekliği belirlenmiş görseller layout kaymasını azaltır; kart fotoğrafları lazy yüklenir. Yeni girişte cüzdan modülleri bulunmaz. Lighthouse veya saha Core Web Vitals ölçümü bu teslimde yapılmadı.
- Mevcut footer’dan dildeki otel/uçuş merkezlerine gerçek bağlantılar vardır. Destinasyon kataloğu 24 kayıtlık sayfalara bölünebilir; hotel related listesi 6 kayıt, merkez önerileri 12 kayıtla sınırlandırılır. Böylece bütün oteller her sayfanın payload’ına kopyalanmaz.
- Analytics V2’nin mevcut event/proof sistemi yeniden kullanılır. SEO sayfaları page_view/heartbeat ve canlı otel açılış olayını gönderir. Tarayıcı testleri gezinmeden önce `markAnalyticsTest(...fixture:true)` çağırır ve API’yi tamamen intercept eder; production analytics’e test göndermez.

## Katalog bakımı ve büyütme

Normal deploy sağlayıcıya gitmez. Mevcut yayınlı snapshot’lar sınırlı ve sıralı bakım komutuyla yenilenebilir:

```bash
npm run seo:refresh -- --api-base=https://rotavoy-production.up.railway.app --ids=lp55de7,lp4f7bd,lp22e91
npm run build
npm run test:seo
```

Komut production sağlayıcı durumunu doğrular, en fazla 25 oteli sırayla okur ve atomik dosya değişikliği yapar. Hata durumunda eski snapshot korunur. Kaynak açıklama veya herhangi bir yayınlanan tesis bilgisi (ad, adres, şehir, ülke, yıldız, fotoğraf, koordinatlar) değişirse ilgili otel yayımdan kaldırılır; 10 dil özeti gözden geçirilip `published:true` yapılmadan tekrar indekslenebilir içerik üretilmez. Fiyat/rates/booking endpointi çağrılmaz. Çeviri modeli tetiklenmez.

Yeni otel: gerçek provider detayını al, snapshot’ı aynı şemada ekle, tüm 10 açıklamayı kaynakla karşılaştır, production provenance ve reviewedAt kaydet, ardından yayımla. Sadece sağlayıcı metni kopyalanıp dil etiketi değiştirilmemelidir. Yeni şehir en az üç yayın onaylı profil içerdiğinde `seo/destinations.js` üzerinden açılabilir. Rota katalog girdisi ancak gerçek havaalanı eşleşmeleri ve kullanıcıya faydalı içerik ile genişletilmelidir.

Build varsayılan üst sınırı 15.000 sayfadır (`SEO_MAX_PAGES`). Bu sınır bir kalite kapısıdır; limitsiz sayfa üretimi teşvik edilmez. Çok büyük katalogda yalnızca değişen sayfaları üreten pipeline veya önbellekli on-demand HTML gerekir. Şu an otomatik cron, CMS ve on-demand regenerasyon kurulu değildir. Fotoğraf ve sabit tesis bilgileri için düzenli bakım önerilir.

## Test ve yayın

```bash
npm ci
npm ci --prefix server
VITE_REOWN_PROJECT_ID=00000000000000000000000000000000 npm run build
npm run lint
npm run test:seo
npm run test:hotel-ui
npm run server:test
npx playwright install chromium
npm run test:seo-e2e
npm run test:hotel-e2e
```

`test:seo`: bütün üretilen HTML’ler; JS’siz içerik; tek canonical; 10 dil ve reciprocal hreflang; schema; dahili bağlantılar; sitemap kapsam/boyutları; sandbox/eksik çeviri/yayımdan kaldırılan tesis kapıları; HTML injection kaçışı; redirect; gerçek function adapter üzerinden 404/noindex/private cache.

`test:seo-e2e`: on dilde JavaScript kapalı otel/destinasyon/rota; hydrate; 320/390/1280px; RTL; tema; karşılık gelen dil bağlantısı; uçuş CTA’sından mevcut forma dil ve havalimanı aktarımı; HTTP 404. API tamamen fixture ile intercept edilir. Mevcut hotel-e2e oda seçimi/prebook ve kart/kripto koşul değişikliği akışlarını ayrıca kapsar. CI’a SEO testleri eklendi. CI build’inde yalnızca mevcut uygulamanın açılabilmesi için sahte Reown proje ID’si kullanılır; production Vercel ayarları değiştirilmez.

Yerel doğrulama: build başarılı; lint sıfır hata (Travel.jsx’te önceden bulunan iki hooks uyarısı); 100 HTML SEO kontrolü başarılı; 10 dil otel UI başarılı; 46 backend testi başarılı. Chromium indirmesi bu çalışma ortamında geçerli arşiv döndürmediği için tarayıcı testleri burada henüz çalıştırılamadı. GitHub Actions Chromium testleri daha sonra çalıştı: JavaScript kapalı 10 dil, mobil/masaüstü, RTL, tema ve uçuş formuna geçiş başarılı oldu. İlk 320px menü taşması düzeltildi. En yeni commit için tam regresyon sonucu PR’da izlenir. Vercel preview build’i başarılıdır; mevcut Vercel bağlantısı projeye erişim yetkisi vermediği için preview HTTP yönlendirmeleri henüz doğrulanamadı. Gerçek kart/kripto ödeme ve gerçek rezervasyon yapılmadı.

Master’a merge veya production yayın yapılmaz; bu branch PR ile değerlendirilir. Sonraki aşamalar: preview’de Vercel cleanUrls/function dosya paketlemesini doğrula, staging’de mevcut otel/uçuş/ödeme regresyonlarını çalıştır, merge sonrası Search Console’a sitemap gönder, seçilmiş şehirlerde yeni gerçek tesis profilleri ekle, organik girişleri Analytics V2 ve Search Console’dan izle, LCP/INP/CLS saha verisi topla.

## Teknik kaynaklar

- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://vercel.com/docs/project-configuration/vercel-json
