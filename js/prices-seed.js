/* Price list transcribed from "Price List Twitter.pdf" (Harga Pasar Joki Twitter), every line of it.
   price = starting price, max = top of the range (0 when the PDF gives a single price; price 0 = a rule, see note).
   group = sub-heading inside a category (the ★ lines in the PDF).
   Ids are pl-<category>-<row>; a 7th element pins the row number so rows added later never renumber older ones
   (orders keep a link to the service they were made from). */
window.MB_PRICE_SEED_VER = 2;
window.MB_PRICE_SEED = (() => {
  const C = [
    ["Jasa Tulis", [
      ["", "Buku kecil / binder A5", 4000, 0, "halaman", ""],
      ["", "Buku besar bigbos / binder B5", 6000, 0, "halaman", ""],
      ["", "Kertas HVS A4/F4", 8000, 0, "halaman", ""],
      ["", "Kertas folio", 8000, 0, "halaman", ""],
      ["", "Bahasa Arab", 10000, 25000, "halaman", ""],
      ["", "Bahasa asing (tambahan)", 2000, 5000, "halaman", "Ditambahkan ke harga tulis per halaman."]]],
    ["Jasa Ketik MS Word / Excel", [
      ["", "Ketik Word", 5000, 0, "halaman", "Per halaman atau 300 kata. Tinggal ketik saja."],
      ["", "Excel dengan rumus", 15000, 0, "halaman", ""]]],
    ["Jasa Ketik Power Point", [
      ["Materi dari customer", "Template kosongan", 2000, 0, "slide", ""],
      ["Materi dari customer", "Template software", 3000, 0, "slide", ""],
      ["Materi dari customer", "Template desain", 5000, 0, "slide", ""],
      ["Materi dari penjoki", "Tanpa rangkuman", 2000, 0, "slide", "Ditambah harga template yang dipakai."],
      ["Materi dari penjoki", "Tanpa rangkuman, template kosongan", 4000, 0, "slide", "Alternatif dari 2k/slide + harga template.", 6],
      ["Materi dari penjoki", "Dengan rangkuman", 7000, 10000, "slide", ""]]],
    ["Makalah, Essay, Artikel, Jurnal, Laporan", [
      ["", "Materi dari customer (tanpa parafrase)", 10000, 0, "halaman", ""],
      ["", "Materi customer + tambahan penjoki (tanpa parafrase)", 15000, 0, "halaman", ""],
      ["", "Materi dari penjoki (tanpa parafrase)", 20000, 0, "halaman", ""],
      ["", "Materi dari penjoki (dengan parafrase)", 25000, 65000, "halaman", ""]]],
    ["Jasa Mencari Jurnal", [
      ["", "Jurnal Indonesia", 5000, 0, "jurnal", ""],
      ["", "Jurnal internasional", 10000, 0, "jurnal", ""]]],
    ["Jasa Joki Soal", [
      ["Matematika, Fisika, Kimia", "Pilihan ganda", 4000, 0, "soal", ""],
      ["Matematika, Fisika, Kimia", "Essay", 5000, 15000, "soal", "Tergantung kesulitan dan penjabaran."],
      ["Akuntansi", "Pilihan ganda", 5000, 0, "soal", ""],
      ["Akuntansi", "Soal / laporan", 15000, 25000, "soal", "Tergantung kesulitan."],
      ["Statistika", "Pilihan ganda", 5000, 0, "soal", ""],
      ["Statistika", "Essay", 15000, 25000, "soal", ""],
      ["Statistika", "SPSS / EViews", 25000, 0, "uji", "Tergantung kesulitan dan banyaknya variabel/indikator."],
      ["Statistika", "SPSS / EViews untuk skripsi", 50000, 0, "uji", "Tergantung kesulitan dan banyaknya variabel/indikator."],
      ["Puisi / Pantun", "Puisi / pantun", 8000, 0, "bait", ""],
      ["Soal lain-lain (selain hitungan)", "Pilihan ganda", 2000, 3000, "soal", ""],
      ["Soal lain-lain (selain hitungan)", "Short essay", 4000, 7000, "soal", ""],
      ["Soal lain-lain (selain hitungan)", "Long essay", 7000, 15000, "soal", "Tergantung kesulitan dan riset."]]],
    ["Jasa Joki Bahasa Asing", [
      ["", "Translate per kata", 100, 500, "kata", "Tergantung kesulitan."],
      ["", "Translate per halaman", 30000, 0, "halaman", "Tergantung kesulitan."]]],
    ["Revisi, Dapus, Dafis, Penomoran Halaman", [
      ["Revisi", "Format, EYD", 1000, 0, "halaman", ""],
      ["Revisi", "Format, EYD, typo", 3000, 0, "halaman", ""],
      ["Revisi", "Format, EYD, typo, olahan kata (sedikit)", 5000, 0, "halaman", ""],
      ["Daftar Pustaka", "Sudah ada file (Mendeley)", 2000, 0, "sumber", ""],
      ["Daftar Pustaka", "Sudah ada file (manual)", 3000, 0, "sumber", ""],
      ["Daftar Pustaka", "Belum ada file (Mendeley/manual)", 5000, 0, "sumber", ""],
      ["Daftar Isi", "Daftar isi", 10000, 20000, "halaman", "Tergantung kesulitan dan banyaknya."],
      ["Penomoran Halaman", "Penomoran sama / tanpa ketentuan berbeda", 1000, 0, "10 halaman", ""],
      ["Penomoran Halaman", "Penomoran berbeda (romawi + angka)", 2000, 0, "10 halaman", "2× harga penomoran biasa."]]],
    ["Resume, Review, Rangkuman", [
      ["Dari video", "Rangkuman video", 5000, 0, "10 menit", "Tergantung kesulitan materi."],
      ["Dari file / ebook / buku", "Rangkuman jadi 1 halaman", 25000, 35000, "halaman", "Contoh: 1 file jadi 4 halaman rangkuman = 30k × 4 = 120k."],
      ["Review jurnal", "Review jurnal", 35000, 0, "jurnal", "Tergantung kesulitan dan banyaknya."]]],
    ["Jasa Parafrase", [
      ["", "Penurunan 1–10%", 10000, 0, "halaman", ""],
      ["", "Penurunan 11–30%", 15000, 0, "halaman", ""],
      ["", "Penurunan di atas 30%", 20000, 0, "halaman", "Harga start, sesuaikan dengan kesulitan."]]],
    ["Skripsi", [
      ["Laporan / Proposal", "Laporan / proposal per halaman", 40000, 0, "halaman", "Tergantung jurusan dan kesulitan."],
      ["Laporan / Proposal", "Laporan / proposal per bab", 250000, 1250000, "bab", "Mulai ½ harga per bab skripsi. Tergantung jurusan dan kesulitan.", 5],
      ["Skripsi", "Skripsi per halaman", 40000, 60000, "halaman", "Tergantung jurusan, kesulitan, deadline."],
      ["Skripsi", "Skripsi per bab", 500000, 2500000, "bab", "Tergantung jurusan, kesulitan, deadline."],
      ["Skripsi", "Judul skripsi sampai di-ACC", 50000, 0, "", ""]]],
    ["Tutor / Konsultasi (Zoom / GMeet)", [
      ["", "Bimbingan belajar, konsul skripsi/TA/magang", 50000, 75000, "jam", "Tergantung kesulitan materi."]]],
    ["TOEFL", [
      ["", "Skor 350–450", 300000, 0, "", "Harga dapat dinaikkan sesuai permintaan skor."],
      ["", "Skor 450 ke atas", 500000, 700000, "", "Harga dapat dinaikkan sesuai permintaan skor."]]],
    ["Kreasi / Karya", [
      ["Gambar manual", "Kertas A4 (gambar)", 35000, 100000, "gambar", "Tergantung kesulitan dan usaha."],
      ["Gambar manual", "Kertas A4 (gambar + warna)", 65000, 150000, "gambar", ""],
      ["Gambar manual", "Kertas A3 (gambar)", 50000, 120000, "gambar", ""],
      ["Gambar manual", "Kertas A3 (gambar + warna)", 75000, 150000, "gambar", ""],
      ["Gambar / desain digital", "Poster, pamflet, infografis, banner, logo", 30000, 0, "desain", ""],
      ["Gambar / desain digital", "Feeds IG sederhana", 15000, 0, "3 feeds", ""],
      ["Gambar / desain digital", "Feeds IG aesthetic / rumit", 30000, 0, "3 feeds", ""],
      ["Gambar / desain digital", "Twibbon", 30000, 0, "", ""],
      ["Gambar / desain digital", "Animasi Blender 3D (modelling)", 150000, 400000, "", ""],
      ["Gambar / desain digital", "Animasi Blender 3D (animasi)", 700000, 0, "30 detik", ""],
      ["Gambar / desain digital", "Ubah background foto", 20000, 0, "foto", ""],
      ["Kliping", "Kertas HVS", 15000, 30000, "halaman", "Tergantung kesulitan, materi dari customer atau penjoki."],
      ["Kliping", "Kertas karton / manila", 50000, 120000, "", ""],
      ["Lettering", "Lettering full", 10000, 25000, "halaman", ""],
      ["Lettering", "Lettering judul saja", 5000, 0, "", ""],
      ["Mindmapping, peta konsep", "Digital (sederhana)", 15000, 0, "", ""],
      ["Mindmapping, peta konsep", "Manual kertas A4", 20000, 50000, "", "Tergantung hiasan lettering dll."],
      ["Mindmapping, peta konsep", "Manual kertas A3", 30000, 75000, "", "Tergantung hiasan lettering dll."],
      ["Edit video", "Edit video", 10000, 15000, "menit", ""],
      ["Voice over / transkrip", "Voice over", 5000, 0, "menit", ""],
      ["Voice over / transkrip", "Voice over + script", 5000, 0, "menit", "Ditambah script mulai 25k/halaman."],
      ["Voice over / transkrip", "Script saja", 25000, 0, "halaman", ""],
      ["Voice over / transkrip", "Transkrip per menit", 5000, 0, "menit", "Tergantung kesulitan dan lama waktu."],
      ["Voice over / transkrip", "Transkrip per halaman", 20000, 0, "halaman", "Tergantung kesulitan dan lama waktu.", 26],
      ["Curriculum Vitae (CV)", "CV template sederhana", 25000, 0, "", ""],
      ["Curriculum Vitae (CV)", "CV ATS friendly", 50000, 0, "", "Tergantung kesulitan."]]],
    ["Ketentuan Umum", [
      ["", "Sistem DP minimal 30%", 0, 0, "", "Berlaku untuk setiap pengguna jasa. Opsional, untuk mencegah hit and run."],
      ["", "Full payment sebelum hasil dikirim", 0, 0, "", "Customer wajib melunasi sebelum hasil dikirim."],
      ["", "Deadline mepet / realtime", 0, 0, "", "Harga bisa naik, boleh sampai 2× harga normal. Bedakan harga realtime dengan harga biasa."],
      ["", "Biaya lain / fee tambahan", 0, 0, "", "Tambahkan fee sesuai kebutuhan. Jangan ada kata \"fee seikhlasnya\"."],
      ["", "Standar halaman", 0, 0, "", "Kertas A4, Times New Roman 12, justified, spasi 1,5, margin 4-4-3-3 (1 halaman kurang lebih 300 kata). Berlaku untuk semua Microsoft Office."],
      ["", "Semua harga adalah harga start", 0, 0, "", "Sesuaikan dengan kesulitan, banyaknya, dan deadline."]]]
  ];
  const out = [], p2 = n => String(n).padStart(2, "0");
  C.forEach(([cat, rows], ci) => { let auto = 0;
    rows.forEach(([group, name, price, max, unit, note, pin], ri) => {
      const n = pin || ++auto;
      out.push({ id: `pl-${p2(ci + 1)}-${p2(n)}`, code: `${p2(ci + 1)}.${p2(n)}`, cat, group, name, price, max, unit, note, sort: (ci + 1) * 100 + ri + 1 });
    });
  });
  return out;
})();
window.MB_PRICE_NOTES = [
  "Sistem DP minimal 30% untuk setiap pengguna jasa. Customer wajib full payment sebelum hasil dikirim.",
  "Standar halaman: kertas A4, Times New Roman 12, justified, spasi 1,5, margin 4-4-3-3 (1 halaman kurang lebih 300 kata). Berlaku untuk semua Microsoft Office.",
  "Harga bisa naik jika deadline terlalu mepet. Order realtime boleh sampai 2× harga normal.",
  "Jika ada biaya lain, tambahkan fee sesuai kebutuhan. Jangan ada kata \"fee seikhlasnya\".",
  "Semua harga adalah harga START, sesuaikan dengan kesulitan."
];
