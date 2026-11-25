import { useState } from 'react'
import type { ViewStyle } from 'react-native'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import { useTheme } from 'react-native-paper'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Props {
	visible: boolean
	onDismiss: () => void
	children?: React.ReactNode
	contentStyle?: ViewStyle
}

export default function AnimatedModalOverlay({
	visible,
	onDismiss,
	children,
	contentStyle,
}: Props) {
	const insets = useSafeAreaInsets()
	const { width: windowWidth, height: windowHeight } = useWindowDimensions()
	const isLandscape = windowWidth > windowHeight
	const { height } = useReanimatedKeyboardAnimation()
	const theme = useTheme()
	const [showContent, setShowContent] = useState(false)

	const wrapperAvoiding = useAnimatedStyle(() => {
		const k = Math.max(0, Math.abs(height.value) - insets.bottom)
		return { paddingBottom: k }
	})

	if (!visible) return null

	const horizontalMargin = Math.max(insets.left, insets.right, 26)
	const maxModalHeight = Math.max(
		220,
		windowHeight - insets.top - insets.bottom - (isLandscape ? 20 : 48),
	)
	const maxModalWidth = isLandscape
		? Math.min(windowWidth - horizontalMargin * 2, 600)
		: undefined

	return (
		<Animated.View style={[styles.wrapper, wrapperAvoiding]}>
			<Pressable
				style={StyleSheet.absoluteFill}
				onPress={onDismiss}
			/>
			<View
				style={[
					styles.content,
					{
						marginHorizontal: horizontalMargin,
						maxHeight: maxModalHeight,
						maxWidth: maxModalWidth,
						alignSelf: isLandscape ? 'center' : 'stretch',
						width: isLandscape ? maxModalWidth : undefined,
						opacity: showContent ? 1 : 0,
					},
				]}
				onLayout={(e) => {
					setShowContent(
						e.nativeEvent.layout.height > 0 && e.nativeEvent.layout.width > 0,
					)
				}}
			>
				<SquircleView
					style={[
						styles.contentInner,
						{
							backgroundColor: theme.colors.surface,
							maxHeight: maxModalHeight,
						},
						contentStyle,
					]}
					cornerSmoothing={0.6}
				>
					{children}
				</SquircleView>
			</View>
		</Animated.View>
	)
}

const styles = StyleSheet.create({
	wrapper: {
		...StyleSheet.absoluteFill,
		justifyContent: 'center',
		backgroundColor: 'rgba(0,0,0,0.5)',
		zIndex: 1000,
	},
	content: {
		maxHeight: '85%',
	},
	contentInner: {
		paddingTop: 10,
		elevation: 24,
		borderRadius: 32,
		overflow: 'hidden',
	},
})
