# Progress SCADA Platform Updates

Log perkembangan dan status pengerjaan fitur untuk menjaga konteks pengerjaan tetap utuh antar sesi.

---

## 1. Status Pengerjaan Terkini
- **Boiler & Chiller Ignition API integration**: Selesai.
- **Cooling Water System WF1-U3 Overview & P&ID Cleanups**: Selesai.
- **Electricity Load Factor Bugfix**: Selesai.
- **Build Status**: Sukses (`0 errors` pada TypeScript & build compilation).

---

## 2. Rincian Perubahan Per Fitur & File

### A. Cooling Water System WF1-U3 (cooling-water-1)
- **Tujuan**: Menghilangkan data dummy/simulated pada halaman Overview dan P&ID Diagram. Menampilkan `"API TIDAK TERKIRIM"` untuk data/parameter yang belum ter-fetch oleh Ignition API, dan menggunakan live telemetry untuk data yang aktif. Menghilangkan demo flow ON/OFF statis.
- **File yang Diubah**:
  1. **`apps/frontend/src/components/pid/SensorIndicator.tsx`**:
     - Mengubah type prop `value` agar mendukung type `string` sehingga tulisan `"API TIDAK TERKIRIM"` bisa ditampilkan langsung dalam box SVG.
  2. **`apps/frontend/src/pages/machines/diagrams/CoolingWF1U3Pid.tsx`**:
     - Mengubah semua sensor statis/dummy (seperti TDS, pH, volume basin, makeup water, blowdown) menjadi `"API TIDAK TERKIRIM"`.
     - Menghubungkan visualisasi fan status secara dinamis untuk **FAN-1**, **FAN-2**, dan **FAN-3** menggunakan tag realtime dari store telemetry.
     - Membungkus `motorStatus` dengan boolean Proxy sehingga jika nilainya berupa string `"API TIDAK TERKIRIM"` tidak memicu animasi putaran fan atau flow pipa yang menyala (hanya boolean `true` yang dianggap ON).
  3. **`apps/frontend/src/pages/machines/MachinePidDiagram.tsx`**:
     - Menghapus state `allOn` (demo flow) dan membersihkan data task/alarm dummy khusus untuk `cooling-water-1`.
  4. **`apps/frontend/src/pages/machines/PidPageTemplate.tsx`**:
     - Menghapus button UI "FLOW ON / FLOW OFF (demo)" di bar atas canvas diagram.
  5. **`apps/frontend/src/pages/machines/MachineOverview.tsx`**:
     - Memodifikasi `liveData` useMemo agar jika `unitId === "cooling-water-1"`, semua data yang bukan dari API (suhu return/supply, TDS supply, pH supply, makeup/blowdown volume, dosing pump rates, dsb.) di-set nilainya menjadi `"API TIDAK TERKIRIM"`.
     - Menangani progress bar agar jika bernilai `"API TIDAK TERKIRIM"`, progress bar diisi `0%` untuk mencegah `NaN` dan menjaga agar tampilan tidak rusak.
     - Menyembunyikan Cooling Tower Detail Grid untuk mesin selain Cooling Water (ditambahkan check `unitId.startsWith("cooling-water")`).
     - Mengamankan komparasi baris tabel status area matrix dengan typecast `(row.flow as any) === "API TIDAK TERKIRIM"` agar tidak memicu error compiler TS2367.

### B. Bugfix Load Factor di Page Electricity
- **Tujuan**: Memastikan kartu Load Factor di halaman Electricity menampilkan nilai Power Factor (Cos Phi) yang sesuai dengan API baik dalam range bulanan maupun tahunan, serta menampilkan `"API TIDAK TERKIRIM"` saat status offline.
- **File yang Diubah**:
  1. **`apps/frontend/src/pages/utilities/Electricity.tsx`**:
     - Mengubah value `loadFactor` pada filter "bulanan" (monthly) dari perhitungan matematis lokal menjadi live Power Factor dari API: `plnData.pqData.pf * 100` (atau fallback 88.5 jika null).
     - Menghapus batasan `cardPeriod === "yearly"` pada check offline, sehingga peringatan `"API TIDAK TERKIRIM"` muncul secara konsisten di semua filter waktu ketika status API offline.

---

## 3. Hasil Pengujian / Kompilasi
Kompilasi build turbo repo selesai dengan status **Success**:
- `packages/shared`: Build sukses.
- `apps/backend`: Build sukses.
- `apps/frontend`: Build sukses (Vite compile selesai tanpa syntax/TS errors).

---

## 4. Langkah Selanjutnya jika Ingin Melanjutkan Sesi
- Tarik perubahan dari repo utama ke web server menggunakan `git pull`.
- Jalankan service pnpm/npm dev atau build di server production/development.
