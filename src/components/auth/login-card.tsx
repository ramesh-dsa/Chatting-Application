import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { auth } from '../../lib/firebase';

// 1. Zod Schemas for Validation
const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  confirmPassword: z.string().min(6, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"], // Error path
});

// TypeScript interfaces inferred from Zod schemas
type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;
type FormData = SignupFormData; // Use the broader type for the form

export default function LoginCard() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // 2. React Hook Form Setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(isSignUp ? signupSchema : loginSchema),
    mode: 'onBlur', // Validate on blur for better UX
  });

  const onSubmit = async (data: FormData) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, data.email, data.password);
      } else {
        await signInWithEmailAndPassword(auth, data.email, data.password);
      }
      reset(); // Clear form on success
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setIsSuccess(true);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err.message || 'Google Sign-In failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSignUp(!isSignUp);
    setErrorMessage(null);
    reset(); // Clear errors and fields when switching modes
  };

  if (isSuccess) {
    return (
      <div className="relative z-10 w-[92vw] max-w-[460px] p-6 sm:p-10 md:p-12 backdrop-blur-3xl bg-black/60 border border-white/20 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_15px_rgba(168,85,247,0.8)]"></div>
        <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Success!</h2>
        <p className="text-gray-400">You have successfully authenticated.</p>
        <button
          onClick={() => setIsSuccess(false)}
          className="mt-8 px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div className="relative z-10 w-[92vw] max-w-[460px] p-6 sm:p-10 md:p-12 backdrop-blur-3xl bg-black/60 border border-white/20 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden">
      {/* Ultra-subtle top inner neon rim glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_15px_rgba(168,85,247,0.8)]"></div>

      {/* Header */}
      <div className="text-center mb-10 relative z-20">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-purple-400 transition-all duration-300">
          {isSignUp ? "Join the Network" : "Let's Chat"}
        </h1>
        <p className="text-sm md:text-base text-gray-400 transition-all duration-300">
          {isSignUp 
            ? "Create your identity to start chatting" 
            : "Enter your neural space & continue chatting"}
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
          {errorMessage}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 relative z-20">
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-300 mb-2 ml-1">
            Email
          </label>
          <input
            type="email"
            {...register("email")}
            disabled={isLoading}
            autoComplete="username"
            className={`w-full py-3.5 px-4 rounded-2xl bg-white/5 border ${errors.email ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/20' : 'border-white/10 focus:border-purple-400 focus:ring-purple-500/20'} text-white placeholder-white/30 focus:outline-none focus:ring-4 transition-all duration-300 text-sm md:text-base disabled:opacity-50`}
            placeholder="Enter your email"
          />
          {errors.email && (
            <p className="mt-1.5 ml-1 text-xs text-red-400 font-medium animate-in fade-in slide-in-from-top-1">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2 px-1">
            <label className="block text-xs md:text-sm font-medium text-gray-300">
              Password
            </label>
            {!isSignUp && (
              <a href="#" className="text-xs md:text-sm text-purple-400 hover:text-purple-300 transition-colors">
                Forgot?
              </a>
            )}
          </div>
          <input
            type="password"
            {...register("password")}
            disabled={isLoading}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className={`w-full py-3.5 px-4 rounded-2xl bg-white/5 border ${errors.password ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/20' : 'border-white/10 focus:border-purple-400 focus:ring-purple-500/20'} text-white placeholder-white/30 focus:outline-none focus:ring-4 transition-all duration-300 text-sm md:text-base disabled:opacity-50`}
            placeholder="Enter your password"
          />
          {errors.password && (
            <p className="mt-1.5 ml-1 text-xs text-red-400 font-medium animate-in fade-in slide-in-from-top-1">
              {errors.password.message}
            </p>
          )}
        </div>

        {isSignUp && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <label className="block text-xs md:text-sm font-medium text-gray-300 mb-2 ml-1">
              Confirm Password
            </label>
            <input
              type="password"
              {...register("confirmPassword")}
              disabled={isLoading}
              autoComplete="new-password"
              className={`w-full py-3.5 px-4 rounded-2xl bg-white/5 border ${errors.confirmPassword ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/20' : 'border-white/10 focus:border-purple-400 focus:ring-purple-500/20'} text-white placeholder-white/30 focus:outline-none focus:ring-4 transition-all duration-300 text-sm md:text-base disabled:opacity-50`}
              placeholder="Enter your password again"
            />
            {errors.confirmPassword && (
              <p className="mt-1.5 ml-1 text-xs text-red-400 font-medium animate-in fade-in slide-in-from-top-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 mt-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/40 active:scale-[0.98] transition-all duration-300 font-semibold text-white flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Authenticating...
            </>
          ) : (
            isSignUp ? "Create Account" : "Sign In"
          )}
        </button>
      </form>

      <div className="my-8 flex items-center relative z-20">
        <div className="flex-grow h-px bg-white/10"></div>
        <span className="px-4 text-xs md:text-sm text-gray-400 font-medium">Or continue with</span>
        <div className="flex-grow h-px bg-white/10"></div>
      </div>

      {/* Google Login */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium flex items-center justify-center gap-3 transition-all duration-300 relative z-20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
          <path d="M1 1h22v22H1z" fill="none" />
        </svg>
        Sign in with Google
      </button>

      {/* Footer */}
      <p className="mt-8 text-center text-sm md:text-base text-gray-400 relative z-20">
        {isSignUp ? "Already have an account?" : "New user?"}{' '}
        <a
          href="#"
          onClick={toggleMode}
          className="text-purple-400 font-medium hover:text-purple-300 underline underline-offset-4 decoration-purple-500/50 transition-colors"
        >
          {isSignUp ? "Sign In" : "Create an account"}
        </a>
      </p>
    </div>
  );
}
