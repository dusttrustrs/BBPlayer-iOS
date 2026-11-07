import * as ScreenOrientation from 'expo-screen-orientation'
import { Platform } from 'react-native'

import { storage } from '@/utils/mmkv'

let playerScreenRefCount = 0
let cachedIPadMode: boolean | null = null

function readPersistedIPadMode(): boolean {
	try {
		const raw = storage.getString('app-storage')
		if (!raw) return false
		const parsed = JSON.parse(raw) as {
			state?: { settings?: { enableIPadMode?: boolean } }
		}
		return parsed?.state?.settings?.enableIPadMode === true
	} catch {
		return false
	}
}

export function isIPadModeEnabled(): boolean {
	return cachedIPadMode ?? readPersistedIPadMode()
}

export function applyAppOrientation(enableIPadMode?: boolean): void {
	if (typeof enableIPadMode === 'boolean') {
		cachedIPadMode = enableIPadMode
	}
	if (Platform.OS === 'web') return

	const iPadMode = isIPadModeEnabled()
	const allowFreeLandscape =
		iPadMode || (Platform.OS === 'ios' && playerScreenRefCount > 0)

	if (allowFreeLandscape) {
		void ScreenOrientation.unlockAsync().catch(() => undefined)
	} else {
		void ScreenOrientation.lockAsync(
			ScreenOrientation.OrientationLock.PORTRAIT_UP,
		).catch(() => undefined)
	}
}

export function enterPlayerOrientationScope(): () => void {
	playerScreenRefCount += 1
	applyAppOrientation()
	return () => {
		playerScreenRefCount = Math.max(0, playerScreenRefCount - 1)
		applyAppOrientation()
	}
}
