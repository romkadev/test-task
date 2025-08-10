declare module 'firebase/auth/react-native' {
  import type { Persistence } from 'firebase/auth';
  export function getReactNativePersistence(storage: unknown): Persistence;
  export function initializeAuth(...args: any[]): any;
}

