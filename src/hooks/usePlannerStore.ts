import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  appleProvider,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../lib/firebase';
import {
  buildPatternSummaryForAI,
  computeCategoryPeakWindows,
  isWithinQuietHours,
  parseHHMMToMinutes,
  suggestOptimalTaskTime,
  type AdaptiveTimeSuggestion,
} from '../lib/adaptiveReminders';
import {
  addDaysISO,
  daysUntilOccasion,
  getNextRecurrenceDate,
  todayISO,
} from '../lib/dateUtils';
import {
  createStarterDietLogs,
  createStarterHabitInsights,
  createStarterSpecialDays,
  createStarterTasks,
  createStarterWorkoutPlans,
  getDefaultSettings,
} from '../lib/seedData';
import {
  FIELD_LIMITS,
  type AchievementBadge,
  type DietActivityLog,
  type HabitInsight,
  type PlannerTask,
  type ReminderNotification,
  type SpecialDay,
  type UserSettings,
  type WorkoutPlan,
} from '../types';

const LOCAL_STORAGE_KEY = 'verdant_day_workspace_v1';

interface LocalWorkspaceData {
  settings: UserSettings;
  tasks: PlannerTask[];
  dietLogs: DietActivityLog[];
  workoutPlans: WorkoutPlan[];
  specialDays: SpecialDay[];
  habitInsights: HabitInsight[];
  usedVoiceCapture?: boolean;
}

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function loadLocalWorkspace(): LocalWorkspaceData {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalWorkspaceData>;
      if (parsed && parsed.settings && Array.isArray(parsed.tasks)) {
        return {
          settings: { ...getDefaultSettings('guest'), ...parsed.settings },
          tasks: parsed.tasks,
          dietLogs: Array.isArray(parsed.dietLogs) ? parsed.dietLogs : [],
          workoutPlans: Array.isArray(parsed.workoutPlans) ? parsed.workoutPlans : [],
          specialDays: Array.isArray(parsed.specialDays) ? parsed.specialDays : [],
          habitInsights: Array.isArray(parsed.habitInsights) ? parsed.habitInsights : [],
          usedVoiceCapture: Boolean(parsed.usedVoiceCapture),
        };
      }
    }
  } catch {
    // fall through to fresh starter data
  }
  return {
    settings: getDefaultSettings('guest'),
    tasks: createStarterTasks('guest'),
    dietLogs: createStarterDietLogs('guest'),
    workoutPlans: createStarterWorkoutPlans('guest'),
    specialDays: createStarterSpecialDays('guest'),
    habitInsights: createStarterHabitInsights('guest'),
    usedVoiceCapture: false,
  };
}

function sanitizeTaskPayload(task: PlannerTask, uid: string) {
  return {
    ownerId: uid,
    title: task.title.trim().slice(0, FIELD_LIMITS.TASK_TITLE_MAX) || 'Untitled task',
    notes: (task.notes || '').trim().slice(0, FIELD_LIMITS.TASK_NOTES_MAX),
    category: task.category,
    priority: task.priority,
    orderIndex: Math.max(0, Math.min(100000, Math.round(task.orderIndex))),
    completed: Boolean(task.completed),
    completedAt: task.completed ? (task.completedAt || new Date().toISOString()).slice(0, 40) : '',
    dueDate: task.dueDate.slice(0, 10),
    dueTime: (task.dueTime || '').slice(0, 10),
    reminderOffsetMinutes: Math.max(0, Math.min(10080, Math.round(task.reminderOffsetMinutes || 0))),
    recurrence: task.recurrence,
  };
}

function sanitizeDietLogPayload(log: DietActivityLog, uid: string) {
  return {
    ownerId: uid,
    date: log.date.slice(0, 10),
    entryType: log.entryType,
    mealSlot: log.mealSlot,
    title: log.title.trim().slice(0, FIELD_LIMITS.DIET_TITLE_MAX) || 'Logged item',
    calories: Math.max(0, Math.min(10000, Math.round(log.calories || 0))),
    proteinGrams: Math.max(0, Math.min(1000, Math.round(log.proteinGrams || 0))),
    carbsGrams: Math.max(0, Math.min(1500, Math.round(log.carbsGrams || 0))),
    fatsGrams: Math.max(0, Math.min(500, Math.round(log.fatsGrams || 0))),
    durationMinutes: Math.max(0, Math.min(1440, Math.round(log.durationMinutes || 0))),
    waterGlasses: Math.max(0, Math.min(30, Math.round(log.waterGlasses ?? 0))),
    intensity: log.intensity,
  };
}

function sanitizeWorkoutPayload(plan: WorkoutPlan, uid: string) {
  const safeExercises = (plan.exercises.length > 0
    ? plan.exercises
    : [
        {
          id: 'ex-1',
          name: 'Mobility warm-up',
          sets: 2,
          repsOrDuration: '60 sec',
          restSeconds: 30,
          formCue: 'Breathe steadily.',
          completed: false,
        },
      ]
  ).slice(0, FIELD_LIMITS.ARRAY_MAX);

  return {
    ownerId: uid,
    title: plan.title.trim().slice(0, FIELD_LIMITS.WORKOUT_TITLE_MAX) || 'Workout session',
    goal: plan.goal.trim().slice(0, FIELD_LIMITS.WORKOUT_GOAL_MAX) || 'General fitness',
    fitnessLevel: plan.fitnessLevel,
    durationMinutes: Math.max(5, Math.min(240, Math.round(plan.durationMinutes || 25))),
    equipment: (plan.equipment || 'Bodyweight').trim().slice(0, FIELD_LIMITS.WORKOUT_EQUIPMENT_MAX),
    rationale: (plan.rationale || '').trim().slice(0, FIELD_LIMITS.WORKOUT_RATIONALE_MAX),
    exercises: safeExercises,
  };
}

