import CoreGraphics
import ExpoModulesCore
import swift_vibrant
import UIKit

struct SwatchRecord: Record {
  @Field
  var hex: String = ""

  @Field
  var titleTextColor: String = ""

  @Field
  var bodyTextColor: String = ""

  @Field
  var population: Int = 0
}

struct PaletteRecord: Record {
  @Field
  var width: Double = 0

  @Field
  var height: Double = 0

  @Field
  var dominant: SwatchRecord?

  @Field
  var vibrant: SwatchRecord?

  @Field
  var lightVibrant: SwatchRecord?

  @Field
  var darkVibrant: SwatchRecord?

  @Field
  var muted: SwatchRecord?

  @Field
  var lightMuted: SwatchRecord?

  @Field
  var darkMuted: SwatchRecord?

  @Field
  var swatches: [SwatchRecord] = []
}

private func downsampleImageForPalette(_ image: UIImage, maxDimension: CGFloat = 128) -> UIImage {
  guard let cgImage = image.cgImage else {
    return image
  }
  let srcWidth = CGFloat(cgImage.width)
  let srcHeight = CGFloat(cgImage.height)
  let maxSide = max(srcWidth, srcHeight)
  guard maxSide > maxDimension, srcWidth > 0, srcHeight > 0 else {
    return image
  }

  let scale = maxDimension / maxSide
  let targetWidth = max(1, Int((srcWidth * scale).rounded()))
  let targetHeight = max(1, Int((srcHeight * scale).rounded()))
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue

  guard let context = CGContext(
    data: nil,
    width: targetWidth,
    height: targetHeight,
    bitsPerComponent: 8,
    bytesPerRow: targetWidth * 4,
    space: colorSpace,
    bitmapInfo: bitmapInfo
  ) else {
    return image
  }

  context.interpolationQuality = .medium
  context.draw(cgImage, in: CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
  guard let scaledCg = context.makeImage() else {
    return image
  }
  return UIImage(cgImage: scaledCg)
}

private func loadImageFromStringSource(_ rawSource: String) throws -> UIImage {
  let trimmed = rawSource.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmed.isEmpty else {
    throw Exception(name: "InvalidSource", description: "Empty image source string")
  }

  if trimmed.hasPrefix("file://"), let fileUrl = URL(string: trimmed) {
    let data = try Data(contentsOf: fileUrl)
    guard let img = UIImage(data: data) else {
      throw Exception(name: "ImageLoadingFailed", description: "Could not decode local file image")
    }
    return img
  }

  if trimmed.hasPrefix("/") {
    let fileUrl = URL(fileURLWithPath: trimmed)
    let data = try Data(contentsOf: fileUrl)
    guard let img = UIImage(data: data) else {
      throw Exception(name: "ImageLoadingFailed", description: "Could not decode local path image")
    }
    return img
  }

  guard let url = URL(string: trimmed) else {
    throw Exception(name: "InvalidSource", description: "Invalid image URL string")
  }

  let semaphore = DispatchSemaphore(value: 0)
  var fetchedData: Data?
  var fetchError: Error?

  var request = URLRequest(url: url)
  request.timeoutInterval = 10
  let task = URLSession.shared.dataTask(with: request) { data, _, error in
    fetchedData = data
    fetchError = error
    semaphore.signal()
  }
  task.resume()
  _ = semaphore.wait(timeout: .now() + 12)

  if let fetchError = fetchError {
    throw Exception(name: "ImageLoadingFailed", description: fetchError.localizedDescription)
  }
  guard let data = fetchedData, let img = UIImage(data: data) else {
    throw Exception(name: "ImageLoadingFailed", description: "Could not load image from URL")
  }
  return img
}

public class ExpoImageThemeColorsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoImageThemeColors")

    // IMPORTANT: Keep SharedRef<UIImage> first and String second.
    // Never use URL (DynamicConvertibleType) in Either here, because DynamicConvertibleType calls
    // JavaScriptValue.getAny() on SharedObject instances and triggers EXC_BREAKPOINT in ExpoModulesJSI.
    AsyncFunction("extractThemeColorAsync") { (source: Either<SharedRef<UIImage>, String>) -> PaletteRecord in
      let originalImage: UIImage
      if let sharedRef: SharedRef<UIImage> = source.get() {
        originalImage = sharedRef.ref
      } else if let sourceString: String = source.get() {
        originalImage = try loadImageFromStringSource(sourceString)
      } else {
        throw Exception(name: "InvalidSource", description: "Invalid image source provided")
      }

      let originalSize = originalImage.size
      let sampledImage = downsampleImageForPalette(originalImage, maxDimension: 128)
      var capturedSwatches: [Swatch] = []
      let palette = Vibrant.from(sampledImage)
        .useGenerator { swatches in
          capturedSwatches = swatches
          return Generator.defaultGenerator(swatches)
        }
        .getPalette()

      let record = PaletteRecord()
      record.width = Double(originalSize.width)
      record.height = Double(originalSize.height)
      record.dominant = capturedSwatches
        .max { $0.population < $1.population }?
        .toRecord() ?? (palette.Vibrant ?? palette.Muted)?.toRecord()
      record.vibrant = palette.Vibrant?.toRecord()
      record.lightVibrant = palette.LightVibrant?.toRecord()
      record.darkVibrant = palette.DarkVibrant?.toRecord()
      record.muted = palette.Muted?.toRecord()
      record.lightMuted = palette.LightMuted?.toRecord()
      record.darkMuted = palette.DarkMuted?.toRecord()
      record.swatches = capturedSwatches
        .sorted { $0.population > $1.population }
        .map { $0.toRecord() }

      return record
    }
  }
}

extension Swatch {
  func toRecord() -> SwatchRecord {
    let record = SwatchRecord()
    record.hex = self.uiColor.toHexString()
    record.titleTextColor = self.titleTextColor.toHexString()
    record.bodyTextColor = self.bodyTextColor.toHexString()
    record.population = self.population
    return record
  }
}

extension UIColor {
  func toHexString() -> String {
    var r: CGFloat = 0
    var g: CGFloat = 0
    var b: CGFloat = 0
    var a: CGFloat = 0
    if self.getRed(&r, green: &g, blue: &b, alpha: &a) {
      let rgb: Int = (Int)(r * 255) << 16 | (Int)(g * 255) << 8 | (Int)(b * 255) << 0
      return String(format: "#%06X", rgb)
    }
    return "#000000"
  }
}
