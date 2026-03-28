import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

export function severityColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: 'badge-critical',
    HIGH: 'badge-high',
    MEDIUM: 'badge-medium',
    LOW: 'badge-low',
    INFO: 'badge-info',
  };
  return colors[severity] || 'badge-info';
}

export function severityDotColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-severity-critical',
    HIGH: 'bg-severity-high',
    MEDIUM: 'bg-severity-medium',
    LOW: 'bg-severity-low',
    INFO: 'bg-severity-info',
  };
  return colors[severity] || 'bg-severity-info';
}

export function priorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    P0: 'Blocker',
    P1: 'Critical',
    P2: 'Major',
    P3: 'Minor',
    P4: 'Trivial',
  };
  return labels[priority] || priority;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function getQualityScoreColor(score: number): string {
  if (score >= 80) return 'text-severity-low';
  if (score >= 60) return 'text-severity-medium';
  if (score >= 40) return 'text-severity-high';
  return 'text-severity-critical';
}

export function getQualityScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
}
