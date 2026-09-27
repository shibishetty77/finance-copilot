/**
 * ReceiptScanModal — CortexFi Receipt OCR (Phase 3).
 *
 * Manages five internal states:
 *   1. "upload"      — drag-and-drop / browse files zone with image preview
 *   2. "loading"     — animated progress steps while OCR + AI run
 *   3. "review"      — extracted fields, confidence badge, Edit / Continue / Retry / Cancel
 *   4. "ocr_failure" — OCR extracted too little text; suggestions + Retry / Upload Another / Cancel
 *   5. "ai_error"    — AI structuring failed; Retry / Cancel
 *
 * On "Continue" the parent receives a TransactionPrefill (the same shape as
 * AISmartEntryModal) and opens the existing Manual Transaction form pre-filled.
 * Zero transaction or AI logic lives here.
 *
 * Architecture rule: All OCR calls go through ocrApi.scanReceipt().
 * This component never calls Tesseract or Gemini directly.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Receipt,
  CheckCircle2,
  AlertCircle,
  Edit3,
  RefreshCw,
  ChevronRight,
  IndianRupee,
  Calendar,
  Building2,
  Tag,
  Layers,
  TrendingUp,
  FileText,
  Loader2,
  Upload,
  ImageIcon,
  X,
  Camera,
} from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { ocrApi } from '@/api/ocr';
import {
  getConfidenceLevel,
  formatConfidence,
  type ConfidenceLevel,
} from '@/utils/aiTransactionPrompt';
import { CATEGORIES } from '@/utils/categorize';
import type { ReceiptParseResponse, OCRFailureDetail } from '@/types/ocr';
import type { TransactionPrefill } from './AISmartEntryModal';

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.webp';

const OCR_PROGRESS_STEPS = [
  'Uploading receipt…',
  'Reading receipt…',
  'Extracting text…',
  'Understanding transaction…',
  'Preparing review…',
] as const;

const DEFAULT_SUGGESTIONS = [
  'Take a clearer photo with good lighting',
  'Avoid blurry or out-of-focus images',
  'Ensure receipt text is fully visible and not cropped',
];

// ── Types ──────────────────────────────────────────────────────────────────────

type ModalState = 'upload' | 'loading' | 'review' | 'ocr_failure' | 'ai_error';

interface ReceiptScanModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when user clicks Continue — parent opens the existing form pre-filled. */
  onContinue: (prefill: TransactionPrefill) => void;
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level: ConfidenceLevel = getConfidenceLevel(confidence);
  const styles: Record<ConfidenceLevel, string> = {
    high:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/15  text-amber-400  border-amber-500/30',
    low:    'bg-red-500/15    text-red-400    border-red-500/30',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
        styles[level],
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {formatConfidence(confidence)}
    </span>
  );
}

