# Makefile for News Filter extension packaging

# 使い方 ###############################################################
# Chrome 用の .zip パッケージを作成する場合: make chrome
# Firefox 用の .zip パッケージを作成する場合: make firefox
# 生成されたファイル（パッケージと一時ファイル）を削除する場合: make clean
# Makefile の使い方（ヘルプ）を表示する場合: make help
# Chrome のデバック用の manifest.json を作成する: make setup-debug-chrome
# Firefox のデバック用の manifest.json を作成する: make setup-debug-firefox
#######################################################################

# --- Configuration ---
EXTENSION_NAME = news-filter

# ★★★ 拡張機能バージョン番号はここで一元管理するので、リリース時にここを編集する ★★★
VERSION := 1.2.0

# 出力ディレクトリ
DIST_DIR = dist

# Chrome 用 Zip ファイル名
CHROME_ZIP_FILE = $(DIST_DIR)/$(EXTENSION_NAME)-chrome-$(VERSION).zip
# Firefox 用 Zip ファイル名
FIREFOX_ZIP_FILE = $(DIST_DIR)/$(EXTENSION_NAME)-firefox-$(VERSION).zip

# パッケージに含めるファイル/ディレクトリ
SOURCE_DIRS_FILES = css/ icons/ js/ popup.html

# zip コマンド
ZIP = zip
# sed コマンド
SED = sed

# --- Targets ---

.PHONY: all clean chrome firefox help setup-debug-chrome setup-debug-firefox

# デフォルトターゲット
all: help

# ヘルプ表示
help:
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  chrome                 Create Chrome package as zip file (v$(VERSION))"
	@echo "  firefox                Create Firefox package as zip file (v$(VERSION))"
	@echo "  clean                  Remove generated manifest.json and packages in $(DIST_DIR)"
	@echo "  help                   Show this help message"
	@echo "  setup-debug-chrome     Setting up manifest.json for Chrome debugging"
	@echo "  setup-debug-firefox    Setting up manifest.json for Firefox debugging"
	@echo ""

# Chrome デバッグ用の manifest.json を準備
setup-debug-chrome: manifest-chrome.json
	@echo "Setting up manifest.json for Chrome debugging..."
	@$(SED) 's/"version":\s*"[^"]*"/"version": "$(VERSION)"/' manifest-chrome.json > manifest.json
	@echo "chrome://extensions"
	@echo "$(CURDIR)/manifest.json"

# Firefox デバッグ用の manifest.json を準備
setup-debug-firefox: manifest-firefox.json
	@echo "Setting up manifest.json for Firefox debugging..."
	@$(SED) 's/"version":\s*"[^"]*"/"version": "$(VERSION)"/' manifest-firefox.json > manifest.json
	@echo "about:debugging#/runtime/this-firefox"
	@echo "$(CURDIR)/manifest.json"

# Chrome Zip パッケージ作成
chrome: $(CHROME_ZIP_FILE)

# Firefox Zip パッケージ作成
firefox: $(FIREFOX_ZIP_FILE)

# Chrome Zip ファイル作成
# $(sed) で manifest.json を生成 manifest-*.json 内の "version": "version" が $(VERSION) の値に置き換える
# $(zip) コマンドでパッケージ作成。-x オプションで除外するファイルを個別に指定
$(CHROME_ZIP_FILE): $(SOURCE_DIRS_FILES) manifest-chrome.json | $(DIST_DIR)
	@echo "Creating Chrome Zip package (v$(VERSION))..."
	@$(SED) 's/"version":\s*"[^"]*"/"version": "$(VERSION)"/' manifest-chrome.json > manifest.json
	@$(ZIP) -r -FS $(CHROME_ZIP_FILE) $(SOURCE_DIRS_FILES) manifest.json \
		-x '*/.*' \
		-x '*~' \
		-x '*.txt' \
		-x '*.md' \
		-x '*.sh' \
		-x 'Makefile' \
		-x 'manifest-*.json' \
		-x '$(DIST_DIR)/*' \
		-x '*.pem' \
		-x 'README.md' \
		-x 'node_modules/*'
	@rm -f manifest.json
	@echo "Created $(CHROME_ZIP_FILE)"

# Firefox Zip ファイル作成
# $(sed) で manifest.json を生成 manifest-*.json 内の "version": "version" が $(VERSION) の値に置き換える
# $(zip) コマンドでパッケージ作成。-x オプションで除外するファイルを個別に指定
$(FIREFOX_ZIP_FILE): $(SOURCE_DIRS_FILES) manifest-firefox.json | $(DIST_DIR)
	@echo "Creating Firefox Zip package (v$(VERSION))..."
	@$(SED) 's/"version":\s*"[^"]*"/"version": "$(VERSION)"/' manifest-firefox.json > manifest.json
	@$(ZIP) -r -FS $(FIREFOX_ZIP_FILE) $(SOURCE_DIRS_FILES) manifest.json \
		-x '*/.*' \
		-x '*~' \
		-x '*.txt' \
		-x '*.md' \
		-x '*.sh' \
		-x 'Makefile' \
		-x 'manifest-*.json' \
		-x '$(DIST_DIR)/*' \
		-x '*.pem' \
		-x 'README.md' \
		-x 'node_modules/*'
	@rm -f manifest.json
	@echo "Created $(FIREFOX_ZIP_FILE)"

# dist ディレクトリ作成
$(DIST_DIR):
	@mkdir -p $(DIST_DIR)

# 中間ファイルとパッケージ、$(DIST_DIR) を削除
clean:
	@echo "Cleaning up..."
	@rm -f manifest.json
	@rm -f $(DIST_DIR)/$(EXTENSION_NAME)-*.zip
	@echo "Removing $(DIST_DIR)..."
	@rm -rf $(DIST_DIR)