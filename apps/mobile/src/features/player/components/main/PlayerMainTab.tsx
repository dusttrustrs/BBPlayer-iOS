import { Show } from '@legendapp/state/react'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PlayerControls } from '@/features/player/components/controls/PlayerControls'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import * as Haptics from '@/utils/haptics'

import { PlayerSlider } from './PlayerSlider'
import { TrackInfo } from './PlayerTrackInfo'

interface PlayerMainTabProps {
	jumpTo: (key: string) => void
	imageRef: ImageRef | null
	onPresent: () => void
}

const PlayerMainTab = memo(function PlayerMainTab({
	jumpTo,
	imageRef,
	onPresent,
}: PlayerMainTabProps) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const { width, height } = useWindowDimensions()
	const isLandscape = width > height
	const [isDraggingSlider, setIsDraggingSlider] = useState(false)

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
			transform: [{ translateX: dir * 60 * (1 - t) }, { scaleX: 0.85 + 0.15 * t }],
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
	if (isLandscape) {
		const padH = Math.max(insets.left, insets.right, 24)
		const coverSize = Math.min(width * 0.42, height - 56 - 24)
		return (
			<Show if={playbackContextStore$.ready}>
				<View style={[styles.landscapeRow, { paddingHorizontal: padH }]}>
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
					<View style={styles.landscapeRight}>
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
				</View>
			</Show>
		)
	}
	return (
		<Show if={playbackContextStore$.ready}>
			<ScrollView
				scrollEnabled={!isDraggingSlider}
				contentContainerStyle={styles.container}
				showsVerticalScrollIndicator={false}
			>
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
						void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
						jumpTo('lyrics')
					}}
					coverRef={imageRef}
				/>

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
				</View>
			</ScrollView>
		</Show>
	)
})

const styles = StyleSheet.create({
	container: {
		flexGrow: 1,
		justifyContent: 'space-between',
	},
	controlsContainer: {
		paddingHorizontal: 24,
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
	landscapeGap: {
		marginTop: 16,
		marginBottom: 20,
	},
})

PlayerMainTab.displayName = 'PlayerMainTab'
export default PlayerMainTab
