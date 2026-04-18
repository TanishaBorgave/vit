import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  IndianRupee,
  TrendingUp,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { dashboardAPI } from '../services/api';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import { CardSkeleton, ChartSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  MATCHED: '#22c55e',
  MISMATCH: '#ef4444',
  MISSING_IN_2B: '#f59e0b',
  MISSING_IN_BOOKS: '#f97316',
};

const STATUS_LABELS = {
  MATCHED: 'Matched',
  MISMATCH: 'Mismatch',
  MISSING_IN_2B: 'Missing in 2B',
  MISSING_IN_BOOKS: 'Missing in Books',
};

function formatCurrency(val) {
  if (val === undefined || val === null) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data: resp } = await dashboardAPI.getStats();
      setData(resp);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-surface-900">Dashboard</h1></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const pieData = (data?.statusDistribution || []).map((s) => ({
    name: STATUS_LABELS[s._id] || s._id,
    value: s.count,
    color: STATUS_COLORS[s._id] || '#94a3b8',
  }));

  const barData = (data?.gstinImpact || []).map((g) => ({
    name: g._id?.slice(-4) || 'N/A',
    fullGstin: g._id,
    partyName: g.partyName || 'Unknown',
    itcAtRisk: g.itcAtRisk || 0,
    issues: g.issueCount || 0,
  }));

  if (stats.totalInvoices === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
        <div className="bg-white rounded-2xl border border-surface-200 p-8">
          <EmptyState
            icon={TrendingUp}
            title="No reconciliation data yet"
            description="Upload your Books and GSTR-2B files, then run reconciliation to see your dashboard come alive."
            action={
              <a href="/upload" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors">
                Upload Files
              </a>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
        <p className="text-sm text-surface-400 mt-1">Overview of your GST reconciliation status</p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Invoices"
          value={stats.totalInvoices?.toLocaleString() || '0'}
          icon={FileText}
          color="primary"
          delay={0}
        />
        <StatCard
          title="Matched"
          value={stats.matched?.toLocaleString() || '0'}
          subtitle={stats.totalInvoices ? `${((stats.matched / stats.totalInvoices) * 100).toFixed(1)}%` : '0%'}
          icon={CheckCircle2}
          color="success"
          delay={1}
        />
        <StatCard
          title="Mismatched"
          value={stats.mismatched?.toLocaleString() || '0'}
          icon={XCircle}
          color="danger"
          delay={2}
        />
        <StatCard
          title="Missing"
          value={((stats.missingIn2B || 0) + (stats.missingInBooks || 0)).toLocaleString()}
          subtitle={`2B: ${stats.missingIn2B || 0} | Books: ${stats.missingInBooks || 0}`}
          icon={AlertTriangle}
          color="warning"
          delay={3}
        />
        <StatCard
          title="ITC at Risk"
          value={formatCurrency(stats.totalItcAtRisk)}
          icon={IndianRupee}
          color="danger"
          delay={4}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-surface-200 p-6"
        >
          <h3 className="text-sm font-semibold text-surface-700 mb-6">Status Distribution</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: 'none',
                      borderRadius: '12px',
                      color: '#f1f5f9',
                      fontSize: '13px',
                      padding: '8px 12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-shrink-0">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: entry.color }} />
                    <span className="text-xs text-surface-500">{entry.name}</span>
                    <span className="text-xs font-semibold text-surface-700 ml-auto">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-12">No data available</p>
          )}
        </motion.div>

        {/* Bar Chart - GSTIN Impact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-surface-200 p-6"
        >
          <h3 className="text-sm font-semibold text-surface-700 mb-6">GSTIN-wise ITC at Risk (Top 10)</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#f1f5f9',
                    fontSize: '13px',
                    padding: '8px 12px',
                  }}
                  formatter={(val) => [formatCurrency(val), 'ITC at Risk']}
                  labelFormatter={(label, payload) => payload[0]?.payload?.fullGstin || label}
                />
                <Bar dataKey="itcAtRisk" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-surface-400 text-center py-12">No issues found</p>
          )}
        </motion.div>
      </div>

      {/* Recent uploads */}
      {data?.recentUploads?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl border border-surface-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-surface-100">
            <h3 className="text-sm font-semibold text-surface-700">Recent Uploads</h3>
          </div>
          <div className="divide-y divide-surface-100">
            {data.recentUploads.map((upload) => (
              <div key={upload._id} className="px-6 py-3 flex items-center gap-4 text-sm">
                <FileText className="w-4 h-4 text-surface-400" />
                <span className="text-surface-700 font-medium">{upload.originalName}</span>
                <Badge status={upload.fileType === 'books' ? 'MATCHED' : 'MISSING_IN_2B'} />
                <span className="text-surface-400 ml-auto">{upload.rowCount} rows</span>
                <span className="text-surface-300 text-xs">{new Date(upload.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
