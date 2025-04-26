// js/content.js

// --- グローバル変数 ---
let keywordsData = [];
let siteSettings = []; // content.js でも設定は必要
let caseInsensitive = false;
let ahoCorasickInstance = null;
let applicableSelectors = [];
let hiddenCount = 0;
const HIDE_ATTRIBUTE = "data-news-filter-match";
const HIDE_STYLE_ID = "news-filter-hide-style";
let styleElement = null;
let observer = null;
let observerOptions = { childList: true, subtree: true };
let badgeUpdateTimer = null;

// --- 初期化と設定読み込み ---

async function initialize() {
  // 初期化ログ
  console.log(
    "News Filter: Initializing content script for",
    window.location.hostname
  );
  createHideStyleElement();
  await loadAndApplySettings(); // 設定を読み込み、フィルタリングを開始

  // 設定更新メッセージのリスナー
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "settingsUpdated") {
      stopObserver(); // 既存の監視を停止
      loadAndApplySettings()
        .then(() => {
          // 設定を再読み込みして適用
          sendResponse({ success: true });
        })
        .catch((error) => {
          // ★ エラーログは残す
          console.error("News Filter: Error reloading settings:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // 非同期応答を示す
    }
  });
}

// スタイル要素を作成する関数
function createHideStyleElement() {
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = HIDE_STYLE_ID;
    styleElement.textContent = `[${HIDE_ATTRIBUTE}="true"] { display: none !important; }`;
  }
}

// スタイル要素を <head> に挿入する関数
function ensureHideStyleInjected() {
  // styleElement がまだ DOM に追加されていない場合のみ実行
  if (styleElement && !document.head.contains(styleElement)) {
    (document.head || document.documentElement).appendChild(styleElement);
  }
}

// 設定を読み込み、フィルタリングを実行する関数
async function loadAndApplySettings() {
  try {
    // 既存の非表示状態を解除（キーワード削除などに備える）
    unhideAllElements();

    // ストレージから設定を取得
    // default_settings.js は content script の js リストに含まれている必要がある
    // (Manifest V3 では background と content は別スコープのため)
    const data = await chrome.storage.local.get([
      "keywordsData",
      "siteSettings",
      "caseInsensitive",
    ]);

    keywordsData = data.keywordsData || [];
    siteSettings = data.siteSettings || []; // 設定自体は content.js でも必要
    caseInsensitive = !!data.caseInsensitive;

    // 現在のホストに適用されるセレクターを特定
    const currentHostname = window.location.hostname;
    const applicableSetting = siteSettings.find((setting) =>
      setting.hosts.some((hostPattern) => {
        // ホスト名の比較ロジック
        const lowerHostname = currentHostname.toLowerCase(); // 比較用に小文字化
        const lowerPattern = hostPattern.toLowerCase();
        if (lowerPattern.startsWith("*.")) {
          const domain = lowerPattern.substring(2);
          return (
            lowerHostname === domain || lowerHostname.endsWith("." + domain)
          );
        }
        return lowerHostname === lowerPattern;
      })
    );
    applicableSelectors = applicableSetting ? applicableSetting.selectors : [];

    // ★ フィルタリング実行条件: セレクタがあり、かつキーワードがある場合
    if (applicableSelectors.length > 0 && keywordsData.length > 0) {
      // AhoCorasickインスタンスを構築 (aho_corasick.js が読み込まれている前提)
      ahoCorasickInstance = new AhoCorasick(keywordsData, caseInsensitive);
      // 既存要素をスキャン
      scanExistingElements();
      // DOM変更の監視を開始
      startObserver();
    } else {
      // フィルタリングを実行しない場合
      ahoCorasickInstance = null; // インスタンスをクリア
      stopObserver(); // 監視停止
      updateBadge(true); // バッジは強制クリア
    }
  } catch (error) {
    // エラーログは残す
    console.error("News Filter: Error loading settings:", error);
    ahoCorasickInstance = null; // エラー時もインスタンスをクリア
    stopObserver(); // 監視停止
    updateBadge(true); // バッジも強制クリア
  }
}

// --- DOM操作と監視 ---

// MutationObserverを開始する関数
function startObserver() {
  if (observer) observer.disconnect();
  // インスタンスが存在する場合のみ監視開始
  if (!ahoCorasickInstance) return;

  observer = new MutationObserver((mutations) => {
    let foundMatchInMutation = false;
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          // 要素ノードのみ処理
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (processNodeAndChildren(node)) {
              foundMatchInMutation = true;
            }
          }
        });
      }
      // 属性変更なども監視する場合はここに追加
      // else if (mutation.type === 'attributes') { ... }
    }
    // ミューテーション内でマッチが見つかった場合、スタイルが挿入されていることを確認
    if (foundMatchInMutation) {
      ensureHideStyleInjected();
    }
  });

  // body または documentElement を監視対象とする
  observer.observe(document.body || document.documentElement, observerOptions);
}

// MutationObserverを停止する関数
function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// 既存の要素をスキャンして処理する関数
function scanExistingElements() {
  hiddenCount = 0; // スキャン開始時にリセット
  // インスタンスが存在する場合のみスキャン
  if (!ahoCorasickInstance || applicableSelectors.length === 0) return;

  const selectorString = applicableSelectors.join(", ");
  if (!selectorString) return;

  let foundMatch = false;
  try {
    document.querySelectorAll(selectorString).forEach((element) => {
      if (processNode(element)) {
        foundMatch = true;
      }
    });
  } catch (error) {
    console.error(
      `News Filter: Invalid selector detected in "${selectorString}". Error:`,
      error
    );
    updateBadge(true); // エラー時はバッジをクリア
    return; // スキャン中断
  }

  // 1つでも要素を非表示にした場合、スタイルが挿入されていることを確認
  if (foundMatch) {
    ensureHideStyleInjected();
  }

  // スキャン完了後にバッジ更新
  updateBadge();
}

