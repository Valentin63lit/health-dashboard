import { getDailyLogs, getGoals, getTodayStr } from '@/lib/sheets';
import { DailyLog, Goal } from '@/lib/types';
import { ScoreCard } from '@/components/ScoreCard';
import { StatusBadge } from '@/components/StatusBadge';
import { MacroBar } from '@/components/MacroBar';
import { StatRow } from '@/components/StatRow';

export const revalidate = 60; // Revalidate every 60 seconds

export default async function TodayPage() {
  let dailyLogs: DailyLog[] = [];
  let goals: Goal[] = [];
  let error: string | null = null;

  try {
    [dailyLogs, goals] = await Promise.all([getDailyLogs(), getGoals()]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load data';
  }

  const today = getTodayStr();
  const todayData = dailyLogs.find((d) => d.Date === today);

  // Get today's targets
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayGoal = goals.find((g) => g.Weekday === dayOfWeek);

  if (error) {
    return (
      <div className="space-y-4">
        <Header date={today} />
        <div className="bg-score-red/10 border border-score-red/30 rounded-xl p-4 text-center">
          <p className="text-score-red text-sm">❌ {error}</p>
          <p className="text-brand-muted text-xs mt-1">Check GOOGLE_SHEET_ID and service account credentials</p>
        </div>
      </div>
    );
  }

  if (!todayData) {
    return (
      <div className="space-y-4">
        <Header date={today} />
        <div className="bg-brand-dark rounded-xl p-6 text-center">
          <p className="text-brand-muted text-sm">No data for today yet.</p>
          <p className="text-brand-muted/60 text-xs mt-2">Oura syncs at 10am, 6pm, midnight (Sofia time)</p>
        </div>
      </div>
    );
  }

  const hasOura = todayData.Sleep_Score !== null;
  const hasNutrition = todayData.Calories !== null && todayData.Calories > 0;
  const hasWeight = todayData.Weight_kg !== null && todayData.Weight_kg > 0;

  return (
    <div className="space-y-4">
      <Header date={today} />

      {/* Status */}
      <StatusBadge hasOura={hasOura} hasNutrition={hasNutrition} hasWeight={hasWeight} />

      {/* Score Cards */}
      <div className="grid grid-cols-3 gap-3">
        <ScoreCard label="Sleep" value={todayData.Sleep_Score} icon="😴" />
        <ScoreCard label="Readiness" value={todayData.Readiness_Score} icon="⚡" />
        <ScoreCard label="Activity" value={todayData.Activity_Score} icon="🏃" />
      </div>

      {/* Sleep Details */}
      {todayData.Total_Sleep_Hours !== null && (
        <div className="bg-brand-dark rounded-xl p-4">
          <h3 className="text-xs text-brand-muted uppercase tracking-wider mb-2 font-medium">Sleep</h3>
          <StatRow icon="🛏️" label="Total Sleep" value={todayData.Total_Sleep_Hours} unit="h" accent />
          <StatRow icon="🫧" label="Deep Sleep" value={todayData.Deep_Sleep_Minutes} unit="min" />
          <StatRow icon="💭" label="REM Sleep" value={todayData.REM_Sleep_Minutes} unit="min" />
          <StatRow icon="📊" label="Efficiency" value={todayData.Sleep_Efficiency !== null ? `${todayData.Sleep_Efficiency}` : null} unit="%" />
          {todayData.Nap_Minutes !== null && todayData.Nap_Minutes > 0 && (
            <StatRow icon="💤" label="Nap" value={todayData.Nap_Minutes} unit="min" />
          )}
        </div>
      )}

      {/* Body Metrics */}
      <div className="bg-brand-dark rounded-xl p-4">
        <h3 className="text-xs text-brand-muted uppercase tracking-wider mb-2 font-medium">Body</h3>
        <StatRow icon="🚶" label="Steps" value={todayData.Steps !== null ? todayData.Steps.toLocaleString() : null} accent />
        <StatRow icon="❤️" label="Resting HR" value={todayData.Resting_Heart_Rate} unit="bpm" />
        <StatRow icon="📈" label="HRV Balance" value={todayData.HRV_Balance} />
        {todayData.Temperature_Deviation !== null && (
          <StatRow
            icon="🌡️"
            label="Temp Deviation"
            value={`${todayData.Temperature_Deviation > 0 ? '+' : ''}${todayData.Temperature_Deviation}`}
            unit="°"
          />
        )}
      </div>

      {/* Nutrition */}
      <div className="bg-brand-dark rounded-xl p-4">
        <h3 className="text-xs text-brand-muted uppercase tracking-wider mb-2 font-medium">Nutrition</h3>

        {hasWeight && (
          <StatRow
            icon="⚖️"
            label="Weight"
            value={todayData.Weight_kg}
            unit="kg"
            accent
            subtitle={todayData.Trend_Weight_kg !== null ? `Trend: ${todayData.Trend_Weight_kg}kg` : undefined}
          />
        )}

        {hasNutrition ? (
          <div className="space-y-3 mt-3">
            <MacroBar label="Calories" value={todayData.Calories} target={todayGoal?.Target_Calories ?? null} unit="kcal" color="bg-brand-accent" />
            <MacroBar label="Protein" value={todayData.Protein_g} target={todayGoal?.Target_Protein_g ?? null} unit="g" color="bg-score-green" />
            <MacroBar label="Carbs" value={todayData.Carbs_g} target={todayGoal?.Target_Carbs_g ?? null} unit="g" color="bg-score-yellow" />
            <MacroBar label="Fats" value={todayData.Fats_g} target={todayGoal?.Target_Fats_g ?? null} unit="g" color="bg-brand-primary" />

            {todayData.Expenditure !== null && (
              <div className="flex justify-between text-xs pt-2 border-t border-brand-primary/20">
                <span className="text-brand-muted">TDEE</span>
                <span className="text-brand-text">{todayData.Expenditure} kcal</span>
              </div>
            )}
            {todayData.Calories !== null && todayData.Expenditure !== null && (
              <div className="flex justify-between text-xs">
                <span className="text-brand-muted">Balance</span>
                <span className={todayData.Calories - todayData.Expenditure > 0 ? 'text-score-red' : 'text-score-green'}>
                  {todayData.Calories - todayData.Expenditure > 0 ? '+' : ''}
                  {todayData.Calories - todayData.Expenditure} kcal
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-brand-muted/60 text-sm text-center py-3">No nutrition data yet</p>
        )}
      </div>
    </div>
  );
}

function Header({ date }: { date: string }) {
  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-brand-white">Today</h1>
        <p className="text-xs text-brand-muted">{formatted}</p>
      </div>
      <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-xs font-bold text-brand-accent">
        CL
      </div>
    </div>
  );
}
