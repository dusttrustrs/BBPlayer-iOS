import type { Track as OrpheusTrack } from '@bbplayer/orpheus'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { type ComponentProps, memo } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { Icon, Text, useTheme } from 'react-native-paper'
import Animated from 'react-native-reanimated'
import type { EdgeInsets } from 'react-native-safe-area-context'

import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import {
	SQUIRCLE_CORNER_SMOOTHING,
	SQUIRCLE_RADIUS_RATIO,
} from '@/theme/dimensions'
import { getGradientColors } from '@/utils/color'
import { resolveBilibiliImageUrl, resolveTrackCover } from '@/utils/imageUrl'
import { formatDurationToHHMMSS } from '@/utils/time'

interface PlayerTrackPreviewProps {
	track: OrpheusTrack | null
	width: number
	insets: EdgeInsets
	enableSwipeToOpenComments?: boolean
	coverAnimatedStyle?: ComponentProps<typeof Animated.View>['style']
}

export const PlayerTrackPreview = memo(function PlayerTrackPreview({
	track,
	width,
	insets,
	enableSwipeToOpenComments = true,
	coverAnimatedStyle,
}: PlayerTrackPreviewProps) {
	const theme = useTheme()
	const colors = theme.colors
	const isDark = useColorScheme() === 'dark'

	if (!track) return null

	const podcast = playbackContextStore$.context.mode.get() === 'podcast'
	const coverSizeRect = width - 80
	const coverSize = podcast ? coverSizeRect : width - 120
	const coverRadius = podcast
		? coverSizeRect * SQUIRCLE_RADIUS_RATIO
		: coverSize / 2
	const rawCover = track.artwork ?? ''
	const coverUri = resolveBilibiliImageUrl(
		resolveTrackCover(track.id, rawCover) ?? rawCover,
	)

	const isBilibiliVideo = track.id.startsWith('bilibili')
	const { color1, color2 } = getGradientColors(track.title ?? '', isDark)
	const firstChar =
		track.title && track.title.length > 0
			? track.title.charAt(0).toUpperCase()
			: undefined

	const durationStr = formatDurationToHHMMSS(Math.trunc(track.duration ?? 0))

	return (
		<View style={styles.container}>
			{/* 与 PlayerMainTab trackInfoWrapper + TrackInfo 100% 像素级对齐 */}
			<View style={styles.trackInfoWrapper}>
				<View style={styles.trackInfoRoot}>
					<View style={[styles.coverWrapper, { height: coverSizeRect + 48 }]}>
						<Animated.View
							style={[
								{ width: coverSize, height: coverSize },
								coverAnimatedStyle,
							]}
						>
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
										style={[
											styles.fallbackCover,
											{ borderRadius: coverRadius },
										]}
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
						</Animated.View>
					</View>

					<View style={styles.trackInfoContainer}>
						<View style={styles.trackTitleContainer}>
							<View style={styles.trackTitleTextContainer}>
								<Text
									variant='titleLarge'
									numberOfLines={1}
									ellipsizeMode='tail'
									style={styles.title}
								>
									{track.title || '正在加载'}
								</Text>
								{Boolean(track.artist) && (
									<Text
										variant='bodyMedium'
										numberOfLines={1}
										style={{ color: colors.onSurfaceVariant }}
									>
										{track.artist}
									</Text>
								)}
							</View>
							{isBilibiliVideo && (
								<View style={styles.heartPlaceholder}>
									<Icon
										source='heart-outline'
										size={24}
										color={colors.onSurfaceVariant}
									/>
								</View>
							)}
						</View>
					</View>
				</View>
			</View>

			{/* 与 PlayerMainTab controlsContainer (PlayerSlider + PlayerControls + bottomPill) 100% 像素级等高 */}
			<View
				style={[
					{ paddingBottom: Math.max(insets.bottom + 20, 20) },
					styles.controlsContainer,
				]}
			>
				{/* PlayerSlider 等高占位 */}
				<View style={styles.sliderRoot}>
					{podcast && <View style={styles.podcastChapterSpacer} />}
					<View style={podcast ? styles.podcastSliderRow : styles.sliderBox}>
						{podcast && <View style={styles.seekBtnBox} />}
						<View
							style={podcast ? styles.podcastSliderInner : styles.sliderInner}
						>
							<View
								style={[
									styles.sliderTrack,
									{ backgroundColor: colors.surfaceVariant },
								]}
							/>
							<View
								style={[
									styles.sliderThumb,
									{ backgroundColor: colors.primary },
								]}
							/>
						</View>
						{podcast && <View style={styles.seekBtnBox} />}
					</View>
					<View style={styles.timeContainer}>
						<Text
							variant='bodySmall'
							style={[styles.timeText, { color: colors.onSurfaceVariant }]}
						>
							00:00
						</Text>
						<Text
							variant='bodySmall'
							style={[styles.timeText, { color: colors.onSurfaceVariant }]}
						>
							{durationStr}
						</Text>
					</View>
				</View>

				{/* PlayerControls 等高占位 */}
				<View>
					<View style={styles.mainControlsWrapper}>
						<View style={styles.mainControlsRow}>
							<View style={styles.skipBtnBox}>
								<Icon
									source='skip-previous'
									size={32}
									color={colors.onSurfaceVariant}
								/>
							</View>
							<View style={styles.playBtnBox}>
								<View
									style={[
										styles.playBtnCircle,
										{ backgroundColor: colors.primaryContainer },
									]}
								>
									<Icon
										source='play'
										size={36}
										color={colors.onPrimaryContainer}
									/>
								</View>
							</View>
							<View style={styles.skipBtnBox}>
								<Icon
									source='skip-next'
									size={32}
									color={colors.onSurfaceVariant}
								/>
							</View>
						</View>
					</View>
					<View style={styles.secondaryControlsRow}>
						{(podcast
							? [
									'speedometer',
									'timer-outline',
									'book-open-page-variant-outline',
									'format-list-bulleted',
								]
							: [
									'shuffle-disabled',
									'repeat',
									'comment-text-outline',
									'format-list-bulleted',
								]
						).map((iconName) => (
							<View
								key={iconName}
								style={styles.secondaryIconBox}
							>
								<Icon
									source={iconName}
									size={24}
									color={colors.onSurfaceVariant}
								/>
							</View>
						))}
					</View>
				</View>

				{enableSwipeToOpenComments && (
					<View style={styles.bottomPillArea}>
						<View style={styles.bottomPill} />
					</View>
				)}
			</View>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'space-between',
	},
	trackInfoWrapper: {
		flex: 1,
		justifyContent: 'center',
	},
	trackInfoRoot: {
		position: 'relative',
	},
	coverWrapper: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 32,
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
	trackInfoContainer: {
		paddingHorizontal: 24,
	},
	trackTitleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		minHeight: 52,
	},
	trackTitleTextContainer: {
		flex: 1,
		marginRight: 8,
	},
	title: {
		fontWeight: 'bold',
	},
	heartPlaceholder: {
		width: 40,
		height: 40,
		margin: 6,
		alignItems: 'center',
		justifyContent: 'center',
	},
	controlsContainer: {
		paddingHorizontal: 24,
	},
	sliderRoot: {
		width: '100%',
		justifyContent: 'center',
	},
	podcastChapterSpacer: {
		height: 24,
		marginBottom: 8,
	},
	podcastSliderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	seekBtnBox: {
		width: 48,
		height: 48,
	},
	podcastSliderInner: {
		flex: 1,
		height: 25,
		justifyContent: 'center',
	},
	sliderBox: {
		height: 25,
		width: '90%',
		alignSelf: 'center',
		justifyContent: 'center',
	},
	sliderInner: {
		height: 25,
		width: '100%',
		justifyContent: 'center',
	},
	sliderTrack: {
		height: 3,
		borderRadius: 1.5,
		width: '100%',
	},
	sliderThumb: {
		width: 12,
		height: 12,
		borderRadius: 6,
		position: 'absolute',
		left: 0,
	},
	timeContainer: {
		marginTop: 4,
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '90%',
		alignSelf: 'center',
	},
	timeText: {
		fontVariant: ['tabular-nums'],
		includeFontPadding: false,
	},
	mainControlsWrapper: {
		marginTop: 24,
	},
	mainControlsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 40,
	},
	skipBtnBox: {
		width: 46,
		height: 46,
		alignItems: 'center',
		justifyContent: 'center',
	},
	playBtnBox: {
		width: 96,
		height: 96,
		alignItems: 'center',
		justifyContent: 'center',
	},
	playBtnCircle: {
		width: 64,
		height: 64,
		borderRadius: 32,
		alignItems: 'center',
		justifyContent: 'center',
	},
	secondaryControlsRow: {
		marginTop: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 32,
	},
	secondaryIconBox: {
		width: 40,
		height: 40,
		margin: 6,
		alignItems: 'center',
		justifyContent: 'center',
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
