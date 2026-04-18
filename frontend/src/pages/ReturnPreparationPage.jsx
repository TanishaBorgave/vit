import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Shield,
  FileCheck,
  Loader2,
  BarChart3,
  Receipt,
  IndianRupee,
  AlertOctagon,
  Upload,
  Trash2,
  ArrowRight,
  FileText,
  Eye,
  Edit3,
  Save,
  X,
  FilePlus,
} from 'lucide-react';
import { returnsAPI, uploadAPI } from '../services/api.js';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import toast from 'react-hot-toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();

function formatCurrency(value) {
  if (value === undefined || value === null) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const CONFIDENCE_STYLES = {
  HIGH: { bg: 'bg-success-100 text-success-700', label: 'High' },
  MEDIUM: { bg: 'bg-warning-100 text-warning-700', label: 'Medium' },
  LOW: { bg: 'bg-danger-100 text-danger-700', label: 'Low' },
};

export default function ReturnPreparationPage() {
  const [month, setMonth] = useState(currentMonth > 1 ? currentMonth - 1 : 12);
  const [year, setYear] = useState(currentMonth > 1 ? currentYear : currentYear - 1);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState({ gstr1: false, gstr3b: false });
  const [validating, setValidating] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [showErrors, setShowErrors] = useState(false);

  // Upload state
  const [uploadType, setUploadType] = useState('sales');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Invoices state
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Upload results (last batch)
  const [lastUploadResult, setLastUploadResult] = useState(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await returnsAPI.getSummary({ month, year });
      setSummary(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch summary');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    setInvoicesLoading(true);
    try {
      // Don't filter by period — show all uploaded Phase 2 invoices
      const res = await returnsAPI.getInvoices({});
      setInvoices(res.data.invoices || []);
    } catch {
      // silent
    } finally {
      setInvoicesLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchInvoices();
  }, [month, year]);

  // PDF Drop handler
  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      setUploading(true);
      setUploadProgress(0);
      setLastUploadResult(null);

      const formData = new FormData();
      acceptedFiles.forEach((file) => {
        formData.append('invoices', file);
      });
      formData.append('invoiceType', uploadType);

      try {
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 8, 85));
        }, 300);

        const res = await returnsAPI.uploadInvoices(formData);

        clearInterval(progressInterval);
        setUploadProgress(100);

        setLastUploadResult(res.data);

        const { summary: s } = res.data;
        if (s.failed > 0) {
          toast(
            `Processed ${s.total} PDFs: ${s.successful} extracted, ${s.failed} failed`,
            { icon: '⚠️' }
          );
        } else {
          toast.success(
            `${s.successful} invoice(s) extracted from ${s.total} PDF(s)!`
          );
        }

        fetchInvoices();
        fetchSummary();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Upload failed');
      } finally {
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 500);
      }
    },
    [uploadType]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 50,
    disabled: uploading,
  });

  const handleDeleteInvoice = async (id) => {
    try {
      // Delete the upload record which cascade-cleans
      const inv = invoices.find((i) => i._id === id);
      if (inv?.upload) {
        await uploadAPI.delete(inv.upload);
      }
      toast.success('Invoice deleted');
      fetchInvoices();
      fetchSummary();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const startEditing = (invoice) => {
    setEditingId(invoice._id);
    setEditForm({
      invoiceNo: invoice.invoiceNo,
      gstin: invoice.gstin,
      partyName: invoice.partyName,
      invoiceDate: invoice.invoiceDate ? invoice.invoiceDate.split('T')[0] : '',
      taxableValue: invoice.taxableValue,
      cgst: invoice.cgst,
      sgst: invoice.sgst,
      igst: invoice.igst,
      gstAmount: invoice.gstAmount,
      totalValue: invoice.totalValue,
    });
  };

  const saveEdit = async () => {
    try {
      await returnsAPI.updateInvoice(editingId, editForm);
      toast.success('Invoice updated');
      setEditingId(null);
      fetchInvoices();
      fetchSummary();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleValidate = async (returnType) => {
    setValidating(true);
    try {
      const res = await returnsAPI.validate({ month, year, returnType });
      toast.success(
        res.data.validation.canExport
          ? 'All validations passed! Ready to export.'
          : `Found ${res.data.validation.totalErrors} error(s) and ${res.data.validation.totalWarnings} warning(s)`
      );
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleGenerateGSTR1 = async () => {
    setGenerating((prev) => ({ ...prev, gstr1: true }));
    try {
      const res = await returnsAPI.generateGSTR1({ month, year });
      toast.success('GSTR-1 Excel generated!');
      try {
        const downloadRes = await returnsAPI.downloadExport(res.data.export._id);
        const url = window.URL.createObjectURL(new Blob([downloadRes.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.data.export.fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch {
        toast('File generated. Download from Export Center.', { icon: '📁' });
      }
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate GSTR-1');
    } finally {
      setGenerating((prev) => ({ ...prev, gstr1: false }));
    }
  };

  const handleGenerateGSTR3B = async () => {
    setGenerating((prev) => ({ ...prev, gstr3b: true }));
    try {
      const res = await returnsAPI.generateGSTR3B({ month, year });
      toast.success('GSTR-3B summary generated!');
      try {
        const downloadRes = await returnsAPI.downloadExport(res.data.export._id);
        const url = window.URL.createObjectURL(new Blob([downloadRes.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.data.export.fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch {
        toast('File generated. Download from Export Center.', { icon: '📁' });
      }
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate GSTR-3B');
    } finally {
      setGenerating((prev) => ({ ...prev, gstr3b: false }));
    }
  };

  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);

  const salesErrors = summary?.validation?.sales?.errors || [];
  const purchaseErrors = summary?.validation?.purchases?.errors || [];
  const totalErrors = (summary?.validation?.sales?.totalErrors || 0) + (summary?.validation?.purchases?.totalErrors || 0);
  const totalWarnings = (summary?.validation?.sales?.totalWarnings || 0) + (summary?.validation?.purchases?.totalWarnings || 0);
  const canExport = totalErrors === 0;

  const salesInvoices = invoices.filter((i) => i.source === 'sales');
  const purchaseInvoices = invoices.filter((i) => i.source === 'purchase');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            Return Preparation
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            Upload invoice PDFs, review extracted data, and generate GST-compliant Excel files
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-surface-200 px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-primary-500" />
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
              className="text-sm font-medium text-surface-700 bg-transparent border-none outline-none cursor-pointer" id="period-month-select">
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              className="text-sm font-medium text-surface-700 bg-transparent border-none outline-none cursor-pointer" id="period-year-select">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={() => { fetchSummary(); fetchInvoices(); }} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50"
            id="refresh-summary-btn">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Step Tabs */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-xl w-fit">
        {[
          { id: 'upload', label: '1. Upload PDFs', icon: Upload },
          { id: 'review', label: '2. Review Data', icon: Eye },
          { id: 'gstr1', label: '3. GSTR-1', icon: FileSpreadsheet },
          { id: 'gstr3b', label: '4. GSTR-3B', icon: BarChart3 },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-500 hover:text-surface-700'
            }`} id={`tab-${tab.id}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ════════════════════ UPLOAD TAB ════════════════════ */}
        {activeTab === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

            {/* Upload Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard title="Sales Invoices" value={salesInvoices.length} subtitle="Uploaded from PDFs" icon={TrendingUp} color="primary" delay={0} />
              <StatCard title="Purchase Invoices" value={purchaseInvoices.length} subtitle="Uploaded from PDFs" icon={TrendingDown} color="success" delay={1} />
              <StatCard title="Total for Period" value={summary?.invoiceCounts?.total || 0}
                subtitle={`Sales: ${summary?.invoiceCounts?.sales || 0} | Purchases: ${summary?.invoiceCounts?.purchases || 0}`}
                icon={Receipt} color="info" delay={2} />
            </div>

            {/* Upload Type Selector */}
            <div className="bg-white rounded-2xl border border-surface-200 p-6">
              <h3 className="text-sm font-semibold text-surface-700 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                Select Invoice Type
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => setUploadType('sales')}
                  className={`text-left p-5 rounded-xl border-2 transition-all ${
                    uploadType === 'sales' ? 'border-primary-500 bg-primary-50/50 shadow-sm' : 'border-surface-200 hover:border-surface-300'
                  }`} id="upload-type-sales">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${uploadType === 'sales' ? 'bg-primary-100' : 'bg-surface-100'}`}>
                      <TrendingUp className={`w-4 h-4 ${uploadType === 'sales' ? 'text-primary-600' : 'text-surface-400'}`} />
                    </div>
                    <p className={`text-sm font-bold ${uploadType === 'sales' ? 'text-primary-700' : 'text-surface-700'}`}>Sales Invoices</p>
                  </div>
                  <p className="text-xs text-surface-400">Your outward supply invoices (PDF). Used to generate <span className="font-semibold text-surface-600">GSTR-1</span>.</p>
                </button>
                <button onClick={() => setUploadType('purchase')}
                  className={`text-left p-5 rounded-xl border-2 transition-all ${
                    uploadType === 'purchase' ? 'border-success-500 bg-success-50/50 shadow-sm' : 'border-surface-200 hover:border-surface-300'
                  }`} id="upload-type-purchase">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${uploadType === 'purchase' ? 'bg-success-100' : 'bg-surface-100'}`}>
                      <TrendingDown className={`w-4 h-4 ${uploadType === 'purchase' ? 'text-success-600' : 'text-surface-400'}`} />
                    </div>
                    <p className={`text-sm font-bold ${uploadType === 'purchase' ? 'text-success-700' : 'text-surface-700'}`}>Purchase Invoices</p>
                  </div>
                  <p className="text-xs text-surface-400">Your inward supply invoices (PDF). Used for <span className="font-semibold text-surface-600">ITC</span> in GSTR-3B.</p>
                </button>
              </div>
            </div>

            {/* PDF Dropzone */}
            <div className="bg-white rounded-2xl border border-surface-200 p-6">
              <h3 className="text-sm font-semibold text-surface-700 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                Upload Invoice PDFs
              </h3>
              <div
                {...getRootProps()}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive ? 'border-primary-400 bg-primary-50/50'
                    : uploading ? 'border-surface-300 bg-surface-50 cursor-wait'
                      : 'border-surface-300 hover:border-primary-400 hover:bg-primary-50/30'
                }`}
              >
                <input {...getInputProps()} id="invoice-pdf-dropzone" />

                {uploading ? (
                  <div className="space-y-4">
                    <Loader2 className="w-10 h-10 text-primary-500 animate-spin mx-auto" />
                    <div>
                      <p className="text-sm font-medium text-surface-700">Extracting invoice data from PDFs...</p>
                      <div className="w-64 h-2 bg-surface-200 rounded-full mx-auto mt-3 overflow-hidden">
                        <motion.div className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
                          initial={{ width: '0%' }} animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.3 }} />
                      </div>
                      <p className="text-xs text-surface-400 mt-2">{uploadProgress}% complete</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <FilePlus className={`w-12 h-12 mx-auto mb-3 ${isDragActive ? 'text-primary-500' : 'text-surface-300'}`} />
                    <p className="text-sm font-medium text-surface-700">
                      {isDragActive ? 'Drop your PDFs here' : `Drop ${uploadType === 'sales' ? 'Sales' : 'Purchase'} invoice PDFs here`}
                    </p>
                    <p className="text-xs text-surface-400 mt-1">or click to browse • Supports multiple PDFs (up to 50)</p>
                    <p className="text-xs mt-3 px-3 py-1.5 bg-surface-100 rounded-full inline-block font-medium text-surface-500">
                      Uploading as: <span className={uploadType === 'sales' ? 'text-primary-600' : 'text-success-600'}>
                        {uploadType === 'sales' ? '📤 Sales Invoices (for GSTR-1)' : '📥 Purchase Invoices (for ITC)'}
                      </span>
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Last Upload Results */}
            {lastUploadResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
                  <h3 className="font-semibold text-surface-800">Extraction Results</h3>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-success-100 text-success-700 font-medium">
                      {lastUploadResult.summary.successful} extracted
                    </span>
                    {lastUploadResult.summary.failed > 0 && (
                      <span className="px-2.5 py-1 rounded-full bg-danger-100 text-danger-700 font-medium">
                        {lastUploadResult.summary.failed} failed
                      </span>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-surface-50 max-h-72 overflow-y-auto">
                  {/* Successful */}
                  {lastUploadResult.invoices?.map((inv, idx) => (
                    <div key={idx} className="px-6 py-3 flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-surface-700 truncate">{inv.fileName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLES[inv.confidence]?.bg || ''}`}>
                            {CONFIDENCE_STYLES[inv.confidence]?.label} confidence
                          </span>
                        </div>
                        <p className="text-xs text-surface-400 mt-0.5">
                          {inv.invoiceNo} · {inv.gstin || 'No GSTIN'} · {formatCurrency(inv.totalValue)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {/* Failed */}
                  {lastUploadResult.failed?.map((f, idx) => (
                    <div key={`f-${idx}`} className="px-6 py-3 flex items-center gap-3">
                      <XCircle className="w-4 h-4 text-danger-500 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-surface-700">{f.fileName}</span>
                        <p className="text-xs text-danger-500">{f.error}</p>
                      </div>
                    </div>
                  ))}
                  {/* Warnings */}
                  {lastUploadResult.warnings?.map((w, idx) => (
                    <div key={`w-${idx}`} className="px-6 py-3 flex items-center gap-3 bg-warning-50/50">
                      <AlertTriangle className="w-4 h-4 text-warning-500 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-surface-700">{w.fileName}</span>
                        <p className="text-xs text-warning-600">{w.message}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {lastUploadResult.invoices?.length > 0 && (
                  <div className="px-6 py-3 border-t border-surface-100 bg-primary-50/30">
                    <button onClick={() => setActiveTab('review')}
                      className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
                      Review & edit extracted data <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Next Step CTA */}
            {(salesInvoices.length > 0 || purchaseInvoices.length > 0) && !lastUploadResult && (
              <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-2xl border border-primary-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-primary-900">Invoice data ready</h4>
                    <p className="text-sm text-primary-600 mt-1">
                      {salesInvoices.length} sales and {purchaseInvoices.length} purchase invoices loaded.
                    </p>
                  </div>
                  <button onClick={() => setActiveTab('review')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary-500/25">
                    Review Data <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════ REVIEW TAB ════════════════════ */}
        {activeTab === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

            {invoicesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
                <FileText className="w-12 h-12 text-surface-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-surface-700 mb-2">No Invoices Yet</h3>
                <p className="text-sm text-surface-400 mb-4">Upload invoice PDFs first.</p>
                <button onClick={() => setActiveTab('upload')} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all">Go to Upload</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-surface-800">Extracted Invoices ({invoices.length})</h3>
                  <p className="text-xs text-surface-400">Click the edit icon to correct any parsing errors</p>
                </div>

                <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface-50 border-b border-surface-200">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase">Type</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase">Invoice No</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase">GSTIN</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase">Party</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase">Date</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-surface-400 uppercase">Taxable</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-surface-400 uppercase">GST</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-surface-400 uppercase">Total</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-surface-400 uppercase">Confidence</th>
                          <th className="text-center py-3 px-4 text-xs font-semibold text-surface-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {invoices.map((inv) => (
                          <tr key={inv._id} className="hover:bg-surface-50/50 transition-colors">
                            {editingId === inv._id ? (
                              // Edit mode
                              <>
                                <td className="py-2 px-4">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.source === 'sales' ? 'bg-primary-100 text-primary-700' : 'bg-success-100 text-success-700'}`}>
                                    {inv.source === 'sales' ? 'Sale' : 'Purchase'}
                                  </span>
                                </td>
                                <td className="py-2 px-4"><input value={editForm.invoiceNo} onChange={(e) => setEditForm({ ...editForm, invoiceNo: e.target.value })} className="w-full px-2 py-1 border border-primary-300 rounded text-xs bg-primary-50 focus:outline-none" /></td>
                                <td className="py-2 px-4"><input value={editForm.gstin} onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value })} className="w-full px-2 py-1 border border-primary-300 rounded text-xs bg-primary-50 focus:outline-none font-mono" /></td>
                                <td className="py-2 px-4"><input value={editForm.partyName} onChange={(e) => setEditForm({ ...editForm, partyName: e.target.value })} className="w-full px-2 py-1 border border-primary-300 rounded text-xs bg-primary-50 focus:outline-none" /></td>
                                <td className="py-2 px-4"><input type="date" value={editForm.invoiceDate} onChange={(e) => setEditForm({ ...editForm, invoiceDate: e.target.value })} className="w-full px-2 py-1 border border-primary-300 rounded text-xs bg-primary-50 focus:outline-none" /></td>
                                <td className="py-2 px-4"><input type="number" value={editForm.taxableValue} onChange={(e) => setEditForm({ ...editForm, taxableValue: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-1 border border-primary-300 rounded text-xs bg-primary-50 focus:outline-none text-right" /></td>
                                <td className="py-2 px-4"><input type="number" value={editForm.gstAmount} onChange={(e) => setEditForm({ ...editForm, gstAmount: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-1 border border-primary-300 rounded text-xs bg-primary-50 focus:outline-none text-right" /></td>
                                <td className="py-2 px-4"><input type="number" value={editForm.totalValue} onChange={(e) => setEditForm({ ...editForm, totalValue: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-1 border border-primary-300 rounded text-xs bg-primary-50 focus:outline-none text-right" /></td>
                                <td></td>
                                <td className="py-2 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={saveEdit} className="p-1.5 rounded-lg bg-success-100 text-success-600 hover:bg-success-200"><Save className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              // View mode
                              <>
                                <td className="py-3 px-4">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.source === 'sales' ? 'bg-primary-100 text-primary-700' : 'bg-success-100 text-success-700'}`}>
                                    {inv.source === 'sales' ? 'Sale' : 'Purchase'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono text-xs text-surface-700">{inv.invoiceNo}</td>
                                <td className="py-3 px-4 font-mono text-xs text-surface-500">{inv.gstin || '—'}</td>
                                <td className="py-3 px-4 text-xs text-surface-600 max-w-32 truncate">{inv.partyName || '—'}</td>
                                <td className="py-3 px-4 text-xs text-surface-600">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : '—'}</td>
                                <td className="py-3 px-4 text-right font-mono text-xs text-surface-700">{formatCurrency(inv.taxableValue)}</td>
                                <td className="py-3 px-4 text-right font-mono text-xs text-surface-700">{formatCurrency(inv.gstAmount)}</td>
                                <td className="py-3 px-4 text-right font-mono text-xs font-medium text-surface-800">{formatCurrency(inv.totalValue)}</td>
                                <td className="py-3 px-4 text-center">
                                  {inv.rawData?.extractionConfidence && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLES[inv.rawData.extractionConfidence]?.bg || ''}`}>
                                      {CONFIDENCE_STYLES[inv.rawData.extractionConfidence]?.label}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => startEditing(inv)} className="p-1.5 rounded-lg text-surface-400 hover:bg-primary-50 hover:text-primary-600 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleDeleteInvoice(inv._id)} className="p-1.5 rounded-lg text-surface-400 hover:bg-danger-50 hover:text-danger-600 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Next step */}
                <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-2xl border border-primary-200 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-primary-900">Data looks good?</h4>
                      <p className="text-sm text-primary-600 mt-1">Proceed to generate your GST return files.</p>
                    </div>
                    <button onClick={() => setActiveTab('gstr1')}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary-500/25">
                      Continue to GSTR-1 <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ════════════════════ GSTR-1 TAB ════════════════════ */}
        {activeTab === 'gstr1' && (
          <motion.div key="gstr1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary-500" /></div>
            ) : !summary?.gstr1?.totalInvoices ? (
              <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
                <Upload className="w-12 h-12 text-surface-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-surface-700 mb-2">No Sales Data</h3>
                <p className="text-sm text-surface-400 mb-4">Upload sales invoice PDFs first.</p>
                <button onClick={() => setActiveTab('upload')} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all">Go to Upload</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Sales Invoices" value={summary.gstr1?.totalInvoices || 0} icon={Receipt} color="primary" delay={0} />
                  <StatCard title="Total GST" value={formatCurrency(summary.gstr1?.totalGst)} icon={IndianRupee} color="success" delay={1} />
                  <StatCard title="Validation" value={totalErrors === 0 ? 'Ready' : `${totalErrors} Errors`} icon={totalErrors === 0 ? CheckCircle2 : AlertTriangle} color={totalErrors === 0 ? 'success' : 'danger'} delay={2} />
                  <StatCard title="Invoice Value" value={formatCurrency(summary.gstr1?.totalInvoiceValue)} icon={BarChart3} color="info" delay={3} />
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {[
                    { label: 'B2B Invoices', count: summary.gstr1?.b2bCount, color: 'primary', desc: 'Registered party sales' },
                    { label: 'B2C Invoices', count: summary.gstr1?.b2cCount, color: 'success', desc: 'Consumer sales' },
                    { label: 'Credit/Debit Notes', count: summary.gstr1?.cdnCount, color: 'warning', desc: 'Adjustments' },
                  ].map((item) => (
                    <div key={item.label} className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg transition-shadow">
                      <h3 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">{item.label}</h3>
                      <p className={`text-3xl font-bold text-${item.color}-700 mt-2`}>{item.count || 0}</p>
                      <p className="text-xs text-surface-400 mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Tax Table */}
                <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
                    <h3 className="font-semibold text-surface-800">Tax Breakdown</h3>
                    <Badge status={canExport ? 'VALID' : 'ERROR'} />
                  </div>
                  <div className="p-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-surface-50">
                        {[
                          ['Taxable Value', summary.gstr1?.totalTaxableValue],
                          ['CGST', summary.gstr1?.totalCgst],
                          ['SGST/UTGST', summary.gstr1?.totalSgst],
                          ['IGST', summary.gstr1?.totalIgst],
                        ].map(([l, v]) => (
                          <tr key={l}><td className="py-3 px-4 text-surface-700">{l}</td><td className="py-3 px-4 text-right font-mono">{formatCurrency(v)}</td></tr>
                        ))}
                        <tr className="bg-primary-50/50"><td className="py-3 px-4 font-bold text-primary-700">Total GST</td><td className="py-3 px-4 text-right font-mono font-bold text-primary-700">{formatCurrency(summary.gstr1?.totalGst)}</td></tr>
                        <tr className="bg-surface-50"><td className="py-3 px-4 font-bold text-surface-800">Invoice Value</td><td className="py-3 px-4 text-right font-mono font-bold text-surface-900">{formatCurrency(summary.gstr1?.totalInvoiceValue)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Generate */}
                <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-2xl border border-primary-200 p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-primary-900 text-lg">Generate GSTR-1 Excel</h3>
                      <p className="text-sm text-primary-600 mt-1">Creates GST portal-compatible Excel (B2B, B2CS, CDNR sheets)</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleValidate('GSTR1')} disabled={validating}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-primary-200 text-primary-700 rounded-xl text-sm font-medium transition-all disabled:opacity-50" id="validate-gstr1-btn">
                        {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} Validate
                      </button>
                      <button onClick={handleGenerateGSTR1} disabled={generating.gstr1}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50" id="generate-gstr1-btn">
                        {generating.gstr1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Generate & Download
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ════════════════════ GSTR-3B TAB ════════════════════ */}
        {activeTab === 'gstr3b' && (
          <motion.div key="gstr3b" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary-500" /></div>
            ) : (!summary?.invoiceCounts?.sales && !summary?.invoiceCounts?.purchases) ? (
              <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
                <Upload className="w-12 h-12 text-surface-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-surface-700 mb-2">No Invoice Data</h3>
                <p className="text-sm text-surface-400 mb-4">Upload invoice PDFs first.</p>
                <button onClick={() => setActiveTab('upload')} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all">Go to Upload</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl border border-surface-200 p-6">
                    <h3 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-4">Output Tax</h3>
                    <p className="text-2xl font-bold text-danger-700">{formatCurrency(summary.gstr3b?.totalOutputTax)}</p>
                    <div className="mt-3 space-y-1.5 text-xs">
                      {[['IGST', summary.gstr3b?.outwardSupplies?.igst], ['CGST', summary.gstr3b?.outwardSupplies?.cgst], ['SGST', summary.gstr3b?.outwardSupplies?.sgst]].map(([l, v]) => (
                        <div key={l} className="flex justify-between text-surface-500"><span>{l}</span><span className="font-mono">{formatCurrency(v)}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-surface-200 p-6">
                    <h3 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-4">ITC Available</h3>
                    <p className="text-2xl font-bold text-success-700">{formatCurrency(summary.gstr3b?.totalITC)}</p>
                    <div className="mt-3 space-y-1.5 text-xs">
                      {[['IGST', summary.gstr3b?.itcAvailable?.igst], ['CGST', summary.gstr3b?.itcAvailable?.cgst], ['SGST', summary.gstr3b?.itcAvailable?.sgst]].map(([l, v]) => (
                        <div key={l} className="flex justify-between text-surface-500"><span>{l}</span><span className="font-mono">{formatCurrency(v)}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-surface-800 to-surface-900 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">Net Tax Payable</h3>
                    <p className="text-3xl font-bold text-white">{formatCurrency(summary.gstr3b?.netPayable)}</p>
                    <p className="text-xs text-surface-400 mt-2">After ITC set-off</p>
                  </div>
                </div>

                {summary.gstr3b?.itcAtRisk?.total > 0 && (
                  <div className="bg-danger-50 border border-danger-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <AlertOctagon className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-danger-800">ITC at Risk: {formatCurrency(summary.gstr3b.itcAtRisk.total)}</h4>
                        <p className="text-sm text-danger-600 mt-1">Some invoices are unmatched. Review in Reconciliation before filing.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-purple-900 text-lg">Generate GSTR-3B Summary</h3>
                      <p className="text-sm text-purple-600 mt-1">Summary report with output tax, ITC, and net payable</p>
                    </div>
                    <button onClick={handleGenerateGSTR3B} disabled={generating.gstr3b}
                      className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50" id="generate-gstr3b-btn">
                      {generating.gstr3b ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Generate & Download
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation Errors */}
      {(salesErrors.length > 0 || purchaseErrors.length > 0) && (
        <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
          <button onClick={() => setShowErrors(!showErrors)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 transition-colors" id="toggle-errors-btn">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-500" />
              <span className="font-semibold text-surface-800">Validation Issues ({totalErrors} errors, {totalWarnings} warnings)</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-surface-400 transition-transform ${showErrors ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showErrors && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-6 pb-4 max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-surface-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-surface-400 uppercase">Severity</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-surface-400 uppercase">Invoice</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-surface-400 uppercase">Message</th>
                    </tr></thead>
                    <tbody className="divide-y divide-surface-50">
                      {[...salesErrors, ...purchaseErrors].map((err, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">{err.severity === 'ERROR' ? <XCircle className="w-4 h-4 text-danger-500" /> : <AlertTriangle className="w-4 h-4 text-warning-500" />}</td>
                          <td className="py-2 px-3 font-mono text-xs">{err.invoiceNo}</td>
                          <td className="py-2 px-3 text-xs text-surface-600">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
