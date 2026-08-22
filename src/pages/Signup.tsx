import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { MessageSquare, User, Mail, Lock, Loader2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { BorderBeam } from '../registry/magicui/border-beam';
import { validatePassword } from '../utils/validatePassword';

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

    const passwordErrorMsg = validatePassword(formData.password);
    if (passwordErrorMsg) {
      return setError(passwordErrorMsg);
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
        statusMessage: 'Hey there! I am using Chat App.',
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface to-background">
      <Card className="relative w-full max-w-[400px] overflow-hidden rounded-2xl shadow-lg border-border">
        <CardHeader className="text-center pb-6 pt-8">
          <div className="mx-auto inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4 shadow-sm">
            <MessageSquare className="w-8 h-8 text-accent" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">Antigravity Chat</CardTitle>
          <CardDescription className="text-muted mt-2">
            Sign up to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${error ? 'max-h-24 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl border border-destructive/20 text-center">
              {error}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label className="text-muted-foreground mb-1">Display Name</Label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input
                    type="text"
                    required
                    className="pl-10 h-11 rounded-xl"
                    placeholder="John Doe"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <Label className="text-muted-foreground mb-1">Email</Label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input
                    type="email"
                    required
                    className="pl-10 h-11 rounded-xl"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <Label className="text-muted-foreground mb-1">Password</Label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input
                    type="password"
                    required
                    className="pl-10 h-11 rounded-xl"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <Label className="text-muted-foreground mb-1">Confirm Password</Label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input
                    type="password"
                    required
                    className="pl-10 h-11 rounded-xl"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-medium bg-accent hover:bg-accent-hover mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center pb-8 pt-0">
          <p className="text-center text-sm text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:text-accent-hover hover:underline font-medium">
              Log in
            </Link>
          </p>
        </CardFooter>
        <BorderBeam duration={8} size={300} reverse className="from-transparent via-accent to-transparent" />
      </Card>
    </div>
  );
}
