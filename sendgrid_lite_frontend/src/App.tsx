// src/App.tsx
import React from 'react'
import { Routes, Route, NavLink, Outlet } from 'react-router-dom'
import UploadCSV from './components/UploadCSV'
import ValidateSingle from './components/ValidateSingle'
import ComposeCampaign from './components/ComposeCampaign'
import ContactsPage from './components/ContactsPage'   // <-- correct file

// Shell with navbar
function Shell() {
  return (
    <div className="wrap">
      <div className="nav">
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/upload">Upload CSV</NavLink>
        <NavLink to="/validate">Validate Email</NavLink>
        <NavLink to="/contacts">Contacts</NavLink>
        <NavLink to="/compose">Compose Campaign</NavLink>
      </div>
      <Outlet />
    </div>
  )
}

// Dashboard: CSV + Validate only (contacts moved to its own page)
function Dashboard() {
  return (
    <>
      <div className="card"><h2>SendGrid-Lite Dashboard</h2></div>
      <UploadCSV onDone={() => { }} />
      <ValidateSingle onAdded={() => { }} />
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/upload" element={<UploadCSV onDone={() => { }} />} />
        <Route path="/validate" element={<ValidateSingle onAdded={() => { }} />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/compose" element={<ComposeCampaign />} />
      </Route>
    </Routes>
  )
}
