import { create } from 'zustand'

interface PlayerCommentsStoreState {
	isOpen: boolean
	isExpanded: boolean // true = full, false = card
	open: () => void
	close: () => void
	toggleExpanded: () => void
	setOpen: (value: boolean) => void
	setExpanded: (value: boolean) => void
}

export const usePlayerCommentsStore = create<PlayerCommentsStoreState>(
	(set) => ({
		isOpen: false,
		isExpanded: false,
		open: () => set({ isOpen: true, isExpanded: false }),
		close: () => set({ isOpen: false, isExpanded: false }),
		toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
		setOpen: (isOpen: boolean) => set({ isOpen, isExpanded: false }),
		setExpanded: (isExpanded: boolean) => set({ isExpanded }),
	}),
)
