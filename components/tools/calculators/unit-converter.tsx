'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { UNITS, UNIT_CATEGORIES, convertUnit, formatUnitValue, type UnitCategory } from '@/lib/calculators/units';
import { CopyButton, PrivacyNotice, ResetButton, ToggleGroup, ToolPanel } from '../kit';

export default function UnitConverterTool() {
  const t = useTranslations();
  const [category, setCategory] = React.useState<UnitCategory>('length');
  const [source, setSource] = React.useState<{ unit: string; value: string }>({ unit: 'm', value: '1' });

  const units = UNITS[category];

  const switchCategory = (next: UnitCategory) => {
    setCategory(next);
    setSource({ unit: UNITS[next][0].id, value: '1' });
  };

  const valueFor = (unitId: string): string => {
    if (unitId === source.unit) return source.value;
    const numeric = Number(source.value);
    if (source.value === '' || !Number.isFinite(numeric)) return '';
    return formatUnitValue(convertUnit(numeric, source.unit, unitId, category));
  };

  const unitLabel = (id: string) => t(`calc.unit_${category}_${id}` as never);

  return (
    <div className="space-y-5">
      <ToolPanel title={t('calc.category')}>
        <div className="flex flex-wrap gap-2">
          <Select
            value={category}
            onChange={(e) => switchCategory(e.target.value as UnitCategory)}
            options={UNIT_CATEGORIES.map((value) => ({ value, label: t(`calc.unitCat_${value}` as never) }))}
            className="max-w-xs"
          />
          <ResetButton onClick={() => setSource({ unit: units[0].id, value: '1' })} />
        </div>
      </ToolPanel>

      <ToolPanel title={t('calc.allUnits')}>
        <p className="mb-4 text-sm text-muted-foreground">{t('calc.unitHint')}</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => {
            const value = valueFor(unit.id);
            const active = unit.id === source.unit;
            return (
              <li key={unit.id} className="space-y-1.5">
                <label className="flex items-center justify-between text-sm font-medium text-foreground">
                  <span>{unitLabel(unit.id)}</span>
                  <CopyButton value={value} size="icon-sm" variant="ghost" />
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={value}
                  onChange={(e) => setSource({ unit: unit.id, value: e.target.value })}
                  aria-label={unitLabel(unit.id)}
                  className={active ? 'border-primary ring-1 ring-primary/30' : undefined}
                />
              </li>
            );
          })}
        </ul>
      </ToolPanel>

      <ToolPanel title={t('calc.quickSwap')}>
        <ToggleGroup
          value={source.unit}
          onChange={(unit) => {
            const numeric = Number(source.value);
            const converted = Number.isFinite(numeric)
              ? formatUnitValue(convertUnit(numeric, source.unit, unit, category))
              : source.value;
            setSource({ unit, value: converted });
          }}
          options={units.map((u) => ({ value: u.id, label: unitLabel(u.id) }))}
        />
      </ToolPanel>

      <PrivacyNotice />
    </div>
  );
}
