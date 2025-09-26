// src/ProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './auth';

export default function ProtectedRoute({
    children,
    requireAdmin = false,
}: { children: JSX.Element; requireAdmin?: boolean }) {
    const { user, initializing } = useAuth();

    if (initializing) return <div style={{ padding: 24 }}>Loading…</div>; // ✅ wait
    if (!user) return <Navigate to="/login" replace />;
    if (requireAdmin && user.role !== 'admin') return <Navigate to="/" replace />;
    return children;
}
