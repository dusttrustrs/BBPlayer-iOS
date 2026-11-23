import {
	Orpheus,
	PlaybackState,
	RepeatMode,
	useIsPlaying,
	usePlaybackState,
} from '@bbplayer/orpheus'
import { Computed, Show } from '@legendapp/state/react'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
	Pressable,
	ScrollView,
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import { PlayerCommentsCard } from '@/features/player/components/comments/PlayerCommentsCard'
import { AppVolumeSlider } from '@/features/player/components/controls/AppVolumeSlider'
import Lyrics from '@/features/player/components/lyrics/PlayerLyrics'
import { PodcastSubtitles } from '@/features/player/components/lyrics/PodcastSubtitles'
import SkinThumbUpBurst from '@/features/player/components/visuals/SkinThumbUpBurst'
import { useThumbUpVideo } from '@/hooks/mutations/bilibili/video'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	setPlayerRepeatMode,
	setPlayerShuffleMode,
	usePlaybackOptions,
} from '@/hooks/player/usePlaybackOptions'
import { useGetVideoIsThumbUp } from '@/hooks/queries/bilibili/video'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { usePlayerCommentsStore } from '@/hooks/stores/usePlayerCommentsStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { seekWithinTrack } from '@/lib/player/seek'
import { analyticsService } from '@/lib/services/analyticsService'
import { toastAndLogError } from '@/utils/error-handling'
import * as Haptics from '@/utils/haptics'
import toast from '@/utils/toast'

import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'

