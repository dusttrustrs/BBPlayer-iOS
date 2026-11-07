import {
	Orpheus,
	RepeatMode,
	type Track as OrpheusTrack,
} from '@bbplayer/orpheus'
import { Show } from '@legendapp/state/react'
import { Image, type ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from 'react'
import {
	type LayoutChangeEvent,
	StyleSheet,
	useWindowDimensions,
	View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
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
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { usePlaybackOptions } from '@/hooks/player/usePlaybackOptions'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import useAppStore from '@/hooks/stores/useAppStore'
import { usePlayerCommentsStore } from '@/hooks/stores/usePlayerCommentsStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import { usePlayerQueueStore } from '@/hooks/stores/usePlayerQueueStore'
import { analyticsService } from '@/lib/services/analyticsService'
import * as Haptics from '@/utils/haptics'
import { resolveBilibiliImageUrl, resolveTrackCover } from '@/utils/imageUrl'

import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'
import { PlayerTrackPreview } from './PlayerTrackPreview'

interface PlayerMainTabProps {
	jumpTo: (key: string) => void
	imageRef: ImageRef | null
	onPresent: () => void
}

let lastPlayerSkipTimestamp = 0

function tryAcquirePlayerSkipLock(cooldownMs = 450): boolean {
	const now = Date.now()
	if (now - lastPlayerSkipTimestamp < cooldownMs) return false
	lastPlayerSkipTimestamp = now
	return true
}

const PlayerMainTab = memo(function PlayerMainTab({
	jumpTo,
	imageRef,
	onPresent,
}: PlayerMainTabProps) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const activeTrackKey = currentTrack?.uniqueKey
	const { width, height } = useWindowDimensions()
	const isLandscape = width > height
	const [isDraggingSlider, setIsDraggingSlider] = useState(false)

	const estimatedViewportHeight = Math.max(1, height - insets.top - 56)
	const [viewportHeight, setViewportHeight] = useState(estimatedViewportHeight)
	const viewportHeightSV = useSharedValue(estimatedViewportHeight)

	const handleViewportLayout = useCallback(
		(e: LayoutChangeEvent) => {
			const measuredH = e.nativeEvent.layout.height
			if (measuredH > 0) {
				viewportHeightSV.set(measuredH)
				setViewportHeight((prev) =>
					Math.abs(prev - measuredH) > 0.5 ? measuredH : prev,
				)
			}
		},
		[viewportHeightSV],
	)

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

	// 预热相邻歌曲封面到内存/磁盘缓存，避免切歌瞬间解码闪烁
	useEffect(() => {
		const urlsToPrefetch: string[] = []
		for (const candidate of [nextTrack, prevTrack]) {
			if (!candidate) continue
			const rawCover = candidate.artwork ?? ''
			const resolved = resolveBilibiliImageUrl(
				resolveTrackCover(candidate.id, rawCover) ?? rawCover,
			)
			if (resolved && /^https?:\/\//i.test(resolved)) {
				urlsToPrefetch.push(resolved)
			}
		}
		if (urlsToPrefetch.length > 0) {
			void Image.prefetch(urlsToPrefetch, 'memory-disk').catch(() => void 0)
		}
	}, [nextTrack, prevTrack])

	const handleSkipNext = useCallback(() => {
		if (!tryAcquirePlayerSkipLock()) return
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		void Orpheus.skipToNext()
		void analyticsService.logPlayerAction('skip_next')
	}, [])

	const handleSkipPrevious = useCallback(() => {
		if (!tryAcquirePlayerSkipLock()) return
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		void Orpheus.skipToPrevious()
		void analyticsService.logPlayerAction('skip_prev')
	}, [])

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

	const swipeAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: swipeTranslateY.value }],
	}))

	// 歌曲封面独立淡出/淡入过渡样式，平滑衔接切歌过程
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

	const incomingCoverFadeStyle = useAnimatedStyle(() => {
		const vh = Math.max(1, viewportHeightSV.value)
		return {
			opacity: interpolate(
				Math.abs(swipeTranslateY.value),
				[0, vh],
				[0, 0.38],
				Extrapolation.CLAMP,
			),
		}
	})

	const displayNextTrack = frozenNextTrack ?? nextTrack
	const displayPrevTrack = frozenPrevTrack ?? prevTrack
	const hasNext = Boolean(displayNextTrack)
	const hasPrev = Boolean(displayPrevTrack)

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

	// 仿抖音上下滑切歌手势：滑屏直接呈现下一首/上一首歌曲页面
	const panGesture = useMemo(() => {
		return Gesture.Pan()
			.enabled(enableSwipeToSwitchTrack && !isDraggingSlider)
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
				const threshold = 70
				const velocityThreshold = 450
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
		isDraggingSlider,
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

	// 底部向上滑动手势：开启卡片样式评论区
	const bottomCommentsGesture = useMemo(() => {
		return Gesture.Pan()
			.enabled(enableSwipeToOpenComments && !isDraggingSlider)
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
	}, [enableSwipeToOpenComments, isDraggingSlider, handleOpenCommentsCard])

	// 0 = 刚旋转完（元素还在「旧位置」），1 = 各就各位；每次方向变化重播一遍编排
	const p = useSharedValue(1)
	useEffect(() => {
		p.set(0)
		const curve = Easing.bezier(0.2, 0.8, 0.2, 1)
		p.set(withTiming(1, { duration: 520, easing: curve }))
	}, [isLandscape, p])

	const dir = isLandscape ? 1 : -1
	const coverStyle = useAnimatedStyle(() => ({
		opacity: 0.4 + 0.6 * p.value,
		transform: [
			{ translateX: dir * -width * 0.22 * (1 - p.value) },
			{ translateY: dir * height * 0.12 * (1 - p.value) },
			{ rotateZ: `${-6 * (1 - p.value)}deg` },
			{ scale: 1 + 0.12 * (1 - p.value) },
		],
	}))
	const delayed = (d: number) => {
		'worklet'
		return Math.min(1, Math.max(0, (p.value * 520 - d) / (520 - d)))
	}
	const infoStyle = useAnimatedStyle(() => {
		const t = delayed(60)
		return {
			opacity: 0.3 + 0.7 * t,
			transform: [{ translateY: 90 * (1 - t) }],
		}
	})
	const sliderStyle = useAnimatedStyle(() => {
		const t = delayed(110)
		return {
			opacity: 0.3 + 0.7 * t,
			transform: [
				{ translateX: dir * 60 * (1 - t) },
				{ scaleX: 0.85 + 0.15 * t },
			],
		}
	})
	const controlsStyle = useAnimatedStyle(() => {
		const t = delayed(150)
		// 控件从中心向两侧「展开」：先收拢再散开
		return {
			opacity: 0.2 + 0.8 * t,
			transform: [{ scaleX: 0.6 + 0.4 * t }, { scale: 0.9 + 0.1 * t }],
		}
	})

	if (!currentTrack) return null

	// 横屏布局：左侧封面，右侧播放控制区域（评论区开启时卡片只占据右侧区域）
	if (isLandscape) {
		const padH = Math.max(insets.left, insets.right, 24)
		const coverSize = Math.min(width * 0.42, height - 56 - 24)
		return (
			<Show if={playbackContextStore$.ready}>
				<View style={[styles.landscapeRow, { paddingHorizontal: padH }]}>
					<GestureDetector gesture={panGesture}>
						<Animated.View style={[styles.landscapeLeft, coverStyle]}>
							<TrackInfo
								part='cover'
								coverMaxSize={coverSize}
								onArtistPress={() => void 0}
								onPressCover={() => {
									void Haptics.performHaptics(
										Haptics.AndroidHaptics.Context_Click,
									)
									jumpTo('lyrics')
								}}
								coverRef={imageRef}
							/>
						</Animated.View>
					</GestureDetector>

					<View style={styles.landscapeRight}>
						{isCommentsOpen ? (
							<PlayerCommentsCard
								bvid={bvid}
								isLandscape={true}
							/>
						) : (
							<GestureDetector gesture={bottomCommentsGesture}>
								<View style={styles.landscapeRightContent}>
									<Animated.View style={infoStyle}>
										<TrackInfo
											part='info'
											onArtistPress={() =>
												currentTrack.artist?.remoteId
													? router.navigate({
															pathname: '/playlist/remote/uploader/[mid]',
															params: { mid: currentTrack.artist?.remoteId },
														})
													: void 0
											}
											onPressCover={() => void 0}
											coverRef={imageRef}
										/>
									</Animated.View>
									<Animated.View style={[styles.landscapeGap, sliderStyle]}>
										<PlayerSlider onDragStateChange={setIsDraggingSlider} />
									</Animated.View>
									<Animated.View style={controlsStyle}>
										<PlayerControls
											onOpenQueue={() => {
												onPresent()
												void usePlayerQueueSheetStore.getState().open()
											}}
										/>
									</Animated.View>
								</View>
							</GestureDetector>
						)}
					</View>
				</View>
			</Show>
		)
	}

	// 竖屏布局：仿抖音垂直滑屏切歌 + 底部上滑开启卡片式评论区
	return (
		<Show if={playbackContextStore$.ready}>
			<View
				style={styles.viewportWrapper}
				onLayout={handleViewportLayout}
			>
				<Animated.View style={[styles.container, swipeAnimatedStyle]}>
					<GestureDetector gesture={panGesture}>
						<View style={styles.trackInfoWrapper}>
							<TrackInfo
								onArtistPress={() =>
									currentTrack.artist?.remoteId
										? router.navigate({
												pathname: '/playlist/remote/uploader/[mid]',
												params: { mid: currentTrack.artist?.remoteId },
											})
										: void 0
								}
								onPressCover={() => {
									void Haptics.performHaptics(
										Haptics.AndroidHaptics.Context_Click,
									)
									jumpTo('lyrics')
								}}
								coverRef={imageRef}
								coverAnimatedStyle={outgoingCoverFadeStyle}
							/>
						</View>
					</GestureDetector>

					<GestureDetector gesture={bottomCommentsGesture}>
						<View
							style={[
								{ paddingBottom: Math.max(insets.bottom + 20, 20) },
								styles.controlsContainer,
							]}
						>
							<PlayerSlider onDragStateChange={setIsDraggingSlider} />
							<PlayerControls
								onOpenQueue={() => {
									onPresent()
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
				</Animated.View>

				{/* 仿抖音垂直切歌预览：向上滑动时下一首以相同视口高度无缝滑入 */}
				{hasNext && (
					<Animated.View
						style={[
							styles.previewContainer,
							{ top: viewportHeight, height: viewportHeight },
							swipeAnimatedStyle,
						]}
						pointerEvents='none'
					>
						<PlayerTrackPreview
							track={displayNextTrack}
							width={width}
							insets={insets}
							enableSwipeToOpenComments={enableSwipeToOpenComments}
							coverAnimatedStyle={incomingCoverFadeStyle}
						/>
					</Animated.View>
				)}

				{/* 仿抖音垂直切歌预览：向下滑动时上一首以相同视口高度无缝滑入 */}
				{hasPrev && (
					<Animated.View
						style={[
							styles.previewContainer,
							{ top: -viewportHeight, height: viewportHeight },
							swipeAnimatedStyle,
						]}
						pointerEvents='none'
					>
						<PlayerTrackPreview
							track={displayPrevTrack}
							width={width}
							insets={insets}
							enableSwipeToOpenComments={enableSwipeToOpenComments}
							coverAnimatedStyle={incomingCoverFadeStyle}
						/>
					</Animated.View>
				)}
			</View>
		</Show>
	)
})

const styles = StyleSheet.create({
	viewportWrapper: {
		flex: 1,
		overflow: 'hidden',
		position: 'relative',
	},
	container: {
		flex: 1,
		justifyContent: 'space-between',
	},
	trackInfoWrapper: {
		flex: 1,
		justifyContent: 'center',
	},
	previewContainer: {
		position: 'absolute',
		left: 0,
		right: 0,
	},
	controlsContainer: {
		paddingHorizontal: 24,
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
	landscapeRow: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 24,
	},
	landscapeLeft: {
		flex: 0.42,
		alignItems: 'center',
		justifyContent: 'center',
	},
	landscapeRight: {
		flex: 0.58,
		justifyContent: 'center',
	},
	landscapeRightContent: {
		flex: 1,
		justifyContent: 'center',
	},
	landscapeGap: {
		marginTop: 16,
		marginBottom: 20,
	},
})

PlayerMainTab.displayName = 'PlayerMainTab'
export default PlayerMainTab
