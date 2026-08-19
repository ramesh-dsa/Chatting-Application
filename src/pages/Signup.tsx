import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { MessageSquare, User, Mail, Lock, Loader2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    try {
      setLoading(true);
      
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Default avatar using dicebear
      const photoURL = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formData.displayName)}&backgroundColor=1E293B&textColor=ffffff`;

      await updateProfile(user, {
        displayName: formData.displayName,
        photoURL: photoURL
      });

      // Save to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: formData.displayName,
        photoURL: photoURL,
        status: 'Hey there! I am using Chat App.',
        isOnline: true,
        lastSeen: Date.now()
      });

      // Send verification email
      await sendEmailVerification(user);

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
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface to-background p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-lg shadow-black/5">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <MessageSquare className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Antigravity Chat</h2>
          <p className="text-muted-foreground mt-2">Sign up to get started</p>
        </div>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${error ? 'max-h-24 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl border border-destructive/20 text-center">
            {error}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Display Name</label>
            <div className="relative">
              <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                required
                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow"
                placeholder="John Doe"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                required
                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Confirm Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                required
                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-shadow"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-2.5 px-4 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:bg-accent-hover transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-6 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-accent"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating account...
              </>
            ) : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
