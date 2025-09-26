// src/auth.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
type User = { email: string; role: 'user' | 'admin' } | null;

const AuthCtx = createContext<{
    user: User;
    initializing: boolean;
    login: (email: string, pw: string) => Promise<void>;
    logout: () => void;
}>({
    user: null,
    initializing: true,
    login: async () => { },
    logout: () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User>(null);
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role') as 'user' | 'admin' | null;
        const email = localStorage.getItem('email');
        if (token && role && email) setUser({ email, role });
        setInitializing(false);                     // ✅ done loading
    }, []);

    async function login(email: string, password: string) {
        const r = await (await import('./api')).login(email, password);
        localStorage.setItem('token', r.access_token);
        localStorage.setItem('role', r.role);
        localStorage.setItem('email', r.email);
        setUser({ email: r.email, role: r.role });
    }

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('email');
        setUser(null);
    }

    return (
        <AuthCtx.Provider value={{ user, initializing, login, logout }}>
            {children}
        </AuthCtx.Provider>
    );
};

export const useAuth = () => useContext(AuthCtx);
