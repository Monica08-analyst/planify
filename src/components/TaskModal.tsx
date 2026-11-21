import React, { useEffect, useMemo, useState } from 'react';
import { Mic, MicOff, Sparkles, X } from 'lucide-react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { suggestOptimalTaskTime } from '../lib/adaptiveReminders';
import { todayISO } from '../lib/dateUtils';
import type {
  DietActivityLog,
  PlannerTask,
  RecurrenceRule,
  TaskCategory,
  TaskPriority,
  UserSettings,
} from '../types';

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  defaultLeadMinutes: number;
  initialTask?: PlannerTask | null;
  autoStartVoice?: boolean;
  tasks?: PlannerTask[];
  dietLogs?: DietActivityLog[];
  settings?: UserSettings;
  onSave: (
    data: Omit<PlannerTask, 'id' | 'ownerId' | 'orderIndex' | 'completed'>,
    usedVoice: boolean
  ) => Promise<void>;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  open,
  onClose,
  defaultLeadMinutes,
  initialTask,
  autoStartVoice = false,
  tasks = [],
  dietLogs = [],
  settings,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<TaskCategory>('work');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(todayISO());
  const [dueTime, setDueTime] = useState('09:00');
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState(defaultLeadMinutes);
  const [recurrence, setRecurrence] = useState<RecurrenceRule>('none');
  const [usedVoice, setUsedVoice] = useState(false);

  const {
    isListening,
    interimText,
    voiceError,
    clearVoiceError,
    startListening,
    stopListening,
  } = useVoiceInput((parsed) => {
    setUsedVoice(true);
    if (parsed.title) {
      setTitle((prev) => (prev.trim() ? `${prev.trim()} ${parsed.title}` : parsed.title));
    }
    if (parsed.priority) setPriority(parsed.priority);
    if (parsed.recurrence) setRecurrence(parsed.recurrence);
  });

  useEffect(() => {
    if (!open) {
      stopListening();
      return;
    }
    if (initialTask) {
      setTitle(initialTask.title);
      setNotes(initialTask.notes);
      setCategory(initialTask.category);
      setPriority(initialTask.priority);
      setDueDate(initialTask.dueDate);
      setDueTime(initialTask.dueTime);
      setReminderOffsetMinutes(initialTask.reminderOffsetMinutes);
      setRecurrence(initialTask.recurrence);
      setUsedVoice(false);
    } else {
      setTitle('');
      setNotes('');
      setCategory('work');
      setPriority('medium');
      setDueDate(todayISO());
      setDueTime('09:00');
      setReminderOffsetMinutes(defaultLeadMinutes);
      setRecurrence('none');
      setUsedVoice(false);
      if (autoStartVoice) {
        startListening();
      }
    }
  }, [open, initialTask, defaultLeadMinutes, autoStartVoice, startListening, stopListening]);

  const adaptiveSuggestion = useMemo(() => {
    if (!open || !settings || settings.adaptiveRemindersEnabled === false) {
      return null;
    }
    return suggestOptimalTaskTime(
      {
        id: initialTask?.id,
        category,
        priority,
        dueTime,
        reminderOffsetMinutes,
      },
      tasks,
      dietLogs,
      settings
    );
  }, [
    open,
    settings,
    initialTask?.id,
    category,
    priority,
    dueTime,
    reminderOffsetMinutes,
    tasks,
    dietLogs,
  ]);

  if (!open) return null;

  const isAlreadyAligned =
    adaptiveSuggestion !== null &&
    dueTime === adaptiveSuggestion.suggestedTime &&
    reminderOffsetMinutes === adaptiveSuggestion.suggestedOffsetMinutes;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSave(
      {
        title: title.trim(),
        notes: notes.trim(),
        category,
        priority,
        dueDate,
        dueTime,
        reminderOffsetMinutes,
        recurrence,
      },
      usedVoice
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {initialTask ? 'Edit Task' : 'New Planner Task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#5B635E] hover:bg-[#EFEDE6] dark:hover:bg-[#232824]"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="task-title" className="text-xs font-medium text-[#5B635E] dark:text-[#9BA39D]">
                Task Title
              </label>
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isListening
                    ? 'bg-[#B91C1C] text-white'
                    : 'bg-[#E9EFE9] dark:bg-[#243227] text-[#3A5A40] dark:text-[#74A17B] hover:opacity-90'
                }`}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isListening ? 'Stop Listening' : 'Voice Capture'}</span>
              </button>
            </div>
            <input
              id="task-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Prepare project brief every weekday"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm focus:outline-none focus:ring-2 focus:ring-[#3A5A40]"
            />
            {isListening && (
              <p className="mt-1.5 text-xs text-[#3A5A40] dark:text-[#74A17B]">
                Listening… {interimText ? `"${interimText}"` : 'Say your task, priority, or "daily / weekly".'}
              </p>
            )}
            {voiceError && (
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-[#B45309] dark:text-[#E39B4D]">
                <span>{voiceError}</span>
                <button type="button" onClick={clearVoiceError} className="underline shrink-0">
                  Dismiss
                </button>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="task-notes" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1.5">
              Notes
            </label>
            <textarea
              id="task-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional checklist details or context"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm focus:outline-none focus:ring-2 focus:ring-[#3A5A40]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-category" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1.5">
                Category
              </label>
              <select
                id="task-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
              >
                <option value="work">Work</option>
                <option value="wellness">Wellness</option>
                <option value="personal">Personal</option>
                <option value="errands">Errands</option>
              </select>
            </div>
            <div>
              <label htmlFor="task-priority" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1.5">
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-date" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1.5">
                Due Date
              </label>
              <input
                id="task-date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="task-time" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1.5">
                Due Time
              </label>
              <input
                id="task-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-recurrence" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1.5">
                Recurring Deadline
              </label>
              <select
                id="task-recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceRule)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
              >
                <option value="none">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays (Mon–Fri)</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label htmlFor="task-reminder" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1.5">
                Custom Reminder
              </label>
              <select
                id="task-reminder"
                value={reminderOffsetMinutes}
                onChange={(e) => setReminderOffsetMinutes(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
              >
                <option value={0}>At due time</option>
                <option value={10}>10 min before</option>
                <option value={15}>15 min before</option>
                <option value={30}>30 min before</option>
                <option value={60}>1 hour before</option>
                <option value={1440}>1 day before</option>
              </select>
            </div>
          </div>

          {adaptiveSuggestion && (
            <div className="rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#3A5A40] dark:text-[#74A17B]">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>{adaptiveSuggestion.windowLabel}</span>
                </div>
                <span className="text-[11px] text-[#5B635E] dark:text-[#9BA39D] font-mono tabular-nums">
                  {adaptiveSuggestion.confidence === 'high'
                    ? 'High confidence'
                    : adaptiveSuggestion.confidence === 'medium'
                    ? 'Medium confidence'
                    : 'Learning rhythm'}
                  {' · '}
                  {adaptiveSuggestion.sampleCount} sample
                  {adaptiveSuggestion.sampleCount === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] leading-relaxed">
                {adaptiveSuggestion.rationale}
              </p>
              <div className="pt-0.5">
                {isAlreadyAligned ? (
                  <span className="text-xs font-medium text-[#3A5A40] dark:text-[#74A17B]">
                    Scheduled inside your optimal reminder window
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDueTime(adaptiveSuggestion.suggestedTime);
                      setReminderOffsetMinutes(adaptiveSuggestion.suggestedOffsetMinutes);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E9EFE9] dark:bg-[#243227] text-[#3A5A40] dark:text-[#74A17B] text-xs font-medium font-mono tabular-nums hover:opacity-90 transition-opacity"
                  >
                    Apply {adaptiveSuggestion.suggestedTime} · {adaptiveSuggestion.suggestedOffsetMinutes}m prior
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#3A5A40] text-white text-sm font-medium hover:bg-[#588157] transition-colors"
            >
              {initialTask ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
