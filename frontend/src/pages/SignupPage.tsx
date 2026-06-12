import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, Phone, IndianRupee } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth';
import { getApiError } from '@/api/client';

// ── Validation schema ─────────────────────────────────────────────────────────
const schema = z
  .object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    email:     z.string().email('Enter a valid email address'),
    phone:     z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one digit'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type FormData = z.infer<typeof schema>;

// ── Password strength indicator ───────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /[0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ['bg-expense', 'bg-warning', 'bg-income'];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[score - 1] : 'bg-surface-border'}`}
          />
        ))}
      </div>
      <div className="flex gap-3">
        {checks.map(({ label, ok }) => (
          <span key={label} className={`text-2xs ${ok ? 'text-income' : 'text-white/30'}`}>
            {ok ? '✓' : '○'} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SignupPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const password = watch('password', '');

  const onSubmit = async (data: FormData) => {
    try {
      await authApi.register({
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
      });
      await login(data.email, data.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('root', { message: getApiError(err) });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Link to="/login" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">Finance <span className="text-gradient">Copilot</span></span>
          </Link>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Create your account</h2>
        <p className="text-white/50 text-sm mb-8">Start your financial journey today. It's free.</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Input
            label="Full name"
            type="text"
            placeholder="Riya Sharma"
            leftIcon={<User className="w-4 h-4" />}
            error={errors.full_name?.message}
            autoComplete="name"
            id="signup-name"
            {...register('full_name')}
          />

          <Input
            label="Email address"
            type="email"
            placeholder="riya@example.com"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            autoComplete="email"
            id="signup-email"
            {...register('email')}
          />

          <Input
            label="Mobile number (optional)"
            type="tel"
            placeholder="9876543210"
            leftIcon={<Phone className="w-4 h-4" />}
            hint="Used for account recovery only"
            error={errors.phone?.message}
            autoComplete="tel"
            id="signup-phone"
            {...register('phone')}
          />

          <div>
            <Input
              label="Password"
              type="password"
              placeholder="Create a strong password"
              leftIcon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              autoComplete="new-password"
              id="signup-password"
              {...register('password')}
            />
            {password && <PasswordStrength password={password} />}
          </div>

          <Input
            label="Confirm password"
            type="password"
            placeholder="Repeat your password"
            leftIcon={<Lock className="w-4 h-4" />}
            error={errors.confirm_password?.message}
            autoComplete="new-password"
            id="signup-confirm-password"
            {...register('confirm_password')}
          />

          {errors.root && (
            <div className="p-3 rounded-xl bg-expense/10 border border-expense/30 text-expense text-sm">
              {errors.root.message}
            </div>
          )}

          <Button type="submit" fullWidth loading={isSubmitting} id="signup-submit">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-2xs text-white/30">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
