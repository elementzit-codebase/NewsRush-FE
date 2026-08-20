import { Navigate, Route, Routes } from 'react-router-dom'
import CreateTask from './pages/CreateTask'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import Users from './pages/Users'
import Workspace from './pages/Workspace'
import { RequireAuth, RequireSystemUser } from './lib/auth'

export default function App() {
  return (
    <Routes>
      {/* Public: everything the backend exposes without a bearer token. */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <Workspace />
          </RequireAuth>
        }
      />
      <Route
        path="/create"
        element={
          <RequireAuth>
            <CreateTask />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      {/* GET /api/users and the approve route both require a system user. */}
      <Route
        path="/users"
        element={
          <RequireSystemUser>
            <Users />
          </RequireSystemUser>
        }
      />

      {/* Sidebar destinations that have no screen yet fall back to the workspace. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
