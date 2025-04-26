/**
 * 文字列を正規化する関数
 * - NFKC正規化
 * - 全角記号を半角に
 * - 円マーク/バックスラッシュ統一
 * - スペース統一
 * - 前後の空白削除
 * @param {string} str 正規化する文字列
 * @returns {string} 正規化された文字列
 */
function normalizeKeyword(str) {
  if (!str) return "";
  let normalized = str;

  // 1. NFKC正規化 (全角英数カナなどを半角に、互換文字を統一)
  normalized = normalized.normalize("NFKC");

  // 2. 個別の記号正規化 (NFKCでカバーされないものや、より一般的な形へ)
  normalized = normalized
    .replace(/．/g, ".")
    .replace(/[―－‐]/g, "-") // 全角ダッシュ, 全角ハイフンマイナス, ハイフン
    .replace(/[！ǃ]/g, "!") // 全角感嘆符, 感嘆符(他)
    .replace(/[？⁇]/g, "?") // 全角疑問符, 疑問符(他)
    .replace(/[：﹕]/g, ":") // 全角コロン, コロン(他)
    .replace(/[；﹔]/g, ";") // 全角セミコロン, セミコロン(他)
    .replace(/[／⧸]/g, "/") // 全角スラッシュ, スラッシュ(他)
    .replace(/[％﹪]/g, "%") // 全角パーセント, パーセント(他)
    .replace(/[＆﹠]/g, "&") // 全角アンパサンド, アンパサンド(他)
    .replace(/[＠﹫]/g, "@") // 全角アットマーク, アットマーク(他)
    .replace(/[＃﹟]/g, "#") // 全角シャープ, シャープ(他)
    .replace(/[＄﹩]/g, "$") // 全角ドル, ドル(他)
    .replace(/[＊﹡]/g, "*") // 全角アスタリスク, アスタリスク(他)
    .replace(/[＋﹢]/g, "+") // 全角プラス, プラス(他)
    .replace(/[＝﹦]/g, "=") // 全角イコール, イコール(他)
    .replace(/[（﹙]/g, "(") // 全角左括弧, 括弧(他)
    .replace(/[）﹚]/g, ")") // 全角右括弧, 括弧(他)
    .replace(/[［ '[']/g, "[") // 全角左角括弧, etc.
    .replace(/[］ ']' ]/g, "]") // 全角右角括弧, etc.
    .replace(/[｛ '{' ]/g, "{") // 全角左波括弧, etc.
    .replace(/[｝ '}' ]/g, "}") // 全角右波括弧, etc.
    .replace(/[〜～]/g, "~"); // 全角チルダ, 波ダッシュ

  // 3. 円マーク/バックスラッシュ統一
  normalized = normalized.replace(/[￥¥]/g, "\\");

  // 4. スペース統一 (連続する空白や全角スペースを半角スペース1つに)
  normalized = normalized.replace(/[\s\u3000]+/g, " ").trim();

  // 5. 小文字化 (オプションとして残すが、デフォルトでは適用しない)
  // normalized = normalized.toLowerCase();

  return normalized;
}

// Node.js環境でのエクスポート (テスト用など)
if (typeof module !== "undefined" && module.exports) {
  module.exports = normalizeKeyword;
}
