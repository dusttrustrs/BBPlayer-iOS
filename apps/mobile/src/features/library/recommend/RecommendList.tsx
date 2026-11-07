import { LegendList } from '@legendapp/list/react-native'
import { memo, useCallback, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Button, Text, useTheme } from 'react-native-paper'

import { DataFetchingError } from '@/features/library/shared/DataFetchingError'
import { RecommendListSkeleton } from '@/features/library/skeletons/LibraryTabSkeleton'
import { useRemotePlaylist } from '@/features/playlist/remote/hooks/useRemotePlaylist'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	useGetHotSongsToplist,
	useGetMusicRanking,
	useGetMusicRegionFeed,
} from '@/hooks/queries/bilibili/recommend'
import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import { addToQueue } from '@/utils/player'
import toast from '@/utils/toast'

import { RecommendPlaylistCard } from './RecommendPlaylistCard'
import { RecommendSongItem } from './RecommendSongItem'
import {
	feedItemToRecommendItem,
	hotSongToRecommendItem,
	type RecommendCategory,
	type RecommendItem,
	videoDetailsToRecommendItem,
} from './types'

export const RecommendListComponent = memo(function RecommendListComponent() {
	const { colors } = useTheme()
	const haveTrack = useCurrentTrack()
	const { playTrack } = useRemotePlaylist()

	const [category, setCategory] = useState<RecommendCategory>('hot')
	const [feedPage, setFeedPage] = useState(1)
	const [refreshing, setRefreshing] = useState(false)

	// Queries for 3 recommendation categories
	const hotQuery = useGetHotSongsToplist(1)
	const rankQuery = useGetMusicRanking()
	const feedQuery = useGetMusicRegionFeed(feedPage, 20)

	// Items for current category
	const items: RecommendItem[] = useMemo(() => {
		switch (category) {
			case 'hot':
				return hotQuery.data?.list.map(hotSongToRecommendItem) ?? []
			case 'rank':
				return (
					rankQuery.data
						?.slice(0, 30)
						.map((video, index) =>
							videoDetailsToRecommendItem(video, index + 1),
						) ?? []
				)
			case 'feed':
				return feedQuery.data?.map(feedItemToRecommendItem) ?? []
		}
	}, [category, hotQuery.data, rankQuery.data, feedQuery.data])

	// Active query state
	const activeQuery =
		category === 'hot' ? hotQuery : category === 'rank' ? rankQuery : feedQuery

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		await activeQuery.refetch()
		setRefreshing(false)
	}, [activeQuery])

	const onNextBatch = useCallback(() => {
		setFeedPage((prev) => (prev >= 10 ? 1 : prev + 1))
	}, [])

	const onPlayAll = useCallback(async () => {
		if (items.length === 0) return
		const tracks = items.map((i) => i.track)
		for (const t of tracks) {
			void syncFacade.addTrackToLocal(t)
		}
		const success = await addToQueue({
			tracks,
			playNow: true,
			clearQueue: true,
			startFromKey: tracks[0]?.uniqueKey,
			playNext: false,
		})
		if (success) {
			toast.success('已开始播放全部')
		}
	}, [items])

	const renderItem = useCallback(
		({ item }: { item: RecommendItem }) => (
			<RecommendSongItem
				item={item}
				onPress={() => void playTrack(item.track, false)}
				onPlayNext={() => void playTrack(item.track, true)}
			/>
		),
		[playTrack],
	)

	const keyExtractor = useCallback((item: RecommendItem) => item.id, [])

	if (activeQuery.isPending && !activeQuery.data) {
		return <RecommendListSkeleton />
	}

	if (activeQuery.isError && items.length === 0) {
		return (
			<DataFetchingError
				text='推荐内容加载失败'
				onRetry={onRefresh}
			/>
		)
	}

	const hotCover =
		hotQuery.data?.list[0]?.mv_cover || hotQuery.data?.list[0]?.creation_cover
	const rankCover = rankQuery.data?.[0]?.pic
	const feedCover = feedQuery.data?.[0]?.cover

	const headerSubtitle =
		category === 'hot'
			? hotQuery.data?.period
				? `第 ${hotQuery.data.period} 期 · 官方版权周榜`
				: '官方版权音乐周榜'
			: category === 'rank'
				? '全站音乐稿件综合热度排行'
				: `第 ${feedPage} 批 · 音乐区精选推荐`

	const currentTitle =
		category === 'hot'
			? '热歌周榜'
			: category === 'rank'
				? '音乐区排行榜'
				: '发现音乐'

	const ListHeaderComponent = (
		<View style={styles.headerWrapper}>
			{/* 推荐歌单横向滑动卡片 */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.cardsScrollContent}
			>
				<RecommendPlaylistCard
					id='card_hot'
					title='热歌周榜'
					subtitle={
						hotQuery.data?.period
							? `第${hotQuery.data.period}期 · 20首`
							: '官方热歌 · 20首'
					}
					badge='官方榜单'
					icon='fire'
					coverUrl={hotCover}
					isSelected={category === 'hot'}
					onPress={() => setCategory('hot')}
				/>

				<RecommendPlaylistCard
					id='card_rank'
					title='音乐区排行榜'
					subtitle='综合热门 · 30首'
					badge='热门'
					icon='trophy'
					coverUrl={rankCover}
					isSelected={category === 'rank'}
					onPress={() => setCategory('rank')}
				/>

				<RecommendPlaylistCard
					id='card_feed'
					title='发现音乐'
					subtitle={`第 ${feedPage} 批 · 换一批`}
					badge='推荐'
					icon='compass'
					coverUrl={feedCover}
					isSelected={category === 'feed'}
					onPress={() => setCategory('feed')}
				/>
			</ScrollView>

			{/* 当前选中的歌单头部信息与操作栏 */}
			<View style={styles.sectionHeader}>
				<View style={styles.sectionTitleCol}>
					<Text
						variant='titleMedium'
						style={styles.sectionTitle}
					>
						{currentTitle}
					</Text>
					<Text
						variant='bodySmall'
						style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}
					>
						{headerSubtitle}
					</Text>
				</View>

				<View style={styles.actionsRow}>
					{category === 'feed' && (
						<Button
							mode='text'
							compact
							icon='autorenew'
							loading={feedQuery.isFetching}
							onPress={onNextBatch}
							style={styles.actionBtn}
						>
							换一批
						</Button>
					)}

					<Button
						mode='contained-tonal'
						compact
						icon='play'
						onPress={onPlayAll}
						disabled={items.length === 0}
						style={styles.actionBtn}
					>
						播放全部
					</Button>
				</View>
			</View>
		</View>
	)

	return (
		<View style={styles.container}>
			<LegendList
				data={items}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				recycleItems
				ListHeaderComponent={ListHeaderComponent}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingBottom: haveTrack ? 165 : 80,
				}}
				refreshControl={
					<RefreshControl
						refreshing={refreshing || activeQuery.isRefetching}
						onRefresh={onRefresh}
						colors={[colors.primary]}
						progressViewOffset={50}
					/>
				}
				ListEmptyComponent={
					<View style={styles.emptyContainer}>
						<Text
							variant='bodyMedium'
							style={{ color: colors.onSurfaceVariant }}
						>
							暂无推荐曲目
						</Text>
					</View>
				}
			/>
		</View>
	)
})

const styles = StyleSheet.create({
	container: {
		flex: 1,
		marginHorizontal: 16,
	},
	headerWrapper: {
		paddingTop: 4,
		paddingBottom: 8,
	},
	cardsScrollContent: {
		paddingVertical: 6,
		paddingRight: 16,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 12,
		marginBottom: 8,
		paddingHorizontal: 2,
	},
	sectionTitleCol: {
		flex: 1,
		marginRight: 8,
	},
	sectionTitle: {
		fontWeight: 'bold',
	},
	sectionSubtitle: {
		marginTop: 2,
	},
	actionsRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	actionBtn: {
		borderRadius: 20,
	},
	emptyContainer: {
		paddingVertical: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
})

export default RecommendListComponent
