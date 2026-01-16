import React from 'react'
import ReactDOM from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css' // <--- 1. Import Notification Styles
import App from './App.jsx'
import { BrandThemeProvider } from './BrandTheme.jsx'
import { Notifications } from '@mantine/notifications' // <--- 2. Import Component

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* The Provider handles the Theme */}
    <BrandThemeProvider>
      {/* Notifications sits here to access the theme */}
      <Notifications position="top-right" zIndex={2000} />
      <App />
    </BrandThemeProvider>
  </React.StrictMode>,
)
