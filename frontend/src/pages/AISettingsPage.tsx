import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, CheckCircle, XCircle, Server, Cloud, Key, Globe, Zap, Cpu } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { aiApi } from '@/api/ai';
import { getApiError } from '@/api/client';
import type {
  AIMode,
  AIProvider,
  UpdateAISettingsRequest,
} from '@/types/ai';

// ── AI Settings form schema ─────────────────────────────────────────────────
const aiSettingsSchema = z.object({
  mode: z.enum(['cloud', 'byok']),
  provider: z.enum(['openrouter', 'gemini', 'openai', 'claude', 'ollama']),
  api_key: z.string().optional(),
  base_url: z.string().optional(),
  default_model: z.string().optional(),
  assistant_model: z.string().optional(),
  smart_entry_model: z.string().optional(),
  ocr_model: z.string().optional(),
  sms_model: z.string().optional(),
  gmail_model: z.string().optional(),
  investment_advisor_model: z.string().optional(),
  cloud_fallback_enabled: z.boolean(),
});
type AISettingsForm = z.infer<typeof aiSettingsSchema>;

export function AISettingsPage() {
  const qc = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Fetch AI settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: aiApi.getSettings,
  });

  // AI settings mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateAISettingsRequest) => aiApi.updateSettings(data),
    onSuccess: (updated) => {
      qc.setQueryData(['ai-settings'], updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  // Test settings mutation
  const testMutation = useMutation({
    mutationFn: aiApi.testSettings,
    onSuccess: (result) => {
      setTestResult(result);
    },
  });

  // List models mutation
  const listModelsMutation = useMutation({
    mutationFn: aiApi.listModels,
    onSuccess: (result) => {
      setAvailableModels(result.models);
    },
  });

  // AI settings form
  const aiForm = useForm<AISettingsForm>({
    resolver: zodResolver(aiSettingsSchema),
    values: {
      mode: (settings?.mode as AIMode) || 'cloud',
      provider: (settings?.provider as AIProvider) || 'openrouter',
      api_key: '', // We don't show the real key, only allow updating it
      base_url: settings?.base_url || '',
      default_model: settings?.default_model || '',
      assistant_model: settings?.assistant_model || '',
      smart_entry_model: settings?.smart_entry_model || '',
      ocr_model: settings?.ocr_model || '',
      sms_model: settings?.sms_model || '',
      gmail_model: settings?.gmail_model || '',
      investment_advisor_model: settings?.investment_advisor_model || '',
      cloud_fallback_enabled: settings?.cloud_fallback_enabled ?? true,
    },
  });

  // Reset the form when settings are loaded
  useEffect(() => {
    if (settings) {
      aiForm.reset({
        mode: settings.mode as AIMode,
        provider: settings.provider as AIProvider,
        api_key: '',
        base_url: settings.base_url || '',
        default_model: settings.default_model || '',
        assistant_model: settings.assistant_model || '',
        smart_entry_model: settings.smart_entry_model || '',
        ocr_model: settings.ocr_model || '',
        sms_model: settings.sms_model || '',
        gmail_model: settings.gmail_model || '',
        investment_advisor_model: settings.investment_advisor_model || '',
        cloud_fallback_enabled: settings.cloud_fallback_enabled,
      });
    }
  }, [settings, aiForm]);

  // Watch mode and provider for conditional fields
  const selectedMode = aiForm.watch('mode');
  const selectedProvider = aiForm.watch('provider');

  // Handle provider change to load models
  const handleProviderChange = async (provider: AIProvider) => {
    setLoadingModels(true);
    try {
      if (provider === 'ollama') {
        const baseUrl = aiForm.getValues('base_url') || 'http://localhost:11434';
        await listModelsMutation.mutateAsync({ provider, base_url: baseUrl });
      } else {
        const apiKey = aiForm.getValues('api_key');
        const baseUrl = aiForm.getValues('base_url');
        await listModelsMutation.mutateAsync({ provider, api_key: apiKey || undefined, base_url: baseUrl || undefined });
      }
    } catch (error) {
      console.error('Failed to load models', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    const formValues = aiForm.getValues();
    testMutation.mutate({
      mode: formValues.mode,
      provider: formValues.provider,
      api_key: formValues.api_key || undefined,
      base_url: formValues.base_url || undefined,
      model: formValues.default_model || undefined,
    });
  };

  if (isLoading) {
    return <div className="max-w-2xl mx-auto animate-fade-in">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="fc-heading">AI Settings</h1>
        <p className="fc-subheading mt-0.5">Configure your AI provider settings</p>
      </div>

      {/* AI Provider Section */}
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <Settings className="w-4 h-4 text-white/40" />
        </CardHeader>

        <form
          onSubmit={aiForm.handleSubmit((d) => {
            const updateData: UpdateAISettingsRequest = { ...d };
            if (!d.api_key) delete updateData.api_key;
            updateMutation.mutateAsync(updateData);
          })}
          noValidate
          className="space-y-5"
        >
          {/* Mode Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/70">Select Mode</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => aiForm.setValue('mode', 'cloud')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedMode === 'cloud' ? 'border-brand-500 bg-brand-500/10' : 'border-surface-border hover:border-surface-hover'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Cloud className="w-5 h-5 text-brand-500" />
                  <span className="font-semibold text-white">Finance Copilot Cloud</span>
                </div>
                <p className="mt-2 text-xs text-white/50 text-left">
                  ✓ Zero setup<br />
                  ✓ Optimized for speed<br />
                  ✓ Cost-efficient AI models<br />
                  ✓ Recommended for most users
                </p>
              </button>

              <button
                type="button"
                onClick={() => aiForm.setValue('mode', 'byok')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedMode === 'byok' ? 'border-brand-500 bg-brand-500/10' : 'border-surface-border hover:border-surface-hover'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-white/70" />
                  <span className="font-semibold text-white">Bring Your Own AI</span>
                </div>
                <p className="mt-2 text-xs text-white/50 text-left">
                  Use OpenRouter, Gemini, OpenAI, Claude, or Ollama
                </p>
              </button>
            </div>
          </div>

          {/* Bring Your Own AI Fields */}
          {selectedMode === 'byok' && (
            <div className="space-y-5 pt-4 border-t border-surface-border">
              <Select
                label="Provider"
                options={[
                  { value: 'openrouter', label: 'OpenRouter' },
                  { value: 'gemini', label: 'Gemini' },
                  { value: 'openai', label: 'OpenAI' },
                  { value: 'claude', label: 'Claude' },
                  { value: 'ollama', label: 'Ollama' },
                ]}
                value={selectedProvider}
                onChange={(event) => {
                  const provider = event.target.value as AIProvider;
                  aiForm.setValue('provider', provider);
                  handleProviderChange(provider);
                }}
              />

              {selectedProvider !== 'ollama' && (
                <Input
                  label="API Key"
                  type="password"
                  leftIcon={<Key className="w-4 h-4" />}
                  placeholder="Enter your API key"
                  error={aiForm.formState.errors.api_key?.message}
                  {...aiForm.register('api_key')}
                />
              )}

              <Input
                label="Base URL (optional)"
                leftIcon={<Globe className="w-4 h-4" />}
                placeholder={`${
                  selectedProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' :
                  selectedProvider === 'ollama' ? 'http://localhost:11434' : ''
                }`}
                {...aiForm.register('base_url')}
              />

              <Input
                label="Default Model"
                leftIcon={<Cpu className="w-4 h-4" />}
                placeholder={`${
                  selectedProvider === 'openrouter' ? 'meta-llama/llama-3.1-8b-instruct:free' :
                  selectedProvider === 'gemini' ? 'gemini-2.5-flash' :
                  selectedProvider === 'openai' ? 'gpt-4o-mini' :
                  selectedProvider === 'claude' ? 'claude-3-5-sonnet-20241022' :
                  selectedProvider === 'ollama' ? 'llama3.2' : ''
                }`}
                {...aiForm.register('default_model')}
              />

              {availableModels.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-white/50 mb-1">Available models:</p>
                  <div className="max-h-32 overflow-y-auto p-2 rounded-lg bg-surface-elevated border border-surface-border space-y-1">
                    {availableModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => aiForm.setValue('default_model', model)}
                        className="w-full text-left text-sm text-white/70 hover:text-white hover:bg-surface-hover px-2 py-1 rounded"
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={loadingModels}
                  leftIcon={<Globe className="w-4 h-4" />}
                  onClick={() => handleProviderChange(selectedProvider)}
                >
                  Refresh models
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  loading={testMutation.isPending}
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                  onClick={handleTestConnection}
                >
                  Test connection
                </Button>
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg border ${
                    testResult.connected ? 'border-income bg-income/5' : 'border-expense bg-expense/5'
                  }`}
                >
                  {testResult.connected ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-income shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-income font-medium">Connected</p>
                        {testResult.provider && (
                          <p className="text-white/60">Provider: {testResult.provider}</p>
                        )}
                        {testResult.model && (
                          <p className="text-white/60">Model: {testResult.model}</p>
                        )}
                        {testResult.latency_ms && (
                          <p className="text-white/60">Latency: {testResult.latency_ms}ms</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-expense shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-expense font-medium">Failed</p>
                        {testResult.error && (
                          <p className="text-white/60">{testResult.error}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Advanced Settings */}
          <div className="pt-4 border-t border-surface-border">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
              Advanced settings
            </button>

            {showAdvanced && (
              <div className="pt-4 space-y-5">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="cloud-fallback"
                    checked={aiForm.watch('cloud_fallback_enabled')}
                    onChange={(e) => aiForm.setValue('cloud_fallback_enabled', e.target.checked)}
                    className="w-4 h-4 rounded border-surface-border bg-surface-input text-brand-500 focus:ring-brand-500"
                  />
                  <label htmlFor="cloud-fallback" className="text-sm text-white/70">
                    Fall back to Finance Copilot Cloud if my provider fails
                  </label>
                </div>

                <Input
                  label="Assistant Model"
                  leftIcon={<Zap className="w-4 h-4" />}
                  placeholder="Leave blank to use default"
                  {...aiForm.register('assistant_model')}
                />

                <Input
                  label="Smart Entry Model"
                  leftIcon={<Zap className="w-4 h-4" />}
                  placeholder="Leave blank to use default"
                  {...aiForm.register('smart_entry_model')}
                />

                <Input
                  label="OCR Model"
                  leftIcon={<Zap className="w-4 h-4" />}
                  placeholder="Leave blank to use default"
                  {...aiForm.register('ocr_model')}
                />

                <Input
                  label="SMS Import Model"
                  leftIcon={<Zap className="w-4 h-4" />}
                  placeholder="Leave blank to use default"
                  {...aiForm.register('sms_model')}
                />

                <Input
                  label="Gmail Import Model"
                  leftIcon={<Zap className="w-4 h-4" />}
                  placeholder="Leave blank to use default"
                  {...aiForm.register('gmail_model')}
                />

                <Input
                  label="Investment Advisor Model"
                  leftIcon={<Zap className="w-4 h-4" />}
                  placeholder="Leave blank to use default"
                  {...aiForm.register('investment_advisor_model')}
                />
              </div>
            )}
          </div>

          {updateMutation.error && (
            <p className="text-sm text-expense">{getApiError(updateMutation.error)}</p>
          )}
          {saveSuccess && (
            <p className="text-sm text-income">✓ Settings saved successfully</p>
          )}

          <Button
            type="submit"
            loading={updateMutation.isPending}
            leftIcon={<CheckCircle className="w-4 h-4" />}
          >
            Save settings
          </Button>
        </form>
      </Card>
    </div>
  );
}
