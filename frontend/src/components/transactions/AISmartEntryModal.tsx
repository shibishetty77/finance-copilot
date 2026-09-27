/**
 * AISmartEntryModal — CortexFi AI Smart Entry (Phase 2).
 *
 * Manages three internal states:
 *   1. "input"   — large textarea, Analyze / Cancel buttons
 *   2. "loading" — animated progress steps while the AI runs
 *   3. "review"  — extracted fields, confidence badge, Edit / Continue / Cancel
 *   4. "error"   — AI couldn't parse; Retry / Edit Manually / Cancel
 *
 * On "Continue" the parent receives a pre-filled TransactionForm object and
 * opens the existing Manual Transaction modal. Zero transaction logic lives here.
 *
 * Architecture rule: All AI calls go through aiApi.parseTransaction().
 * This component never calls Gemini directly.
 */

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
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
} from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { aiApi } from '@/api/ai';
import {
  buildTransactionPrompt,
  parseTransactionResponse,
  getConfidenceLevel,
  formatConfidence,
  type ConfidenceLevel,
} from '@/utils/aiTransactionPrompt';
import { CATEGORIES } from '@/utils/categorize';
import type { ParsedTransaction } from '@/types/transaction-parser';

// ── Types ─────────────────────────────────────────────────────────────────────

/** The pre-filled shape passed back to the existing Add Transaction form. */
export interface TransactionPrefill {
  description: string;
  amount?: number;
  type: 'income' | 'expense';
  category_id?: number;
  transaction_date: string;
  merchant_name?: string;
  notes?: string;
}

interface AISmartEntryModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user clicks Continue — parent opens the existing form pre-filled. */
  onContinue: (prefill: TransactionPrefill) => void;
}

type ModalState = 'input' | 'loading' | 'review' | 'error';

// ── Loading progress steps ─────────────────────────────────────────────────────

const PROGRESS_STEPS = [
  'Understanding your transaction…',
  'Identifying merchant…',
  'Detecting amount…',
  'Categorizing transaction…',
  'Preparing review…',
] as const;

// ── Confidence badge ───────────────────────────────────────────────────────────

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

// ── Editable review field ──────────────────────────────────────────────────────

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

