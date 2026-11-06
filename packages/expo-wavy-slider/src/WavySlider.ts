import { requireNativeView } from 'expo'
import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Platform, StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedReaction,
	useAnimatedStyle,
	useFrameCallback,
	useSharedValue,
	withTiming,
	type SharedValue,
} from 'react-native-reanimated'

let SvgComponent: any = null
let PathComponent: any = null
try {
	const svgMod = require('react-native-svg')
	SvgComponent = svgMod.Svg || svgMod.default || svgMod
	PathComponent = svgMod.Path
} catch {}

import type { WavySliderProps } from './ExpoWavySlider.types'
import useNativeNumberProp, {
	type NativeNumberProp,
} from './hooks/useNativeNumberProp'
import useObservableStateAdapter from './hooks/useObservableStateAdapter'
import useWorkletProp from './hooks/useWorkletProp'
import getStateId from './utils/getStateId'

type NativeWavySliderProps = Omit<
	WavySliderProps,
	| 'progress'
	| 'bufferedProgress'
	| 'waveLength'
	| 'waveHeight'
	| 'waveVelocity'
	| 'waveThickness'
	| 'trackThickness'
	| 'onValueChange'
	| 'onValueChangeFinished'
	| 'onDragStateChange'
> & {
	progress?: number
	bufferedProgress?: number
	waveLength?: NativeNumberProp
	waveHeight?: NativeNumberProp
	waveVelocity?: NativeNumberProp
	waveThickness?: NativeNumberProp
	trackThickness?: NativeNumberProp
	onValueChange?: number
	onValueChangeFinished?: number
	onDragStateChange?: number
}

const NativeWavySlider =
	Platform.OS === 'android'
		? requireNativeView<NativeWavySliderProps>(
				'ExpoWavySlider',
				'ExpoWavySliderView',
			)
		: null

export default function WavySlider({
	progress,
	bufferedProgress,
	onValueChange,
	onValueChangeFinished,
	onDragStateChange,
	value = 0,
	bufferedValue = 0,
	min = 0,
	max = 1,
	enabled = true,
	waveLength = 16,
	waveHeight = 16,
	waveVelocity = 15,
	waveDirection = 'head',
	thumbShape = 'default',
	thumbImageUri,
	thumbImageDragLeftUri,
	thumbImageDragRightUri,
	thumbImageSize = 32,
	thumbImageOffsetX = 0,
	thumbImageOffsetY = 0,
	waveThickness = 4,
	trackThickness = 4,
	incremental = false,
	...props
}: WavySliderProps) {
	if (Platform.OS !== 'android' || !NativeWavySlider) {
		return createElement(IOSSliderFallback, {
			...props,
			progress,
			bufferedProgress,
			value,
			bufferedValue,
			min,
			max,
			enabled,
			colors: props.colors,
			onValueChange,
			onValueChangeFinished,
			onDragStateChange,
			trackThickness,
			waveThickness,
			waveLength,
			waveHeight,
			waveVelocity,
			waveDirection,
			thumbShape,
			thumbImageUri,
			thumbImageDragLeftUri,
			thumbImageDragRightUri,
			thumbImageSize,
			thumbImageOffsetX,
			thumbImageOffsetY,
			incremental,
		})
	}

	const onValueChangeCallback = useWorkletProp(onValueChange, 'onValueChange')
	const onValueChangeFinishedCallback = useWorkletProp(
		onValueChangeFinished,
		'onValueChangeFinished',
	)
	const onDragStateChangeCallback = useWorkletProp(
		onDragStateChange,
		'onDragStateChange',
	)
	const progressState = useObservableStateAdapter(progress, value)
	const bufferedProgressState = useObservableStateAdapter(
		bufferedProgress,
		bufferedValue,
	)
	const nativeWaveLength = useNativeNumberProp(waveLength, 16)
	const nativeWaveHeight = useNativeNumberProp(waveHeight, 16)
	const nativeWaveVelocity = useNativeNumberProp(waveVelocity, 15)
	const nativeWaveThickness = useNativeNumberProp(waveThickness, 4)
	const nativeTrackThickness = useNativeNumberProp(trackThickness, 4)

	return createElement(NativeWavySlider, {
		...props,
		value,
		progress: getStateId(progressState),
		bufferedValue,
		bufferedProgress: getStateId(bufferedProgressState),
		min,
		max,
		enabled,
		waveLength: nativeWaveLength,
		waveHeight: nativeWaveHeight,
		waveVelocity: nativeWaveVelocity,
		waveDirection,
		thumbShape,
		thumbImageUri,
		thumbImageDragLeftUri,
		thumbImageDragRightUri,
		thumbImageSize,
		thumbImageOffsetX,
		thumbImageOffsetY,
		waveThickness: nativeWaveThickness,
		trackThickness: nativeTrackThickness,
		incremental,
		onValueChange: getStateId(onValueChangeCallback),
		onValueChangeFinished: getStateId(onValueChangeFinishedCallback),
		onDragStateChange: getStateId(onDragStateChangeCallback),
	})
}

