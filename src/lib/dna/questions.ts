export type Question = {
  id: number
  text: string
  scale: string
}

export const questions: Question[] = [

/* FİZYOLOJİK REGÜLASYON */

{ id:1, scale:"fizyolojik", text:"Stresli olduğunda midesi bulanır." },
{ id:2, scale:"fizyolojik", text:"Stresli olduğunda solunum ritmi belirgin şekilde değişir." },
{ id:3, scale:"fizyolojik", text:"Stresli olduğunda bedensel olarak donar veya tepkisizleşir." },
{ id:4, scale:"fizyolojik", text:"Stresli olduğunda oyun temposu veya oyun biçimi belirgin şekilde değişir." },
{ id:5, scale:"fizyolojik", text:"Stresli olduğunda diğer insanlarla etkileşimi azalır." },
{ id:6, scale:"fizyolojik", text:"Stresli dönemlerde uykuya geçişi zorlaşır." },
{ id:7, scale:"fizyolojik", text:"Stresli dönemlerde gece uyanmaları artabilir." },
{ id:8, scale:"fizyolojik", text:"Stresli dönemlerde iştahı veya yeme düzeni değişir." },
{ id:9, scale:"fizyolojik", text:"Yoğun duygusal uyarılma sonrası sakinleşmek için yetişkin desteğine ihtiyaç duyar." },
{ id:10, scale:"fizyolojik", text:"Ani uyarılarda bedensel irkilme veya yüksek uyarılma tepkisi gösterebilir." },

/* DUYUSAL */

{ id:11, scale:"duyusal", text:"Ani hareket eden nesnelerden veya hızlı görsel hareketten rahatsız olabilir." },
{ id:12, scale:"duyusal", text:"Sallanma, dönme veya hızlı hareket içeren oyunlarda huzursuzluk gösterebilir." },
{ id:13, scale:"duyusal", text:"Parlak ışık veya yoğun görsel uyaranlardan rahatsız olabilir." },
{ id:14, scale:"duyusal", text:"Kalabalık, hareketli veya görsel olarak yoğun ortamlarda huzursuz olabilir." },
{ id:15, scale:"duyusal", text:"Ani seslerden belirgin şekilde rahatsız olabilir." },
{ id:16, scale:"duyusal", text:"Arka plan gürültüsü veya birden fazla ses olduğunda huzursuzluğu artabilir." },
{ id:17, scale:"duyusal", text:"Yumuşak dokulara veya belirli yüzeylere temas etmekten rahatsız olabilir." },
{ id:18, scale:"duyusal", text:"Ellerinin, yüzünün veya kıyafetlerinin kirlenmesinden rahatsız olabilir." },
{ id:19, scale:"duyusal", text:"Yeni tat, koku veya dokudaki yiyecekleri denemekte isteksiz olabilir." },
{ id:20, scale:"duyusal", text:"Keskin koku veya yoğun kokulu ortamlardan rahatsız olabilir." },

/* DUYGUSAL */

{ id:21, scale:"duygusal", text:"Beklenmedik durumlarda ani duygusal tepkiler verebilir." },
{ id:22, scale:"duygusal", text:"Öfkelendiğinde tepkisini düzenlemekte zorlanır." },
{ id:23, scale:"duygusal", text:"Üzüldüğünde sakinleşmesi uzun sürebilir." },
{ id:24, scale:"duygusal", text:"Hayal kırıklığı yaşadığında toleransı düşebilir." },
{ id:25, scale:"duygusal", text:"Yeni ortam veya kişilerle karşılaştığında kolay huzursuz olabilir." },
{ id:26, scale:"duygusal", text:"Küçük değişikliklere veya aksaklıklara yoğun tepki verebilir." },
{ id:27, scale:"duygusal", text:"Ne hissettiğini ifade etmekte zorlanabilir." },
{ id:28, scale:"duygusal", text:"Öfke sonrası yeniden sakinleşmekte zorlanabilir." },
{ id:29, scale:"duygusal", text:"Duygusal durumu kısa sürede hızlı değişebilir." },
{ id:30, scale:"duygusal", text:"Beklemesi gerektiğinde huzursuzluğu artabilir." },

/* BİLİŞSEL */

{ id:31, scale:"bilissel", text:"Yeni bir görevde ne yapması gerektiğini anlamakta zorlanabilir." },
{ id:32, scale:"bilissel", text:"Bir işi yaparken adımları zihninde düzenlemekte zorlanır." },
{ id:33, scale:"bilissel", text:"Yeni kuralları öğrenmesi veya hatırlaması zaman alabilir." },
{ id:34, scale:"bilissel", text:"Etkinlik sırasında zihinsel odağını başka uyaranlara kaydırabilir." },
{ id:35, scale:"bilissel", text:"Dikkatini sürdürmekte zorlanır." },
{ id:36, scale:"bilissel", text:"Birden fazla yönergeyi akılda tutup uygulamakta zorlanır." },
{ id:37, scale:"bilissel", text:"Sorunla karşılaştığında çözüm denemeden kolayca vazgeçebilir." },
{ id:38, scale:"bilissel", text:"Yeni görevlerde ne yapacağını anlamak için ek yönlendirme ister." },
{ id:39, scale:"bilissel", text:"Planlama gerektiren oyun veya etkinliklerde zorlanabilir." },
{ id:40, scale:"bilissel", text:"Görev sırasında dikkatini yeniden toplamakta zorlanabilir." },

/* YÜRÜTÜCÜ */

{ id:41, scale:"yurutucu", text:"Başladığı görevleri tamamlamakta zorlanır." },
{ id:42, scale:"yurutucu", text:"Kurallı oyunlarda kurala uygun davranışı sürdürmekte zorlanır." },
{ id:43, scale:"yurutucu", text:"Sırasını beklemekte veya bekleme davranışını sürdürmekte zorlanır." },
{ id:44, scale:"yurutucu", text:"Davranışını duruma göre durdurmakta veya ayarlamakta zorlanır." },
{ id:45, scale:"yurutucu", text:"Bir işi bitirmeden başka bir işe geçme eğilimi gösterir." },
{ id:46, scale:"yurutucu", text:"Verilen talimatı uygulamaya başlasa bile sürdürmekte zorlanır." },
{ id:47, scale:"yurutucu", text:"Dikkati kolay dağılır ve göreve geri dönmekte zorlanabilir." },
{ id:48, scale:"yurutucu", text:"Bir işi planlı ve sıralı biçimde yürütmekte zorlanır." },
{ id:49, scale:"yurutucu", text:"Kuralları veya görev adımlarını akılda tutmakta zorlanır." },
{ id:50, scale:"yurutucu", text:"Görev sırasında materyallerini, bedenini veya davranışını organize etmekte zorlanır." },

/* INTEROSEPSİYON */

{ id:51, scale:"intero", text:"Acıktığını fark eder." },
{ id:52, scale:"intero", text:"Susadığını fark eder." },
{ id:53, scale:"intero", text:"Tuvalet ihtiyacını fark eder." },
{ id:54, scale:"intero", text:"Yorgun olduğunu fark eder." },
{ id:55, scale:"intero", text:"Kalp atışının hızlandığını fark eder." },
{ id:56, scale:"intero", text:"Vücudunun sıcak veya soğuk olduğunu fark eder." },
{ id:57, scale:"intero", text:"Ağrı hissettiğinde bunu ifade eder." },
{ id:58, scale:"intero", text:"Stresli olduğunu fark eder." },
{ id:59, scale:"intero", text:"Vücudundaki değişimleri fark eder." },
{ id:60, scale:"intero", text:"Rahatladığında bunu fark eder." }

]
