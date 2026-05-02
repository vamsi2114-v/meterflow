import axios from 'axios'

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000' 
})

api.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`
  return cfg
})

export default api