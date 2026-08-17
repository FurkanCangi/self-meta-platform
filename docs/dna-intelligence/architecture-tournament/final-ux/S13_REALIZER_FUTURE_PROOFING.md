# S13-Strict Realizer Future-Proofing

Bu katman S13-Strict'in retrieval, locked plan, validator, final regression veya production cevap davranışını değiştirmez. Amaç, realization aşamasının sağlayıcı bağımsız bir sözleşmeyle çalışmasını ve doğrulanmış sentetik çıktılar için geriye dönük provenance bulunmasını sağlamaktır.

## Realizer sözleşmesi

```text
Realizer
├── LunaRealizer
├── LocalRealizer        # yalnız interface; implementasyon/model seçimi yok
└── DeterministicRealizer
```

Realizer yalnız önceden kilitlenmiş planı gerçekleştirir. Claim seçimi, retrieval, planlama ve doğrulama Realizer'ın yetkisi değildir. `DnaS13StrictRealization` şeması provider/model alanı içermez; Luna, gelecekteki local realizer ve deterministic realizer aynı input/output contract'ını kullanır.

## Provenance

Her provider-neutral runtime sonucu aşağıdakileri tek kayıtta taşır:

- özgün ve normalize soru;
- QueryFrame, required slotlar, required/explanatory claim kimlikleri ve tam locked plan;
- provider, model ve realizer implementasyon sürümü;
- prompt sürümü/hash'i ve varsa repair prompt hash'i;
- katalog, retrieval ve validator sürüm/hash'leri;
- ham ilk çıktı, varsa ham repair çıktısı ve gösterilen nihai çıktı;
- accepted/repaired/fallback durumu ve validator hata kodları;
- token kullanımı, toplam latency ve micro-USD maliyet;
- privacy sınıflandırması ve training disposition.

## Training adaylığı ve privacy

`training_candidate` yalnız şu koşullar birlikte sağlanırsa `true` olabilir:

1. kayıt için adaylık açıkça istenmiştir;
2. sonuç `realized` veya `repaired` durumundadır;
3. nihai validator sonucu geçmiştir;
4. kabul edilmiş target answer vardır;
5. privacy sınıflandırması otomatik adaylığa izin verir.

Klinik/vaka bağlamı, kişisel veri ve sınıflandırılmamış hassas bağlam otomatik olarak `exclude_from_training: true` olur. Bu etiket veri setine alınabilirlik hazırlığıdır; model eğitimi, kullanıcı izni veya production model değişikliği anlamına gelmez.

## JSONL hazırlığı

Saf serializer aşağıdaki provider-independent kaydı oluşturabilir:

```text
question + query_frame + locked_plan + approved_claims + target_answer + metadata
```

Serializer yalnız `training_candidate` kayıtları döndürür. Bu çalışmada dosya export'u, dataset üretimi veya eğitim yapılmaz.

## Shadow çalışma

Shadow orkestrasyonu primary ve shadow realizer'ı aynı immutable locked plan üzerinde paralel çalıştırabilir. Kullanıcıya gösterilecek cevap her zaman primary sonucudur. Shadow sonucu `displayEligible: false` olarak işaretlenir ve otomatik training candidate yapılmaz.

Bu hazırlık LocalRealizer implementasyonu, Qwen/Phi/Gemma seçimi, LoRA, fine-tuning, distillation veya GPU altyapısı içermez.
