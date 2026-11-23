import { Orpheus } from '@bbplayer/orpheus'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	type LayoutChangeEvent,
	Pressable,
	StyleSheet,
	useColorScheme,
	View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Icon, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import * as Haptics from '@/utils/haptics'

function readNativeAppVolume(): number {
	try {
		if (typeof Orpheus.getAppVolume === 'function') {
			const val = Orpheus.getAppVolume()
			if (Number.isFinite(val)) {
				return Math.max(0, Math.min(1, val))
			}
		}
	} catch {
		// fallback to full volume if native method is unavailable
	}
	return 1
}

function writeNativeAppVolume(volume: number) {
	try {
		if (typeof Orpheus.setAppVolume === 'function') {
			Orpheus.setAppVolume(Math.max(0, Math.min(1, volume)))
		}
	} catch {
		// ignore if unavailable
	}
}

interface AppVolumeSliderProps {
	onDragStateChange?: (dragging: boolean) => void
}

export const AppVolumeSlider = memo(function AppVolumeSlider({
	onDragStateChange,
}: AppVolumeSliderProps) {
	const { colors } = useTheme()
	const isDark = useColorScheme() === 'dark'

	const initialVolume = useMemo(() => readNativeAppVolume(), [])
	const [volumeState, setVolumeState] = useState(initialVolume)
	const [isDragging, setIsDragging] = useState(false)
	const lastNonZeroVolumeRef = useRef(
		initialVolume > 0.05 ? initialVolume : 0.7,
	)

	const trackWidthSV = useSharedValue(1)
	const volumeSV = useSharedValue(initialVolume)
	const isDraggingSV = useSharedValue(false)

	useEffect(() => {
		const synced = readNativeAppVolume()
		volumeSV.set(synced)
		setVolumeState(synced)
	}, [volumeSV])

	useEffect(() => {
		if (volumeState > 0.05) {
			lastNonZeroVolumeRef.current = volumeState
		}
	}, [volumeState])

	const applyVolumeFromJS = useCallback((next: number) => {
		const clamped = Math.max(0, Math.min(1, next))
		setVolumeState(clamped)
		writeNativeAppVolume(clamped)
	}, [])

	const notifyDragging = useCallback(
		(dragging: boolean) => {
			setIsDragging(dragging)
			onDragStateChange?.(dragging)
		},
		[onDragStateChange],
	)

	const triggerHaptic = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
	}, [])

	const handleTrackLayout = useCallback(
		(e: LayoutChangeEvent) => {
			const w = e.nativeEvent.layout.width
			if (w > 0) {
				trackWidthSV.set(w)
			}
		},
		[trackWidthSV],
	)

	const handleToggleMute = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		const target = volumeState <= 0.01 ? lastNonZeroVolumeRef.current || 0.7 : 0
		volumeSV.set(withTiming(target, { duration: 140 }))
		applyVolumeFromJS(target)
	}, [volumeState, volumeSV, applyVolumeFromJS])

	const gesture = useMemo(() => {
		const pan = Gesture.Pan()
			.minDistance(0)
			.activeOffsetX([-2, 2])
			.onBegin((e) => {
				'worklet'
				isDraggingSV.set(true)
				scheduleOnRN(notifyDragging, true)
				const width = Math.max(1, trackWidthSV.value)
				const next = Math.max(0, Math.min(1, e.x / width))
				volumeSV.set(next)
				scheduleOnRN(applyVolumeFromJS, next)
			})
			.onUpdate((e) => {
				'worklet'
				const width = Math.max(1, trackWidthSV.value)
				const next = Math.max(0, Math.min(1, e.x / width))
				volumeSV.set(next)
				scheduleOnRN(applyVolumeFromJS, next)
			})
			.onFinalize(() => {
				'worklet'
				isDraggingSV.set(false)
				scheduleOnRN(notifyDragging, false)
			})

		const tap = Gesture.Tap().onEnd((e) => {
			'worklet'
			const width = Math.max(1, trackWidthSV.value)
			const next = Math.max(0, Math.min(1, e.x / width))
			volumeSV.set(withTiming(next, { duration: 100 }))
			scheduleOnRN(applyVolumeFromJS, next)
			scheduleOnRN(triggerHaptic)
		})

		return Gesture.Race(pan, tap)
	}, [
		isDraggingSV,
		notifyDragging,
		trackWidthSV,
		volumeSV,
		applyVolumeFromJS,
		triggerHaptic,
	])

	const trackAnimatedStyle = useAnimatedStyle(() => ({
		height: withTiming(isDraggingSV.value ? 8 : 4.5, { duration: 140 }),
	}))

	const fillAnimatedStyle = useAnimatedStyle(() => ({
		width: `${Math.max(0, Math.min(1, volumeSV.value)) * 100}%`,
	}))

	const volumeIcon =
		volumeState <= 0.01
			? 'volume-off'
			: volumeState < 0.35
				? 'volume-low'
				: volumeState < 0.7
					? 'volume-medium'
					: 'volume-high'

	const activeTrackColor = isDark ? 'rgba(255, 255, 255, 0.92)' : colors.primary
	const inactiveTrackColor = isDark
		? 'rgba(255, 255, 255, 0.2)'
		: colors.surfaceVariant
	const iconColor = isDark
		? 'rgba(255, 255, 255, 0.8)'
		: colors.onSurfaceVariant

	return (
		<View
			style={styles.container}
			testID='app-volume-slider'
		>
			<Pressable
				onPress={handleToggleMute}
				hitSlop={10}
				accessibilityRole='button'
				accessibilityLabel={volumeState <= 0.01 ? '取消静音' : '静音'}
				style={styles.iconButton}
			>
				<Icon
					source={volumeIcon}
					size={18}
					color={iconColor}
				/>
			</Pressable>

			<GestureDetector gesture={gesture}>
				<View
					style={styles.sliderHitArea}
					onLayout={handleTrackLayout}
					accessibilityRole='adjustable'
					accessibilityLabel='应用独立音量'
				>
					<Animated.View
						style={[
							styles.track,
							{ backgroundColor: inactiveTrackColor },
							trackAnimatedStyle,
						]}
					>
						<Animated.View
							style={[
								styles.fill,
								{ backgroundColor: activeTrackColor },
								fillAnimatedStyle,
							]}
						/>
					</Animated.View>
				</View>
			</GestureDetector>

			<Text
				variant='labelSmall'
				style={[
					styles.percentText,
					{
						color: isDragging ? colors.onSurface : iconColor,
						opacity: isDragging ? 0.95 : 0.65,
					},
				]}
			>
				{Math.round(volumeState * 100)}%
			</Text>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		width: '100%',
		gap: 10,
	},
	iconButton: {
		width: 28,
		height: 28,
		alignItems: 'center',
		justifyContent: 'center',
	},
	sliderHitArea: {
		flex: 1,
		height: 30,
		justifyContent: 'center',
	},
	track: {
		width: '100%',
		borderRadius: 999,
		overflow: 'hidden',
	},
	fill: {
		height: '100%',
		borderRadius: 999,
	},
	percentText: {
		width: 34,
		textAlign: 'right',
		fontVariant: ['tabular-nums'],
	},
})
