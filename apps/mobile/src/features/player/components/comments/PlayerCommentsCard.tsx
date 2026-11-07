import { LegendList } from '@legendapp/list/react-native'
import { useRouter } from 'expo-router'
import { memo, useCallback, useMemo } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Divider, Text, useTheme } from 'react-native-paper'
import Animated, {
	Easing,
	useAnimatedStyle,
	withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import IconButton from '@/components/common/IconButton'
import { CommentItem } from '@/features/comments/components/CommentItem'
import { useComments } from '@/hooks/queries/bilibili/comments'
import { usePlayerCommentsStore } from '@/hooks/stores/usePlayerCommentsStore'
import type { BilibiliCommentItem } from '@/types/apis/bilibili'
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'
import * as Haptics from '@/utils/haptics'

interface PlayerCommentsCardProps {
	bvid?: string
	isLandscape?: boolean
}

const renderCommentItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	BilibiliCommentItem,
	{ bvid: string; onReplyPress: (item: BilibiliCommentItem) => void }
>) => {
	if (!extraData) return null
	const { bvid, onReplyPress } = extraData
	return (
		<CommentItem
			item={item}
			bvid={bvid}
			onReplyPress={onReplyPress}
		/>
	)
}

export const PlayerCommentsCard = memo(function PlayerCommentsCard({
	bvid,
	isLandscape = false,
}: PlayerCommentsCardProps) {
	const theme = useTheme()
	const colors = theme.colors
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const { height } = useWindowDimensions()

	const isOpen = usePlayerCommentsStore((state) => state.isOpen)
	const isExpanded = usePlayerCommentsStore((state) => state.isExpanded)
	const close = usePlayerCommentsStore((state) => state.close)
	const toggleExpanded = usePlayerCommentsStore((state) => state.toggleExpanded)
	const setExpanded = usePlayerCommentsStore((state) => state.setExpanded)

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		refetch,
		isRefetching,
	} = useComments(bvid ?? '', 3, { enabled: isOpen && !!bvid })

	const comments = useMemo(
		() => data?.pages.flatMap((page) => page.replies ?? []) ?? [],
		[data],
	)
	const totalCount = data?.pages[0]?.cursor?.all_count

	const onReplyPress = useCallback(
		(item: BilibiliCommentItem) => {
			if (!bvid) return
			router.navigate({
				pathname: '/comments/reply',
				params: { bvid, rpid: item.rpid },
			})
		},
		[bvid, router],
	)

	const extraData = useMemo(
		() => ({ bvid: bvid ?? '', onReplyPress }),
		[bvid, onReplyPress],
	)

	const keyExtractor = useCallback(
		(item: BilibiliCommentItem) => item.rpid.toString(),
		[],
	)

	const ItemSeparatorComponent = useCallback(() => <Divider />, [])

	const cardHeight = Math.min(height * 0.52, 440)
	const fullHeight = height - insets.top - 56

	const headerPanGesture = useMemo(() => {
		return Gesture.Pan()
			.activeOffsetY([-15, 15])
			.failOffsetX([-25, 25])
			.onEnd((e) => {
				'worklet'
				if (e.translationY < -30) {
					scheduleOnRN(() => {
						void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
						setExpanded(true)
					})
				} else if (e.translationY > 30) {
					scheduleOnRN(() => {
						void Haptics.performHaptics(Haptics.AndroidHaptics.Context_Click)
						if (isExpanded) {
							setExpanded(false)
						} else {
							close()
						}
					})
				}
			})
	}, [isExpanded, setExpanded, close])

	// 线性动画：完全避免弹性效果；固定高度 fullHeight，仅通过 translateY 控制露出范围，杜绝 UI 线程高度布局闪退
	const portraitCardStyle = useAnimatedStyle(() => {
		const targetY = !isOpen
			? fullHeight + 100
			: isExpanded
				? 0
				: fullHeight - cardHeight

		return {
			transform: [
				{
					translateY: withTiming(targetY, {
						duration: 250,
						easing: Easing.linear,
					}),
				},
			],
		}
	}, [isOpen, isExpanded, fullHeight, cardHeight])

	const backdropStyle = useAnimatedStyle(() => {
		return {
			opacity: withTiming(isOpen ? 1 : 0, {
				duration: 220,
				easing: Easing.linear,
			}),
		}
	}, [isOpen])

	// 横屏模式：卡片占据右侧控制区域
	if (isLandscape) {
		if (!isOpen) return null
		return (
			<View
				style={[
					styles.landscapeCard,
					{ backgroundColor: colors.elevation.level2 },
				]}
			>
				<View style={styles.header}>
					<View style={styles.titleContainer}>
						<Text
							variant='titleMedium'
							style={styles.titleText}
						>
							评论区 {totalCount !== undefined ? `(${totalCount})` : ''}
						</Text>
					</View>
					<IconButton
						icon='close'
						size={20}
						onPress={close}
					/>
				</View>
				<Divider />
				<View style={styles.content}>
					{!bvid ? (
						<View style={styles.center}>
							<Text style={{ color: colors.onSurfaceVariant }}>
								当前歌曲非哔哩哔哩音源，暂无评论
							</Text>
						</View>
					) : isLoading ? (
						<View style={styles.center}>
							<ActivityIndicator
								size='small'
								color={colors.primary}
							/>
						</View>
					) : (
						<LegendList
							data={comments}
							extraData={extraData}
							keyExtractor={keyExtractor}
							renderItem={renderCommentItem}
							recycleItems
							onEndReached={() => {
								if (hasNextPage) void fetchNextPage()
							}}
							onEndReachedThreshold={0.5}
							ListFooterComponent={() =>
								isFetchingNextPage ? (
									<ActivityIndicator
										style={styles.footer}
										color={colors.primary}
									/>
								) : null
							}
							refreshing={isRefetching}
							onRefresh={refetch}
							contentContainerStyle={{ paddingBottom: 24 }}
							ItemSeparatorComponent={ItemSeparatorComponent}
						/>
					)}
				</View>
			</View>
		)
	}

	// 竖屏模式：固定高度为 fullHeight，以线性平移方式向上展开与收缩，杜绝高度重排闪退
	return (
		<>
			<Animated.View
				pointerEvents={isOpen ? 'auto' : 'none'}
				style={[
					StyleSheet.absoluteFill,
					{ backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: 90 },
					backdropStyle,
				]}
			>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={close}
				/>
			</Animated.View>
			<Animated.View
				pointerEvents={isOpen ? 'auto' : 'none'}
				style={[
					styles.portraitCard,
					portraitCardStyle,
					{
						height: fullHeight,
						backgroundColor: colors.elevation.level2,
						paddingBottom: insets.bottom,
					},
				]}
			>
				<GestureDetector gesture={headerPanGesture}>
					<Pressable
						style={styles.dragHandleArea}
						onPress={toggleExpanded}
					>
						<View
							style={[
								styles.dragHandlePill,
								{ backgroundColor: colors.outlineVariant },
							]}
						/>
						<View style={styles.header}>
							<View style={styles.titleContainer}>
								<Text
									variant='titleMedium'
									style={styles.titleText}
								>
									评论区 {totalCount !== undefined ? `(${totalCount})` : ''}
								</Text>
							</View>
							<View style={styles.headerActions}>
								<IconButton
									icon={isExpanded ? 'chevron-down' : 'chevron-up'}
									size={22}
									onPress={toggleExpanded}
									accessibilityLabel={
										isExpanded ? '缩小评论区' : '拉伸完整评论区'
									}
								/>
								<IconButton
									icon='close'
									size={22}
									onPress={close}
									accessibilityLabel='关闭评论区'
								/>
							</View>
						</View>
					</Pressable>
				</GestureDetector>
				<Divider />
				<View style={styles.content}>
					{!bvid ? (
						<View style={styles.center}>
							<Text style={{ color: colors.onSurfaceVariant }}>
								当前歌曲非哔哩哔哩音源，暂无评论
							</Text>
						</View>
					) : isLoading ? (
						<View style={styles.center}>
							<ActivityIndicator
								size='large'
								color={colors.primary}
							/>
						</View>
					) : (
						<LegendList
							data={comments}
							extraData={extraData}
							keyExtractor={keyExtractor}
							renderItem={renderCommentItem}
							recycleItems
							onEndReached={() => {
								if (hasNextPage) void fetchNextPage()
							}}
							onEndReachedThreshold={0.5}
							ListFooterComponent={() =>
								isFetchingNextPage ? (
									<ActivityIndicator
										style={styles.footer}
										color={colors.primary}
									/>
								) : null
							}
							refreshing={isRefetching}
							onRefresh={refetch}
							contentContainerStyle={{ paddingBottom: 24 }}
							ItemSeparatorComponent={ItemSeparatorComponent}
						/>
					)}
				</View>
			</Animated.View>
		</>
	)
})

const styles = StyleSheet.create({
	portraitCard: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.18,
		shadowRadius: 10,
		elevation: 16,
		zIndex: 99,
		overflow: 'hidden',
	},
	landscapeCard: {
		flex: 1,
		borderRadius: 20,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 8,
		overflow: 'hidden',
	},
	dragHandleArea: {
		paddingTop: 10,
	},
	dragHandlePill: {
		width: 38,
		height: 4,
		borderRadius: 2,
		alignSelf: 'center',
		marginBottom: 6,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingBottom: 8,
	},
	titleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	titleText: {
		fontWeight: '600',
	},
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	content: {
		flex: 1,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 24,
	},
	footer: {
		padding: 16,
	},
})
