import { LegendList } from '@legendapp/list/react-native'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Dialog, Text, TouchableRipple } from 'react-native-paper'
import { Searchbar as SearchBar } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import { useFetchLyrics } from '@/hooks/mutations/lyrics'
import { useManualSearchLyrics } from '@/hooks/queries/lyrics'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'
import type { LyricSearchResult } from '@/types/player/lyrics'
import { formatDurationToHHMMSS } from '@/utils/time'

const SOURCE_MAP = {
	netease: '网易云',
	qqmusic: 'QQ 音乐',
	kuwo: '酷我',
	kugou: '酷狗',
	baidu: '百度',
}

const renderItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	LyricSearchResult[0],
	{
		isFetchingLyrics: boolean
		handlePressItem: (item: LyricSearchResult[0]) => void
	}
>) => {
	if (!extraData) throw new Error('Extradata 不存在')
	return (
		<SearchItem
			item={item}
			onPress={extraData.handlePressItem}
			disabled={extraData.isFetchingLyrics}
		/>
	)
}

const SearchItem = memo(function SearchItem({
	item,
	onPress,
	disabled,
}: {
	item: LyricSearchResult[0]
	onPress: (item: LyricSearchResult[0]) => void
	disabled: boolean
}) {
	return (
		<TouchableRipple
			style={styles.searchItem}
			onPress={() => onPress(item)}
			disabled={disabled}
		>
			<View style={styles.searchItemContent}>
				<Text variant='bodyMedium'>{item.title}</Text>
				<Text variant='bodySmall'>{`${item.artist} - ${formatDurationToHHMMSS(
					Math.round(item.duration),
				)} - ${SOURCE_MAP[item.source]}`}</Text>
			</View>
		</TouchableRipple>
	)
})

const ManualSearchLyricsModal = ({
	uniqueKey,
	initialQuery,
}: {
	uniqueKey: string
	initialQuery: string
}) => {
	const [query, setQuery] = useState(initialQuery)
	const close = useModalStore((state) => state.close)
	const { height: windowHeight } = useWindowDimensions()
	const isCompactHeight = windowHeight < 500
	const scrollAreaHeight = isCompactHeight
		? Math.min(220, Math.max(96, windowHeight - 220))
		: 300

	const {
		results: searchResult,
		search: searchIt,
		isLoading: isSearching,
	} = useManualSearchLyrics(uniqueKey)
	const { mutate: fetchLyrics, isPending: isFetchingLyrics } = useFetchLyrics()
	const handlePressItem = useCallback(
		(item: LyricSearchResult[0]) => {
			fetchLyrics(
				{
					uniqueKey,
					item,
				},
				{ onSuccess: () => close('ManualSearchLyrics') },
			)
		},
		[close, fetchLyrics, uniqueKey],
	)
	const extraData = useMemo(
		() => ({ isFetchingLyrics, handlePressItem }),
		[handlePressItem, isFetchingLyrics],
	)

	const keyExtractor = useCallback(
		(item: LyricSearchResult[0]) => item.remoteId.toString(),
		[],
	)

	const renderContent = () => {
		if (!searchResult) {
			return (
				<View style={styles.centerContainer}>
					<Text style={styles.centerText}>请修改搜索关键词并回车搜索</Text>
				</View>
			)
		}

		// When loading initially (no results yet)
		if (isSearching && searchResult.length === 0) {
			return (
				<View style={styles.centerContainer}>
					<ActivityIndicator size={'large'} />
				</View>
			)
		}

		if (searchResult.length > 0) {
			return (
				<LegendList
					data={searchResult}
					renderItem={renderItem}
					keyExtractor={keyExtractor}
					extraData={extraData}
					recycleItems
				/>
			)
		}

		// Search finished but nothing found
		if (!isSearching && searchResult.length === 0) {
			return (
				<View style={styles.centerContainer}>
					<Text style={styles.centerText}>没有找到匹配的歌词</Text>
				</View>
			)
		}

		// Fallback for edge cases
		return null
	}

	return (
		<>
			<Dialog.Title
				style={[
					styles.dialogTitle,
					isCompactHeight && styles.compactDialogTitle,
				]}
			>
				<View style={styles.titleContainer}>
					<Text variant={isCompactHeight ? 'titleLarge' : 'headlineSmall'}>
						手动搜索歌词
					</Text>
					{isSearching && (
						<ActivityIndicator
							size='small'
							style={styles.loadingIndicator}
						/>
					)}
				</View>
			</Dialog.Title>
			<Dialog.Content
				style={isCompactHeight ? styles.compactSearchContent : undefined}
			>
				<SearchBar
					value={query}
					onChangeText={setQuery}
					placeholder='输入歌曲名'
					onSubmitEditing={() => searchIt(query)}
					style={isCompactHeight ? styles.compactSearchBar : undefined}
					inputStyle={isCompactHeight ? styles.compactSearchInput : undefined}
				/>
			</Dialog.Content>
			<Dialog.ScrollArea
				style={[styles.scrollArea, { height: scrollAreaHeight }]}
			>
				{renderContent()}
			</Dialog.ScrollArea>
			<Dialog.Actions
				style={isCompactHeight ? styles.compactActions : undefined}
			>
				<Button
					onPress={() => close('ManualSearchLyrics')}
					disabled={isFetchingLyrics}
				>
					取消
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	searchItem: {
		flexDirection: 'column',
		paddingVertical: 8,
	},
	searchItemContent: {
		flexDirection: 'column',
	},
	centerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	centerText: {
		textAlign: 'center',
	},
	scrollArea: {
		height: 300,
	},
	loadingOverlay: {
		paddingVertical: 10,
		alignItems: 'center',
	},
	dialogTitle: {
		alignItems: 'center',
	},
	compactDialogTitle: {
		marginTop: 8,
		marginBottom: 8,
	},
	compactSearchContent: {
		paddingBottom: 10,
	},
	compactSearchBar: {
		height: 44,
	},
	compactSearchInput: {
		minHeight: 44,
	},
	compactActions: {
		paddingBottom: 10,
		paddingTop: 4,
	},
	titleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	loadingIndicator: {
		marginLeft: 8,
	},
})

export default ManualSearchLyricsModal
