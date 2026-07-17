import { WaterConfig } from "../store/config.store";

export function calculateWaterCost(monthlyVolume: number, config: WaterConfig): number {
  if (!config || !config.tiers) return 0;
  
  let remainingVolume = monthlyVolume;
  let totalHda = 0;
  let previousMax = 0;

  for (const tier of config.tiers) {
    if (remainingVolume <= 0) break;

    // Calculate how much volume falls into this tier
    const tierSize = tier.maxVolume ? tier.maxVolume - previousMax : Infinity;
    const volumeInTier = Math.min(remainingVolume, tierSize);
    
    totalHda += volumeInTier * tier.rate;
    remainingVolume -= volumeInTier;
    
    if (tier.maxVolume) {
      previousMax = tier.maxVolume;
    }
  }

  // Calculate NPA and Pajak based on bill formula:
  // NPA = Total HDA * AR
  // Cost = NPA * Tax Rate
  const npa = totalHda * config.ar;
  return npa * config.taxRate;
}
