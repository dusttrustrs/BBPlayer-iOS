import ExpoModulesCore
import MMKV
import UIKit

private final class LiveActivityCoverHelper: @unchecked Sendable {
    static let shared = LiveActivityCoverHelper()

    private let lock = NSLock()
    private var cache: [String: [String: String]] = [:]
    private var cacheOrder: [String] = []
    private let workQueue = DispatchQueue(label: "com.bbplayer.orpheus.livecover", qos: .userInitiated)

    private init() {}

    func prepareCover(rawUrl: String, completion: @escaping ([String: String]) -> Void) {
        let trimmed = rawUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            completion([:])
            return
        }

        let normalized: String
        if trimmed.hasPrefix("//") {
            normalized = "https:" + trimmed
        } else if trimmed.hasPrefix("http://") {
            normalized = "https://" + String(trimmed.dropFirst("http://".count))
        } else {
            normalized = trimmed
        }

        lock.lock()
        if let hit = cache[normalized] {
            let pathOk: Bool
            if let cp = hit["coverPath"], !cp.isEmpty {
                pathOk = FileManager.default.fileExists(atPath: cp)
            } else {
                pathOk = true
            }
            if pathOk && !(hit["coverBase64"] ?? "").isEmpty && !(hit["waveMidColor"] ?? "").isEmpty {
                lock.unlock()
                completion(hit)
                return
            }
        }
        lock.unlock()

