import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Phone, Lock, Save, Camera } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { authApi } from '@/api/auth';
import { getApiError } from '@/api/client';
import { formatDateTime } from '@/utils/formatDate';
import type { UpdateProfileRequest, ChangePasswordRequest } from '@/types/auth';

// ── Profile form schema ───────────────────────────────────────────────────────
const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian number')
    .optional()
    .or(z.literal('')),
});
type ProfileForm = z.infer<typeof profileSchema>;

// ── Password form schema ──────────────────────────────────────────────────────
const pwSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Must have one uppercase letter')
      .regex(/[0-9]/, 'Must have one digit'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });
type PasswordForm = z.infer<typeof pwSchema>;

export function ProfilePage() {
  const qc = useQueryClient();
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [pwSuccess, setPwSuccess]           = useState(false);

  // Fetch user
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn:  authApi.getMe,
  });

  // Profile mutation
  const profileMutation = useMutation({
    mutationFn: (data: UpdateProfileRequest) => authApi.updateMe(data),
    onSuccess: (updated) => {
      qc.setQueryData(['me'], updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    },
  });

  // Password mutation
  const pwMutation = useMutation({
    mutationFn: (data: ChangePasswordRequest) => authApi.changePassword(data),
    onSuccess: () => {
      setPwSuccess(true);
      pwForm.reset();
      setTimeout(() => setPwSuccess(false), 3000);
    },
  });

  // Profile form
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { full_name: user?.full_name ?? '', phone: user?.phone ?? '' },
  });

  // Password form
  const pwForm = useForm<PasswordForm>({ resolver: zodResolver(pwSchema) });

  const initials = user?.full_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="fc-heading">Profile</h1>
        <p className="fc-subheading mt-0.5">Manage your account details and security settings</p>
      </div>

      {/* Avatar section */}
      <Card>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-glow">
              {initials}
            </div>
            <button
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-surface-input border border-surface-border flex items-center justify-center hover:bg-surface-hover transition-colors"
              aria-label="Change avatar"
            >
              <Camera className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>
          <div>
            <p className="text-lg font-bold text-white">{user?.full_name}</p>
            <p className="text-sm text-white/50">{user?.email}</p>
            {user?.created_at && (
              <p className="text-xs text-white/30 mt-1">
                Member since {formatDateTime(user.created_at)}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <User className="w-4 h-4 text-white/40" />
        </CardHeader>
        <form
          onSubmit={profileForm.handleSubmit((d) =>
            profileMutation.mutateAsync({ full_name: d.full_name, phone: d.phone || undefined }),
          )}
          noValidate
          className="space-y-5"
        >
          <Input
            label="Full name"
            leftIcon={<User className="w-4 h-4" />}
            error={profileForm.formState.errors.full_name?.message}
            id="profile-name"
            {...profileForm.register('full_name')}
          />

          <Input
            label="Email address"
            type="email"
            value={user?.email ?? ''}
            leftIcon={<Mail className="w-4 h-4" />}
            disabled
            className="opacity-50 cursor-not-allowed"
            id="profile-email"
            hint="Email cannot be changed. Contact support."
          />

          <Input
            label="Mobile number"
            type="tel"
            placeholder="9876543210"
            leftIcon={<Phone className="w-4 h-4" />}
            error={profileForm.formState.errors.phone?.message}
            id="profile-phone"
            {...profileForm.register('phone')}
          />

          {profileMutation.error && (
            <p className="text-sm text-expense">{getApiError(profileMutation.error)}</p>
          )}
          {profileSuccess && (
            <p className="text-sm text-income">✓ Profile updated successfully</p>
          )}

          <Button
            type="submit"
            loading={profileMutation.isPending}
            leftIcon={<Save className="w-4 h-4" />}
            id="profile-save"
          >
            Save changes
          </Button>
        </form>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <Lock className="w-4 h-4 text-white/40" />
        </CardHeader>
        <form
          onSubmit={pwForm.handleSubmit((d) =>
            pwMutation.mutateAsync({
              current_password: d.current_password,
              new_password: d.new_password,
            }),
          )}
          noValidate
          className="space-y-5"
        >
          <Input
            label="Current password"
            type="password"
            leftIcon={<Lock className="w-4 h-4" />}
            error={pwForm.formState.errors.current_password?.message}
            id="pw-current"
            {...pwForm.register('current_password')}
          />
          <Input
            label="New password"
            type="password"
            leftIcon={<Lock className="w-4 h-4" />}
            error={pwForm.formState.errors.new_password?.message}
            hint="At least 8 characters, 1 uppercase, 1 digit"
            id="pw-new"
            {...pwForm.register('new_password')}
          />
          <Input
            label="Confirm new password"
            type="password"
            leftIcon={<Lock className="w-4 h-4" />}
            error={pwForm.formState.errors.confirm_password?.message}
            id="pw-confirm"
            {...pwForm.register('confirm_password')}
          />

          {pwMutation.error && (
            <p className="text-sm text-expense">{getApiError(pwMutation.error)}</p>
          )}
          {pwSuccess && (
            <p className="text-sm text-income">✓ Password changed successfully</p>
          )}

          <Button
            type="submit"
            loading={pwMutation.isPending}
            leftIcon={<Lock className="w-4 h-4" />}
            id="pw-save"
          >
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
