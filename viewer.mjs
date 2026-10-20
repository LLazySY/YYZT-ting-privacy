const status = document.querySelector('#status');
const container = document.querySelector('#document');
try {
  const pdfjs = await import('./vendor/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
  const pdf = await pdfjs.getDocument({
    url: new URL('./privacy.pdf', import.meta.url).href,
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const element = document.createElement('section');
    element.className = 'page';
    element.setAttribute('aria-label', `第 ${number} 页，共 ${pdf.numPages} 页`);
    container.append(element);
    pages.push({ page, element });
  }
  let rendering = false;
  let pending = true;
  let previousWidth = 0;
  async function render() {
    if (rendering) { pending = true; return; }
    rendering = true;
    try {
      do {
        pending = false;
        const width = container.clientWidth;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (const { page, element } of pages) {
          const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
          element.style.width = `${viewport.width}px`;
          element.style.height = `${viewport.height}px`;
          element.style.setProperty('--total-scale-factor', viewport.scale);
          const canvas = document.createElement('canvas');
          canvas.setAttribute('aria-hidden', 'true');
          canvas.width = Math.ceil(viewport.width * ratio);
          canvas.height = Math.ceil(viewport.height * ratio);
          const layer = document.createElement('div');
          layer.className = 'textLayer';
          await page.render({
            canvasContext: canvas.getContext('2d'), viewport,
            transform: [ratio, 0, 0, ratio, 0, 0], background: '#ffffff',
          }).promise;
          element.replaceChildren(canvas, layer);
          await new pdfjs.TextLayer({
            textContentSource: page.streamTextContent(), container: layer, viewport,
          }).render();
          if (status) status.hidden = true;
        }
        previousWidth = width;
      } while (pending);
    } finally { rendering = false; }
  }
  await render();
  let timer;
  new ResizeObserver(() => {
    if (container.clientWidth === previousWidth) return;
    clearTimeout(timer);
    timer = setTimeout(() => render().catch(showError), 180);
  }).observe(container);
} catch (error) { showError(error); }

function showError(error) {
  console.error('Privacy policy viewer:', error);
  status.hidden = false;
  status.replaceChildren(document.createTextNode('加载失败，请'));
  const link = document.createElement('a');
  link.href = 'privacy.pdf';
  link.textContent = '直接阅读隐私政策原版';
  status.append(link, document.createTextNode('。'));
}
