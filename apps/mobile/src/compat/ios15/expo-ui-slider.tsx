import { useCallback, useRef, useState } from 'react'
import {
	StyleSheet,
	View,
	type GestureResponderEvent,
	type LayoutChangeEvent,
	type StyleProp,
	type ViewStyle,
} from 'react-native'
import { useTheme } from 'react-native-paper'

export type SliderProps = {
	value?: number
	minimumValue?: number
	maximumValue?: number
	min?: number
	max?: number
	step?: number
	steps?: number
	disabled?: boolean
	minimumTrackTintColor?: string
	maximumTrackTintColor?: string
	thumbTintColor?: string
	onValueChange?: (value: number) => void
	onSlidingStart?: (value: number) => void
	onSlidingComplete?: (value: number) => void
	onValueChangeFinished?: (value: number) => void
	style?: StyleProp<ViewStyle>
	testID?: string
}

const THUMB_SIZE = 22
const TRACK_HEIGHT = 4

export function Slider({
	value = 0,
	minimumValue,
	maximumValue,
	min,
	max,
	step,
	steps,
	disabled = false,
	minimumTrackTintColor,
	maximumTrackTintColor,
	thumbTintColor,
	onValueChange,
	onSlidingStart,
	onSlidingComplete,
	onValueChangeFinished,
	style,
	testID,
}: SliderProps) {
	const { colors } = useTheme()
	const minVal = minimumValue ?? min ?? 0
	const maxVal = maximumValue ?? max ?? 1
	const range = maxVal > minVal ? maxVal - minVal : 1
	const resolvedStep =
		step && step > 0 ? step : steps && steps > 0 ? range / steps : 0

	const [trackWidth, setTrackWidth] = useState(0)
	const trackWidthRef = useRef(0)
	const trackPageXRef = useRef(0)
	const containerRef = useRef<View>(null)
	const lastEmittedRef = useRef<number>(value)

	const clampAndSnap = useCallback(
		(raw: number) => {
			let next = Math.max(minVal, Math.min(maxVal, raw))
			if (resolvedStep > 0) {
				next =
					minVal + Math.round((next - minVal) / resolvedStep) * resolvedStep
				next = Math.max(minVal, Math.min(maxVal, next))
			}
			return next
		},
		[maxVal, minVal, resolvedStep],
	)

	const valueFromPageX = useCallback(
		(pageX: number) => {
			const width = trackWidthRef.current
			if (width <= 0) return value
			const ratio = Math.max(
				0,
				Math.min(1, (pageX - trackPageXRef.current) / width),
			)
			return clampAndSnap(minVal + ratio * range)
		},
		[clampAndSnap, minVal, range, value],
	)

	const measureTrack = useCallback(() => {
		const node = containerRef.current
		if (node && typeof node.measureInWindow === 'function') {
			node.measureInWindow((x, _y, width) => {
				trackPageXRef.current = x + THUMB_SIZE / 2
				if (width > THUMB_SIZE) {
					trackWidthRef.current = width - THUMB_SIZE
				}
			})
		}
	}, [])

	const handleResponderGrant = useCallback(
		(evt: GestureResponderEvent) => {
			measureTrack()
			const locationX = evt.nativeEvent.locationX - THUMB_SIZE / 2
			const width = trackWidthRef.current
			const next =
				width > 0
					? clampAndSnap(
							minVal + Math.max(0, Math.min(1, locationX / width)) * range,
						)
					: valueFromPageX(evt.nativeEvent.pageX)
			lastEmittedRef.current = next
			onSlidingStart?.(next)
			onValueChange?.(next)
		},
		[
			clampAndSnap,
			measureTrack,
			minVal,
			onSlidingStart,
			onValueChange,
			range,
			valueFromPageX,
		],
	)

	const handleResponderMove = useCallback(
		(evt: GestureResponderEvent) => {
			const next = valueFromPageX(evt.nativeEvent.pageX)
			if (next !== lastEmittedRef.current) {
				lastEmittedRef.current = next
				onValueChange?.(next)
			}
		},
		[onValueChange, valueFromPageX],
	)

	const handleResponderRelease = useCallback(
		(evt: GestureResponderEvent) => {
			const next = valueFromPageX(evt.nativeEvent.pageX)
			lastEmittedRef.current = next
			onValueChange?.(next)
			onSlidingComplete?.(next)
			onValueChangeFinished?.(next)
		},
		[onSlidingComplete, onValueChange, onValueChangeFinished, valueFromPageX],
	)

	const handleResponderTerminate = useCallback(() => {
		onSlidingComplete?.(lastEmittedRef.current)
		onValueChangeFinished?.(lastEmittedRef.current)
	}, [onSlidingComplete, onValueChangeFinished])

	const handleLayout = useCallback(
		(event: LayoutChangeEvent) => {
			const usableWidth = Math.max(
				0,
				event.nativeEvent.layout.width - THUMB_SIZE,
			)
			trackWidthRef.current = usableWidth
			setTrackWidth(usableWidth)
			measureTrack()
		},
		[measureTrack],
	)

	const clampedValue = Math.max(minVal, Math.min(maxVal, value))
	const fraction = range > 0 ? (clampedValue - minVal) / range : 0
	const thumbLeft = trackWidth * fraction

	return (
		<View
			ref={containerRef}
			collapsable={false}
			onLayout={handleLayout}
			onStartShouldSetResponder={() => !disabled}
			onMoveShouldSetResponder={() => !disabled}
			onResponderTerminationRequest={() => false}
			onResponderGrant={handleResponderGrant}
			onResponderMove={handleResponderMove}
			onResponderRelease={handleResponderRelease}
			onResponderTerminate={handleResponderTerminate}
			style={[styles.container, disabled && styles.disabled, style]}
			testID={testID}
		>
			<View
				pointerEvents='none'
				style={[
					styles.trackBackground,
					{
						backgroundColor: maximumTrackTintColor ?? colors.surfaceVariant,
					},
				]}
			>
				<View
					style={[
						styles.trackFill,
						{
							width: `${fraction * 100}%`,
							backgroundColor: minimumTrackTintColor ?? colors.primary,
						},
					]}
				/>
			</View>
			<View
				pointerEvents='none'
				style={[
					styles.thumb,
					{
						left: thumbLeft,
						backgroundColor: thumbTintColor ?? colors.primary,
					},
				]}
			/>
		</View>
	)
}

export default Slider

const styles = StyleSheet.create({
	container: {
		height: 36,
		justifyContent: 'center',
		paddingHorizontal: THUMB_SIZE / 2,
	},
	disabled: {
		opacity: 0.45,
	},
	trackBackground: {
		height: TRACK_HEIGHT,
		borderRadius: TRACK_HEIGHT / 2,
		overflow: 'hidden',
	},
	trackFill: {
		height: TRACK_HEIGHT,
		borderRadius: TRACK_HEIGHT / 2,
	},
	thumb: {
		position: 'absolute',
		width: THUMB_SIZE,
		height: THUMB_SIZE,
		borderRadius: THUMB_SIZE / 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.25,
		shadowRadius: 2,
		elevation: 2,
	},
})
