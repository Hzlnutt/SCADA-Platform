import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useConfigStore, type WaterConfig } from "../../store/config.store";

export default function UtilityConfig() {
  const storeWbpRate = useConfigStore((state) => state.wbpRate);
  const storeLwbpRate = useConfigStore((state) => state.lwbpRate);
  const storeWaterConfig = useConfigStore((state) => state.waterConfig);
  const fetchRates = useConfigStore((state) => state.fetchRates);
  const setRates = useConfigStore((state) => state.setRates);

  const [wbpRate, setWbpRate] = useState(storeWbpRate);
  const [lwbpRate, setLwbpRate] = useState(storeLwbpRate);
  const [waterConfig, setWaterConfig] = useState<WaterConfig | null>(null);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  useEffect(() => {
    setWbpRate(storeWbpRate);
    setLwbpRate(storeLwbpRate);
    if (storeWaterConfig) setWaterConfig(storeWaterConfig);
  }, [storeWbpRate, storeLwbpRate, storeWaterConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      await setRates(wbpRate, lwbpRate, waterConfig || undefined);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Config"
        description="Pengaturan parameter manual untuk kalkulasi konsumsi utilitas."
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Electricity Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">
            Parameter Tarif Listrik PLN
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Tarif Beban Puncak (WBP) / kWh
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">Rp</span>
              <input
                type="number"
                step="any"
                value={wbpRate}
                onChange={(e) => setWbpRate(Number(e.target.value))}
                min="0"
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
              />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
              Tarif WBP berlaku untuk penggunaan listrik pada pukul 17:00 - 22:00 WIB.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
              Tarif Luar Beban Puncak (LWBP) / kWh
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">Rp</span>
              <input
                type="number"
                step="any"
                value={lwbpRate}
                onChange={(e) => setLwbpRate(Number(e.target.value))}
                min="0"
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
              />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
              Tarif LWBP berlaku untuk penggunaan listrik di luar jam WBP.
            </span>
          </div>
          </div>
        </div>

        {/* Water Card */}
        {waterConfig && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">
              Parameter Pajak Air Permukaan (PDAM)
            </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Tarif Pajak (%)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={waterConfig.taxRate * 100}
                    onChange={(e) => setWaterConfig(prev => ({ ...prev!, taxRate: Number(e.target.value) / 100 }))}
                    min="0"
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Angka Rasio (AR)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={waterConfig.ar}
                    onChange={(e) => setWaterConfig(prev => ({ ...prev!, ar: Number(e.target.value) }))}
                    min="0"
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Tarif Berjenjang (HDA/m³)
                </label>
                {waterConfig.tiers.map((tier, idx) => (
                  <div key={idx} className="flex gap-4 items-center">
                    <div className="flex-1">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                          Vol {idx === 0 ? "0" : (waterConfig.tiers[idx-1].maxVolume! + 1)} -
                        </span>
                        <input
                          type="number"
                          value={tier.maxVolume || ""}
                          placeholder="Maks (Kosongkan jika >)"
                          onChange={(e) => {
                            const newTiers = [...waterConfig.tiers];
                            newTiers[idx].maxVolume = e.target.value ? Number(e.target.value) : null;
                            setWaterConfig(prev => ({ ...prev!, tiers: newTiers }));
                          }}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-20 pr-4 py-2 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                        />
                      </div>
                    </div>
                    <span className="text-slate-400 text-sm font-bold">=</span>
                    <div className="flex-1">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">Rp</span>
                        <input
                          type="number"
                          value={tier.rate}
                          onChange={(e) => {
                            const newTiers = [...waterConfig.tiers];
                            newTiers[idx].rate = Number(e.target.value);
                            setWaterConfig(prev => ({ ...prev!, tiers: newTiers }));
                          }}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 py-2 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-6 py-3 shadow-md transition-all active:scale-[0.98] ${
                saving ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>

            {success && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-fade-in">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Settings saved successfully!
              </span>
            )}
          </div>
      </form>
    </div>
  );
}
