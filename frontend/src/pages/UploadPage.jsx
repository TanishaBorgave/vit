import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Trash2,
  CloudUpload,
  Loader2,
  Play,
  RefreshCw,
} from 'lucide-react';
import { uploadAPI, reconciliationAPI } from '../services/api';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import toast from 'react-hot-toast';

export default function UploadPage() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileType, setFileType] = useState('books');
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    try {
      const { data } = await uploadAPI.getAll();
      setUploads(data.uploads || []);
    } catch {
      toast.error('Failed to load uploads');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];

      setUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', fileType);

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 15, 90));
        }, 200);

        await uploadAPI.upload(formData);

        clearInterval(progressInterval);
        setUploadProgress(100);

        toast.success(`${file.name} uploaded and processed successfully`);
        fetchUploads();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Upload failed');
      } finally {
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 500);
      }
    },
    [fileType]
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

  const handleDelete = async (id) => {
    try {
      await uploadAPI.delete(id);
      toast.success('Upload deleted');
      fetchUploads();
    } catch {
      toast.error('Failed to delete upload');
    }
  };

  const runReconciliation = async () => {
    const bookUploads = uploads.filter((u) => u.fileType === 'books' && u.status === 'processed');
    const gstUploads = uploads.filter((u) => u.fileType !== 'books' && u.status === 'processed');

    if (bookUploads.length === 0 || gstUploads.length === 0) {
      return toast.error('Please upload both Books and GST data files first');
    }

    setReconciling(true);
    try {
      const { data } = await reconciliationAPI.run();
      toast.success(`Reconciliation complete! ${data.summary.matched} matched, ${data.summary.mismatched} mismatches found.`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const fileTypeOptions = [
    { value: 'books', label: 'Purchase Register (Books)', description: 'Your purchase records from accounting software' },
    { value: 'gstr2b', label: 'GSTR-2B', description: 'Auto-drafted ITC statement from GST portal' },
    { value: 'gstr1', label: 'GSTR-1', description: 'Outward supply statement from supplier' },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-surface-900">Upload Data</h1>
        <p className="text-sm text-surface-400 mt-1">Upload Excel files to start reconciliation</p>
      </motion.div>

      {/* File Type selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-surface-200 p-6"
      >
        <h3 className="text-sm font-semibold text-surface-700 mb-4">1. Select File Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fileTypeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFileType(opt.value)}
              className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                fileType === opt.value
                  ? 'border-primary-500 bg-primary-50/50 shadow-sm'
                  : 'border-surface-200 hover:border-surface-300 bg-white'
              }`}
            >
              <p className={`text-sm font-semibold ${fileType === opt.value ? 'text-primary-700' : 'text-surface-700'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-surface-400 mt-1">{opt.description}</p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Dropzone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl border border-surface-200 p-6"
      >
        <h3 className="text-sm font-semibold text-surface-700 mb-4">2. Upload File</h3>
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
            isDragActive
              ? 'border-primary-400 bg-primary-50/50'
              : uploading
                ? 'border-surface-300 bg-surface-50 cursor-wait'
                : 'border-surface-300 hover:border-primary-400 hover:bg-primary-50/30'
          }`}
        >
          <input {...getInputProps()} id="file-dropzone" />

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
                {isDragActive ? 'Drop your file here' : 'Drag & drop your Excel file here'}
              </p>
              <p className="text-xs text-surface-400 mt-1">or click to browse • Supports .xlsx, .xls, .csv</p>
            </>
          )}
        </div>
      </motion.div>

      {/* Run Reconciliation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl border border-surface-200 p-6"
      >
        <h3 className="text-sm font-semibold text-surface-700 mb-3">3. Run Reconciliation</h3>
        <p className="text-xs text-surface-400 mb-4">
          After uploading both Books and GST data, run the matching engine to find discrepancies.
        </p>
        <button
          id="run-reconciliation"
          onClick={runReconciliation}
          disabled={reconciling}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-medium text-sm hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reconciling ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Reconciliation
            </>
          )}
        </button>
      </motion.div>

      {/* Upload History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl border border-surface-200 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-surface-100">
          <h3 className="text-sm font-semibold text-surface-700">Upload History</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-surface-400 mx-auto" />
          </div>
        ) : uploads.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No files uploaded yet"
            description="Upload your first Excel file to get started"
          />
        ) : (
          <div className="divide-y divide-surface-100">
            <AnimatePresence>
              {uploads.map((upload) => (
                <motion.div
                  key={upload._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-surface-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-primary-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-700 truncate">{upload.originalName}</p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {upload.rowCount} rows • {new Date(upload.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    upload.fileType === 'books'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {upload.fileType === 'books' ? 'Books' : upload.fileType.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {upload.status === 'processed' ? (
                      <CheckCircle2 className="w-4 h-4 text-success-500" />
                    ) : upload.status === 'error' ? (
                      <XCircle className="w-4 h-4 text-danger-500" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-surface-400 animate-spin" />
                    )}
                    <span className="text-xs text-surface-400 capitalize">{upload.status}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(upload._id)}
                    className="p-1.5 rounded-lg hover:bg-danger-50 text-surface-300 hover:text-danger-500 transition-colors"
                    title="Delete upload"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
