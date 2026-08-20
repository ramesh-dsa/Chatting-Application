import { useState, useEffect } from 'react';
import { Mail, RefreshCw, LogOut, ArrowRight } from 'lucide-react';
import { sendEmailVerification, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface VerificationPendingProps {
  user: User;
}

export default function VerificationPending({ user }: VerificationPendingProps) {
  const [cooldown, setCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Start countdown immediately since an email was just sent on signup
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      setIsResending(true);
      setError('');
      setMessage('');
      await sendEmailVerification(user);
      setMessage('Verification email sent! Please check your inbox.');
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckVerification = async () => {
    try {
      setIsChecking(true);
      setError('');
      await user.reload(); // Refresh the user's data from Firebase
      
      if (user.emailVerified) {
        // If verified, reload the entire page to trigger the AuthContext and ProtectedRoute to re-evaluate
        window.location.reload();
      } else {
        setError('Email is not verified yet. Please check your inbox and click the link.');
      }
    } catch {
      setError('Error checking verification status.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface to-background p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-lg shadow-black/5 text-center">
        <div className="mx-auto w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
          <Mail className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">Verify your email</h2>
        <p className="text-muted-foreground mb-6">
          We've sent a verification link to <span className="font-semibold text-foreground">{user.email}</span>. 
          Please verify your email to continue.
        </p>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${error || message ? 'max-h-24 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl border border-destructive/20 text-center">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-accent/10 text-accent text-sm p-3 rounded-xl border border-accent/20 text-center">
              {message}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={handleCheckVerification}
            disabled={isChecking}
            className="w-full flex justify-center items-center py-2.5 px-4 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:bg-accent-hover transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-accent"
          >
            {isChecking ? (
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="w-5 h-5 mr-2" />
            )}
            {isChecking ? 'Checking...' : 'I have verified my email'}
          </button>

          <button
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className="w-full flex justify-center items-center py-2.5 px-4 bg-surface text-foreground border border-border rounded-xl text-sm font-medium hover:bg-surface-hover transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-accent"
          >
            {isResending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend verification email'}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center mx-auto text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
