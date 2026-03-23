#!/bin/bash

# 遇到错误立即退出
set -e

APP_NAME="ClipStream"
APP_BUNDLE="$APP_NAME.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

echo "🧹 清理旧的构建..."
rm -rf "$APP_BUNDLE"
rm -f "${APP_NAME}.zip"

echo "📁 创建 App 目录结构..."
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

echo "🔨 编译 Swift 代码..."
# 使用 swiftc 编译所有的 .swift 文件
swiftc ClipStreamApp.swift ContentView.swift ClipboardManager.swift PasteHelper.swift -o "$MACOS_DIR/$APP_NAME"

echo "🎨 生成应用图标..."
ICONSET_DIR="AppIcon.iconset"
mkdir -p "$ICONSET_DIR"
# 从上一级目录获取 icon.png 并生成 macOS 需要的 .icns 图标集
if [ -f "../public/icon.png" ]; then
    sips -z 16 16     ../public/icon.png --out "$ICONSET_DIR/icon_16x16.png" > /dev/null
    sips -z 32 32     ../public/icon.png --out "$ICONSET_DIR/icon_16x16@2x.png" > /dev/null
    sips -z 32 32     ../public/icon.png --out "$ICONSET_DIR/icon_32x32.png" > /dev/null
    sips -z 64 64     ../public/icon.png --out "$ICONSET_DIR/icon_32x32@2x.png" > /dev/null
    sips -z 128 128   ../public/icon.png --out "$ICONSET_DIR/icon_128x128.png" > /dev/null
    sips -z 256 256   ../public/icon.png --out "$ICONSET_DIR/icon_128x128@2x.png" > /dev/null
    sips -z 256 256   ../public/icon.png --out "$ICONSET_DIR/icon_256x256.png" > /dev/null
    sips -z 512 512   ../public/icon.png --out "$ICONSET_DIR/icon_256x256@2x.png" > /dev/null
    sips -z 512 512   ../public/icon.png --out "$ICONSET_DIR/icon_512x512.png" > /dev/null
    sips -z 1024 1024 ../public/icon.png --out "$ICONSET_DIR/icon_512x512@2x.png" > /dev/null
    iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/AppIcon.icns"
    rm -rf "$ICONSET_DIR"
else
    echo "⚠️ 未找到 ../public/icon.png，跳过图标生成。"
fi

echo "📝 生成 Info.plist..."
cat > "$CONTENTS_DIR/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>com.clipstream.mac</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSAppleEventsUsageDescription</key>
    <string>ClipStream 需要辅助功能权限来自动粘贴剪贴板内容。</string>
</dict>
</plist>
EOF

echo "📦 打包成 ZIP..."
zip -qr "${APP_NAME}.zip" "$APP_BUNDLE"

echo "✅ 构建完成！"
echo "👉 生成的应用程序: ${APP_BUNDLE}"
echo "👉 生成的压缩包: ${APP_NAME}.zip"
