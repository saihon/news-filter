// js/popup.js

// --- 要素取得 ---
const keywordsTextarea = document.getElementById("keywords");
const saveButton = document.getElementById("saveButton"); // キーワードタブの保存ボタン
const sortButton = document.getElementById("sortButton");
const caseInsensitiveToggle = document.getElementById("caseInsensitiveToggle");
const contextMenuToggle = document.getElementById("contextMenuToggle");
const siteSettingsJsonTextarea = document.getElementById("siteSettingsJson");
const saveAdvancedButton = document.getElementById("saveAdvancedButton"); // 高度な設定タブの保存ボタン
const openInTabButton = document.getElementById("openInTabButton");
const statusDiv = document.getElementById("status"); // メッセージ表示領域の div
const statusTextSpan = document.getElementById("statusText"); // メッセージテキスト用 span
const tabButtons = document.querySelectorAll(".tab-button"); // タブボタン(複数)
const tabPanes = document.querySelectorAll(".tab-pane"); // タブペイン(複数)

// --- 初期化処理 ---
// タブとして開かれた場合にクラスを付与
if (window.location.search.includes("tab=true")) {
  document.documentElement.classList.add("is-tab");
}

// 設定をストレージから読み込む関数
async function loadSettings() {
  try {
    // ストレージからデータを取得
    const data = await chrome.storage.local.get([
      "originalKeywords",
      "siteSettings",
      "caseInsensitive",
      "contextMenuEnabled",
    ]);

    // キーワードテキストエリアに設定
    keywordsTextarea.value = (data.originalKeywords || []).join("\n");

    // サイト設定テキストエリアに設定
    // getDefaultSiteSettings は default_settings.js で定義されている想定
    const siteSettings = data.siteSettings || getDefaultSiteSettings();
    siteSettingsJsonTextarea.value = JSON.stringify(siteSettings, null, 2);

    // オプションチェックボックスに設定
    caseInsensitiveToggle.checked = !!data.caseInsensitive;
    contextMenuToggle.checked =
      data.contextMenuEnabled === undefined ? true : !!data.contextMenuEnabled;

    // ★ 設定読み込み完了後に、現在アクティブなタブに応じてフォーカス
    //    (初期表示はキーワードタブなので、キーワードタブにフォーカス)
    focusKeywordsTextarea();
  } catch (error) {
    console.error("Error loading settings:", error);
    displayStatus("設定の読み込みに失敗しました。", "error");
  }
}

// キーワードテキストエリアの末尾にフォーカスする関数
function focusKeywordsTextarea() {
  // 要素が実際に表示されているか確認
  if (keywordsTextarea.offsetParent === null) {
    return;
  }
  let currentValue = keywordsTextarea.value;
  if (currentValue.length > 0 && !currentValue.endsWith("\n")) {
    keywordsTextarea.value += "\n";
  }
  keywordsTextarea.scrollTop = keywordsTextarea.scrollHeight;
  keywordsTextarea.focus();
  keywordsTextarea.setSelectionRange(
    keywordsTextarea.value.length,
    keywordsTextarea.value.length
  );
}

// --- タブ切り替えロジック ---
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetTabId = button.dataset.tab; // data-tab属性の値を取得

    // すべてのボタンとペインから active クラスを削除
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabPanes.forEach((pane) => pane.classList.remove("active"));

    // クリックされたボタンと対応するペインに active クラスを追加
    button.classList.add("active");
    const targetPane = document.getElementById(targetTabId);
    if (targetPane) {
      targetPane.classList.add("active");
    }

    // ★ キーワードタブが表示されたらフォーカスする (任意)
    if (targetTabId === "keywordsTab") {
      focusKeywordsTextarea();
    }
  });
});

// --- イベントリスナー ---

// 保存ボタン (キーワードタブ) のイベントリスナー
saveButton.addEventListener("click", handleSave); // 保存処理を共通関数化

// 保存ボタン (高度な設定タブ) のイベントリスナー
saveAdvancedButton.addEventListener("click", handleSave); // 同じ保存処理を呼び出す

