import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  EyeOff,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { issueAPI } from '../services/api';
import Badge from '../components/Badge.jsx';
import StatCard from '../components/StatCard.jsx';
import { TableSkeleton, CardSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import toast from 'react-hot-toast';

function formatCurrency(val) {
  if (!val) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function IssuesPage() {
  const [issues, setIssues] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [issuesResp, summaryResp] = await Promise.all([
        issueAPI.getAll({ ...(filter && { status: filter }), limit: 100 }),
        issueAPI.getSummary(),
      ]);
      setIssues(issuesResp.data.issues || []);
      setSummary(summaryResp.data.summary || {});
    } catch {
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (issueId, newStatus) => {
    try {
      await issueAPI.updateStatus(issueId, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      fetchData();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const viewTimeline = (issue) => {
    setSelectedIssue(issue);
    setShowTimeline(true);
  };

  const statusFilters = [
    { value: '', label: 'All Issues', icon: AlertTriangle },
    { value: 'OPEN', label: 'Open', icon: AlertTriangle },
    { value: 'FOLLOWED_UP', label: 'Followed Up', icon: Clock },
    { value: 'RESOLVED', label: 'Resolved', icon: CheckCircle2 },
    { value: 'IGNORED', label: 'Ignored', icon: EyeOff },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-surface-900">Issue Tracking</h1>
        <p className="text-sm text-surface-400 mt-1">Manage and track reconciliation issues</p>
      </motion.div>

      {/* Summary cards */}
      {summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Open Issues"
            value={summary.OPEN?.count || 0}
            subtitle={`ITC at risk: ${formatCurrency(summary.OPEN?.itcAtRisk)}`}
            icon={AlertTriangle}
            color="danger"
            delay={0}
          />
          <StatCard
            title="Followed Up"
            value={summary.FOLLOWED_UP?.count || 0}
            icon={Clock}
            color="info"
            delay={1}
          />
          <StatCard
            title="Resolved"
            value={summary.RESOLVED?.count || 0}
            icon={CheckCircle2}
            color="success"
            delay={2}
          />
          <StatCard
            title="Ignored"
            value={summary.IGNORED?.count || 0}
            icon={EyeOff}
            color="warning"
            delay={3}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 flex-wrap"
      >
        <Filter className="w-4 h-4 text-surface-400" />
        {statusFilters.map((sf) => (
          <button
            key={sf.value}
            onClick={() => setFilter(sf.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === sf.value
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white border border-surface-200 text-surface-500 hover:border-surface-300'
            }`}
          >
            <sf.icon className="w-3.5 h-3.5" />
            {sf.label}
          </button>
        ))}
      </motion.div>

      {/* Issues list */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 p-8">
          <EmptyState
            icon={AlertTriangle}
            title="No issues found"
            description={filter ? 'Try a different filter' : 'Run reconciliation to generate issues'}
          />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          {issues.map((issue, i) => (
            <motion.div
              key={issue._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="bg-white rounded-2xl border border-surface-200 p-5 hover:shadow-sm transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-mono text-sm font-semibold text-surface-700">{issue.gstin}</span>
                    <Badge status={issue.issueType} />
                    <Badge status={issue.status} />
                  </div>
                  <p className="text-sm text-surface-600 mb-1">
                    <span className="text-surface-400">Invoice:</span> {issue.invoiceNo || 'N/A'}
                    {issue.partyName && <> • <span className="text-surface-400">Party:</span> {issue.partyName}</>}
                  </p>
                  <p className="text-xs text-surface-400">{issue.description}</p>
                  {issue.itcAtRisk > 0 && (
                    <p className="text-xs text-danger-500 font-semibold mt-1">ITC at Risk: {formatCurrency(issue.itcAtRisk)}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => viewTimeline(issue)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 text-surface-500 hover:bg-surface-200 transition-colors"
                  >
                    Timeline
                  </button>

                  {/* Status dropdown */}
                  <div className="relative group">
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors">
                      Update <ChevronDown className="w-3 h-3" />
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-surface-200 shadow-lg py-1 z-10 w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      {['OPEN', 'FOLLOWED_UP', 'RESOLVED', 'IGNORED'].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(issue._id, s)}
                          className="w-full text-left px-3 py-2 text-xs text-surface-600 hover:bg-surface-50 transition-colors"
                        >
                          {s.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Timeline modal */}
      <Modal isOpen={showTimeline} onClose={() => setShowTimeline(false)} title="Issue Timeline">
        {selectedIssue && (
          <div className="space-y-4">
            <div className="mb-4">
              <p className="text-sm font-medium text-surface-700">{selectedIssue.invoiceNo || 'N/A'}</p>
              <p className="text-xs text-surface-400 font-mono">{selectedIssue.gstin}</p>
            </div>
            <div className="relative space-y-4 pl-6 border-l-2 border-surface-200">
              {(selectedIssue.timeline || []).map((entry, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-primary-500 border-2 border-white" />
                  <p className="text-sm font-medium text-surface-700">{entry.action}</p>
                  <p className="text-xs text-surface-400">
                    {new Date(entry.date).toLocaleString()} • <Badge status={entry.status} />
                  </p>
                  {entry.note && <p className="text-xs text-surface-500 mt-1">{entry.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
