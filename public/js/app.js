import { loadSiteData } from "./api.js";
import { HomeRenderer } from "./home-renderer.js";

try {
  const data = await loadSiteData();
  new HomeRenderer(data).init();
} catch (error) {
  document.querySelector("#content").innerHTML = `<section class="about-box">页面内容加载失败：${error.message}</section>`;
}
