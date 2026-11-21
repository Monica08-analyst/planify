import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckSquare,
  Cloud,
  Dumbbell,
  Gift,
  Home,
  Menu,
  Plus,
  Search,
  Settings,
  Utensils,
  X,
} from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { DietActivityView } from './components/DietActivityView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeDashboard } from './components/HomeDashboard';
import { MyTasksView } from './components/MyTasksView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { ProgressView } from './components/ProgressView';
import { SettingsView } from './components/SettingsView';
import { SpecialDaysView } from './components/SpecialDaysView';
import { TaskModal } from './components/TaskModal';
import { WorkoutAIView } from './components/WorkoutAIView';
import { usePlannerStore } from './hooks/usePlannerStore';
import { todayISO } from './lib/dateUtils';
import type { PlannerTask, TabId } from './types';

const NAV_ITEMS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'diet', label: 'Diet & Activity', icon: Utensils },
  { id: 'workout', label: 'Workout AI', icon: Dumbbell },
  { id: 'gifts', label: 'Special Days', icon: Gift },
  { id: 'progress', label: 'My Progress', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function AppShell() {
  const store = usePlannerStore();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [globalSearch, setGlobalSearch] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalVoice, setTaskModalVoice] = useState(false);
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const openNewTask = (voice = false) => {
    setEditingTask(null);
    setTaskModalVoice(voice);
    setTaskModalOpen(true);
  };

  const openEditTask = (task: PlannerTask) => {
    setEditingTask(task);
    setTaskModalVoice(false);
    setTaskModalOpen(true);
  };

  const recentWorkoutContext = useMemo(() => {
    return `Completion rate: ${store.todayCompletionPct}%, Active streak: ${store.streakDays} days, Today active minutes: ${store.todayDietSummary.activeMinutes}, Today intake: ${store.todayDietSummary.intakeCalories} kcal.`;
  }, [
    store.todayCompletionPct,
    store.streakDays,
    store.todayDietSummary.activeMinutes,
    store.todayDietSummary.intakeCalories,
  ]);

  const currentTabTitle =
    NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Home';

  return (
    <div className="min-h-screen bg-[#F6F5F0] dark:bg-[#121513] text-[#1C211E] dark:text-[#F0F2EF] flex">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-[#E6E4DC] dark:border-[#2A302C] bg-white dark:bg-[#1B1F1C] sticky top-0 h-screen">
        <div className="px-6 py-5 border-b border-[#EFEDE6] dark:border-[#2A302C]">
          <span className="font-display text-xl font-semibold tracking-tight whitespace-nowrap">
            Verdant Day
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#E9EFE9] dark:bg-[#243227] text-[#3A5A40] dark:text-[#74A17B]'
                    : 'text-[#5B635E] dark:text-[#9BA39D] hover:bg-[#F6F5F0] dark:hover:bg-[#232824] hover:text-[#1C211E] dark:hover:text-[#F0F2EF]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#EFEDE6] dark:border-[#2A302C] space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[#5B635E] dark:text-[#9BA39D]">
            <span>{store.settings.tierPreview === 'pro' ? 'Pro Studio' : 'Free Preview'}</span>
            <span className="capitalize">
              {store.user ? `Cloud ${store.syncStatus}` : 'Local offline'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-xs font-medium hover:bg-[#F6F5F0] dark:hover:bg-[#232824] transition-colors"
          >
            <Cloud className="w-3.5 h-3.5 text-[#3A5A40] dark:text-[#74A17B] shrink-0" />
            <span className="truncate">
              {store.user ? store.user.displayName || store.user.email : 'Sign In for Cloud Sync'}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (3-zone layout, <=56px on mobile) */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-[#F6F5F0]/90 dark:bg-[#121513]/90 backdrop-blur-md border-b border-[#E6E4DC] dark:border-[#2A302C] px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden font-display text-lg font-semibold tracking-tight whitespace-nowrap">
              Verdant Day
            </span>
            <span className="hidden lg:inline text-sm font-medium text-[#5B635E] dark:text-[#9BA39D] whitespace-nowrap">
              Workspace / <span className="text-[#1C211E] dark:text-[#F0F2EF]">{currentTabTitle}</span>
            </span>
          </div>

          <div className="hidden md:flex items-center flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[#5B635E] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  if (e.target.value && activeTab !== 'tasks') {
                    setActiveTab('tasks');
                  }
                }}
                placeholder="Search tasks..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#1B1F1C] border border-[#E6E4DC] dark:border-[#2A302C] text-xs focus:outline-none focus:ring-2 focus:ring-[#3A5A40]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton compact />
            </div>
            <button
              type="button"
              onClick={() => openNewTask(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3A5A40] text-white text-xs font-medium hover:bg-[#588157] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          {activeTab === 'home' && (
            <HomeDashboard
              dailyScore={store.dailyScore}
              streakDays={store.streakDays}
              todayCompletionPct={store.todayCompletionPct}
              todayTasks={store.todayTasks}
              allTasks={store.tasks}
              todayDietSummary={store.todayDietSummary}
              settings={store.settings}
              activeReminders={store.activeReminders}
              categoryPeaks={store.categoryPeaks}
              specialDays={store.specialDays}
              workoutPlans={store.workoutPlans}
              onNavigate={setActiveTab}
              onToggleTask={store.toggleTask}
              onOpenNewTask={openNewTask}
              onAdjustWater={(delta) => store.adjustWaterGlasses(todayISO(), delta)}
              onToggleProPreview={() =>
                store.updateSettings({
                  tierPreview: store.settings.tierPreview === 'pro' ? 'free' : 'pro',
                })
              }
              onApplyAdaptiveTiming={store.applyAdaptiveTiming}
              onOptimizeAllReminders={store.optimizePendingRemindersWithAI}
            />
          )}

          {activeTab === 'tasks' && (
            <MyTasksView
              tasks={store.tasks}
              taskSuggestions={store.taskSuggestions}
              globalSearch={globalSearch}
              onGlobalSearchChange={setGlobalSearch}
              onToggleTask={store.toggleTask}
              onDeleteTask={store.deleteTask}
              onReorderTasks={store.reorderTasks}
              onOpenNewTask={openNewTask}
              onEditTask={openEditTask}
              onApplyAdaptiveTiming={store.applyAdaptiveTiming}
            />
          )}

          {activeTab === 'diet' && (
            <DietActivityView
              logs={store.dietLogs}
              settings={store.settings}
              onAddLog={store.addDietLog}
              onAdjustWater={store.adjustWaterGlasses}
              onDeleteLog={store.deleteDietLog}
            />
          )}

          {activeTab === 'workout' && (
            <WorkoutAIView
              workoutPlans={store.workoutPlans}
              recentSummary={recentWorkoutContext}
              onSaveWorkoutPlan={store.saveWorkoutPlan}
              onToggleExercise={store.toggleWorkoutExercise}
              onScheduleAsTask={(task) => store.addTask(task, false)}
            />
          )}

          {activeTab === 'gifts' && (
            <SpecialDaysView
              specialDays={store.specialDays}
              onAddSpecialDay={store.addSpecialDay}
              onUpdateSpecialDay={store.updateSpecialDay}
              onDeleteSpecialDay={store.deleteSpecialDay}
            />
          )}

          {activeTab === 'progress' && (
            <ProgressView
              tasks={store.tasks}
              dietLogs={store.dietLogs}
              badges={store.badges}
              streakDays={store.streakDays}
              habitInsights={store.habitInsights}
              settings={store.settings}
              onSaveHabitInsights={store.saveHabitInsights}
              onAdoptHabit={store.adoptHabitInsight}
              onToggleProPreview={() =>
                store.updateSettings({
                  tierPreview: store.settings.tierPreview === 'pro' ? 'free' : 'pro',
                })
              }
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              user={store.user}
              syncStatus={store.syncStatus}
              settings={store.settings}
              onUpdateSettings={store.updateSettings}
              onOpenAuth={() => setAuthModalOpen(true)}
              onExportBackup={store.exportBackupJSON}
              onImportBackup={store.importBackupJSON}
              onShowToast={store.showToast}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Thumb Zone, compact height <= 60px) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1B1F1C]/95 backdrop-blur-md border-t border-[#E6E4DC] dark:border-[#2A302C] grid grid-cols-5 h-15 pb-safe"
        aria-label="Mobile Navigation"
      >
        {(
          [
            { id: 'home', label: 'Home', icon: Home },
            { id: 'tasks', label: 'Tasks', icon: CheckSquare },
            { id: 'diet', label: 'Diet', icon: Utensils },
            { id: 'progress', label: 'Progress', icon: BarChart3 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMoreOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active
                  ? 'text-[#3A5A40] dark:text-[#74A17B]'
                  : 'text-[#5B635E] dark:text-[#9BA39D]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMoreOpen((v) => !v)}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            ['workout', 'gifts', 'settings'].includes(activeTab)
              ? 'text-[#3A5A40] dark:text-[#74A17B]'
              : 'text-[#5B635E] dark:text-[#9BA39D]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile More Drawer */}
      {mobileMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end">
          <div className="w-full rounded-t-3xl bg-white dark:bg-[#1B1F1C] border-t border-[#E6E4DC] dark:border-[#2A302C] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Studio Tools</h3>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                className="p-2 rounded-xl text-[#5B635E]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  { id: 'workout', label: 'Workout AI Studio', icon: Dumbbell },
                  { id: 'gifts', label: 'Special Days & Gifting', icon: Gift },
                  { id: 'settings', label: 'Settings & Cloud Sync', icon: Settings },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMoreOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F6F5F0] dark:bg-[#121513] text-sm font-medium"
                  >
                    <Icon className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMobileMoreOpen(false);
                  setAuthModalOpen(true);
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E6E4DC] dark:border-[#2A302C] text-sm font-medium"
              >
                <Cloud className="w-4 h-4 text-[#3A5A40] dark:text-[#74A17B]" />
                <span>
                  {store.user ? 'Manage Cloud Account' : 'Sign In (Google / Apple)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals & Status */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={store.user}
        authError={store.authError}
        onClearError={store.clearAuthError}
        onGoogleSignIn={store.signInWithGoogle}
        onAppleSignIn={store.signInWithApple}
        onSignOut={store.signOutUser}
      />

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        defaultLeadMinutes={store.settings.defaultReminderLeadMinutes}
        initialTask={editingTask}
        autoStartVoice={taskModalVoice}
        tasks={store.tasks}
        dietLogs={store.dietLogs}
        settings={store.settings}
        onSave={async (data, usedVoice) => {
          if (editingTask) {
            await store.updateTask(editingTask.id, data);
          } else {
            await store.addTask(data, usedVoice);
          }
        }}
      />

      <OfflineIndicator />

      {store.toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#1C211E] dark:bg-[#F0F2EF] text-white dark:text-[#121513] text-xs font-medium shadow-lg"
        >
          {store.toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
