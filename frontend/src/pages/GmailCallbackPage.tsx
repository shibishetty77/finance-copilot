import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { gmailApi } from '@/api/gmail';
import { getApiError } from '@/api/client';

export function GmailCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const called = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('No authorization code found in URL.');
      return;
    }

    if (called.current) return;
    called.current = true;

    async function handleCallback() {
      try {
        const res = await gmailApi.callback(code as string);
        if (res.status === 'success') {
          showToast(`Successfully connected: ${res.email}`, 'success');
        }
        // Redirect to transactions page and trigger the modal opening
        navigate('/transactions?action=gmail-import', { replace: true });
      } catch (err) {
        const errorMessage = getApiError(err);
        showToast(`OAuth Callback Failed: ${errorMessage}`, 'error');
        setError(errorMessage);
      }
    }

    handleCallback();
  }, [searchParams, navigate, showToast]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-white p-4">
      {!error ? (
        <div className="flex flex-col items-center animate-fade-in">
          <RefreshCw className="w-8 h-8 animate-spin mb-4 text-brand-500" />
          <h2 className="text-xl font-semibold mb-2">Connecting to Gmail...</h2>
          <p className="text-white/60">Please wait while we complete the authorization.</p>
        </div>
      ) : (
        <Card className="max-w-md p-6 text-center animate-fade-in border-red-500/30">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Connection Failed</h2>
          <p className="text-white/60 mb-6 text-sm">{error}</p>
          <Button onClick={() => navigate('/transactions', { replace: true })}>
            Back to Transactions
          </Button>
        </Card>
      )}
    </div>
  );
}
