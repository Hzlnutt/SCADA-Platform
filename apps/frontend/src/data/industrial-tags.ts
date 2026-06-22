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

export const telemetryTagIds = industrialTags.map((tag) => tag.tagId);
