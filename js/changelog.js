/* What changed in each release, newest first. Add an entry at the top before running tools/publish.sh:
   the "Update Now" bar on every device lists the entries it does not have yet.
   Keep this file as one JSON array after "=", because the update bar reads it as JSON. */
window.MB_CHANGELOG = [
 {"id": "2026-11-06-7", "items": [
  "Order yang sudah lunas (DP + pelunasan atau bayar penuh) kini bisa dipilih tahap kerjanya: In Progress, Revision, atau Completed",
  "Order lunas yang masih dikerjakan tampil di In Progress (dashboard dan pipeline), bukan Ready to close",
  "Order yang sedang revisi tetap berstatus In Revision sampai Anda pilih Completed, tidak otomatis Ready to close"
 ]},
 {"id": "2026-11-06-6", "items": [
  "Order baru: pilihan Payment = Down payment 50% atau Full payment 100% (atau persen lain)",
  "Full payment 100%: invoice bayar penuh; setelah pembayaran dikonfirmasi, status dipilih bebas: In Progress, Revision, atau Completed (tidak otomatis close)",
  "Kuitansi selama order dikerjakan memuat jadwal kerja; ketentuan revisi baru muncul setelah masuk tahap Revision"
 ]},
 {"id": "2026-11-06-5", "items": [
  "QRIS dinamis: halaman QRIS kini memuat nominal tagihan, jadi customer tinggal scan tanpa mengetik jumlah (bila gambar QRIS tidak terbaca, otomatis memakai QRIS statis)",
  "Order tanpa customer: peringatan di halaman order dan dashboard, plus halaman \"Orders Without a Customer\" untuk mengisi nama sebelum invoice dikirim",
  "Price List Matching (Price List > Match Old Orders): usulan kode price list untuk baris order lama, disimpan hanya yang dicentang",
  "Order tanpa DP (DP 0%): langsung punya Invoice (bayar setelah selesai) yang bisa dikirim sejak order masuk dan selama dikerjakan, dengan template WA sendiri"
 ]},
 {"id": "2026-11-06-4", "items": [
  "Order dengan metode QRIS: sekali download langsung 2 halaman (invoice + halaman QRIS); PDF jadi 1 file 2 halaman, PNG jadi 2 gambar, kirim WA di HP membagikan 2 gambar"
 ]},
 {"id": "2026-11-06-3", "items": [
  "Category order tinggal 3: HQ (layanan umum 01-15 dan mindbytehq), TECHNO (mindbyte_techno), PRAXIS (mindbyte_praxis)",
  "Category terisi otomatis saat memilih layanan dari price list; semua order lama dipindah ke HQ"
 ]},
 {"id": "2026-11-06-2", "items": [
  "Metode bayar dipilih admin per order: QRIS atau transfer bank (rekening diatur di Settings > Bank Transfer, nama pemilik disensor)",
  "QRIS tidak lagi menempel di invoice: QRIS jadi halaman tersendiri (\"QRIS · ...\") yang dikirim di samping invoice; transfer bank tercetak di invoice",
  "Alur dokumen sesuai skema DP: Invoice DP, Kuitansi DP, Invoice Pelunasan, Kuitansi Lunas; bayar penuh di depan (DP 100%) cukup 1 Invoice + 1 Kuitansi",
  "Konfirmasi Order diganti Kuitansi DP (nomor RCT-...-DP)",
  "Brand order otomatis dari price list: @mindbyte_praxis (16-17), @mindbytehq (18), @mindbyte_techno (19), layanan umum (01-14); kategori ikut terisi dan brand tampil di invoice",
  "Template WA baru: Invoice bayar penuh, File Terkirim (bayar penuh), dan kode {payment_method}"
 ]},
 {"id": "2026-11-06", "items": [
  "Price list: layanan @mindbyte_praxis (jasa jurnal & publish SINTA) dan @mindbytehq (riset kuantitatif & kualitatif) ditambahkan",
  "Sinkron lebih aman: simpanan yang gagal dicoba ulang otomatis, dan perubahan langsung dikirim saat aplikasi ditutup",
  "Pemberitahuan saat data diubah dari perangkat lain atau oleh Claude, beserta isi perubahannya",
  "Bar update sekarang menampilkan daftar perubahan versi baru"
 ]}
];
