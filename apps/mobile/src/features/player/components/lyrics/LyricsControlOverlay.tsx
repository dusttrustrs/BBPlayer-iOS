import { memo } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MainPlaybackControls } from '@/features/player/components/controls/PlayerControlContent'
import { PlayerSlider } from '@/features/player/components/main/PlayerSlider'

export const LYRICS_CONTROLS_OVERLAY_HEIGHT = 200

export const LyricsControlOverlay = memo(function LyricsControlOverlay() {
	const insets = useSafeAreaInsets()
	const { width, height } = useWindowDimensions()
	const isLandscape = width > height

	// 横屏状态下彻底去除歌词界面下方的进度条与播放控制按钮
	if (isLandscape) {
		return null
	}

	const isTabletPortrait = width >= 600 && !isLandscape
	const paddingBottom = Math.max(insets.bottom + 14, 24)
	const overlayHeight = 148 + paddingBottom

	return (
		<View
			style={[
				styles.overlayContainer,
				{
					height: overlayHeight,
				},
			]}
			pointerEvents='box-none'
		>
			<View
				style={[
					styles.playerControls,
					{ paddingBottom },
					isTabletPortrait && {
						maxWidth: Math.min(width - 96, 620),
						alignSelf: 'center',
					},
				]}
			>
				<PlayerSlider />
				<View style={styles.playbackButtonsWrapper}>
					<MainPlaybackControls size='compact' />
				</View>
			</View>
		</View>
	)
})

const styles = StyleSheet.create({
	overlayContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		zIndex: 2,
		justifyContent: 'flex-end',
	},
	playerControls: {
		width: '100%',
		paddingTop: 4,
	},
	playbackButtonsWrapper: {
		marginTop: 0,
	},
})
