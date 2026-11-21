import React, { useMemo, useState } from 'react';
import { Bell, Check, Gift, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { daysUntilOccasion, todayISO } from '../lib/dateUtils';
import type { GiftIdea, OccasionType, SpecialDay } from '../types';

interface SpecialDaysViewProps {
  specialDays: SpecialDay[];
  onAddSpecialDay: (day: Omit<SpecialDay, 'id' | 'ownerId'>) => Promise<void>;
  onUpdateSpecialDay: (id: string, patch: Partial<SpecialDay>) => Promise<void>;
  onDeleteSpecialDay: (id: string) => Promise<void>;
}

export const SpecialDaysView: React.FC<SpecialDaysViewProps> = ({
  specialDays,
  onAddSpecialDay,
  onUpdateSpecialDay,
  onDeleteSpecialDay,
}) => {
  const [personOrEvent, setPersonOrEvent] = useState('');
  const [occasionType, setOccasionType] = useState<OccasionType>('birthday');
  const [date, setDate] = useState(todayISO());
  const [repeatsYearly, setRepeatsYearly] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(3);
  const [customReminderTime, setCustomReminderTime] = useState('09:00');
  const [budget, setBudget] = useState('80');
  const [imgError, setImgError] = useState(false);

  const [newGiftTitleByDay, setNewGiftTitleByDay] = useState<Record<string, string>>({});
  const [newGiftPriceByDay, setNewGiftPriceByDay] = useState<Record<string, string>>({});
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const sortedDays = useMemo(() => {
    return [...specialDays].sort(
      (a, b) =>
        daysUntilOccasion(a.date, a.repeatsYearly) -
        daysUntilOccasion(b.date, b.repeatsYearly)
    );
  }, [specialDays]);

  const handleAddDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personOrEvent.trim()) return;
    await onAddSpecialDay({
      personOrEvent: personOrEvent.trim(),
      occasionType,
      date,
      repeatsYearly,
      reminderDaysBefore,
      customReminderTime,
      budget: Number(budget) || 0,
      giftIdeas: [],
    });
    setPersonOrEvent('');
  };

  const handleAddGiftIdea = async (day: SpecialDay) => {
    const title = (newGiftTitleByDay[day.id] || '').trim();
    if (!title) return;
    const price = Number(newGiftPriceByDay[day.id] || 0) || 0;
    const nextIdeas: GiftIdea[] = [
      ...day.giftIdeas,
      {
        id: `gift-${Date.now()}`,
        title: title.slice(0, 120),
        estimatedPrice: price,
        purchased: false,
        notes: '',
      },
    ];
    await onUpdateSpecialDay(day.id, { giftIdeas: nextIdeas });
    setNewGiftTitleByDay((prev) => ({ ...prev, [day.id]: '' }));
    setNewGiftPriceByDay((prev) => ({ ...prev, [day.id]: '' }));
  };

  const handleToggleGiftPurchased = async (day: SpecialDay, giftId: string) => {
    const nextIdeas = day.giftIdeas.map((g) =>
      g.id === giftId ? { ...g, purchased: !g.purchased } : g
    );
    await onUpdateSpecialDay(day.id, { giftIdeas: nextIdeas });
  };

  const handleBrainstormGifts = async (day: SpecialDay) => {
    setAiLoadingId(day.id);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/gift-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personOrEvent: day.personOrEvent,
          occasionType: day.occasionType,
          budget: day.budget,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not suggest gift ideas.');

      const additions: GiftIdea[] = (data.ideas || []).map(
        (item: { title: string; estimatedPrice: number; notes: string }, idx: number) => ({
          id: `gift-ai-${Date.now()}-${idx}`,
          title: item.title,
          estimatedPrice: item.estimatedPrice,
          purchased: false,
          notes: item.notes,
        })
      );

      await onUpdateSpecialDay(day.id, {
        giftIdeas: [...day.giftIdeas, ...additions].slice(0, 20),
      });
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Unable to fetch gift suggestions.');
    } finally {
      setAiLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Special Days &amp; Gifting</h2>
        <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
          Remember birthdays, anniversaries, and milestones with gift ideas, budgets, and custom reminder notifications.
        </p>
      </div>

      {aiError && (
        <div className="p-3.5 rounded-xl bg-[#B91C1C]/10 border border-[#B91C1C]/30 text-xs text-[#B91C1C] dark:text-[#E67676]">
          {aiError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Add Special Day Form + Editorial Accent */}
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] overflow-hidden">
          <div className="aspect-[4/3] bg-[#EFEDE6] dark:bg-[#232824]">
            {!imgError ? (
              <img
                src="/src/assets/images/gifting_atelier_card_1795259652949.jpg"
                alt="Linen wrapped gifts tied with olive sage ribbon on travertine stone"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-[#5B635E]">
                Gifting Atelier
              </div>
            )}
          </div>

          <form onSubmit={handleAddDay} className="p-6 space-y-4">
            <h3 className="text-base font-semibold">Add Occasion</h3>
            <div>
              <label htmlFor="sd-title" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                Person or Occasion
              </label>
              <input
                id="sd-title"
                type="text"
                required
                value={personOrEvent}
                onChange={(e) => setPersonOrEvent(e.target.value)}
                placeholder="e.g., Elena's 30th Birthday"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sd-type" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Occasion
                </label>
                <select
                  id="sd-type"
                  value={occasionType}
                  onChange={(e) => setOccasionType(e.target.value as OccasionType)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
                >
                  <option value="birthday">Birthday</option>
                  <option value="anniversary">Anniversary</option>
                  <option value="milestone">Milestone</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>
              <div>
                <label htmlFor="sd-date" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Date
                </label>
                <input
                  id="sd-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sd-rem-days" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Notify Before
                </label>
                <select
                  id="sd-rem-days"
                  value={reminderDaysBefore}
                  onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
                >
                  <option value={0}>On the day</option>
                  <option value={1}>1 day before</option>
                  <option value={3}>3 days before</option>
                  <option value={7}>1 week before</option>
                  <option value={14}>2 weeks before</option>
                </select>
              </div>
              <div>
                <label htmlFor="sd-rem-time" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Reminder Time
                </label>
                <input
                  id="sd-rem-time"
                  type="time"
                  value={customReminderTime}
                  onChange={(e) => setCustomReminderTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label htmlFor="sd-budget" className="block text-xs font-medium text-[#5B635E] dark:text-[#9BA39D] mb-1">
                  Gift Budget ($)
                </label>
                <input
                  id="sd-budget"
                  type="number"
                  min={0}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                />
              </div>
              <label className="flex items-center gap-2 py-2.5 text-xs text-[#5B635E] dark:text-[#9BA39D] cursor-pointer">
                <input
                  type="checkbox"
                  checked={repeatsYearly}
                  onChange={(e) => setRepeatsYearly(e.target.checked)}
                  className="rounded accent-[#3A5A40]"
                />
                <span>Repeat yearly</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#3A5A40] text-white text-sm font-medium hover:bg-[#588157] transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Save Special Day</span>
            </button>
          </form>
        </div>

        {/* Right: Occasion Cards */}
        <div className="lg:col-span-8 space-y-5">
          {sortedDays.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-10 text-center space-y-2">
              <Gift className="w-8 h-8 text-[#3A5A40] mx-auto" />
              <p className="text-sm text-[#5B635E] dark:text-[#9BA39D]">
                Add a birthday, anniversary, or milestone to track gift ideas and reminders.
              </p>
            </div>
          ) : (
            sortedDays.map((day) => {
              const daysAway = daysUntilOccasion(day.date, day.repeatsYearly);
              const plannedTotal = day.giftIdeas.reduce((acc, g) => acc + g.estimatedPrice, 0);

              return (
                <div
                  key={day.id}
                  className="rounded-2xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B635E] dark:text-[#9BA39D]">
                        <span className="capitalize">{day.occasionType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{day.date}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Bell className="w-3 h-3" />
                          {day.reminderDaysBefore}d prior at {day.customReminderTime}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold mt-1">{day.personOrEvent}</h3>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-semibold font-mono tabular-nums text-[#3A5A40] dark:text-[#74A17B]">
                          {daysAway === 0 ? 'Today' : `In ${daysAway}d`}
                        </p>
                        <p className="text-xs text-[#5B635E] dark:text-[#9BA39D] font-mono tabular-nums">
                          ${plannedTotal} / ${day.budget} budget
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteSpecialDay(day.id)}
                        aria-label={`Delete ${day.personOrEvent}`}
                        className="p-2 rounded-lg text-[#5B635E] hover:text-[#B91C1C] hover:bg-[#B91C1C]/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Gift Ideas List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#5B635E] dark:text-[#9BA39D]">
                        Gift Ideas ({day.giftIdeas.length})
                      </span>
                      <button
                        type="button"
                        disabled={aiLoadingId === day.id}
                        onClick={() => handleBrainstormGifts(day)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3A5A40] dark:text-[#74A17B] hover:underline disabled:opacity-50"
                      >
                        {aiLoadingId === day.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>AI Suggest Ideas</span>
                      </button>
                    </div>

                    {day.giftIdeas.length > 0 && (
                      <div className="divide-y divide-[#EFEDE6] dark:divide-[#2A302C] border-t border-[#EFEDE6] dark:border-[#2A302C]">
                        {day.giftIdeas.map((gift) => (
                          <div key={gift.id} className="py-2.5 flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleGiftPurchased(day, gift.id)}
                              className="flex items-start gap-2.5 text-left min-w-0 flex-1"
                            >
                              <span
                                className={`mt-0.5 w-5 h-5 min-w-[20px] rounded-md border flex items-center justify-center ${
                                  gift.purchased
                                    ? 'bg-[#3A5A40] border-[#3A5A40] text-white'
                                    : 'border-[#5B635E]/40'
                                }`}
                              >
                                {gift.purchased && <Check className="w-3 h-3" />}
                              </span>
                              <div className="min-w-0">
                                <p className={`text-sm ${gift.purchased ? 'line-through text-[#5B635E]' : 'font-medium'}`}>
                                  {gift.title}
                                </p>
                                {gift.notes && (
                                  <p className="text-xs text-[#5B635E] dark:text-[#9BA39D]">
                                    {gift.notes}
                                  </p>
                                )}
                              </div>
                            </button>
                            <span className="text-xs font-mono tabular-nums text-[#5B635E] dark:text-[#9BA39D] shrink-0">
                              ${gift.estimatedPrice}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline Add Gift Idea */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <input
                        type="text"
                        value={newGiftTitleByDay[day.id] || ''}
                        onChange={(e) =>
                          setNewGiftTitleByDay((prev) => ({ ...prev, [day.id]: e.target.value }))
                        }
                        placeholder="Add a gift idea..."
                        className="flex-1 px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm"
                      />
                      <input
                        type="number"
                        min={0}
                        value={newGiftPriceByDay[day.id] || ''}
                        onChange={(e) =>
                          setNewGiftPriceByDay((prev) => ({ ...prev, [day.id]: e.target.value }))
                        }
                        placeholder="$ Price"
                        className="w-full sm:w-24 px-3 py-2 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-mono tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddGiftIdea(day)}
                        className="px-4 py-2 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-xs font-medium hover:bg-[#EFEDE6] dark:hover:bg-[#232824] whitespace-nowrap"
                      >
                        Add Idea
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
