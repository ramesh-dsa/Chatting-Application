import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../lib/firebase';
import { validatePassword, validateEmail, stripHTML } from '../utils/sanitize';

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const hasMinLength = formData.password.length >= 8;
  const hasUpper = /[A-Z]/.test(formData.password);
  const hasLower = /[a-z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const isPasswordValid = formData.password.length > 0 && hasMinLength && hasUpper && hasLower && hasNumber;

  const showRules = (passwordFocused || formData.password.length > 0) && !isPasswordValid;

  const confirmPasswordMatches = formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword;
  const confirmPasswordMismatch = formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let cleanedName = formData.displayName.trim();
    if (!cleanedName) {
      return setError('Display name is required');
    }
    if (cleanedName.length > 50) {
      return setError('Display name must be 50 characters or less');
    }
    cleanedName = stripHTML(cleanedName);
    
    if (!validateEmail(formData.email)) {
      return setError('Please enter a valid email address');
    }

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    const { valid, errors } = validatePassword(formData.password);
    if (!valid) {
      return setError(`Password must contain: ${errors.join(', ')}`);
    }

    try {
      setLoading(true);
      
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      const photoURL = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanedName)}&backgroundColor=1E293B&textColor=ffffff`;

      await updateProfile(user, {
        displayName: cleanedName,
        photoURL: photoURL
      });

      await set(ref(db, `users/${user.uid}`), {
        uid: user.uid,
        email: user.email,
        displayName: cleanedName,
        photoURL: photoURL,
        statusMessage: 'Hey there! I am using Chat App.',
        isOnline: true,
        lastSeen: Date.now()
      });

      await sendEmailVerification(user);

      setFormData({
        displayName: '',
        email: '',
        password: '',
        confirmPassword: ''
      });

      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Failed to create an account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-[92vw] max-w-[460px] p-6 sm:p-10 md:p-12 backdrop-blur-3xl bg-black/60 border border-white/20 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_15px_rgba(168,85,247,0.8)]"></div>

        <div className="text-center mb-10 relative z-20">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-purple-400 transition-all duration-300">
            Join the Network
          </h1>
          <p className="text-sm md:text-base text-gray-400 transition-all duration-300">
            Create your identity to start chatting
          </p>
        </div>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${error ? 'max-h-24 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-20">
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-300 mb-2 ml-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              disabled={loading}
              autoComplete="username"
              className="w-full py-3.5 px-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all duration-300 text-sm md:text-base disabled:opacity-50"
              placeholder="Enter your display name"
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-300 mb-2 ml-1">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={loading}
              autoComplete="email"
              className="w-full py-3.5 px-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all duration-300 text-sm md:text-base disabled:opacity-50"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-300 mb-2 ml-1">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                disabled={loading}
                autoComplete="new-password"
                className="w-full py-3.5 px-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 transition-all duration-300 text-sm md:text-base disabled:opacity-50 pr-12"
                placeholder="Enter your password"
              />
              <div 
                className={`absolute right-4 top-1/2 -translate-y-1/2 text-green-400 pointer-events-none transition-all duration-300 ${
                  isPasswordValid ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            
            <div 
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                showRules ? 'max-h-[120px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'
              }`}
            >
              <div className="text-xs space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="font-medium text-gray-400">Password must contain:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`flex items-center gap-1.5 transition-colors duration-300 ${hasMinLength ? 'text-green-400' : 'text-gray-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${hasMinLength ? 'bg-green-400' : 'bg-gray-600'}`} />
                    8+ characters
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors duration-300 ${hasUpper ? 'text-green-400' : 'text-gray-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${hasUpper ? 'bg-green-400' : 'bg-gray-600'}`} />
                    Uppercase
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors duration-300 ${hasLower ? 'text-green-400' : 'text-gray-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${hasLower ? 'bg-green-400' : 'bg-gray-600'}`} />
                    Lowercase
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors duration-300 ${hasNumber ? 'text-green-400' : 'text-gray-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${hasNumber ? 'bg-green-400' : 'bg-gray-600'}`} />
                    Number
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-300 mb-2 ml-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                disabled={loading}
                className={`w-full py-3.5 px-4 rounded-2xl bg-white/5 border text-white placeholder-white/30 focus:outline-none focus:ring-4 transition-all duration-300 text-sm md:text-base disabled:opacity-50 pr-12 ${
                  confirmPasswordMismatch 
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
                    : confirmPasswordMatches
                    ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20'
                    : 'border-white/10 focus:border-purple-400 focus:ring-purple-500/20'
                }`}
                autoComplete="new-password"
                placeholder="Enter your password"
              />
              <div 
                className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300 ${
                  confirmPasswordMatches || confirmPasswordMismatch ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                } ${confirmPasswordMatches ? 'text-green-400' : 'text-red-400'}`}
              >
                {confirmPasswordMatches ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
            </div>
            <div 
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                confirmPasswordMismatch ? 'max-h-8 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'
              }`}
            >
              <p className="text-xs text-red-400 ml-1">Passwords do not match</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/40 active:scale-[0.98] transition-all duration-300 font-semibold text-white flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm md:text-base text-gray-400 relative z-20">
          Already have an account?{' '}
          <Link to="/login" className="text-purple-400 font-medium hover:text-purple-300 underline underline-offset-4 decoration-purple-500/50 transition-colors">
            Sign In
          </Link>
        </p>
      </div>
  );
}
