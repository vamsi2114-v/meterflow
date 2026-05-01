import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'

const api = axios.create({ baseURL: 'http://localhost:5000' })
api.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`
  return cfg
})

export default function Usage() {
  const [summary, setSummary] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [topEndpoints, setTopEndpoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)
  const navigate = useNavigate()

  useEffect(() => { fetchUsage() }, [days])

  const fetchUsage = async () => {
    setLoading(true)
    try {
      const [summaryRes, timelineRes, endpointsRes] = await Promise.all([
        api.get('/api/usage/summary'),
        api.get(`/api/usage/timeline?groupBy=hour&days=${days}`),
        api.get('/api/usage/top-endpoints'),
      ])
      setSummary(summaryRes.data.data)
      setTimeline(timelineRes.data.data || [])
      setTopEndpoints(endpointsRes.data.data || [])
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

  const chartData = timeline.map(d => ({
    time: d._id?.slice(11, 16) || d._id,
    requests: d.requests,
    errors: d.errors,
  }))

  const endpointData = topEndpoints.map(e => ({
    endpoint: e._id?.split('/').slice(-2).join('/') || e._id,
    count: e.count,
    latency: Math.round(e.avgLatency),
  }))

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
          <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm transition">Dashboard</Link>
          <Link to="/billing" className="text-gray-400 hover:text-white text-sm transition">Billing</Link>
          <button onClick={handleLogout} className="bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold">Usage Analytics</h2>
            <p className="text-gray-400 mt-1">Monitor your API requests and performance</p>
          </div>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="bg-gray-800 text-white text-sm px-4 py-2 rounded-lg outline-none"
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <StatCard title="Total Requests" value={summary?.totalRequests ?? 0} color="indigo" />
          <StatCard title="Success (2xx)" value={summary?.successRequests ?? 0} color="green" />
          <StatCard title="Errors (4xx/5xx)" value={summary?.errorRequests ?? 0} color="red" />
          <StatCard
            title="Avg Latency"
            value={summary?.avgLatency ? Math.round(summary.avgLatency) + 'ms' : '—'}
            color="blue"
          />
        </div>

        {/* Requests over time */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-6">Requests Over Time</h3>
          {chartData.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No data yet — make some API calls through the gateway!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="requests" stroke="#6366F1" strokeWidth={2} dot={false} name="Requests" />
                <Line type="monotone" dataKey="errors" stroke="#EF4444" strokeWidth={2} dot={false} name="Errors" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top endpoints */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-6">Top Endpoints</h3>
          {endpointData.length === 0 ? (
            <div className="text-center py-16 text-gray-500">No endpoint data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={endpointData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <YAxis dataKey="endpoint" type="category" stroke="#9CA3AF" tick={{ fontSize: 11 }} width={120} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#6366F1" radius={[0, 4, 4, 0]} name="Requests" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top endpoints table */}
        {topEndpoints.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-6">Endpoint Details</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left pb-3">Endpoint</th>
                  <th className="text-left pb-3">Requests</th>
                  <th className="text-left pb-3">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {topEndpoints.map((e, i) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 font-mono text-xs">{e._id}</td>
                    <td className="py-3">{e.count}</td>
                    <td className="py-3 text-gray-400">{Math.round(e.avgLatency)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ title, value, color }) {
  const colors = {
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  }
  return (
    <div className={`rounded-2xl border p-6 ${colors[color]}`}>
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}