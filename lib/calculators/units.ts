/** Unit conversion tables and helpers — pure arithmetic, no dependencies. */

export type UnitCategory =
  | 'length'
  | 'weight'
  | 'temperature'
  | 'area'
  | 'volume'
  | 'speed'
  | 'time'
  | 'storage';

export interface UnitDef {
  id: string;
  /** Factor relative to the category's base unit. */
  factor: number;
}

/** Base units: metre, gram, m², litre, m/s, second, byte. */
export const UNITS: Record<UnitCategory, UnitDef[]> = {
  length: [
    { id: 'mm', factor: 0.001 },
    { id: 'cm', factor: 0.01 },
    { id: 'm', factor: 1 },
    { id: 'km', factor: 1000 },
    { id: 'in', factor: 0.0254 },
    { id: 'ft', factor: 0.3048 },
    { id: 'yd', factor: 0.9144 },
    { id: 'mi', factor: 1609.344 },
  ],
  weight: [
    { id: 'mg', factor: 0.001 },
    { id: 'g', factor: 1 },
    { id: 'kg', factor: 1000 },
    { id: 't', factor: 1_000_000 },
    { id: 'oz', factor: 28.349523125 },
    { id: 'lb', factor: 453.59237 },
  ],
  temperature: [
    { id: 'c', factor: 1 },
    { id: 'f', factor: 1 },
    { id: 'k', factor: 1 },
  ],
  area: [
    { id: 'cm2', factor: 0.0001 },
    { id: 'm2', factor: 1 },
    { id: 'km2', factor: 1_000_000 },
    { id: 'ha', factor: 10_000 },
    { id: 'acre', factor: 4046.8564224 },
    { id: 'ft2', factor: 0.09290304 },
    { id: 'mi2', factor: 2_589_988.110336 },
  ],
  volume: [
    { id: 'ml', factor: 0.001 },
    { id: 'l', factor: 1 },
    { id: 'm3', factor: 1000 },
    { id: 'gal', factor: 3.785411784 },
    { id: 'pt', factor: 0.473176473 },
    { id: 'cup', factor: 0.2365882365 },
    { id: 'tbsp', factor: 0.01478676478125 },
    { id: 'tsp', factor: 0.00492892159375 },
    { id: 'floz', factor: 0.0295735295625 },
  ],
  speed: [
    { id: 'ms', factor: 1 },
    { id: 'kmh', factor: 1 / 3.6 },
    { id: 'mph', factor: 0.44704 },
    { id: 'kn', factor: 0.514444 },
  ],
  time: [
    { id: 'ms', factor: 0.001 },
    { id: 's', factor: 1 },
    { id: 'min', factor: 60 },
    { id: 'h', factor: 3600 },
    { id: 'day', factor: 86_400 },
    { id: 'week', factor: 604_800 },
    { id: 'month', factor: 2_629_746 }, // average Gregorian month
    { id: 'year', factor: 31_556_952 }, // average Gregorian year
  ],
  storage: [
    { id: 'bit', factor: 0.125 },
    { id: 'byte', factor: 1 },
    { id: 'kb', factor: 1024 },
    { id: 'mb', factor: 1024 ** 2 },
    { id: 'gb', factor: 1024 ** 3 },
    { id: 'tb', factor: 1024 ** 4 },
    { id: 'pb', factor: 1024 ** 5 },
  ],
};

export const UNIT_CATEGORIES = Object.keys(UNITS) as UnitCategory[];

function toCelsius(value: number, unit: string): number {
  if (unit === 'f') return (value - 32) * (5 / 9);
  if (unit === 'k') return value - 273.15;
  return value;
}

function fromCelsius(celsius: number, unit: string): number {
  if (unit === 'f') return celsius * (9 / 5) + 32;
  if (unit === 'k') return celsius + 273.15;
  return celsius;
}

/** Convert between two units of the same category. */
export function convertUnit(
  value: number,
  from: string,
  to: string,
  category: UnitCategory,
): number {
  if (category === 'temperature') return fromCelsius(toCelsius(value, from), to);
  const units = UNITS[category];
  const a = units.find((u) => u.id === from);
  const b = units.find((u) => u.id === to);
  if (!a || !b) return Number.NaN;
  return (value * a.factor) / b.factor;
}

/** Format with sensible significant figures, avoiding float noise. */
export function formatUnitValue(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e15 || abs < 1e-9) return value.toExponential(6);
  const digits = abs >= 1 ? Math.max(0, 10 - Math.floor(Math.log10(abs))) : 10;
  return Number(value.toFixed(Math.min(digits, 12))).toString();
}
