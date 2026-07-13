import {
  PencilLine,
  Sparkles,
  FileSpreadsheet,
  Receipt,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';

interface TransactionHubModalProps {
  open: boolean;
  onClose: () => void;
  onManualEntry: () => void;
  onAISmartEntry: () => void;
}

interface ImportMethod {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: 'available' | 'coming-soon';
  toastMessage?: string;
}

const importMethods: ImportMethod[] = [
  {
    id: 'manual',
    title: 'Manual Entry',
    description: 'Enter transaction details manually.',
    icon: PencilLine,
    status: 'available',
  },
  {
    id: 'ai',
    title: 'AI Smart Entry',
    description: 'Describe your transaction naturally.',
    icon: Sparkles,
    status: 'available',
  },
  {
    id: 'bank-statement',
    title: 'Bank Statement',
    description: 'Import PDF or CSV bank statements.',
    icon: FileSpreadsheet,
    status: 'coming-soon',
    toastMessage: 'Bank Statement Import is under development.',
  },
  {
    id: 'receipt',
    title: 'Scan Receipt',
    description: 'Extract transactions from receipts.',
    icon: Receipt,
    status: 'coming-soon',
    toastMessage: 'Receipt OCR will be available soon.',
  },
  {
    id: 'gmail',
    title: 'Gmail Import',
    description: 'Import transactions from bank emails.',
    icon: Mail,
    status: 'coming-soon',
    toastMessage: 'Gmail integration is planned.',
  },
  {
    id: 'sms',
    title: 'Paste SMS',
    description: 'Paste a bank SMS and extract transaction details.',
    icon: MessageSquare,
    status: 'coming-soon',
    toastMessage: 'SMS parser is coming soon.',
  },
];

export function TransactionHubModal({
  open,
  onClose,
  onManualEntry,
  onAISmartEntry,
}: TransactionHubModalProps) {
  const { showToast } = useToast();

  const handleCardClick = (method: ImportMethod) => {
    if (method.id === 'manual') {
      onClose();
      onManualEntry();
    } else if (method.id === 'ai') {
      onClose();
      onAISmartEntry();
    } else {
      showToast(method.toastMessage || 'Coming soon', 'info');
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    method: ImportMethod
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(method);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction" description="Choose how you'd like to capture your transaction." size="lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {importMethods.map((method) => {
          const Icon = method.icon;
          return (
            <button
              key={method.id}
              onClick={() => handleCardClick(method)}
              onKeyDown={(e) => handleKeyDown(e, method)}
              className={cn(
                'relative group flex flex-col items-start gap-3 p-5 rounded-xl',
                'bg-surface-input border border-white/10',
                'hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10',
                'transition-all duration-300 ease-out',
                'hover:-translate-y-1',
                'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-card',
                'cursor-pointer'
              )}
              tabIndex={0}
              aria-label={`${method.title}: ${method.description}`}
            >
              {/* Icon */}
              <div
                className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-xl',
                  'bg-surface-card border border-white/10',
                  'group-hover:border-brand-500/30 group-hover:bg-brand-900/20',
                  'transition-all duration-300 ease-out'
                )}
              >
                <Icon
                  className={cn(
                    'w-6 h-6',
                    method.status === 'available'
                      ? 'text-brand-400'
                      : 'text-white/40 group-hover:text-white/60'
                  )}
                  strokeWidth={2}
                />
              </div>

              {/* Content */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white">
                    {method.title}
                  </h3>
                  {method.status === 'coming-soon' && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/5 text-white/50 border border-white/10">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  {method.description}
                </p>
              </div>

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-xl bg-brand-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
