// src/App.tsx
import React from 'react'
import { Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom'
import ComposeCampaign from './components/ComposeCampaign'
import ContactsPage from './components/ContactsPage'
import AdminUsersPage from './pages/AdminUsers'
import { useAuth } from './auth'

// Top shell (header/nav + right-side user & Logout)
function Shell() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="wrap">
      <div className="nav flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Only keep Contacts + (optionally) Compose */}
          <NavLink to="/contacts">Contacts</NavLink>
          {!isAdmin && <NavLink to="/compose">Compose Campaign</NavLink>}
          {isAdmin && <NavLink to="/admin/users">Admin · Users</NavLink>}
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="text-sm opacity-80">{user.email} · {user.role}</span>}
          <button className="btn btn-small" onClick={logout}>Logout</button>
        </div>
      </div>
      <Outlet />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        {/* Default & any unknown paths -> Contacts */}
        <Route index element={<Navigate to="/contacts" replace />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="compose" element={<ComposeCampaign />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
        <Route path="*" element={<Navigate to="/contacts" replace />} />
      </Route>
    </Routes>
  )
}
