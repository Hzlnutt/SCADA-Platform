import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useConfigStore, type WaterConfig, type ElectricityTariff } from "../../store/config.store";

export default function UtilityConfig() {
  const storeWbpRate = useConfigStore((state) => state.wbpRate);
  const storeLwbpRate = useConfigStore((state) => state.lwbpRate);
  const storeWaterConfig = useConfigStore((state) => state.waterConfig);
  const storeElectricityTariffs = useConfigStore((state) => state.electricityTariffs);
  const fetchRates = useConfigStore((state) => state.fetchRates);
  const setRates = useConfigStore((state) => state.setRates);

  const [wbpRate, setWbpRate] = useState(storeWbpRate);
  const [lwbpRate, setLwbpRate] = useState(storeLwbpRate);
  const [waterConfig, setWaterConfig] = useState<WaterConfig | null>(null);
  const [electricityTariffs, setElectricityTariffs] = useState<ElectricityTariff[]>(storeElectricityTariffs);

  // Form states for registering new tariff
  const [newValidFrom, setNewValidFrom] = useState("");
  const [newWbpRate, setNewWbpRate] = useState<number | "">("");
  const [newLwbpRate, setNewLwbpRate] = useState<number | "">("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  useEffect(() => {
    setWbpRate(storeWbpRate);
    setLwbpRate(storeLwbpRate);
    if (storeWaterConfig) setWaterConfig(storeWaterConfig);
    if (storeElectricityTariffs) setElectricityTariffs(storeElectricityTariffs);
  }, [storeWbpRate, storeLwbpRate, storeWaterConfig, storeElectricityTariffs]);

  const handleAddTariff = () => {
    if (!newValidFrom || newWbpRate === "" || newLwbpRate === "") {
      alert("Mohon isi semua input tarif baru.");
      return;
    }
    
    // Check if duplicate month
    const existingIdx = electricityTariffs.findIndex(t => t.validFrom === newValidFrom);
    if (existingIdx > -1) {
      if (confirm(`Tarif untuk bulan ${newValidFrom} sudah ada. Apakah Anda ingin meng-update-nya?`)) {
        const updated = [...electricityTariffs];
        updated[existingIdx] = {
          validFrom: newValidFrom,
          wbpRate: Number(newWbpRate),
          lwbpRate: Number(newLwbpRate)
        };
        setElectricityTariffs(updated);
      }
    } else {
      setElectricityTariffs(prev => [
        ...prev,
        {
          validFrom: newValidFrom,
          wbpRate: Number(newWbpRate),
          lwbpRate: Number(newLwbpRate)
        }
      ]);
    }

    // Reset inputs
    setNewValidFrom("");
    setNewWbpRate("");
    setNewLwbpRate("");
  };

  const handleDeleteTariff = (validFrom: string) => {
    if (electricityTariffs.length <= 1) {
      alert("Harus menyisakan minimal satu tarif di riwayat.");
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus tarif dari bulan ${validFrom}?`)) {
      setElectricityTariffs(prev => prev.filter(t => t.validFrom !== validFrom));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      // Find latest rates for top-level config backward compatibility
      const sorted = [...electricityTariffs].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      const latestWbp = sorted[0]?.wbpRate ?? wbpRate;
      const latestLwbp = sorted[0]?.lwbpRate ?? lwbpRate;
      
      await setRates(latestWbp, latestLwbp, waterConfig || undefined, electricityTariffs);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const formatMonth = (validFrom: string) => {
    const [year, month] = validFrom.split("-");
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
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
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
            Parameter Tarif Listrik PLN (History)
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
            Mencegah penyesuaian tarif listrik baru merusak kalkulasi biaya historis di bulan-bulan sebelumnya.
          </p>

          <div className="space-y-6">
            {/* Table of Tariff History */}
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="p-3">Berlaku Mulai</th>
                    <th className="p-3 text-right">Tarif WBP (Rp/kWh)</th>
                    <th className="p-3 text-right">Tarif LWBP (Rp/kWh)</th>
                    <th className="p-3 text-center w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                  {[...electricityTariffs]
                    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
                    .map((tariff) => (
                      <tr key={tariff.validFrom} className="hover:bg-slate-50/55 dark:hover:bg-slate-800/10">
                        <td className="p-3">{formatMonth(tariff.validFrom)}</td>
                        <td className="p-3 text-right font-mono">Rp {tariff.wbpRate.toLocaleString("id-ID")}</td>
                        <td className="p-3 text-right font-mono">Rp {tariff.lwbpRate.toLocaleString("id-ID")}</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteTariff(tariff.validFrom)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition"
                            title="Hapus dari history"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Registry Form for New Tariff */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Registrasi Tarif Baru
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bulan Mulai</label>
                  <input
                    type="month"
                    value={newValidFrom}
                    onChange={(e) => setNewValidFrom(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tarif WBP (Rp/kWh)</label>
                  <input
                    type="number"
                    placeholder="Contoh: 1600"
                    value={newWbpRate}
                    onChange={(e) => setNewWbpRate(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tarif LWBP (Rp/kWh)</label>
                  <input
                    type="number"
                    placeholder="Contoh: 1112"
                    value={newLwbpRate}
                    onChange={(e) => setNewLwbpRate(e.target.value ? Number(e.target.value) : "")}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddTariff}
                className="w-full md:w-auto rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 shadow transition-all active:scale-[0.98]"
              >
                Tambah Tarif ke History
              </button>
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
