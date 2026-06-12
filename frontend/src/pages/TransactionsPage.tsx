import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  IndianRupee,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Calendar,
  Tag,
  Building2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { transactionsApi } from '@/api/transactions';
import { formatCurrency, formatDate } from '@/utils/formatDate';
import type { Transaction, TransactionCreate, TransactionUpdate } from '@/types/transaction';

// ── Form schema ───────────────────────────────────────────────────────────────
const transactionSchema = z.object({
  description: z.string().min(1, 'Description is required').max(255),
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense']),
  category_id: z.number().optional(),
  transaction_date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_recurring: z.boolean().optional(),
  recurrence_type: z.enum(['monthly', 'weekly', 'yearly']).optional(),
  merchant_name: z.string().max(100).optional(),
});

type TransactionForm = z.infer<typeof transactionSchema>;

// ── Summary Card Component ─────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  icon: Icon,
  trend,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: number;
  color: string;
}) {
  return (
    <Card className="flex-1 min-w-0">
      <CardHeader>
        <p className="text-xs text-white/50 font-medium">{label}</p>
        <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </CardHeader>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend >= 0 ? 'text-income' : 'text-expense'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend).toFixed(2)}% vs last month
        </div>
      )}
    </Card>
  );
}

export function TransactionsPage() {
  const qc = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState({
    type: undefined as 'income' | 'expense' | undefined,
    category_id: undefined as number | undefined,
    date_from: undefined as string | undefined,
    date_to: undefined as string | undefined,
    search: '',
    page: 1,
    page_size: 20,
  });

  // Fetch transactions
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => transactionsApi.list(filters),
  });

  // Fetch monthly summary
  const { data: monthlySummary } = useQuery({
    queryKey: ['transactions-summary'],
    queryFn: () => transactionsApi.getMonthlySummary(),
  });

  // Calculate current month totals
  const currentMonthData = monthlySummary?.[0] || { income: 0, expenses: 0, savings: 0 };
  const savingsRate = currentMonthData.income > 0 
    ? ((currentMonthData.savings / currentMonthData.income) * 100).toFixed(1)
    : '0';

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: TransactionCreate) => transactionsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transactions-summary'] });
      setIsAddModalOpen(false);
      addForm.reset();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionUpdate }) =>
      transactionsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transactions-summary'] });
      setIsEditModalOpen(false);
      setSelectedTransaction(null);
      editForm.reset();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transactions-summary'] });
      setIsDeleteModalOpen(false);
      setSelectedTransaction(null);
    },
  });

  // Add form
  const addForm = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      transaction_date: new Date().toISOString().split('T')[0],
      is_recurring: false,
    },
  });

  // Edit form
  const editForm = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
  });

  const handleAdd = (data: TransactionForm) => {
    createMutation.mutate(data as TransactionCreate);
  };

  const handleEdit = (data: TransactionForm) => {
    if (selectedTransaction) {
      updateMutation.mutate({
        id: selectedTransaction.id,
        data: data as TransactionUpdate,
      });
    }
  };

  const openEditModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    editForm.reset({
      description: transaction.description || '',
      amount: transaction.amount,
      type: transaction.type,
      category_id: transaction.category_id || undefined,
      transaction_date: transaction.transaction_date.split('T')[0],
      notes: transaction.notes || undefined,
      tags: transaction.tags || undefined,
      is_recurring: transaction.is_recurring,
      recurrence_type: transaction.recurrence_type || undefined,
      merchant_name: transaction.merchant_name || undefined,
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (selectedTransaction) {
      deleteMutation.mutate(selectedTransaction.id);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="fc-heading">Transactions</h1>
          <p className="fc-subheading mt-0.5">Track your income and expenses</p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
        <SummaryCard
          label="Total Income"
          value={formatCurrency(currentMonthData.income)}
          icon={IndianRupee}
          color="bg-income/80"
        />
        <SummaryCard
          label="Total Expenses"
          value={formatCurrency(currentMonthData.expenses)}
          icon={TrendingUp}
          color="bg-expense/80"
        />
        <SummaryCard
          label="Savings"
          value={formatCurrency(currentMonthData.savings)}
          icon={IndianRupee}
          color="bg-purple-600"
        />
        <SummaryCard
          label="Savings Rate"
          value={`${savingsRate}%`}
          icon={TrendingUp}
          color="bg-brand-600"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <Filter className="w-4 h-4 text-white/40" />
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            placeholder="Search transactions..."
            leftIcon={<Search className="w-4 h-4" />}
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
          <Select
            placeholder="Type"
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ]}
          />
          <Input
            type="date"
            placeholder="From Date"
            value={filters.date_from || ''}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
          />
          <Input
            type="date"
            placeholder="To Date"
            value={filters.date_to || ''}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
          />
        </div>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <span className="text-xs text-white/40">
            {transactionsData?.total || 0} transactions
          </span>
        </CardHeader>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-input animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-surface-input animate-pulse rounded" />
                  <div className="h-3 w-20 bg-surface-input animate-pulse rounded" />
                </div>
                <div className="h-4 w-16 bg-surface-input animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : transactionsData?.items && transactionsData.items.length > 0 ? (
          <div className="space-y-2">
            {transactionsData.items.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-hover transition-colors"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    transaction.type === 'income' ? 'bg-income/20' : 'bg-expense/20'
                  }`}
                >
                  {transaction.category?.icon ? (
                    <span className="text-lg">{transaction.category.icon}</span>
                  ) : (
                    <IndianRupee className="w-4 h-4 text-white/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {transaction.description || transaction.merchant_name || 'Transaction'}
                  </p>
                  <p className="text-xs text-white/50">
                    {formatDate(transaction.transaction_date)}
                    {transaction.category && ` • ${transaction.category.name}`}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      transaction.type === 'income' ? 'text-income' : 'text-expense'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(transaction)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteModal(transaction)}
                  >
                    <Trash2 className="w-4 h-4 text-expense" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-white/50">No transactions found</p>
          </div>
        )}

        {/* Pagination */}
        {transactionsData && transactionsData.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-border">
            <p className="text-xs text-white/50">
              Page {transactionsData.page} of {transactionsData.total_pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={transactionsData.page === 1}
                onClick={() => handlePageChange(transactionsData.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={transactionsData.page === transactionsData.total_pages}
                onClick={() => handlePageChange(transactionsData.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Transaction Modal */}
      <TransactionModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAdd}
        form={addForm}
        title="Add Transaction"
        submitLabel="Add Transaction"
        isSubmitting={createMutation.isPending}
      />

      {/* Edit Transaction Modal */}
      <TransactionModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTransaction(null);
        }}
        onSubmit={handleEdit}
        form={editForm}
        title="Edit Transaction"
        submitLabel="Save Changes"
        isSubmitting={updateMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedTransaction(null);
        }}
        title="Delete Transaction"
        description="Are you sure you want to delete this transaction? This action cannot be undone."
      >
        <div className="flex gap-3 justify-end mt-6">
          <Button
            variant="secondary"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setSelectedTransaction(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ── Transaction Modal Component ─────────────────────────────────────────────────
function TransactionModal({
  open,
  onClose,
  onSubmit,
  form,
  title,
  submitLabel,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionForm) => void;
  form: ReturnType<typeof useForm<TransactionForm>>;
  title: string;
  submitLabel: string;
  isSubmitting: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Description"
          placeholder="e.g., Grocery shopping at Walmart"
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            leftIcon={<IndianRupee className="w-4 h-4" />}
            error={form.formState.errors.amount?.message}
            {...form.register('amount', { valueAsNumber: true })}
          />
          <Select
            label="Type"
            value={form.watch('type')}
            onChange={(e) => form.setValue('type', e.target.value as 'income' | 'expense')}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ]}
            error={form.formState.errors.type?.message}
          />
        </div>
        <Input
          label="Date"
          type="date"
          leftIcon={<Calendar className="w-4 h-4" />}
          error={form.formState.errors.transaction_date?.message}
          {...form.register('transaction_date')}
        />
        <Input
          label="Merchant"
          placeholder="e.g., Walmart"
          leftIcon={<Building2 className="w-4 h-4" />}
          error={form.formState.errors.merchant_name?.message}
          {...form.register('merchant_name')}
        />
        <Input
          label="Tags"
          placeholder="e.g., travel, vacation (comma separated)"
          leftIcon={<Tag className="w-4 h-4" />}
          {...form.register('tags', {
            setValueAs: (value) => {
              if (!value) return undefined;
              return value.split(',').map((t: string) => t.trim()).filter(Boolean);
            },
          })}
        />
        <Input
          label="Notes"
          placeholder="Additional notes..."
          {...form.register('notes')}
        />
        {form.formState.errors.root && (
          <p className="text-sm text-expense">{form.formState.errors.root.message}</p>
        )}
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
