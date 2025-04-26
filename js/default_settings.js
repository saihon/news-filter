/**
 * デフォルトのサイト設定データを返します。
 * @returns {Array<object>} デフォルトのサイト設定オブジェクトの配列
 */
function getDefaultSiteSettings() {
  return [
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
        "section ul > li",
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
      ],
    },
    {
      hosts: ["feedly.com"],
      selectors: [".entry", ".InlineArticle"],
    },
  ];
}