        workQueue.async { [weak self] in
            guard let self = self else {
                completion([:])
                return
            }
            self.loadImageData(for: normalized) { data in
                guard let data = data, let sourceImage = UIImage(data: data) else {
                    completion([:])
                    return
                }
                let encoded = self.encodeCoverOutputs(sourceImage: sourceImage, cacheKey: normalized)
                if !encoded.isEmpty {
                    self.lock.lock()
                    if self.cache[normalized] == nil {
                        self.cacheOrder.append(normalized)
                        if self.cacheOrder.count > 24 {
                            let evicted = self.cacheOrder.removeFirst()
                            self.cache.removeValue(forKey: evicted)
                        }
                    }
                    self.cache[normalized] = encoded
                    self.lock.unlock()
                }
                completion(encoded)
            }
        }
    }

    private func loadImageData(for urlString: String, completion: @escaping (Data?) -> Void) {
        if urlString.hasPrefix("file://") {
            if let fileUrl = URL(string: urlString), let data = try? Data(contentsOf: fileUrl), !data.isEmpty {
                completion(data)
                return
            }
            let rawPath = String(urlString.dropFirst("file://".count))
            let decoded = rawPath.removingPercentEncoding ?? rawPath
            completion(try? Data(contentsOf: URL(fileURLWithPath: decoded)))
            return
        }
        if urlString.hasPrefix("/") {
            completion(try? Data(contentsOf: URL(fileURLWithPath: urlString)))
            return
        }

        var candidates: [String] = []
        if urlString.contains("hdslb.com") && !urlString.contains("@") && !urlString.contains("?") {
            candidates.append(urlString + "@240w_240h_1c.jpg")
        }
        candidates.append(urlString)

        fetchFirstValidCandidate(candidates, index: 0, completion: completion)
    }

    private func fetchFirstValidCandidate(_ candidates: [String], index: Int, completion: @escaping (Data?) -> Void) {
        guard index < candidates.count else {
            completion(nil)
            return
        }
        guard let url = URL(string: candidates[index]) else {
            fetchFirstValidCandidate(candidates, index: index + 1, completion: completion)
            return
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 8
        request.setValue("https://www.bilibili.com/", forHTTPHeaderField: "Referer")
        request.setValue(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
            forHTTPHeaderField: "User-Agent"
        )

        URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
            let statusOk = (response as? HTTPURLResponse).map { (200...299).contains($0.statusCode) } ?? true
            if statusOk, let data = data, !data.isEmpty, UIImage(data: data) != nil {
                completion(data)
            } else if let self = self {
                self.fetchFirstValidCandidate(candidates, index: index + 1, completion: completion)
            } else {
                completion(nil)
            }
        }.resume()
    }

    private func encodeCoverOutputs(sourceImage: UIImage, cacheKey: String) -> [String: String] {
        var result: [String: String] = [:]

        let gradient = Self.extractWaveGradientColors(from: sourceImage)
        result["waveTopColor"] = gradient.top
        result["waveMidColor"] = gradient.mid
        result["waveBottomColor"] = gradient.bottom

        if let groupDir = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.roitium.bbplayer"
        ) {
            let coversDir = groupDir.appendingPathComponent("live_covers", isDirectory: true)
            try? FileManager.default.createDirectory(at: coversDir, withIntermediateDirectories: true)
            let hashHex = Self.fnv1aHex(cacheKey)
            let fileUrl = coversDir.appendingPathComponent("live_cover_\(hashHex).jpg")
            let hiRes = Self.renderSquareImage(sourceImage, side: 160)
            if let jpeg = hiRes.jpegData(compressionQuality: 0.78) {
                if (try? jpeg.write(to: fileUrl, options: .atomic)) != nil {
                    result["coverPath"] = fileUrl.path
                    Self.pruneOldCovers(in: coversDir, keepCount: 8)
                }
            }
        }

        let attempts: [(CGFloat, CGFloat)] = [
            (48, 0.42),
            (44, 0.38),
            (40, 0.34),
            (36, 0.30)
        ]
        for (side, quality) in attempts {
            let thumb = Self.renderSquareImage(sourceImage, side: side)
            if let jpeg = thumb.jpegData(compressionQuality: quality) {
                let b64 = jpeg.base64EncodedString()
                if b64.utf8.count <= 1200 {
                    result["coverBase64"] = b64
                    break
                }
            }
        }

        return result
    }

    private static func extractWaveGradientColors(from image: UIImage) -> (top: String, mid: String, bottom: String) {
        let defaultColors = ("#FF9EBB", "#FB7299", "#D9467E")
        let sampled = renderSquareImage(image, side: 24)
        guard let cgImage = sampled.cgImage else { return defaultColors }

        let sampleSide = 24
        let bytesPerPixel = 4
        let bytesPerRow = sampleSide * bytesPerPixel
        var rawBytes = [UInt8](repeating: 0, count: sampleSide * sampleSide * bytesPerPixel)

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: &rawBytes,
            width: sampleSide,
            height: sampleSide,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        ) else {
            return defaultColors
        }

        context.interpolationQuality = .medium
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: sampleSide, height: sampleSide))

        let bucketCount = 12
        var bucketWeights = [CGFloat](repeating: 0, count: bucketCount)
        var bucketR = [CGFloat](repeating: 0, count: bucketCount)
        var bucketG = [CGFloat](repeating: 0, count: bucketCount)
        var bucketB = [CGFloat](repeating: 0, count: bucketCount)

        var fallbackWeight: CGFloat = 0
        var fallbackR: CGFloat = 0
        var fallbackG: CGFloat = 0
        var fallbackB: CGFloat = 0

        for y in 0..<sampleSide {
            let cy = abs(CGFloat(y) - CGFloat(sampleSide - 1) * 0.5) / (CGFloat(sampleSide) * 0.5)
            for x in 0..<sampleSide {
                let cx = abs(CGFloat(x) - CGFloat(sampleSide - 1) * 0.5) / (CGFloat(sampleSide) * 0.5)
                let offset = (y * sampleSide + x) * bytesPerPixel
                let r = CGFloat(rawBytes[offset]) / 255.0
                let g = CGFloat(rawBytes[offset + 1]) / 255.0
                let b = CGFloat(rawBytes[offset + 2]) / 255.0

                var h: CGFloat = 0
                var s: CGFloat = 0
                var v: CGFloat = 0
                UIColor(red: r, green: g, blue: b, alpha: 1.0)
                    .getHue(&h, saturation: &s, brightness: &v, alpha: nil)

                if v < 0.15 { continue }
                let centerBoost: CGFloat = (cx < 0.65 && cy < 0.65) ? 1.25 : 0.9

                if v > 0.20 && v < 0.95 {
                    let w = (0.2 + s) * v * centerBoost
                    fallbackWeight += w
                    fallbackR += r * w
                    fallbackG += g * w
                    fallbackB += b * w
                }

                if s < 0.14 || (v > 0.94 && s < 0.22) { continue }

                let vibranceWeight = pow(s, 1.35) * sqrt(v) * centerBoost
                let bin = min(bucketCount - 1, max(0, Int(floor(h * CGFloat(bucketCount)))))
                bucketWeights[bin] += vibranceWeight
                bucketR[bin] += r * vibranceWeight
                bucketG[bin] += g * vibranceWeight
                bucketB[bin] += b * vibranceWeight
            }
        }

        var bestBin = -1
        var bestWeight: CGFloat = 0
        for i in 0..<bucketCount {
            if bucketWeights[i] > bestWeight {
                bestWeight = bucketWeights[i]
                bestBin = i
            }
        }

        var baseHue: CGFloat = 0.95
        var baseSat: CGFloat = 0.68
        var baseBri: CGFloat = 0.95

        if bestBin >= 0 && bestWeight > 0.05 {
            let avgR = bucketR[bestBin] / bestWeight
            let avgG = bucketG[bestBin] / bestWeight
            let avgB = bucketB[bestBin] / bestWeight
            UIColor(red: avgR, green: avgG, blue: avgB, alpha: 1.0)
                .getHue(&baseHue, saturation: &baseSat, brightness: &baseBri, alpha: nil)
        } else if fallbackWeight > 0.05 {
            let avgR = fallbackR / fallbackWeight
            let avgG = fallbackG / fallbackWeight
            let avgB = fallbackB / fallbackWeight
            UIColor(red: avgR, green: avgG, blue: avgB, alpha: 1.0)
                .getHue(&baseHue, saturation: &baseSat, brightness: &baseBri, alpha: nil)
        } else {
            return defaultColors
        }

        let midSat = min(max(baseSat * 1.18, 0.66), 0.96)
        let midBri = min(max(baseBri * 1.12, 0.86), 0.98)

        let topHue = fmod(baseHue + 1.0 - 0.045, 1.0)
        let topSat = min(max(midSat * 0.66, 0.42), 0.82)
        let topBri = min(max(midBri * 1.10, 0.96), 1.0)

        let botHue = fmod(baseHue + 0.055, 1.0)
        let botSat = min(max(midSat * 1.10, 0.78), 1.0)
        let botBri = min(max(midBri * 0.74, 0.62), 0.84)

        let topColor = UIColor(hue: topHue, saturation: topSat, brightness: topBri, alpha: 1.0)
        let midColor = UIColor(hue: baseHue, saturation: midSat, brightness: midBri, alpha: 1.0)
        let botColor = UIColor(hue: botHue, saturation: botSat, brightness: botBri, alpha: 1.0)

        return (
            top: hexString(from: topColor),
            mid: hexString(from: midColor),
            bottom: hexString(from: botColor)
        )
    }

    private static func hexString(from color: UIColor) -> String {
        var r: CGFloat = 0.98
        var g: CGFloat = 0.45
        var b: CGFloat = 0.60
        color.getRed(&r, green: &g, blue: &b, alpha: nil)
        let ri = min(255, max(0, Int(round(r * 255.0))))
        let gi = min(255, max(0, Int(round(g * 255.0))))
        let bi = min(255, max(0, Int(round(b * 255.0))))
        return String(format: "#%02X%02X%02X", ri, gi, bi)
    }

    private static func renderSquareImage(_ source: UIImage, side: CGFloat) -> UIImage {
        let targetSize = CGSize(width: side, height: side)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1.0
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
        return renderer.image { _ in
            UIColor(white: 0.14, alpha: 1.0).setFill()
            UIRectFill(CGRect(origin: .zero, size: targetSize))
            let srcSize = source.size
            guard srcSize.width > 0, srcSize.height > 0 else { return }
            let scale = max(side / srcSize.width, side / srcSize.height)
            let drawW = srcSize.width * scale
            let drawH = srcSize.height * scale
            let drawRect = CGRect(
                x: (side - drawW) * 0.5,
                y: (side - drawH) * 0.5,
                width: drawW,
                height: drawH
            )
            source.draw(in: drawRect)
        }
    }

    private static func fnv1aHex(_ text: String) -> String {
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in text.utf8 {
            hash ^= UInt64(byte)
            hash &*= 0x100000001b3
        }
        return String(format: "%016llx", hash)
    }

    private static func pruneOldCovers(in directory: URL, keepCount: Int) {
        guard let urls = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        ), urls.count > keepCount else {
            return
        }
        let sorted = urls.sorted { a, b in
            let da = (try? a.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            let db = (try? b.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            return da > db
        }
        for stale in sorted.dropFirst(keepCount) {
            try? FileManager.default.removeItem(at: stale)
        }
    }
}

