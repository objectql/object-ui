/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 #8 — the proactive AI usage indicator for the ChatDock header.
 *
 * Two independent meters (`build` + `dataChat`) rendered as small progress rings so
 * the user sees remaining AI headroom BEFORE a send hits the 429 wall, instead of
 * only learning the limit reactively. Data comes from {@link useAiUsage} (the cloud
 * `GET /api/v1/ai/usage` endpoint), which speaks a D5-SAFE fraction — this component
 * NEVER renders a token number, only a ring + qualitative words.
 *
 * Near-full (≥ {@link NEAR_FULL}) a meter turns amber and, on click, the popover
 * shows "running low — resets tonight/next cycle" plus the SAME upgrade / top-up CTA
 * the 429 error banner uses ({@link cloudConsoleUrl}). When usage is unknown
 * (endpoint absent on an older backend, OSS, no seat) the whole indicator renders
 * nothing — a missing endpoint degrades to no widget, never a broken one.
 */
import * as React from 'react';
import { cn, Button, Popover, PopoverTrigger, PopoverContent } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { useAiUsage, type AiMeterUsage } from '../hooks/useAiUsage.js';
import { cloudConsoleUrl } from '../console/marketplace/marketplaceApi.js';

/** Fraction at/above which a meter is "running low" (amber + CTA). */
export const NEAR_FULL = 0.8;

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

type Tone = 'ok' | 'low' | 'full';

function toneFor(fraction: number): Tone {
  if (fraction >= 1) return 'full';
  if (fraction >= NEAR_FULL) return 'low';
  return 'ok';
}

/** A renderable meter: numeric fraction (unmetered/unknown meters are dropped upstream). */
interface RenderableMeter {
  key: 'build' | 'dataChat';
  meter: AiMeterUsage;
  fraction: number;
  tone: Tone;
}

function ringColorClass(tone: Tone): string {
  if (tone === 'full') return 'text-destructive';
  if (tone === 'low') return 'text-amber-500';
  return 'text-primary';
}

/** A small SVG progress ring. Presentational only (aria-hidden) — the button labels it. */
function MeterRing({ fraction, tone, size = 16 }: { fraction: number; tone: Tone; size?: number }) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, fraction));
  const dash = circumference * pct;
  const center = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={ringColorClass(tone)}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx={center} cy={center} r={r} fill="none" strokeWidth={stroke} className="stroke-muted-foreground/25" />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}

export interface AiUsageIndicatorProps {
  /** Resolved AI service base (e.g. `/api/v1/ai`). Falsy → the hook stays inert. */
  apiBase?: string;
  /** Gate rendering (e.g. no AI seat). Default true. */
  enabled?: boolean;
  className?: string;
}

/**
 * The ChatDock-header usage indicator. Renders nothing until it has at least one
 * metered meter to show (fail-soft — see file header).
 */
