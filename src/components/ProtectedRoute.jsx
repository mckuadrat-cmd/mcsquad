import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const auth = useAuth() || {};
  const { currentUser, userRole } = auth;
  
  if (currentUser === null) {
    return <Navigate to="/login" replace />;
  }

  // If component requires specific roles, and userRole is defined but not in the list
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />; // Redirect unauthorized users to dashboard
  }

  return children;
};
