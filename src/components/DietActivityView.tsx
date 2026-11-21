import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Droplets, Flame, Plus, Trash2, Utensils } from 'lucide-react';
import { addDaysISO, formatFriendlyDate, todayISO } from '../lib/dateUtils';
import type { ActivityIntensity, DietActivityLog, MealSlot, UserSettings } from '../types';

interface DietActivityViewProps {
  logs: DietActivityLog[];
  settings: UserSettings;
  onAddLog: (log: Omit<DietActivityLog, 'id' | 'ownerId'>) => Promise<void>;
  onAdjustWater: (date: string, delta: number) => Promise<void>;
  onDeleteLog: (id: string) => Promise<void>;
}

export const DietActivityView: React.FC<DietActivityViewProps> = ({
  logs,
  settings,
  onAddLog,
  onAdjustWater,
  onDeleteLog,
}) => {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [mode, setMode] = useState<'meal' | 'activity'>('meal');

  const [mealSlot, setMealSlot] = useState<MealSlot>('lunch');
  const [title, setTitle] = useState('');
  const [calories, setCalories] = useState('480');
  const [protein, setProtein] = useState('30');
  const [carbs, setCarbs] = useState('45');
  const [fats, setFats] = useState('16');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [intensity, setIntensity] = useState<ActivityIntensity>('moderate');

  const dayLogs = useMemo(
    () => logs.filter((l) => l.date === selectedDate && l.entryType !== 'hydration'),
    [logs, selectedDate]
  );

  const summary = useMemo(() => {
    let intake = 0;
    let burned = 0;
    let p = 0;
    let c = 0;
    let f = 0;
    let activeMin = 0;
    let water = 0;

    logs
      .filter((l) => l.date === selectedDate)
      .forEach((l) => {
        if (l.entryType === 'meal') {
          intake += l.calories;
          p += l.proteinGrams;
          c += l.carbsGrams;
          f += l.fatsGrams;
        } else if (l.entryType === 'activity') {
          burned += l.calories;
          activeMin += l.durationMinutes;
        } else if (l.entryType === 'hydration') {
          water = Math.max(water, l.waterGlasses ?? 0);
        }
      });

    return { intake, burned, net: Math.max(0, intake - burned), p, c, f, activeMin, water };
  }, [logs, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (mode === 'meal') {
      await onAddLog({
        date: selectedDate,
        entryType: 'meal',
        mealSlot,
        title: title.trim(),
        calories: Number(calories) || 0,
        proteinGrams: Number(protein) || 0,
        carbsGrams: Number(carbs) || 0,
        fatsGrams: Number(fats) || 0,
        durationMinutes: 0,
        intensity: 'gentle',
      });
    } else {
      await onAddLog({
        date: selectedDate,
        entryType: 'activity',
        mealSlot: 'movement',
        title: title.trim(),
        calories: Number(calories) || 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatsGrams: 0,
        durationMinutes: Number(durationMinutes) || 0,
        intensity,
      });
    }

    setTitle('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Diet &amp; Activity Log</h2>
          <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
            Track daily nutritional intake, macronutrients, hydration, and movement side by side.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] rounded-xl p-1">
          <button
            type="button"
            onClick={() => setSelectedDate((d) => addDaysISO(d, -1))}
            className="p-2 rounded-lg hover:bg-[#EFEDE6] dark:hover:bg-[#232824]"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 text-xs font-medium font-mono tabular-nums whitespace-nowrap">
            {formatFriendlyDate(selectedDate)} · {selectedDate}
          </span>
          <button
            type="button"
            onClick={() => setSelectedDate((d) => addDaysISO(d, 1))}
            className="p-2 rounded-lg hover:bg-[#EFEDE6] dark:hover:bg-[#232824]"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5 space-y-2">
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Calorie Intake</p>
          <p className="text-2xl font-semibold font-mono tabular-nums">
            {summary.intake} <span className="text-xs font-normal text-[#5B635E]">/ {settings.calorieTarget}</span>
          </p>
          <div className="h-1.5 rounded-full bg-[#EFEDE6] dark:bg-[#2A302C] overflow-hidden">
            <div
              className="h-full bg-[#3A5A40] dark:bg-[#74A17B] rounded-full"
              style={{ width: `${Math.min(100, (summary.intake / settings.calorieTarget) * 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5 space-y-2">
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Macros (P / C / F)</p>
          <p className="text-lg font-semibold font-mono tabular-nums">
            {summary.p}g · {summary.c}g · {summary.f}g
          </p>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] font-mono tabular-nums">
            Goals {settings.proteinTarget} / {settings.carbsTarget} / {settings.fatsTarget}g
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5 space-y-2">
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Activity Output</p>
          <p className="text-2xl font-semibold font-mono tabular-nums">
            {summary.activeMin} min
          </p>
          <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] font-mono tabular-nums">
            {summary.burned} kcal burned · Net {summary.net}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">Hydration</p>
            <Droplets className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums">
            {summary.water} / {settings.waterTargetGlasses}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAdjustWater(selectedDate, -1)}
              className="px-2.5 py-1 rounded-lg border border-[#E6E4DC] dark:border-[#2A302C] text-xs font-medium"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => onAdjustWater(selectedDate, 1)}
              className="px-2.5 py-1 rounded-lg bg-[#3A5A40] text-white text-xs font-medium"
            >
              +1 Glass
            </button>
          </div>
        </div>
      </div>

      {/* Two-Column Entry Form + Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Log Entry</h3>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EFEDE6] dark:bg-[#232824]">
              <button
                type="button"
                onClick={() => setMode('meal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mode === 'meal'
                    ? 'bg-white dark:bg-[#2A302C] text-[#1C211E] dark:text-[#F0F2EF]'
                    : 'text-[#5B635E]'
                }`}
              >
                Meal
              </button>
              <button
                type="button"
                onClick={() => setMode('activity')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mode === 'activity'
                    ? 'bg-white dark:bg-[#2A302C] text-[#1C211E] dark:text-[#F0F2EF]'
                    : 'text-[#5B635E]'
                }`}
              >
                Activity
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="diet-title" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
              {mode === 'meal' ? 'Meal or Snack Description' : 'Activity Name'}
            </label>
            <input
              id="diet-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'meal' ? 'e.g., Salmon poke bowl' : 'e.g., Evening 4K run'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
            />
          </div>

          {mode === 'meal' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="diet-slot" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                    Meal Slot
                  </label>
                  <select
                    id="diet-slot"
                    value={mealSlot}
                    onChange={(e) => setMealSlot(e.target.value as MealSlot)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="diet-cals" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    id="diet-cals"
                    type="number"
                    min={0}
                    max={5000}
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="diet-p" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                    Protein (g)
                  </label>
                  <input
                    id="diet-p"
                    type="number"
                    min={0}
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="diet-c" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                    Carbs (g)
                  </label>
                  <input
                    id="diet-c"
                    type="number"
                    min={0}
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="diet-f" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                    Fats (g)
                  </label>
                  <input
                    id="diet-f"
                    type="number"
                    min={0}
                    value={fats}
                    onChange={(e) => setFats(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="act-dur" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Minutes
                </label>
                <input
                  id="act-dur"
                  type="number"
                  min={1}
                  max={600}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="act-cals" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Burned (kcal)
                </label>
                <input
                  id="act-cals"
                  type="number"
                  min={0}
                  max={3000}
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="act-int" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Intensity
                </label>
                <select
                  id="act-int"
                  value={intensity}
                  onChange={(e) => setIntensity(e.target.value as ActivityIntensity)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
                >
                  <option value="gentle">Gentle</option>
                  <option value="moderate">Moderate</option>
                  <option value="vigorous">Vigorous</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#3A5A40] text-white text-sm font-medium hover:bg-[#588157] transition-colors min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>{mode === 'meal' ? 'Add Meal Log' : 'Add Activity Log'}</span>
          </button>
        </form>

        {/* Daily Ledger */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
          <h3 className="text-base font-semibold">
            {formatFriendlyDate(selectedDate)} Ledger
          </h3>

          {dayLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#5B635E] dark:text-[#9BA39D]">
              No meals or movement logged for {selectedDate} yet.
            </p>
          ) : (
            <div className="divide-y divide-[#EFEDE6] dark:divide-[#2A302C]">
              {dayLogs.map((log) => (
                <div key={log.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] text-[#3A5A40] dark:text-[#74A17B] shrink-0">
                      {log.entryType === 'meal' ? (
                        <Utensils className="w-4 h-4" />
                      ) : (
                        <Flame className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{log.title}</p>
                      <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-0.5 font-mono tabular-nums">
                        {log.entryType === 'meal' ? (
                          <>
                            <span className="capitalize font-sans">{log.mealSlot}</span>
                            {' · '}
                            {log.calories} kcal · P {log.proteinGrams}g · C {log.carbsGrams}g · F {log.fatsGrams}g
                          </>
                        ) : (
                          <>
                            <span className="capitalize font-sans">{log.intensity}</span>
                            {' · '}
                            {log.durationMinutes} min · {log.calories} kcal burned
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteLog(log.id)}
                    aria-label={`Remove ${log.title}`}
                    className="p-2 rounded-lg text-[#5B635E] hover:text-[#B91C1C] hover:bg-[#B91C1C]/10 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
