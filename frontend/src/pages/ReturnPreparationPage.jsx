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
  CloudUpload,
  Upload,
  Trash2,
  ArrowRight,
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
  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(true);

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

  const fetchUploads = async () => {
    try {
      const { data } = await uploadAPI.getAll();
      // Filter to only show Phase 2 uploads (sales/purchase)
      const phase2Uploads = (data.uploads || []).filter(
        (u) => u.fileType === 'sales' || u.fileType === 'purchase'
      );
      setUploads(phase2Uploads);
    } catch {
      // silent fail
    } finally {
      setUploadsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchUploads();
  }, [month, year]);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];

      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', uploadType);

      try {
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 15, 90));
        }, 200);

        await uploadAPI.upload(formData);

        clearInterval(progressInterval);
        setUploadProgress(100);

        toast.success(`${file.name} uploaded as ${uploadType === 'sales' ? 'Sales Register' : 'Purchase Register'}`);
        fetchUploads();
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
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleDeleteUpload = async (id) => {
    try {
      await uploadAPI.delete(id);
      toast.success('Upload deleted');
      fetchUploads();
      fetchSummary();
    } catch {
      toast.error('Failed to delete');
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
      toast.success('GSTR-1 Excel generated successfully!');
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
      const msg = err.response?.data?.message || 'Failed to generate GSTR-1';
      toast.error(msg);
      if (err.response?.data?.validation) {
        setShowErrors(true);
      }
    } finally {
      setGenerating((prev) => ({ ...prev, gstr1: false }));
    }
  };

  const handleGenerateGSTR3B = async () => {
    setGenerating((prev) => ({ ...prev, gstr3b: true }));
    try {
      const res = await returnsAPI.generateGSTR3B({ month, year });
      toast.success('GSTR-3B summary generated successfully!');
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

  const salesUploads = uploads.filter((u) => u.fileType === 'sales');
  const purchaseUploads = uploads.filter((u) => u.fileType === 'purchase');

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
            Upload invoices, validate, and generate GST-compliant Excel files for portal upload
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-surface-200 px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-primary-500" />
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="text-sm font-medium text-surface-700 bg-transparent border-none outline-none cursor-pointer pr-1"
              id="period-month-select"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="text-sm font-medium text-surface-700 bg-transparent border-none outline-none cursor-pointer"
              id="period-year-select"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { fetchSummary(); fetchUploads(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 disabled:opacity-50"
            id="refresh-summary-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Step Tabs */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-xl w-fit">
        {[
          { id: 'upload', label: '1. Upload Invoices', icon: Upload },
          { id: 'gstr1', label: '2. GSTR-1 (Sales)', icon: FileSpreadsheet },
          { id: 'gstr3b', label: '3. GSTR-3B (Summary)', icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            }`}
            id={`tab-${tab.id}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ════════════════════ UPLOAD TAB ════════════════════ */}
        {activeTab === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Upload Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Sales Invoices Uploaded"
                value={salesUploads.reduce((sum, u) => sum + (u.rowCount || 0), 0)}
                subtitle={`${salesUploads.length} file(s) uploaded`}
                icon={TrendingUp}
                color="primary"
                delay={0}
              />
              <StatCard
                title="Purchase Invoices Uploaded"
                value={purchaseUploads.reduce((sum, u) => sum + (u.rowCount || 0), 0)}
                subtitle={`${purchaseUploads.length} file(s) uploaded`}
                icon={TrendingDown}
                color="success"
                delay={1}
              />
              <StatCard
                title="Total for Period"
                value={summary?.invoiceCounts?.total || 0}
                subtitle={`Sales: ${summary?.invoiceCounts?.sales || 0} | Purchases: ${summary?.invoiceCounts?.purchases || 0}`}
                icon={Receipt}
                color="info"
                delay={2}
              />
            </div>

            {/* Upload Type Selector */}
            <div className="bg-white rounded-2xl border border-surface-200 p-6">
              <h3 className="text-sm font-semibold text-surface-700 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                Select Invoice Type
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setUploadType('sales')}
                  className={`text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                    uploadType === 'sales'
                      ? 'border-primary-500 bg-primary-50/50 shadow-sm'
                      : 'border-surface-200 hover:border-surface-300 bg-white'
                  }`}
                  id="upload-type-sales"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${uploadType === 'sales' ? 'bg-primary-100' : 'bg-surface-100'}`}>
                      <TrendingUp className={`w-4 h-4 ${uploadType === 'sales' ? 'text-primary-600' : 'text-surface-400'}`} />
                    </div>
                    <p className={`text-sm font-bold ${uploadType === 'sales' ? 'text-primary-700' : 'text-surface-700'}`}>
                      Sales Register
                    </p>
                  </div>
                  <p className="text-xs text-surface-400">
                    Your outward supply invoices. Used to generate <span className="font-semibold text-surface-600">GSTR-1</span> Excel for portal upload.
                  </p>
                </button>
                <button
                  onClick={() => setUploadType('purchase')}
                  className={`text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                    uploadType === 'purchase'
                      ? 'border-success-500 bg-success-50/50 shadow-sm'
                      : 'border-surface-200 hover:border-surface-300 bg-white'
                  }`}
                  id="upload-type-purchase"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${uploadType === 'purchase' ? 'bg-success-100' : 'bg-surface-100'}`}>
                      <TrendingDown className={`w-4 h-4 ${uploadType === 'purchase' ? 'text-success-600' : 'text-surface-400'}`} />
                    </div>
                    <p className={`text-sm font-bold ${uploadType === 'purchase' ? 'text-success-700' : 'text-surface-700'}`}>
                      Purchase Register
                    </p>
                  </div>
                  <p className="text-xs text-surface-400">
                    Your inward supply invoices. Used for <span className="font-semibold text-surface-600">ITC calculation</span> in GSTR-3B.
                  </p>
                </button>
              </div>
            </div>

            {/* Dropzone */}
            <div className="bg-white rounded-2xl border border-surface-200 p-6">
              <h3 className="text-sm font-semibold text-surface-700 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                Upload Excel File
              </h3>
              <div
                {...getRootProps()}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-primary-400 bg-primary-50/50'
                    : uploading
                      ? 'border-surface-300 bg-surface-50 cursor-wait'
                      : 'border-surface-300 hover:border-primary-400 hover:bg-primary-50/30'
                }`}
              >
                <input {...getInputProps()} id="invoice-dropzone" />

                {uploading ? (
                  <div className="space-y-4">
                    <Loader2 className="w-10 h-10 text-primary-500 animate-spin mx-auto" />
                    <div>
                      <p className="text-sm font-medium text-surface-700">Processing file...</p>
                      <div className="w-64 h-2 bg-surface-200 rounded-full mx-auto mt-3 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p className="text-xs text-surface-400 mt-2">{uploadProgress}% complete</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <CloudUpload className={`w-12 h-12 mx-auto mb-3 ${isDragActive ? 'text-primary-500' : 'text-surface-300'}`} />
                    <p className="text-sm font-medium text-surface-700">
                      {isDragActive ? 'Drop your file here' : `Drop your ${uploadType === 'sales' ? 'Sales' : 'Purchase'} Register Excel here`}
                    </p>
                    <p className="text-xs text-surface-400 mt-1">or click to browse • Supports .xlsx, .xls, .csv</p>
                    <p className="text-xs mt-3 px-3 py-1.5 bg-surface-100 rounded-full inline-block font-medium text-surface-500">
                      Uploading as: <span className={uploadType === 'sales' ? 'text-primary-600' : 'text-success-600'}>
                        {uploadType === 'sales' ? '📤 Sales Register (for GSTR-1)' : '📥 Purchase Register (for ITC)'}
                      </span>
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Uploaded Files */}
            {uploads.length > 0 && (
              <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-surface-100">
                  <h3 className="text-sm font-semibold text-surface-700">Uploaded Invoice Files</h3>
                </div>
                <div className="divide-y divide-surface-100">
                  {uploads.map((upload) => (
                    <div
                      key={upload._id}
                      className="px-6 py-3.5 flex items-center gap-4 hover:bg-surface-50 transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        upload.fileType === 'sales'
                          ? 'bg-primary-50'
                          : 'bg-success-50'
                      }`}>
                        <FileSpreadsheet className={`w-5 h-5 ${
                          upload.fileType === 'sales' ? 'text-primary-500' : 'text-success-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-700 truncate">{upload.originalName}</p>
                        <p className="text-xs text-surface-400 mt-0.5">
                          {upload.rowCount} invoices • {new Date(upload.createdAt).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        upload.fileType === 'sales'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-success-100 text-success-700'
                      }`}>
                        {upload.fileType === 'sales' ? '📤 Sales' : '📥 Purchase'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {upload.status === 'processed' ? (
                          <CheckCircle2 className="w-4 h-4 text-success-500" />
                        ) : upload.status === 'error' ? (
                          <XCircle className="w-4 h-4 text-danger-500" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-surface-400 animate-spin" />
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteUpload(upload._id)}
                        className="p-1.5 rounded-lg hover:bg-danger-50 text-surface-300 hover:text-danger-500 transition-colors"
                        title="Delete upload"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Step CTA */}
            {(summary?.invoiceCounts?.sales > 0 || summary?.invoiceCounts?.purchases > 0) && (
              <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-2xl border border-primary-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-primary-900">Ready to generate returns?</h4>
                    <p className="text-sm text-primary-600 mt-1">
                      {summary.invoiceCounts.sales} sales invoices and {summary.invoiceCounts.purchases} purchase invoices found for this period.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('gstr1')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary-500/25"
                  >
                    Continue to GSTR-1
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════ GSTR-1 TAB ════════════════════ */}
        {activeTab === 'gstr1' && (
          <motion.div
            key="gstr1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
              </div>
            ) : !summary?.gstr1?.totalInvoices ? (
              <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
                <Upload className="w-12 h-12 text-surface-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-surface-700 mb-2">No Sales Invoices Found</h3>
                <p className="text-sm text-surface-400 mb-4">Upload your Sales Register Excel first to generate GSTR-1.</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all"
                >
                  Go to Upload
                </button>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Total Sales Invoices" value={summary.gstr1?.totalInvoices || 0} icon={Receipt} color="primary" delay={0} />
                  <StatCard title="Total GST" value={formatCurrency(summary.gstr1?.totalGst)} icon={IndianRupee} color="success" delay={1} />
                  <StatCard
                    title="Validation"
                    value={totalErrors === 0 ? 'Ready' : `${totalErrors} Errors`}
                    subtitle={`${totalWarnings} warnings`}
                    icon={totalErrors === 0 ? CheckCircle2 : AlertTriangle}
                    color={totalErrors === 0 ? 'success' : 'danger'}
                    delay={2}
                  />
                  <StatCard title="Invoice Value" value={formatCurrency(summary.gstr1?.totalInvoiceValue)} icon={BarChart3} color="info" delay={3} />
                </div>

                {/* GSTR-1 Breakdown Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">B2B Invoices</h3>
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                        <FileCheck className="w-4 h-4 text-primary-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-primary-700">{summary.gstr1?.b2bCount || 0}</p>
                    <p className="text-xs text-surface-400 mt-1">Registered party sales</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">B2C Invoices</h3>
                      <div className="w-8 h-8 rounded-lg bg-success-100 flex items-center justify-center">
                        <Receipt className="w-4 h-4 text-success-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-success-700">{summary.gstr1?.b2cCount || 0}</p>
                    <p className="text-xs text-surface-400 mt-1">Consumer / unregistered sales</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">Credit/Debit Notes</h3>
                      <div className="w-8 h-8 rounded-lg bg-warning-100 flex items-center justify-center">
                        <FileSpreadsheet className="w-4 h-4 text-warning-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-warning-600">{summary.gstr1?.cdnCount || 0}</p>
                    <p className="text-xs text-surface-400 mt-1">Adjustments and returns</p>
                  </div>
                </div>

                {/* Tax Breakdown Table */}
                <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
                    <h3 className="font-semibold text-surface-800">Tax Breakdown</h3>
                    <Badge status={canExport ? 'VALID' : 'ERROR'} />
                  </div>
                  <div className="p-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface-100">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-surface-400 uppercase">Component</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-surface-400 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-50">
                        <tr><td className="py-3 px-4 text-surface-700">Taxable Value</td><td className="py-3 px-4 text-right font-mono">{formatCurrency(summary.gstr1?.totalTaxableValue)}</td></tr>
                        <tr><td className="py-3 px-4 text-surface-700">CGST</td><td className="py-3 px-4 text-right font-mono">{formatCurrency(summary.gstr1?.totalCgst)}</td></tr>
                        <tr><td className="py-3 px-4 text-surface-700">SGST/UTGST</td><td className="py-3 px-4 text-right font-mono">{formatCurrency(summary.gstr1?.totalSgst)}</td></tr>
                        <tr><td className="py-3 px-4 text-surface-700">IGST</td><td className="py-3 px-4 text-right font-mono">{formatCurrency(summary.gstr1?.totalIgst)}</td></tr>
                        <tr className="bg-primary-50/50"><td className="py-3 px-4 font-bold text-primary-700">Total GST</td><td className="py-3 px-4 text-right font-mono font-bold text-primary-700">{formatCurrency(summary.gstr1?.totalGst)}</td></tr>
                        <tr className="bg-surface-50"><td className="py-3 px-4 font-bold text-surface-800">Total Invoice Value</td><td className="py-3 px-4 text-right font-mono font-bold text-surface-900">{formatCurrency(summary.gstr1?.totalInvoiceValue)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Generate GSTR-1 Action */}
                <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-2xl border border-primary-200 p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-primary-900 text-lg">Generate GSTR-1 Excel</h3>
                      <p className="text-sm text-primary-600 mt-1">
                        Creates a GST portal-compatible Excel with B2B, B2CS, and CDNR sheets
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleValidate('GSTR1')}
                        disabled={validating}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-primary-200 text-primary-700 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                        id="validate-gstr1-btn"
                      >
                        {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        Validate
                      </button>
                      <button
                        onClick={handleGenerateGSTR1}
                        disabled={generating.gstr1}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50"
                        id="generate-gstr1-btn"
                      >
                        {generating.gstr1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Generate & Download
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
          <motion.div
            key="gstr3b"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
              </div>
            ) : (!summary?.invoiceCounts?.sales && !summary?.invoiceCounts?.purchases) ? (
              <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center">
                <Upload className="w-12 h-12 text-surface-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-surface-700 mb-2">No Invoices Found</h3>
                <p className="text-sm text-surface-400 mb-4">Upload Sales and Purchase Register first.</p>
                <button onClick={() => setActiveTab('upload')} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all">Go to Upload</button>
              </div>
            ) : (
              <>
                {/* GSTR-3B Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">Output Tax</h3>
                      <div className="w-8 h-8 rounded-lg bg-danger-100 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-danger-600" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-danger-700">{formatCurrency(summary.gstr3b?.totalOutputTax)}</p>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-surface-500"><span>IGST</span><span className="font-mono">{formatCurrency(summary.gstr3b?.outwardSupplies?.igst)}</span></div>
                      <div className="flex justify-between text-surface-500"><span>CGST</span><span className="font-mono">{formatCurrency(summary.gstr3b?.outwardSupplies?.cgst)}</span></div>
                      <div className="flex justify-between text-surface-500"><span>SGST</span><span className="font-mono">{formatCurrency(summary.gstr3b?.outwardSupplies?.sgst)}</span></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-surface-200 p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-surface-700 uppercase tracking-wider">ITC Available</h3>
                      <div className="w-8 h-8 rounded-lg bg-success-100 flex items-center justify-center">
                        <TrendingDown className="w-4 h-4 text-success-600" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-success-700">{formatCurrency(summary.gstr3b?.totalITC)}</p>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-surface-500"><span>IGST</span><span className="font-mono">{formatCurrency(summary.gstr3b?.itcAvailable?.igst)}</span></div>
                      <div className="flex justify-between text-surface-500"><span>CGST</span><span className="font-mono">{formatCurrency(summary.gstr3b?.itcAvailable?.cgst)}</span></div>
                      <div className="flex justify-between text-surface-500"><span>SGST</span><span className="font-mono">{formatCurrency(summary.gstr3b?.itcAvailable?.sgst)}</span></div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-surface-800 to-surface-900 rounded-2xl border border-surface-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Net Tax Payable</h3>
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                        <IndianRupee className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-white">{formatCurrency(summary.gstr3b?.netPayable)}</p>
                    <p className="text-xs text-surface-400 mt-2">After ITC set-off</p>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-surface-400"><span>IGST</span><span className="font-mono text-surface-300">{formatCurrency(summary.gstr3b?.taxPayable?.igst)}</span></div>
                      <div className="flex justify-between text-surface-400"><span>CGST</span><span className="font-mono text-surface-300">{formatCurrency(summary.gstr3b?.taxPayable?.cgst)}</span></div>
                      <div className="flex justify-between text-surface-400"><span>SGST</span><span className="font-mono text-surface-300">{formatCurrency(summary.gstr3b?.taxPayable?.sgst)}</span></div>
                    </div>
                  </div>
                </div>

                {/* ITC at Risk */}
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

                {/* Generate GSTR-3B */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-purple-900 text-lg">Generate GSTR-3B Summary</h3>
                      <p className="text-sm text-purple-600 mt-1">Creates a summary report with output tax, ITC, and net payable</p>
                    </div>
                    <button
                      onClick={handleGenerateGSTR3B}
                      disabled={generating.gstr3b}
                      className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
                      id="generate-gstr3b-btn"
                    >
                      {generating.gstr3b ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Generate & Download
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation Errors (shown across all tabs) */}
      {(salesErrors.length > 0 || purchaseErrors.length > 0) && (
        <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 transition-colors"
            id="toggle-errors-btn"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-500" />
              <span className="font-semibold text-surface-800">
                Validation Issues ({totalErrors} errors, {totalWarnings} warnings)
              </span>
            </div>
            <ChevronDown className={`w-5 h-5 text-surface-400 transition-transform ${showErrors ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showErrors && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-4 max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-surface-400 uppercase">Severity</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-surface-400 uppercase">Invoice</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-surface-400 uppercase">GSTIN</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-surface-400 uppercase">Field</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-surface-400 uppercase">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-50">
                      {[...salesErrors, ...purchaseErrors].map((err, idx) => (
                        <tr key={idx} className="hover:bg-surface-50/50">
                          <td className="py-2 px-3">
                            {err.severity === 'ERROR' ? <XCircle className="w-4 h-4 text-danger-500" /> : <AlertTriangle className="w-4 h-4 text-warning-500" />}
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-surface-700">{err.invoiceNo}</td>
                          <td className="py-2 px-3 font-mono text-xs text-surface-500">{err.gstin}</td>
                          <td className="py-2 px-3 text-xs text-surface-600">{err.field}</td>
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

      {/* Previous Exports */}
      {summary?.existingExports?.length > 0 && (
        <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-100">
            <h3 className="font-semibold text-surface-800">Previous Exports for This Period</h3>
          </div>
          <div className="divide-y divide-surface-50">
            {summary.existingExports.map((exp) => (
              <div key={exp._id} className="px-6 py-3 flex items-center justify-between hover:bg-surface-50/50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-4 h-4 text-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-surface-700">{exp.fileName}</p>
                    <p className="text-xs text-surface-400">
                      v{exp.version} · {formatFileSize(exp.fileSize)} · {exp.invoiceCount} invoices · {new Date(exp.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <Badge status={exp.exportType} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
