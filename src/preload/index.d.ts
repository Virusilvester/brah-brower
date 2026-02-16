import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
    downloads: {
      onProgress: (callback: (data: any) => void) => void
      onComplete: (callback: (data: any) => void) => void
    }
  }
}
