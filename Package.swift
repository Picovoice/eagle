// swift-tools-version:5.3
import PackageDescription
let package = Package(
    name: "Eagle-iOS",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(
            name: "Eagle",
            targets: ["Eagle"]
        )
    ],
    targets: [
        .binaryTarget(
            name: "PvEagle",
            path: "lib/ios/PvEagle.xcframework"
        ),
        .target(
            name: "Eagle",
            dependencies: ["PvEagle"],
            path: ".",
            exclude: [
                "binding/ios/EagleAppTest",
                "demo"
            ],
            sources: [
                "binding/ios/Eagle.swift",
                "binding/ios/EagleBase.swift",
                "binding/ios/EagleErrors.swift",
                "binding/ios/EagleProfile.swift",
                "binding/ios/EagleProfiler.swift"
            ],
            resources: [
               .copy("lib/common/eagle_params.pv")
            ]
        )
    ]
)
