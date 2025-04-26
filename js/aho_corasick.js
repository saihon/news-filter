class TrieNode {
  constructor() {
    this.children = {}; // 子ノード { char: TrieNode }
    this.output = []; // このノードで終わるキーワードのリスト (正規化前のオリジナル)
    this.fail = null; // Failureリンク (別のTrieNodeへの参照)
    this.keyword = null; // このノードで終わる正規化済みキーワード (検索高速化用)
  }
}

class AhoCorasick {
  constructor(keywordsData = [], caseInsensitive = false) {
    this.root = new TrieNode();
    this.caseInsensitive = caseInsensitive;
    if (keywordsData.length > 0) {
      this.buildTrie(keywordsData);
    }
  }

  _normalizeChar(char) {
    return this.caseInsensitive ? char.toLowerCase() : char;
  }

  /**
   * トライ木とFailureリンクを構築する
   * @param {Array<{original: string, normalized: string}>} keywordsData キーワードデータ
   */
  buildTrie(keywordsData) {
    this.root = new TrieNode(); // Reset the trie

    // 1. Build basic trie structure & store original keywords in output
    for (const data of keywordsData) {
      const { original, normalized } = data;
      let node = this.root;
      for (let i = 0; i < normalized.length; i++) {
        const char = this._normalizeChar(normalized[i]);
        if (!node.children[char]) {
          node.children[char] = new TrieNode();
        }
        node = node.children[char];
      }
      node.output.push(original); // Store original keyword
      node.keyword = normalized; // Store normalized keyword at the end node
    }

    // 2. Build failure links using BFS
    const queue = [];
    // Start with children of the root node
    for (const char in this.root.children) {
      const node = this.root.children[char];
      node.fail = this.root; // Children of root fail to root
      queue.push(node);
    }

    while (queue.length > 0) {
      const currentNode = queue.shift();

      for (const char in currentNode.children) {
        const nextNode = currentNode.children[char];
        queue.push(nextNode);

        let failNode = currentNode.fail;
        // Find the longest proper suffix of the current path that is also a prefix in the trie
        while (failNode && !failNode.children[char]) {
          failNode = failNode.fail;
        }

        nextNode.fail = failNode ? failNode.children[char] : this.root;

        // Append output of the failure node to the current node's output
        // This allows matching keywords that are suffixes of other keywords
        if (nextNode.fail.output.length > 0) {
          // Use Set to avoid duplicate original keywords if normalization causes overlap
          const combinedOutput = new Set([
            ...nextNode.output,
            ...nextNode.fail.output,
          ]);
          nextNode.output = Array.from(combinedOutput);
        }
      }
    }
  }

  /**
   * テキスト内からキーワードを検索する
   * @param {string} text 検索対象のテキスト
   * @returns {Array<{index: number, originalKeywords: string[]}>} マッチ結果の配列
   */
  search(text) {
    const results = [];
    let currentNode = this.root;
    const normalizedText = normalizeKeyword(text); // Normalize the input text once

    for (let i = 0; i < normalizedText.length; i++) {
      const char = this._normalizeChar(normalizedText[i]);

      // Follow failure links until a match is found or root is reached
      while (currentNode && !currentNode.children[char]) {
        currentNode = currentNode.fail;
      }

      if (!currentNode) {
        currentNode = this.root; // If no node found, reset to root
        continue;
      }

      currentNode = currentNode.children[char];

      // If the current node has output, we found a match
      if (currentNode.output.length > 0) {
        // Try to find an existing result for this index
        let foundResult = results.find((r) => r.index === i);
        if (foundResult) {
          // Add unique keywords to the existing result
          const currentKeywords = new Set(foundResult.originalKeywords);
          currentNode.output.forEach((kw) => currentKeywords.add(kw));
          foundResult.originalKeywords = Array.from(currentKeywords);
        } else {
          // Add new result
          results.push({
            index: i, // index is the *end* position of the match in normalized text
            originalKeywords: [...currentNode.output], // Copy output array
          });
        }
      }
    }
    return results;
  }

  /**
   * マッチした最初のキーワード（正規化済み）を返す簡易検索
   * @param {string} text 検索対象のテキスト
   * @returns {string | null} マッチした正規化済みキーワード、またはnull
   */
  contains(text) {
    let currentNode = this.root;
    const normalizedText = normalizeKeyword(text);

    for (let i = 0; i < normalizedText.length; i++) {
      const char = this._normalizeChar(normalizedText[i]);

      while (currentNode && !currentNode.children[char]) {
        currentNode = currentNode.fail;
      }

      if (!currentNode) {
        currentNode = this.root;
        continue;
      }

      currentNode = currentNode.children[char];

      if (currentNode.output.length > 0) {
        // Return the keyword associated with this node (or the first one)
        // Using node.keyword for potentially faster check than re-searching output
        return currentNode.keyword || normalizeKeyword(currentNode.output[0]);
      }
    }
    return null; // No match found
  }

  /**
   * トライ木をシリアライズ可能な形式に変換する
   * Note: Failureリンクは再構築が必要なため、ここでは基本的な構造のみ保存
   *       より完全なシリアライズは複雑になるため、ここではキーワードリストを保存し、
   *       ロード時に再構築するアプローチを採用する。
   *       直接Trieを保存する代わりに、キーワードリストと設定を保存する方がシンプル。
   *
   * このメソッドは参考用であり、現在の実装では使用しません。
   * 代わりにキーワードリストを保存し、content.jsでAhoCorasickインスタンスを再生成します。
   */
  serialize() {
    // 実装例：
    // - ノードをIDで管理し、childrenやfailをIDで参照する形式にする
    // - JSON.stringifyで保存可能なオブジェクトを返す
    // この実装は複雑なので、ここではキーワードリストを保存する方式を推奨
    console.warn(
      "AhoCorasick.serialize() is not fully implemented for storage. Saving keyword list instead."
    );
    return null; // Or return a simplified representation if needed elsewhere
  }

  /**
   * シリアライズされたデータからトライ木を復元する
   * Note: 上記 serialize 同様、現在の実装では使用しません。
   */
  static deserialize(data) {
    console.warn(
      "AhoCorasick.deserialize() is not implemented for storage. Rebuilding from keyword list instead."
    );
    // 実装例：
    // - dataからノード構造とFailureリンクを再構築する
    return new AhoCorasick(); // Return an empty instance
  }
}

// Node.js環境でのエクスポート (テスト用など)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { AhoCorasick, TrieNode };
}
