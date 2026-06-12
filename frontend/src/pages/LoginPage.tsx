import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, IndianRupee, TrendingUp, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { getApiError } from '@/api/client';

// ── Form schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

// ── Features list ─────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: TrendingUp,   text: 'Track investments, stocks & mutual funds' },
  { icon: IndianRupee,  text: 'Monitor expenses with AI categorization' },
  { icon: ShieldCheck,  text: 'Bank-grade security & encryption' },
];

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('root', { message: getApiError(err) });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: branding ────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-surface-card via-brand-950 to-surface flex-col items-start justify-between p-12 relative overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-glow">
            <IndianRupee className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-lg">Finance</span>
            <span className="text-gradient font-bold text-lg ml-1">Copilot</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Your Personal
            <br />
            <span className="text-gradient">Finance AI</span>
          </h1>
          <p className="text-white/60 text-lg mb-10 max-w-sm leading-relaxed">
            Track spending, grow investments, and get AI-powered insights tailored for Indian investors.
          </p>
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-brand-400" />
                </div>
                <span className="text-white/70 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-8 relative z-10">
          {[['10K+', 'Active users'], ['₹50Cr+', 'Tracked'], ['AI', 'Powered']].map(([val, label]) => (
            <div key={label}>
              <div className="text-xl font-bold text-white">{val}</div>
              <div className="text-xs text-white/40">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: login form ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">Finance <span className="text-gradient">Copilot</span></span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-white/50 text-sm mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              autoComplete="email"
              id="login-email"
              {...register('email')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              leftIcon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              autoComplete="current-password"
              id="login-password"
              {...register('password')}
            />

            {/* Root error */}
            {errors.root && (
              <div className="p-3 rounded-xl bg-expense/10 border border-expense/30 text-expense text-sm">
                {errors.root.message}
              </div>
            )}

            <Button type="submit" fullWidth loading={isSubmitting} id="login-submit">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-white/50">
            Don't have an account?{' '}
            <Link to="/signup" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