export function AISmartEntryModal({
  open,
  onClose,
  onContinue,
}: AISmartEntryModalProps) {
  const [state, setState] = useState<ModalState>('input');
  const [inputText, setInputText] = useState('');
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Editing state — mirrors parsed fields as editable strings
  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editType, setEditType] = useState<'income' | 'expense'>('expense');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');

  // Loading step animation
  const [progressStep, setProgressStep] = useState(0);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when the modal opens
  useEffect(() => {
    if (open) {
      setState('input');
      setInputText('');
      setParsed(null);
      setErrorMessage('');
      setEditing(false);
      setProgressStep(0);
    }
  }, [open]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  // ── Populate edit fields when parsed data arrives ──────────────────────────

  function populateEditFields(p: ParsedTransaction) {
    setEditAmount(p.amount != null ? String(p.amount) : '');
    setEditMerchant(p.merchant ?? '');
    setEditCategory(p.category ?? '');
    setEditType(p.type ?? 'expense');
    setEditDescription(p.description ?? '');
    setEditDate(p.transaction_date ?? new Date().toISOString().split('T')[0]);
  }

  // ── Animate loading steps ──────────────────────────────────────────────────

  function startProgressAnimation() {
    setProgressStep(0);
    let step = 0;
    progressTimer.current = setInterval(() => {
      step += 1;
      if (step >= PROGRESS_STEPS.length) {
        if (progressTimer.current) clearInterval(progressTimer.current);
      } else {
        setProgressStep(step);
      }
    }, 500);
  }

  function stopProgressAnimation() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }

  // ── Analyze ────────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!inputText.trim()) return;

    setState('loading');
    setProgressStep(0);
    startProgressAnimation();

    const today = new Date().toISOString().split('T')[0];
    const prompt = buildTransactionPrompt(inputText.trim(), today);

    try {
      const aiResponse = await aiApi.parseTransaction({ prompt });
      stopProgressAnimation();

      // Animate to last step before transitioning
      setProgressStep(PROGRESS_STEPS.length - 1);
      await new Promise((r) => setTimeout(r, 300));

      const result = parseTransactionResponse(aiResponse.response);
      setParsed(result);
      populateEditFields(result);
      setEditing(false);
      setState('review');
    } catch (err) {
      stopProgressAnimation();
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(message);
      setState('error');
    }
  }

  // ── Continue (map parsed → TransactionPrefill) ─────────────────────────────

  function handleContinue() {
    // Use edited values if in edit mode, otherwise parsed
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
      description: description || merchant || inputText.slice(0, 100),
      amount,
      type,
      category_id,
      transaction_date: date,
      merchant_name: merchant || undefined,
    };

    onContinue(prefill);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onClose={state === 'loading' ? () => {} : onClose}
      size="lg"
    >
      {/* ── Input state ── */}
      {state === 'input' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-900/40 border border-brand-500/30 mb-2">
              <Sparkles className="w-7 h-7 text-brand-400" strokeWidth={2} />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              ✨ AI Smart Entry
            </h2>
            <p className="text-sm text-white/50 max-w-sm mx-auto leading-relaxed">
              Describe your transaction naturally and Cortex will extract the details.
            </p>
          </div>

          {/* Textarea */}
          <div className="space-y-2">
            <textarea
              id="ai-smart-entry-input"
              className={cn(
                'w-full h-32 px-4 py-3 rounded-xl resize-none',
                'bg-surface-input border border-white/10',
                'text-sm text-white placeholder:text-white/30',
                'focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30',
                'transition-colors duration-200',
              )}
              placeholder={
                'e.g.\n' +
                'Paid ₹540 for lunch at McDonald\'s yesterday.\n' +
                'Received ₹50,000 salary today.\n' +
                'Uber ride cost me ₹320.'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAnalyze();
                }
              }}
              autoFocus
            />
            <p className="text-xs text-white/30 text-right">Ctrl+Enter to analyze</p>
          </div>

          {/* Example chips */}
          <div className="flex flex-wrap gap-2">
            {[
              'Paid ₹540 for lunch at McDonald\'s yesterday.',
              'Received ₹50,000 salary today.',
              'Uber ride cost me ₹320.',
              'Paid electricity bill of ₹1,850.',
              'Bought groceries worth ₹2,100 from DMart.',
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setInputText(example)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-lg',
                  'bg-white/5 border border-white/10 text-white/50',
                  'hover:bg-brand-900/30 hover:border-brand-500/30 hover:text-white/80',
                  'transition-all duration-200 text-left',
                )}
              >
                {example.length > 40 ? example.slice(0, 40) + '…' : example}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={!inputText.trim()}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Analyze
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
            <h2 className="text-lg font-bold text-white">Analyzing your transaction…</h2>
            <p className="text-sm text-white/40">Cortex is reading between the lines</p>
          </div>

          {/* Quoted input */}
          <div className="px-4 py-3 rounded-xl bg-surface-input border border-white/5 text-sm text-white/50 italic leading-relaxed">
            "{inputText}"
          </div>

          {/* Progress steps */}
          <div className="space-y-3">
            {PROGRESS_STEPS.map((step, index) => {
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
                <h2 className="text-lg font-bold text-white">Cortex understood</h2>
              </div>
              <p className="text-sm text-white/40">
                Please review the extracted information before continuing.
              </p>
            </div>
            <ConfidenceBadge confidence={parsed.confidence} />
          </div>

          {/* Quoted input */}
          <div className="px-4 py-3 rounded-xl bg-surface-input border border-white/5 text-xs text-white/40 italic leading-relaxed">
            "{inputText}"
          </div>

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

          {/* Confidence note for low confidence */}
          {getConfidenceLevel(parsed.confidence) === 'low' && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-xs text-amber-300 leading-relaxed">
                I couldn't confidently understand all details. Please review and correct the fields before continuing.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              type="button"
            >
              Cancel
            </Button>
            <div className="flex-1" />
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

      {/* ── Error state ── */}
      {state === 'error' && (
        <div className="space-y-6 py-4 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-900/30 border border-red-500/30 mb-2">
              <AlertCircle className="w-7 h-7 text-red-400" strokeWidth={2} />
            </div>
            <h2 className="text-lg font-bold text-white">
              I couldn't confidently understand this transaction.
            </h2>
            <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
              {errorMessage || 'The AI was unable to extract structured data. Try rephrasing, or enter manually.'}
            </p>
          </div>

          {/* Quoted input — never lost */}
          <div className="px-4 py-3 rounded-xl bg-surface-input border border-white/5 text-sm text-white/50 italic leading-relaxed">
            "{inputText}"
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="ghost"
              onClick={onClose}
              type="button"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setState('input');
                setErrorMessage('');
              }}
              type="button"
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Retry
            </Button>
            <Button
              onClick={() => {
                // Continue to the existing manual form with just the raw text as description
                onContinue({
                  description: inputText.slice(0, 100),
                  type: 'expense',
                  transaction_date: new Date().toISOString().split('T')[0],
                });
              }}
              type="button"
            >
              Edit Manually
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
