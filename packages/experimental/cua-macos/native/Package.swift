// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "LYNCUANative",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "lyn-cua-native", targets: ["CuaNative"])],
    targets: [
        .executableTarget(name: "CuaNative"),
        .testTarget(name: "CuaNativeTests", dependencies: ["CuaNative"], path: "tests/swift"),
    ],
    swiftLanguageModes: [.v6]
)
