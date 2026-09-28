// Renders each page of the design draft to docs/design/<NN-name>.png (macOS only).
// Usage: swift scripts/split-mockups.swift docs/design/visual-directions.pdf docs/design
//
// The draft's pages are 1080 pt wide and draw desktop frames at 0.75 scale, so a
// 4/3 render makes desktop mockups exactly 1440 px wide and phone mockups 390 px,
// matching the Playwright screenshots one to one.

import AppKit
import PDFKit

let names = [
  "01-dashboard-today-desktop",
  "02-review-problem-full-desktop",
  "03-review-problem-minimal-desktop",
  "04-flash-start-phone",
  "05-all-done-phone",
  "06-all-done-desktop",
  "07-dashboard-today-phone",
  "08-review-answer-full-desktop",
  "09-review-answer-minimal-desktop",
  "10-future-day-review-early-phone",
  "11-review-problem-full-phone",
  "12-review-problem-minimal-phone",
  "13-review-answer-full-phone",
  "14-review-answer-minimal-phone",
  "15-review-answer-scrolled-phone",
  "16-image-zoom-phone",
  "17-style-tokens",
  "18-style-components",
  "19-style-mnemos-parts",
  "20-style-history-ladder-fields",
  "21-style-image-prompts",
  "22-style-contrast",
  "23-items-desktop",
  "24-items-search-phone",
  "25-item-editor-desktop",
  "26-section-picker-desktop",
  "27-item-editor-phone",
  "28-item-editor-images-phone",
  "29-section-picker-phone",
  "30-settings-desktop",
  "31-settings-phone",
  "32-remove-stop-phone",
]

let scale: CGFloat = 4.0 / 3.0

let args = CommandLine.arguments
guard args.count == 3 else {
  FileHandle.standardError.write("usage: split-mockups.swift <draft.pdf> <out-dir>\n".data(using: .utf8)!)
  exit(2)
}
guard let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("cannot open \(args[1])\n".data(using: .utf8)!)
  exit(1)
}
guard doc.pageCount == names.count else {
  FileHandle.standardError.write("expected \(names.count) pages, found \(doc.pageCount)\n".data(using: .utf8)!)
  exit(1)
}

let outDir = URL(fileURLWithPath: args[2], isDirectory: true)

for index in 0..<doc.pageCount {
  guard let page = doc.page(at: index) else { continue }
  let bounds = page.bounds(for: .mediaBox)
  let width = Int((bounds.width * scale).rounded())
  let height = Int((bounds.height * scale).rounded())

  guard
    let context = CGContext(
      data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpace(name: CGColorSpace.sRGB)!,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
  else { exit(1) }

  context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  context.scaleBy(x: scale, y: scale)
  context.translateBy(x: -bounds.minX, y: -bounds.minY)
  page.draw(with: .mediaBox, to: context)

  let rep = NSBitmapImageRep(cgImage: context.makeImage()!)
  let url = outDir.appendingPathComponent("\(names[index]).png")
  try rep.representation(using: .png, properties: [:])!.write(to: url)
  print("\(names[index]).png  \(width)×\(height)")
}
