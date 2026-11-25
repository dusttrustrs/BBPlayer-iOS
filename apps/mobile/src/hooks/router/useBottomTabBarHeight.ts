import * as React from 'react'
import { Platform } from 'react-native'
import { BottomTabBarHeightContext } from 'react-native-bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function useBottomTabBarHeight() {
	const height = React.useContext(BottomTabBarHeightContext)
	const insets = useSafeAreaInsets()

	if (height === undefined) {
		// 说明这个页面并不是 tabs 页面，直接返回 0 就可以
		return 0
	}

	if (height === 0 && Platform.OS === 'ios') {
		return 49 + insets.bottom
	}

	return height
}
