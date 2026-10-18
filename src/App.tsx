import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import Starfield from './components/Starfield'
import Login from './pages/Login'
import Home from './pages/Home'
import Reset from './pages/Reset'
import Layout from './components/Layout'
import Album from './pages/Album'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Songs from './pages/Songs'
import ThemePage from './pages/ThemePage'
import Calendar from './pages/Calendar'
import Surprises from './pages/Surprises'
import Chat from './pages/Chat'
import Sections from './pages/Sections'
import SectionView from './pages/SectionView'
function Gate() {
  const { session, me, loading, signOut } = useAuth()
  if (loading) return <p className="p-10 text-center opacity-70">...</p>
  if (!session) return <Login />
  if (!me) return <main className="p-10 text-center space-y-3"><p>هذا الحساب غير مصرّح له بدخول الموقع.</p><button className="btn" onClick={signOut}>خروج</button></main>
  return <Routes><Route path="/reset" element={<Reset/>}/><Route element={<Layout/>}><Route path="/" element={<Home/>}/><Route path="/album" element={<Album/>}/><Route path="/notifications" element={<Notifications/>}/><Route path="/settings" element={<Settings/>}/><Route path="/songs" element={<Songs/>}/><Route path="/theme" element={<ThemePage/>}/><Route path="/calendar" element={<Calendar/>}/><Route path="/surprises" element={<Surprises/>}/><Route path="/chat" element={<Chat/>}/><Route path="/sections" element={<Sections/>}/><Route path="/sections/:slug" element={<SectionView/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes>
}
export default function App() { return <AuthProvider><Starfield/><Gate/></AuthProvider> }
