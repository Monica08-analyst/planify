import React, { useState } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  Droplets,
  Dumbbell,
  Gift,
  Loader2,
  Mic,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { CategoryPeakWindow } from '../lib/adaptiveReminders';
import { daysUntilOccasion, formatFriendlyDate } from '../lib/dateUtils';
import type {
  PlannerTask,
  ReminderNotification,
  SpecialDay,
  TabId,
  TaskCategory,
  UserSettings,
  WorkoutPlan,
} from '../types';

interface HomeDashboardProps {
  dailyScore: number;
  streakDays: number;
  todayCompletionPct: number;
  todayTasks: PlannerTask[];
  allTasks: PlannerTask[];
  todayDietSummary: {
    intakeCalories: number;
    protein: number;
    carbs: number;
    fats: number;
    activeMinutes: number;
    burnedCalories: number;
    waterGlasses: number;
  };
  settings: UserSettings;
  activeReminders: ReminderNotification[];
  categoryPeaks: Record<TaskCategory, CategoryPeakWindow>;
  specialDays: SpecialDay[];
  workoutPlans: WorkoutPlan[];
  onNavigate: (tab: TabId) => void;
  onToggleTask: (id: string) => Promise<void>;
  onOpenNewTask: (voice?: boolean) => void;
  onAdjustWater: (delta: number) => Promise<void>;
  onToggleProPreview: () => Promise<void>;
  onApplyAdaptiveTiming: (
    taskId: string,
    suggestedTime: string,
    suggestedOffsetMinutes: number
  ) => Promise<void>;
  onOptimizeAllReminders: () => Promise<void>;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  dailyScore,
  streakDays,
  todayCompletionPct,
  todayTasks,
  allTasks,
  todayDietSummary,
  settings,
  activeReminders,
  categoryPeaks,
  specialDays,
  workoutPlans,
  onNavigate,
  onToggleTask,
  onOpenNewTask,
  onAdjustWater,
  onToggleProPreview,
  onApplyAdaptiveTiming,
  onOptimizeAllReminders,
}) => {
  const [bannerError, setBannerError] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      await onOptimizeAllReminders();
    } finally {
      setIsOptimizing(false);
    }
  };

  const upcomingTasks = allTasks.filter((t) => !t.completed).slice(0, 5);
  const completedTodayCount = todayTasks.filter((t) => t.completed).length;
  const nextSpecialDay = [...specialDays].sort(
    (a, b) =>
      daysUntilOccasion(a.date, a.repeatsYearly) -
      daysUntilOccasion(b.date, b.repeatsYearly)
  )[0];
  const latestWorkout = workoutPlans[0];

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (dailyScore / 100) * circumference;

  const isFreePreview = settings.tierPreview === 'free';

  return (
    <div className="space-y-6">
      {/* Free Tier Preview Subtle Notice (Ad-free is a Pro highlight) */}
      {isFreePreview && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-[#EFEDE6] dark:bg-[#1E231F] border border-[#E6E4DC] dark:border-[#2A302C]">
          <div className="text-sm">
            <span className="font-medium">Free Tier Preview Active</span>
            <span className="text-[#5B635E] dark:text-[#9BA39D]">
              {' '}
              — Upgrade to Pro for an ad-free studio, multi-device cloud export reports, 90-day trend charts, and AI habit coaching.
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleProPreview}
            className="px-4 py-2 rounded-xl bg-[#3A5A40] text-white text-xs font-medium hover:bg-[#588157] transition-colors whitespace-nowrap shrink-0"
          >
            Switch to Pro Mode
          </button>
        </div>
      )}

      {/* Editorial Studio Header + Progress Ring */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-7 p-6 flex flex-col justify-between gap-5">
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#5B635E] dark:text-[#9BA39D]">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
                {' · '}
                {settings.tierPreview === 'pro' ? 'Pro Studio' : 'Standard Plan'}
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
                Intentional rhythm for your day ahead
              </h2>
              <p className="text-sm text-[#5B635E] dark:text-[#9BA39D] leading-relaxed">
                Keep tasks ordered by priority, fuel steadily, and stay ahead of upcoming milestones.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenNewTask(false)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3A5A40] text-white text-sm font-medium hover:bg-[#588157] transition-colors min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Task</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenNewTask(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824] transition-colors min-h-[44px]"
              >
                <Mic className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
                <span>Voice Capture</span>
              </button>
            </div>
          </div>

          <div className="md:col-span-5 relative min-h-[190px] bg-[#EFEDE6] dark:bg-[#232824]">
            {!bannerError ? (
              <img
                src="/src/assets/images/studio_planner_banner_1795259653511.jpg"
                alt="Calm architectural wellness desk with matcha cup, journal, and fresh eucalyptus"
                referrerPolicy="no-referrer"
                onError={() => setBannerError(true)}
                className="w-full h-full object-cover lg:h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-6 text-xs text-[#5B635E]">
                Verdant Wellness Studio
              </div>
            )}
          </div>
        </div>

        {/* Daily Productivity Progress Ring */}
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Daily Productivity</h3>
              <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-0.5">
                Tasks, fuel &amp; movement index
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('progress')}
              className="text-xs font-medium text-[#3A5A40] dark:text-[#74A17B] hover:underline"
            >
              Details
            </button>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  strokeWidth="8"
                  fill="none"
                  className="stroke-[#EFEDE6] dark:stroke-[#2A302C]"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="stroke-[#3A5A40] dark:stroke-[#74A17B] transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold font-mono tabular-nums">
                  {dailyScore}
                </span>
                <span className="text-[11px] text-[#5B635E] dark:text-[#9BA39D]">score</span>
              </div>
            </div>

            <div className="space-y-2 text-sm flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[#5B635E] dark:text-[#9BA39D]">Tasks today</span>
                <span className="font-mono tabular-nums font-medium">
                  {completedTodayCount}/{todayTasks.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5B635E] dark:text-[#9BA39D]">Completion</span>
                <span className="font-mono tabular-nums font-medium">
                  {todayCompletionPct}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5B635E] dark:text-[#9BA39D]">Active streak</span>
                <span className="font-mono tabular-nums font-medium">
                  {streakDays}d
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Bento KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('tasks')}
          className="text-left rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5 hover:border-[#3A5A40]/50 transition-colors"
        >
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Open Tasks</p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {allTasks.filter((t) => !t.completed).length}
          </p>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1">
            {allTasks.filter((t) => t.recurrence !== 'none').length} recurring
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('diet')}
          className="text-left rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5 hover:border-[#3A5A40]/50 transition-colors"
        >
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Calories Logged</p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {todayDietSummary.intakeCalories}
          </p>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1 font-mono tabular-nums">
            Target {settings.calorieTarget} kcal
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('workout')}
          className="text-left rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5 hover:border-[#3A5A40]/50 transition-colors"
        >
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Daily Movement</p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {todayDietSummary.activeMinutes} min
          </p>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1 font-mono tabular-nums">
            {todayDietSummary.burnedCalories} kcal active
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('gifts')}
          className="text-left rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5 hover:border-[#3A5A40]/50 transition-colors"
        >
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Next Special Day</p>
          <p className="text-2xl font-semibold font-mono tabular-nums mt-1">
            {nextSpecialDay
              ? `${daysUntilOccasion(nextSpecialDay.date, nextSpecialDay.repeatsYearly)}d`
              : 'None'}
          </p>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1 truncate">
            {nextSpecialDay ? nextSpecialDay.personOrEvent : 'Add an occasion'}
          </p>
        </button>
      </section>

      {/* Main Bento Grid: Upcoming Tasks + Reminders + Wellness & Gifting */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Upcoming Tasks */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Upcoming Tasks</h3>
              <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">
                Ordered by your priority stack
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#3A5A40] dark:text-[#74A17B] hover:underline"
            >
              <span>Manage all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {upcomingTasks.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
                All scheduled tasks are complete.
              </p>
              <button
                type="button"
                onClick={() => onOpenNewTask(false)}
                className="px-4 py-2 rounded-xl bg-[#3A5A40] text-white text-xs font-medium hover:bg-[#588157]"
              >
                Plan Next Task
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#EFEDE6] dark:divide-[#2A302C]">
              {upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3.5"
                >
                  <button
                    type="button"
                    onClick={() => onToggleTask(task.id)}
                    aria-label={`Mark ${task.title} complete`}
                    className="mt-0.5 w-6 h-6 min-w-[24px] rounded-lg border border-[#5B635E]/40 dark:border-[#9BA39D]/40 flex items-center justify-center hover:border-[#3A5A40] transition-colors"
                  >
                    {task.completed && <Check className="w-3.5 h-3.5 text-[#3A5A40]" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{task.title}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1">
                      <span className="capitalize">{task.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatFriendlyDate(task.dueDate)}
                        {task.dueTime ? ` ${task.dueTime}` : ''}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          task.priority === 'high'
                            ? 'text-[#B91C1C] dark:text-[#E67676] font-medium'
                            : task.priority === 'medium'
                            ? 'text-[#B45309] dark:text-[#E39B4D]'
                            : ''
                        }
                      >
                        {task.priority === 'high'
                          ? 'High priority'
                          : task.priority === 'medium'
                          ? 'Medium'
                          : 'Low'}
                      </span>
                      {task.recurrence !== 'none' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{task.recurrence}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reminders & Quick Wellness Column */}
        <div className="lg:col-span-5 space-y-5">
          {/* Reminders Panel */}
          <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
                <h3 className="text-base font-semibold">Custom Reminders</h3>
              </div>
              <div className="flex items-center gap-3">
                {settings.adaptiveRemindersEnabled !== false && (
                  <button
                    type="button"
                    disabled={isOptimizing}
                    onClick={handleOptimize}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#3A5A40] dark:text-[#74A17B] hover:underline disabled:opacity-50"
                  >
                    {isOptimizing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{isOptimizing ? 'Optimizing…' : 'Optimize'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="text-xs text-[#5B635E] dark:text-[#9BA39D] hover:underline"
                >
                  Configure
                </button>
              </div>
            </div>

            {settings.adaptiveRemindersEnabled !== false && (
              <p className="text-[11px] text-[#5B635E] dark:text-[#9BA39D] font-mono tabular-nums">
                Peak windows: Work {categoryPeaks.work.peakTime} · Wellness {categoryPeaks.wellness.peakTime} · Personal {categoryPeaks.personal.peakTime}
              </p>
            )}

            {activeReminders.length === 0 ? (
              <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
                No immediate reminders queued.
              </p>
            ) : (
              <div className="divide-y divide-[#EFEDE6] dark:divide-[#2A302C]">
                {activeReminders.slice(0, 4).map((rem) => (
                  <div key={rem.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{rem.title}</p>
                        <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-0.5">
                          {rem.detail}
                        </p>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-[#3A5A40] dark:text-[#74A17B] shrink-0">
                        {rem.timeLabel}
                      </span>
                    </div>

                    {rem.canOptimize && rem.taskId && rem.suggestedTime && (
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <p className="text-[11px] text-[#5B635E] dark:text-[#9BA39D] truncate">
                          {rem.adaptiveReason}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            onApplyAdaptiveTiming(
                              rem.taskId!,
                              rem.suggestedTime!,
                              rem.suggestedOffsetMinutes ?? 15
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#E9EFE9] dark:bg-[#243227] text-[#3A5A40] dark:text-[#74A17B] text-[11px] font-medium font-mono tabular-nums whitespace-nowrap shrink-0 hover:opacity-90"
                        >
                          Use {rem.suggestedTime}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Hydration & Nutrition Strip */}
          <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Fuel &amp; Hydration</h3>
                <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] font-mono tabular-nums mt-0.5">
                  P {todayDietSummary.protein}g · C {todayDietSummary.carbs}g · F {todayDietSummary.fats}g
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAdjustWater(1)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#E9EFE9] dark:bg-[#243227] text-[#3A5A40] dark:text-[#74A17B] text-xs font-medium hover:opacity-90 min-h-[40px]"
              >
                <Droplets className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">
                  {todayDietSummary.waterGlasses}/{settings.waterTargetGlasses} +1
                </span>
              </button>
            </div>

            <div className="w-full h-2 rounded-full bg-[#EFEDE6] dark:bg-[#2A302C] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#3A5A40] dark:bg-[#74A17B] transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((todayDietSummary.intakeCalories / settings.calorieTarget) * 100)
                  )}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#5B635E] dark:text-[#9BA39D]">
              <span className="font-mono tabular-nums">
                {todayDietSummary.intakeCalories} / {settings.calorieTarget} kcal
              </span>
              <button
                type="button"
                onClick={() => onNavigate('diet')}
                className="text-[#3A5A40] dark:text-[#74A17B] font-medium hover:underline"
              >
                Log meal or activity
              </button>
            </div>
          </div>

          {/* Quick Actions: AI Workout + Gifting */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => onNavigate('workout')}
              className="text-left rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5 space-y-2 hover:border-[#3A5A40]/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <Dumbbell className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
                <Sparkles className="w-3.5 h-3.5 text-[#5B635E]" />
              </div>
              <p className="text-sm font-semibold">AI Workout Plan</p>
              <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] truncate">
                {latestWorkout ? latestWorkout.title : 'Generate personalized session'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('gifts')}
              className="text-left rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5 space-y-2 hover:border-[#3A5A40]/50 transition-colors"
            >
              <Gift className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
              <p className="text-sm font-semibold">Special Days</p>
              <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] truncate">
                {specialDays.length} tracked occasion{specialDays.length === 1 ? '' : 's'}
              </p>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
