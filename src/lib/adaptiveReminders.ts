import type {
  DietActivityLog,
  PlannerTask,
  TaskCategory,
  TaskPriority,
  UserSettings,
} from '../types';

export interface AdaptiveTimeSuggestion {
  taskId?: string;
  suggestedTime: string; // HH:mm
  suggestedOffsetMinutes: number;
  windowLabel: string;
  confidence: 'high' | 'medium' | 'learning';
  sampleCount: number;
  rationale: string;
  isDifferentFromCurrent: boolean;
}

export interface CategoryPeakWindow {
  category: TaskCategory;
  peakTime: string;
  sampleCount: number;
  avgCompletionDelayMinutes: number;
}

const DEFAULT_CATEGORY_MINUTES: Record<TaskCategory, number> = {
  work: 9 * 60 + 15,      // 09:15
  wellness: 13 * 60,      // 13:00
  personal: 18 * 60 + 30, // 18:30
  errands: 16 * 60 + 30,  // 16:30
};

export function parseHHMMToMinutes(hhmm?: string): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export function minutesToHHMM(totalMinutes: number): string {
  const clamped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  // Round to nearest 15 minutes for clean scheduling
  const rounded = Math.round(clamped / 15) * 15;
  const norm = rounded >= 1440 ? 0 : rounded;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isWithinQuietHours(
  minutes: number,
  quietStart?: string,
  quietEnd?: string
): boolean {
  const start = parseHHMMToMinutes(quietStart);
  const end = parseHHMMToMinutes(quietEnd);
  if (start === null || end === null || start === end) return false;
  if (start < end) {
    return minutes >= start && minutes < end;
  }
  // Overnight quiet window (e.g. 22:00 - 07:00)
  return minutes >= start || minutes < end;
}

function clampOutOfQuietHours(
  minutes: number,
  quietStart?: string,
  quietEnd?: string
): number {
  if (!isWithinQuietHours(minutes, quietStart, quietEnd)) return minutes;
  const end = parseHHMMToMinutes(quietEnd);
  if (end === null) return 8 * 60;
  // Schedule 30 minutes after quiet hours end
  return (end + 30) % 1440;
}

function extractCompletedMinutes(completedAt?: string): number | null {
  if (!completedAt) return null;
  const dt = new Date(completedAt);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getHours() * 60 + dt.getMinutes();
}

export function computeCategoryPeakWindows(
  tasks: PlannerTask[],
  dietLogs: DietActivityLog[],
  settings: UserSettings
): Record<TaskCategory, CategoryPeakWindow> {
  const categories: TaskCategory[] = ['work', 'wellness', 'personal', 'errands'];
  const completedTasks = tasks.filter((t) => t.completed && t.completedAt);

  // Activity peak minutes from movement logs (helpful for wellness alignment)
  const activityLogs = dietLogs.filter((l) => l.entryType === 'activity');
  const hasMorningActivity = activityLogs.some((l) =>
    /morning|walk|run/i.test(l.title)
  );

  const result = {} as Record<TaskCategory, CategoryPeakWindow>;

  for (const cat of categories) {
    const catDone = completedTasks.filter((t) => t.category === cat);
    const completionMins: number[] = [];
    const delays: number[] = [];

    for (const t of catDone) {
      const doneMin = extractCompletedMinutes(t.completedAt);
      if (doneMin !== null) {
        completionMins.push(doneMin);
        const dueMin = parseHHMMToMinutes(t.dueTime);
        if (dueMin !== null) {
          delays.push(doneMin - dueMin);
        }
      }
    }

    let rawTarget = DEFAULT_CATEGORY_MINUTES[cat];
    if (cat === 'wellness' && completionMins.length === 0 && hasMorningActivity) {
      rawTarget = 12 * 60 + 30;
    }

    if (completionMins.length > 0) {
      // Weighted blend: 75% historical median/average + 25% baseline prior
      const avgDone =
        completionMins.reduce((a, b) => a + b, 0) / completionMins.length;
      const weight = Math.min(0.85, 0.45 + completionMins.length * 0.12);
      rawTarget = avgDone * weight + rawTarget * (1 - weight);
    }

    const safeTarget = clampOutOfQuietHours(
      rawTarget,
      settings.quietHoursStart,
      settings.quietHoursEnd
    );

    const avgDelay =
      delays.length > 0
        ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
        : 0;

    result[cat] = {
      category: cat,
      peakTime: minutesToHHMM(safeTarget),
      sampleCount: completionMins.length,
      avgCompletionDelayMinutes: avgDelay,
    };
  }

  return result;
}

export function suggestOptimalTaskTime(
  draft: {
    id?: string;
    category: TaskCategory;
    priority: TaskPriority;
    dueTime?: string;
    reminderOffsetMinutes?: number;
  },
  tasks: PlannerTask[],
  dietLogs: DietActivityLog[],
  settings: UserSettings
): AdaptiveTimeSuggestion {
  const peaks = computeCategoryPeakWindows(tasks, dietLogs, settings);
  const peak = peaks[draft.category];
  let suggestedMins = parseHHMMToMinutes(peak.peakTime) ?? DEFAULT_CATEGORY_MINUTES[draft.category];

  // High-priority tasks shift slightly earlier in the user's active window
  if (draft.priority === 'high' && suggestedMins > 9 * 60) {
    suggestedMins = Math.max(8 * 60 + 30, suggestedMins - 30);
  } else if (draft.priority === 'low' && suggestedMins < 16 * 60) {
    suggestedMins = Math.min(18 * 60, suggestedMins + 30);
  }

  // Avoid direct collision with other uncompleted tasks at the exact same slot
  const occupiedMins = new Set(
    tasks
      .filter((t) => !t.completed && t.id !== draft.id && t.dueTime)
      .map((t) => parseHHMMToMinutes(t.dueTime))
      .filter((m): m is number => m !== null)
  );

  let guard = 0;
  while (occupiedMins.has(suggestedMins) && guard < 6) {
    suggestedMins = clampOutOfQuietHours(
      suggestedMins + 30,
      settings.quietHoursStart,
      settings.quietHoursEnd
    );
    guard += 1;
  }

  suggestedMins = clampOutOfQuietHours(
    suggestedMins,
    settings.quietHoursStart,
    settings.quietHoursEnd
  );

  const suggestedTime = minutesToHHMM(suggestedMins);

  // Adaptive reminder lead-time based on historical completion lag + priority
  let suggestedOffset = settings.defaultReminderLeadMinutes || 15;
  if (peak.avgCompletionDelayMinutes > 20 || draft.priority === 'high') {
    suggestedOffset = 30;
  } else if (peak.avgCompletionDelayMinutes < -5 && draft.priority === 'low') {
    suggestedOffset = 10;
  } else {
    suggestedOffset = 15;
  }

  const confidence: AdaptiveTimeSuggestion['confidence'] =
    peak.sampleCount >= 4 ? 'high' : peak.sampleCount >= 2 ? 'medium' : 'learning';

  const currentMins = parseHHMMToMinutes(draft.dueTime);
  const isDifferentFromCurrent =
    currentMins === null || Math.abs(currentMins - suggestedMins) >= 30;

  const windowNameMap: Record<TaskCategory, string> = {
    work: 'Peak Focus Window',
    wellness: 'Energy & Recovery Window',
    personal: 'Evening Personal Window',
    errands: 'Afternoon Transition Window',
  };

  const delayNote =
    peak.avgCompletionDelayMinutes > 15
      ? `You typically wrap ${draft.category} items ~${peak.avgCompletionDelayMinutes}m after scheduled time, so a ${suggestedOffset}m lead alert helps keep momentum.`
      : `A ${suggestedOffset}m prior alert aligns with your steady rhythm.`;

  const rationale =
    peak.sampleCount > 0
      ? `Based on ${peak.sampleCount} completed ${draft.category} task${peak.sampleCount === 1 ? '' : 's'} averaging near ${peak.peakTime}. ${delayNote}`
      : `Learning baseline from your quiet hours (${settings.quietHoursStart || '22:00'}–${settings.quietHoursEnd || '07:00'}) and activity logs. ${delayNote}`;

  return {
    taskId: draft.id,
    suggestedTime,
    suggestedOffsetMinutes: suggestedOffset,
    windowLabel: `${windowNameMap[draft.category]} (${suggestedTime})`,
    confidence,
    sampleCount: peak.sampleCount,
    rationale,
    isDifferentFromCurrent,
  };
}

export function buildPatternSummaryForAI(
  tasks: PlannerTask[],
  dietLogs: DietActivityLog[],
  settings: UserSettings
): string {
  const peaks = computeCategoryPeakWindows(tasks, dietLogs, settings);
  const completed = tasks.filter((t) => t.completed && t.completedAt);
  const activityLogs = dietLogs.filter((l) => l.entryType === 'activity');

  return [
    `Completed tasks analyzed: ${completed.length}`,
    `Quiet hours: ${settings.quietHoursStart || '22:00'} to ${settings.quietHoursEnd || '07:00'}`,
    `Category completion peaks: work=${peaks.work.peakTime} (${peaks.work.sampleCount} samples, avg lag ${peaks.work.avgCompletionDelayMinutes}m), wellness=${peaks.wellness.peakTime} (${peaks.wellness.sampleCount} samples), personal=${peaks.personal.peakTime} (${peaks.personal.sampleCount} samples), errands=${peaks.errands.peakTime} (${peaks.errands.sampleCount} samples)`,
    `Recent logged workouts/activities: ${activityLogs.slice(0, 4).map((a) => `${a.title} (${a.durationMinutes}m, ${a.intensity})`).join('; ') || 'none'}`,
  ].join('\n');
}
