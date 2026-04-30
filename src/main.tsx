import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import './index.css'
import App from './App.tsx'

import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://6f9b7d7e4104464f826138049a9d6722@o4505519988998144.ingest.us.sentry.io/4505519990439936",
  enabled: import.meta.env.PROD,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
