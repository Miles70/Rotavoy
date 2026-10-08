import { useLayoutEffect } from 'react';
import { seoHeadEntries } from '../../../shared/seoHead';
import { SITE_URL } from '../../../shared/travelSeo';
// Initial HTML and navigation share one head owner, avoiding duplicate canonical/robots metadata.
export default function Seo(props) {
  const serialized = JSON.stringify(seoHeadEntries(props));
  useLayoutEffect(() => {
    const nodes = JSON.parse(serialized).map(([tag, attributes, content]) => {
      const node = document.createElement(tag);
      node.dataset.rvSeo = 'true';
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      if (content !== undefined) node.textContent = content;
      return node;
    });
    document.head.querySelectorAll('[data-rv-seo]').forEach(node => node.remove());
    document.head.append(...nodes);
    return () => nodes.forEach(node => node.remove());
  }, [serialized]);
  return null;
}
export { SITE_URL };
