import { useLocalSearchParams, useRouter } from 'expo-router'
import { decode } from 'he'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { useMMKVObject } from 'react-native-mmkv'
import { Text, useTheme } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import { SearchResultHeader } from '@/features/playlist/remote/search-result/components/SearchResultHeader'
import { SearchUserHeader } from '@/features/playlist/remote/search-result/components/SearchUserHeader'
import { useSearchInteractions } from '@/features/playlist/remote/search-result/hooks/useSearchInteractions'
import {
	PlaylistTrackListSkeleton,
	TrackListItemSkeletonGroup,
} from '@/features/playlist/skeletons/PlaylistSkeleton'
import type { SearchHistoryItem } from '@/features/search/SearchHistory'
import { useSearchResults } from '@/hooks/queries/bilibili/search'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { analyticsService } from '@/lib/services/analyticsService'
import type { BilibiliSearchVideo } from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import {
	matchSearchStrategies,
	navigateWithSearchStrategy,
} from '@/utils/search'
import { formatMMSSToSeconds } from '@/utils/time'

const SEARCH_HISTORY_KEY = 'bilibili_search_history'
const MAX_SEARCH_HISTORY = 10

const mapApiItemToTrack = (apiItem: BilibiliSearchVideo): BilibiliTrack => {
	return {
		id: apiItem.aid,
		uniqueKey: `bilibili::${apiItem.bvid}`,
		source: 'bilibili',
		title: apiItem.title.replace(/<em[^>]*>|<\/em>/g, ''),
		artist: {
			id: apiItem.mid,
			name: apiItem.author,
			remoteId: apiItem.mid.toString(),
			source: 'bilibili',
			createdAt: new Date(apiItem.senddate),
			updatedAt: new Date(apiItem.senddate),
		},
		coverUrl: `https:${apiItem.pic}`,
		duration: apiItem.duration ? formatMMSSToSeconds(apiItem.duration) : 0,
		createdAt: new Date(apiItem.senddate),
		updatedAt: new Date(apiItem.senddate),
		titleHtml: apiItem.title,
		bilibiliMetadata: {
			bvid: apiItem.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: true,
		},
	}
}

