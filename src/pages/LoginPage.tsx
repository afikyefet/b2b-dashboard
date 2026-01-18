import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

type Step = 'email' | 'code';

function LoginPage() {
  const { status, isAuthenticated, authDisabled, allowedDomain, requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname || '/';
  }, [location.state]);

  useEffect(() => {
    if (status !== 'ready') return;
    if (authDisabled || isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [authDisabled, isAuthenticated, navigate, redirectTo, status]);

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setIsSubmitting(true);
    try {
      await requestCode(email.trim());
      setStep('code');
      setInfo('We emailed you a 6-digit code.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setIsSubmitting(true);
    try {
      await verifyCode(email.trim(), code.trim());
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    setIsSubmitting(true);
    try {
      await requestCode(email.trim());
      setInfo('A new code was sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
  };

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/80 to-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <Card className="w-full shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle>B2B Dashboard</CardTitle>
            <CardDescription>Sign in to continue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 'email' && (
              <form className="space-y-4" onSubmit={handleEmailSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="auth-email">Work email</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder={allowedDomain ? `name@${allowedDomain}` : 'name@company.com'}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                  {allowedDomain && (
                    <p className="text-xs text-muted-foreground">Use your @{allowedDomain} email.</p>
                  )}
                </div>
                <Button type="submit" disabled={isSubmitting || !email.trim()} className="w-full">
                  {isSubmitting ? 'Sending...' : 'Send code'}
                </Button>
              </form>
            )}

            {step === 'code' && (
              <form className="space-y-4" onSubmit={handleCodeSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="auth-code">6-digit code</Label>
                  <Input
                    id="auth-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(event) => handleCodeChange(event.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Sent to <strong>{email}</strong>
                  </p>
                </div>
                <Button type="submit" disabled={isSubmitting || code.length !== 6} className="w-full">
                  {isSubmitting ? 'Verifying...' : 'Verify & sign in'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleResend}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  Resend code
                </Button>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setError('');
                    setInfo('');
                  }}
                  disabled={isSubmitting}
                  className="h-auto p-0 text-left text-sm"
                >
                  Use a different email
                </Button>
              </form>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {info && (
              <Alert>
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;
