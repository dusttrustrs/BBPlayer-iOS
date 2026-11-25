import { memo, useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Divider, Icon, Portal, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

export interface LyricsOffsetControlProps {
	visible: boolean
	offset: number
	onChangeOffset: (delta: number) => void
	onClose: () => void
}

export const LyricsOffsetControl = memo(function LyricsOffsetControl({
	visible,
	offset,
	onChangeOffset,
	onClose,
}: LyricsOffsetControlProps) {
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const { height: windowHeight } = useWindowDimensions()
	const isCompactHeight = windowHeight < 500

	const [mounted, setMounted] = useState(visible)
	const translateX = useSharedValue(200)
	const isAnimatingOut = useSharedValue(false)

	useEffect(() => {
		if (visible) {
			setMounted(true)
			isAnimatingOut.set(false)
			translateX.set(200)
			translateX.set(withTiming(0, { duration: 250 }))
		} else {
			setMounted(false)
		}
	}, [visible, translateX, isAnimatingOut])

	const finishClose = useCallback(() => {
		setMounted(false)
		onClose()
	}, [onClose])

	const handleDismiss = useCallback(() => {
		if (isAnimatingOut.value) return
		isAnimatingOut.set(true)
		translateX.set(
			withTiming(250, { duration: 200 }, (finished) => {
				if (finished) {
					scheduleOnRN(finishClose)
				}
			}),
		)
	}, [isAnimatingOut, translateX, finishClose])

	const panelStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.value }],
	}))

	if (!mounted && !visible) {
		return null
	}

	const buttonPadding = isCompactHeight ? 10 : 14
	const iconSize = isCompactHeight ? 24 : 28

	return (
		<Portal>
			<View
				style={styles.modalRoot}
				pointerEvents='box-none'
			>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={handleDismiss}
				/>
				<Animated.View
					style={[
						styles.panel,
						{
							backgroundColor: colors.elevation.level2,
							marginRight: Math.max(insets.right, 16),
							gap: isCompactHeight ? 4 : 12,
							paddingVertical: isCompactHeight ? 6 : 8,
						},
						panelStyle,
					]}
				>
					<Pressable
						android_ripple={{}}
						style={[styles.offsetControlButton, { padding: buttonPadding }]}
						onPress={() => onChangeOffset(0.5)}
					>
						<Icon
							source='arrow-up'
							size={iconSize}
							color={colors.onSurface}
						/>
					</Pressable>
					<Text
						variant='titleMedium'
						style={[styles.offsetControlText, { color: colors.onSurface }]}
					>
						{offset.toFixed(1)}s
					</Text>
					<Pressable
						android_ripple={{}}
						style={[styles.offsetControlButton, { padding: buttonPadding }]}
						onPress={() => onChangeOffset(-0.5)}
					>
						<Icon
							source='arrow-down'
							size={iconSize}
							color={colors.onSurface}
						/>
					</Pressable>
					<Divider />
					<Pressable
						android_ripple={{}}
						style={[styles.offsetControlButton, { padding: buttonPadding }]}
						onPress={handleDismiss}
					>
						<Icon
							source='check'
							size={iconSize}
							color={colors.onSurface}
						/>
					</Pressable>
				</Animated.View>
			</View>
		</Portal>
	)
})

const styles = StyleSheet.create({
	modalRoot: {
		...StyleSheet.absoluteFill,
		zIndex: 1200,
		justifyContent: 'center',
		alignItems: 'flex-end',
	},
	panel: {
		borderRadius: 20,
		elevation: 10,
		paddingHorizontal: 4,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 10,
	},
	offsetControlButton: {
		borderRadius: 99999,
		alignItems: 'center',
		justifyContent: 'center',
	},
	offsetControlText: {
		textAlign: 'center',
		minWidth: 56,
	},
})