function sanitizeSpecialDayPayload(day: SpecialDay, uid: string) {
  return {
    ownerId: uid,
    personOrEvent: day.personOrEvent.trim().slice(0, FIELD_LIMITS.SPECIAL_DAY_TITLE_MAX) || 'Special Day',
    occasionType: day.occasionType,
    date: day.date.slice(0, 10),
    repeatsYearly: Boolean(day.repeatsYearly),
    reminderDaysBefore: Math.max(0, Math.min(90, Math.round(day.reminderDaysBefore || 0))),
    customReminderTime: (day.customReminderTime || '09:00').slice(0, 10),
    budget: Math.max(0, Math.min(100000, Math.round(day.budget || 0))),
    giftIdeas: day.giftIdeas.slice(0, FIELD_LIMITS.ARRAY_MAX),
  };
}

function sanitizeSettingsPayload(s: UserSettings, uid: string) {
  return {
    ownerId: uid,
    theme: s.theme,
    tierPreview: s.tierPreview,
    notificationsEnabled: Boolean(s.notificationsEnabled),
    adaptiveRemindersEnabled: s.adaptiveRemindersEnabled ?? true,
    defaultReminderLeadMinutes: Math.max(0, Math.min(10080, Math.round(s.defaultReminderLeadMinutes || 30))),
    quietHoursStart: (s.quietHoursStart || '22:00').slice(0, 10),
    quietHoursEnd: (s.quietHoursEnd || '07:00').slice(0, 10),
    calorieTarget: Math.max(500, Math.min(10000, Math.round(s.calorieTarget || 2150))),
    proteinTarget: Math.max(0, Math.min(1000, Math.round(s.proteinTarget || 135))),
    carbsTarget: Math.max(0, Math.min(1500, Math.round(s.carbsTarget || 230))),
    fatsTarget: Math.max(0, Math.min(500, Math.round(s.fatsTarget || 70))),
    waterTargetGlasses: Math.max(1, Math.min(30, Math.round(s.waterTargetGlasses || 8))),
  };
}