export function AiUsageIndicator({ apiBase, enabled = true, className }: AiUsageIndicatorProps) {
  const { t } = useObjectTranslation();
  const { usage } = useAiUsage({ apiBase, enabled });

  // "Now", read OUTSIDE render (react-hooks/purity forbids `Date.now()` in the
  // render body — it is non-deterministic and the compiler assumes render can
  // re-run any number of times). `null` until the mount effect measures it —
  // the render body itself never calls `Date.now()`, only reads this state —
  // then refreshed periodically so a long-open popover's "N days/hours" stays
  // roughly current; the countdown is day/hour-grained, so a minute of drift
  // is invisible.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const meters = React.useMemo<RenderableMeter[]>(() => {
    if (!usage) return [];
    const out: RenderableMeter[] = [];
    (['build', 'dataChat'] as const).forEach((key) => {
      const meter = usage.meters[key];
      // Skip unknown (null) and unmetered (usage-based) meters — nothing to ring.
      if (!meter || meter.unmetered || meter.fraction == null) return;
      const fraction = meter.fraction;
      out.push({ key, meter, fraction, tone: toneFor(fraction) });
    });
    return out;
  }, [usage]);

  if (!enabled || meters.length === 0) return null;

  const meterLabel = (key: RenderableMeter['key']): string =>
    key === 'build'
      ? t('console.ai.usage.meterBuild', { defaultValue: 'Build' })
      : t('console.ai.usage.meterAsk', { defaultValue: 'Ask' });

  const statusLabel = (tone: Tone): string => {
    if (tone === 'full') return t('console.ai.usage.statusFull', { defaultValue: 'Limit reached' });
    if (tone === 'low') return t('console.ai.usage.statusLow', { defaultValue: 'Running low' });
    return t('console.ai.usage.statusOk', { defaultValue: 'Plenty left' });
  };

  // `resetKind: 'weekly'` (the free plan's rolling 7-day window, cloud PR #1852):
  // "N days" (or "N hours" inside the final day), derived from `resetsAt` and
  // the `now` state above — PURE given those two inputs, no clock read here.
  // Contract-first (objectui#7371) — `resetsAt` is the ONE source of the reset
  // instant; never re-derive or guess it client-side.
  const weeklyResetLabel = (resetsAt: string, nowMs: number): string => {
    const diffMs = new Date(resetsAt).getTime() - nowMs;
    if (diffMs <= ONE_DAY_MS) {
      const hours = Math.max(1, Math.ceil(diffMs / ONE_HOUR_MS));
      return t('console.ai.usage.resetsWeeklyHours', { count: hours, defaultValue: 'Resets in {{count}} hours' });
    }
    const days = Math.ceil(diffMs / ONE_DAY_MS);
    return t('console.ai.usage.resetsWeeklyDays', { count: days, defaultValue: 'Resets in {{count}} days' });
  };

  // `null` = render nothing for this line — an unrecognized `resetKind` (a
  // future backend value this build doesn't know yet) fails soft instead of
  // crashing or showing stale/wrong copy, a `weekly` meter with no `resetsAt`
  // yet (nothing counted) is never guessed at (objectui#7371), and `now` not
  // yet measured (the one frame before the mount effect above runs) is the
  // same "nothing to show yet" as any other missing input.
  const resetLabel = (meter: AiMeterUsage): string | null => {
    if (meter.resetKind === 'daily') return t('console.ai.usage.resetsDaily', { defaultValue: 'Resets tonight' });
    if (meter.resetKind === 'monthly')
      return t('console.ai.usage.resetsMonthly', { defaultValue: 'Resets next cycle' });
    if (meter.resetKind === 'weekly')
      return meter.resetsAt && now !== null ? weeklyResetLabel(meter.resetsAt, now) : null;
    return null;
  };

  // Worst meter drives the trigger accent + the inline "running low" hint.
  const worst = meters.reduce((a, b) => (b.fraction > a.fraction ? b : a));
  const anyLow = worst.tone !== 'ok';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="ai-usage-indicator"
          className={cn('h-7 gap-1.5 px-1.5 text-muted-foreground hover:text-foreground', className)}
          aria-label={t('console.ai.usage.ariaLabel', {
            defaultValue: 'AI usage: {{status}}',
            status: statusLabel(worst.tone),
          })}
        >
          <span className="flex items-center gap-1">
            {meters.map((m) => (
              <MeterRing key={m.key} fraction={m.fraction} tone={m.tone} />
            ))}
          </span>
          {anyLow ? (
            <span
              className={cn(
                'hidden text-xs font-medium sm:inline',
                worst.tone === 'full' ? 'text-destructive' : 'text-amber-600 dark:text-amber-500',
              )}
            >
              {statusLabel(worst.tone)}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3" data-testid="ai-usage-popover">
        <div className="mb-2 text-xs font-semibold text-foreground/80">
          {t('console.ai.usage.title', { defaultValue: 'AI usage' })}
        </div>
        <ul className="space-y-3">
          {meters.map(({ key, meter, fraction, tone }) => {
            // No upstream cloud named by the runtime ⇒ no control plane to
            // send anyone to, so no CTA (objectui#7253).
            const showCta = tone !== 'ok' && (meter.upgrade || meter.topUp) && !!cloudConsoleUrl();
            const reset = resetLabel(meter);
            return (
              <li key={key} className="flex items-start gap-2.5">
                <MeterRing fraction={fraction} tone={tone} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{meterLabel(key)}</span>
                    <span
                      className={cn(
                        'text-xs',
                        tone === 'full'
                          ? 'text-destructive'
                          : tone === 'low'
                            ? 'text-amber-600 dark:text-amber-500'
                            : 'text-muted-foreground',
                      )}
                    >
                      {statusLabel(tone)}
                    </span>
                  </div>
                  {reset ? <div className="text-xs text-muted-foreground">{reset}</div> : null}
                  {showCta ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto p-0 text-xs"
                      data-testid={`ai-usage-cta-${key}`}
                      onClick={() =>
                        window.open(cloudConsoleUrl(), '_blank', 'noopener,noreferrer')
                      }
                    >
                      {meter.upgrade
                        ? t('console.ai.usage.ctaUpgrade', { defaultValue: 'Upgrade to keep going' })
                        : t('console.ai.usage.ctaTopUp', { defaultValue: 'Add credits to continue' })}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
