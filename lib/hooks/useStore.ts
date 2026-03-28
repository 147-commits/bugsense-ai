import { create } from 'zustand';
import { BugReport, DashboardStats, ProjectSummary } from '@/types';

interface AppState {
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Projects
  projects: ProjectSummary[];
  setProjects: (projects: ProjectSummary[]) => void;
  currentProject: ProjectSummary | null;
  setCurrentProject: (project: ProjectSummary | null) => void;

  // Bug Reports
  bugs: BugReport[];
  setBugs: (bugs: BugReport[]) => void;
  addBug: (bug: BugReport) => void;
  selectedBug: BugReport | null;
  setSelectedBug: (bug: BugReport | null) => void;

  // Analysis State
  isAnalyzing: boolean;
  setIsAnalyzing: (val: boolean) => void;
  analysisProgress: number;
  setAnalysisProgress: (val: number) => void;

  // Dashboard
  dashboardStats: DashboardStats | null;
  setDashboardStats: (stats: DashboardStats) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  projects: [],
  setProjects: (projects) => set({ projects }),
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),

  bugs: [],
  setBugs: (bugs) => set({ bugs }),
  addBug: (bug) => set((s) => ({ bugs: [bug, ...s.bugs] })),
  selectedBug: null,
  setSelectedBug: (bug) => set({ selectedBug: bug }),

  isAnalyzing: false,
  setIsAnalyzing: (val) => set({ isAnalyzing: val }),
  analysisProgress: 0,
  setAnalysisProgress: (val) => set({ analysisProgress: val }),

  dashboardStats: null,
  setDashboardStats: (stats) => set({ dashboardStats: stats }),

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
