export type ProRagChunk = {
  id: string
  tags: string[]
  text: string
}

export const PRO_RAG_CHUNKS: ProRagChunk[] = [
  {
    id: "REGULATION_OVERVIEW",
    tags: ["base", "overview"],
    text: "Regülasyon, fizyolojik uyarılma, duyusal yanıt, duygu, dikkat ve davranışın bağlama göre ayarlanmasıdır. Erken çocuklukta bu alanlar çoğu zaman tek tek değil, birlikte örüntü oluşturacak şekilde görünür.",
  },
  {
    id: "REGULATION_INTERPRETATION_BOUNDARY",
    tags: ["base", "safety"],
    text: "Düşük ya da zayıf görünen bir profil tek başına tanı göstermez; gelişimsel olgunlaşma, rutinler, stres yükü, uyku ve çevresel bağlamla birlikte düşünülmelidir. Klinik dil olasılık temelli ve betimleyici kalmalıdır.",
  },
  {
    id: "PHYSIOLOGICAL_REGULATION_RELATIVE_WEAKNESS",
    tags: ["domain", "physiological", "weak"],
    text: "Fizyolojik regülasyonda kırılganlık, uyku-uyanıklık dengesi, enerji düzeyi, bedensel toparlanma ve stres sonrası yatışma hızında zorlanma olasılığını düşündürür. Bu alan duygusal ve bilişsel düzenlenmenin zemin değişkenlerinden biri olarak ele alınabilir.",
  },
  {
    id: "PHYSIOLOGICAL_REGULATION_RELATIVE_STRENGTH",
    tags: ["domain", "physiological", "strong"],
    text: "Fizyolojik regülasyonda göreli korunmuşluk, günlük biyolojik ritimlerin daha dengeli ilerleyebildiğini ve stres sonrası toparlanmanın daha düzenli olabildiğini düşündürür. Bu alan diğer zorlanmalar arasında koruyucu bir unsur gibi çalışabilir.",
  },
  {
    id: "SENSORY_REGULATION_RELATIVE_WEAKNESS",
    tags: ["domain", "sensory", "weak"],
    text: "Duyusal regülasyonda kırılganlık, çevresel uyaranlara uyum sağlama kapasitesinin zorlanabileceğini düşündürür. Bu görünüm ses, dokunma, kalabalık, ışık ya da hareket yükü arttığında duygusal ve davranışsal düzenlenmeyi de etkileyebilir.",
  },
  {
    id: "SENSORY_REGULATION_RELATIVE_STRENGTH",
    tags: ["domain", "sensory", "strong"],
    text: "Duyusal regülasyonda göreli korunmuşluk, çevresel uyaranlara daha dengeli yanıt verilebildiğini ve günlük ortamlara uyumun daha rahat ilerleyebildiğini düşündürür. Bu alan, diğer kırılgan alanlara rağmen işlevselliği destekleyebilir.",
  },
  {
    id: "EMOTIONAL_REGULATION_RELATIVE_WEAKNESS",
    tags: ["domain", "emotional", "weak"],
    text: "Duygusal regülasyonda kırılganlık, zorlayıcı durumlar sonrası toparlanmanın uzayabildiğini, duygusal eşiklerin daha hızlı yükselebildiğini ve dış desteğe duyulan ihtiyacın artabildiğini düşündürür. Klinik yorum, kişilik etiketi yerine toparlanma hızı ve yoğunluk üzerinden kurulmalıdır.",
  },
  {
    id: "EMOTIONAL_REGULATION_RELATIVE_STRENGTH",
    tags: ["domain", "emotional", "strong"],
    text: "Duygusal regülasyonda göreli korunmuşluk, hayal kırıklığı ve değişim karşısında yeniden dengeye dönmenin daha yönetilebilir olabildiğini düşündürür. Bu güçlü alan, diğer regülasyon yüklerini hafifleten bir kaynak olabilir.",
  },
  {
    id: "COGNITIVE_REGULATION_RELATIVE_WEAKNESS",
    tags: ["domain", "cognitive", "weak"],
    text: "Bilişsel regülasyonda kırılganlık, dikkat sürdürme, göreve bağlı kalma ve zihinsel organizasyonu koruma süreçlerinde zorlanma olasılığını düşündürür. Özellikle görev talebi ve çevresel yük arttığında daha görünür hale gelebilir.",
  },
  {
    id: "COGNITIVE_REGULATION_RELATIVE_STRENGTH",
    tags: ["domain", "cognitive", "strong"],
    text: "Bilişsel regülasyonda göreli korunmuşluk, dikkat odağını sürdürme ve yapılandırılmış etkinlikte kalma kapasitesinin daha istikrarlı olabileceğini düşündürür. Bu durum diğer alanlardaki zorlukları kısmen dengeleyebilir.",
  },
  {
    id: "EXECUTIVE_FUNCTION_RELATIVE_WEAKNESS",
    tags: ["domain", "executive", "weak"],
    text: "Yürütücü işlevde kırılganlık, dürtü kontrolü, kuralı sürdürme, davranışı durdurma ve çok basamaklı yönergeyi yönetme süreçlerinde zorlanma olasılığını düşündürür. Bu alan, bilişsel ve duygusal regülasyonla birlikte yorumlandığında daha anlamlı hale gelir.",
  },
  {
    id: "EXECUTIVE_FUNCTION_RELATIVE_STRENGTH",
    tags: ["domain", "executive", "strong"],
    text: "Yürütücü işlevde göreli korunmuşluk, davranışı hedefe göre ayarlama ve geri bildirime göre düzenleme kapasitesinin daha dengeli olabileceğini düşündürür. Bu güçlü alan, davranışsal toparlanmayı destekleyebilir.",
  },
  {
    id: "INTEROCEPTION_RELATIVE_WEAKNESS",
    tags: ["domain", "interoception", "weak"],
    text: "İnterosepsiyonda kırılganlık, açlık, yorgunluk, tuvalet ihtiyacı veya genel bedensel rahatsızlık gibi iç sinyalleri fark etme ve bunlara uygun yanıt üretme kapasitesinde zorlanma olasılığını düşündürür. Bu alan özellikle fizyolojik ve duygusal düzenlenmeyle birlikte ele alınmalıdır.",
  },
  {
    id: "INTEROCEPTION_RELATIVE_STRENGTH",
    tags: ["domain", "interoception", "strong"],
    text: "İnterosepsiyonda göreli korunmuşluk, iç bedensel ihtiyaçları fark etme ve günlük işlevsellik içinde kullanma kapasitesinin daha düzenli olabileceğini düşündürür. Bu, beden temelli düzenlenmede koruyucu bir unsur olabilir.",
  },
  {
    id: "CROSS_SCALE_SENSORY_EMOTIONAL",
    tags: ["pattern", "sensory", "emotional"],
    text: "Duyusal yüklenme ile duygusal toparlanma güçlüğü birlikte görüldüğünde, çevresel uyaran yoğunluğu duygusal tepki yönetimini zorlaştıran bir örüntü oluşturabilir. Bu ilişki nedensellik değil, klinik olarak anlamlı bir birliktelik olarak yorumlanmalıdır.",
  },
  {
    id: "CROSS_SCALE_PHYSIOLOGICAL_EMOTIONAL",
    tags: ["pattern", "physiological", "emotional"],
    text: "Fizyolojik ritimlerdeki kırılganlık duygusal eşiği düşürebilir ve toparlanmayı zorlaştırabilir. Uyku, enerji ve bedensel denge zorlandığında duygusal yük daha görünür hale gelebilir.",
  },
  {
    id: "CROSS_SCALE_INTEROCEPTION_PHYSIOLOGICAL",
    tags: ["pattern", "interoception", "physiological"],
    text: "İnterosepsiyon ile fizyolojik regülasyon birlikte zorlandığında, iç sinyalleri fark etme ve temel ritimleri düzenleme alanları aynı beden-temelli eksende kırılgan görünebilir.",
  },
  {
    id: "CROSS_SCALE_INTEROCEPTION_EMOTIONAL",
    tags: ["pattern", "interoception", "emotional"],
    text: "Beden sinyallerini erken fark etmekte zorlanma, duygusal yükselmeyi zamanında okuyup yatıştırmayı güçleştirebilir. Bu nedenle interoseptif kırılganlık duygusal regülasyon bulgularını anlamlandıran bir zemin sunabilir.",
  },
  {
    id: "CROSS_SCALE_COGNITIVE_EXECUTIVE",
    tags: ["pattern", "cognitive", "executive"],
    text: "Bilişsel ve yürütücü alanlar birlikte zorlandığında, dikkat sürdürme, görev organizasyonu ve davranışı hedefe göre düzenleme süreçlerinde daha bütüncül bir yük oluşabilir.",
  },
  {
    id: "CROSS_SCALE_EMOTIONAL_EXECUTIVE",
    tags: ["pattern", "emotional", "executive"],
    text: "Duygusal yüklenme ile yürütücü kontrol kırılganlığı birlikteyse, özellikle engellenme ve geçiş anlarında davranışı durdurup yeniden düzenleme kapasitesi daha çok zorlanabilir.",
  },
  {
    id: "CROSS_SCALE_WIDESPREAD_PATTERN",
    tags: ["pattern", "global"],
    text: "Birden fazla regülasyon alanında eşzamanlı zorlanma görüldüğünde, günlük işlevsellikte daha yaygın bir regülasyon yükü düşünülmelidir. Bu tür görünüm tek bir baskın alandan çok çoklu sistem etkileşimini işaret edebilir.",
  },
  {
    id: "CROSS_SCALE_ASYMMETRICAL_PROFILE",
    tags: ["pattern", "asymmetry"],
    text: "Profil asimetrik olduğunda, belirgin zorlanan alan ile korunmuş alanlar arasındaki fark klinik yorumun merkezine alınmalıdır. Güçlü alanlar koruyucu kaynak olabilir; ancak kırılgan alan belirli bağlamlarda baskın hale gelebilir.",
  },
  {
    id: "RISK_PROFILE_SINGLE_DOMAIN",
    tags: ["risk", "single"],
    text: "Zorlanma daha çok tek bir alanda yoğunlaşıyorsa seçici bir regülasyon kırılganlığı düşünülmelidir. Bu durumda güçlü alanları da görünür kılmak ve zorlanmanın bağlama özgü artabileceğini belirtmek önemlidir.",
  },
  {
    id: "RISK_PROFILE_DUAL_DOMAIN",
    tags: ["risk", "dual"],
    text: "İki alanda eşzamanlı zorlanma, ilişkili sistemlerin birlikte etkilenebildiği daha belirgin bir örüntü düşündürür. Klinik yorum, bu iki alan arasındaki ilişkiyi açık ama temkinli biçimde anlatmalıdır.",
  },
  {
    id: "RISK_PROFILE_MULTI_DOMAIN",
    tags: ["risk", "multi"],
    text: "Üç veya daha fazla alanda zorlanma birlikteliği, daha yaygın bir regülasyon yüküne işaret edebilir. Böyle bir tabloda yorum, tek bir belirtiye değil örüntünün genişliğine odaklanmalıdır.",
  },
  {
    id: "RISK_PROFILE_PROTECTIVE_FACTORS",
    tags: ["risk", "protective"],
    text: "Görece güçlü alanlar, zorlanan sistemler arasında işlevselliği koruyan tamponlar olarak ele alınabilir. Bu nedenle raporda yalnız kırılganlıklar değil, korunmuş alanlar da kısa biçimde vurgulanmalıdır.",
  },
  {
    id: "ANAMNESIS_SENSORY_CONTEXT",
    tags: ["anamnesis", "sensory"],
    text: "Anamnezde gürültü, kalabalık, dokunma, giyim, banyo, oral hassasiyet veya belirgin duyusal tetikleyiciler bildiriliyorsa, bunlar duyusal regülasyon bulgularını bağlamsallaştıran yüksek değerli verilerdir.",
  },
  {
    id: "ANAMNESIS_EMOTIONAL_CONTEXT",
    tags: ["anamnesis", "emotional"],
    text: "Sık öfke nöbeti, zor sakinleşme, rutin bozulduğunda taşma, ayrılıkta zorlanma veya yoğun dış destek ihtiyacı gibi anamnez verileri duygusal regülasyon yorumuna doğrudan bağlanmalıdır.",
  },
  {
    id: "ANAMNESIS_ATTENTION_AND_TASK_BEHAVIOR",
    tags: ["anamnesis", "cognitive", "executive"],
    text: "Dikkat süresinin kısa olması, oyunda çabuk dağılma, görevi yarım bırakma, çok basamaklı işlerde kopma veya dürtüsellik bildirimleri bilişsel ve yürütücü alan yorumlarını günlük yaşama bağlayan önemli ipuçlarıdır.",
  },
  {
    id: "ANAMNESIS_SLEEP_AND_ROUTINE",
    tags: ["anamnesis", "physiological"],
    text: "Uykuya dalma güçlüğü, sık uyanma, düzensiz rutin, açlık-yorgunlukla zorlanma gibi veriler fizyolojik regülasyon yorumunda zemin değişkeni olarak dikkate alınmalıdır.",
  },
  {
    id: "ANAMNESIS_INTEROCEPTIVE_CONTEXT",
    tags: ["anamnesis", "interoception"],
    text: "Açlık, susuzluk, tuvalet ihtiyacı, yorgunluk veya bedensel rahatsızlığı geç fark etme gibi veriler interosepsiyon yorumuna doğrudan bağlanmalıdır. Bu alan özellikle beden temelli düzenlenme ile birlikte düşünülmelidir.",
  },
  {
    id: "ANAMNESIS_CONTRADICTION_RULE",
    tags: ["anamnesis", "consistency"],
    text: "Anamnez belirli bir alana güçlü vurgu yapmasına rağmen ölçekte o alan göreli korunmuş görünüyorsa, bu durum çelişki değil bağlam farkı veya durumsallık olarak dikkatle not edilmelidir.",
  },
  {
    id: "REPORT_FINAL_SUMMARY_TEMPLATE",
    tags: ["style", "summary"],
    text: "Kısa sonuç bölümü profil tipi, temel zorlanma ekseni, korunmuş alan ve genel klinik yükü kısa ama net bir sentez halinde vermelidir. Aynı bilgi tekrar edilmemeli, tanısal ya da müdahale öneren dil kullanılmamalıdır.",
  },
]
