import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, IndianRupee, ChevronRight, Search } from 'lucide-react';
import { partyAPI } from '../services/api';
import Badge from '../components/Badge.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import toast from 'react-hot-toast';

function formatCurrency(val) {
  if (!val) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function PartyListPage() {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchParties();
  }, []);

  const fetchParties = async () => {
    try {
      const { data } = await partyAPI.getAll();
      setParties(data.parties || []);
    } catch {
      toast.error('Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  const filtered = parties.filter(
    (p) =>
      p.gstin?.toLowerCase().includes(search.toLowerCase()) ||
      p.partyName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-surface-900">Party-wise View</h1>
        <p className="text-sm text-surface-400 mt-1">GSTIN-wise reconciliation summary and risk analysis</p>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-surface-200 p-4"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            id="party-search"
            type="text"
            placeholder="Search by GSTIN or Party Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all placeholder:text-surface-300"
          />
        </div>
      </motion.div>

      {/* Party Cards */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 p-8">
          <EmptyState
            icon={Users}
            title="No parties found"
            description={search ? 'Try a different search term' : 'Run reconciliation first to see party data'}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((party, i) => (
            <motion.div
              key={party.gstin}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/parties/${party.gstin}`)}
              className="bg-white rounded-2xl border border-surface-200 p-5 cursor-pointer hover:shadow-md hover:border-primary-200 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-mono text-sm font-semibold text-surface-700">{party.gstin}</p>
                    <Badge status={party.riskLevel} />
                  </div>
                  {party.partyName && (
                    <p className="text-sm text-surface-500 mb-3">{party.partyName}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-success-400" />
                      <span className="text-surface-400">Matched:</span>
                      <span className="font-semibold text-surface-600">{party.matched}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-danger-400" />
                      <span className="text-surface-400">Mismatch:</span>
                      <span className="font-semibold text-surface-600">{party.mismatched}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-warning-400" />
                      <span className="text-surface-400">Missing:</span>
                      <span className="font-semibold text-surface-600">{party.missingIn2B + party.missingInBooks}</span>
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 flex items-center gap-4">
                  <div>
                    <p className="text-xs text-surface-400 mb-0.5">ITC at Risk</p>
                    <p className="text-lg font-bold text-danger-600">{formatCurrency(party.totalItcAtRisk)}</p>
                    <p className="text-xs text-surface-400">{party.totalInvoices} invoices</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-surface-300 group-hover:text-primary-500 transition-colors" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