export function SplitLyricsPlayer({
	imageRef,
	isFocused,
}: {
	imageRef: ImageRef | null
	isFocused: boolean
}) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const { colors } = useTheme()
	const isDark = useColorScheme() === 'dark'
	const { width, height } = useWindowDimensions()

	const currentTrack = useCurrentTrack()
	const isPlaying = useIsPlaying()
	const playbackState = usePlaybackState()
	const { shuffle: shuffleMode, repeat: repeatMode } = usePlaybackOptions()
	const isCommentsOpen = usePlayerCommentsStore((state) => state.isOpen)
	const activeSkin = useActiveSkin()

	const [isTitleExpanded, setIsTitleExpanded] = useState(false)
	const [thumbUpBurstSignal, setThumbUpBurstSignal] = useState(0)
	const [debouncedIsPlaying, setDebouncedIsPlaying] = useState(isPlaying)
	const [debouncedBuffering, setDebouncedBuffering] = useState(false)
	const playingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const isBilibiliVideo = currentTrack?.source === 'bilibili'
	const bvid = isBilibiliVideo ? currentTrack.bilibiliMetadata.bvid : undefined

	const { data: isThumbUp, isPending: isThumbUpPending } =
		useGetVideoIsThumbUp(bvid)
	const { mutate: doThumbUpAction } = useThumbUpVideo()

	useEffect(() => {
		setIsTitleExpanded(false)
	}, [currentTrack?.uniqueKey])

	useEffect(() => {
		if (playbackState === PlaybackState.BUFFERING) {
			if (bufferingTimeoutRef.current) {
				clearTimeout(bufferingTimeoutRef.current)
			}
			bufferingTimeoutRef.current = setTimeout(() => {
				setDebouncedBuffering(true)
			}, 300)
		} else {
			if (bufferingTimeoutRef.current) {
				clearTimeout(bufferingTimeoutRef.current)
				bufferingTimeoutRef.current = null
			}
			setDebouncedBuffering(false)
		}
		return () => {
			if (bufferingTimeoutRef.current) {
				clearTimeout(bufferingTimeoutRef.current)
			}
		}
	}, [playbackState])

	useEffect(() => {
		if (playingTimeoutRef.current) {
			clearTimeout(playingTimeoutRef.current)
			playingTimeoutRef.current = null
		}
		if (isPlaying) {
			setDebouncedIsPlaying(true)
		} else {
			playingTimeoutRef.current = setTimeout(() => {
				setDebouncedIsPlaying(false)
			}, 200)
		}
		return () => {
			if (playingTimeoutRef.current) {
				clearTimeout(playingTimeoutRef.current)
			}
		}
	}, [isPlaying])

	const entrance = useSharedValue(0)
	useEffect(() => {
		entrance.set(
			withTiming(1, {
				duration: 360,
				easing: Easing.bezier(0.2, 0.8, 0.2, 1),
			}),
		)
	}, [entrance])

	const leftAnimStyle = useAnimatedStyle(() => ({
		opacity: 0.4 + 0.6 * entrance.value,
		transform: [{ scale: 0.96 + 0.04 * entrance.value }],
	}))

	const rightAnimStyle = useAnimatedStyle(() => ({
		opacity: 0.4 + 0.6 * entrance.value,
		transform: [{ translateX: 28 * (1 - entrance.value) }],
	}))

	const handleThumbUpPress = useCallback(() => {
		if (isThumbUpPending || !isBilibiliVideo || !currentTrack) return
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		if (!isThumbUp) {
			setThumbUpBurstSignal((signal) => signal + 1)
		}
		doThumbUpAction({
			bvid: currentTrack.bilibiliMetadata.bvid,
			like: !isThumbUp,
		})
	}, [
		isThumbUpPending,
		isBilibiliVideo,
		currentTrack,
		isThumbUp,
		doThumbUpAction,
	])

	const handleToggleComments = useCallback(() => {
		if (!isBilibiliVideo) return
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		const store = usePlayerCommentsStore.getState()
		if (store.isOpen) {
			store.close()
		} else {
			store.open()
		}
	}, [isBilibiliVideo])

	const handleCyclePlayMode = useCallback(async () => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Confirm)
		try {
			// 循环顺序：列表循环 -> 随机播放 -> 单曲循环 -> 顺序播放 -> 列表循环
			if (shuffleMode) {
				await setPlayerShuffleMode(false)
				await setPlayerRepeatMode(RepeatMode.TRACK)
				toast.show('单曲循环')
			} else if (repeatMode === RepeatMode.QUEUE) {
				await setPlayerShuffleMode(true)
				toast.show('随机播放')
			} else if (repeatMode === RepeatMode.TRACK) {
				await setPlayerRepeatMode(RepeatMode.OFF)
				toast.show('顺序播放')
			} else {
				await setPlayerRepeatMode(RepeatMode.QUEUE)
				toast.show('列表循环')
			}
		} catch (error) {
			toastAndLogError('切换播放模式失败', error, 'SplitPlayer.Controls')
		}
	}, [shuffleMode, repeatMode])

	const handlePlayPause = useCallback(async () => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		const nextPlaying = !debouncedIsPlaying
		setDebouncedIsPlaying(nextPlaying)
		try {
			if (debouncedIsPlaying) {
				await Orpheus.pause()
				void analyticsService.logPlayerAction('pause')
			} else {
				await Orpheus.play()
				void analyticsService.logPlayerAction('play')
			}
		} catch (e) {
			toastAndLogError('播放操作失败', e, 'SplitPlayer.Controls')
		}
	}, [debouncedIsPlaying])

	const handlePrev = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		if (
			playbackContextStore$.context.mode.peek() === 'podcast' &&
			currentTrack
		) {
			void seekWithinTrack(currentTrack.uniqueKey, -15, true).catch(
				(error: unknown) => {
					toastAndLogError('快退失败', error, 'SplitPlayer.Controls')
				},
			)
			return
		}
		void Orpheus.skipToPrevious()
		void analyticsService.logPlayerAction('skip_prev')
	}, [currentTrack])

	const handleNext = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		if (
			playbackContextStore$.context.mode.peek() === 'podcast' &&
			currentTrack
		) {
			void seekWithinTrack(currentTrack.uniqueKey, 15, true).catch(
				(error: unknown) => {
					toastAndLogError('快进失败', error, 'SplitPlayer.Controls')
				},
			)
			return
		}
		void Orpheus.skipToNext()
		void analyticsService.logPlayerAction('skip_next')
	}, [currentTrack])

	const handleOpenQueue = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		void usePlayerQueueSheetStore.getState().open()
		void analyticsService.logPlayerQueueAction('open_queue')
	}, [])

	if (!currentTrack) return null

	const isTabletWide = width >= 760
	const isCompactWidth = width < 520

	const padLeft = Math.max(
		insets.left,
		isTabletWide ? 36 : isCompactWidth ? 12 : 20,
	)
	const padRight = Math.max(
		insets.right,
		isTabletWide ? 28 : isCompactWidth ? 10 : 16,
	)
	const padBottom = Math.max(insets.bottom, 12)
	const availHeight = Math.max(300, height - insets.top - 56 - padBottom)

	const leftRatio = isTabletWide ? 0.39 : isCompactWidth ? 0.47 : 0.42
	const leftColumnWidth = isTabletWide
		? Math.min(Math.max(width * leftRatio, 300), 430)
		: Math.max(width * leftRatio, 168)
	const leftInnerPadding = isTabletWide ? 18 : isCompactWidth ? 6 : 12
	const leftContentWidth = Math.max(140, leftColumnWidth - leftInnerPadding * 2)

	// 预留给下方控制区域的高度（信息行 + 进度条 + 5键控制行 + 音量条 + 间距）
	const reservedBottomHeight = isCompactWidth ? 236 : 268
	const maxCoverByHeight = Math.max(110, availHeight - reservedBottomHeight)
	const maxCoverByWidth = leftContentWidth * (isCompactWidth ? 0.84 : 0.78)
	const coverSize = Math.floor(
		Math.min(maxCoverByWidth, maxCoverByHeight, isTabletWide ? 280 : 210),
	)
	const needsVerticalScroll =
		availHeight < coverSize + reservedBottomHeight + 16

	const playModeIcon = shuffleMode
		? 'shuffle-variant'
		: repeatMode === RepeatMode.TRACK
			? 'repeat-once'
			: repeatMode === RepeatMode.QUEUE
				? 'repeat'
				: 'repeat-off'
	const playModeActive = shuffleMode || repeatMode !== RepeatMode.OFF

	const actionCircleBg = isDark
		? 'rgba(255, 255, 255, 0.11)'
		: 'rgba(0, 0, 0, 0.06)'
	const primaryControlColor = isDark
		? 'rgba(255, 255, 255, 0.96)'
		: colors.onSurface
	const secondaryControlColor = isDark
		? 'rgba(255, 255, 255, 0.72)'
		: colors.onSurfaceVariant

	const mainPlayIconSize = isCompactWidth ? 34 : 44
	const skipIconSize = isCompactWidth ? 24 : 30
	const sideIconSize = isCompactWidth ? 19 : 22

	const leftColumnContent = (
		<View
			style={[
				styles.leftInner,
				{
					paddingHorizontal: leftInnerPadding,
					minHeight: needsVerticalScroll ? undefined : availHeight - 12,
				},
			]}
		>
			{/* 左上方：圆形歌曲封面（兼容频谱光环与唱片旋转） */}
			<View
				style={[
					styles.coverWrapper,
					{
						minHeight: coverSize + (isCompactWidth ? 12 : 24),
					},
				]}
			>
				<TrackInfo
					part='cover'
					forceCircle
					coverMaxSize={coverSize}
					spectrumVisibleHeight={Math.max(coverSize + 90, availHeight * 0.56)}
					onArtistPress={() => void 0}
					onPressCover={() => void 0}
					coverRef={imageRef}
				/>
			</View>

			{/* 左下方：歌曲信息 + 进度条 + 播放控制 + App 独立音量控制条 */}
			<View style={styles.controlsCluster}>
				{/* 标题、歌手与操作圆钮 */}
				<View style={styles.infoRow}>
					<View style={styles.infoTextCol}>
						<TouchableRipple
							onPress={() => setIsTitleExpanded((prev) => !prev)}
						>
							<Text
								variant={isCompactWidth ? 'titleMedium' : 'titleLarge'}
								style={styles.trackTitle}
								numberOfLines={isTitleExpanded ? undefined : 1}
								ellipsizeMode='tail'
							>
								{currentTrack.title}
							</Text>
						</TouchableRipple>
						{currentTrack.artist?.name && (
							<TouchableRipple
								onPress={() =>
									currentTrack.artist?.remoteId
										? router.navigate({
												pathname: '/playlist/remote/uploader/[mid]',
												params: { mid: currentTrack.artist.remoteId },
											})
										: void 0
								}
							>
								<Text
									variant={isCompactWidth ? 'bodySmall' : 'bodyMedium'}
									style={{ color: colors.onSurfaceVariant }}
									numberOfLines={1}
								>
									{currentTrack.artist.name}
								</Text>
							</TouchableRipple>
						)}
					</View>

					{isBilibiliVideo && (
						<View style={styles.actionButtonsCol}>
							<View style={styles.thumbUpWrap}>
								<SkinThumbUpBurst
									skin={activeSkin}
									playSignal={thumbUpBurstSignal}
								/>
								<Pressable
									onPress={handleThumbUpPress}
									style={({ pressed }) => [
										styles.circleActionBtn,
										{
											width: isCompactWidth ? 34 : 38,
											height: isCompactWidth ? 34 : 38,
											borderRadius: isCompactWidth ? 17 : 19,
											backgroundColor: actionCircleBg,
											opacity: pressed ? 0.72 : 1,
										},
									]}
									accessibilityRole='button'
									accessibilityLabel={isThumbUp ? '取消点赞' : '点赞'}
								>
									<Icon
										source={isThumbUp ? 'heart' : 'heart-outline'}
										size={isCompactWidth ? 18 : 20}
										color={isThumbUp ? colors.error : primaryControlColor}
									/>
								</Pressable>
							</View>
							<Pressable
								onPress={handleToggleComments}
								style={({ pressed }) => [
									styles.circleActionBtn,
									{
										width: isCompactWidth ? 34 : 38,
										height: isCompactWidth ? 34 : 38,
										borderRadius: isCompactWidth ? 17 : 19,
										backgroundColor: isCommentsOpen
											? colors.primaryContainer
											: actionCircleBg,
										opacity: pressed ? 0.72 : 1,
									},
								]}
								accessibilityRole='button'
								accessibilityLabel='评论'
							>
								<Icon
									source='comment-text-outline'
									size={isCompactWidth ? 17 : 19}
									color={
										isCommentsOpen
											? colors.onPrimaryContainer
											: primaryControlColor
									}
								/>
							</Pressable>
						</View>
					)}
				</View>

				{/* 进度条 */}
				<View style={styles.sliderSection}>
					<PlayerSlider fullWidth />
				</View>

				{/* 5 键单行播放控制 */}
				<View style={styles.transportRow}>
					<Pressable
						onPress={() => void handleCyclePlayMode()}
						hitSlop={8}
						style={({ pressed }) => [
							styles.transportBtn,
							{ opacity: pressed ? 0.6 : 1 },
						]}
						accessibilityRole='button'
						accessibilityLabel='切换播放模式'
						testID='split-player-mode'
					>
						<Icon
							source={playModeIcon}
							size={sideIconSize}
							color={playModeActive ? colors.primary : secondaryControlColor}
						/>
					</Pressable>

					<Pressable
						onPress={handlePrev}
						hitSlop={8}
						style={({ pressed }) => [
							styles.transportBtn,
							{ opacity: pressed ? 0.6 : 1 },
						]}
						accessibilityRole='button'
						accessibilityLabel='上一首'
						testID='split-player-prev'
					>
						<Icon
							source='skip-previous'
							size={skipIconSize}
							color={primaryControlColor}
						/>
					</Pressable>

					<Pressable
						onPress={() => void handlePlayPause()}
						hitSlop={8}
						style={({ pressed }) => [
							styles.playPauseBtn,
							{
								width: isCompactWidth ? 46 : 56,
								height: isCompactWidth ? 46 : 56,
								opacity: pressed ? 0.7 : 1,
								transform: [{ scale: pressed ? 0.94 : 1 }],
							},
						]}
						accessibilityRole='button'
						accessibilityLabel={debouncedIsPlaying ? '暂停' : '播放'}
						testID='split-player-play-pause'
					>
						{debouncedBuffering ? (
							<ActivityIndicator
								size={mainPlayIconSize * 0.7}
								color={colors.primary}
							/>
						) : (
							<Icon
								source={debouncedIsPlaying ? 'pause' : 'play'}
								size={mainPlayIconSize}
								color={primaryControlColor}
							/>
						)}
					</Pressable>

					<Pressable
						onPress={handleNext}
						hitSlop={8}
						style={({ pressed }) => [
							styles.transportBtn,
							{ opacity: pressed ? 0.6 : 1 },
						]}
						accessibilityRole='button'
						accessibilityLabel='下一首'
						testID='split-player-next'
					>
						<Icon
							source='skip-next'
							size={skipIconSize}
							color={primaryControlColor}
						/>
					</Pressable>

					<Pressable
						onPress={handleOpenQueue}
						hitSlop={8}
						style={({ pressed }) => [
							styles.transportBtn,
							{ opacity: pressed ? 0.6 : 1 },
						]}
						accessibilityRole='button'
						accessibilityLabel='播放列表'
						testID='split-player-queue'
					>
						<Icon
							source='playlist-music'
							size={sideIconSize}
							color={secondaryControlColor}
						/>
					</Pressable>
				</View>

				{/* 最下方：App 独立音量控制条 */}
				<View style={styles.volumeSection}>
					<AppVolumeSlider />
				</View>
			</View>
		</View>
	)

	return (
		<Show if={playbackContextStore$.ready}>
			<View
				style={[
					styles.rootRow,
					{
						paddingLeft: padLeft,
						paddingRight: padRight,
						paddingBottom: padBottom,
						gap: isTabletWide ? 24 : isCompactWidth ? 8 : 16,
					},
				]}
				testID='split-lyrics-player'
			>
				{/* 左侧：圆形封面 + 控制区 + App 独立音量条 */}
				<Animated.View
					style={[styles.leftColumn, { width: leftColumnWidth }, leftAnimStyle]}
				>
					{needsVerticalScroll ? (
						<ScrollView
							style={styles.flex}
							contentContainerStyle={styles.scrollLeftContent}
							showsVerticalScrollIndicator={false}
						>
							{leftColumnContent}
						</ScrollView>
					) : (
						leftColumnContent
					)}
				</Animated.View>

				{/* 右侧：常驻歌词界面 + 右下角圆形歌词源切换按钮（开启评论时展示评论卡片） */}
				<Animated.View style={[styles.rightColumn, rightAnimStyle]}>
					{isCommentsOpen ? (
						<PlayerCommentsCard
							bvid={bvid}
							isLandscape={true}
						/>
					) : (
						<Computed>
							{() =>
								playbackContextStore$.context.mode.get() === 'podcast' ? (
									<PodcastSubtitles
										active={isFocused}
										embedded
									/>
								) : (
									<Lyrics
										currentIndex={1}
										splitMode
									/>
								)
							}
						</Computed>
					)}
				</Animated.View>
			</View>
		</Show>
	)
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
	},
	rootRow: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'stretch',
	},
	leftColumn: {
		alignSelf: 'stretch',
		justifyContent: 'center',
		zIndex: 2,
	},
	scrollLeftContent: {
		flexGrow: 1,
		justifyContent: 'center',
	},
	leftInner: {
		flex: 1,
		width: '100%',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingTop: 6,
		paddingBottom: 6,
	},
	coverWrapper: {
		flex: 1,
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'visible',
	},
	controlsCluster: {
		width: '100%',
		gap: 12,
	},
	infoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 10,
	},
	infoTextCol: {
		flex: 1,
		gap: 4,
	},
	trackTitle: {
		fontWeight: '700',
	},
	actionButtonsCol: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	thumbUpWrap: {
		position: 'relative',
	},
	circleActionBtn: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	sliderSection: {
		width: '100%',
		marginTop: 2,
	},
	transportRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		width: '100%',
		paddingHorizontal: 2,
		marginTop: 2,
	},
	transportBtn: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 20,
	},
	playPauseBtn: {
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 999,
	},
	volumeSection: {
		width: '100%',
		marginTop: 4,
		paddingHorizontal: 2,
	},
	rightColumn: {
		flex: 1,
		alignSelf: 'stretch',
		position: 'relative',
	},
})
