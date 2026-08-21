import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { MessageSquare, Mail, Lock, LogIn, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { auth } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { BorderBeam } from '../registry/magicui/border-beam';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.');
      } else {
        setError('Failed to log in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign in was cancelled.');
      } else {
        setError('Failed to log in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError('');
    setIsResetting(true);
    setResetMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage(`If an account exists for ${email}, a reset link has been sent.`);
    } catch {
      setResetMessage(`If an account exists for ${email}, a reset link has been sent.`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface to-background">
      <Card className="relative w-full max-w-[400px] overflow-hidden rounded-2xl shadow-lg border-border">
        <CardHeader className="text-center pb-6 pt-8">
          <div className="mx-auto inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4 shadow-sm">
            <MessageSquare className="w-8 h-8 text-accent" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">Let's Chat</CardTitle>
          <CardDescription className="text-muted mt-2">
            {showForgotPassword ? "Reset your password" : "Sign in to your account to continue"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${error || resetMessage ? 'max-h-24 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl border border-destructive/20 text-center">
                {error}
              </div>
            )}
            {resetMessage && (
              <div className="bg-accent/10 text-accent text-sm p-3 rounded-xl border border-accent/20 text-center">
                {resetMessage}
              </div>
            )}
          </div>

          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="reset-email" className="text-muted-foreground mb-1">Email</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                      <Mail className="h-5 w-5" />
                    </div>
                    <Input
                      id="reset-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 rounded-xl"
                      placeholder="you@example.com"
                    />
                  </div>
                  <p className="text-xs text-muted mt-2">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 mt-6">
                <Button type="submit" disabled={isResetting || !email} className="w-full h-11 rounded-xl text-sm font-medium bg-accent hover:bg-accent-hover">
                  {isResetting ? (
                    <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Sending link...</>
                  ) : 'Send Reset Link'}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowForgotPassword(false);
                  setError('');
                  setResetMessage('');
                }} className="w-full h-11 rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-hover">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to log in
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div className="grid w-full items-center gap-5">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="email" className="text-muted-foreground mb-1">Email</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                      <Mail className="h-5 w-5" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 rounded-xl"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div className="flex flex-col space-y-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="password" className="text-muted-foreground">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setError('');
                        setResetMessage('');
                      }}
                      className="text-xs font-medium text-accent hover:text-accent-hover hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                      <Lock className="h-5 w-5" />
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-11 rounded-xl"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>
              
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl text-sm font-medium bg-accent hover:bg-accent-hover mt-6">
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Signing in...</>
                ) : (
                  <><LogIn className="w-5 h-5 mr-2" /> Sign in</>
                )}
              </Button>

              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-card text-muted">Or continue with</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full mt-6 h-11 rounded-xl font-medium bg-background hover:bg-surface-hover"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </Button>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center pb-8 pt-0">
          <p className="text-center text-sm text-muted">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-accent hover:text-accent-hover hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
        <BorderBeam duration={8} size={300} reverse className="from-transparent via-accent to-transparent" />
      </Card>
    </div>
  );
}
