import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";

function WaterSubNav() {
  return (
    <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
      <Link
        to="/air"
        className="border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase transition-all duration-200"
      >
        Overview
      </Link>
      <Link
        to="/air/distribusi"
        className="border-b-2 border-cyan-500 px-4 py-2.5 text-xs font-extrabold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase transition-all duration-200"
      >
        Distribusi Air
      </Link>
      <Link
        to="/air/energy"
        className="border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase transition-all duration-200"
      >
        Energy
      </Link>
    </div>
  );
}

export default function WaterDistribution() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Water Utility — Distribusi Air" description="Monitoring jalur aliran air dari deepwell, softener, purifikasi hingga ke titik distribusi factory." />
      </div>

      <WaterSubNav />

      {/* Visually stunning placeholder card */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="h-16 w-16 bg-blue-500/10 text-blue-500 text-3xl rounded-2xl flex items-center justify-center mb-4">
          🌐
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Diagram Distribusi Air</h3>
        <p className="text-xs text-slate-400 max-w-md mt-2">
          Halaman ini akan menampilkan diagram alur proses sensor dan valve distribusi air (Deepwell, Multimedia Filter, Softener, Storage Tank, Factory Utility Loop).
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <span className="px-3 py-1.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-500 uppercase">
            Waiting Mockup from User
          </span>
          <span className="px-3 py-1.5 rounded-full text-[10px] font-extrabold bg-indigo-500/10 text-indigo-500 uppercase">
            SCADA P&ID Layout
          </span>
        </div>

        {/* Mock P&ID flow diagram placeholder */}
        <div className="w-full max-w-xl mt-10 p-6 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 grid grid-cols-5 gap-2 items-center text-xs font-mono font-bold text-slate-400">
          <div className="p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
            💧 SUMUR DW-03
          </div>
          <div className="h-0.5 bg-blue-500/60 relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] text-blue-500">221 L/m</span>
          </div>
          <div className="p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
            📦 TANGKI T-1
          </div>
          <div className="h-0.5 bg-blue-500/60 relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] text-blue-500">112 L/m</span>
          </div>
          <div className="p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
            🏭 FACTORY-1
          </div>
        </div>
      </section>
    </div>
  );
}
