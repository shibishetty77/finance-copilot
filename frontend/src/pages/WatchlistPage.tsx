import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Star,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { watchlistApi } from '@/api/watchlist';
import type { Watchlist, WatchlistUpdate } from '@/types/watchlist';

// ── Form schema ───────────────────────────────────────────────────────────────
const watchlistSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(20),
  company_name: z.string().max(255).optional(),
  sector: z.string().max(50).optional(),
  notes: z.string().optional(),
});

type WatchlistForm = z.infer<typeof watchlistSchema>;

export function WatchlistPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: '',
    page: 1,
    page_size: 20,
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Watchlist | null>(null);

  // Fetch watchlist
  const { data: watchlistData, isLoading: watchlistLoading } = useQuery({
    queryKey: ['watchlist', filters],
    queryFn: () => watchlistApi.list(filters),
  });

  // Create watchlist item mutation
  const createMutation = useMutation({
    mutationFn: watchlistApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setIsAddModalOpen(false);
    },
  });

  // Update watchlist item mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: WatchlistUpdate }) =>
      watchlistApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setIsEditModalOpen(false);
    },
  });

  // Delete watchlist item mutation
  const deleteMutation = useMutation({
    mutationFn: watchlistApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setIsDeleteModalOpen(false);
    },
  });

  // Form setup
  const form = useForm<WatchlistForm>({
    resolver: zodResolver(watchlistSchema),
    defaultValues: {
      symbol: '',
      company_name: '',
      sector: '',
      notes: '',
    },
  });

  const openEditModal = (item: Watchlist) => {
    setSelectedItem(item);
    form.reset({
      symbol: item.symbol,
      company_name: item.company_name || '',
      sector: item.sector || '',
      notes: item.notes || '',
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (item: Watchlist) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const onSubmit = (data: WatchlistForm) => {
    if (selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (selectedItem) {
      deleteMutation.mutate(selectedItem.id);
    }
  };

  // Show empty state
  if (!watchlistLoading && (!watchlistData || watchlistData.total === 0)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="fc-heading">Watchlist</h1>
            <p className="fc-subheading mt-0.5">Track stocks you're interested in</p>
          </div>
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add to Watchlist
          </Button>
        </div>

        <EmptyState
          icon={<Star className="w-12 h-12" />}
          title="No items in watchlist"
          description="Add stocks you want to track to your watchlist"
          action={
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsAddModalOpen(true)}>
              Add First Item
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="fc-heading">Watchlist</h1>
          <p className="fc-subheading mt-0.5">Track stocks you're interested in</p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Add to Watchlist
        </Button>
      </div>

      {/* Watchlist Card */}
      <Card>
        <CardHeader>
          <CardTitle>Watchlist Items</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          {/* Search */}
          <Input
            placeholder="Search watchlist..."
            leftIcon={<Search className="w-4 h-4" />}
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />

          {/* Watchlist Items */}
          <div className="space-y-2">
            {watchlistLoading ? (
              <p className="text-center text-white/50 py-8">Loading...</p>
            ) : (
              watchlistData?.items.map((item: Watchlist) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-hover transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{item.symbol}</p>
                    <p className="text-xs text-white/50">
                      {item.company_name || item.sector || 'No details'}
                    </p>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-white/50 truncate max-w-32">{item.notes}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Edit2 className="w-3 h-3" />}
                      onClick={() => openEditModal(item)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 className="w-3 h-3" />}
                      onClick={() => openDeleteModal(item)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {watchlistData && watchlistData.total_pages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={filters.page === 1}
                onClick={() => handlePageChange(filters.page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-white/50">
                Page {filters.page} of {watchlistData.total_pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={filters.page === watchlistData.total_pages}
                onClick={() => handlePageChange(filters.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Add Watchlist Item Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add to Watchlist"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Symbol" {...form.register('symbol')} placeholder="e.g., RELIANCE" />
          <Input label="Company Name" {...form.register('company_name')} placeholder="e.g., Reliance Industries" />
          <Input label="Sector" {...form.register('sector')} placeholder="e.g., Technology" />
          <Input label="Notes" {...form.register('notes')} placeholder="Why are you interested?" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Add to Watchlist
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Watchlist Item Modal */}
      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Watchlist Item"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Symbol" {...form.register('symbol')} />
          <Input label="Company Name" {...form.register('company_name')} />
          <Input label="Sector" {...form.register('sector')} />
          <Input label="Notes" {...form.register('notes')} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Update
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Remove from Watchlist"
      >
        <div className="space-y-4">
          <p className="text-white/70">
            Are you sure you want to remove {selectedItem?.symbol} from your watchlist?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
