import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  CheckCheck,
  Mail,
  FileText,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { partyAPI, issueAPI } from '../services/api';
import Badge from '../components/Badge.jsx';
import StatCard from '../components/StatCard.jsx';
import { CardSkeleton, TableSkeleton } from '../components/Skeleton.jsx';
import toast from 'react-hot-toast';

function formatCurrency(val) {
  if (!val) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const TONE_OPTIONS = [
  { value: 'formal', label: 'Formal' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'concise', label: 'Concise' },
];

export default function PartyDetailPage() {
  const { gstin } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [emailGenerating, setEmailGenerating] = useState(false);
  const [selectedTone, setSelectedTone] = useState('formal');

  useEffect(() => {
    fetchPartyDetail();
  }, [gstin]);

  const fetchPartyDetail = async () => {
    try {
      const { data: resp } = await partyAPI.getDetail(gstin);
      setData(resp);
    } catch {
      toast.error('Failed to load party details');
    } finally {
      setLoading(false);
    }
  };

  const copyEmail = () => {
    if (data?.emailTemplate) {
      navigator.clipboard.writeText(data.emailTemplate);
      setCopied(true);
      toast.success('Email template copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const regenerateEmail = async () => {
    setEmailGenerating(true);
    try {
      const { data: resp } = await partyAPI.regenerateEmail(gstin, selectedTone);
      setData((prev) => ({ ...prev, emailTemplate: resp.emailTemplate }));
      toast.success('Email regenerated with AI');
    } catch {
      toast.error('Failed to regenerate email');
    } finally {
      setEmailGenerating(false);
    }
  };

  const markFollowedUp = async (issueId) => {
    try {
      await issueAPI.updateStatus(issueId, { status: 'FOLLOWED_UP', note: 'Email sent to party' });
      toast.success('Marked as followed up');
      fetchPartyDetail();
    } catch {
      toast.error('Failed to update');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/parties')} className="p-2 rounded-lg hover:bg-surface-100">
            <ArrowLeft className="w-5 h-5 text-surface-500" />
          </button>
          <div className="skeleton h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-surface-500">No data found for this GSTIN</p>
        <button onClick={() => navigate('/parties')} className="mt-4 text-primary-600 text-sm font-medium">
          ← Back to parties
        </button>
      </div>
    );
  }

  const { summary, results, issues, emailTemplate } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <button onClick={() => navigate('/parties')} className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 font-mono">{summary.gstin}</h1>
          {summary.partyName && <p className="text-sm text-surface-400 mt-0.5">{summary.partyName}</p>}
        </div>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Invoices" value={summary.totalInvoices} icon={FileText} color="primary" delay={0} />
        <StatCard title="Matched" value={summary.matched} icon={CheckCircle2} color="success" delay={1} />
        <StatCard title="Issues" value={summary.mismatched + summary.missingIn2B + summary.missingInBooks} icon={AlertTriangle} color="warning" delay={2} />
        <StatCard title="ITC at Risk" value={formatCurrency(summary.totalItcAtRisk)} icon={IndianRupee} color="danger" delay={3} />
      </div>

      {/* AI-Generated Email template */}
      {(emailTemplate || emailGenerating) && (summary.missingIn2B > 0 || summary.mismatched > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-surface-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-surface-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary-500" />
              <h3 className="text-sm font-semibold text-surface-700">AI-Powered Follow-up Email</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 border border-purple-200/50">
                <Sparkles className="w-3 h-3" />
                Gemini AI
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Copy button */}
              <button
                onClick={copyEmail}
                disabled={emailGenerating || !emailTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Email'}
              </button>
            </div>
          </div>
          <div className="p-6">
            {emailGenerating ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-surface-100 rounded w-3/4" />
                <div className="h-4 bg-surface-100 rounded w-full" />
                <div className="h-4 bg-surface-100 rounded w-5/6" />
                <div className="h-4 bg-surface-100 rounded w-2/3" />
                <div className="h-4 bg-surface-100 rounded w-full" />
                <div className="h-4 bg-surface-100 rounded w-4/5" />
                <div className="h-4 bg-surface-100 rounded w-1/2" />
                <p className="text-xs text-surface-400 text-center pt-2 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Gemini AI is crafting a personalized email...
                </p>
              </div>
            ) : (
              <pre className="text-xs text-surface-600 whitespace-pre-wrap font-mono leading-relaxed bg-surface-50 p-4 rounded-xl max-h-64 overflow-y-auto">
                {emailTemplate}
              </pre>
            )}
          </div>
        </motion.div>
      )}

      {/* Issues with actions */}
      {issues?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-surface-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-surface-100">
            <h3 className="text-sm font-semibold text-surface-700">Issues ({issues.length})</h3>
          </div>
          <div className="divide-y divide-surface-100">
            {issues.map((issue) => (
              <div key={issue._id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-surface-700">{issue.invoiceNo || 'N/A'}</span>
                    <Badge status={issue.issueType} />
                    <Badge status={issue.status} />
                  </div>
                  <p className="text-xs text-surface-400">{issue.description}</p>
                  {issue.itcAtRisk > 0 && (
                    <p className="text-xs text-danger-500 font-medium mt-1">ITC at risk: {formatCurrency(issue.itcAtRisk)}</p>
                  )}
                </div>
                {issue.status === 'OPEN' && (
                  <button
                    onClick={() => markFollowedUp(issue._id)}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-info-50 text-info-600 hover:bg-info-100 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark Followed Up
                  </button>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Results table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl border border-surface-200 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-surface-100">
          <h3 className="text-sm font-semibold text-surface-700">All Invoices</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Invoice No</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Date</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Books</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">GST</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Diff</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {results.map((r) => (
                <tr key={r._id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-surface-700">{r.invoiceNo || '-'}</td>
                  <td className="px-5 py-3 text-surface-500">
                    {r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString('en-IN') : '-'}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-surface-600">{formatCurrency(r.bookAmount)}</td>
                  <td className="px-5 py-3 text-right font-mono text-surface-600">{formatCurrency(r.gstAmount)}</td>
                  <td className={`px-5 py-3 text-right font-mono font-medium ${
                    r.amountDifference > 0 ? 'text-danger-600' : r.amountDifference < 0 ? 'text-warning-600' : 'text-surface-400'
                  }`}>
                    {r.amountDifference !== 0 ? formatCurrency(Math.abs(r.amountDifference)) : '-'}
                  </td>
                  <td className="px-5 py-3 text-center"><Badge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

