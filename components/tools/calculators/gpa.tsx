'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { calculateGpa, type Course, type GradeScale } from '@/lib/calculators';
import {
  CheckboxRow,
  CopyButton,
  Field,
  Notice,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextDownloadButton,
  ToolPanel,
} from '../kit';

const EMPTY: Course = { name: '', grade: '', credits: 3 };

export default function GpaCalculatorTool() {
  const t = useTranslations();
  const [scale, setScale] = React.useState<GradeScale>('4.0');
  const [courses, setCourses] = React.useState<Course[]>([{ ...EMPTY }, { ...EMPTY }, { ...EMPTY }]);
  const [cumulative, setCumulative] = React.useState(false);
  const [prevGpa, setPrevGpa] = React.useState('3.0');
  const [prevCredits, setPrevCredits] = React.useState('30');

  const result = React.useMemo(
    () =>
      calculateGpa(
        courses,
        scale,
        cumulative ? { gpa: Number(prevGpa) || 0, credits: Number(prevCredits) || 0 } : undefined,
      ),
    [courses, scale, cumulative, prevGpa, prevCredits],
  );

  const update = (index: number, patch: Partial<Course>) =>
    setCourses((prev) => prev.map((course, i) => (i === index ? { ...course, ...patch } : course)));

  const exportText = [
    ...courses
      .filter((c) => c.grade)
      .map((c) => `${c.name || '—'}\t${c.grade}\t${c.credits}`),
    `GPA: ${result.semesterGpa.toFixed(3)}`,
    result.cumulativeGpa !== null ? `Cumulative: ${result.cumulativeGpa.toFixed(3)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('calc.courses')}
        actions={
          <>
            <Select
              value={scale}
              onChange={(e) => setScale(e.target.value as GradeScale)}
              options={[
                { value: '4.0', label: t('calc.scale40') },
                { value: '5.0', label: t('calc.scale50') },
                { value: 'percentage', label: t('calc.scalePercent') },
              ]}
              className="w-auto"
            />
            <ResetButton onClick={() => setCourses([{ ...EMPTY }, { ...EMPTY }, { ...EMPTY }])} />
          </>
        }
      >
        <div className="space-y-2">
          <div className="hidden gap-2 px-1 text-xs font-medium uppercase text-muted-foreground sm:grid sm:grid-cols-[1fr_120px_100px_40px]">
            <span>{t('calc.courseName')}</span>
            <span>{t('calc.grade')}</span>
            <span>{t('calc.credits')}</span>
            <span />
          </div>
          {courses.map((course, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px_100px_40px]">
              <Input
                value={course.name}
                onChange={(e) => update(index, { name: e.target.value })}
                placeholder={t('calc.courseNamePlaceholder')}
                aria-label={t('calc.courseName')}
              />
              <Input
                value={course.grade}
                onChange={(e) => update(index, { grade: e.target.value })}
                placeholder={scale === 'percentage' ? '85' : 'A'}
                aria-label={t('calc.grade')}
                dir="ltr"
              />
              <Input
                type="number"
                min={0}
                max={12}
                value={course.credits}
                onChange={(e) => update(index, { credits: Number(e.target.value) })}
                aria-label={t('calc.credits')}
                dir="ltr"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={courses.length <= 1}
                onClick={() => setCourses((prev) => prev.filter((_, i) => i !== index))}
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => setCourses((prev) => [...prev, { ...EMPTY }])}>
            <Plus className="h-3.5 w-3.5" />
            {t('calc.addCourse')}
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          <CheckboxRow checked={cumulative} onChange={setCumulative} label={t('calc.includePrevious')} />
          {cumulative && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('calc.previousGpa')}>
                <Input type="number" step="0.01" value={prevGpa} onChange={(e) => setPrevGpa(e.target.value)} dir="ltr" />
              </Field>
              <Field label={t('calc.previousCredits')}>
                <Input type="number" value={prevCredits} onChange={(e) => setPrevCredits(e.target.value)} dir="ltr" />
              </Field>
            </div>
          )}
        </div>
      </ToolPanel>

      <StatGrid
        columns={3}
        items={[
          { label: t('calc.semesterGpa'), value: result.semesterGpa.toFixed(3), accent: true },
          {
            label: t('calc.cumulativeGpa'),
            value: result.cumulativeGpa !== null ? result.cumulativeGpa.toFixed(3) : '—',
          },
          { label: t('calc.totalCredits'), value: String(result.totalCredits) },
        ]}
      />

      {result.steps.length > 1 && (
        <ToolPanel
          title={t('calc.formulaBreakdown')}
          actions={
            <>
              <CopyButton value={exportText} />
              <TextDownloadButton value={exportText} filename="gpa-report.txt" />
            </>
          }
        >
          <ul className="space-y-1 font-mono text-xs text-muted-foreground" dir="ltr">
            {result.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </ToolPanel>
      )}

      <Notice>{t('calc.gpaHint')}</Notice>
      <PrivacyNotice />
    </div>
  );
}
