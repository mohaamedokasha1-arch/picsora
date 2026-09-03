/**
 * Pure calculator functions. Each takes typed inputs and returns a typed
 * result plus a step-by-step explanation, with no DOM or network access.
 */

export interface Steps {
  steps: string[];
}

/* ------------------------------------------------------------------- age */

export interface AgeResult extends Steps {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalWeeks: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  daysToNextBirthday: number;
  nextBirthday: Date;
  weekday: number;
  zodiac: string;
  chineseZodiac: string;
}

const ZODIAC: { name: string; until: [number, number] }[] = [
  { name: 'capricorn', until: [1, 19] },
  { name: 'aquarius', until: [2, 18] },
  { name: 'pisces', until: [3, 20] },
  { name: 'aries', until: [4, 19] },
  { name: 'taurus', until: [5, 20] },
  { name: 'gemini', until: [6, 20] },
  { name: 'cancer', until: [7, 22] },
  { name: 'leo', until: [8, 22] },
  { name: 'virgo', until: [9, 22] },
  { name: 'libra', until: [10, 22] },
  { name: 'scorpio', until: [11, 21] },
  { name: 'sagittarius', until: [12, 21] },
  { name: 'capricorn', until: [12, 31] },
];

const CHINESE_ZODIAC = [
  'monkey', 'rooster', 'dog', 'pig', 'rat', 'ox',
  'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat',
];

export function zodiacSign(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  for (const sign of ZODIAC) {
    const [m, d] = sign.until;
    if (month < m || (month === m && day <= d)) return sign.name;
  }
  return 'capricorn';
}

export function chineseZodiac(year: number): string {
  return CHINESE_ZODIAC[((year % 12) + 12) % 12];
}

export function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/** Calendar-accurate Y/M/D breakdown between two dates. */
export function diffYMD(from: Date, to: Date): { years: number; months: number; days: number } {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    // Days in the month preceding `to`.
    const prevMonth = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
    days += prevMonth;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

export function calculateAge(birth: Date, asOf: Date): AgeResult {
  const { years, months, days } = diffYMD(birth, asOf);
  const ms = asOf.getTime() - birth.getTime();
  const totalSeconds = Math.floor(ms / 1000);
  const totalDays = Math.floor(ms / 86_400_000);

  // Next birthday (handles Feb 29 by rolling to Mar 1 in non-leap years).
  const makeBirthday = (year: number) => {
    const d = new Date(year, birth.getMonth(), birth.getDate());
    if (d.getMonth() !== birth.getMonth()) d.setDate(0);
    return d;
  };
  let next = makeBirthday(asOf.getFullYear());
  if (next.getTime() <= asOf.getTime()) next = makeBirthday(asOf.getFullYear() + 1);
  const daysToNextBirthday = Math.ceil((next.getTime() - asOf.getTime()) / 86_400_000);

  return {
    years,
    months,
    days,
    totalMonths: years * 12 + months,
    totalWeeks: Math.floor(totalDays / 7),
    totalDays,
    totalHours: Math.floor(ms / 3_600_000),
    totalMinutes: Math.floor(ms / 60_000),
    totalSeconds,
    daysToNextBirthday,
    nextBirthday: next,
    weekday: birth.getDay(),
    zodiac: zodiacSign(birth),
    chineseZodiac: chineseZodiac(birth.getFullYear()),
    steps: [
      `${asOf.toISOString().slice(0, 10)} − ${birth.toISOString().slice(0, 10)}`,
      `= ${years}y ${months}m ${days}d (${totalDays} days total)`,
    ],
  };
}

/* ------------------------------------------------------------------- BMI */

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese1' | 'obese2' | 'obese3';

export interface BmiResult extends Steps {
  bmi: number;
  category: BmiCategory;
  bmiPrime: number;
  ponderalIndex: number;
  healthyMinKg: number;
  healthyMaxKg: number;
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  if (bmi < 35) return 'obese1';
  if (bmi < 40) return 'obese2';
  return 'obese3';
}

/** weightKg / heightM² */
export function calculateBmi(weightKg: number, heightCm: number): BmiResult | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return {
    bmi,
    category: bmiCategory(bmi),
    bmiPrime: bmi / 25,
    ponderalIndex: weightKg / (heightM * heightM * heightM),
    healthyMinKg: 18.5 * heightM * heightM,
    healthyMaxKg: 24.9 * heightM * heightM,
    steps: [
      `${heightCm} cm = ${heightM.toFixed(2)} m`,
      `BMI = ${weightKg} ÷ (${heightM.toFixed(2)})² = ${bmi.toFixed(2)}`,
    ],
  };
}

export const lbsToKg = (lbs: number) => lbs * 0.45359237;
export const kgToLbs = (kg: number) => kg / 0.45359237;
export const inchesToCm = (inches: number) => inches * 2.54;

/* ------------------------------------------------------------ percentage */

export type PercentMode = 'ofValue' | 'isWhatPercent' | 'change' | 'increaseDecrease' | 'original';

export interface PercentResult extends Steps {
  value: number | null;
  /** Set when the maths is undefined (e.g. divide by zero). */
  undefinedReason?: 'divideByZero';
}

