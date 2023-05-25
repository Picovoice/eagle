Pod::Spec.new do |s|
    s.name = 'Eagle-iOS'
    s.module_name = 'Eagle'
    s.version = '0.1.0'
    s.license = {:type => 'Apache 2.0'}
    s.summary = 'iOS binding for Picovoice\'s Eagle speaker recognition engine'
    s.description =
    <<-DESC
    Eagle is Picovoice's on-device speaker recognition engine.
    DESC
    s.homepage = 'https://github.com/Picovoice/eagle/tree/master/binding/ios'
    s.author = { 'Picovoice' => 'hello@picovoice.ai' }
    s.source = { :git => "https://github.com/Picovoice/eagle.git", :branch => "v0.1-ios" }
    s.ios.deployment_target = '11.0'
    s.swift_version = '5.0'
    s.vendored_frameworks = 'lib/ios/PvEagle.xcframework'
    s.resources = 'lib/common/eagle_params.pv'
    s.source_files = 'binding/ios/*.{swift}'
    s.exclude_files = 'binding/ios/EagleTestApp/**'
end
