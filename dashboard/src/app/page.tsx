'use client';

import { useEffect, useState } from 'react';
import { Moon, Heart, Footprints, Utensils, Scale, Timer, Send } from 'lucide-react';
import { DailyLog, Goal, fmtNum, scoreHex } from '@/lib/types';
import { ScoreRing } from '@/components/ScoreRing';
import { MetricCard } from '@/components/MetricCard';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonPage } from '@/components/SkeletonCard';

export default function TodayPage() {
  const [todayData, setTodayData] = useState<DailyLog | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetch(`/api/data?start=${today}&end=${today}`)
      .then((r) => r.json())
      .then((data) => {
        const logs: DailyLog[] = data.dailyLogs || [];
        const entry = logs.find((d: DailyLog) => d.Date === today);
        setTodayData(entry || null);
        setGoals(data.goals || []);

        // Find most recent entry date for "last synced"
        if (logs.length > 0) {
          const mostRecent = logs.sort((a: DailyLog, b: DailyLog) => b.Date.localeCompare(a.Date))[0];
          setLastSync(mostRecent.Date);
        }
      })
      .catch((e) => setError(e.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [today]);

  const formatted = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const syncText = lastSync
    ? lastSync === today
      ? 'Synced today'
      : `Last data: ${new Date(lastSync + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : undefined;

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Today" subtitle={formatted} />
        <SkeletonPage />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Today" subtitle={formatted} />
        <div className="bg-score-red/10 border border-score-red/30 rounded-xl p-4 text-center">
          <p className="text-score-red text-sm">{error}</p>
          <p className="text-brand-muted text-xs mt-1">Check API credentials</p>
        </div>
      </div>
    );
  }

  if (!todayData) {
    return (
      <div className="space-y-4">
        <PageHeader title="Today" subtitle={formatted} />
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Moon size={48} className="text-brand-muted" />
          <p className="text-base text-brand-text">No data for today yet</p>
          <p className="text-sm text-brand-muted">Oura syncs at 10am, 6pm, midnight</p>
          <a
            href="https://t.me/alex_health_tracker_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-2 px-4 py-2.5 bg-brand-accent text-brand-darkest rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
            Open Telegram to sync
          </a>
        </div>
      </div>
    );
  }

  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayGoal = goals.find((g) => g.Weekday === dayOfWeek);

  const hasNutrition = todayData.Calories !== null && todayData.Calories > 0;

  // Macro ratio bar widths
  const totalMacroG = (todayData.Protein_g || 0) + (todayData.Carbs_g || 0) + (todayData.Fats_g || 0);
  const pPct = totalMacroG > 0 ? ((todayData.Protein_g || 0) / totalMacroG) * 100 : 33;
  const cPct = totalMacroG > 0 ? ((todayData.Carbs_g || 0) / totalMacroG) * 100 : 33;
  const fPct = totalMacroG > 0 ? ((todayData.Fats_g || 0) / totalMacroG) * 100 : 34;

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Today"
        subtitle={formatted}
        right={
          syncText ? (
            <span className="text-[11px] text-brand-muted">{syncText}</span>
          ) : undefined
        }
      />

      {/* Score Rings */}
      <div className="flex justify-center gap-6 py-2">
        <ScoreRing score={todayData.Sleep_Score} label="Sleep" />
        <ScoreRing score={todayData.Readiness_Score} label="Readiness" />
        <ScoreRing score={todayData.Activity_Score} label="Activity" />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Sleep Card */}
        {todayData.Total_Sleep_Hours !== null && (
          <MetricCard
            icon={Moon}
            title="Sleep"
            info="7-9 hours is optimal. Deep sleep repairs your body, REM consolidates memory. Aim for 1.5-2h deep, 1.5-2h REM, >85% efficiency."
          >
            <p className="text-3xl font-bold text-brand-text tnum">
              {todayData.Total_Sleep_Hours.toFixed(1)}
              <span className="text-sm font-normal text-brand-muted ml-1">hrs</span>
            </p>
            <p className="text-sm text-brand-muted mt-1 tnum">
              Deep {todayData.Deep_Sleep_Minutes ?? '—'}min
              {' · '}REM {todayData.REM_Sleep_Minutes ?? '—'}min
              {' · '}Eff {todayData.Sleep_Efficiency !== null ? `${todayData.Sleep_Efficiency}%` : '—'}
            </p>
          </MetricCard>
        )}

        {/* Body Card */}
        <MetricCard
          icon={Heart}
          title="Body"
          info="Lower resting HR = better fitness (40-60 is athletic). Higher HRV = better recovery. Temp deviation should be close to 0°."
        >
          <p className="text-3xl font-bold text-brand-text tnum">
            {todayData.Resting_Heart_Rate !== null ? todayData.Resting_Heart_Rate : '—'}
            <span className="text-sm font-normal text-brand-muted ml-1">bpm</span>
          </p>
          <p className="text-sm text-brand-muted mt-1 tnum">
            HRV {todayData.HRV_Balance ?? '—'}
            {todayData.Temperature_Deviation !== null && (
              <> · Temp {todayData.Temperature_Deviation > 0 ? '+' : ''}{todayData.Temperature_Deviation.toFixed(1)}°</>
            )}
          </p>
        </MetricCard>

        {/* Steps Card */}
        <MetricCard
          icon={Footprints}
          title="Steps"
          info="8,000-10,000 steps daily is a good target for overall health."
        >
          <p className="text-3xl font-bold text-brand-text tnum">
            {todayData.Steps !== null ? fmtNum(todayData.Steps) : '—'}
          </p>
          {todayData.Steps !== null && (
            <div className="mt-2">
              <div className="w-full h-1.5 bg-brand-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((todayData.Steps / 10000) * 100, 100)}%`,
                    backgroundColor: todayData.Steps >= 10000 ? '#10B981' : '#08DEDE',
                  }}
                />
              </div>
            </div>
          )}
        </MetricCard>

        {/* Nutrition Card */}
        <MetricCard
          icon={Utensils}
          title="Nutrition"
          info="Track against your MacroFactor targets. Protein supports muscle, carbs fuel activity, fats support hormones."
        >
          {hasNutrition ? (
            <>
              <p className="text-3xl font-bold text-brand-text tnum">
                {fmtNum(todayData.Calories)}
                <span className="text-sm font-normal text-brand-muted ml-1">kcal</span>
              </p>
              {/* Macro ratio bar */}
              <div className="flex h-2 rounded-full overflow-hidden mt-2 gap-0.5">
                <div style={{ width: `${pPct}%`, backgroundColor: '#08DEDE' }} className="rounded-l-full" />
                <div style={{ width: `${cPct}%`, backgroundColor: '#0A7E7E' }} />
                <div style={{ width: `${fPct}%`, backgroundColor: '#1A4A4A' }} className="rounded-r-full" />
              </div>
              <p className="text-xs text-brand-muted mt-1.5 tnum">
                {fmtNum(todayData.Protein_g)}P · {fmtNum(todayData.Carbs_g)}C · {fmtNum(todayData.Fats_g)}F
              </p>
              {todayData.Expenditure !== null && (
                <div className="flex justify-between text-xs mt-2 pt-2 border-t border-brand-border">
                  <span className="text-brand-muted">TDEE {fmtNum(todayData.Expenditure)}</span>
                  <span
                    className="tnum font-medium"
                    style={{
                      color: (todayData.Calories! - todayData.Expenditure) > 0 ? '#EF4444' : '#10B981',
                    }}
                  >
                    {(todayData.Calories! - todayData.Expenditure) > 0 ? '+' : ''}
                    {fmtNum(todayData.Calories! - todayData.Expenditure)} kcal
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-brand-muted text-sm py-2">No nutrition data yet</p>
          )}
        </MetricCard>

        {/* Weight Card */}
        {todayData.Weight_kg !== null && todayData.Weight_kg > 0 && (
          <MetricCard
            icon={Scale}
            title="Weight"
            info="Trend weight smooths daily fluctuations. Focus on the trend, not daily swings."
          >
            <p className="text-3xl font-bold text-brand-text tnum">
              {todayData.Weight_kg.toFixed(1)}
              <span className="text-sm font-normal text-brand-muted ml-1">kg</span>
            </p>
            {todayData.Trend_Weight_kg !== null && (
              <p className="text-sm text-brand-muted mt-1 tnum">
                Trend: {todayData.Trend_Weight_kg.toFixed(1)}kg
              </p>
            )}
          </MetricCard>
        )}

        {/* Nap Card — only if nap > 0 */}
        {todayData.Nap_Minutes !== null && todayData.Nap_Minutes > 0 && (
          <MetricCard
            icon={Timer}
            title="Nap"
            info="Short naps (20-30min) boost alertness. Longer naps may affect nighttime sleep."
          >
            <p className="text-3xl font-bold text-brand-text tnum">
              {todayData.Nap_Minutes}
              <span className="text-sm font-normal text-brand-muted ml-1">min</span>
            </p>
          </MetricCard>
        )}
      </div>
    </div>
  );
}
