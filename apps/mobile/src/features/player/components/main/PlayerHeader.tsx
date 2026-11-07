import { DownloadState } from '@bbplayer/orpheus'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import Animated from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import IconButton from '@/components/common/IconButton'
import { usePlayerHeaderAnimation } from '@/features/player/hooks/usePlayerHeaderAnimation'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useBatchDownloadStatus } from '@/hooks/queries/orpheus'

export function PlayerHeader({
	onMorePress,
	onBack,
	index,
	scrollX,
}: {
	onMorePress: () => void
	onBack: () => void
	index: number
	scrollX?: SharedValue<number>
}) {
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const { data: downloadStatus } = useBatchDownloadStatus(
		currentTrack?.uniqueKey ? [currentTrack.uniqueKey] : [],
	)

	const title = currentTrack?.title ?? '正在播放'
	const statusText =
		downloadStatus?.[currentTrack?.uniqueKey ?? ''] === DownloadState.COMPLETED
			? '正在播放 (已缓存)'
			: '正在播放'

	const { titleStyle, statusStyle } = usePlayerHeaderAnimation(index, scrollX)

	const padLeft = Math.max(insets.left, 8) + 4
	const padRight = Math.max(insets.right, 8) + 4
	const symmetricTitleInset = Math.max(padLeft, padRight) + 52

	return (
		<View
			style={[
				styles.container,
				{
					paddingLeft: padLeft,
					paddingRight: padRight,
				},
			]}
		>
			<IconButton
				icon={index === 0 ? 'chevron-down' : 'chevron-left'}
				size={24}
				onPress={onBack}
			/>
			<View
				pointerEvents='none'
				style={[
					styles.titleContainer,
					{
						left: symmetricTitleInset,
						right: symmetricTitleInset,
					},
				]}
			>
				<Animated.View
					style={[styles.headerTextContainer, statusStyle]}
					pointerEvents='none'
				>
					<Text
						variant='titleMedium'
						numberOfLines={1}
						style={styles.text}
					>
						{statusText}
					</Text>
				</Animated.View>
				<Animated.View
					style={[styles.headerTextContainer, titleStyle]}
					pointerEvents='none'
				>
					<Text
						variant='titleMedium'
						numberOfLines={1}
						style={styles.text}
					>
						{title}
					</Text>
				</Animated.View>
			</View>
			<IconButton
				icon='dots-vertical'
				size={24}
				onPress={onMorePress}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 8,
		position: 'relative',
	},
	titleContainer: {
		position: 'absolute',
		top: 8,
		bottom: 8,
		justifyContent: 'center',
		alignItems: 'center',
		height: 40,
	},
	headerTextContainer: {
		...StyleSheet.absoluteFill,
		justifyContent: 'center',
		alignItems: 'center',
	},
	text: {
		textAlign: 'center',
	},
})
