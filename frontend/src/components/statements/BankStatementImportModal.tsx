import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Loader2, ArrowRight, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import { statementApi, StatementImportPreview, StatementImportResult } from '@/api/statements';
import { formatCurrency, formatDate } from '@/utils/formatDate';

interface BankStatementImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'summary';

export function BankStatementImportModal({ open, onClose, onSuccess }: BankStatementImportModalProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<StatementImportPreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<StatementImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep('upload');
      setFile(null);
      setPreviewData(null);
      setImportResult(null);
      setIsUploading(false);
    }
  }, [open]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        showToast('Only CSV files are supported', 'error');
        return;
      }
      if (selectedFile.size > 20 * 1024 * 1024) {
        showToast('File size must be less than 20MB', 'error');
        return;
      }
      setFile(selectedFile);
      await processFile(selectedFile);
    }
  };

  const processFile = async (f: File) => {
    setIsUploading(true);
    try {
      const data = await statementApi.uploadCSV(f);
      // set selected based on status
      const mappedData = {
        ...data,
        transactions: data.transactions.map((tx) => ({
          ...tx,
          selected: tx.status === 'Ready'
        }))
      };
      setPreviewData(mappedData);
      setStep('preview');
    } catch (error: any) {
      console.error(error);
      showToast(error.response?.data?.detail || 'Failed to parse CSV file', 'error');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (!droppedFile.name.toLowerCase().endsWith('.csv')) {
        showToast('Only CSV files are supported', 'error');
        return;
      }
      setFile(droppedFile);
      await processFile(droppedFile);
    }
  };

  const toggleRowSelection = (index: number) => {
    if (!previewData) return;
    const newData = { ...previewData };
    newData.transactions[index].selected = !newData.transactions[index].selected;
    setPreviewData(newData);
  };

  const toggleAll = (checked: boolean) => {
    if (!previewData) return;
    const newData = { ...previewData };
    newData.transactions.forEach((tx) => {
      tx.selected = checked;
    });
    setPreviewData(newData);
  };

  const handleImport = async () => {
    if (!previewData) return;
    const selectedRows = previewData.transactions.filter((tx) => tx.selected);
    if (selectedRows.length === 0) {
      showToast('Please select at least one transaction to import', 'error');
      return;
    }

    setStep('importing');
    try {
      const result = await statementApi.confirmImport(selectedRows);
      setImportResult(result);
      setStep('summary');
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Import failed', 'error');
      setStep('preview');
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      <div className={cn("text-xs font-medium px-2 py-1 rounded-md", step === 'upload' ? 'bg-brand-500/20 text-brand-300' : 'text-white/40')}>1. Upload</div>
      <ChevronRight className="w-3 h-3 text-white/20" />
      <div className={cn("text-xs font-medium px-2 py-1 rounded-md", step === 'preview' ? 'bg-brand-500/20 text-brand-300' : 'text-white/40')}>2. Preview</div>
      <ChevronRight className="w-3 h-3 text-white/20" />
      <div className={cn("text-xs font-medium px-2 py-1 rounded-md", ['importing', 'summary'].includes(step) ? 'bg-brand-500/20 text-brand-300' : 'text-white/40')}>3. Import</div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Import Bank Statement" size="xl">
      {renderStepIndicator()}
      
      {step === 'upload' && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-sm text-white/60 mb-4">
            Upload your bank statement in CSV format to automatically import transactions. Max size 20MB.
          </p>
          <div
            className={cn(
              'border-2 border-dashed border-white/10 rounded-xl p-8 text-center transition-colors',
              'hover:border-brand-500/50 hover:bg-brand-500/5',
              isUploading && 'opacity-50 cursor-not-allowed'
            )}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                <p className="text-sm text-white/80">Parsing CSV...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-surface border border-white/10 rounded-xl">
                  <UploadCloud className="w-6 h-6 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Drag and drop your CSV here</p>
                  <p className="text-xs text-white/50 mt-1">or click to browse files</p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="mt-2">
                  Browse Files
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'preview' && previewData && (
        <div className="space-y-4 animate-fade-in flex flex-col h-[60vh]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Preview Transactions</h3>
            <span className="text-xs text-white/50">{file?.name} &bull; {previewData.total_rows} rows found</span>
          </div>

          <div className="flex-1 overflow-auto border border-white/10 rounded-xl bg-surface-card relative">
            <table className="w-full text-left text-sm text-white/80">
              <thead className="bg-surface sticky top-0 z-10 border-b border-white/10">
                <tr>
                  <th className="p-3 font-medium text-white/50 w-10">
                    <input
                      type="checkbox"
                      checked={previewData.transactions.every((t) => t.selected)}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="rounded border-white/20 bg-surface-input text-brand-500 focus:ring-brand-500"
                    />
                  </th>
                  <th className="p-3 font-medium text-white/50">Date</th>
                  <th className="p-3 font-medium text-white/50">Description</th>
                  <th className="p-3 font-medium text-white/50 text-right">Amount</th>
                  <th className="p-3 font-medium text-white/50">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {previewData.transactions.map((tx, idx) => (
                  <tr key={idx} className={cn("hover:bg-white/5 transition-colors", tx.status === 'Duplicate' && 'opacity-60 bg-white/5')}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={tx.selected || false}
                        onChange={() => toggleRowSelection(idx)}
                        disabled={['Missing Data', 'Invalid'].includes(tx.status)}
                        className="rounded border-white/20 bg-surface-input text-brand-500 focus:ring-brand-500 disabled:opacity-50"
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap">{tx.date ? formatDate(tx.date) : '-'}</td>
                    <td className="p-3">
                      <div className="line-clamp-1" title={tx.description || ''}>{tx.description || '-'}</div>
                      {tx.merchant && <div className="text-xs text-white/40">{tx.merchant}</div>}
                    </td>
                    <td className={cn("p-3 text-right tabular-nums font-medium", tx.type === 'income' ? 'text-income' : tx.type === 'expense' ? 'text-expense' : '')}>
                      {tx.amount ? formatCurrency(tx.amount) : '-'}
                    </td>
                    <td className="p-3">
                      {tx.status === 'Ready' && <span className="inline-flex items-center gap-1 text-xs text-income"><CheckCircle className="w-3 h-3"/> Ready</span>}
                      {tx.status === 'Duplicate' && <span className="inline-flex items-center gap-1 text-xs text-brand-400 bg-brand-400/10 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3"/> Duplicate</span>}
                      {['Missing Data', 'Invalid'].includes(tx.status) && <span className="inline-flex items-center gap-1 text-xs text-expense"><AlertCircle className="w-3 h-3"/> {tx.status}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-white/50">
              {previewData.transactions.filter(t => t.selected).length} selected for import
            </span>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep('upload')}>Cancel</Button>
              <Button onClick={handleImport} leftIcon={<ArrowRight className="w-4 h-4" />}>
                Import Selected
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-fade-in">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
          <p className="text-white/80">Importing transactions...</p>
        </div>
      )}

      {step === 'summary' && importResult && (
        <div className="space-y-6 animate-fade-in text-center py-6">
          <div className="mx-auto w-16 h-16 bg-income/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-income" />
          </div>
          <h3 className="text-xl font-semibold text-white">Import Complete</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-surface-card border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-semibold text-income">{importResult.imported}</div>
              <div className="text-xs text-white/50 mt-1">Imported</div>
            </div>
            <div className="bg-surface-card border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-semibold text-brand-400">{importResult.duplicates}</div>
              <div className="text-xs text-white/50 mt-1">Duplicates Skipped</div>
            </div>
            <div className="bg-surface-card border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-semibold text-white/80">{importResult.skipped - importResult.duplicates}</div>
              <div className="text-xs text-white/50 mt-1">Other Skipped</div>
            </div>
            <div className="bg-surface-card border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-semibold text-expense">{importResult.errors}</div>
              <div className="text-xs text-white/50 mt-1">Errors</div>
            </div>
          </div>

          <div className="pt-6">
            <Button onClick={onSuccess}>View Transactions</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
