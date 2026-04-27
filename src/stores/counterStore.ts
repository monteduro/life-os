import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface CounterState {
  value: number
  increment: () => void
  decrement: () => void
  reset: () => void
}

export const useCounterStore = create<CounterState>()(
  devtools(
    persist(
      (set) => ({
        value: 0,
        increment: () => set((state) => ({ value: state.value + 1 }), false, 'increment'),
        decrement: () => set((state) => ({ value: state.value - 1 }), false, 'decrement'),
        reset: () => set({ value: 0 }, false, 'reset'),
      }),
      {
        name: 'counter-storage', // chiave in localStorage
        partialize: (state) => ({ value: state.value }), // opzionale: salva solo "value", non le funzioni
      }
    ),
    { name: 'CounterStore' }
  )
)
