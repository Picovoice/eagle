Pod::Spec.new do |s|
    s.name = 'Eagle-iOS'
    s.module_name = 'Eagle'
    s.version = '1.0.0'
    s.license = {:type => 'Apache 2.0'}
    s.summary = 'iOS binding for Picovoice\'s Eagle speaker recognition engine'
    s.description =
    <<-DESC
    Eagle Speaker Recognition is speaker verification and identification software
    that distinguishes individuals using their unique voice characteristics.
    DESC
    s.homepage = 'https://github.com/Picovoice/eagle/tree/master/binding/ios'
    s.author = { 'Picovoice' => 'hello@picovoice.ai' }
    s.source = { :git => "https://github.com/Picovoice/eagle.git", :tag => "Eagle-iOS-v1.0.0" }
    s.ios.deployment_target = '13.0'
    s.swift_version = '5.0'
    s.vendored_frameworks = 'lib/ios/PvEagle.xcframework'
    s.resources = 'lib/common/eagle_params.pv'
    s.source_files = 'binding/ios/*.{swift}'
    s.exclude_files = 'binding/ios/EagleTestApp/**'
end
