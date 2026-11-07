import { useQuery } from '@tanstack/react-query'

import { bilibiliApi } from '@/lib/api/bilibili/api'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'

export const recommendQueryKeys = {
	all: ['bilibili', 'recommend'] as const,
	hotSongs: (listType = 1) =>
		[...recommendQueryKeys.all, 'hotSongs', listType] as const,
	musicRanking: () => [...recommendQueryKeys.all, 'musicRanking'] as const,
	musicRegionFeed: (page = 1, count = 20) =>
		[...recommendQueryKeys.all, 'musicRegionFeed', page, count] as const,
} as const

/**
 * 获取 B 站版权音乐热歌榜（当期）
 */
export function useGetHotSongsToplist(listType = 1) {
	return useQuery({
		queryKey: recommendQueryKeys.hotSongs(listType),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(bilibiliApi.getHotSongsToplist({ listType, signal })),
		staleTime: 10 * 60 * 1000, // 10分钟新鲜度
	})
}

/**
 * 获取 B 站音乐区排行榜（全站热门）
 */
export function useGetMusicRanking() {
	return useQuery({
		queryKey: recommendQueryKeys.musicRanking(),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(
				bilibiliApi.getPopularVideos({ partition: '1003', signal }),
			),
		staleTime: 15 * 60 * 1000, // 15分钟新鲜度
	})
}

/**
 * 获取 B 站音乐区推荐流
 */
export function useGetMusicRegionFeed(page = 1, count = 20) {
	return useQuery({
		queryKey: recommendQueryKeys.musicRegionFeed(page, count),
		queryFn: ({ signal }) =>
			returnOrThrowAsync(
				bilibiliApi.getMusicRegionFeed({ page, count, signal }),
			),
		staleTime: 5 * 60 * 1000,
	})
}