export function percentageOf(percent: number, total: number): PercentResult {
  const value = (percent / 100) * total;
  return { value, steps: [`(${percent} ÷ 100) × ${total} = ${round(value)}`] };
}

export function isWhatPercentOf(part: number, total: number): PercentResult {
  if (total === 0) return { value: null, undefinedReason: 'divideByZero', steps: [`${part} ÷ 0 → undefined`] };
  const value = (part / total) * 100;
  return { value, steps: [`(${part} ÷ ${total}) × 100 = ${round(value)}%`] };
}

export function percentChange(from: number, to: number): PercentResult {
  if (from === 0) return { value: null, undefinedReason: 'divideByZero', steps: [`(${to} − 0) ÷ 0 → undefined`] };
  const value = ((to - from) / Math.abs(from)) * 100;
  return { value, steps: [`(${to} − ${from}) ÷ |${from}| × 100 = ${round(value)}%`] };
}

export function applyPercent(base: number, percent: number, direction: 'increase' | 'decrease'): PercentResult {
  const delta = (percent / 100) * base;
  const value = direction === 'increase' ? base + delta : base - delta;
  return {
    value,
    steps: [`${base} ${direction === 'increase' ? '+' : '−'} (${percent}% × ${base} = ${round(delta)}) = ${round(value)}`],
  };
}

