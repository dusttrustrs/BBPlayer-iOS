import { useIsPlaying, useSpectrumVisualizerEnabled } from '@bbplayer/orpheus'
import { Computed } from '@legendapp/state/react'
import type { ImageRef } from 'expo-image'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import {
	type ComponentProps,
	useEffect,
	useLayoutEffect,
	useState,
} from 'react'
import type { ColorSchemeName } from 'react-native'
import {
	Pressable,
	StyleSheet,
	TouchableOpacity,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { Text, TouchableRipple, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useFrameCallback,
	useSharedValue,
} from 'react-native-reanimated'

import IconButton from '@/components/common/IconButton'
import SkinThumbUpBurst from '@/features/player/components/visuals/SkinThumbUpBurst'
import { SpectrumVisualizer } from '@/features/player/components/visuals/SpectrumVisualizer'
import { useThumbUpVideo } from '@/hooks/mutations/bilibili/video'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useGetVideoIsThumbUp } from '@/hooks/queries/bilibili/video'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import useAppStore from '@/hooks/stores/useAppStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import {
	SQUIRCLE_CORNER_SMOOTHING,
	SQUIRCLE_RADIUS_RATIO,
} from '@/theme/dimensions'
import { getGradientColors } from '@/utils/color'
import { resolveBilibiliImageUrl, resolveTrackCover } from '@/utils/imageUrl'

