import { useIsPlaying } from '@bbplayer/orpheus'
import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import Color from 'color'
import { WavySlider } from 'expo-wavy-slider'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	Image,
	PanResponder,
	Platform,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from 'react-native'
import AnimateableText from 'react-native-animateable-text'
import { useTheme } from 'react-native-paper'
import Animated, {
	Easing,
	cancelAnimation,
	useAnimatedProps,
	useAnimatedReaction,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withRepeat,
	withTiming,
	type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import IconButton from '@/components/common/IconButton'
import { usePlayerChapters } from '@/features/player/hooks/usePlayerChapters'
import {
	chapterIndexAt,
	chapterBoundaryIndex,
	chapterBoundaries,
} from '@/features/player/utils/chapters'
import useCurrentTrackId from '@/hooks/player/useCurrentTrackId'
import useSmoothProgress from '@/hooks/player/useSmoothProgress'
import useTrackDuration from '@/hooks/player/useTrackProgress'
import useAppStore from '@/hooks/stores/useAppStore'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { seekWithinTrack } from '@/lib/player/seek'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'

function TextWithAnimation({
	sharedPosition,
	sharedDuration,
}: {
	sharedPosition: SharedValue<number>
	sharedDuration: SharedValue<number>
}) {
	const { colors, fonts } = useTheme()

	const positionText = useSharedValue('00:00')
	const durationText = useSharedValue('00:00')

	useAnimatedReaction(
		() => (sharedPosition.value ? Math.trunc(sharedPosition.value) : 0),
		(pos, prev) => {
			if (pos !== prev) {
				positionText.set(formatDurationToHHMMSS(pos))
			}
		},
	)

	useAnimatedReaction(
		() => (sharedDuration.value ? Math.trunc(sharedDuration.value) : 0),
		(dur, prev) => {
			if (dur !== prev) {
				durationText.set(formatDurationToHHMMSS(dur))
			}
		},
	)

	const textStyle = useMemo(
		() => ({
			...fonts.bodySmall,
			color: colors.onSurfaceVariant,
			fontVariant: ['tabular-nums'],
			includeFontPadding: false,
		}),
		[colors.onSurfaceVariant, fonts.bodySmall],
	)
	const positionTextProp = useAnimatedProps(() => {
		return {
			text: positionText.value,
		}
	})
	const durationTextProp = useAnimatedProps(() => {
		return {
			text: durationText.value,
		}
	})

	return (
		<>
			<AnimateableText
				numberOfLines={1}
				adjustsFontSizeToFit
				style={textStyle}
				animatedProps={positionTextProp}
			/>
			<AnimateableText
				numberOfLines={1}
				adjustsFontSizeToFit
				style={textStyle}
				animatedProps={durationTextProp}
			/>
		</>
	)
}

interface PlayerSliderProps {
	onInteraction?: () => void
	onDragStateChange?: (dragging: boolean) => void
}

function IOSSlider({
	enabled,
	progress,
	colors,
	waveHeight,
	waveThickness,
	trackThickness,
	isPlaying,
	chapterMarkers = [],
	thumbImageUri,
	thumbImageDragLeftUri: _thumbImageDragLeftUri,
	thumbImageDragRightUri: _thumbImageDragRightUri,
	thumbImageSize = 32,
	thumbImageOffsetX = 0,
	thumbImageOffsetY = 0,
	onValueChange,
	onValueChangeFinished,
	onDragStateChange,
	style,
}: {
	enabled: boolean
	progress: SharedValue<number>
	colors: {
		activeTrackColor: string
		inactiveTrackColor: string
		thumbColor: string
		activeTickColor?: string
		inactiveTickColor?: string
	}
	waveHeight: SharedValue<number>
	waveThickness: SharedValue<number>
	trackThickness: SharedValue<number>
	isPlaying: boolean
	chapterMarkers?: number[]
	thumbImageUri?: string
	thumbImageDragLeftUri?: string
	thumbImageDragRightUri?: string
	thumbImageSize?: number
	thumbImageOffsetX?: number
	thumbImageOffsetY?: number
	onValueChange: (value: number) => void
	onValueChangeFinished: (value: number) => void
	onDragStateChange: (dragging: boolean) => void
	style?: StyleProp<ViewStyle>
}) {
	const [trackWidth, setTrackWidth] = useState(0)
	const widthShared = useSharedValue(0)
	const isDraggingRef = useRef(false)
	const trackPageXRef = useRef(0)
	const trackRef = useRef<View>(null)
	const isDraggingShared = useSharedValue(false)
	const dragDeltaShared = useSharedValue(0)
	const phase = useSharedValue(0)

	useEffect(() => {
		if (isPlaying) {
			phase.set(0)
			phase.set(
				withRepeat(
					withTiming(30, {
						duration: 2000,
						easing: Easing.linear,
					}),
					-1,
					false,
				),
			)
		} else {
			cancelAnimation(phase)
		}
	}, [isPlaying, phase])

	const panResponder = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => enabled,
				onMoveShouldSetPanResponder: (_, gs) => enabled && Math.abs(gs.dx) > 2,
				onPanResponderGrant: (evt) => {
					isDraggingRef.current = true
					isDraggingShared.set(true)
					onDragStateChange(true)
					trackRef.current?.measure((_x, _y, width, _height, pageX) => {
						if (width > 0) {
							trackPageXRef.current = pageX
							const currentX = evt.nativeEvent.pageX - pageX
							const fraction = Math.max(0, Math.min(1, currentX / width))
							onValueChange(fraction)
						}
					})
				},
				onPanResponderMove: (evt) => {
					if (!isDraggingRef.current || trackWidth <= 0) return
					const currentX = evt.nativeEvent.pageX - trackPageXRef.current
					const fraction = Math.max(0, Math.min(1, currentX / trackWidth))
					dragDeltaShared.set(fraction - (progress.value || 0))
					onValueChange(fraction)
				},
				onPanResponderRelease: (evt) => {
					isDraggingRef.current = false
					isDraggingShared.set(false)
					dragDeltaShared.set(0)
					if (trackWidth > 0) {
						const currentX = evt.nativeEvent.pageX - trackPageXRef.current
						const fraction = Math.max(0, Math.min(1, currentX / trackWidth))
						onValueChangeFinished(fraction)
					}
					onDragStateChange(false)
				},
				onPanResponderTerminate: () => {
					isDraggingRef.current = false
					isDraggingShared.set(false)
					dragDeltaShared.set(0)
					onDragStateChange(false)
				},
			}),
		[
			enabled,
			trackWidth,
			onDragStateChange,
			onValueChange,
			onValueChangeFinished,
			isDraggingShared,
			dragDeltaShared,
			progress,
		],
	)

	const activeWavePath = useDerivedValue(() => {
		const w = widthShared.value
		const path = Skia.Path.Make()
		if (w <= 0) return path

		const p = Math.max(0, Math.min(1, progress.value || 0))
		const thumbX = p * w
		const centerY = 14
		const h = waveHeight.value
		const ph = phase.value

		if (thumbX <= 0) return path

		path.moveTo(0, centerY)

		// 振幅极小或游标极靠起点时平滑收缩为直线
		if (h < 0.2 || thumbX < 4) {
			path.lineTo(thumbX, centerY)
			return path
		}

		// Google Material 3 经典波浪正弦曲线，波长为 30px，相位朝游标方向行进
		const step = 2
		const transitionZone = 16
		for (let x = step; x < thumbX; x += step) {
			const leadIn = Math.min(1, x / transitionZone)
			const leadOut = Math.min(1, (thumbX - x) / transitionZone)
			const envelope = leadIn * leadOut
			const y =
				centerY +
				h * envelope * Math.sin((2 * Math.PI * (x - ph)) / 30)
			path.lineTo(x, y)
		}
		path.lineTo(thumbX, centerY)

		return path
	})

	const inactiveTrackPath = useDerivedValue(() => {
		const w = widthShared.value
		const path = Skia.Path.Make()
		if (w <= 0) return path

		const p = Math.max(0, Math.min(1, progress.value || 0))
		const thumbX = p * w
		const centerY = 14

		if (thumbX < w) {
			path.moveTo(thumbX, centerY)
			path.lineTo(w, centerY)
		}

		return path
	})

	const ticksPath = useDerivedValue(() => {
		const w = widthShared.value
		const path = Skia.Path.Make()
		if (w <= 0 || !chapterMarkers || chapterMarkers.length === 0) return path

		const centerY = 14
		const tickH = isDraggingShared.value ? 6 : 3

		for (let i = 0; i < chapterMarkers.length; i++) {
			const fraction = chapterMarkers[i]
			if (fraction > 0 && fraction < 1) {
				const x = fraction * w
				path.moveTo(x, centerY - tickH)
				path.lineTo(x, centerY + tickH)
			}
		}

		return path
	})

	const thumbAnimatedStyle = useAnimatedStyle(() => {
		const p = Math.max(0, Math.min(1, progress.value || 0))
		return {
			left: `${p * 100}%`,
			transform: [
				{ translateX: -8 },
				{ scale: isDraggingShared.value ? 1.35 : 1 },
			],
		}
	})

	const activeThumbUri = useMemo(() => {
		return thumbImageUri
	}, [thumbImageUri])

	return (
		<View
			ref={trackRef}
			style={[styles.iosSliderContainer, style]}
			onLayout={(e) => {
				const w = e.nativeEvent.layout.width
				if (w > 0) {
					setTrackWidth(w)
					widthShared.set(w)
				}
				trackRef.current?.measure((_x, _y, _width, _height, pageX) => {
					if (pageX) trackPageXRef.current = pageX
				})
			}}
			{...panResponder.panHandlers}
		>
			<Canvas
				style={styles.skiaCanvas}
				pointerEvents='none'
			>
				<Path
					path={inactiveTrackPath}
					color={colors.inactiveTrackColor}
					style='stroke'
					strokeWidth={trackThickness}
					strokeCap='round'
					strokeJoin='round'
				/>
				<Path
					path={activeWavePath}
					color={colors.activeTrackColor}
					style='stroke'
					strokeWidth={waveThickness}
					strokeCap='round'
					strokeJoin='round'
				/>
				{chapterMarkers.length > 0 && (
					<Path
						path={ticksPath}
						color={colors.activeTickColor || colors.activeTrackColor}
						style='stroke'
						strokeWidth={2}
						strokeCap='round'
					/>
				)}
			</Canvas>

			<Animated.View
				style={[styles.iosThumbWrapper, thumbAnimatedStyle]}
				pointerEvents='none'
			>
				{activeThumbUri ? (
					<Image
						source={{ uri: activeThumbUri }}
						style={{
							width: thumbImageSize,
							height: thumbImageSize,
							transform: [
								{ translateX: thumbImageOffsetX },
								{ translateY: thumbImageOffsetY },
							],
						}}
						resizeMode='contain'
					/>
				) : (
					<View
						style={[
							styles.iosThumb,
							{ backgroundColor: colors.thumbColor },
						]}
					/>
				)}
			</Animated.View>
		</View>
	)
}

