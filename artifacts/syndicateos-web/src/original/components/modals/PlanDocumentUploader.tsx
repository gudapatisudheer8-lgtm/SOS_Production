import React, { useState, useRef } from 'react';
import { validatePlanFile } from '../../../adapter/planFile';
import { PlanUploadDocument, SectorType } from '../../types';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Eye,
  Trash2,
  ZoomIn,
  X,
  Sparkles,
  Download,
  CheckCircle2,
  Maximize2
} from 'lucide-react';

interface PlanDocumentUploaderProps {
  documents: PlanUploadDocument[];
  onChange: (docs: PlanUploadDocument[]) => void;
  sector: SectorType;
}

export const PlanDocumentUploader: React.FC<PlanDocumentUploaderProps> = ({
  documents,
  onChange,
  sector,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<PlanUploadDocument | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadError('');
    try {
      const selected = Array.from(files);
      for (const file of selected) await validatePlanFile(file);
      const newDocs = await Promise.all(selected.map(async (file) => {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error(`Could not read "${file.name}". Select it again.`));
          reader.readAsDataURL(file);
        });
        let defaultCategory: PlanUploadDocument['category'] = 'floor_plan';
        let defaultTitle = file.name.replace(/\.[^/.]+$/, '');

        if (sector === 'real_estate_open_plotting') {
          defaultCategory = 'master_layout';
          defaultTitle = file.name.replace(/\.[^/.]+$/, '');
        } else if (sector === 'real_estate_construction') {
          defaultCategory = 'floor_plan';
          defaultTitle = file.name.replace(/\.[^/.]+$/, '');
        }

        const doc: PlanUploadDocument = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          fileName: file.name,
          fileType: file.type || 'image/png',
          fileSize: file.size,
          uploadedAt: new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          dataUrl,
          title: defaultTitle,
          category: defaultCategory,
        };

        return doc;
      }));
      onChange([...documents, ...newDocs]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveDoc = (id: string) => {
    onChange(documents.filter((d) => d.id !== id));
    if (selectedDocForPreview?.id === id) {
      setSelectedDocForPreview(null);
    }
  };

  const handleUpdateTitle = (id: string, title: string) => {
    onChange(
      documents.map((d) => (d.id === id ? { ...d, title } : d))
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      {uploadError && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-xl">{uploadError}</p>}
      {/* Upload Zone & Action Bar */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
          dragActive
            ? 'border-amber-500 bg-amber-50/70'
            : 'border-gray-300 hover:border-amber-400 bg-gray-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-gray-900">
              Upload {sector === 'real_estate_construction' ? 'Building Architectural Plans & Elevation Blueprints' : sector === 'real_estate_open_plotting' ? 'DTCP / CRDA / HMDA Approved Master Layout Plans' : 'Venture Statutory Drawing / Sanctioned Map'}
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              PDF, PNG, JPG or WebP · Maximum 10 MB per file
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Browse Files to Upload</span>
            </button>

          </div>
        </div>
      </div>

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700">
            <span>Uploaded Venture Blueprints &amp; Plans ({documents.length})</span>
            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Attached to this project
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3 relative group"
              >
                {/* Thumbnail Preview */}
                <div
                  onClick={() => setSelectedDocForPreview(doc)}
                  className="w-16 h-16 rounded-xl bg-slate-900 border border-gray-200 overflow-hidden shrink-0 cursor-pointer relative flex items-center justify-center group/thumb"
                >
                  {doc.dataUrl ? (
                    <img
                      src={doc.dataUrl}
                      alt={doc.title}
                      className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform"
                    />
                  ) : (
                    <FileText className="w-8 h-8 text-slate-400" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <input
                    type="text"
                    value={doc.title}
                    onChange={(e) => handleUpdateTitle(doc.id, e.target.value)}
                    className="w-full text-xs font-bold text-gray-900 border-b border-transparent focus:border-amber-400 outline-none pb-0.5 truncate bg-transparent"
                    placeholder="Plan Title"
                  />
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-bold uppercase">
                      {doc.category.replace('_', ' ')}
                    </span>
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>• {doc.uploadedAt}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedDocForPreview(doc)}
                    title="Zoom / View Blueprint"
                    className="p-1.5 text-gray-500 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveDoc(doc.id)}
                    title="Remove Document"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox / Fullscreen Modal Preview */}
      {selectedDocForPreview && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex flex-col p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between text-white pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-gray-950 flex items-center justify-center font-black">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black truncate max-w-md sm:max-w-xl">
                  {selectedDocForPreview.title}
                </h3>
                <p className="text-[11px] text-gray-400">
                  {selectedDocForPreview.fileName} • {formatFileSize(selectedDocForPreview.fileSize)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedDocForPreview.dataUrl && (
                <a
                  href={selectedDocForPreview.dataUrl}
                  download={selectedDocForPreview.fileName}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setSelectedDocForPreview(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-950 rounded-2xl overflow-auto p-2 sm:p-4 flex items-center justify-center border border-white/10">
            {selectedDocForPreview.dataUrl ? (
              <img
                src={selectedDocForPreview.dataUrl}
                alt={selectedDocForPreview.title}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <div className="text-center text-gray-400 p-8">
                <FileText className="w-16 h-16 mx-auto mb-2 text-gray-500" />
                <p className="text-sm font-semibold">PDF Document Attached</p>
                <p className="text-xs text-gray-500 mt-1">{selectedDocForPreview.fileName}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
