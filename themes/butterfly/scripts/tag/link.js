const { url_for } = require("hexo-util");

const siteHost = new URL(hexo.config.url).hostname;

function link(args) {
  let [title, text = "", rawLink = "", rawImg = ""] = args.join(" ").split(",").map(s => s.trim());

  // 如果只写了两个参数并且第二个是链接，则自动调整参数位置
  if (!rawLink && /^https?:\/\//.test(text)) {
    rawLink = text;
    text = "";
  }

  const link = rawLink || "#";

  const match = link.match(/^https?:\/\/([^\/?#]+)/i);
  const linkHost = match?.[1] || "";
  const isExternal = !!match && linkHost !== siteHost;

  const imgUrl = rawImg || (
    isExternal
      ? `https://favicon.im/${linkHost}?larger=true`
      // ? `	https://ico.kucat.cn/get.php?url=${domain}`
      // ? `//api.xinac.net/icon/?url=${domain}`
      // ? `https://favicon.yandex.net/favicon/${domain}`
      // ? `https://www.faviconextractor.com/favicon/${domain}?larger=true`
      : "/img/siteicon/android-chrome-512x512.png"
  );

  return `
<div class="tag link">
  <a class="link-card" target="_blank" href="${isExternal ? link : url_for.call(hexo, link)}">
    <div class="tips">${isExternal ? "引用站外地址" : "站内地址"}</div>
    <div class="link-group">
      <div class="left" style="background-image:url(${imgUrl});">
        <i class="fas fa-link" style="display:none"></i>
      </div>
      <div class="right">
        <div class="title">${title}</div>
        <div class="text">${text}</div>
      </div>
      <i class="fas fa-angle-right"></i>
    </div>
  </a>
</div>`;
}

hexo.extend.tag.register("link", link);