export function PlayerSlider({
	onInteraction,
	onDragStateChange: externalDragStateChange,
}: PlayerSliderProps = {}) {
	const trackId = useCurrentTrackId()
	const nativeDuration = useTrackDuration()
	const { chapters, podcast } = usePlayerChapters()
	const canSeek = Number.isFinite(nativeDuration) && nativeDuration > 0
	const markers = useMemo(
		() => (podcast ? chapterBoundaries(chapters, nativeDuration) : []),
		[chapters, nativeDuration, podcast],
	)
	const { colors } = useTheme()
	const pureWhiteBackground = useAppStore(
		(state) => state.settings.pureWhiteBackground,
	)
	const activeSkin = useActiveSkin()
	const skinSliderThumbSize = useSkinStore(
		(state) => state.skinSliderThumbSize ?? 20,
	)
	const skinSliderThumbOffsetX = useSkinStore(
		(state) => state.skinSliderThumbOffsetX ?? 0,
	)
	const skinSliderThumbOffsetY = useSkinStore(
		(state) => state.skinSliderThumbOffsetY ?? 0,
	)
	const activePlayIconIndex = useSkinStore((state) => state.activePlayIconIndex)
	const { position, duration, buffered } = useSmoothProgress()
	const isPlaying = useIsPlaying()

	const isScrubbing = useSharedValue(false)
	const scrubPosition = useSharedValue(0)
	const isSeeking = useSharedValue(false)
	const seekPosition = useSharedValue(0)
	const isPlayingShared = useSharedValue(isPlaying)
	const isNativeDragging = useSharedValue(false)
	const animatedWaveHeight = useSharedValue(isPlaying ? 6 : 0)
	const animatedWaveVelocity = useSharedValue(isPlaying ? 15 : 0)
	const animatedWaveThickness = useSharedValue(3)
	const animatedTrackThickness = useSharedValue(3)
	const lastChapterHaptic = useSharedValue(0)

	useEffect(() => {
		isPlayingShared.set(isPlaying)
	}, [isPlaying, isPlayingShared])

	const handleSeek = useCallback(
		async (time: number, relative = false) => {
			if (!trackId) return
			try {
				const target = await seekWithinTrack(trackId, time, relative)
				if (target !== null) {
					position.set(target)
					seekPosition.set(target)
				}
				isSeeking.set(false)
			} catch (error) {
				toastAndLogError('跳转失败', error, 'Player.Slider')
				isSeeking.set(false)
			}
		},
		[trackId, position, seekPosition, isSeeking],
	)

	useEffect(() => {
		isScrubbing.set(false)
		isSeeking.set(false)
		isNativeDragging.set(false)
	}, [trackId, isScrubbing, isSeeking, isNativeDragging])

	const displayPosition = useDerivedValue(() => {
		if (isScrubbing.value) return scrubPosition.value
		if (isSeeking.value) return seekPosition.value
		return position.value
	})

	const chapterPreviewProps = useAnimatedProps(() => {
		const time = displayPosition.value
		const chapter = chapters[chapterIndexAt(chapters, time)]
		return {
			text: chapter?.title ?? '',
		}
	})

	useAnimatedReaction(
		() => position.value,
		(currentPosition) => {
			if (!isSeeking.value) return
			const target = seekPosition.value
			const threshold = 1
			const diff = Math.abs(currentPosition - target)
			if (diff < threshold) {
				isSeeking.set(false)
			}
		},
		[position, isSeeking, seekPosition],
	)

	useAnimatedReaction(
		() =>
			[
				isPlayingShared.value,
				isNativeDragging.value || isScrubbing.value,
			] as const,
		([playing, dragging]) => {
			const shouldShowWave = playing && !dragging
			const thickness = dragging ? 12 : 3
			animatedWaveHeight.set(
				withTiming(shouldShowWave ? 6 : 0, { duration: dragging ? 100 : 300 }),
			)
			animatedWaveVelocity.set(
				withTiming(playing ? 15 : 0, { duration: playing ? 150 : 100 }),
			)
			animatedWaveThickness.set(withTiming(thickness, { duration: 200 }))
			animatedTrackThickness.set(withTiming(thickness, { duration: 200 }))
		},
		[
			animatedTrackThickness,
			animatedWaveHeight,
			animatedWaveThickness,
			animatedWaveVelocity,
			isNativeDragging,
			isScrubbing,
			isPlayingShared,
		],
	)

	const progressFraction = useDerivedValue(() => {
		const dur = duration.value || 1
		let pos = position.value
		if (isScrubbing.value) {
			pos = scrubPosition.value
		} else if (isSeeking.value) {
			pos = seekPosition.value
		}
		return Math.min(Math.max(pos / dur, 0), 1)
	})

	// oxlint-disable-next-line no-underscore-dangle
	const _bufferedFraction = useDerivedValue(() => {
		const dur = duration.value || 1
		return Math.min(Math.max(buffered.value / dur, 0), 1)
	})

	const handleValueChange = useCallback(
		(value: number) => {
			'worklet'
			const wasScrubbing = isScrubbing.value
			const previousFraction = scrubPosition.value / (duration.value || 1)
			isScrubbing.set(true)
			scrubPosition.set(value * (duration.value || 1))
			if (
				podcast &&
				wasScrubbing &&
				chapterBoundaryIndex(markers, value) !==
					chapterBoundaryIndex(markers, previousFraction)
			) {
				const now = Date.now()
				if (now - lastChapterHaptic.value >= 80) {
					lastChapterHaptic.set(now)
					scheduleOnRN(
						Haptics.performHaptics,
						Haptics.AndroidHaptics.Clock_Tick,
					)
				}
			}

			if (!wasScrubbing) {
				scheduleOnRN(Haptics.performHaptics, Haptics.AndroidHaptics.Drag_Start)
			}
			if (onInteraction) {
				scheduleOnRN(onInteraction)
			}
		},
		[
			duration,
			isScrubbing,
			onInteraction,
			scrubPosition,
			markers,
			podcast,
			lastChapterHaptic,
		],
	)

	const handleValueChangeFinished = useCallback(
		(value: number) => {
			'worklet'
			const targetTime = value * (duration.value || 1)

			seekPosition.set(targetTime)
			isSeeking.set(true)
			isScrubbing.set(false)
			scheduleOnRN(handleSeek, targetTime)
			scheduleOnRN(Haptics.performHaptics, Haptics.AndroidHaptics.Gesture_End)
			if (onInteraction) {
				scheduleOnRN(onInteraction)
			}
		},
		[duration, isScrubbing, isSeeking, onInteraction, seekPosition, handleSeek],
	)

	const handleDragStateChange = useCallback(
		(dragging: boolean) => {
			'worklet'
			isNativeDragging.set(dragging)
			if (!dragging) isScrubbing.set(false)
			if (externalDragStateChange) {
				scheduleOnRN(externalDragStateChange, dragging)
			}
		},
		[isNativeDragging, isScrubbing, externalDragStateChange],
	)

	const sliderColors = useMemo(
		() => ({
			activeTrackColor: colors.primary,
			bufferedTrackColor: Color(colors.primary).alpha(0.28).rgb().string(),
			inactiveTrackColor: pureWhiteBackground
				? colors.outlineVariant
				: colors.surfaceVariant,
			thumbColor: colors.primary,
			activeTickColor: colors.onSurface,
			inactiveTickColor: colors.onSurface,
		}),
		[
			colors.primary,
			colors.surfaceVariant,
			colors.onSurface,
			colors.outlineVariant,
			pureWhiteBackground,
		],
	)
	const sliderThumb = activeSkin?.sliderThumbs[activePlayIconIndex]
	const hasSkinSliderThumb = Boolean(sliderThumb?.normal)

	return (
		<View style={styles.root}>
			{podcast && (
				<AnimateableText
					numberOfLines={1}
					animatedProps={chapterPreviewProps}
					style={{
						color: colors.onSurfaceVariant,
						height: 24,
						textAlign: 'center',
						marginBottom: 8,
					}}
				/>
			)}
			<View style={podcast ? styles.podcastSliderRow : undefined}>
				{podcast && (
					<IconButton
						icon='rewind-15'
						accessibilityLabel='后退 15 秒'
						disabled={!canSeek}
						style={styles.seekButton}
						onPress={() => {
							void handleSeek(-15, true)
						}}
					/>
				)}
				{Platform.OS === 'android' ? (
					<WavySlider
						style={podcast ? styles.podcastSlider : styles.slider}
						enabled={canSeek}
						chapterMarkers={markers}
						progress={progressFraction}
						// bufferedProgress={bufferedFraction} 缓冲进度条在使用自定义 slider 时会出现一些样式问题，懒得修复了，反正音乐播放器不是很需要这个东西。
						colors={sliderColors}
						waveLength={30}
						waveVelocity={animatedWaveVelocity}
						waveDirection='head'
						waveHeight={animatedWaveHeight}
						waveThickness={animatedWaveThickness}
						trackThickness={animatedTrackThickness}
						thumbImageUri={sliderThumb?.normal}
						thumbImageDragLeftUri={sliderThumb?.dragLeft}
						thumbImageDragRightUri={sliderThumb?.dragRight}
						thumbImageSize={hasSkinSliderThumb ? skinSliderThumbSize : undefined}
						thumbImageOffsetX={
							hasSkinSliderThumb ? skinSliderThumbOffsetX : undefined
						}
						thumbImageOffsetY={
							hasSkinSliderThumb ? skinSliderThumbOffsetY : undefined
						}
						incremental={false}
						onValueChange={handleValueChange}
						onValueChangeFinished={handleValueChangeFinished}
						onDragStateChange={handleDragStateChange}
					/>
				) : (
					<IOSSlider
						enabled={canSeek}
						progress={progressFraction}
						colors={sliderColors}
						waveHeight={animatedWaveHeight}
						waveThickness={animatedWaveThickness}
						trackThickness={animatedTrackThickness}
						isPlaying={isPlaying}
						chapterMarkers={markers}
						thumbImageUri={sliderThumb?.normal}
						thumbImageDragLeftUri={sliderThumb?.dragLeft}
						thumbImageDragRightUri={sliderThumb?.dragRight}
						thumbImageSize={hasSkinSliderThumb ? skinSliderThumbSize : undefined}
						thumbImageOffsetX={
							hasSkinSliderThumb ? skinSliderThumbOffsetX : undefined
						}
						thumbImageOffsetY={
							hasSkinSliderThumb ? skinSliderThumbOffsetY : undefined
						}
						onValueChange={handleValueChange}
						onValueChangeFinished={handleValueChangeFinished}
						onDragStateChange={handleDragStateChange}
						style={podcast ? styles.podcastSlider : styles.slider}
					/>
				)}

				{podcast && (
					<IconButton
						icon='fast-forward-15'
						accessibilityLabel='前进 15 秒'
						disabled={!canSeek}
						style={styles.seekButton}
						onPress={() => {
							void handleSeek(15, true)
						}}
					/>
				)}
			</View>
			<View style={styles.timeContainer}>
				<TextWithAnimation
					sharedPosition={displayPosition}
					sharedDuration={duration}
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	podcastSliderRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
	podcastSlider: { flex: 1, height: 28 },
	seekButton: { width: 48, height: 48, margin: 0 },
	root: {
		width: '100%',
		justifyContent: 'center',
	},
	slider: {
		height: 28,
		width: '90%',
		alignSelf: 'center',
	},
	timeContainer: {
		marginTop: 4,
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '90%',
		alignSelf: 'center',
	},
	iosSliderContainer: {
		height: 28,
		width: '90%',
		alignSelf: 'center',
		justifyContent: 'center',
		position: 'relative',
	},
	skiaCanvas: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		height: 28,
	},
	iosThumbWrapper: {
		position: 'absolute',
		top: 6,
		width: 16,
		height: 16,
		justifyContent: 'center',
		alignItems: 'center',
		overflow: 'visible',
	},
	iosThumb: {
		width: 16,
		height: 16,
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3,
		elevation: 3,
	},
})
