# Progress SCADA Platform Updates

Log perkembangan dan status pengerjaan fitur untuk menjaga konteks pengerjaan tetap utuh antar sesi.

---

## 1. Status Pengerjaan Terkini
- **Boiler & Chiller Ignition API integration**: Selesai.
- **Cooling Water System WF1-U3 Overview & P&ID Cleanups**: Selesai.
- **Electricity Load Factor Bugfix**: Selesai.
- **Backend Telemetry Cache (In-Memory)**: Selesai.
- **Frontend Telemetry Subscription**: Selesai.
- **Temperatur Baru dari API (Supply, Return, ST3 Return)**: Selesai (Memetakan 3 variabel temperatur baru dari `cooling3` API ke dashboard, P&ID, dan visualisasi trend).
- **Build Status**: Sukses (`0 errors` pada TypeScript & build compilation via pnpm).

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
     - **[UPDATE 13 Juli 2026]**: Memetakan tag `"cooling-water/supply_temp"`, `"cooling-water/return_temp"`, dan `"cooling-water/st3_return_temp"` secara real-time ke masing-masing sensor card (Supply Temp, Return Temp, Delta Temp, dan Loop ST-3).
  3. **`apps/frontend/src/pages/machines/MachinePidDiagram.tsx`**:
     - Menghapus state `allOn` (demo flow) dan membersihkan data task/alarm dummy khusus untuk `cooling-water-1`.
  4. **`apps/frontend/src/pages/machines/PidPageTemplate.tsx`**:
     - Menghapus button UI "FLOW ON / FLOW OFF (demo)" di bar atas canvas diagram.
  5. **`apps/frontend/src/pages/machines/MachineOverview.tsx`**:
     - Memodifikasi `liveData` useMemo agar jika `unitId === "cooling-water-1"`, semua data yang bukan dari API (suhu return/supply, TDS supply, pH supply, makeup/blowdown volume, dosing pump rates, dsb.) di-set nilainya menjadi `"API TIDAK TERKIRIM"`.
     - **[UPDATE 13 Juli 2026]**: Menyambungkan variabel `supplyTemp` dan `returnTemp` secara dinamis ke tag `"cooling-water/supply_temp"` dan `"cooling-water/return_temp"` yang berasal dari API.
     - Menangani progress bar agar jika bernilai `"API TIDAK TERKIRIM"`, progress bar diisi `0%` untuk mencegah `NaN` dan menjaga agar tampilan tidak rusak.
     - Menyembunyikan Cooling Tower Detail Grid untuk mesin selain Cooling Water (ditambahkan check `unitId.startsWith("cooling-water")`).
     - Mengamankan komparasi baris tabel status area matrix dengan typecast `(row.flow as any) === "API TIDAK TERKIRIM"` agar tidak memicu error compiler TS2367.
  6. **`apps/frontend/src/pages/machines/MachineStatistics.tsx`**:
     - **[UPDATE 13 Juli 2026]**: Mengimpor `useTelemetryStore` untuk memantau nilai live secara real-time. Modifikasi fungsi `getValuesForParam` agar visualisasi trend garis historis untuk `ST3 Return Temp`, `Supply Water Temp`, dan `Return Water Temp` secara dinamis berpusat (centered) di sekitar nilai real-time API terbaru alih-alih angka dummy acak.

### B. Live Telemetry Data Binding & Subscriptions
- **Tujuan**: Menghubungkan real-time websocket dengan tags telemetry cooling-water yang baru tanpa menyimpan data tersebut ke database (sesuai request database-free), dan memastikan in-memory cache memuat snapshot awal instan tanpa delay.
- **File yang Diubah**:
  1. **`apps/frontend/src/data/industrial-tags.ts`**:
     - Menambahkan array `extraTags` yang berisi list lengkap tag cooling-water realtime (seperti fan status, motor status, sensor pressure, basin level, dsb.) ke dalam array `telemetryTagIds`. Hal ini memastikan klien frontend mengirim trigger room subscription ke websocket server.
     - **[UPDATE 13 Juli 2026]**: Menambahkan tag temperatur baru `"cooling-water/supply_temp"`, `"cooling-water/return_temp"`, dan `"cooling-water/st3_return_temp"` ke subscription list.
  2. **`apps/backend/src/services/socket.manager.ts`**:
     - Menambahkan map `telemetryCache` serta helper function `updateTelemetryCache` dan `getTelemetryFromCache` untuk menyimpan nilai realtime di memory.
  3. **`apps/backend/src/core/scheduler.ts`**:
     - Memanggil `updateTelemetryCache(points)` sesaat setelah Ignition API sukses di-poll, menyimpan nilai realtime di backend memory.
     - **[UPDATE 13 Juli 2026]**: Memetakan tag `"Scaled_Temp_Tank_Colling3_Supp"`, `"Scaled_Temp_Tank_Colling3_Return"`, dan `"Scaled_Temp_ST3_Return"` ke tagId masing-masing.
  4. **`apps/backend/src/core/socket.ts`**:
     - Saat klien frontend terhubung dan melakukan subscribe ke tagIds, menggabungkan data snapshot database dengan data dari `getTelemetryFromCache` sehingga data realtime dari API cooling-water langsung dikirimkan ke web browser secara instan tanpa menunggu siklus polling berikutnya.

### C. Bugfix Load Factor di Page Electricity
- **Tujuan**: Memastikan kartu Load Factor di halaman Electricity menampilkan nilai Power Factor (Cos Phi) yang sesuai dengan API baik dalam range bulanan maupun tahunan, serta menampilkan `"API TIDAK TERKIRIM"` saat status offline.
- **File yang Diubah**:
  1. **`apps/frontend/src/pages/utilities/Electricity.tsx`**:
     - Mengubah value `loadFactor` pada filter "bulanan" (monthly) dari perhitungan matematis lokal menjadi live Power Factor dari API: `plnData.pqData.pf * 100` (atau fallback 88.5 jika null).
     - Menghapus batasan `cardPeriod === "yearly"` pada check offline, sehingga peringatan `"API TIDAK TERKIRIM"` muncul secara konsisten di semua filter waktu ketika status API offline.

---

## 3. Hasil Pengujian / Kompilasi
Kompilasi build turbo repo selesai dengan status **Success** via **pnpm**:
- `packages/shared`: Build sukses.
- `apps/backend`: Build sukses.
- `apps/frontend`: Build sukses (Vite compile selesai tanpa syntax/TS errors).

---

## 4. Langkah Selanjutnya jika Ingin Melanjutkan Sesi
- Tarik perubahan dari repo utama ke web server menggunakan `git pull`.
- Jalankan service pnpm/npm dev atau build di server production/development.