public class ExpoOrpheusModule: Module {

    private func setupEventListeners() {
        let manager = OrpheusPlayerManager.shared

        manager.onPlaybackStateChanged = { [weak self] state in
            self?.sendEvent("onPlaybackStateChanged", ["state": state.rawValue])
        }

        manager.onTrackStarted = { [weak self] trackId, reason in
            self?.sendEvent("onTrackStarted", [
                "trackId": trackId,
                "reason": reason.rawValue
            ])
        }

        manager.onPositionUpdate = { [weak self] position, duration, buffered in
            self?.sendEvent("onPositionUpdate", [
                "position": position,
                "duration": duration,
                "buffered": buffered
            ])
        }

        OrpheusDownloadManager.shared.onDownloadUpdated = { [weak self] task in
            self?.sendEvent("onDownloadUpdated", [
                "id": task.id,
                "state": task.state.rawValue,
                "percentDownloaded": task.percentDownloaded,
                "bytesDownloaded": task.bytesDownloaded,
                "contentLength": task.contentLength
            ])
        }

        manager.onTrackFinished = { [weak self] trackId, finalPosition, duration in
            self?.sendEvent("onTrackFinished", [
                "trackId": trackId,
                "finalPosition": finalPosition,
                "duration": duration
            ])
        }

        manager.onPlayerError = { [weak self] errorMsg in
            self?.sendEvent("onPlayerError", ["platform": "ios", "error": errorMsg])
        }

        manager.onIsPlayingChanged = { [weak self] isPlaying in
            self?.sendEvent("onIsPlayingChanged", ["status": isPlaying])
        }

        manager.onQueueChanged = { [weak self] in
            self?.sendEvent("onQueueChanged", [:])
        }
    }

