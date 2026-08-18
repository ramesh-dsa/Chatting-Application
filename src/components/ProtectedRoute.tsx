import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import React from 'react';
import VerificationPending from './VerificationPending';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const isPasswordProvider = currentUser.providerData.some(p => p.providerId === 'password');
  if (isPasswordProvider && !currentUser.emailVerified) {
    return <VerificationPending user={currentUser} />;
  }

  return children;
};
