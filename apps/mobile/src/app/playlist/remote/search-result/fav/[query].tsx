import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import { PlaylistError } from '@/features/playlist/remote/components/PlaylistError'
import { TrackList } from '@/features/playlist/remote/components/RemoteTrackList'
import { useTrackSelection } from '@/features/playlist/remote/hooks/useTrackSelection'
import {
	type SearchInputOverlayState,
	SearchResultHeader,
	type SearchResultHeaderHandle,
} from '@/features/playlist/remote/search-result/components/SearchResultHeader'
import { useSearchInteractions } from '@/features/playlist/remote/search-result/hooks/useSearchInteractions'
import { PlaylistTrackListSkeleton } from '@/features/playlist/skeletons/PlaylistSkeleton'
import SearchSuggestions from '@/features/search/SearchSuggestions'
import {
	useGetFavoritePlaylists,
	useInfiniteSearchFavoriteItems,
} from '@/hooks/queries/bilibili/favorite'
import { usePersonalInformation } from '@/hooks/queries/bilibili/user'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { useDoubleTapScrollToTop } from '@/hooks/ui/useDoubleTapScrollToTop'
import { bv2av } from '@/lib/api/bilibili/utils'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'
import type { BilibiliTrack, Track } from '@/types/core/media'

const mapApiItemToTrack = (
	apiItem: BilibiliFavoriteListContent,
): BilibiliTrack => {
	return {
		id: bv2av(apiItem.bvid),
		uniqueKey: `bilibili::${apiItem.bvid}`,
		source: 'bilibili',
		title: apiItem.title,
		artist: {
			id: apiItem.upper.mid,
			name: apiItem.upper.name,
			remoteId: apiItem.upper.mid.toString(),
			source: 'bilibili',
			avatarUrl: apiItem.upper.face,
			createdAt: new Date(apiItem.pubdate),
			updatedAt: new Date(apiItem.pubdate),
		},
		coverUrl: apiItem.cover,
		duration: apiItem.duration,
		createdAt: new Date(apiItem.pubdate),
		updatedAt: new Date(apiItem.pubdate),
		bilibiliMetadata: {
			bvid: apiItem.bvid,
			cid: null,
			isMultiPage: false,
			videoIsValid: apiItem.attr === 0,
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
	const [listHeight, setListHeight] = useState(0)
	const headerRef = useRef<SearchResultHeaderHandle | null>(null)
	const [searchOverlayState, setSearchOverlayState] =
		useState<SearchInputOverlayState>({
			isOpen: false,
			query: '',
			showSuggestions: false,
		})
	const deferredSuggestionQuery = useDeferredValue(searchOverlayState.query)
	const suggestionsVisible =
		searchOverlayState.showSuggestions &&
		searchOverlayState.query.trim().length > 0 &&
		deferredSuggestionQuery.trim().length > 0
	const openModal = useModalStore((state) => state.open)

	const { listRef, handleDoubleTap } = useDoubleTapScrollToTop()

	const { data: userData } = usePersonalInformation()
	const { data: favoriteFolderList } = useGetFavoritePlaylists(userData?.mid)
	const {
		data: searchData,
		isPending: isPendingSearchData,
		isError: isErrorSearchData,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		refetch,
	} = useInfiniteSearchFavoriteItems(
		'all',
		query,
		favoriteFolderList?.at(0)?.id,
	)
	const tracks = useMemo(
		() =>
			searchData?.pages
				.flatMap((page) => page.medias ?? [])
				.map(mapApiItemToTrack) ?? [],
		[searchData],
	)

	const { trackMenuItems, playTrack } = useSearchInteractions()

	const handleSubmitSearch = useCallback(
		(nextQuery: string) => {
			router.replace({
				pathname: '/playlist/remote/search-result/fav/[query]',
				params: { query: nextQuery },
			})
		},
		[router],
	)

	const handleSuggestionPress = useCallback(
		(nextQuery: string) => {
			headerRef.current?.collapse(false)
			const trimmed = nextQuery.trim()
			if (!trimmed || trimmed === (query ?? '').trim()) return
			handleSubmitSearch(trimmed)
		},
		[handleSubmitSearch, query],
	)

	const handleBatchAdd = useCallback(() => {
		const payloads = []
		for (const id of selected) {
			const track = tracks.find((t) => t.id === id)
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
	}, [openModal, selected, tracks])

	if (isPendingSearchData || !isListReady) {
		return <PlaylistTrackListSkeleton animate={isListReady} />
	}

	if (isErrorSearchData) {
		return <PlaylistError text='加载失败' />
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<SearchResultHeader
				headerRef={headerRef}
				query={query ?? ''}
				selectMode={selectMode}
				selectedCount={selected.size}
				onExitSelectMode={exitSelectMode}
				onBack={() => router.back()}
				onDoubleTap={handleDoubleTap}
				onSubmitSearch={handleSubmitSearch}
				onSearchStateChange={setSearchOverlayState}
				onBatchAdd={handleBatchAdd}
				placeholder='搜索收藏夹内视频'
			/>

			<View
				style={styles.listContainer}
				onLayout={({ nativeEvent }) => {
					const nextHeight = Math.floor(nativeEvent.layout.height)
					setListHeight((prev) => (prev === nextHeight ? prev : nextHeight))
				}}
			>
				<TrackList
					listRef={listRef}
					tracks={tracks}
					playTrack={playTrack}
					trackMenuItems={trackMenuItems}
					selection={selection}
					onEndReached={hasNextPage ? () => fetchNextPage() : undefined}
					hasNextPage={hasNextPage}
					isFetchingNextPage={isFetchingNextPage}
					ListHeaderComponent={null}
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
						<Text
							style={[styles.emptyListText, { color: colors.onSurfaceVariant }]}
						>
							没有在收藏中找到与&thinsp;&ldquo;{query}&rdquo;&thinsp;相关的内容
						</Text>
					}
				/>
				{searchOverlayState.isOpen && (
					<Pressable
						style={styles.suggestionsBackdrop}
						onPress={() => headerRef.current?.collapse(false)}
						accessibilityLabel='收起搜索建议'
					/>
				)}
				<View
					pointerEvents='box-none'
					style={styles.suggestionsOverlay}
				>
					<SearchSuggestions
						query={deferredSuggestionQuery}
						visible={suggestionsVisible}
						availableHeight={Math.max(0, listHeight - 24)}
						onSuggestionPress={handleSuggestionPress}
					/>
				</View>
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
		position: 'relative',
	},
	suggestionsBackdrop: {
		...StyleSheet.absoluteFill,
		zIndex: 15,
	},
	suggestionsOverlay: {
		position: 'absolute',
		top: 8,
		left: 16,
		right: 16,
		zIndex: 20,
	},
	emptyListText: {
		paddingVertical: 32,
		textAlign: 'center',
	},
})