    public func definition() -> ModuleDefinition {
        Name("Orpheus")


        Events(
            "onPlaybackStateChanged",
            "onPlayerError",
            "onPositionUpdate",
            "onIsPlayingChanged",
            "onDownloadUpdated",
            "onPlaybackSpeedChanged",
            "onSpectrumVisualizerError",
            "onSpectrumVisualizerEnabledChanged",
            "onHeadlessEvent",
            "onTrackStarted",
            "onTrackFinished",
            "onQueueChanged"
        )

        OnCreate {
            MMKV.initialize(rootDir: nil)
            self.setupEventListeners()
        }

        // MARK: - Preferences

        Property("preferredBilibiliCdn")
            .get { GeneralStorage.shared.preferredBilibiliCdn }
            .set { GeneralStorage.shared.preferredBilibiliCdn = $0 }

        Property("restorePlaybackPositionEnabled")
            .get { GeneralStorage.shared.isRestoreEnabled }
            .set { GeneralStorage.shared.isRestoreEnabled = $0 }

        Property("loudnessNormalizationEnabled")
            .get { GeneralStorage.shared.isLoudnessNormalizationEnabled }
            .set { GeneralStorage.shared.isLoudnessNormalizationEnabled = $0 }

        Property("autoplayOnStartEnabled")
            .get { GeneralStorage.shared.isAutoplayOnStartEnabled }
            .set { GeneralStorage.shared.isAutoplayOnStartEnabled = $0 }

        Property("isSpectrumVisualizerEnabled")
            .get { GeneralStorage.shared.isSpectrumVisualizerEnabled }
            .set {
                GeneralStorage.shared.isSpectrumVisualizerEnabled = $0
                self.sendEvent("onSpectrumVisualizerEnabledChanged", ["enabled": $0])
            }

    // MARK: - Getters

    AsyncFunction("getPosition") { () -> Double in
        return OrpheusPlayerManager.shared.getPosition()
    }

    AsyncFunction("getDuration") { () -> Double in
        return OrpheusPlayerManager.shared.getDuration()
    }

    AsyncFunction("getBuffered") { () -> Double in
        return OrpheusPlayerManager.shared.getBufferedPosition()
    }

    AsyncFunction("getIsPlaying") { () -> Bool in
        return OrpheusPlayerManager.shared.isPlaying()
    }

    AsyncFunction("getCurrentIndex") { () -> Int in
        return OrpheusPlayerManager.shared.getCurrentIndex()
    }

    AsyncFunction("getCurrentTrack") { () -> Track? in
        return OrpheusPlayerManager.shared.getCurrentTrack()
    }

    AsyncFunction("getQueue") { () -> [Track] in
        return OrpheusPlayerManager.shared.getQueue()
    }

    AsyncFunction("getIndexTrack") { (index: Int) -> Track? in
        return OrpheusPlayerManager.shared.getTrack(at: index)
    }

    AsyncFunction("getPlaybackSpeed") { () -> Double in
        return Double(OrpheusPlayerManager.shared.getPlaybackSpeed())
    }

    AsyncFunction("getRepeatMode") { () -> Int in
        return OrpheusPlayerManager.shared.repeatMode.rawValue
    }

    AsyncFunction("getAdjacentTracks") { () -> [String: Track?] in
        return OrpheusPlayerManager.shared.getAdjacentTracks()
    }

    AsyncFunction("getShuffleMode") { () -> Bool in
        return OrpheusPlayerManager.shared.shuffleMode
    }

    // MARK: - Controls

    AsyncFunction("play") {
        OrpheusPlayerManager.shared.play()
    }
    AsyncFunction("pause") {
        OrpheusPlayerManager.shared.pause()
    }

    AsyncFunction("skipToNext") {
        OrpheusPlayerManager.shared.playNext()
    }

    AsyncFunction("skipToPrevious") {
        OrpheusPlayerManager.shared.skipToPrevious()
    }

    AsyncFunction("seekTo") { (seconds: Double) in
        OrpheusPlayerManager.shared.seek(to: seconds)
    }

    AsyncFunction("skipTo") { (index: Int) in
        OrpheusPlayerManager.shared.skipTo(index: index)
    }

    AsyncFunction("addToEnd") { (tracks: [Track], startFromId: String?, clearQueue: Bool) in
        OrpheusPlayerManager.shared.addToEnd(tracks: tracks, startFromId: startFromId, clearQueue: clearQueue)
    }

    AsyncFunction("playNext") { (track: Track) in
        OrpheusPlayerManager.shared.addToNext(track: track)
    }

    AsyncFunction("removeTrack") { (index: Int) in
        OrpheusPlayerManager.shared.removeTrack(at: index)
    }

    AsyncFunction("moveTrack") { (fromIndex: Int, toIndex: Int) in
        OrpheusPlayerManager.shared.moveTrack(fromIndex: fromIndex, toIndex: toIndex)
    }

    AsyncFunction("clear") {
         OrpheusPlayerManager.shared.clearQueue()
    }

    AsyncFunction("reverseRemainingQueue") {
        OrpheusPlayerManager.shared.reverseRemainingQueue()
    }

    AsyncFunction("setPlaybackSpeed") { (speed: Double) in
        OrpheusPlayerManager.shared.setPlaybackSpeed(Float(speed))
    }

    Function("setBilibiliCookie") { (cookie: String) in
        BilibiliApi.shared.setCookie(cookie)
    }

    Function("setShuffleMode") { (enabled: Bool) in
        OrpheusPlayerManager.shared.setExecuteShuffleMode(enabled)
    }

    Function("setRepeatMode") { (mode: Int) in
        if let repeatMode = RepeatMode(rawValue: mode) {
            OrpheusPlayerManager.shared.setExecuteRepeatMode(repeatMode)
        }
    }

    Function("setSleepTimer") { (durationMs: Double) in
        OrpheusPlayerManager.shared.setSleepTimer(durationMs: durationMs)
    }

    Function("getSleepTimerEndTime") { () -> Double? in
        return OrpheusPlayerManager.shared.getSleepTimerEndTime()
    }

    Function("cancelSleepTimer") {
        OrpheusPlayerManager.shared.cancelSleepTimer()
    }

    // MARK: - Downloads

    Function("downloadTrack") { (track: Track) in
        OrpheusDownloadManager.shared.downloadTrack(track: track)
    }

    Function("multiDownload") { (tracks: [Track]) in
        OrpheusDownloadManager.shared.multiDownload(tracks: tracks)
    }

    Function("resumeDownload") { (id: String) in
        OrpheusDownloadManager.shared.resumeDownload(id: id)
    }

    Function("retryDownload") { (track: Track) in
        OrpheusDownloadManager.shared.downloadTrack(track: track)
    }

    Function("setDownloadMaxParallelTasks") { (_: Int) in
        // iOS download concurrency is currently managed by URLSession.
    }

    Function("removeDownload") { (id: String) in
        OrpheusDownloadManager.shared.removeDownload(id: id)
    }

    Function("removeDownloads") { (ids: [String]) in
        for id in ids {
            OrpheusDownloadManager.shared.removeDownload(id: id)
        }
    }

    Function("removeAllDownloads") {
        OrpheusDownloadManager.shared.removeAllDownloads()
    }

    Function("getDownloads") { () -> [DownloadTask] in
        return OrpheusDownloadManager.shared.getDownloads()
    }

    Function("getCompletedDownloadTasks") { () -> [DownloadTask] in
        return OrpheusDownloadManager.shared.getCompletedTasks()
    }

    Function("getDownloadStatusByIds") { (ids: [String]) -> [String: Int] in
        return OrpheusDownloadManager.shared.getDownloadStatusByIds(ids: ids)
    }

    Function("clearUncompletedDownloadTasks") {
        OrpheusDownloadManager.shared.clearUncompletedTasks()
    }

    Function("getUncompletedDownloadTasks") { () -> [DownloadTask] in
         return OrpheusDownloadManager.shared.getUncompletedTasks()
    }

    AsyncFunction("checkOverlayPermission") { () -> Bool in
        return false
    }

    AsyncFunction("requestOverlayPermission") {
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("showDesktopLyrics") {
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("hideDesktopLyrics") {
         throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("setDesktopLyricsSuppressed") { (_: Bool) in
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("clearOverlays") {
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("setLyricsInternal") { (_: String, _: [String]) in
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("setDesktopLyricsInternal") { (lyricsJson: String) in
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("setStatusBarLyricsInternal") { (lyricsJson: String) in
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    AsyncFunction("prepareLiveActivityCover") { (coverUrl: String, promise: Promise) in
        LiveActivityCoverHelper.shared.prepareCover(rawUrl: coverUrl) { result in
            promise.resolve(result)
        }
    }

    AsyncFunction("debugTriggerError") {
        throw NSError(domain: "Orpheus", code: 1, userInfo: [NSLocalizedDescriptionKey: "Platform not supported"])
    }

    Function("updateSpectrumData") { (destination: TypedArray) in
        let count = destination.length
        // Get the unsafe pointer to valid memory
        let pointer = destination.getUnsafeMutablePointer(Float32.self)

        if let ptr = pointer {
            AudioSpectrumAnalyzer.shared.fillSpectrumData(destination: ptr, count: count)
        }
    }

  }
}
