import '@testing-library/jest-dom/vitest'
import { installSpeechMocks } from './mocks/speech'

installSpeechMocks()

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

if (
  typeof window !== 'undefined' &&
  typeof window.ResizeObserver === 'undefined'
) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
