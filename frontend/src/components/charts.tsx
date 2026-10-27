'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const AXIS = { fontSize: 11, fill: '#A89EA1', fontFamily: 'var(--font-mono)' };

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong !rounded-xl px-3 py-2 text-xs">
      {label && <p className="mb-1 font-mono text-fog">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2 text-bone">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <span className="font-semibold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

const SERIES = [
  { key: 'lead', name: 'Leads', color: '#D64545' },
  { key: 'email', name: 'Emails', color: '#F2B8B5' },
  { key: 'document', name: 'Documents', color: '#7A0E0E' },
];

export function ActivityChart({ data }: { data: { label: string; lead: number; email: number; document: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 16, left: -24, bottom: 0 }}>
        <defs>
          {SERIES.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip content={<GlassTooltip />} cursor={{ stroke: 'rgba(242,184,181,0.25)' }} />
        {SERIES.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stackId="1" stroke={s.color} strokeWidth={2}
            fill={`url(#fill-${s.key})`} animationDuration={1200} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const QUALITY_COLORS: Record<string, string> = { High: '#D64545', Medium: '#C98F8F', Low: '#3A2D31' };

export function QualityDonut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="92%" paddingAngle={3}
          stroke="none" cornerRadius={6} animationDuration={1100}>
          {data.map((d) => <Cell key={d.name} fill={QUALITY_COLORS[d.name]} />)}
        </Pie>
        <Tooltip content={<GlassTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryBars({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bar-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7A0E0E" />
            <stop offset="100%" stopColor="#F2B8B5" />
          </linearGradient>
        </defs>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={84} tick={{ ...AXIS, fill: '#F4ECEC' }} axisLine={false} tickLine={false} />
        <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="value" name="Emails" fill="url(#bar-fill)" radius={[0, 8, 8, 0]} barSize={12} animationDuration={1100} />
      </BarChart>
    </ResponsiveContainer>
  );
}
