import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { validateEmail } from '../utils/sanitize';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutTimer, setLockoutTimer] = useState<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutTimer(0);
        clearInterval(interval);
      } else {
        setLockoutTimer(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const getAttempts = (emailToCheck: string) => {
    const data = localStorage.getItem(`login_attempts_${emailToCheck}`);
    if (data) {
      const parsed = JSON.parse(data);
      if (Date.now() < parsed.expiry) {
        return parsed.count;
      }
    }
    return 0;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return setError('Please enter a valid email address');
    }

    if (lockoutUntil && Date.now() < lockoutUntil) {
      return;
    }

    const attempts = getAttempts(email);
    if (attempts >= 5) {
      const newLockout = Date.now() + 5 * 60 * 1000;
      setLockoutUntil(newLockout);
      localStorage.setItem(`login_attempts_${email}`, JSON.stringify({ count: 5, expiry: newLockout }));
      setError('Too many failed login attempts. Please try again later.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.removeItem(`login_attempts_${email}`);
      setEmail('');
      setPassword('');
      navigate('/');
    } catch (err: any) {
      const currentAttempts = getAttempts(email);
      const newCount = currentAttempts + 1;
      const expiry = Date.now() + 5 * 60 * 1000;
      localStorage.setItem(`login_attempts_${email}`, JSON.stringify({ count: newCount, expiry }));

      if (newCount >= 5) {
        setLockoutUntil(expiry);
        setError('Too many failed login attempts. Please try again later.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
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
    <div className="relative z-10 w-[92vw] max-w-[460px] p-6 sm:p-10 md:p-12 backdrop-blur-3xl bg-black/60 border border-white/20 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_15px_rgba(168,85,247,0.8)]"></div>

        <div className="text-center mb-10 relative z-20">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-purple-400 transition-all duration-300">
            Let's Chat
          </h1>
          <p className="text-sm md:text-base text-gray-400 transition-all duration-300">
            {showForgotPassword ? "Reset your password" : "Enter your neural space & continue chatting"}
          </p>
        </div>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${error || resetMessage ? 'max-h-24 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}
          {resetMessage && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center">
              {resetMessage}
            </div>
          )}
        </div>

        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-6 relative z-20">
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-300 mb-2 ml-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isResetting}
                autoComplete="email"
                className="w-full py-3.5 px-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all duration-300 text-sm md:text-base disabled:opacity-50"
                placeholder="Enter your email"
              />
            </div>
            
            <div className="flex flex-col gap-3 mt-6">
              <button
                type="submit"
                disabled={isResetting || !email}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/40 active:scale-[0.98] transition-all duration-300 font-semibold text-white flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isResetting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending link...
                  </>
                ) : 'Send Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setError('');
                  setResetMessage('');
                }}
                className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium flex items-center justify-center transition-all duration-300"
              >
                Back to log in
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleEmailLogin} className="space-y-6 relative z-20">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-300 mb-2 ml-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  className="w-full py-3.5 px-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all duration-300 text-sm md:text-base disabled:opacity-50"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2 px-1">
                  <label className="block text-xs md:text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setError('');
                      setResetMessage('');
                    }}
                    className="text-xs md:text-sm text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  className="w-full py-3.5 px-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all duration-300 text-sm md:text-base disabled:opacity-50"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !!lockoutUntil}
                className="w-full py-4 mt-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/40 active:scale-[0.98] transition-all duration-300 font-semibold text-white flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {lockoutUntil ? (
                  `Try again in ${Math.floor(lockoutTimer / 60)}:${(lockoutTimer % 60).toString().padStart(2, '0')}`
                ) : loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="my-8 flex items-center relative z-20">
              <div className="flex-grow h-px bg-white/10"></div>
              <span className="px-4 text-xs md:text-sm text-gray-400 font-medium">Or continue with</span>
              <div className="flex-grow h-px bg-white/10"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium flex items-center justify-center gap-3 transition-all duration-300 relative z-20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              Sign in with Google
            </button>

            <p className="mt-8 text-center text-sm md:text-base text-gray-400 relative z-20">
              New user?{' '}
              <Link to="/signup" className="text-purple-400 font-medium hover:text-purple-300 underline underline-offset-4 decoration-purple-500/50 transition-colors">
                Create an account
              </Link>
            </p>
          </>
        )}
      </div>
  );
}
