import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="auth-font relative min-h-screen overflow-hidden bg-[#eaf4ff] text-[#002b5c]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-[#d6e9fb] blur-[110px]" />
        <div className="absolute right-10 top-20 h-56 w-56 rounded-full bg-[#bfe0ff] blur-[100px]" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-[#ffe7c7] blur-[120px]" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 items-center justify-center rounded-xl bg-white px-3 shadow-[0_10px_28px_rgba(31,111,181,0.12)]">
              <img
                src="https://www.widatra.com/asset/logotext.png"
                alt="Widatra"
                className="h-6 w-auto"
                loading="lazy"
              />
            </div>
            <div>
              <div className="text-lg font-semibold">WidatraOne</div>
              <div className="text-xs text-[#47729f]">
                Industrial SCADA Platform
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-[#002b5c]">
            Kendali, Analitik, dan P&ID PLC dalam satu dashboard eksekutif.
          </h1>
          <p className="text-sm text-[#47729f]">
            Pantau konsumsi energi, histori peralatan, dan laporan shift secara
            real-time. Semua data terpusat dan siap untuk audit.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Realtime historian & alarm",
              "P&ID fokus untuk tiap mesin",
              "Shift report terstruktur",
              "Audit trail & akses role"
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-[#d6e9fb] bg-white/70 p-4 text-sm text-[#003b75]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-[#d6e9fb] bg-white/90 p-8 shadow-[0_24px_70px_rgba(31,111,181,0.18)]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
