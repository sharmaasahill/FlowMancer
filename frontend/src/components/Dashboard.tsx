'use client';

import { useEffect, useState } from 'react';
import { Activity, Zap, TrendingUp, Clock } from 'lucide-react';
import { workflowsApi } from '@/lib/api';
import type { Workflow } from '@/types';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: string;
}

function StatCard({ title, value, icon, trend, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {trend && (
            <p className="text-sm text-green-600 mt-1">
              <TrendingUp className="inline w-4 h-4" /> {trend}
            </p>
          )}
        </div>
        <div className="text-4xl opacity-80" style={{ color }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const response = await workflowsApi.list();
      setWorkflows(response.data);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalWorkflows: workflows.length,
    activeWorkflows: workflows.filter(w => w.is_active).length,
    totalExecutions: 245, // Mock data
    avgResponseTime: '2.3s', // Mock data
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to FlowMancer - AI-Powered Automation</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Workflows"
          value={stats.totalWorkflows}
          icon={<Zap />}
          trend="+12% this month"
          color="#0ea5e9"
        />
        <StatCard
          title="Active Workflows"
          value={stats.activeWorkflows}
          icon={<Activity />}
          color="#10b981"
        />
        <StatCard
          title="Total Executions"
          value={stats.totalExecutions}
          icon={<TrendingUp />}
          trend="+25% this week"
          color="#8b5cf6"
        />
        <StatCard
          title="Avg Response Time"
          value={stats.avgResponseTime}
          icon={<Clock />}
          color="#f59e0b"
        />
      </div>

      {/* Recent Workflows */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Recent Workflows</h2>
        {loading ? (
          <p className="text-gray-600">Loading workflows...</p>
        ) : workflows.length === 0 ? (
          <p className="text-gray-600">No workflows yet. Create your first workflow!</p>
        ) : (
          <div className="space-y-3">
            {workflows.slice(0, 5).map((workflow) => (
              <div
                key={workflow.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
              >
                <div>
                  <h3 className="font-semibold">{workflow.name}</h3>
                  <p className="text-sm text-gray-600">{workflow.workflow_type}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    workflow.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {workflow.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Ready to Automate?</h2>
        <p className="mb-4">Create intelligent workflows powered by AI agents</p>
        <div className="flex gap-4">
          <button className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition">
            Create Workflow
          </button>
          <button className="border-2 border-white px-6 py-2 rounded-lg font-semibold hover:bg-white/10 transition">
            View Documentation
          </button>
        </div>
      </div>
    </div>
  );
}