export function usePlannerStore() {
  const [localData, setLocalData] = useState<LocalWorkspaceData>(() => loadLocalWorkspace());
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'guest' | 'syncing' | 'synced' | 'offline'>('guest');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [cloudSettings, setCloudSettings] = useState<UserSettings | null>(null);
  const [cloudTasks, setCloudTasks] = useState<PlannerTask[]>([]);
  const [cloudDietLogs, setCloudDietLogs] = useState<DietActivityLog[]>([]);
  const [cloudWorkoutPlans, setCloudWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [cloudSpecialDays, setCloudSpecialDays] = useState<SpecialDay[]>([]);
  const [cloudHabitInsights, setCloudHabitInsights] = useState<HabitInsight[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    testConnection();
  }, []);

  // Persist guest workspace in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localData));
    } catch {
      // ignore storage quota errors
    }
  }, [localData]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setSyncStatus('guest');
      }
    });
    return () => unsub();
  }, []);

  // Bootstrap and attach Firestore listeners when authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    const uid = user.uid;
    setSyncStatus('syncing');

    let cancelled = false;
    const unsubscribers: Array<() => void> = [];

    async function initCloudWorkspace() {
      try {
        const profileRef = doc(db, 'users', uid, 'private', 'profile');
        const settingsRef = doc(db, 'users', uid, 'settings', 'preferences');

        const [profileSnap, settingsSnap] = await Promise.all([
          getDoc(profileRef),
          getDoc(settingsRef),
        ]);

        if (cancelled) return;

        const providerId = user?.providerData?.[0]?.providerId || '';
        const provider = providerId.includes('apple') ? 'apple' : 'google';

        if (!profileSnap.exists()) {
          await setDoc(profileRef, {
            ownerId: uid,
            displayName: (user?.displayName || 'Planner Member').slice(0, 120),
            email: (user?.email || 'member@verdantday.app').slice(0, 200),
            provider,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        if (!settingsSnap.exists()) {
          const batch = writeBatch(db);
          batch.set(settingsRef, {
            ...sanitizeSettingsPayload(localData.settings, uid),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          localData.tasks.slice(0, 20).forEach((t) => {
            const ref = doc(db, 'users', uid, 'tasks', t.id);
            batch.set(ref, {
              ...sanitizeTaskPayload(t, uid),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          localData.dietLogs.slice(0, 25).forEach((l) => {
            const ref = doc(db, 'users', uid, 'dietLogs', l.id);
            batch.set(ref, {
              ...sanitizeDietLogPayload(l, uid),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          localData.workoutPlans.slice(0, 5).forEach((w) => {
            const ref = doc(db, 'users', uid, 'workoutPlans', w.id);
            batch.set(ref, {
              ...sanitizeWorkoutPayload(w, uid),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          localData.specialDays.slice(0, 15).forEach((s) => {
            const ref = doc(db, 'users', uid, 'specialDays', s.id);
            batch.set(ref, {
              ...sanitizeSpecialDayPayload(s, uid),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          localData.habitInsights.slice(0, 5).forEach((h) => {
            const ref = doc(db, 'users', uid, 'habitInsights', h.id);
            batch.set(ref, {
              ownerId: uid,
              title: h.title.slice(0, 160),
              patternObservation: h.patternObservation.slice(0, 500),
              suggestedAction: h.suggestedAction.slice(0, 500),
              focusArea: h.focusArea,
              adopted: Boolean(h.adopted),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          await batch.commit();
        }

        if (cancelled) return;

        unsubscribers.push(
          onSnapshot(
            settingsRef,
            (snap) => {
              if (snap.exists()) {
                setCloudSettings(snap.data() as UserSettings);
              }
              setSyncStatus('synced');
            },
            (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}/settings/preferences`)
          )
        );

        const attachList = <T,>(
          colName: string,
          setter: (items: T[]) => void
        ) => {
          const path = `users/${uid}/${colName}`;
          const q = query(collection(db, path), where('ownerId', '==', uid));
          unsubscribers.push(
            onSnapshot(
              q,
              (snap) => {
                const items = snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
                setter(items);
                setSyncStatus('synced');
              },
              (err) => handleFirestoreError(err, OperationType.LIST, path)
            )
          );
        };

        attachList<PlannerTask>('tasks', setCloudTasks);
        attachList<DietActivityLog>('dietLogs', setCloudDietLogs);
        attachList<WorkoutPlan>('workoutPlans', setCloudWorkoutPlans);
        attachList<SpecialDay>('specialDays', setCloudSpecialDays);
        attachList<HabitInsight>('habitInsights', setCloudHabitInsights);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }
    }

    initCloudWorkspace();

    return () => {
      cancelled = true;
      unsubscribers.forEach((fn) => fn());
    };
  }, [authReady, user]); // intentionally omit localData to avoid re-seeding on every local change

  const settings = user && cloudSettings ? cloudSettings : localData.settings;
  const tasks = useMemo(() => {
    const raw = user ? cloudTasks : localData.tasks;
    return [...raw].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [user, cloudTasks, localData.tasks]);

  const dietLogs = user ? cloudDietLogs : localData.dietLogs;
  const workoutPlans = user ? cloudWorkoutPlans : localData.workoutPlans;
  const specialDays = user ? cloudSpecialDays : localData.specialDays;
  const habitInsights = user ? cloudHabitInsights : localData.habitInsights;

  // Apply light/dark theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark =
        settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
      root.classList.toggle('dark', shouldBeDark);
    };
    apply();

    if (settings.theme === 'system' && typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [settings.theme]);

  // Auth actions
  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Signed in with Google. Cloud sync active.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in cancelled.';
      setAuthError(message);
    }
  }, [showToast]);

  const signInWithApple = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, appleProvider);
      showToast('Signed in with Apple. Cloud sync active.');
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('operation-not-allowed') || raw.includes('configuration-not-found')) {
        setAuthError(
          'Apple Sign-In requires enabling the Apple provider with your Apple Developer Service ID in the Firebase Console Authentication settings. Use Google Sign-In for instant one-click access right now.'
        );
      } else {
        setAuthError(raw);
      }
    }
  }, [showToast]);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    showToast('Signed out. Switched to local offline workspace.');
  }, [showToast]);

  // --- Mutations ---
  const updateSettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      const merged: UserSettings = { ...settings, ...patch };
      if (!user) {
        setLocalData((prev) => ({ ...prev, settings: merged }));
        return;
      }
      const path = `users/${user.uid}/settings/preferences`;
      try {
        await updateDoc(doc(db, path), {
          ...sanitizeSettingsPayload(merged, user.uid),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [settings, user]
  );

  const addTask = useCallback(
    async (
      input: Omit<PlannerTask, 'id' | 'ownerId' | 'orderIndex' | 'completed'>,
      usedVoice = false
    ) => {
      const minOrder = tasks.length > 0 ? Math.min(...tasks.map((t) => t.orderIndex)) : 1;
      const newTask: PlannerTask = {
        ...input,
        id: makeSafeId('task'),
        ownerId: user?.uid || 'guest',
        orderIndex: Math.max(0, minOrder === 0 ? 0 : minOrder - 1),
        completed: false,
      };

      // Keep unique strictly increasing orderIndex when prepending
      const reindexed = [newTask, ...tasks].map((t, idx) => ({ ...t, orderIndex: idx }));

      if (!user) {
        setLocalData((prev) => ({
          ...prev,
          tasks: reindexed,
          usedVoiceCapture: prev.usedVoiceCapture || usedVoice,
        }));
        showToast('Task added to your planner.');
        return;
      }

      const path = `users/${user.uid}/tasks`;
      try {
        const batch = writeBatch(db);
        reindexed.forEach((t) => {
          const ref = doc(db, path, t.id);
          if (t.id === newTask.id) {
            batch.set(ref, {
              ...sanitizeTaskPayload(t, user.uid),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.update(ref, {
              orderIndex: t.orderIndex,
              updatedAt: serverTimestamp(),
            });
          }
        });
        await batch.commit();
        if (usedVoice) {
          setLocalData((prev) => ({ ...prev, usedVoiceCapture: true }));
        }
        showToast('Task synced to cloud.');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [tasks, user, showToast]
  );

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<PlannerTask>) => {
      const existing = tasks.find((t) => t.id === taskId);
      if (!existing) return;
      const updated: PlannerTask = { ...existing, ...patch };

      if (!user) {
        setLocalData((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? updated : t)),
        }));
        return;
      }

      const path = `users/${user.uid}/tasks/${taskId}`;
      try {
        await updateDoc(doc(db, path), {
          ...sanitizeTaskPayload(updated, user.uid),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [tasks, user]
  );

  const toggleTask = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      const nextCompleted = !target.completed;
      const completedAt = nextCompleted ? new Date().toISOString() : '';

      // If completing a recurring task, automatically schedule next occurrence
      let nextOccurrence: PlannerTask | null = null;
      if (nextCompleted && target.recurrence !== 'none') {
        const nextDue = getNextRecurrenceDate(target.dueDate, target.recurrence);
        const alreadyExists = tasks.some(
          (t) => !t.completed && t.title === target.title && t.dueDate === nextDue
        );
        if (!alreadyExists) {
          nextOccurrence = {
            ...target,
            id: makeSafeId('task'),
            completed: false,
            completedAt: '',
            dueDate: nextDue,
            orderIndex: tasks.length,
          };
        }
      }

      if (!user) {
        setLocalData((prev) => {
          const updatedList = prev.tasks.map((t) =>
            t.id === taskId ? { ...t, completed: nextCompleted, completedAt } : t
          );
          if (nextOccurrence) updatedList.push(nextOccurrence);
          return { ...prev, tasks: updatedList };
        });
        if (nextOccurrence) {
          showToast(`Completed! Next ${target.recurrence} occurrence scheduled for ${nextOccurrence.dueDate}.`);
        }
        return;
      }

      const colPath = `users/${user.uid}/tasks`;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, colPath, taskId), {
          completed: nextCompleted,
          completedAt,
          updatedAt: serverTimestamp(),
        });
        if (nextOccurrence) {
          batch.set(doc(db, colPath, nextOccurrence.id), {
            ...sanitizeTaskPayload(nextOccurrence, user.uid),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
        if (nextOccurrence) {
          showToast(`Completed! Next ${target.recurrence} occurrence scheduled.`);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, colPath);
      }
    },
    [tasks, user, showToast]
  );

  const reorderTasks = useCallback(
    async (orderedIds: string[]) => {
      const map = new Map(tasks.map((t) => [t.id, t]));
      const reordered: PlannerTask[] = [];
      orderedIds.forEach((id, idx) => {
        const item = map.get(id);
        if (item) reordered.push({ ...item, orderIndex: idx });
      });
      // Append any remaining items not in orderedIds
      tasks.forEach((t) => {
        if (!orderedIds.includes(t.id)) {
          reordered.push({ ...t, orderIndex: reordered.length });
        }
      });

      if (!user) {
        setLocalData((prev) => ({ ...prev, tasks: reordered }));
        return;
      }

      const colPath = `users/${user.uid}/tasks`;
      try {
        const batch = writeBatch(db);
        reordered.forEach((t) => {
          batch.update(doc(db, colPath, t.id), {
            orderIndex: t.orderIndex,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, colPath);
      }
    },
    [tasks, user]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!user) {
        setLocalData((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== taskId),
        }));
        return;
      }
      const path = `users/${user.uid}/tasks/${taskId}`;
      try {
        await deleteDoc(doc(db, path));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const addDietLog = useCallback(
    async (input: Omit<DietActivityLog, 'id' | 'ownerId'>) => {
      const log: DietActivityLog = {
        ...input,
        id: makeSafeId('log'),
        ownerId: user?.uid || 'guest',
      };
      if (!user) {
        setLocalData((prev) => ({ ...prev, dietLogs: [log, ...prev.dietLogs] }));
        showToast(`${log.entryType === 'meal' ? 'Meal' : 'Activity'} logged.`);
        return;
      }
      const path = `users/${user.uid}/dietLogs/${log.id}`;
      try {
        await setDoc(doc(db, path), {
          ...sanitizeDietLogPayload(log, user.uid),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(`${log.entryType === 'meal' ? 'Meal' : 'Activity'} synced.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user, showToast]
  );

  const adjustWaterGlasses = useCallback(
    async (date: string, delta: number) => {
      const existing = dietLogs.find(
        (l) => l.date === date && l.entryType === 'hydration'
      );
      const currentCount = existing?.waterGlasses ?? 0;
      const nextCount = Math.max(0, Math.min(30, currentCount + delta));

      if (!existing) {
        const log: DietActivityLog = {
          id: makeSafeId('hydra'),
          ownerId: user?.uid || 'guest',
          date,
          entryType: 'hydration',
          mealSlot: 'hydration',
          title: 'Daily Hydration',
          calories: 0,
          proteinGrams: 0,
          carbsGrams: 0,
          fatsGrams: 0,
          durationMinutes: 0,
          waterGlasses: nextCount,
          intensity: 'gentle',
        };
        if (!user) {
          setLocalData((prev) => ({ ...prev, dietLogs: [log, ...prev.dietLogs] }));
          return;
        }
        const path = `users/${user.uid}/dietLogs/${log.id}`;
        try {
          await setDoc(doc(db, path), {
            ...sanitizeDietLogPayload(log, user.uid),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
        return;
      }

      if (!user) {
        setLocalData((prev) => ({
          ...prev,
          dietLogs: prev.dietLogs.map((l) =>
            l.id === existing.id ? { ...l, waterGlasses: nextCount } : l
          ),
        }));
        return;
      }

      const path = `users/${user.uid}/dietLogs/${existing.id}`;
      try {
        await updateDoc(doc(db, path), {
          ...sanitizeDietLogPayload({ ...existing, waterGlasses: nextCount }, user.uid),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [dietLogs, user]
  );

  const deleteDietLog = useCallback(
    async (logId: string) => {
      if (!user) {
        setLocalData((prev) => ({
          ...prev,
          dietLogs: prev.dietLogs.filter((l) => l.id !== logId),
        }));
        return;
      }
      const path = `users/${user.uid}/dietLogs/${logId}`;
      try {
        await deleteDoc(doc(db, path));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const saveWorkoutPlan = useCallback(
    async (input: Omit<WorkoutPlan, 'id' | 'ownerId'>) => {
      const plan: WorkoutPlan = {
        ...input,
        id: makeSafeId('plan'),
        ownerId: user?.uid || 'guest',
      };
      if (!user) {
        setLocalData((prev) => ({ ...prev, workoutPlans: [plan, ...prev.workoutPlans] }));
        showToast('Workout plan saved.');
        return plan;
      }
      const path = `users/${user.uid}/workoutPlans/${plan.id}`;
      try {
        await setDoc(doc(db, path), {
          ...sanitizeWorkoutPayload(plan, user.uid),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Workout plan synced.');
        return plan;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user, showToast]
  );

  const toggleWorkoutExercise = useCallback(
    async (planId: string, exerciseId: string) => {
      const plan = workoutPlans.find((p) => p.id === planId);
      if (!plan) return;
      const nextExercises = plan.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, completed: !ex.completed } : ex
      );

      if (!user) {
        setLocalData((prev) => ({
          ...prev,
          workoutPlans: prev.workoutPlans.map((p) =>
            p.id === planId ? { ...p, exercises: nextExercises } : p
          ),
        }));
        return;
      }

      const path = `users/${user.uid}/workoutPlans/${planId}`;
      try {
        await updateDoc(doc(db, path), {
          exercises: nextExercises,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [workoutPlans, user]
  );

  const addSpecialDay = useCallback(
    async (input: Omit<SpecialDay, 'id' | 'ownerId'>) => {
      const entry: SpecialDay = {
        ...input,
        id: makeSafeId('day'),
        ownerId: user?.uid || 'guest',
      };
      if (!user) {
        setLocalData((prev) => ({ ...prev, specialDays: [entry, ...prev.specialDays] }));
        showToast('Special day & reminder saved.');
        return;
      }
      const path = `users/${user.uid}/specialDays/${entry.id}`;
      try {
        await setDoc(doc(db, path), {
          ...sanitizeSpecialDayPayload(entry, user.uid),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Special day synced.');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user, showToast]
  );

  const updateSpecialDay = useCallback(
    async (dayId: string, patch: Partial<SpecialDay>) => {
      const existing = specialDays.find((d) => d.id === dayId);
      if (!existing) return;
      const updated: SpecialDay = { ...existing, ...patch };

      if (!user) {
        setLocalData((prev) => ({
          ...prev,
          specialDays: prev.specialDays.map((d) => (d.id === dayId ? updated : d)),
        }));
        return;
      }

      const path = `users/${user.uid}/specialDays/${dayId}`;
      try {
        await updateDoc(doc(db, path), {
          ...sanitizeSpecialDayPayload(updated, user.uid),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [specialDays, user]
  );

  const deleteSpecialDay = useCallback(
    async (dayId: string) => {
      if (!user) {
        setLocalData((prev) => ({
          ...prev,
          specialDays: prev.specialDays.filter((d) => d.id !== dayId),
        }));
        return;
      }
      const path = `users/${user.uid}/specialDays/${dayId}`;
      try {
        await deleteDoc(doc(db, path));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const saveHabitInsights = useCallback(
    async (
      items: Array<Omit<HabitInsight, 'id' | 'ownerId' | 'adopted'>>
    ) => {
      const uid = user?.uid || 'guest';
      const formatted: HabitInsight[] = items.map((item) => ({
        ...item,
        id: makeSafeId('habit'),
        ownerId: uid,
        adopted: false,
      }));

      if (!user) {
        setLocalData((prev) => ({
          ...prev,
          habitInsights: [...formatted, ...prev.habitInsights].slice(0, 8),
        }));
        showToast('Personalized habit suggestions ready.');
        return;
      }

      const colPath = `users/${user.uid}/habitInsights`;
      try {
        const batch = writeBatch(db);
        formatted.forEach((h) => {
          batch.set(doc(db, colPath, h.id), {
            ownerId: user.uid,
            title: h.title.slice(0, 160),
            patternObservation: h.patternObservation.slice(0, 500),
            suggestedAction: h.suggestedAction.slice(0, 500),
            focusArea: h.focusArea,
            adopted: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
        showToast('Habit suggestions synced.');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, colPath);
      }
    },
    [user, showToast]
  );

  const adoptHabitInsight = useCallback(
    async (insightId: string) => {
      const insight = habitInsights.find((h) => h.id === insightId);
      if (!insight) return;

      if (!user) {
        setLocalData((prev) => ({
          ...prev,
          habitInsights: prev.habitInsights.map((h) =>
            h.id === insightId ? { ...h, adopted: true } : h
          ),
        }));
      } else {
        const path = `users/${user.uid}/habitInsights/${insightId}`;
        try {
          await updateDoc(doc(db, path), {
            adopted: true,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }

      await addTask({
        title: insight.title,
        notes: insight.suggestedAction,
        category: insight.focusArea === 'productivity' ? 'work' : 'wellness',
        priority: 'medium',
        dueDate: todayISO(),
        dueTime: '09:00',
        reminderOffsetMinutes: settings.defaultReminderLeadMinutes,
        recurrence: 'daily',
      });
    },
    [habitInsights, user, addTask, settings.defaultReminderLeadMinutes]
  );

  // Backup Export / Import
  const exportBackupJSON = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Verdant Day',
      settings,
      tasks,
      dietLogs,
      workoutPlans,
      specialDays,
      habitInsights,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verdant-day-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON downloaded.');
  }, [settings, tasks, dietLogs, workoutPlans, specialDays, habitInsights, showToast]);

  const importBackupJSON = useCallback(
    async (rawJson: string) => {
      try {
        const parsed = JSON.parse(rawJson) as Partial<LocalWorkspaceData>;
        if (!parsed || !Array.isArray(parsed.tasks)) {
          showToast('Invalid backup file format.');
          return;
        }
        const uid = user?.uid || 'guest';
        const nextLocal: LocalWorkspaceData = {
          settings: { ...getDefaultSettings(uid), ...(parsed.settings || {}), ownerId: uid },
          tasks: parsed.tasks.slice(0, 60).map((t, idx) => ({ ...t, ownerId: uid, orderIndex: idx })),
          dietLogs: Array.isArray(parsed.dietLogs)
            ? parsed.dietLogs.slice(0, 60).map((l) => ({ ...l, ownerId: uid }))
            : [],
          workoutPlans: Array.isArray(parsed.workoutPlans)
            ? parsed.workoutPlans.slice(0, 15).map((w) => ({ ...w, ownerId: uid }))
            : [],
          specialDays: Array.isArray(parsed.specialDays)
            ? parsed.specialDays.slice(0, 40).map((s) => ({ ...s, ownerId: uid }))
            : [],
          habitInsights: Array.isArray(parsed.habitInsights)
            ? parsed.habitInsights.slice(0, 20).map((h) => ({ ...h, ownerId: uid }))
            : [],
        };

        setLocalData(nextLocal);
        if (user) {
          const batch = writeBatch(db);
          batch.set(doc(db, 'users', uid, 'settings', 'preferences'), {
            ...sanitizeSettingsPayload(nextLocal.settings, uid),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          nextLocal.tasks.slice(0, 20).forEach((t) => {
            batch.set(doc(db, 'users', uid, 'tasks', t.id), {
              ...sanitizeTaskPayload(t, uid),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        }
        showToast('Backup restored successfully.');
      } catch {
        showToast('Could not parse backup file.');
      }
    },
    [user, showToast]
  );

  // Derived metrics & reminders
  const today = todayISO();
  const todayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === today),
    [tasks, today]
  );

  const todayCompletionPct = useMemo(() => {
    if (todayTasks.length === 0) return 0;
    const done = todayTasks.filter((t) => t.completed).length;
    return Math.round((done / todayTasks.length) * 100);
  }, [todayTasks]);

  const todayDietSummary = useMemo(() => {
    const dayLogs = dietLogs.filter((l) => l.date === today);
    let intakeCalories = 0;
    let protein = 0;
    let carbs = 0;
    let fats = 0;
    let activeMinutes = 0;
    let burnedCalories = 0;
    let waterGlasses = 0;

    dayLogs.forEach((l) => {
      if (l.entryType === 'meal') {
        intakeCalories += l.calories;
        protein += l.proteinGrams;
        carbs += l.carbsGrams;
        fats += l.fatsGrams;
      } else if (l.entryType === 'activity') {
        activeMinutes += l.durationMinutes;
        burnedCalories += l.calories;
      } else if (l.entryType === 'hydration') {
        waterGlasses = Math.max(waterGlasses, l.waterGlasses ?? 0);
      }
    });

    return {
      intakeCalories,
      protein,
      carbs,
      fats,
      activeMinutes,
      burnedCalories,
      waterGlasses,
    };
  }, [dietLogs, today]);

  const adaptiveEnabled = settings.adaptiveRemindersEnabled !== false;

  const categoryPeaks = useMemo(
    () => computeCategoryPeakWindows(tasks, dietLogs, settings),
    [tasks, dietLogs, settings]
  );

  const taskSuggestions = useMemo(() => {
    const map: Record<string, AdaptiveTimeSuggestion> = {};
    if (!adaptiveEnabled) return map;
    tasks
      .filter((t) => !t.completed)
      .forEach((t) => {
        map[t.id] = suggestOptimalTaskTime(t, tasks, dietLogs, settings);
      });
    return map;
  }, [adaptiveEnabled, tasks, dietLogs, settings]);

  const applyAdaptiveTiming = useCallback(
    async (taskId: string, suggestedTime: string, suggestedOffsetMinutes: number) => {
      await updateTask(taskId, {
        dueTime: suggestedTime,
        reminderOffsetMinutes: suggestedOffsetMinutes,
      });
      showToast(`Reminder adjusted to optimal slot (${suggestedTime}, ${suggestedOffsetMinutes}m prior).`);
    },
    [updateTask, showToast]
  );

  const optimizePendingRemindersWithAI = useCallback(async () => {
    const pending = tasks.filter((t) => !t.completed && t.dueDate >= today).slice(0, 8);
    if (pending.length === 0) {
      showToast('No pending tasks to optimize.');
      return;
    }

    try {
      const response = await fetch('/api/ai/adaptive-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patternSummary: buildPatternSummaryForAI(tasks, dietLogs, settings),
          pendingTasks: pending.map((t) => ({
            id: t.id,
            title: t.title,
            category: t.category,
            priority: t.priority,
            dueTime: t.dueTime,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.recommendations)) {
        throw new Error(data.error || 'Fallback to pattern engine');
      }

      let updatedCount = 0;
      for (const rec of data.recommendations as Array<{
        taskId: string;
        suggestedTime: string;
        suggestedOffsetMinutes: number;
      }>) {
        if (rec.taskId && rec.suggestedTime) {
          await updateTask(rec.taskId, {
            dueTime: rec.suggestedTime,
            reminderOffsetMinutes: rec.suggestedOffsetMinutes,
          });
          updatedCount += 1;
        }
      }
      showToast(
        updatedCount > 0
          ? `AI optimized ${updatedCount} upcoming task reminder${updatedCount === 1 ? '' : 's'}.`
          : 'Your reminders already match your optimal focus windows.'
      );
    } catch {
      // Offline / fallback to deterministic behavioral pattern engine
      let updatedCount = 0;
      for (const t of pending) {
        const s = suggestOptimalTaskTime(t, tasks, dietLogs, settings);
        if (s.isDifferentFromCurrent) {
          await updateTask(t.id, {
            dueTime: s.suggestedTime,
            reminderOffsetMinutes: s.suggestedOffsetMinutes,
          });
          updatedCount += 1;
        }
      }
      showToast(
        updatedCount > 0
          ? `Adjusted ${updatedCount} reminder${updatedCount === 1 ? '' : 's'} using your completion history.`
          : 'Your reminders already align with your historical peak windows.'
      );
    }
  }, [tasks, dietLogs, settings, today, updateTask, showToast]);

  const activeReminders = useMemo<ReminderNotification[]>(() => {
    const list: ReminderNotification[] = [];
    const tomorrow = addDaysISO(today, 1);

    tasks
      .filter((t) => !t.completed && (t.dueDate === today || t.dueDate === tomorrow))
      .slice(0, 4)
      .forEach((t) => {
        const suggestion = taskSuggestions[t.id];
        list.push({
          id: `rem-task-${t.id}`,
          taskId: t.id,
          source: 'task',
          title: t.title,
          detail: `${t.dueDate === today ? 'Due today' : 'Due tomorrow'}${t.dueTime ? ` at ${t.dueTime}` : ''} · Notify ${t.reminderOffsetMinutes}m prior`,
          timeLabel: t.dueTime || (t.dueDate === today ? 'Today' : 'Tomorrow'),
          suggestedTime: suggestion?.suggestedTime,
          suggestedOffsetMinutes: suggestion?.suggestedOffsetMinutes,
          adaptiveReason: suggestion?.rationale,
          canOptimize: Boolean(suggestion?.isDifferentFromCurrent),
        });
      });

    specialDays.forEach((day) => {
      const daysAway = daysUntilOccasion(day.date, day.repeatsYearly);
      if (daysAway >= 0 && daysAway <= Math.max(day.reminderDaysBefore, 7)) {
        const unpurchased = day.giftIdeas.filter((g) => !g.purchased).length;
        list.push({
          id: `rem-day-${day.id}`,
          source: 'special-day',
          title: day.personOrEvent,
          detail:
            daysAway === 0
              ? `Today · ${unpurchased} gift idea(s) pending`
              : `In ${daysAway} day${daysAway === 1 ? '' : 's'} · Reminder at ${day.customReminderTime}`,
          timeLabel: daysAway === 0 ? 'Today' : `${daysAway}d`,
        });
      }
    });

    return list;
  }, [tasks, specialDays, today, taskSuggestions]);

  // Browser notification check when enabled (respecting quiet hours)
  useEffect(() => {
    if (!settings.notificationsEnabled || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    if (isWithinQuietHours(nowMins, settings.quietHoursStart, settings.quietHoursEnd)) {
      return;
    }

    const todayDueSoon = tasks.find(
      (t) => !t.completed && t.dueDate === today && t.dueTime
    );
    if (!todayDueSoon) return;

    const sessionKey = `verdant_notified_${today}_${todayDueSoon.id}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const dueMins = parseHHMMToMinutes(todayDueSoon.dueTime);
    if (dueMins === null) return;
    const hh = Math.floor(dueMins / 60);
    const mm = dueMins % 60;
    const dueMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hh,
      mm
    ).getTime();
    const triggerMs = dueMs - todayDueSoon.reminderOffsetMinutes * 60 * 1000;
    if (now.getTime() >= triggerMs && now.getTime() <= dueMs + 30 * 60 * 1000) {
      sessionStorage.setItem(sessionKey, '1');
      try {
        new Notification('Verdant Day Reminder', {
          body: `${todayDueSoon.title} (${todayDueSoon.dueTime})`,
          icon: '/pwa-192x192.png',
        });
      } catch {
        // ignore in environments disallowing Notification constructor
      }
    }
  }, [settings.notificationsEnabled, settings.quietHoursStart, settings.quietHoursEnd, tasks, today]);

  const streakDays = useMemo(() => {
    const activeDates = new Set<string>();
    tasks.forEach((t) => {
      if (t.completed) activeDates.add(t.dueDate);
    });
    dietLogs.forEach((l) => activeDates.add(l.date));
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = addDaysISO(today, -i);
      if (activeDates.has(d)) streak += 1;
      else if (i > 0) break;
    }
    return Math.max(streak, 1);
  }, [tasks, dietLogs, today]);

  const badges = useMemo<AchievementBadge[]>(() => {
    const completedCount = tasks.filter((t) => t.completed).length;
    const mealDays = new Set(dietLogs.filter((l) => l.entryType === 'meal').map((l) => l.date)).size;
    const purchasedGifts = specialDays.reduce(
      (acc, d) => acc + d.giftIdeas.filter((g) => g.purchased).length,
      0
    );
    const completedWorkouts = workoutPlans.filter((w) =>
      w.exercises.some((ex) => ex.completed)
    ).length;

    return [
      {
        id: 'badge-first-step',
        title: 'First Intentional Step',
        description: 'Complete your first daily planner task.',
        unlocked: completedCount >= 1,
        progressText: `${Math.min(completedCount, 1)} / 1 task`,
      },
      {
        id: 'badge-rhythm',
        title: '5-Day Studio Rhythm',
        description: 'Stay active across planner or nutrition logs for 5 days.',
        unlocked: streakDays >= 5,
        progressText: `${Math.min(streakDays, 5)} / 5 days`,
      },
      {
        id: 'badge-fuel',
        title: 'Mindful Fuel Tracker',
        description: 'Log meals across 3 separate calendar days.',
        unlocked: mealDays >= 3,
        progressText: `${Math.min(mealDays, 3)} / 3 days`,
      },
      {
        id: 'badge-movement',
        title: 'Movement Initiated',
        description: 'Check off exercises in a personalized workout plan.',
        unlocked: completedWorkouts >= 1,
        progressText: `${Math.min(completedWorkouts, 1)} / 1 plan`,
      },
      {
        id: 'badge-gifter',
        title: 'Thoughtful Gifter',
        description: 'Prepare and mark a gift ready for a special occasion.',
        unlocked: purchasedGifts >= 1,
        progressText: `${Math.min(purchasedGifts, 1)} / 1 gift`,
      },
      {
        id: 'badge-voice',
        title: 'Hands-Free Capture',
        description: 'Add a task using voice recognition.',
        unlocked: Boolean(localData.usedVoiceCapture),
        progressText: localData.usedVoiceCapture ? 'Unlocked' : '0 / 1 voice task',
      },
    ];
  }, [tasks, dietLogs, specialDays, workoutPlans, streakDays, localData.usedVoiceCapture]);

  const dailyScore = useMemo(() => {
    const taskPart = todayTasks.length > 0 ? (todayCompletionPct / 100) * 45 : 20;
    const nutritionPart = todayDietSummary.intakeCalories > 0 ? 25 : 0;
    const movementPart = todayDietSummary.activeMinutes >= 20 ? 20 : todayDietSummary.activeMinutes > 0 ? 10 : 0;
    const waterPart = todayDietSummary.waterGlasses >= 4 ? 10 : todayDietSummary.waterGlasses > 0 ? 5 : 0;
    return Math.min(100, Math.round(taskPart + nutritionPart + movementPart + waterPart));
  }, [todayTasks.length, todayCompletionPct, todayDietSummary]);

  return {
    user,
    authReady,
    authError,
    clearAuthError: () => setAuthError(null),
    syncStatus,
    toastMessage,
    showToast,
    settings,
    tasks,
    dietLogs,
    workoutPlans,
    specialDays,
    habitInsights,
    todayTasks,
    todayCompletionPct,
    todayDietSummary,
    activeReminders,
    categoryPeaks,
    taskSuggestions,
    streakDays,
    badges,
    dailyScore,
    signInWithGoogle,
    signInWithApple,
    signOutUser,
    updateSettings,
    addTask,
    updateTask,
    toggleTask,
    reorderTasks,
    deleteTask,
    applyAdaptiveTiming,
    optimizePendingRemindersWithAI,
    addDietLog,
    adjustWaterGlasses,
    deleteDietLog,
    saveWorkoutPlan,
    toggleWorkoutExercise,
    addSpecialDay,
    updateSpecialDay,
    deleteSpecialDay,
    saveHabitInsights,
    adoptHabitInsight,
    exportBackupJSON,
    importBackupJSON,
  };
}