function ReviewField({
  label,
  icon: Icon,
  value,
  editValue,
  editing,
  onEdit,
  inputType = 'text',
  selectOptions,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  editValue: string;
  editing: boolean;
  onEdit: (val: string) => void;
  inputType?: string;
  selectOptions?: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-white/40" strokeWidth={2} />
        <p className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</p>
      </div>
      {editing ? (
        selectOptions ? (
          <select
            className="w-full bg-surface-input border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 outline-none transition-colors"
            value={editValue}
            onChange={(e) => onEdit(e.target.value)}
          >
            {selectOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-surface">
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={inputType}
            className="w-full bg-surface-input border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 outline-none transition-colors"
            value={editValue}
            onChange={(e) => onEdit(e.target.value)}
          />
        )
      ) : (
        <p className="text-sm font-semibold text-white pl-0.5">
          {value || <span className="text-white/30 font-normal italic">Not detected</span>}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ReceiptScanModal({ open, onClose, onContinue }: ReceiptScanModalProps) {
  const [state, setState] = useState<ModalState>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ReceiptParseResponse | null>(null);
  const [ocrSuggestions, setOcrSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [aiErrorMessage, setAiErrorMessage] = useState('');

  // Edit state — mirrors parsed fields
  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editType, setEditType] = useState<'income' | 'expense'>('expense');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');

  // Progress animation
  const [progressStep, setProgressStep] = useState(0);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setState('upload');
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsDragging(false);
      setFileError(null);
      setParsed(null);
      setEditing(false);
      setProgressStep(0);
      setOcrSuggestions(DEFAULT_SUGGESTIONS);
      setAiErrorMessage('');
    }
  }, [open]);

  // Cleanup preview URL and timer on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [previewUrl]);

  // ── File validation ────────────────────────────────────────────────────────

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Unsupported file type (${file.type || 'unknown'}). Please upload a PNG, JPEG, or WEBP image.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return `File is ${mb} MB — maximum size is 10 MB. Please compress or crop the image.`;
    }
    return null;
  }

  function selectFile(file: File) {
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      return;
    }
    setFileError(null);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
    // Reset the input so the same file can be re-selected after clearing
    e.target.value = '';
  };

  // ── Progress animation ─────────────────────────────────────────────────────

  function startProgressAnimation() {
    setProgressStep(0);
    let step = 0;
    progressTimer.current = setInterval(() => {
      step += 1;
      if (step >= OCR_PROGRESS_STEPS.length) {
        if (progressTimer.current) clearInterval(progressTimer.current);
      } else {
        setProgressStep(step);
      }
    }, 600);
  }

  function stopProgressAnimation() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }

  // ── Populate edit fields ───────────────────────────────────────────────────

  function populateEditFields(p: ReceiptParseResponse) {
    setEditAmount(p.amount != null ? String(p.amount) : '');
    setEditMerchant(p.merchant ?? '');
    setEditCategory(p.category ?? '');
    setEditType(p.type ?? 'expense');
    setEditDescription(p.description ?? '');
    setEditDate(p.transaction_date ?? new Date().toISOString().split('T')[0]);
  }

  // ── Scan ───────────────────────────────────────────────────────────────────

  async function handleScan() {
    if (!selectedFile) return;

    setState('loading');
    setProgressStep(0);
    startProgressAnimation();

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const result = await ocrApi.scanReceipt(formData);
      stopProgressAnimation();
      setProgressStep(OCR_PROGRESS_STEPS.length - 1);
      await new Promise((r) => setTimeout(r, 300));
      setParsed(result);
      populateEditFields(result);
      setEditing(false);
      setState('review');
    } catch (err: unknown) {
      stopProgressAnimation();

      // Try to read the structured error detail from the backend
      const axiosErr = err as { response?: { data?: { detail?: OCRFailureDetail } }; message?: string };
      const detail = axiosErr?.response?.data?.detail;

      if (detail?.code === 'ocr_failure') {
        setOcrSuggestions(detail.suggestions ?? DEFAULT_SUGGESTIONS);
        setState('ocr_failure');
      } else {
        const msg = detail?.message
          ?? (err instanceof Error ? err.message : 'An unexpected error occurred.');
        setAiErrorMessage(msg);
        setState('ai_error');
      }
    }
  }

  // ── Continue ───────────────────────────────────────────────────────────────

  function handleContinue() {
    const amount = editing
      ? (parseFloat(editAmount) || undefined)
      : (parsed?.amount ?? undefined);

    const merchant = editing ? editMerchant : (parsed?.merchant ?? undefined);
    const categoryName = editing ? editCategory : (parsed?.category ?? null);
    const type: 'income' | 'expense' = editing ? editType : (parsed?.type ?? 'expense');
    const description = editing ? editDescription : (parsed?.description ?? '');
    const date = editing
      ? editDate
      : (parsed?.transaction_date ?? new Date().toISOString().split('T')[0]);

    // Map category name → category_id using the same CATEGORIES list
    let category_id: number | undefined;
    if (categoryName) {
      const match = CATEGORIES.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
      );
      category_id = match?.id;
    }

    const prefill: TransactionPrefill = {
      description: description || merchant || (selectedFile?.name ?? 'Receipt'),
      amount,
      type,
      category_id,
      transaction_date: date,
      merchant_name: merchant || undefined,
    };

    onContinue(prefill);
  }

  // ── Reset to upload state ──────────────────────────────────────────────────

  function resetToUpload() {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setFileError(null);
    setState('upload');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onClose={state === 'loading' ? () => {} : onClose}
      size="lg"
    >
      {/* ── Upload state ── */}
      {state === 'upload' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-900/40 border border-brand-500/30 mb-2">
              <Receipt className="w-7 h-7 text-brand-400" strokeWidth={2} />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Scan Receipt</h2>
            <p className="text-sm text-white/50 max-w-sm mx-auto leading-relaxed">
              Upload a receipt image and Cortex will automatically extract the transaction.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative flex flex-col items-center justify-center gap-4',
              'min-h-48 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer',
              isDragging
                ? 'border-brand-500 bg-brand-900/20 scale-[1.01]'
                : 'border-white/15 bg-white/3 hover:border-brand-500/40 hover:bg-brand-900/10',
            )}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload receipt image"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          >
            {previewUrl ? (
              /* Preview */
              <div className="relative w-full p-4">
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="mx-auto max-h-52 object-contain rounded-xl shadow-lg"
                />
                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); resetToUpload(); }}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-white/20 text-white/60 hover:text-white hover:bg-red-900/40 hover:border-red-500/40 transition-all duration-200"
                  aria-label="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <p className="mt-3 text-center text-xs text-white/40">
                  {selectedFile?.name} · {((selectedFile?.size ?? 0) / 1024).toFixed(0)} KB
                </p>
              </div>
            ) : (
              /* Empty drop zone */
              <div className="flex flex-col items-center gap-3 py-4 px-6 text-center pointer-events-none">
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300',
                  isDragging ? 'bg-brand-500/20 border border-brand-500/50' : 'bg-white/5 border border-white/10',
                )}>
                  {isDragging ? (
                    <Upload className="w-6 h-6 text-brand-400 animate-bounce" strokeWidth={2} />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-white/30" strokeWidth={1.5} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white/70">
                    {isDragging ? 'Drop your receipt here' : 'Drag & drop your receipt'}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    PNG, JPG, JPEG, WEBP · Max 10 MB
                  </p>
                </div>
              </div>
            )}

            {/* Animated drag glow */}
            {isDragging && (
              <div className="absolute inset-0 rounded-2xl bg-brand-500/5 pointer-events-none animate-pulse" />
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileInput}
            className="sr-only"
            aria-label="Choose receipt file"
            id="receipt-file-input"
          />

          {/* File error */}
          {fileError && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-xs text-red-300">{fileError}</p>
            </div>
          )}

          {/* Browse button + accepted formats */}
          <div className="flex flex-col items-center gap-3">
            <Button
              variant="secondary"
              type="button"
              leftIcon={<Camera className="w-4 h-4" />}
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
            <p className="text-xs text-white/30">
              Accepted: PNG, JPEG, WEBP · Max 10 MB
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              onClick={handleScan}
              disabled={!selectedFile || !!fileError}
              leftIcon={<Receipt className="w-4 h-4" />}
            >
              Scan Receipt
            </Button>
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {state === 'loading' && (
        <div className="space-y-8 py-4 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-900/40 border border-brand-500/30 mb-2">
              <Loader2 className="w-7 h-7 text-brand-400 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-white">Reading your receipt…</h2>
            <p className="text-sm text-white/40">Cortex is extracting the transaction details</p>
          </div>

          {/* Receipt thumbnail */}
          {previewUrl && (
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="Receipt being processed"
                className="h-24 object-contain rounded-xl opacity-60 border border-white/10"
              />
            </div>
          )}

          {/* Progress steps */}
          <div className="space-y-3">
            {OCR_PROGRESS_STEPS.map((step, index) => {
              const done = index < progressStep;
              const active = index === progressStep;
              return (
                <div
                  key={step}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500',
                    done && 'bg-emerald-500/8 border border-emerald-500/20',
                    active && 'bg-brand-900/30 border border-brand-500/30',
                    !done && !active && 'opacity-30',
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" strokeWidth={2} />
                  ) : active ? (
                    <Loader2 className="w-4 h-4 text-brand-400 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      'text-sm',
                      done && 'text-emerald-300',
                      active && 'text-brand-300 font-medium',
                      !done && !active && 'text-white/30',
                    )}
                  >
                    {done ? '✓ ' : ''}{step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Review state ── */}
      {state === 'review' && parsed && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                <h2 className="text-lg font-bold text-white">Receipt Scanned</h2>
              </div>
              <p className="text-sm text-white/40">
                Please review the extracted information before continuing.
              </p>
            </div>
            <ConfidenceBadge confidence={parsed.confidence} />
          </div>

          {/* Receipt thumbnail */}
          {previewUrl && (
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="Scanned receipt"
                className="h-20 object-contain rounded-lg border border-white/10 opacity-70"
              />
            </div>
          )}

          {/* Fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ReviewField
              label="Merchant"
              icon={Building2}
              value={editMerchant || '—'}
              editValue={editMerchant}
              editing={editing}
              onEdit={setEditMerchant}
            />
            <ReviewField
              label="Amount (₹)"
              icon={IndianRupee}
              value={editAmount ? `₹${parseFloat(editAmount).toLocaleString('en-IN')}` : '—'}
              editValue={editAmount}
              editing={editing}
              onEdit={setEditAmount}
              inputType="number"
            />
            <ReviewField
              label="Category"
              icon={Tag}
              value={editCategory || '—'}
              editValue={editCategory}
              editing={editing}
              onEdit={setEditCategory}
              selectOptions={[
                { value: '', label: 'None' },
                ...CATEGORIES.map((c) => ({ value: c.name, label: `${c.icon} ${c.name}` })),
              ]}
            />
            <ReviewField
              label="Transaction Type"
              icon={TrendingUp}
              value={editType.charAt(0).toUpperCase() + editType.slice(1)}
              editValue={editType}
              editing={editing}
              onEdit={(v) => setEditType(v as 'income' | 'expense')}
              selectOptions={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
            />
            <ReviewField
              label="Date"
              icon={Calendar}
              value={editDate || '—'}
              editValue={editDate}
              editing={editing}
              onEdit={setEditDate}
              inputType="date"
            />
            <ReviewField
              label="Description"
              icon={FileText}
              value={editDescription || '—'}
              editValue={editDescription}
              editing={editing}
              onEdit={setEditDescription}
            />
          </div>

          {/* Low-confidence warning */}
          {getConfidenceLevel(parsed.confidence) === 'low' && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-xs text-amber-300 leading-relaxed">
                I wasn't able to confidently read all the receipt details. Please review and correct the fields before continuing.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} type="button">
              Cancel
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToUpload}
              type="button"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry OCR
            </Button>
            {editing ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(false)}
                type="button"
                leftIcon={<Layers className="w-3.5 h-3.5" />}
              >
                Done Editing
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
                type="button"
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              >
                Edit
              </Button>
            )}
            <Button
              onClick={handleContinue}
              type="button"
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* ── OCR Failure state ── */}
      {state === 'ocr_failure' && (
        <div className="space-y-6 py-4 animate-fade-in">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-900/30 border border-amber-500/30 mb-2">
              <AlertCircle className="w-7 h-7 text-amber-400" strokeWidth={2} />
            </div>
            <h2 className="text-lg font-bold text-white">Couldn't read this receipt.</h2>
            <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
              The image didn't contain enough readable text. Try these tips:
            </p>
          </div>

          {/* Suggestions */}
          <ul className="space-y-2">
            {ocrSuggestions.map((tip) => (
              <li key={tip} className="flex items-start gap-2 px-4 py-3 rounded-xl bg-surface-input border border-white/5">
                <span className="text-amber-400 text-sm flex-shrink-0">•</span>
                <span className="text-sm text-white/60">{tip}</span>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button variant="ghost" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={resetToUpload}
              type="button"
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Upload Another
            </Button>
            <Button
              onClick={() => {
                setState('upload');
                setSelectedFile(null);
                if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
              }}
              type="button"
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* ── AI Error state ── */}
      {state === 'ai_error' && (
        <div className="space-y-6 py-4 animate-fade-in">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-900/30 border border-red-500/30 mb-2">
              <AlertCircle className="w-7 h-7 text-red-400" strokeWidth={2} />
            </div>
            <h2 className="text-lg font-bold text-white">
              Couldn't structure this receipt.
            </h2>
            <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
              {aiErrorMessage || 'Cortex was unable to extract transaction details. Please try again.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="ghost" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => setState('upload')}
              type="button"
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Try Again
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
