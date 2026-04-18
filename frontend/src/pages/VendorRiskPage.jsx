import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Shield,
  AlertTriangle,
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  IndianRupee,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  Target,
  Zap,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Eye,
} from 'lucide-react';
import { vendorRiskAPI } from '../services/api.js';
import StatCard from '../components/StatCard.jsx';
import toast from 'react-hot-toast';

function formatCurrency(value) {
  if (!value) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const RISK_CONFIG = {
  LOW: { color: 'success', bg: 'bg-success-100 text-success-700', label: 'Low Risk', icon: CheckCircle2 },
  MEDIUM: { color: 'warning', bg: 'bg-warning-100 text-warning-700', label: 'Medium Risk', icon: AlertTriangle },
  HIGH: { color: 'danger', bg: 'bg-danger-100 text-danger-700', label: 'High Risk', icon: AlertOctagon },
  CRITICAL: { color: 'danger', bg: 'bg-red-100 text-red-700', label: 'Critical', icon: XCircle },
};

const TREND_ICONS = {
  IMPROVING: { icon: TrendingDown, color: 'text-success-500', label: 'Improving' },
  STABLE: { icon: Minus, color: 'text-surface-400', label: 'Stable' },
  WORSENING: { icon: TrendingUp, color: 'text-danger-500', label: 'Worsening' },
};

function ScoreRing({ score, size = 56, strokeWidth = 5, color }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colorMap = {
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    primary: '#4f46e5',
  };
  const strokeColor = colorMap[color] || colorMap.primary;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-surface-800">{score}</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    info: 'bg-blue-500',
  };
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-surface-600 font-medium">{label}</span>
        <span className="text-surface-800 font-bold">{score}/100</span>
      </div>
      <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${colorMap[color]}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default function VendorRiskPage() {
  const [dashboard, setDashboard] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [riskFilter, setRiskFilter] = useState('ALL');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, vendorsRes] = await Promise.all([
        vendorRiskAPI.getDashboardStats(),
        vendorRiskAPI.getAll({ sort: 'overallScore', order: 'asc' }),
      ]);
      setDashboard(dashRes.data);
      setVendors(vendorsRes.data.vendors || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await vendorRiskAPI.runAnalysis();
      toast.success(`ML analysis complete! ${res.data.summary.total} vendors scored.`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredVendors = riskFilter === 'ALL'
    ? vendors
    : vendors.filter((v) => v.riskLevel === riskFilter);

  const getScoreColor = (score) => {
    if (score >= 70) return 'success';
    if (score >= 45) return 'warning';
    if (score >= 25) return 'danger';
    return 'danger';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-surface-500">Loading vendor risk data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Brain className="w-5 h-5 text-white" />
            </div>
            Vendor Risk Intelligence
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            AI-powered vendor behavior analysis &amp; ITC risk predictions
          </p>
        </div>

        <button onClick={handleAnalyze} disabled={analyzing}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
          id="run-analysis-btn">
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {analyzing ? 'Analyzing...' : 'Run ML Analysis'}
        </button>
      </div>

      {/* No data state */}
      {(!dashboard?.hasData) && (
        <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
          <Brain className="w-16 h-16 text-surface-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-surface-700 mb-2">No Risk Data Yet</h3>
          <p className="text-sm text-surface-400 mb-6 max-w-md mx-auto">
            Run the ML analysis to score your vendors based on reconciliation history. 
            You need reconciliation data first — upload Books and GSTR-2B files, then run reconciliation.
          </p>
          <button onClick={handleAnalyze} disabled={analyzing}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/25">
            {analyzing ? 'Analyzing...' : 'Run First Analysis'}
          </button>
        </div>
      )}

      {dashboard?.hasData && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-surface-100 rounded-xl w-fit">
            {[
              { id: 'overview', label: 'Risk Overview', icon: BarChart3 },
              { id: 'vendors', label: 'Vendor Scores', icon: Users },
              { id: 'predictions', label: 'Predictions', icon: Activity },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id ? 'bg-white text-purple-600 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                }`} id={`tab-${tab.id}`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ═══════ OVERVIEW TAB ═══════ */}
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Total Vendors" value={dashboard.summary.total} icon={Users} color="primary" delay={0} />
                  <StatCard title="Average Score" value={`${dashboard.summary.avgOverallScore}/100`} icon={Target} color={getScoreColor(dashboard.summary.avgOverallScore)} delay={1} />
                  <StatCard title="ITC at Risk" value={formatCurrency(dashboard.summary.totalItcAtRisk)} icon={IndianRupee} color="danger" delay={2} />
                  <StatCard title="Likely to Delay" value={dashboard.summary.vendorsLikelyToDelay} subtitle="vendors predicted" icon={Clock} color="warning" delay={3} />
                </div>

                {/* Risk Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Risk Tier Cards */}
                  <div className="bg-white rounded-2xl border border-surface-200 p-6">
                    <h3 className="font-semibold text-surface-800 mb-5">Risk Distribution</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { level: 'LOW', count: dashboard.summary.low, color: 'border-success-300 bg-success-50', textColor: 'text-success-700', dotColor: 'bg-success-500' },
                        { level: 'MEDIUM', count: dashboard.summary.medium, color: 'border-warning-300 bg-warning-50', textColor: 'text-warning-700', dotColor: 'bg-warning-500' },
                        { level: 'HIGH', count: dashboard.summary.high, color: 'border-danger-300 bg-danger-50', textColor: 'text-danger-700', dotColor: 'bg-danger-500' },
                        { level: 'CRITICAL', count: dashboard.summary.critical, color: 'border-red-300 bg-red-50', textColor: 'text-red-700', dotColor: 'bg-red-600' },
                      ].map((tier) => (
                        <div key={tier.level} className={`rounded-xl border ${tier.color} p-4`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${tier.dotColor}`} />
                            <span className={`text-xs font-semibold uppercase ${tier.textColor}`}>{tier.level}</span>
                          </div>
                          <p className={`text-3xl font-bold ${tier.textColor}`}>{tier.count}</p>
                          <p className="text-xs text-surface-400 mt-1">
                            {dashboard.summary.total > 0 ? Math.round((tier.count / dashboard.summary.total) * 100) : 0}% of vendors
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Score Dimensions */}
                  <div className="bg-white rounded-2xl border border-surface-200 p-6">
                    <h3 className="font-semibold text-surface-800 mb-5">Score Dimensions (Avg)</h3>
                    <div className="space-y-4">
                      <ScoreBar label="Compliance" score={dashboard.dimensionAverages?.compliance || 0} color="primary" />
                      <ScoreBar label="Reliability" score={dashboard.dimensionAverages?.reliability || 0} color="info" />
                      <ScoreBar label="Financial Impact" score={dashboard.dimensionAverages?.financialImpact || 0} color="warning" />
                      <ScoreBar label="Resolution Speed" score={dashboard.dimensionAverages?.resolution || 0} color="success" />
                    </div>
                    <div className="mt-5 pt-4 border-t border-surface-100 text-xs text-surface-400">
                      <p><strong>Weights:</strong> Compliance 35% · Reliability 25% · Financial 25% · Resolution 15%</p>
                    </div>
                  </div>
                </div>

                {/* Score Distribution Histogram */}
                {dashboard.scoreDistribution && (
                  <div className="bg-white rounded-2xl border border-surface-200 p-6">
                    <h3 className="font-semibold text-surface-800 mb-5">Score Distribution</h3>
                    <div className="flex items-end gap-2 h-32">
                      {dashboard.scoreDistribution.map((bucket, idx) => {
                        const maxCount = Math.max(...dashboard.scoreDistribution.map((b) => b.count), 1);
                        const height = (bucket.count / maxCount) * 100;
                        const colors = ['bg-red-400', 'bg-danger-400', 'bg-warning-400', 'bg-primary-400', 'bg-success-400'];
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs font-bold text-surface-700">{bucket.count}</span>
                            <motion.div
                              className={`w-full rounded-t-lg ${colors[idx]}`}
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(height, 4)}%` }}
                              transition={{ duration: 0.8, delay: idx * 0.1 }}
                            />
                            <span className="text-xs text-surface-400 mt-1">{bucket.range}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Top Risky Vendors */}
                {dashboard.topRiskyVendors?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-surface-100">
                      <h3 className="font-semibold text-surface-800">Vendors Needing Attention</h3>
                    </div>
                    <div className="divide-y divide-surface-100">
                      {dashboard.topRiskyVendors.map((v) => (
                        <div key={v.gstin} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-50/50 transition-colors">
                          <ScoreRing score={v.overallScore} size={44} color={getScoreColor(v.overallScore)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-surface-800 truncate">{v.partyName || v.gstin}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_CONFIG[v.riskLevel]?.bg}`}>
                                {v.riskLevel}
                              </span>
                            </div>
                            <p className="text-xs text-surface-400 mt-0.5 font-mono">{v.gstin}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-danger-600">{formatCurrency(v.itcAtRisk)}</p>
                            <p className="text-xs text-surface-400">ITC at risk</p>
                          </div>
                          <div className="text-right flex-shrink-0 w-20">
                            <p className="text-sm font-semibold text-warning-600">{Math.round(v.delayProbability * 100)}%</p>
                            <p className="text-xs text-surface-400">delay prob.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══════ VENDORS TAB ═══════ */}
            {activeTab === 'vendors' && (
              <motion.div key="vendors" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

                {/* Risk Filter */}
                <div className="flex gap-2">
                  {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => (
                    <button key={level} onClick={() => setRiskFilter(level)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        riskFilter === level
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                      }`}>
                      {level === 'ALL' ? `All (${vendors.length})` : `${level} (${vendors.filter((v) => v.riskLevel === level).length})`}
                    </button>
                  ))}
                </div>

                {/* Vendor Cards */}
                <div className="space-y-3">
                  {filteredVendors.map((vendor) => {
                    const isExpanded = expandedVendor === vendor.gstin;
                    const riskCfg = RISK_CONFIG[vendor.riskLevel] || RISK_CONFIG.MEDIUM;
                    const trendCfg = TREND_ICONS[vendor.metrics?.trendDirection] || TREND_ICONS.STABLE;
                    const TrendIcon = trendCfg.icon;

                    return (
                      <div key={vendor.gstin} className="bg-white rounded-2xl border border-surface-200 overflow-hidden hover:shadow-md transition-shadow">
                        {/* Vendor Header */}
                        <button
                          onClick={() => setExpandedVendor(isExpanded ? null : vendor.gstin)}
                          className="w-full px-6 py-4 flex items-center gap-4 text-left"
                        >
                          <ScoreRing score={vendor.scores?.overallScore || 0} size={48} color={getScoreColor(vendor.scores?.overallScore || 0)} />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-surface-800">{vendor.partyName || 'Unknown'}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${riskCfg.bg}`}>{riskCfg.label}</span>
                              <div className="flex items-center gap-1">
                                <TrendIcon className={`w-3.5 h-3.5 ${trendCfg.color}`} />
                                <span className={`text-xs ${trendCfg.color}`}>{trendCfg.label}</span>
                              </div>
                            </div>
                            <p className="text-xs text-surface-400 mt-0.5 font-mono">{vendor.gstin}</p>
                          </div>

                          <div className="hidden sm:flex items-center gap-6 text-right">
                            <div>
                              <p className="text-xs text-surface-400">Match Rate</p>
                              <p className="text-sm font-semibold text-surface-700">{Math.round((vendor.metrics?.matchRate || 0) * 100)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-surface-400">ITC Risk</p>
                              <p className="text-sm font-semibold text-danger-600">{formatCurrency(vendor.metrics?.totalItcAtRisk)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-surface-400">Delay</p>
                              <p className="text-sm font-semibold text-warning-600">{Math.round((vendor.predictions?.delayProbability || 0) * 100)}%</p>
                            </div>
                          </div>

                          <ChevronDown className={`w-5 h-5 text-surface-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Expanded Detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-5 pt-2 border-t border-surface-100">
                                {/* Score breakdown */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Score Breakdown</h4>
                                    <ScoreBar label="Compliance" score={vendor.scores?.complianceScore || 0} color="primary" />
                                    <ScoreBar label="Reliability" score={vendor.scores?.reliabilityScore || 0} color="info" />
                                    <ScoreBar label="Financial Impact" score={vendor.scores?.financialImpactScore || 0} color="warning" />
                                    <ScoreBar label="Resolution" score={vendor.scores?.resolutionScore || 0} color="success" />
                                  </div>
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Metrics</h4>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {[
                                        ['Total Invoices', vendor.metrics?.totalInvoices],
                                        ['Matched', vendor.metrics?.matchedInvoices],
                                        ['Mismatched', vendor.metrics?.mismatchedInvoices],
                                        ['Missing in 2B', vendor.metrics?.missingIn2B],
                                        ['Open Issues', vendor.metrics?.openIssues],
                                        ['Resolved Issues', vendor.metrics?.resolvedIssues],
                                        ['Avg Delay (days)', vendor.metrics?.avgUploadDelay],
                                        ['Avg Resolution', `${vendor.metrics?.avgResolutionDays}d`],
                                      ].map(([label, val]) => (
                                        <div key={label} className="flex justify-between py-1.5 px-2 rounded bg-surface-50">
                                          <span className="text-surface-500">{label}</span>
                                          <span className="font-semibold text-surface-700">{val}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Prediction & Action */}
                                <div className={`rounded-xl p-4 ${
                                  vendor.riskLevel === 'CRITICAL' || vendor.riskLevel === 'HIGH'
                                    ? 'bg-danger-50 border border-danger-200'
                                    : vendor.riskLevel === 'MEDIUM'
                                      ? 'bg-warning-50 border border-warning-200'
                                      : 'bg-success-50 border border-success-200'
                                }`}>
                                  <div className="flex items-start gap-3">
                                    <Zap className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                      vendor.riskLevel === 'LOW' ? 'text-success-500' : vendor.riskLevel === 'MEDIUM' ? 'text-warning-500' : 'text-danger-500'
                                    }`} />
                                    <div>
                                      <p className="text-sm font-semibold text-surface-800">
                                        {vendor.predictions?.likelyToDelay ? '⚠ Delay Predicted' : '✓ No Delay Expected'}
                                        {vendor.predictions?.delayProbability > 0.3 &&
                                          ` (${Math.round(vendor.predictions.delayProbability * 100)}% probability)`
                                        }
                                      </p>
                                      <p className="text-xs text-surface-600 mt-1">{vendor.predictions?.recommendedAction}</p>
                                      {vendor.predictions?.itcRiskNextPeriod > 0 && (
                                        <p className="text-xs text-danger-600 mt-1 font-medium">
                                          Predicted ITC risk next period: {formatCurrency(vendor.predictions.itcRiskNextPeriod)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {filteredVendors.length === 0 && (
                  <div className="bg-white rounded-2xl border border-surface-200 p-8 text-center">
                    <Shield className="w-10 h-10 text-surface-300 mx-auto mb-2" />
                    <p className="text-sm text-surface-500">No vendors match this filter.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══════ PREDICTIONS TAB ═══════ */}
            {activeTab === 'predictions' && (
              <motion.div key="predictions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

                {/* Delay Predictions */}
                <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-surface-100 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-warning-500" />
                    <h3 className="font-semibold text-surface-800">Delay Predictions</h3>
                    <span className="text-xs px-2.5 py-1 bg-warning-100 text-warning-700 rounded-full font-medium">
                      {dashboard.delayPredictions?.length || 0} vendors at risk
                    </span>
                  </div>

                  {dashboard.delayPredictions?.length > 0 ? (
                    <div className="divide-y divide-surface-100">
                      {dashboard.delayPredictions.map((v) => (
                        <div key={v.gstin} className="px-6 py-4 flex items-center gap-4">
                          <div className="relative w-12 h-12 flex items-center justify-center">
                            <svg width="48" height="48" className="transform -rotate-90">
                              <circle cx="24" cy="24" r="20" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                              <circle cx="24" cy="24" r="20" fill="none"
                                stroke={v.delayProbability > 0.7 ? '#ef4444' : v.delayProbability > 0.5 ? '#f59e0b' : '#6366f1'}
                                strokeWidth="4" strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 20}`}
                                strokeDashoffset={`${2 * Math.PI * 20 * (1 - v.delayProbability)}`}
                              />
                            </svg>
                            <span className="absolute text-xs font-bold text-surface-700">{Math.round(v.delayProbability * 100)}%</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-surface-800">{v.partyName || v.gstin}</p>
                            <p className="text-xs text-surface-400 font-mono">{v.gstin}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-warning-600">{v.estimatedDelay}d</p>
                            <p className="text-xs text-surface-400">est. delay</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-danger-600">{formatCurrency(v.itcRiskNextPeriod)}</p>
                            <p className="text-xs text-surface-400">ITC at risk</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <CheckCircle2 className="w-10 h-10 text-success-400 mx-auto mb-2" />
                      <p className="text-sm text-surface-500">No vendors predicted to delay. Great!</p>
                    </div>
                  )}
                </div>

                {/* ML Model Info */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-6">
                  <h3 className="font-semibold text-purple-900 flex items-center gap-2 mb-4">
                    <Brain className="w-5 h-5" />
                    ML Model Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div className="bg-white/60 rounded-xl p-4">
                      <p className="text-xs text-purple-600 font-semibold uppercase mb-2">Algorithm</p>
                      <p className="text-surface-800 font-medium">Weighted Multi-Factor Scoring + Logistic Regression</p>
                    </div>
                    <div className="bg-white/60 rounded-xl p-4">
                      <p className="text-xs text-purple-600 font-semibold uppercase mb-2">Features Used</p>
                      <p className="text-surface-800 font-medium">10-dimensional feature vector per vendor</p>
                    </div>
                    <div className="bg-white/60 rounded-xl p-4">
                      <p className="text-xs text-purple-600 font-semibold uppercase mb-2">Data Sources</p>
                      <p className="text-surface-800 font-medium">Reconciliation Results, Invoices, Issues</p>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-purple-500">
                    <p><strong>Scoring:</strong> Compliance (35%) · Reliability (25%) · Financial Impact (25%) · Resolution Speed (15%)</p>
                    <p className="mt-1"><strong>Prediction:</strong> Sigmoid-based delay probability using mismatch rate, upload delays, missing invoices, and trend analysis</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
