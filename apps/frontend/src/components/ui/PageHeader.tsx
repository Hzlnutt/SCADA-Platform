import { useTranslation } from "../../i18n/useTranslation";

type PageHeaderProps = {
  title: string;
  description?: string;
};

const PAGE_TRANSLATIONS: Record<
  string,
  { id: { title: string; desc?: string }; en: { title: string; desc?: string } }
> = {
  "Energy Monitoring Dashboard": {
    id: {
      title: "Dashboard Pemantauan Energi",
      desc: "Ringkasan konsumsi energi, biaya operasional, dan status utilitas utama.",
    },
    en: {
      title: "Energy Monitoring Dashboard",
      desc: "Summary of energy consumption, costs, and key utility status.",
    },
  },
  "Dashboard Pemantauan Energi": {
    id: {
      title: "Dashboard Pemantauan Energi",
      desc: "Ringkasan konsumsi energi, biaya operasional, dan status utilitas utama.",
    },
    en: {
      title: "Energy Monitoring Dashboard",
      desc: "Summary of energy consumption, costs, and key utility status.",
    },
  },
  "Plant Layout": {
    id: {
      title: "Tata Letak Pabrik",
      desc: "Ikhtisar visual untuk Boiler, RO, WFI, dan utilitas pabrik.",
    },
    en: {
      title: "Plant Layout",
      desc: "Visual overview for Boiler, RO, WFI, and utilities.",
    },
  },
  "Tata Letak Pabrik": {
    id: {
      title: "Tata Letak Pabrik",
      desc: "Ikhtisar visual untuk Boiler, RO, WFI, dan utilitas pabrik.",
    },
    en: {
      title: "Plant Layout",
      desc: "Visual overview for Boiler, RO, WFI, and utilities.",
    },
  },
  "Machine Health": {
    id: {
      title: "Kesehatan Mesin",
      desc: "Pantau status batas peringatan dan rekomendasi tindakan untuk tiap grup mesin.",
    },
    en: {
      title: "Machine Health",
      desc: "Monitor threshold status and recommended actions for each equipment group.",
    },
  },
  "Alarm Console": {
    id: {
      title: "Konsol Alarm",
      desc: "Konfirmasi, filter, dan tinjau seluruh alarm aktif.",
    },
    en: {
      title: "Alarm Console",
      desc: "Acknowledge, filter, and review active alarms.",
    },
  },
  "Analytics": {
    id: {
      title: "Analitik",
      desc: "Dashboard OEE, KPI, dan efisiensi operasional sistem.",
    },
    en: {
      title: "Analytics",
      desc: "OEE, KPI, and operational efficiency dashboards.",
    },
  },
  "Device Health": {
    id: {
      title: "Kesehatan Perangkat",
      desc: "Diagnostik peralatan dan status komunikasi PLC.",
    },
    en: {
      title: "Device Health",
      desc: "PLC communication and equipment diagnostics.",
    },
  },
  "Historian": {
    id: {
      title: "Data Historian",
      desc: "Tren dan kueri data telemetri historis.",
    },
    en: {
      title: "Historian",
      desc: "Trend and query historical telemetry.",
    },
  },
  "Reports": {
    id: {
      title: "Laporan",
      desc: "Laporan bulanan, year-to-date, dan lembar verifikasi inspeksi shift.",
    },
    en: {
      title: "Reports",
      desc: "Monthly reports, year-to-date, and shift inspection checklists.",
    },
  },
  "Settings": {
    id: {
      title: "Pengaturan",
      desc: "Konfigurasi tampilan dan preferensi aplikasi EMS.",
    },
    en: {
      title: "Settings",
      desc: "Display configuration and EMS application preferences.",
    },
  },
  "Task Management": {
    id: {
      title: "Manajemen Tugas",
      desc: "Catatan tugas pemeliharaan preventif dan riwayat penyelesaian jam kerja.",
    },
    en: {
      title: "Task Management",
      desc: "Preventative maintenance running hours task records & completion logs.",
    },
  },
  "Approvals": {
    id: {
      title: "Persetujuan",
      desc: "Konfirmasi atau tolak log perawatan dan laporan shift yang diajukan.",
    },
    en: {
      title: "Approvals",
      desc: "Confirm or reject submitted maintenance logs and shift reports.",
    },
  },
  "Admin Panel": {
    id: {
      title: "Panel Admin",
      desc: "Kelola direktori pengguna, tetapkan peran akses organisasi, dan modifikasi log PLC.",
    },
    en: {
      title: "Admin Panel",
      desc: "Manage user directory, assign organizational access roles, and modify historical PLC logs.",
    },
  },
  "Audit Trail": {
    id: {
      title: "Jejak Audit (Audit Trail)",
      desc: "Pantau riwayat perubahan, aktivitas administratif, dan log audit operasional sistem SCADA secara terpusat.",
    },
    en: {
      title: "Audit Trail",
      desc: "Centrally track changes, administrative actions, and SCADA operational audit logs.",
    },
  },
  "Thresholds": {
    id: {
      title: "Ambang Batas (Thresholds)",
      desc: "Konfigurasi tingkat pemicu dan batas parameter untuk peringatan telemetri serta kesehatan mesin.",
    },
    en: {
      title: "Thresholds",
      desc: "Configure trigger levels and limit parameters for telemetry alerts and machine health indicators.",
    },
  },
  "Profile Settings": {
    id: {
      title: "Pengaturan Profil",
      desc: "Kelola rincian identitas akun dan foto avatar.",
    },
    en: {
      title: "Profile Settings",
      desc: "Manage user identity details and avatar picture.",
    },
  },
  "Utility & HVAC Status": {
    id: {
      title: "Status Utilitas & HVAC",
      desc: "Status otomatis dari sistem dan override manual untuk peralatan utama.",
    },
    en: {
      title: "Utility & HVAC Status",
      desc: "System automatic status and manual override for primary equipment.",
    },
  },
  "Single Line Diagram — Distribusi Daya": {
    id: {
      title: "Single Line Diagram — Distribusi Daya",
      desc: "Monitoring diagram garis tunggal jaringan distribusi kelistrikan Factory 1 & Factory 2",
    },
    en: {
      title: "Single Line Diagram — Power Distribution",
      desc: "Single-line diagram monitoring of electrical power distribution network for Factory 1 & Factory 2",
    },
  },
  "Single Line Diagram — Power Distribution": {
    id: {
      title: "Single Line Diagram — Distribusi Daya",
      desc: "Monitoring diagram garis tunggal jaringan distribusi kelistrikan Factory 1 & Factory 2",
    },
    en: {
      title: "Single Line Diagram — Power Distribution",
      desc: "Single-line diagram monitoring of electrical power distribution network for Factory 1 & Factory 2",
    },
  },
  "Laporan Kelistrikan": {
    id: {
      title: "Laporan Kelistrikan",
      desc: "Report data historis parameter kelistrikan per transformator",
    },
    en: {
      title: "Electricity Report",
      desc: "Historical electricity parameter report per transformer",
    },
  },
  "Electricity Report": {
    id: {
      title: "Laporan Kelistrikan",
      desc: "Report data historis parameter kelistrikan per transformator",
    },
    en: {
      title: "Electricity Report",
      desc: "Historical electricity parameter report per transformer",
    },
  },
};

export const PageHeader = ({ title, description }: PageHeaderProps) => {
  const { t, language } = useTranslation();

  const mapping = PAGE_TRANSLATIONS[title.trim()];
  const localizedTitle = mapping ? mapping[language]?.title ?? title : title;
  const localizedDescription = mapping
    ? mapping[language]?.desc ?? description
    : description;

  return (
    <div className="mb-5">
      <div className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#1f6fb5]">
        {t("pageHeader.executiveOverview")}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-[#002b5c] dark:text-white">
        {localizedTitle}
      </h1>
      {localizedDescription ? (
        <p className="mt-1 text-sm text-[#47729f] dark:text-slate-400">
          {localizedDescription}
        </p>
      ) : null}
    </div>
  );
};
