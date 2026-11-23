import { useQueries, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { kugouApi } from '@/lib/api/kugou/api'
import { neteaseApi } from '@/lib/api/netease/api'
import { qqMusicApi } from '@/lib/api/qqmusic/api'
import lyricService from '@/lib/services/lyricService'
import type { Track } from '@/types/core/media'
import type { LyricFileData, LyricSearchResult } from '@/types/player/lyrics'

import { lyricsQueryKeys } from './keys'

export { lyricsQueryKeys }

export const useSmartFetchLyrics = (enable: boolean, track?: Track) => {
	const enabled = !!track && enable
	// oxlint-disable-next-line @tanstack/query/exhaustive-deps -- 同一 uniqueKey 的歌词是唯一缓存实体，track 仅供缓存未命中时获取歌词。
	return useQuery({
		// 缓存以曲目唯一标识为准，保证编辑、清除和偏移量调整写入的
		// lyricsQueryKeys.smartFetchLyrics(uniqueKey) 能立即更新当前歌词页。
		queryKey: lyricsQueryKeys.smartFetchLyrics(track?.uniqueKey),
		queryFn: async () => {
			const result = await lyricService.smartFetchLyrics(track!)
			if (result.isErr()) {
				if (result.error.type === 'LyricNotFound') {
					return {
						id: track!.uniqueKey,
						updateTime: Date.now(),
						lrc: undefined,
						tlyric: undefined,
						romalrc: undefined,
						errorMessage: result.error.message,
						misc: undefined,
					} satisfies LyricFileData
				}
				throw result.error
			}
			// manualSkip: 用户已手动跳过该曲目的歌词获取
			if (result.value.manualSkip) {
				return {
					id: track!.uniqueKey,
					updateTime: result.value.updateTime,
					lrc: undefined,
					tlyric: undefined,
					romalrc: undefined,
					manualSkip: true,
					errorMessage: '已跳过歌词获取，但你可以重新搜索或编辑歌词',
					misc: undefined,
				} satisfies LyricFileData
			}
			return result.value
		},
		enabled,
		staleTime: 0,
		networkMode: 'always',
	})
}

export const useManualSearchLyrics = (uniqueKey?: string) => {
	const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined)

	const [results, setResults] = useState<LyricSearchResult>([])
	const processedProvidersRef = useRef<Set<string>>(new Set())

	// Effect to reset results when query changes - REMOVED
	// Moved to triggerSearch

	const queries = useQueries({
		queries: [
			{
				queryKey: lyricsQueryKeys.manualSearch(
					uniqueKey,
					`netease-${searchQuery}`,
				),
				queryFn: async ({ signal }) => {
					if (!searchQuery) return []
					const res = await neteaseApi.search(
						{
							keywords: searchQuery,
							limit: 20,
						},
						signal,
					)
					if (res.isOk()) {
						return res.value
					}
					throw res.error
				},
				enabled: !!searchQuery,
				staleTime: 0,
			},
			{
				queryKey: lyricsQueryKeys.manualSearch(uniqueKey, `qq-${searchQuery}`),
				queryFn: async ({ signal }) => {
					if (!searchQuery) return []
					const res = await qqMusicApi.search(searchQuery, 20, signal)
					if (res.isOk()) {
						return res.value
					}
					throw res.error
				},
				enabled: !!searchQuery,
				staleTime: 0,
			},
			{
				queryKey: lyricsQueryKeys.manualSearch(
					uniqueKey,
					`kugou-${searchQuery}`,
				),
				queryFn: async ({ signal }) => {
					if (!searchQuery) return []
					const res = await kugouApi.search(searchQuery, 20, signal)
					if (res.isOk()) {
						return res.value
					}
					throw res.error
				},
				enabled: !!searchQuery,
				staleTime: 0,
			},
		],
	})

	const neteaseQuery = queries[0]
	const qqQuery = queries[1]
	const kugouQuery = queries[2]

	const neteaseData = neteaseQuery.data
	const qqData = qqQuery.data
	const kugouData = kugouQuery.data

	// Effect to append results as they arrive
	useEffect(() => {
		const processResult = (
			providerName: string,
			data: LyricSearchResult | undefined,
		) => {
			if (data && !processedProvidersRef.current.has(providerName)) {
				setResults((prev) => [...prev, ...data])
				processedProvidersRef.current.add(providerName)
			}
		}

		if (neteaseData) processResult('netease', neteaseData)
		if (qqData) processResult('qq', qqData)
		if (kugouData) processResult('kugou', kugouData)
	}, [neteaseData, qqData, kugouData])

	const triggerSearch = useCallback((query: string) => {
		setResults([])
		processedProvidersRef.current = new Set()
		setSearchQuery(query)
	}, [])

	const isLoading = queries.some((q) => q.isFetching)

	return {
		search: triggerSearch,
		results,
		isLoading,
		errors: {
			netease: neteaseQuery.error,
			qq: qqQuery.error,
			kugou: kugouQuery.error,
		},
	}
}

export const useTrackLyricCandidates = (track?: Track, enabled = false) => {
	// oxlint-disable-next-line @tanstack/query/exhaustive-deps -- 同一 uniqueKey 对应同一曲目，缓存候选歌词列表
	return useQuery({
		queryKey: lyricsQueryKeys.trackCandidates(track?.uniqueKey),
		enabled: Boolean(track && enabled),
		staleTime: 5 * 60 * 1000,
		queryFn: async ({ signal }): Promise<LyricSearchResult> => {
			if (!track) return []
			const keyword = await lyricService.resolveSearchKeyword(track)
			const [neteaseRes, qqRes, kugouRes] = await Promise.allSettled([
				neteaseApi.search({ keywords: keyword, limit: 8 }, signal),
				qqMusicApi.search(keyword, 8, signal),
				kugouApi.search(keyword, 8, signal),
			])

			const combined: LyricSearchResult = []
			if (neteaseRes.status === 'fulfilled' && neteaseRes.value.isOk()) {
				combined.push(...neteaseRes.value.value)
			}
			if (qqRes.status === 'fulfilled' && qqRes.value.isOk()) {
				combined.push(...qqRes.value.value)
			}
			if (kugouRes.status === 'fulfilled' && kugouRes.value.isOk()) {
				combined.push(...kugouRes.value.value)
			}

			// 按时长接近度排序，让最贴合当前曲目的各源歌词排在前面
			const targetDuration = track.duration || 0
			if (targetDuration > 0) {
				combined.sort((a, b) => {
					const diffA = Math.abs((a.duration || 0) - targetDuration)
					const diffB = Math.abs((b.duration || 0) - targetDuration)
					return diffA - diffB
				})
			}

			return combined
		},
	})
}