// ★ 設定保存処理 (共通関数)
async function handleSave() {
  // 両方の保存ボタンを無効化し、テキストを変更
  saveButton.disabled = true;
  saveAdvancedButton.disabled = true;
  saveButton.textContent = "保存中...";
  saveAdvancedButton.textContent = "保存中...";
  displayStatus(""); // ステータスメッセージをクリア

  try {
    // 1. キーワードの処理 (正規化と重複排除)
    const originalKeywordsRaw = keywordsTextarea.value
      .split("\n")
      .map((k) => k.trim()) // 前後の空白削除
      .filter((k) => k !== ""); // 空行を除去
    const keywordsData = []; // content.js 用: {original, normalized}
    const normalizedSet = new Set(); // 正規化後の重複チェック用
    const duplicatesRemoved = []; // 削除されたキーワード通知用
    const uniqueOriginalKeywords = []; // popup.js 表示/保存用

    for (const original of originalKeywordsRaw) {
      // normalizeKeyword は normalize.js で定義されている想定
      const normalized = normalizeKeyword(original);
      if (normalized && !normalizedSet.has(normalized)) {
        normalizedSet.add(normalized);
        keywordsData.push({ original: original, normalized: normalized });
        uniqueOriginalKeywords.push(original);
      } else if (normalized && normalizedSet.has(normalized)) {
        duplicatesRemoved.push(original);
      }
    }
    // 重複キーワードがあればユーザーに通知し、テキストエリアを更新
    if (duplicatesRemoved.length > 0) {
      alert(
        `以下のキーワードは正規化後に重複するため、削除されました:\n- ${duplicatesRemoved.join(
          "\n- "
        )}`
      );
      keywordsTextarea.value = uniqueOriginalKeywords.join("\n");
      // 再フォーカスは必須ではないが、UX向上のために入れても良い
      // focusKeywordsTextarea();
    }

    // 2. サイト設定 (JSON) の検証
    let siteSettings;
    try {
      siteSettings = JSON.parse(siteSettingsJsonTextarea.value);
      // 簡単な形式チェック
      if (
        !Array.isArray(siteSettings) ||
        siteSettings.some(
          (s) =>
            typeof s !== "object" ||
            !Array.isArray(s.hosts) ||
            !Array.isArray(s.selectors)
        )
      ) {
        throw new Error(
          "JSONデータは配列で、各要素に hosts (配列) と selectors (配列) が必要です。"
        );
      }
    } catch (e) {
      alert(`サイト設定のJSONが無効です:\n${e.message}`);
      throw e; // 保存処理を中断
    }

    // 3. オプション設定の取得
    const caseInsensitive = caseInsensitiveToggle.checked;
    const contextMenuEnabled = contextMenuToggle.checked;

    // 4. ストレージに全設定を保存
    await chrome.storage.local.set({
      keywordsData: keywordsData,
      originalKeywords: uniqueOriginalKeywords,
      siteSettings: siteSettings,
      caseInsensitive: caseInsensitive,
      contextMenuEnabled: contextMenuEnabled,
    });

    // 5. Background Script にコンテキストメニューの状態更新を依頼
    try {
      await chrome.runtime.sendMessage({
        type: "updateContextMenu",
        enabled: contextMenuEnabled,
      });
    } catch (e) {
      console.error("Failed to send updateContextMenu message:", e);
    }

    // 6. Background Script に設定が保存されたことを通知
    try {
      await chrome.runtime.sendMessage({ type: "settingsSaved" });
    } catch (e) {
      console.error("Failed to send settingsSaved message:", e);
    }

    // 7. 開いている関連タブの Content Script に設定更新を通知
    try {
      const tabs = await chrome.tabs.query({
        url: ["http://*/*", "https://*/*"],
      });
      tabs.forEach((tab) => {
        try {
          chrome.tabs.sendMessage(tab.id, { type: "settingsUpdated" });
        } catch (error) {
          /* ignore */
        }
      });
    } catch (queryError) {
      console.error("Error querying tabs:", queryError);
    }

    // 8. 完了メッセージ表示
    displayStatus("設定を保存しました。", "success");
  } catch (error) {
    // 9. エラー処理
    console.error("Error saving settings:", error);
    // JSON関連のエラーはアラートで表示済みなので、それ以外のエラーを表示
    if (!error.message?.includes("JSON")) {
      displayStatus(`保存中にエラーが発生しました: ${error.message}`, "error");
    }
  } finally {
    // 10. 両方の保存ボタンの状態を元に戻す
    saveButton.disabled = false;
    saveAdvancedButton.disabled = false;
    saveButton.textContent = "保存して反映";
    saveAdvancedButton.textContent = "設定を保存";
  }
}

// ソートボタンクリック時の処理
sortButton.addEventListener("click", () => {
  const keywords = keywordsTextarea.value
    .split("\n")
    .map((k) => k.trim()) // 前後の空白削除
    .filter((k) => k.trim() !== ""); // 空行除去
  keywords.sort(); // 文字列ソート
  keywordsTextarea.value = keywords.join("\n");
  focusKeywordsTextarea(); // 末尾に改行追加＆フォーカス
  displayStatus(
    "キーワードをソートしました。保存ボタンを押して確定してください。",
    "info"
  );
});

// 別タブで開くボタンクリック時の処理
openInTabButton.addEventListener("click", () => {
  try {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?tab=true") });
  } catch (e) {
    console.error("Failed to open popup in new tab:", e);
    displayStatus("新しいタブを開けませんでした。", "error");
  }
});

// 右クリックメニュー有効化トグル変更時の処理
contextMenuToggle.addEventListener("change", async () => {
  const enabled = contextMenuToggle.checked;
  try {
    await chrome.storage.local.set({ contextMenuEnabled: enabled });
    await chrome.runtime.sendMessage({
      type: "updateContextMenu",
      enabled: enabled,
    });
    displayStatus(
      `右クリックメニューを${enabled ? "有効" : "無効"}にしました。`,
      "info"
    );
  } catch (error) {
    console.error("Error updating context menu setting:", error);
    displayStatus("右クリックメニュー設定の更新に失敗しました。", "error");
    contextMenuToggle.checked = !enabled; // UIを元に戻す
  }
});

// 大文字/小文字区別トグル変更時の処理
caseInsensitiveToggle.addEventListener("change", () => {
  displayStatus(
    "大文字/小文字の設定を変更しました。保存ボタンを押して反映してください。",
    "info"
  );
});

// ステータスメッセージ表示関数
function displayStatus(message, type = "info") {
  statusTextSpan.textContent = message;
  statusDiv.className = "status-message-area"; // デフォルトクラスに戻す
  if (message) {
    statusDiv.classList.add(type); // タイプクラスを追加
  }
}

// --- 初期読み込み実行 ---
// DOMが完全に読み込まれたら設定をロード
document.addEventListener("DOMContentLoaded", loadSettings);

// ★ popup.js が必要とする他のスクリプト (normalize.js, default_settings.js) が
//   popup.html 内でこのファイルより先に読み込まれている必要がある点に注意。