// 指定されたノードとその子孫を処理する関数 (MutationObserver用)
function processNodeAndChildren(node) {
  // インスタンスが存在する場合のみ処理
  if (!ahoCorasickInstance || applicableSelectors.length === 0) return false;

  let foundMatch = false;
  // 要素自体がセレクターにマッチするか
  // nodeTypeチェックとmatchesの存在確認
  try {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      typeof node.matches === "function" &&
      applicableSelectors.some((sel) => node.matches(sel))
    ) {
      if (processNode(node)) {
        foundMatch = true;
      }
    }
  } catch (e) {
    /* matches でエラーになる場合 (SVGなど) は無視 */
  }

  // 子孫要素をチェック
  try {
    // querySelectorAllの存在確認
    if (typeof node.querySelectorAll === "function") {
      const elements = node.querySelectorAll(applicableSelectors.join(", "));
      elements.forEach((element) => {
        if (processNode(element)) {
          foundMatch = true;
        }
      });
    }
  } catch (e) {}
  return foundMatch; // この変更でマッチがあったか返す
}

// 単一の要素ノードを処理して、キーワードが含まれていれば非表示属性を設定する関数
function processNode(element) {
  // インスタンスが存在する場合のみ処理
  if (
    !ahoCorasickInstance ||
    !element ||
    typeof element.hasAttribute !== "function" ||
    element.hasAttribute(HIDE_ATTRIBUTE) ||
    typeof element.matches !== "function"
  ) {
    return false; // 処理不要 or 対象外 or 既に非表示
  }

  // 要素のテキスト内容を取得 (textContent を使用)
  const textContent = element.textContent || "";
  // 空の要素は無視
  if (!textContent.trim()) {
    return false;
  }

  // Aho-Corasickでキーワード検索 (contains を使用)
  // normalizeKeyword は aho_corasick.js 内部で呼ばれる
  const matchFound = ahoCorasickInstance.contains(textContent);

  if (matchFound) {
    // 属性がまだない場合のみカウントアップしてバッジ更新
    if (!element.hasAttribute(HIDE_ATTRIBUTE)) {
      element.setAttribute(HIDE_ATTRIBUTE, "true");
      hiddenCount++;
      updateBadge(); // カウント変更時にバッジ更新依頼
    }
    ensureHideStyleInjected(); // マッチしたらスタイル注入を確認
    return true; // 非表示にした（または既に非表示だった）
  } else {
    // 以前非表示で、マッチしなくなった場合（キーワード削除など）
    if (element.hasAttribute(HIDE_ATTRIBUTE)) {
      element.removeAttribute(HIDE_ATTRIBUTE);
      hiddenCount = Math.max(0, hiddenCount - 1);
      updateBadge(); // カウント変更時にバッジ更新依頼
    }
    return false; // 非表示にしなかった
  }
}

// 全ての非表示要素を表示に戻す関数
function unhideAllElements() {
  let changed = false;
  // hiddenCount をここでリセットしておく
  hiddenCount = 0;
  try {
    // パフォーマンスのため try-catch で囲む
    document
      .querySelectorAll(`[${HIDE_ATTRIBUTE}="true"]`)
      .forEach((element) => {
        if (typeof element.removeAttribute === "function") {
          element.removeAttribute(HIDE_ATTRIBUTE);
          changed = true;
        }
      });
  } catch (e) {
    console.error("News Filter: Error querying or removing hide attribute:", e);
  }
  // unhide後、バッジは呼び出し元で更新されるのでここでは不要
  // if (changed) { updateBadge(true); }
}

// --- Background Script への通知 (バッジのみ) ---
// バッジ更新をスロットリングする関数
function updateBadge(force = false) {
  clearTimeout(badgeUpdateTimer);
  // hiddenCountが0でも即時更新する（クリアを確実にするため）
  if (force || hiddenCount === 0) {
    // try-catch を追加 (ランタイムが無効になる場合への対策)
    try {
      // background script が有効か確認 (オプション)
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({ type: "updateBadge", count: hiddenCount });
      }
    } catch (error) {
      // console.error("Error sending badge update message:", error);
    }
  } else {
    // 通常は少し待ってから実行 (300ms)
    badgeUpdateTimer = setTimeout(() => {
      try {
        if (chrome.runtime?.id) {
          chrome.runtime.sendMessage({
            type: "updateBadge",
            count: hiddenCount,
          });
        }
      } catch (error) {
        // console.error("Error sending badge update message (delayed):", error);
      }
    }, 300);
  }
}

// --- 初期化実行 ---
// DOMContentLoaded イベントで initialize を呼び出す
// document.readyState チェックも行う
if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  initialize();
} else {
  document.addEventListener("DOMContentLoaded", initialize, { once: true }); // 念のため once: true を追加
}

// ★ content script が必要とする他のスクリプト (normalize.js, aho_corasick.js, default_settings.js) が
//   manifest.json の content_scripts.js 配列でこのファイルより先に読み込まれている必要がある点に注意。
