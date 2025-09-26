// src/pages/AdminUsers.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { Navigate } from "react-router-dom";
import { adminListUsers, adminCreateUser, type AppUser } from "../api";

export default function AdminUsersPage() {
    const { user } = useAuth();
    if (user?.role !== "admin") return <Navigate to="/" replace />;

    const [rows, setRows] = useState<AppUser[]>([]);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<'user' | 'admin'>("user");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function load() {
        try {
            setErr(null);
            const data = await adminListUsers();
            setRows(data);
        } catch (e: any) {
            setErr(e.message || "Failed to load users");
        }
    }

    useEffect(() => { load(); }, []);

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setErr(null);
        try {
            await adminCreateUser({ email, password, role });
            setEmail(""); setPassword(""); setRole("user");
            await load();
        } catch (e: any) {
            setErr(e.message || "Failed to create user");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-2xl font-semibold">Admin · Users</h1>

            <form onSubmit={onCreate} className="space-y-3 card">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                        className="input"
                        placeholder="email@domain.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                    <input
                        className="input"
                        type="password"
                        placeholder="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                    <select
                        className="input"
                        value={role}
                        onChange={e => setRole(e.target.value as 'user' | 'admin')}
                    >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                    </select>
                </div>
                {err && <div className="text-red-400 text-sm">{err}</div>}
                <button className="btn" disabled={busy}>
                    {busy ? "Creating..." : "Create User"}
                </button>
            </form>

            <div className="space-y-2">
                {!rows.length && <div className="text-gray-400">No users yet.</div>}
                {rows.map(u => (
                    <div
                        key={u.id}
                        className="p-3 rounded-md border border-gray-800 bg-[#0f172a] flex items-center justify-between"
                    >
                        <div>
                            <div className="font-mono">{u.email}</div>
                            <div className="text-xs text-gray-400">role: {u.role}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
