import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  GripVertical,
  Mic,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { AdaptiveTimeSuggestion } from '../lib/adaptiveReminders';
import { formatFriendlyDate, formatMinutesLabel, todayISO } from '../lib/dateUtils';
import type { PlannerTask } from '../types';

type TaskFilter = 'all' | 'today' | 'upcoming' | 'recurring' | 'completed';

interface MyTasksViewProps {
  tasks: PlannerTask[];
  taskSuggestions: Record<string, AdaptiveTimeSuggestion>;
  globalSearch: string;
  onGlobalSearchChange: (q: string) => void;
  onToggleTask: (id: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onReorderTasks: (orderedIds: string[]) => Promise<void>;
  onOpenNewTask: (voice?: boolean) => void;
  onEditTask: (task: PlannerTask) => void;
  onApplyAdaptiveTiming: (
    taskId: string,
    suggestedTime: string,
    suggestedOffsetMinutes: number
  ) => Promise<void>;
}

export const MyTasksView: React.FC<MyTasksViewProps> = ({
  tasks,
  taskSuggestions,
  globalSearch,
  onGlobalSearchChange,
  onToggleTask,
  onDeleteTask,
  onReorderTasks,
  onOpenNewTask,
  onEditTask,
  onApplyAdaptiveTiming,
}) => {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const today = todayISO();

  const filteredTasks = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q) {
        const hay = `${t.title} ${t.notes} ${t.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === 'today') return t.dueDate === today && !t.completed;
      if (filter === 'upcoming') return t.dueDate >= today && !t.completed;
      if (filter === 'recurring') return t.recurrence !== 'none';
      if (filter === 'completed') return t.completed;
      return true;
    });
  }, [tasks, globalSearch, filter, today]);

  const handleDropOn = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const currentIds = tasks.map((t) => t.id);
    const fromIdx = currentIds.indexOf(draggedId);
    const toIdx = currentIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(fromIdx, 1);
    nextIds.splice(toIdx, 0, moved);

    setDraggedId(null);
    setDragOverId(null);
    await onReorderTasks(nextIds);
  };

  const moveStep = async (taskId: string, delta: -1 | 1) => {
    const visibleIds = filteredTasks.map((t) => t.id);
    const visIdx = visibleIds.indexOf(taskId);
    const swapVisIdx = visIdx + delta;
    if (visIdx === -1 || swapVisIdx < 0 || swapVisIdx >= visibleIds.length) return;

    const partnerId = visibleIds[swapVisIdx];
    const fullIds = tasks.map((t) => t.id);
    const idxA = fullIds.indexOf(taskId);
    const idxB = fullIds.indexOf(partnerId);
    if (idxA === -1 || idxB === -1) return;

    const nextIds = [...fullIds];
    [nextIds[idxA], nextIds[idxB]] = [nextIds[idxB], nextIds[idxA]];
    await onReorderTasks(nextIds);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">My Tasks</h2>
          <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
            Search, dictate by voice, set recurring deadlines, and drag rows to prioritize.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onOpenNewTask(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] bg-white dark:bg-[#1B1F1C] text-sm font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824] min-h-[44px]"
          >
            <Mic className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
            <span>Voice Add</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenNewTask(false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3A5A40] text-white text-sm font-medium hover:bg-[#588157] transition-colors min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Search + Segmented Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#5B635E] dark:text-[#9BA39D] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={globalSearch}
            onChange={(e) => onGlobalSearchChange(e.target.value)}
            placeholder="Search tasks, notes, or categories..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] text-sm focus:outline-none focus:ring-2 focus:ring-[#3A5A40]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EFEDE6] dark:bg-[#1E231F] overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'recurring', label: 'Recurring' },
              { id: 'completed', label: 'Completed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                filter === tab.id
                  ? 'bg-white dark:bg-[#2A302C] text-[#1C211E] dark:text-[#F0F2EF] shadow-xs'
                  : 'text-[#5B635E] dark:text-[#9BA39D] hover:text-[#1C211E] dark:hover:text-[#F0F2EF]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task List with Drag & Drop Prioritization */}
      <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
              {globalSearch
                ? `No tasks match "${globalSearch}".`
                : 'No tasks in this view yet.'}
            </p>
            <button
              type="button"
              onClick={() => onOpenNewTask(false)}
              className="px-4 py-2 rounded-xl bg-[#3A5A40] text-white text-xs font-medium hover:bg-[#588157]"
            >
              Create First Task
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#EFEDE6] dark:divide-[#2A302C]">
            {filteredTasks.map((task, idx) => (
              <div
                key={task.id}
                draggable
                onDragStart={() => setDraggedId(task.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(task.id);
                }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={() => handleDropOn(task.id)}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                className={`px-4 sm:px-6 py-4 flex items-start gap-3 transition-colors ${
                  draggedId === task.id
                    ? 'opacity-50'
                    : dragOverId === task.id
                    ? 'bg-[#E9EFE9]/60 dark:bg-[#243227]/60'
                    : 'hover:bg-[#F6F5F0]/70 dark:hover:bg-[#232824]/40'
                }`}
              >
                <div
                  className="hidden sm:flex items-center pt-1 text-[#5B635E] dark:text-[#9BA39D] cursor-grab active:cursor-grabbing"
                  title="Drag to reorder priority"
                >
                  <GripVertical className="w-4 h-4" />
                </div>

                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  aria-label={`Toggle ${task.title}`}
                  className={`mt-0.5 w-6 h-6 min-w-[24px] rounded-lg border flex items-center justify-center transition-colors ${
                    task.completed
                      ? 'bg-[#3A5A40] border-[#3A5A40] text-white'
                      : 'border-[#5B635E]/40 dark:border-[#9BA39D]/40 hover:border-[#3A5A40]'
                  }`}
                >
                  {task.completed && <Check className="w-3.5 h-3.5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      task.completed
                        ? 'line-through text-[#5B635E] dark:text-[#9BA39D]'
                        : ''
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.notes && (
                    <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] mt-0.5">
                      {task.notes}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B635E] dark:text-[#9BA39D] mt-1.5">
                    <span className="capitalize">{task.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatFriendlyDate(task.dueDate)}
                      {task.dueTime ? ` at ${task.dueTime}` : ''}
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
                        ? 'Medium priority'
                        : 'Low priority'}
                    </span>
                    {task.recurrence !== 'none' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">Repeats {task.recurrence}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{formatMinutesLabel(task.reminderOffsetMinutes)}</span>
                  </div>
                  {!task.completed && taskSuggestions[task.id]?.isDifferentFromCurrent && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-[#3A5A40] dark:text-[#74A17B]">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Optimal slot:{' '}
                        <span className="font-mono tabular-nums">
                          {taskSuggestions[task.id].windowLabel}
                        </span>
                        {' · '}
                        Notify {taskSuggestions[task.id].suggestedOffsetMinutes}m prior
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onApplyAdaptiveTiming(
                            task.id,
                            taskSuggestions[task.id].suggestedTime,
                            taskSuggestions[task.id].suggestedOffsetMinutes
                          )
                        }
                        className="px-2 py-0.5 rounded-md bg-[#E9EFE9] dark:bg-[#243227] font-medium hover:opacity-90"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveStep(task.id, -1)}
                    aria-label={`Move ${task.title} up`}
                    className="p-2 rounded-lg text-[#5B635E] hover:bg-[#EFEDE6] dark:hover:bg-[#2A302C] disabled:opacity-30 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === filteredTasks.length - 1}
                    onClick={() => moveStep(task.id, 1)}
                    aria-label={`Move ${task.title} down`}
                    className="p-2 rounded-lg text-[#5B635E] hover:bg-[#EFEDE6] dark:hover:bg-[#2A302C] disabled:opacity-30 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditTask(task)}
                    aria-label={`Edit ${task.title}`}
                    className="p-2 rounded-lg text-[#5B635E] hover:bg-[#EFEDE6] dark:hover:bg-[#2A302C] min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTask(task.id)}
                    aria-label={`Delete ${task.title}`}
                    className="p-2 rounded-lg text-[#B91C1C] dark:text-[#E67676] hover:bg-[#B91C1C]/10 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
