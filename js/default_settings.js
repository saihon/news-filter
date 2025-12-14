/**
 * デフォルトのサイト設定データを返します。
 * @returns {Array<object>} デフォルトのサイト設定オブジェクトの配列
 */
function getDefaultSiteSettings() {
  return [
    {
      hosts: ["m.yahoo.co.jp"],
      selectors: [
        // すべて
        "section > div > article", // 広告の上のやつ
        "section > div > ul > li > div > article", // 広告の下のやつ
        // ニュース
        "#news > div > div > section > ul > li",
        // おトク
        "section > div > ul > li",
        // 芸能
        "section > div > div > ul > li",
        // スポーツ
        "article > ul > li > article", // 広告の上のやつ
        "article > div > ul > li > article", // 広告の下やつ
        // SNSの話題
        "#yjtop-wadai-service > div > div > div > article", // x トレンドランキング
        "#yjtop-wadai-service > div > div > div > a", // x 話題のテーマ
        "#yjtop-wadai-service > div > div > article", // x 人気ポスト
      ],
    },
    {
      hosts: ["www.yahoo.co.jp"],
      selectors: [
        "section ol > li",
        "section ul > li",
        "section div > li",
        "section div > div > article",
        "#Stream article",
      ],
    },
    {
      hosts: ["news.yahoo.co.jp"],
      selectors: [
        "section ol > li",
        "section ul > li", // mobile でも同様にトップページの記事のリスト
        "section ul > div",
        "section div > li",
        "section div > ul > li",
        "#uamods-topics ul > li",
        "#uamods-topics > div > p",
        "#newsFeed ul > li",
        "#newsFeed ol > li",
        ".newsFeed ol > li",
        "#contentsWrap ul > li",
        "#comment-main ul > li",
        // mobile
        "#contents > div > article > div > ul > li", // 「こんなトピックも読まれています」
        "#uamods-pickupfeed > div > ol > li", // 「合わせて読みたい記事」
        "#uamods-recommend > ol > li", // 「合わせて読みたい記事」
        "#uamods-also_read > ul > li", // 「合わせて読みたい記事」「こんな記事も読まれています」
        "#uamods-also_read > ul > div > section > div > ol > li", // 「ヤフコメランキング」
        "#contents > div > article > div > div > ul > li > div > article", // 「ユーザーコメント」
      ],
    },
    {
      hosts: [
        "sports.yahoo.co.jp",
        "baseball.yahoo.co.jp",
        "soccer.yahoo.co.jp",
      ],
      selectors: [
        "section ul > li",
        "section div > ul > li",
        "section > div.sn-doPickup",
        "section ul > div#timeline > li",
        "#livelist > ul > li",
        // mobile
        "#pkart > div > ul > li",
        "#mv_new > ul > li", // 新着動画
        "section > div > div > ul > li", // 新着記事
      ],
    },
    {
      hosts: ["feedly.com"],
      selectors: [".entry", ".InlineArticle"],
    },
  ];
}