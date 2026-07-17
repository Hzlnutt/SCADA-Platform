import { machineGroups } from "./machines";

export type IndustrialTag = {
  id: string;
  name: string;
  area: string;
  category: string;
  tagId: string;
  unit: string;
  normalMin?: number;
  normalMax?: number;
};

export const industrialTags: IndustrialTag[] = machineGroups.flatMap((group) => {
  return group.units.map((unit) => {
    let normalMin = 0;
    let normalMax = 100;

    if (unit.unit === "m3/h") {
      normalMin = 20;
      normalMax = 60;
    } else if (unit.unit === "bar") {
      if (unit.category === "Steam") {
        if (unit.groupId === "pure-steam-generator") {
          normalMin = 2;
          normalMax = 5;
        } else {
          normalMin = 14;
          normalMax = 20;
        }
      } else if (unit.category === "Air") {
        normalMin = 6;
        normalMax = 8.5;
      }
    } else if (unit.unit === "C") {
      if (unit.area === "HVAC") {
        normalMin = 18;
        normalMax = 26;
      } else if (unit.category === "Cooling") {
        normalMin = 4;
        normalMax = 10;
      } else if (unit.category === "Air") {
        normalMin = 55;
        normalMax = 90;
      }
    } else if (unit.unit === "uS") {
      normalMin = 0;
      normalMax = 1.3;
    }

    return {
      id: unit.id,
      name: unit.name,
      area: unit.area,
      category: unit.category,
      tagId: unit.tagId,
      unit: unit.unit,
      normalMin,
      normalMax
    };
  });
});

const extraTags = [
  "cooling-water/fan_status_1",
  "cooling-water/fan_status_2",
  "cooling-water/fan_status_3",
  "cooling-water/motor_status_1",
  "cooling-water/motor_status_2",
  "cooling-water/motor_status_3",
  "cooling-water/pressure_1",
  "cooling-water/pressure_2",
  "cooling-water/pressure_3",
  "cooling-water/basin_lvl",
  "cooling-water/eq_status_du03",
  "cooling-water/eq_press_du03",
  "cooling-water/eq_status_bp03",
  "cooling-water/eq_press_bp03",
  "cooling-water/eq_status_prep03",
  "cooling-water/eq_press_prep03",
  "cooling-water/eq_status_st03",
  "cooling-water/eq_press_st03",
  "cooling-water/eq_status_washing",
  "cooling-water/eq_press_washing",
  "cooling-water/eq_status_minilab",
  "cooling-water/supply_temp",
  "cooling-water/return_temp",
  "cooling-water/st3_return_temp",
  "cooling-water/eq_temp_du03",
  "cooling-water/eq_temp_prep03",
  "cooling-water/eq_temp_washing",
  "cooling-water/eq_temp_st03_supply",
  "cooling-water/st3_heating",
  "cooling-water/st3_cooling",
  "cooling-water/st3_steril",
  "cooling-water/jumo_pieces"
];

export const telemetryTagIds = [
  ...industrialTags.map((tag) => tag.tagId),
  ...extraTags
];
