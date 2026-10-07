# Otel teklifleri ve rezervasyon koşulları

## Doğrulanan veri kaynağı

7 Ekim 2026 tarihinde Rotavoy production backend'i üzerinden LiteAPI rates ve prebook cevapları incelendi. API anahtarı okunmadı veya kopyalanmadı. Upstream ham cevabının ticari alanları mevcut backend'de ayıklandığından, bulgular erişilebilen gerçek rate/policy payload'larına ve mevcut fiyat normalizasyon koduna dayanır.

- Novotel Phuket City Phokeethra (`lp97ae1`), 6–8 Kasım 2026, iki yetişkin: RO, RFN ve NRFN teklifler; RFN teklifinde 4 Kasım 18:00 GMT'den itibaren iptal bedeli; dahil VAT/city tax ve ayrıca ödenecek property service charge.
- Rixos Downtown Antalya (`lp22e91`), aynı tarihler/kişiler: FB ve AI teklifler; NRFN; dahil ve hariç ücretler. AI prebook'ta da AI/NRFN ve hariç ücretler doğrulandı.
- Royal Wings araması bu incelemede backend hatası verdi; doğrulama Rixos ile yapıldı.

Bu fiyatlar üretim kodunda kullanılmaz. Testlerdeki fiyatlar ve kimlikler fixture verisidir.

Rates'te gözlenen alanlar: oda adı, adultCount/childCount/maxOccupancy, boardType/boardName, cancellationPolicies.refundableTag, cancelPolicyInfos (cancelTime, amount, currency, type, timezone), retailRate.taxesAndFees (included, description, amount, currency), remarks/hotelRemarks, paymentSchedule. Perks bu örneklerde boştu.

Prebook'ta gözlenen nihai alanlar: hotelId, checkin/checkout, currency, roomTypes.rates, nihai satış fiyatı, termsAndConditions, cancellationChanged, boardChanged. İncelenen cevaplarda termsAndConditions boştu. Mevcut backend priceDifferencePercent'i ayıklıyordu; yeni normalizasyon sağlayıcı cevabındaki bu bayrağı yalnızca değişiklik uyarısına dönüştürür, ticari oranı istemciye vermez.

Resmi anlamlar: https://docs.liteapi.travel/reference/post_hotels-rates, https://docs.liteapi.travel/reference/post_rates-prebook, https://docs.liteapi.travel/docs/canceling-a-booking.

## Uygulama

Tek sağlayıcı normalizasyonu backend'de `hotelRateConditions.js` içinde tutulur. Müşteriye açık cevaplar allowlist kullanır; net maliyet, markup, komisyon, marj, supplier/rate kimlikleri, alternatif ticari fiyatlar ve SDK credential alanları rates/prebook cevabına çıkarılmaz. İşlem için zorunlu opaque offer/prebook kimlikleri korunur. Kart SDK'sının gerekli ödeme oturumu credential akışı korunur.

Mevcut %15 margin ve `offerRetailRate`/nihai `price` üzerinden uygulanan tek fiyatlandırma değiştirilmedi. Ek tesis ücretleri online tahsil edilecek tutara sessizce eklenmez; ayrı gösterilir.

Yemek planları resmi RO/BI/HB/FB/AI/DI/LI/BDI/BLI/LDI anlamlarıyla on dilde sunulur. BB/UAI gibi bu doğrulamada belgelenmeyen kodlar körlemesine map edilmez; anlamlı boardName varsa kullanılır, yoksa nötr açıklama gösterilir.

RFN tek başına ücretsiz iptal vaadi üretmez. Gelecekteki, doğru GMT tarihli ve bilinen tutar tipli ceza zinciri doğrulanınca deadline gösterilir. Deadline geçince ceza etiketi yenilenir. NRFN iade edilemez olarak gösterilir; gelen ceza detayları ayrıca açılır. Eksik/belirsiz policy güvenli fallback kullanır.

Vergiler dahil iddiası ancak dolu bir ücret listesinde tüm `included` alanları true olduğunda sunulur. Null/boş/belirsiz liste dahil iddiası üretmez. `included:false` kalemleri miktar/para birimi/açıklamasıyla ayrıca gösterilir; eksik miktar sıfır sayılmaz.

Oda kartı ve checkout ortak, erişilebilir detay açılımını kullanır. Yeni metinler on dilde yerelleştirildi. Ana kartta ham fiyat tipi/supplier jargonları gösterilmez. Checkout güncel oda, yemek, iptal, ücret ve koşulları onaylatır; kart/kripto ödeme açıldıktan sonra da özette görünür kalır. Confirmed hotel ID dönüş bağlantısı düzeltmesi korunur.

Prebook, arama teklifiyle fiyat/para birimi/oda/kişi/yemek/iptal/ücret/koşul farklarını karşılaştırır. Kart session, crypto-checkout ve eski checkout endpoint'i nihai prebook'tan üretilen koşul revision'ını tekrar doğrular. Stale/missing revision 409 döndürür; ödeme kaydı oluşmaz. Frontend yeni koşulları gösterir, onayı sıfırlar. Nihai kabul edilen koşullar rezervasyon kaydında tutulur. Bu revision ödeme tutarını müşteriden kabul etmek için kullanılmaz; tahsilat her zaman server-side sağlayıcı fiyatına dayanır.

## Testler ve sınırlar

- Backend: mevcut ödeme/booking/auth/crypto/flight testleri ve altı eski rate regresyon senaryosu korunup yeni modele uyarlanmıştır. Yeni koşul testi refundable/non-refundable, GMT deadline, sıfır tutarlı aşamalar, bilinmeyen policy tipi/zaman dilimi, yemek mapping/fallback, vergi inclusion/unknown, fiyat/iptal/yemek/ücret/oda değişimi, ticari veri ayıklama ve üç checkout yolunda stale acceptance bloklamasını kapsar.
- UI metin/SSR testi: on dil, detay açılımı, zorunlu ek ücret, bilinmeyen veriler, geçmiş cancellation deadline.
- Playwright: 320/390/1280 px; uzun oda adı, detay açılımı, yatay taşma, oda seçimi, prebook, kart/kripto koşul değişikliği, yeniden kabul ve confirmed hotel dönüş URL'si. Görseller GitHub Actions artifact'ına kaydedilir.
- Komutlar: `npm run lint`, `npm run build`, `npm --prefix server test`, `npm run test:hotel-ui`, `npm run test:hotel-e2e`, backend dosyalarında `node --check`, `npm run security:check`, `git diff --check`.

Gerçek ücretli rezervasyon veya ödeme yapılmadı. Kart SDK/3DS gerçek sandbox işlem testi için bu çalışma ortamında sandbox credential bulunmuyor; mevcut SDK/booking regresyonları mock sağlayıcı ile çalışır. Canlı rates/prebook veri incelemesi gerçek production API üzerinden yapıldı. Yeni tarayıcı regresyonları deterministik fixture kullanır.

Bu örneklerde yatak konfigürasyonu, oda büyüklüğü, manzara, envanter, dolu perks, pay-later deadline ve dolu ek booking conditions doğrulanmadı; oda adından tahmin edilmez. Başka otel/rate'lerde sağlayıcı yeni veri sunarsa aynı backend modelinde genişletilmelidir.

Vercel fixture önizlemesi API üzerinden 403 ile reddedildi; tarayıcı doğrulaması GitHub Actions üzerinden yürütülür. Master'a teslim ancak ilgili doğrulamaların sonuçları kontrol edildikten sonra yapılır; final Git/CI durumu görev raporunda belirtilir.
