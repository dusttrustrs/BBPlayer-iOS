import { bv2av } from '@/lib/api/bilibili/utils'
import type {
	BilibiliHotSong,
	BilibiliMusicFeedItem,
	BilibiliVideoDetails,
} from '@/types/apis/bilibili'
import type { BilibiliTrack } from '@/types/core/media'

export type RecommendCategory = 'hot' | 'rank' | 'feed'

export interface RecommendItem {
	id: string
	title: string
	subtitle: string
	coverUrl: string
	rank?: number
	heatOrPlayCount?: string
	duration: number
	track: BilibiliTrack
	rawBvid: string
}

function formatCount(count: number): string {
	if (!count || count <= 0) return ''
	if (count >= 100000000) {
		return `${(count / 100000000).toFixed(1)}亿`
	}
	if (count >= 10000) {
		return `${(count / 10000).toFixed(1)}万`
	}
	return String(count)
}

/**
 * 将热歌榜条目转换为 BilibiliTrack
 */
export function hotSongToTrack(song: BilibiliHotSong): BilibiliTrack {
	const bvid = song.creation_bvid || ''
	const avId = bvid ? bv2av(bvid) : 0
	return {
		id: avId,
		uniqueKey: `bilibili::${bvid || song.music_id}`,
		source: 'bilibili',
		title: song.music_title || song.creation_title,
		artist: {
			id: song.creation_up || 0,
			name: song.singer || song.creation_nickname || '未知歌手',
			remoteId: String(song.creation_up || 0),
			source: 'bilibili',
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		coverUrl: song.mv_cover || song.creation_cover || '',
		duration: song.creation_duration || 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		bilibiliMetadata: {
			bvid,
			cid: song.creation_first_cid ? song.creation_first_cid : null,
			isMultiPage: false,
			videoIsValid: true,
		},
	}
}

/**
 * 将热歌榜条目转换为统一渲染模型
 */
export function hotSongToRecommendItem(song: BilibiliHotSong): RecommendItem {
	const track = hotSongToTrack(song)
	const subtitle = song.album?.trim()
		? `${song.singer} · ${song.album}`
		: song.singer || song.creation_nickname || '未知歌手'
	return {
		id: `hot_${song.music_id}_${song.rank}`,
		title: song.music_title || song.creation_title,
		subtitle,
		coverUrl: song.mv_cover || song.creation_cover || '',
		rank: song.rank,
		heatOrPlayCount: song.heat ? `🔥 ${formatCount(song.heat)}` : undefined,
		duration: song.creation_duration || 0,
		track,
		rawBvid: song.creation_bvid || '',
	}
}

/**
 * 将音乐区热门稿件转换为 BilibiliTrack
 */
export function videoDetailsToTrack(
	video: BilibiliVideoDetails,
): BilibiliTrack {
	const avId = bv2av(video.bvid)
	return {
		id: avId,
		uniqueKey: `bilibili::${video.bvid}`,
		source: 'bilibili',
		title: video.title,
		artist: {
			id: video.owner.mid,
			name: video.owner.name,
			remoteId: String(video.owner.mid),
			source: 'bilibili',
			createdAt: new Date(video.pubdate * 1000),
			updatedAt: new Date(video.pubdate * 1000),
		},
		coverUrl: video.pic,
		duration: video.duration,
		createdAt: new Date(video.pubdate * 1000),
		updatedAt: new Date(video.pubdate * 1000),
		bilibiliMetadata: {
			bvid: video.bvid,
			cid: video.cid ?? null,
			isMultiPage: (video.pages?.length ?? 0) > 1,
			videoIsValid: true,
		},
	}
}

/**
 * 将音乐区热门稿件转换为统一渲染模型
 */
export function videoDetailsToRecommendItem(
	video: BilibiliVideoDetails,
	rank: number,
): RecommendItem {
	const track = videoDetailsToTrack(video)
	return {
		id: `rank_${video.bvid}`,
		title: video.title,
		subtitle: video.owner?.name ?? '未知UP主',
		coverUrl: video.pic,
		rank,
		duration: video.duration,
		track,
		rawBvid: video.bvid,
	}
}

/**
 * 将音乐区推荐流条目转换为 BilibiliTrack
 */
export function feedItemToTrack(item: BilibiliMusicFeedItem): BilibiliTrack {
	const avId = bv2av(item.bvid)
	return {
		id: avId,
		uniqueKey: `bilibili::${item.bvid}`,
		source: 'bilibili',
		title: item.title,
		artist: {
			id: item.author.mid,
			name: item.author.name,
			remoteId: String(item.author.mid),
			source: 'bilibili',
			createdAt: new Date(item.pubdate * 1000),
			updatedAt: new Date(item.pubdate * 1000),
		},
		coverUrl: item.cover,
		duration: item.duration,
		createdAt: new Date(item.pubdate * 1000),
		updatedAt: new Date(item.pubdate * 1000),
		bilibiliMetadata: {
			bvid: item.bvid,
			cid: item.cid ?? null,
			isMultiPage: false,
			videoIsValid: true,
		},
	}
}

/**
 * 将音乐区推荐流条目转换为统一渲染模型
 */
export function feedItemToRecommendItem(
	item: BilibiliMusicFeedItem,
): RecommendItem {
	const track = feedItemToTrack(item)
	return {
		id: `feed_${item.bvid}`,
		title: item.title,
		subtitle: item.author?.name ?? '未知UP主',
		coverUrl: item.cover,
		heatOrPlayCount: item.stat?.view
			? `${formatCount(item.stat.view)}播放`
			: undefined,
		duration: item.duration,
		track,
		rawBvid: item.bvid,
	}
}
