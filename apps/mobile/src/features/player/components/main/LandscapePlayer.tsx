import {
	Orpheus,
	RepeatMode,
	type Track as OrpheusTrack,
} from '@bbplayer/orpheus'
import { Computed, Show } from '@legendapp/state/react'
import { Image, type ImageRef } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import {
	type ComponentProps,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from 'react'
import {
	type LayoutChangeEvent,
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import PagerView from 'react-native-pager-view'
import { Text } from 'react-native-paper'
import Animated, {
	createAnimatedComponent,
	Easing,
	Extrapolation,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { PlayerCommentsCard } from '@/features/player/components/comments/PlayerCommentsCard'
import { PlayerControls } from '@/features/player/components/controls/PlayerControls'
import Lyrics from '@/features/player/components/lyrics/PlayerLyrics'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { usePlaybackOptions } from '@/hooks/player/usePlaybackOptions'
import {
	playbackContextStore$,
	playerSliderDragging$,
} from '@/hooks/stores/playbackContextStore'
import useAppStore from '@/hooks/stores/useAppStore'
import { usePlayerCommentsStore } from '@/hooks/stores/usePlayerCommentsStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { usePlayerQueueStore } from '@/hooks/stores/usePlayerQueueStore'
import { analyticsService } from '@/lib/services/analyticsService'
import {
	SQUIRCLE_CORNER_SMOOTHING,
	SQUIRCLE_RADIUS_RATIO,
} from '@/theme/dimensions'
import { getGradientColors } from '@/utils/color'
import * as Haptics from '@/utils/haptics'
import { resolveBilibiliImageUrl, resolveTrackCover } from '@/utils/imageUrl'

import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'

const AnimatedPagerView = createAnimatedComponent(PagerView)

let lastLandscapeSkipTimestamp = 0

function tryAcquireLandscapeSkipLock(cooldownMs = 450): boolean {
	const now = Date.now()
	if (now - lastLandscapeSkipTimestamp < cooldownMs) return false
	lastLandscapeSkipTimestamp = now
	return true
}

function LandscapeCoverPreview({
	track,
	coverSize,
	isPodcast,
}: {
	track: OrpheusTrack | null
	coverSize: number
	isPodcast: boolean
}) {
	const isDark = useColorScheme() === 'dark'
	if (!track) return null

	const coverRadius = isPodcast
		? coverSize * SQUIRCLE_RADIUS_RATIO
		: coverSize / 2
	const rawCover = track.artwork ?? ''
	const coverUri = resolveBilibiliImageUrl(
		resolveTrackCover(track.id, rawCover) ?? rawCover,
	)
	const { color1, color2 } = getGradientColors(track.title ?? '', isDark)
	const firstChar =
		track.title && track.title.length > 0
			? track.title.charAt(0).toUpperCase()
			: undefined

	return (
		<View style={styles.coverPreviewSlot}>
			<SquircleView
				style={{
					width: coverSize,
					height: coverSize,
					borderRadius: coverRadius,
					overflow: 'hidden',
				}}
				cornerSmoothing={SQUIRCLE_CORNER_SMOOTHING}
			>
				{coverUri ? (
					<Image
						source={{ uri: coverUri }}
						style={{
							width: coverSize,
							height: coverSize,
							borderRadius: coverRadius,
						}}
						contentFit='cover'
						cachePolicy='memory-disk'
					/>
				) : (
					<LinearGradient
						colors={[color1, color2]}
						style={[styles.fallbackCover, { borderRadius: coverRadius }]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
					>
						<Text
							style={[
								styles.coverPlaceholderText,
								{ fontSize: coverSize * 0.45 },
							]}
						>
							{firstChar}
						</Text>
					</LinearGradient>
				)}
			</SquircleView>
		</View>
	)
}

export function LandscapePlayer({
	pagerRef,
	index,
	setIndex,
	jumpTo,
	imageRef,
	onPageScroll,
}: {
	pagerRef: RefObject<PagerView | null>
	index: number
	setIndex: (i: number) => void
	jumpTo: (key: string) => void
	imageRef: ImageRef | null
	onPageScroll: ComponentProps<typeof AnimatedPagerView>['onPageScroll']
}) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const activeTrackKey = currentTrack?.uniqueKey
	const { width, height } = useWindowDimensions()
	const [isScrubbing, setIsScrubbing] = useState(false)

	const enableSwipeToSwitchTrack = useAppStore(
		(state) => state.settings.enableSwipeToSwitchTrack ?? true,
	)
	const enableSwipeToOpenComments = useAppStore(
		(state) => state.settings.enableSwipeToOpenComments ?? true,
	)
	const isCommentsOpen = usePlayerCommentsStore((state) => state.isOpen)

	const bvid =
		currentTrack?.source === 'bilibili'
			? currentTrack.bilibiliMetadata.bvid
			: undefined

	const queueTracks = usePlayerQueueStore((state) => state.tracks)
	const { repeat: repeatMode } = usePlaybackOptions()

	const currentIndex = useMemo(() => {
		if (!activeTrackKey) return -1
		return queueTracks.findIndex((t) => t.id === activeTrackKey)
	}, [activeTrackKey, queueTracks])

	const nextTrack = useMemo(() => {
		if (currentIndex < 0 || queueTracks.length === 0) return null
		if (currentIndex + 1 < queueTracks.length) {
			return queueTracks[currentIndex + 1]
		}
		if (repeatMode === RepeatMode.QUEUE && queueTracks.length > 1) {
			return queueTracks[0]
		}
		return null
	}, [currentIndex, queueTracks, repeatMode])

	const prevTrack = useMemo(() => {
		if (currentIndex < 0 || queueTracks.length === 0) return null
		if (currentIndex > 0) {
			return queueTracks[currentIndex - 1]
		}
		if (repeatMode === RepeatMode.QUEUE && queueTracks.length > 1) {
			return queueTracks[queueTracks.length - 1]
		}
		return null
	}, [currentIndex, queueTracks, repeatMode])

	const [frozenNextTrack, setFrozenNextTrack] = useState<OrpheusTrack | null>(
		null,
	)
	const [frozenPrevTrack, setFrozenPrevTrack] = useState<OrpheusTrack | null>(
		null,
	)
	const [isSwitchingTrack, setIsSwitchingTrack] = useState(false)
	const [settledTrackKey, setSettledTrackKey] = useState(activeTrackKey)

	const estimatedViewportH = Math.max(
		1,
		height - insets.top - 52 - Math.max(insets.bottom, 8),
	)
	const [leftViewportHeight, setLeftViewportHeight] =
		useState(estimatedViewportH)
	const viewportHeightSV = useSharedValue(estimatedViewportH)

	const handleLeftLayout = useCallback(
		(e: LayoutChangeEvent) => {
			const h = e.nativeEvent.layout.height
			if (h > 0) {
				viewportHeightSV.set(h)
				setLeftViewportHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev))
			}
		},
		[viewportHeightSV],
	)

	const swipeTranslateY = useSharedValue(0)
	const isTransitioning = useSharedValue(false)
	const coverSwitchFade = useSharedValue(1)

	useLayoutEffect(() => {
		if (settledTrackKey === activeTrackKey) return
		setSettledTrackKey(activeTrackKey)
		if (!isSwitchingTrack) return
		setIsSwitchingTrack(false)
		setFrozenNextTrack(null)
		setFrozenPrevTrack(null)
		swipeTranslateY.set(0)
		isTransitioning.set(false)
		coverSwitchFade.set(0.38)
		coverSwitchFade.set(
			withTiming(1, {
				duration: 280,
				easing: Easing.out(Easing.cubic),
			}),
		)
	}, [
		activeTrackKey,
		settledTrackKey,
		isSwitchingTrack,
		swipeTranslateY,
		isTransitioning,
		coverSwitchFade,
	])

	useEffect(() => {
		if (!isSwitchingTrack) return
		const timer = setTimeout(() => {
			setIsSwitchingTrack(false)
			setFrozenNextTrack(null)
			setFrozenPrevTrack(null)
			swipeTranslateY.set(0)
			isTransitioning.set(false)
			coverSwitchFade.set(1)
		}, 900)
		return () => clearTimeout(timer)
	}, [isSwitchingTrack, swipeTranslateY, isTransitioning, coverSwitchFade])

	const handleSkipNext = useCallback(() => {
		if (!tryAcquireLandscapeSkipLock()) return
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		void Orpheus.skipToNext()
		void analyticsService.logPlayerAction('skip_next')
	}, [])

	const handleSkipPrevious = useCallback(() => {
		if (!tryAcquireLandscapeSkipLock()) return
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		void Orpheus.skipToPrevious()
		void analyticsService.logPlayerAction('skip_prev')
	}, [])

	const triggerSkipNext = useCallback(() => {
		setIsSwitchingTrack(true)
		setFrozenNextTrack(nextTrack)
		handleSkipNext()
	}, [nextTrack, handleSkipNext])

	const triggerSkipPrevious = useCallback(() => {
		setIsSwitchingTrack(true)
		setFrozenPrevTrack(prevTrack)
		handleSkipPrevious()
	}, [prevTrack, handleSkipPrevious])

	const displayNextTrack = frozenNextTrack ?? nextTrack
	const displayPrevTrack = frozenPrevTrack ?? prevTrack
	const hasNext = Boolean(displayNextTrack)
	const hasPrev = Boolean(displayPrevTrack)

	const swipeTrackGesture = useMemo(() => {
		return Gesture.Pan()
			.enabled(enableSwipeToSwitchTrack && !isScrubbing)
			.activeOffsetY([-20, 20])
			.failOffsetX([-25, 25])
			.onUpdate((e) => {
				'worklet'
				if (isTransitioning.value) return
				if (e.translationY < 0) {
					swipeTranslateY.set(hasNext ? e.translationY : e.translationY * 0.25)
				} else {
					swipeTranslateY.set(hasPrev ? e.translationY : e.translationY * 0.25)
				}
			})
			.onEnd((e) => {
				'worklet'
				if (isTransitioning.value) return
				const threshold = 60
				const velocityThreshold = 420
				const targetDistance = Math.max(1, viewportHeightSV.value)

				if (
					(e.translationY < -threshold ||
						(e.translationY < -20 && e.velocityY < -velocityThreshold)) &&
					hasNext
				) {
					isTransitioning.set(true)
					swipeTranslateY.set(
						withTiming(
							-targetDistance,
							{ duration: 220, easing: Easing.out(Easing.cubic) },
							(finished) => {
								if (finished) {
									scheduleOnRN(triggerSkipNext)
								}
							},
						),
					)
				} else if (
					(e.translationY > threshold ||
						(e.translationY > 20 && e.velocityY > velocityThreshold)) &&
					hasPrev
				) {
					isTransitioning.set(true)
					swipeTranslateY.set(
						withTiming(
							targetDistance,
							{ duration: 220, easing: Easing.out(Easing.cubic) },
							(finished) => {
								if (finished) {
									scheduleOnRN(triggerSkipPrevious)
								}
							},
						),
					)
				} else {
					swipeTranslateY.set(withSpring(0, { damping: 16, stiffness: 160 }))
				}
			})
			.onFinalize(() => {
				'worklet'
				if (!isTransitioning.value) {
					swipeTranslateY.set(withSpring(0, { damping: 16, stiffness: 160 }))
				}
			})
	}, [
		enableSwipeToSwitchTrack,
		isScrubbing,
		hasNext,
		hasPrev,
		viewportHeightSV,
		triggerSkipNext,
		triggerSkipPrevious,
		swipeTranslateY,
		isTransitioning,
	])

	const handleOpenCommentsCard = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		usePlayerCommentsStore.getState().open()
	}, [])

	const bottomCommentsGesture = useMemo(() => {
		return Gesture.Pan()
			.enabled(enableSwipeToOpenComments && !isScrubbing)
			.activeOffsetY([-15, 15])
			.failOffsetX([-25, 25])
			.onEnd((e) => {
				'worklet'
				if (
					e.translationY < -30 ||
					(e.translationY < -15 && e.velocityY < -350)
				) {
					scheduleOnRN(handleOpenCommentsCard)
				}
			})
	}, [enableSwipeToOpenComments, isScrubbing, handleOpenCommentsCard])

	// 进入横屏平滑动画
	const p = useSharedValue(1)
	useEffect(() => {
		p.set(0)
		p.set(
			withTiming(1, {
				duration: 480,
				easing: Easing.bezier(0.2, 0.8, 0.2, 1),
			}),
		)
	}, [p])

	const coverStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateY: swipeTranslateY.value },
			{ scale: 0.94 + 0.06 * p.value },
		],
		opacity: 0.5 + 0.5 * p.value,
	}))

	const outgoingCoverFadeStyle = useAnimatedStyle(() => {
		const vh = Math.max(1, viewportHeightSV.value)
		const dragFade = interpolate(
			Math.abs(swipeTranslateY.value),
			[0, vh * 0.65],
			[1, 0],
			Extrapolation.CLAMP,
		)
		return {
			opacity: coverSwitchFade.value * dragFade,
		}
	})

	const incomingCoverSlideStyle = useAnimatedStyle(() => {
		const vh = Math.max(1, viewportHeightSV.value)
		return {
			transform: [{ translateY: swipeTranslateY.value }],
			opacity: interpolate(
				Math.abs(swipeTranslateY.value),
				[0, vh],
				[0, 0.55],
				Extrapolation.CLAMP,
			),
		}
	})

	const rightStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: 50 * (1 - p.value) }],
		opacity: 0.6 + 0.4 * p.value,
	}))

	if (!currentTrack) return null
	const isTabletScreen = Math.min(width, height) >= 600
	const padL = Math.max(insets.left, isTabletScreen ? 40 : 24)
	const padR = Math.max(insets.right, isTabletScreen ? 40 : 24)

	const availHeight = height - insets.top - 52 - Math.max(insets.bottom, 12)
	const availWidth = (width - padL - padR - (isTabletScreen ? 44 : 28)) * 0.44
	const maxCoverCap = isTabletScreen ? 430 : 340
	const coverSize = Math.floor(
		Math.min(availWidth, availHeight * 0.92, maxCoverCap),
	)
	const isPodcast = playbackContextStore$.context.mode.peek() === 'podcast'

	return (
		<Show if={playbackContextStore$.ready}>
			<View
				style={[
					styles.row,
					{
						paddingLeft: padL,
						paddingRight: padR,
						paddingBottom: Math.max(insets.bottom, 8),
						gap: isTabletScreen ? 36 : 20,
					},
				]}
			>
				{/* 左侧封面居中常驻展示，支持上下滑切歌 */}
				<GestureDetector gesture={swipeTrackGesture}>
					<View
						style={styles.left}
						onLayout={handleLeftLayout}
					>
						<Animated.View style={[styles.leftInner, coverStyle]}>
							<TrackInfo
								part='cover'
								coverMaxSize={coverSize}
								onArtistPress={() => void 0}
								onPressCover={() => {
									void Haptics.performHaptics(
										Haptics.AndroidHaptics.Context_Click,
									)
									jumpTo(index === 1 ? 'main' : 'lyrics')
								}}
								coverRef={imageRef}
								coverAnimatedStyle={outgoingCoverFadeStyle}
							/>
						</Animated.View>

						{hasNext && (
							<Animated.View
								pointerEvents='none'
								style={[
									styles.coverPreviewOverlay,
									{ top: leftViewportHeight, height: leftViewportHeight },
									incomingCoverSlideStyle,
								]}
							>
								<LandscapeCoverPreview
									track={displayNextTrack}
									coverSize={coverSize}
									isPodcast={isPodcast}
								/>
							</Animated.View>
						)}

						{hasPrev && (
							<Animated.View
								pointerEvents='none'
								style={[
									styles.coverPreviewOverlay,
									{ top: -leftViewportHeight, height: leftViewportHeight },
									incomingCoverSlideStyle,
								]}
							>
								<LandscapeCoverPreview
									track={displayPrevTrack}
									coverSize={coverSize}
									isPodcast={isPodcast}
								/>
							</Animated.View>
						)}
					</View>
				</GestureDetector>

				{/* 右侧区域：开启卡片评论区时仅占据右侧区域；否则展示 主控制页 / 纯歌词页 */}
				<Animated.View style={[styles.right, rightStyle]}>
					{isCommentsOpen ? (
						<PlayerCommentsCard
							bvid={bvid}
							isLandscape={true}
						/>
					) : (
						<Computed>
							<AnimatedPagerView
								key={
									playbackContextStore$.context.mode.get() === 'podcast'
										? 'podcast'
										: 'music'
								}
								ref={pagerRef}
								style={styles.flex}
								initialPage={index}
								scrollEnabled={
									playbackContextStore$.context.mode.get() !== 'podcast' &&
									!isScrubbing &&
									!playerSliderDragging$.get()
								}
								onPageScroll={onPageScroll}
								onPageSelected={(e) => setIndex(e.nativeEvent.position)}
							>
								{[
									<View
										key='main'
										style={styles.page}
									>
										<View
											style={[
												styles.rightMainBox,
												isTabletScreen && styles.rightMainBoxTablet,
											]}
										>
											<GestureDetector gesture={swipeTrackGesture}>
												<View>
													<TrackInfo
														part='info'
														onArtistPress={() =>
															currentTrack.artist?.remoteId
																? router.navigate({
																		pathname: '/playlist/remote/uploader/[mid]',
																		params: {
																			mid: currentTrack.artist?.remoteId,
																		},
																	})
																: void 0
														}
														onPressCover={() => void 0}
														coverRef={imageRef}
													/>
												</View>
											</GestureDetector>

											<GestureDetector gesture={bottomCommentsGesture}>
												<View>
													<View style={styles.gap}>
														<PlayerSlider onDragStateChange={setIsScrubbing} />
													</View>
													<PlayerControls
														onOpenQueue={() => {
															void usePlayerQueueSheetStore.getState().open()
														}}
													/>
													{enableSwipeToOpenComments && (
														<View style={styles.bottomPillArea}>
															<View style={styles.bottomPill} />
														</View>
													)}
												</View>
											</GestureDetector>
										</View>
									</View>,
									...(playbackContextStore$.context.mode.get() === 'podcast'
										? []
										: [
												<View
													key='lyrics'
													style={styles.flex}
												>
													<Lyrics
														currentIndex={index}
														onPressBackground={() => jumpTo('main')}
													/>
												</View>,
											]),
								]}
							</AnimatedPagerView>
						</Computed>
					)}
				</Animated.View>
			</View>
		</Show>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	row: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	left: {
		flex: 0.44,
		alignItems: 'center',
		justifyContent: 'center',
		alignSelf: 'stretch',
		overflow: 'hidden',
		position: 'relative',
	},
	leftInner: {
		flex: 1,
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
	},
	coverPreviewOverlay: {
		position: 'absolute',
		left: 0,
		right: 0,
		alignItems: 'center',
		justifyContent: 'center',
	},
	coverPreviewSlot: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	fallbackCover: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	coverPlaceholderText: {
		fontWeight: 'bold',
		color: 'rgba(255, 255, 255, 0.7)',
	},
	right: {
		flex: 0.56,
		alignSelf: 'stretch',
	},
	page: {
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: 8,
	},
	rightMainBox: {
		width: '100%',
	},
	rightMainBoxTablet: {
		maxWidth: 520,
		alignSelf: 'center',
	},
	gap: {
		marginTop: 14,
		marginBottom: 16,
	},
	bottomPillArea: {
		alignItems: 'center',
		paddingTop: 8,
		paddingBottom: 2,
	},
	bottomPill: {
		width: 36,
		height: 3,
		borderRadius: 1.5,
		backgroundColor: 'rgba(150, 150, 150, 0.35)',
	},
})