export default function SearchResultsPage() {
	const isListReady = useScreenTransitionReady()
	const { colors } = useTheme()
	const { query } = useLocalSearchParams<{ query: string }>()
	const router = useRouter()

	const { selected, selectMode, toggle, enterSelectMode, exitSelectMode } =
		useTrackSelection()
	const selection = useMemo(
		() => ({
			active: selectMode,
			selected,
			toggle,
			enter: enterSelectMode,
		}),
		[selectMode, selected, toggle, enterSelectMode],
	)
	const [refreshing, setRefreshing] = useState(false)
	const [isSearching, setIsSearching] = useState(false)
	const [searchHistory, setSearchHistory] =
		useMMKVObject<SearchHistoryItem[]>(SEARCH_HISTORY_KEY)
	const openModal = useModalStore((state) => state.open)

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop()

	const {
		data: searchData,
		isPending: isPendingSearchData,
		isError: isErrorSearchData,
		hasNextPage,
		isFetchingNextPage,
		refetch,
		fetchNextPage,
	} = useSearchResults(query)

	useEffect(() => {
		if (query) {
			void analyticsService.logSearch('global')
		}
	}, [query])

	const { trackMenuItems, playTrack } = useSearchInteractions()

	const addSearchHistory = useCallback(
		(nextQuery: string) => {
			if (!nextQuery.trim()) return
			try {
				const newItem: SearchHistoryItem = {
					id: `history_${Date.now()}`,
					text: nextQuery,
					timestamp: Date.now(),
				}
				const currentHistory = searchHistory ?? []
				const filtered = currentHistory.filter(
					(item) => item.text.toLowerCase() !== nextQuery.toLowerCase(),
				)
				const newHistory = [newItem, ...filtered].slice(0, MAX_SEARCH_HISTORY)
				setSearchHistory(newHistory)
			} catch (error) {
				toastAndLogError('保存搜索历史失败', error, 'UI.Search')
			}
		},
		[searchHistory, setSearchHistory],
	)

	const handleSubmitSearch = useCallback(
		async (nextQuery: string) => {
			const trimmed = nextQuery.trim()
			if (!trimmed) return
			setIsSearching(true)
			try {
				const result = await matchSearchStrategies(trimmed)
				if (result.type === 'SEARCH') {
					addSearchHistory(result.query)
					router.replace({
						pathname: '/playlist/remote/search-result/global/[query]',
						params: { query: result.query },
					})
				} else if (navigateWithSearchStrategy(result, router) === 1) {
					addSearchHistory(trimmed)
				}
			} catch (error) {
				toastAndLogError('搜索失败，请重试', error, 'UI.Search')
			} finally {
				setIsSearching(false)
			}
		},
		[addSearchHistory, router],
	)

	const uniqueSearchData = useMemo(() => {
		if (!searchData?.pages) {
			return []
		}

		const allTracks = searchData.pages.flatMap((page) => page.result)
		const uniqueMap = new Map(
			allTracks.map((track) => [
				track.bvid,
				{
					...track,
					title: decode(track.title),
				},
			]),
		)
		const uniqueTracks = [...uniqueMap.values()]
		return uniqueTracks.map(mapApiItemToTrack)
	}, [searchData])

	const handleBatchAdd = useCallback(() => {
		const payloads = []
		for (const id of selected) {
			const track = uniqueSearchData.find((t) => t.id === id)
			if (track) {
				payloads.push({
					track: track as Track,
					artist: track.artist!,
				})
			}
		}
		openModal('BatchAddTracksToLocalPlaylist', {
			payloads,
		})
	}, [openModal, selected, uniqueSearchData])

	if (!isListReady) {
		return <PlaylistTrackListSkeleton animate={isListReady} />
	}

	if (isErrorSearchData) {
		return <PlaylistError text='加载失败' />
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<SearchResultHeader
				query={query ?? ''}
				selectMode={selectMode}
				selectedCount={selected.size}
				onExitSelectMode={exitSelectMode}
				onBack={() => router.back()}
				onDoubleTap={handleDoubleTap}
				onSubmitSearch={handleSubmitSearch}
				onBatchAdd={handleBatchAdd}
				isSubmitting={isSearching}
			/>

			<View style={styles.listContainer}>
				<TrackList
					listRef={listRef}
					tracks={uniqueSearchData ?? []}
					playTrack={playTrack}
					trackMenuItems={trackMenuItems}
					selection={selection}
					onEndReached={hasNextPage ? () => fetchNextPage() : undefined}
					hasNextPage={hasNextPage}
					isFetchingNextPage={isFetchingNextPage}
					ListHeaderComponent={<SearchUserHeader query={query} />}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={async () => {
								setRefreshing(true)
								await refetch()
								setRefreshing(false)
							}}
							colors={[colors.primary]}
							progressViewOffset={50}
						/>
					}
					ListEmptyComponent={
						isPendingSearchData ? (
							<View>
								<View style={styles.videoLoadingRow}>
									<Text
										variant='titleMedium'
										style={[
											styles.videoSectionTitle,
											{ color: colors.onSurface },
										]}
									>
										相关视频
									</Text>
									<ActivityIndicator
										size='small'
										style={{ marginLeft: 8 }}
									/>
								</View>
								<TrackListItemSkeletonGroup
									count={10}
									animate
								/>
							</View>
						) : (
							<Text
								style={[
									styles.emptyListText,
									{ color: colors.onSurfaceVariant },
								]}
							>
								没有找到与&thinsp;&ldquo;{query}&rdquo;&thinsp;相关的内容
							</Text>
						)
					}
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	listContainer: {
		flex: 1,
	},
	emptyListText: {
		paddingVertical: 32,
		textAlign: 'center',
	},
	videoLoadingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		marginTop: 18,
		marginBottom: 4,
	},
	videoSectionTitle: {
		fontWeight: 'bold',
	},
})
