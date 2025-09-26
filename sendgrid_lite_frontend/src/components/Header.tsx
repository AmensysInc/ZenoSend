import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
    const { pathname, hash } = useLocation();
    const here = (hash || pathname).replace(/^#/, "") || "/";
    const isActive = (to === "/" && here === "/") || here.startsWith(to);
    return (
        <Link
            to={to}
            className={`px-3 py-2 rounded-md text-sm ${isActive ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
        >
            {children}
        </Link>
    );
}

export default function Header() {
    const { user, logout } = useAuth();
    const isAdmin = user?.role === "admin";

    return (
        <header className="w-full border-b border-gray-800 bg-[#0b1220] sticky top-0 z-50">
            <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
                {/* left: brand + nav */}
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-white mr-3">SendGrid-Lite</span>
                    <nav className="flex items-center gap-2">
                        <NavLink to="/">Dashboard</NavLink>
                        <NavLink to="/upload">Upload CSV</NavLink>
                        <NavLink to="/validate">Validate Email</NavLink>
                        <NavLink to="/contacts">Contacts</NavLink>
                        {/* per your request: HIDE compose for admins */}
                        {!isAdmin && <NavLink to="/compose">Compose Campaign</NavLink>}
                        {/* admin-only menu */}
                        {isAdmin && <NavLink to="/admin/users">Admin · Users</NavLink>}
                    </nav>
                </div>

                {/* right: user + logout */}
                <div className="flex items-center gap-3">
                    {user && (
                        <span className="text-sm text-gray-300 hidden sm:inline">
                            {user.email} · {user.role}
                        </span>
                    )}
                    <button
                        className="px-3 py-2 rounded-md text-sm bg-gray-800 text-gray-300 hover:bg-gray-700"
                        onClick={logout}
                        aria-label="Log out"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
}
