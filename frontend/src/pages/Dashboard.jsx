import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:5000' })
api.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`
  return cfg
})

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [apiKeys, setApiKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedApi, setSelectedApi] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const [profileRes, keysRes] = await Promise.all([
        api.get('/api/auth/me'),
        api.get('/api/apis'),
      ])
      setUser(profileRes.data.user)
      const apis = keysRes.data.apis || keysRes.data.data || keysRes.data || []
      setApiKeys(Array.isArray(apis) ? apis : [])
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('accessToken')
        navigate('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    navigate('/login')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-400">MeterFlow</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.email}</span>
          <Link to="/usage" className="text-gray-400 hover:text-white text-sm transition">Usage</Link>
          <button onClick={handleLogout} className="bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h2 className="text-3xl font-bold">Welcome, {user?.name} 👋</h2>
          <p className="text-gray-400 mt-1">Manage your APIs and monitor usage</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard title="Total APIs" value={apiKeys.length} color="indigo" />
          <StatCard title="Active Keys" value={apiKeys.filter(a => a.status === 'active').length} color="green" />
          <StatCard title="Total Requests" value="—" color="blue" />
        </div>

        <div className="bg-gray-900 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Your APIs</h3>
            <button onClick={() => setShowModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-sm px-4 py-2 rounded-lg transition">
              + New API
            </button>
          </div>

          {apiKeys.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-4">🔑</p>
              <p className="text-lg">No APIs yet</p>
              <p className="text-sm mt-1">Click "New API" to create your first one</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left pb-3">Name</th>
                  <th className="text-left pb-3">Status</th>
                  <th className="text-left pb-3">Created</th>
                  <th className="text-left pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map(k => (
                  <tr key={k._id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 font-medium">{k.name}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${(k.status === 'active' || !k.status) ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {k.status || 'active'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="py-3">
                      <button
                        onClick={() => setSelectedApi(k)}
                        className="text-indigo-400 hover:underline text-xs"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <NewApiModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchData() }}
        />
      )}

      {selectedApi && (
        <ApiDetailModal
          apiData={selectedApi}
          onClose={() => setSelectedApi(null)}
          onRevoke={(id) => {
            setApiKeys(prev => prev.map(k => k._id === id ? { ...k, status: 'revoked' } : k))
            setSelectedApi(null)
          }}
        />
      )}
    </div>
  )
}

function ApiDetailModal({ apiData, onClose, onRevoke }) {
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [keys, setKeys] = useState([])
  const [loadingKeys, setLoadingKeys] = useState(true)

  useEffect(() => { fetchKeys() }, [])

  const fetchKeys = async () => {
    setLoadingKeys(true)
    try {
      const res = await api.get(`/api/apis/${apiData._id}/keys`)
      console.log('Keys response:', res.data)
      const k = res.data.keys || res.data.data || res.data || []
      setKeys(Array.isArray(k) ? k : [])
    } catch (err) {
      console.error('Failed to fetch keys:', err)
      setKeys([])
    } finally {
      setLoadingKeys(false)
    }
  }

  const generateKey = async () => {
    setGenerating(true)
    try {
      const res = await api.post(`/api/apis/${apiData._id}/keys`)
      console.log('Key generated:', res.data)
      fetchKeys()
    } catch (err) {
      console.error('Generate key failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  const copyKey = (keyStr) => {
    navigator.clipboard.writeText(keyStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to revoke this API?')) return
    setRevoking(true)
    try {
      await api.patch(`/api/apis/${apiData._id}/revoke`)
      onRevoke(apiData._id)
    } catch (err) {
      console.error('Revoke failed:', err)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">{apiData.name}</h3>
            <p className="text-gray-400 text-sm mt-1">{apiData.description || 'No description'}</p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs ${(apiData.status === 'active' || !apiData.status) ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {apiData.status || 'active'}
          </span>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <p className="text-xs text-gray-400 mb-1">Target URL</p>
          <p className="text-white text-sm font-mono">{apiData.baseUrl}</p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-gray-400">API Keys</p>
            <button
              onClick={generateKey}
              disabled={generating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              {generating ? 'Generating...' : '+ Generate Key'}
            </button>
          </div>

          {loadingKeys ? (
            <p className="text-gray-500 text-sm">Loading keys...</p>
          ) : keys.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-500 text-sm">No keys yet — click "Generate Key" to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map(k => (
                <div key={k._id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between gap-3">
                  <p className="text-white text-sm font-mono truncate">{k.key}</p>
                  <button
                    onClick={() => copyKey(k.key)}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                  >
                    {copied ? '✅ Copied!' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg transition">
            Close
          </button>
          <button
            onClick={handleRevoke}
            disabled={revoking || apiData.status === 'revoked'}
            className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 py-3 rounded-lg transition disabled:opacity-50"
          >
            {revoking ? 'Revoking...' : 'Revoke API'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NewApiModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name || !targetUrl) return setError('Name and Target URL are required')
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/api/apis', { name, description, baseUrl: targetUrl })
      console.log('Created:', res.data)
      onCreated()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create API')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-6">Create New API</h3>
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">API Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="My Weather API" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Optional description" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Target URL *</label>
            <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://jsonplaceholder.typicode.com" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg transition">Cancel</button>
          <button onClick={handleCreate} disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg transition disabled:opacity-50">
            {loading ? 'Creating...' : 'Create API'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color }) {
  const colors = {
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  }
  return (
    <div className={`rounded-2xl border p-6 ${colors[color]}`}>
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-4xl font-bold">{value}</p>
    </div>
  )
}