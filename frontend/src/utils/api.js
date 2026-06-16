import axios from 'axios'

// En prod: Nginx sert sur / et proxy /api → FastAPI
// En dev:  vite.config.js proxy /api → localhost:8000
const api = axios.create({ baseURL: '/api', timeout: 20000 })

export const getHealth        = ()           => api.get('/health/').then(r => r.data)
export const getMapH1         = ()           => api.get('/predictions/map/h1').then(r => r.data)
export const getCityForecast  = (city)       => api.get(`/predictions/city/${encodeURIComponent(city)}`).then(r => r.data)
export const getRanking       = (h = 1)     => api.get(`/predictions/ranking?horizon=${h}`).then(r => r.data)
export const getCities        = ()           => api.get('/cities/').then(r => r.data)

// Admin
export const adminCollect     = () => api.post('/admin/collect')
export const adminPredict     = () => api.post('/admin/predict')
export const adminFineTune    = () => api.post('/admin/fine-tune')
export const adminFullRetrain = () => api.post('/admin/full-retrain')
export const adminPush        = () => api.post('/admin/push')

export default api
