import React, { useEffect, useState } from 'react';
import { Mail, RefreshCw, LogOut, CheckSquare, Square, Trash2, Edit2, Play, AlertCircle, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { gmailApi, GmailTransactionCandidate } from '@/api/gmail';
import { getApiError } from '@/api/client';

export interface GmailImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GmailImportModal({ open, onClose, onSuccess }: GmailImportModalProps) {
  const { showToast } = useToast();
  const addToast = ({ message, type }: { message: string; type: string }) => 
    showToast(message, type === 'warning' ? 'error' : (type as 'success' | 'info' | 'error'));

  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanDays, setScanDays] = useState(7);
  const [candidates, setCandidates] = useState<GmailTransactionCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [editingItem, setEditingItem] = useState<GmailTransactionCandidate | null>(null);

  // Load status when modal opens
  useEffect(() => {
    if (!open) return;

    async function checkStatus() {
      setLoading(true);
      try {
        const status = await gmailApi.getStatus();
        setConnected(status.connected);
        if (status.email) setConnectedEmail(status.email);
      } catch (err) {
        addToast({ type: 'error', message: getApiError(err) });
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, [open, showToast]);

  const handleConnect = async () => {
    try {
      const { url } = await gmailApi.getAuthUrl();
      // Redirect to Google. Google will redirect back to /gmail-callback
      window.location.href = url;
    } catch (err) {
      addToast({ type: 'error', message: getApiError(err) });
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Gmail account?')) return;
    try {
      await gmailApi.disconnect();
      setConnected(false);
      setConnectedEmail(null);
      setCandidates([]);
      setSelectedIds(new Set());
      addToast({ type: 'success', message: 'Disconnected Gmail account' });
    } catch (err) {
      addToast({ type: 'error', message: getApiError(err) });
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setCandidates([]);
    setSelectedIds(new Set());
    try {
      const res = await gmailApi.scan(scanDays);
      setCandidates(res.transactions);
      // Auto-select items that are Ready (not duplicates)
      const initialSelected = new Set<string>();
      res.transactions.forEach((tx) => {
        if (tx.status === 'Ready') {
          initialSelected.add(tx.gmail_message_id);
        }
      });
      setSelectedIds(initialSelected);
      addToast({
        type: 'success',
        message: `Found ${res.transactions.length} transaction emails in last ${scanDays} days.`,
      });
    } catch (err) {
      addToast({ type: 'error', message: `Scan Failed: ${getApiError(err)}` });
    } finally {
      setScanning(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.gmail_message_id)));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDeleteItem = (id: string) => {
    setCandidates(candidates.filter((c) => c.gmail_message_id !== id));
    const next = new Set(selectedIds);
    next.delete(id);
    setSelectedIds(next);
  };

  const handleSaveEdit = (edited: GmailTransactionCandidate) => {
    setCandidates(candidates.map((c) => (c.gmail_message_id === edited.gmail_message_id ? edited : c)));
    setEditingItem(null);
    addToast({ type: 'success', message: 'Transaction details updated' });
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      addToast({ type: 'warning', message: 'No transactions selected for import' });
      return;
    }

    setImporting(true);
    const payload = candidates
      .filter((c) => selectedIds.has(c.gmail_message_id))
      .map((c) => ({
        gmail_message_id: c.gmail_message_id,
        merchant: c.merchant,
        amount: c.amount || 0,
        type: c.type,
        date: c.date,
        payment_method: c.payment_method,
        category: c.category,
        description: c.description,
      }));

    try {
      const res = await gmailApi.importTransactions(payload);
      addToast({
        type: 'success',
        message: `Import complete. Imported: ${res.imported}, Duplicates Skipped: ${res.duplicates}, Errors: ${res.errors}`,
      });
      onSuccess();
    } catch (err) {
      addToast({ type: 'error', message: `Import Failed: ${getApiError(err)}` });
    } finally {
      setImporting(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-white">
          <RefreshCw className="w-8 h-8 animate-spin mb-2" />
          <span>Checking Gmail authorization status...</span>
        </div>
      );
    }

    if (!connected) {
      return (
        <Card className="p-8 max-w-xl mx-auto text-center border-dashed border-2 border-surface-border bg-surface-card/60">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400">
            <Mail className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect your Gmail Account</h2>
          <p className="text-white/60 mb-6 text-sm">
            Connect your Gmail account to scan and extract transactions. We request readonly access to parse bank transaction alerts, order confirmations, and receipts.
          </p>
          <Button onClick={handleConnect} size="lg" className="w-full sm:w-auto">
            Connect Gmail securely
          </Button>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* Connection Status & Control */}
        <Card className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Connected Account</p>
              <p className="text-sm font-semibold text-white">{connectedEmail}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/50">Days to Scan:</label>
              <select
                value={scanDays}
                onChange={(e) => setScanDays(Number(e.target.value))}
                className="bg-surface-hover border border-surface-border text-white text-xs rounded-lg p-2 focus:ring-brand-500"
              >
                <option value={1}>Last 24 Hours</option>
                <option value={3}>Last 3 Days</option>
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
              </select>
            </div>
            <Button onClick={handleScan} disabled={scanning} className="flex-1 sm:flex-none">
              {scanning ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              Scan Emails
            </Button>
            <Button onClick={handleDisconnect} variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Scanning Progress state */}
        {scanning && (
          <Card className="p-8 text-center text-white/60 space-y-4">
            <RefreshCw className="w-10 h-10 animate-spin mx-auto text-brand-500" />
            <div className="space-y-1">
              <h3 className="text-white font-semibold">Scanning Gmail Inboxes</h3>
              <p className="text-sm">Fetching candidate emails & structuring them via AI. This may take a moment...</p>
            </div>
          </Card>
        )}

        {/* Candidate Transactions Review */}
        {!scanning && candidates.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold flex items-center gap-2">
                Review Extracted Transactions
                <Badge variant="default">{candidates.length}</Badge>
              </h3>
              <div className="flex gap-2">
                <Button onClick={handleToggleSelectAll} variant="secondary" size="sm">
                  {selectedIds.size === candidates.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button onClick={handleImport} disabled={importing || selectedIds.size === 0} size="sm">
                  {importing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Import Selected ({selectedIds.size})
                </Button>
              </div>
            </div>

            {/* Transactions grid */}
            <div className="grid gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {candidates.map((item) => {
                const isSelected = selectedIds.has(item.gmail_message_id);
                const isDuplicate = item.status === 'Duplicate';

                return (
                  <Card
                    key={item.gmail_message_id}
                    className={`p-4 transition-all duration-200 ${
                      isSelected ? 'border-brand-500 bg-brand-500/5' : 'hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => handleToggleSelectItem(item.gmail_message_id)}
                        className="mt-1 text-white/40 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-brand-500" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="col-span-1 md:col-span-2">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-white font-semibold truncate block">
                              {item.merchant || 'Unknown Merchant'}
                            </span>
                            {isDuplicate && (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-none flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> Possible Duplicate
                              </Badge>
                            )}
                            <Badge variant="default" className="text-xs">
                              Confidence: {Math.round(item.confidence * 100)}%
                            </Badge>
                          </div>
                          <p className="text-xs text-white/50 truncate">Subject: {item.subject}</p>
                          <p className="text-xs text-white/30 truncate">From: {item.sender}</p>
                        </div>

                        <div className="flex flex-col justify-center">
                          <span className="text-white font-bold text-base">
                            {item.type === 'expense' ? '-' : '+'}₹{(item.amount || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-xs text-white/40 uppercase tracking-wider">{item.type}</span>
                        </div>

                        <div className="flex flex-col justify-center md:items-end">
                          <span className="text-sm text-white/80 font-medium">{item.date}</span>
                          <span className="text-xs text-white/40">{item.category || 'Uncategorized'}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-2 text-white/40 hover:text-white hover:bg-surface-hover rounded-lg"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.gmail_message_id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {!scanning && candidates.length === 0 && (
          <Card className="p-8 text-center text-white/40">
            <Mail className="w-12 h-12 mx-auto mb-2 text-white/20" />
            <p>No transaction candidates found in the scan range.</p>
            <p className="text-xs mt-1">Try increasing the date filter or ensuring bank alert emails are present.</p>
          </Card>
        )}
      </div>
    );
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Gmail Transaction Import" size="3xl">
        <div className="animate-fade-in">
          {renderContent()}
        </div>
      </Modal>
      {/* Edit Modal (layered on top if active) */}
      {editingItem && (
        <Modal
          open={true}
          title="Edit Extracted Transaction"
          onClose={() => setEditingItem(null)}
        >
          <EditTransactionForm
            item={editingItem}
            onSave={handleSaveEdit}
            onCancel={() => setEditingItem(null)}
          />
        </Modal>
      )}
    </>
  );
}

// Edit Form Helper component
function EditTransactionForm({
  item,
  onSave,
  onCancel,
}: {
  item: GmailTransactionCandidate;
  onSave: (edited: GmailTransactionCandidate) => void;
  onCancel: () => void;
}) {
  const [merchant, setMerchant] = useState(item.merchant || '');
  const [amount, setAmount] = useState(item.amount?.toString() || '');
  const [type, setType] = useState(item.type);
  const [dateStr, setDateStr] = useState(item.date);
  const [category, setCategory] = useState(item.category || '');
  const [description, setDescription] = useState(item.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...item,
      merchant: merchant.trim() || undefined,
      amount: parseFloat(amount) || undefined,
      type,
      date: dateStr,
      category: category.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1">Merchant</label>
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1">Amount (₹)</label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1">Transaction Type</label>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as 'income' | 'expense')}
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1">Date</label>
          <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/60 mb-1">Category</label>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/60 mb-1">Description</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Changes
        </Button>
      </div>
    </form>
  );
}
