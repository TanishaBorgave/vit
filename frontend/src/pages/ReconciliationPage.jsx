import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, ChevronLeft, ChevronRight, GitCompare } from 'lucide-react';
import { reconciliationAPI } from '../services/api';
import Badge from '../components/Badge.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import toast from 'react-hot-toast';

function formatCurrency(val) {
  if (!val) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export default function ReconciliationPage() {
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', search: '', page: 1, limit: 25 });

  useEffect(() => {
    fetchResults();
  }, [filters.status, filters.page]);

  const fetchResults = async (searchOverride) => {
    setLoading(true);
    try {
      const params = {
        page: filters.page,
        limit: filters.limit,
        ...(filters.status && { status: filters.status }),
        ...(searchOverride !== undefined ? (searchOverride && { search: searchOverride }) : (filters.search && { search: filters.search })),
      };
      const { data } = await reconciliationAPI.getResults(params);
      setResults(data.results || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch {
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((val) => {
      setFilters((prev) => ({ ...prev, page: 1, search: val }));
      fetchResults(val);
    }, 400),
    []
  );

  const statuses = ['', 'MATCHED', 'MISMATCH', 'MISSING_IN_2B', 'MISSING_IN_BOOKS'];
  const statusLabels = { '': 'All', MATCHED: 'Matched', MISMATCH: 'Mismatch', MISSING_IN_2B: 'Missing in 2B', MISSING_IN_BOOKS: 'Missing in Books' };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-surface-900">Reconciliation Results</h1>
        <p className="text-sm text-surface-400 mt-1">{pagination.total} records found</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-surface-200 p-4 flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            id="recon-search"
            type="text"
            placeholder="Search by GSTIN, Invoice No, or Party..."
            onChange={(e) => debouncedSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all placeholder:text-surface-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-surface-400" />
          <div className="flex gap-1 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setFilters((prev) => ({ ...prev, status: s, page: 1 }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filters.status === s
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
                }`}
              >
                {statusLabels[s]}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 p-8">
          <EmptyState
            icon={GitCompare}
            title="No results found"
            description={filters.search || filters.status ? 'Try adjusting your filters' : 'Run reconciliation first to see results here'}
          />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-surface-200 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">GSTIN</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Invoice No</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Date</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Books Amt</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">GST Amt</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Difference</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {results.map((r, i) => (
                  <motion.tr
                    key={r._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-surface-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-surface-600">{r.gstin}</span>
                      {r.partyName && <p className="text-[11px] text-surface-400 mt-0.5">{r.partyName}</p>}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-surface-700">{r.invoiceNo || '-'}</td>
                    <td className="px-5 py-3.5 text-surface-500">
                      {r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-surface-600">{formatCurrency(r.bookAmount)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-surface-600">{formatCurrency(r.gstAmount)}</td>
                    <td className={`px-5 py-3.5 text-right font-mono font-medium ${
                      r.amountDifference > 0 ? 'text-danger-600' : r.amountDifference < 0 ? 'text-warning-600' : 'text-surface-400'
                    }`}>
                      {r.amountDifference !== 0 ? formatCurrency(Math.abs(r.amountDifference)) : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge status={r.status} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-surface-100 bg-surface-50/50">
              <p className="text-xs text-surface-400">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                  disabled={pagination.page >= pagination.pages}
                  className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
