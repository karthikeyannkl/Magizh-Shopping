import React, { useState, useEffect } from 'react';
import { X, Upload, Check, Image as ImageIcon, Loader2, Search, Trash2 } from 'lucide-react';
import { ProductImage } from '../../types';
import { optimizeImageForUpload } from './ImageUploadField';

interface ImageGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  currentImages?: string[];
}

export const ImageGalleryModal: React.FC<ImageGalleryModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  currentImages = [],
}) => {
  const [galleryImages, setGalleryImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchGallery = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/images', {
        headers: {
          'x-admin-secret': 'MAGIZH_ADMIN_HMAC_SECRET_2026',
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.images)) {
        setGalleryImages(data.images);
      }
    } catch (err) {
      console.error('Failed to load image library', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGallery();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      let lastUploadedUrl = '';
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) continue;
        const optimized = await optimizeImageForUpload(file, 1400, 0.90);
        const res = await fetch('/api/admin/images/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-secret': 'MAGIZH_ADMIN_HMAC_SECRET_2026',
          },
          body: JSON.stringify({
            filename: file.name,
            dataBase64: optimized.dataBase64,
            mimeType: optimized.mimeType,
            sizeBytes: optimized.sizeBytes,
            title: file.name,
          }),
        });
        const data = await res.json();
        if (data.success && data.url) {
          lastUploadedUrl = data.url;
        }
      }

      await fetchGallery();
      if (files.length === 1 && lastUploadedUrl) {
        onSelectImage(lastUploadedUrl);
        onClose();
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload error');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const filtered = galleryImages.filter((img) =>
    (img.title || img.filename).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-cream-200 flex items-center justify-between bg-cream-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-900">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-darkbrown-900">Reusable Product Image Gallery</h2>
              <p className="text-xs text-gray-500">Select an existing stored image or upload a new one permanently</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-cream-200 text-gray-500 hover:text-darkbrown-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Upload Bar */}
        <div className="p-4 border-b border-cream-200 bg-white flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stored images..."
              className="w-full pl-9 pr-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-600 focus:outline-none"
            />
          </div>

          <label className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all shrink-0">
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>Upload New to Gallery</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>

        {uploadError && (
          <div className="mx-4 mt-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold">
            {uploadError}
          </div>
        )}

        {/* Images Grid */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              <span className="text-xs font-bold">Loading stored image library...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">No matching stored images found.</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Use the button above to upload a new image.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((img) => {
                const imgDisplayUrl = img.dataBase64 || img.url;
                const isSelected = currentImages.includes(img.url) || currentImages.includes(img.id);

                return (
                  <div
                    key={img.id}
                    onClick={() => {
                      onSelectImage(img.url);
                      onClose();
                    }}
                    className={`group relative border-2 rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-amber-600 ring-2 ring-amber-400/40 bg-amber-50/20'
                        : 'border-cream-200 hover:border-amber-400 bg-white'
                    }`}
                  >
                    <div className="aspect-square bg-cream-50 overflow-hidden flex items-center justify-center">
                      <img
                        src={imgDisplayUrl}
                        alt={img.title || img.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    </div>

                    <div className="p-2 text-[10px] bg-white border-t border-cream-100">
                      <p className="font-bold text-darkbrown-900 truncate">{img.title || img.filename}</p>
                      <div className="flex items-center justify-between text-gray-400 mt-0.5">
                        <span>{(img.sizeBytes ? (img.sizeBytes / 1024).toFixed(0) : '0')} KB</span>
                        <span className="font-mono text-[9px] uppercase">{img.mimeType?.replace('image/', '')}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 p-1 rounded-full bg-amber-600 text-white shadow-sm">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-cream-200 bg-cream-50 flex items-center justify-between text-xs text-gray-500">
          <span>{filtered.length} image(s) available</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-cream-300 hover:bg-cream-100 rounded-xl font-bold text-darkbrown-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
