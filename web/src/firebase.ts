import { initializeApp } from 'firebase/app';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

// Khi dev dùng project "demo-emg": tiền tố demo- khiến SDK chỉ chạy với emulator, không chạm project thật.
const config = import.meta.env.DEV
  ? { projectId: 'demo-emg', apiKey: 'demo', databaseURL: 'https://demo-emg-default-rtdb.firebaseio.com' }
  : {
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    };

export const db = getDatabase(initializeApp(config));
if (import.meta.env.DEV) connectDatabaseEmulator(db, '127.0.0.1', 9000);

export const DEVICE_ID = 'esp32s3-01';
