import {
  MessageSquareText,
  Sparkles,
  TrendingUp,
  Shield,
  PieChart,
  ArrowRight,
  Bot,
  Clock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { useNavigate } from 'react-router-dom';

const SUGGESTED_PROMPTS = [
  'How can I improve my savings rate this month?',
  'Analyze my top spending categories',
  'What is my portfolio diversification score?',
  'Help me plan an emergency fund goal',
];

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Smart Insights',
    description: 'Get personalized analysis of your spending and income patterns.',
  },
  {
    icon: PieChart,
    title: 'Portfolio Guidance',
    description: 'Understand allocation, risk, and opportunities in your holdings.',
  },
  {
    icon: Shield,
    title: 'Financial Health',
    description: 'Receive actionable recommendations to strengthen your finances.',
  },
];

const RECENT_PLACEHOLDERS = [
  { title: 'Monthly spending review', time: 'Coming soon' },
  { title: 'Portfolio rebalancing tips', time: 'Coming soon' },
  { title: 'Savings goal strategy', time: 'Coming soon' },
];

export function AIAssistantPage() {
  const navigate = useNavigate();

  return (
    <div className="fc-page max-w-6xl mx-auto">
      <PageHeader
        title="AI Assistant"
        subtitle="Your intelligent financial copilot — powered insights coming soon"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-600/15 text-brand-400 border border-brand-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            Beta Preview
          </span>
        }
      />

      {/* Hero */}
      <Card className="fc-card-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-brand-600/30 border border-brand-500/30 flex items-center justify-center mb-4 shadow-glow transition-transform duration-300 ease-out hover:scale-105">
              <Bot className="w-7 h-7 text-brand-300" strokeWidth={1.5} />
            </div>
            <h2 className="fc-heading-lg mb-3">
              Ask anything about your finances
            </h2>
            <p className="fc-subheading max-w-md">
              The AI Assistant will help you understand spending trends, portfolio performance,
              and goal progress — all in natural language.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Button disabled leftIcon={<MessageSquareText className="w-4 h-4" />}>
                Start a conversation
              </Button>
              <Button variant="secondary" onClick={() => navigate('/analytics')}>
                View Analytics
              </Button>
            </div>
          </div>

          {/* Chat illustration */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-brand-400" strokeWidth={2} />
              </div>
              <div className="flex-1 p-4 rounded-2xl rounded-tl-sm bg-white/5 border border-white/10">
                <p className="text-sm text-white/80">
                  Hi! I&apos;m your Finance Copilot. Once enabled, I&apos;ll analyze your
                  transactions and portfolio to give you personalized insights.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <div className="max-w-[80%] p-4 rounded-2xl rounded-tr-sm bg-brand-600/20 border border-brand-500/20">
                <p className="text-sm text-white/90">
                  How can I reduce my monthly expenses?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-brand-400" strokeWidth={2} />
              </div>
              <div className="flex-1 p-4 rounded-2xl rounded-tl-sm bg-white/5 border border-white/10">
                <p className="text-sm text-white/50 italic">
                  AI responses will appear here when the feature launches...
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Suggested prompts */}
      <div className="fc-section">
        <h3 className="text-sm font-semibold text-white/70 mb-3">Suggested prompts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              disabled
              className="fc-card-interactive text-left p-4
                         disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              <p className="text-sm text-white/80 group-hover:text-white transition-colors duration-200">
                {prompt}
              </p>
              <ArrowRight className="w-4 h-4 text-white/30 mt-2 group-hover:text-brand-400 transition-colors duration-200" strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Features */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-white/70">Feature highlights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="fc-card-interactive !p-4">
                <div className="w-9 h-9 rounded-xl bg-brand-600/15 flex items-center justify-center mb-3 shadow-glow transition-transform duration-300 ease-out hover:scale-110">
                  <Icon className="w-4 h-4 text-brand-400" strokeWidth={2} />
                </div>
                <p className="text-sm font-semibold text-white mb-1">{title}</p>
                <p className="text-xs text-white/50 leading-relaxed">{description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent conversations placeholder */}
        <Card className="fc-card">
          <CardHeader>
            <CardTitle>Recent conversations</CardTitle>
            <Clock className="w-4 h-4 text-white/40" strokeWidth={2} />
          </CardHeader>
          <div className="space-y-2">
            {RECENT_PLACEHOLDERS.map((item) => (
              <div
                key={item.title}
                className="p-3 rounded-xl bg-white/[0.02] border border-surface-border opacity-60 transition-colors duration-200 hover:bg-white/[0.04]"
              >
                <p className="text-sm text-white/70">{item.title}</p>
                <p className="text-xs text-white/40 mt-0.5">{item.time}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Transactions', path: '/transactions' },
          { label: 'Portfolio', path: '/portfolio' },
          { label: 'Goals', path: '/goals' },
          { label: 'Analytics', path: '/analytics' },
        ].map(({ label, path }) => (
          <Button key={label} variant="secondary" fullWidth onClick={() => navigate(path)}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
