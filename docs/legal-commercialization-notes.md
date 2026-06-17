# DNA Intelligence Legal Commercialization Notes

Bu not, avukat incelemesine gönderilecek ekonomik v1 hukuk paketinin kapsamını ve resmi dayanak kontrol noktalarını özetler. Nihai hukuki görüş yerine geçmez.

## Hazırlanan Metinler

- `/privacy`: gizlilik politikası.
- `/terms`: kullanım şartları ve hizmet koşulları.
- `/kvkk`: KVKK aydınlatma metni.
- `/explicit-consent`: özel nitelikli veri, çocuk/danışan verisi, AI işleme ve gerekirse yurt dışı aktarım için açık rıza.
- `/retention-policy`: saklama, imha, anonimleştirme ve owner audit açıklaması.
- `/package-agreement`: paket satın alma ve clickwrap hizmet sözleşmesi.

## Resmi Dayanaklar

- KVKK Aydınlatma Yükümlülüğü: https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-
  - Aydınlatmada veri sorumlusu kimliği, işleme amacı, aktarım alıcıları/amaçları, toplama yöntemi/hukuki sebep ve ilgili kişi hakları yer almalı.
- Özel Nitelikli Kişisel Verilerin İşlenmesine İlişkin Rehber: https://www.kvkk.gov.tr/Icerik/8184/Ozel-Nitelikli-Kisisel-Verilerin-Islenmesine-Iliskin-Rehber
  - Sağlık/gelişim/klinik değerlendirme bağlamlı veriler için özel nitelikli veri riski kabul edilerek açık rıza ve sıkı erişim modeli tasarlandı.
- KVKK Kişisel Veri Saklama ve İmha Politikası: https://www.kvkk.gov.tr/Icerik/5387/KVKK-Kisisel-Veri-Saklama-ve-Imha-Politikasi
  - Saklama ve imha politikası, işleme amaçları için gerekli azami süreler ve silme/yok etme/anonimleştirme dayanaklarıyla düşünülmeli.

## Avukata Sorulacak Kırmızı Riskler

- Çocuk/danışan verisi için uzman kullanıcının yetki ve veli/danışan izin beyanı yeterli mi, ek veli onayı akışı gerekir mi?
- OpenAI/LLM ve barındırma sağlayıcıları için yurt dışı aktarım maddesi yeterli mi?
- Owner audit katmanında silinen kaydın sınırlı snapshot olarak saklanması için sözleşme/aydınlatma dili yeterli mi?
- Paket seçimi ve ödeme entegrasyonu öncesi clickwrap kabul kaydı ticari sözleşme ispatı için yeterli mi?
- Veri sorumlusu/sıfat ayrımı: platform bazı senaryolarda veri sorumlusu, bazı senaryolarda veri işleyen gibi konumlanabilir mi?