export function TrackInfo({
	onArtistPress,
	onPressCover,
	coverRef,
	part = 'all',
	coverMaxSize,
	coverAnimatedStyle,
}: {
	onArtistPress: () => void
	onPressCover: () => void
	coverRef: ImageRef | null
	/** 横屏时封面和信息分到两列，分别渲染 */
	part?: 'all' | 'cover' | 'info'
	/** 横屏时封面边长上限 */
	coverMaxSize?: number
	/** 切歌时独立的封面淡入淡出动画样式 */
	coverAnimatedStyle?: ComponentProps<typeof Animated.View>['style']
}) {
	const { colors } = useTheme()
	const { width: screenWidth } = useWindowDimensions()

	const colorScheme: ColorSchemeName = useColorScheme()
	const isDark: boolean = colorScheme === 'dark'

	const currentTrack = useCurrentTrack()
	const isPlaying = useIsPlaying()
	const [isTitleExpanded, setIsTitleExpanded] = useState(false)
	const [thumbUpBurstSignal, setThumbUpBurstSignal] = useState(0)
	const activeSkin = useActiveSkin()

	const enableSpectrumVisualizer = useSpectrumVisualizerEnabled()
	const rotatePlayerCover = useAppStore(
		(state) =>
			(state.settings as { rotatePlayerCover?: boolean }).rotatePlayerCover ??
			false,
	)

	const rotation = useSharedValue(0)

	const frameCallback = useFrameCallback((frameInfo) => {
		'worklet'
		const delta = frameInfo.timeSincePreviousFrame ?? 16.6
		rotation.set((rotation.value + (360 / 20000) * delta) % 360)
	}, false)

	const animatedRotateStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}))

	useLayoutEffect(() => {
		rotation.set(0)
	}, [currentTrack?.uniqueKey, rotation])

	useEffect(() => {
		const shouldAnimate = Boolean(rotatePlayerCover && isPlaying)
		frameCallback.setActive(shouldAnimate)
		if (!rotatePlayerCover) {
			rotation.set(0)
		}
	}, [rotatePlayerCover, isPlaying, frameCallback, rotation])

	const { data: isThumbUp, isPending: isThumbUpPending } = useGetVideoIsThumbUp(
		currentTrack?.source === 'bilibili'
			? currentTrack?.bilibiliMetadata.bvid
			: undefined,
	)
	const { mutate: doThumbUpAction } = useThumbUpVideo()

	const isBilibiliVideo = currentTrack?.source === 'bilibili'

	const { color1, color2 } = getGradientColors(
		currentTrack?.title ?? '',
		isDark,
	)

	const firstChar =
		currentTrack &&
		(currentTrack.title.length > 0
			? currentTrack?.title.charAt(0).toUpperCase()
			: undefined)

	const coverUri = resolveBilibiliImageUrl(
		currentTrack
			? resolveTrackCover(currentTrack.uniqueKey, currentTrack.coverUrl)
			: null,
	)

	const onThumbUpPress = () => {
		if (isThumbUpPending || !isBilibiliVideo || !currentTrack) return
		if (!isThumbUp) {
			setThumbUpBurstSignal((signal) => signal + 1)
		}
		doThumbUpAction({
			bvid: currentTrack.bilibiliMetadata.bvid,
			like: !isThumbUp,
		})
	}

	useEffect(() => {
		setIsTitleExpanded(false)
	}, [currentTrack?.uniqueKey])

	if (!currentTrack) return null

	const coverSizeRect = screenWidth - 80
	const coverSizeCircle = screenWidth - 120

	return (
		<View
			style={[
				{
					position: 'relative',
				},
				part === 'cover'
					? { flex: 1, justifyContent: 'center', alignItems: 'center' }
					: null,
			]}
		>
			{part !== 'info' && (
				<Computed>
					{() => {
						const podcast =
							playbackContextStore$.context.mode.get() === 'podcast'
						const baseSize = podcast ? coverSizeRect : coverSizeCircle
						const coverSize = coverMaxSize ? coverMaxSize : baseSize
						const coverBorderRadius = podcast
							? coverSizeRect * SQUIRCLE_RADIUS_RATIO
							: coverSize / 2
						return (
							<Pressable
								style={[
									styles.coverContainer,
									{ height: coverSizeRect + 48 },
									coverMaxSize
										? {
												height: coverMaxSize + 8,
												paddingHorizontal: 0,
												justifyContent: 'center',
												alignItems: 'center',
											}
										: null,
								]}
								onPress={podcast ? undefined : onPressCover}
								disabled={podcast}
							>
								{!podcast && enableSpectrumVisualizer && (
									<View
										style={[
											StyleSheet.absoluteFill,
											{ alignItems: 'center', justifyContent: 'center' },
										]}
									>
										<SpectrumVisualizer
											isPlaying={isPlaying}
											size={coverSize}
											color={colors.primary}
										/>
									</View>
								)}
								<Animated.View
									style={[
										{ width: coverSize, height: coverSize },
										coverAnimatedStyle,
									]}
								>
									<TouchableOpacity
										activeOpacity={0.8}
										onPress={podcast ? undefined : onPressCover}
										disabled={podcast}
										style={{ width: coverSize, height: coverSize }}
										testID='player-cover'
									>
										<Animated.View
											style={[
												{ width: coverSize, height: coverSize },
												!podcast && animatedRotateStyle,
											]}
										>
											<SquircleView
												style={{
													width: coverSize,
													height: coverSize,
													borderRadius: coverBorderRadius,
													overflow: 'hidden',
												}}
												cornerSmoothing={SQUIRCLE_CORNER_SMOOTHING}
											>
												{!coverUri && !coverRef ? (
													<LinearGradient
														colors={[color1, color2]}
														style={[
															styles.coverGradient,
															{ borderRadius: coverBorderRadius },
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
												) : (
													<Image
														source={coverUri ? { uri: coverUri } : coverRef}
														style={{
															width: coverSize,
															height: coverSize,
															borderRadius: coverBorderRadius,
														}}
														contentFit='cover'
														cachePolicy='memory-disk'
														transition={0}
													/>
												)}
											</SquircleView>
										</Animated.View>
									</TouchableOpacity>
								</Animated.View>
							</Pressable>
						)
					}}
				</Computed>
			)}

			{part !== 'cover' && (
				<View
					style={[
						styles.trackInfoContainer,
						coverMaxSize !== undefined || part === 'info'
							? { paddingHorizontal: 0 }
							: null,
					]}
				>
					<View style={styles.trackTitleContainer}>
						<View style={styles.trackTitleTextContainer}>
							<TouchableRipple
								onPress={() => setIsTitleExpanded((expanded) => !expanded)}
							>
								<Text
									variant='titleLarge'
									style={styles.trackTitle}
									numberOfLines={isTitleExpanded ? undefined : 1}
									ellipsizeMode='tail'
								>
									{currentTrack.title}
								</Text>
							</TouchableRipple>
							{currentTrack.artist?.name && (
								<TouchableRipple onPress={onArtistPress}>
									<Text
										variant='bodyMedium'
										style={{ color: colors.onSurfaceVariant }}
										numberOfLines={1}
									>
										{currentTrack.artist.name}
									</Text>
								</TouchableRipple>
							)}
						</View>
						{isBilibiliVideo && (
							<View style={styles.thumbUpButtonContainer}>
								<SkinThumbUpBurst
									skin={activeSkin}
									playSignal={thumbUpBurstSignal}
								/>
								<IconButton
									icon={isThumbUp ? 'heart' : 'heart-outline'}
									size={24}
									iconColor={isThumbUp ? colors.error : colors.onSurfaceVariant}
									onPress={onThumbUpPress}
								/>
							</View>
						)}
					</View>
				</View>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	coverContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 32,
	},
	coverGradient: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
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
	trackTitle: {
		fontWeight: 'bold',
	},
	thumbUpButtonContainer: {
		position: 'relative',
	},
})