// Google Style Smooth Sine Wave Path
const SINE_WAVE_PATH = (function () {
	const L = 30
	const A = 4.5
	const midY = 12
	let p = `M 0 ${midY}`
	for (let i = 0; i < 45; i++) {
		const x0 = i * L
		p += ` Q ${(x0 + L * 0.25).toFixed(1)} ${(midY - A * 1.3).toFixed(1)}, ${(x0 + L * 0.5).toFixed(1)} ${midY}`
		p += ` Q ${(x0 + L * 0.75).toFixed(1)} ${(midY + A * 1.3).toFixed(1)}, ${(x0 + L).toFixed(1)} ${midY}`
	}
	return p
})()

function IOSSliderFallback(props: WavySliderProps) {
	const {
		progress,
		value = 0,
		min = 0,
		max = 1,
		enabled = true,
		colors,
		onValueChange,
		onValueChangeFinished,
		onDragStateChange,
		style,
		waveHeight,
		waveVelocity,
		trackThickness = 4,
		thumbImageUri,
		thumbImageDragLeftUri,
		thumbImageDragRightUri,
		thumbImageSize = 32,
		thumbImageOffsetX = 0,
		thumbImageOffsetY = 0,
	} = props

	const [sliderWidth, setSliderWidth] = useState(0)
	const [thumbLoadFailed, setThumbLoadFailed] = useState(false)
	const isDraggingShared = useSharedValue(false)
	const isPendingSeekShared = useSharedValue(false)
	const pendingSeekValue = useSharedValue(0)
	const dragDirShared = useSharedValue(0)
	const localProgress = useSharedValue(value)
	const thumbScale = useSharedValue(1)
	const wavePhase = useSharedValue(0)

	const startTouchXRef = useRef(0)
	const lastTouchXRef = useRef(0)
	const sliderWidthRef = useRef(0)
	const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		setThumbLoadFailed(false)
	}, [thumbImageUri])

	// 100% UI-Thread Continuous Wave Animation (60/120 fps zero-cost worklet)
	useFrameCallback((frameInfo) => {
		'worklet'
		const h =
			waveHeight && typeof waveHeight === 'object' && 'value' in waveHeight
				? (waveHeight as SharedValue<number>).value
				: typeof waveHeight === 'number'
					? waveHeight
					: 0
		const v =
			waveVelocity && typeof waveVelocity === 'object' && 'value' in waveVelocity
				? (waveVelocity as SharedValue<number>).value
				: typeof waveVelocity === 'number'
					? waveVelocity
					: 0

		if (h > 0.05 && v > 0 && frameInfo.timeSincePreviousFrame) {
			const dt = frameInfo.timeSincePreviousFrame / 1000
			let next = wavePhase.value - dt * v * 2.5
			if (next <= -30) {
				next += 30
			}
			wavePhase.value = next
		}
	})

	useEffect(() => {
		return () => {
			if (releaseTimerRef.current) {
				clearTimeout(releaseTimerRef.current)
				releaseTimerRef.current = null
			}
		}
	}, [])

	const handleLayout = (e: { nativeEvent: { layout: { width: number } } }) => {
		const w = e.nativeEvent.layout.width
		setSliderWidth(w)
		sliderWidthRef.current = w
	}

	useAnimatedReaction(
		() => {
			'worklet'
			if (progress && typeof progress === 'object' && 'value' in progress) {
				return (progress as SharedValue<number>).value
			}
			return value
		},
		(current) => {
			'worklet'
			if (isDraggingShared.value) return
			if (isPendingSeekShared.value) {
				const diff = Math.abs(current - pendingSeekValue.value)
				if (diff < 0.03) {
					isPendingSeekShared.value = false
					localProgress.value = current
				}
				return
			}
			localProgress.value = current
		},
	)

	const activeColor = (colors?.activeTrackColor as string) || '#a855f7'
	const inactiveColor =
		(colors?.inactiveTrackColor as string) || 'rgba(150, 150, 150, 0.3)'
	const thumbColor = (colors?.thumbColor as string) || activeColor

	const normalUri = thumbImageUri ? String(thumbImageUri).trim() : ''
	const leftUri = thumbImageDragLeftUri
		? String(thumbImageDragLeftUri).trim()
		: ''
	const rightUri = thumbImageDragRightUri
		? String(thumbImageDragRightUri).trim()
		: ''
	const hasCustomThumb = Boolean(normalUri) && !thumbLoadFailed
	const hasLeftVariant = Boolean(leftUri && leftUri !== normalUri)
	const hasRightVariant = Boolean(rightUri && rightUri !== normalUri)
	const effectiveThumbSize = Math.max(
		10,
		Number.isFinite(thumbImageSize) ? Number(thumbImageSize) : 32,
	)
	const effectiveOffsetX = Number.isFinite(thumbImageOffsetX)
		? Number(thumbImageOffsetX)
		: 0
	const effectiveOffsetY = Number.isFinite(thumbImageOffsetY)
		? Number(thumbImageOffsetY)
		: 0

	const panResponder = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => enabled,
				onStartShouldSetPanResponderCapture: () => enabled,
				onMoveShouldSetPanResponder: (_, gestureState) => {
					return (
						enabled &&
						(Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) < 15)
					)
				},
				onMoveShouldSetPanResponderCapture: (_, gestureState) => {
					return (
						enabled &&
						(Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) < 15)
					)
				},
				onPanResponderTerminationRequest: () => false,
				onPanResponderGrant: (evt) => {
					if (releaseTimerRef.current) {
						clearTimeout(releaseTimerRef.current)
						releaseTimerRef.current = null
					}
					isDraggingShared.value = true
					isPendingSeekShared.value = false
					dragDirShared.value = 0
					thumbScale.value = withTiming(1.2, { duration: 150 })
					onDragStateChange?.(true)
					const width = sliderWidthRef.current || 1
					const locationX = Math.max(
						0,
						Math.min(width, evt.nativeEvent.locationX),
					)
					startTouchXRef.current = locationX
					lastTouchXRef.current = locationX
					const fraction = locationX / width
					const actualVal = min + fraction * (max - min)
					localProgress.value = actualVal
					onValueChange?.(actualVal)
				},
				onPanResponderMove: (_, gestureState) => {
					const width = sliderWidthRef.current || 1
					const currentX = Math.max(
						0,
						Math.min(width, startTouchXRef.current + gestureState.dx),
					)
					const delta = currentX - lastTouchXRef.current
					if (delta < -0.5) {
						dragDirShared.value = -1
						lastTouchXRef.current = currentX
					} else if (delta > 0.5) {
						dragDirShared.value = 1
						lastTouchXRef.current = currentX
					} else if (delta === 0) {
						dragDirShared.value = 0
					}
					const fraction = currentX / width
					const actualVal = min + fraction * (max - min)
					localProgress.value = actualVal
					onValueChange?.(actualVal)
				},
				onPanResponderRelease: () => {
					dragDirShared.value = 0
					thumbScale.value = withTiming(1, { duration: 150 })
					onDragStateChange?.(false)
					onValueChangeFinished?.(localProgress.value)
					isDraggingShared.value = false
					isPendingSeekShared.value = true
					pendingSeekValue.value = localProgress.value
					if (releaseTimerRef.current) {
						clearTimeout(releaseTimerRef.current)
					}
					releaseTimerRef.current = setTimeout(() => {
						isPendingSeekShared.value = false
						releaseTimerRef.current = null
					}, 1500)
				},
				onPanResponderTerminate: () => {
					dragDirShared.value = 0
					thumbScale.value = withTiming(1, { duration: 150 })
					onDragStateChange?.(false)
					onValueChangeFinished?.(localProgress.value)
					isDraggingShared.value = false
					isPendingSeekShared.value = true
					pendingSeekValue.value = localProgress.value
					if (releaseTimerRef.current) {
						clearTimeout(releaseTimerRef.current)
					}
					releaseTimerRef.current = setTimeout(() => {
						isPendingSeekShared.value = false
						releaseTimerRef.current = null
					}, 1500)
				},
			}),
		[
			enabled,
			min,
			max,
			onValueChange,
			onValueChangeFinished,
			onDragStateChange,
			isDraggingShared,
			isPendingSeekShared,
			pendingSeekValue,
			dragDirShared,
			thumbScale,
			localProgress,
		],
	)

	// Animated styles driven directly by Reanimated worklets
	const trackAnimatedStyle = useAnimatedStyle(() => {
		'worklet'
		const rawH =
			trackThickness &&
			typeof trackThickness === 'object' &&
			'value' in trackThickness
				? (trackThickness as SharedValue<number>).value
				: typeof trackThickness === 'number'
					? trackThickness
					: 4
		const h = Math.max(2, hasCustomThumb ? Math.min(rawH, 6) : rawH)
		return {
			height: h,
			borderRadius: h / 2,
		}
	}, [trackThickness, hasCustomThumb])

	const activeTrackStyle = useAnimatedStyle(() => {
		'worklet'
		const fraction = (localProgress.value - min) / (max - min || 1)
		const clamped = Math.max(0, Math.min(1, fraction))
		return {
			width: `${clamped * 100}%` as `${number}%`,
			height: '100%',
		}
	}, [min, max, localProgress])

	const animatedWaveStyle = useAnimatedStyle(() => {
		'worklet'
		return {
			transform: [{ translateX: wavePhase.value }],
		}
	}, [wavePhase])

	const waveTrackVisibilityStyle = useAnimatedStyle(() => {
		'worklet'
		const h =
			waveHeight && typeof waveHeight === 'object' && 'value' in waveHeight
				? (waveHeight as SharedValue<number>).value
				: typeof waveHeight === 'number'
					? waveHeight
					: 0
		const scaleY = Math.max(0, Math.min(1.2, h / 6))
		return {
			opacity: h > 0.1 ? 1 : 0,
			transform: [{ scaleY }],
		}
	}, [waveHeight])

	const flatTrackVisibilityStyle = useAnimatedStyle(() => {
		'worklet'
		const h =
			waveHeight && typeof waveHeight === 'object' && 'value' in waveHeight
				? (waveHeight as SharedValue<number>).value
				: typeof waveHeight === 'number'
					? waveHeight
					: 0
		return {
			opacity: h > 0.1 ? 0 : 1,
		}
	}, [waveHeight])

	const defaultThumbStyle = useAnimatedStyle(() => {
		'worklet'
		const fraction = (localProgress.value - min) / (max - min || 1)
		const clamped = Math.max(0, Math.min(1, fraction))
		const left = clamped * (sliderWidth || 0)
		const h =
			waveHeight && typeof waveHeight === 'object' && 'value' in waveHeight
				? (waveHeight as SharedValue<number>).value
				: typeof waveHeight === 'number'
					? waveHeight
					: 0
		const isWavy = h > 0.1
		const offset = isWavy ? 2 : 7
		const w = isWavy ? 4 : 14
		const height = isWavy ? 18 : 14
		const radius = isWavy ? 2 : 7
		const marginTop = isWavy ? -9 : -7
		return {
			width: w,
			height: height,
			borderRadius: radius,
			marginTop: marginTop,
			transform: [{ translateX: left - offset }, { scale: thumbScale.value }],
		}
	}, [min, max, sliderWidth, localProgress, thumbScale, waveHeight])

	const customThumbStyle = useAnimatedStyle(() => {
		'worklet'
		const fraction = (localProgress.value - min) / (max - min || 1)
		const clamped = Math.max(0, Math.min(1, fraction))
		const left = clamped * (sliderWidth || 0)
		return {
			transform: [
				{ translateX: left - effectiveThumbSize / 2 + effectiveOffsetX },
				{ translateY: effectiveOffsetY },
			],
		}
	}, [
		min,
		max,
		sliderWidth,
		effectiveThumbSize,
		effectiveOffsetX,
		effectiveOffsetY,
		localProgress,
	])

	const normalImgStyle = useAnimatedStyle(() => {
		'worklet'
		const dir = dragDirShared.value
		const showLeft = dir < 0 && hasLeftVariant
		const showRight = dir > 0 && hasRightVariant
		return { opacity: showLeft || showRight ? 0 : 1 }
	}, [hasLeftVariant, hasRightVariant, dragDirShared])

	const leftImgStyle = useAnimatedStyle(() => {
		'worklet'
		return { opacity: dragDirShared.value < 0 && hasLeftVariant ? 1 : 0 }
	}, [hasLeftVariant, dragDirShared])

	const rightImgStyle = useAnimatedStyle(() => {
		'worklet'
		return { opacity: dragDirShared.value > 0 && hasRightVariant ? 1 : 0 }
	}, [hasRightVariant, dragDirShared])

	return createElement(
		View,
		{
			testID: 'player-slider',
			style: [iosSliderStyles.container, style],
			onLayout: handleLayout,
			hitSlop: { top: 15, bottom: 15, left: 0, right: 0 },
			...panResponder.panHandlers,
		},
		// 1. Google Wavy Track Layer (Active when Google 波浪进度条 is ON)
		SvgComponent && PathComponent
			? createElement(
					Animated.View,
					{
						pointerEvents: 'none',
						style: [
							iosSliderStyles.waveTrackContainer,
							waveTrackVisibilityStyle,
						],
					},
					createElement(View, {
						style: [
							iosSliderStyles.inactiveLine,
							{ backgroundColor: inactiveColor },
						],
					}),
					createElement(View, {
						style: [
							iosSliderStyles.endDot,
							{ backgroundColor: inactiveColor },
						],
					}),
					createElement(
						Animated.View,
						{
							style: [
								iosSliderStyles.waveActiveClip,
								activeTrackStyle,
							],
						},
						createElement(
							Animated.View,
							{
								style: [
									{ width: 1350, height: 24 },
									animatedWaveStyle,
								],
							},
							createElement(
								SvgComponent,
								{ width: 1350, height: 24, viewBox: '0 0 1350 24' },
								createElement(PathComponent, {
									d: SINE_WAVE_PATH,
									stroke: activeColor,
									strokeWidth: 3.5,
									strokeLinecap: 'round',
									strokeLinejoin: 'round',
									fill: 'none',
								}),
							),
						),
					),
				)
			: null,
		// 2. Flat Straight Track Layer (Active when Google 波浪进度条 is OFF or scrubbing)
		createElement(
			Animated.View,
			{
				pointerEvents: 'none',
				style: [
					iosSliderStyles.track,
					{ backgroundColor: inactiveColor },
					trackAnimatedStyle,
					flatTrackVisibilityStyle,
				],
			},
			createElement(Animated.View, {
				pointerEvents: 'none',
				style: [
					iosSliderStyles.activeTrack,
					{ backgroundColor: activeColor },
					activeTrackStyle,
				],
			}),
		),
		// 3. Thumb Layer
		hasCustomThumb
			? createElement(
					Animated.View,
					{
						pointerEvents: 'none',
						style: [
							iosSliderStyles.customThumb,
							{
								width: effectiveThumbSize,
								height: effectiveThumbSize,
								marginTop: -effectiveThumbSize / 2,
							},
							customThumbStyle,
						],
					},
					createElement(Animated.Image, {
						source: { uri: normalUri },
						resizeMode: 'contain',
						onError: () => setThumbLoadFailed(true),
						style: [StyleSheet.absoluteFill, normalImgStyle],
					}),
					hasLeftVariant
						? createElement(Animated.Image, {
								source: { uri: leftUri },
								resizeMode: 'contain',
								style: [StyleSheet.absoluteFill, leftImgStyle],
							})
						: null,
					hasRightVariant
						? createElement(Animated.Image, {
								source: { uri: rightUri },
								resizeMode: 'contain',
								style: [StyleSheet.absoluteFill, rightImgStyle],
							})
						: null,
				)
			: createElement(Animated.View, {
					pointerEvents: 'none',
					style: [
						iosSliderStyles.thumb,
						{ backgroundColor: thumbColor },
						defaultThumbStyle,
					],
				}),
	)
}

const iosSliderStyles = StyleSheet.create({
	container: { height: 32, justifyContent: 'center', overflow: 'visible' },
	track: { position: 'absolute', left: 0, right: 0, borderRadius: 2, overflow: 'hidden' },
	activeTrack: { position: 'absolute', left: 0, top: 0, bottom: 0 },
	waveTrackContainer: {
		position: 'absolute',
		left: 0,
		right: 0,
		height: 24,
		justifyContent: 'center',
		overflow: 'hidden',
	},
	inactiveLine: {
		position: 'absolute',
		left: 0,
		right: 4,
		height: 3,
		borderRadius: 1.5,
	},
	endDot: {
		position: 'absolute',
		right: 0,
		width: 4,
		height: 4,
		borderRadius: 2,
	},
	waveActiveClip: {
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 0,
		overflow: 'hidden',
	},
	thumb: {
		position: 'absolute',
		top: '50%',
		left: 0,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.3,
		shadowRadius: 2,
	},
	customThumb: {
		position: 'absolute',
		top: '50%',
		left: 0,
		overflow: 'visible',
	},
})
