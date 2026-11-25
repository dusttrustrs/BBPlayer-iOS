import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
	Pressable,
	ScrollView,
	StyleSheet,
	useColorScheme,
	useWindowDimensions,
	View,
} from 'react-native'
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper'
import Animated, {
	FadeInDown,
	FadeOutDown,
	LinearTransition,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import { useFetchLyrics } from '@/hooks/mutations/lyrics'
import { useTrackLyricCandidates } from '@/hooks/queries/lyrics'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { Track } from '@/types/core/media'
import type { LyricFileData, LyricSearchResult } from '@/types/player/lyrics'
import * as Haptics from '@/utils/haptics'
import { formatDurationToHHMMSS } from '@/utils/time'

type SourceFilter = 'all' | 'netease' | 'qqmusic' | 'kugou'

const SOURCE_LABELS: Record<LyricSearchResult[0]['source'], string> = {
	netease: '网易云',
	qqmusic: 'QQ 音乐',
	kugou: '酷狗',
}

const FILTER_OPTIONS: { key: SourceFilter; label: string }[] = [
	{ key: 'all', label: '全部' },
	{ key: 'netease', label: '网易云' },
	{ key: 'qqmusic', label: 'QQ 音乐' },
	{ key: 'kugou', label: '酷狗' },
]

interface LyricSourcePickerProps {
	track: Track
	currentLyrics?: LyricFileData
	showTranslationToggle: boolean
	translationType: 'translation' | 'romaji'
	onToggleTranslation: () => void
	onEditLyrics: () => void
	onOpenOffsetMenu: () => void
	bottomOffset?: number
	rightOffset?: number
	compact?: boolean
}

export const LyricSourcePicker = memo(function LyricSourcePicker({
	track,
	currentLyrics,
	showTranslationToggle,
	translationType,
	onToggleTranslation,
	onEditLyrics,
	onOpenOffsetMenu,
	bottomOffset: customBottomOffset,
	rightOffset = 12,
	compact = false,
}: LyricSourcePickerProps) {
	const { colors } = useTheme()
	const isDark = useColorScheme() === 'dark'
	const insets = useSafeAreaInsets()
	const { width: windowWidth, height: windowHeight } = useWindowDimensions()

	const [expanded, setExpanded] = useState(false)
	const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
	const [pendingKey, setPendingKey] = useState<string | null>(null)

	const {
		data: candidates = [],
		isFetching,
		refetch,
	} = useTrackLyricCandidates(track, expanded)
	const { mutate: fetchLyrics, isPending: isFetchingLyrics } = useFetchLyrics()

	// 切歌时自动收起浮层并重置筛选
	useEffect(() => {
		setExpanded(false)
		setSourceFilter('all')
		setPendingKey(null)
	}, [track.uniqueKey])

	const filteredCandidates = useMemo(() => {
		if (sourceFilter === 'all') return candidates
		return candidates.filter((item) => item.source === sourceFilter)
	}, [candidates, sourceFilter])

	const handleToggleExpanded = useCallback(() => {
		void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
		setExpanded((prev) => !prev)
	}, [])

	const handleClose = useCallback(() => {
		setExpanded(false)
	}, [])

	const handleSelectCandidate = useCallback(
		(item: LyricSearchResult[0]) => {
			if (isFetchingLyrics) return
			void Haptics.performHaptics(Haptics.AndroidHaptics.Confirm)
			const itemKey = `${item.source}:${item.remoteId}`
			setPendingKey(itemKey)
			fetchLyrics(
				{
					uniqueKey: track.uniqueKey,
					item,
				},
				{
					onSettled: () => {
						setPendingKey(null)
					},
					onSuccess: () => {
						setExpanded(false)
					},
				},
			)
		},
		[fetchLyrics, isFetchingLyrics, track.uniqueKey],
	)

	const handleManualSearch = useCallback(() => {
		setExpanded(false)
		useModalStore.getState().open('ManualSearchLyrics', {
			uniqueKey: track.uniqueKey,
			initialQuery: track.title,
		})
	}, [track.title, track.uniqueKey])

	const bottomOffset = customBottomOffset ?? Math.max(insets.bottom, 12) + 4
	const fabSize = compact ? 42 : 46
	const fabIconSize = compact ? 19 : 21
	const popoverWidth = Math.min(
		312,
		Math.max(240, windowWidth - rightOffset * 2),
	)
	const maxListHeight = Math.min(
		248,
		Math.max(116, windowHeight - insets.top - bottomOffset - 224),
	)
	const surfaceBg = isDark
		? 'rgba(26, 26, 30, 0.94)'
		: 'rgba(255, 255, 255, 0.96)'
	const surfaceBorder = isDark
		? 'rgba(255, 255, 255, 0.14)'
		: 'rgba(0, 0, 0, 0.1)'
	const fabBg = expanded
		? colors.primaryContainer
		: isDark
			? 'rgba(255, 255, 255, 0.12)'
			: 'rgba(0, 0, 0, 0.08)'
	const fabBorder = expanded
		? colors.primary
		: isDark
			? 'rgba(255, 255, 255, 0.2)'
			: 'rgba(0, 0, 0, 0.12)'
	const fabIconColor = expanded
		? colors.onPrimaryContainer
		: isDark
			? 'rgba(255, 255, 255, 0.85)'
			: colors.onSurface

	const activeSource = currentLyrics?.misc?.source
	const activeRemoteId =
		currentLyrics?.misc?.remoteId !== undefined
			? String(currentLyrics.misc.remoteId)
			: undefined

	return (
		<View
			style={[StyleSheet.absoluteFill, { zIndex: 30 }]}
			pointerEvents='box-none'
		>
			{expanded && (
				<Pressable
					style={styles.backdrop}
					onPress={handleClose}
				/>
			)}

			{expanded && (
				<Animated.View
					entering={FadeInDown.duration(180)}
					exiting={FadeOutDown.duration(140)}
					layout={LinearTransition.duration(160)}
					style={[
						styles.popover,
						{
							right: rightOffset,
							width: popoverWidth,
							bottom: bottomOffset + fabSize + 10,
							backgroundColor: surfaceBg,
							borderColor: surfaceBorder,
						},
					]}
				>
					{/* 顶部标题栏 */}
					<View style={styles.header}>
						<View style={styles.headerTitleGroup}>
							<Text
								variant='titleSmall'
								style={styles.headerTitle}
							>
								歌词源选择
							</Text>
							{isFetching && (
								<ActivityIndicator
									size={14}
									color={colors.primary}
								/>
							)}
						</View>
						<View style={styles.headerActions}>
							<Pressable
								onPress={() => void refetch()}
								hitSlop={8}
								style={styles.iconActionBtn}
								accessibilityRole='button'
								accessibilityLabel='刷新歌词候选'
							>
								<Icon
									source='refresh'
									size={18}
									color={colors.onSurfaceVariant}
								/>
							</Pressable>
							<Pressable
								onPress={handleManualSearch}
								style={[
									styles.manualSearchPill,
									{ backgroundColor: colors.secondaryContainer },
								]}
								accessibilityRole='button'
								accessibilityLabel='手动搜索歌词'
							>
								<Icon
									source='magnify'
									size={14}
									color={colors.onSecondaryContainer}
								/>
								<Text
									variant='labelSmall'
									style={{ color: colors.onSecondaryContainer }}
								>
									手动搜索
								</Text>
							</Pressable>
						</View>
					</View>

					{/* 音源过滤标签 */}
					<View style={styles.filterRow}>
						{FILTER_OPTIONS.map((option) => {
							const active = sourceFilter === option.key
							return (
								<Pressable
									key={option.key}
									onPress={() => setSourceFilter(option.key)}
									style={[
										styles.filterChip,
										{
											backgroundColor: active
												? colors.primaryContainer
												: isDark
													? 'rgba(255, 255, 255, 0.08)'
													: 'rgba(0, 0, 0, 0.05)',
										},
									]}
								>
									<Text
										variant='labelSmall'
										style={{
											color: active
												? colors.onPrimaryContainer
												: colors.onSurfaceVariant,
											fontWeight: active ? '600' : '400',
										}}
									>
										{option.label}
									</Text>
								</Pressable>
							)
						})}
					</View>

					{/* 候选歌词列表 */}
					<ScrollView
						style={[styles.list, { maxHeight: maxListHeight }]}
						contentContainerStyle={styles.listContent}
						showsVerticalScrollIndicator={false}
						nestedScrollEnabled
					>
						{isFetching && filteredCandidates.length === 0 ? (
							<View style={styles.emptyBox}>
								<ActivityIndicator
									size='small'
									color={colors.primary}
								/>
								<Text
									variant='bodySmall'
									style={{ color: colors.onSurfaceVariant }}
								>
									正在匹配多平台歌词...
								</Text>
							</View>
						) : filteredCandidates.length === 0 ? (
							<View style={styles.emptyBox}>
								<Text
									variant='bodySmall'
									style={{ color: colors.onSurfaceVariant }}
								>
									未找到匹配歌词，可尝试点击右上角「手动搜索」
								</Text>
							</View>
						) : (
							filteredCandidates.map((item) => {
								const itemKey = `${item.source}:${item.remoteId}`
								const isSelected =
									activeSource === item.source &&
									activeRemoteId === String(item.remoteId)
								const isLoadingItem = pendingKey === itemKey
								return (
									<TouchableRipple
										key={itemKey}
										onPress={() => handleSelectCandidate(item)}
										disabled={isFetchingLyrics}
										style={[
											styles.candidateRow,
											isSelected && {
												backgroundColor: isDark
													? 'rgba(255, 255, 255, 0.08)'
													: 'rgba(0, 0, 0, 0.05)',
											},
										]}
									>
										<View style={styles.candidateInner}>
											<View style={styles.candidateCheckSlot}>
												{isLoadingItem ? (
													<ActivityIndicator
														size={14}
														color={colors.primary}
													/>
												) : isSelected ? (
													<Icon
														source='check'
														size={16}
														color={colors.primary}
													/>
												) : null}
											</View>
											<View style={styles.candidateTextCol}>
												<Text
													variant='bodyMedium'
													numberOfLines={1}
													style={{
														fontWeight: isSelected ? '700' : '500',
														color: isSelected
															? colors.primary
															: colors.onSurface,
													}}
												>
													{item.title}
												</Text>
												<Text
													variant='bodySmall'
													numberOfLines={1}
													style={{ color: colors.onSurfaceVariant }}
												>
													{`${item.artist || '未知歌手'} · ${formatDurationToHHMMSS(
														Math.round(item.duration || 0),
													)}`}
												</Text>
											</View>
											<View
												style={[
													styles.sourceBadge,
													{
														backgroundColor: isDark
															? 'rgba(255, 255, 255, 0.1)'
															: 'rgba(0, 0, 0, 0.06)',
													},
												]}
											>
												<Text
													variant='labelSmall'
													style={{
														color: colors.onSurfaceVariant,
														fontSize: 10,
													}}
												>
													{SOURCE_LABELS[item.source]}
												</Text>
											</View>
										</View>
									</TouchableRipple>
								)
							})
						)}
					</ScrollView>

					{/* 底部快捷歌词工具栏 */}
					<View style={[styles.footer, { borderTopColor: surfaceBorder }]}>
						<Pressable
							style={styles.footerBtn}
							onPress={() => {
								setExpanded(false)
								onOpenOffsetMenu()
							}}
						>
							<Icon
								source='tune-vertical'
								size={15}
								color={colors.onSurfaceVariant}
							/>
							<Text
								variant='labelSmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								时间轴偏移
							</Text>
						</Pressable>

						{showTranslationToggle && (
							<Pressable
								style={styles.footerBtn}
								onPress={() => {
									onToggleTranslation()
								}}
							>
								<Icon
									source='translate'
									size={15}
									color={colors.onSurfaceVariant}
								/>
								<Text
									variant='labelSmall'
									style={{ color: colors.onSurfaceVariant }}
								>
									{translationType === 'translation' ? '切罗马音' : '切翻译'}
								</Text>
							</Pressable>
						)}

						<Pressable
							style={styles.footerBtn}
							onPress={() => {
								setExpanded(false)
								onEditLyrics()
							}}
						>
							<Icon
								source='script-text-outline'
								size={15}
								color={colors.onSurfaceVariant}
							/>
							<Text
								variant='labelSmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								编辑歌词
							</Text>
						</Pressable>
					</View>
				</Animated.View>
			)}

			{/* 右下角圆形歌词源切换按钮 */}
			<Pressable
				onPress={handleToggleExpanded}
				style={({ pressed }) => [
					styles.fab,
					{
						right: rightOffset,
						bottom: bottomOffset,
						width: fabSize,
						height: fabSize,
						borderRadius: fabSize / 2,
						backgroundColor: fabBg,
						borderColor: fabBorder,
						opacity: pressed ? 0.78 : 1,
						transform: [{ scale: pressed ? 0.94 : 1 }],
					},
				]}
				accessibilityRole='button'
				accessibilityLabel='选择歌词源'
				testID='lyric-source-picker-button'
			>
				<Icon
					source={expanded ? 'close' : 'script-text-outline'}
					size={fabIconSize}
					color={fabIconColor}
				/>
			</Pressable>
		</View>
	)
})

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFill,
		zIndex: 19,
	},
	popover: {
		position: 'absolute',
		right: 12,
		width: 312,
		maxWidth: '92%',
		borderRadius: 18,
		borderWidth: 1,
		overflow: 'hidden',
		zIndex: 20,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.3,
		shadowRadius: 18,
		elevation: 10,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 14,
		paddingTop: 12,
		paddingBottom: 8,
	},
	headerTitleGroup: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	headerTitle: {
		fontWeight: '700',
	},
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	iconActionBtn: {
		width: 28,
		height: 28,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 14,
	},
	manualSearchPill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 999,
	},
	filterRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: 14,
		paddingBottom: 8,
	},
	filterChip: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
	},
	list: {
		maxHeight: 248,
	},
	listContent: {
		paddingVertical: 4,
	},
	emptyBox: {
		paddingVertical: 28,
		paddingHorizontal: 18,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	candidateRow: {
		paddingHorizontal: 12,
		paddingVertical: 9,
	},
	candidateInner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	candidateCheckSlot: {
		width: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	candidateTextCol: {
		flex: 1,
		gap: 2,
	},
	sourceBadge: {
		paddingHorizontal: 7,
		paddingVertical: 2,
		borderRadius: 6,
	},
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-around',
		borderTopWidth: StyleSheet.hairlineWidth,
		paddingVertical: 9,
		paddingHorizontal: 8,
	},
	footerBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	fab: {
		position: 'absolute',
		right: 12,
		width: 46,
		height: 46,
		borderRadius: 23,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 21,
	},
})
