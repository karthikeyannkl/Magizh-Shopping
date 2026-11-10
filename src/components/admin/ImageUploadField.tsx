import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, X, Trash2, Link as LinkIcon, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StorageService } from '../../services/storage';

export interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  assignedProductId?: string;
  assignedCategoryId?: string;
  title?: string;
  placeholderUrl?: string;
  helperText?: string;
  slotIndex?: number;
  compact?: boolean;
}

const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  value,
  onChange,
  onRemove,
  assignedProductId,
  assignedCategoryId,
  title,
  placeholderUrl = 'https://images.unsplash.com/...',
  helperText,
  slotIndex,
  compact = false,
}) => {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState(value && (value.startsWith('http') || value.startsWith('/api/')) ? value : '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setUploadSuccess(false);

    const file = e.target.files?.[0];
    if (!file) return;

    // 1. MIME Type Validation
    const mime = file.type || 'image/jpeg';
    if (!SUPPORTED_MIME_TYPES.includes(mime) && !mime.startsWith('image/')) {
      setErrorMessage(`Unsupported format "${mime}". Allowed: JPEG, PNG, WebP, GIF, SVG.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. File Size Validation (5 MB limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(`File size (${sizeMB} MB) exceeds the 5 MB limit. Please select a smaller file.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);

    // Read as DataURL for live preview
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;

      try {
        const token = StorageService.getAdminToken();
        const res = await fetch('/api/admin/images/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'x-admin-secret': 'MAGIZH_ADMIN_HMAC_SECRET_2026',
          },
          body: JSON.stringify({
            filename: file.name,
            dataBase64: base64,
            mimeType: mime,
            sizeBytes: file.size,
            title: title || file.name,
            assignedProductId,
            assignedCategoryId,
          }),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.success && data?.url) {
          onChange(data.url);
          setUploadSuccess(true);
        } else {
          // If server upload failed, fallback to base64 so user work is not lost
          onChange(base64);
          setUploadSuccess(true);
        }
      } catch (err) {
        // Fallback to base64 preview when offline
        onChange(base64);
        setUploadSuccess(true);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setErrorMessage('Failed to read file.');
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleUrlApply = () => {
    setErrorMessage(null);
    if (!urlInput.trim()) {
      setErrorMessage('Please enter a valid image URL.');
      return;
    }
    onChange(urlInput.trim());
    setUploadSuccess(true);
  };

  const handleClear = () => {
    setErrorMessage(null);
    setUploadSuccess(false);
    setUrlInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onRemove) {
      onRemove();
    } else {
      onChange('');
    }
  };

  const hasImage = Boolean(value && value.trim().length > 0);

  return (
    <div className="space-y-2 text-xs">
      {/* Label and Mode Switcher */}
      <div className="flex items-center justify-between">
        <label className="font-bold text-gray-700 flex items-center gap-1.5">
          <span>{label}</span>
          {typeof slotIndex === 'number' && (
            <span className="text-[10px] bg-cream-200 text-gray-700 px-1.5 py-0.2 rounded font-mono font-bold">
              Slot #{slotIndex + 1}
            </span>
          )}
        </label>

        {/* Tab Toggle: Upload vs URL */}
        <div className="flex items-center gap-1 bg-cream-100 p-0.5 rounded-lg border border-cream-200">
          <button
            type="button"
            onClick={() => {
              setMode('upload');
              setErrorMessage(null);
            }}
            className={`px-2 py-0.5 rounded-md font-bold text-[10px] transition-all flex items-center gap-1 ${
              mode === 'upload'
                ? 'bg-white text-magizh-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Upload className="w-2.5 h-2.5" />
            <span>Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('url');
              setErrorMessage(null);
            }}
            className={`px-2 py-0.5 rounded-md font-bold text-[10px] transition-all flex items-center gap-1 ${
              mode === 'url'
                ? 'bg-white text-magizh-900 shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <LinkIcon className="w-2.5 h-2.5" />
            <span>Image URL</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-1.5 text-[11px] animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Content: Live Preview or Upload Controls */}
      {hasImage ? (
        <div className="relative border border-cream-300 rounded-2xl bg-cream-50/50 p-2.5 flex items-center gap-3">
          {/* Image Thumbnail */}
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white border border-cream-200 shrink-0 shadow-2xs">
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
              }}
            />
          </div>

          {/* Image Details & Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-darkbrown-900 truncate">
                {value.startsWith('data:')
                  ? 'Base64 Local Image'
                  : value.startsWith('/api/images/')
                  ? 'Persistent DB Image'
                  : 'Remote Image URL'}
              </span>
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            </div>
            <p className="text-[10px] text-gray-500 truncate font-mono mt-0.5" title={value}>
              {value.slice(0, 48)}...
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              {/* Replace Button */}
              <label className="cursor-pointer text-[10px] font-bold text-magizh-800 hover:text-magizh-900 flex items-center gap-1 bg-white hover:bg-cream-100 px-2 py-1 rounded-lg border border-cream-300 transition-colors">
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Replace</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {/* Remove Button */}
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1 bg-white hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200 transition-colors"
              >
                <Trash2 className="w-2.5 h-2.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {mode === 'upload' ? (
            <label
              className={`border-2 border-dashed border-cream-300 hover:border-magizh-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-cream-50/40 hover:bg-cream-100/50 transition-all ${
                isUploading ? 'opacity-60 cursor-wait' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-cream-200 flex items-center justify-center text-magizh-800 shadow-2xs mb-1.5">
                {isUploading ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-magizh-600" />
                ) : (
                  <Upload className="w-5 h-5 text-magizh-700" />
                )}
              </div>
              <span className="font-bold text-darkbrown-900 text-xs">
                {isUploading ? 'Uploading Image to Database...' : 'Click to select image file'}
              </span>
              <span className="text-[10px] text-gray-500 mt-0.5">
                JPEG, PNG, WebP, GIF, SVG (Max 5 MB)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={placeholderUrl}
                className="flex-1 p-2 bg-white border border-cream-300 rounded-xl font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={handleUrlApply}
                className="px-3 py-2 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl font-bold text-xs transition-colors shrink-0"
              >
                Apply URL
              </button>
            </div>
          )}
        </div>
      )}

      {helperText && <p className="text-[10px] text-gray-500 italic">{helperText}</p>}
    </div>
  );
};
