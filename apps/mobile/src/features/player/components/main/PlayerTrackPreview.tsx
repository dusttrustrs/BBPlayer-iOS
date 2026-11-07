import type { Track as OrpheusTrack } from '@bbplayer/orpheus'
import { Image } from 'expo-image'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { Icon, Text, useTheme } from 'react-native-paper'
import type { EdgeInsets } from 'react-native-safe-area-context'

import { playbackContextStore$ } from '@/hooks/stores/playbackContextStore'
import {
	SQUIRCLE_CORNER_SMOOTHING,
	SQUIRCLE_RADIUS_RATIO,
} from '@/theme/dimensions'
import { resolveBilibiliImageUrl, resolveTrackCover } from '@/utils/imageUrl'

interface PlayerTrackPreviewProps {
	track: OrpheusTrack | null
	width: number
	insets: EdgeInsets
}

export const PlayerTrackPreview = memo(function PlayerTrackPreview({
	track,
	width,
	insets,
}: PlayerTrackPreviewProps) {
	const theme = useTheme()
	const colors = theme.colors

	if (!track) return null

	const podcast = playbackContextStore$.context.mode.get() === 'podcast'
	const coverSize = podcast ? width - 80 : width - 120
	const coverRadius = podcast
		? (width - 80) * SQUIRCLE_RADIUS_RATIO
		: coverSize / 2
	const rawCover = track.artwork ?? ''
	const coverUri = resolveBilibiliImageUrl(
		resolveTrackCover(track.id, rawCover) ?? rawCover,
	)

	return (
		<View style={styles.container}>
			<View style={styles.trackInfoArea}>
				<View style={[styles.coverWrapper, { height: width - 80 + 48 }]}>
					<SquircleView
						style={[
							styles.coverContainer,
							{
								width: coverSize,
								height: coverSize,
								borderRadius: coverRadius,
								backgroundColor: colors.surfaceVariant,
								overflow: 'hidden',
							},
						]}
						cornerSmoothing={SQUIRCLE_CORNER_SMOOTHING}
					>
						{coverUri ? (
							<Image
								source={{ uri: coverUri }}
								style={StyleSheet.absoluteFill}
								contentFit='cover'
								cachePolicy='disk'
							/>
						) : (
							<View style={styles.fallbackCover}>
								<Icon
									source='music'
									size={64}
									color={colors.onSurfaceVariant}
								/>
							</View>
						)}
					</SquircleView>
				</View>

				<View style={styles.textContainer}>
					<Text
						variant='headlineSmall'
						numberOfLines={1}
						style={[styles.title, { color: colors.onSurface }]}
					>
						{track.title || '正在加载'}
					</Text>
					<Text
						variant='titleMedium'
						numberOfLines={1}
						style={[styles.artist, { color: colors.onSurfaceVariant }]}
					>
						{track.artist || '未知作者'}
					</Text>
				</View>
			</View>

			<View
				style={[
					styles.controlsContainer,
					{ paddingBottom: Math.max(insets.bottom + 20, 20) },
				]}
			>
				{/* Mock Slider */}
				<View style={styles.sliderMock}>
					<View
						style={[
							styles.sliderTrack,
							{ backgroundColor: colors.surfaceVariant },
						]}
					/>
					<View
						style={[styles.sliderThumb, { backgroundColor: colors.primary }]}
					/>
				</View>

				{/* Mock Controls */}
				<View style={styles.controlsMock}>
					<Icon
						source='skip-previous'
						size={32}
						color={colors.onSurfaceVariant}
					/>
					<View
						style={[
							styles.playBtnMock,
							{ backgroundColor: colors.primaryContainer },
						]}
					>
						<Icon
							source='play'
							size={36}
							color={colors.onPrimaryContainer}
						/>
					</View>
					<Icon
						source='skip-next'
						size={32}
						color={colors.onSurfaceVariant}
					/>
				</View>
			</View>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'space-between',
	},
	trackInfoArea: {
		flex: 1,
		justifyContent: 'center',
	},
	coverWrapper: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 32,
	},
	coverContainer: {
		overflow: 'hidden',
	},
	fallbackCover: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	textContainer: {
		alignItems: 'center',
		marginTop: 20,
		paddingHorizontal: 24,
		width: '100%',
	},
	title: {
		fontWeight: 'bold',
		textAlign: 'center',
	},
	artist: {
		marginTop: 4,
		textAlign: 'center',
	},
	controlsContainer: {
		paddingHorizontal: 24,
	},
	sliderMock: {
		height: 40,
		justifyContent: 'center',
		marginBottom: 8,
	},
	sliderTrack: {
		height: 4,
		borderRadius: 2,
		width: '100%',
	},
	sliderThumb: {
		width: 14,
		height: 14,
		borderRadius: 7,
		position: 'absolute',
		left: 0,
	},
	controlsMock: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-around',
		marginTop: 12,
		paddingHorizontal: 16,
	},
	playBtnMock: {
		width: 64,
		height: 64,
		borderRadius: 32,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
