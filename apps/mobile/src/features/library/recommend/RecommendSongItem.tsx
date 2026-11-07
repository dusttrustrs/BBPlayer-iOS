import { Icon as ExpoIcon } from '@expo/ui'
import { useRouter } from 'expo-router'
import { memo, useMemo } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'
import { Touchable } from 'react-native-gesture-handler'
import { Icon, Surface, Text, useTheme } from 'react-native-paper'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import { MenuView } from '@/components/common/FunctionalMenu'
import { VariantPlainText } from '@/components/common/VariantPlainText'
import useIsCurrentTrack from '@/hooks/player/useIsCurrentTrack'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useMenuActions } from '@/hooks/ui/useMenuActions'
import {
	LIST_ITEM_BORDER_RADIUS,
	LIST_ITEM_COVER_SIZE,
} from '@/theme/dimensions'
import { formatDurationToHHMMSS } from '@/utils/time'

import type { RecommendItem } from './types'

const PLAY_NEXT_ICON = ExpoIcon.select({
	ios: 'arrow.right.to.line.circle',
	android: import('@expo/material-symbols/skip_next.xml'),
})

const INFO_ICON = ExpoIcon.select({
	ios: 'doc.text',
	android: import('@expo/material-symbols/description.xml'),
})

const ADD_TO_PLAYLIST_ICON = ExpoIcon.select({
	ios: 'plus.rectangle.on.rectangle',
	android: import('@expo/material-symbols/playlist_add.xml'),
})

interface RecommendSongItemProps {
	item: RecommendItem
	onPress: () => void
	onPlayNext: () => void
}

export const RecommendSongItem = memo(function RecommendSongItem({
	item,
	onPress,
	onPlayNext,
}: RecommendSongItemProps) {
	const { colors } = useTheme()
	const dark = useColorScheme() === 'dark'
	const router = useRouter()
	const openModal = useModalStore((state) => state.open)
	const isCurrentTrack = useIsCurrentTrack(item.track.uniqueKey)

	const menuItems = useMemo(
		() => [
			{
				title: '下一首播放',
				image: PLAY_NEXT_ICON,
				onPress: onPlayNext,
			},
			{
				title: '添加到本地歌单',
				image: ADD_TO_PLAYLIST_ICON,
				onPress: () => {
					openModal('UpdateTrackLocalPlaylists', { track: item.track })
				},
			},
			...(item.rawBvid
				? [
						{
							title: '查看视频详情',
							image: INFO_ICON,
							onPress: () => {
								router.navigate({
									pathname: '/playlist/remote/multipage/[bvid]',
									params: { bvid: item.rawBvid },
								})
							},
						},
					]
				: []),
		],
		[item, onPlayNext, openModal, router],
	)

	const menuActions = useMenuActions(menuItems)

	const isTopThree = item.rank !== undefined && item.rank >= 1 && item.rank <= 3

	return (
		<Touchable
			androidRipple={{}}
			style={[
				styles.rectButton,
				{
					backgroundColor: isCurrentTrack
						? dark
							? 'rgba(255, 255, 255, 0.12)'
							: 'rgba(0, 0, 0, 0.08)'
						: 'transparent',
				},
			]}
			onPress={onPress}
		>
			<Surface
				style={styles.surface}
				elevation={0}
			>
				<View style={styles.itemContainer}>
					{/* 排名列 */}
					{item.rank !== undefined && (
						<View style={styles.rankContainer}>
							<Text
								variant='titleSmall'
								style={[
									styles.rankText,
									{
										color: isTopThree
											? colors.primary
											: colors.onSurfaceVariant,
										fontWeight: isTopThree ? 'bold' : 'normal',
									},
								]}
							>
								{item.rank}
							</Text>
						</View>
					)}

					{/* 封面 */}
					<CoverWithPlaceHolder
						id={item.id}
						cover={item.coverUrl}
						title={item.title}
						size={LIST_ITEM_COVER_SIZE}
					/>

					{/* 歌曲信息 */}
					<View style={styles.infoContainer}>
						<VariantPlainText
							variant='bodyMedium'
							numberOfLines={1}
							style={[
								styles.title,
								{
									color: isCurrentTrack ? colors.primary : colors.onSurface,
									fontWeight: isCurrentTrack ? 'bold' : '500',
								},
							]}
						>
							{item.title}
						</VariantPlainText>

						<View style={styles.detailsRow}>
							<VariantPlainText
								variant='bodySmall'
								numberOfLines={1}
								style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
							>
								{item.subtitle}
							</VariantPlainText>

							{item.heatOrPlayCount && (
								<>
									<Text
										variant='bodySmall'
										style={styles.dot}
									>
										•
									</Text>
									<VariantPlainText
										variant='bodySmall'
										numberOfLines={1}
										style={{ color: colors.onSurfaceVariant }}
									>
										{item.heatOrPlayCount}
									</VariantPlainText>
								</>
							)}

							{item.duration > 0 && (
								<>
									<Text
										variant='bodySmall'
										style={styles.dot}
									>
										•
									</Text>
									<VariantPlainText
										variant='bodySmall'
										numberOfLines={1}
										style={{ color: colors.onSurfaceVariant }}
									>
										{formatDurationToHHMMSS(item.duration)}
									</VariantPlainText>
								</>
							)}
						</View>
					</View>

					{/* 右侧更多操作菜单 */}
					<MenuView {...menuActions}>
						<Touchable
							androidRipple={{}}
							style={styles.menuButton}
						>
							<Icon
								source='dots-vertical'
								size={20}
								color={colors.primary}
							/>
						</Touchable>
					</MenuView>
				</View>
			</Surface>
		</Touchable>
	)
})

const styles = StyleSheet.create({
	rectButton: {
		paddingVertical: 3,
		borderRadius: LIST_ITEM_BORDER_RADIUS,
	},
	surface: {
		overflow: 'hidden',
		borderRadius: LIST_ITEM_BORDER_RADIUS,
		backgroundColor: 'transparent',
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 6,
		paddingVertical: 4,
	},
	rankContainer: {
		width: 30,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 4,
	},
	rankText: {
		fontSize: 15,
	},
	infoContainer: {
		flex: 1,
		marginLeft: 12,
		justifyContent: 'center',
	},
	title: {
		fontSize: 14,
		lineHeight: 20,
	},
	detailsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 2,
	},
	subtitle: {
		maxWidth: '50%',
	},
	dot: {
		marginHorizontal: 4,
		opacity: 0.6,
	},
	menuButton: {
		padding: 8,
		justifyContent: 'center',
		alignItems: 'center',
	},
})
