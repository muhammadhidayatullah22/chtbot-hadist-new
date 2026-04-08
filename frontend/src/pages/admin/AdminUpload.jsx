import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { adminAPI } from '../../services/api';
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader2, CloudUpload } from 'lucide-react';

export default function AdminUpload() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { loadFiles(); }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getFiles();
      setFiles(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleUpload = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setMessage({ type: 'error', text: 'Hanya file PDF yang diizinkan' });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Ukuran file maksimal 50MB' });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setMessage(null);

    try {
      await adminAPI.uploadFile(file, setUploadProgress);
      setMessage({ type: 'success', text: `File "${file.name}" berhasil diupload dan sedang diproses.` });
      loadFiles();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Upload gagal' });
    }

    setUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async (fileId, fileName) => {
    if (!confirm(`Hapus file "${fileName}"? Semua data chunks-nya akan ikut terhapus.`)) return;
    try {
      await adminAPI.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      setMessage({ type: 'success', text: `File "${fileName}" berhasil dihapus.` });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Gagal menghapus' });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusBadge = (status) => {
    if (status === 'ready') return <span className="badge badge-success"><CheckCircle size={10} /> Siap</span>;
    if (status === 'processing') return <span className="badge badge-warning"><Loader2 size={10} className="animate-spin" /> Proses</span>;
    return <span className="badge badge-error"><AlertCircle size={10} /> Error</span>;
  };

  return (
    <div className="chat-layout">
      <Sidebar onNewChat={() => navigate('/chat')} onSelectSession={(sid) => navigate(`/chat/${sid}`)} />
      <main className="chat-main">
        <div className="admin-page">
          <div className="admin-header animate-fade-in">
            <div>
              <h1>Upload PDF</h1>
              <p>Tambahkan file PDF hadist ke knowledge base</p>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`alert alert-${message.type} animate-fade-in`} style={{ marginBottom: 'var(--space-4)' }}>
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {message.text}
            </div>
          )}

          {/* Upload area */}
          <div
            className={`upload-zone animate-fade-in ${dragOver ? 'upload-zone-active' : ''} ${uploading ? 'upload-zone-uploading' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              hidden
              onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])}
            />

            {uploading ? (
              <div className="upload-progress">
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-500)' }} />
                <p>Mengupload... {uploadProgress}%</p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <>
                <div className="upload-icon">
                  <CloudUpload size={36} />
                </div>
                <p className="upload-text">
                  <strong>Klik untuk upload</strong> atau drag & drop
                </p>
                <p className="upload-hint">PDF, maksimal 50MB</p>
              </>
            )}
          </div>

          {/* File list */}
          <div className="admin-section" style={{ marginTop: 'var(--space-8)' }}>
            <h2><FileText size={18} /> File Knowledge Base</h2>

            {loading ? (
              <div className="admin-loading"><span className="spinner" /> Memuat...</div>
            ) : files.length === 0 ? (
              <div className="upload-empty">
                <p>Belum ada file yang diupload</p>
              </div>
            ) : (
              <div className="file-list">
                {files.map((f, i) => (
                  <div
                    key={f.id}
                    className="file-item animate-fade-in"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="file-icon">
                      <FileText size={20} />
                    </div>
                    <div className="file-info">
                      <h3 className="truncate">{f.original_name}</h3>
                      <div className="file-meta">
                        <span>{formatSize(f.file_size)}</span>
                        <span>•</span>
                        <span>{f.chunk_count} chunks</span>
                        <span>•</span>
                        {statusBadge(f.status)}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={() => handleDelete(f.id, f.original_name)}
                      title="Hapus file"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <style>{`
          .upload-zone {
            border: 2px dashed var(--border-color);
            border-radius: var(--radius-lg);
            padding: var(--space-12) var(--space-8);
            text-align: center;
            cursor: pointer;
            transition: all var(--transition-fast);
            background: var(--bg-secondary);
          }

          .admin-page {
            max-width: 960px;
            margin: 0 auto;
            padding: var(--space-8) var(--space-6);
            width: 100%;
          }

          .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: var(--space-8);
          }

          .admin-header h1 {
            font-size: var(--text-2xl);
            font-weight: 700;
            margin-bottom: var(--space-1);
          }

          .admin-header p {
            color: var(--text-secondary);
            font-size: var(--text-sm);
          }

          .admin-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-3);
            padding: var(--space-12);
            color: var(--text-tertiary);
          }

          .admin-section h2 {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            font-size: var(--text-lg);
            font-weight: 600;
            margin-bottom: var(--space-4);
          }

          .upload-zone:hover, .upload-zone-active {
            border-color: var(--primary-400);
            background: var(--bg-hover);
          }

          .upload-zone-uploading {
            cursor: default;
            border-style: solid;
            border-color: var(--primary-400);
          }

          .upload-icon {
            color: var(--text-tertiary);
            margin-bottom: var(--space-4);
          }

          .upload-zone:hover .upload-icon {
            color: var(--primary-500);
          }

          .upload-text {
            font-size: var(--text-sm);
            color: var(--text-secondary);
            margin-bottom: var(--space-1);
          }

          .upload-hint {
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          }

          .upload-progress {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--space-3);
          }

          .upload-progress p {
            font-size: var(--text-sm);
            color: var(--text-secondary);
          }

          .progress-bar {
            width: 200px;
            height: 4px;
            background: var(--bg-tertiary);
            border-radius: var(--radius-full);
            overflow: hidden;
          }

          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--primary-500), var(--primary-400));
            border-radius: var(--radius-full);
            transition: width 0.3s ease;
          }

          .upload-empty {
            text-align: center;
            padding: var(--space-8);
            color: var(--text-tertiary);
            font-size: var(--text-sm);
          }

          .file-list {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
          }

          .file-item {
            display: flex;
            align-items: center;
            gap: var(--space-4);
            padding: var(--space-4);
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            transition: all var(--transition-fast);
          }

          .file-item:hover {
            box-shadow: var(--shadow-sm);
          }

          .file-icon {
            width: 40px;
            height: 40px;
            border-radius: var(--radius-md);
            background: rgba(239, 68, 68, 0.08);
            color: #ef4444;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .file-info {
            flex: 1;
            min-width: 0;
          }

          .file-info h3 {
            font-size: var(--text-sm);
            font-weight: 500;
            margin-bottom: var(--space-1);
          }

          .file-meta {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          }

          .file-item .btn-ghost:hover {
            color: var(--error);
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </main>
    </div>
  );
}
