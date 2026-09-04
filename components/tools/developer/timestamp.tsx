'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Play, Pause, Copy, Calendar, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react';
import { ToolPanel, CopyButton, ResetButton, PrivacyNotice, StatGrid } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UnixTimestampConverter() {
  const t = useTranslations();
  const [currentSec, setCurrentSec] = React.useState<number>(Math.floor(Date.now() / 1000));
  const [isLive, setIsLive] = React.useState(true);

  // Timestamp -> Date states
  const [inputTs, setInputTs] = React.useState<string>(String(Math.floor(Date.now() / 1000)));
  const [tsUnit, setTsUnit] = React.useState<'seconds' | 'milliseconds'>('seconds');

  // Date -> Timestamp states
  const now = new Date();
  const [dateInput, setDateInput] = React.useState<string>(now.toISOString().slice(0, 19));

  // Ticker
  React.useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setCurrentSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Derived timestamp -> date
  const parsedDate = React.useMemo(() => {
    const num = Number(inputTs.trim());
    if (isNaN(num) || !inputTs.trim()) return null;
    const ms = tsUnit === 'seconds' ? num * 1000 : num;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d;
  }, [inputTs, tsUnit]);

  // Derived date -> timestamp
  const generatedTs = React.useMemo(() => {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return {
      seconds: Math.floor(d.getTime() / 1000),
      milliseconds: d.getTime(),
    };
  }, [dateInput]);

  const setPresetTimestamp = (deltaSeconds: number) => {
    const target = Math.floor(Date.now() / 1000) + deltaSeconds;
    setInputTs(String(target));
    setTsUnit('seconds');
  };

  return (
    <div className="space-y-6">
      {/* Current Unix Timestamp Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/40 bg-primary/5 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Clock className="h-6 w-6" />
          </span>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Unix Timestamp</span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-extrabold tabular-nums text-foreground">{currentSec}</span>
              <span className="text-xs text-muted-foreground">({currentSec * 1000} ms)</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton value={String(currentSec)} label="Copy Seconds" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsLive((v) => !v)}
          >
            {isLive ? <Pause className="me-1.5 h-3.5 w-3.5" /> : <Play className="me-1.5 h-3.5 w-3.5" />}
            {isLive ? 'Pause' : 'Resume'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Timestamp to Date */}
        <ToolPanel title="Convert Timestamp to Date">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Unix Timestamp</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  value={inputTs}
                  onChange={(e) => setInputTs(e.target.value)}
                  placeholder="e.g. 1700000000"
                  className="font-mono"
                />
                <select
                  value={tsUnit}
                  onChange={(e) => setTsUnit(e.target.value as 'seconds' | 'milliseconds')}
                  className="rounded-lg border border-input bg-background px-3 text-xs font-medium"
                >
                  <option value="seconds">Seconds (s)</option>
                  <option value="milliseconds">Milliseconds (ms)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Now', delta: 0 },
                { label: '+1 Hour', delta: 3600 },
                { label: '+1 Day', delta: 86400 },
                { label: '+7 Days', delta: 604800 },
                { label: '+30 Days', delta: 2592000 },
                { label: '+1 Year', delta: 31536000 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPresetTimestamp(p.delta)}
                  className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground hover:bg-accent"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {parsedDate ? (
              <div className="space-y-2.5 rounded-lg border border-border bg-secondary/20 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">ISO 8601</span>
                  <span className="font-mono font-bold text-foreground">{parsedDate.toISOString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                  <span className="text-muted-foreground">UTC / GMT</span>
                  <span className="font-mono text-foreground">{parsedDate.toUTCString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                  <span className="text-muted-foreground">Local Time</span>
                  <span className="font-mono text-foreground">{parsedDate.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-destructive">Please enter a valid numeric timestamp.</p>
            )}
          </div>
        </ToolPanel>

        {/* Date to Timestamp */}
        <ToolPanel title="Convert Date to Timestamp">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Date and Time (Local / ISO)</Label>
              <Input
                type="datetime-local"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="mt-1.5 font-mono"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDateInput(new Date().toISOString().slice(0, 19))}
                className="rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-xs font-medium hover:bg-accent"
              >
                Set to Now
              </button>
            </div>

            {generatedTs ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 p-3">
                  <div>
                    <span className="text-xs text-muted-foreground block">Seconds (Unix Epoch)</span>
                    <span className="font-mono text-lg font-bold text-primary">{generatedTs.seconds}</span>
                  </div>
                  <CopyButton value={String(generatedTs.seconds)} />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 p-3">
                  <div>
                    <span className="text-xs text-muted-foreground block">Milliseconds (JS Timestamp)</span>
                    <span className="font-mono text-base font-bold text-foreground">{generatedTs.milliseconds}</span>
                  </div>
                  <CopyButton value={String(generatedTs.milliseconds)} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-destructive">Please choose a valid date.</p>
            )}
          </div>
        </ToolPanel>
      </div>

      <PrivacyNotice />
    </div>
  );
}
