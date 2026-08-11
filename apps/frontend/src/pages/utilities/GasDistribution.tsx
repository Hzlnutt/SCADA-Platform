import { useEffect, useState, useMemo } from "react";
import { useSystemStore } from "../../store/system.store";

interface EquipmentState {
  flow: number;
  pressure: number;
  valveOpen: boolean;
}

/* ═══════════════════════════════════════════════════════════════════
   Gas Distribution Network — SCADA P&ID Diagram
   Full live-flow schematic: PGN Metering → Distribution Header → Equipment
   ═══════════════════════════════════════════════════════════════════ */

export default function GasDistribution() {
  const theme = useSystemStore((state) => state.theme);
  const isDark = theme === "dark";

  /* ── Equipment states ─────────────────────────────────────── */
  const [boiler3, setBoiler3] = useState<EquipmentState>({ flow: 320, pressure: 2.8, valveOpen: true });
  const [boiler4, setBoiler4] = useState<EquipmentState>({ flow: 400, pressure: 2.7, valveOpen: true });
  const [genset, setGenset]   = useState<EquipmentState>({ flow: 220, pressure: 2.1, valveOpen: true });
  const [boiler5, setBoiler5] = useState<EquipmentState>({ flow: 615, pressure: 2.9, valveOpen: true });
  const [pgnPressure, setPgnPressure] = useState(5.16);

  /* ── Live telemetry jitter simulation ─────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => {
      const j = (v: number, lo: number, hi: number, d: number, on: boolean): number => {
        if (!on) return v > 0 ? Number(Math.max(0, v - 15).toFixed(1)) : 0;
        return Number(Math.max(lo, Math.min(hi, v + (Math.random() * 2 - 1) * d)).toFixed(1));
      };
      setBoiler3(p => ({ ...p, flow: j(p.flow, 290, 350, 3, p.valveOpen), pressure: j(p.pressure, 2.6, 3.1, 0.04, p.valveOpen) }));
      setBoiler4(p => ({ ...p, flow: j(p.flow, 370, 430, 3, p.valveOpen), pressure: j(p.pressure, 2.5, 3.0, 0.04, p.valveOpen) }));
      setGenset(p  => ({ ...p, flow: j(p.flow, 195, 245, 2.5, p.valveOpen), pressure: j(p.pressure, 1.9, 2.4, 0.03, p.valveOpen) }));
      setBoiler5(p => ({ ...p, flow: j(p.flow, 580, 650, 4, p.valveOpen), pressure: j(p.pressure, 2.7, 3.2, 0.03, p.valveOpen) }));
      setPgnPressure(p => Number(Math.max(4.9, Math.min(5.4, p + (Math.random() * 2 - 1) * 0.04)).toFixed(2)));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  /* ── Derived metrics ──────────────────────────────────────── */
  const totalFlow = useMemo(() =>
    Number((boiler3.flow + boiler4.flow + genset.flow + boiler5.flow).toFixed(1)),
    [boiler3.flow, boiler4.flow, genset.flow, boiler5.flow]
  );

  const todayNm3 = useMemo(() => {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    return Number((totalFlow * h * 0.78).toFixed(1));
  }, [totalFlow]);

  /* ── Valve toggle handler ─────────────────────────────────── */
  const toggleValve = (id: string) => {
    const flip = (s: React.Dispatch<React.SetStateAction<EquipmentState>>) =>
      s(p => ({ ...p, valveOpen: !p.valveOpen }));
    if (id === "boiler3") flip(setBoiler3);
    else if (id === "boiler4") flip(setBoiler4);
    else if (id === "genset") flip(setGenset);
    else if (id === "boiler5") flip(setBoiler5);
  };

  /* ── Equipment configuration (matches mockup colors/layout) ─ */
  const EQ = [
    { id: "boiler3", s: boiler3, name: "Boiler-3",           cap: "6 ton/h",  mx: 500, c: "#3b82f6", ic: "🔥" },
    { id: "boiler4", s: boiler4, name: "Boiler-4",           cap: "6 ton/h",  mx: 500, c: "#22d3ee", ic: "🔥" },
    { id: "genset",  s: genset,  name: "Genset Caterpillar", cap: "1350 kVA", mx: 400, c: "#f97316", ic: "⚡" },
    { id: "boiler5", s: boiler5, name: "Boiler-5",           cap: "18 ton/h", mx: 750, c: "#10b981", ic: "🔥" },
  ];

  /** Branch Y positions as % of diagram height */
  const BY = [18, 40, 62, 84];

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div>
      <section
        className="rounded-2xl overflow-hidden shadow-2xl border transition-colors duration-200"
        style={{
          background: isDark ? "#0c1425" : "#ffffff",
          borderColor: isDark ? "#1e293b" : "#e2e8f0"
        }}
      >
        {/* ═══ HEADER BAR ═══ */}
        <div className="px-8 pt-5 pb-4 flex items-center justify-between">
          <div>
            <h2 className={`text-base font-bold italic tracking-wide transition-colors duration-200 ${isDark ? "text-white" : "text-slate-800"}`}>
              Gas Distribution Network
            </h2>
            <p className={`text-[11px] mt-0.5 transition-colors duration-200 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Live flow schematic – PGN → Utility Plant
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              System Normal
            </span>
            <span className={isDark ? "text-slate-600" : "text-slate-300"}>|</span>
            <span className={`font-mono text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>Update: 1.5s</span>
          </div>
        </div>

        {/* ═══ DIAGRAM AREA ═══ */}
        <div className="relative" style={{ height: 520 }}>
          {/* CSS keyframes for flowing dashes */}
          <style>{`
            @keyframes dfl { to { stroke-dashoffset: -13; } }
            .dfl { animation: dfl 0.8s linear infinite; }
          `}</style>

          {/* ─── SVG PIPELINE LAYER ─── */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Main horizontal pipe: PGN → Distribution Header */}
            <line
              x1="24" y1="50" x2="42" y2="50"
              stroke={totalFlow > 0 ? "#60a5fa" : (isDark ? "#1e293b" : "#cbd5e1")}
              strokeWidth="2"
              strokeDasharray="8 5"
              vectorEffect="non-scaling-stroke"
              className={totalFlow > 0 ? "dfl" : ""}
            />

            {/* Vertical Distribution Header pipe */}
            <line
              x1="42" y1="10" x2="42" y2="90"
              stroke={isDark ? "#1e293b" : "#cbd5e1"}
              strokeWidth="2"
              strokeDasharray="8 5"
              vectorEffect="non-scaling-stroke"
            />

            {/* Branch pipes — one per equipment */}
            {EQ.map((e, i) => (
              <line
                key={e.id}
                x1="42" y1={BY[i]} x2="59" y2={BY[i]}
                stroke={e.s.valveOpen ? e.c : (isDark ? "#1e293b" : "#cbd5e1")}
                strokeWidth="2"
                strokeDasharray="8 5"
                vectorEffect="non-scaling-stroke"
                className={e.s.valveOpen ? "dfl" : ""}
                opacity={e.s.valveOpen ? 0.7 : 0.2}
              />
            ))}
          </svg>

          {/* ─── LABELS ─── */}
          <div
            className={`absolute text-[10px] font-semibold z-10 transition-colors duration-200 ${isDark ? "text-amber-400/80" : "text-amber-600"}`}
            style={{ left: "5%", top: "calc(28% - 18px)" }}
          >
            ⚠ Natural Gas Inlet
          </div>

          <div
            className={`absolute text-[10px] font-medium italic z-10 transition-colors duration-200 ${isDark ? "text-slate-500" : "text-slate-400"}`}
            style={{ left: "42%", top: "3%", transform: "translateX(-50%)" }}
          >
            Distribution Header
          </div>

          {/* ─── PGN SUPPLY CARD ─── */}
          <div
            className="absolute z-10 rounded-xl shadow-lg border border-blue-500/30"
            style={{
              left: "4%",
              top: "28%",
              width: "19%",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            }}
          >
            <div className="p-4">
              <h3 className="text-[13px] font-extrabold text-white uppercase tracking-wider">
                PGN SUPPLY
              </h3>
              <p className="text-[9px] text-blue-200/70 mt-0.5">
                Metering & Regulating Station
              </p>

              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-baseline">
                  <span className="text-blue-200/60">Flow</span>
                  <span className="font-bold text-white font-mono text-[13px]">
                    {totalFlow.toFixed(0)} Nm³/h
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-blue-200/60">Pressure</span>
                  <span className="font-bold text-white font-mono text-[13px]">
                    {pgnPressure} bar
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-blue-200/60">Today</span>
                  <span className="font-bold text-white font-mono text-[13px]">
                    {todayNm3.toLocaleString("id-ID")} Nm³
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── VALVE JUNCTION CIRCLES (clickable) ─── */}
          {EQ.map((e, i) => (
            <button
              key={`valve-${e.id}`}
              onClick={() => toggleValve(e.id)}
              className="absolute z-20 group cursor-pointer"
              title={`Toggle ${e.name} valve`}
              style={{ left: "calc(42% - 11px)", top: `calc(${BY[i]}% - 11px)` }}
            >
              <div
                className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all duration-300 group-hover:scale-125"
                style={{
                  borderColor: e.s.valveOpen ? e.c : (isDark ? "#334155" : "#cbd5e1"),
                  background: e.s.valveOpen ? `${e.c}20` : (isDark ? "transparent" : "#f8fafc"),
                }}
              >
                {e.s.valveOpen && (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: e.c }}
                  />
                )}
              </div>
            </button>
          ))}

          {/* ─── EQUIPMENT CARDS ─── */}
          {EQ.map((e, i) => {
            const load = e.s.valveOpen
              ? Math.min(100, Math.round((e.s.flow / e.mx) * 100))
              : 0;

            return (
              <div
                key={`card-${e.id}`}
                className="absolute z-10"
                style={{
                  left: "60%",
                  right: "4%",
                  top: `calc(${BY[i]}% - 50px)`,
                  height: 100,
                }}
              >
                <div
                  className="w-full h-full rounded-xl p-3.5 hover:brightness-110 dark:hover:brightness-110 transition-all duration-300 shadow-sm border"
                  style={{
                    background: isDark ? "#111827" : "#ffffff",
                    borderColor: isDark ? `${e.c}25` : `${e.c}40`,
                    borderLeftWidth: 3,
                    borderLeftColor: e.c,
                  }}
                >
                  {/* Top: Icon + Name + Capacity */}
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                      style={{ background: `${e.c}15` }}
                    >
                      {e.ic}
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-slate-800"}`}>
                        {e.name}
                      </h4>
                      <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                        Capacity: {e.cap}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Flow value + Load bar */}
                  <div className="flex items-end gap-4">
                    <div className="shrink-0">
                      <span className={`text-[9px] uppercase tracking-wider block ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        Flow:
                      </span>
                      <span
                        className="text-sm font-bold font-mono leading-tight"
                        style={{ color: e.c }}
                      >
                        {e.s.valveOpen
                          ? `${e.s.flow.toFixed(0)} Nm³/h`
                          : "0 Nm³/h"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[9px] uppercase tracking-wider block mb-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        Load:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold font-mono shrink-0 ${isDark ? "text-white" : "text-slate-700"}`}>
                          {load}%
                        </span>
                        <div
                          className="flex-1 h-2.5 rounded-full overflow-hidden"
                          style={{ background: isDark ? "#1e293b" : "#e2e8f0" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${load}%`, background: e.c }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ BOTTOM SUMMARY STRIP ═══ */}
        <div
          className="px-8 py-3.5 flex items-center justify-between border-t transition-colors duration-200"
          style={{
            background: isDark ? "#0d1a2e" : "#f8fafc",
            borderColor: isDark ? "#1e293b" : "#e2e8f0"
          }}
        >
          {EQ.map((e) => (
            <div key={`sum-${e.id}`} className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: e.c }}
              />
              <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                {e.name}
              </span>
              <span className={`text-xs font-bold font-mono ml-1 ${isDark ? "text-white" : "text-slate-800"}`}>
                {e.s.valveOpen ? e.s.flow.toFixed(0) : "0"}
                <span className={`font-normal ml-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>Nm³/h</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
