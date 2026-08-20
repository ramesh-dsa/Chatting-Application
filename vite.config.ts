import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'inject-fcm-sw',
        apply: 'build',
        generateBundle() {
          const source = readFileSync('public/firebase-messaging-sw.js', 'utf8')
          const out = source.replace('__FIREBASE_CONFIG__', JSON.stringify(firebaseConfig))
          this.emitFile({ type: 'asset', fileName: 'firebase-messaging-sw.js', source: out })
        },
      },
    ],
  }
})