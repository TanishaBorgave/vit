import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  FileSpreadsheet,
  Trash2,
  Clock,
  HardDrive,
  FileCheck,
  Loader2,
  Calendar,
  BarChart3,
  RefreshCw,
  Search,
  Filter,
  Eye,
  ArrowDownToLine,
  History,
  ChevronDown,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { returnsAPI } from '../services/api.js';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import toast from 'react-hot-toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value) {
  if (value === undefined || value === null) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

export default function ExportCenterPage() {
  const [exports, setExports] = useState([]);
  const [returnHistory, setReturnHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [activeTab, setActiveTab] = useState('exports');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [exportsRes, historyRes] = await Promise.all([
        returnsAPI.getExports(),
        returnsAPI.getHistory(),
      ]);
      setExports(exportsRes.data.exports || []);
      setReturnHistory(historyRes.data.returns || []);
    } catch (err) {
      toast.error('Failed to fetch export data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownload = async (exportItem) => {
    setDownloading(exportItem._id);
    try {
      const res = await returnsAPI.downloadExport(exportItem._id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', exportItem.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started!');
      fetchData(); // Refresh download count
    } catch (err) {
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (exportItem) => {
    if (!confirm(`Delete "${exportItem.fileName}"? This cannot be undone.`)) return;
    setDeleting(exportItem._id);
    try {
      await returnsAPI.deleteExport(exportItem._id);
      toast.success('Export deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete export');
    } finally {
      setDeleting(null);
    }
  };

  // Filters
  const filteredExports = exports.filter((exp) => {
    const matchesSearch =
      !searchQuery ||
      exp.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      filterType === 'ALL' || exp.exportType === filterType;
    return matchesSearch && matchesType;
  });

  // Stats
  const totalExports = exports.length;
  const totalDownloads = exports.reduce((sum, e) => sum + (e.downloadCount || 0), 0);
  const totalSize = exports.reduce((sum, e) => sum + (e.fileSize || 0), 0);
  const gstr1Count = exports.filter((e) => e.exportType === 'GSTR1_EXCEL').length;
  const gstr3bCount = exports.filter(
    (e) => e.exportType === 'GSTR3B_EXCEL' || e.exportType === 'GSTR3B_SUMMARY'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Download className="w-5 h-5 text-white" />
            </div>
            Export Center
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            Download and manage your GST return files
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-900 text-white rounded-xl text-sm font-medium transition-all shadow-lg disabled:opacity-50"
          id="refresh-exports-btn"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Exports"
          value={totalExports}
          subtitle={`GSTR-1: ${gstr1Count} | GSTR-3B: ${gstr3bCount}`}
          icon={Package}
          color="primary"
          delay={0}
        />
        <StatCard
          title="Total Downloads"
          value={totalDownloads}
          subtitle="Across all files"
          icon={ArrowDownToLine}
          color="success"
          delay={1}
        />
        <StatCard
          title="Storage Used"
          value={formatFileSize(totalSize)}
          subtitle={`${totalExports} files`}
          icon={HardDrive}
          color="info"
          delay={2}
        />
        <StatCard
          title="Return History"
          value={returnHistory.length}
          subtitle="Periods processed"
          icon={History}
          color="warning"
          delay={3}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('exports')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'exports'
              ? 'bg-white text-surface-800 shadow-sm'
              : 'text-surface-500 hover:text-surface-700'
          }`}
          id="tab-exports"
        >
          Export Files ({totalExports})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'history'
              ? 'bg-white text-surface-800 shadow-sm'
              : 'text-surface-500 hover:text-surface-700'
          }`}
          id="tab-history"
        >
          Return History ({returnHistory.length})
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'exports' ? (
          <motion.div
            key="exports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search exports..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                  id="export-search-input"
                />
              </div>
              <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-3">
                <Filter className="w-4 h-4 text-surface-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-sm text-surface-700 bg-transparent border-none outline-none py-2.5 cursor-pointer"
                  id="export-filter-select"
                >
                  <option value="ALL">All Types</option>
                  <option value="GSTR1_EXCEL">GSTR-1 Only</option>
                  <option value="GSTR3B_EXCEL">GSTR-3B Only</option>
                </select>
              </div>
            </div>

            {/* Export List */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            ) : filteredExports.length === 0 ? (
              <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet className="w-8 h-8 text-surface-300" />
                </div>
                <h3 className="text-lg font-semibold text-surface-700 mb-2">No Exports Yet</h3>
                <p className="text-sm text-surface-400 max-w-md mx-auto">
                  Generate your first GST return file from the Return Preparation page. Your exported files will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredExports.map((exp, index) => (
                  <motion.div
                    key={exp._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-2xl border border-surface-200 p-5 hover:shadow-lg hover:border-surface-300 transition-all group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          exp.exportType === 'GSTR1_EXCEL'
                            ? 'bg-gradient-to-br from-primary-400 to-primary-600'
                            : 'bg-gradient-to-br from-purple-400 to-purple-600'
                        }`}>
                          <FileSpreadsheet className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-surface-800 text-sm truncate">{exp.fileName}</h3>
                            <Badge status={exp.exportType} />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-surface-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {MONTH_SHORT[(exp.period?.month || 1) - 1]} {exp.period?.year}
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatFileSize(exp.fileSize)}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileCheck className="w-3 h-3" />
                              {exp.invoiceCount} invoices
                            </span>
                            <span className="flex items-center gap-1">
                              <ArrowDownToLine className="w-3 h-3" />
                              {exp.downloadCount || 0} downloads
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(exp.createdAt)}
                            </span>
                            {exp.version > 1 && (
                              <span className="text-primary-500 font-medium">v{exp.version}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDownload(exp)}
                          disabled={downloading === exp._id}
                          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                          id={`download-export-${exp._id}`}
                        >
                          {downloading === exp._id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(exp)}
                          disabled={deleting === exp._id}
                          className="flex items-center justify-center w-9 h-9 rounded-lg border border-surface-200 text-surface-400 hover:text-danger-500 hover:border-danger-200 hover:bg-danger-50 transition-all disabled:opacity-50"
                          id={`delete-export-${exp._id}`}
                        >
                          {deleting === exp._id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            ) : returnHistory.length === 0 ? (
              <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                  <History className="w-8 h-8 text-surface-300" />
                </div>
                <h3 className="text-lg font-semibold text-surface-700 mb-2">No Return History</h3>
                <p className="text-sm text-surface-400">
                  Your return preparation history will appear here after you generate returns.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-50 border-b border-surface-200">
                        <th className="text-left py-3 px-5 text-xs font-semibold text-surface-400 uppercase tracking-wider">Period</th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-surface-400 uppercase tracking-wider">Return Type</th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-surface-400 uppercase tracking-wider">Status</th>
                        <th className="text-right py-3 px-5 text-xs font-semibold text-surface-400 uppercase tracking-wider">Invoices</th>
                        <th className="text-right py-3 px-5 text-xs font-semibold text-surface-400 uppercase tracking-wider">Total GST</th>
                        <th className="text-right py-3 px-5 text-xs font-semibold text-surface-400 uppercase tracking-wider">Validation</th>
                        <th className="text-left py-3 px-5 text-xs font-semibold text-surface-400 uppercase tracking-wider">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {returnHistory.map((ret, index) => (
                        <motion.tr
                          key={ret._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                          className="hover:bg-surface-50/50 transition-colors"
                        >
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-surface-400" />
                              <span className="font-medium text-surface-700">
                                {MONTHS[(ret.period?.month || 1) - 1]} {ret.period?.year}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-5">
                            <Badge status={ret.returnType === 'GSTR1' ? 'GSTR1_EXCEL' : 'GSTR3B_EXCEL'} />
                          </td>
                          <td className="py-3 px-5">
                            <Badge status={ret.status} />
                          </td>
                          <td className="py-3 px-5 text-right font-mono text-surface-700">
                            {ret.summary?.totalInvoices || 0}
                          </td>
                          <td className="py-3 px-5 text-right font-mono text-surface-700">
                            {ret.returnType === 'GSTR1'
                              ? formatCurrency(ret.summary?.totalGst)
                              : formatCurrency(ret.summary?.netTaxPayable)}
                          </td>
                          <td className="py-3 px-5 text-right">
                            {ret.validation?.totalErrors > 0 ? (
                              <span className="text-danger-600 text-xs font-medium flex items-center justify-end gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {ret.validation.totalErrors} errors
                              </span>
                            ) : (
                              <span className="text-success-600 text-xs font-medium">✓ Clean</span>
                            )}
                          </td>
                          <td className="py-3 px-5 text-xs text-surface-400">
                            {formatDate(ret.updatedAt)}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
