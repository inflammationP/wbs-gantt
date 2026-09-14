import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// The update check now runs from `App`'s mount effect, so that its result has
// somewhere to be recorded and shown. See `runUpdateCheck` in the store.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
