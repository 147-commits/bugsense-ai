'use client';

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid #27272a',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '12px',
  color: '#fafafa',
};

const gridColor = '#27272a';
const tickStyle = { fontSize: 11, fill: '#71717a' };

// Bug Trend Chart — clean line chart, 2 colors only
export function BugTrendChart({ data }: { data: { date: string; bugs: number; resolved: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={tickStyle} />
        <YAxis axisLine={false} tickLine={false} tick={tickStyle} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="bugs" stroke="#fafafa" strokeWidth={1.5} dot={false} name="New Bugs" />
        <Line type="monotone" dataKey="resolved" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Resolved" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Severity Distribution Pie
export function SeverityPieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          verticalAlign="bottom"
          formatter={(value: string) => <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Module Bar Chart — all bars same color
export function ModuleBarChart({ data }: { data: { module: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
        <XAxis type="number" axisLine={false} tickLine={false} tick={tickStyle} />
        <YAxis dataKey="module" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} width={110} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#3f3f46" name="Bug Count" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Quality Radar Chart
export function QualityRadarChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([key, val]) => ({
    subject: key.charAt(0).toUpperCase() + key.slice(1),
    score: val,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke={gridColor} />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#71717a' }} />
        <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={1.5} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// Mini Sparkline — kept for backward compat but simplified
export function Sparkline({ data, color = '#3b82f6', height = 40 }: { data: number[]; color?: string; height?: number }) {
  const chartData = data.map((val, i) => ({ x: i, y: val }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
