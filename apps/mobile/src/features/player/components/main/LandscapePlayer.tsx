import { Show } from '@legendapp/state/react'
import type { ImageRef } from 'expo-image'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import PagerView from 'react-native-pager-view'
import Animated, {
	createAnimatedComponent,
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PlayerControls } from '@/features/player/components/controls/PlayerControls'
import Lyrics from '@/features/player/components/lyrics/PlayerLyrics'
import { PlayerSlider } from '@/features/player/components/main/PlayerSlider'
import { TrackInfo } from '@/features/player/components/main/PlayerTrackInfo'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import { usePlayerQueueSheetStore } from '@/hooks/stores/usePlayerQueueSheetStore'
import * as Haptics from '@/utils/haptics'

const AnimatedPagerView = createAnimatedComponent(PagerView)

/**
 * 横屏播放器：左侧封面常驻且居中；右侧是一个小 PagerView（播放控制 / 歌词）。
 * 左滑进入歌词时，歌词页从右侧平滑切换，封面保持不动。
 */
export function LandscapePlayer({
	pagerRef,
	index,
	setIndex,
	jumpTo,
	imageRef,
	onPageScroll,
}: {
	pagerRef: React.RefObject<PagerView | null>
	index: number
	setIndex: (i: number) => void
	jumpTo: (key: string) => void
	imageRef: ImageRef | null
	onPageScroll: unknown
}) {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const { width, height } = useWindowDimensions()
	const [isScrubbing, setIsScrubbing] = useState(false)

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
		transform: [{ scale: 0.94 + 0.06 * p.value }],
		opacity: 0.5 + 0.5 * p.value,
	}))

	const rightStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: 50 * (1 - p.value) }],
		opacity: 0.6 + 0.4 * p.value,
	}))

	if (!currentTrack) return null
	const padL = Math.max(insets.left, 24)
	const padR = Math.max(insets.right, 24)

	// 动态计算封面尺寸：居中并充分利用高度与宽度，不再受制于过小的 220px 限制
	const availHeight = height - 52 - Math.max(insets.bottom, 12)
	const availWidth = (width - padL - padR - 32) * 0.44
	const coverSize = Math.floor(Math.min(availWidth, availHeight * 0.94, 340))
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
					},
				]}
			>
				{/* 左侧封面居中常驻展示 */}
				<Animated.View style={[styles.left, coverStyle]}>
					<TrackInfo
						part='cover'
						coverMaxSize={coverSize}
						onArtistPress={() => void 0}
						onPressCover={() => {
							void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
							jumpTo(index === 1 ? 'main' : 'lyrics')
						}}
						coverRef={imageRef}
					/>
				</Animated.View>

				{/* 右侧分页：主控制页 / 纯歌词页 */}
				<Animated.View style={[styles.right, rightStyle]}>
					<AnimatedPagerView
						key={isPodcast ? 'podcast' : 'music'}
						ref={pagerRef}
						style={styles.flex}
						initialPage={index}
						scrollEnabled={!isPodcast && !isScrubbing}
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						onPageScroll={onPageScroll as any}
						onPageSelected={(e) => setIndex(e.nativeEvent.position)}
					>
						{[
							<View
								key='main'
								style={styles.page}
							>
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
								<View style={styles.gap}>
									<PlayerSlider onDragStateChange={setIsScrubbing} />
								</View>
								<PlayerControls
									onOpenQueue={() => {
										void usePlayerQueueSheetStore.getState().open()
									}}
								/>
							</View>,
							...(isPodcast
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
		gap: 20,
	},
	left: {
		flex: 0.44,
		alignItems: 'center',
		justifyContent: 'center',
		alignSelf: 'stretch',
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
	gap: {
		marginTop: 14,
		marginBottom: 16,
	},
})
