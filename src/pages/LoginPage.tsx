import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LoginPage.scss';

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
    return <div className="auth-loading">Loading...</div>;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>B2B Dashboard</h1>
          <p>Sign in to continue.</p>
        </div>

        {step === 'email' && (
          <form className="login-form" onSubmit={handleEmailSubmit}>
            <label className="login-label" htmlFor="auth-email">Work email</label>
            <input
              id="auth-email"
              type="email"
              placeholder={allowedDomain ? `name@${allowedDomain}` : 'name@company.com'}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            {allowedDomain && (
              <div className="login-hint">Use your @{allowedDomain} email.</div>
            )}
            <button className="btn btn-primary" type="submit" disabled={isSubmitting || !email.trim()}>
              {isSubmitting ? 'Sending...' : 'Send code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form className="login-form" onSubmit={handleCodeSubmit}>
            <label className="login-label" htmlFor="auth-code">6-digit code</label>
            <input
              id="auth-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(event) => handleCodeChange(event.target.value)}
              required
            />
            <div className="login-hint">
              Sent to <strong>{email}</strong>
            </div>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting || code.length !== 6}>
              {isSubmitting ? 'Verifying...' : 'Verify & sign in'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleResend} disabled={isSubmitting}>
              Resend code
            </button>
            <button
              className="login-link"
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
                setInfo('');
              }}
              disabled={isSubmitting}
            >
              Use a different email
            </button>
          </form>
        )}

        {error && <div className="login-error">{error}</div>}
        {info && <div className="login-info">{info}</div>}
      </div>
    </div>
  );
}

export default LoginPage;
