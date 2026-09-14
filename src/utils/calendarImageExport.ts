import { toPng } from 'html-to-image';

export interface CalendarImageExportOptions {
  filename?: string;
  download?: boolean;
  pixelRatio?: number;
}

/**
 * Captures a calendar container DOM element as a high-resolution PNG image.
 * Optionally triggers a file download and returns the base64 data URL.
 */
export async function exportCalendarAsImage(
  targetElementOrId: HTMLElement | string,
  options: CalendarImageExportOptions = {}
): Promise<{ dataUrl: string; filename: string }> {
  const target: HTMLElement | null =
    typeof targetElementOrId === 'string'
      ? document.getElementById(targetElementOrId)
      : targetElementOrId;

  if (!target) {
    throw new Error('Target calendar element not found for image export.');
  }

  const {
    filename = `Calendar_Export_${new Date().toISOString().slice(0, 10)}.png`,
    download = true,
    pixelRatio = 2,
  } = options;

  // Filter out UI elements marked with .no-export
  const filter = (node: HTMLElement) => {
    if (node.classList && typeof node.classList.contains === 'function') {
      if (node.classList.contains('no-export')) {
        return false;
      }
    }
    return true;
  };

  try {
    const dataUrl = await toPng(target, {
      pixelRatio,
      backgroundColor: '#ffffff',
      filter: filter as any,
      cacheBust: true,
      style: {
        borderRadius: '0px',
      },
    });

    if (download) {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    return { dataUrl, filename };
  } catch (error: any) {
    console.error('Error generating calendar image with html-to-image:', error);
    throw new Error(`Failed to export calendar image: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Convenience helper to capture target element as base64 without downloading.
 */
export async function captureCalendarElementAsBase64(
  targetElementOrId: HTMLElement | string,
  _titlePrefix?: string
): Promise<string> {
  const { dataUrl } = await exportCalendarAsImage(targetElementOrId, {
    download: false,
    pixelRatio: 2,
  });
  return dataUrl;
}

/**
 * Convenience helper to export and trigger download of calendar image directly.
 */
export async function downloadCalendarImageDirectly(
  targetElementOrId: HTMLElement | string,
  filename?: string,
  _titlePrefix?: string
): Promise<string> {
  const { dataUrl } = await exportCalendarAsImage(targetElementOrId, {
    download: true,
    filename,
    pixelRatio: 2,
  });
  return dataUrl;
}