export function originalBeforePercent(
  result: number,
  percent: number,
  direction: 'increase' | 'decrease',
): PercentResult {
  const factor = direction === 'increase' ? 1 + percent / 100 : 1 - percent / 100;
  if (factor === 0) return { value: null, undefinedReason: 'divideByZero', steps: ['division by zero'] };
  const value = result / factor;
  return { value, steps: [`${result} ÷ ${round(factor)} = ${round(value)}`] };
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

/* -------------------------------------------------------------- interest */

export interface SimpleInterestResult extends Steps {
  interest: number;
  total: number;
}

export function simpleInterest(principal: number, ratePercent: number, years: number): SimpleInterestResult {
  const interest = (principal * ratePercent * years) / 100;
  return {
    interest,
    total: principal + interest,
    steps: [`I = P × r × t = ${principal} × ${ratePercent / 100} × ${years} = ${round(interest, 2)}`],
  };
}

export type CompoundFrequency = 1 | 2 | 4 | 12 | 365;

export interface CompoundInterestResult extends Steps {
  interest: number;
  total: number;
  effectiveAnnualRate: number;
  yearly: { year: number; balance: number; interest: number }[];
}

export function compoundInterest(
  principal: number,
  annualRatePercent: number,
  years: number,
  frequency: CompoundFrequency,
): CompoundInterestResult {
  const r = annualRatePercent / 100;
  const n = frequency;
  const total = principal * Math.pow(1 + r / n, n * years);
  const yearly: { year: number; balance: number; interest: number }[] = [];
  let previous = principal;
  for (let y = 1; y <= Math.ceil(years); y += 1) {
    const t = Math.min(y, years);
    const balance = principal * Math.pow(1 + r / n, n * t);
    yearly.push({ year: y, balance, interest: balance - previous });
    previous = balance;
  }
  return {
    interest: total - principal,
    total,
    effectiveAnnualRate: (Math.pow(1 + r / n, n) - 1) * 100,
    yearly,
    steps: [
      `A = P(1 + r/n)^(nt)`,
      `A = ${principal}(1 + ${round(r, 6)}/${n})^(${n}×${years}) = ${round(total, 2)}`,
    ],
  };
}

/* --------------------------------------------------------- date difference */

export interface DateDiffResult extends Steps {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalWeeks: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  businessDays: number;
  future: boolean;
}

export function businessDaysBetween(start: Date, end: Date, excluded: string[] = []): number {
  const excludedSet = new Set(excluded);
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const to = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const step = from <= to ? 1 : -1;
  let count = 0;
  const cursor = new Date(from);
  while (step > 0 ? cursor < to : cursor > to) {
    cursor.setDate(cursor.getDate() + step);
    const day = cursor.getDay();
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (day !== 0 && day !== 6 && !excludedSet.has(iso)) count += 1;
  }
  return count;
}

export function dateDifference(start: Date, end: Date, excludedDates: string[] = []): DateDiffResult {
  const future = end.getTime() > Date.now();
  const [from, to] = start <= end ? [start, end] : [end, start];
  const { years, months, days } = diffYMD(from, to);
  const ms = to.getTime() - from.getTime();
  const totalDays = Math.floor(ms / 86_400_000);
  return {
    years,
    months,
    days,
    totalMonths: years * 12 + months,
    totalWeeks: Math.floor(totalDays / 7),
    totalDays,
    totalHours: Math.floor(ms / 3_600_000),
    totalMinutes: Math.floor(ms / 60_000),
    totalSeconds: Math.floor(ms / 1000),
    businessDays: businessDaysBetween(from, to, excludedDates),
    future,
    steps: [`${to.toISOString().slice(0, 10)} − ${from.toISOString().slice(0, 10)} = ${totalDays} days`],
  };
}

/* --------------------------------------------------------------- discount */

export interface DiscountResult extends Steps {
  original: number;
  discountAmount: number;
  afterDiscount: number;
  taxAmount: number;
  finalTotal: number;
  effectivePercent: number;
}

export function stackedDiscount(original: number, percents: number[], taxPercent = 0): DiscountResult {
  let running = original;
  const steps: string[] = [];
  for (const percent of percents) {
    const amount = (running * percent) / 100;
    steps.push(`${round(running, 2)} − ${percent}% (${round(amount, 2)}) = ${round(running - amount, 2)}`);
    running -= amount;
  }
  const taxAmount = (running * taxPercent) / 100;
  if (taxPercent) steps.push(`+ ${taxPercent}% tax = ${round(taxAmount, 2)}`);
  return {
    original,
    discountAmount: original - running,
    afterDiscount: running,
    taxAmount,
    finalTotal: running + taxAmount,
    effectivePercent: original ? ((original - running) / original) * 100 : 0,
    steps,
  };
}

export function discountPercentFromPrices(original: number, discounted: number): number | null {
  if (!(original > 0)) return null;
  return ((original - discounted) / original) * 100;
}

export function originalFromDiscounted(discounted: number, percent: number): number | null {
  const factor = 1 - percent / 100;
  if (factor <= 0) return null;
  return discounted / factor;
}

/* -------------------------------------------------------------------- GPA */

export type GradeScale = '4.0' | '5.0' | 'percentage';

export interface Course {
  name: string;
  grade: string;
  credits: number;
}

export interface GpaResult extends Steps {
  semesterGpa: number;
  cumulativeGpa: number | null;
  totalCredits: number;
  qualityPoints: number;
}

const SCALE_4: Record<string, number> = {
  'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7,
  'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, F: 0,
};
const SCALE_5: Record<string, number> = {
  'A+': 5, A: 5, 'A-': 4.7, 'B+': 4.3, B: 4, 'B-': 3.7,
  'C+': 3.3, C: 3, 'C-': 2.7, 'D+': 2.3, D: 2, 'D-': 1.7, F: 0,
};

/** Percentage → 4.0 points (common US conversion). */
export function percentageToPoints(percent: number, max: number): number {
  if (percent >= 90) return max;
  if (percent >= 80) return max * 0.75;
  if (percent >= 70) return max * 0.5;
  if (percent >= 60) return max * 0.25;
  return 0;
}

export function gradeToPoints(grade: string, scale: GradeScale): number | null {
  const key = grade.trim().toUpperCase();
  if (!key) return null;
  if (scale === 'percentage') {
    const value = Number(key);
    if (!Number.isFinite(value)) return null;
    return percentageToPoints(value, 4);
  }
  const table = scale === '5.0' ? SCALE_5 : SCALE_4;
  if (key in table) return table[key];
  const numeric = Number(key);
  return Number.isFinite(numeric) ? numeric : null;
}

export function calculateGpa(
  courses: Course[],
  scale: GradeScale,
  previous?: { gpa: number; credits: number },
): GpaResult {
  let qualityPoints = 0;
  let totalCredits = 0;
  const steps: string[] = [];
  for (const course of courses) {
    const points = gradeToPoints(course.grade, scale);
    if (points === null || !(course.credits > 0)) continue;
    qualityPoints += points * course.credits;
    totalCredits += course.credits;
    steps.push(`${course.name || '—'}: ${points} × ${course.credits} = ${round(points * course.credits, 2)}`);
  }
  const semesterGpa = totalCredits ? qualityPoints / totalCredits : 0;
  let cumulativeGpa: number | null = null;
  if (previous && previous.credits > 0) {
    cumulativeGpa =
      (qualityPoints + previous.gpa * previous.credits) / (totalCredits + previous.credits);
  }
  steps.push(`GPA = ${round(qualityPoints, 2)} ÷ ${totalCredits} = ${round(semesterGpa, 3)}`);
  return { semesterGpa, cumulativeGpa, totalCredits, qualityPoints, steps };
}

/* -------------------------------------------------------------------- tip */

export interface TipResult extends Steps {
  tipAmount: number;
  total: number;
  perPerson: number;
  tipPerPerson: number;
}

export function calculateTip(bill: number, tipPercent: number, people: number, roundUp: boolean): TipResult {
  const safePeople = Math.max(1, Math.floor(people));
  const tipAmount = (bill * tipPercent) / 100;
  let total = bill + tipAmount;
  let perPerson = total / safePeople;
  if (roundUp) {
    perPerson = Math.ceil(perPerson);
    total = perPerson * safePeople;
  }
  return {
    tipAmount: total - bill,
    total,
    perPerson,
    tipPerPerson: (total - bill) / safePeople,
    steps: [
      `Tip = ${bill} × ${tipPercent}% = ${round(tipAmount, 2)}`,
      `Total = ${round(total, 2)} ÷ ${safePeople} = ${round(perPerson, 2)} per person`,
    ],
  };
}

/** Arabic-Indic numeral rendering for calculator outputs. */
export function toArabicDigits(value: string): string {
  return value.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}
