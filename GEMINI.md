# SCADA Platform Project Guidelines & Rules

## 1. Standar Desain Responsif (Responsive Design Invariants)
Setiap pembuatan, perbaikan, atau penambahan komponen UI di platform web SCADA ini WAJIB menerapkan kaidah responsif penuh across multi-device (Mobile 360px+, Tablet 768px+, Desktop 1024px+, Ultra-wide 1440px+):

### A. Layout & Kontainer Adaptif
- **Grid Fleksibel**: Selalu gunakan kolom adaptif berbasis Tailwind (contoh: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`). Hindari jumlah kolom tetap yang kaku tanpa breakpoint.
- **Flexbox Wrap**: Header, toolbar, filter tanggal/kategori, dan barisan tombol wajib menggunakan `flex-wrap` dengan `gap-2` atau `gap-3` agar elemen tidak berhimpitan atau meluap ketika dibuka di layar kecil.
- **Hindari Fixed Width Kaku**: Dilarang menetapkan lebar kaku yang melebihi lebar layar HP (seperti `w-[800px]` atau `minWidth: 1200` pada kontainer induk halaman). Gunakan `max-w-full` atau bungkus dalam container scroll horizontal.

### B. Diagram P&ID, Single Line Diagram (SLD) & Skematik Aliran
- Kanvas diagram besar (P&ID mesin, Single Line Diagram distribusi listrik, diagram alir air/gas) wajib dibungkus dalam kontainer geser horizontal:
  ```tsx
  <div className="overflow-x-auto scrollbar-thin">
    <div className="relative min-w-[760px] md:min-w-[900px]">
      {/* Kanvas / SVG Diagram */}
    </div>
  </div>
  ```
- Hindari penempatan panel tetap (*fixed/absolute*) di sisi kanan diagram yang menggunakan margin statis besar (seperti `mr-[400px]`), melainkan gunakan tata letak flex tumpuk responsif: `flex flex-col xl:flex-row gap-5`.

### C. Tabel Data & Historian
- Setiap tabel data (Log Alarm, Laporan Shift, Maintenance, Audit Trail, Konfigurasi Sensor, Billing) WAJIB dibungkus dalam:
  ```tsx
  <div className="overflow-x-auto scrollbar-thin">
    <table className="w-full min-w-[500px...720px] text-left text-xs border-collapse">
      {/* Kolom & Baris */}
    </table>
  </div>
  ```
- Tetapkan `min-w-[...px]` yang proporsional pada elemen `<table>` agar teks, angka, dan badge status tidak terhimpit atau terpotong pada layar kecil.

### D. Modal Dialog & Jendela Pop-up
- Kontainer backdrop modal wajib menggunakan padding adaptif: `p-3 sm:p-6`.
- Kontainer card modal wajib membatasi lebar maksimum: `relative w-[450px] max-w-full rounded-2xl ...`.
- Isi modal yang panjang wajib menyertakan batas tinggi dan scroll vertikal (`max-h-[90vh] overflow-y-auto`).

### E. Navigasi & Tabs
- Navigasi utama pada perangkat mobile/tablet (< 1024px / `< lg`) menggunakan *Mobile Slide-Out Drawer* yang dipicu melalui tombol hamburger `☰` pada Topbar.
- Barisan sub-menu dan tab mesin/P&ID wajib menggunakan strip geser horizontal (`flex items-center gap-1.5 overflow-x-auto scrollbar-thin whitespace-nowrap py-1`).

---

## 2. Integritas Kode & Build
- Preservasi komentar kode, docstrings, dan fitur yang sudah ada.
- Setiap kompilasi frontend Vite wajib dijalankan dari dalam direktori `apps/frontend` (`cd apps/frontend; node node_modules/vite/bin/vite.js build`) agar bundle Tailwind CSS diproses dengan benar.
- Pastikan pengecekan tipe TypeScript frontend dan backend selalu bebas dari error (`tsc --noEmit`).
