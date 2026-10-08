import { renderToString } from 'react-dom/server';
import SeoLanding from '../src/seo/SeoLanding.jsx';
export function render(page) { return renderToString(<SeoLanding page={page} />); }
