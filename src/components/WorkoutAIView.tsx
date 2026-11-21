import React, { useState } from 'react';
import { CalendarPlus, Check, Dumbbell, Loader2, Sparkles } from 'lucide-react';
import { todayISO } from '../lib/dateUtils';
import type { FitnessLevel, PlannerTask, WorkoutPlan } from '../types';

interface WorkoutAIViewProps {
  workoutPlans: WorkoutPlan[];
  recentSummary: string;
  onSaveWorkoutPlan: (plan: Omit<WorkoutPlan, 'id' | 'ownerId'>) => Promise<WorkoutPlan | undefined>;
  onToggleExercise: (planId: string, exerciseId: string) => Promise<void>;
  onScheduleAsTask: (task: Omit<PlannerTask, 'id' | 'ownerId' | 'orderIndex' | 'completed'>) => Promise<void>;
}

export const WorkoutAIView: React.FC<WorkoutAIViewProps> = ({
  workoutPlans,
  recentSummary,
  onSaveWorkoutPlan,
  onToggleExercise,
  onScheduleAsTask,
}) => {
  const [goal, setGoal] = useState('Balanced core strength & desk posture recovery');
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>('intermediate');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [equipment, setEquipment] = useState('Yoga mat and medium dumbbells');
  const [energyLevel, setEnergyLevel] = useState('steady');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const activePlan = workoutPlans[0] || null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/workout-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          fitnessLevel,
          durationMinutes,
          equipment,
          energyLevel,
          recentSummary,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate workout plan.');
      }

      await onSaveWorkoutPlan({
        title: data.title,
        goal,
        fitnessLevel,
        durationMinutes,
        equipment,
        rationale: data.rationale,
        exercises: data.exercises,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI coach.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">AI Workout Studio</h2>
        <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
          Generate personalized movement sessions adapted to your recent progress, nutrition consistency, and goals.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Generator Form + Studio Imagery */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] overflow-hidden">
          <div className="aspect-[4/3] bg-[#EFEDE6] dark:bg-[#232824]">
            {!imgError ? (
              <img
                src="/src/assets/images/wellness_workout_card_1795259652453.jpg"
                alt="Sunlit home movement studio with sage yoga mat and wooden dumbbells"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-[#5B635E]">
                Movement Studio
              </div>
            )}
          </div>

          <form onSubmit={handleGenerate} className="p-6 space-y-4">
            <div>
              <label htmlFor="wo-goal" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                Training Goal
              </label>
              <input
                id="wo-goal"
                type="text"
                required
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="wo-level" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Fitness Level
                </label>
                <select
                  id="wo-level"
                  value={fitnessLevel}
                  onChange={(e) => setFitnessLevel(e.target.value as FitnessLevel)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label htmlFor="wo-duration" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Duration (min)
                </label>
                <input
                  id="wo-duration"
                  type="number"
                  min={10}
                  max={120}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="wo-equip" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Equipment
                </label>
                <input
                  id="wo-equip"
                  type="text"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
                />
              </div>
              <div>
                <label htmlFor="wo-energy" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Energy Today
                </label>
                <select
                  id="wo-energy"
                  value={energyLevel}
                  onChange={(e) => setEnergyLevel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
                >
                  <option value="low-recovery">Low / Recovery</option>
                  <option value="steady">Steady</option>
                  <option value="high-output">High Output</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-[#B91C1C]/10 border border-[#B91C1C]/30 text-xs text-[#B91C1C] dark:text-[#E67676]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#3A5A40] text-white text-sm font-medium hover:bg-[#588157] disabled:opacity-60 transition-colors min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Personalized Plan…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate AI Workout Plan</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Active Workout Plan & History */}
        <div className="lg:col-span-7 space-y-5">
          {activePlan ? (
            <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] capitalize">
                    {activePlan.fitnessLevel} · {activePlan.durationMinutes} min · {activePlan.equipment}
                  </p>
                  <h3 className="text-xl font-semibold mt-1">{activePlan.title}</h3>
                  <p className="text-sm text-[#5B635E] dark:text-[#9BA39D] mt-1.5 leading-relaxed">
                    {activePlan.rationale}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onScheduleAsTask({
                      title: `Workout: ${activePlan.title}`,
                      notes: `${activePlan.durationMinutes} min · ${activePlan.goal}`,
                      category: 'wellness',
                      priority: 'medium',
                      dueDate: todayISO(),
                      dueTime: '17:30',
                      reminderOffsetMinutes: 30,
                      recurrence: 'none',
                    })
                  }
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-xs font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824] whitespace-nowrap shrink-0"
                >
                  <CalendarPlus className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
                  <span>Add to My Tasks</span>
                </button>
              </div>

              <div className="divide-y divide-[#EFEDE6] dark:divide-[#2A302C]">
                {activePlan.exercises.map((ex) => (
                  <div key={ex.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3.5">
                    <button
                      type="button"
                      onClick={() => onToggleExercise(activePlan.id, ex.id)}
                      aria-label={`Toggle ${ex.name}`}
                      className={`mt-0.5 w-6 h-6 min-w-[24px] rounded-lg border flex items-center justify-center transition-colors ${
                        ex.completed
                          ? 'bg-[#3A5A40] border-[#3A5A40] text-white'
                          : 'border-[#5B635E]/40 dark:border-[#9BA39D]/40'
                      }`}
                    >
                      {ex.completed && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={`text-sm font-medium ${ex.completed ? 'line-through text-[#5B635E]' : ''}`}>
                          {ex.name}
                        </p>
                        <span className="text-xs font-mono tabular-nums text-[#3A5A40] dark:text-[#74A17B]">
                          {ex.sets} × {ex.repsOrDuration} · Rest {ex.restSeconds}s
                        </span>
                      </div>
                      <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1">
                        {ex.formCue}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-10 text-center space-y-3">
              <Dumbbell className="w-8 h-8 text-[#3A5A40] mx-auto" />
              <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
                Generate your first personalized workout session using the studio controls.
              </p>
            </div>
          )}

          {workoutPlans.length > 1 && (
            <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-3">
              <h4 className="text-sm font-semibold">Previous Generated Plans</h4>
              <div className="divide-y divide-[#EFEDE6] dark:divide-[#2A302C]">
                {workoutPlans.slice(1, 5).map((plan) => (
                  <div key={plan.id} className="py-2.5 flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{plan.title}</span>
                    <span className="text-xs font-mono tabular-nums text-[#5B635E] shrink-0">
                      {plan.durationMinutes} min · {plan.exercises.filter((e) => e.completed).length}/{plan.exercises.length} done
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
