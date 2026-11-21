import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  Download,
  FileText,
  Loader2,
  Printer,
  Sparkles,
} from 'lucide-react';
import { getLastNDays, todayISO } from '../lib/dateUtils';
import type {
  AchievementBadge,
  DietActivityLog,
  HabitInsight,
  PlannerTask,
  UserSettings,
} from '../types';

interface ProgressViewProps {
  tasks: PlannerTask[];
  dietLogs: DietActivityLog[];
  badges: AchievementBadge[];
  streakDays: number;
  habitInsights: HabitInsight[];
  settings: UserSettings;
  onSaveHabitInsights: (
    items: Array<Omit<HabitInsight, 'id' | 'ownerId' | 'adopted'>>
  ) => Promise<void>;
  onAdoptHabit: (insightId: string) => Promise<void>;
  onToggleProPreview: () => Promise<void>;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  tasks,
  dietLogs,
  badges,
  streakDays,
  habitInsights,
  settings,
  onSaveHabitInsights,
  onAdoptHabit,
  onToggleProPreview,
}) => {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(7);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const isPro = settings.tierPreview === 'pro';
  const effectiveRange = !isPro && rangeDays > 7 ? 7 : rangeDays;

  const series = useMemo(() => {
    const days = getLastNDays(effectiveRange);
    return days.map((date) => {
      const dayTasks = tasks.filter((t) => t.dueDate === date);
      const completed = dayTasks.filter((t) => t.completed).length;
      const dayMeals = dietLogs.filter((l) => l.date === date && l.entryType === 'meal');
      const dayMoves = dietLogs.filter((l) => l.date === date && l.entryType === 'activity');
      const calories = dayMeals.reduce((sum, l) => sum + l.calories, 0);
      const activeMin = dayMoves.reduce((sum, l) => sum + l.durationMinutes, 0);
      return {
        date,
        label: date.slice(5),
        tasksDone: completed,
        tasksTotal: dayTasks.length,
        calories,
        activeMin,
      };
    });
  }, [effectiveRange, tasks, dietLogs]);

  const totals = useMemo(() => {
    const completed = tasks.filter((t) => t.completed).length;
    const rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    const mealDays = series.filter((s) => s.calories > 0);
    const avgCalories =
      mealDays.length > 0
        ? Math.round(mealDays.reduce((a, b) => a + b.calories, 0) / mealDays.length)
        : 0;
    const avgActiveMin = Math.round(
      series.reduce((a, b) => a + b.activeMin, 0) / Math.max(1, series.length)
    );
    return { completed, rate, avgCalories, avgActiveMin };
  }, [tasks, series]);

  const maxTasks = Math.max(4, ...series.map((s) => Math.max(s.tasksDone, s.tasksTotal)));
  const maxActive = Math.max(45, ...series.map((s) => s.activeMin));

  const handleGenerateHabits = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const categoryCounts: Record<string, number> = {};
      tasks.forEach((t) => {
        categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
      });
      const topCategory =
        Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'work';
      const incompleteCount = tasks.filter((t) => !t.completed).length;

      const response = await fetch('/api/ai/habit-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completionRate: totals.rate,
          activeStreak: streakDays,
          avgCalories: totals.avgCalories,
          avgActiveMinutes: totals.avgActiveMin,
          topCategory,
          missedPatterns: `${incompleteCount} open tasks currently pending`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate habit insights.');
      await onSaveHabitInsights(data.insights || []);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate habit suggestions.');
    } finally {
      setAiLoading(false);
    }
  };

  const exportCSVReport = () => {
    const headers = ['Date', 'Tasks Completed', 'Tasks Total', 'Calories Logged', 'Active Minutes'];
    const rows = series.map((s) =>
      [s.date, s.tasksDone, s.tasksTotal, s.calories, s.activeMin].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verdant-day-progress-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSONReport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      rangeDays: effectiveRange,
      summary: totals,
      streakDays,
      dailySeries: series,
      badgesUnlocked: badges.filter((b) => b.unlocked).map((b) => b.title),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verdant-day-report-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : series[series.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">My Progress &amp; Insights</h2>
          <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
            Interactive consistency trends, achievement milestones, and personalized habit coaching.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EFEDE6] dark:bg-[#1E231F] self-start">
          {([7, 30, 90] as const).map((d) => {
            const locked = !isPro && d > 7;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  if (locked) return;
                  setRangeDays(d);
                }}
                disabled={locked}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium font-mono tabular-nums transition-colors ${
                  effectiveRange === d
                    ? 'bg-white dark:bg-[#2A302C] text-[#1C211E] dark:text-[#F0F2EF]'
                    : 'text-[#5B635E] dark:text-[#9BA39D]'
                } ${locked ? 'opacity-45 cursor-not-allowed' : ''}`}
              >
                {d}D {locked ? '· Pro' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5">
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Completion Rate</p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">{totals.rate}%</p>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1 font-mono tabular-nums">
            {totals.completed} of {tasks.length} tasks
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5">
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Consistency Streak</p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">{streakDays} days</p>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1">Daily engagement</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5">
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Avg Daily Intake</p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">{totals.avgCalories}</p>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1">kcal across logged days</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5">
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Avg Movement</p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">{totals.avgActiveMin} min</p>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1">per day over {effectiveRange}D</p>
        </div>
      </div>

      {/* Interactive Consistency Chart */}
      <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">
              Task &amp; Movement Rhythm ({effectiveRange}-Day View)
            </h3>
            <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">
              Hover or tap any day column to inspect exact output
            </p>
          </div>
          {activePoint && (
            <div className="text-xs font-mono tabular-nums text-[#5B635E] dark:text-[#9BA39D]">
              {activePoint.date} · {activePoint.tasksDone} tasks · {activePoint.activeMin}m movement · {activePoint.calories} kcal
            </div>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <div
            className="min-w-[520px] h-52 flex items-end gap-1.5 pt-6 pb-2 border-b border-[#EFEDE6] dark:border-[#2A302C]"
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {series.map((point, idx) => {
              const taskH = Math.max(6, Math.round((point.tasksDone / maxTasks) * 140));
              const moveH = Math.max(4, Math.round((point.activeMin / maxActive) * 140));
              const isSelected = hoveredIdx === idx;
              return (
                <button
                  key={point.date}
                  type="button"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onFocus={() => setHoveredIdx(idx)}
                  onClick={() => setHoveredIdx(idx)}
                  className={`flex-1 flex flex-col items-center justify-end gap-1.5 h-full rounded-lg px-0.5 transition-colors ${
                    isSelected ? 'bg-[#EFEDE6]/80 dark:bg-[#232824]' : ''
                  }`}
                  aria-label={`${point.date}: ${point.tasksDone} tasks, ${point.activeMin} active minutes`}
                >
                  <div className="w-full flex items-end justify-center gap-1 h-[144px]">
                    <div
                      className="w-2.5 sm:w-3 rounded-t-md bg-[#3A5A40] dark:bg-[#74A17B] transition-all"
                      style={{ height: `${taskH}px` }}
                      title={`Tasks completed: ${point.tasksDone}`}
                    />
                    <div
                      className="w-2.5 sm:w-3 rounded-t-md bg-[#A3B18A] dark:bg-[#4F6D54] transition-all"
                      style={{ height: `${moveH}px` }}
                      title={`Active minutes: ${point.activeMin}`}
                    />
                  </div>
                  {(effectiveRange <= 14 || idx % Math.ceil(effectiveRange / 10) === 0) && (
                    <span className="text-[10px] font-mono tabular-nums text-[#5B635E] dark:text-[#9BA39D]">
                      {point.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs text-[#5B635E] dark:text-[#9BA39D]">
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-[#3A5A40] dark:bg-[#74A17B]" />
            Completed Tasks
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-[#A3B18A] dark:bg-[#4F6D54]" />
            Active Minutes
          </span>
        </div>
      </div>

      {/* Pro Feature: AI Personalized Habit Suggestions + Custom Export Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Personalized Habit Suggestions</h3>
              <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">
                AI pattern analysis grounded in your completion rate, intake, and movement logs
              </p>
            </div>
            {isPro ? (
              <button
                type="button"
                disabled={aiLoading}
                onClick={handleGenerateHabits}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#3A5A40] text-white text-xs font-medium hover:bg-[#588157] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Analyze Patterns</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleProPreview}
                className="px-3.5 py-2 rounded-xl border border-[#3A5A40] text-[#3A5A40] dark:text-[#74A17B] text-xs font-medium"
              >
                Enable Pro Preview
              </button>
            )}
          </div>

          {aiError && (
            <p className="text-xs text-[#B91C1C] dark:text-[#E67676]">{aiError}</p>
          )}

          {!isPro ? (
            <p className="text-sm text-[#5B635E] dark:text-[#9BA39D] py-4">
              Switch to Pro Mode to unlock personalized AI habit coaching derived from your behavioral patterns.
            </p>
          ) : (
            <div className="divide-y divide-[#EFEDE6] dark:divide-[#2A302C]">
              {habitInsights.map((insight) => (
                <div key={insight.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] capitalize">
                        {insight.focusArea}
                      </p>
                      <p className="text-sm font-semibold mt-0.5">{insight.title}</p>
                    </div>
                    <button
                      type="button"
                      disabled={insight.adopted}
                      onClick={() => onAdoptHabit(insight.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 ${
                        insight.adopted
                          ? 'bg-[#E9EFE9] dark:bg-[#243227] text-[#3A5A40] dark:text-[#74A17B]'
                          : 'border border-[#E6E4DC] dark:border-[#2A302C] hover:bg-[#EFEDE6] dark:hover:bg-[#232824]'
                      }`}
                    >
                      {insight.adopted && <Check className="w-3.5 h-3.5" />}
                      <span>{insight.adopted ? 'Added to Tasks' : 'Adopt Daily Habit'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">
                    {insight.patternObservation} {insight.suggestedAction}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom Export Reports */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Custom Export Reports</h3>
            <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-0.5">
              Download structured analytics for spreadsheets, journaling, or coaching reviews.
            </p>
          </div>

          {!isPro ? (
            <button
              type="button"
              onClick={onToggleProPreview}
              className="w-full py-2.5 rounded-xl bg-[#3A5A40] text-white text-xs font-medium"
            >
              Unlock Export Reports (Pro Preview)
            </button>
          ) : (
            <div className="space-y-2.5 no-print">
              <button
                type="button"
                onClick={exportCSVReport}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824] transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
                  Export {effectiveRange}-Day CSV Spreadsheet
                </span>
                <span className="text-xs font-mono text-[#5B635E]">.csv</span>
              </button>
              <button
                type="button"
                onClick={exportJSONReport}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824] transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
                  Export Analytics Summary JSON
                </span>
                <span className="text-xs font-mono text-[#5B635E]">.json</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824] transition-colors"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Printer className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
                  Print / Save PDF Progress Report
                </span>
                <span className="text-xs font-mono text-[#5B635E]">PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Achievement Badges */}
      <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Achievement Badges</h3>
          <span className="text-xs font-mono tabular-nums text-[#5B635E] dark:text-[#9BA39D]">
            {badges.filter((b) => b.unlocked).length} / {badges.length} unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`p-4 rounded-xl border transition-colors ${
                badge.unlocked
                  ? 'border-[#3A5A40]/40 bg-[#E9EFE9]/40 dark:bg-[#243227]/40'
                  : 'border-[#E6E4DC] dark:border-[#2A302C] opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Award
                  className={`w-5 h-5 shrink-0 ${
                    badge.unlocked
                      ? 'text-[#3A5A40] dark:text-[#74A17B]'
                      : 'text-[#5B635E] dark:text-[#9BA39D]'
                  }`}
                />
                <span className="text-xs font-mono tabular-nums text-[#5B635E] dark:text-[#9BA39D]">
                  {badge.progressText}
                </span>
              </div>
              <p className="text-sm font-semibold mt-2.5">{badge.title}</p>
              <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1">
                {badge.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
