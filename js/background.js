// js/background.js

// (Chrome MV3 の場合は importScripts で読み込む)
// Service Worker 用 importScripts (Chrome Manifest V3 用)
// Firefox では background.scripts で指定するため不要
if (typeof importScripts === "function") {
  try {
    importScripts("default_settings.js", "normalize.js");
    console.log("Background scripts imported successfully."); // ログ追加（任意）
  } catch (e) {
    console.error("Error importing scripts in background worker:", e);
  }
} else {
  // Firefoxなど、importScripts がない環境向けの注意喚起 (任意)
  // console.log("importScripts not found, assuming non-worker environment (e.g., Firefox).");
}

// --- 初期化 ---
const CONTEXT_MENU_ID = "addNewsFilterKeyword";
// デフォルトアイコンパスのみ定義
const DEFAULT_ICON_PATHS = {
  16: "icons/icon-16.png",
  19: "icons/icon-19.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

// --- 状態管理ヘルパー ---
// バッジクリアヘルパー
function clearBadge(tabId) {
  if (!tabId) return;
  try {
    chrome.action.setBadgeText({ text: "", tabId: tabId });
    chrome.action.setTitle({ title: "News Filter", tabId: tabId });
    // 必要であれば色設定をデフォルトに戻す
    // chrome.action.setBadgeBackgroundColor({ color: null, tabId: tabId });
    // chrome.action.setBadgeTextColor({ color: null, tabId: tabId });
  } catch (e) {
    // console.log(`Failed to clear badge for tab ${tabId}: ${e.message}`);
  }
}

// --- インストール・起動時 ---
chrome.runtime.onInstalled.addListener(async (details) => {
  // コンテキストメニュー設定読み込みと更新
  try {
    const contextMenuData = await chrome.storage.local.get([
      "contextMenuEnabled",
    ]);
    updateContextMenu(
      contextMenuData.contextMenuEnabled === undefined
        ? true
        : !!contextMenuData.contextMenuEnabled
    );
  } catch (e) {
    console.error(
      "Error getting/updating context menu settings on install:",
      e
    );
  }

  // siteSettings がなければデフォルトを保存
  try {
    const siteData = await chrome.storage.local.get("siteSettings");
    if (!siteData.siteSettings) {
      // default_settings.js の関数を直接呼び出す (グローバルスコープにある前提)
      await chrome.storage.local.set({
        siteSettings: getDefaultSiteSettings(),
      });
      console.log("Default site settings saved on install.");
    }
  } catch (e) {
    console.error("Failed to check/save default settings on install:", e);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  // コンテキストメニュー設定読み込みと更新
  try {
    const contextMenuData = await chrome.storage.local.get([
      "contextMenuEnabled",
    ]);
    updateContextMenu(
      contextMenuData.contextMenuEnabled === undefined
        ? true
        : !!contextMenuData.contextMenuEnabled
    );
  } catch (e) {
    console.error(
      "Error getting/updating context menu settings on startup:",
      e
    );
  }
});

// --- タブイベントリスナー ---
// chrome.tabs.onActivated.addListener((activeInfo) => {
// console.log(`Tab ${activeInfo.tabId} activated.`);
// });

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // console.log(`Tab ${tabId} updated. Status: ${changeInfo.status}`);
  // ページ読み込み開始時にバッジをクリアする
  if (changeInfo.status === "loading") {
    clearBadge(tabId);
  }
});

// chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
// console.log(`Tab ${tabId} removed.`);
// });

// --- コンテキストメニュー関連 ---
// 右クリックメニューの作成/削除
function updateContextMenu(enabled) {
  // メニュー削除 -> 作成 の順で、多重登録を防ぐ
  chrome.contextMenus.remove(CONTEXT_MENU_ID, () => {
    // remove が失敗しても (メニューが存在しなくても) エラーは無視
    if (chrome.runtime.lastError) {
    }
    // 有効な場合のみメニューを作成
    if (enabled) {
      chrome.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: "選択したテキストを News Filter に追加",
        contexts: ["selection"], // テキスト選択時のみ
      });
    }
  });
}

// 右クリックメニューがクリックされたときの処理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
    const selectedText = info.selectionText.trim();
    if (selectedText) {
      try {
        // ストレージからキーワードデータを取得
        const data = await chrome.storage.local.get([
          "originalKeywords",
          "keywordsData",
        ]);
        let originalKeywords = data.originalKeywords || [];
        let keywordsData = data.keywordsData || [];

        // 正規化と比較 (normalize.js を参照)
        // normalizeKeyword はグローバルスコープにある前提
        const normalizedNewKeyword = normalizeKeyword(selectedText);
        const isDuplicate = keywordsData.some(
          (kd) => kd.normalized === normalizedNewKeyword
        );

        // 重複がなければ追加して保存
        if (!isDuplicate) {
          originalKeywords.push(selectedText);
          keywordsData.push({
            original: selectedText,
            normalized: normalizedNewKeyword,
          });
          await chrome.storage.local.set({
            originalKeywords: originalKeywords,
            keywordsData: keywordsData,
          });

          // Content Script に設定更新を通知 (即時反映のため)
          if (tab && tab.id) {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: "settingsUpdated",
              });
            } catch (e) {
              /* エラー無視 */
            }
          }
        }
      } catch (error) {
        console.error("Error adding keyword from context menu:", error);
      }
    }
  }
});

// --- メッセージリスナー ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // コンテキストメニュー更新リクエスト (Popupから)
  if (message.type === "updateContextMenu") {
    updateContextMenu(message.enabled);
    sendResponse({ success: true });
    return true; // 念のため非同期扱い
  }

  // バッジ更新リクエスト (Content Scriptから)
  if (message.type === "updateBadge") {
    if (sender.tab && sender.tab.id) {
      const tabId = sender.tab.id;
      const count = message.count > 0 ? String(message.count) : "";
      try {
        // バッジ色設定
        chrome.action.setBadgeBackgroundColor({
          color: "#5F5F5F", // 背景色
          tabId: tabId,
        });
        chrome.action.setBadgeTextColor({ color: "#FFFFFF", tabId: tabId }); // 文字色

        // バッジテキストとツールチップを設定
        chrome.action.setBadgeText({ text: count, tabId: tabId });
        const title = count
          ? `News Filter: ${count} items hidden`
          : "News Filter";
        chrome.action.setTitle({ title: title, tabId: tabId });
      } catch (e) {
        // console.log(`Failed to update badge for tab ${tabId}: ${e.message}`);
      }
    }
    // 応答は不要
  }

  // 設定保存通知 (Popupから)
  if (message.type === "settingsSaved") {
    // console.log("settingsSaved message received.");
    // アイコンの再評価などは不要になった
    sendResponse({ success: true });
    // 非同期処理がなければ return true は不要
  }
});

// --- ヘルパー関数 ---
// getDefaultSiteSettings は default_settings.js に定義されている想定
// normalizeKeyword は normalize.js に定義されている想定
// background.scripts で default_settings.js, normalize.js が先に読み込まれている必要がある
