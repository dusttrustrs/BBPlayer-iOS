import { create } from 'zustand'

interface CommentImageViewerState {
	visible: boolean
	pictures: string[]
	currentIndex: number
	open: (pictures: string[], initialIndex: number) => void
	close: () => void
	setCurrentIndex: (index: number) => void
}

export const useCommentImageViewerStore = create<CommentImageViewerState>(
	(set) => ({
		visible: false,
		pictures: [],
		currentIndex: 0,
		open: (pictures, initialIndex) => {
			if (pictures.length === 0) return
			const clamped = Math.max(0, Math.min(initialIndex, pictures.length - 1))
			set({
				visible: true,
				pictures,
				currentIndex: clamped,
			})
		},
		close: () =>
			set({
				visible: false,
				pictures: [],
				currentIndex: 0,
			}),
		setCurrentIndex: (index) =>
			set((state) => {
				if (state.pictures.length === 0) return state
				const clamped = Math.max(0, Math.min(index, state.pictures.length - 1))
				return { currentIndex: clamped }
			}),
	}),
)
