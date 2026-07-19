# Yerel 3D Aktivite Pilotu

Bu klasör, **Altından geç – üstünden aş** aktivitesinin ücretsiz ve yerel
Blender üretim hattını içerir. Çalışma zamanı yapay zekâsı, ücretli varlık,
harici medya veya sunucu renderı kullanılmaz.

Üretim çıktıları depo dışında şu klasöre yazılır:

`/Volumes/ResearchSSD/selfmeta-activity-pilot/altindan-gec-ustunden-as`

Blender 4.5+ binary yolunu ortamınıza göre bir kez tanımlayın. Örneğin standart
macOS kurulumu için:

```bash
export BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender"
test -x "$BLENDER_BIN"
"$BLENDER_BIN" --version
```

Blender başka bir disk veya klasördeyse yalnız `BLENDER_BIN` değerini değiştirin.
Sahneyi ve yedi QA karesini oluşturmak için:

```bash
PILOT_OUTPUT_DIR="/Volumes/ResearchSSD/selfmeta-activity-pilot/altindan-gec-ustunden-as" \
PILOT_RESOLUTION_PERCENT=100 \
  "$BLENDER_BIN" --background --factory-startup \
  --python scripts/activity-pilot/create_altindan_gec_pilot.py
```

`--factory-startup`, scriptin `clear_scene()` adımının açık bir kullanıcı
sahnesini etkilemesini önler. Script bu varsayılan çalıştırmada `.blend`, yedi
QA PNG karesi ve gerçek çözünürlük/çıktı bilgilerini taşıyan `manifest.json`
üretir.

Tüm 360 PNG karesini render etmek için:

```bash
PILOT_OUTPUT_DIR="/Volumes/ResearchSSD/selfmeta-activity-pilot/altindan-gec-ustunden-as" \
PILOT_RESOLUTION_PERCENT=100 \
PILOT_RENDER_ANIMATION=1 \
  "$BLENDER_BIN" --background --factory-startup \
  --python scripts/activity-pilot/create_altindan_gec_pilot.py
```

Script video üretmez. `preview-360p.mp4` hızlı inceleme içindir; final MP4/WebM
ayrı teslim çıktılarıdır. PNG dizisinden yerel `ffmpeg` ile üretmek için:

```bash
export PILOT_OUTPUT_DIR="/Volumes/ResearchSSD/selfmeta-activity-pilot/altindan-gec-ustunden-as"

ffmpeg -y -framerate 30 \
  -i "$PILOT_OUTPUT_DIR/frames/frame_%04d.png" \
  -vf "scale=640:360:flags=lanczos" \
  -c:v libx264 -crf 24 -preset medium -pix_fmt yuv420p -movflags +faststart \
  "$PILOT_OUTPUT_DIR/preview-360p.mp4"

ffmpeg -y -framerate 30 \
  -i "$PILOT_OUTPUT_DIR/frames/frame_%04d.png" \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -movflags +faststart \
  "$PILOT_OUTPUT_DIR/altindan-gec-ustunden-as-pilot.mp4"

ffmpeg -y -framerate 30 \
  -i "$PILOT_OUTPUT_DIR/frames/frame_%04d.png" \
  -c:v libvpx-vp9 -crf 28 -b:v 0 -row-mt 1 \
  "$PILOT_OUTPUT_DIR/altindan-gec-ustunden-as-pilot.webm"
```

Video süresi, codec, çözünürlük ve kare hızını doğrulamak için:

```bash
ffprobe -v error \
  -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height,r_frame_rate \
  -of json "$PILOT_OUTPUT_DIR/altindan-gec-ustunden-as-pilot.mp4"
```

Pilot klinik onay yerine geçmez. Manifestteki güvenlik ve gözetim metinleri
değiştirilmeden korunmalıdır.
