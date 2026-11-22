import { DownloadState, Orpheus } from '@bbplayer/orpheus'
import { useCallback } from 'react'

import { playlistService } from '@/lib/services/playlistService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { addToQueue, getInternalPlayUri } from '@/utils/player'
import toast from '@/utils/toast'

const SCOPE = 'UI.Playlist.Local.Player'

export function useLocalPlaylistPlayer(
	playlistId: number,
	isOffline?: boolean,
	playableOfflineKeys?: Set<string>,
) {
	const playAll = useCallback(
		async (startFromId?: string) => {
			const tracksResult = await playlistService.getPlaylistTracks(playlistId)
			if (tracksResult.isErr()) {
				toastAndLogError('获取播放列表内容失败', tracksResult.error, SCOPE)
				return
			}
			let tracks = tracksResult.value.filter((item) =>
				item.source === 'bilibili' ? item.bilibiliMetadata.videoIsValid : true,
			)

			if (isOffline) {
				const originalLength = tracks.length
				const urisToCheck: { uniqueKey: string; uri: string }[] = []
				const keys = new Set<string>()

				for (const track of tracks) {
					if (track.source === 'local') {
						keys.add(track.uniqueKey)
						continue
					}
					const uri = getInternalPlayUri(track)
					if (uri) {
						urisToCheck.push({ uniqueKey: track.uniqueKey, uri })
					}
				}

				const validUris = new Set(
					Orpheus.getLruCachedUris(urisToCheck.map((u) => u.uri)),
				)
				const downloadStatus = await Orpheus.getDownloadStatusByIds(
					urisToCheck.map((u) => u.uniqueKey),
				)

				for (const item of urisToCheck) {
					if (
						validUris.has(item.uri) ||
						downloadStatus?.[item.uniqueKey] === DownloadState.COMPLETED
					) {
						keys.add(item.uniqueKey)
					}
				}

				tracks = tracks.filter((t) => keys.has(t.uniqueKey))

				if (tracks.length === 0) {
					toast.show('当前离线，没有可播放的已缓存歌曲')
					return
				}
				if (tracks.length < originalLength) {
					toast.show('当前离线，仅添加可播放的已缓存歌曲到播放队列')
				}
			}

			if (!tracks || tracks.length === 0) {
				return
			}

			try {
				await addToQueue({
					playlistId,
					tracks: tracks,
					playNow: true,
					clearQueue: true,
					startFromKey: startFromId,
					playNext: false,
				})
			} catch (error) {
				toastAndLogError('播放全部失败', error, SCOPE)
			}
		},
		[playlistId, isOffline],
	)

	const handleTrackPress = useCallback(
		(track: Track) => {
			if (track.source === 'bilibili' && !track.bilibiliMetadata.videoIsValid) {
				return
			}
			if (
				isOffline &&
				playableOfflineKeys &&
				!playableOfflineKeys.has(track.uniqueKey)
			) {
				toast.show('当前无网络，无法播放，请检查网络设置')
				return
			}
			void addToQueue({
				playlistId,
				tracks: [track],
				playNow: true,
				clearQueue: false,
				startFromKey: track.uniqueKey,
				playNext: false,
			})
		},
		[playlistId, isOffline, playableOfflineKeys],
	)

	return { playAll, handleTrackPress }
}
