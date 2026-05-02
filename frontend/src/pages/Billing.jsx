import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function Billing() {
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetchBilling() }, [])

  const fetchBilling = async () => {
    try {
      const [summaryRes, historyRes] = await Promise.all([
        api.get('/api/billing'),
        api.get('/api/billing/history'),
      ])
      setSummary(summaryRes.data.data)
      setHistory(historyRes.data.data || [])
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

  const handlePay = async (billing) => {
    setPayingId(billing._id)
    try {
      const res = await api.post('/api/billing/create-order', { billingId: billing._id })
      const { orderId, amount, currency, keyId } = res.data.data

      const options = {
        key: keyId,
        amount,
        currency,
        name: 'MeterFlow',
        description: `Bill for ${billing.month}`,
        order_id: orderId,
        handler: async (response) => {
          try {
            await api.post('/api/billing/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              billingId: billing._id,
            })
            alert('Payment successful!')
            fetchBilling()
          } catch {
            alert('Payment verification failed')
          }
        },
        theme: { color: '#6366F1' },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create order')
    } finally {
      setPayingId(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>
  )

  const totalDue = history.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.amountDue, 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-400">MeterFlow</h1>
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm transition">Dashboard</Link>
          <Link to="/usage" className="text-gray-400 hover:text-white text-sm transition">Usage</Link>
          <button onClick={handleLogout} className="bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h2 className="text-3xl font-bold">Billing</h2>
          <p className="text-gray-400 mt-1">Manage your API usage bills</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard title="Total Due" value={`₹${totalDue.toFixed(2)}`} color="red" />
          <StatCard title="This Month Requests" value={summary?.totalRequests ?? '—'} color="indigo" />
          <StatCard title="Billable Requests" value={summary?.totalBillableRequests ?? '—'} color="blue" />
        </div>

        {/* Billing history */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <h3 className="text-xl font-semibold mb-6">Billing History</h3>
          {history.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-4">🧾</p>
              <p>No billing records yet</p>
              <p className="text-sm mt-1">Bills are generated monthly based on your API usage</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left pb-3">API</th>
                  <th className="text-left pb-3">Month</th>
                  <th className="text-left pb-3">Requests</th>
                  <th className="text-left pb-3">Billable</th>
                  <th className="text-left pb-3">Amount</th>
                  <th className="text-left pb-3">Status</th>
                  <th className="text-left pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map(b => (
                  <tr key={b._id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 font-medium">{b.apiId?.name || '—'}</td>
                    <td className="py-3 text-gray-400">{b.month}</td>
                    <td className="py-3">{b.totalRequests}</td>
                    <td className="py-3">{b.billableRequests}</td>
                    <td className="py-3 font-mono">₹{b.amountDue.toFixed(2)}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        b.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                        b.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        b.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {b.status === 'pending' && b.amountDue > 0 ? (
                        <button
                          onClick={() => handlePay(b)}
                          disabled={payingId === b._id}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                        >
                          {payingId === b._id ? 'Opening...' : 'Pay Now'}
                        </button>
                      ) : b.status === 'paid' ? (
                        <span className="text-green-400 text-xs">✓ Paid</span>
                      ) : (
                        <span className="text-gray-500 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color }) {
  const colors = {
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
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